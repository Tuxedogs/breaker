import type { IncomingMessage, ServerResponse } from "node:http";

import { handleSavedBlueprintsRoute } from "../../src/server/user/savedBlueprintsRoute.js";

async function readBody(request: IncomingMessage): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") return {};

  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response: ServerResponse, status: number, body: unknown, extraHeaders?: Record<string, string>) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  for (const [key, value] of Object.entries(extraHeaders ?? {})) {
    response.setHeader(key, value);
  }
  response.end(JSON.stringify(body));
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  let body: unknown;

  try {
    body = await readBody(request);
  } catch (error) {
    console.error("[api/user/saved-blueprints] Invalid request body.", error);
    sendJson(response, 400, { error: "Invalid request body." });
    return;
  }

  try {
    const result = await handleSavedBlueprintsRoute(
      request.method ?? "GET",
      request.headers,
      body,
    );
    response.statusCode = result.status;
    response.setHeader("content-type", "application/json");
    if (result.status === 405) response.setHeader("allow", "GET, POST, DELETE");
    response.end(JSON.stringify(result.body));
  } catch (error) {
    console.error("[api/user/saved-blueprints] Unhandled route error.", error);
    sendJson(response, 500, { error: "Saved blueprints request failed." });
  }
}