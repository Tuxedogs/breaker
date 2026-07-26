import {
  inventoryLocations,
  materialTemplates,
  rarityCatalog,
  type RecipeInputTemplate,
} from "../../data/logistics/seed";
import type {
  BuildQueue,
  BuildQueueItem,
  InventoryEntry,
  InventoryLocation,
  MaterialTemplate,
  RecipeTemplate,
  ReservedMaterialAllocation,
} from "../../types/logistics";

const now = "2026-07-11T00:00:00.000Z";
const fixtureLocationId = "orbituary";

export const BUILD_QUEUE_STATS_FIXTURE_PATH = "/logistics/build-queue/__fixture/stats";
export const INVENTORY_ADD_MODAL_FIXTURE_PATH = "/logistics/build-queue/__fixture/add-inventory";

export const FIXTURE_BLUEPRINT_IDS = {
  fr66: "db3f4c97-8d40-4b36-b397-452dea1594fc",
  ad5b: "ba842720-ad32-4d53-8f56-992bacb1fc45",
  fpsWeapon: "bd636d35-43fd-4782-a223-40ce0a727f39",
  cq7: "1a85280e-7b8f-4486-a563-17cd2549d268",
  fpsArmor: "005d95db-96ca-45b7-9647-7e7537b8fac8",
  atlas: "17b29a33-88fe-484f-bb9b-fbf780273ff5",
  snowBlind: "9b4499d4-b54c-4eb9-b661-e65f3d0f501d",
  js300: "9585b0dc-b660-4e2a-9136-0092af1e72c1",
  m5a: "9fe902be-8b39-4d71-9017-e2fed7b0604c",
} as const;

export const FIXTURE_ITEM_IDS = {
  fr66: "bq-fixture-fr66",
  fr66High: "bq-fixture-fr66-high",
  fr66Precision: "bq-fixture-fr66-precision",
  fr66Completed: "bq-fixture-fr66-completed",
  ad5b: "bq-fixture-ad5b",
  fpsWeapon: "bq-fixture-fps-weapon",
  cq7: "bq-fixture-cq7",
  fpsArmor: "bq-fixture-fps-armor",
  atlas: "bq-fixture-atlas",
  snowBlind: "bq-fixture-snowblind",
  js300: "bq-fixture-js300",
  m5a: "bq-fixture-m5a-energy",
} as const;

const fixtureMaterials = [...materialTemplates];
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
): InventoryEntry {
  return {
    id,
    materialId,
    materialType: materialTypeFor(materialId),
    quantity,
    quality,
    qualityBand: Math.max(1, Math.ceil(quality / 100)),
    unitType: "scu",
    boxSize: quantity,
    locationId: fixtureLocationId,
    container,
    rarity,
    createdAt: now,
    updatedAt: now,
  };
}

function requirement(
  requirementId: string,
  materialId: string,
  quantity: number,
  unitType: RecipeInputTemplate["unitType"] = "scu",
  selectedQuality = 800,
): RecipeInputTemplate {
  return {
    requirementId,
    materialId,
    materialKey: materialId,
    materialName: materialById.get(materialId)?.name ?? materialId,
    quantity,
    unitType,
    selectedQuality,
  };
}

function allocation(
  id: string,
  materialId: string,
  inventoryEntryId: string,
  quantityReserved: number,
  requirementId: string,
  quality: number,
  rarity: InventoryEntry["rarity"],
  unitType: RecipeInputTemplate["unitType"] = "scu",
): ReservedMaterialAllocation {
  return {
    id,
    materialId,
    inventoryEntryId,
    quantityReserved,
    requirementId,
    selectedQuality: quality,
    quality,
    qualityBand: Math.max(1, Math.ceil(quality / 100)),
    unitType,
    materialName: materialById.get(materialId)?.name ?? materialId,
    rarity,
    locationId: fixtureLocationId,
  };
}

