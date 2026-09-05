import assert from "node:assert/strict";
import test from "node:test";

import { materialTemplates, rarityCatalog } from "../../src/data/logistics/seed";
import { projectQueueMiningDemand } from "../../src/features/mining/queueMiningDemand";
import { buildRecommendationRequest } from "../../src/features/mining/recommenderAdapter";
import type { BuildQueueItem, InventoryEntry, ReservedMaterialAllocation } from "../../src/types/logistics";
import { aggregateRequirements } from "../../server/recommender/aggregateRequirements";

const createdAt = "2026-09-04T00:00:00.000Z";

function tungstenRequirement(selectedQuality = 900, quantity = 2) {
  return {
    requirementId: `tungsten-${selectedQuality}`,
    materialId: "tungsten",
    materialKey: "tungsten",
    materialName: "Tungsten",
    quantity,
    selectedQuality,
    unitType: "scu" as const,
  };
}

function queueItem(id: string, options: {
  quantity?: number;
  quality?: number;
  status?: BuildQueueItem["status"];
  reservedAllocations?: ReservedMaterialAllocation[];
} = {}): BuildQueueItem {
  return {
    id,
    recipeId: id,
    quantity: options.quantity ?? 1,
    status: options.status ?? "active",
    materialRequirements: [tungstenRequirement(options.quality)],
    reservedAllocations: options.reservedAllocations,
  };
}

function tungstenInventory(quality: number, quantity = 2): InventoryEntry {
  return {
    id: `tungsten-${quality}`,
    materialId: "tungsten",
    materialName: "Tungsten",
    itemName: "Tungsten",
    materialType: "refined",
    itemKind: "refined",
    unitType: "scu",
    quantity,
    quality,
    rarity: rarityCatalog.common,
    createdAt,
    updatedAt: createdAt,
  };
}

function demandFor(buildQueue: BuildQueueItem[], focusItemId?: string) {
  return projectQueueMiningDemand({
    buildQueue,
    materials: materialTemplates,
    recipeInputsByRecipeId: {},
    focusItemId,
  });
}

test("Queue Mining uses gross active Queue requirements at the selected quality", () => {
  assert.deepEqual(demandFor([queueItem("quality-900")]), [{
    materialKey: "tungsten",
    materialId: "tungsten",
    materialName: "Tungsten",
    displayName: "Tungsten",
    quantity: 2,
    originalRequiredQuantity: 2,
    requiredQuantity: 2,
    selectedQuality: 900,
    unitType: "scu",
    usedBy: [],
    slots: [],
  }]);
});

test("Queue Mining gross demand is independent of owned inventory quality and quantity", () => {
  const queue = [queueItem("quality-900")];
  const expected = demandFor(queue);
  // Inventory is deliberately outside this projection. These fixtures cover
  // no stock, lower-quality, matching-quality, higher-quality, and partial stock.
  for (const inventory of [
    [],
    [tungstenInventory(850)],
    [tungstenInventory(900)],
    [tungstenInventory(950)],
    [tungstenInventory(900, 1)],
  ]) {
    assert.ok(inventory.length === 0 || inventory[0]?.materialId === "tungsten");
    assert.deepEqual(demandFor(queue), expected);
  }
});

test("Queue Mining gross demand is independent of valid, invalid, and competing reservations", () => {
  const valid: ReservedMaterialAllocation = {
    id: "valid", inventoryEntryId: "lot-900", materialId: "tungsten", quantityReserved: 2,
    requirementId: "tungsten-900", quality: 900, unitType: "scu", rarity: rarityCatalog.common,
  };
  const invalid: ReservedMaterialAllocation = { ...valid, id: "below-quality", quality: 850 };
  const expected = demandFor([queueItem("first")]);
  assert.deepEqual(demandFor([queueItem("first", { reservedAllocations: [valid] })]), expected);
  assert.deepEqual(demandFor([queueItem("first", { reservedAllocations: [invalid] })]), expected);
  assert.deepEqual(demandFor([queueItem("first"), queueItem("second", { reservedAllocations: [valid] })]), [{ ...expected[0]!, quantity: 4, originalRequiredQuantity: 4, requiredQuantity: 4 }]);
});

test("Queue Mining focus limits gross demand to the focused active Queue item and excludes completed items", () => {
  const active = queueItem("active", { quantity: 2 });
  const other = queueItem("other", { quantity: 3 });
  const complete = queueItem("complete", { quantity: 9, status: "complete" });
  assert.equal(demandFor([active, other, complete])[0]?.requiredQuantity, 10);
  assert.equal(demandFor([active, other, complete], "active")[0]?.requiredQuantity, 4);
  assert.deepEqual(demandFor([active, other, complete], "complete"), []);
});

test("Queue Mining keeps same-material requirements with different quality policies distinct", () => {
  const queue = [{
    ...queueItem("mixed"),
    materialRequirements: [tungstenRequirement(850, 1), tungstenRequirement(900, 2)],
  }];
  assert.deepEqual(demandFor(queue).map((demand) => [demand.selectedQuality, demand.requiredQuantity]), [[850, 1], [900, 2]]);
});

test("recommender aggregation preserves material quality and unit policies", () => {
  const warnings: Array<{ code: string; message: string }> = [];
  const aggregated = aggregateRequirements([
    { materialId: "tungsten", materialName: "Tungsten", requiredQuantity: 1, selectedQuality: 850, unitType: "scu" },
    { materialId: "tungsten", materialName: "Tungsten", requiredQuantity: 2, selectedQuality: 900, unitType: "scu" },
    { materialId: "tungsten", materialName: "Tungsten", requiredQuantity: 3, selectedQuality: 900, unitType: "scu" },
    { materialId: "tungsten", materialName: "Tungsten", requiredQuantity: 4, selectedQuality: 900, unitType: "unit" },
  ], warnings);
  assert.deepEqual(aggregated.map((requirement) => [requirement.selectedQuality, requirement.requiredQuantity, requirement.unitType]), [[850, 1, "scu"], [900, 5, "scu"], [900, 4, "unit"]]);
});

test("Explore recommendation input remains independent of Queue mining demand", () => {
  const request = buildRecommendationRequest({
    priorityStack: [],
    manualDemand: [],
    favoriteLocationIds: [],
    filters: { showOnlyStarred: false },
  }, null);
  assert.deepEqual(request.requiredMaterials, []);
});
