import type { IncomingMessage, ServerResponse } from "node:http";
import { handleFittingRoute } from "./fitting.routes.js";

function applyHeaders(response: ServerResponse, headers?: Record<string, string>): void {
  for (const [key, value] of Object.entries(headers ?? {})) response.setHeader(key, value);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

export async function runFittingApiHandler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const method = request.method ?? "GET";
  const rawUrl = request.url ?? "/";
  try {
    const pathname = new URL(rawUrl, "http://localhost").pathname;
    const body = method === "POST" && (pathname.endsWith("/validate") || pathname.endsWith("/calculate"))
      ? await readJsonBody(request)
      : undefined;
    const requestId = typeof request.headers["x-vercel-id"] === "string" ? request.headers["x-vercel-id"] : "unavailable";
    const result = await handleFittingRoute(method, rawUrl, requestId, undefined, body);
    if (!result) {
      response.statusCode = 404;
      response.setHeader("content-type", "application/problem+json; charset=utf-8");
      response.end(method === "HEAD" ? undefined : JSON.stringify({
        type: "https://scintel.example/problems/resource-not-found",
        title: "Resource not found",
        status: 404,
        code: "RESOURCE_NOT_FOUND",
        detail: "No fitting API route matched the requested path.",
        instance: new URL(rawUrl, "http://localhost").pathname,
        requestId: request.headers["x-vercel-id"] ?? "unavailable",
        errors: [],
      }));
      return;
    }

    applyHeaders(response, result.headers);
    if (result.status === 200 && result.headers?.etag && request.headers["if-none-match"] === result.headers.etag) {
      response.statusCode = 304;
      response.end();
      return;
    }
    response.statusCode = result.status;
    response.end(method === "HEAD" ? undefined : JSON.stringify(result.body));
  } catch (error) {
    console.error("[api/v1/fitting] Unhandled route error.", error);
    response.statusCode = 500;
    response.setHeader("content-type", "application/problem+json; charset=utf-8");
    response.setHeader("cache-control", "no-store");
    response.end(method === "HEAD" ? undefined : JSON.stringify({
      type: "https://scintel.example/problems/internal-error",
      title: "Internal error",
      status: 500,
      code: "INTERNAL_ERROR",
      detail: "The fitting API could not complete the request.",
      instance: new URL(rawUrl, "http://localhost").pathname,
      requestId: request.headers["x-vercel-id"] ?? "unavailable",
      errors: [],
    }));
  }
}
