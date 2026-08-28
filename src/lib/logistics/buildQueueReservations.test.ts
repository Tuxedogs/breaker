import assert from "node:assert/strict";
import test from "node:test";
import { rarityCatalog } from "../../data/logistics/seed";
import type { BuildQueueItem, InventoryEntry, ReservedMaterialAllocation } from "../../types/logistics";
import { useLogisticsStore } from "../../stores/logisticsStore";
import {
  getAvailableQuantityForInventoryEntry,
  getReservedQuantityByInventoryEntry,
  validateReservedAllocations,
} from "./selectors.ts";
import {
  getHighestAvailableInventoryQuality,
  getLotAvailableAmountAfterReservations,
  getReservedAmountForInventoryLot,
} from "./buildQueueReservations.ts";

function stack(id: string, quantity: number, quality: number): Pick<InventoryEntry, "id" | "quantity" | "quality"> {
  return { id, quantity, quality };
}

function allocation(id: string, inventoryEntryId: string, quantityReserved: number): Pick<ReservedMaterialAllocation, "id" | "inventoryEntryId" | "quantityReserved"> {
  return { id, inventoryEntryId, quantityReserved };
}

function reservedAllocation(
  id: string,
  inventoryEntryId: string,
  quantityReserved: number,
  allowLowerQualityOverride = false,
  materialId = "stileron",
): ReservedMaterialAllocation {
  return {
    id,
    inventoryEntryId,
    materialId,
    quantityReserved,
    allowLowerQualityOverride,
    rarity: rarityCatalog.common,
  };
}

function queueItem(id: string, reservedAllocations: ReservedMaterialAllocation[] = []): BuildQueueItem {
  return {
    id,
    entryKind: "instance",
    queueId: "queue-a",
    recipeId: "same-recipe",
    quantity: 1,
    allowLowerQuality: false,
    reservedAllocations,
  };
}

function inventoryLot(id = "lot-a", quantity = 10): InventoryEntry {
  return {
    id,
    materialId: "stileron",
    itemName: "Stileron",
    quantity,
    rarity: rarityCatalog.common,
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
  };
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

test("normal and lower-quality override allocations both reserve physical lot quantity", () => {
  const normal = reservedAllocation("normal", "lot-a", 3);
  const lowerQualityOverride = reservedAllocation("override", "lot-a", 4, true);
  const queue = [
    queueItem("instance-a", [normal]),
    queueItem("instance-b", [lowerQualityOverride]),
  ];
  const lot = inventoryLot();

  assert.equal(getReservedAmountForInventoryLot(queue, lot.id), 7);
  assert.equal(getReservedQuantityByInventoryEntry(queue).get(lot.id), 7);
  assert.equal(getAvailableQuantityForInventoryEntry(lot, queue), 3);
  assert.equal(getAvailableQuantityForInventoryEntry(lot, queue, "instance-a"), 6);
  assert.equal(getLotAvailableAmountAfterReservations(lot, queue, "instance-a", [normal]), 3);
});

test("non-positive allocations are stale and do not reduce lot availability", () => {
  const zero = reservedAllocation("zero", "lot-a", 0);
  const negative = reservedAllocation("negative", "lot-a", -2);
  const queue = [queueItem("instance-a", [zero, negative])];
  const lot = inventoryLot();

  assert.equal(getReservedAmountForInventoryLot(queue, lot.id), 0);
  assert.equal(getReservedQuantityByInventoryEntry(queue).has(lot.id), false);
  assert.equal(getAvailableQuantityForInventoryEntry(lot, queue), lot.quantity);
  assert.deepEqual(
    validateReservedAllocations([zero, negative], [lot]).map((validation) => validation.staleReason),
    ["nonPositiveQuantity", "nonPositiveQuantity"],
  );
});

test("existing validation reports missing, mismatched, and oversized stale allocations", () => {
  const lot = inventoryLot();
  const missing = reservedAllocation("missing", "missing-lot", 1);
  const mismatched = reservedAllocation("mismatched", lot.id, 1, false, "different-material");
  const oversized = reservedAllocation("oversized", lot.id, lot.quantity + 1);

  assert.deepEqual(
    validateReservedAllocations([missing, mismatched, oversized], [lot]).map((validation) => validation.staleReason),
    ["missingStack", "mismatchedMaterial", "exceedsStackQuantity"],
  );
  assert.equal(getLotAvailableAmountAfterReservations(lot, [queueItem("instance-a", [oversized])]), 0);
});

test("completed craft snapshots do not reserve live inventory lots", () => {
  const historical = reservedAllocation("historical", "lot-a", 8, true);
  const completed = {
    ...queueItem("completed", [historical]),
    status: "complete" as const,
  };
  const lot = inventoryLot();

  assert.equal(getReservedAmountForInventoryLot([completed], lot.id), 0);
  assert.equal(getAvailableQuantityForInventoryEntry(lot, [completed]), lot.quantity);
  assert.equal(getLotAvailableAmountAfterReservations(lot, [completed], completed.id, [historical]), lot.quantity);
});

test("store sanitization and selector views agree when duplicate recipe instances compete for one lot", () => {
  const original = useLogisticsStore.getState();
  try {
    const lot = inventoryLot();
    useLogisticsStore.setState({
      inventoryEntries: [lot],
      buildQueues: [{ id: "queue-a", name: "Queue A", sourceType: "custom" }],
      activeBuildQueueId: "queue-a",
      buildQueue: [queueItem("instance-a"), queueItem("instance-b")],
    });

    useLogisticsStore.getState().setBuildQueueItemAllocations("instance-a", [
      reservedAllocation("normal", lot.id, 6),
    ]);
    useLogisticsStore.getState().setBuildQueueItemAllocations("instance-b", [
      reservedAllocation("override", lot.id, 6, true),
    ]);

    const queue = useLogisticsStore.getState().buildQueue;
    assert.equal(queue.find((item) => item.id === "instance-a")?.reservedAllocations?.[0].quantityReserved, 6);
    assert.equal(queue.find((item) => item.id === "instance-b")?.reservedAllocations?.[0].quantityReserved, 4);
    assert.equal(getReservedQuantityByInventoryEntry(queue).get(lot.id), 10);
    assert.equal(getAvailableQuantityForInventoryEntry(lot, queue), 0);
  } finally {
    useLogisticsStore.setState(original, true);
  }
});
