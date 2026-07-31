import type { IncomingMessage, ServerResponse } from "node:http";

import { handleMissionsRoute } from "./missions.routes.js";

async function readBody(request: IncomingMessage): Promise<unknown> {
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

export async function runMissionsApiHandler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const method = request.method ?? "GET";
  const rawUrl = request.url ?? "";

  try {
    const body = method === "GET" || method === "HEAD" ? undefined : await readBody(request);
    const result = await handleMissionsRoute(method, rawUrl, body);
    if (!result) {
      sendJson(response, 404, { error: "Mission route not found." });
      return;
    }
    sendJson(
      response,
      result.status,
      result.body,
      result.status === 405 ? { allow: rawUrl.endsWith("/eligibility") ? "POST" : "GET" } : undefined,
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Invalid request body." });
      return;
    }
    console.error("[api/missions] Unhandled route error.", error);
    sendJson(response, 500, { error: "Mission request failed." });
  }
}
