import type {
  BuildQueueItem,
  InventoryEntry,
  InventoryLocation,
  ItemTemplate,
  MaterialTemplate,
  RarityInfo,
  RarityTier,
  RecipeTemplate,
} from "../../types/logistics.js";
import type { QualityModifier } from "../../components/industry/crafting/utils/craftingTypes.js";
import type { QualityBand } from "../../components/industry/crafting/utils/qualityBands.js";

export interface RecipeInputTemplate {
  /** Stable line-level id for editing duplicate material contributors independently. */
  requirementId?: string;
  /** Stable canonical material key used for queue/inventory/mining matching. */
  materialKey?: string;
  materialId: string;
  costId?: string;
  materialGuid?: string;
  materialName?: string;
  displayName?: string;
  rawName?: string;
  sourceName?: string;
  sourceType?: string;
  quantity: number;
  unitType?: "unit" | "SCU" | "scu" | "cscu";
  selectedQuality?: number;
  mappedQuality?: number;
  qualityBand?: number;
  modifierName?: string;
  modifierType?: string;
  modifierValue?: number;
  qualityModifiers?: QualityModifier[];
  qualityBands?: QualityBand[];
}

export type MaterialSourceGroup = "ores" | "vehicleMining" | "fpsMining";

export type LogisticsMaterialTemplate = MaterialTemplate & {
  /** Display/source grouping used by inventory/material browser. */
  sourceGroups: MaterialSourceGroup[];
  /** True only for ship/ore refinery materials accepted from Processing/Complete refinery screenshots. */
  acceptedInRefineryImport: boolean;
  /** True only for materials that can come through refinery jobs. Vehicle/FPS mineables are false. */
  canComeFromRefinery: boolean;
  /** True when the mined resource is refined through refinery gameplay. Vehicle/FPS mineables are false. */
  isRefinable: boolean;
};

export const rarityCatalog = {
  legendary: {
    tier: "legendary",
    label: "Legendary",
    colorRgb: [255, 215, 0],
    colorHex: "#FFD700",
    colorToken: "var(--rarity-legendary)",
  },
  epic: {
    tier: "epic",
    label: "Epic",
    colorRgb: [157, 0, 255],
    colorHex: "#9D00FF",
    colorToken: "var(--rarity-epic)",
  },
  rare: {
    tier: "rare",
    label: "Rare",
    colorRgb: [45, 104, 196],
    colorHex: "#2D68C4",
    colorToken: "var(--rarity-rare)",
  },
  uncommon: {
    tier: "uncommon",
    label: "Uncommon",
    colorRgb: [76, 187, 23],
    colorHex: "#4CBB17",
    colorToken: "var(--rarity-uncommon)",
  },
  common: {
    tier: "common",
    label: "Common",
    colorRgb: [109, 129, 150],
    colorHex: "#6D8196",
    colorToken: "var(--rarity-common)",
  },
  quantanium: {
    tier: "quantanium",
    label: "Quantanium",
    colorRgb: [184, 115, 51],
    colorHex: "#B87333",
    colorToken: "var(--rarity-quantanium)",
  },
} satisfies Record<RarityTier, RarityInfo>;

function refineryMaterial(id: string, name: string, extra?: Partial<LogisticsMaterialTemplate>): LogisticsMaterialTemplate {
  return {
    id,
    name,
    materialType: "ore",
    sourceGroups: ["ores"],
    acceptedInRefineryImport: true,
    canComeFromRefinery: true,
    isRefinable: true,
    ...extra,
  };
}

function vehicleMineable(id: string, name: string, extra?: Partial<LogisticsMaterialTemplate>): LogisticsMaterialTemplate {
  return {
    id,
    name,
    materialType: "raw",
    sourceGroups: ["vehicleMining"],
    acceptedInRefineryImport: false,
    canComeFromRefinery: false,
    isRefinable: false,
    ...extra,
  };
}

function fpsMineable(id: string, name: string, extra?: Partial<LogisticsMaterialTemplate>): LogisticsMaterialTemplate {
  return {
    id,
    name,
    materialType: "special",
    sourceGroups: ["fpsMining"],
    acceptedInRefineryImport: false,
    canComeFromRefinery: false,
    isRefinable: false,
    ...extra,
  };
}

/**
 * Canonical material ids for inventory and crafting.
 *
 * Important rules:
 * - Only `sourceGroups: ["ores"]` materials can be imported from refinery screenshots.
 * - Vehicle mining and FPS mining materials cannot be refined and must never appear in the refinery parser dropdown.
 * - Quality can still exist for any material. Refinery eligibility and quality quantization are separate concepts.
 * - Carinite is stored once and displayed in both Vehicle Mining and FPS Mining source groups.
 */
