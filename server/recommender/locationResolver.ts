import type { ApiSource, RecommenderApiData, RecommenderWarning } from "./recommender.types";
import { addWarning } from "./recommenderWarnings";
import { normalizeMiningLocationName, normalizedMiningSystemName } from "./locationNormalization";

export function resolveLocation(source: ApiSource, apiData: RecommenderApiData, warnings: RecommenderWarning[]) {
  const metadataKey = source.system && source.providerName ? `${source.system}:${source.providerName}` : "";
  const metadata = metadataKey ? apiData.locationMetadata[metadataKey] : undefined;

  if (!source.system || !source.location || !source.spawnType) {
    addWarning(warnings, {
      code: "source_location_fields_missing",
      message: "A material source is missing system, location, or spawnType.",
      materialId: source.materialId,
      materialName: source.materialName,
      path: "public/api/recommendations/material_source_scores.json:materials[].bestSources[]",
    });
  }

  const systemName = normalizedMiningSystemName(metadata?.systemName ?? source.system ?? "Unknown");
  const rawLocationName = metadata?.locationName ?? source.location ?? source.providerName ?? "Unknown";

  return {
    systemName,
    locationName: normalizeMiningLocationName(systemName, rawLocationName),
    locationKind: metadata?.locationKind ?? source.locationType ?? "unknown",
    spawnType: source.spawnType ?? "unknown",
    nearbyStations: metadata?.nearbyStations ?? [],
  };
}
