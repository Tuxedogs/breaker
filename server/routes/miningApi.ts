import type { IncomingMessage, ServerResponse } from "node:http";

import { handleMiningRoute } from "./mining.routes.js";

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers?: Record<string, string>,
): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  for (const [key, value] of Object.entries(headers ?? {})) response.setHeader(key, value);
  response.end(JSON.stringify(body));
}

export async function runMiningApiHandler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const method = request.method ?? "GET";
  try {
    const body = method === "POST" ? await readBody(request) : undefined;
    const result = await handleMiningRoute(method, request.url ?? "", body);
    if (!result) {
      sendJson(response, 404, { error: "Mining route not found." });
      return;
    }
    if (method === "HEAD") {
      response.statusCode = result.status;
      for (const [key, value] of Object.entries(result.headers ?? {})) response.setHeader(key, value);
      response.end();
      return;
    }
    sendJson(response, result.status, result.body, result.headers);
  } catch (error) {
    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Invalid request body." });
      return;
    }
    console.error("[api/mining] Unhandled route error.", error);
    sendJson(response, 500, { error: "Mining request failed." });
  }
}
