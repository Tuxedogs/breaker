import type {
  BuildQueueItem,
  InventoryEntry,
  InventoryLocation,
  MaterialTemplate,
  RarityTier,
  RecipeTemplate,
  ReservedMaterialAllocation,
} from "../../types/logistics";
import type { RecipeInputTemplate } from "../../data/logistics/seed";
import { computeShortages, type Shortage } from "./shortages";
import { getInventoryStacks, type InventoryStack } from "./inventory";

export interface MaterialInventoryGroup {
  materialId: string;
  material: MaterialTemplate | undefined;
  entries: InventoryEntry[];
  totalQuantity: number;
}

export interface RarityInventoryGroup {
  rarityTier: RarityTier;
  rarityLabel: string;
  rarityColorHex: string;
  entries: InventoryEntry[];
  totalQuantity: number;
}

export interface LocationInventorySummary {
  location: InventoryLocation;
  entries: InventoryEntry[];
  totalQuantity: number;
  materialCount: number;
  rarityDistribution: RarityInventoryGroup[];
  bestQualityStack: InventoryEntry | undefined;
}

export interface InventoryQualitySummary {
  highestQualityStack: InventoryEntry | undefined;
  bestStacksByMaterial: Array<{
    materialId: string;
    material: MaterialTemplate | undefined;
    entry: InventoryEntry;
  }>;
  averageQuality: number | undefined;
}

export interface InventoryRaritySummary {
  groups: RarityInventoryGroup[];
  totalEntries: number;
  totalQuantity: number;
}

export interface BuildQueueShortageSummary {
  shortages: Shortage[];
  totalShortageMaterials: number;
  totalShortfallQuantity: number;
  activeQueueItems: BuildQueueItem[];
  recipesById: Map<string, RecipeTemplate>;
}

export type AllocationCoverageState = "covered" | "partial" | "missing" | "overReserved" | "stale";

export interface ReservedAllocationValidation {
  allocation: ReservedMaterialAllocation;
  inventoryEntry: InventoryEntry | undefined;
  isStale: boolean;
  staleReason?: "missingStack" | "mismatchedMaterial" | "nonPositiveQuantity" | "exceedsStackQuantity";
}

export interface MaterialReservationCoverage {
  materialId: string;
  requiredQuantity: number;
  reservedQuantity: number;
  coverageState: AllocationCoverageState;
  validations: ReservedAllocationValidation[];
}

export interface BuildQueueMaterialNeedSummary {
  buildQueueItemId: string;
  materialId: string;
  requiredQuantity: number;
  ownedQuantity: number;
  reservedByThisQueueItem: number;
  reservedByOtherQueueItems: number;
  availableQuantity: number;
  stillNeeded: number;
}

export interface BuildQueueRequirementIdentity {
  requirementId?: string;
  selectedQuality?: number;
  unitType?: RecipeInputTemplate["unitType"];
  allowLowerQuality?: boolean;
}

function compareQualityDesc(a: InventoryEntry, b: InventoryEntry): number {
  return (b.quality ?? -1) - (a.quality ?? -1);
}

function getMaterial(materials: MaterialTemplate[], materialId: string): MaterialTemplate | undefined {
  return materials.find((material) => material.id === materialId);
}

export function getReservedQuantityByInventoryEntry(
  buildQueue: BuildQueueItem[],
  excludeBuildQueueItemId?: string,
): Map<string, number> {
  const reservedByStack = new Map<string, number>();
  for (const item of buildQueue) {
    if (item.id === excludeBuildQueueItemId) continue;
    for (const allocation of item.reservedAllocations ?? []) {
      if (allocation.allowLowerQualityOverride && item.allowLowerQuality !== true) continue;
      reservedByStack.set(
        allocation.inventoryEntryId,
        (reservedByStack.get(allocation.inventoryEntryId) ?? 0) + allocation.quantityReserved,
      );
    }
  }
  return reservedByStack;
}

export function getAvailableQuantityForInventoryEntry(
  inventoryEntry: InventoryEntry,
  buildQueue: BuildQueueItem[],
  currentBuildQueueItemId?: string,
): number {
  const reservedByOthers = getReservedQuantityByInventoryEntry(buildQueue, currentBuildQueueItemId);
  return Math.max(0, inventoryEntry.quantity - (reservedByOthers.get(inventoryEntry.id) ?? 0));
}

export function isInventoryEntryEligibleForRequirement(
  inventoryEntry: InventoryEntry,
  materialId: string,
): boolean {
  if (inventoryEntry.materialId !== materialId) return false;
  if (inventoryEntry.quantity <= 0) return false;
  return true;
}

export function allocationMatchesRequirement(
  allocation: ReservedMaterialAllocation,
  materialId: string,
  identity?: BuildQueueRequirementIdentity,
): boolean {
  if (allocation.materialId !== materialId) return false;
  if (!identity) return true;
  if (identity.requirementId !== undefined && allocation.requirementId !== identity.requirementId) return false;
  if (identity.unitType !== undefined && allocation.unitType !== identity.unitType) return false;
  return true;
}

