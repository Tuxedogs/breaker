import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";

export const DEFAULT_VEHICLE_TYPE = "weaponGun";

const LEGACY_UTILITY_TYPES = new Set([
  "dockingCollar",
  "salvageHead",
  "salvageModifier",
  "weaponMining",
]);

const KNOWN_VEHICLE_TYPES = new Set([
  "weaponGun",
  "powerplant",
  "shield",
  "cooler",
  "radar",
  "quantumdrive",
  "weaponMining",
  "salvageHead",
  "salvageModifier",
]);

const KNOWN_FPS_TYPES = new Set(["weapons", "armor"]);

export function getRecipeBrowserSearchParam(searchParams: URLSearchParams): string {
  return (searchParams.get("search") ?? searchParams.get("q") ?? "").trim();
}

export function buildRecipeBrowserSearchTokens(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function parseRecipeBrowserFilterSet(searchParams: URLSearchParams, key: string): Set<string> {
  const raw = searchParams.get(key);
  if (!raw) return new Set();
  return new Set(raw.split(",").filter(Boolean));
}

export function hasExplicitVehicleFilter(searchParams: URLSearchParams): boolean {
  const raw = searchParams.get("v");
  return raw !== null && raw !== "";
}

export function isRecipeBrowserDefaultState(searchParams: URLSearchParams): boolean {
  return !hasExplicitVehicleFilter(searchParams)
    && !getRecipeBrowserSearchParam(searchParams)
    && !searchParams.get("f")
    && !searchParams.get("sz")
    && !searchParams.get("gr")
    && !searchParams.get("cl")
    && !searchParams.get("mt")
    && searchParams.get("bk") !== "1";
}

export function matchesRecipeBrowserSearch(
  record: ComponentCardIndexRecord,
  queryTokens: string[],
): boolean {
  if (queryTokens.length === 0) return true;
  const haystack = typeof record.searchText === "string" ? record.searchText : "";
  return queryTokens.every((token) => haystack.includes(token));
}

function recordUsesMaterialFilter(
  record: ComponentCardIndexRecord,
  materialFilters: Set<string>,
): boolean {
  const materials = Array.isArray(record.facets?.materials) ? record.facets.materials : [];
  const materialNames = Array.isArray(record.facets?.materialNames) ? record.facets.materialNames : [];
  return materials.some((id) => materialFilters.has(id))
    || materialNames.some((name) => materialFilters.has(name));
}

export function matchesRecipeBrowserCategory(
  record: ComponentCardIndexRecord,
  vehicleFilters: Set<string>,
  fpsFilters: Set<string>,
): boolean {
  const hasCategoryFilters = vehicleFilters.size > 0 || fpsFilters.size > 0;
  if (!hasCategoryFilters) return false;

  if (record.kind === "fps") {
    const type = record.type ?? "";
    return fpsFilters.has(type)
      || (fpsFilters.has("__utility__") && type === "utility")
      || (fpsFilters.has("__other__") && !KNOWN_FPS_TYPES.has(type) && type !== "utility");
  }

  const type = record.type ?? "";
  return vehicleFilters.has(type)
    || (vehicleFilters.has("__mining__") && type === "weaponMining")
    || (vehicleFilters.has("__salvage__") && (type === "salvageHead" || type === "salvageModifier"))
    || (vehicleFilters.has("__other__") && !KNOWN_VEHICLE_TYPES.has(type))
    || (vehicleFilters.has("__utility__") && LEGACY_UTILITY_TYPES.has(type));
}

export function compareRecipeBrowserRecords(
  a: ComponentCardIndexRecord,
  b: ComponentCardIndexRecord,
): number {
  const typeA = a.sort?.type ?? a.type ?? "";
  const typeB = b.sort?.type ?? b.type ?? "";
  const typeCompare = typeA.localeCompare(typeB);
  if (typeCompare !== 0) return typeCompare;
  const nameA = a.sort?.name ?? a.name ?? "";
  const nameB = b.sort?.name ?? b.name ?? "";
  return nameA.localeCompare(nameB);
}

export type RecipeBrowserFilterOptions = {
  savedOnly?: boolean;
  savedBlueprintIds?: Set<string>;
};

export function matchesRecipeBrowserAppliedFilters(
  record: ComponentCardIndexRecord,
  searchParams: URLSearchParams,
  options: RecipeBrowserFilterOptions = {},
): boolean {
  const vehicleFilters = parseRecipeBrowserFilterSet(searchParams, "v");
  const fpsFilters = parseRecipeBrowserFilterSet(searchParams, "f");
  const sizeFilters = parseRecipeBrowserFilterSet(searchParams, "sz");
  const gradeFilters = parseRecipeBrowserFilterSet(searchParams, "gr");
  const classFilters = parseRecipeBrowserFilterSet(searchParams, "cl");
  const materialFilters = parseRecipeBrowserFilterSet(searchParams, "mt");
  const savedOnly = options.savedOnly ?? searchParams.get("bk") === "1";

  if (
    (vehicleFilters.size > 0 || fpsFilters.size > 0)
    && !matchesRecipeBrowserCategory(record, vehicleFilters, fpsFilters)
  ) {
    return false;
  }
  if (sizeFilters.size > 0) {
    const sizeKey = record.size !== null && record.size !== undefined ? String(record.size) : "";
    if (!sizeFilters.has(sizeKey)) return false;
  }
  if (gradeFilters.size > 0 && !gradeFilters.has(record.grade ?? "")) return false;
  if (classFilters.size > 0 && !classFilters.has((record.class ?? "").toLowerCase())) return false;
  if (materialFilters.size > 0 && !recordUsesMaterialFilter(record, materialFilters)) return false;
  if (savedOnly && options.savedBlueprintIds && !options.savedBlueprintIds.has(record.id)) return false;
  return true;
}

function searchNameRank(record: ComponentCardIndexRecord, query: string): number {
  const normalizedName = record.name.trim().toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedName === normalizedQuery) return 0;
  if (normalizedName.startsWith(normalizedQuery)) return 1;
  if (normalizedName.includes(normalizedQuery)) return 2;
  return 3;
}

