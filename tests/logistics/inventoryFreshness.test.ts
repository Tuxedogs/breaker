import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getInventoryFreshnessBlockReason,
  isInventoryFetchedRecently,
  INVENTORY_FRESHNESS_MS,
} from "../../src/lib/logistics/inventoryFreshness";
import type { InventorySyncState } from "../../src/stores/logisticsStore";

function baseSync(overrides: Partial<InventorySyncState> = {}): InventorySyncState {
  return {
    status: "synced",
    isFetching: false,
    isSyncing: false,
    loadedForUserId: "user-a",
    lastSuccessfulSyncAt: Date.now(),
    lastFailedSyncAt: undefined,
    activeRequestId: 1,
    hasUnsyncedChanges: false,
    pendingMutationCount: 0,
    hasHydratedPersist: true,
    hasFetchedServerInventory: true,
    lastFetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("inventoryFreshness", () => {
  const now = 1_700_000_000_000;
  const userId = "user-a";

  it("returns fresh when synced recently for the same user", () => {
    const sync = baseSync({ lastSuccessfulSyncAt: now - 30_000 });
    assert.equal(isInventoryFetchedRecently(sync, userId, now), true);
    assert.equal(getInventoryFreshnessBlockReason(sync, userId, now), null);
  });

  it("blocks when sync is stale", () => {
    const sync = baseSync({ lastSuccessfulSyncAt: now - INVENTORY_FRESHNESS_MS - 1 });
    assert.equal(isInventoryFetchedRecently(sync, userId, now), false);
    assert.ok(getInventoryFreshnessBlockReason(sync, userId, now));
  });

  it("blocks when user id does not match", () => {
    const sync = baseSync({ loadedForUserId: "user-b" });
    assert.equal(isInventoryFetchedRecently(sync, userId, now), false);
    assert.ok(getInventoryFreshnessBlockReason(sync, userId, now));
  });

  it("blocks when auth user is missing", () => {
    const sync = baseSync();
    assert.ok(getInventoryFreshnessBlockReason(sync, null, now));
  });

  it("blocks when last successful sync timestamp is missing", () => {
    const sync = baseSync({ lastSuccessfulSyncAt: null, hasFetchedServerInventory: false });
    assert.equal(isInventoryFetchedRecently(sync, userId, now), false);
    assert.ok(getInventoryFreshnessBlockReason(sync, userId, now));
  });

  it("blocks while fetching or syncing", () => {
    assert.ok(getInventoryFreshnessBlockReason(baseSync({ isFetching: true }), userId, now));
    assert.ok(getInventoryFreshnessBlockReason(baseSync({ isSyncing: true }), userId, now));
  });

  it("blocks when unsynced local mutations are pending", () => {
    assert.ok(getInventoryFreshnessBlockReason(baseSync({ hasUnsyncedChanges: true }), userId, now));
  });
});
