import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canMutateInventory,
  getInventoryAddReadinessBlockReason,
  getInventoryMutationBlockReason,
  getInventoryFreshnessBlockReason,
} from "../../src/lib/logistics/inventoryFreshness";
import type { InventorySyncState } from "../../src/stores/logisticsStore";

function syncedState(overrides: Partial<InventorySyncState> = {}): InventorySyncState {
  return {
    status: "synced",
    isFetching: false,
    isSyncing: false,
    loadedForUserId: "user-a",
    lastSuccessfulSyncAt: Date.now(),
    activeRequestId: 1,
    hasUnsyncedChanges: false,
    pendingMutationCount: 0,
    hasHydratedPersist: true,
    hasFetchedServerInventory: true,
    ...overrides,
  };
}

describe("inventory mutation guard", () => {
  const userId = "user-a";
  const readyContext = { hasAccessToken: true, hasHydratedPersist: true };

  it("blocks append import path when inventory is not synced", () => {
    const sync = syncedState({ status: "pending", lastSuccessfulSyncAt: null });
    assert.equal(canMutateInventory(sync, userId, readyContext), false);
    assert.ok(getInventoryMutationBlockReason(sync, userId, readyContext));
  });

  it("blocks when signed out", () => {
    const sync = syncedState();
    assert.ok(getInventoryMutationBlockReason(sync, null, { hasAccessToken: false, hasHydratedPersist: true }));
  });

  it("blocks when auth token is missing", () => {
    const sync = syncedState();
    assert.ok(getInventoryMutationBlockReason(sync, userId, { hasAccessToken: false, hasHydratedPersist: true }));
  });

  it("blocks when hydration is incomplete", () => {
    const sync = syncedState();
    assert.ok(getInventoryMutationBlockReason(sync, userId, { hasAccessToken: true, hasHydratedPersist: false }));
  });

  it("blocks when loaded user mismatches", () => {
    const sync = syncedState({ loadedForUserId: "user-b" });
    assert.ok(getInventoryFreshnessBlockReason(sync, userId));
    assert.ok(getInventoryMutationBlockReason(sync, userId, readyContext));
  });

  it("allows mutation only when synced and fresh", () => {
    const sync = syncedState();
    assert.equal(canMutateInventory(sync, userId, readyContext), true);
    assert.equal(getInventoryMutationBlockReason(sync, userId, readyContext), null);
  });

  it("allows creating discrete boxes after the general freshness window expires", () => {
    const sync = syncedState({ lastSuccessfulSyncAt: 1 });
    assert.ok(getInventoryMutationBlockReason(sync, userId, readyContext));
    assert.equal(getInventoryAddReadinessBlockReason(sync, userId, readyContext), null);
  });

  it("still blocks box creation before initial server inventory is ready", () => {
    const sync = syncedState({
      status: "pending",
      hasFetchedServerInventory: false,
      loadedForUserId: userId,
    });
    assert.ok(getInventoryAddReadinessBlockReason(sync, userId, readyContext));
  });

  it("still blocks box creation for a different authenticated user", () => {
    const sync = syncedState({ loadedForUserId: "user-b" });
    assert.ok(getInventoryAddReadinessBlockReason(sync, userId, readyContext));
  });

  it("allows retrying a failed add when the authenticated server inventory was already loaded", () => {
    const sync = syncedState({ status: "error", syncError: "Temporary network failure" });
    assert.equal(getInventoryAddReadinessBlockReason(sync, userId, readyContext), null);
  });
});
