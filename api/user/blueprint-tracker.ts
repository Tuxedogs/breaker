import type { IncomingMessage, ServerResponse } from "node:http";

import { handleBlueprintTrackerRoute } from "../../src/server/user/blueprintTrackerRoute.js";

async function readBody(request: IncomingMessage): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") return {};

  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    const result = await handleBlueprintTrackerRoute(
      request.method ?? "GET",
      request.headers,
      await readBody(request),
    );
    response.statusCode = result.status;
    response.setHeader("content-type", "application/json");
    if (result.status === 405) response.setHeader("allow", "GET, PUT");
    response.end(JSON.stringify(result.body));
  } catch {
    response.statusCode = 400;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ error: "Invalid request body." }));
  }
}
