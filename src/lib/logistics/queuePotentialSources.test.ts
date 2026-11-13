import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { BuildQueueItem, InventoryEntry, InventoryLocation } from "../../types/logistics";
import type { Shortage } from "./shortages";
import { getQueuePotentialSources } from "./queuePotentialSources";

const line = (selectedQuality = 900): Shortage => ({
  key: "beryl-target", materialKey: "beryl", materialId: "beryl",
  selectedQuality, unitType: "unit", needed: 12, allocated: 0,
  available: 0, have: 0, shortfall: 12,
});
const lot = (id: string, locationId: string, quantity: number, quality: number, overrides: Partial<InventoryEntry> = {}): InventoryEntry => ({
  id, locationId, quantity, quality,
  recordKind: "box", materialId: "beryl", unitType: "unit",
  itemKind: "material", inventoryStatus: "active",
  ...overrides,
} as InventoryEntry);
const places: InventoryLocation[] = [{ id: "area18", name: "Area18" }, { id: "everus", name: "Everus Harbor" }];

test("potential sources report only actual eligible unreserved physical lots", () => {
  const inventory = [
    lot("a", "area18", 8, 935),
    lot("b", "everus", 5, 850),
    lot("c", "area18", 4, 975),
    lot("d", "everus", 20, 990, { recordKind: "aggregate" }),
    lot("e", "everus", 10, 990, { materialType: "ore" }),
  ];
  const reserved = [{
    id: "craft1",
    status: "queued",
    reservedAllocations: [{ id: "reserve1", inventoryEntryId: "c", quantityReserved: 2 }],
  }] as BuildQueueItem[];
  const sources = getQueuePotentialSources([line()], inventory, places, reserved);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].name, "Area18");
  assert.equal(sources[0].available, 10);
  assert.equal(sources[0].lotCount, 2);
  assert.equal(sources[0].materials[0].qualityMin, 935);
  assert.equal(sources[0].materials[0].qualityMax, 975);
});
test("quality gating and replacement status cannot create false source cards", () => {
  assert.equal(getQueuePotentialSources([line(990)], [lot("a", "area18", 3, 935)], places, []).length, 0);
  assert.equal(getQueuePotentialSources([line(900)], [lot("a", "area18", 3, 935, { inventoryStatus: "replaced" })], places, []).length, 0);
});
test("remaining availability cannot double-count one physical lot for repeated requirements", () => {
  const sources = getQueuePotentialSources([line(800), line(900)], [lot("a", "area18", 3, 940)], places, []);
  assert.equal(sources[0].materials[0].available, 3);
  assert.equal(sources[0].lotCount, 1);
});
