import type {
  BuildQueueItem,
  InventoryEntry,
  InventoryLocation,
  ItemTemplate,
  MaterialTemplate,
  RarityInfo,
  RarityTier,
  RecipeTemplate,
} from "../../types/logistics";

export interface RecipeInputTemplate {
  materialId: string;
  quantity: number;
}

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

export const materialTemplates: MaterialTemplate[] = [
  { id: "stileron", name: "Stileron", materialType: "refined" },
  { id: "borase", name: "Borase", materialType: "raw" },
  { id: "feynmaline", name: "Feynmaline", materialType: "special" },
  { id: "tungsten", name: "Tungsten", materialType: "ore" },
  { id: "savrilium", name: "Savrilium", materialType: "refined" },
  { id: "quantanium", name: "Quantanium", materialType: "special", isQuantanium: true },
  { id: "laranite", name: "Laranite", materialType: "ore" },
  { id: "copper-ore", name: "Copper Ore", materialType: "ore" },
  { id: "titanium", name: "Titanium", materialType: "ore" },
  // Refined outputs that appear in refinery completed orders
  { id: "gold", name: "Gold", materialType: "refined" },
  { id: "agricium", name: "Agricium", materialType: "refined" },
  { id: "aslarite", name: "Aslarite", materialType: "refined" },
  { id: "bexalite", name: "Bexalite", materialType: "refined" },
  { id: "corundum", name: "Corundum", materialType: "refined" },
  { id: "hephaestanite", name: "Hephaestanite", materialType: "refined" },
  { id: "iron", name: "Iron", materialType: "refined" },
  { id: "torite", name: "Torite", materialType: "refined" },
  { id: "pressurized-ice", name: "Pressurized Ice", materialType: "refined" },
  // Ore/raw inputs that appear in MATERIALS SELECTED pre-refine screenshots
  { id: "stileron-ore", name: "Stileron (Ore)", materialType: "ore" },
  { id: "quartz", name: "Quartz", materialType: "raw" },
  { id: "taranite", name: "Taranite", materialType: "ore" },
  { id: "riccite", name: "Riccite", materialType: "ore" },
];

export const inventoryLocations: InventoryLocation[] = [
  { id: "everus-harbor", name: "Everus Harbor", category: "station", system: "Stanton", type: "station" },
  { id: "orison", name: "Orison", category: "city", system: "Stanton", type: "city" },
  { id: "area18", name: "Area18", category: "city", system: "Stanton", type: "city" },
  { id: "seraphim-station", name: "Seraphim Station", category: "station", system: "Pyro", type: "station" },
];

export const recipeTemplates: RecipeTemplate[] = [
  { id: "recipe-1", name: "Avalanche Cooler", category: "ship_part", outputTemplateId: "avalanche-cooler", outputQuantity: 1 },
  { id: "recipe-2", name: "TS-2 Quantum Drive", category: "ship_part", outputTemplateId: "ts-2-quantum-drive", outputQuantity: 1 },
  { id: "recipe-3", name: "VK-00 Quantum Drive", category: "ship_part", outputTemplateId: "vk-00-quantum-drive", outputQuantity: 1 },
  { id: "recipe-4", name: "Arbor Mining Laser", category: "weapon", outputTemplateId: "arbor-mining-laser", outputQuantity: 1 },
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
    { materialId: "copper-ore", quantity: 0.8 },
  ],
};

export const itemTemplates: ItemTemplate[] = [
  { id: "avalanche-cooler", name: "Avalanche Cooler", category: "ship_part", recipeId: "recipe-1" },
  { id: "ts-2-quantum-drive", name: "TS-2 Quantum Drive", category: "ship_part", size: 2, grade: "A", class: "military", recipeId: "recipe-2" },
  { id: "vk-00-quantum-drive", name: "VK-00 Quantum Drive", category: "ship_part", size: 1, grade: "A", class: "competition", recipeId: "recipe-3" },
  { id: "snowblind-cooler", name: "SnowBlind Cooler", category: "ship_part" },
  { id: "arbor-mining-laser", name: "Arbor Mining Laser", category: "weapon", recipeId: "recipe-4" },
  { id: "demeco-lmg", name: "Demeco LMG", category: "weapon" },
];

const now = "2026-04-22T08:25:00Z";

