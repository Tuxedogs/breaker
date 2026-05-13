import type { AggregatedRequirement, ApiSource, MaterialRouteScore, Recommendation, RouteTargetabilityLabel, ScoredLocation } from "./recommender.types";
import { formatRequirementQuantity } from "../shared/quantityFormatter";
import { canonicalMaterialDisplayName, canonicalMaterialKey } from "./materialResolver";

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

function percentSignal(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return clampScore(value <= 1 ? value * 100 : value);
}

function providerWeightedSignal(source: ApiSource): number | null {
  if (typeof source.probability === "number" && Number.isFinite(source.probability)) return source.probability;

  const groupProbability = source.groupProbability;
  const relativeProbability = source.relativeProbability;
  const materialProbability = source.materialProbability;
  if (
    typeof groupProbability !== "number" ||
    typeof relativeProbability !== "number" ||
    typeof materialProbability !== "number" ||
    !Number.isFinite(groupProbability) ||
    !Number.isFinite(relativeProbability) ||
    !Number.isFinite(materialProbability)
  ) {
    return null;
  }

  return (groupProbability * relativeProbability * materialProbability) / 10000;
}

function materialBiasSignal(source: ApiSource): number | null {
  const relativeProbability = source.relativeProbability;
  const materialProbability = source.materialProbability;
  if (
    typeof relativeProbability !== "number" ||
    typeof materialProbability !== "number" ||
    !Number.isFinite(relativeProbability) ||
    !Number.isFinite(materialProbability)
  ) {
    return null;
  }

  return relativeProbability * materialProbability;
}

function selectedQualityScore(source: ApiSource, selectedQuality: number | undefined): number | undefined {
  if (selectedQuality === undefined) return undefined;
  return percentSignal(source.quality?.thresholdChances?.[String(selectedQuality)]);
}

function sourceStrengthScore(source: ApiSource): number {
  const overall = percentSignal(source.overallScore);
  if (overall !== undefined) return overall;

  const probability = percentSignal(source.probability) ?? 0;
  const relativeProbability = percentSignal(source.relativeProbability) ?? 0;
  const groupProbability = percentSignal(source.groupProbability) ?? 0;
  const materialProbability = percentSignal(source.materialProbability) ?? 0;

  return clampScore(
    probability * 0.35 +
      relativeProbability * 0.3 +
      groupProbability * 0.2 +
      materialProbability * 0.15,
  );
}

function labelForScore(score: number): RouteTargetabilityLabel {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Good";
  if (score >= 30) return "Weak";
  return "Poor";
}

