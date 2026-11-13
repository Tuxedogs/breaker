import assert from "node:assert/strict";
import test from "node:test";

import { createMaterialIdentityResolver } from "../../src/lib/materialIdentity.js";
import { compareLocationsForDemand, withRecommendationDemandScores } from "../../src/components/industry/mining/miningScoring.js";
import type { MiningRecommendationRequest, RequiredMaterial } from "../../src/features/mining/types.js";
import { getRecommendations } from "./recommender.service.js";
import { aggregateRequirements } from "./aggregateRequirements.js";
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
      source(materialName, "Unknown Quality", "ship_mineable", 0.05),
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

function visibleDemandMaterials(response: Awaited<ReturnType<typeof getRecommendations>>): RequiredMaterial[] {
  return (response.recommendations[0]?.requiredMaterials ?? []).map((material) => ({
    ...material,
    usedBy: [],
    slots: [],
  }));
}

test("decision-quality fixture applies ship eligibility, retains sources with missing quality evidence, and changes server order by ranking mode", async () => {
  const quality = await getRecommendations(request("quality"), fixtureApiData());
  const quantity = await getRecommendations(request("quantity"), fixtureApiData());

  assert.equal(quality.recommendations[0]?.locationName, "Quality Ridge");
  assert.equal(quantity.recommendations[0]?.locationName, "Quantity Basin");
  for (const response of [quality, quantity]) {
    assert.ok(response.recommendations.every((entry) => entry.spawnType.includes("ship")));
    assert.ok(response.recommendations.every((entry) => entry.locationName !== "Hand Jackpot"));
    assert.ok(response.recommendations.some((entry) => entry.locationName === "Unknown Quality"));
    assert.ok(response.warnings.some((warning) => warning.code === "source_mining_method_excluded"));
    assert.ok(response.warnings.every((warning) => warning.code !== "source_quality_thresholds_missing"));
    for (const route of response.recommendations.flatMap((entry) => entry.routeScores ?? [])) {
      assert.notEqual(route.signals.thresholdChance, 0.5);
      assert.notEqual(route.label, "Excellent");
    }
  }
});

test("visible demand ordering consumes getRecommendations route scores for every ranking mode", async () => {
  const expected = {
    quality: { location: "Quality Ridge", score: 74 },
    quantity: { location: "Quantity Basin", score: 78 },
    balanced: { location: "Quantity Basin", score: 60 },
  } as const;

  for (const mode of ["quality", "quantity", "balanced"] as const) {
    const response = await getRecommendations(request(mode), fixtureApiData());
    const visibleDemand = visibleDemandMaterials(response);
    const visible = [...response.recommendations].sort((left, right) =>
      compareLocationsForDemand(left, right, visibleDemand),
    );
    const displayed = withRecommendationDemandScores(
      visible,
      visibleDemand,
      () => "Good",
    );

    // Quantity Basin's old formatter heuristic is lower than Quality Ridge
    // despite the canonical quantity scorer choosing it. This assertion locks
    // the scorer-to-visible-list handoff rather than a fabricated route score.
    assert.equal(visible[0]?.locationName, expected[mode].location, mode);
    assert.equal(displayed[0]?.routeScores?.[0]?.overallTargetabilityScore, expected[mode].score, mode);
    assert.equal(displayed[0]?.score, expected[mode].score, mode);
  }
});

test("multiple eligible sources at one physical location retain the server's explicit-mode ordering", async () => {
  const apiData = fixtureApiData();
  apiData.materialGroups = [{
    materialId: "agricium",
    materialName: "Agricium",
    sources: [
      source("Agricium", "Duplicated Ridge", "ship_mineable", 0.4, 0.4),
      source("Agricium", "Duplicated Ridge", "ship_mineable", 0.4, 0.4),
      source("Agricium", "Solo Ridge", "ship_mineable", 0.7, 0.7),
    ],
  }];
  const singleMaterialRequest = request("quality");
  singleMaterialRequest.requiredMaterials = [singleMaterialRequest.requiredMaterials[0]!];

  const response = await getRecommendations(singleMaterialRequest, apiData);
  const visibleDemand = visibleDemandMaterials(response);
  const visible = [...response.recommendations].sort((left, right) =>
    compareLocationsForDemand(left, right, visibleDemand),
  );

  assert.equal(response.recommendations[0]?.locationName, "Duplicated Ridge");
  assert.equal(visible[0]?.locationName, "Duplicated Ridge");
  assert.equal(visible[0]?.routeScores?.[0]?.overallTargetabilityScore, 80);
});

test("omitting rankingMode retains the legacy server score path", async () => {
  const legacy = request("quality");
  delete legacy.rankingMode;
  const response = await getRecommendations(legacy, fixtureApiData());
  assert.equal(response.recommendations[0]?.locationName, "Quantity Basin");
  assert.ok(response.recommendations.some((entry) => entry.locationName === "Unknown Quality"));
});

test("arbitrary queue targets do not affect ranking or invent threshold chances", async () => {
  const snapshots = [];
  for (const target of [902, 947, 967]) {
    const req = request("quality");
    req.requiredMaterials = req.requiredMaterials.map((material) => ({ ...material, selectedQuality: target }));
    const result = await getRecommendations(req, fixtureApiData());
    snapshots.push(result.recommendations.map((location) => [location.locationName, location.score]));
    const known = result.recommendations.find((location) => location.locationName === "Quality Ridge")?.routeScores?.[0];
    assert.equal(known?.signals.qualityThreshold, 900);
    assert.equal(known?.signals.thresholdChance, 0.9);
    const unknown = result.recommendations.find((location) => location.locationName === "Unknown Quality")?.routeScores?.[0];
    assert.equal(unknown?.signals.thresholdChance, null);
  }
  assert.deepEqual(snapshots[0], snapshots[1]);
  assert.deepEqual(snapshots[1], snapshots[2]);
});

test("common bands retain zero and never compare different thresholds", async () => {
  const data = fixtureApiData();
  const sources = data.materialGroups[0].sources!;
  sources[0].quality = { thresholdChances: { "700": 0.4, "900": 0 } };
  sources[1].quality = { thresholdChances: { "700": 0.2 } };
  const req = request("quality");
  req.requiredMaterials = [req.requiredMaterials[0]];
  const response = await getRecommendations(req, data);
  const ridge = response.recommendations.find((location) => location.locationName === "Quality Ridge")?.routeScores?.[0];
  assert.equal(ridge?.signals.qualityThreshold, 700);
  assert.equal(ridge?.signals.thresholdChance, 0.4);
  sources[1].quality = { thresholdChances: { "900": 0.2 } };
  const zero = await getRecommendations(req, data);
  const zeroRidge = zero.recommendations.find((location) => location.locationName === "Quality Ridge")?.routeScores?.[0];
  assert.equal(zeroRidge?.signals.qualityThreshold, 900);
  assert.equal(zeroRidge?.signals.thresholdChance, 0);
});

test("different Build Queue qualities merge into one material requirement", () => {
  const items = [
    { materialId: "agricium", materialName: "Agricium", requiredQuantity: 2, selectedQuality: 902 },
    { materialId: "agricium", materialName: "Agricium", requiredQuantity: 3, selectedQuality: 947 },
  ];
  const demands = aggregateRequirements(items, [], fixtureApiData().materialIdentityResolver);
  assert.equal(demands.length, 1);
  assert.equal(demands[0].materialKey, "agricium");
  assert.equal(demands[0].requiredQuantity, 5);
  assert.equal(demands[0].selectedQuality, undefined);
});
