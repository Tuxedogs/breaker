import { apiUrl } from "../../lib/apiUrl";
import { parseJsonResponse } from "../../lib/safeJson";
import type { PublicLocationEntry } from "./types";
import { canonicalMiningMaterial, canonicalMiningMaterialKey } from "./materialIdentity";

export type StaticLocationMaterialRow = {
  materialId: string;
  materialName: string;
  system: string;
  systemKey: string;
  systemDisplayName: string;
  location: string;
  locationKey: string;
  locationDisplayName: string;
  parents: string[];
  parentDisplayNames: string[];
  resolvedMineableClass: "Orbitborne" | "Shipborne" | "Geoborne" | "Handborne" | "Harvestable" | "Unclassified" | string;
  sourceCount: number;
  sourceProbabilitySum: number;
  sourceProbabilityMax: number;
  compositionAveragePercentage: number | null;
  qualityThresholdChancesWeighted: Record<string, number>;
  qualityOverrideApplied: boolean;
  qualityOverrideRecordNames: string[];
  qualityDistributionSourceNames: string[];
  locationClassDistributionShare: number;
  encounterScore: number;
  primaryRockShare?: number | null;
  materialEncounterScore?: number | null;
  candidateMaterialEncounterRank?: number | null;
  candidateMaterialEncounterRankOutOf?: number | null;
  methodFit?: number | null;
  materialBiasSignal?: number | null;
  providerWeightedSignal?: number | null;
  traceMaterials?: string[];
  traceMaterialDetails?: Array<{
    materialId?: string;
    materialName?: string;
    minPercentage?: number;
    maxPercentage?: number;
    probability?: number;
    qualityScale?: number;
    qualityFloor?: number;
    qualityCeiling?: number;
  }>;
  sources?: Array<{
    materialKey?: string;
    materialId?: string;
    materialName?: string;
    spawnType?: string;
    groupName?: string;
    sourceProbability?: number;
    relativeProbability?: number;
    groupProbability?: number;
    materialProbability?: number;
    traceMaterials?: string[];
    traceMaterialDetails?: Array<{
      materialId?: string;
      materialName?: string;
      minPercentage?: number;
      maxPercentage?: number;
      probability?: number;
      qualityScale?: number;
      qualityFloor?: number;
      qualityCeiling?: number;
    }>;
    quality?: {
      min?: number;
      max?: number;
    };
  }>;
};

export type StaticLocationDistributionRow = {
  system?: string;
  systemKey?: string;
  systemDisplayName?: string;
  location?: string;
  locationKey?: string;
  locationDisplayName?: string;
  resolvedMineableClass?: string;
  mineableClass?: string;
  miningMethod?: string;
  method?: string;
  locationClassDistributionShare?: number;
  distributionShare?: number;
  share?: number;
  methodShares?: Record<string, number>;
  miningMix?: Record<string, number>;
  classDistribution?: Record<string, number>;
  distribution?: Record<string, number>;
  probabilityTotals?: Record<string, number>;
  edgeCounts?: Record<string, number>;
};

export type StaticMaterialQualityRow = {
  materialId?: string;
  materialKey?: string;
  materialName?: string;
  system?: string;
  systemKey?: string;
  location?: string;
  locationKey?: string;
  resolvedMineableClass?: string;
  thresholdChances?: Record<string, number>;
  qualityThresholdChancesWeighted?: Record<string, number>;
  qualitySourceScope?: string;
  qualitySourceFamily?: string;
  qualityDistributionSourceName?: string;
  qualityDistributionSourceNames?: string[];
  qualityOverrideApplied?: boolean;
};

export type StaticLocationHierarchyIndex = {
  lagrangeGroups?: unknown[];
  locationParents?: Record<string, string[]>;
  locationParentDisplayNames?: Record<string, string[]>;
};

export type StaticMaterialEncounterRankingRow = StaticLocationMaterialRow & {
  encounterRank: number;
  encounterRankOutOf: number;
};

export type StaticMiningMaterialResource = {
  id: string;
  label: string;
  miningType?: string;
};

export type StaticMiningIndex = {
  rows: StaticLocationMaterialRow[];
  rankings: StaticMaterialEncounterRankingRow[];
  resourcesByLocationJoinKey: Map<string, StaticLocationMaterialRow[]>;
  materialKeysByLocationJoinKey: Map<string, string[]>;
  locationKeysByDisplayName: Map<string, string[]>;
  materialResources: StaticMiningMaterialResource[];
  rankingByRowKey: Map<string, StaticMaterialEncounterRankingRow>;
  encounterScoreRangeByMaterialKey: Map<string, { min: number; max: number }>;
  materialEncounterScoreRangeByMaterialKey: Map<string, { min: number; max: number }>;
  distributionRows: StaticLocationDistributionRow[];
  distributionByLocationJoinKey: Map<string, StaticLocationDistributionRow[]>;
  qualityRows: StaticMaterialQualityRow[];
  qualityByRowKey: Map<string, StaticMaterialQualityRow>;
  locationHierarchy: StaticLocationHierarchyIndex | null;
};

