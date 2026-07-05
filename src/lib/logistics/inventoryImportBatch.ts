import type { InventoryEntry, InventoryLocation } from "../../types/logistics";

export type InventoryImportBatchSnapshot = {
  locations: InventoryLocation[];
  inventoryEntries: InventoryEntry[];
};

export type InventoryImportBatchInput = {
  batchId: string;
  additions: InventoryEntry[];
  replaceEntryIds?: string[];
  locations?: InventoryLocation[];
};

export type InventoryImportBatchComputed = {
  snapshot: InventoryImportBatchSnapshot;
  nextLocations: InventoryLocation[];
  inventoryEntries: InventoryEntry[];
  stacksToSync: InventoryEntry[];
};

export function computeInventoryImportBatchState(
  state: InventoryImportBatchSnapshot,
  input: InventoryImportBatchInput,
): InventoryImportBatchComputed {
  const replaceIds = new Set(input.replaceEntryIds ?? []);
  const nextLocations = (input.locations ?? []).reduce<InventoryLocation[]>((current, location) => (
    current.some((entry) => entry.id === location.id) ? current : [...current, location]
  ), state.locations);
  const markedExisting = state.inventoryEntries.map((entry) =>
    replaceIds.has(entry.id)
      ? {
          ...entry,
          inventoryStatus: "replaced" as const,
          replacedByImportBatchId: input.batchId,
        }
      : entry,
  );
  const normalizedAdditions = input.additions.map((entry) => ({
    ...entry,
    inventoryStatus: "active" as const,
    importBatchId: input.batchId,
  }));
  const inventoryEntries = [...markedExisting, ...normalizedAdditions];
  const stacksToSync = inventoryEntries.filter(
    (entry) => replaceIds.has(entry.id) || entry.importBatchId === input.batchId,
  );

  return {
    snapshot: {
      locations: state.locations,
      inventoryEntries: state.inventoryEntries,
    },
    nextLocations,
    inventoryEntries,
    stacksToSync,
  };
}

export function revertInventoryImportBatchLocalState(
  snapshot: InventoryImportBatchSnapshot,
): InventoryImportBatchSnapshot {
  return {
    locations: snapshot.locations,
    inventoryEntries: snapshot.inventoryEntries,
  };
}

export function hasInventoryImportSyncPayload(
  locations: InventoryLocation[],
  stacksToSync: InventoryEntry[],
): boolean {
  return locations.length > 0 || stacksToSync.length > 0;
}
