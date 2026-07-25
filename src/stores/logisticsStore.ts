import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  initialBuildQueue,
  inventoryLocations,
  itemTemplates,
  materialTemplates,
  recipeInputTemplates,
  recipeTemplates,
  rarityCatalog,
  type RecipeInputTemplate,
} from "../data/logistics/seed";
import { normalizeRecipeInputTemplate } from "../lib/logistics/materialResolver";
import {
  createBuildQueueCompletionSnapshot,
  createBuildQueueEntryId,
  moveActiveQueueEntry,
  reorderActiveQueueEntries,
} from "../lib/logistics/buildQueueEntries";
import { rarityFromBandIndex } from "../components/industry/crafting/utils/qualityBands";
import {
  persistBuildQueueClear,
  persistBuildQueueDelete,
  persistBuildQueueItem,
} from "../lib/userBuildQueuePersistence";
import {
  persistOnlineActiveBuildQueue,
  persistOnlineBuildQueue,
  persistOnlineBuildQueueDelete,
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
import { getRequirementLineKey } from "../lib/logistics/buildQueueReservations";
import {
  createDefaultBuildQueue,
  createLocalBuildQueueId,
  normalizeBuildQueueName,
  normalizeBuildQueueState,
} from "../lib/logistics/buildQueues";
import { getInventoryMutationBlockReason } from "../lib/logistics/inventoryFreshness";
import {
  hasInventoryImportSyncPayload,
  revertInventoryImportBatchLocalState,
  type InventoryImportBatchSnapshot,
} from "../lib/logistics/inventoryImportBatch";
import {
  backupLegacyInventoryPayload,
  buildInventorySyncFailurePatch,
  buildInventorySyncSuccessPatch,
  isInventorySyncRequestCurrent,
  logInventorySyncDev,
  type InventorySyncStatus,
} from "../lib/logistics/inventorySyncLifecycle";
import {
  getOnlinePersistenceAuth,
  runOnlinePersistenceMutation,
  syncOnlinePersistenceState,
} from "../lib/userOnlinePersistence";
import type {
  BuildQueue,
  BuildQueueItem,
  BuildQueueSourceType,
  InventoryEntry,
  InventoryLocation,
  ItemTemplate,
  MaterialTemplate,
  OwnedItem,
  RecipeTemplate,
  RarityInfo,
  ReservedMaterialAllocation,
} from "../types/logistics";

export interface InventoryUiState {
  selectedLocationId: string | null;
  searchQuery: string;
  materialFilter: string;
  locationFilter: string;
  qualityMin: number;
  sortKey: "quality" | "quantity" | "material" | "location";
  sortDir: "asc" | "desc";
  viewMode: "location" | "item" | "list";
  listGroupBy: "location" | "item";
  lastImportMode: "append" | "replace_matching_materials_location" | "replace_locations" | "replace_all";
  expandedCards: string[];
  expandedQualityRows: string[];
  viewDensity: "compact" | "comfortable";
}

export interface InventorySyncState {
  status: InventorySyncStatus;
  isFetching: boolean;
  isSyncing: boolean;
  loadedForUserId: string | null;
  lastSuccessfulSyncAt: number | null;
  lastFailedSyncAt?: number;
  activeRequestId: number;
  lastFetchedAt?: string;
  lastSyncedAt?: string;
  syncError?: string;
  hasUnsyncedChanges: boolean;
  pendingMutationCount: number;
  hasHydratedPersist: boolean;
  hasFetchedServerInventory: boolean;
}

const defaultInventoryUi: InventoryUiState = {
  selectedLocationId: null,
  searchQuery: "",
  materialFilter: "",
  locationFilter: "",
  qualityMin: 0,
  sortKey: "quality",
  sortDir: "desc",
  viewMode: "location",
  listGroupBy: "location",
  lastImportMode: "append",
  expandedCards: [],
  expandedQualityRows: [],
  viewDensity: "compact",
};

const defaultInventorySync: InventorySyncState = {
  status: "idle",
  isFetching: false,
  isSyncing: false,
  loadedForUserId: null,
  lastSuccessfulSyncAt: null,
  activeRequestId: 0,
  hasUnsyncedChanges: false,
  pendingMutationCount: 0,
  hasHydratedPersist: false,
  hasFetchedServerInventory: false,
};

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
  inventoryUi: InventoryUiState;
  inventorySync: InventorySyncState;
  buildQueue: BuildQueueItem[];
  buildQueues: BuildQueue[];
  activeBuildQueueId: string;
  setInventoryUi: (patch: Partial<InventoryUiState>) => void;
  setInventorySync: (patch: Partial<InventorySyncState>) => void;
  addLocation: (location: InventoryLocation) => void;
  updateLocation: (location: InventoryLocation) => void;
  deleteLocation: (id: string) => void;
  addInventoryEntries: (entries: InventoryEntry[]) => void;
  applyInventoryImportBatch: (input: {
    batchId: string;
    additions: InventoryEntry[];
    replaceEntryIds?: string[];
    locations?: InventoryLocation[];
  }) => Promise<void>;
  undoInventoryImportBatch: (batchId: string) => void;
  updateInventoryEntry: (entry: InventoryEntry) => void;
  updateInventoryEntryAsync: (entry: InventoryEntry) => Promise<void>;
  transferInventoryStacksAsync: (input: {
    entryIds: string[];
    sourceLocationId: string;
    targetLocationId: string;
  }) => Promise<{
    moves: Array<{ snapshot: InventoryEntry; fromLocationId: string }>;
  }>;
  deleteInventoryEntry: (id: string) => void;
  registerCraftingRecipe: (registration: CraftingRecipeRegistration) => void;
  replaceBuildQueueFromRemote: (
    items: BuildQueueItem[],
    registrations: {
      recipeTemplates: RecipeTemplate[];
      recipeInputTemplates: Record<string, RecipeInputTemplate[]>;
    },
  ) => void;
  replaceOnlineState: (
    state: {
      locations: InventoryLocation[];
      inventoryEntries: InventoryEntry[];
      buildQueues: BuildQueue[];
      buildQueue: BuildQueueItem[];
      activeBuildQueueId?: string | null;
    },
    options?: {
      userId?: string;
      requestId?: number;
    },
  ) => void;
  applyInventorySyncFailure: (
    requestId: number,
    userId: string | null,
    error: unknown,
  ) => void;
  createBuildQueue: (name: string, options?: { sourceType?: BuildQueueSourceType; sourceReference?: string }) => string;
  setActiveBuildQueue: (id: string) => void;
  renameBuildQueue: (id: string, name: string) => void;
  deleteBuildQueue: (id: string) => void;
  addBuildQueueItem: (recipeId: string, quantity?: number, snapshot?: Partial<Pick<BuildQueueItem, "blueprint_id" | "itemId" | "itemName" | "finalProductQualityBand" | "finalProductQualityAverage" | "finalProductRarity" | "materialRequirements" | "blueprintSources">>) => void;
  updateBuildQueueItemStatus: (id: string, status: NonNullable<BuildQueueItem["status"]>) => void;
  updateBuildQueueItemPriority: (id: string, priority: number) => void;
  reorderBuildQueueItems: (queueId: string, orderedEntryIds: string[]) => void;
  moveBuildQueueItem: (id: string, destinationQueueId: string, destinationIndex?: number) => void;
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
  clearAuthenticatedLogisticsData: () => void;
  resetLogisticsState: () => void;
}

