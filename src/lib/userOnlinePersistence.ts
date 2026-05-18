import type { BuildQueueItem, InventoryEntry, InventoryLocation } from "../types/logistics";
import { apiUrl } from "./apiUrl";
import { parseJsonResponse, type JsonParseOptions } from "./safeJson";

const INVENTORY_URL = "/api/user/inventory";
const INVENTORY_SYNC_URL = "/api/user/inventory/sync";

export type OnlinePersistenceState = {
  locations: InventoryLocation[];
  inventoryEntries: InventoryEntry[];
  buildQueue: BuildQueueItem[];
  sync?: {
    migratedAt?: string | null;
    lastSyncedAt?: string | null;
  };
  idMap?: {
    locations?: Record<string, string>;
    inventoryEntries?: Record<string, string>;
    buildQueue?: Record<string, string>;
  };
};

export type OnlinePersistencePayload = {
  locations: InventoryLocation[];
  inventoryEntries: InventoryEntry[];
  buildQueue: BuildQueueItem[];
};

function authHeaders(accessToken: string) {
  return {
    authorization: `Bearer ${accessToken}`,
  };
}

async function parseUserJsonResponse<T>(response: Response, options: JsonParseOptions): Promise<T> {
  const data = await parseJsonResponse<Record<string, unknown>>(response, options);
  if (!response.ok) {
    const message = typeof data?.error === "string" ? data.error : `Request failed: ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

export async function fetchOnlinePersistenceState(accessToken: string): Promise<OnlinePersistenceState | null> {
  const url = apiUrl(INVENTORY_URL);
  const response = await fetch(url, {
    headers: authHeaders(accessToken),
  });
  if (response.status === 401) return null;
  return parseUserJsonResponse<OnlinePersistenceState>(response, {
    label: "online inventory",
    url,
  });
}

export async function syncOnlinePersistenceState(
  accessToken: string,
  payload: OnlinePersistencePayload,
): Promise<OnlinePersistenceState> {
  const url = apiUrl(INVENTORY_SYNC_URL);
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      ...authHeaders(accessToken),
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return parseUserJsonResponse<OnlinePersistenceState>(response, {
    label: "sync inventory",
    url,
  });
}