const inventoryEntries: InventoryEntry[] = [
  entry("bq-fix-inv-stileron", "stileron", 4, 860, rarityCatalog.legendary, "SHLD-01"),
  entry("bq-fix-inv-feynmaline", "feynmaline", 40, 720, rarityCatalog.rare, "SHLD-02"),
  entry("bq-fix-inv-iron", "iron", 12, 640, rarityCatalog.common, "WPN-01"),
  entry("bq-fix-inv-ouratite", "ouratite", 2, 780, rarityCatalog.uncommon, "WPN-02"),
  entry("bq-fix-inv-tungsten", "tungsten", 6, 700, rarityCatalog.common, "WPN-03"),
  entry("bq-fix-inv-taranite", "taranite", 1, 820, rarityCatalog.epic, "FPS-01"),
  entry("bq-fix-inv-hephaestanite", "hephaestanite", 1, 760, rarityCatalog.uncommon, "FPS-02"),
  entry("bq-fix-inv-hadanite", "hadanite", 4, 880, rarityCatalog.epic, "FPS-03"),
];

const recipes: RecipeTemplate[] = [
  { id: "recipe-fixture-fr66", name: "FR-66", category: "ship_part", outputTemplateId: "fr66", outputQuantity: 1 },
  { id: "recipe-fixture-ad5b", name: "AD5B Ballistic Gatling", category: "weapon", outputTemplateId: "ad5b", outputQuantity: 1 },
  { id: "recipe-fixture-fps-weapon", name: "P6-LR \"Archangel\" Sniper Rifle", category: "weapon", outputTemplateId: "p6-lr", outputQuantity: 1 },
  { id: "recipe-fixture-cq7", name: "CQ7 Rifle", category: "weapon", outputTemplateId: "cq7", outputQuantity: 1 },
  { id: "recipe-fixture-fps-armor", name: "ADP-mk4 Arms Woodland", category: "armor", outputTemplateId: "adp-mk4-arms", outputQuantity: 1 },
  { id: "recipe-fixture-atlas", name: "Atlas", category: "ship_part", outputTemplateId: "atlas", outputQuantity: 1 },
  { id: "recipe-fixture-snowblind", name: "SnowBlind", category: "ship_part", outputTemplateId: "snowblind", outputQuantity: 1 },
  { id: "recipe-fixture-js300", name: "JS-300", category: "ship_part", outputTemplateId: "js300", outputQuantity: 1 },
  { id: "recipe-fixture-m5a-energy", name: "M5A Cannon", category: "weapon", outputTemplateId: "m5a-cannon", outputQuantity: 1 },
];

const fr66Requirements = [
  requirement("bq-fix-fr66:shell", "stileron", 0.15),
  requirement("bq-fix-fr66:field-array", "stileron", 0.24),
  requirement("bq-fix-fr66:frequency", "feynmaline", 20, "unit", 720),
];

const ad5bRequirements = [
  requirement("bq-fix-ad5b:frame", "iron", 3.74, "scu", 640),
  requirement("bq-fix-ad5b:drive", "ouratite", 0.37, "scu", 780),
  requirement("bq-fix-ad5b:barrels", "tungsten", 2.24, "scu", 700),
];

const fpsWeaponRequirements = [
  requirement("bq-fix-fps-weapon:frame", "taranite", 0.06, "scu", 820),
  requirement("bq-fix-fps-weapon:stock", "hephaestanite", 0.02, "scu", 760),
  requirement("bq-fix-fps-weapon:barrel", "iron", 0.03, "scu", 640),
  requirement("bq-fix-fps-weapon:precision", "hadanite", 1, "unit", 880),
];

const fpsArmorRequirements = [
  requirement("bq-fix-fps-armor:carapace", "ouratite", 0.06, "scu", 780),
];

const cq7Requirements = [
  requirement("bq-fix-cq7:frame", "aluminum", 0.06, "scu", 820),
  requirement("bq-fix-cq7:stock", "hephaestanite", 0.02, "scu", 760),
  requirement("bq-fix-cq7:barrel", "iron", 0.01, "scu", 640),
];

const atlasRequirements = [
  requirement("bq-fix-atlas:case", "torite", 0.35, "scu", 760),
  requirement("bq-fix-atlas:injector", "tungsten", 0.14, "scu", 760),
  requirement("bq-fix-atlas:matrix", "bexalite", 0.14, "scu", 760),
];

const snowBlindRequirements = [
  requirement("bq-fix-snowblind:shell", "savrilium", 0.16, "scu", 760),
  requirement("bq-fix-snowblind:coolant", "rawice", 0.16, "scu", 760),
  requirement("bq-fix-snowblind:impeller", "borase", 0.1, "scu", 760),
];

const js300Requirements = [
  requirement("bq-fix-js300:shell", "stileron", 0.35, "scu", 760),
  requirement("bq-fix-js300:regulator", "beryl", 0.14, "scu", 760),
  requirement("bq-fix-js300:stator", "savrilium", 0.24, "scu", 760),
];

