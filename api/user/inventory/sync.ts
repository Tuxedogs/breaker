import type { IncomingMessage, ServerResponse } from "node:http";

async function readBody(request: IncomingMessage): Promise<unknown> {
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
    console.error("[api/user/inventory/sync] Invalid request body.", error);
    response.statusCode = 400;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ error: "Invalid request body." }));
    return;
  }

  try {
    const { handleUserInventoryRoute } = await import("../../../src/server/user/inventoryRoute.js");
    const result = await handleUserInventoryRoute(
      request.method ?? "PUT",
      "/api/user/inventory/sync",
      request.headers,
      body,
    );
    response.statusCode = result?.status ?? 404;
    response.setHeader("content-type", "application/json");
    if (result?.status === 405) response.setHeader("allow", "PUT, POST");
    response.end(JSON.stringify(result?.body ?? { error: "Not found." }));
  } catch (error) {
    console.error("[api/user/inventory/sync] Unhandled route error.", error);
    response.statusCode = 500;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ error: "Inventory sync request failed." }));
  }
}