function materialTypeFor(materialId: string): MaterialTemplate["materialType"] {
  return materialTemplates.find((material) => material.id === materialId)?.materialType ?? "special";
}

export const initialInventoryEntries: InventoryEntry[] = [
  { id: "inv-1", materialId: "stileron", materialType: materialTypeFor("stileron"), quantity: 3.5, quality: 900, locationId: "everus-harbor", rarity: rarityCatalog.legendary, createdAt: now, updatedAt: "2026-04-18T10:22:00Z" },
  { id: "inv-2", materialId: "stileron", materialType: materialTypeFor("stileron"), quantity: 1.2, quality: 300, locationId: "orison", rarity: rarityCatalog.common, createdAt: now, updatedAt: "2026-04-17T14:05:00Z" },
  { id: "inv-3", materialId: "stileron", materialType: materialTypeFor("stileron"), quantity: 0.8, quality: 860, locationId: "seraphim-station", rarity: rarityCatalog.epic, createdAt: now, updatedAt: "2026-04-15T08:00:00Z" },
  { id: "inv-4", materialId: "borase", materialType: materialTypeFor("borase"), quantity: 2, quality: 500, locationId: "everus-harbor", container: "520", rarity: rarityCatalog.common, createdAt: now, updatedAt: "2026-04-19T09:15:00Z" },
  { id: "inv-5", materialId: "borase", materialType: materialTypeFor("borase"), quantity: 0.5, quality: 740, locationId: "orison", rarity: rarityCatalog.uncommon, createdAt: now, updatedAt: "2026-04-16T11:30:00Z" },
  { id: "inv-6", materialId: "feynmaline", materialType: materialTypeFor("feynmaline"), quantity: 85, quality: 240, locationId: "area18", rarity: rarityCatalog.common, createdAt: now, updatedAt: "2026-04-20T07:00:00Z" },
  { id: "inv-7", materialId: "feynmaline", materialType: materialTypeFor("feynmaline"), quantity: 30, quality: 100, locationId: "seraphim-station", container: "920", rarity: rarityCatalog.common, createdAt: now, updatedAt: "2026-04-14T16:45:00Z" },
  { id: "inv-8", materialId: "tungsten", materialType: materialTypeFor("tungsten"), quantity: 1.5, quality: 0, locationId: "everus-harbor", rarity: rarityCatalog.common, createdAt: now, updatedAt: "2026-04-21T12:00:00Z" },
  { id: "inv-9", materialId: "savrilium", materialType: materialTypeFor("savrilium"), quantity: 0.86, quality: 0, locationId: "seraphim-station", rarity: rarityCatalog.common, createdAt: now, updatedAt: "2026-04-13T09:30:00Z" },
  { id: "inv-10", materialId: "laranite", materialType: materialTypeFor("laranite"), quantity: 0.8, quality: 0, locationId: "area18", rarity: rarityCatalog.common, createdAt: now, updatedAt: "2026-04-22T08:20:00Z" },
  { id: "inv-11", materialId: "copper-ore", materialType: materialTypeFor("copper-ore"), quantity: 0.5, quality: 0, locationId: "area18", rarity: rarityCatalog.common, createdAt: now, updatedAt: "2026-04-22T08:25:00Z" },
  { id: "inv-12", materialId: "titanium", materialType: materialTypeFor("titanium"), quantity: 3, quality: 0, locationId: "everus-harbor", container: "1000", rarity: rarityCatalog.common, createdAt: now, updatedAt: "2026-04-20T15:00:00Z" },
];

export const initialBuildQueue: BuildQueueItem[] = [
  { id: "bq-1", recipeId: "recipe-1", quantity: 1, status: "active", priority: 1 },
  { id: "bq-2", recipeId: "recipe-2", quantity: 1, status: "active", priority: 2 },
  { id: "bq-3", recipeId: "recipe-3", quantity: 1, status: "paused", priority: 3 },
  { id: "bq-4", recipeId: "snowblind-cooler", quantity: 1, status: "queued", priority: 4 },
  { id: "bq-5", recipeId: "recipe-4", quantity: 1, status: "queued", priority: 5 },
  { id: "bq-6", recipeId: "demeco-lmg", quantity: 1, status: "queued", priority: 6 },
];