export const materialTemplates: LogisticsMaterialTemplate[] = [
  // ORES / refinery job outputs accepted from Processing and Complete screenshots.
  refineryMaterial("agricium", "Agricium"),
  refineryMaterial("aluminum", "Aluminium"),
  refineryMaterial("aslarite", "Aslarite"),
  refineryMaterial("beryl", "Beryl"),
  refineryMaterial("bexalite", "Bexalite"),
  refineryMaterial("borase", "Borase"),
  refineryMaterial("copper", "Copper"),
  refineryMaterial("corundum", "Corundum"),
  refineryMaterial("gold", "Gold"),
  refineryMaterial("hephaestanite", "Hephaestanite"),
  refineryMaterial("rawice", "Ice"),
  refineryMaterial("iron", "Iron"),
  refineryMaterial("laranite", "Laranite"),
  refineryMaterial("lindinium", "Lindinium"),
  refineryMaterial("ouratite", "Ouratite"),
  refineryMaterial("quantanium", "Quantanium", { isQuantanium: true }),
  refineryMaterial("quartz", "Quartz"),
  refineryMaterial("riccite", "Riccite"),
  refineryMaterial("savrilium", "Savrilium"),
  refineryMaterial("silicon", "Silicon"),
  refineryMaterial("stileron", "Stileron"),
  refineryMaterial("taranite", "Taranite"),
  refineryMaterial("tin", "Tin"),
  refineryMaterial("titanium", "Titanium"),
  refineryMaterial("torite", "Torite"),
  refineryMaterial("tungsten", "Tungsten"),

  // VEHICLE MINING / ROC-type mineables. These cannot be refined.
  vehicleMineable("beradom", "Beradom"),
  vehicleMineable("carinite", "Carinite", { sourceGroups: ["vehicleMining", "fpsMining"] }),
  vehicleMineable("feynmaline", "Feynmaline"),
  vehicleMineable("glacosite", "Glacosite"),

  // FPS MINING / hand mineables. These cannot be refined.
  fpsMineable("aphorite", "Aphorite"),
  fpsMineable("carinite-pure", "Carinite Pure"),
  fpsMineable("dolivine", "Dolivine"),
  fpsMineable("hadanite", "Hadanite"),
  fpsMineable("jaclium", "Jaclium"),
  fpsMineable("janalite", "Janalite"),
  fpsMineable("sadaryx", "Sadaryx"),
  fpsMineable("saldynium", "Saldynium"),
];

export const materialSourceGroups: Record<MaterialSourceGroup, string[]> = {
  ores: [
    "agricium",
    "aluminum",
    "aslarite",
    "beryl",
    "bexalite",
    "borase",
    "copper",
    "corundum",
    "gold",
    "hephaestanite",
    "rawice",
    "iron",
    "laranite",
    "lindinium",
    "ouratite",
    "quantanium",
    "quartz",
    "riccite",
    "savrilium",
    "silicon",
    "stileron",
    "taranite",
    "tin",
    "titanium",
    "torite",
    "tungsten",
  ],
  vehicleMining: ["beradom", "carinite", "feynmaline", "glacosite"],
  fpsMining: [
    "aphorite",
    "carinite",
    "carinite-pure",
    "dolivine",
    "hadanite",
    "jaclium",
    "janalite",
    "sadaryx",
    "saldynium",
  ],
};

export const refineryImportMaterialIds = materialTemplates
  .filter((material) => material.acceptedInRefineryImport)
  .map((material) => material.id);

export const nonRefinableMaterialIds = materialTemplates
  .filter((material) => !material.isRefinable)
  .map((material) => material.id);

export function isRefineryImportMaterial(materialId: string): boolean {
  return refineryImportMaterialIds.includes(materialId);
}

export function isNonRefinableMaterial(materialId: string): boolean {
  return nonRefinableMaterialIds.includes(materialId);
}

