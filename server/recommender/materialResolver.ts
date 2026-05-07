import type { AggregatedRequirement, MaterialSourceGroup, RecommenderWarning } from "./recommender.types";
import { addWarning } from "./recommenderWarnings";

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function findMaterialGroup(
  requirement: AggregatedRequirement,
  groups: MaterialSourceGroup[],
  warnings: RecommenderWarning[],
): MaterialSourceGroup | null {
  const byId = groups.find((group) => group.materialId === requirement.materialId);
  if (byId) return byId;
  const byName = groups.find((group) => normalize(group.materialName) === normalize(requirement.materialName));
  if (byName) return byName;

  addWarning(warnings, {
    code: "material_sources_missing",
    message: `No API source group found for ${requirement.materialName}.`,
    materialId: requirement.materialId,
    materialName: requirement.materialName,
    path: "public/api/recommendations/material_source_scores.json:materials",
  });
  return null;
}