type LogisticsSet = (
  partial:
    | Partial<LogisticsStoreState>
    | LogisticsStoreState
    | ((state: LogisticsStoreState) => Partial<LogisticsStoreState> | LogisticsStoreState),
  replace?: false,
) => void;

const LOGISTICS_STORAGE_KEY = "sc_logistics_state_v1";
const LEGACY_LOGISTICS_STORAGE_KEY = "moonbreaker-logistics-v1";

function buildAuthenticatedLogisticsClearUpdate(
  state: Pick<LogisticsStoreState, "inventoryUi"> & Partial<Pick<LogisticsStoreState, "buildQueue">>,
): Pick<LogisticsStoreState, "inventoryEntries" | "locations" | "buildQueue" | "buildQueues" | "activeBuildQueueId" | "inventoryUi"> {
  const defaultQueue = createDefaultBuildQueue();
  return {
    inventoryEntries: [],
    locations: mergeCanonicalInventoryLocations(undefined).locations,
    buildQueue: initialBuildQueue.map((item) => ({ ...item, queueId: defaultQueue.id, reservedAllocations: [] })),
    buildQueues: [defaultQueue],
    activeBuildQueueId: defaultQueue.id,
    inventoryUi: {
      ...state.inventoryUi,
      selectedLocationId: null,
      expandedCards: [],
      expandedQualityRows: [],
    },
  };
}

export { buildAuthenticatedLogisticsClearUpdate };

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

function isInventoryUiSortKey(value: unknown): value is InventoryUiState["sortKey"] {
  return value === "quality" || value === "quantity" || value === "material" || value === "location";
}

