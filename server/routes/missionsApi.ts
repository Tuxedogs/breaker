import type { IncomingMessage, ServerResponse } from "node:http";

import { handleMissionsRoute } from "./missions.routes.js";

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
    const result = await handleMissionsRoute(method, rawUrl);
    if (!result) {
      sendJson(response, 404, { error: "Mission route not found." });
      return;
    }
    sendJson(
      response,
      result.status,
      result.body,
      result.status === 405 ? { allow: "GET" } : undefined,
    );
  } catch (error) {
    console.error("[api/missions] Unhandled route error.", error);
    sendJson(response, 500, { error: "Mission request failed." });
  }
}