function qualityMatters(requirement: AggregatedRequirement, source: ApiSource): boolean {
  return canonicalMaterialKey(
    source.canonicalMaterialName ??
      source.materialName ??
      requirement.displayName ??
      requirement.materialName,
  ) !== "quantanium";
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

type SignalScore = {
  score: number | null;
  fieldsUsed: string[];
  missingComponents: string[];
};

type QualitySignal = SignalScore & {
  ignored: boolean;
  thresholdChance: number | null;
};

type EncounterSignal = SignalScore & {
  proxy: boolean;
};

function qualitySignal(source: ApiSource, requirement: AggregatedRequirement): QualitySignal {
  if (!qualityMatters(requirement, source)) {
    return {
      score: null,
      ignored: true,
      thresholdChance: null,
      fieldsUsed: [],
      missingComponents: [],
    };
  }

  const thresholdChance = selectedQualityScore(source, requirement.selectedQuality);
  if (thresholdChance === undefined) {
    return {
      score: null,
      ignored: false,
      thresholdChance: null,
      fieldsUsed: [],
      missingComponents: ["quality.thresholdChances[selectedQuality]"],
    };
  }

  return {
    score: thresholdChance,
    ignored: false,
    thresholdChance,
    fieldsUsed: ["quality.thresholdChances[selectedQuality]"],
    missingComponents: [],
  };
}

function compositionSignal(source: ApiSource): SignalScore & { average: number | null; max: number | null } {
  const average = percentSignal(compositionAverage(source));
  const max = percentSignal(source.composition?.maxPercentage);
  const fieldsUsed: string[] = [];
  const missingComponents: string[] = [];

  if (average !== undefined) fieldsUsed.push("composition.averagePercentage");
  else missingComponents.push("composition.averagePercentage");
  if (max !== undefined) fieldsUsed.push("composition.maxPercentage");
  else missingComponents.push("composition.maxPercentage");

  if (average === undefined && max === undefined) {
    return { score: null, average: null, max: null, fieldsUsed, missingComponents };
  }

  return {
    score: clampScore((average ?? 0) * 0.65 + (max ?? 0) * 0.35),
    average: average ?? null,
    max: max ?? null,
    fieldsUsed,
    missingComponents,
  };
}

function sourceRowCountScore(sourceRowCount: number): number {
  return clampScore((Math.min(sourceRowCount, 5) / 5) * 100);
}

function encounterSignal(source: ApiSource, sourceRowCount: number): EncounterSignal {
  const weightedSignals: Array<{ value: number | undefined; weight: number; field: string }> = [
    { value: percentSignal(source.probability), weight: 0.35, field: "probability" },
    { value: percentSignal(source.relativeProbability), weight: 0.35, field: "relativeProbability" },
    { value: percentSignal(source.groupProbability), weight: 0.2, field: "groupProbability" },
    { value: sourceRowCountScore(sourceRowCount), weight: 0.1, field: "sourceRowCount" },
  ];

  let score = 0;
  const fieldsUsed: string[] = [];
  const missingComponents: string[] = [];
  for (const signal of weightedSignals) {
    if (signal.value === undefined) {
      missingComponents.push(signal.field);
      continue;
    }
    score += signal.value * signal.weight;
    fieldsUsed.push(signal.field);
  }

  if (fieldsUsed.length === 0) {
    return { score: null, proxy: true, fieldsUsed, missingComponents };
  }

  return {
    score: clampScore(score),
    proxy: true,
    fieldsUsed,
    missingComponents,
  };
}

function confidenceScore(signals: Array<SignalScore | QualitySignal | EncounterSignal>): number {
  const used = signals.reduce((total, signal) => total + signal.fieldsUsed.length, 0);
  const missing = signals.reduce((total, signal) => total + signal.missingComponents.length, 0);
  if (used + missing === 0) return 0;
  return roundScore((used / (used + missing)) * 100);
}

function recommendationScore(
  encounter: number | null,
  quality: QualitySignal,
  confidence: number,
): number {
  const encounterScore = encounter ?? 0;
  if (quality.ignored) {
    return clampScore(encounterScore * 0.85 + confidence * 0.15);
  }

  return clampScore(encounterScore * 0.6 + (quality.score ?? 0) * 0.25 + confidence * 0.15);
}

function buildRouteSignals(
  source: ApiSource,
  requirement: AggregatedRequirement,
  sourceRowCount: number,
): {
  quality: QualitySignal;
  composition: ReturnType<typeof compositionSignal>;
  encounter: EncounterSignal;
  confidence: number;
  recommendation: number;
  missingComponents: string[];
  sourceFieldsUsed: string[];
  sourceStrength: number;
} {
  const quality = qualitySignal(source, requirement);
  const composition = compositionSignal(source);
  const encounter = encounterSignal(source, sourceRowCount);
  const sourceStrength = sourceStrengthScore(source);
  const confidence = confidenceScore([quality, composition, encounter]);
  const recommendation = recommendationScore(encounter.score, quality, confidence);
  const sourceFieldsUsed = Array.from(new Set([
    ...quality.fieldsUsed,
    ...composition.fieldsUsed,
    ...encounter.fieldsUsed,
  ]));
  const missingComponents = Array.from(new Set([
    ...quality.missingComponents,
    ...composition.missingComponents,
    ...encounter.missingComponents,
  ]));

  return {
    quality,
    composition,
    encounter,
    confidence,
    recommendation,
    missingComponents,
    sourceFieldsUsed,
    sourceStrength,
  };
}

function routeCanonicalMaterialName(source: ApiSource, requirement: AggregatedRequirement): string {
  return canonicalMaterialDisplayName(source.canonicalMaterialName ?? source.materialName ?? requirement.displayName);
}

function routeSourceRowCount(location: ScoredLocation, requirement: AggregatedRequirement): number {
  return Math.max(1, location.bestSources.filter((source) => sourceBelongsToRequirement(source, requirement)).length);
}

function routeSignalsPayload(args: {
  source: ApiSource;
  requirement: AggregatedRequirement;
  locationName: string;
  qualityRouteScore: number | null;
  yieldRouteScore: number;
  overallTargetabilityScore: number;
  competingSources: number;
  sourceRowCount: number;
  built: ReturnType<typeof buildRouteSignals>;
}): MaterialRouteScore["signals"] {
  const { source, requirement, locationName, qualityRouteScore, yieldRouteScore, overallTargetabilityScore, competingSources, built } = args;
  return {
    qualityFit: qualityRouteScore,
    yieldPotential: yieldRouteScore,
    sourceWeight: roundScore(built.sourceStrength),
    routeTargetability: overallTargetabilityScore,
    competingSources,
    materialName: requirement.displayName,
    canonicalMaterialName: routeCanonicalMaterialName(source, requirement),
    locationName,
    qualityChance: built.quality.score,
    qualityIgnored: built.quality.ignored,
    compositionScore: built.composition.score,
    encounterScore: built.encounter.score,
    proxyEncounterScore: built.encounter.proxy,
    recommendationScore: overallTargetabilityScore,
    selectedQuality: requirement.selectedQuality,
    thresholdChance: built.quality.thresholdChance,
    compositionAverage: built.composition.average,
    compositionMax: built.composition.max,
    probability: percentSignal(source.probability) ?? null,
    groupProbability: percentSignal(source.groupProbability) ?? null,
    relativeProbability: percentSignal(source.relativeProbability) ?? null,
    materialProbability: percentSignal(source.materialProbability) ?? null,
    providerWeightedSignal: providerWeightedSignal(source),
    materialBiasSignal: materialBiasSignal(source),
    normalizedWithinMethodSignal: null,
    sourceStrength: roundScore(built.sourceStrength),
    sourceRowCount: args.sourceRowCount,
    confidence: built.confidence,
    missingComponents: built.missingComponents,
    sourceFieldsUsed: built.sourceFieldsUsed,
  };
}

function makeReasons(route: {
  qualityRouteScore: number | null;
  yieldRouteScore: number;
  demandMatchScore: number;
  competingSources: number;
}): string[] {
  const reasons: string[] = [];
  if (route.qualityRouteScore !== null && route.qualityRouteScore >= 70) reasons.push("higher quality fit");
  if (route.yieldRouteScore >= 70) reasons.push("better encounter opportunity");
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
    locationName: string;
    requirement: AggregatedRequirement;
    source: ApiSource;
    signals: ReturnType<typeof buildRouteSignals>;
    rawDemand: number;
    competingSources: number;
    sourceRowCount: number;
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
      const sourceRowCount = routeSourceRowCount(location, requirement);
      const signals = buildRouteSignals(source, requirement, sourceRowCount);
      rawRoutes.push({
        locationKey: location.locationKey,
        locationName: location.locationName,
        requirement,
        source,
        signals,
        rawDemand: Math.log10(requirement.requiredQuantity + 10) * 25,
        competingSources: sourceCounts.get(requirement.materialKey) ?? 1,
        sourceRowCount,
      });
    }
  }

  const maxDemandByMaterial = new Map<string, number>();
  for (const route of rawRoutes) {
    const currentDemand = maxDemandByMaterial.get(route.requirement.materialKey) ?? 0;
    maxDemandByMaterial.set(route.requirement.materialKey, Math.max(currentDemand, route.rawDemand));
  }

  const byLocation = new Map<string, MaterialRouteScore[]>();
  for (const route of rawRoutes) {
    const maxDemand = maxDemandByMaterial.get(route.requirement.materialKey) ?? 0;
    const qualityRouteScore = route.signals.quality.score === null ? null : roundScore(route.signals.quality.score);
    const yieldRouteScore = roundScore(route.signals.composition.score ?? 0);
    const demandMatchScore = roundScore(maxDemand > 0 ? (route.rawDemand / maxDemand) * 100 : 0);
    const overallTargetabilityScore = roundScore(route.signals.recommendation);
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
      signals: routeSignalsPayload({
        source: route.source,
        requirement: route.requirement,
        locationName: route.locationName,
        qualityRouteScore,
        yieldRouteScore,
        overallTargetabilityScore,
        competingSources: route.competingSources,
        sourceRowCount: route.sourceRowCount,
        built: route.signals,
      }),
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
