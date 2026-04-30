export type RarityTier =
  | "legendary"
  | "epic"
  | "rare"
  | "uncommon"
  | "common"
  | "quantanium";

export interface RarityInfo {
  tier: RarityTier;
  label: string;
  colorRgb: [number, number, number];
  colorHex: string;
  colorToken: string;
}

export interface MaterialTemplate {
  id: string;
  name: string;
  materialType: "ore" | "refined" | "raw" | "special";
  isQuantanium?: boolean;
}

export interface ItemTemplate {
  id: string;
  name: string;
  category: string;
  size?: number | string;
  grade?: "A" | "B" | "C" | "D";
  class?: "civilian" | "military" | "industrial" | "stealth" | "competition";
  manufacturer?: string;
  recipeId?: string;
}

export interface RecipeTemplate {
  id: string;
  name: string;
  category?: string;
  outputTemplateId?: string;
  outputQuantity?: number;
}

export interface InventoryLocation {
  id: string;
  name: string;
  category?: string;
  system?: string;
  type?: "station" | "city" | "outpost" | "ship";
}

export interface InventoryEntry {
  id: string;
  materialId: string;
  materialName?: string;
  materialType: MaterialTemplate["materialType"];
  quality?: number;
  quantity: number;
  locationId?: string;
  container?: string;
  rarity: RarityInfo;
  createdAt: string;
  updatedAt: string;
}

export interface CraftedMaterialInputSnapshot {
  inventoryEntryId?: string;
  materialId: string;
  materialName?: string;
  quality?: number;
  quantityConsumed: number;
  rarity: RarityInfo;
}

export interface OwnedItem {
  id: string;
  templateId: string;
  displayName?: string;
  quantity: number;
  locationId?: string;
  container?: string;
  averageInputQuality?: number;
  rarity: RarityInfo;
  source: "crafted" | "looted" | "purchased" | "manual";
  materialInputsSnapshot?: CraftedMaterialInputSnapshot[];
  createdAt: string;
  updatedAt: string;
}

export interface ReservedMaterialAllocation {
  id: string;
  materialId: string;
  inventoryEntryId: string;
  quantityReserved: number;
  materialName?: string;
  quality?: number;
  rarity: RarityInfo;
  locationId?: string;
  container?: string;
}

export interface BuildQueueItem {
  id: string;
  recipeId: string;
  quantity: number;
  priority?: number;
  status?: "queued" | "active" | "paused" | "complete";
  reservedAllocations?: ReservedMaterialAllocation[];
}
