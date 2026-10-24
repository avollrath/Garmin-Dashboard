import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { readHistory, syncHistory, today } from "./src/history.mjs";

let port = Number(process.env.PORT ?? 3000);
const assets = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/stats", ["stats.html", "text/html; charset=utf-8"]],
  ["/app.css", ["app.css", "text/css; charset=utf-8"]],
  ["/app.mjs", ["app.mjs", "text/javascript; charset=utf-8"]],
  ["/metrics.mjs", ["metrics.mjs", "text/javascript; charset=utf-8"]],
  ["/fun-stats.mjs", ["fun-stats.mjs", "text/javascript; charset=utf-8"]],
  ["/stats.mjs", ["stats.mjs", "text/javascript; charset=utf-8"]],
  ["/favicon.svg", ["favicon.svg", "image/svg+xml"]],
]);

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  );

  const host = request.headers.host;
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) {
    return json(response, 403, { error: "Local access only." });
  }
  let pathname;
  try {
    pathname = new URL(request.url, `http://${host}`).pathname;
  } catch {
    return json(response, 400, { error: "Invalid request URL." });
  }
  if (
    pathname.startsWith("/api/") &&
    request.headers["sec-fetch-site"] === "cross-site"
  ) {
    return json(response, 403, {
      error: "Open the dashboard directly to access training data.",
    });
  }

  try {
    if (request.method === "GET" && pathname === "/api/training") {
      return json(response, 200, {
        history: await readHistory(),
        today: today(),
      });
    }
    if (request.method === "POST" && pathname === "/api/sync") {
      if (request.headers.origin !== `http://${host}`) {
        return json(response, 403, {
          error: "Refresh must come from this dashboard.",
        });
      }
      return json(response, 200, {
        history: await syncHistory(),
        today: today(),
      });
    }
    if (request.method !== "GET")
      return json(response, 405, { error: "Method not allowed." });
    const asset = assets.get(pathname);
    if (!asset) return json(response, 404, { error: "Not found." });
    const content = await readFile(
      new URL(`./public/${asset[0]}`, import.meta.url),
    );
    response.writeHead(200, { "Content-Type": asset[1] });
    response.end(content);
  } catch (error) {
    json(response, 500, {
      error: pathname.startsWith("/api/")
        ? error.message
        : "Cannot load dashboard.",
    });
  }
});

server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `Port ${port} is busy. Set PORT in .env or stop the other server.`
      : "Cannot start local dashboard.",
  );
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  port = server.address().port;
  console.log(`Running dashboard: http://127.0.0.1:${port}`);
  console.log("Local access only. Press Ctrl+C to stop.");
});
