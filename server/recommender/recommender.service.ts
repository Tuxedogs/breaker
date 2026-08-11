import { aggregateRequirements } from "./aggregateRequirements.js";
import { buildRequirementInput } from "./buildRequirementInput.js";
import { formatRecommendations } from "./formatRecommendations.js";
import { loadApiData } from "./loadApiData.js";
import { scoreLocations } from "./scoreLocations.js";
import type { RecommendRequest, RecommendResponse, RecommenderWarning } from "./recommender.types.js";
import { addWarning } from "./recommenderWarnings.js";

export async function getRecommendations(request: RecommendRequest): Promise<RecommendResponse> {
  const warnings: RecommenderWarning[] = [];
  const apiData = await loadApiData(warnings);
  const requirements = aggregateRequirements(buildRequirementInput(request), warnings);

  if (requirements.length === 0) {
    addWarning(warnings, {
      code: "requirements_empty",
      message: "No material requirements were provided to the recommender.",
    });
    return {
      recommendations: [],
      warnings,
      diagnostics: { materialCoverage: [] },
    };
  }

  const scored = scoreLocations(requirements, apiData, warnings);

  return {
    recommendations: formatRecommendations(scored.locations),
    warnings,
    diagnostics: {
      materialCoverage: scored.diagnostics,
      scoreContributions: scored.scoreContributions,
    },
  };
}
