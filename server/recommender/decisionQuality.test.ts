import assert from "node:assert/strict";
import test from "node:test";

import { createMaterialIdentityResolver } from "../../src/lib/materialIdentity.js";
import { buildStaticRecommendations } from "../../src/features/mining/recommenderAdapter.js";
import type { MiningRecommendationRequest } from "../../src/features/mining/types.js";
import type { StaticLocationMaterialRow, StaticMiningIndex } from "../../src/features/mining/staticMiningIndex.js";
import { getRecommendations } from "./recommender.service.js";
import type { ApiSource, MaterialSourceGroup, RecommenderApiData } from "./recommender.types.js";

const materialNames = ["Agricium", "Bexalite"] as const;

function source(materialName: string, location: string, spawnType: string, overallScore: number, qualityChance?: number): ApiSource {
  return {
    materialId: materialName.toLowerCase(),
    materialName,
    system: "Test System",
    location,
    spawnType,
    overallScore,
    composition: { averagePercentage: overallScore * 100 },
    quality: qualityChance === undefined ? {} : { thresholdChances: { "900": qualityChance } },
  };
}

function fixtureApiData(): RecommenderApiData {
  const materialGroups: MaterialSourceGroup[] = materialNames.map((materialName) => ({
    materialId: materialName.toLowerCase(),
    materialName,
    sources: [
      source(materialName, "Quality Ridge", "ship_mineable", 0.1, 0.9),
      source(materialName, "Quantity Basin", "ship_mineable", 0.9, 0.3),
      source(materialName, "Hand Jackpot", "hand_mineable", 1, 0.99),
      source(materialName, "Unknown Quality", "ship_mineable", 1),
    ],
  }));
  return {
    materialGroups,
    materialIdentityResolver: createMaterialIdentityResolver(materialNames.map((materialName) => ({
      materialKey: materialName.toLowerCase(),
      displayName: materialName,
    }))),
    locationMetadata: {},
    consumedFiles: [],
  };
}

function request(rankingMode: "quality" | "quantity" | "balanced"): MiningRecommendationRequest {
  return {
    version: "1.0",
    generatedAt: "2026-10-15T00:00:00.000Z",
    requiredMaterials: materialNames.map((materialName) => ({
      materialId: materialName.toLowerCase(),
      materialName,
      requiredQuantity: 10,
      selectedQuality: 900,
    })),
    priorityStack: [],
    manualDemand: [],
    favoriteLocationIds: [],
    filters: { showOnlyStarred: false },
    allowedMiningMethods: ["ship"],
    rankingMode,
    refineryContext: null,
    currentFixtureSummary: null,
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
  const rows = materialNames.flatMap((materialName) => [
    staticRow(materialName, "Quality Ridge", "Shipborne", 0.1, 0.9),
    staticRow(materialName, "Quantity Basin", "Shipborne", 0.9, 0.3),
    staticRow(materialName, "Hand Jackpot", "Handborne", 1, 0.99),
    staticRow(materialName, "Unknown Quality", "Shipborne", 1),
  ]);
  return {
    rows, rankings: [], resourcesByLocationJoinKey: new Map(), materialKeysByLocationJoinKey: new Map(),
    locationKeysByDisplayName: new Map(), materialResources: [], rankingByRowKey: new Map(),
    encounterScoreRangeByMaterialKey: new Map(), materialEncounterScoreRangeByMaterialKey: new Map(),
    distributionRows: [], distributionByLocationJoinKey: new Map(), qualityRows: [], qualityByRowKey: new Map(),
    locationHierarchy: null,
  };
}

test("decision-quality fixture applies ship eligibility, fails closed on missing quality evidence, and changes server order by ranking mode", async () => {
  const quality = await getRecommendations(request("quality"), fixtureApiData());
  const quantity = await getRecommendations(request("quantity"), fixtureApiData());

  assert.equal(quality.recommendations[0]?.locationName, "Quality Ridge");
  assert.equal(quantity.recommendations[0]?.locationName, "Quantity Basin");
  for (const response of [quality, quantity]) {
    assert.ok(response.recommendations.every((entry) => entry.spawnType.includes("ship")));
    assert.ok(response.recommendations.every((entry) => entry.locationName !== "Hand Jackpot"));
    assert.ok(response.recommendations.every((entry) => entry.locationName !== "Unknown Quality"));
    assert.ok(response.warnings.some((warning) => warning.code === "source_mining_method_excluded"));
    assert.ok(response.warnings.some((warning) => warning.code === "source_quality_thresholds_missing"));
    for (const route of response.recommendations.flatMap((entry) => entry.routeScores ?? [])) {
      assert.notEqual(route.signals.thresholdChance, 0.5);
      assert.notEqual(route.label, "Excellent");
    }
  }
});

test("static fallback preserves the same ship and explicit-quality eligibility gates", () => {
  const response = buildStaticRecommendations(request("quality"), fixtureStaticIndex());
  assert.deepEqual(response.recommendations.map((entry) => entry.locationName).sort(), ["Quality Ridge", "Quantity Basin"]);
  assert.ok(response.recommendations.flatMap((entry) => entry.routeScores ?? []).every((route) => route.selectedQuality === 900));
});

test("static fallback reports only request-eligible coverage for mixed methods and missing quality", () => {
  const index = fixtureStaticIndex();
  index.rows = [
    staticRow("Agricium", "Mixed Ridge", "Handborne", 1, 0.99),
    staticRow("Agricium", "Mixed Ridge", "Shipborne", 0.4, 0.8),
    staticRow("Bexalite", "Mixed Ridge", "Shipborne", 0.8),
  ];
  const response = buildStaticRecommendations(request("quality"), index);
  const mixed = response.recommendations.find((entry) => entry.locationName === "Mixed Ridge");
  assert.ok(mixed);
  assert.deepEqual(mixed.requiredMaterials?.map((material) => material.materialKey), ["agricium"]);
  assert.deepEqual(mixed.materials.sort(), ["Agricium", "Bexalite"]);
  assert.equal(mixed.routeScores?.[0]?.signals.qualityChance, 0.8);
});

test("explicit ranking modes produce parity ordering between server and static fallback", async () => {
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

test("omitting rankingMode retains the legacy server score path", async () => {
  const legacy = request("quality");
  delete legacy.rankingMode;
  const response = await getRecommendations(legacy, fixtureApiData());
  assert.equal(response.recommendations[0]?.locationName, "Quantity Basin");
  assert.ok(response.recommendations.every((entry) => entry.locationName !== "Unknown Quality"));
});