export function validateReservedAllocations(
  allocations: ReservedMaterialAllocation[],
  inventoryEntries: InventoryEntry[],
): ReservedAllocationValidation[] {
  return allocations.map((allocation) => {
    const inventoryEntry = inventoryEntries.find((entry) => entry.id === allocation.inventoryEntryId);
    if (allocation.quantityReserved <= 0) {
      return { allocation, inventoryEntry, isStale: true, staleReason: "nonPositiveQuantity" };
    }
    if (!inventoryEntry) {
      return { allocation, inventoryEntry, isStale: true, staleReason: "missingStack" };
    }
    if (allocation.materialId !== inventoryEntry.materialId) {
      return { allocation, inventoryEntry, isStale: true, staleReason: "mismatchedMaterial" };
    }
    if (allocation.quantityReserved > inventoryEntry.quantity) {
      return { allocation, inventoryEntry, isStale: true, staleReason: "exceedsStackQuantity" };
    }
    return { allocation, inventoryEntry, isStale: false };
  });
}

export function getMaterialReservationCoverage(
  buildQueueItem: BuildQueueItem,
  materialId: string,
  requiredQuantity: number,
  inventoryEntries: InventoryEntry[],
  identity?: BuildQueueRequirementIdentity,
): MaterialReservationCoverage {
  const allocations = (buildQueueItem.reservedAllocations ?? []).filter(
    (allocation) => allocationMatchesRequirement(allocation, materialId, identity),
  );
  const validations = validateReservedAllocations(allocations, inventoryEntries);
  const reservedQuantity = allocations.reduce((sum, allocation) => sum + allocation.quantityReserved, 0);
  const hasStaleAllocation = validations.some((validation) => validation.isStale);
  const coverageState: AllocationCoverageState = hasStaleAllocation
    ? "stale"
    : reservedQuantity > requiredQuantity
      ? "overReserved"
      : reservedQuantity >= requiredQuantity
        ? "covered"
        : reservedQuantity > 0
          ? "partial"
          : "missing";

  return {
    materialId,
    requiredQuantity,
    reservedQuantity,
    coverageState,
    validations,
  };
}

export function getBuildQueueMaterialNeedSummary(
  buildQueueItem: BuildQueueItem,
  materialId: string,
  requiredQuantity: number,
  inventoryEntries: InventoryEntry[],
  buildQueue: BuildQueueItem[],
  identity?: BuildQueueRequirementIdentity,
): BuildQueueMaterialNeedSummary {
  const ownedQuantity = inventoryEntries
    .filter((entry) => isInventoryEntryEligibleForRequirement(entry, materialId))
    .reduce((sum, entry) => sum + entry.quantity, 0);
  const reservedByThisQueueItem = (buildQueueItem.reservedAllocations ?? [])
    .filter((allocation) => allocationMatchesRequirement(allocation, materialId, identity))
    .reduce((sum, allocation) => sum + allocation.quantityReserved, 0);
  const reservedByOtherQueueItems = buildQueue
    .filter((item) => item.id !== buildQueueItem.id)
    .flatMap((item) => (item.reservedAllocations ?? []).map((allocation) => ({ allocation, item })))
    .filter(({ allocation }) => allocation.materialId === materialId)
    .reduce((sum, { allocation }) => sum + allocation.quantityReserved, 0);
  const availableQuantity = inventoryEntries
    .filter((entry) => isInventoryEntryEligibleForRequirement(entry, materialId))
    .reduce((sum, entry) => sum + getAvailableQuantityForInventoryEntry(entry, buildQueue, buildQueueItem.id), 0);

  return {
    buildQueueItemId: buildQueueItem.id,
    materialId,
    requiredQuantity,
    ownedQuantity,
    reservedByThisQueueItem,
    reservedByOtherQueueItems,
    availableQuantity,
    stillNeeded: Math.max(0, requiredQuantity - reservedByThisQueueItem),
  };
}

export function getInventoryByLocation(
  inventoryEntries: InventoryEntry[],
  locations: InventoryLocation[],
): Map<string, InventoryEntry[]> {
  const grouped = new Map(locations.map((location) => [location.id, [] as InventoryEntry[]]));
  for (const entry of inventoryEntries) {
    const key = entry.locationId ?? "unassigned";
    grouped.set(key, [...(grouped.get(key) ?? []), entry]);
  }
  return grouped;
}

