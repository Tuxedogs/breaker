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
  fpsArmor: "005d95db-96ca-45b7-9647-7e7537b8fac8",
} as const;

export const FIXTURE_ITEM_IDS = {
  fr66: "bq-fixture-fr66",
  fr66High: "bq-fixture-fr66-high",
  fr66Precision: "bq-fixture-fr66-precision",
  fr66Completed: "bq-fixture-fr66-completed",
  ad5b: "bq-fixture-ad5b",
  fpsWeapon: "bq-fixture-fps-weapon",
  fpsArmor: "bq-fixture-fps-armor",
} as const;

const fixtureExtraMaterials: MaterialTemplate[] = [
  { id: "insulativelinermaterial", name: "Insulative Liner Material", materialType: "refined" },
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
  entry("bq-fix-inv-liner", "insulativelinermaterial", 1, 740, rarityCatalog.rare, "ARM-01"),
];

const recipes: RecipeTemplate[] = [
  { id: "recipe-fixture-fr66", name: "FR-66", category: "ship_part", outputTemplateId: "fr66", outputQuantity: 1 },
  { id: "recipe-fixture-ad5b", name: "AD5B Ballistic Gatling", category: "weapon", outputTemplateId: "ad5b", outputQuantity: 1 },
  { id: "recipe-fixture-fps-weapon", name: "P6-LR \"Archangel\" Sniper Rifle", category: "weapon", outputTemplateId: "p6-lr", outputQuantity: 1 },
  { id: "recipe-fixture-fps-armor", name: "ADP-mk4 Arms Woodland", category: "armor", outputTemplateId: "adp-mk4-arms", outputQuantity: 1 },
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
  requirement("bq-fix-fps-armor:liner", "insulativelinermaterial", 0.02, "scu", 740),
];

const recipeInputsByRecipeId: Record<string, RecipeInputTemplate[]> = {
  "recipe-fixture-fr66": fr66Requirements,
  "recipe-fixture-ad5b": ad5bRequirements,
  "recipe-fixture-fps-weapon": fpsWeaponRequirements,
  "recipe-fixture-fps-armor": fpsArmorRequirements,
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
      allocation("bq-fix-alloc-fps-arm-liner", "insulativelinermaterial", "bq-fix-inv-liner", 0.02, "bq-fix-fps-armor:liner", 740, rarityCatalog.rare),
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
