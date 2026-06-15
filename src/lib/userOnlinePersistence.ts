import type { BuildQueueItem, InventoryEntry, InventoryLocation } from "../types/logistics";
import { apiUrl } from "./apiUrl";
import { parseJsonResponse, type JsonParseOptions } from "./safeJson";

const INVENTORY_URL = "/api/user/inventory";
const INVENTORY_SYNC_URL = "/api/user/inventory/sync";
const INVENTORY_STACKS_URL = "/api/user/inventory/stacks";
const INVENTORY_LOCATIONS_URL = "/api/user/inventory/locations";

let onlineMutationCount = 0;
let currentOnlineAccessToken: string | null = null;
let onlineMutationTail: Promise<void> = Promise.resolve();

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
  locations?: InventoryLocation[];
  inventoryEntries?: InventoryEntry[];
  buildQueue?: BuildQueueItem[];
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

export function isOnlinePersistenceMutationInFlight() {
  return onlineMutationCount > 0;
}

export function setOnlinePersistenceAccessToken(accessToken: string | null) {
  currentOnlineAccessToken = accessToken;
}

export async function runOnlinePersistenceMutation<T>(request: () => Promise<T>): Promise<T> {
  onlineMutationCount += 1;
  const result = onlineMutationTail.then(request, request);
  onlineMutationTail = result.then(() => undefined, () => undefined);
  try {
    return await result;
  } finally {
    onlineMutationCount -= 1;
  }
}

export function upsertOnlineInventoryStack(accessToken: string, entry: InventoryEntry, location?: InventoryLocation) {
  return runOnlinePersistenceMutation(() => syncOnlinePersistenceState(accessToken, {
    locations: location ? [location] : undefined,
    inventoryEntries: [entry],
  }));
}

export function deleteOnlineInventoryStack(accessToken: string, stackId: string) {
  return runOnlinePersistenceMutation(async () => {
    const url = apiUrl(`${INVENTORY_STACKS_URL}/${encodeURIComponent(stackId)}`);
    const response = await fetch(url, {
      method: "DELETE",
      headers: authHeaders(accessToken),
    });
    return parseUserJsonResponse<OnlinePersistenceState>(response, {
      label: "delete inventory stack",
      url,
    });
  });
}

export function upsertOnlineInventoryLocation(accessToken: string, location: InventoryLocation) {
  return runOnlinePersistenceMutation(() => syncOnlinePersistenceState(accessToken, {
    locations: [location],
  }));
}

export function deleteOnlineInventoryLocation(accessToken: string, locationId: string) {
  return runOnlinePersistenceMutation(async () => {
    const url = apiUrl(`${INVENTORY_LOCATIONS_URL}/${encodeURIComponent(locationId)}`);
    const response = await fetch(url, {
      method: "DELETE",
      headers: authHeaders(accessToken),
    });
    return parseUserJsonResponse<OnlinePersistenceState>(response, {
      label: "delete inventory location",
      url,
    });
  });
}

export function upsertOnlineBuildQueueItem(accessToken: string, item: BuildQueueItem) {
  return runOnlinePersistenceMutation(() => syncOnlinePersistenceState(accessToken, {
    buildQueue: [item],
  }));
}

export function persistOnlineInventoryStack(entry: InventoryEntry, location?: InventoryLocation) {
  return currentOnlineAccessToken ? upsertOnlineInventoryStack(currentOnlineAccessToken, entry, location) : null;
}

export function persistOnlineInventoryStackDelete(stackId: string) {
  return currentOnlineAccessToken ? deleteOnlineInventoryStack(currentOnlineAccessToken, stackId) : null;
}

export function persistOnlineInventoryLocation(location: InventoryLocation) {
  return currentOnlineAccessToken ? upsertOnlineInventoryLocation(currentOnlineAccessToken, location) : null;
}

export function persistOnlineInventoryLocationDelete(locationId: string) {
  return currentOnlineAccessToken ? deleteOnlineInventoryLocation(currentOnlineAccessToken, locationId) : null;
}
