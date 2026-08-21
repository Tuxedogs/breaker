import assert from "node:assert/strict";
import test from "node:test";
import type { BuildQueueItem, InventoryEntry, ReservedMaterialAllocation } from "../../types/logistics";
import { getHighestAvailableInventoryQuality } from "./buildQueueReservations.ts";

function stack(id: string, quantity: number, quality: number): Pick<InventoryEntry, "id" | "quantity" | "quality"> {
  return { id, quantity, quality };
}

function allocation(id: string, inventoryEntryId: string, quantityReserved: number): Pick<ReservedMaterialAllocation, "id" | "inventoryEntryId" | "quantityReserved"> {
  return { id, inventoryEntryId, quantityReserved };
}

test("highest available quality ignores reserved inventory", () => {
  assert.equal(
    getHighestAvailableInventoryQuality(
      [stack("a", 2, 400), stack("b", 1, 820), stack("c", 3, 610)],
      [],
      "craft-1",
    ),
    820,
  );

  const ownAllocations = [allocation("alloc-b", "b", 1)];
  const queue = [{
    id: "other-craft",
    reservedAllocations: [allocation("alloc-a", "a", 2)],
  }] as BuildQueueItem[];
  assert.equal(
    getHighestAvailableInventoryQuality(
      [stack("a", 2, 900), stack("b", 1, 850), stack("c", 2, 530)],
      queue,
      "craft-1",
      ownAllocations,
    ),
    530,
  );

  assert.equal(
    getHighestAvailableInventoryQuality(
      [stack("a", 2, 740), stack("b", 1, 500)],
      [],
      "craft-1",
      [allocation("alloc-a", "a", 1)],
    ),
    740,
  );
});
