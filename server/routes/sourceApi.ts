import type { IncomingMessage, ServerResponse } from "node:http";
import { handleSourceRoute } from "./source.routes.js";

export async function runSourceApiHandler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const method = request.method ?? "GET";
  try {
    const result = await handleSourceRoute(method, request.url ?? "");
    response.setHeader("content-type", "application/json");
    for (const [key, value] of Object.entries(result?.headers ?? {})) response.setHeader(key, value);
    response.statusCode = result?.status ?? 404;
    response.end(method === "HEAD" ? undefined : JSON.stringify(result?.body ?? { error: "Source route not found." }));
  } catch (error) {
    console.error("[api/source] Source catalog unavailable.", error);
    response.statusCode = 503;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ error: "Source catalog unavailable." }));
  }
}