const m5aRequirements = [
  requirement("bq-fix-m5a:frame", "agricium", 1.16, "scu", 760),
  requirement("bq-fix-m5a:emitter", "hadanite", 23, "unit", 760),
  requirement("bq-fix-m5a:aperture", "dolivine", 23, "unit", 760),
];

const recipeInputsByRecipeId: Record<string, RecipeInputTemplate[]> = {
  "recipe-fixture-fr66": fr66Requirements,
  "recipe-fixture-ad5b": ad5bRequirements,
  "recipe-fixture-fps-weapon": fpsWeaponRequirements,
  "recipe-fixture-cq7": cq7Requirements,
  "recipe-fixture-fps-armor": fpsArmorRequirements,
  "recipe-fixture-atlas": atlasRequirements,
  "recipe-fixture-snowblind": snowBlindRequirements,
  "recipe-fixture-js300": js300Requirements,
  "recipe-fixture-m5a-energy": m5aRequirements,
};

const buildQueue: BuildQueueItem[] = [
  {
    id: FIXTURE_ITEM_IDS.fr66,
    entryKind: "instance",
    queueId: "bq-fixture-queue-defense",
    recipeId: "recipe-fixture-fr66",
    blueprint_id: FIXTURE_BLUEPRINT_IDS.fr66,
    itemId: "fr66",
    itemName: "FR-66",
    quantity: 1,
    status: "active",
    priority: 1,
    priorityActive: true,
    allowLowerQuality: false,
    finalProductQualityBand: 8,
    finalProductQualityAverage: 8.1,
    finalProductRarity: "legendary",
    materialRequirements: fr66Requirements,
    reservedAllocations: [
      allocation("bq-fix-alloc-fr66-shell", "stileron", "bq-fix-inv-stileron", 0.15, "bq-fix-fr66:shell", 860, rarityCatalog.legendary),
      allocation("bq-fix-alloc-fr66-field", "stileron", "bq-fix-inv-stileron", 0.24, "bq-fix-fr66:field-array", 860, rarityCatalog.legendary),
      allocation("bq-fix-alloc-fr66-freq", "feynmaline", "bq-fix-inv-feynmaline", 20, "bq-fix-fr66:frequency", 720, rarityCatalog.rare, "unit"),
    ],
    blueprintSources: [
      { displayName: "Xenothreat 2 85 01", poolGuid: "ddb463e6-1bf8-47da-8816-e1eab8347beb", poolName: "BlueprintPoolRecord.BP_REWARDS_Xenothreat2_85_01", sourceFolder: "xenothreat2rewards", weight: 1 },
    ],
  },
  {
    id: FIXTURE_ITEM_IDS.fr66High,
    entryKind: "instance",
    queueId: "bq-fixture-queue-defense",
    recipeId: "recipe-fixture-fr66",
    blueprint_id: FIXTURE_BLUEPRINT_IDS.fr66,
    itemId: "fr66",
    itemName: "FR-66",
    quantity: 1,
    status: "active",
    priority: 2,
    allowLowerQuality: false,
    finalProductQualityBand: 9,
    finalProductQualityAverage: 8.8,
    finalProductRarity: "legendary",
    materialRequirements: fr66Requirements.map((input) => ({ ...input, selectedQuality: 860 })),
    reservedAllocations: [
      allocation("bq-fix-alloc-fr66-high-shell", "stileron", "bq-fix-inv-stileron", 0.15, "bq-fix-fr66:shell", 860, rarityCatalog.legendary),
      allocation("bq-fix-alloc-fr66-high-field", "stileron", "bq-fix-inv-stileron", 0.24, "bq-fix-fr66:field-array", 860, rarityCatalog.legendary),
      allocation("bq-fix-alloc-fr66-high-freq", "feynmaline", "bq-fix-inv-feynmaline", 20, "bq-fix-fr66:frequency", 720, rarityCatalog.rare, "unit"),
    ],
  },
  {
    id: FIXTURE_ITEM_IDS.fr66Precision,
    entryKind: "instance",
    queueId: "bq-fixture-queue-defense",
    recipeId: "recipe-fixture-fr66",
    blueprint_id: FIXTURE_BLUEPRINT_IDS.fr66,
    itemId: "fr66",
    itemName: "FR-66",
    quantity: 1,
    status: "active",
    priority: 3,
    allowLowerQuality: true,
    finalProductQualityBand: 7,
    finalProductQualityAverage: 7.4,
    finalProductRarity: "epic",
    materialRequirements: fr66Requirements.map((input) => ({ ...input, selectedQuality: 740 })),
    reservedAllocations: [],
  },
  {
    id: FIXTURE_ITEM_IDS.ad5b,
    entryKind: "instance",
    queueId: "bq-fixture-queue-defense",
    recipeId: "recipe-fixture-ad5b",
    blueprint_id: FIXTURE_BLUEPRINT_IDS.ad5b,
    itemId: "ad5b",
    itemName: "AD5B Ballistic Gatling",
    quantity: 1,
    status: "active",
    priority: 4,
    allowLowerQuality: false,
    finalProductQualityBand: 7,
    finalProductQualityAverage: 7.0,
    finalProductRarity: "epic",
    materialRequirements: ad5bRequirements,
    reservedAllocations: [
      allocation("bq-fix-alloc-ad5b-frame", "iron", "bq-fix-inv-iron", 3.74, "bq-fix-ad5b:frame", 640, rarityCatalog.common),
      allocation("bq-fix-alloc-ad5b-drive", "ouratite", "bq-fix-inv-ouratite", 0.37, "bq-fix-ad5b:drive", 780, rarityCatalog.uncommon),
      allocation("bq-fix-alloc-ad5b-barrels", "tungsten", "bq-fix-inv-tungsten", 2.24, "bq-fix-ad5b:barrels", 700, rarityCatalog.common),
    ],
  },
  {
    id: FIXTURE_ITEM_IDS.fr66Completed,
    entryKind: "instance",
    queueId: "bq-fixture-queue-defense",
    recipeId: "recipe-fixture-fr66",
    blueprint_id: FIXTURE_BLUEPRINT_IDS.fr66,
    itemId: "fr66",
    itemName: "FR-66",
    quantity: 1,
    status: "complete",
    priority: 5,
    allowLowerQuality: false,
    finalProductQualityBand: 8,
    finalProductQualityAverage: 8.1,
    finalProductRarity: "legendary",
    materialRequirements: fr66Requirements.map((input) => ({ ...input, selectedQuality: 820 })),
    reservedAllocations: [
      allocation("bq-fix-alloc-fr66-done-shell", "stileron", "fixture-consumed-stileron", 0.15, "bq-fix-fr66:shell", 860, rarityCatalog.legendary),
      allocation("bq-fix-alloc-fr66-done-field", "stileron", "fixture-consumed-stileron", 0.24, "bq-fix-fr66:field-array", 860, rarityCatalog.legendary),
      allocation("bq-fix-alloc-fr66-done-freq", "feynmaline", "fixture-consumed-feynmaline", 20, "bq-fix-fr66:frequency", 720, rarityCatalog.rare, "unit"),
    ],
    completionSnapshot: {
      completedAt: "2026-07-11T12:00:00.000Z",
      quantity: 1,
      allowLowerQuality: false,
      finalProductQualityBand: 8,
      finalProductQualityAverage: 8.1,
      finalProductRarity: "legendary",
      materialRequirements: fr66Requirements.map((input) => ({ ...input, selectedQuality: 820 })),
      reservedAllocations: [
        allocation("bq-fix-alloc-fr66-done-shell", "stileron", "fixture-consumed-stileron", 0.15, "bq-fix-fr66:shell", 860, rarityCatalog.legendary),
        allocation("bq-fix-alloc-fr66-done-field", "stileron", "fixture-consumed-stileron", 0.24, "bq-fix-fr66:field-array", 860, rarityCatalog.legendary),
        allocation("bq-fix-alloc-fr66-done-freq", "feynmaline", "fixture-consumed-feynmaline", 20, "bq-fix-fr66:frequency", 720, rarityCatalog.rare, "unit"),
      ],
    },
  },
  {
    id: FIXTURE_ITEM_IDS.atlas,
    entryKind: "instance",
    queueId: "bq-fixture-queue-systems",
    recipeId: "recipe-fixture-atlas",
    blueprint_id: FIXTURE_BLUEPRINT_IDS.atlas,
    itemId: "atlas",
    itemName: "Atlas",
    quantity: 1,
    status: "active",
    priority: 1,
    priorityActive: true,
    allowLowerQuality: false,
    finalProductQualityBand: 8,
    finalProductQualityAverage: 7.6,
    finalProductRarity: "epic",
    materialRequirements: atlasRequirements,
    reservedAllocations: [],
  },
  {
    id: FIXTURE_ITEM_IDS.snowBlind,
    entryKind: "instance",
    queueId: "bq-fixture-queue-systems",
    recipeId: "recipe-fixture-snowblind",
    blueprint_id: FIXTURE_BLUEPRINT_IDS.snowBlind,
    itemId: "snowblind",
    itemName: "SnowBlind",
    quantity: 1,
    status: "active",
    priority: 2,
    allowLowerQuality: false,
    finalProductQualityBand: 8,
    finalProductQualityAverage: 7.6,
    finalProductRarity: "epic",
    materialRequirements: snowBlindRequirements,
    reservedAllocations: [],
  },
  {
    id: FIXTURE_ITEM_IDS.js300,
    entryKind: "instance",
    queueId: "bq-fixture-queue-systems",
    recipeId: "recipe-fixture-js300",
    blueprint_id: FIXTURE_BLUEPRINT_IDS.js300,
    itemId: "js300",
    itemName: "JS-300",
    quantity: 1,
    status: "active",
    priority: 3,
    allowLowerQuality: false,
    finalProductQualityBand: 8,
    finalProductQualityAverage: 7.6,
    finalProductRarity: "epic",
    materialRequirements: js300Requirements,
    reservedAllocations: [],
  },
  {
    id: FIXTURE_ITEM_IDS.m5a,
    entryKind: "instance",
    queueId: "bq-fixture-queue-systems",
    recipeId: "recipe-fixture-m5a-energy",
    blueprint_id: FIXTURE_BLUEPRINT_IDS.m5a,
    itemId: "m5a-cannon",
    itemName: "M5A Cannon",
    quantity: 1,
    status: "active",
    priority: 4,
    allowLowerQuality: false,
    finalProductQualityBand: 8,
    finalProductQualityAverage: 7.6,
    finalProductRarity: "epic",
    materialRequirements: m5aRequirements,
    reservedAllocations: [],
  },
  {
    id: FIXTURE_ITEM_IDS.fpsWeapon,
    entryKind: "instance",
    queueId: "bq-fixture-queue-ground",
    recipeId: "recipe-fixture-fps-weapon",
    blueprint_id: FIXTURE_BLUEPRINT_IDS.fpsWeapon,
    itemId: "p6-lr",
    itemName: "P6-LR \"Archangel\" Sniper Rifle",
    quantity: 1,
    status: "active",
    priority: 3,
    allowLowerQuality: false,
    finalProductQualityBand: 8,
    finalProductQualityAverage: 7.75,
    finalProductRarity: "epic",
    materialRequirements: fpsWeaponRequirements,
    reservedAllocations: [
      allocation("bq-fix-alloc-fps-wpn-frame", "taranite", "bq-fix-inv-taranite", 0.06, "bq-fix-fps-weapon:frame", 820, rarityCatalog.epic),
      allocation("bq-fix-alloc-fps-wpn-stock", "hephaestanite", "bq-fix-inv-hephaestanite", 0.02, "bq-fix-fps-weapon:stock", 760, rarityCatalog.uncommon),
      allocation("bq-fix-alloc-fps-wpn-barrel", "iron", "bq-fix-inv-iron", 0.03, "bq-fix-fps-weapon:barrel", 640, rarityCatalog.common),
      allocation("bq-fix-alloc-fps-wpn-precision", "hadanite", "bq-fix-inv-hadanite", 1, "bq-fix-fps-weapon:precision", 880, rarityCatalog.epic, "unit"),
    ],
  },
  {
    id: FIXTURE_ITEM_IDS.fpsArmor,
    entryKind: "instance",
    queueId: "bq-fixture-queue-expedition",
    recipeId: "recipe-fixture-fps-armor",
    blueprint_id: FIXTURE_BLUEPRINT_IDS.fpsArmor,
    itemId: "adp-mk4-arms",
    itemName: "ADP-mk4 Arms Woodland",
    quantity: 1,
    status: "active",
    priority: 4,
    allowLowerQuality: false,
    finalProductQualityBand: 7,
    finalProductQualityAverage: 7.6,
    finalProductRarity: "rare",
    materialRequirements: fpsArmorRequirements,
    reservedAllocations: [
      allocation("bq-fix-alloc-fps-arm-carapace", "ouratite", "bq-fix-inv-ouratite", 0.06, "bq-fix-fps-armor:carapace", 780, rarityCatalog.uncommon),
    ],
  },
  {
    id: FIXTURE_ITEM_IDS.cq7,
    entryKind: "instance",
    queueId: "bq-fixture-queue-ground",
    recipeId: "recipe-fixture-cq7",
    blueprint_id: FIXTURE_BLUEPRINT_IDS.cq7,
    itemId: "cq7",
    itemName: "CQ7 Rifle",
    quantity: 1,
    status: "active",
    priority: 4,
    allowLowerQuality: false,
    finalProductQualityBand: 8,
    finalProductQualityAverage: 7.4,
    finalProductRarity: "rare",
    materialRequirements: cq7Requirements,
    reservedAllocations: [
      allocation("bq-fix-alloc-cq7-stock", "hephaestanite", "bq-fix-inv-hephaestanite", 0.02, "bq-fix-cq7:stock", 760, rarityCatalog.uncommon),
      allocation("bq-fix-alloc-cq7-barrel", "iron", "bq-fix-inv-iron", 0.01, "bq-fix-cq7:barrel", 640, rarityCatalog.common),
    ],
  },
];