export function compareRecipeBrowserSearchRecords(
  a: ComponentCardIndexRecord,
  b: ComponentCardIndexRecord,
  query: string,
): number {
  const nameRank = searchNameRank(a, query) - searchNameRank(b, query);
  if (nameRank !== 0) return nameRank;

  // When a weapon and its compatible magazine both satisfy the same weapon
  // search, the weapon is the useful default detail target.
  const weaponRankA = a.kind === "fps" && a.type === "weapons" ? 0 : a.type === "ammo" ? 1 : 0;
  const weaponRankB = b.kind === "fps" && b.type === "weapons" ? 0 : b.type === "ammo" ? 1 : 0;
  if (weaponRankA !== weaponRankB) return weaponRankA - weaponRankB;
  return compareRecipeBrowserRecords(a, b);
}

export function pickPreferredRecipeBrowserSearchRecord(
  records: ComponentCardIndexRecord[],
  query: string,
): ComponentCardIndexRecord | undefined {
  if (records.length === 0) return undefined;
  if (!query.trim()) return records[0];
  return [...records].sort((a, b) => compareRecipeBrowserSearchRecords(a, b, query))[0];
}

export function filterRecipeBrowserRecords(
  records: ComponentCardIndexRecord[],
  searchParams: URLSearchParams,
  options: RecipeBrowserFilterOptions = {},
): ComponentCardIndexRecord[] {
  if (!Array.isArray(records) || records.length === 0) return [];

  const isDefaultState = isRecipeBrowserDefaultState(searchParams);
  const vehicleFilters = parseRecipeBrowserFilterSet(searchParams, "v");
  const fpsFilters = parseRecipeBrowserFilterSet(searchParams, "f");
  const searchTokens = buildRecipeBrowserSearchTokens(getRecipeBrowserSearchParam(searchParams));
  const hasTextSearch = searchTokens.length > 0;
  const savedOnly = options.savedOnly ?? searchParams.get("bk") === "1";
  const savedBlueprintIds = options.savedBlueprintIds;

  if (hasTextSearch) {
    return records
      .filter((record) => Boolean(record?.id) && matchesRecipeBrowserSearch(record, searchTokens))
      .sort(compareRecipeBrowserRecords);
  }

  return records
    .filter((record) => {
      if (!record?.id) return false;
      if (savedOnly && savedBlueprintIds && !savedBlueprintIds.has(record.id)) return false;

      if (vehicleFilters.size > 0 || fpsFilters.size > 0) {
        if (!matchesRecipeBrowserCategory(record, vehicleFilters, fpsFilters)) return false;
      } else if (isDefaultState && record.type !== DEFAULT_VEHICLE_TYPE) {
        return false;
      } else if (record.kind === "fps" && !hasTextSearch) {
        // Preserve the current vehicle-first default while allowing search to span
        // both inventories when no category filter is selected.
        return false;
      }

      return matchesRecipeBrowserAppliedFilters(record, searchParams, {
        savedOnly,
        savedBlueprintIds,
      });
    })
    .sort(compareRecipeBrowserRecords);
}
