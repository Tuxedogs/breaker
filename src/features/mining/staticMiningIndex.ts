import { apiUrl } from "../../lib/apiUrl";
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
  sources?: Array<{
    materialKey?: string;
    materialId?: string;
    materialName?: string;
    spawnType?: string;
    groupName?: string;
    sourceProbability?: number;
    relativeProbability?: number;
    groupProbability?: number;
  }>;
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
  materialResources: StaticMiningMaterialResource[];
  rankingByRowKey: Map<string, StaticMaterialEncounterRankingRow>;
  encounterScoreRangeByMaterialKey: Map<string, { min: number; max: number }>;
};

const LOCATION_INDEX_URL = "/api/recommendations/location_material_index.json";
const MATERIAL_RANKINGS_URL = "/api/recommendations/material_encounter_rankings.json";

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
  return parts.length > 1 ? parts[parts.length - 1] : normalized;
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
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
      return "Orbitborne";
    case "Shipborne":
      return "Shipborne";
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

export function formatStaticYield(row: StaticLocationMaterialRow): string {
  const value = row.compositionAveragePercentage;
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unknown";
  return `${Number(value.toFixed(2)).toString()}%`;
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

function addLocationAliases(map: Map<string, StaticLocationMaterialRow[]>, row: StaticLocationMaterialRow, rows: StaticLocationMaterialRow[]): void {
  for (const key of [
    compactJoinKey(row.systemKey, row.locationKey),
    compactJoinKey(row.system, row.location),
    compactJoinKey(row.systemDisplayName, row.locationDisplayName),
    looseJoinKey(row.systemKey, row.locationKey),
    looseJoinKey(row.system, row.location),
    looseJoinKey(row.systemDisplayName, row.locationDisplayName),
  ]) {
    if (key !== "::") map.set(key, rows);
  }
}

function getEntryJoinKeys(entry: PublicLocationEntry): string[] {
  const extended = entry as PublicLocationEntry & {
    systemKey?: string;
    locationDisplayName?: string;
  };
  const systems = unique([extended.systemKey, entry.systemName]);
  const locations = unique([
    splitLocationCandidate(entry.locationKey),
    entry.locationKey,
    entry.locationName,
    extended.locationDisplayName,
  ]);
  const exact = systems.flatMap((system) => locations.map((location) => compactJoinKey(system, location)));
  const loose = systems.flatMap((system) => locations.map((location) => looseJoinKey(system, location)));
  return [...new Set([...exact, ...loose])].filter((key) => key !== "::");
}

export function getStaticResourcesForLocation(entry: PublicLocationEntry, index: StaticMiningIndex | null | undefined): StaticLocationMaterialRow[] {
  if (!index) return [];
  for (const key of getEntryJoinKeys(entry)) {
    const rows = index.resourcesByLocationJoinKey.get(key);
    if (rows?.length) return rows;
  }
  return [];
}

export function getStaticLocationMaterialKeys(entry: PublicLocationEntry, index: StaticMiningIndex | null | undefined): string[] {
  if (!index) return [];
  for (const key of getEntryJoinKeys(entry)) {
    const keys = index.materialKeysByLocationJoinKey.get(key);
    if (keys?.length) return keys;
  }
  return [];
}

export function getStaticLocationAttemptedJoinKeys(entry: PublicLocationEntry): string[] {
  return getEntryJoinKeys(entry);
}

async function fetchJsonArray<T>(path: string): Promise<T[]> {
  const url = apiUrl(path);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  const data = (await response.json()) as unknown;
  return Array.isArray(data) ? data as T[] : [];
}

function buildStaticMiningIndex(
  rows: StaticLocationMaterialRow[],
  rankings: StaticMaterialEncounterRankingRow[],
): StaticMiningIndex {
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

  const materialKeysByLocationJoinKey = new Map<string, string[]>();
  for (const [key, group] of resourcesByLocationJoinKey) {
    materialKeysByLocationJoinKey.set(key, [...new Set(group.map(getStaticMaterialKey).filter(Boolean))]);
  }

  const rankingByRowKey = new Map<string, StaticMaterialEncounterRankingRow>();
  for (const ranking of rankings) {
    rankingByRowKey.set(getStaticRowRankingKey(ranking), ranking);
  }

  const encounterScoreRangeByMaterialKey = new Map<string, { min: number; max: number }>();
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
  }

  return {
    rows,
    rankings,
    resourcesByLocationJoinKey,
    materialKeysByLocationJoinKey,
    materialResources: [...materialResources.values()].sort((left, right) => left.label.localeCompare(right.label)),
    rankingByRowKey,
    encounterScoreRangeByMaterialKey,
  };
}

export async function loadStaticMiningIndex(): Promise<StaticMiningIndex> {
  loadPromise ??= Promise.all([
    fetchJsonArray<StaticLocationMaterialRow>(LOCATION_INDEX_URL),
    fetchJsonArray<StaticMaterialEncounterRankingRow>(MATERIAL_RANKINGS_URL).catch(() => []),
  ]).then(([rows, rankings]) => buildStaticMiningIndex(rows, rankings)).finally(() => {
    loadPromise = null;
  });
  return loadPromise;
}
