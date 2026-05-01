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
import type {
  BuildQueueItem,
  InventoryEntry,
  InventoryLocation,
  ItemTemplate,
  MaterialTemplate,
  OwnedItem,
  RecipeTemplate,
  RarityInfo,
  ReservedMaterialAllocation,
} from "../types/logistics";

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
  updateInventoryEntry: (entry: InventoryEntry) => void;
  deleteInventoryEntry: (id: string) => void;
  updateBuildQueueItemStatus: (id: string, status: NonNullable<BuildQueueItem["status"]>) => void;
  updateBuildQueueItemPriority: (id: string, priority: number) => void;
  removeBuildQueueItem: (id: string) => void;
  setBuildQueueItemAllocations: (buildQueueItemId: string, allocations: ReservedMaterialAllocation[]) => void;
  toggleBuildQueueAllocation: (buildQueueItemId: string, allocation: ReservedMaterialAllocation) => void;
  updateBuildQueueAllocationQuantity: (buildQueueItemId: string, inventoryEntryId: string, quantity: number) => void;
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

function getMaterialTemplate(materialId: string, materials: MaterialTemplate[]): MaterialTemplate | undefined {
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

function isMaterialType(value: unknown): value is MaterialTemplate["materialType"] {
  return value === "ore" || value === "refined" || value === "raw" || value === "special";
}

function isBuildStatus(value: unknown): value is BuildQueueItem["status"] {
  return value === "queued" || value === "active" || value === "paused" || value === "complete";
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
    materialName: isString(value.materialName) ? value.materialName : undefined,
    quality: isNumber(value.quality) ? value.quality : undefined,
    rarity: rarityCatalog[value.rarity.tier],
    locationId: isString(value.locationId) ? value.locationId : undefined,
    container: isString(value.container) ? value.container : undefined,
  };
}

