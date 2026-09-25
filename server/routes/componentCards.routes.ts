import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { getComponentCardsRoot } from "../config/componentCardsRoot.js";
import { resolveDataset } from "../fitting/datasetResolver.js";
import { loadRegistry } from "../fitting/registryStore.js";
import { loadCraftingBlueprintSourceGuidSet } from "./craftingBlueprintSources.routes.js";

type RouteResult = { status: number; body: unknown };

type BrowserRecord = Record<string, unknown> & {
  id?: string;
  name?: string;
  kind?: string;
  type?: string;
  size?: number | null;
  grade?: string | null;
  class?: string | null;
  searchText?: string;
  facets?: { materials?: unknown; materialNames?: unknown };
  sort?: { name?: string; type?: string };
};

type ComponentCardsIndex = {
  schemaVersion: 1;
  generatedAt?: string;
  sourceGeneratedAt?: string;
  sourceRecordCount?: {
    vehicle?: number;
    fps?: number;
    total?: number;
  };
  shapedRecordCount?: number;
  missingIdCount?: number;
  duplicateIdCount?: number;
  skippedCount?: number;
  warnings?: string[];
  recordFiles: Record<string, string>;
};

const cardsRoot = getComponentCardsRoot();

let indexCache: Promise<ComponentCardsIndex> | null = null;
let indexModifiedAt = 0;
let browseCache: Promise<unknown> | null = null;
let browseModifiedAt = 0;
let facetsCache: Promise<unknown> | null = null;
let facetsModifiedAt = 0;

function parseRouteUrl(rawUrl: string): URL {
  return new URL(rawUrl, "http://localhost");
}

function normalizeGuid(value: string): string {
  return value.trim().toLowerCase();
}

function isGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function readJson<T>(relativePath: string): Promise<T> {
  const filePath = path.resolve(cardsRoot, relativePath);
  const relativeToRoot = path.relative(cardsRoot, filePath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("Invalid component card data path.");
  }
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function loadIndex(): Promise<ComponentCardsIndex> {
  const indexPath = path.join(cardsRoot, "index.json");
  const modifiedAt = (await stat(indexPath)).mtimeMs;
  if (!indexCache || modifiedAt !== indexModifiedAt) {
    indexModifiedAt = modifiedAt;
    indexCache = readJson<ComponentCardsIndex>("index.json");
  }
  return indexCache;
}

async function loadBrowse(): Promise<unknown> {
  const browsePath = path.join(cardsRoot, "browse.json");
  const modifiedAt = (await stat(browsePath)).mtimeMs;
  if (!browseCache || modifiedAt !== browseModifiedAt) {
    browseModifiedAt = modifiedAt;
    browseCache = readJson("browse.json");
  }
  return browseCache;
}

function normalizedIdentity(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().toLowerCase()
    : null;
}

function deliveredNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function enrichComponentCardBrowseWithShipWeapons(
  browse: unknown,
  shipWeapons: Array<Record<string, unknown>>,
): unknown {
  if (!browse || typeof browse !== "object") return browse;

  const payload = browse as Record<string, unknown>;
  if (!Array.isArray(payload.records)) return browse;

  const weaponByIdentity = new Map<string, Record<string, unknown>>();
  for (const weapon of shipWeapons) {
    const identity = normalizedIdentity(weapon.entityClass);
    if (identity) weaponByIdentity.set(identity, weapon);
  }

  let changed = false;
  const records = payload.records.map((candidate) => {
    if (!candidate || typeof candidate !== "object") return candidate;
    const record = candidate as Record<string, unknown>;
    const identity = normalizedIdentity(record.entityClass);
    const weapon = identity ? weaponByIdentity.get(identity) : undefined;
    const stats = record.stats;
    if (!weapon || !stats || typeof stats !== "object") return candidate;

    const shipWeapon = (stats as Record<string, unknown>).shipWeapon;
    if (!shipWeapon || typeof shipWeapon !== "object") return candidate;

    const maxAmmoLoad = deliveredNumber(weapon.maxAmmoLoad);
    const penetrationDistance = deliveredNumber(weapon.basePenetrationDistance);
    if (maxAmmoLoad === undefined && penetrationDistance === undefined) return candidate;

    changed = true;
    return {
      ...record,
      stats: {
        ...(stats as Record<string, unknown>),
        shipWeapon: {
          ...(shipWeapon as Record<string, unknown>),
          ...(maxAmmoLoad !== undefined ? { maxAmmoLoad } : {}),
          ...(penetrationDistance !== undefined ? { penetrationDistance } : {}),
        },
      },
    };
  });

  return changed ? { ...payload, records } : browse;
}

async function loadEnrichedBrowse(): Promise<unknown> {
  const browse = await loadBrowse();
  try {
    const selection = await resolveDataset(new URLSearchParams());
    const shipWeapons = await loadRegistry(selection, "ship_weapons.json");
    return enrichComponentCardBrowseWithShipWeapons(browse, shipWeapons.records);
  } catch {
    return browse;
  }
}

async function loadFacets(): Promise<unknown> {
  const facetsPath = path.join(cardsRoot, "facets.json");
  const modifiedAt = (await stat(facetsPath)).mtimeMs;
  if (!facetsCache || modifiedAt !== facetsModifiedAt) {
    facetsModifiedAt = modifiedAt;
    facetsCache = readJson("facets.json");
  }
  return facetsCache;
}

function methodNotAllowed(): RouteResult {
  return { status: 405, body: { error: "Method not allowed" } };
}

const vehicleTypeAliases = new Map([
  ["weapongun", "weaponGun"], ["vehicleweapon", "weaponGun"], ["vehicleweapons", "weaponGun"],
  ["shipweapon", "weaponGun"], ["shipweapons", "weaponGun"], ["powerplant", "powerplant"],
  ["shield", "shield"], ["cooler", "cooler"], ["radar", "radar"], ["quantumdrive", "quantumdrive"],
  ["weaponmining", "weaponMining"], ["salvagehead", "salvageHead"], ["salvagemodifier", "salvageModifier"],
]);
const fpsTypeAliases = new Map([["weapon", "weapons"], ["weapons", "weapons"], ["armor", "armor"], ["armors", "armor"], ["ammo", "ammo"], ["utility", "utility"]]);
const knownVehicleTypes = new Set(["weaponGun", "powerplant", "shield", "cooler", "radar", "quantumdrive", "weaponMining", "salvageHead", "salvageModifier"]);
const knownFpsTypes = new Set(["weapons", "armor"]);
const vehicleFilterValues = new Set(["weaponGun", "powerplant", "shield", "cooler", "radar", "quantumdrive", "__mining__", "__salvage__", "__other__"]);
const fpsFilterValues = new Set(["weapons", "armor", "__utility__", "__other__"]);
const sizeFilterValues = new Set(["1", "2", "3", "4", "5", "6"]);
const gradeFilterValues = new Set(["A", "B", "C", "D"]);
const classFilterValues = new Set(["military", "stealth", "civilian", "industrial", "competition"]);

function csvValues(url: URL, key: string): Set<string> {
  return new Set((url.searchParams.get(key) ?? "").split(",").map((value) => value.trim()).filter(Boolean));
}

function normalizedCategoryType(kind: string | undefined, value: string | undefined): string {
  if (value?.startsWith("__")) return value;
  const normalized = (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return (kind === "vehicle" ? vehicleTypeAliases : fpsTypeAliases).get(normalized) ?? value?.trim() ?? "";
}

function categoryFilterValues(url: URL, key: "v" | "f"): Set<string> {
  const kind = key === "v" ? "vehicle" : "fps";
  const allowed = key === "v" ? vehicleFilterValues : fpsFilterValues;
  return new Set([...csvValues(url, key)]
    .map((value) => normalizedCategoryType(kind, value))
    .filter((value) => allowed.has(value)));
}

function validValues(url: URL, key: string, allowed: ReadonlySet<string>): Set<string> {
  return new Set([...csvValues(url, key)].filter((value) => allowed.has(value)));
}

function matchesBrowserQuery(record: BrowserRecord, url: URL, materialFilterValues: ReadonlySet<string>): boolean {
  const savedIds = csvValues(url, "saved");
  if (url.searchParams.get("bk") === "1" && !savedIds.has(record.id ?? "")) return false;
  const vehicleFilters = categoryFilterValues(url, "v");
  const fpsFilters = categoryFilterValues(url, "f");
  if (vehicleFilters.size || fpsFilters.size) {
    const type = normalizedCategoryType(record.kind, record.type);
    const categoryMatch = record.kind === "fps"
      ? fpsFilters.has(type) || (fpsFilters.has("__utility__") && type === "utility") || (fpsFilters.has("__other__") && !knownFpsTypes.has(type) && type !== "utility")
      : vehicleFilters.has(type) || (vehicleFilters.has("__mining__") && type === "weaponMining") || (vehicleFilters.has("__salvage__") && (type === "salvageHead" || type === "salvageModifier")) || (vehicleFilters.has("__other__") && !knownVehicleTypes.has(type));
    if (!categoryMatch) return false;
  }

  const sizeFilters = validValues(url, "sz", sizeFilterValues);
  if (sizeFilters.size && !sizeFilters.has(record.size == null ? "" : String(record.size))) return false;
  const gradeFilters = validValues(url, "gr", gradeFilterValues);
  if (gradeFilters.size && !gradeFilters.has(record.grade ?? "")) return false;
  const classFilters = validValues(url, "cl", classFilterValues);
  if (classFilters.size && !classFilters.has((record.class ?? "").toLowerCase())) return false;
  const materialFilters = validValues(url, "mt", materialFilterValues);
  if (materialFilters.size) {
    const facets = record.facets;
    const values = [
      ...(Array.isArray(facets?.materials) ? facets.materials : []),
      ...(Array.isArray(facets?.materialNames) ? facets.materialNames : []),
    ].filter((value): value is string => typeof value === "string");
    if (!values.some((value) => materialFilters.has(value))) return false;
  }

  const search = (url.searchParams.get("search") ?? url.searchParams.get("q") ?? "").trim().toLowerCase();
  const tokens = search.split(/\s+/).filter(Boolean);
  return tokens.every((token) => (record.searchText ?? "").includes(token));
}

function compareBrowserRecords(a: BrowserRecord, b: BrowserRecord, search: string): number {
  const nameRank = (record: BrowserRecord) => {
    const name = (record.name ?? "").trim().toLowerCase();
    if (!search) return 0;
    if (name === search) return 0;
    if (name.startsWith(search)) return 1;
    if (name.includes(search)) return 2;
    return 3;
  };
  if (search) {
    const rank = nameRank(a) - nameRank(b);
    if (rank) return rank;
    const weaponRank = (record: BrowserRecord) => record.kind === "fps" && record.type === "weapons" ? 0 : record.type === "ammo" ? 1 : 0;
    const weapon = weaponRank(a) - weaponRank(b);
    if (weapon) return weapon;
  }
  const type = String(a.sort?.type ?? a.type ?? "").localeCompare(String(b.sort?.type ?? b.type ?? ""));
  return type || String(a.sort?.name ?? a.name ?? "").localeCompare(String(b.sort?.name ?? b.name ?? ""));
}

function variantGroupKey(record: BrowserRecord): string | null {
  if (record.kind !== "fps") return null;
  const baseName = (record.name ?? "").replace(/\s*"[^"]+"\s*/g, " ").replace(/\s+/g, " ").trim();
  return baseName ? `${baseName.toLowerCase()}::${record.type ?? ""}::${record.kind}` : null;
}

function pickVariantRepresentative(records: BrowserRecord[]): BrowserRecord {
  return records.find((record) => !/"\w/.test(record.name ?? ""))
    ?? records.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)))[0]!;
}

