import type { IncomingMessage, ServerResponse } from "node:http";

import { handleUserInventoryRoute } from "../../../../src/server/user/inventoryRoute";

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    const pathname = (request.url ?? "").split("?")[0] ?? "";
    const locationId = decodeURIComponent(pathname.split("/").pop() ?? "");
    const result = await handleUserInventoryRoute(
      request.method ?? "DELETE",
      `/api/user/inventory/locations/${locationId}`,
      request.headers,
      {},
    );
    response.statusCode = result?.status ?? 404;
    response.setHeader("content-type", "application/json");
    if (result?.status === 405) response.setHeader("allow", "DELETE");
    response.end(JSON.stringify(result?.body ?? { error: "Not found." }));
  } catch {
    response.statusCode = 400;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ error: "Invalid request." }));
  }
}
