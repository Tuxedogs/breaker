import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeInventoryImportBatchState,
  hasInventoryImportSyncPayload,
  revertInventoryImportBatchLocalState,
} from "../../src/lib/logistics/inventoryImportBatch";
import type { InventoryEntry, InventoryLocation } from "../../src/types/logistics";

const baseLocation: InventoryLocation = {
  id: "loc-1",
  name: "Levski",
  category: "manual",
  type: "station",
};

const existingEntry: InventoryEntry = {
  id: "inv-existing",
  materialId: "mat-1",
  itemName: "Beryl",
  quantity: 2,
  locationId: "loc-1",
};

describe("inventoryImportBatch", () => {
  it("builds a single batch payload for new import rows", () => {
    const addition: InventoryEntry = {
      id: "inv-new",
      materialId: "mat-1",
      itemName: "Beryl",
      quantity: 4,
      locationId: "loc-1",
      importSourceType: "inventory_csv",
    };
    const computed = computeInventoryImportBatchState(
      { locations: [baseLocation], inventoryEntries: [existingEntry] },
      { batchId: "csv-batch-1", additions: [addition], locations: [] },
    );

    assert.equal(computed.stacksToSync.length, 1);
    assert.equal(computed.stacksToSync[0]?.id, "inv-new");
    assert.equal(computed.inventoryEntries.length, 2);
    assert.equal(hasInventoryImportSyncPayload([], computed.stacksToSync), true);
  });

  it("restores the prior local snapshot when import sync fails", () => {
    const snapshot = {
      locations: [baseLocation],
      inventoryEntries: [existingEntry],
    };
    const reverted = revertInventoryImportBatchLocalState(snapshot);
    assert.deepEqual(reverted.locations, snapshot.locations);
    assert.deepEqual(reverted.inventoryEntries, snapshot.inventoryEntries);
  });

  it("does not treat an empty import payload as syncable", () => {
    assert.equal(hasInventoryImportSyncPayload([], []), false);
  });
});
