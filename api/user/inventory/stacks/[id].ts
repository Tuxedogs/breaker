import type { IncomingMessage, ServerResponse } from "node:http";

import { handleUserInventoryRoute } from "../../../../src/server/user/inventoryRoute";

async function readBody(request: IncomingMessage): Promise<unknown> {
  if (request.method === "DELETE") return {};

  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function getStackId(request: IncomingMessage) {
  const url = request.url ?? "";
  const pathname = url.split("?")[0] ?? "";
  return decodeURIComponent(pathname.split("/").pop() ?? "");
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    const stackId = getStackId(request);
    const result = await handleUserInventoryRoute(
      request.method ?? "PATCH",
      `/api/user/inventory/stacks/${stackId}`,
      request.headers,
      await readBody(request),
    );
    response.statusCode = result?.status ?? 404;
    response.setHeader("content-type", "application/json");
    if (result?.status === 405) response.setHeader("allow", "PATCH, DELETE");
    response.end(JSON.stringify(result?.body ?? { error: "Not found." }));
  } catch {
    response.statusCode = 400;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ error: "Invalid request body." }));
  }
}
