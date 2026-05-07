import type { AggregatedRequirement, RequirementInput, RecommenderWarning } from "./recommender.types";
import { addWarning } from "./recommenderWarnings";

export function aggregateRequirements(
  requirements: RequirementInput[],
  warnings: RecommenderWarning[],
): AggregatedRequirement[] {
  const byMaterial = new Map<string, AggregatedRequirement>();

  for (const requirement of requirements) {
    const materialId = requirement.materialId?.trim() || requirement.materialName?.trim();
    const materialName = requirement.materialName?.trim() || materialId;
    if (!materialId || !materialName) {
      addWarning(warnings, {
        code: "requirement_missing_material",
        message: "Requirement is missing materialId/materialName and was skipped.",
      });
      continue;
    }

    const selectedQuality = requirement.selectedQuality ?? requirement.usedBy?.find((entry) => entry.selectedQuality !== undefined)?.selectedQuality;
    const unitType = requirement.unitType ?? requirement.usedBy?.find((entry) => entry.unitType)?.unitType;
    const existing = byMaterial.get(materialId);
    if (existing) {
      existing.requiredQuantity += requirement.requiredQuantity;
      if (selectedQuality !== undefined) existing.selectedQuality = selectedQuality;
      if (unitType) existing.unitType = unitType;
      continue;
    }
    byMaterial.set(materialId, {
      materialId,
      materialName,
      requiredQuantity: requirement.requiredQuantity,
      selectedQuality,
      unitType,
    });
  }

  return Array.from(byMaterial.values()).filter((entry) => entry.requiredQuantity > 0);
}
