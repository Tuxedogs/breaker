import type { InventorySyncState } from "../../stores/logisticsStore";

export const INVENTORY_FRESHNESS_MS = 60_000;
export const INVENTORY_FRESHNESS_REQUIRED_MESSAGE = "Inventory needs a fresh server sync before this action.";

export function isInventoryFetchedRecently(
  sync: Pick<
    InventorySyncState,
    | "lastSuccessfulSyncAt"
    | "lastFetchedAt"
    | "hasFetchedServerInventory"
    | "loadedForUserId"
  >,
  currentUserId: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!currentUserId || sync.loadedForUserId !== currentUserId) return false;

  const syncedAt = sync.lastSuccessfulSyncAt ?? (
    sync.hasFetchedServerInventory && sync.lastFetchedAt
      ? Date.parse(sync.lastFetchedAt)
      : Number.NaN
  );

  return Number.isFinite(syncedAt) && syncedAt > 0 && now - syncedAt <= INVENTORY_FRESHNESS_MS;
}

export type InventoryMutationContext = {
  hasAccessToken: boolean;
  hasHydratedPersist: boolean;
};

export type InventoryFreshnessSync = Pick<
  InventorySyncState,
  | "status"
  | "isFetching"
  | "isSyncing"
  | "lastSuccessfulSyncAt"
  | "lastFetchedAt"
  | "hasUnsyncedChanges"
  | "hasFetchedServerInventory"
  | "loadedForUserId"
  | "syncError"
>;

export function getInventoryFreshnessBlockReason(
  sync: InventoryFreshnessSync,
  currentUserId: string | null | undefined,
  now = Date.now(),
): string | null {
  if (!currentUserId) {
    return INVENTORY_FRESHNESS_REQUIRED_MESSAGE;
  }

  if (
    sync.isFetching ||
    sync.isSyncing ||
    sync.hasUnsyncedChanges ||
    sync.status === "error" ||
    sync.status === "pending" ||
    !isInventoryFetchedRecently(sync, currentUserId, now)
  ) {
    return sync.syncError ?? INVENTORY_FRESHNESS_REQUIRED_MESSAGE;
  }

  return null;
}

export function getInventoryMutationBlockReason(
  sync: InventoryFreshnessSync & Pick<InventorySyncState, "hasHydratedPersist">,
  currentUserId: string | null | undefined,
  context: InventoryMutationContext,
  now = Date.now(),
): string | null {
  if (!context.hasHydratedPersist) {
    return INVENTORY_FRESHNESS_REQUIRED_MESSAGE;
  }
  if (!context.hasAccessToken || !currentUserId) {
    return INVENTORY_FRESHNESS_REQUIRED_MESSAGE;
  }
  if (sync.status !== "synced") {
    return sync.syncError ?? INVENTORY_FRESHNESS_REQUIRED_MESSAGE;
  }
  return getInventoryFreshnessBlockReason(sync, currentUserId, now);
}

export function canMutateInventory(
  sync: InventoryFreshnessSync & Pick<InventorySyncState, "hasHydratedPersist">,
  currentUserId: string | null | undefined,
  context: InventoryMutationContext,
  now = Date.now(),
): boolean {
  return getInventoryMutationBlockReason(sync, currentUserId, context, now) === null;
}

export function isInventoryServerFetchStale(
  sync: Pick<InventorySyncState, "lastSuccessfulSyncAt" | "lastFetchedAt" | "hasFetchedServerInventory">,
  now = Date.now(),
): boolean {
  if (!sync.hasFetchedServerInventory) return true;
  const syncedAt = sync.lastSuccessfulSyncAt ?? (
    sync.lastFetchedAt ? Date.parse(sync.lastFetchedAt) : Number.NaN
  );
  return !Number.isFinite(syncedAt) || now - syncedAt > INVENTORY_FRESHNESS_MS;
}
