import type { ApiSource, MaterialSourceGroup, RecommenderWarning } from "./recommender.types";
import { addWarning } from "./recommenderWarnings";

export function resolveSources(group: MaterialSourceGroup, warnings: RecommenderWarning[]): ApiSource[] {
  const sources = group.bestSources ?? group.sources ?? [];
  if (sources.length === 0) {
    addWarning(warnings, {
      code: "material_sources_empty",
      message: `No source rows were available for ${group.materialName ?? group.materialId ?? "unknown material"}.`,
      materialId: group.materialId,
      materialName: group.materialName,
    });
  }
  return sources;
}
