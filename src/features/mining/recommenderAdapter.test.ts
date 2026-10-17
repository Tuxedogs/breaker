import assert from "node:assert/strict";
import test from "node:test";

import { buildStaticRecommendations } from "./recommenderAdapter.js";
import type { MiningRecommendationRequest } from "./types.js";
import type { StaticLocationMaterialRow, StaticMiningIndex } from "./staticMiningIndex.js";
import { getRecommendations } from "../../../server/recommender/recommender.service.js";
import type { ApiSource, MaterialSourceGroup, RecommenderApiData } from "../../../server/recommender/recommender.types.js";
import { createMaterialIdentityResolver } from "../../lib/materialIdentity.js";

const materialNames = ["Agricium", "Bexalite"] as const;

function request(rankingMode: "quality" | "quantity" | "balanced"): MiningRecommendationRequest {
  return {
    version: "1.0",
    generatedAt: "2026-10-15T00:00:00.000Z",
    requiredMaterials: materialNames.map((materialName) => ({
      materialId: materialName.toLowerCase(), materialName, requiredQuantity: 10, selectedQuality: 900,
    })),
    priorityStack: [], manualDemand: [], favoriteLocationIds: [], filters: { showOnlyStarred: false },
    allowedMiningMethods: ["ship"], rankingMode, refineryContext: null, currentFixtureSummary: null,
  };
}

function staticRow(materialName: string, location: string, method: StaticLocationMaterialRow["resolvedMineableClass"], score: number, qualityChance?: number): StaticLocationMaterialRow {
  return {
    materialId: materialName.toLowerCase(), materialName,
    system: "Test System", systemKey: "test", systemDisplayName: "Test System",
    location, locationKey: location.toLowerCase().replace(/ /g, "-"), locationDisplayName: location,
    parents: [], parentDisplayNames: [], resolvedMineableClass: method,
    sourceCount: 1, sourceProbabilitySum: score, sourceProbabilityMax: score,
    compositionAveragePercentage: score * 100,
    qualityThresholdChancesWeighted: qualityChance === undefined ? {} : { "900": qualityChance },
    qualityOverrideApplied: false, qualityOverrideRecordNames: [], qualityDistributionSourceNames: [],
    locationClassDistributionShare: 1, encounterScore: score * 100, materialEncounterScore: score * 100,
  };
}

function fixtureStaticIndex(): StaticMiningIndex {
  return {
    rows: materialNames.flatMap((materialName) => [
      staticRow(materialName, "Quality Ridge", "Shipborne", 0.1, 0.9),
      staticRow(materialName, "Quantity Basin", "Shipborne", 0.9, 0.3),
      staticRow(materialName, "Hand Jackpot", "Handborne", 1, 0.99),
      staticRow(materialName, "Unknown Quality", "Shipborne", 1),
    ]),
    rankings: [], resourcesByLocationJoinKey: new Map(), materialKeysByLocationJoinKey: new Map(),
    locationKeysByDisplayName: new Map(), materialResources: [], rankingByRowKey: new Map(),
    encounterScoreRangeByMaterialKey: new Map(), materialEncounterScoreRangeByMaterialKey: new Map(),
    distributionRows: [], distributionByLocationJoinKey: new Map(), qualityRows: [], qualityByRowKey: new Map(),
    locationHierarchy: null,
  };
}

function source(
  materialName: string,
  location: string,
  overallScore: number,
  qualityChance?: number,
  spawnType = "ship_mineable",
): ApiSource {
  return {
    materialId: materialName.toLowerCase(), materialName, system: "Test System", location,
    spawnType, overallScore, composition: { averagePercentage: overallScore * 100 },
    quality: qualityChance === undefined ? {} : { thresholdChances: { "900": qualityChance } },
  };
}

function fixtureApiData(): RecommenderApiData {
  const materialGroups: MaterialSourceGroup[] = materialNames.map((materialName) => ({
    materialId: materialName.toLowerCase(), materialName,
    sources: [
      source(materialName, "Quality Ridge", 0.1, 0.9),
      source(materialName, "Quantity Basin", 0.9, 0.3),
      source(materialName, "Hand Jackpot", 1, 0.99, "hand_mineable"),
      source(materialName, "Unknown Quality", 1),
    ],
  }));
  return {
    materialGroups,
    materialIdentityResolver: createMaterialIdentityResolver(materialNames.map((materialName) => ({
      materialKey: materialName.toLowerCase(), displayName: materialName,
    }))),
    locationMetadata: {}, consumedFiles: [],
  };
}

test("static fallback preserves ship and explicit-quality eligibility gates", () => {
  const response = buildStaticRecommendations(request("quality"), fixtureStaticIndex());
  assert.deepEqual(response.recommendations.map((entry) => entry.locationName).sort(), ["Quality Ridge", "Quantity Basin"]);
  assert.ok(response.recommendations.flatMap((entry) => entry.routeScores ?? []).every((route) => route.selectedQuality === 900));
});

test("static fallback coverage excludes mixed-method and missing-quality rows", () => {
  const index = fixtureStaticIndex();
  index.rows = [
    staticRow("Agricium", "Mixed Ridge", "Handborne", 1, 0.99),
    staticRow("Agricium", "Mixed Ridge", "Shipborne", 0.4, 0.8),
    staticRow("Bexalite", "Mixed Ridge", "Shipborne", 0.8),
  ];
  const mixed = buildStaticRecommendations(request("quality"), index).recommendations.find((entry) => entry.locationName === "Mixed Ridge");
  assert.ok(mixed);
  assert.deepEqual(mixed.requiredMaterials?.map((material) => material.materialKey), ["agricium"]);
  assert.deepEqual(mixed.materials.sort(), ["Agricium", "Bexalite"]);
  assert.equal(mixed.routeScores?.[0]?.signals.qualityChance, 0.8);
});

test("static fallback selects same-location eligible evidence by ranking strategy", () => {
  const index = fixtureStaticIndex();
  index.rows = [
    staticRow("Agricium", "Strategy Ridge", "Shipborne", 0.9, 0.2),
    staticRow("Agricium", "Strategy Ridge", "Shipborne", 0.2, 0.95),
  ];
  const quality = buildStaticRecommendations(request("quality"), index);
  const quantity = buildStaticRecommendations(request("quantity"), index);
  assert.equal(quality.recommendations[0]?.routeScores?.[0]?.signals.qualityChance, 0.95);
  assert.equal(quantity.recommendations[0]?.routeScores?.[0]?.signals.qualityChance, 0.2);
  assert.equal(quality.recommendations[0]?.routeScores?.[0]?.signals.yieldPotential, 20);
  assert.equal(quantity.recommendations[0]?.routeScores?.[0]?.signals.yieldPotential, 90);
});

test("explicit ranking modes keep server and static fallback location ordering in parity", async () => {
  for (const mode of ["quality", "quantity", "balanced"] as const) {
    const server = await getRecommendations(request(mode), fixtureApiData());
    const fallback = buildStaticRecommendations(request(mode), fixtureStaticIndex());
    assert.deepEqual(
      fallback.recommendations.map((entry) => entry.locationName),
      server.recommendations.map((entry) => entry.locationName),
      mode,
    );
  }
});
