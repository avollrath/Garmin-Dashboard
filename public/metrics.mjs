export function shiftDate(date, days) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function inRange(runs, endDate, days) {
  const start = shiftDate(endDate, 1 - days);
  return runs.filter(
    (run) =>
      run.startLocal.slice(0, 10) >= start &&
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

export function weeks(runs, startDate, endDate) {
  const start = new Date(`${startDate}T12:00:00Z`);
  const monday = shiftDate(startDate, -((start.getUTCDay() + 6) % 7));
  const result = [];
  for (let date = monday; date <= endDate; date = shiftDate(date, 7)) {
    const end = shiftDate(date, 6);
    const group = runs.filter((run) => {
      const day = run.startLocal.slice(0, 10);
      return day >= date && day <= end;
    });
    result.push({ date, ...summarize(group) });
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
