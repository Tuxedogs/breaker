import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { rarityCatalog } from "../../src/data/logistics/seed";
import {
  buildInventoryHierarchy,
  groupReservableStacksByLocation,
} from "../../src/lib/logistics/inventoryHierarchy";
import type {
  InventoryEntry,
  InventoryLocation,
  MaterialTemplate,
} from "../../src/types/logistics";

const timestamp = "2026-07-25T00:00:00.000Z";
const materials: MaterialTemplate[] = [
  { id: "iron", name: "Iron", materialType: "refined", rarity: rarityCatalog.common },
];
const locations: InventoryLocation[] = [
  { id: "loc-a", name: "Orbital A", system: "Pyro", type: "station" },
  { id: "loc-b", name: "Warehouse B", system: "Stanton", type: "city" },
];

function entry(id: string, patch: Partial<InventoryEntry> = {}): InventoryEntry {
  return {
    id,
    recordKind: "box",
    materialId: "iron",
    itemName: "Iron",
    itemKind: "refined",
    materialType: "refined",
    unitType: "scu",
    quality: 500,
    quantity: 1,
    locationId: "loc-a",
    rarity: rarityCatalog.common,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...patch,
  };
}

describe("inventory hierarchy", () => {
  it("inverts Location and Item views without combining SCU and units", () => {
    const entries = [
      entry("scu-a"),
      entry("unit-a", { catalogItemId: "iron-unit", unitType: "unit", quantity: 3 }),
      entry("scu-b", { locationId: "loc-b", quantity: 2 }),
    ];

    const byLocation = buildInventoryHierarchy(entries, materials, locations, "location");
    assert.deepEqual(byLocation.map((folder) => folder.label), ["Orbital A", "Warehouse B"]);
    assert.equal(byLocation[0].totalScu, 1);
    assert.equal(byLocation[0].totalUnits, 3);
    assert.equal(byLocation[0].secondaryFolders.length, 2);

    const byItem = buildInventoryHierarchy(entries, materials, locations, "item");
    assert.equal(byItem.length, 2);
    assert.equal(byItem.find((folder) => folder.rows[0].unitType === "scu")?.secondaryFolders.length, 2);
  });

  it("keeps Quality 0 distinct from missing quality and preserves aggregate records", () => {
    const folders = buildInventoryHierarchy([
      entry("zero", { quality: 0 }),
      entry("missing", { quality: undefined, recordKind: "aggregate" }),
    ], materials, locations, "location");

    const qualities = folders[0].secondaryFolders[0].qualityFolders;
    assert.equal(qualities.length, 2);
    assert.ok(qualities.some((folder) => folder.quality === 0));
    assert.ok(qualities.some((folder) => folder.quality === null));
    assert.equal(qualities.flatMap((folder) => folder.rows).find((row) => row.id === "missing")?.entry.recordKind, "aggregate");
  });

  it("uses safe labels for unassigned and unresolved locations", () => {
    const folders = buildInventoryHierarchy([
      entry("unassigned", { locationId: undefined }),
      entry("unknown", { locationId: "missing-location" }),
    ], materials, locations, "location");

    assert.deepEqual(folders.map((folder) => folder.label), ["Unassigned Stock", "Unknown Location"]);
    assert.ok(folders.every((folder) => !folder.label.includes("missing-location")));
  });

  it("preserves first-seen reservation order while nesting location and quality", () => {
    const stacks = [
      { ...entry("first", { locationId: "loc-b", quality: 400 }), material: materials[0], location: locations[1] },
      { ...entry("second", { locationId: "loc-a", quality: 900 }), material: materials[0], location: locations[0] },
      { ...entry("third", { locationId: "loc-b", quality: 800 }), material: materials[0], location: locations[1] },
    ];

    const grouped = groupReservableStacksByLocation(stacks);
    assert.deepEqual(grouped.map((folder) => folder.key), ["loc-b", "loc-a"]);
    assert.deepEqual(grouped[0].qualities.map((folder) => folder.quality), [400, 800]);
    assert.deepEqual(grouped[0].qualities.flatMap((folder) => folder.stacks.map((stack) => stack.id)), ["first", "third"]);
  });
});
