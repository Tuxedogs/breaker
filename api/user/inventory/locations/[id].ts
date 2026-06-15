import type { IncomingMessage, ServerResponse } from "node:http";

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    const { handleUserInventoryRoute } = await import("../../../../src/server/user/inventoryRoute.js");
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
  } catch (error) {
    console.error("[api/user/inventory/locations/:id] Unhandled route error.", error);
    response.statusCode = 500;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ error: "Inventory location request failed." }));
  }
}
