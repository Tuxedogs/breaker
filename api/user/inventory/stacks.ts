import type { IncomingMessage, ServerResponse } from "node:http";

import { handleUserInventoryRoute } from "../../../src/server/user/inventoryRoute";

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    const result = await handleUserInventoryRoute(
      request.method ?? "POST",
      "/api/user/inventory/stacks",
      request.headers,
      await readBody(request),
    );
    response.statusCode = result?.status ?? 404;
    response.setHeader("content-type", "application/json");
    if (result?.status === 405) response.setHeader("allow", "POST");
    response.end(JSON.stringify(result?.body ?? { error: "Not found." }));
  } catch {
    response.statusCode = 400;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ error: "Invalid request body." }));
  }
}
