import {
  canonicalInventoryLocations,
  inventoryLocationAliasIds,
} from "../../data/logistics/inventoryLocationCatalog";
import type { InventoryEntry, InventoryLocation } from "../../types/logistics";

export function normalizeInventoryLocationLookup(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getLocationAliasKeys(location: InventoryLocation): string[] {
  const raw = location as InventoryLocation & { aliases?: unknown };
  if (!Array.isArray(raw.aliases)) return [];
  return raw.aliases.filter((alias): alias is string => typeof alias === "string");
}

function resolveCanonicalLocationIdByName(name: string): string | undefined {
  const key = normalizeInventoryLocationLookup(name);
  if (!key) return undefined;
  const aliasId = inventoryLocationAliasIds[key];
  if (aliasId) return aliasId;
  return canonicalInventoryLocations.find((location) => normalizeInventoryLocationLookup(location.name) === key)?.id;
}

export function buildInventoryLocationLookup(locations: InventoryLocation[]): Map<string, InventoryLocation> {
  const lookup = new Map<string, InventoryLocation>();
  for (const location of locations) {
    lookup.set(normalizeInventoryLocationLookup(location.id), location);
    lookup.set(normalizeInventoryLocationLookup(location.name), location);
    for (const alias of getLocationAliasKeys(location)) {
      lookup.set(normalizeInventoryLocationLookup(alias), location);
    }
  }
  for (const [aliasKey, canonicalId] of Object.entries(inventoryLocationAliasIds)) {
    const canonical = locations.find((location) => location.id === canonicalId);
    if (canonical) lookup.set(aliasKey, canonical);
  }
  return lookup;
}

export function resolveInventoryLocationByInput(
  input: string,
  lookup: Map<string, InventoryLocation>,
): InventoryLocation | undefined {
  const key = normalizeInventoryLocationLookup(input);
  if (!key) return undefined;
  return lookup.get(key);
}

export type MergeInventoryLocationsResult = {
  locations: InventoryLocation[];
  locationIdRemap: Map<string, string>;
};

export function mergeCanonicalInventoryLocations(
  userLocations: InventoryLocation[] | undefined,
): MergeInventoryLocationsResult {
  const canonicalIds = new Set(canonicalInventoryLocations.map((location) => location.id));
  const locationIdRemap = new Map<string, string>();
  const extraLocations: InventoryLocation[] = [];

  for (const location of userLocations ?? []) {
    const canonicalId = resolveCanonicalLocationIdByName(location.name);
    if (canonicalId) {
      if (location.id !== canonicalId) locationIdRemap.set(location.id, canonicalId);
      continue;
    }
    if (canonicalIds.has(location.id)) continue;
    if (location.category?.toLowerCase() === "moon") continue;
    extraLocations.push(location);
  }

  return {
    locations: [...canonicalInventoryLocations, ...extraLocations],
    locationIdRemap,
  };
}

export function remapInventoryEntryLocationIds(
  entries: InventoryEntry[],
  locationIdRemap: Map<string, string>,
): InventoryEntry[] {
  if (locationIdRemap.size === 0) return entries;
  return entries.map((entry) => {
    if (!entry.locationId) return entry;
    const remappedId = locationIdRemap.get(entry.locationId);
    return remappedId ? { ...entry, locationId: remappedId } : entry;
  });
}

export function mergeInventoryLocationOptions(
  userLocations: InventoryLocation[] | undefined,
): InventoryLocation[] {
  return mergeCanonicalInventoryLocations(userLocations).locations;
}
