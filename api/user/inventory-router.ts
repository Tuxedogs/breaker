import type { IncomingMessage, ServerResponse } from "node:http";

import { handleUserInventoryRoute } from "../../src/server/user/inventoryRoute.js";

type InventoryRouteKind = "sync" | "stacks" | "stack" | "location" | "build-queue";

type InventoryRoute = {
  kind: InventoryRouteKind;
  rawId?: string;
};

function matchRoute(request: IncomingMessage): InventoryRoute | null {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  if (pathname === "/api/user/inventory/sync") return { kind: "sync" };
  if (pathname === "/api/user/inventory/stacks") return { kind: "stacks" };

  const stackMatch = pathname.match(/^\/api\/user\/inventory\/stacks\/([^/]+)$/);
  if (stackMatch) return { kind: "stack", rawId: stackMatch[1] };

  const locationMatch = pathname.match(/^\/api\/user\/inventory\/locations\/([^/]+)$/);
  if (locationMatch) return { kind: "location", rawId: locationMatch[1] };

  const buildQueueMatch = pathname.match(/^\/api\/user\/inventory\/build-queues\/([^/]+)$/);
  if (buildQueueMatch) return { kind: "build-queue", rawId: buildQueueMatch[1] };

  return null;
}

function defaultMethod(route: InventoryRoute): string {
  if (route.kind === "sync") return "PUT";
  if (route.kind === "stacks") return "POST";
  if (route.kind === "stack") return "PATCH";
  return "DELETE";
}

function dispatcherPath(route: InventoryRoute): string {
  if (route.kind === "sync") return "/api/user/inventory/sync";
  if (route.kind === "stacks") return "/api/user/inventory/stacks";

  const decodedId = decodeURIComponent(route.rawId ?? "");
  if (route.kind === "stack") return `/api/user/inventory/stacks/${decodedId}`;
  if (route.kind === "location") return `/api/user/inventory/locations/${decodedId}`;
  return `/api/user/inventory/build-queues/${encodeURIComponent(decodedId)}`;
}

async function readBody(request: IncomingMessage, route: InventoryRoute): Promise<unknown> {
  if (route.kind === "location" || route.kind === "build-queue") return {};
  if (route.kind === "stack" && request.method === "DELETE") return {};

  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function allowHeader(route: InventoryRoute): string {
  if (route.kind === "sync") return "PUT, POST";
  if (route.kind === "stacks") return "POST";
  if (route.kind === "stack") return "PATCH, DELETE";
  return "DELETE";
}

function routeLabel(route: InventoryRoute): string {
  if (route.kind === "sync") return "api/user/inventory/sync";
  if (route.kind === "stacks") return "api/user/inventory/stacks";
  if (route.kind === "stack") return "api/user/inventory/stacks/:id";
  if (route.kind === "location") return "api/user/inventory/locations/:id";
  return "api/user/inventory/build-queues";
}

function failurePayload(route: InventoryRoute, error: unknown): Record<string, unknown> {
  if (route.kind === "sync") {
    return {
      error: "Inventory sync request failed.",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
  if (route.kind === "stacks" || route.kind === "stack") {
    return { error: "Inventory stack request failed." };
  }
  if (route.kind === "location") return { error: "Inventory location request failed." };
  return { error: "Build queue request failed." };
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  const route = matchRoute(request);
  if (!route) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  let body: unknown;
  try {
    body = await readBody(request, route);
  } catch (error) {
    console.error(`[${routeLabel(route)}] Invalid request body.`, error);
    sendJson(response, 400, { error: "Invalid request body." });
    return;
  }

  try {
    const result = await handleUserInventoryRoute(
      request.method ?? defaultMethod(route),
      dispatcherPath(route),
      request.headers,
      body,
    );
    response.statusCode = result?.status ?? 404;
    response.setHeader("content-type", "application/json");
    if (result?.status === 405) response.setHeader("allow", allowHeader(route));
    response.end(JSON.stringify(result?.body ?? { error: "Not found." }));
  } catch (error) {
    console.error(`[${routeLabel(route)}] Unhandled route error.`, error);
    sendJson(response, 500, failurePayload(route, error));
  }
}
