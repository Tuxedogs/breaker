import { readFile } from "node:fs/promises";
import { apiPaths } from "../config/apiPaths";
import type { ApiSource, MaterialSourceGroup, RecommenderApiData, RecommenderWarning } from "./recommender.types";
import { canonicalMaterialKey } from "./materialResolver";
import { addWarning } from "./recommenderWarnings";

async function readJson<T>(filePath: string, warnings: RecommenderWarning[]): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    addWarning(warnings, {
      code: "api_file_unreadable",
      message: `Unable to read API file: ${error instanceof Error ? error.message : String(error)}`,
      path: filePath,
    });
    return null;
  }
}

function sourceIdentity(source: ApiSource): string {
  return [
    source.providerGuid,
    source.providerName,
    source.system,
    source.location,
    source.harvestableGuid,
    source.compositionGuid,
    source.entityClass,
    source.mineableEntity,
  ].filter(Boolean).join("|").toLowerCase();
}

function mergeSourceScoreFields(target: ApiSource, sourceScore: ApiSource): ApiSource {
  return {
    ...target,
    overallScore: target.overallScore ?? sourceScore.overallScore,
    reason: target.reason ?? sourceScore.reason,
    scoreInputs: target.scoreInputs ?? sourceScore.scoreInputs,
    composition: {
      ...(target.composition ?? {}),
      ...(sourceScore.composition?.averagePercentage !== undefined ? { averagePercentage: sourceScore.composition.averagePercentage } : {}),
    },
  };
}

function mergeEnrichedWithSourceScores(
  enrichedSources: MaterialSourceGroup[],
  sourceScoreGroups: MaterialSourceGroup[] | undefined,
): MaterialSourceGroup[] {
  if (!sourceScoreGroups?.length) return enrichedSources;

  const scoreGroupsByMaterial = new Map<string, MaterialSourceGroup>();
  for (const group of sourceScoreGroups) {
    scoreGroupsByMaterial.set(canonicalMaterialKey(group.materialName ?? group.materialId), group);
  }

  return enrichedSources.map((group) => {
    const scoreGroup = scoreGroupsByMaterial.get(canonicalMaterialKey(group.materialName ?? group.materialId));
    const scoreSources = scoreGroup?.bestSources ?? scoreGroup?.sources ?? [];
    if (!scoreSources.length || !group.sources?.length) return group;

    const scoreSourceByIdentity = new Map(scoreSources.map((source) => [sourceIdentity(source), source]));
    return {
      ...group,
      sources: group.sources.map((source) => {
        const sourceScore = scoreSourceByIdentity.get(sourceIdentity(source));
        return sourceScore ? mergeSourceScoreFields(source, sourceScore) : source;
      }),
    };
  });
}

export async function loadApiData(warnings: RecommenderWarning[]): Promise<RecommenderApiData> {
  const sourceScores = await readJson<{ materials?: MaterialSourceGroup[] }>(apiPaths.materialSourceScores, warnings);
  const enrichedSources = await readJson<MaterialSourceGroup[]>(apiPaths.materialSourcesQualityEnriched, warnings);
  const locationMetadata = await readJson<RecommenderApiData["locationMetadata"]>(apiPaths.locationMetadata, warnings);

  const materialGroups = enrichedSources?.length
    ? mergeEnrichedWithSourceScores(enrichedSources, sourceScores?.materials)
    : sourceScores?.materials ?? [];

  if (!enrichedSources?.length) {
    addWarning(warnings, {
      code: "api_field_missing",
      message: "mining/material_sources_quality_enriched.json did not expose source groups; using recommendation source scores.",
      path: "public/api/mining/material_sources_quality_enriched.json",
    });
  }

  return {
    materialGroups,
    locationMetadata: locationMetadata ?? {},
    consumedFiles: [
      "public/api/recommendations/material_source_scores.json",
      "public/api/mining/material_sources_quality_enriched.json",
      "public/api/recommendations/location_metadata.json",
    ],
  };
}
