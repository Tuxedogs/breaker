import type { Recommendation, ScoredLocation } from "./recommender.types";
import { formatRequirementQuantity } from "../shared/quantityFormatter";

function spawnTypeLabel(spawnType: string): string {
  const normalized = spawnType.toLowerCase();
  if (normalized.includes("ship") || normalized === "mineable") return "ship mining";
  if (normalized.includes("surface")) return "surface mining";
  if (normalized.includes("hand") || normalized.includes("fps")) return "hand mining";
  return spawnType.replace(/_/g, " ");
}

export function formatRecommendations(locations: ScoredLocation[]): Recommendation[] {
  return locations.map((location) => {
    const names = location.coveredRequirements.map((requirement) => requirement.materialName);
    return {
      locationKey: location.locationKey,
      locationName: location.locationName,
      locationKind: location.locationKind,
      systemName: location.systemName,
      spawnType: location.spawnType,
      nearbyStations: location.nearbyStations,
      materials: location.materials,
      score: Number(location.score.toFixed(6)),
      reason: `Covers ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` +${names.length - 3} more` : ""} via ${spawnTypeLabel(location.spawnType)}.`,
      requiredMaterials: location.coveredRequirements.map((requirement) => ({
        materialId: requirement.materialId,
        materialName: requirement.materialName,
        requiredQuantity: requirement.requiredQuantity,
        selectedQuality: requirement.selectedQuality,
        unitType: requirement.unitType,
        displayQuantity: formatRequirementQuantity(requirement.requiredQuantity, requirement.unitType),
      })),
    };
  });
}