function browserSummary(record: BrowserRecord): BrowserRecord {
  const { searchText: _searchText, searchTokens: _searchTokens, description: _description, descriptionSourceKey: _descriptionSourceKey, materials: _materials, source: _source, card: _card, ...summary } = record;
  return summary;
}

async function loadBrowserPage(url: URL): Promise<unknown> {
  const [browse, eligibleBlueprintGuids, facets] = await Promise.all([loadEnrichedBrowse(), loadCraftingBlueprintSourceGuidSet(), loadFacets()]);
  const payload = browse as { generatedAt?: string; records?: BrowserRecord[] };
  const materialFilterValues = new Set((payload.records ?? []).flatMap((record) => [
    ...(Array.isArray(record.facets?.materials) ? record.facets.materials : []),
    ...(Array.isArray(record.facets?.materialNames) ? record.facets.materialNames : []),
  ]).filter((value): value is string => typeof value === "string"));
  const search = (url.searchParams.get("search") ?? url.searchParams.get("q") ?? "").trim().toLowerCase();
  const matched = (payload.records ?? [])
    .filter((record) => typeof record.id === "string" && eligibleBlueprintGuids.has(normalizeGuid(record.id)) && matchesBrowserQuery(record, url, materialFilterValues));
  const groups = new Map<string, BrowserRecord[]>();
  const ungrouped: BrowserRecord[] = [];
  for (const record of matched) {
    const key = variantGroupKey(record);
    if (!key) ungrouped.push(record);
    else groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  const grouped = [...ungrouped, ...[...groups.values()].map(pickVariantRepresentative)].sort((a, b) => compareBrowserRecords(a, b, search));
  const requestedPage = Math.max(1, Number(url.searchParams.get("pg") ?? "1") || 1);
  const requestedLimit = Math.max(1, Math.min(40, Number(url.searchParams.get("limit") ?? "40") || 40));
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(grouped.length / requestedLimit)));
  const offset = (page - 1) * requestedLimit;
  const pageRecords = grouped.slice(offset, offset + requestedLimit);
  const familyRecipeIdsById = Object.fromEntries(pageRecords.map((record) => {
    const familyIds = record.familyKey
      ? (payload.records ?? [])
        .filter((candidate) => candidate.kind === record.kind && candidate.type === record.type && candidate.familyKey === record.familyKey && typeof candidate.id === "string" && eligibleBlueprintGuids.has(normalizeGuid(candidate.id)))
        .map((candidate) => candidate.id!)
      : [record.id!];
    return [record.id!, familyIds];
  }));
  const supportingRecord = (payload.records ?? []).find((record) => record.type === "weapons" && /P6-LR\s+"Blacklist"/i.test(record.name ?? ""));
  return {
    schemaVersion: 1,
    generatedAt: payload.generatedAt,
    facets,
    totalRecords: grouped.length,
    page,
    limit: requestedLimit,
    records: pageRecords.map(browserSummary),
    supportingRecords: supportingRecord ? [browserSummary(supportingRecord)] : [],
    familyRecipeIdsById,
  };
}

