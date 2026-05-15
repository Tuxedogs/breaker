import type {
  AggregatedRequirement,
  MaterialCoverageDiagnostic,
  RecommenderApiData,
  RecommenderWarning,
  ScoreContributionDiagnostic,
  ScoredLocation,
} from "./recommender.types";
import { resolveLocation } from "./locationResolver";
import { canonicalMaterialDisplayName, canonicalMaterialKey, findMaterialGroup } from "./materialResolver";
import { resolveSources } from "./sourceResolver";
import { addWarning } from "./recommenderWarnings";
import { miningLocationMergeKey } from "./locationNormalization";

function qualityFit(requirement: AggregatedRequirement, sourceQuality?: Record<string, unknown>): number {
  if (requirement.selectedQuality === undefined) return 1;
  const chances = sourceQuality?.thresholdChances as Record<string, number> | undefined;
  const chance = chances?.[String(requirement.selectedQuality)];
  if (typeof chance === "number") return chance;
  return 0.5;
}

function thresholdChanceFor(requirement: AggregatedRequirement, sourceQuality?: Record<string, unknown>): number | undefined {
  if (requirement.selectedQuality === undefined) return undefined;
  const chances = sourceQuality?.thresholdChances as Record<string, number> | undefined;
  const chance = chances?.[String(requirement.selectedQuality)];
  return typeof chance === "number" ? chance : undefined;
}

function fallbackSourceScore(source: Record<string, unknown>): number {
  const probability = typeof source.probability === "number" ? source.probability : 0;
  const relativeProbability = typeof source.relativeProbability === "number" ? source.relativeProbability : 0;
  const groupProbability = typeof source.groupProbability === "number" ? source.groupProbability : 0;

  return probability + (relativeProbability / 1000) + (groupProbability / 10000);
}

function miningTypeFromSpawn(spawnType: string): string {
  const normalized = spawnType.toLowerCase();
  if (normalized.includes("ground")) return "Ground Vehicle";
  if (normalized.includes("hand") || normalized.includes("fps")) return "Hand";
  if (normalized.includes("ship") || normalized === "mineable") return "Ship";
  if (normalized.includes("harvest")) return "Harvestable";
  if (normalized.includes("mixed")) return "Mixed";
  return "Other/Unknown";
}

function materialNeedKey(requirement: AggregatedRequirement): string {
  return `${requirement.materialKey}|${requirement.selectedQuality ?? "any"}|${requirement.unitType ?? ""}`;
}

