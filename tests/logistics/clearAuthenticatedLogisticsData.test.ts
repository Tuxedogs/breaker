import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getInventoryFreshnessBlockReason,
} from "../../src/lib/logistics/inventoryFreshness";
import {
  buildSignedOutInventorySyncPatch,
  shouldClearAuthenticatedLogisticsForUser,
} from "../../src/lib/logistics/inventorySyncLifecycle";
import {
  buildAuthenticatedLogisticsClearUpdate,
  useLogisticsStore,
} from "../../src/stores/logisticsStore";
import type { InventoryEntry, InventoryLocation } from "../../src/types/logistics";

const sampleUi = {
  selectedLocationId: "loc-user-1",
  searchQuery: "beryl",
  materialFilter: "mat-1",
  locationFilter: "loc-user-1",
  qualityMin: 900,
  sortKey: "quality" as const,
  sortDir: "desc" as const,
  viewMode: "list" as const,
  listGroupBy: "item" as const,
  lastImportMode: "append" as const,
  expandedCards: ["card-1"],
  expandedQualityRows: ["row-1"],
  viewDensity: "compact" as const,
};

describe("clearAuthenticatedLogisticsData", () => {
  it("clears visible user-owned logistics data", () => {
    const cleared = buildAuthenticatedLogisticsClearUpdate({
      inventoryUi: sampleUi,
      buildQueue: [{
        id: "bq-user-1",
        recipeId: "recipe-1",
        quantity: 2,
        reservedAllocations: [{
          id: "alloc-1",
          inventoryEntryId: "inv-1",
          materialId: "mat-1",
          quantityReserved: 1,
          requirementId: "req-1",
        }],
      }],
    });

    assert.equal(cleared.inventoryEntries.length, 0);
    assert.ok(cleared.locations.length > 0);
    assert.equal(cleared.buildQueue.every((item) => (item.reservedAllocations ?? []).length === 0), true);
  });

  it("preserves inventory UI preferences except data-bound selections", () => {
    const cleared = buildAuthenticatedLogisticsClearUpdate({
      inventoryUi: sampleUi,
      buildQueue: [],
    });

    assert.equal(cleared.inventoryUi.searchQuery, "beryl");
    assert.equal(cleared.inventoryUi.materialFilter, "mat-1");
    assert.equal(cleared.inventoryUi.locationFilter, "loc-user-1");
    assert.equal(cleared.inventoryUi.qualityMin, 900);
    assert.equal(cleared.inventoryUi.sortKey, "quality");
    assert.equal(cleared.inventoryUi.sortDir, "desc");
    assert.equal(cleared.inventoryUi.viewMode, "list");
    assert.equal(cleared.inventoryUi.listGroupBy, "item");
    assert.equal(cleared.inventoryUi.viewDensity, "compact");
    assert.equal(cleared.inventoryUi.selectedLocationId, null);
    assert.deepEqual(cleared.inventoryUi.expandedCards, []);
    assert.deepEqual(cleared.inventoryUi.expandedQualityRows, []);
  });

  it("store action clears authenticated logistics data while keeping UI prefs", () => {
    useLogisticsStore.setState({
      inventoryEntries: [{
        id: "inv-1",
        materialId: "mat-1",
        quantity: 4,
      } as InventoryEntry],
      locations: [{
        id: "loc-user-1",
        name: "User Hangar",
      } as InventoryLocation],
      inventoryUi: sampleUi,
    });

    useLogisticsStore.getState().clearAuthenticatedLogisticsData();
    const after = useLogisticsStore.getState();

    assert.equal(after.inventoryEntries.length, 0);
    assert.equal(after.inventoryUi.searchQuery, "beryl");
    assert.equal(after.inventoryUi.selectedLocationId, null);
  });
});

describe("auth logistics visibility guards", () => {
  it("blocks mutations while signed out", () => {
    const sync = {
      ...buildSignedOutInventorySyncPatch(true),
      hasHydratedPersist: true,
    };
    assert.ok(getInventoryFreshnessBlockReason(sync, null));
  });

  it("requires clearing visible data when authenticated user changes", () => {
    assert.equal(shouldClearAuthenticatedLogisticsForUser("user-a", "user-b"), true);
    assert.equal(shouldClearAuthenticatedLogisticsForUser("user-a", "user-a"), false);
    assert.equal(shouldClearAuthenticatedLogisticsForUser(null, "user-b"), true);
    assert.equal(shouldClearAuthenticatedLogisticsForUser("user-a", null), true);
  });

  it("wrong-user freshness remains false", () => {
    const sync = {
      status: "synced" as const,
      isFetching: false,
      isSyncing: false,
      loadedForUserId: "user-b",
      lastSuccessfulSyncAt: Date.now(),
      hasUnsyncedChanges: false,
      hasFetchedServerInventory: true,
      syncError: undefined,
    };
    assert.ok(getInventoryFreshnessBlockReason(sync, "user-a"));
  });
});
