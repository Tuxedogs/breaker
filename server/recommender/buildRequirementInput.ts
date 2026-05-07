import type { RecommendRequest, RequirementInput } from "./recommender.types";

export function buildRequirementInput(request: RecommendRequest): RequirementInput[] {
  if (Array.isArray(request.requiredMaterials)) return request.requiredMaterials;
  if (Array.isArray(request.materialRequirements)) return request.materialRequirements;
  if (Array.isArray(request.buildQueue)) {
    return request.buildQueue.flatMap((item) => item.requiredMaterials ?? []);
  }
  return [];
}