export async function handleComponentCardsRoute(
  method: string,
  rawUrl: string,
): Promise<RouteResult | null> {
  const url = parseRouteUrl(rawUrl);
  const pathName = url.pathname;

  if (pathName === "/api/crafting/component-cards/index") {
    if (method !== "GET") return methodNotAllowed();
    const index = await loadIndex();
    return {
      status: 200,
      body: {
        schemaVersion: 1,
        generatedAt: index.generatedAt,
        sourceGeneratedAt: index.sourceGeneratedAt,
        sourceRecordCount: index.sourceRecordCount ?? {},
        shapedRecordCount: index.shapedRecordCount ?? 0,
        missingIdCount: index.missingIdCount ?? 0,
        duplicateIdCount: index.duplicateIdCount ?? 0,
        skippedCount: index.skippedCount ?? 0,
        warnings: index.warnings ?? [],
        recordIds: Object.keys(index.recordFiles),
      },
    };
  }

  if (pathName === "/api/crafting/component-cards/facets") {
    if (method !== "GET") return methodNotAllowed();
    return { status: 200, body: await loadFacets() };
  }

  if (pathName === "/api/crafting/component-cards/browse") {
    if (method !== "GET") return methodNotAllowed();
    return { status: 200, body: await loadEnrichedBrowse() };
  }

  if (pathName === "/api/crafting/component-cards/browser") {
    if (method !== "GET") return methodNotAllowed();
    return { status: 200, body: await loadBrowserPage(url) };
  }

  const recordMatch = pathName.match(/^\/api\/crafting\/component-cards\/([^/]+)$/);
  if (recordMatch) {
    if (method !== "GET") return methodNotAllowed();
    const recordId = normalizeGuid(decodeURIComponent(recordMatch[1] ?? ""));
    if (!recordId || !isGuid(recordId)) {
      return { status: 400, body: { error: "Invalid component card id." } };
    }
    const index = await loadIndex();
    const file = index.recordFiles[recordId];
    if (!file) return { status: 404, body: { error: "Component card not found." } };
    return { status: 200, body: await readJson(file) };
  }

  return null;
}
