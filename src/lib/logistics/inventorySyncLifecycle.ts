import type { InventorySyncState } from "../../stores/logisticsStore";
import type { BuildQueueItem, InventoryEntry, InventoryLocation } from "../../types/logistics";

export const LEGACY_INVENTORY_BACKUP_KEY = "moonbreaker:legacy-inventory-backup:v2";

export type InventorySyncStatus = "idle" | "pending" | "synced" | "error";

export type InventoryOnlinePayload = {
  locations: InventoryLocation[];
  inventoryEntries: InventoryEntry[];
  buildQueue: BuildQueueItem[];
};

let nextInventorySyncRequestId = 1;
let inventoryFetchInFlight = false;

export function isInventoryFetchInFlight(): boolean {
  return inventoryFetchInFlight;
}

export function markInventoryFetchStarted(): void {
  inventoryFetchInFlight = true;
}

export function markInventoryFetchFinished(): void {
  inventoryFetchInFlight = false;
}

export function shouldSkipInventoryFetch(input: {
  caller: string;
  isStale: boolean;
  allowWhileFresh?: boolean;
}): boolean {
  if (inventoryFetchInFlight) {
    logInventorySyncDev("fetch skipped", { caller: input.caller, reason: "in-flight" });
    return true;
  }
  if (!input.isStale && !input.allowWhileFresh) {
    logInventorySyncDev("fetch skipped", { caller: input.caller, reason: "fresh" });
    return true;
  }
  return false;
}

export function createInventorySyncRequestId(): number {
  nextInventorySyncRequestId += 1;
  return nextInventorySyncRequestId;
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  return false;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function backupLegacyInventoryPayload(persisted: unknown): void {
  if (typeof window === "undefined" || !isRecord(persisted)) return;
  if (window.localStorage.getItem(LEGACY_INVENTORY_BACKUP_KEY)) return;

  const inventoryEntries = Array.isArray(persisted.inventoryEntries) ? persisted.inventoryEntries : [];
  const locations = Array.isArray(persisted.locations) ? persisted.locations : [];
  const buildQueue = Array.isArray(persisted.buildQueue) ? persisted.buildQueue : [];
  if (inventoryEntries.length === 0 && locations.length === 0 && buildQueue.length === 0) return;

  try {
    window.localStorage.setItem(
      LEGACY_INVENTORY_BACKUP_KEY,
      JSON.stringify({
        backedUpAt: new Date().toISOString(),
        version: persisted.version ?? null,
        inventoryEntries,
        locations,
        buildQueue,
      }),
    );
  } catch {
    // ignore storage failures
  }
}

export function hasMeaningfulLocalInventoryPayload(payload: InventoryOnlinePayload): boolean {
  return payload.inventoryEntries.length > 0
    || payload.buildQueue.length > 0
    || payload.locations.length > 0;
}

export function shouldAllowLocalToServerMigrationUpload(
  remote: InventoryOnlinePayload,
  local: InventoryOnlinePayload,
): boolean {
  if (hasMeaningfulLocalInventoryPayload(remote)) return false;
  return hasMeaningfulLocalInventoryPayload(local);
}

export function buildInventorySyncBeginPatch(
  requestId: number,
  userId: string,
): Partial<InventorySyncState> {
  return {
    status: "pending",
    isFetching: true,
    activeRequestId: requestId,
    loadedForUserId: userId,
    syncError: undefined,
  };
}

export function buildInventorySyncSuccessPatch(
  requestId: number,
  userId: string,
  now = Date.now(),
): Partial<InventorySyncState> {
  const syncedAtIso = new Date(now).toISOString();
  return {
    status: "synced",
    isFetching: false,
    isSyncing: false,
    activeRequestId: requestId,
    loadedForUserId: userId,
    lastSuccessfulSyncAt: now,
    lastFailedSyncAt: undefined,
    lastFetchedAt: syncedAtIso,
    lastSyncedAt: syncedAtIso,
    hasFetchedServerInventory: true,
    syncError: undefined,
    hasUnsyncedChanges: false,
    pendingMutationCount: 0,
  };
}

export function buildInventorySyncFailurePatch(
  requestId: number,
  userId: string | null,
  error: unknown,
  now = Date.now(),
): Partial<InventorySyncState> {
  if (isAbortError(error)) {
    return { isFetching: false, status: "idle" };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    status: "error",
    isFetching: false,
    activeRequestId: requestId,
    loadedForUserId: userId,
    lastFailedSyncAt: now,
    syncError: message,
    hasFetchedServerInventory: false,
  };
}

export function isInventorySyncRequestCurrent(
  sync: Pick<InventorySyncState, "activeRequestId">,
  requestId: number,
): boolean {
  return sync.activeRequestId === requestId;
}

export function buildSignedOutInventorySyncPatch(
  hasHydratedPersist: boolean,
): Partial<InventorySyncState> {
  return {
    status: "idle",
    isFetching: false,
    isSyncing: false,
    loadedForUserId: null,
    lastSuccessfulSyncAt: null,
    lastFailedSyncAt: undefined,
    hasFetchedServerInventory: false,
    syncError: undefined,
    hasUnsyncedChanges: false,
    pendingMutationCount: 0,
    hasHydratedPersist,
  };
}

export function shouldClearAuthenticatedLogisticsForUser(
  loadedForUserId: string | null,
  nextUserId: string | null,
): boolean {
  if (!nextUserId) return true;
  return loadedForUserId !== nextUserId;
}

export function buildPendingUserSwitchInventorySyncPatch(): Partial<InventorySyncState> {
  return {
    status: "pending",
    isFetching: true,
    isSyncing: false,
    loadedForUserId: null,
    lastSuccessfulSyncAt: null,
    lastFailedSyncAt: undefined,
    hasFetchedServerInventory: false,
    syncError: undefined,
    hasUnsyncedChanges: false,
    pendingMutationCount: 0,
  };
}

export function logInventorySyncDev(event: string, details: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  console.info("[inventory-sync]", event, details);
}