function sourceResourceKeys(source: Record<string, unknown>, group: { materialId?: string; materialName?: string }): string[] {
  return [
    group.materialId,
    group.materialName,
    source.materialId,
    source.materialName,
    source.harvestableName,
    source.mineableEntity,
    source.compositionName,
    source.entityClass,
    source.providerName,
    source.groupName,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
}

function physicalLocationKey(location: { systemName: string; locationName: string }): string {
  return miningLocationMergeKey(location.systemName, location.locationName);
}

function mergeSpawnType(current: string, next: string): string {
  if (current === next) return current;
  if (current === "unknown") return next;
  if (next === "unknown") return current;
  return "mixed";
}

function mergeMatchedLocationCodes(current: string[] | undefined, next: string[] | undefined): string[] | undefined {
  const merged = Array.from(new Set([...(current ?? []), ...(next ?? [])])).sort();
  return merged.length > 0 ? merged : undefined;
}

function addIndexedResource(
  resourcesByLocation: Map<string, ScoredLocation["indexedResources"]>,
  locationKey: string,
  resource: ScoredLocation["indexedResources"][number],
): void {
  const resources = resourcesByLocation.get(locationKey) ?? [];
  const existing = resources.find((entry) =>
    (entry.materialId ?? "") === (resource.materialId ?? "") &&
    entry.materialName === resource.materialName
  );
  if (existing) {
    existing.miningType = mergeSpawnType(existing.miningType, resource.miningType);
  } else {
    resources.push(resource);
  }
  resourcesByLocation.set(locationKey, resources);
}

function buildIndexedResources(
  apiData: RecommenderApiData,
  warnings: RecommenderWarning[],
): Map<string, ScoredLocation["indexedResources"]> {
  const resourcesByLocation = new Map<string, ScoredLocation["indexedResources"]>();
  const seen = new Set<string>();

  for (const group of apiData.materialGroups) {
    const materialName = group.materialName ?? group.materialId;
    if (!materialName) continue;
    for (const source of resolveSources(group, warnings)) {
      const location = resolveLocation(source, apiData, warnings);
      const locationKey = physicalLocationKey(location);
      const resourceKey = `${locationKey}|${group.materialId ?? ""}|${materialName}`.toLowerCase();
      if (seen.has(resourceKey)) continue;
      seen.add(resourceKey);

      addIndexedResource(resourcesByLocation, locationKey, {
        materialId: group.materialId,
        materialName,
        miningType: miningTypeFromSpawn(location.spawnType),
      });
    }
  }

  for (const resources of resourcesByLocation.values()) {
    resources.sort((left, right) =>
      left.miningType.localeCompare(right.miningType) || left.materialName.localeCompare(right.materialName)
    );
  }

  return resourcesByLocation;
}

function pickCoverageAwareLocations(locations: ScoredLocation[], requirements: AggregatedRequirement[], limit: number): ScoredLocation[] {
  const sourceCounts = new Map<string, number>();
  for (const requirement of requirements) {
    const needKey = materialNeedKey(requirement);
    sourceCounts.set(needKey, locations.filter((location) =>
      location.coveredRequirements.some((entry) => materialNeedKey(entry) === needKey)
    ).length);
  }

  const scarcityScore = (location: ScoredLocation) =>
    location.coveredRequirements.reduce((total, requirement) => {
      const count = sourceCounts.get(materialNeedKey(requirement)) ?? (locations.length || 1);
      return total + 1 / count;
    }, 0);

  const sorted = [...locations].sort((left, right) =>
    right.coveredRequirements.length - left.coveredRequirements.length ||
    scarcityScore(right) - scarcityScore(left) ||
    right.score - left.score
  );
  const selected: ScoredLocation[] = [];
  const selectedKeys = new Set<string>();
  const coveredNeeds = new Set<string>();

  const addLocation = (location: ScoredLocation) => {
    if (selectedKeys.has(location.locationKey)) return;
    selected.push(location);
    selectedKeys.add(location.locationKey);
    for (const requirement of location.coveredRequirements) coveredNeeds.add(materialNeedKey(requirement));
  };

  for (const requirement of [...requirements].sort((left, right) =>
    (sourceCounts.get(materialNeedKey(left)) ?? 0) - (sourceCounts.get(materialNeedKey(right)) ?? 0)
  )) {
    if (selected.length >= limit) break;
    const needKey = materialNeedKey(requirement);
    if (coveredNeeds.has(needKey)) continue;
    const bestCoveringLocation = sorted
      .filter((location) =>
      !selectedKeys.has(location.locationKey) &&
      location.coveredRequirements.some((entry) => materialNeedKey(entry) === needKey)
      )
      .sort((left, right) =>
        right.coveredRequirements.length - left.coveredRequirements.length ||
        scarcityScore(right) - scarcityScore(left) ||
        right.score - left.score
      )[0];
    if (bestCoveringLocation) addLocation(bestCoveringLocation);
  }

  for (const location of sorted) {
    if (selected.length >= limit) break;
    addLocation(location);
  }

  return selected;
}

export function scoreLocations(
  requirements: AggregatedRequirement[],
  apiData: RecommenderApiData,
  warnings: RecommenderWarning[],
): { locations: ScoredLocation[]; diagnostics: MaterialCoverageDiagnostic[]; scoreContributions: ScoreContributionDiagnostic[] } {
  const locations = new Map<string, ScoredLocation>();
  const diagnostics: MaterialCoverageDiagnostic[] = [];
  const scoreContributions: ScoreContributionDiagnostic[] = [];
  const indexedResourcesByLocation = buildIndexedResources(apiData, warnings);

  for (const requirement of requirements) {
    const group = findMaterialGroup(requirement, apiData.materialGroups, warnings);
    if (!group) {
      diagnostics.push({
        materialKey: requirement.materialKey,
        materialId: requirement.materialId,
        displayName: requirement.displayName,
        unitType: requirement.unitType,
        sourceCount: 0,
        candidateLocations: [],
        matchingResourceKeys: [],
      });
      continue;
    }

    const sources = resolveSources(group, warnings);
    const materialDiagnostics: MaterialCoverageDiagnostic = {
      materialKey: requirement.materialKey,
      materialId: requirement.materialId,
      displayName: requirement.displayName,
      unitType: requirement.unitType,
      sourceCount: sources.length,
      candidateLocations: [],
      matchingResourceKeys: Array.from(new Set(sources.flatMap((source) => sourceResourceKeys(source as Record<string, unknown>, group)))),
    };
    diagnostics.push(materialDiagnostics);

    for (const source of sources) {
      const location = resolveLocation(source, apiData, warnings);
      const key = physicalLocationKey(location);
      materialDiagnostics.candidateLocations.push({
        locationKey: key,
        locationName: location.locationName,
        systemName: location.systemName,
        spawnType: location.spawnType,
        miningType: miningTypeFromSpawn(location.spawnType),
      });
      materialDiagnostics.miningType ??= miningTypeFromSpawn(location.spawnType);
      const compositionAverageUsed = source.composition?.averagePercentage ?? source.composition?.maxPercentage;
      const compositionMaxUsed = source.composition?.maxPercentage;
      const compositionMissing = compositionAverageUsed === undefined;
      const thresholdChanceUsed = thresholdChanceFor(requirement, source.quality);
      const thresholdDataMissing = requirement.selectedQuality !== undefined && !source.quality?.thresholdChances;
      if (compositionMissing) {
        addWarning(warnings, {
          code: "source_composition_missing",
          message: `Composition percentage is missing for ${requirement.materialName} at ${location.locationName}.`,
          materialId: requirement.materialId,
          materialName: requirement.materialName,
        });
      }
      if (thresholdDataMissing) {
        addWarning(warnings, {
          code: "source_quality_thresholds_missing",
          message: `Quality threshold chances are missing for ${requirement.materialName}; selected quality was preserved but partially scored.`,
          materialId: requirement.materialId,
          materialName: requirement.materialName,
        });
      }

      const baseScore = source.overallScore ?? fallbackSourceScore(source as Record<string, unknown>);
      const requirementWeight = Math.log10(requirement.requiredQuantity + 10);
      const qualityFitResult = qualityFit(requirement, source.quality);
      const score = (baseScore + (compositionAverageUsed ?? 0) / 100) * qualityFitResult * requirementWeight;
      const scoreDiagnostic: ScoreContributionDiagnostic = {
        materialKey: requirement.materialKey,
        materialId: requirement.materialId,
        materialName: requirement.materialName,
        displayName: requirement.displayName,
        locationKey: key,
        locationName: location.locationName,
        systemName: location.systemName,
        baseScore,
        overallScore: source.overallScore,
        compositionAverageUsed,
        compositionMaxUsed,
        selectedQuality: requirement.selectedQuality,
        thresholdChanceUsed,
        qualityFit: qualityFitResult,
        requirementWeight,
        finalContribution: score,
        compositionMissing,
        thresholdDataMissing,
        sourceResolverPath: source.sourceResolverPath,
        perLocationOverrideApplied: source.perLocationOverrideApplied ?? false,
        overrideFieldsApplied: source.overrideFieldsApplied ?? [],
        sourceLocationRawName: source.sourceLocationRawName ?? source.location ?? source.providerName,
        sourceLocationKey: source.sourceLocationKey,
        materialKeyResolved: source.materialKeyResolved ?? canonicalMaterialKey(source.materialName ?? requirement.materialName),
        materialAliasApplied: source.materialAliasApplied ?? canonicalMaterialKey(requirement.materialName) !== canonicalMaterialKey(source.originalMaterialName ?? source.materialName ?? requirement.materialName),
        originalMaterialName: source.originalMaterialName ?? source.materialName,
        originalMaterialKey: source.originalMaterialKey ?? source.materialId,
        canonicalMaterialName: source.canonicalMaterialName ?? canonicalMaterialDisplayName(requirement.materialName),
        canonicalMaterialKey: source.canonicalMaterialKey ?? canonicalMaterialKey(requirement.materialName),
      };
      scoreContributions.push(scoreDiagnostic);
      const existing = locations.get(key);
      if (existing) {
        existing.score += score;
        existing.spawnType = mergeSpawnType(existing.spawnType, location.spawnType);
        existing.matchedLocationCodes = mergeMatchedLocationCodes(existing.matchedLocationCodes, location.matchedLocationCodes);
        if (!existing.materials.includes(requirement.displayName)) existing.materials.push(requirement.displayName);
        if (!existing.coveredRequirements.some((entry) => entry.materialKey === requirement.materialKey)) {
          existing.coveredRequirements.push(requirement);
        }
        existing.bestSources.push(source);
        existing.scoreDiagnostics = [...(existing.scoreDiagnostics ?? []), scoreDiagnostic];
      } else {
        locations.set(key, {
          locationKey: key,
          ...location,
          materials: [requirement.displayName],
          indexedResources: indexedResourcesByLocation.get(physicalLocationKey(location)) ?? [{
            materialId: requirement.materialId,
            materialName: requirement.displayName,
            miningType: miningTypeFromSpawn(location.spawnType),
          }],
          score,
          coveredRequirements: [requirement],
          bestSources: [source],
          scoreDiagnostics: [scoreDiagnostic],
        });
      }
    }
  }

  return {
    locations: pickCoverageAwareLocations(Array.from(locations.values()), requirements, 24),
    diagnostics,
    scoreContributions,
  };
}
