import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  initialBuildQueue,
  initialInventoryEntries,
  inventoryLocations,
  itemTemplates,
  materialTemplates,
  recipeInputTemplates,
  recipeTemplates,
  rarityCatalog,
  type RecipeInputTemplate,
} from "../data/logistics/seed";
import { normalizeRecipeInputTemplate } from "../lib/logistics/materialResolver";
import { rarityFromBandIndex } from "../components/industry/crafting/utils/qualityBands";
import {
  persistBuildQueueClear,
  persistBuildQueueDelete,
  persistBuildQueueItem,
} from "../lib/userBuildQueuePersistence";
import {
  persistOnlineInventoryLocation,
  persistOnlineInventoryLocationDelete,
  persistOnlineInventoryStack,
  persistOnlineInventoryStackDelete,
} from "../lib/userOnlinePersistence";
import { setOnlineSyncStatus } from "../lib/onlineSyncStatus";
import {
  getLegacyMaterialItemKind,
  resolveInventoryItemName,
  resolveInventoryUnitType,
} from "../lib/logistics/inventory";
import {
  mergeCanonicalInventoryLocations,
  remapInventoryEntryLocationIds,
} from "../lib/logistics/inventoryLocationOptions";
import { clampMaterialQuality, getRequirementLineKey } from "../lib/logistics/buildQueueReservations";
import type {
  BuildQueueItem,
  InventoryCatalogSource,
  InventoryEntry,
  InventoryItemKind,
  InventoryLocation,
  InventoryUnitType,
  ItemTemplate,
  MaterialTemplate,
  OwnedItem,
  RecipeTemplate,
  RarityInfo,
  ReservedMaterialAllocation,
} from "../types/logistics";

const seedInventoryEntryIds = new Set(initialInventoryEntries.map((entry) => entry.id));

export interface CraftingRecipeRegistration {
  recipeId: string;
  name: string;
  category?: string;
  inputs: RecipeInputTemplate[];
}

interface LogisticsStoreState {
  materialTemplates: MaterialTemplate[];
  itemTemplates: ItemTemplate[];
  recipeTemplates: RecipeTemplate[];
  recipeInputTemplates: Record<string, RecipeInputTemplate[]>;
  locations: InventoryLocation[];
  inventoryEntries: InventoryEntry[];
  buildQueue: BuildQueueItem[];
  addLocation: (location: InventoryLocation) => void;
  updateLocation: (location: InventoryLocation) => void;
  deleteLocation: (id: string) => void;
  addInventoryEntries: (entries: InventoryEntry[]) => void;
  applyInventoryImportBatch: (input: {
    batchId: string;
    additions: InventoryEntry[];
    replaceEntryIds?: string[];
    locations?: InventoryLocation[];
  }) => void;
  undoInventoryImportBatch: (batchId: string) => void;
  updateInventoryEntry: (entry: InventoryEntry) => void;
  deleteInventoryEntry: (id: string) => void;
  registerCraftingRecipe: (registration: CraftingRecipeRegistration) => void;
  replaceBuildQueueFromRemote: (
    items: BuildQueueItem[],
    registrations: {
      recipeTemplates: RecipeTemplate[];
      recipeInputTemplates: Record<string, RecipeInputTemplate[]>;
    },
  ) => void;
  replaceOnlineState: (state: {
    locations: InventoryLocation[];
    inventoryEntries: InventoryEntry[];
    buildQueue: BuildQueueItem[];
  }) => void;
  addBuildQueueItem: (recipeId: string, quantity?: number, snapshot?: Partial<Pick<BuildQueueItem, "blueprint_id" | "itemId" | "itemName" | "finalProductQualityBand" | "finalProductQualityAverage" | "finalProductRarity" | "materialRequirements" | "blueprintSources">>) => void;
  updateBuildQueueItemStatus: (id: string, status: NonNullable<BuildQueueItem["status"]>) => void;
  updateBuildQueueItemPriority: (id: string, priority: number) => void;
  toggleBuildQueueItemPriority: (id: string) => void;
  updateBuildQueueItemQuantity: (id: string, quantity: number) => void;
  updateBuildQueueItemAllowLowerQuality: (id: string, allowLowerQuality: boolean) => void;
  updateBuildQueueMaterialRequirement: (id: string, requirementId: string, input: RecipeInputTemplate) => void;
  removeBuildQueueItem: (id: string) => void;
  clearBuildQueue: () => void;
  setBuildQueueItemAllocations: (buildQueueItemId: string, allocations: ReservedMaterialAllocation[]) => void;
  toggleBuildQueueAllocation: (buildQueueItemId: string, allocation: ReservedMaterialAllocation) => void;
  updateBuildQueueAllocationQuantity: (buildQueueItemId: string, allocationId: string, quantity: number) => void;
  clearBuildQueueItemAllocations: (buildQueueItemId: string) => void;
  clearStaleBuildQueueItemAllocations: (buildQueueItemId: string) => void;
  resetLogisticsState: () => void;
}

const LOGISTICS_STORAGE_KEY = "sc_logistics_state_v1";
const LEGACY_LOGISTICS_STORAGE_KEY = "moonbreaker-logistics-v1";

function migrateLegacyLogisticsStorage() {
  if (typeof window === "undefined") return;
  const storage = window.localStorage;
  if (storage.getItem(LOGISTICS_STORAGE_KEY)) return;
  const legacyState = storage.getItem(LEGACY_LOGISTICS_STORAGE_KEY);
  if (!legacyState) return;
  storage.setItem(LOGISTICS_STORAGE_KEY, legacyState);
}

function getMaterialTemplate(materialId: string | undefined, materials: MaterialTemplate[]): MaterialTemplate | undefined {
  if (!materialId) return undefined;
  return materials.find((material) => material.id === materialId);
}

