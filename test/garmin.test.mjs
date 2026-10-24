import assert from "node:assert/strict";
import { test } from "node:test";

test("token is reused in memory and authorization stays out of result data", async (t) => {
  const originalKey = process.env.GARMIN_PERSONAL_API_KEY;
  process.env.GARMIN_PERSONAL_API_KEY = "test-key";
  try {
    const value = `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`;
    let tokensRequested = 0;
    t.mock.method(globalThis, "fetch", async (url, options) => {
      assert.equal(options.redirect, "error");
      if (options.method === "POST") {
        tokensRequested++;
        assert.equal(options.headers.Authorization, "ApiKey test-key");
        return new Response(value);
      }
      assert.equal(options.headers.Authorization, `Bearer ${value}`);
      return Response.json([]);
    });
    const { getActivities } = await import("../src/garmin.mjs?case=cache");
    assert.deepEqual(await getActivities({ start: 0, limit: 1 }), []);
    assert.deepEqual(await getActivities({ start: 0, limit: 1 }), []);
    assert.equal(tokensRequested, 1);
  } finally {
    if (originalKey === undefined) delete process.env.GARMIN_PERSONAL_API_KEY;
    else process.env.GARMIN_PERSONAL_API_KEY = originalKey;
  }
});

test("Garmin error response bodies are never exposed", async (t) => {
  const originalKey = process.env.GARMIN_PERSONAL_API_KEY;
  process.env.GARMIN_PERSONAL_API_KEY = "test-key";
  try {
    t.mock.method(
      globalThis,
      "fetch",
      async () => new Response("sensitive-server-response", { status: 403 }),
    );
    const { authenticate } = await import("../src/garmin.mjs?case=error");
    await assert.rejects(authenticate, (error) => {
      assert.match(error.message, /HTTP 403/);
      assert.ok(!error.message.includes("sensitive-server-response"));
      assert.ok(!error.message.includes("test-key"));
      return true;
    });
  } finally {
    if (originalKey === undefined) delete process.env.GARMIN_PERSONAL_API_KEY;
    else process.env.GARMIN_PERSONAL_API_KEY = originalKey;
  }
});
