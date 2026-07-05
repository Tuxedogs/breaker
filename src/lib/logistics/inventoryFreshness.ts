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

export function getInventoryFreshnessBlockReason(
  sync: Pick<
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
  >,
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
