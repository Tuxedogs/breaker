import http from "node:http";
import { fileURLToPath } from "node:url";
import { handleBuildQueueRoute } from "./routes/buildQueue.routes";
import { handleRecommenderRoute } from "./routes/recommender.routes";
import { handleSavedBlueprintsRoute } from "../src/server/user/savedBlueprintsRoute";

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
      const url = request.url?.split("?")[0] ?? "";
      const route = url === "/api/user/saved-blueprints"
        ? await handleSavedBlueprintsRoute(request.method ?? "GET", request.headers, body)
        : await handleRecommenderRoute(request.method ?? "GET", url, body) ??
          await handleBuildQueueRoute(request.method ?? "GET", url, body);
      if (!route) {
        response.writeHead(404, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "Not found" }));
        return;
      }
      response.writeHead(route.status, { "content-type": "application/json" });
      response.end(JSON.stringify(route.body));
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT ?? 8787);
  createServer().listen(port, () => {
    console.log(`Recommender API listening on http://localhost:${port}`);
  });
}