export type BuildQueuePageFixture = {
  buildQueues: BuildQueue[];
  buildQueue: BuildQueueItem[];
  activeBuildQueueId: string;
  inventoryEntries: InventoryEntry[];
  materials: MaterialTemplate[];
  locations: InventoryLocation[];
  recipes: RecipeTemplate[];
  recipeInputsByRecipeId: Record<string, RecipeInputTemplate[]>;
  selectedItemId: string;
};

export const buildQueueStatsFixture: BuildQueuePageFixture = {
  buildQueues: [
    { id: "bq-fixture-queue-defense", name: "Pyro Defense Refit", sourceType: "custom" },
    { id: "bq-fixture-queue-ground", name: "Ground Team Loadout", sourceType: "custom" },
    { id: "bq-fixture-queue-systems", name: "Ship Systems", sourceType: "custom" },
    { id: "bq-fixture-queue-expedition", name: "Expedition Spares", sourceType: "fitting", sourceReference: "fixture-fit-600i-expedition" },
  ],
  buildQueue,
  activeBuildQueueId: "bq-fixture-queue-defense",
  inventoryEntries,
  materials: fixtureMaterials,
  locations: inventoryLocations.filter((location) => location.id === fixtureLocationId),
  recipes,
  recipeInputsByRecipeId,
  selectedItemId: FIXTURE_ITEM_IDS.fr66,
};

