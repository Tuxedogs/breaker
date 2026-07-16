import type { IncomingMessage, ServerResponse } from "node:http";

import { handleUserInventoryRoute } from "../../../../src/server/user/inventoryRoute.js";

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    const id = request.url?.split("?")[0]?.split("/").filter(Boolean).at(-1) ?? "";
    const path = `/api/user/inventory/build-queues/${encodeURIComponent(decodeURIComponent(id))}`;
    const result = await handleUserInventoryRoute(request.method ?? "DELETE", path, request.headers, {});
    response.statusCode = result?.status ?? 404;
    response.setHeader("content-type", "application/json");
    if (result?.status === 405) response.setHeader("allow", "DELETE");
    response.end(JSON.stringify(result?.body ?? { error: "Not found." }));
  } catch (error) {
    console.error("[api/user/inventory/build-queues] Unhandled route error.", error);
    response.statusCode = 500;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ error: "Build queue request failed." }));
  }
}