function isInventoryUiSortDir(value: unknown): value is InventoryUiState["sortDir"] {
  return value === "asc" || value === "desc";
}

function coerceInventoryUiViewMode(value: unknown): InventoryUiState["viewMode"] {
  if (value === "cards") return "location";
  if (value === "location" || value === "item" || value === "list") return value;
  return defaultInventoryUi.viewMode;
}

function isInventoryUiListGroupBy(value: unknown): value is InventoryUiState["listGroupBy"] {
  return value === "location" || value === "item";
}

function isInventoryUiImportMode(value: unknown): value is InventoryUiState["lastImportMode"] {
  return value === "append" ||
    value === "replace_matching_materials_location" ||
    value === "replace_locations" ||
    value === "replace_all";
}

function coerceStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(isString) : [];
}

function coerceInventoryUi(value: unknown): InventoryUiState {
  const record = isRecord(value) ? value : {};
  return {
    ...defaultInventoryUi,
    selectedLocationId: isString(record.selectedLocationId) ? record.selectedLocationId : null,
    searchQuery: isString(record.searchQuery) ? record.searchQuery : defaultInventoryUi.searchQuery,
    materialFilter: isString(record.materialFilter) ? record.materialFilter : defaultInventoryUi.materialFilter,
    locationFilter: isString(record.locationFilter) ? record.locationFilter : defaultInventoryUi.locationFilter,
    qualityMin: isNumber(record.qualityMin) ? record.qualityMin : defaultInventoryUi.qualityMin,
    sortKey: isInventoryUiSortKey(record.sortKey) ? record.sortKey : defaultInventoryUi.sortKey,
    sortDir: isInventoryUiSortDir(record.sortDir) ? record.sortDir : defaultInventoryUi.sortDir,
    viewMode: coerceInventoryUiViewMode(record.viewMode),
    listGroupBy: isInventoryUiListGroupBy(record.listGroupBy) ? record.listGroupBy : defaultInventoryUi.listGroupBy,
    lastImportMode: isInventoryUiImportMode(record.lastImportMode) ? record.lastImportMode : defaultInventoryUi.lastImportMode,
    expandedCards: coerceStringArray(record.expandedCards),
    expandedQualityRows: coerceStringArray(record.expandedQualityRows),
    viewDensity: record.viewDensity === "comfortable" ? "comfortable" : defaultInventoryUi.viewDensity,
  };
}

function readPersistedInventoryUi(persisted: unknown): InventoryUiState {
  if (!isRecord(persisted)) return defaultInventoryUi;
  return coerceInventoryUi(persisted.inventoryUi ?? persisted);
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

function isDiscreteInventoryBox(entry: InventoryEntry): boolean {
  return entry.recordKind === "box";
}

export function getRarityForBand(qualityBand?: number): RarityInfo {
  return rarityCatalog[rarityFromBandIndex(qualityBand)];
}

function normalizeRarity(rarity: RarityInfo | undefined, fallback: RarityInfo): RarityInfo {
  return isRarityTier(rarity?.tier) ? rarityCatalog[rarity.tier] : fallback;
}

function normalizeInventoryQuality(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.min(1000, Math.trunc(parsed)));
}

function normalizeInventoryEntry(
  entry: InventoryEntry,
  materials: MaterialTemplate[],
  fallbackCreatedAt?: string,
): InventoryEntry {
  const material = getMaterialTemplate(entry.materialId, materials);
  const quality = isNumber(entry.quality) ? normalizeInventoryQuality(entry.quality) : undefined;
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
    isDiscreteInventoryBox(entry) ? `box:${entry.id}` : "aggregate",
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
      if (isDiscreteInventoryBox(entry)) {
        repaired[identicalIndex] = entry;
        continue;
      }
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

export function mergeInventoryEntries(
  existingEntries: InventoryEntry[],
  incomingEntries: InventoryEntry[],
  materials: MaterialTemplate[],
): InventoryEntry[] {
  const normalizedIncoming = incomingEntries.map((entry) => normalizeInventoryEntry(entry, materials));
  return repairInventoryEntryIds(normalizedIncoming.reduce((inventory, normalized) => {
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
      !isDiscreteInventoryBox(current) &&
      !isDiscreteInventoryBox(normalized) &&
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
    }, materials, existing.createdAt);

    return inventory.map((current, idx) => idx === existingIdx ? merged : current);
  }, existingEntries));
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