const mockupQueueId = "bq-fixture-queue-mockup";
const mockupM5aId = "bq-fixture-m5a";
const mockupC788Id = "bq-fixture-c788";
const mockupM5aBlueprintId = "9fe902be-8b39-4d71-9017-e2fed7b0604c";
const mockupC788BlueprintId = "6713db41-8231-4e71-b7a2-74073ddd4b50";

const mockupM5aRequirements = [
  requirement("bq-mockup-m5a:frame", "agricium", 1.16, "scu", 812),
  requirement("bq-mockup-m5a:emitter", "hadanite", 8, "unit", 959),
  requirement("bq-mockup-m5a:aperture", "dolivine", 8, "unit", 957),
];

const mockupC788Requirements = [
  requirement("bq-mockup-c788:frame", "iron", 2.08, "scu", 800),
  requirement("bq-mockup-c788:cycler", "riccite", 0.31, "scu", 800),
  requirement("bq-mockup-c788:barrel", "titanium", 1.04, "scu", 800),
];

const mockupInventory: InventoryEntry[] = [
  { ...entry("bq-mockup-hadanite-762", "hadanite", 15, 762, rarityCatalog.epic, "GEM-H15"), unitType: "unit" },
  { ...entry("bq-mockup-hadanite-867", "hadanite", 5, 867, rarityCatalog.legendary, "GEM-H05"), unitType: "unit" },
  { ...entry("bq-mockup-dolivine-886", "dolivine", 25, 886, rarityCatalog.legendary, "GEM-D25"), unitType: "unit" },
  { ...entry("bq-mockup-dolivine-901", "dolivine", 4, 901, rarityCatalog.legendary, "GEM-D04"), unitType: "unit" },
  { ...entry("bq-mockup-dolivine-957", "dolivine", 3, 957, rarityCatalog.legendary, "GEM-D03"), unitType: "unit" },
];

