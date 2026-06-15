import { AuthError, requireAuthenticatedUser } from "../auth/requireDiscordUserId.js";
import {
  deleteInventoryStack,
  deleteInventoryLocation,
  listOnlinePersistenceState,
  syncOnlinePersistenceState,
  type OnlinePersistencePayload,
} from "./onlinePersistenceService.js";

type HeaderValue = string | string[] | undefined;
type HeaderBag = Record<string, HeaderValue> | Headers;

type RouteResult = {
  status: number;
  body: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeError(status: number, message: string): RouteResult {
  return { status, body: { error: message } };
}

export async function handleUserInventoryRoute(
  method: string,
  path: string,
  headers: HeaderBag,
  body: unknown,
): Promise<RouteResult | null> {
  const stackMatch = path.match(/^\/api\/user\/inventory\/stacks(?:\/([^/]+))?$/);
  const locationMatch = path.match(/^\/api\/user\/inventory\/locations(?:\/([^/]+))?$/);
  if (path !== "/api/user/inventory" && path !== "/api/user/inventory/sync" && !stackMatch && !locationMatch) return null;

  try {
    const { userId } = await requireAuthenticatedUser(headers);

    if (path === "/api/user/inventory" && method === "GET") {
      return { status: 200, body: await listOnlinePersistenceState(userId) };
    }

    if (path === "/api/user/inventory/sync" && (method === "PUT" || method === "POST")) {
      if (!isRecord(body)) return safeError(400, "Invalid request body.");
      return {
        status: 200,
        body: await syncOnlinePersistenceState(userId, body as OnlinePersistencePayload),
      };
    }

    if (stackMatch && method === "POST") {
      if (!isRecord(body)) return safeError(400, "Invalid request body.");
      const entry = isRecord(body.entry) ? body.entry : body;
      return {
        status: 200,
        body: await syncOnlinePersistenceState(userId, {
          inventoryEntries: [entry],
        }),
      };
    }

    if (stackMatch && method === "PATCH") {
      if (!isRecord(body)) return safeError(400, "Invalid request body.");
      const stackId = stackMatch[1];
      if (!stackId) return safeError(400, "Stack id is required.");
      const entry = isRecord(body.entry) ? body.entry : body;
      return {
        status: 200,
        body: await syncOnlinePersistenceState(userId, {
          inventoryEntries: [{ ...entry, id: stackId }],
        }),
      };
    }

    if (stackMatch && method === "DELETE") {
      const stackId = stackMatch[1];
      if (!stackId) return safeError(400, "Stack id is required.");
      return { status: 200, body: await deleteInventoryStack(userId, stackId) };
    }

    if (locationMatch && method === "DELETE") {
      const locationId = locationMatch[1];
      if (!locationId) return safeError(400, "Location id is required.");
      return { status: 200, body: await deleteInventoryLocation(userId, locationId) };
    }

    return safeError(405, "Method not allowed.");
  } catch (error) {
    if (error instanceof AuthError) return safeError(error.status, error.message);
    if (error instanceof TypeError) return safeError(400, error.message);
    console.error("[api/user/inventory] Database request failed.", error);
    return safeError(500, "Database request failed.");
  }
}
