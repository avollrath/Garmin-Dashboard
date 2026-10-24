import { authenticate, getActivities } from "../src/garmin.mjs";

try {
  await authenticate();
  console.log("Personal API authentication: OK");

  const activities = await getActivities({ start: 0, limit: 1 });

  console.log("Activity data access: OK");
  console.log(activities.length ? "Latest activity found." : "No activities found yet.");
  console.log("Credentials and activity details were not printed or saved.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Garmin connection check failed.");
  process.exitCode = 1;
}
