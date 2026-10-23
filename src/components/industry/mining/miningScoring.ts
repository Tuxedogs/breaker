import type { PublicLocationEntry, RequiredMaterial } from "../../../features/mining/types";
import { canonicalMiningMaterial, canonicalMiningMaterialKey } from "../../../features/mining/materialIdentity";

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

/**
 * Re-aggregate only the scores already produced by the recommender.  A
 * location's static browse rows are deliberately not an input here: they can
 * describe physically present but method-ineligible or quality-unsupported
 * sources.
 */
export function recommendationDemandScore(
  entry: PublicLocationEntry,
  demandMaterials: RequiredMaterial[],
): { covered: number; score: number | null } {
  if (demandMaterials.length === 0) return { covered: 0, score: null };
  const eligibleKeys = new Set((entry.requiredMaterials ?? []).map((material) => canonicalMiningMaterial({
    materialKey: material.materialKey,
    materialId: material.materialId,
    materialName: material.materialName,
    displayName: material.displayName,
  }).key).filter(Boolean));
  let covered = 0;
  let weightedScore = 0;
  let scoredDemandWeight = 0;
  for (const material of demandMaterials) {
    const canonical = canonicalMiningMaterial({
      materialKey: material.materialKey,
      materialId: material.materialId,
      displayName: material.displayName,
      materialName: material.materialName,
    });
    if (canonical.unresolvedUuid || !canonical.key) continue;
    const quantityWeight = Math.max(1, Number(material.requiredQuantity) || 1);
    if (!eligibleKeys.has(canonical.key)) continue;
    covered += 1;
    const route = findRouteScoreForMaterial(entry, canonical.key);
    if (!route || !Number.isFinite(route.overallTargetabilityScore)) continue;
    weightedScore += route.overallTargetabilityScore * quantityWeight;
    scoredDemandWeight += quantityWeight;
  }
  return { covered, score: scoredDemandWeight > 0 ? weightedScore / scoredDemandWeight : null };
}

export function compareLocationsForDemand(
  left: PublicLocationEntry,
  right: PublicLocationEntry,
  demandMaterials: RequiredMaterial[],
): number {
  const leftScore = recommendationDemandScore(left, demandMaterials);
  const rightScore = recommendationDemandScore(right, demandMaterials);
  return rightScore.covered - leftScore.covered ||
    (rightScore.score ?? getLocationSortScore(right)) - (leftScore.score ?? getLocationSortScore(left)) ||
    left.locationName.localeCompare(right.locationName);
}

/**
 * A visible tie exists only when the evidence used by the active ordering is
 * also identical. In particular, equal modeled scores do not override the
 * coverage-first ordering used for queue demand.
 */
export function recommendationTieGroupSize(
  entry: PublicLocationEntry,
  locations: PublicLocationEntry[],
  demandMaterials: RequiredMaterial[],
): number {
  return locations.filter((candidate) => sameActiveRankingEvidence(entry, candidate, demandMaterials)).length;
}

function sameActiveRankingEvidence(
  left: PublicLocationEntry,
  right: PublicLocationEntry,
  demandMaterials: RequiredMaterial[],
): boolean {
  if (demandMaterials.length > 0) {
    const leftScore = recommendationDemandScore(left, demandMaterials);
    const rightScore = recommendationDemandScore(right, demandMaterials);
    return leftScore.covered === rightScore.covered &&
      (leftScore.score ?? getLocationSortScore(left)) === (rightScore.score ?? getLocationSortScore(right));
  }

  return getLocationSortScore(left) === getLocationSortScore(right) &&
    getMatchedDemandCount(left) === getMatchedDemandCount(right);
}

export type DisplayedLocationRank = {
  visualLabel: string;
  accessibleLabel: string;
  tooltip: string | null;
  tieGroupSize: number;
};

/**
 * Convert the already-displayed stable order into competition ranks. A tie's
 * rank is its first displayed position, so all members receive one label.
 */
export function getDisplayedLocationRank(
  entry: PublicLocationEntry,
  displayedLocations: PublicLocationEntry[],
  demandMaterials: RequiredMaterial[],
  options: { routeOrdered?: boolean } = {},
): DisplayedLocationRank {
  const index = displayedLocations.findIndex((candidate) => candidate.locationKey === entry.locationKey);
  const fallbackRank = Math.max(index, 0) + 1;
  if (options.routeOrdered) {
    return {
      visualLabel: `Route ${fallbackRank}`,
      accessibleLabel: `Route position ${fallbackRank}`,
      tooltip: "Route order reflects the coverage plan, not a modeled score rank.",
      tieGroupSize: 1,
    };
  }
  const tiedEntries = displayedLocations.filter((candidate) => sameActiveRankingEvidence(entry, candidate, demandMaterials));
  if (tiedEntries.length < 2) {
    return { visualLabel: String(fallbackRank), accessibleLabel: `Rank ${fallbackRank}`, tooltip: null, tieGroupSize: 1 };
  }
  const sharedRank = Math.max(displayedLocations.findIndex((candidate) => sameActiveRankingEvidence(entry, candidate, demandMaterials)), 0) + 1;
  const accessibleLabel = `Tied modeled rank ${sharedRank}, shared by ${tiedEntries.length} locations`;
  return {
    visualLabel: `T-${sharedRank}`,
    accessibleLabel,
    tooltip: `${accessibleLabel}. Stable order only displays this tie.`,
    tieGroupSize: tiedEntries.length,
  };
}

/**
 * The coverage planner may show a score specific to its active demand.  Keep
 * the original recommendation score intact if no per-material recommendation
 * score exists instead of fabricating a zero.
 */
export function withRecommendationDemandScores(
  locations: PublicLocationEntry[],
  demandMaterials: RequiredMaterial[],
  targetabilityLabel: (score: number) => PublicLocationEntry["routeTargetabilityLabel"],
): PublicLocationEntry[] {
  return locations.map((entry) => {
    const score = recommendationDemandScore(entry, demandMaterials).score;
    if (score === null) return entry;
    const rounded = Math.round(score);
    return { ...entry, score: rounded, routeTargetabilityScore: rounded, routeTargetabilityLabel: targetabilityLabel(rounded) };
  });
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