function mergeInventoryLocationSeeds(_seedLocations: InventoryLocation[], persistedLocations: InventoryLocation[] | undefined): InventoryLocation[] {
  return mergeCanonicalInventoryLocations(persistedLocations?.length ? persistedLocations : undefined).locations;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRarityTier(value: unknown): value is keyof typeof rarityCatalog {
  return (
    value === "legendary" ||
    value === "epic" ||
    value === "rare" ||
    value === "uncommon" ||
    value === "common" ||
    value === "quantanium"
  );
}

function isMaterialType(value: unknown): value is MaterialTemplate["materialType"] {
  return value === "ore" || value === "refined" || value === "raw" || value === "special";
}

function isInventoryItemKind(value: unknown): value is InventoryItemKind {
  return (
    value === "material" ||
    value === "ore" ||
    value === "refined" ||
    value === "raw_mineable" ||
    value === "ice" ||
    value === "fps_weapon" ||
    value === "fps_armor" ||
    value === "vehicle_component" ||
    value === "crafted_item" ||
    value === "manual" ||
    value === "unknown"
  );
}

function isInventoryUnitType(value: unknown): value is InventoryUnitType {
  return value === "scu" || value === "unit";
}

function isInventoryCatalogSource(value: unknown): value is InventoryCatalogSource {
  return value === "api" || value === "seed" || value === "manual" || value === "unknown";
}

function isInventoryStatus(value: unknown): value is InventoryEntry["inventoryStatus"] {
  return value === "active" || value === "replaced";
}

function isBuildStatus(value: unknown): value is BuildQueueItem["status"] {
  return value === "queued" || value === "active" || value === "paused" || value === "complete";
}

function getInventoryLotKey(entry: InventoryEntry): string {
  const importParts = [
    entry.importSourceType ?? "",
    entry.importBatchId ?? "",
    entry.importRowNumber ?? "",
    entry.importLotIndex ?? "",
    entry.replacedByImportBatchId ?? "",
  ];
  const hasImportLot = importParts.some((value) => value !== "");
  return [
    hasImportLot ? importParts.join(":") : "",
    entry.boxSize ?? "",
  ].join("|");
}

function coercePersistedRecipeInput(value: unknown, materials: MaterialTemplate[]): RecipeInputTemplate | null {
  if (!isRecord(value) || !isNumber(value.quantity)) return null;
  const materialId =
    isString(value.materialId) ? value.materialId :
    isString(value.materialKey) ? value.materialKey :
    isString(value.rawName) ? value.rawName :
    isString(value.materialName) ? value.materialName :
    isString(value.displayName) ? value.displayName :
    "";
  if (!materialId) return null;
  return normalizeRecipeInputTemplate({
    ...value,
    materialId,
    materialKey: isString(value.materialKey) ? value.materialKey : undefined,
    requirementId: isString(value.requirementId) ? value.requirementId : undefined,
    costId: isString(value.costId) ? value.costId : undefined,
    materialGuid: isString(value.materialGuid) ? value.materialGuid : isString(value.costId) ? value.costId : undefined,
    materialName: isString(value.materialName) ? value.materialName : undefined,
    displayName: isString(value.displayName) ? value.displayName : undefined,
    rawName: isString(value.rawName) ? value.rawName : undefined,
    sourceName: isString(value.sourceName) ? value.sourceName : undefined,
    sourceType: isString(value.sourceType) ? value.sourceType : undefined,
    quantity: value.quantity,
  } as RecipeInputTemplate, materials);
}

function coercePersistedReservedAllocation(value: unknown): ReservedMaterialAllocation | null {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !isString(value.materialId) ||
    !isString(value.inventoryEntryId) ||
    !isNumber(value.quantityReserved) ||
    !isRecord(value.rarity) ||
    !isRarityTier(value.rarity.tier)
  ) {
    return null;
  }

  return {
    id: value.id,
    materialId: value.materialId,
    inventoryEntryId: value.inventoryEntryId,
    quantityReserved: Math.max(0, value.quantityReserved),
    requirementId: isString(value.requirementId) ? value.requirementId : undefined,
    selectedQuality: isNumber(value.selectedQuality) ? value.selectedQuality : undefined,
    allowLowerQualityOverride: value.allowLowerQualityOverride === true,
    unitType: isString(value.unitType) ? value.unitType as ReservedMaterialAllocation["unitType"] : undefined,
    materialName: isString(value.materialName) ? value.materialName : undefined,
    quality: isNumber(value.quality) ? value.quality : undefined,
    qualityBand: isNumber(value.qualityBand) ? value.qualityBand : undefined,
    rarity: rarityCatalog[value.rarity.tier],
    boxSize: isNumber(value.boxSize) ? value.boxSize : value.boxSize === null ? null : undefined,
    locationId: isString(value.locationId) ? value.locationId : undefined,
    container: isString(value.container) ? value.container : undefined,
  };
}

function coercePersistedBlueprintSource(value: unknown): NonNullable<BuildQueueItem["blueprintSources"]>[number] | null {
  if (!isRecord(value)) return null;
  const displayName = isString(value.displayName) ? value.displayName : undefined;
  if (!displayName) return null;

  return {
    poolName: isString(value.poolName) ? value.poolName : undefined,
    poolGuid: isString(value.poolGuid) ? value.poolGuid : undefined,
    sourceFolder: isString(value.sourceFolder) ? value.sourceFolder : undefined,
    displayName,
    weight: isNumber(value.weight) ? value.weight : undefined,
  };
}

export function getRarityForBand(qualityBand?: number): RarityInfo {
  return rarityCatalog[rarityFromBandIndex(qualityBand)];
}

function normalizeRarity(rarity: RarityInfo | undefined, fallback: RarityInfo): RarityInfo {
  return isRarityTier(rarity?.tier) ? rarityCatalog[rarity.tier] : fallback;
}

function normalizeInventoryEntry(
  entry: InventoryEntry,
  materials: MaterialTemplate[],
  fallbackCreatedAt?: string,
): InventoryEntry {
  const material = getMaterialTemplate(entry.materialId, materials);
  const quality = isNumber(entry.quality) ? clampMaterialQuality(entry.quality) : undefined;
  const qualityBand = isNumber(entry.qualityBand) ? Math.trunc(entry.qualityBand) : undefined;
  const rarity = quality !== undefined
    ? getRarityForBand(qualityBand)
    : normalizeRarity(entry.rarity, rarityCatalog.common);
  const itemName = resolveInventoryItemName(entry, material);
  const itemKind = entry.itemKind ?? getLegacyMaterialItemKind(material);
  const unitType = entry.unitType ?? resolveInventoryUnitType(entry, material);
  return {
    ...entry,
    materialName: material?.name ?? entry.materialName,
    materialType: entry.materialType ?? material?.materialType,
    catalogItemId: entry.catalogItemId ?? entry.materialId,
    catalogSource: entry.catalogSource ?? (material ? "seed" : "manual"),
    itemName,
    itemKind,
    unitType,
    quality,
    qualityBand,
    accentTier: quality !== undefined ? rarity.tier : entry.accentTier,
    rarity,
    createdAt: entry.createdAt ?? fallbackCreatedAt ?? new Date().toISOString(),
    updatedAt: entry.updatedAt ?? new Date().toISOString(),
  };
}

