export function shiftDate(date, days) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function periodRange(period, today, historyStart = today) {
  if (period === "all") {
    return { start: historyStart, end: today, label: "All time", unit: "year" };
  }
  if (/^year:\d{4}$/.test(period)) {
    const year = period.slice(5);
    return {
      start: `${year}-01-01`,
      end: `${year}-12-31` < today ? `${year}-12-31` : today,
      label: year,
      unit: "month",
    };
  }
  const days = Number(period);
  if (![7, 28, 90].includes(days)) throw new Error("Unknown training period.");
  return {
    start: shiftDate(today, 1 - days),
    end: today,
    label: `${days} days`,
    unit: "week",
  };
}

export function inRange(runs, startDate, endDate) {
  return runs.filter(
    (run) =>
      run.startLocal.slice(0, 10) >= startDate &&
      run.startLocal.slice(0, 10) <= endDate,
  );
}

export function summarize(runs) {
  let distance = 0,
    seconds = 0,
    paceDistance = 0,
    paceSeconds = 0;
  let hrSeconds = 0,
    hrTotal = 0,
    elevation = 0;
  const zones = [0, 0, 0, 0, 0];
  for (const run of runs) {
    distance += run.distanceMeters ?? 0;
    seconds += run.durationSeconds ?? 0;
    elevation += run.elevationMeters ?? 0;
    if (run.distanceMeters > 0 && run.durationSeconds > 0) {
      paceDistance += run.distanceMeters;
      paceSeconds += run.durationSeconds;
    }
    if (run.averageHr > 0 && run.durationSeconds > 0) {
      hrSeconds += run.durationSeconds;
      hrTotal += run.averageHr * run.durationSeconds;
    }
    run.hrZoneSeconds?.forEach((value, i) => {
      zones[i] += value ?? 0;
    });
  }
  return {
    count: runs.length,
    km: distance / 1000,
    seconds,
    elevation,
    pace: paceDistance ? (paceSeconds / paceDistance) * 1000 : null,
    averageHr: hrSeconds ? hrTotal / hrSeconds : null,
    longestKm: runs.length
      ? Math.max(...runs.map((run) => run.distanceMeters ?? 0)) / 1000
      : 0,
    days: new Set(runs.map((run) => run.startLocal.slice(0, 10))).size,
    zones,
  };
}

export function groupRuns(runs, startDate, endDate, unit = "week") {
  const start = new Date(`${startDate}T12:00:00Z`);
  const first =
    unit === "year"
      ? `${startDate.slice(0, 4)}-01-01`
      : unit === "month"
        ? `${startDate.slice(0, 7)}-01`
        : shiftDate(startDate, -((start.getUTCDay() + 6) % 7));
  const result = [];
  for (let date = first; date <= endDate; ) {
    const next = new Date(`${date}T12:00:00Z`);
    if (unit === "year") next.setUTCFullYear(next.getUTCFullYear() + 1);
    else if (unit === "month") next.setUTCMonth(next.getUTCMonth() + 1);
    else next.setUTCDate(next.getUTCDate() + 7);
    const nextDate = next.toISOString().slice(0, 10);
    const group = runs.filter((run) => {
      const day = run.startLocal.slice(0, 10);
      return (
        day >= date && day < nextDate && day >= startDate && day <= endDate
      );
    });
    result.push({ date, ...summarize(group) });
    date = nextDate;
  }
  return result;
}

export function pace(seconds) {
  if (!(seconds > 0) || !Number.isFinite(seconds)) return "—";
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

export function duration(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const minutes = Math.round(seconds / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`
    : `${minutes}m`;
}
