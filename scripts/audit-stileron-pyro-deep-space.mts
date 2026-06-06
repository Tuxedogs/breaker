import { readFile } from "node:fs/promises";
import { getRecommendations } from "../server/recommender/recommender.service";

const API_ROOT = process.env.SCINTEL_API_ROOT ?? "D:\\scintel\\api";
const STILERON_ID = "9498a080-84c0-41f4-b88f-71942c60c43f";
const requestedThreshold = 900;

async function readJson(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

const enriched = await readJson(`${API_ROOT}\\mining\\material_sources_quality_enriched.json`) as Array<{
  materialName?: string;
  sources?: Array<Record<string, any>>;
}>;
const quantization = await readJson("public/api/crafting/quality_quantization.json") as Array<{
  materialKey: string;
  bands: Array<{ start: string; end: string; mappedValue: string }>;
}>;
const materialGroup = enriched.find((group) => group.materialName === "Stileron");
const candidateRowsBeforeFiltering = materialGroup?.sources ?? [];
const response = await getRecommendations({
  materialRequirements: [{
    materialId: STILERON_ID,
    materialName: "Stileron",
    displayName: "Stileron",
    requiredQuantity: 1,
    selectedQuality: requestedThreshold,
  }],
});
const recommendation = response.recommendations.find((entry) => entry.locationName === "Pyro Deep Space Asteroids");
const routeScore = recommendation?.routeScores?.find((entry) => entry.materialKey === "stileron");
const quantizedBands = quantization.find((row) => row.materialKey === "stileron")?.bands ?? [];
const resolvedQuantizedValues = quantizedBands
  .filter((band) => Number(band.start) >= requestedThreshold)
  .map((band) => Number(band.mappedValue));
const deepSpaceCandidatesBeforeFiltering = candidateRowsBeforeFiltering.filter((source) =>
  source.system === "Pyro" &&
  (source.location === "Pyro Akirocluster" ||
    source.location === "Pyro Deepspaceasteroids" ||
    /^Pyro (?:RAB|RMB)/i.test(String(source.location)))
);

console.log(JSON.stringify({
  requestedMaterial: "Stileron",
  canonicalMaterialKey: routeScore?.materialKey ?? null,
  requestedThreshold,
  resolvedQuantizedThreshold: {
    meaning: "raw quality >= 900",
    validMappedValues: resolvedQuantizedValues,
  },
  includedParentLocation: recommendation?.locationName ?? null,
  expandedChildLocations: recommendation?.matchedLocationCodes ?? [],
  candidateRowsBeforeFiltering: candidateRowsBeforeFiltering.length,
  deepSpaceCandidateRowsBeforeFiltering: deepSpaceCandidatesBeforeFiltering.length,
  candidateRowsAfterFiltering: response.diagnostics?.materialCoverage[0]?.candidateLocations.length ?? 0,
  distributionType: deepSpaceCandidatesBeforeFiltering.map((source) => source.quality?.distributionName),
  sourceRowCount: routeScore?.signals.sourceRowCount ?? null,
  encounterProbabilityFields: {
    probability: routeScore?.signals.probability ?? null,
    groupProbability: routeScore?.signals.groupProbability ?? null,
    relativeProbability: routeScore?.signals.relativeProbability ?? null,
    materialProbability: routeScore?.signals.materialProbability ?? null,
    encounterScore: routeScore?.signals.encounterScore ?? null,
  },
  qualitySourceScope: routeScore?.signals.qualitySourceScope ?? null,
  qualitySourceFamily: routeScore?.signals.qualitySourceFamily ?? null,
  thresholdChances: deepSpaceCandidatesBeforeFiltering[0]?.quality?.thresholdChances ?? null,
  finalQualityChance: routeScore?.signals.qualityChance ?? null,
  compositionAverage: routeScore?.signals.compositionAverage ?? null,
  compositionMax: routeScore?.signals.compositionMax ?? null,
  compositionScore: routeScore?.signals.compositionScore ?? null,
  recommendationScore: routeScore?.signals.recommendationScore ?? null,
  finalDisplayValues: {
    qualityChance: routeScore?.signals.qualityChance == null ? "Unknown" : `${Math.round(routeScore.signals.qualityChance * 100)}%`,
    encounterTierInput: routeScore?.signals.sourceWeight ?? null,
    compositionYield: routeScore?.signals.compositionAverage == null ? "Unknown" : `${routeScore.signals.compositionAverage}%`,
  },
}, null, 2));