export function getRarityForQuality(quality?: number, material?: MaterialTemplate): RarityInfo {
  if (material?.isQuantanium) return rarityCatalog.quantanium;
  if ((quality ?? 0) >= 900) return rarityCatalog.legendary;
  if ((quality ?? 0) >= 800) return rarityCatalog.epic;
  if ((quality ?? 0) >= 750) return rarityCatalog.rare;
  if ((quality ?? 0) >= 650) return rarityCatalog.uncommon;
  return rarityCatalog.common;
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
  const quality = isNumber(entry.quality) ? Math.max(0, Math.min(1000, entry.quality)) : undefined;
  const rarity = material?.isQuantanium
    ? rarityCatalog.quantanium
    : quality !== undefined
      ? getRarityForQuality(quality, material)
      : normalizeRarity(entry.rarity, rarityCatalog.common);
  return {
    ...entry,
    materialName: material?.name ?? entry.materialName,
    materialType: material?.materialType ?? entry.materialType,
    quality,
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
  if (!isRecord(value) || !isString(value.id) || !isString(value.materialId) || !isNumber(value.quantity)) {
    return null;
  }

  const material = getMaterialTemplate(value.materialId, materials);
  const materialType = material?.materialType ?? (isMaterialType(value.materialType) ? value.materialType : "special");
  const entry: InventoryEntry = {
    id: value.id,
    materialId: value.materialId,
    materialName: isString(value.materialName) ? value.materialName : undefined,
    materialType,
    quality: isNumber(value.quality) ? value.quality : undefined,
    quantity: value.quantity,
    locationId: isString(value.locationId) ? value.locationId : undefined,
    container: isString(value.container) ? value.container : isString(value.containerName) ? value.containerName : undefined,
    source: isString(value.source) ? value.source : undefined,
    sourceHistory: Array.isArray(value.sourceHistory) ? value.sourceHistory.filter(isString) : undefined,
    workOrderId: isString(value.workOrderId) ? value.workOrderId : undefined,
    workOrderIds: Array.isArray(value.workOrderIds) ? value.workOrderIds.filter(isString) : undefined,
    rarity: isRecord(value.rarity) && isRarityTier(value.rarity.tier)
      ? rarityCatalog[value.rarity.tier]
      : rarityCatalog.common,
    createdAt: isString(value.createdAt) ? value.createdAt : new Date().toISOString(),
    updatedAt: isString(value.updatedAt) ? value.updatedAt : new Date().toISOString(),
  };

  return normalizeInventoryEntry(entry, materials);
}

function coercePersistedBuildQueueItem(value: unknown): BuildQueueItem | null {
  if (!isRecord(value) || !isString(value.id) || !isString(value.recipeId) || !isNumber(value.quantity)) {
    return null;
  }

  return {
    id: value.id,
    recipeId: value.recipeId,
    quantity: value.quantity,
    priority: isNumber(value.priority) ? value.priority : undefined,
    status: isBuildStatus(value.status) ? value.status : undefined,
    reservedAllocations: Array.isArray(value.reservedAllocations)
      ? value.reservedAllocations
          .map(coercePersistedReservedAllocation)
          .filter((allocation): allocation is ReservedMaterialAllocation => allocation !== null)
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

function createValidatedAllocation(
  allocation: ReservedMaterialAllocation,
  inventoryEntry: InventoryEntry,
  quantityReserved: number,
): ReservedMaterialAllocation {
  return {
    id: allocation.id || `${inventoryEntry.id}-${inventoryEntry.materialId}`,
    inventoryEntryId: inventoryEntry.id,
    materialId: inventoryEntry.materialId,
    quantityReserved,
    materialName: inventoryEntry.materialName ?? allocation.materialName,
    quality: inventoryEntry.quality,
    rarity: normalizeRarity(inventoryEntry.rarity, rarityCatalog.common),
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
    if (!inventoryEntry || inventoryEntry.materialId !== allocation.materialId) continue;

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
      inventoryEntry.materialId === allocation.materialId &&
      allocation.quantityReserved > 0 &&
      allocation.quantityReserved <= inventoryEntry.quantity
    );
  });
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
      inventoryEntries: initialInventoryEntries,
      buildQueue: initialBuildQueue,
      addLocation: (location) => {
        set((state) => ({ locations: [...state.locations, location] }));
      },
      updateLocation: (location) => {
        set((state) => ({ locations: state.locations.map((l) => l.id === location.id ? location : l) }));
      },
      deleteLocation: (id) => {
        set((state) => ({ locations: state.locations.filter((l) => l.id !== id) }));
      },
      addInventoryEntries: (entries) => {
        set((state) => ({
          inventoryEntries: entries.reduce((inventory, entry) => {
            const normalized = normalizeInventoryEntry(entry, state.materialTemplates);
            const existingIdx = inventory.findIndex((current) =>
              current.materialId === normalized.materialId &&
              (current.locationId ?? "") === (normalized.locationId ?? "") &&
              (current.quality ?? 0) === (normalized.quality ?? 0)
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
          }, state.inventoryEntries),
        }));
      },
      updateInventoryEntry: (entry) => {
        set((state) => ({
          inventoryEntries: state.inventoryEntries.map((current) =>
            current.id === entry.id
              ? normalizeInventoryEntry(entry, state.materialTemplates, current.createdAt)
              : current,
          ),
        }));
      },
      deleteInventoryEntry: (id) => {
        set((state) => ({
          inventoryEntries: state.inventoryEntries.filter((entry) => entry.id !== id),
        }));
      },
      updateBuildQueueItemStatus: (id, status) => {
        set((state) => ({
          buildQueue: state.buildQueue.map((item) => (item.id === id ? { ...item, status } : item)),
        }));
      },
      updateBuildQueueItemPriority: (id, priority) => {
        set((state) => ({
          buildQueue: state.buildQueue.map((item) =>
            item.id === id ? { ...item, priority: Math.max(1, Math.trunc(priority)) } : item,
          ),
        }));
      },
      removeBuildQueueItem: (id) => {
        set((state) => ({
          buildQueue: state.buildQueue.filter((item) => item.id !== id),
        }));
      },
      setBuildQueueItemAllocations: (buildQueueItemId, allocations) => {
        set((state) => ({
          buildQueue: state.buildQueue.map((item) =>
            item.id === buildQueueItemId
              ? { ...item, reservedAllocations: sanitizeReservedAllocationsForItem(buildQueueItemId, allocations, state) }
              : item,
          ),
        }));
      },
      toggleBuildQueueAllocation: (buildQueueItemId, allocation) => {
        set((state) => ({
          buildQueue: state.buildQueue.map((item) => {
            if (item.id !== buildQueueItemId) return item;
            const allocations = item.reservedAllocations ?? [];
            const exists = allocations.some((current) => current.inventoryEntryId === allocation.inventoryEntryId);
            const nextAllocations = exists
              ? allocations.filter((current) => current.inventoryEntryId !== allocation.inventoryEntryId)
              : sanitizeReservedAllocationsForItem(buildQueueItemId, [allocation], state);
            return {
              ...item,
              reservedAllocations: exists ? nextAllocations : [...allocations, ...nextAllocations],
            };
          }),
        }));
      },
      updateBuildQueueAllocationQuantity: (buildQueueItemId, inventoryEntryId, quantity) => {
        set((state) => ({
          buildQueue: state.buildQueue.map((item) => {
            if (item.id !== buildQueueItemId) return item;
            const inventoryEntry = state.inventoryEntries.find((e) => e.id === inventoryEntryId);
            if (!inventoryEntry) return item;
            const allocations = item.reservedAllocations ?? [];
            const allocation = allocations.find((entry) => entry.inventoryEntryId === inventoryEntryId);
            if (!allocation || allocation.materialId !== inventoryEntry.materialId) return item;
            const reservedByOthers = getReservedQuantityForStack(state.buildQueue, inventoryEntryId, buildQueueItemId);
            const maxQuantity = Math.max(0, inventoryEntry.quantity - reservedByOthers);
            const clamped = Math.max(0, Math.min(quantity, maxQuantity));
            if (clamped <= 0) {
              return { ...item, reservedAllocations: allocations.filter((a) => a.inventoryEntryId !== inventoryEntryId) };
            }
            return {
              ...item,
              reservedAllocations: allocations.map((a) =>
                a.inventoryEntryId === inventoryEntryId ? createValidatedAllocation(a, inventoryEntry, clamped) : a,
              ),
            };
          }),
        }));
      },
      clearBuildQueueItemAllocations: (buildQueueItemId) => {
        set((state) => ({
          buildQueue: state.buildQueue.map((item) =>
            item.id === buildQueueItemId ? { ...item, reservedAllocations: [] } : item,
          ),
        }));
      },
      clearStaleBuildQueueItemAllocations: (buildQueueItemId) => {
        set((state) => ({
          buildQueue: state.buildQueue.map((item) =>
            item.id === buildQueueItemId
              ? {
                  ...item,
                  reservedAllocations: removeStaleReservedAllocations(
                    item.reservedAllocations ?? [],
                    state.inventoryEntries,
                  ),
                }
              : item,
          ),
        }));
      },
      resetLogisticsState: () => {
        set({
          materialTemplates,
          itemTemplates,
          recipeTemplates,
          recipeInputTemplates,
          locations: inventoryLocations,
          inventoryEntries: initialInventoryEntries,
          buildQueue: initialBuildQueue,
        });
      },
    }),
    {
      name: LOGISTICS_STORAGE_KEY,
      version: 1,
      partialize: (state) => ({
        inventoryEntries: state.inventoryEntries,
        buildQueue: state.buildQueue,
        locations: state.locations,
      }),
      merge: (persisted, current) => {
        const persistedInventory = getPersistedArray(persisted, "inventoryEntries");
        const persistedBuildQueue = getPersistedArray(persisted, "buildQueue");
        const persistedLocations = getPersistedArray(persisted, "locations");
        const inventoryEntries = persistedInventory
          ?.map((entry) => coercePersistedInventoryEntry(entry, current.materialTemplates))
          .filter((entry): entry is InventoryEntry => entry !== null);
        const buildQueue = persistedBuildQueue
          ?.map(coercePersistedBuildQueueItem)
          .filter((item): item is BuildQueueItem => item !== null);
        const locations = persistedLocations
          ?.map(coercePersistedLocation)
          .filter((l): l is InventoryLocation => l !== null);

        return {
          ...current,
          inventoryEntries: inventoryEntries ?? current.inventoryEntries,
          buildQueue: buildQueue ?? current.buildQueue,
          locations: locations?.length ? locations : current.locations,
        };
      },
    },
  ),
);

export function createInventoryEntryDraft(
  input: Pick<InventoryEntry, "id" | "materialId" | "quantity"> &
    Partial<Omit<InventoryEntry, "id" | "materialId" | "quantity" | "rarity">>,
): InventoryEntry {
  const material = getMaterialTemplate(input.materialId, get().materialTemplates);
  const timestamp = new Date().toISOString();
  const quality = Math.max(0, Math.min(1000, input.quality ?? 0));
  return {
    id: input.id,
    materialId: input.materialId,
    materialName: material?.name,
    materialType: material?.materialType ?? "special",
    quality,
    quantity: input.quantity,
    locationId: input.locationId,
    container: input.container,
    source: input.source,
    sourceHistory: input.sourceHistory,
    workOrderId: input.workOrderId,
    workOrderIds: input.workOrderIds,
    rarity: getRarityForQuality(quality, material),
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  };
}

function get() {
  return useLogisticsStore.getState();
}