const mockupActiveItems: BuildQueueItem[] = [
  {
    id: mockupM5aId,
    entryKind: "instance",
    queueId: mockupQueueId,
    recipeId: "recipe-fixture-m5a",
    blueprint_id: mockupM5aBlueprintId,
    itemId: "m5a-cannon",
    itemName: "M5A Cannon",
    quantity: 4,
    status: "active",
    priority: 1,
    priorityActive: true,
    allowLowerQuality: true,
    finalProductQualityBand: 9,
    finalProductQualityAverage: 9.1,
    finalProductRarity: "legendary",
    materialRequirements: mockupM5aRequirements,
    reservedAllocations: [
      allocation("bq-mockup-alloc-h762", "hadanite", "bq-mockup-hadanite-762", 15, "bq-mockup-m5a:emitter", 762, rarityCatalog.epic, "unit"),
      allocation("bq-mockup-alloc-h867", "hadanite", "bq-mockup-hadanite-867", 5, "bq-mockup-m5a:emitter", 867, rarityCatalog.legendary, "unit"),
      allocation("bq-mockup-alloc-d886", "dolivine", "bq-mockup-dolivine-886", 25, "bq-mockup-m5a:aperture", 886, rarityCatalog.legendary, "unit"),
      allocation("bq-mockup-alloc-d901", "dolivine", "bq-mockup-dolivine-901", 4, "bq-mockup-m5a:aperture", 901, rarityCatalog.legendary, "unit"),
      allocation("bq-mockup-alloc-d957", "dolivine", "bq-mockup-dolivine-957", 3, "bq-mockup-m5a:aperture", 957, rarityCatalog.legendary, "unit"),
    ],
    blueprintSources: [
      { displayName: "Low Risk Protection Detail", poolGuid: "mockup-source-low", poolName: "Mockup Low Risk", sourceFolder: "fixture", weight: 1 },
      { displayName: "Executive Protection Detail", poolGuid: "mockup-source-executive", poolName: "Mockup Executive", sourceFolder: "fixture", weight: 1 },
      { displayName: "Experienced Protection Detail Needed", poolGuid: "mockup-source-experienced", poolName: "Mockup Experienced", sourceFolder: "fixture", weight: 1 },
    ],
  },
  {
    id: mockupC788Id,
    entryKind: "instance",
    queueId: mockupQueueId,
    recipeId: "recipe-fixture-c788",
    blueprint_id: mockupC788BlueprintId,
    itemId: "c788-cannon",
    itemName: "C-788 Cannon",
    quantity: 1,
    status: "active",
    priority: 2,
    allowLowerQuality: false,
    finalProductQualityBand: 8,
    finalProductQualityAverage: 8.8,
    finalProductRarity: "legendary",
    materialRequirements: mockupC788Requirements,
    reservedAllocations: [],
  },
];

