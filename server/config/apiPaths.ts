import path from "node:path";

export const publicApiRoot = path.resolve(process.env.SCINTEL_API_ROOT ?? "D:\\scintel\\api");

export const apiPaths = {
  materialIdentityIndex: path.resolve("public", "api", "crafting", "material_identity_index.json"),
  materialSourceScores: path.join(publicApiRoot, "recommendations", "material_source_scores.json"),
  materialSourcesQualityEnriched: path.join(publicApiRoot, "mining", "material_sources_quality_enriched.json"),
  locationMetadata: path.join(publicApiRoot, "recommendations", "location_metadata.json"),
} as const;

export const recommenderApiPath = "/api/recommender/recommendations";
