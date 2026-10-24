import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { getActivities } from "./garmin.mjs";
import { shiftDate } from "../public/metrics.mjs";

const dataFile = new URL("../data/runs.json", import.meta.url);
let syncInProgress;

export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(
    new Date(),
  );
}

function metric(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

export function normalizeRun(activity) {
  if (
    !Number.isSafeInteger(activity.activityId) ||
    activity.activityId <= 0 ||
    !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(activity.startTimeLocal)
  ) {
    throw new Error(
      "Garmin returned a run with an invalid ID or local timestamp.",
    );
  }
  return {
    id: activity.activityId,
    name:
      typeof activity.activityName === "string" ? activity.activityName : "Run",
    startLocal: activity.startTimeLocal.replace(" ", "T"),
    type: activity.activityType?.typeKey ?? "running",
    distanceMeters: metric(activity.distance),
    durationSeconds: metric(activity.duration),
    movingSeconds: metric(activity.movingDuration),
    elevationMeters: metric(activity.elevationGain),
    averageHr: metric(activity.averageHR) || null,
    maxHr: metric(activity.maxHR) || null,
    cadenceSpm: metric(activity.averageRunningCadenceInStepsPerMinute) || null,
    aerobicEffect: metric(activity.aerobicTrainingEffect),
    anaerobicEffect: metric(activity.anaerobicTrainingEffect),
    trainingLoad: metric(activity.activityTrainingLoad),
    hrZoneSeconds: [1, 2, 3, 4, 5].map((zone) =>
      metric(activity[`hrTimeInZone_${zone}`]),
    ),
  };
}

export async function readHistory() {
  try {
    const history = JSON.parse(await readFile(dataFile, "utf8"));
    if (history.version !== 1 || !Array.isArray(history.runs))
      throw new Error();
    return history;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(
      "Cannot read local running data. Run npm run garmin:sync to rebuild it.",
    );
  }
}

export function syncHistory() {
  if (!syncInProgress) {
    syncInProgress = importHistory().finally(() => {
      syncInProgress = undefined;
    });
  }
  return syncInProgress;
}

async function importHistory() {
  const endDate = today();
  const startDate = shiftDate(endDate, -89);
  const runs = new Map();
  let completed = false;
  for (let page = 0; page < 100; page++) {
    const activities = await getActivities({
      start: page * 100,
      limit: 100,
      activityType: "running",
      startDate,
      endDate,
    });
    for (const activity of activities) {
      const run = normalizeRun(activity);
      const date = run.startLocal.slice(0, 10);
      if (date >= startDate && date <= endDate) runs.set(run.id, run);
    }
    if (activities.length < 100) {
      completed = true;
      break;
    }
  }
  if (!completed)
    throw new Error(
      "Garmin pagination limit reached; existing data was preserved.",
    );
  const history = {
    version: 1,
    syncedAt: new Date().toISOString(),
    startDate,
    endDate,
    runs: [...runs.values()].sort((a, b) =>
      b.startLocal.localeCompare(a.startLocal),
    ),
  };
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  // Replace only after every page succeeds; failed imports preserve the previous snapshot.
  const tempFile = new URL("../data/runs.json.tmp", import.meta.url);
  await writeFile(tempFile, `${JSON.stringify(history, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(tempFile, dataFile);
  return history;
}
