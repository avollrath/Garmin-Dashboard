import assert from "node:assert/strict";
import { test } from "node:test";
import { funStats, runPace } from "../public/fun-stats.mjs";
import { inRange } from "../public/metrics.mjs";

function run(id, startLocal, distanceMeters = 5000, durationSeconds = 1800) {
  return {
    id,
    name: `Run ${id}`,
    startLocal,
    distanceMeters,
    durationSeconds,
    elevationMeters: null,
  };
}

test("pace records use whole-run pace, exclude missing/zero data, and honor distance filter", () => {
  const runs = [
    run(1, "2026-01-03T09:00:00", 500, 30),
    run(2, "2026-01-02T09:00:00", 5000, 1500),
    run(3, "2026-01-01T09:00:00", 10000, 2400),
    run(4, "2026-01-04T09:00:00", 5000, 3000),
    run(5, "2026-01-05T09:00:00", 0, 500),
    run(6, "2026-01-06T09:00:00", 5000, null),
    run(7, "2026-01-07T09:00:00", null, 200),
  ];
  const result = funStats(runs);
  assert.equal(result.fastest.id, 3);
  assert.equal(result.slowest.id, 4);
  assert.equal(result.longest.id, 3);
  assert.equal(result.longestTime.id, 4);
  assert.equal(runPace(result.fastest), 240);
  assert.equal(funStats(runs, 0).fastest.id, 1);
  assert.equal(funStats(runs, 10000).slowest.id, 3);
  assert.equal(funStats(runs, 21097.5).fastest, null);
  assert.deepEqual(
    runs.map((item) => item.id),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.equal(result.first.id, 3);
  assert.equal(result.latest.id, 7);
});

test("streak counts distinct running dates across leap day and DST, with earliest tie winning", () => {
  const result = funStats([
    run(1, "2024-02-28T08:00:00"),
    run(2, "2024-02-29T08:00:00"),
    run(3, "2024-02-29T17:00:00"),
    run(4, "2024-03-01T08:00:00"),
    run(5, "2024-03-03T08:00:00"),
    run(6, "2024-10-26T08:00:00"),
    run(7, "2024-10-27T08:00:00"),
    run(8, "2024-10-28T08:00:00"),
  ]);
  assert.deepEqual(result.longestStreak, {
    days: 3,
    start: "2024-02-28",
    end: "2024-03-01",
  });
  assert.deepEqual(result.longestPause, {
    days: 236,
    start: "2024-03-04",
    end: "2024-10-25",
  });
  assert.equal(result.total.days, 7);
});

test("year views clip streaks at period boundaries and pauses count only intervening days", () => {
  const runs = [
    run(1, "2025-12-30T08:00:00"),
    run(2, "2025-12-31T08:00:00"),
    run(3, "2026-01-01T08:00:00"),
  ];
  assert.equal(funStats(runs).longestStreak.days, 3);
  assert.equal(
    funStats(inRange(runs, "2026-01-01", "2026-12-31")).longestStreak.days,
    1,
  );
  assert.equal(funStats(runs).longestPause, null);
  assert.deepEqual(funStats([runs[0], runs[2]]).longestPause, {
    days: 1,
    start: "2025-12-31",
    end: "2025-12-31",
  });
});

test("distance records sum multiple runs and Monday weeks can cross calendar years", () => {
  const result = funStats([
    run(4, "2026-01-05T17:00:00", 2000),
    run(2, "2026-01-04T08:00:00", 7000),
    run(1, "2025-12-31T08:00:00", 5000),
    run(3, "2026-01-05T08:00:00", 10000),
  ]);
  assert.deepEqual(result.biggestDay, { date: "2026-01-05", km: 12, count: 2 });
  assert.deepEqual(result.biggestWeek, {
    date: "2025-12-29",
    km: 12,
    count: 2,
  });
  assert.deepEqual(result.biggestMonth, { date: "2026-01", km: 19, count: 3 });
  assert.deepEqual(result.biggestYear, { date: "2026", km: 19, count: 3 });
  assert.equal(result.busiestDay.count, 2);
  assert.equal(result.weekdays[0].count, 2);
  assert.equal(result.weekdays[6].count, 1);
});

test("local time habits handle midnight and exact six-hour boundaries", () => {
  const result = funStats(
    [
      "00:00",
      "05:59",
      "06:00",
      "11:59",
      "12:00",
      "17:59",
      "18:00",
      "23:59",
    ].map((time, i) => run(i + 1, `2026-01-05T${time}:00`)),
  );
  assert.deepEqual(
    result.times.map((bucket) => bucket.count),
    [2, 2, 2, 2],
  );
  assert.equal(result.earliestStart.startLocal.slice(11, 16), "00:00");
  assert.equal(result.latestStart.startLocal.slice(11, 16), "23:59");
  assert.equal(result.longestStreak.days, 1);
});

test("distance bins do not overlap and missing distance is not counted", () => {
  const result = funStats(
    [4999, 5000, 9999, 10000, 19999, 20000, null].map((meters, i) =>
      run(i + 1, "2026-01-05T08:00:00", meters),
    ),
  );
  assert.deepEqual(
    result.distances.map((bucket) => bucket.count),
    [1, 2, 2, 1],
  );
});

test("milestones require actual threshold distance without extrapolating split records", () => {
  const result = funStats(
    [4999, 5000, 9999, 10000, 21097.49, 21097.5, 42194.99, 42195].map(
      (meters, i) => run(i + 1, `2026-01-0${i + 1}T08:00:00`, meters),
    ),
  );
  assert.deepEqual(
    result.milestones.map((milestone) => milestone.run.id),
    [2, 4, 6, 8],
  );
});

test("empty history and missing sensors do not produce invented records", () => {
  const empty = funStats([]);
  assert.equal(empty.first, null);
  assert.equal(empty.latest, null);
  assert.equal(empty.fastest, null);
  assert.equal(empty.longestStreak.days, 0);
  assert.equal(empty.biggestDay, null);
  assert.ok(empty.milestones.every((milestone) => milestone.run === null));
  const missing = funStats([run(1, "2026-01-01T08:00:00", null, null)]);
  assert.equal(missing.longest, null);
  assert.equal(missing.longestTime, null);
  assert.equal(missing.mostClimbing, null);
  assert.equal(missing.biggestWeek, null);
});
