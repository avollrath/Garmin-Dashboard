import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";

test(
  "local HTTP server isolates secrets and preserves saved data after failed refresh",
  { timeout: 15_000 },
  async (t) => {
    const child = spawn(process.execPath, ["server.mjs"], {
      cwd: new URL("../", import.meta.url),
      env: { ...process.env, PORT: "0", GARMIN_PERSONAL_API_KEY: "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    t.after(() => child.kill());
    const base = await new Promise((resolve, reject) => {
      child.stdout.on("data", (chunk) => {
        const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) resolve(match[0]);
      });
      child.on("error", reject);
      child.on("exit", () =>
        reject(new Error("Test server exited before readiness.")),
      );
    });

    for (const path of [
      "/",
      "/app.css",
      "/app.mjs",
      "/metrics.mjs",
      "/favicon.svg",
    ]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      assert.equal(response.headers.get("cache-control"), "no-store");
      await response.arrayBuffer();
    }
    for (const path of [
      "/.env",
      "/data/runs.json",
      "/src/garmin.mjs",
      "/../.env",
    ]) {
      assert.equal((await fetch(base + path)).status, 404, path);
    }
    assert.equal(
      (await fetch(base + "/api/sync", { method: "POST" })).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + "/api/sync", {
          method: "POST",
          headers: { Origin: "https://example.com" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + "/api/training", {
          headers: { "Sec-Fetch-Site": "cross-site" },
        })
      ).status,
      403,
    );

    const before = await (await fetch(base + "/api/training")).json();
    const failed = await fetch(base + "/api/sync", {
      method: "POST",
      headers: { Origin: base },
    });
    assert.equal(failed.status, 500);
    assert.match((await failed.json()).error, /Set GARMIN_PERSONAL_API_KEY/);
    const after = await (await fetch(base + "/api/training")).json();
    assert.equal(after.history?.syncedAt, before.history?.syncedAt);
    assert.equal(after.history?.runs.length, before.history?.runs.length);
  },
);