export function getInventoryByMaterial(
  inventoryEntries: InventoryEntry[],
  materialTemplates: MaterialTemplate[],
): Map<string, MaterialInventoryGroup> {
  const grouped = new Map<string, MaterialInventoryGroup>();
  for (const entry of inventoryEntries) {
    const materialId = entry.materialId ?? entry.catalogItemId ?? entry.itemName ?? entry.id;
    const current = grouped.get(materialId) ?? {
      materialId,
      material: entry.materialId ? getMaterial(materialTemplates, entry.materialId) : undefined,
      entries: [],
      totalQuantity: 0,
    };
    grouped.set(materialId, {
      ...current,
      entries: [...current.entries, entry],
      totalQuantity: current.totalQuantity + entry.quantity,
    });
  }
  return grouped;
}

export function getInventoryByRarity(inventoryEntries: InventoryEntry[]): Map<RarityTier, RarityInventoryGroup> {
  const grouped = new Map<RarityTier, RarityInventoryGroup>();
  for (const entry of inventoryEntries) {
    const current = grouped.get(entry.rarity.tier) ?? {
      rarityTier: entry.rarity.tier,
      rarityLabel: entry.rarity.label,
      rarityColorHex: entry.rarity.colorHex,
      entries: [],
      totalQuantity: 0,
    };
    grouped.set(entry.rarity.tier, {
      ...current,
      rarityLabel: entry.rarity.label,
      rarityColorHex: entry.rarity.colorHex,
      entries: [...current.entries, entry],
      totalQuantity: current.totalQuantity + entry.quantity,
    });
  }
  return grouped;
}

export function getBestAvailableStacksForMaterial(
  materialId: string,
  inventoryEntries: InventoryEntry[],
  materialTemplates: MaterialTemplate[],
  locations: InventoryLocation[],
  limit?: number,
): InventoryStack[] {
  const sorted = getInventoryStacks(
    inventoryEntries.filter((entry) => entry.materialId === materialId && entry.quantity > 0),
    materialTemplates,
    locations,
  ).sort((a, b) => compareQualityDesc(a, b) || b.quantity - a.quantity);

  return limit === undefined ? sorted : sorted.slice(0, limit);
}

export function getLocationInventorySummary(
  location: InventoryLocation,
  inventoryEntries: InventoryEntry[],
): LocationInventorySummary {
  const entries = inventoryEntries.filter((entry) => entry.locationId === location.id);
  const materialIds = new Set(entries.map((entry) => entry.materialId));
  const rarityDistribution = Array.from(getInventoryByRarity(entries).values());
  const bestQualityStack = entries.slice().sort(compareQualityDesc)[0];

  return {
    location,
    entries,
    totalQuantity: entries.reduce((sum, entry) => sum + entry.quantity, 0),
    materialCount: materialIds.size,
    rarityDistribution,
    bestQualityStack,
  };
}

export function getInventoryQualitySummary(
  inventoryEntries: InventoryEntry[],
  materialTemplates: MaterialTemplate[],
): InventoryQualitySummary {
  const entriesWithQuality = inventoryEntries.filter((entry) => entry.quality !== undefined);
  const highestQualityStack = entriesWithQuality.slice().sort(compareQualityDesc)[0];
  const bestStacksByMaterial = Array.from(getInventoryByMaterial(inventoryEntries, materialTemplates).values())
    .map((group) => {
      const entry = group.entries.slice().sort(compareQualityDesc)[0];
      return entry
        ? {
            materialId: group.materialId,
            material: group.material,
            entry,
          }
        : undefined;
    })
    .filter((item): item is { materialId: string; material: MaterialTemplate | undefined; entry: InventoryEntry } => item !== undefined)
    .sort((a, b) => compareQualityDesc(a.entry, b.entry));

  return {
    highestQualityStack,
    bestStacksByMaterial,
    averageQuality:
      entriesWithQuality.length > 0
        ? entriesWithQuality.reduce((sum, entry) => sum + (entry.quality ?? 0), 0) / entriesWithQuality.length
        : undefined,
  };
}

export function getInventoryRaritySummary(inventoryEntries: InventoryEntry[]): InventoryRaritySummary {
  const groups = Array.from(getInventoryByRarity(inventoryEntries).values());
  return {
    groups,
    totalEntries: inventoryEntries.length,
    totalQuantity: inventoryEntries.reduce((sum, entry) => sum + entry.quantity, 0),
  };
}

export function getBuildQueueShortageSummary(
  inventoryEntries: InventoryEntry[],
  buildQueue: BuildQueueItem[],
  recipeTemplates: RecipeTemplate[],
  recipeInputsByRecipeId: Record<string, RecipeInputTemplate[]>,
): BuildQueueShortageSummary {
  const activeQueueItems = buildQueue.filter((item) => item.status !== "complete");
  const shortages = computeShortages(inventoryEntries, buildQueue, recipeInputsByRecipeId);

  return {
    shortages,
    totalShortageMaterials: shortages.length,
    totalShortfallQuantity: shortages.reduce((sum, shortage) => sum + shortage.shortfall, 0),
    activeQueueItems,
    recipesById: new Map(recipeTemplates.map((recipe) => [recipe.id, recipe])),
  };
}
