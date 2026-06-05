import type { PublicLocationEntry, RequiredMaterial } from "../../../features/mining/types";
import { canonicalMiningMaterial, canonicalMiningMaterialKey } from "../../../features/mining/materialIdentity";
import {
  getStaticDensityScore,
  getStaticMaterialQualityRow,
  getStaticMaterialKey,
  getStaticResourcesForLocation,
  type StaticMiningIndex,
} from "../../../features/mining/staticMiningIndex";
import type { MiningRankingMode } from "./miningTypes";

export function findRouteScoreForMaterial(entry: PublicLocationEntry, materialKey: string | null | undefined) {
  if (!materialKey) return null;
  const selectedKey = canonicalMiningMaterialKey(materialKey);
  return (entry.routeScores ?? []).find((score) =>
    canonicalMiningMaterialKey(score.materialKey) === selectedKey ||
    canonicalMiningMaterialKey(score.materialId) === selectedKey ||
    canonicalMiningMaterialKey(score.materialName) === selectedKey ||
    canonicalMiningMaterialKey(score.displayName) === selectedKey
  ) ?? null;
}

export function getPrimaryRouteScore(entry: PublicLocationEntry, selectedMaterials: Set<string>) {
  if (selectedMaterials.size === 1) {
    return findRouteScoreForMaterial(entry, [...selectedMaterials][0]);
  }
  return entry.routeScores?.[0] ?? null;
}

export function getLocationSortScore(entry: PublicLocationEntry): number {
  if (Number.isFinite(entry.routeTargetabilityScore)) return entry.routeTargetabilityScore ?? 0;
  if (Number.isFinite(entry.score)) return entry.score;
  return 0;
}

export function getMatchedDemandCount(entry: PublicLocationEntry): number {
  return entry.requiredMaterials?.length ?? 0;
}

export function compareLocationsByRecommendationScore(left: PublicLocationEntry, right: PublicLocationEntry): number {
  return getLocationSortScore(right) - getLocationSortScore(left) ||
    getMatchedDemandCount(right) - getMatchedDemandCount(left) ||
    left.locationName.localeCompare(right.locationName);
}

export const scoringWeightsByMode: Record<MiningRankingMode, { encounter: number; quality: number; composition: number; methodFit: number }> = {
  quality: { encounter: 0.35, quality: 0.45, composition: 0.10, methodFit: 0.10 },
  quantity: { encounter: 0.55, quality: 0.10, composition: 0.25, methodFit: 0.10 },
  balanced: { encounter: 0.40, quality: 0.25, composition: 0.20, methodFit: 0.15 },
};

export function clampScore(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function compositionPctFromRow(row: { compositionAveragePercentage?: number | null } | null | undefined): number {
  const value = row?.compositionAveragePercentage;
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return clampScore(value > 1 ? value : value * 100);
}

export function methodFitPctFromRow(row: { methodFit?: number | null; locationClassDistributionShare?: number | null } | null | undefined): number {
  const value = row?.methodFit ?? row?.locationClassDistributionShare;
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return clampScore(value > 1 ? value : value * 100);
}

export function demandWeightedLocationScore(
  entry: PublicLocationEntry,
  demandMaterials: RequiredMaterial[],
  locationMaterialKeysByLocationKey: Map<string, string[]>,
  staticMiningIndex: StaticMiningIndex | null,
  rankingMode: MiningRankingMode,
): { covered: number; score: number } {
  if (demandMaterials.length === 0) return { covered: 0, score: getLocationSortScore(entry) };
  const coveredKeys = new Set(locationMaterialKeysByLocationKey.get(entry.locationKey) ?? []);
  const staticRowsByKey = new Map(
    getStaticResourcesForLocation(entry, staticMiningIndex).map((row) => [getStaticMaterialKey(row), row])
  );
  let covered = 0;
  let weightedFit = 0;
  let coveredDemandWeight = 0;
  for (const material of demandMaterials) {
    const canonical = canonicalMiningMaterial({
      materialKey: material.materialKey,
      materialId: material.materialId,
      displayName: material.displayName,
      materialName: material.materialName,
    });
    if (canonical.unresolvedUuid || !canonical.key) continue;
    const quantityWeight = Math.max(1, Number(material.requiredQuantity) || 1);
    if (!coveredKeys.has(canonical.key)) {
      continue;
    }
    covered += 1;
    const row = staticRowsByKey.get(canonical.key);
    const qualityRow = row ? getStaticMaterialQualityRow(row, staticMiningIndex) : null;
    const threshold = material.selectedQuality ?? 800;
    const qualityChance = qualityRow?.qualityThresholdChancesWeighted?.[String(threshold)]
      ?? qualityRow?.thresholdChances?.[String(threshold)]
      ?? row?.qualityThresholdChancesWeighted?.[String(threshold)]
      ?? 0;
    const weights = scoringWeightsByMode[rankingMode];
    const fit = (
      clampScore(row ? getStaticDensityScore(row, staticMiningIndex) : 0) * weights.encounter +
      clampScore(qualityChance * 100) * weights.quality +
      compositionPctFromRow(row) * weights.composition +
      methodFitPctFromRow(row) * weights.methodFit
    );
    weightedFit += fit * quantityWeight;
    coveredDemandWeight += quantityWeight;
  }
  const locationFit = coveredDemandWeight > 0 ? weightedFit / coveredDemandWeight : 0;
  return { covered, score: locationFit };
}


export function isIndexableMiningResource(name: string): boolean {
  const lower = name.toLowerCase();
  return ![
    "drug",
    "commodity",
    "consumable",
    "modifier",
    "damage",
    "duration",
    "crafting",
    "blueprint",
  ].some((term) => lower.includes(term));
}

export function locationMatchesMaterialKey(
  location: PublicLocationEntry,
  materialKey: string,
  indexedMaterialKeysByLocationKey: Map<string, string[]>,
): boolean {
  return (indexedMaterialKeysByLocationKey.get(location.locationKey) ?? []).includes(canonicalMiningMaterialKey(materialKey));
}

export function diversifyLocationsByMaterials(
  locations: PublicLocationEntry[],
  materialKeys: Set<string>,
  indexedMaterialKeysByLocationKey: Map<string, string[]>,
): PublicLocationEntry[] {
  if (materialKeys.size < 2 || locations.length < 2) return locations;

  const selected: PublicLocationEntry[] = [];
  const selectedKeys = new Set<string>();
  const keys = [...materialKeys];

  for (const materialKey of keys) {
    const nextLocation = locations.find((location) =>
      !selectedKeys.has(location.locationKey) &&
      locationMatchesMaterialKey(location, materialKey, indexedMaterialKeysByLocationKey)
    );
    if (!nextLocation) continue;
    selected.push(nextLocation);
    selectedKeys.add(nextLocation.locationKey);
  }

  for (const location of locations) {
    if (!selectedKeys.has(location.locationKey)) selected.push(location);
  }

  return selected;
}
