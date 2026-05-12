import type { AggregatedRequirement, RequirementInput, RecommenderWarning } from "./recommender.types";
import { canonicalMaterialDisplayName, canonicalMaterialKey } from "./materialResolver";
import { addWarning } from "./recommenderWarnings";

export function aggregateRequirements(
  requirements: RequirementInput[],
  warnings: RecommenderWarning[],
): AggregatedRequirement[] {
  const byMaterial = new Map<string, AggregatedRequirement>();

  for (const requirement of requirements) {
    const materialKey = requirement.materialKey?.trim() || requirement.materialId?.trim() || requirement.slug?.trim() || requirement.materialName?.trim();
    const materialId = requirement.materialId?.trim() || materialKey;
    const inputDisplayName = requirement.displayName?.trim() || requirement.materialName?.trim() || materialId;
    const canonicalDisplayName = canonicalMaterialDisplayName(inputDisplayName);
    const displayName = canonicalMaterialKey(inputDisplayName) === "quantanium" ? canonicalDisplayName : inputDisplayName;
    const materialName = canonicalMaterialKey(requirement.materialName ?? displayName) === "quantanium"
      ? canonicalDisplayName
      : requirement.materialName?.trim() || displayName;
    if (!materialKey || !materialId || !materialName || !displayName) {
      addWarning(warnings, {
        code: "requirement_missing_material",
        message: "Requirement is missing materialId/materialName and was skipped.",
      });
      continue;
    }
    const normalizedName = requirement.normalizedName?.trim() || displayName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const slug = requirement.slug?.trim() || displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    const selectedQuality = requirement.selectedQuality ?? requirement.usedBy?.find((entry) => entry.selectedQuality !== undefined)?.selectedQuality;
    const unitType = requirement.unitType ?? requirement.usedBy?.find((entry) => entry.unitType)?.unitType;
    const existing = byMaterial.get(materialKey);
    if (existing) {
      existing.requiredQuantity += requirement.requiredQuantity;
      if (selectedQuality !== undefined) existing.selectedQuality = selectedQuality;
      if (unitType) existing.unitType = unitType;
      continue;
    }
    byMaterial.set(materialKey, {
      materialKey,
      materialId,
      materialName,
      displayName,
      normalizedName,
      slug,
      requiredQuantity: requirement.requiredQuantity,
      selectedQuality,
      unitType,
    });
  }

  return Array.from(byMaterial.values()).filter((entry) => entry.requiredQuantity > 0);
}
