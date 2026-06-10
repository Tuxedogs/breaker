import http from "node:http";
import { fileURLToPath } from "node:url";
import { handleBuildQueueRoute } from "./routes/buildQueue.routes";
import { handleFittingRoute } from "./routes/fitting.routes";
import { handleRecommenderRoute } from "./routes/recommender.routes";
import { handleSavedBlueprintsRoute } from "../src/server/user/savedBlueprintsRoute";
import { handleUserBuildQueueRoute } from "../src/server/user/buildQueueRoute";
import { handleUserInventoryRoute } from "../src/server/user/inventoryRoute";
import { handleBlueprintTrackerRoute } from "../src/server/user/blueprintTrackerRoute";

async function readBody(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export function createServer() {
  return http.createServer(async (request, response) => {
    try {
      const body = await readBody(request);
      const rawUrl = request.url ?? "";
      const url = rawUrl.split("?")[0] ?? "";
      const route = await handleUserInventoryRoute(request.method ?? "GET", url, request.headers, body)
        ?? (url === "/api/user/saved-blueprints"
        ? await handleSavedBlueprintsRoute(request.method ?? "GET", request.headers, body)
        : url === "/api/user/blueprint-tracker"
          ? await handleBlueprintTrackerRoute(request.method ?? "GET", request.headers, body)
        : url === "/api/user/build-queue"
          ? await handleUserBuildQueueRoute(request.method ?? "GET", request.headers, body)
        : await handleFittingRoute(request.method ?? "GET", rawUrl, body) ??
          await handleRecommenderRoute(request.method ?? "GET", url, body) ??
          await handleBuildQueueRoute(request.method ?? "GET", url, body));
      if (!route) {
        response.writeHead(404, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "Not found" }));
        return;
      }
      response.writeHead(route.status, { "content-type": "application/json" });
      response.end(JSON.stringify(route.body));
    } catch (error) {
      const isSyntaxError = error instanceof SyntaxError;
      response.writeHead(isSyntaxError ? 400 : 500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: isSyntaxError ? "Invalid request body." : error instanceof Error ? error.message : String(error) }));
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT ?? 8787);
  createServer().listen(port, () => {
    console.log(`Recommender API listening on http://localhost:${port}`);
  });
}