export function normalizeOwnedItemRarity(item: OwnedItem): OwnedItem {
  return {
    ...item,
    rarity: normalizeRarity(item.rarity, rarityCatalog.common),
  };
}

function getInventoryMergeKey(entry: InventoryEntry): string {
  return [
    entry.materialId ?? "",
    entry.catalogItemId ?? "",
    entry.itemName ?? entry.materialName ?? "",
    entry.itemKind ?? "",
    entry.unitType ?? "",
  ].join("|");
}

function getInventoryStackKey(entry: InventoryEntry): string {
  return [
    getInventoryMergeKey(entry),
    entry.locationId ?? "",
    entry.container ?? "",
    entry.quality ?? "__none",
    entry.inventoryStatus ?? "active",
    getInventoryLotKey(entry),
  ].join("|");
}

function stableInventoryIdSuffix(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function repairInventoryEntryIds(entries: InventoryEntry[]): InventoryEntry[] {
  const repaired: InventoryEntry[] = [];
  const indexByStackKey = new Map<string, number>();
  const usedIds = new Set<string>();

  for (const entry of entries) {
    const stackKey = getInventoryStackKey(entry);
    const identicalIndex = indexByStackKey.get(stackKey);
    if (identicalIndex !== undefined) {
      const existing = repaired[identicalIndex];
      const sourceHistory = Array.from(new Set([
        ...(existing.sourceHistory ?? (existing.source ? [existing.source] : [])),
        ...(entry.sourceHistory ?? (entry.source ? [entry.source] : [])),
      ]));
      const workOrderIds = Array.from(new Set([
        ...(existing.workOrderIds ?? (existing.workOrderId ? [existing.workOrderId] : [])),
        ...(entry.workOrderIds ?? (entry.workOrderId ? [entry.workOrderId] : [])),
      ]));
      repaired[identicalIndex] = {
        ...existing,
        quantity: existing.quantity + entry.quantity,
        source: entry.source ?? existing.source,
        sourceHistory: sourceHistory.length ? sourceHistory : undefined,
        workOrderId: entry.workOrderId ?? existing.workOrderId,
        workOrderIds: workOrderIds.length ? workOrderIds : undefined,
        updatedAt: entry.updatedAt ?? existing.updatedAt,
      };
      continue;
    }

    let id = entry.id;
    if (usedIds.has(id)) {
      const baseId = `${id}--repaired-${stableInventoryIdSuffix(stackKey)}`;
      id = baseId;
      let collision = 2;
      while (usedIds.has(id)) {
        id = `${baseId}-${collision}`;
        collision += 1;
      }
    }

    usedIds.add(id);
    indexByStackKey.set(stackKey, repaired.length);
    repaired.push(id === entry.id ? entry : { ...entry, id });
  }

  return repaired;
}

function coercePersistedLocation(value: unknown): InventoryLocation | null {
  if (!isRecord(value) || !isString(value.id) || !isString(value.name)) return null;
  return {
    id: value.id,
    name: value.name,
    category: isString(value.category) ? value.category : undefined,
    system: isString(value.system) ? value.system : undefined,
    type: (value.type === "station" || value.type === "city" || value.type === "outpost" || value.type === "ship")
      ? (value.type as InventoryLocation["type"]) : undefined,
  };
}

function coercePersistedInventoryEntry(value: unknown, materials: MaterialTemplate[]): InventoryEntry | null {
  if (!isRecord(value) || !isString(value.id) || !isNumber(value.quantity)) {
    return null;
  }
  const materialId = isString(value.materialId) ? value.materialId : undefined;
  const itemName = isString(value.itemName) ? value.itemName : isString(value.materialName) ? value.materialName : undefined;
  const catalogItemId = isString(value.catalogItemId) ? value.catalogItemId : materialId;
  if (!materialId && !itemName && !catalogItemId) return null;

  const material = getMaterialTemplate(materialId, materials);
  const materialType = material?.materialType ?? (isMaterialType(value.materialType) ? value.materialType : "special");
  const entry: InventoryEntry = {
    id: value.id,
    materialId,
    materialName: isString(value.materialName) ? value.materialName : undefined,
    materialType,
    catalogItemId,
    catalogSource: isInventoryCatalogSource(value.catalogSource) ? value.catalogSource : undefined,
    itemName,
    itemKind: isInventoryItemKind(value.itemKind) ? value.itemKind : undefined,
    category: isString(value.category) ? value.category : undefined,
    unitType: isInventoryUnitType(value.unitType) ? value.unitType : undefined,
    quality: isNumber(value.quality) ? value.quality : undefined,
    qualityBand: isNumber(value.qualityBand) ? value.qualityBand : undefined,
    quantity: value.quantity,
    boxSize: isNumber(value.boxSize) ? value.boxSize : value.boxSize === null ? null : undefined,
    locationId: isString(value.locationId) ? value.locationId : undefined,
    container: isString(value.container) ? value.container : isString(value.containerName) ? value.containerName : undefined,
    notes: isString(value.notes) ? value.notes : undefined,
    source: isString(value.source) ? value.source : undefined,
    sourceHistory: Array.isArray(value.sourceHistory) ? value.sourceHistory.filter(isString) : undefined,
    inventoryStatus: isInventoryStatus(value.inventoryStatus) ? value.inventoryStatus : undefined,
    importSourceType: isString(value.importSourceType) ? value.importSourceType : undefined,
    importBatchId: isString(value.importBatchId) ? value.importBatchId : undefined,
    importRowNumber: isNumber(value.importRowNumber) ? Math.trunc(value.importRowNumber) : undefined,
    importLotIndex: isNumber(value.importLotIndex) ? Math.trunc(value.importLotIndex) : undefined,
    importLotCount: isNumber(value.importLotCount) ? Math.trunc(value.importLotCount) : undefined,
    replacedByImportBatchId: isString(value.replacedByImportBatchId) ? value.replacedByImportBatchId : undefined,
    replacedAt: isString(value.replacedAt) ? value.replacedAt : undefined,
    workOrderId: isString(value.workOrderId) ? value.workOrderId : undefined,
    workOrderIds: Array.isArray(value.workOrderIds) ? value.workOrderIds.filter(isString) : undefined,
    accentTier: isRarityTier(value.accentTier) ? value.accentTier : undefined,
    rarity: isRecord(value.rarity) && isRarityTier(value.rarity.tier)
      ? rarityCatalog[value.rarity.tier]
      : rarityCatalog.common,
    createdAt: isString(value.createdAt) ? value.createdAt : new Date().toISOString(),
    updatedAt: isString(value.updatedAt) ? value.updatedAt : new Date().toISOString(),
  };

  return normalizeInventoryEntry(entry, materials);
}

function coercePersistedBuildQueueItem(value: unknown, materials: MaterialTemplate[]): BuildQueueItem | null {
  if (!isRecord(value) || !isString(value.id) || !isString(value.recipeId) || !isNumber(value.quantity)) {
    return null;
  }

  return {
    id: value.id,
    recipeId: value.recipeId,
    blueprint_id: isString(value.blueprint_id) ? value.blueprint_id : undefined,
    itemId: isString(value.itemId) ? value.itemId : undefined,
    itemName: isString(value.itemName) ? value.itemName : undefined,
    finalProductQualityBand: isNumber(value.finalProductQualityBand) ? value.finalProductQualityBand : undefined,
    finalProductQualityAverage: isNumber(value.finalProductQualityAverage) ? value.finalProductQualityAverage : undefined,
    finalProductRarity: isString(value.finalProductRarity) ? value.finalProductRarity : undefined,
    quantity: value.quantity,
    allowLowerQuality: value.allowLowerQuality === true,
    priority: isNumber(value.priority) ? value.priority : undefined,
    priorityActive: typeof value.priorityActive === "boolean" ? value.priorityActive : undefined,
    status: isBuildStatus(value.status) ? value.status : undefined,
    reservedAllocations: Array.isArray(value.reservedAllocations)
      ? value.reservedAllocations
          .map(coercePersistedReservedAllocation)
          .filter((allocation): allocation is ReservedMaterialAllocation => allocation !== null)
      : undefined,
    materialRequirements: Array.isArray(value.materialRequirements)
      ? value.materialRequirements
          .map((input) => coercePersistedRecipeInput(input, materials))
          .filter((input): input is RecipeInputTemplate => input !== null)
      : undefined,
    blueprintSources: Array.isArray(value.blueprintSources)
      ? value.blueprintSources
          .map(coercePersistedBlueprintSource)
          .filter((source): source is NonNullable<BuildQueueItem["blueprintSources"]>[number] => source !== null)
      : undefined,
  };
}

function getPersistedArray(persisted: unknown, key: string): unknown[] | undefined {
  if (!isRecord(persisted)) return undefined;
  const value = persisted[key];
  return Array.isArray(value) ? value : undefined;
}

function getReservedQuantityForStack(
  buildQueue: BuildQueueItem[],
  inventoryEntryId: string,
  excludeBuildQueueItemId?: string,
): number {
  return buildQueue.reduce((sum, item) => {
    if (item.id === excludeBuildQueueItemId) return sum;
    return (
      sum +
      (item.reservedAllocations ?? [])
        .filter((allocation) => allocation.inventoryEntryId === inventoryEntryId)
        .reduce((allocationSum, allocation) => allocationSum + allocation.quantityReserved, 0)
    );
  }, 0);
}

function getRequirementLineId(item: BuildQueueItem, input: RecipeInputTemplate, index: number): string {
  return getRequirementLineKey(item, input, index);
}

function createValidatedAllocation(
  allocation: ReservedMaterialAllocation,
  inventoryEntry: InventoryEntry,
  quantityReserved: number,
): ReservedMaterialAllocation {
  const materialId = inventoryEntry.materialId ?? allocation.materialId;
  const allocationId = allocation.id || [
    allocation.requirementId,
    materialId,
    allocation.selectedQuality ?? "any",
    allocation.unitType ?? "unit",
    inventoryEntry.id,
    inventoryEntry.locationId ?? "unassigned",
  ].join(":");
  return {
    id: allocationId,
    inventoryEntryId: inventoryEntry.id,
    materialId,
    quantityReserved,
    requirementId: allocation.requirementId,
    selectedQuality: allocation.selectedQuality,
    allowLowerQualityOverride: allocation.allowLowerQualityOverride,
    unitType: allocation.unitType,
    materialName: inventoryEntry.itemName ?? inventoryEntry.materialName ?? allocation.materialName,
    quality: inventoryEntry.quality,
    qualityBand: inventoryEntry.qualityBand,
    rarity: normalizeRarity(inventoryEntry.rarity, rarityCatalog.common),
    boxSize: inventoryEntry.boxSize,
    locationId: inventoryEntry.locationId,
    container: inventoryEntry.container,
  };
}

function sanitizeReservedAllocationsForItem(
  buildQueueItemId: string,
  allocations: ReservedMaterialAllocation[],
  state: Pick<LogisticsStoreState, "buildQueue" | "inventoryEntries">,
): ReservedMaterialAllocation[] {
  if (!state.buildQueue.some((item) => item.id === buildQueueItemId)) return [];

  const usedByPayload = new Map<string, number>();
  const sanitized: ReservedMaterialAllocation[] = [];

  for (const allocation of allocations) {
    if (!allocation.inventoryEntryId || allocation.quantityReserved <= 0) continue;
    const inventoryEntry = state.inventoryEntries.find((entry) => entry.id === allocation.inventoryEntryId);
    if (!inventoryEntry?.materialId || inventoryEntry.materialId !== allocation.materialId) continue;
    const reservedByOthers = getReservedQuantityForStack(
      state.buildQueue,
      allocation.inventoryEntryId,
      buildQueueItemId,
    );
    const alreadyUsed = usedByPayload.get(allocation.inventoryEntryId) ?? 0;
    const availableQuantity = Math.max(0, inventoryEntry.quantity - reservedByOthers - alreadyUsed);
    const quantityReserved = Math.min(allocation.quantityReserved, availableQuantity);
    if (quantityReserved <= 0) continue;

    usedByPayload.set(allocation.inventoryEntryId, alreadyUsed + quantityReserved);
    sanitized.push(createValidatedAllocation(allocation, inventoryEntry, quantityReserved));
  }

  return sanitized;
}

function removeStaleReservedAllocations(
  allocations: ReservedMaterialAllocation[],
  inventoryEntries: InventoryEntry[],
): ReservedMaterialAllocation[] {
  return allocations.filter((allocation) => {
    const inventoryEntry = inventoryEntries.find((entry) => entry.id === allocation.inventoryEntryId);
    return (
      inventoryEntry !== undefined &&
      inventoryEntry.materialId !== undefined &&
      inventoryEntry.materialId === allocation.materialId &&
      allocation.quantityReserved > 0 &&
      allocation.quantityReserved <= inventoryEntry.quantity
    );
  });
}

function logBuildQueuePersistenceFailure(action: string, error: unknown) {
  setOnlineSyncStatus({
    lastError: `Build queue failed to ${action}: ${error instanceof Error ? error.message : String(error)}`,
  });
  if (import.meta.env.DEV) {
    console.warn(`[build-queue] failed to ${action}`, error);
  }
}

function logOnlinePersistenceFailure(action: string, error: unknown) {
  setOnlineSyncStatus({
    lastError: `Online sync failed to ${action}: ${error instanceof Error ? error.message : String(error)}`,
  });
  if (import.meta.env.DEV) {
    console.warn(`[online-sync] failed to ${action}`, error);
  }
}

function persistQueueSnapshot(action: string, item: BuildQueueItem) {
  persistBuildQueueItem(item)?.catch((error: unknown) => logBuildQueuePersistenceFailure(action, error));
}

migrateLegacyLogisticsStorage();

export const useLogisticsStore = create<LogisticsStoreState>()(
  persist(
    (set) => ({
      materialTemplates,
      itemTemplates,
      recipeTemplates,
      recipeInputTemplates,
      locations: inventoryLocations,
      inventoryEntries: [],
      buildQueue: initialBuildQueue,
      addLocation: (location) => {
        persistOnlineInventoryLocation(location)?.catch((error: unknown) => logOnlinePersistenceFailure("add location", error));
        set((state) => ({ locations: [...state.locations, location] }));
      },
      updateLocation: (location) => {
        persistOnlineInventoryLocation(location)?.catch((error: unknown) => logOnlinePersistenceFailure("update location", error));
        set((state) => ({ locations: state.locations.map((l) => l.id === location.id ? location : l) }));
      },
      deleteLocation: (id) => {
        persistOnlineInventoryLocationDelete(id)?.catch((error: unknown) => logOnlinePersistenceFailure("delete location", error));
        set((state) => ({ locations: state.locations.filter((l) => l.id !== id) }));
      },
      addInventoryEntries: (entries) => {
        set((state) => {
          const normalizedIncoming = entries.map((entry) => normalizeInventoryEntry(entry, state.materialTemplates));
          const inventoryEntries = repairInventoryEntryIds(normalizedIncoming.reduce((inventory, normalized) => {
            const incomingWorkOrderIds = normalized.workOrderIds ?? (normalized.workOrderId ? [normalized.workOrderId] : []);
            if (
              incomingWorkOrderIds.length > 0 &&
              inventory.some((current) => {
                const currentWorkOrderIds = current.workOrderIds ?? (current.workOrderId ? [current.workOrderId] : []);
                return current.materialId !== undefined &&
                  current.materialId === normalized.materialId &&
                  currentWorkOrderIds.some((id) => incomingWorkOrderIds.includes(id));
              })
            ) {
              return inventory;
            }
            const existingIdx = inventory.findIndex((current) =>
              getInventoryMergeKey(current) === getInventoryMergeKey(normalized) &&
              (current.locationId ?? "") === (normalized.locationId ?? "") &&
              (current.container ?? "") === (normalized.container ?? "") &&
              (current.quality ?? "__none") === (normalized.quality ?? "__none") &&
              getInventoryLotKey(current) === getInventoryLotKey(normalized)
            );
            if (existingIdx === -1) return [...inventory, normalized];

            const existing = inventory[existingIdx];
            const sourceHistory = Array.from(new Set([
              ...(existing.sourceHistory ?? (existing.source ? [existing.source] : [])),
              ...(normalized.sourceHistory ?? (normalized.source ? [normalized.source] : [])),
            ]));
            const workOrderIds = Array.from(new Set([
              ...(existing.workOrderIds ?? (existing.workOrderId ? [existing.workOrderId] : [])),
              ...(normalized.workOrderIds ?? (normalized.workOrderId ? [normalized.workOrderId] : [])),
            ]));
            const merged = normalizeInventoryEntry({
              ...existing,
              quantity: existing.quantity + normalized.quantity,
              source: normalized.source ?? existing.source,
              sourceHistory: sourceHistory.length ? sourceHistory : undefined,
              workOrderId: normalized.workOrderId ?? existing.workOrderId,
              workOrderIds: workOrderIds.length ? workOrderIds : undefined,
              updatedAt: new Date().toISOString(),
            }, state.materialTemplates, existing.createdAt);

            return inventory.map((current, idx) => idx === existingIdx ? merged : current);
          }, state.inventoryEntries));
          for (const incoming of normalizedIncoming) {
            const saved = inventoryEntries.find((entry) => getInventoryStackKey(entry) === getInventoryStackKey(incoming));
            if (saved) {
              const location = state.locations.find((entry) => entry.id === saved.locationId);
              persistOnlineInventoryStack(saved, location)?.catch((error: unknown) => logOnlinePersistenceFailure("add inventory stack", error));
            }
          }
          return { inventoryEntries };
        });
      },
      applyInventoryImportBatch: ({ batchId, additions, replaceEntryIds = [], locations = [] }) => {
        set((state) => {
          const now = new Date().toISOString();
          const replaceIds = new Set(replaceEntryIds);
          const nextLocations = locations.reduce<InventoryLocation[]>((current, location) => (
            current.some((entry) => entry.id === location.id) ? current : [...current, location]
          ), state.locations);
          const markedExisting = state.inventoryEntries.map((entry) =>
            replaceIds.has(entry.id)
              ? normalizeInventoryEntry({
                  ...entry,
                  inventoryStatus: "replaced",
                  replacedByImportBatchId: batchId,
                  replacedAt: now,
                  updatedAt: now,
                }, state.materialTemplates, entry.createdAt)
              : entry,
          );
          const normalizedAdditions = additions.map((entry) => normalizeInventoryEntry({
            ...entry,
            inventoryStatus: "active",
            importBatchId: batchId,
          }, state.materialTemplates));
          const inventoryEntries = repairInventoryEntryIds([...markedExisting, ...normalizedAdditions]);

          for (const entry of inventoryEntries) {
            if (!replaceIds.has(entry.id) && entry.importBatchId !== batchId) continue;
            const location = nextLocations.find((candidate) => candidate.id === entry.locationId);
            persistOnlineInventoryStack(entry, location)?.catch((error: unknown) => logOnlinePersistenceFailure("apply inventory import", error));
          }
          for (const location of locations) {
            persistOnlineInventoryLocation(location)?.catch((error: unknown) => logOnlinePersistenceFailure("add import location", error));
          }

          return {
            locations: nextLocations,
            inventoryEntries,
          };
        });
      },
      undoInventoryImportBatch: (batchId) => {
        set((state) => {
          const restored: InventoryEntry[] = [];
          const removedImportedIds = new Set<string>();
          const inventoryEntries = state.inventoryEntries.flatMap((entry) => {
            if (entry.importBatchId === batchId && entry.importSourceType === "inventory_csv") {
              removedImportedIds.add(entry.id);
              return [];
            }
            if (entry.replacedByImportBatchId === batchId) {
              const next = normalizeInventoryEntry({
                ...entry,
                inventoryStatus: "active",
                replacedByImportBatchId: undefined,
                replacedAt: undefined,
                updatedAt: new Date().toISOString(),
              }, state.materialTemplates, entry.createdAt);
              restored.push(next);
              return [next];
            }
            return [entry];
          });

          for (const id of removedImportedIds) {
            persistOnlineInventoryStackDelete(id)?.catch((error: unknown) => logOnlinePersistenceFailure("undo imported inventory stack", error));
          }
          for (const entry of restored) {
            const location = state.locations.find((candidate) => candidate.id === entry.locationId);
            persistOnlineInventoryStack(entry, location)?.catch((error: unknown) => logOnlinePersistenceFailure("restore inventory stack", error));
          }

          return { inventoryEntries };
        });
      },
      updateInventoryEntry: (entry) => {
        set((state) => {
          const normalized = normalizeInventoryEntry(
            entry,
            state.materialTemplates,
            state.inventoryEntries.find((current) => current.id === entry.id)?.createdAt,
          );
          const location = state.locations.find((entry) => entry.id === normalized.locationId);
          persistOnlineInventoryStack(normalized, location)?.catch((error: unknown) => logOnlinePersistenceFailure("update inventory stack", error));
          return { inventoryEntries: state.inventoryEntries.map((current) =>
            current.id === entry.id
              ? normalized
              : current,
          ) };
        });
      },
      deleteInventoryEntry: (id) => {
        persistOnlineInventoryStackDelete(id)?.catch((error: unknown) => logOnlinePersistenceFailure("delete inventory stack", error));
        set((state) => ({
          inventoryEntries: state.inventoryEntries.filter((entry) => entry.id !== id),
        }));
      },
      registerCraftingRecipe: ({ recipeId, name, category, inputs }) => {
        set((state) => {
          const normalizedInputs = inputs.map((input) => normalizeRecipeInputTemplate(input, state.materialTemplates));
          const existingRecipe = state.recipeTemplates.find((r) => r.id === recipeId);
          const nextRecipes = existingRecipe
            ? state.recipeTemplates
            : [...state.recipeTemplates, { id: recipeId, name, category }];
          return {
            recipeTemplates: nextRecipes,
            recipeInputTemplates: { ...state.recipeInputTemplates, [recipeId]: normalizedInputs },
          };
        });
      },
      replaceBuildQueueFromRemote: (items, registrations) => {
        set((state) => {
          const seedRecipeIds = new Set(state.recipeTemplates.map((recipe) => recipe.id));
          const extraRecipes = registrations.recipeTemplates.filter((recipe) => !seedRecipeIds.has(recipe.id));
          return {
            buildQueue: items,
            recipeTemplates: [...state.recipeTemplates, ...extraRecipes],
            recipeInputTemplates: {
              ...state.recipeInputTemplates,
              ...registrations.recipeInputTemplates,
            },
          };
        });
      },
      replaceOnlineState: (onlineState) => {
        set((state) => {
          const mergedLocations = mergeCanonicalInventoryLocations(
            onlineState.locations.length ? onlineState.locations : state.locations,
          );
          return {
          locations: mergedLocations.locations,
          inventoryEntries: repairInventoryEntryIds(
            remapInventoryEntryLocationIds(
              onlineState.inventoryEntries.map((entry) => normalizeInventoryEntry(entry, state.materialTemplates)),
              mergedLocations.locationIdRemap,
            ),
          ),
          buildQueue: onlineState.buildQueue.map((item) => ({
            ...item,
            quantity: Math.max(1, Math.trunc(item.quantity)),
            allowLowerQuality: item.allowLowerQuality === true,
            status: item.status ?? "queued",
          })),
        };
        });
      },
      addBuildQueueItem: (recipeId, quantity = 1, snapshot) => {
        set((state) => {
          const existing = state.buildQueue.find((item) => item.recipeId === recipeId);
          if (existing) {
            const nextBuildQueue = state.buildQueue.map((item) =>
              item.id === existing.id
                ? {
                    ...item,
                    quantity: item.quantity + quantity,
                    blueprintSources: item.blueprintSources?.length ? item.blueprintSources : snapshot?.blueprintSources,
                  }
                : item,
            );
            const changedItem = nextBuildQueue.find((item) => item.id === existing.id);
            if (changedItem) persistQueueSnapshot("add item", changedItem);
            return { buildQueue: nextBuildQueue };
          }
          const nextPriority = state.buildQueue.reduce((max, item) => Math.max(max, item.priority ?? 0), 0) + 1;
          const newItem: BuildQueueItem = {
            id: `bq-craft-${recipeId}-${Date.now()}`,
            recipeId,
            blueprint_id: snapshot?.blueprint_id,
            itemId: snapshot?.itemId,
            itemName: snapshot?.itemName,
            finalProductQualityBand: snapshot?.finalProductQualityBand,
            finalProductQualityAverage: snapshot?.finalProductQualityAverage,
            finalProductRarity: snapshot?.finalProductRarity,
            quantity,
            allowLowerQuality: false,
            status: "queued",
            priority: nextPriority,
            priorityActive: false,
            blueprintSources: snapshot?.blueprintSources,
            materialRequirements: snapshot?.materialRequirements?.map((input, index) => ({
              ...input,
              requirementId: input.requirementId ?? `${recipeId}:${index}:${input.materialKey ?? input.materialId}:${input.modifierName ?? input.modifierType ?? "material"}`,
            })),
          };
          const nextBuildQueue = [...state.buildQueue, newItem];
          persistQueueSnapshot("add item", newItem);
          return { buildQueue: nextBuildQueue };
        });
      },
      updateBuildQueueItemStatus: (id, status) => {
        set((state) => {
          const buildQueue = state.buildQueue.map((item) => (item.id === id ? { ...item, status } : item));
          const changed = buildQueue.find((item) => item.id === id);
          if (changed) persistQueueSnapshot("update status", changed);
          return { buildQueue };
        });
      },
      updateBuildQueueItemPriority: (id, priority) => {
        set((state) => {
          const buildQueue = state.buildQueue.map((item) =>
            item.id === id ? { ...item, priority: Math.max(1, Math.trunc(priority)) } : item,
          );
          const changed = buildQueue.find((item) => item.id === id);
          if (changed) persistQueueSnapshot("update priority", changed);
          return { buildQueue };
        });
      },
      toggleBuildQueueItemPriority: (id) => {
        set((state) => {
          const buildQueue = state.buildQueue.map((item) =>
            item.id === id ? { ...item, priorityActive: !(item.priorityActive ?? false) } : item,
          );
          const changed = buildQueue.find((item) => item.id === id);
          if (changed) persistQueueSnapshot("toggle priority", changed);
          return { buildQueue };
        });
      },
      updateBuildQueueItemQuantity: (id, quantity) => {
        set((state) => {
          const item = state.buildQueue.find((entry) => entry.id === id);
          if (!item) return {};
          const nextQuantity = Math.max(1, Math.trunc(quantity));
          const nextBuildQueue = state.buildQueue.map((entry) =>
            entry.id === id ? { ...entry, quantity: nextQuantity } : entry,
          );
          const changed = nextBuildQueue.find((entry) => entry.id === id);
          if (changed) persistQueueSnapshot("update quantity", changed);
          return { buildQueue: nextBuildQueue };
        });
      },
      updateBuildQueueItemAllowLowerQuality: (id, allowLowerQuality) => {
        set((state) => {
          const buildQueue = state.buildQueue.map((item) =>
            item.id === id
              ? {
                  ...item,
                  allowLowerQuality,
                  reservedAllocations: allowLowerQuality
                    ? item.reservedAllocations
                    : (item.reservedAllocations ?? []).filter((allocation) => !allocation.allowLowerQualityOverride),
                }
              : item,
          );
          const changed = buildQueue.find((item) => item.id === id);
          if (changed) persistQueueSnapshot("update lower quality", changed);
          return { buildQueue };
        });
      },
      updateBuildQueueMaterialRequirement: (id, requirementId, input) => {
        set((state) => {
          const item = state.buildQueue.find((entry) => entry.id === id);
          if (!item) return {};
          const inputs = (item.materialRequirements ?? state.recipeInputTemplates[item.recipeId] ?? []).map((entry, index) => ({
            ...entry,
            requirementId: getRequirementLineId(item, entry, index),
          }));
          const buildQueue = state.buildQueue.map((entry) =>
              entry.id === id
                ? {
                    ...entry,
                    materialRequirements: inputs.map((entry) =>
                      entry.requirementId === requirementId
                        ? { ...entry, ...input, requirementId: entry.requirementId, materialId: entry.materialId, quantity: entry.quantity }
                        : entry,
                    ),
                  }
                : entry,
            );
          const changed = buildQueue.find((entry) => entry.id === id);
          if (changed) persistQueueSnapshot("update material requirement", changed);
          return { buildQueue };
        });
      },
      removeBuildQueueItem: (id) => {
        set((state) => {
          const item = state.buildQueue.find((entry) => entry.id === id);
          const nextBuildQueue = state.buildQueue.filter((entry) => entry.id !== id);
          if (item) {
            const request = persistBuildQueueDelete(item);
            request?.catch((error: unknown) => {
              logBuildQueuePersistenceFailure("remove item", error);
              set((current) => current.buildQueue === nextBuildQueue ? { buildQueue: state.buildQueue } : {});
            });
          }
          return {
            buildQueue: nextBuildQueue,
          };
        });
      },
      clearBuildQueue: () => {
        set((state) => {
          const nextBuildQueue: BuildQueueItem[] = [];
          const request = persistBuildQueueClear();
          request?.catch((error: unknown) => {
            logBuildQueuePersistenceFailure("clear queue", error);
            set((current) => current.buildQueue === nextBuildQueue ? { buildQueue: state.buildQueue } : {});
          });
          return { buildQueue: nextBuildQueue };
        });
      },
      setBuildQueueItemAllocations: (buildQueueItemId, allocations) => {
        set((state) => {
          const buildQueue = state.buildQueue.map((item) =>
            item.id === buildQueueItemId
              ? { ...item, reservedAllocations: sanitizeReservedAllocationsForItem(buildQueueItemId, allocations, state) }
              : item,
          );
          const changed = buildQueue.find((item) => item.id === buildQueueItemId);
          if (changed) persistQueueSnapshot("set allocations", changed);
          return { buildQueue };
        });
      },
      toggleBuildQueueAllocation: (buildQueueItemId, allocation) => {
        set((state) => {
          const buildQueue = state.buildQueue.map((item) => {
            if (item.id !== buildQueueItemId) return item;
            const allocations = item.reservedAllocations ?? [];
            const exists = allocations.some((current) => current.id === allocation.id);
            const nextAllocations = exists
              ? allocations.filter((current) => current.id !== allocation.id)
              : sanitizeReservedAllocationsForItem(buildQueueItemId, [...allocations, allocation], state);
            return {
              ...item,
              reservedAllocations: nextAllocations,
            };
          });
          const changed = buildQueue.find((item) => item.id === buildQueueItemId);
          if (changed) persistQueueSnapshot("toggle allocation", changed);
          return { buildQueue };
        });
      },
      updateBuildQueueAllocationQuantity: (buildQueueItemId, allocationId, quantity) => {
        set((state) => {
          const buildQueue = state.buildQueue.map((item) => {
            if (item.id !== buildQueueItemId) return item;
            const allocations = item.reservedAllocations ?? [];
            const allocation = allocations.find((entry) => entry.id === allocationId);
            if (!allocation) return item;
            const inventoryEntry = state.inventoryEntries.find((e) => e.id === allocation.inventoryEntryId);
            if (!inventoryEntry) return item;
            if (!allocation || allocation.materialId !== inventoryEntry.materialId) return item;
            const reservedByOthers = getReservedQuantityForStack(state.buildQueue, inventoryEntry.id, buildQueueItemId);
            const reservedByThisStackOtherSlots = allocations
              .filter((entry) => entry.id !== allocationId && entry.inventoryEntryId === inventoryEntry.id)
              .reduce((sum, entry) => sum + entry.quantityReserved, 0);
            const maxQuantity = Math.max(0, inventoryEntry.quantity - reservedByOthers - reservedByThisStackOtherSlots);
            const clamped = Math.max(0, Math.min(quantity, maxQuantity));
            if (clamped <= 0) {
              return { ...item, reservedAllocations: allocations.filter((a) => a.id !== allocationId) };
            }
            return {
              ...item,
              reservedAllocations: allocations.map((a) =>
                a.id === allocationId ? createValidatedAllocation(a, inventoryEntry, clamped) : a,
              ),
            };
          });
          const changed = buildQueue.find((item) => item.id === buildQueueItemId);
          if (changed) persistQueueSnapshot("update allocation quantity", changed);
          return { buildQueue };
        });
      },
      clearBuildQueueItemAllocations: (buildQueueItemId) => {
        set((state) => {
          const buildQueue = state.buildQueue.map((item) =>
            item.id === buildQueueItemId ? { ...item, reservedAllocations: [] } : item,
          );
          const changed = buildQueue.find((item) => item.id === buildQueueItemId);
          if (changed) persistQueueSnapshot("clear allocations", changed);
          return { buildQueue };
        });
      },
      clearStaleBuildQueueItemAllocations: (buildQueueItemId) => {
        set((state) => {
          const buildQueue = state.buildQueue.map((item) =>
            item.id === buildQueueItemId
              ? {
                  ...item,
                  reservedAllocations: removeStaleReservedAllocations(
                    item.reservedAllocations ?? [],
                    state.inventoryEntries,
                  ),
              }
              : item,
          );
          const changed = buildQueue.find((item) => item.id === buildQueueItemId);
          if (changed) persistQueueSnapshot("clear stale allocations", changed);
          return { buildQueue };
        });
      },
      resetLogisticsState: () => {
        set({
          materialTemplates,
          itemTemplates,
          recipeTemplates,
          recipeInputTemplates,
          locations: inventoryLocations,
          inventoryEntries: [],
          buildQueue: initialBuildQueue,
        });
      },
    }),
    {
      name: LOGISTICS_STORAGE_KEY,
      version: 2,
      partialize: (state) => ({
        inventoryEntries: state.inventoryEntries,
        buildQueue: state.buildQueue,
        locations: state.locations,
        recipeTemplates: state.recipeTemplates,
        recipeInputTemplates: state.recipeInputTemplates,
      }),
      merge: (persisted, current) => {
        const persistedInventory = getPersistedArray(persisted, "inventoryEntries");
        const persistedBuildQueue = getPersistedArray(persisted, "buildQueue");
        const persistedLocations = getPersistedArray(persisted, "locations");
        const persistedRecipes = getPersistedArray(persisted, "recipeTemplates");
        const persistedInputs = isRecord(persisted) ? persisted["recipeInputTemplates"] : undefined;

        const inventoryEntries = persistedInventory
          ? repairInventoryEntryIds(
              persistedInventory
                .map((entry) => coercePersistedInventoryEntry(entry, current.materialTemplates))
                .filter((entry): entry is InventoryEntry => entry !== null && !seedInventoryEntryIds.has(entry.id)),
            )
          : undefined;
        const buildQueue = persistedBuildQueue
          ?.map((item) => coercePersistedBuildQueueItem(item, current.materialTemplates))
          .filter((item): item is BuildQueueItem => item !== null);
        const locations = persistedLocations
          ?.map(coercePersistedLocation)
          .filter((l): l is InventoryLocation => l !== null);

        // Merge persisted recipe templates over seed — seed entries win for known IDs
        const seedRecipeIds = new Set(current.recipeTemplates.map((r) => r.id));
        const extraRecipes: RecipeTemplate[] = Array.isArray(persistedRecipes)
          ? persistedRecipes.filter(
              (r): r is RecipeTemplate =>
                isRecord(r) && isString(r.id) && isString(r.name) && !seedRecipeIds.has(r.id as string),
            )
          : [];
        const mergedRecipes = [...current.recipeTemplates, ...extraRecipes];

        const mergedInputs: Record<string, RecipeInputTemplate[]> = { ...current.recipeInputTemplates };
        if (isRecord(persistedInputs)) {
          for (const [recipeId, inputs] of Object.entries(persistedInputs)) {
            if (seedRecipeIds.has(recipeId)) continue;
            if (Array.isArray(inputs)) {
              const coerced = inputs
                .map((input) => coercePersistedRecipeInput(input, current.materialTemplates))
                .filter((input): input is RecipeInputTemplate => input !== null);
              if (coerced.length) mergedInputs[recipeId] = coerced;
            }
          }
        }

        return {
          ...current,
          inventoryEntries: inventoryEntries ?? current.inventoryEntries,
          buildQueue: buildQueue ?? current.buildQueue,
          locations: mergeInventoryLocationSeeds(current.locations, locations),
          recipeTemplates: mergedRecipes,
          recipeInputTemplates: mergedInputs,
        };
      },
    },
  ),
);

export function createInventoryEntryDraft(
  input: Pick<InventoryEntry, "id" | "quantity"> &
    Partial<Omit<InventoryEntry, "id" | "quantity" | "rarity">>,
): InventoryEntry {
  const material = getMaterialTemplate(input.materialId, get().materialTemplates);
  const timestamp = new Date().toISOString();
  const quality = clampMaterialQuality(input.quality);
  const qualityBand = input.qualityBand === undefined ? undefined : Math.trunc(input.qualityBand);
  const rarity = quality !== undefined ? getRarityForBand(qualityBand) : rarityCatalog.common;
  return normalizeInventoryEntry({
    id: input.id,
    materialId: input.materialId,
    materialName: material?.name ?? input.materialName,
    materialType: material?.materialType ?? input.materialType,
    catalogItemId: input.catalogItemId ?? input.materialId,
    catalogSource: input.catalogSource,
    itemName: input.itemName,
    itemKind: input.itemKind,
    category: input.category,
    unitType: input.unitType,
    quality,
    qualityBand,
    quantity: input.quantity,
    boxSize: input.boxSize,
    locationId: input.locationId,
    container: input.container,
    notes: input.notes,
    source: input.source,
    sourceHistory: input.sourceHistory,
    inventoryStatus: input.inventoryStatus,
    importSourceType: input.importSourceType,
    importBatchId: input.importBatchId,
    importRowNumber: input.importRowNumber,
    importLotIndex: input.importLotIndex,
    importLotCount: input.importLotCount,
    replacedByImportBatchId: input.replacedByImportBatchId,
    replacedAt: input.replacedAt,
    workOrderId: input.workOrderId,
    workOrderIds: input.workOrderIds,
    accentTier: quality !== undefined ? rarity.tier : input.accentTier,
    rarity,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  }, get().materialTemplates);
}

function get() {
  return useLogisticsStore.getState();
}
