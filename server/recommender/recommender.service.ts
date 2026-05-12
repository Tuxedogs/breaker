import { aggregateRequirements } from "./aggregateRequirements";
import { buildRequirementInput } from "./buildRequirementInput";
import { formatRecommendations } from "./formatRecommendations";
import { loadApiData } from "./loadApiData";
import { buildIndexedBrowseLocations, scoreLocations } from "./scoreLocations";
import type { RecommendRequest, RecommendResponse, RecommenderWarning } from "./recommender.types";
import { addWarning } from "./recommenderWarnings";

export async function getAllIndexedLocations(): Promise<{ locations: ReturnType<typeof formatRecommendations>; warnings: RecommenderWarning[] }> {
  const warnings: RecommenderWarning[] = [];
  const apiData = await loadApiData(warnings);
  return {
    locations: formatRecommendations(buildIndexedBrowseLocations(apiData, warnings, Infinity)),
    warnings,
  };
}

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
      recommendations: formatRecommendations(buildIndexedBrowseLocations(apiData, warnings)),
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
