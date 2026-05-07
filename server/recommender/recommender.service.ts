import { aggregateRequirements } from "./aggregateRequirements";
import { buildRequirementInput } from "./buildRequirementInput";
import { formatRecommendations } from "./formatRecommendations";
import { loadApiData } from "./loadApiData";
import { scoreLocations } from "./scoreLocations";
import type { RecommendRequest, RecommendResponse, RecommenderWarning } from "./recommender.types";
import { addWarning } from "./recommenderWarnings";

export async function getRecommendations(request: RecommendRequest): Promise<RecommendResponse> {
  const warnings: RecommenderWarning[] = [];
  const apiData = await loadApiData(warnings);
  const requirements = aggregateRequirements(buildRequirementInput(request), warnings);

  if (requirements.length === 0) {
    addWarning(warnings, {
      code: "requirements_empty",
      message: "No material requirements were provided to the recommender.",
    });
    return { recommendations: [], warnings };
  }

  return {
    recommendations: formatRecommendations(scoreLocations(requirements, apiData, warnings)),
    warnings,
  };
}
