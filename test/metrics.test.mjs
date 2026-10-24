import assert from "node:assert/strict";
import { test } from "node:test";
import {
  duration,
  inRange,
  pace,
  periodRange,
  summarize,
  groupRuns,
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
  const range = periodRange("7", "2026-10-24");
  assert.deepEqual(inRange(candidates, range.start, range.end), runs);
});

test("weekly buckets include rest weeks, use Monday, and cross year boundaries", () => {
  const buckets = groupRuns(
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

test("calendar year includes leap day and excludes adjacent years", () => {
  const range = periodRange("year:2024", "2026-10-24", "2020-11-04");
  assert.deepEqual(range, {
    start: "2024-01-01",
    end: "2024-12-31",
    label: "2024",
    unit: "month",
  });
  const leapRun = { ...runs[0], startLocal: "2024-02-29T08:00:00" };
  const candidates = [
    leapRun,
    { ...runs[0], startLocal: "2023-12-31T23:59:59" },
    { ...runs[0], startLocal: "2025-01-01T00:00:00" },
  ];
  assert.deepEqual(inRange(candidates, range.start, range.end), [leapRun]);
  const months = groupRuns(candidates, range.start, range.end, range.unit);
  assert.equal(months.length, 12);
  assert.equal(months[1].km, 5);
  assert.equal(
    months.reduce((sum, month) => sum + month.km, 0),
    5,
  );
});

test("current calendar year ends today while all-time includes earliest imported run", () => {
  assert.equal(periodRange("year:2026", "2026-10-24").end, "2026-10-24");
  const range = periodRange("all", "2026-10-24", "2020-11-04");
  assert.equal(range.start, "2020-11-04");
  assert.equal(range.end, "2026-10-24");
  const oldRun = { ...runs[0], startLocal: "2020-11-04T08:00:00" };
  const allRuns = [oldRun, ...runs];
  assert.equal(inRange(allRuns, range.start, range.end).length, 3);
  const years = groupRuns(allRuns, range.start, range.end, range.unit);
  assert.equal(years.length, 7);
  assert.deepEqual(
    years.map((year) => year.km),
    [5, 0, 0, 0, 0, 0, 15],
  );
});

test("partial calendar buckets exclude records before selected start and after today", () => {
  const months = groupRuns(
    [
      { ...runs[0], startLocal: "2020-11-03T08:00:00" },
      { ...runs[0], startLocal: "2020-11-04T08:00:00" },
      { ...runs[0], startLocal: "2020-11-10T08:00:00" },
    ],
    "2020-11-04",
    "2020-11-09",
    "month",
  );
  assert.equal(months[0].count, 1);
  assert.equal(months[0].km, 5);
});

test("formatting carries rounded seconds and minutes without invalid values", () => {
  assert.equal(pace(359.8), "6:00");
  assert.equal(pace(Infinity), "—");
  assert.equal(duration(3599), "1h 00m");
  assert.equal(duration(0), "0m");
});