export const inventoryLocations: InventoryLocation[] = [
  // Stanton refinery locations
  { id: "arc-l1", name: "ARC-L1", category: "refinery", system: "Stanton", type: "station" },
  { id: "arc-l2", name: "ARC-L2", category: "refinery", system: "Stanton", type: "station" },
  { id: "arc-l4", name: "ARC-L4", category: "refinery", system: "Stanton", type: "station" },
  { id: "cru-l1", name: "CRU-L1", category: "refinery", system: "Stanton", type: "station" },
  { id: "hur-l1", name: "HUR-L1", category: "refinery", system: "Stanton", type: "station" },
  { id: "hur-l2", name: "HUR-L2", category: "refinery", system: "Stanton", type: "station" },
  { id: "mic-l1", name: "MIC-L1", category: "refinery", system: "Stanton", type: "station" },
  { id: "mic-l2", name: "MIC-L2", category: "refinery", system: "Stanton", type: "station" },
  { id: "mic-l5", name: "MIC-L5", category: "refinery", system: "Stanton", type: "station" },
  { id: "nyx-gateway-stanton", name: "Nyx Gateway (Stanton)", category: "station", system: "Stanton", type: "station" },
  { id: "pyro-gateway-stanton", name: "Pyro Gateway (Stanton)", category: "station", system: "Stanton", type: "station" },
  { id: "terra-gateway-stanton", name: "Terra Gateway (Stanton)", category: "station", system: "Stanton", type: "station" },

  // Pyro refinery locations
  { id: "checkmate", name: "Checkmate", category: "refinery", system: "Pyro", type: "station" },
  { id: "orbituary", name: "Orbituary", category: "refinery", system: "Pyro", type: "station" },
  { id: "ruin-station", name: "Ruin Station", category: "refinery", system: "Pyro", type: "station" },
  { id: "nyx-gateway-pyro", name: "Nyx Gateway (Pyro)", category: "station", system: "Pyro", type: "station" },
  { id: "stanton-gateway-pyro", name: "Stanton Gateway (Pyro)", category: "station", system: "Pyro", type: "station" },

  // Nyx refinery locations
  { id: "levski", name: "Levski", category: "city", system: "Nyx", type: "city" },
  { id: "pyro-gateway-nyx", name: "Pyro Gateway (Nyx)", category: "station", system: "Nyx", type: "station" },
  { id: "stanton-gateway-nyx", name: "Stanton Gateway (Nyx)", category: "station", system: "Nyx", type: "station" },

  // Major non-refinery inventory hubs
  { id: "area18", name: "Area18", category: "city", system: "Stanton", type: "city" },
  { id: "orison", name: "Orison", category: "city", system: "Stanton", type: "city" },
  { id: "lorville", name: "Lorville", category: "city", system: "Stanton", type: "city" },
  { id: "new-babbage", name: "New Babbage", category: "city", system: "Stanton", type: "city" },
  { id: "everus-harbor", name: "Everus Harbor", category: "station", system: "Stanton", type: "station" },
  { id: "baijini-point", name: "Baijini Point", category: "station", system: "Stanton", type: "station" },
  { id: "port-tressler", name: "Port Tressler", category: "station", system: "Stanton", type: "station" },
  { id: "seraphim-station", name: "Seraphim Station", category: "station", system: "Stanton", type: "station" },
];

export const recipeTemplates: RecipeTemplate[] = [
  { id: "recipe-1", name: "Avalanche Cooler", category: "ship_part", outputTemplateId: "avalanche-cooler", outputQuantity: 1 },
  { id: "recipe-2", name: "TS-2 Quantum Drive", category: "ship_part", outputTemplateId: "ts-2-quantum-drive", outputQuantity: 1 },
  { id: "recipe-3", name: "VK-00 Quantum Drive", category: "ship_part", outputTemplateId: "vk-00-quantum-drive", outputQuantity: 1 },
  { id: "recipe-4", name: "Arbor Mining Laser", category: "weapon", outputTemplateId: "arbor-mining-laser", outputQuantity: 1 },
  { id: "recipe-5", name: "SnowBlind Cooler", category: "ship_part", outputTemplateId: "snowblind-cooler", outputQuantity: 1 },
  { id: "recipe-6", name: "Demeco LMG", category: "weapon", outputTemplateId: "demeco-lmg", outputQuantity: 1 },
];

export const recipeInputTemplates: Record<string, RecipeInputTemplate[]> = {
  "recipe-1": [
    { materialId: "stileron", quantity: 4 },
    { materialId: "tungsten", quantity: 1.5 },
  ],
  "recipe-2": [
    { materialId: "borase", quantity: 3 },
    { materialId: "feynmaline", quantity: 100 },
    { materialId: "savrilium", quantity: 1 },
  ],
  "recipe-3": [
    { materialId: "borase", quantity: 2 },
    { materialId: "stileron", quantity: 1.5 },
  ],
  "recipe-4": [
    { materialId: "laranite", quantity: 2 },
    { materialId: "copper", quantity: 0.8 },
  ],
  "recipe-5": [
    { materialId: "rawice", quantity: 1.25 },
    { materialId: "silicon", quantity: 0.75 },
  ],
  "recipe-6": [
    { materialId: "titanium", quantity: 2 },
    { materialId: "tungsten", quantity: 0.75 },
    { materialId: "copper", quantity: 0.5 },
  ],
};

export const itemTemplates: ItemTemplate[] = [
  { id: "avalanche-cooler", name: "Avalanche Cooler", category: "ship_part", recipeId: "recipe-1" },
  { id: "ts-2-quantum-drive", name: "TS-2 Quantum Drive", category: "ship_part", size: 2, grade: "A", class: "military", recipeId: "recipe-2" },
  { id: "vk-00-quantum-drive", name: "VK-00 Quantum Drive", category: "ship_part", size: 1, grade: "A", class: "competition", recipeId: "recipe-3" },
  { id: "arbor-mining-laser", name: "Arbor Mining Laser", category: "weapon", recipeId: "recipe-4" },
  { id: "snowblind-cooler", name: "SnowBlind Cooler", category: "ship_part", recipeId: "recipe-5" },
  { id: "demeco-lmg", name: "Demeco LMG", category: "weapon", recipeId: "recipe-6" },
];

