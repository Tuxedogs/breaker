import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";

export const DEFAULT_VEHICLE_TYPE = "weaponGun";

const UTILITY_TYPES = new Set([
  "dockingCollar",
  "salvageHead",
  "salvageModifier",
  "weaponMining",
]);

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

export function filterRecipeBrowserRecords(
  records: ComponentCardIndexRecord[],
  searchParams: URLSearchParams,
  options: RecipeBrowserFilterOptions = {},
): ComponentCardIndexRecord[] {
  if (!Array.isArray(records) || records.length === 0) return [];

  const isDefaultState = isRecipeBrowserDefaultState(searchParams);
  const vehicleFilters = parseRecipeBrowserFilterSet(searchParams, "v");
  const fpsFilters = parseRecipeBrowserFilterSet(searchParams, "f");
  const sizeFilters = parseRecipeBrowserFilterSet(searchParams, "sz");
  const gradeFilters = parseRecipeBrowserFilterSet(searchParams, "gr");
  const classFilters = parseRecipeBrowserFilterSet(searchParams, "cl");
  const materialFilters = parseRecipeBrowserFilterSet(searchParams, "mt");
  const searchTokens = buildRecipeBrowserSearchTokens(getRecipeBrowserSearchParam(searchParams));
  const hasTextSearch = searchTokens.length > 0;
  const savedOnly = options.savedOnly ?? searchParams.get("bk") === "1";
  const savedBlueprintIds = options.savedBlueprintIds;

  return records
    .filter((record) => {
      if (!record?.id) return false;
      if (savedOnly && savedBlueprintIds && !savedBlueprintIds.has(record.id)) return false;

      if (record.kind === "fps") {
        if (fpsFilters.size > 0) {
          if (!fpsFilters.has(record.type ?? "")) return false;
        } else if (vehicleFilters.size > 0 || isDefaultState || !hasTextSearch) {
          return false;
        }
      } else {
        if (fpsFilters.size > 0) return false;
        if (vehicleFilters.size > 0) {
          const type = record.type ?? "";
          const utilityMatch = vehicleFilters.has("__utility__") && UTILITY_TYPES.has(type);
          if (!vehicleFilters.has(type) && !utilityMatch) return false;
        } else if (isDefaultState) {
          if (record.type !== DEFAULT_VEHICLE_TYPE) return false;
        }
      }

      if (sizeFilters.size > 0) {
        const sizeKey = record.size !== null && record.size !== undefined ? String(record.size) : "";
        if (!sizeFilters.has(sizeKey)) return false;
      }
      if (gradeFilters.size > 0 && !gradeFilters.has(record.grade ?? "")) return false;
      if (classFilters.size > 0 && !classFilters.has((record.class ?? "").toLowerCase())) return false;
      if (materialFilters.size > 0 && !recordUsesMaterialFilter(record, materialFilters)) return false;
      if (!matchesRecipeBrowserSearch(record, searchTokens)) return false;
      return true;
    })
    .sort(compareRecipeBrowserRecords);
}
