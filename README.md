# Garmin Dashboard

Running dashboard using Garmin's official Connect Personal API. Development
proceeds one step at a time, with a separate commit for each completed step.

## Step 1: Connect your Garmin account

Requires Node.js 22.9 or newer. This step has no package dependencies.

1. Sign in to [Garmin Connect's Personal API Key page](https://connect.garmin.com/app/settings/personalApiToken).
2. Select **Create Key**, review Garmin's terms, choose an expiration, and create the key.
3. Copy `.env.example` to `.env` if `.env` does not already exist. Set
   `GARMIN_PERSONAL_API_KEY` to your key. Keep the key out of chat and Git.
4. From this repository, run:

   ```powershell
   npm.cmd run garmin:check
   ```

   Use `npm run garmin:check` on macOS/Linux. `npm.cmd` avoids PowerShell's
   script execution policy without changing system settings.

The check exchanges your key for a bearer token and reads at most one activity to
verify data access. It prints status only. Credentials and activity details stay in
memory; `.env`, local data, and caches are ignored by Git.

Garmin returns the token as plain text. Tokens last up to 24 hours, limited by key
expiration; there is no refresh token. This one-off check obtains a fresh token
each run. The dashboard reuses its token in memory until renewal is needed.

This connects repository code to your account. It does not install a persistent
Garmin connector in ChatGPT. During work in this repository, the coding agent can
run local code to read your data.

## Step 2: Import your running history

```powershell
npm.cmd run garmin:sync
```

Imports the last 90 calendar days of running activities, including running subtypes
returned by Garmin. Pagination fetches the full range. Data lives in ignored
`data/runs.json`; only training fields are retained, without profile or GPS fields.
Activity names may still contain place names. Failed imports preserve the last
complete snapshot. Tokens are reused in process memory until renewal is needed.

Distances remain in meters and times in seconds; the dashboard converts for display.
Activity dates use Garmin's recorded local time. The import window uses Europe/Kyiv.

## Step 3: Open your dashboard

```powershell
npm.cmd start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). No install or build is needed.
Use `npm.cmd run dev` for automatic server restarts during development; reload the
browser after frontend edits. Stop either command with Ctrl+C.

- Select 7, 28, or 90 days for distance, timer time, average pace, and run totals.
- View weekly mileage, a 90-day consistency calendar, and Garmin heart rate zones.
- Search and sort your run log; select a run for cadence, elevation, and training metrics.
- Select **Sync Garmin** after your watch syncs to Garmin Connect. Saved data stays
  available if refresh fails. Opening the dashboard reads the snapshot without calling Garmin.

Pace is total timer time divided by distance for runs with both values. Paused time
is excluded according to Garmin's timer duration. Missing sensor values display as
`—`. Distance change compares the prior equal period only when the imported range
covers it. Partial weeks are labeled. No coaching scores or recovery estimates are invented.

Server binds to `127.0.0.1`; credentials never reach browser code. To use another
local port, add `PORT=3001` to `.env` and restart. This server is for local use.

## Step 4: Validate

```powershell
npm.cmd test
```

Tests use synthetic data and require neither credentials nor network access.

Checks cover token reuse, sanitized errors, pace and heart rate weighting, missing
sensors, date boundaries, weekly buckets, and local HTTP access restrictions.
The HTTP test also verifies failed refresh leaves the saved snapshot available.
Live authentication, history import, and dashboard refresh were verified during
setup. Browser visual QA was unavailable in this session; responsive layout and
browser interactions still need a visual check.

Hosting and scheduled synchronization can be decided separately.

## Official references

- [Personal API setup](https://developer.garmin.com/gc-developer-program/personal/personal-api/)
- [Personal API FAQ](https://developer.garmin.com/gc-developer-program/personal/personal-faq/)
- [API endpoint documentation](https://developer.garmin.com/gc-developer-program/personal/swagger-docs/)
- [Garmin's reference client](https://github.com/garmin/connect-personal-api-python)
