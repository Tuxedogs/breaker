import type { IncomingMessage, ServerResponse } from "node:http";

import { handleUserBuildQueueRoute } from "../../src/server/user/buildQueueRoute.js";

async function readBody(request: IncomingMessage): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") return {};

  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  let body: unknown;

  try {
    body = await readBody(request);
  } catch (error) {
    console.error("[api/user/build-queue] Invalid request body.", error);
    response.statusCode = 400;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ error: "Invalid request body." }));
    return;
  }

  try {
    const result = await handleUserBuildQueueRoute(
      request.method ?? "GET",
      request.headers,
      body,
    );
    response.statusCode = result.status;
    response.setHeader("content-type", "application/json");
    if (result.status === 405) response.setHeader("allow", "GET, POST, PATCH, DELETE");
    response.end(JSON.stringify(result.body));
  } catch (error) {
    console.error("[api/user/build-queue] Unhandled route error.", error);
    response.statusCode = 500;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ error: "Build queue request failed." }));
  }
}
