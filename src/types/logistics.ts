import type { RecipeInputTemplate } from "../data/logistics/seed";

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

export type InventoryItemKind =
  | "material"
  | "ore"
  | "refined"
  | "raw_mineable"
  | "ice"
  | "fps_weapon"
  | "fps_armor"
  | "vehicle_component"
  | "crafted_item"
  | "manual"
  | "unknown";

export type InventoryUnitType = "scu" | "unit";

export type InventoryCatalogSource = "api" | "seed" | "manual" | "unknown";

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
  /** Legacy material identifier used by refinery and build queue flows. */
  materialId?: string;
  materialName?: string;
  materialType?: MaterialTemplate["materialType"];
  catalogItemId?: string;
  catalogSource?: InventoryCatalogSource;
  itemName?: string;
  itemKind?: InventoryItemKind;
  category?: string;
  unitType?: InventoryUnitType;
  quality?: number;
  qualityBand?: number;
  quantity: number;
  locationId?: string;
  container?: string;
  notes?: string;
  source?: string;
  sourceHistory?: string[];
  workOrderId?: string;
  workOrderIds?: string[];
  accentTier?: RarityTier;
  valueAUEC?: number;
  valueUnit?: "per_scu" | "per_unit";
  valueSource?: "manual" | "api" | "estimated" | "unknown";
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
  requirementId?: string;
  selectedQuality?: number;
  allowLowerQualityOverride?: boolean;
  unitType?: RecipeInputTemplate["unitType"];
  materialName?: string;
  quality?: number;
  qualityBand?: number;
  rarity: RarityInfo;
  locationId?: string;
  container?: string;
}

export interface BlueprintSourceSnapshot {
  poolName?: string;
  poolGuid?: string;
  sourceFolder?: string;
  displayName: string;
  weight?: number;
}

export interface BuildQueueFinalProductQualitySnapshot {
  averageBand?: number;
  average?: number;
  quality?: number;
  band?: number;
}

export interface BuildQueueItem {
  id: string;
  recipeId: string;
  blueprint_id?: string;
  itemId?: string;
  itemName?: string;
  finalProductQuality?: BuildQueueFinalProductQualitySnapshot;
  finalProductQualityBand?: number;
  finalProductQualityAverage?: number;
  finalProductRarity?: string;
  quantity: number;
  allowLowerQuality?: boolean;
  priority?: number;
  priorityActive?: boolean;
  status?: "queued" | "active" | "paused" | "complete";
  reservedAllocations?: ReservedMaterialAllocation[];
  materialRequirements?: RecipeInputTemplate[];
  blueprintSources?: BlueprintSourceSnapshot[];
}
