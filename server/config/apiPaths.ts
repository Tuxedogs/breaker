import path from "node:path";

import { getCraftingReferenceRoot } from "./craftingReferenceRoot.js";
import { getMiningDataRoot } from "./miningDataRoot.js";

const miningDataRoot = getMiningDataRoot();
const craftingReferenceRoot = getCraftingReferenceRoot();

export const apiPaths = {
  materialIdentityIndex: path.join(craftingReferenceRoot, "material-identity-index.json"),
  materialSourceScores: path.join(miningDataRoot, "recommender", "material-source-scores.json"),
  materialSourcesQualityEnriched: path.join(miningDataRoot, "recommender", "material-sources-quality-enriched.json"),
  locationMetadata: path.join(miningDataRoot, "recommender", "location-metadata.json"),
  lagrangeGroups: path.join(miningDataRoot, "locations", "lagrange-groups.json"),
} as const;

export const recommenderApiPath = "/api/mining/recommendations";
