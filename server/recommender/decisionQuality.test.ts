import assert from "node:assert/strict";
import test from "node:test";

import { createMaterialIdentityResolver } from "../../src/lib/materialIdentity.js";
import { compareLocationsForDemand, withRecommendationDemandScores } from "../../src/components/industry/mining/miningScoring.js";
import type { MiningRecommendationRequest, RequiredMaterial } from "../../src/features/mining/types.js";
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

function visibleDemandMaterials(response: Awaited<ReturnType<typeof getRecommendations>>): RequiredMaterial[] {
  return (response.recommendations[0]?.requiredMaterials ?? []).map((material) => ({
    ...material,
    usedBy: [],
    slots: [],
  }));
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

test("omitting rankingMode retains the legacy server score path", async () => {
  const legacy = request("quality");
  delete legacy.rankingMode;
  const response = await getRecommendations(legacy, fixtureApiData());
  assert.equal(response.recommendations[0]?.locationName, "Quantity Basin");
  assert.ok(response.recommendations.every((entry) => entry.locationName !== "Unknown Quality"));
});
