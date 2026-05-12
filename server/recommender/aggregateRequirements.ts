import type { AggregatedRequirement, RequirementInput, RecommenderWarning } from "./recommender.types";
import { canonicalMaterialDisplayName, canonicalMaterialKey } from "./materialResolver";
import { addWarning } from "./recommenderWarnings";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function aggregateRequirements(
  requirements: RequirementInput[],
  warnings: RecommenderWarning[],
): AggregatedRequirement[] {
  const byMaterial = new Map<string, AggregatedRequirement>();

  for (const requirement of requirements) {
    const rawMaterialKey = requirement.materialKey?.trim() || requirement.materialId?.trim() || requirement.slug?.trim() || requirement.materialName?.trim();
    const inputDisplayName = requirement.displayName?.trim() || requirement.materialName?.trim() || requirement.materialId?.trim() || rawMaterialKey;
    const rawMaterialKeyResolved = UUID_PATTERN.test(rawMaterialKey ?? "") && inputDisplayName && !UUID_PATTERN.test(inputDisplayName)
      ? inputDisplayName
      : rawMaterialKey;
    const rawMaterialId = requirement.materialId?.trim();
    const rawMaterialIdResolved = UUID_PATTERN.test(rawMaterialId ?? "") && inputDisplayName && !UUID_PATTERN.test(inputDisplayName)
      ? inputDisplayName
      : rawMaterialId || rawMaterialKeyResolved;
    const materialKey = canonicalMaterialKey(rawMaterialKeyResolved);
    const materialId = canonicalMaterialKey(rawMaterialIdResolved);
    const canonicalDisplayName = canonicalMaterialDisplayName(inputDisplayName);
    const displayName = canonicalDisplayName || inputDisplayName;
    const materialName = canonicalMaterialDisplayName(requirement.materialName ?? displayName) || displayName;
    if (UUID_PATTERN.test(rawMaterialKey ?? "") && materialKey === rawMaterialKey?.replace(/[^a-z0-9]/gi, "").toLowerCase()) {
      addWarning(warnings, {
        code: "requirement_material_uuid_unresolved",
        message: `Mining requirement used an unresolved material UUID (${rawMaterialKey}); display may be incomplete.`,
        materialId,
        materialName: displayName,
      });
    }
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
