import assert from "node:assert/strict";
import test from "node:test";

import { canonicalInventoryLocations } from "../../src/data/logistics/inventoryLocationCatalog";
import {
  buildInventoryLocationLookup,
  mergeCanonicalInventoryLocations,
  remapInventoryEntryLocationIds,
  resolveInventoryLocationByInput,
} from "../../src/lib/logistics/inventoryLocationOptions";
import type { InventoryEntry, InventoryLocation } from "../../src/types/logistics";

test("mergeCanonicalInventoryLocations always includes the full canonical catalog", () => {
  const merged = mergeCanonicalInventoryLocations([
    { id: "remote-levski", name: "Levksi", category: "manual", type: "station" },
  ]);

  assert.equal(merged.locations.length, canonicalInventoryLocations.length);
  assert.ok(merged.locations.some((location) => location.id === "levski"));
  assert.ok(merged.locations.some((location) => location.id === "area18"));
  assert.equal(merged.locationIdRemap.get("remote-levski"), "levski");
});

test("resolveInventoryLocationByInput matches canonical names and aliases case-insensitively", () => {
  const lookup = buildInventoryLocationLookup(canonicalInventoryLocations);
  const levski = resolveInventoryLocationByInput("  Levksi ", lookup);
  assert.equal(levski?.id, "levski");
  assert.equal(levski?.name, "Levski");
});

test("remapInventoryEntryLocationIds rewrites custom duplicate location ids to canonical ids", () => {
  const entries: InventoryEntry[] = [{
    id: "stack-1",
    quantity: 1,
    locationId: "remote-levski",
    itemName: "Stileron",
    unitType: "scu",
  }];
  const remapped = remapInventoryEntryLocationIds(entries, new Map([["remote-levski", "levski"]]));
  assert.equal(remapped[0]?.locationId, "levski");
});

test("mergeCanonicalInventoryLocations keeps unknown custom user locations", () => {
  const custom: InventoryLocation = {
    id: "custom-hangar",
    name: "Org Hangar 7",
    category: "manual",
    type: "station",
  };
  const merged = mergeCanonicalInventoryLocations([custom]);
  assert.equal(merged.locations.length, canonicalInventoryLocations.length + 1);
  assert.ok(merged.locations.some((location) => location.id === "custom-hangar"));
});

test("explicit custom locations retain their persisted identity even when their display name matches canonical data", () => {
  const custom: InventoryLocation = {
    id: "8bb19af8-8a3a-4a0a-99c4-28112744900b",
    name: "Levski",
    source: "custom",
    category: "custom",
  };
  const merged = mergeCanonicalInventoryLocations([custom]);

  assert.ok(merged.locations.some((location) => location.id === "levski"));
  assert.ok(merged.locations.some((location) => location.id === custom.id && location.source === "custom"));
  assert.equal(merged.locationIdRemap.has(custom.id), false);
});