const mockupCompletedItems: BuildQueueItem[] = Array.from({ length: 10 }, (_, index) => ({
  ...mockupActiveItems[1],
  id: `bq-fixture-completed-${index + 1}`,
  status: "complete" as const,
  priority: index + 1,
  completionSnapshot: {
    completedAt: now,
    quantity: 1,
    reservedAllocations: [],
  },
}));

export const buildQueueMockupFixture: BuildQueuePageFixture = {
  buildQueues: [{ id: mockupQueueId, name: "Primary", sourceType: "custom" }],
  buildQueue: [...mockupActiveItems, ...mockupCompletedItems],
  activeBuildQueueId: mockupQueueId,
  inventoryEntries: mockupInventory,
  materials: fixtureMaterials,
  locations: inventoryLocations.filter((location) => location.id === fixtureLocationId),
  recipes: [
    { id: "recipe-fixture-m5a", name: "M5A Cannon", category: "weapon", outputTemplateId: "m5a-cannon", outputQuantity: 1 },
    { id: "recipe-fixture-c788", name: "C-788 Cannon", category: "weapon", outputTemplateId: "c788-cannon", outputQuantity: 1 },
  ],
  recipeInputsByRecipeId: {
    "recipe-fixture-m5a": mockupM5aRequirements,
    "recipe-fixture-c788": mockupC788Requirements,
  },
  selectedItemId: mockupM5aId,
};
