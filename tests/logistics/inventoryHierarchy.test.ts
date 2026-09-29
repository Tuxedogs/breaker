import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { rarityCatalog } from "../../src/data/logistics/seed";
import { groupReservableStacksByLocation } from "../../src/lib/logistics/inventoryHierarchy";
import type { InventoryStack } from "../../src/lib/logistics/inventory";
import type { InventoryLocation, MaterialTemplate } from "../../src/types/logistics";

const timestamp = "2026-07-25T00:00:00.000Z";
const material: MaterialTemplate = {
  id: "iron",
  name: "Iron",
  materialType: "refined",
  rarity: rarityCatalog.common,
};
const locations: InventoryLocation[] = [
  { id: "loc-a", name: "Orbital A", system: "Pyro", type: "station" },
  { id: "loc-b", name: "Warehouse B", system: "Stanton", type: "city" },
];

function stack(id: string, patch: Partial<InventoryStack> = {}): InventoryStack {
  return {
    id,
    recordKind: "box",
    materialId: material.id,
    itemName: material.name,
    itemKind: "refined",
    materialType: "refined",
    unitType: "scu",
    quality: 500,
    quantity: 1,
    locationId: locations[0].id,
    rarity: rarityCatalog.common,
    createdAt: timestamp,
    updatedAt: timestamp,
    material,
    location: locations[0],
    ...patch,
  };
}

describe("Build Queue reservable inventory grouping", () => {
  it("preserves first-seen location and quality order without collapsing physical records", () => {
    const stacks = [
      stack("first", { locationId: "loc-b", quality: 400, location: locations[1] }),
      stack("second", { locationId: "loc-a", quality: 900, location: locations[0] }),
      stack("third", { locationId: "loc-b", quality: 800, location: locations[1] }),
      stack("fourth", { locationId: "loc-b", quality: 400, location: locations[1] }),
    ];

    const grouped = groupReservableStacksByLocation(stacks);

    assert.deepEqual(grouped.map((folder) => folder.key), ["loc-b", "loc-a"]);
    assert.deepEqual(grouped[0].qualities.map((folder) => folder.quality), [400, 800]);
    assert.deepEqual(grouped[0].qualities[0].stacks.map((entry) => entry.id), ["first", "fourth"]);
    assert.deepEqual(grouped.flatMap((folder) => folder.stacks).map((entry) => entry.id), ["first", "third", "fourth", "second"]);
  });

  it("keeps Quality 0 distinct from missing quality", () => {
    const grouped = groupReservableStacksByLocation([
      stack("zero", { quality: 0 }),
      stack("missing", { quality: undefined, recordKind: "aggregate" }),
    ]);

    assert.deepEqual(grouped[0].qualities.map((folder) => folder.quality), [0, null]);
    assert.deepEqual(grouped[0].qualities.map((folder) => folder.key), ["0", "unknown"]);
  });

  it("uses safe user-facing labels for unassigned and unresolved locations", () => {
    const grouped = groupReservableStacksByLocation([
      stack("unassigned", { locationId: undefined, location: undefined }),
      stack("unknown", { locationId: "missing-location", location: undefined }),
    ]);

    assert.deepEqual(grouped.map((folder) => folder.label), ["Unassigned Stock", "Unknown Location"]);
    assert.ok(grouped.every((folder) => !folder.label.includes("missing-location")));
  });
});
