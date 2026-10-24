import { shiftDate, summarize } from "./metrics.mjs";

export function runPace(run) {
  return run.distanceMeters > 0 && run.durationSeconds > 0
    ? (run.durationSeconds / run.distanceMeters) * 1000
    : null;
}

function record(items, value, direction = 1) {
  let best = null;
  let bestValue;
  for (const item of items) {
    const candidate = value(item);
    if (
      Number.isFinite(candidate) &&
      candidate >= 0 &&
      (best === null || direction * (candidate - bestValue) > 0)
    ) {
      best = item;
      bestValue = candidate;
    }
  }
  return best;
}

export function funStats(runs, minimumDistance = 1000) {
  const sorted = [...runs].sort(
    (a, b) => a.startLocal.localeCompare(b.startLocal) || a.id - b.id,
  );
  const paceRuns = sorted.filter(
    (run) => run.distanceMeters >= minimumDistance && runPace(run) !== null,
  );
  const days = new Map(),
    weeks = new Map(),
    months = new Map(),
    years = new Map();
  const weekdays = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ].map((label) => ({ label, count: 0 }));
  const times = [
    "Night · 00–06",
    "Morning · 06–12",
    "Afternoon · 12–18",
    "Evening · 18–24",
  ].map((label) => ({ label, count: 0 }));
  const distances = ["Under 5 km", "5–10 km", "10–20 km", "20 km+"].map(
    (label) => ({ label, count: 0 }),
  );
  for (const run of sorted) {
    const date = run.startLocal.slice(0, 10);
    const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
    weekdays[weekday].count++;
    times[Math.floor(Number(run.startLocal.slice(11, 13)) / 6)].count++;
    if (Number.isFinite(run.distanceMeters) && run.distanceMeters >= 0) {
      const bucket =
        run.distanceMeters < 5000
          ? 0
          : run.distanceMeters < 10000
            ? 1
            : run.distanceMeters < 20000
              ? 2
              : 3;
      distances[bucket].count++;
    }
    for (const [groups, key] of [
      [days, date],
      [weeks, shiftDate(date, -weekday)],
      [months, date.slice(0, 7)],
      [years, date.slice(0, 4)],
    ]) {
      const group = groups.get(key) ?? { date: key, km: null, count: 0 };
      if (Number.isFinite(run.distanceMeters) && run.distanceMeters >= 0) {
        group.km = (group.km ?? 0) + run.distanceMeters / 1000;
      }
      group.count++;
      groups.set(key, group);
    }
  }

  const dates = [...days.keys()];
  let streakStart,
    streakDays = 0;
  let longestStreak = { days: 0, start: null, end: null };
  let longestPause = null;
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    if (i > 0 && shiftDate(dates[i - 1], 1) === date) streakDays++;
    else {
      streakStart = date;
      streakDays = 1;
    }
    if (streakDays > longestStreak.days)
      longestStreak = { days: streakDays, start: streakStart, end: date };
    if (i > 0) {
      const gap =
        (Date.parse(`${date}T12:00:00Z`) -
          Date.parse(`${dates[i - 1]}T12:00:00Z`)) /
          86_400_000 -
        1;
      if (gap > 0 && (!longestPause || gap > longestPause.days)) {
        longestPause = {
          days: gap,
          start: shiftDate(dates[i - 1], 1),
          end: shiftDate(date, -1),
        };
      }
    }
  }

  return {
    total: summarize(sorted),
    first: sorted[0] ?? null,
    latest: sorted.at(-1) ?? null,
    fastest: record(paceRuns, runPace, -1),
    slowest: record(paceRuns, runPace),
    longest: record(sorted, (run) => run.distanceMeters),
    longestTime: record(sorted, (run) => run.durationSeconds),
    mostClimbing: record(sorted, (run) => run.elevationMeters),
    earliestStart: record(
      sorted,
      (run) =>
        Number(run.startLocal.slice(11, 13)) * 60 +
        Number(run.startLocal.slice(14, 16)),
      -1,
    ),
    latestStart: record(
      sorted,
      (run) =>
        Number(run.startLocal.slice(11, 13)) * 60 +
        Number(run.startLocal.slice(14, 16)),
    ),
    longestStreak,
    longestPause,
    biggestDay: record([...days.values()], (group) => group.km),
    biggestWeek: record([...weeks.values()], (group) => group.km),
    biggestMonth: record([...months.values()], (group) => group.km),
    biggestYear: record([...years.values()], (group) => group.km),
    busiestDay: record([...days.values()], (group) => group.count),
    weekdays,
    times,
    distances,
    milestones: [5000, 10000, 21097.5, 42195].map((meters) => ({
      meters,
      run: sorted.find((run) => run.distanceMeters >= meters) ?? null,
    })),
  };
}