const LOCATION_INDEX_URL = "/api/mining/location-materials";
const MATERIAL_RANKINGS_URL = "/api/mining/encounter-rankings";
const MATERIAL_QUALITY_INDEX_URL = "/api/mining/material-quality";
const LOCATION_DISTRIBUTION_INDEX_URL = "/api/mining/location-distribution";
const LOCATION_HIERARCHY_INDEX_URL = "/api/mining/location-hierarchy";

let resolvedCache: StaticMiningIndex | null = null;
let loadPromise: Promise<StaticMiningIndex> | null = null;

function normalizeExact(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeLoose(value: string | null | undefined): string {
  return normalizeExact(value).replace(/[_-]+/g, "");
}

function compactJoinKey(systemKey: string | null | undefined, locationKey: string | null | undefined): string {
  return `${normalizeExact(systemKey)}::${normalizeExact(locationKey)}`;
}

function looseJoinKey(systemKey: string | null | undefined, locationKey: string | null | undefined): string {
  return `${normalizeLoose(systemKey)}::${normalizeLoose(locationKey)}`;
}

function splitLocationCandidate(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim();
  if (!normalized) return null;
  const parts = normalized.split("::");
  const withoutNamespace = parts.length > 1 ? parts[parts.length - 1] : normalized;
  const pipeParts = withoutNamespace.split("|");
  return pipeParts.length > 1 ? pipeParts[pipeParts.length - 1] : withoutNamespace;
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function pushLookupValue(map: Map<string, string[]>, source: string | null | undefined, value: string | null | undefined): void {
  const key = normalizeExact(source);
  const rawValue = value?.trim();
  if (!key || !rawValue) return;
  const values = map.get(key) ?? [];
  if (!values.includes(rawValue)) values.push(rawValue);
  map.set(key, values);
}

function buildLocationKeysByDisplayName(rows: StaticLocationMaterialRow[]): Map<string, string[]> {
  const lookup = new Map<string, string[]>();
  for (const row of rows) {
    const rawLocationKey = row.locationKey || row.location;
    pushLookupValue(lookup, row.locationDisplayName, rawLocationKey);
    pushLookupValue(lookup, row.location, rawLocationKey);
    pushLookupValue(lookup, row.locationKey, rawLocationKey);
  }
  return lookup;
}

function getParentheticalLocationParts(value: string | null | undefined): string[] {
  const normalized = (value ?? "").trim();
  if (!normalized) return [];
  const match = normalized.match(/^(.*?)\s*\((.*?)\)\s*$/);
  if (!match) return [];
  return unique([match[1], match[2]]);
}

function resolvePyroRomanLocation(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim();
  const match = normalized.match(/^pyro\s+(iv|vi|iii|ii|i|v)(?:-([a-z]))?(?:\s|$|\()/i);
  if (!match) return null;
  const romanToNumber: Record<string, string> = {
    i: "1",
    ii: "2",
    iii: "3",
    iv: "4",
    v: "5",
    vi: "6",
  };
  const number = romanToNumber[match[1].toLowerCase()];
  if (!number) return null;
  const moonSuffix = match[2] ? match[2].toLowerCase() : "";
  return `Pyro${number}${moonSuffix}`;
}

function getDisplayLookupValues(value: string | null | undefined, index: StaticMiningIndex | null | undefined): string[] {
  if (!index) return [];
  return index.locationKeysByDisplayName.get(normalizeExact(value)) ?? [];
}

export function getStaticLocationJoinKey(systemKey: string, locationKey: string): string {
  return compactJoinKey(systemKey, locationKey);
}

export function getEntryLocationJoinKey(entry: PublicLocationEntry): string {
  const extended = entry as PublicLocationEntry & {
    systemKey?: string;
    locationDisplayName?: string;
  };
  const system = extended.systemKey ?? entry.systemName;
  const location = splitLocationCandidate(entry.locationKey) ?? entry.locationName;
  return compactJoinKey(system, location);
}

export function getStaticMaterialKey(row: StaticLocationMaterialRow): string {
  return canonicalMiningMaterial({
    materialKey: row.sources?.[0]?.materialKey,
    materialId: row.materialId,
    materialName: row.materialName,
    displayName: row.materialName,
  }).key;
}

export function displayMineableClass(value: string | null | undefined): string {
  switch (value) {
    case "Orbitborne":
      return "Space / Asteroid";
    case "Shipborne":
      return "Surface Ship";
    case "Geoborne":
      return "Vehicle";
    case "Handborne":
      return "Hand";
    case "Harvestable":
      return "Harvestable";
    case "Unclassified":
    case "":
    case undefined:
    case null:
      return "Unclassified";
    default:
      return value;
  }
}

export function displayMiningMethod(value: string | null | undefined): string {
  switch (value) {
    case "Ground Vehicle":
    case "Vehicle":
      return "Vehicle";
    case "Ship":
    case "Surface":
    case "Surface Ship":
      return "Surface Ship";
    case "Space":
    case "Asteroid":
      return "Space";
    case "Hand":
      return "Hand";
    default:
      return displayMineableClass(value);
  }
}

export function miningChipTypeFromMineableClass(value: string | null | undefined): string {
  switch (value) {
    case "Geoborne":
      return "Ground Vehicle";
    case "Handborne":
      return "Hand";
    case "Orbitborne":
    case "Shipborne":
    case "Harvestable":
    case "Unclassified":
    default:
      return "Ship";
  }
}

export function formatStaticQualityChance(row: StaticLocationMaterialRow, threshold = "800"): string {
  const chance = row.qualityThresholdChancesWeighted?.[threshold];
  return typeof chance === "number" && Number.isFinite(chance) ? `${Math.round(chance * 100)}%` : "Unknown";
}

export function formatStaticQualityChanceFromChances(chances: Record<string, number> | null | undefined, threshold = "800"): string {
  const chance = chances?.[threshold];
  return typeof chance === "number" && Number.isFinite(chance) ? `${Math.round(chance * 100)}%` : "Unknown";
}

export function formatStaticQualityChanceDecimalBelow1(chances: Record<string, number> | null | undefined, threshold: string): string {
  const chance = chances?.[threshold];
  if (typeof chance !== "number" || !Number.isFinite(chance)) return "Unknown";
  const pct = chance * 100;
  return pct < 1 ? `${Number(pct.toFixed(2)).toString()}%` : `${Math.round(pct)}%`;
}

export function formatStaticEncounterSignal(row: StaticLocationMaterialRow): string {
  const value = Number.isFinite(row.materialEncounterScore) ? row.materialEncounterScore : Number.isFinite(row.encounterScore) ? row.encounterScore : row.sourceProbabilitySum;
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unknown";
  return value >= 0.01 ? Number(value.toFixed(3)).toString() : value.toExponential(2);
}

export function formatStaticMethodFit(row: StaticLocationMaterialRow): string {
  const value = row.methodFit ?? row.locationClassDistributionShare;
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unknown";
  return `${Number((value * 100).toFixed(1)).toString()}%`;
}

export function formatStaticMethodBias(row: StaticLocationMaterialRow): string {
  return formatStaticMethodFit(row);
}

export function getStaticDensityScore(row: StaticLocationMaterialRow, index: StaticMiningIndex | null | undefined): number | null {
  const key = getStaticMaterialKey(row);
  const actualScore = row.materialEncounterScore ?? row.encounterScore;
  if (!Number.isFinite(actualScore)) return null;
  const range = index?.materialEncounterScoreRangeByMaterialKey.get(key)
    ?? index?.encounterScoreRangeByMaterialKey.get(key);
  if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max)) return null;
  if (range.max <= range.min) return actualScore > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, ((actualScore - range.min) / (range.max - range.min)) * 100));
}

