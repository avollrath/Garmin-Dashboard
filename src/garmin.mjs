const baseUrl = "https://personal.connectapi.garmin.com";
let token;

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error("Cannot reach Garmin. Check your network and try again.");
  }
  if (!response.ok) {
    let guidance = "Try again later.";
    if (response.status === 401 || response.status === 403) {
      token = undefined;
      guidance = "Check your Personal API key and its expiration in Garmin Connect.";
    } else if (response.status === 429) {
      guidance = "Rate limit reached. Wait before retrying.";
    }
    throw new Error(`Garmin returned HTTP ${response.status}. ${guidance}`);
  }
  return response;
}

export async function authenticate() {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const apiKey = process.env.GARMIN_PERSONAL_API_KEY?.trim();
  if (!apiKey) throw new Error("Set GARMIN_PERSONAL_API_KEY in .env, then restart or retry.");
  const response = await request(
    "/personalapitoken-service/personal-api/personal-api-key/token",
    { method: "POST", headers: { Authorization: `ApiKey ${apiKey}` } },
  );
  // The official endpoint returns a plain-text JWT.
  const value = (await response.text()).trim();
  let expiresAt;
  try {
    if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(value)) throw new Error();
    const payload = JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString());
    expiresAt = payload.exp * 1_000;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error();
  } catch {
    throw new Error("Garmin returned an unexpected or expired token.");
  }
  token = { value, expiresAt };
  return value;
}

export async function getActivities(params) {
  const accessToken = await authenticate();
  const response = await request(
    `/activitylist-service/activities/search/activities?${new URLSearchParams(params)}`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
  );
  let activities;
  try {
    activities = await response.json();
  } catch {
    throw new Error("Garmin returned unreadable activity data. Try again later.");
  }
  if (!Array.isArray(activities)) {
    throw new Error("Garmin returned an unexpected activity response format.");
  }
  return activities;
}
