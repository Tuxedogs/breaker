import type { InventorySyncState } from "../../stores/logisticsStore";

export const INVENTORY_FRESHNESS_MS = 60_000;
export const INVENTORY_FRESHNESS_REQUIRED_MESSAGE = "Inventory needs a fresh server sync before this action.";

export function isInventoryFetchedRecently(
  sync: Pick<InventorySyncState, "lastFetchedAt" | "hasFetchedServerInventory">,
  now = Date.now(),
): boolean {
  if (!sync.hasFetchedServerInventory || !sync.lastFetchedAt) return false;
  const fetchedAt = Date.parse(sync.lastFetchedAt);
  return Number.isFinite(fetchedAt) && now - fetchedAt <= INVENTORY_FRESHNESS_MS;
}

export function getInventoryFreshnessBlockReason(
  sync: Pick<
    InventorySyncState,
    "isFetching" | "isSyncing" | "lastFetchedAt" | "hasUnsyncedChanges" | "hasFetchedServerInventory"
  >,
  now = Date.now(),
): string | null {
  if (
    sync.isFetching ||
    sync.isSyncing ||
    sync.hasUnsyncedChanges ||
    !isInventoryFetchedRecently(sync, now)
  ) {
    return INVENTORY_FRESHNESS_REQUIRED_MESSAGE;
  }
  return null;
}