export function sourceStrengthFromEncounterRank(rank: number | null | undefined, rankOutOf: number | null | undefined): "STRONG" | "MODERATE" | "LOW" | null {
  if (!rank || !rankOutOf || rankOutOf <= 0) return null;
  const sourceWeight = ((rankOutOf - rank + 1) / rankOutOf) * 100;
  if (sourceWeight >= 67) return "STRONG";
  if (sourceWeight >= 34) return "MODERATE";
  return "LOW";
}

export function sourceStrengthFromWeight(sourceWeight: number | null | undefined): "STRONG" | "MODERATE" | "LOW" | "INDEXED" {
  if (sourceWeight === null || sourceWeight === undefined || !Number.isFinite(sourceWeight)) return "INDEXED";
  if (sourceWeight >= 67) return "STRONG";
  if (sourceWeight >= 34) return "MODERATE";
  return "LOW";
}

export function sourceWeightFromEncounterRank(rank: number | null | undefined, rankOutOf: number | null | undefined): number | undefined {
  if (!rank || !rankOutOf || rankOutOf <= 0) return undefined;
  return ((rankOutOf - rank + 1) / rankOutOf) * 100;
}

export function getStaticRowRankingKey(row: Pick<StaticLocationMaterialRow, "materialId" | "materialName" | "systemKey" | "locationKey" | "resolvedMineableClass">): string {
  const materialPart = canonicalMiningMaterialKey(row.materialId) || canonicalMiningMaterialKey(row.materialName);
  return [
    materialPart,
    normalizeExact(row.materialName),
    normalizeExact(row.systemKey),
    normalizeExact(row.locationKey),
    normalizeExact(row.resolvedMineableClass),
  ].join("::");
}

export function getStaticEncounterRankingRow(row: StaticLocationMaterialRow, index: StaticMiningIndex | null | undefined): StaticMaterialEncounterRankingRow | null {
  if (!index) return null;
  const sourceMaterialKey = row.sources?.find((source) => source.materialKey)?.materialKey;
  const materialCandidates = unique([
    row.materialId,
    sourceMaterialKey,
    row.materialName,
  ]);
  for (const materialId of materialCandidates) {
    const match = index.rankingByRowKey.get(getStaticRowRankingKey({ ...row, materialId }));
    if (match) return match;
  }
  return null;
}

