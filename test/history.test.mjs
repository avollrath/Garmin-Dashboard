import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeRun, shiftDate } from "../src/history.mjs";

test("date windows stay correct across month, leap-day, and DST boundaries", () => {
  assert.equal(shiftDate("2026-10-24", -89), "2026-07-27");
  assert.equal(shiftDate("2024-03-01", -1), "2024-02-29");
  assert.equal(shiftDate("2026-10-25", 1), "2026-10-26");
});

test("normalization excludes profile and GPS while preserving missing and zero metrics", () => {
  const run = normalizeRun({
    activityId: 123, activityName: "Morning run", startTimeLocal: "2026-10-24 08:30:00",
    distance: 5000, duration: 1500, elevationGain: 0, averageHR: 0,
    averageRunningCadenceInStepsPerMinute: NaN, aerobicTrainingEffect: 0,
    ownerFullName: "Private", startLatitude: 50, startLongitude: 30, hrTimeInZone_1: 0,
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
  assert.throws(() => normalizeRun({ activityId: 0 }), /invalid ID or local timestamp/);
  assert.throws(() => normalizeRun({ activityId: 1, startTimeLocal: "bad" }), /invalid ID/);
});
