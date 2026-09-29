import { inventoryLocations, materialTemplates, rarityCatalog } from "../../data/logistics/seed";
import type { BuildQueueItem, InventoryEntry, MaterialTemplate } from "../../types/logistics";
import type { InventoryPageFixture } from "./InventoryPage";

const fixtureLocationId = "levski";
const now = "2026-07-11T00:00:00.000Z";

const fixtureExtraMaterials: MaterialTemplate[] = [
  { id: "pressurizedice", name: "Pressurized Ice", materialType: "refined" },
];

const fixtureMaterials = [...materialTemplates, ...fixtureExtraMaterials];
const materialById = new Map(fixtureMaterials.map((material) => [material.id, material]));

function materialTypeFor(materialId: string): MaterialTemplate["materialType"] {
  return materialById.get(materialId)?.materialType ?? "special";
}

function entry(
  id: string,
  materialId: string,
  quantity: number,
  quality: number,
  rarity: InventoryEntry["rarity"],
  container: string,
  boxSize: number | null = quantity,
  locationId = fixtureLocationId,
): InventoryEntry {
  return {
    id,
    recordKind: "box",
    materialId,
    materialType: materialTypeFor(materialId),
    quantity,
    quality,
    qualityBand: Math.max(1, Math.ceil(quality / 100)),
    unitType: "scu",
    boxSize,
    locationId,
    container,
    rarity,
    createdAt: now,
    updatedAt: now,
  };
}

function aggregateEntry(
  id: string,
  materialId: string,
  quantity: number,
  quality: number,
  rarity: InventoryEntry["rarity"],
  locationId = fixtureLocationId,
): InventoryEntry {
  return {
    id,
    recordKind: "aggregate",
    materialId,
    materialType: materialTypeFor(materialId),
    quantity,
    quality,
    qualityBand: Math.max(1, Math.ceil(quality / 100)),
    unitType: "scu",
    locationId,
    rarity,
    createdAt: now,
    updatedAt: now,
  };
}

const fixtureBuildQueue: BuildQueueItem[] = [
  {
    id: "fixture-active-craft",
    recipeId: "fixture-industrial-craft",
    itemName: "Industrial Fabrication Test",
    quantity: 1,
    status: "active",
    reservedAllocations: [{
      id: "fixture-reservation-active",
      materialId: "savrilium",
      inventoryEntryId: "fixture-levski-savrilium-a",
      quantityReserved: 12,
      quality: 942,
      rarity: rarityCatalog.legendary,
    }],
  },
  {
    id: "fixture-complete-craft",
    recipeId: "fixture-complete-craft",
    itemName: "Completed Fabrication Test",
    quantity: 1,
    status: "complete",
    reservedAllocations: [{
      id: "fixture-reservation-complete",
      materialId: "savrilium",
      inventoryEntryId: "fixture-levski-savrilium-b",
      quantityReserved: 32,
      quality: 942,
      rarity: rarityCatalog.legendary,
    }],
  },
];

export const inventoryLayoutFixture: InventoryPageFixture = {
  materials: fixtureMaterials,
  locations: inventoryLocations.filter((location) => [fixtureLocationId, "orison", "port-tressler", "arc-l1"].includes(location.id)),
  selectedLocationId: fixtureLocationId,
  buildQueue: fixtureBuildQueue,
  inventoryUi: {
    selectedLocationId: fixtureLocationId,
    searchQuery: "",
    materialFilter: "",
    locationFilter: "",
    qualityMin: 0,
    sortKey: "quality",
    sortDir: "desc",
    viewMode: "location",
    listGroupBy: "location",
    expandedCards: ["location:levski"],
  },
  entries: [
    entry("fixture-levski-savrilium-a", "savrilium", 32, 942, rarityCatalog.legendary, "SV-01", 32),
    entry("fixture-levski-savrilium-b", "savrilium", 32, 942, rarityCatalog.legendary, "SV-02", 32),
    entry("fixture-levski-savrilium-c", "savrilium", 16, 942, rarityCatalog.legendary, "SV-03", 16),
    entry("fixture-levski-savrilium-d", "savrilium", 8, 942, rarityCatalog.legendary, "SV-04", 8),
    entry("fixture-levski-savrilium-e", "savrilium", 4, 942, rarityCatalog.legendary, "SV-05", 4),
    entry("fixture-levski-pressurized-ice", "pressurizedice", 45, 711, rarityCatalog.rare, "CRYO-01", 45),
    entry("fixture-levski-feynmaline", "feynmaline", 24, 561, rarityCatalog.uncommon, "ROCK-01", 24),
    entry("fixture-levski-stileron", "stileron", 6, 974, rarityCatalog.legendary, "ST-01", 6),
    aggregateEntry("fixture-levski-tungsten", "tungsten", 18, 455, rarityCatalog.common),
    entry("fixture-levski-hadanite", "hadanite", 12, 887, rarityCatalog.epic, "FPS-01", 12),
    entry("fixture-transfer-failure", "tungsten", 987654, 0, rarityCatalog.common, "FREIGHT-LONG-IDENTIFIER-0001", 987654),
    entry("fixture-orison-savrilium", "savrilium", 1, 1000, rarityCatalog.legendary, "ORI-SV-01", 1, "orison"),
  ],
};
