import type { ApiSource, RecommenderApiData, RecommenderWarning } from "./recommender.types";
import { addWarning } from "./recommenderWarnings";
import { normalizeMiningLocationName, normalizedMiningSystemName } from "./locationNormalization";

function normalizeLocationCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function extractStantonLocationCodes(value: string | undefined): string[] {
  if (!value) return [];
  const matches = value.match(/\b(?:ARC|CRU|HUR|MIC)-L[1-5]\b/gi) ?? [];
  return matches.map(normalizeLocationCode);
}

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
  const extractedLocationCodes = Array.from(new Set([
    ...extractStantonLocationCodes(metadata?.locationName),
    ...extractStantonLocationCodes(source.location),
    ...extractStantonLocationCodes(source.providerName),
    ...extractStantonLocationCodes(source.groupName),
  ])).sort();
  const matchedLocationCodes = extractedLocationCodes.length > 0 ? extractedLocationCodes : undefined;

  return {
    systemName,
    locationName: normalizeMiningLocationName(systemName, rawLocationName),
    locationKind: metadata?.locationKind ?? source.locationType ?? "unknown",
    matchedLocationCodes,
    spawnType: source.spawnType ?? "unknown",
    nearbyStations: metadata?.nearbyStations ?? [],
  };
}
