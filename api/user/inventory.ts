import type { IncomingMessage, ServerResponse } from "node:http";

import { handleUserInventoryRoute } from "../../src/server/user/inventoryRoute.js";

const ROUTE = "/api/user/inventory";

async function readBody(request: IncomingMessage): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") return {};

  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  const method = request.method ?? "GET";
  let body: unknown;

  try {
    body = await readBody(request);
  } catch (error) {
    console.error("[api/user/inventory] Invalid request body.", error);
    sendJson(response, 400, { error: "Invalid request body." });
    return;
  }

  try {
    const result = await handleUserInventoryRoute(
      method,
      ROUTE,
      request.headers,
      body,
    );
    response.statusCode = result?.status ?? 404;
    response.setHeader("content-type", "application/json");
    if (result?.status === 405) response.setHeader("allow", "GET");
    response.end(JSON.stringify(result?.body ?? { error: "Not found." }));
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "Error";
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[api/user/inventory] Unhandled route error.", {
      route: ROUTE,
      method,
      errorName,
      errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    const payload: Record<string, unknown> = { error: "Inventory request failed." };
    if (process.env.NODE_ENV !== "production") {
      payload.detail = errorMessage;
    }
    sendJson(response, 500, payload);
  }
}
