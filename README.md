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
each run. The dashboard will need to reuse its token until renewal is needed.

This connects repository code to your account. It does not install a persistent
Garmin connector in ChatGPT. During work in this repository, the coding agent can
run local code to read your data.

## Next steps

- Step 2: Fetch training history into an ignored local cache; normalize dates and units.
- Step 3: Build the local dashboard around real activities and recovery data.
- Step 4: Add refresh controls, error states, and focused validation.

Hosting and scheduled synchronization can be decided after the local dashboard works.

## Official references

- [Personal API setup](https://developer.garmin.com/gc-developer-program/personal/personal-api/)
- [Personal API FAQ](https://developer.garmin.com/gc-developer-program/personal/personal-faq/)
- [API endpoint documentation](https://developer.garmin.com/gc-developer-program/personal/swagger-docs/)
- [Garmin's reference client](https://github.com/garmin/connect-personal-api-python)
