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

Imports your full running history, including running subtypes returned by Garmin.
Pagination continues until all available activities are fetched. Data lives in ignored
`data/runs.json`; only training fields are retained, without profile or GPS fields.
Activity names may still contain place names. Failed imports preserve the last
complete snapshot. Tokens are reused in process memory until renewal is needed.

Distances remain in meters and times in seconds; the dashboard converts for display.
Activity dates use Garmin's recorded local time. The import ends at today's date in Europe/Kyiv.

## Step 3: Open your dashboard

```powershell
npm.cmd start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). No install or build is needed.
Use `npm.cmd run dev` for automatic server restarts during development; reload the
browser after frontend edits. Stop either command with Ctrl+C.

- Select 7, 28, or 90 days, **All time**, or a calendar year for distance, timer time,
  average pace, run totals, heart rate zones, and the run log. Every year from your
  earliest run through the current year is available, including years without runs.
- Distance charts show weeks for rolling periods, months for calendar years, and
  years for All time. The consistency calendar remains a separate recent 90-day view.
- If your saved snapshot came from the old 90-day importer, select **Sync Garmin**
  once to enable full-history filters.
- Search and sort your run log; select a run for cadence, elevation, and training metrics.
- Select **Sync Garmin** after your watch syncs to Garmin Connect. Saved data stays
  available if refresh fails. Opening the dashboard reads the snapshot without calling Garmin.

Pace is total timer time divided by distance for runs with both values. Paused time
is excluded according to Garmin's timer duration. Missing sensor values display as
`—`. Distance change compares the prior equal period only when the imported range
covers it. Calendar-year views use January 1 through December 31; the current year
ends today. Partial chart periods are labeled. No coaching scores or recovery estimates are invented.

Server binds to `127.0.0.1`; credentials never reach browser code. To use another
local port, add `PORT=3001` to `.env` and restart. This server is for local use.

### Fun statistics

Open **Fun stats** in the sidebar or header, or visit [/stats](http://127.0.0.1:3000/stats).
Choose All time, a calendar year, or a rolling period to explore:

- Fastest/slowest average pace, longest run, longest duration, and most climbing.
- Longest consecutive running-day streak, longest pause, and most runs in a day.
- First/latest recorded runs and earliest/latest local start times.
- Biggest day, Monday-based week, month, and year by recorded distance.
- Weekday, time-of-day, and distance habits; first 5 km, 10 km, half-marathon,
  and marathon distances; combined mileage expressed in marathon distances.

Pace records default to runs of at least 1 km. Adjust the threshold independently
of other statistics. Streaks count each running date once, regardless of multiple
runs on that date. Pauses count only days between recorded runs. Tied records use
the earliest occurrence. All records and milestones are limited to the selected
period; a year view clips streaks at January 1 and December 31. These use complete
activity summaries rather than inferred split personal bests. **View run** opens
the matching activity's detail dialog on Overview.

The page reads the saved snapshot without contacting Garmin. Refresh data from
Overview, then reload Fun stats to update its records.

### Training plan

Open **Training plan** from the sidebar/header or visit [/plan](http://127.0.0.1:3000/plan).
The page shows today's and tomorrow's sessions, a dated weekly schedule, session
notes, recovery weeks, and the full progression. Navigate between weeks or return
to the current week. Sessions are proposed, not automatically marked completed.

Personal dates, session durations, and coaching notes live in ignored
`data/training-plan.json`, served only through the local `/api/plan` endpoint.
The page shows an empty state when that private file is absent. No Garmin requests
are needed to view the plan. Cross-training alternates from its own start date,
including across week and year boundaries.

## Step 4: Validate

```powershell
npm.cmd test
```

Tests use synthetic data and require neither credentials nor network access.

Checks cover token reuse, sanitized errors, pace and heart rate weighting, missing
sensors, date boundaries, calendar years and leap days, monthly/yearly buckets,
full-history pagination, preserved snapshots, and local HTTP access restrictions.
Fun stats tests cover pace thresholds, calendar-day streaks, rest-day gaps,
distance records, local time habits, and exact milestone distances.
Plan tests cover its opening sessions, four runs per week, continuous gym/rowing
alternation, recovery weeks, conditional assessments, and date boundaries.
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
