import { AuthError, requireAuthenticatedUser } from "../auth/requireDiscordUserId.js";
import {
  clearBuildQueueItems,
  deleteBuildQueueItem,
  deleteInventoryStack,
  deleteInventoryLocation,
  listOnlinePersistenceState,
  syncOnlinePersistenceState,
  type OnlinePersistencePayload,
} from "./onlinePersistenceService.js";
import { deleteBuildQueue } from "./buildQueueMetadataService.js";

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
  const buildQueueMatch = path.match(/^\/api\/user\/inventory\/build-queues(?:\/([^/]+))?$/);
  const buildQueueItemMatch = path.match(/^\/api\/user\/inventory\/build-queue-items\/([^/]+)$/);
  const buildQueueClearMatch = path.match(/^\/api\/user\/inventory\/build-queues\/([^/]+)\/items$/);
  if (path !== "/api/user/inventory" && path !== "/api/user/inventory/sync" && !stackMatch && !locationMatch && !buildQueueMatch && !buildQueueItemMatch && !buildQueueClearMatch) return null;

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

    if (buildQueueItemMatch && method === "DELETE") {
      const itemId = buildQueueItemMatch[1];
      if (!itemId) return safeError(400, "Build queue item id is required.");
      return { status: 200, body: await deleteBuildQueueItem(userId, itemId) };
    }

    if (buildQueueClearMatch && method === "DELETE") {
      const queueId = buildQueueClearMatch[1];
      if (!queueId) return safeError(400, "Build queue id is required.");
      return { status: 200, body: await clearBuildQueueItems(userId, queueId) };
    }

    if (buildQueueMatch && method === "DELETE") {
      const queueId = buildQueueMatch[1];
      if (!queueId) return safeError(400, "Build queue id is required.");
      await deleteBuildQueue(userId, queueId);
      return { status: 200, body: await listOnlinePersistenceState(userId) };
    }

    return safeError(405, "Method not allowed.");
  } catch (error) {
    if (error instanceof AuthError) return safeError(error.status, error.message);
    if (error instanceof TypeError) return safeError(400, error.message);
    console.error("[api/user/inventory] Database request failed.", error);
    return safeError(500, "Database request failed.");
  }
}