function didQueueLineupItemChange(previous: BuildQueueItem | undefined, next: BuildQueueItem): boolean {
  return previous === undefined
    || previous.queueId !== next.queueId
    || previous.status !== next.status
    || previous.priority !== next.priority
    || previous.priorityActive !== next.priorityActive;
}

function persistQueueLineupChange(
  set: LogisticsSet,
  action: string,
  previousBuildQueue: BuildQueueItem[],
  nextBuildQueue: BuildQueueItem[],
) {
  const previousById = new Map(previousBuildQueue.map((item) => [item.id, item]));
  const changedItems = nextBuildQueue.filter((item) => didQueueLineupItemChange(previousById.get(item.id), item));
  const requests = changedItems.flatMap((item) => {
    const request = persistBuildQueueItem(item);
    return request ? [request] : [];
  });

  if (requests.length === 0) return;

  void Promise.all(requests).catch((error: unknown) => {
    logBuildQueuePersistenceFailure(action, error);
    // Do not overwrite a later queue mutation while rolling back this failed optimistic update.
    set((state) => state.buildQueue === nextBuildQueue ? { buildQueue: previousBuildQueue } : {});
  });
}

function getInventoryMutationBlockReasonFromState(
  state: Pick<LogisticsStoreState, "inventorySync">,
): string | null {
  const auth = getOnlinePersistenceAuth();
  return getInventoryMutationBlockReason(
    state.inventorySync,
    auth.userId,
    {
      hasAccessToken: Boolean(auth.accessToken),
      hasHydratedPersist: state.inventorySync.hasHydratedPersist,
    },
  );
}

function trackInventoryMutation(
  set: LogisticsSet,
  get: () => LogisticsStoreState,
  request: Promise<unknown> | null,
  action: string,
): Promise<void> {
  const blockReason = getInventoryMutationBlockReasonFromState(get());
  if (blockReason) {
    logInventorySyncDev("mutation blocked", { action, reason: blockReason });
    return Promise.reject(new Error(blockReason));
  }
  if (!request) {
    set((state: LogisticsStoreState) => ({
      inventorySync: {
        ...state.inventorySync,
        hasUnsyncedChanges: true,
        syncError: "Inventory changes are pending until sign-in/server sync is available.",
      },
    }));
    return Promise.resolve();
  }
  set((state: LogisticsStoreState) => ({
    inventorySync: {
      ...state.inventorySync,
      isSyncing: true,
      hasUnsyncedChanges: true,
      pendingMutationCount: state.inventorySync.pendingMutationCount + 1,
      syncError: undefined,
    },
  }));
  return request
    .then(() => {
      set((state: LogisticsStoreState) => {
        const pendingMutationCount = Math.max(0, state.inventorySync.pendingMutationCount - 1);
        return {
          inventorySync: {
            ...state.inventorySync,
            isSyncing: pendingMutationCount > 0,
            hasUnsyncedChanges: pendingMutationCount > 0,
            pendingMutationCount,
            lastSyncedAt: new Date().toISOString(),
            syncError: undefined,
          },
        };
      });
    })
    .catch((error: unknown) => {
      logOnlinePersistenceFailure(action, error);
      set((state: LogisticsStoreState) => {
        const pendingMutationCount = Math.max(0, state.inventorySync.pendingMutationCount - 1);
        return {
          inventorySync: {
            ...state.inventorySync,
            isSyncing: pendingMutationCount > 0,
            hasUnsyncedChanges: true,
            pendingMutationCount,
            status: "error",
            syncError: error instanceof Error ? error.message : String(error),
          },
        };
      });
      throw error instanceof Error ? error : new Error(String(error));
    });
}

function fireAndForgetInventoryMutation(
  set: LogisticsSet,
  get: () => LogisticsStoreState,
  request: Promise<unknown> | null,
  action: string,
): void {
  void trackInventoryMutation(set, get, request, action).catch((error: unknown) => {
    logOnlinePersistenceFailure(action, error);
  });
}

migrateLegacyLogisticsStorage();

const initialQueueState = normalizeBuildQueueState({ items: initialBuildQueue });