function getStaticQualityRowKeys(row: StaticMaterialQualityRow): string[] {
  const materialCandidates = unique([
    row.materialId,
    row.materialKey,
    row.materialName,
  ]).map(canonicalMiningMaterialKey).filter(Boolean);
  const location = row.locationKey ?? row.location;
  const keys: string[] = [];
  for (const materialPart of materialCandidates) {
    keys.push([
      materialPart,
      normalizeExact(row.materialName),
      normalizeExact(row.systemKey ?? row.system),
      normalizeExact(location),
      normalizeExact(row.resolvedMineableClass),
    ].join("::"));
  }
  return [...new Set(keys)];
}

export function getStaticMaterialQualityRow(row: StaticLocationMaterialRow, index: StaticMiningIndex | null | undefined): StaticMaterialQualityRow | null {
  if (!index) return null;
  const sourceMaterialKey = row.sources?.find((source) => source.materialKey)?.materialKey;
  const candidates: StaticMaterialQualityRow[] = [
    {
      materialKey: sourceMaterialKey,
      materialId: row.materialId,
      materialName: row.materialName,
      systemKey: row.systemKey,
      locationKey: row.locationKey,
      resolvedMineableClass: row.resolvedMineableClass,
    },
    {
      materialId: row.materialId,
      materialName: row.materialName,
      systemKey: row.systemKey,
      locationKey: row.locationKey,
      resolvedMineableClass: row.resolvedMineableClass,
    },
  ];
  for (const candidate of candidates) {
    for (const key of getStaticQualityRowKeys(candidate)) {
      const match = index.qualityByRowKey.get(key);
      if (match) return match;
    }
  }
  return null;
}

function addLocationAliases(map: Map<string, StaticLocationMaterialRow[]>, row: StaticLocationMaterialRow, rows: StaticLocationMaterialRow[]): void {
  for (const key of [
    compactJoinKey(row.systemKey, row.locationKey),
    compactJoinKey(row.system, row.location),
    looseJoinKey(row.systemKey, row.locationKey),
    looseJoinKey(row.system, row.location),
  ]) {
    if (key !== "::") map.set(key, rows);
  }
}

function addDistributionAliases(map: Map<string, StaticLocationDistributionRow[]>, row: StaticLocationDistributionRow, rows: StaticLocationDistributionRow[]): void {
  for (const key of [
    compactJoinKey(row.systemKey, row.locationKey),
    compactJoinKey(row.system, row.location),
    looseJoinKey(row.systemKey, row.locationKey),
    looseJoinKey(row.system, row.location),
  ]) {
    if (key !== "::") map.set(key, rows);
  }
}

function getEntryJoinKeys(entry: PublicLocationEntry, index?: StaticMiningIndex | null): string[] {
  const extended = entry as PublicLocationEntry & {
    systemKey?: string;
    locationId?: string;
    sourceLocationId?: string;
    systemLocationId?: string;
  };
  const systems = unique([extended.systemKey, entry.systemName]);
  const rawLocations = unique([
    entry.locationKey,
    entry.locationName,
    extended.locationId,
    extended.sourceLocationId,
    extended.systemLocationId,
    ...(entry.matchedLocationCodes ?? []),
  ]);
  const strippedLocations = unique(rawLocations.map(splitLocationCandidate));
  const parentheticalLocations = unique(strippedLocations.flatMap(getParentheticalLocationParts));
  const displayLookupLocations = unique([
    ...strippedLocations.flatMap((location) => getDisplayLookupValues(location, index)),
    ...parentheticalLocations.flatMap((location) => getDisplayLookupValues(location, index)),
  ]);
  const pyroCanonicalLocations = normalizeExact(systems[0]) === "pyro"
    ? unique([
      ...strippedLocations.map(canonicalPyroLocationName),
      ...parentheticalLocations.map(canonicalPyroLocationName),
    ])
    : [];
  const romanLocations = unique([
    ...strippedLocations.map(resolvePyroRomanLocation),
    ...parentheticalLocations.map(resolvePyroRomanLocation),
  ]);
  const exactLocations = unique([
    ...rawLocations,
    ...strippedLocations,
    ...pyroCanonicalLocations,
    ...displayLookupLocations,
    ...romanLocations,
    ...parentheticalLocations,
    ...parentheticalLocations.flatMap((location) => getDisplayLookupValues(location, index)),
    ...parentheticalLocations.map(resolvePyroRomanLocation),
  ]);
  const exact = systems.flatMap((system) => exactLocations.map((location) => compactJoinKey(system, location)));
  const loose = systems.flatMap((system) => exactLocations.map((location) => looseJoinKey(system, location)));
  return [...new Set([...exact, ...loose])].filter((key) => key !== "::");
}

function warnNoStaticLocationMatch(entry: PublicLocationEntry, attemptedJoinKeys: string[], index: StaticMiningIndex): void {
  if (!import.meta.env.DEV) return;
  console.warn("[mining] no static mining rows matched location", {
    systemName: entry.systemName,
    locationKey: entry.locationKey,
    locationName: entry.locationName,
    attemptedJoinKeys,
    availableStaticKeysSample: [...index.resourcesByLocationJoinKey.keys()].slice(0, 20),
  });
}

