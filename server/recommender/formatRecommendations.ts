import type { AggregatedRequirement, ApiSource, MaterialRouteScore, Recommendation, RouteTargetabilityLabel, ScoredLocation } from "./recommender.types";
import { formatRequirementQuantity } from "../shared/quantityFormatter";

function spawnTypeLabel(spawnType: string): string {
  const normalized = spawnType.toLowerCase();
  if (normalized.includes("ship") || normalized === "mineable") return "ship mining";
  if (normalized.includes("surface")) return "surface mining";
  if (normalized.includes("hand") || normalized.includes("fps")) return "hand mining";
  if (normalized.includes("mixed")) return "mixed mining";
  return spawnType.replace(/_/g, " ");
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function roundScore(value: number): number {
  return Math.round(clampScore(value));
}

function labelForScore(score: number): RouteTargetabilityLabel {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Good";
  if (score >= 30) return "Weak";
  return "Poor";
}

function compositionAverage(source: ApiSource): number | undefined {
  const composition = source.composition;
  if (!composition) return undefined;
  if (typeof composition.averagePercentage === "number") return composition.averagePercentage;
  if (typeof composition.minPercentage === "number" && typeof composition.maxPercentage === "number") {
    return (composition.minPercentage + composition.maxPercentage) / 2;
  }
  return composition.maxPercentage;
}

function sourceBelongsToRequirement(source: ApiSource, requirement: AggregatedRequirement): boolean {
  const candidates = [
    source.materialId,
    source.materialName,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  return candidates.some((value) => {
    const normalized = value.trim().toLowerCase();
    return normalized === requirement.materialId.toLowerCase() ||
      normalized === requirement.materialName.toLowerCase() ||
      normalized === requirement.displayName.toLowerCase() ||
      normalized === requirement.materialKey.toLowerCase();
  });
}

function rawQualityRouteScore(source: ApiSource, requirement: AggregatedRequirement): number {
  const thresholdChance = requirement.selectedQuality !== undefined
    ? source.quality?.thresholdChances?.[String(requirement.selectedQuality)]
    : undefined;
  const thresholdSignal = typeof thresholdChance === "number" ? thresholdChance * 100 : undefined;
  const meanSignal = typeof source.quality?.mean === "number" ? source.quality.mean : undefined;
  const maxSignal = typeof source.quality?.max === "number" ? source.quality.max : undefined;
  const potentialSignal = typeof source.estimatedHighQualityPotential === "number"
    ? source.estimatedHighQualityPotential
    : undefined;
  const tierSignal = source.quality?.qualityTier
    ? ({ poor: 20, low: 35, common: 45, average: 50, good: 65, high: 78, excellent: 90, pristine: 96 }[source.quality.qualityTier.toLowerCase()] ?? 55)
    : undefined;
  const signals = [thresholdSignal, meanSignal, maxSignal, potentialSignal, tierSignal]
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (signals.length === 0) return 50;
  return signals.reduce((sum, value) => sum + value, 0) / signals.length;
}

function rawYieldRouteScore(source: ApiSource): number {
  const composition = compositionAverage(source) ?? 0;
  const upside = source.composition?.maxPercentage ?? composition;
  const probability = source.probability ?? 0;
  const relativeProbability = source.relativeProbability ?? 0;
  const materialProbability = source.materialProbability ?? 0;
  const groupProbability = source.groupProbability ?? 0;
  const sourceWeight = source.overallScore ?? probability + (relativeProbability / 100) + materialProbability + (groupProbability / 100);
  return (sourceWeight * 35) + (composition * 0.4) + (upside * 0.15) + (relativeProbability * 0.25);
}

function makeReasons(route: {
  qualityRouteScore: number;
  yieldRouteScore: number;
  demandMatchScore: number;
  competingSources: number;
}): string[] {
  const reasons: string[] = [];
  if (route.qualityRouteScore >= 70) reasons.push("higher quality fit");
  if (route.yieldRouteScore >= 70) reasons.push("better source weighting");
  if (route.yieldRouteScore >= 55) reasons.push("stronger composition/yield signals");
  if (route.demandMatchScore >= 70) reasons.push("better demand coverage");
  if (route.competingSources <= 2) reasons.push("fewer competing sources");
  if (reasons.length === 0) reasons.push("balanced source weight and route fit");
  return reasons;
}

function titleCaseFromIdentifier(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function specialSignalsForSource(source: ApiSource): MaterialRouteScore["specialSignals"] {
  const signals: NonNullable<MaterialRouteScore["specialSignals"]> = [];
  const distributionName = source.quality?.distributionName ?? "";
  const distributionPath = source.quality?.distributionPath ?? "";
  const reason = source.reason ?? "";
  const combined = `${distributionName} ${distributionPath} ${reason}`.toLowerCase();

  if (combined.includes("override")) {
    signals.push({
      label: "High-Value Area",
      reason: distributionName ? titleCaseFromIdentifier(distributionName) : "Quality override distribution",
    });
  }
  if (reason && /high quality potential|strong composition yield|high spawn probability/i.test(reason)) {
    signals.push({
      label: "Special Yield",
      reason: reason.split(":").slice(1).join(":").trim() || reason,
    });
  }

  return signals.length > 0 ? signals : undefined;
}

function buildMaterialRouteScores(locations: ScoredLocation[]): Map<string, MaterialRouteScore[]> {
  type RawRoute = {
    locationKey: string;
    requirement: AggregatedRequirement;
    source: ApiSource;
    rawQuality: number;
    rawYield: number;
    rawDemand: number;
    competingSources: number;
  };

  const rawRoutes: RawRoute[] = [];
  const sourceCounts = new Map<string, number>();
  for (const location of locations) {
    for (const requirement of location.coveredRequirements) {
      sourceCounts.set(requirement.materialKey, (sourceCounts.get(requirement.materialKey) ?? 0) + 1);
    }
  }

  for (const location of locations) {
    for (const requirement of location.coveredRequirements) {
      const source = location.bestSources.find((entry) => sourceBelongsToRequirement(entry, requirement)) ?? location.bestSources[0];
      if (!source) continue;
      rawRoutes.push({
        locationKey: location.locationKey,
        requirement,
        source,
        rawQuality: rawQualityRouteScore(source, requirement),
        rawYield: rawYieldRouteScore(source),
        rawDemand: Math.log10(requirement.requiredQuantity + 10) * 25,
        competingSources: sourceCounts.get(requirement.materialKey) ?? 1,
      });
    }
  }

  const maxByMaterial = new Map<string, { quality: number; yield: number; demand: number }>();
  for (const route of rawRoutes) {
    const current = maxByMaterial.get(route.requirement.materialKey) ?? { quality: 0, yield: 0, demand: 0 };
    current.quality = Math.max(current.quality, route.rawQuality);
    current.yield = Math.max(current.yield, route.rawYield);
    current.demand = Math.max(current.demand, route.rawDemand);
    maxByMaterial.set(route.requirement.materialKey, current);
  }

  const byLocation = new Map<string, MaterialRouteScore[]>();
  for (const route of rawRoutes) {
    const max = maxByMaterial.get(route.requirement.materialKey) ?? { quality: 100, yield: 100, demand: 100 };
    const qualityRouteScore = roundScore(max.quality > 0 ? (route.rawQuality / max.quality) * 100 : 0);
    const yieldRouteScore = roundScore(max.yield > 0 ? (route.rawYield / max.yield) * 100 : 0);
    const demandMatchScore = roundScore(max.demand > 0 ? (route.rawDemand / max.demand) * 100 : 0);
    const overallTargetabilityScore = roundScore((qualityRouteScore * 0.35) + (yieldRouteScore * 0.45) + (demandMatchScore * 0.2));
    const score: MaterialRouteScore = {
      materialKey: route.requirement.materialKey,
      materialId: route.requirement.materialId,
      materialName: route.requirement.materialName,
      displayName: route.requirement.displayName,
      selectedQuality: route.requirement.selectedQuality,
      qualityRouteScore,
      yieldRouteScore,
      demandMatchScore,
      overallTargetabilityScore,
      label: labelForScore(overallTargetabilityScore),
      reasons: makeReasons({ qualityRouteScore, yieldRouteScore, demandMatchScore, competingSources: route.competingSources }),
      specialSignals: specialSignalsForSource(route.source),
      signals: {
        qualityFit: qualityRouteScore,
        yieldPotential: yieldRouteScore,
        sourceWeight: roundScore(route.source.overallScore ? route.source.overallScore * 100 : route.rawYield),
        routeTargetability: overallTargetabilityScore,
        competingSources: route.competingSources,
      },
    };
    const list = byLocation.get(route.locationKey) ?? [];
    list.push(score);
    byLocation.set(route.locationKey, list);
  }

  return byLocation;
}

function addComparisons(locations: ScoredLocation[], routeScoresByLocation: Map<string, MaterialRouteScore[]>): void {
  const scoresByMaterial = new Map<string, Array<{ location: ScoredLocation; score: MaterialRouteScore }>>();
  for (const location of locations) {
    for (const score of routeScoresByLocation.get(location.locationKey) ?? []) {
      const list = scoresByMaterial.get(score.materialKey) ?? [];
      list.push({ location, score });
      scoresByMaterial.set(score.materialKey, list);
    }
  }

  for (const entries of scoresByMaterial.values()) {
    entries.sort((left, right) => right.score.overallTargetabilityScore - left.score.overallTargetabilityScore);
    const baseline = entries[entries.length - 1];
    for (const entry of entries) {
      if (!baseline || entry.location.locationKey === baseline.location.locationKey) continue;
      const delta = entry.score.overallTargetabilityScore - baseline.score.overallTargetabilityScore;
      const strength = delta >= 25 ? "Much better than" : "Better than";
      entry.score.comparison = `${strength} ${baseline.location.locationName}`;
    }
  }
}

function compareRouteScores(left: MaterialRouteScore, right: MaterialRouteScore): number {
  return right.overallTargetabilityScore - left.overallTargetabilityScore ||
    right.demandMatchScore - left.demandMatchScore ||
    left.displayName.localeCompare(right.displayName);
}

function compareRecommendationLocations(left: ScoredLocation, right: ScoredLocation): number {
  return right.score - left.score ||
    right.coveredRequirements.length - left.coveredRequirements.length ||
    left.locationName.localeCompare(right.locationName);
}

export function formatRecommendations(locations: ScoredLocation[]): Recommendation[] {
  const routeScoresByLocation = buildMaterialRouteScores(locations);
  addComparisons(locations, routeScoresByLocation);

  return [...locations].sort(compareRecommendationLocations).map((location) => {
    const names = location.coveredRequirements.map((requirement) => requirement.displayName);
    const routeScores = [...(routeScoresByLocation.get(location.locationKey) ?? [])].sort(compareRouteScores);
    const routeTargetabilityScore = routeScores.length > 0
      ? roundScore(routeScores.reduce((sum, score) => sum + score.overallTargetabilityScore, 0) / routeScores.length)
      : undefined;
    const reason = names.length > 0
      ? `Covers ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` +${names.length - 3} more` : ""} via ${spawnTypeLabel(location.spawnType)}.`
      : `Indexed resources available via ${spawnTypeLabel(location.spawnType)}.`;
    return {
      locationKey: location.locationKey,
      locationName: location.locationName,
      locationKind: location.locationKind,
      systemName: location.systemName,
      matchedLocationCodes: location.matchedLocationCodes,
      spawnType: location.spawnType,
      nearbyStations: location.nearbyStations,
      materials: location.materials,
      indexedResources: location.indexedResources,
      score: Number(location.score.toFixed(6)),
      routeTargetabilityScore,
      routeTargetabilityLabel: routeTargetabilityScore === undefined ? undefined : labelForScore(routeTargetabilityScore),
      routeScores,
      reason,
      requiredMaterials: location.coveredRequirements.map((requirement) => ({
        materialId: requirement.materialId,
        materialName: requirement.materialName,
        displayName: requirement.displayName,
        materialKey: requirement.materialKey,
        normalizedName: requirement.normalizedName,
        slug: requirement.slug,
        requiredQuantity: requirement.requiredQuantity,
        selectedQuality: requirement.selectedQuality,
        unitType: requirement.unitType,
        displayQuantity: formatRequirementQuantity(requirement.requiredQuantity, requirement.unitType),
      })),
    };
  });
}
