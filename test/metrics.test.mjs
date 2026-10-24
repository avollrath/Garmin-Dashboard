import assert from "node:assert/strict";
import { test } from "node:test";
import {
  duration,
  inRange,
  pace,
  summarize,
  weeks,
} from "../public/metrics.mjs";

const runs = [
  {
    startLocal: "2026-10-24T08:00:00",
    distanceMeters: 5000,
    durationSeconds: 1500,
    averageHr: 150,
    hrZoneSeconds: [0, 600, 900, null, null],
  },
  {
    startLocal: "2026-10-18T09:00:00",
    distanceMeters: 10000,
    durationSeconds: 3600,
    averageHr: 160,
    hrZoneSeconds: [100, 2500, 1000, 0, 0],
  },
];

test("pace is distance-weighted and heart rate is time-weighted", () => {
  const summary = summarize(runs);
  assert.equal(summary.km, 15);
  assert.equal(summary.pace, 340);
  assert.equal(summary.averageHr, (150 * 1500 + 160 * 3600) / 5100);
  assert.deepEqual(summary.zones, [100, 3100, 1900, 0, 0]);
});

test("missing sensors and zero-distance activities cannot invent pace or heart rate", () => {
  const result = summarize([
    {
      startLocal: "2026-10-24T09:00:00",
      distanceMeters: 0,
      durationSeconds: 300,
      averageHr: null,
    },
  ]);
  assert.equal(result.pace, null);
  assert.equal(result.averageHr, null);
  assert.equal(pace(result.pace), "—");
  assert.equal(duration(null), "—");
  assert.equal(summarize([]).pace, null);
});

test("seven-day window includes both boundary days and excludes future runs", () => {
  const candidates = [
    ...runs,
    { startLocal: "2026-10-17T23:59:59" },
    { startLocal: "2026-10-25T00:00:00" },
  ];
  assert.deepEqual(inRange(candidates, "2026-10-24", 7), runs);
});

test("weekly buckets include rest weeks, use Monday, and cross year boundaries", () => {
  const buckets = weeks(
    [{ ...runs[0], startLocal: "2026-01-05T08:00:00" }],
    "2025-12-31",
    "2026-01-06",
  );
  assert.deepEqual(
    buckets.map((week) => [week.date, week.km]),
    [
      ["2025-12-29", 0],
      ["2026-01-05", 5],
    ],
  );
});

test("formatting carries rounded seconds and minutes without invalid values", () => {
  assert.equal(pace(359.8), "6:00");
  assert.equal(pace(Infinity), "—");
  assert.equal(duration(3599), "1h 00m");
  assert.equal(duration(0), "0m");
});