export function getStaticResourcesForLocation(entry: PublicLocationEntry, index: StaticMiningIndex | null | undefined): StaticLocationMaterialRow[] {
  if (!index) return [];
  const attemptedJoinKeys = getEntryJoinKeys(entry, index);
  for (const key of attemptedJoinKeys) {
    const rows = index.resourcesByLocationJoinKey.get(key);
    if (rows?.length) return rows;
  }
  warnNoStaticLocationMatch(entry, attemptedJoinKeys, index);
  return [];
}

export function getStaticLocationMaterialKeys(entry: PublicLocationEntry, index: StaticMiningIndex | null | undefined): string[] {
  if (!index) return [];
  const attemptedJoinKeys = getEntryJoinKeys(entry, index);
  for (const key of attemptedJoinKeys) {
    const keys = index.materialKeysByLocationJoinKey.get(key);
    if (keys?.length) return keys;
  }
  warnNoStaticLocationMatch(entry, attemptedJoinKeys, index);
  return [];
}

export function getStaticLocationAttemptedJoinKeys(entry: PublicLocationEntry, index?: StaticMiningIndex | null): string[] {
  return getEntryJoinKeys(entry, index);
}

export function getStaticLocationDisplayName(entry: PublicLocationEntry, index: StaticMiningIndex | null | undefined): string {
  const extended = entry as PublicLocationEntry & { locationDisplayName?: string };
  const canonicalLocationName = normalizeExact(entry.locationName);
  if (
    normalizeExact(entry.systemName) === "stanton" &&
    ACTIVE_STANTON_LAGRANGE_LOCATION_KEYS.has(canonicalLocationName)
  ) {
    return entry.locationName;
  }
  if (index) {
    const rows = getStaticResourcesForLocation(entry, index);
    const displayName = rows.find((row) => row.locationDisplayName)?.locationDisplayName;
    if (displayName) return displayName;

    for (const key of getEntryJoinKeys(entry, index)) {
      const distributionRows = index.distributionByLocationJoinKey.get(key);
      const distributionDisplayName = distributionRows?.find((row) => row.locationDisplayName)?.locationDisplayName;
      if (distributionDisplayName) return distributionDisplayName;
    }
  }
  const pyroDisplayName = normalizeExact(entry.systemName) === "pyro"
    ? canonicalPyroLocationName(extended.locationDisplayName ?? entry.locationName ?? entry.locationKey)
    : null;
  if (pyroDisplayName) return pyroDisplayName;
  return extended.locationDisplayName || entry.locationName;
}

export type StaticMethodBiasItem = {
  method: string;
  share: number;
};

function addMethodBiasItem(items: StaticMethodBiasItem[], rawMethod: string | null | undefined, rawShare: number | null | undefined): void {
  if (!rawMethod || rawShare === null || rawShare === undefined || !Number.isFinite(rawShare)) return;
  const method = displayMiningMethod(rawMethod);
  const share = rawShare > 1 ? rawShare / 100 : rawShare;
  const existing = items.find((item) => item.method === method);
  if (existing) {
    existing.share += share;
  } else {
    items.push({ method, share });
  }
}

function addMethodBiasRecord(items: StaticMethodBiasItem[], record: Record<string, number> | undefined): void {
  if (!record) return;
  for (const [method, share] of Object.entries(record)) addMethodBiasItem(items, method, share);
}

function getMethodBiasRecord(row: StaticLocationDistributionRow): Record<string, number> | undefined {
  const records = [
    row.methodShares,
    row.miningMix,
    row.classDistribution,
    row.distribution,
  ];
  return records.find((record) =>
    record && Object.values(record).some((share) => Number.isFinite(share) && share > 0)
  );
}

function addMethodBiasRow(items: StaticMethodBiasItem[], row: StaticLocationDistributionRow): void {
  const record = getMethodBiasRecord(row);
  if (record) {
    addMethodBiasRecord(items, record);
    return;
  }
  addMethodBiasItem(
    items,
    row.resolvedMineableClass ?? row.mineableClass ?? row.miningMethod ?? row.method,
    row.locationClassDistributionShare ?? row.distributionShare ?? row.share,
  );
}

function getDistributionRowIdentity(row: StaticLocationDistributionRow): string {
  return [
    normalizeExact(row.systemKey ?? row.system),
    normalizeExact(row.locationKey ?? row.location),
    JSON.stringify(row.methodShares ?? null),
    JSON.stringify(row.miningMix ?? null),
    JSON.stringify(row.classDistribution ?? null),
    JSON.stringify(row.distribution ?? null),
    normalizeExact(row.resolvedMineableClass ?? row.mineableClass ?? row.miningMethod ?? row.method),
    String(row.locationClassDistributionShare ?? row.distributionShare ?? row.share ?? ""),
  ].join("::");
}

export function getStaticMethodBiasForLocation(entry: PublicLocationEntry, index: StaticMiningIndex | null | undefined): StaticMethodBiasItem[] {
  if (!index) return [];
  const rowsByIdentity = new Map<string, StaticLocationDistributionRow>();
  for (const key of getEntryJoinKeys(entry, index)) {
    for (const row of index.distributionByLocationJoinKey.get(key) ?? []) {
      rowsByIdentity.set(getDistributionRowIdentity(row), row);
    }
  }
  const rows = [...rowsByIdentity.values()];
  if (rows.length === 0) return [];

  const items: StaticMethodBiasItem[] = [];
  for (const row of rows) {
    addMethodBiasRow(items, row);
  }

  const positiveItems = items.filter((item) => item.share > 0);
  const totalShare = positiveItems.reduce((sum, item) => sum + item.share, 0);
  const normalizedItems = totalShare > 1
    ? positiveItems.map((item) => ({ ...item, share: item.share / totalShare }))
    : positiveItems;

  return normalizedItems
    .sort((left, right) => right.share - left.share);
}

