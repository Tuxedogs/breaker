import type { AggregatedRequirement, RecommenderApiData, RecommenderWarning, ScoredLocation } from "./recommender.types";
import { resolveLocation } from "./locationResolver";
import { findMaterialGroup } from "./materialResolver";
import { resolveSources } from "./sourceResolver";
import { addWarning } from "./recommenderWarnings";

function qualityFit(requirement: AggregatedRequirement, sourceQuality?: Record<string, unknown>): number {
  if (requirement.selectedQuality === undefined) return 1;
  const chances = sourceQuality?.thresholdChances as Record<string, number> | undefined;
  const chance = chances?.[String(requirement.selectedQuality)];
  if (typeof chance === "number") return chance;
  return 0.5;
}

export function scoreLocations(
  requirements: AggregatedRequirement[],
  apiData: RecommenderApiData,
  warnings: RecommenderWarning[],
): ScoredLocation[] {
  const locations = new Map<string, ScoredLocation>();

  for (const requirement of requirements) {
    const group = findMaterialGroup(requirement, apiData.materialGroups, warnings);
    if (!group) continue;

    for (const source of resolveSources(group, warnings)) {
      const location = resolveLocation(source, apiData, warnings);
      const key = `${location.systemName}|${location.locationName}|${location.spawnType}`;
      const composition = source.composition?.averagePercentage ?? source.composition?.maxPercentage;
      if (composition === undefined) {
        addWarning(warnings, {
          code: "source_composition_missing",
          message: `Composition percentage is missing for ${requirement.materialName} at ${location.locationName}.`,
          materialId: requirement.materialId,
          materialName: requirement.materialName,
        });
      }
      if (!source.quality?.thresholdChances && requirement.selectedQuality !== undefined) {
        addWarning(warnings, {
          code: "source_quality_thresholds_missing",
          message: `Quality threshold chances are missing for ${requirement.materialName}; selected quality was preserved but partially scored.`,
          materialId: requirement.materialId,
          materialName: requirement.materialName,
        });
      }

      const baseScore = source.overallScore ?? 0;
      const requirementWeight = Math.log10(requirement.requiredQuantity + 10);
      const score = (baseScore + (composition ?? 0) / 100) * qualityFit(requirement, source.quality) * requirementWeight;
      const existing = locations.get(key);
      if (existing) {
        existing.score += score;
        if (!existing.materials.includes(requirement.materialName)) existing.materials.push(requirement.materialName);
        if (!existing.coveredRequirements.some((entry) => entry.materialId === requirement.materialId)) {
          existing.coveredRequirements.push(requirement);
        }
        existing.bestSources.push(source);
      } else {
        locations.set(key, {
          locationKey: key,
          ...location,
          materials: [requirement.materialName],
          score,
          coveredRequirements: [requirement],
          bestSources: [source],
        });
      }
    }
  }

  return Array.from(locations.values()).sort((left, right) => right.score - left.score).slice(0, 4);
}