export const useLogisticsStore = create<LogisticsStoreState>()(
  persist(
    (set, get) => ({
      materialTemplates,
      itemTemplates,
      recipeTemplates,
      recipeInputTemplates,
      locations: inventoryLocations,
      inventoryEntries: [],
      inventoryUi: defaultInventoryUi,
      inventorySync: defaultInventorySync,
      buildQueue: initialQueueState.items,
      buildQueues: initialQueueState.queues,
      activeBuildQueueId: initialQueueState.activeQueueId,
      setInventoryUi: (patch) => {
        set((state) => ({ inventoryUi: { ...state.inventoryUi, ...patch } }));
      },
      setInventorySync: (patch) => {
        set((state) => ({ inventorySync: { ...state.inventorySync, ...patch } }));
      },
      addLocation: (location) => {
        fireAndForgetInventoryMutation(set, get, persistOnlineInventoryLocation(location), "add location");
        set((state) => ({ locations: [...state.locations, location] }));
      },
      updateLocation: (location) => {
        fireAndForgetInventoryMutation(set, get, persistOnlineInventoryLocation(location), "update location");
        set((state) => ({ locations: state.locations.map((l) => l.id === location.id ? location : l) }));
      },
      deleteLocation: (id) => {
        fireAndForgetInventoryMutation(set, get, persistOnlineInventoryLocationDelete(id), "delete location");
        set((state) => ({ locations: state.locations.filter((l) => l.id !== id) }));
      },
      addInventoryEntries: (entries) => {
        set((state) => {
          const normalizedIncoming = entries.map((entry) => normalizeInventoryEntry(entry, state.materialTemplates));
          const inventoryEntries = mergeInventoryEntries(state.inventoryEntries, entries, state.materialTemplates);
          for (const incoming of normalizedIncoming) {
            const saved = inventoryEntries.find((entry) => getInventoryStackKey(entry) === getInventoryStackKey(incoming));
            if (saved) {
              const location = state.locations.find((entry) => entry.id === saved.locationId);
              fireAndForgetInventoryMutation(set, get, persistOnlineInventoryStack(saved, location), "add inventory stack");
            }
          }
          return { inventoryEntries };
        });
      },
      applyInventoryImportBatch: async ({ batchId, additions, replaceEntryIds = [], locations = [] }) => {
        const state = get();
        const blockReason = getInventoryMutationBlockReasonFromState(state);
        if (blockReason) {
          logInventorySyncDev("applyInventoryImportBatch blocked", {
            reason: blockReason,
            batchId,
            additionCount: additions.length,
            replaceCount: replaceEntryIds.length,
          });
          throw new Error(blockReason);
        }

        const snapshot: InventoryImportBatchSnapshot = {
          locations: state.locations,
          inventoryEntries: state.inventoryEntries,
        };
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
        const stacksToSync = inventoryEntries.filter(
          (entry) => replaceIds.has(entry.id) || entry.importBatchId === batchId,
        );

        if (!hasInventoryImportSyncPayload(locations, stacksToSync)) {
          throw new Error("Import batch produced no syncable inventory rows.");
        }

        set({
          locations: nextLocations,
          inventoryEntries,
        });

        const { accessToken } = getOnlinePersistenceAuth();
        try {
          await trackInventoryMutation(
            set,
            get,
            accessToken
              ? runOnlinePersistenceMutation(() => syncOnlinePersistenceState(accessToken, {
                  locations: locations.length > 0 ? locations : undefined,
                  inventoryEntries: stacksToSync,
                }))
              : null,
            "apply inventory import",
          );
        } catch (error) {
          set(revertInventoryImportBatchLocalState(snapshot));
          logInventorySyncDev("applyInventoryImportBatch rolled back", {
            batchId,
            message: error instanceof Error ? error.message : String(error),
          });
          throw error instanceof Error ? error : new Error(String(error));
        }
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
            fireAndForgetInventoryMutation(set, get, persistOnlineInventoryStackDelete(id), "undo imported inventory stack");
          }
          for (const entry of restored) {
            const location = state.locations.find((candidate) => candidate.id === entry.locationId);
            fireAndForgetInventoryMutation(set, get, persistOnlineInventoryStack(entry, location), "restore inventory stack");
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
          fireAndForgetInventoryMutation(set, get, persistOnlineInventoryStack(normalized, location), "update inventory stack");
          return { inventoryEntries: state.inventoryEntries.map((current) =>
            current.id === entry.id
              ? normalized
              : current,
          ) };
        });
      },
      updateInventoryEntryAsync: async (entry) => {
        const state = get();
        const normalized = normalizeInventoryEntry(
          entry,
          state.materialTemplates,
          state.inventoryEntries.find((current) => current.id === entry.id)?.createdAt,
        );
        const location = state.locations.find((candidate) => candidate.id === normalized.locationId);
        await trackInventoryMutation(set, get, persistOnlineInventoryStack(normalized, location), "update inventory stack");
        set((currentState) => ({
          inventoryEntries: currentState.inventoryEntries.map((current) =>
            current.id === entry.id ? normalized : current,
          ),
        }));
      },
      transferInventoryStacksAsync: async ({ entryIds, sourceLocationId, targetLocationId }) => {
        if (targetLocationId === sourceLocationId) {
          throw new Error("Source and target location must be different.");
        }

        const state = get();
        const plannedMoves: Array<{
          snapshot: InventoryEntry;
          fromLocationId: string;
          updated: InventoryEntry;
        }> = [];

        for (const id of entryIds) {
          const snapshot = state.inventoryEntries.find((entry) => entry.id === id);
          if (!snapshot) {
            throw new Error("One or more selected stacks are no longer in your inventory.");
          }
          const fromLocationId = snapshot.locationId ?? "__unassigned__";
          if (fromLocationId !== sourceLocationId) {
            throw new Error("One or more selected stacks are no longer at the source location.");
          }
          const updated = normalizeInventoryEntry({
            ...snapshot,
            locationId: targetLocationId,
            updatedAt: new Date().toISOString(),
          }, state.materialTemplates, snapshot.createdAt);
          plannedMoves.push({ snapshot, fromLocationId: sourceLocationId, updated });
        }

        if (!plannedMoves.length) {
          throw new Error("No valid stacks selected for transfer.");
        }

        await Promise.all(plannedMoves.map((move) => {
          const location = state.locations.find((candidate) => candidate.id === move.updated.locationId);
          return trackInventoryMutation(
            set,
            get,
            persistOnlineInventoryStack(move.updated, location),
            "transfer inventory stack",
          );
        }));

        const updatedById = new Map(plannedMoves.map((move) => [move.updated.id, move.updated]));
        set((currentState) => ({
          inventoryEntries: currentState.inventoryEntries.map((entry) => updatedById.get(entry.id) ?? entry),
        }));

        return {
          moves: plannedMoves.map(({ snapshot, fromLocationId }) => ({ snapshot, fromLocationId })),
        };
      },
      deleteInventoryEntry: (id) => {
        fireAndForgetInventoryMutation(set, get, persistOnlineInventoryStackDelete(id), "delete inventory stack");
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
          const normalizedQueueState = normalizeBuildQueueState({
            queues: state.buildQueues,
            items,
            activeQueueId: state.activeBuildQueueId,
          });
          const seedRecipeIds = new Set(state.recipeTemplates.map((recipe) => recipe.id));
          const extraRecipes = registrations.recipeTemplates.filter((recipe) => !seedRecipeIds.has(recipe.id));
          return {
            buildQueue: normalizedQueueState.items,
            buildQueues: normalizedQueueState.queues,
            activeBuildQueueId: normalizedQueueState.activeQueueId,
            recipeTemplates: [...state.recipeTemplates, ...extraRecipes],
            recipeInputTemplates: {
              ...state.recipeInputTemplates,
              ...registrations.recipeInputTemplates,
            },
          };
        });
      },
      replaceOnlineState: (onlineState, options) => {
        set((state) => {
          const requestId = options?.requestId;
          if (
            requestId !== undefined &&
            !isInventorySyncRequestCurrent(state.inventorySync, requestId)
          ) {
            return {};
          }

          const nowMs = Date.now();
          const userId = options?.userId ?? state.inventorySync.loadedForUserId;
          if (!userId) {
            return {};
          }
          const mergedLocations = mergeCanonicalInventoryLocations(
            onlineState.locations.length ? onlineState.locations : state.locations,
          );
          const successPatch = buildInventorySyncSuccessPatch(
            requestId ?? state.inventorySync.activeRequestId,
            userId,
            nowMs,
          );
          const normalizedQueueState = normalizeBuildQueueState({
            queues: onlineState.buildQueues,
            items: onlineState.buildQueue.map((item) => ({
              ...item,
              quantity: Math.max(1, Math.trunc(item.quantity)),
              allowLowerQuality: item.allowLowerQuality === true,
              status: item.status ?? "queued",
            })),
            activeQueueId: onlineState.activeBuildQueueId,
          });
          return {
            locations: mergedLocations.locations,
            inventoryEntries: repairInventoryEntryIds(
              remapInventoryEntryLocationIds(
                onlineState.inventoryEntries.map((entry) => normalizeInventoryEntry(entry, state.materialTemplates)),
                mergedLocations.locationIdRemap,
              ),
            ),
            buildQueue: normalizedQueueState.items,
            buildQueues: normalizedQueueState.queues,
            activeBuildQueueId: normalizedQueueState.activeQueueId,
            inventorySync: {
              ...state.inventorySync,
              ...successPatch,
              loadedForUserId: userId,
            },
          };
        });
      },
      applyInventorySyncFailure: (requestId, userId, error) => {
        set((state) => {
          if (!isInventorySyncRequestCurrent(state.inventorySync, requestId)) {
            return {};
          }
          return {
            inventorySync: {
              ...state.inventorySync,
              ...buildInventorySyncFailurePatch(requestId, userId, error),
            },
          };
        });
      },
      createBuildQueue: (name, options) => {
        const normalizedName = normalizeBuildQueueName(name);
        if (!normalizedName) return "";
        const id = createLocalBuildQueueId();
        const queue: BuildQueue = {
          id,
          name: normalizedName,
          sourceType: options?.sourceType ?? "custom",
          sourceReference: options?.sourceReference?.trim() || undefined,
        };
        set((state) => ({
          buildQueues: [...state.buildQueues, queue],
          activeBuildQueueId: id,
        }));
        persistOnlineBuildQueue(queue, id)?.catch((error: unknown) => logBuildQueuePersistenceFailure("create queue", error));
        return id;
      },
      setActiveBuildQueue: (id) => {
        set((state) => state.buildQueues.some((queue) => queue.id === id)
          ? { activeBuildQueueId: id }
          : {});
        persistOnlineActiveBuildQueue(id)?.catch((error: unknown) => logBuildQueuePersistenceFailure("select queue", error));
      },
      renameBuildQueue: (id, name) => {
        const normalizedName = normalizeBuildQueueName(name);
        if (!normalizedName) return;
        let changed: BuildQueue | undefined;
        set((state) => {
          const buildQueues = state.buildQueues.map((queue) => queue.id === id
            ? { ...queue, name: normalizedName }
            : queue);
          changed = buildQueues.find((queue) => queue.id === id);
          return changed ? { buildQueues } : {};
        });
        if (changed) persistOnlineBuildQueue(changed)?.catch((error: unknown) => logBuildQueuePersistenceFailure("rename queue", error));
      },
      deleteBuildQueue: (id) => {
        let previousState: Pick<LogisticsStoreState, "buildQueues" | "buildQueue" | "activeBuildQueueId"> | null = null;
        set((state) => {
          if (state.buildQueues.length <= 1) return {};
          const queueIndex = state.buildQueues.findIndex((queue) => queue.id === id);
          if (queueIndex < 0) return {};
          const buildQueues = state.buildQueues.filter((queue) => queue.id !== id);
          const fallback = buildQueues[Math.max(0, queueIndex - 1)] ?? buildQueues[0];
          const activeBuildQueueId = state.activeBuildQueueId === id ? fallback.id : state.activeBuildQueueId;
          previousState = {
            buildQueues: state.buildQueues,
            buildQueue: state.buildQueue,
            activeBuildQueueId: state.activeBuildQueueId,
          };
          return {
            buildQueues,
            buildQueue: state.buildQueue.filter((item) => item.queueId !== id),
            activeBuildQueueId,
          };
        });
        if (!previousState) return;
        persistOnlineBuildQueueDelete(id)?.then(() => {
          const fallbackId = get().activeBuildQueueId;
          if (fallbackId !== previousState?.activeBuildQueueId) {
            persistOnlineActiveBuildQueue(fallbackId)?.catch((error: unknown) => logBuildQueuePersistenceFailure("select fallback queue", error));
          }
        }).catch((error: unknown) => {
          logBuildQueuePersistenceFailure("delete queue", error);
          const snapshot = previousState;
          if (snapshot) set(snapshot);
        });
      },
      addBuildQueueItem: (recipeId, quantity = 1, snapshot) => {
        set((state) => {
          const nextPriority = state.buildQueue
            .filter((item) => item.queueId === state.activeBuildQueueId)
            .reduce((max, item) => Math.max(max, item.priority ?? 0), 0) + 1;
          const newItem: BuildQueueItem = {
            id: createBuildQueueEntryId(),
            entryKind: "instance",
            queueId: state.activeBuildQueueId,
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
        let previousBuildQueue: BuildQueueItem[] | null = null;
        let nextBuildQueue: BuildQueueItem[] | null = null;
        set((state) => {
          previousBuildQueue = state.buildQueue;
          const buildQueue = state.buildQueue.map((item) => {
            if (item.id !== id) return item;
            if (status === "complete") {
              return {
                ...item,
                status,
                completionSnapshot: item.completionSnapshot ?? createBuildQueueCompletionSnapshot(item),
              };
            }
            return { ...item, status, completionSnapshot: undefined };
          });
          nextBuildQueue = buildQueue;
          return { buildQueue };
        });
        if (previousBuildQueue && nextBuildQueue) {
          persistQueueLineupChange(set, "update status", previousBuildQueue, nextBuildQueue);
        }
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
      reorderBuildQueueItems: (queueId, orderedEntryIds) => {
        let previousBuildQueue: BuildQueueItem[] | null = null;
        let nextBuildQueue: BuildQueueItem[] | null = null;
        set((state) => {
          previousBuildQueue = state.buildQueue;
          const buildQueue = reorderActiveQueueEntries(state.buildQueue, queueId, orderedEntryIds);
          nextBuildQueue = buildQueue;
          return { buildQueue };
        });
        if (previousBuildQueue && nextBuildQueue) {
          persistQueueLineupChange(set, "reorder items", previousBuildQueue, nextBuildQueue);
        }
      },
      moveBuildQueueItem: (id, destinationQueueId, destinationIndex) => {
        let previousBuildQueue: BuildQueueItem[] | null = null;
        let nextBuildQueue: BuildQueueItem[] | null = null;
        set((state) => {
          previousBuildQueue = state.buildQueue;
          const buildQueue = moveActiveQueueEntry(state.buildQueue, id, destinationQueueId, destinationIndex);
          nextBuildQueue = buildQueue;
          return { buildQueue };
        });
        if (previousBuildQueue && nextBuildQueue) {
          persistQueueLineupChange(set, "move item", previousBuildQueue, nextBuildQueue);
        }
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
          const nextBuildQueue = state.buildQueue.filter((item) => item.queueId !== state.activeBuildQueueId);
          const request = persistBuildQueueClear(state.activeBuildQueueId);
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
      clearAuthenticatedLogisticsData: () => {
        set((state) => buildAuthenticatedLogisticsClearUpdate(state));
      },
      resetLogisticsState: () => {
        set((state) => ({
          materialTemplates,
          itemTemplates,
          recipeTemplates,
          recipeInputTemplates,
          locations: inventoryLocations,
          inventoryEntries: [],
          inventorySync: {
            ...defaultInventorySync,
            hasHydratedPersist: state.inventorySync.hasHydratedPersist,
          },
          buildQueue: initialQueueState.items,
          buildQueues: initialQueueState.queues,
          activeBuildQueueId: initialQueueState.activeQueueId,
        }));
      },
    }),
    {
      name: LOGISTICS_STORAGE_KEY,
      version: 3,
      partialize: (state) => ({
        inventoryUi: state.inventoryUi,
      }),
      migrate: (persisted, version) => {
        backupLegacyInventoryPayload(persisted);
        if (import.meta.env.DEV) {
          const record = isRecord(persisted) ? persisted : {};
          console.info("[inventory-sync] migration backup checked", {
            fromVersion: version,
            inventoryEntryCount: Array.isArray(record.inventoryEntries) ? record.inventoryEntries.length : 0,
            locationCount: Array.isArray(record.locations) ? record.locations.length : 0,
            buildQueueCount: Array.isArray(record.buildQueue) ? record.buildQueue.length : 0,
          });
        }
        return {
          inventoryUi: readPersistedInventoryUi(persisted),
        };
      },
      merge: (persisted, current) => {
        const inventoryUi = readPersistedInventoryUi(persisted);
        // Merge persisted recipe templates over seed — seed entries win for known IDs
        return {
          ...current,
          inventoryEntries: [],
          buildQueue: current.buildQueue.map((item) => ({ ...item, reservedAllocations: [] })),
          locations: mergeCanonicalInventoryLocations(undefined).locations,
          inventoryUi,
          inventorySync: {
            ...current.inventorySync,
            hasFetchedServerInventory: false,
          },
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error && import.meta.env.DEV) {
          console.warn("[inventory-sync] persist rehydrate failed", error);
        }
        state?.setInventorySync({ hasHydratedPersist: true });
        if (import.meta.env.DEV) {
          console.info("[inventory-sync] hydration complete");
        }
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
  const quality = normalizeInventoryQuality(input.quality);
  const qualityBand = input.qualityBand === undefined ? undefined : Math.trunc(input.qualityBand);
  const rarity = quality !== undefined ? getRarityForBand(qualityBand) : rarityCatalog.common;
  return normalizeInventoryEntry({
    id: input.id,
    recordKind: input.recordKind,
    materialId: input.materialId,
    materialName: material?.name ?? input.materialName,
    materialType: input.materialType ?? material?.materialType,
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