async function fetchJsonArray<T>(path: string): Promise<T[]> {
  const url = apiUrl(path);
  const response = await fetch(url);
  const data = await parseJsonResponse<unknown>(response, {
    label: `static mining index ${path}`,
    url,
  });
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  if (!Array.isArray(data)) throw new Error(`Expected ${path} to contain a JSON array`);
  return data as T[];
}

async function fetchJsonObject<T>(path: string): Promise<T> {
  const url = apiUrl(path);
  const response = await fetch(url);
  const data = await parseJsonResponse<T>(response, {
    label: `static mining index ${path}`,
    url,
  });
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return data;
}

function warnStaticIndexLoadFailure(path: string, error: unknown): void {
  if (import.meta.env.DEV) {
    console.warn(`[mining] required static mining index failed to load: ${path}`, error);
  }
}

async function fetchRequiredJsonArray<T>(path: string): Promise<T[]> {
  try {
    return await fetchJsonArray<T>(path);
  } catch (error) {
    warnStaticIndexLoadFailure(path, error);
    throw error;
  }
}

async function fetchRequiredJsonObject<T>(path: string): Promise<T | null> {
  try {
    return await fetchJsonObject<T>(path);
  } catch (error) {
    warnStaticIndexLoadFailure(path, error);
    throw error;
  }
}

const PYRO_LOCATION_KEY_ALIASES: Record<string, string> = {
  pyro1: "pyro i",
  "pyro i": "pyro i",
  pyro2: "monox",
  monox: "monox",
  "pyro ii": "monox",
  "pyro ii monox": "monox",
  "pyro ii (monox)": "monox",
  "pyro iii monox": "monox",
  "pyro iii (monox)": "monox",
  pyro3: "bloom",
  bloom: "bloom",
  "pyro iii": "bloom",
  "pyro iii bloom": "bloom",
  "pyro iii (bloom)": "bloom",
  pyro4: "pyro iv",
  "pyro iv": "pyro iv",
  "pyro akirocluster": "akiro cluster",
  "pyro_akirocluster": "akiro cluster",
  "akiro cluster": "akiro cluster",
  "pyro deepspaceasteroids": "pyro deep space asteroids",
  "pyro deep space asteroids": "pyro deep space asteroids",
  "pyro cool01": "pyro cool01",
  "pyro cool02": "pyro cool02",
  "pyro warm01": "pyro warm01",
  "pyro warm02": "pyro warm02",
  pyro5a: "pyro v-a (ignis)",
  "pyro v-a (ignis)": "pyro v-a (ignis)",
  "pyro v-a": "pyro v-a (ignis)",
  "pyro v a": "pyro v-a (ignis)",
  "pyro 5 a": "pyro v-a (ignis)",
  pyro5b: "pyro v-b (vatra)",
  "pyro v-b (vatra)": "pyro v-b (vatra)",
  "pyro v-b": "pyro v-b (vatra)",
  "pyro v b": "pyro v-b (vatra)",
  "pyro 5 b": "pyro v-b (vatra)",
  pyro5c: "pyro v-c (adir)",
  "pyro v-c (adir)": "pyro v-c (adir)",
  "pyro v-c": "pyro v-c (adir)",
  "pyro v c": "pyro v-c (adir)",
  "pyro 5 c": "pyro v-c (adir)",
  pyro5d: "pyro v-d (fairo)",
  "pyro v-d (fairo)": "pyro v-d (fairo)",
  "pyro v-d": "pyro v-d (fairo)",
  "pyro v d": "pyro v-d (fairo)",
  "pyro 5 d": "pyro v-d (fairo)",
  pyro5e: "pyro v-e (fuego)",
  "pyro v-e (fuego)": "pyro v-e (fuego)",
  "pyro v-e": "pyro v-e (fuego)",
  "pyro v e": "pyro v-e (fuego)",
  "pyro 5 e": "pyro v-e (fuego)",
  pyro5f: "pyro v-f (vuur)",
  "pyro v-f (vuur)": "pyro v-f (vuur)",
  "pyro v-f": "pyro v-f (vuur)",
  "pyro v f": "pyro v-f (vuur)",
  "pyro 5 f": "pyro v-f (vuur)",
  pyro6: "pyro vi (terminus)",
  terminus: "pyro vi (terminus)",
  "pyro vi": "pyro vi (terminus)",
  "pyro vi (terminus)": "pyro vi (terminus)",
  "terminus vi": "pyro vi (terminus)",
  "terminus ring": "terminus ring",
};

