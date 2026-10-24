import assert from "node:assert/strict";
import { test } from "node:test";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeRun } from "../src/history.mjs";
import { shiftDate } from "../public/metrics.mjs";

test("date windows stay correct across month, leap-day, and DST boundaries", () => {
  assert.equal(shiftDate("2026-10-24", -89), "2026-07-27");
  assert.equal(shiftDate("2024-03-01", -1), "2024-02-29");
  assert.equal(shiftDate("2026-10-25", 1), "2026-10-26");
});

test("full-history import paginates, deduplicates, and preserves snapshot on failure", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "garmin-history-test-"));
  t.after(async () => {
    assert.ok(directory.startsWith(join(tmpdir(), "garmin-history-test-")));
    await rm(directory, { recursive: true, force: true });
  });
  await mkdir(join(directory, "src"));
  for (const file of ["history.mjs", "garmin.mjs"]) {
    await copyFile(
      new URL(`../src/${file}`, import.meta.url),
      join(directory, "src", file),
    );
  }
  const originalKey = process.env.GARMIN_PERSONAL_API_KEY;
  process.env.GARMIN_PERSONAL_API_KEY = "test-key";
  t.after(() => {
    if (originalKey === undefined) delete process.env.GARMIN_PERSONAL_API_KEY;
    else process.env.GARMIN_PERSONAL_API_KEY = originalKey;
  });
  const page = Array.from({ length: 100 }, (_, i) => ({
    activityId: i + 1,
    startTimeLocal: "2020-12-31 08:00:00",
    distance: 5000,
    duration: 1800,
  }));
  let mode = "complete";
  const offsets = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (options.method === "POST") {
      const payload = Buffer.from(
        JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
      ).toString("base64url");
      return new Response(`header.${payload}.signature`);
    }
    const params = new URL(url).searchParams;
    assert.equal(params.has("startDate"), false);
    const offset = Number(params.get("start"));
    offsets.push(offset);
    if (offset === 0 || mode === "repeat") return Response.json(page);
    if (mode === "fail") return new Response("private-body", { status: 503 });
    return Response.json([
      { ...page[0], activityId: 101, startTimeLocal: "2019-02-01 08:00:00" },
      page[0],
    ]);
  });
  const { readHistory, syncHistory } = await import(
    pathToFileURL(join(directory, "src/history.mjs"))
  );
  assert.equal(await readHistory(), null);
  const history = await syncHistory();
  assert.deepEqual(offsets, [0, 100]);
  assert.equal(history.scope, "all");
  assert.equal(history.startDate, "2019-02-01");
  assert.equal(history.runs.length, 101);
  const snapshot = await readFile(join(directory, "data/runs.json"), "utf8");
  mode = "fail";
  await assert.rejects(syncHistory, /HTTP 503/);
  assert.equal(
    await readFile(join(directory, "data/runs.json"), "utf8"),
    snapshot,
  );
  mode = "repeat";
  await assert.rejects(syncHistory, /pagination made no progress/);
  assert.equal(
    await readFile(join(directory, "data/runs.json"), "utf8"),
    snapshot,
  );
});

test("normalization excludes profile and GPS while preserving missing and zero metrics", () => {
  const run = normalizeRun({
    activityId: 123,
    activityName: "Morning run",
    startTimeLocal: "2026-10-24 08:30:00",
    distance: 5000,
    duration: 1500,
    elevationGain: 0,
    averageHR: 0,
    averageRunningCadenceInStepsPerMinute: NaN,
    aerobicTrainingEffect: 0,
    ownerFullName: "Private",
    startLatitude: 50,
    startLongitude: 30,
    hrTimeInZone_1: 0,
  });
  assert.equal(run.startLocal, "2026-10-24T08:30:00");
  assert.equal(run.elevationMeters, 0);
  assert.equal(run.aerobicEffect, 0);
  assert.equal(run.averageHr, null);
  assert.equal(run.cadenceSpm, null);
  assert.equal(run.movingSeconds, null);
  assert.deepEqual(run.hrZoneSeconds, [0, null, null, null, null]);
  assert.ok(!("ownerFullName" in run));
  assert.ok(!("startLatitude" in run));
  assert.ok(!("startLongitude" in run));
});

test("malformed activity cannot replace valid history silently", () => {
  assert.throws(
    () => normalizeRun({ activityId: 0 }),
    /invalid ID or local timestamp/,
  );
  assert.throws(
    () => normalizeRun({ activityId: 1, startTimeLocal: "bad" }),
    /invalid ID/,
  );
});
