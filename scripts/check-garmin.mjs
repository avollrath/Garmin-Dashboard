// Official endpoints: https://developer.garmin.com/gc-developer-program/personal/personal-api/
const baseUrl = "https://personal.connectapi.garmin.com";

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("Cannot reach Garmin. Check your network and try again.");
  }

  if (!response.ok) {
    let guidance = "Try again later.";
    if (response.status === 401 || response.status === 403) {
      guidance = "Check your Personal API key and its expiration in Garmin Connect.";
    } else if (response.status === 429) {
      guidance = "Rate limit reached. Wait before retrying.";
    }
    // Response bodies can contain personal data; never include them in errors.
    throw new Error(`Garmin returned HTTP ${response.status}. ${guidance}`);
  }

  return response;
}

try {
  const apiKey = process.env.GARMIN_PERSONAL_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Set GARMIN_PERSONAL_API_KEY in .env, then run npm run garmin:check.");
  }

  const tokenResponse = await request(
    "/personalapitoken-service/personal-api/personal-api-key/token",
    { method: "POST", headers: { Authorization: `ApiKey ${apiKey}` } },
  );
  // Garmin returns the bearer token as plain text, not a JSON token object.
  const accessToken = (await tokenResponse.text()).trim();
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(accessToken)) {
    throw new Error("Garmin returned an unexpected token format.");
  }
  console.log("Personal API authentication: OK");

  const activitiesResponse = await request(
    "/activitylist-service/activities/search/activities?start=0&limit=1",
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
  );
  let activities;
  try {
    activities = await activitiesResponse.json();
  } catch {
    throw new Error("Garmin returned unreadable activity data. Try again later.");
  }
  if (!Array.isArray(activities)) {
    throw new Error("Garmin returned an unexpected activity response format.");
  }

  console.log("Activity data access: OK");
  console.log(activities.length ? "Latest activity found." : "No activities found yet.");
  console.log("Credentials and activity details were not printed or saved.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Garmin connection check failed.");
  process.exitCode = 1;
}