const PYRO_CANONICAL_LOCATION_NAMES: Record<string, string> = {
  "pyro i": "Pyro I",
  monox: "Monox",
  bloom: "Bloom",
  "pyro iv": "Pyro IV",
  "akiro cluster": "Akiro Cluster",
  "pyro deep space asteroids": "Pyro Deep Space Asteroids",
  "pyro cool01": "Pyro Cool01",
  "pyro cool02": "Pyro Cool02",
  "pyro warm01": "Pyro Warm01",
  "pyro warm02": "Pyro Warm02",
  "pyro vi (terminus)": "Pyro VI (Terminus)",
  "terminus ring": "Terminus Ring",
  "pyro v-a (ignis)": "Pyro V-a (Ignis)",
  "pyro v-b (vatra)": "Pyro V-b (Vatra)",
  "pyro v-c (adir)": "Pyro V-c (Adir)",
  "pyro v-d (fairo)": "Pyro V-d (Fairo)",
  "pyro v-e (fuego)": "Pyro V-e (Fuego)",
  "pyro v-f (vuur)": "Pyro V-f (Vuur)",
};

const EXCLUDED_PYRO_LOCATION_NAMES = new Set([
  "Pyro Cool01",
  "Pyro Cool02",
  "Pyro Warm01",
  "Pyro Warm02",
]);

const ACTIVE_STANTON_LAGRANGE_LOCATION_KEYS = new Set([
  "lagrange a",
  "lagrange b",
  "lagrange c",
  "lagrange d",
  "lagrange e",
  "lagrange f",
  "lagrange g",
  "lagrange h",
  "lagrange i",
  "lagrange j",
  "lagrange k",
  "lagrange l",
]);

function normalizePyroLocationKey(locationKey: string | null | undefined): string {
  const key = normalizeExact(locationKey);
  return PYRO_LOCATION_KEY_ALIASES[key] ?? key;
}

function canonicalPyroLocationName(locationKey: string | null | undefined): string | null {
  return PYRO_CANONICAL_LOCATION_NAMES[normalizePyroLocationKey(locationKey)] ?? null;
}

function canonicalizePyroRowLocation<T extends {
  system?: string;
  systemKey?: string;
  systemDisplayName?: string;
  location?: string;
  locationKey?: string;
  locationDisplayName?: string;
  sources?: Array<Record<string, unknown>>;
}>(row: T): T {
  if (normalizeExact(row.systemKey ?? row.system) !== "pyro") return row;

  const locationName = canonicalPyroLocationName(row.locationKey ?? row.location ?? row.locationDisplayName);
  if (!locationName) return row;

  row.system = "Pyro";
  row.systemKey = "Pyro";
  row.systemDisplayName = "Pyro";
  row.location = locationName;
  row.locationKey = locationName;
  row.locationDisplayName = locationName;

  if (Array.isArray(row.sources)) {
    row.sources = row.sources.map((source) => canonicalizePyroRowLocation({ ...source }));
  }

  return row;
}

function isExcludedPyroLocation(systemKey: string | null | undefined, locationKey: string | null | undefined): boolean {
  if (normalizeExact(systemKey) !== "pyro") return false;
  const locationName = canonicalPyroLocationName(locationKey) ?? locationKey;
  return EXCLUDED_PYRO_LOCATION_NAMES.has(locationName ?? "");
}

function isInactiveStantonLagrangeLocation(systemKey: string | null | undefined, locationKey: string | null | undefined): boolean {
  if (normalizeExact(systemKey) !== "stanton") return false;
  const key = normalizeExact(locationKey);
  return key.startsWith("lagrange ") && !ACTIVE_STANTON_LAGRANGE_LOCATION_KEYS.has(key);
}

