import { readFile } from "node:fs/promises";
import { apiPaths } from "../config/apiPaths";
import type { MaterialSourceGroup, RecommenderApiData, RecommenderWarning } from "./recommender.types";
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

export async function loadApiData(warnings: RecommenderWarning[]): Promise<RecommenderApiData> {
  const sourceScores = await readJson<{ materials?: MaterialSourceGroup[] }>(apiPaths.materialSourceScores, warnings);
  const enrichedSources = await readJson<MaterialSourceGroup[]>(apiPaths.materialSourcesQualityEnriched, warnings);
  const locationMetadata = await readJson<RecommenderApiData["locationMetadata"]>(apiPaths.locationMetadata, warnings);

  const materialGroups = enrichedSources?.length
    ? enrichedSources
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