const now = "2026-04-22T08:25:00Z";

function materialTypeFor(materialId: string): MaterialTemplate["materialType"] {
  return materialTemplates.find((material) => material.id === materialId)?.materialType ?? "special";
}

export const initialInventoryEntries: InventoryEntry[] = [
  // Refinery/import examples.
  { id: "inv-1", materialId: "stileron", materialType: materialTypeFor("stileron"), quantity: 3.5, quality: 947, locationId: "orbituary", rarity: rarityCatalog.legendary, createdAt: now, updatedAt: "2026-04-18T10:22:00Z" },
  { id: "inv-2", materialId: "iron", materialType: materialTypeFor("iron"), quantity: 87, quality: 325, locationId: "orbituary", rarity: rarityCatalog.common, createdAt: now, updatedAt: "2026-04-17T14:05:00Z" },
  { id: "inv-3", materialId: "iron", materialType: materialTypeFor("iron"), quantity: 10, quality: 710, locationId: "orbituary", rarity: rarityCatalog.uncommon, createdAt: now, updatedAt: "2026-04-15T08:00:00Z" },
  { id: "inv-4", materialId: "hephaestanite", materialType: materialTypeFor("hephaestanite"), quantity: 129, quality: 330, locationId: "orbituary", container: "520", rarity: rarityCatalog.common, createdAt: now, updatedAt: "2026-04-19T09:15:00Z" },
  { id: "inv-5", materialId: "quartz", materialType: materialTypeFor("quartz"), quantity: 7, quality: 522, locationId: "orbituary", rarity: rarityCatalog.common, createdAt: now, updatedAt: "2026-04-16T11:30:00Z" },
  { id: "inv-6", materialId: "silicon", materialType: materialTypeFor("silicon"), quantity: 11, quality: 510, locationId: "orbituary", rarity: rarityCatalog.common, createdAt: now, updatedAt: "2026-04-20T07:00:00Z" },

  // Non-refinable inventory examples. These should never come from the refinery screenshot parser.
  { id: "inv-7", materialId: "feynmaline", materialType: materialTypeFor("feynmaline"), quantity: 30, quality: 561, locationId: "area18", container: "920", rarity: rarityCatalog.rare, createdAt: now, updatedAt: "2026-04-14T16:45:00Z" },
  { id: "inv-8", materialId: "beradom", materialType: materialTypeFor("beradom"), quantity: 12, quality: 578, locationId: "everus-harbor", rarity: rarityCatalog.uncommon, createdAt: now, updatedAt: "2026-04-21T12:00:00Z" },
  { id: "inv-9", materialId: "carinite", materialType: materialTypeFor("carinite"), quantity: 8, quality: 716, locationId: "seraphim-station", rarity: rarityCatalog.common, createdAt: now, updatedAt: "2026-04-13T09:30:00Z" },
  { id: "inv-10", materialId: "hadanite", materialType: materialTypeFor("hadanite"), quantity: 18, quality: 867, locationId: "area18", rarity: rarityCatalog.epic, createdAt: now, updatedAt: "2026-04-22T08:20:00Z" },
  { id: "inv-11", materialId: "aphorite", materialType: materialTypeFor("aphorite"), quantity: 22, quality: 686, locationId: "area18", rarity: rarityCatalog.uncommon, createdAt: now, updatedAt: "2026-04-22T08:25:00Z" },
  { id: "inv-12", materialId: "carinite-pure", materialType: materialTypeFor("carinite-pure"), quantity: 3, quality: 880, locationId: "everus-harbor", container: "1000", rarity: rarityCatalog.rare, createdAt: now, updatedAt: "2026-04-20T15:00:00Z" },
];

export const initialBuildQueue: BuildQueueItem[] = [
  { id: "bq-1", recipeId: "recipe-1", quantity: 1, status: "active", priority: 1 },
  { id: "bq-2", recipeId: "recipe-2", quantity: 1, status: "active", priority: 2 },
  { id: "bq-3", recipeId: "recipe-3", quantity: 1, status: "paused", priority: 3 },
  { id: "bq-4", recipeId: "recipe-5", quantity: 1, status: "queued", priority: 4 },
  { id: "bq-5", recipeId: "recipe-4", quantity: 1, status: "queued", priority: 5 },
  { id: "bq-6", recipeId: "recipe-6", quantity: 1, status: "queued", priority: 6 },
];