function buildStaticMiningIndex(
  rows: StaticLocationMaterialRow[],
  rankings: StaticMaterialEncounterRankingRow[],
  qualityRows: StaticMaterialQualityRow[],
  distributionRows: StaticLocationDistributionRow[],
  locationHierarchy: StaticLocationHierarchyIndex | null,
): StaticMiningIndex {
  rows = rows.filter((row) =>
    !isExcludedPyroLocation(row.systemKey, row.locationKey) &&
    !isInactiveStantonLagrangeLocation(row.systemKey, row.locationKey)
  ).map(canonicalizePyroRowLocation);
  rankings = rankings.filter((row) =>
    !isExcludedPyroLocation(row.systemKey, row.locationKey) &&
    !isInactiveStantonLagrangeLocation(row.systemKey, row.locationKey)
  ).map(canonicalizePyroRowLocation);
  qualityRows = qualityRows.filter((row) =>
    !isExcludedPyroLocation(row.systemKey, row.locationKey) &&
    !isInactiveStantonLagrangeLocation(row.systemKey, row.locationKey)
  ).map(canonicalizePyroRowLocation);
  distributionRows = distributionRows.filter((row) =>
    !isExcludedPyroLocation(row.systemKey, row.locationKey) &&
    !isInactiveStantonLagrangeLocation(row.systemKey, row.locationKey)
  ).map(canonicalizePyroRowLocation);

  const primaryGroups = new Map<string, StaticLocationMaterialRow[]>();
  for (const row of rows) {
    const key = getStaticLocationJoinKey(row.systemKey, row.locationKey);
    const group = primaryGroups.get(key) ?? [];
    group.push(row);
    primaryGroups.set(key, group);
  }

  const resourcesByLocationJoinKey = new Map<string, StaticLocationMaterialRow[]>();
  for (const group of primaryGroups.values()) {
    for (const row of group) addLocationAliases(resourcesByLocationJoinKey, row, group);
  }

  const locationKeysByDisplayName = buildLocationKeysByDisplayName(rows);

  const materialKeysByLocationJoinKey = new Map<string, string[]>();
  for (const [key, group] of resourcesByLocationJoinKey) {
    materialKeysByLocationJoinKey.set(key, [...new Set(group.map(getStaticMaterialKey).filter(Boolean))]);
  }

  const rankingByRowKey = new Map<string, StaticMaterialEncounterRankingRow>();
  for (const ranking of rankings) {
    rankingByRowKey.set(getStaticRowRankingKey(ranking), ranking);
  }

  const qualityByRowKey = new Map<string, StaticMaterialQualityRow>();
  for (const qualityRow of qualityRows) {
    for (const key of getStaticQualityRowKeys(qualityRow)) {
      qualityByRowKey.set(key, qualityRow);
    }
  }

  const distributionPrimaryGroups = new Map<string, StaticLocationDistributionRow[]>();
  for (const row of distributionRows) {
    const key = getStaticLocationJoinKey(row.systemKey ?? row.system ?? "", row.locationKey ?? row.location ?? "");
    const group = distributionPrimaryGroups.get(key) ?? [];
    group.push(row);
    distributionPrimaryGroups.set(key, group);
  }

  const distributionByLocationJoinKey = new Map<string, StaticLocationDistributionRow[]>();
  for (const group of distributionPrimaryGroups.values()) {
    for (const row of group) addDistributionAliases(distributionByLocationJoinKey, row, group);
  }

  const encounterScoreRangeByMaterialKey = new Map<string, { min: number; max: number }>();
  const materialEncounterScoreRangeByMaterialKey = new Map<string, { min: number; max: number }>();
  const materialResources = new Map<string, StaticMiningMaterialResource>();
  for (const row of rows) {
    const canonical = canonicalMiningMaterial({
      materialKey: row.sources?.[0]?.materialKey,
      materialId: row.materialId,
      materialName: row.materialName,
      displayName: row.materialName,
    });
    if (!canonical.key || canonical.unresolvedUuid) continue;

    materialResources.set(canonical.key, {
      id: canonical.key,
      label: row.materialName || canonical.label,
      miningType: miningChipTypeFromMineableClass(row.resolvedMineableClass),
    });

    if (Number.isFinite(row.encounterScore)) {
      const range = encounterScoreRangeByMaterialKey.get(canonical.key);
      encounterScoreRangeByMaterialKey.set(canonical.key, {
        min: range ? Math.min(range.min, row.encounterScore) : row.encounterScore,
        max: range ? Math.max(range.max, row.encounterScore) : row.encounterScore,
      });
    }
    if (typeof row.materialEncounterScore === "number" && Number.isFinite(row.materialEncounterScore)) {
      const range = materialEncounterScoreRangeByMaterialKey.get(canonical.key);
      materialEncounterScoreRangeByMaterialKey.set(canonical.key, {
        min: range ? Math.min(range.min, row.materialEncounterScore) : row.materialEncounterScore,
        max: range ? Math.max(range.max, row.materialEncounterScore) : row.materialEncounterScore,
      });
    }
  }

  return {
    rows,
    rankings,
    resourcesByLocationJoinKey,
    materialKeysByLocationJoinKey,
    locationKeysByDisplayName,
    materialResources: [...materialResources.values()].sort((left, right) => left.label.localeCompare(right.label)),
    rankingByRowKey,
    encounterScoreRangeByMaterialKey,
    materialEncounterScoreRangeByMaterialKey,
    distributionRows,
    distributionByLocationJoinKey,
    qualityRows,
    qualityByRowKey,
    locationHierarchy,
  };
}

export async function loadStaticMiningIndex(): Promise<StaticMiningIndex> {
  if (resolvedCache) return resolvedCache;
  if (!loadPromise) {
    loadPromise = Promise.all([
      fetchRequiredJsonArray<StaticLocationMaterialRow>(LOCATION_INDEX_URL),
      fetchRequiredJsonArray<StaticMaterialEncounterRankingRow>(MATERIAL_RANKINGS_URL),
      fetchRequiredJsonArray<StaticMaterialQualityRow>(MATERIAL_QUALITY_INDEX_URL),
      fetchRequiredJsonArray<StaticLocationDistributionRow>(LOCATION_DISTRIBUTION_INDEX_URL),
      fetchRequiredJsonObject<StaticLocationHierarchyIndex>(LOCATION_HIERARCHY_INDEX_URL),
    ])
      .then(([rows, rankings, qualityRows, distributionRows, locationHierarchy]) => {
        resolvedCache = buildStaticMiningIndex(rows, rankings, qualityRows, distributionRows, locationHierarchy);
        return resolvedCache;
      })
      .catch((error: unknown) => {
        loadPromise = null;
        throw error;
      });
  }
  return loadPromise;
}
