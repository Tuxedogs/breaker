import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { aggregateRequirements } from "./aggregateRequirements";
import { formatRecommendations } from "./formatRecommendations";
import { getRecommendations } from "./recommender.service";
import { normalizeMiningLocationName } from "./locationNormalization";
import type { ScoredLocation } from "./recommender.types";

const STILERON_ID = "9498a080-84c0-41f4-b88f-71942c60c43f";

function stileronRequest(extra: Record<string, unknown> = {}) {
  return {
    materialRequirements: [{
      materialId: STILERON_ID,
      materialName: "Stileron",
      displayName: "Stileron",
      requiredQuantity: 1,
      selectedQuality: 900,
    }],
    ...extra,
  };
}

test("Pyro source aliases normalize into their canonical location buckets", () => {
  assert.equal(normalizeMiningLocationName("Pyro", "Pyro Akirocluster"), "Akiro Cluster");
  assert.equal(normalizeMiningLocationName("Pyro", "Pyro RAB-01"), "Pyro Deep Space Asteroids");
  assert.equal(normalizeMiningLocationName("Pyro", "Pyro RMB 02"), "Pyro Deep Space Asteroids");
  assert.equal(normalizeMiningLocationName("Pyro", "Pyro1"), "Pyro I");
});

test("Stileron resolves canonically without fuzzy source matching", () => {
  const warnings: Array<{ code: string; message: string }> = [];
  const [requirement] = aggregateRequirements(stileronRequest().materialRequirements, warnings);
  assert.equal(requirement?.materialKey, "stileron");
  assert.equal(requirement?.materialId, "stileron");
  assert.deepEqual(warnings, []);
});

test("Stileron 900+ uses only quantized outputs at or above 900", async () => {
  const quantization = JSON.parse(await readFile("server-data/crafting/reference/quality-quantization.json", "utf8")) as Array<{
    recordName: string;
    bands: Array<{ start: string; mappedValue: string }>;
  }>;
  const stileron = quantization.find((row) => row.recordName === "Quantization_Stileron");
  assert.deepEqual(
    stileron?.bands.filter((band) => Number(band.start) >= 900).map((band) => Number(band.mappedValue)),
    [947, 972, 1000],
  );
});

test("Stileron 900+ quality chance stays absolute and independent from recommendation score", async () => {
  const response = await getRecommendations(stileronRequest());
  const akiroRoute = response.recommendations.find((entry) => entry.locationName === "Akiro Cluster");
  const route = response.recommendations.find((entry) => entry.locationName === "Pyro Deep Space Asteroids");
  const score = route?.routeScores?.find((entry) => entry.materialKey === "stileron");

  assert.ok(akiroRoute?.matchedLocationCodes?.includes("Pyro Akirocluster"));
  assert.ok(route?.matchedLocationCodes?.includes("Pyro Deepspaceasteroids"));
  assert.equal(score?.signals.qualityChance, 0.050957);
  assert.equal(score?.signals.thresholdChance, 0.050957);
  assert.equal(score?.qualityRouteScore, 5);
  assert.notEqual(score?.signals.recommendationScore, score?.signals.qualityChance);
  assert.equal(score?.signals.qualitySourceScope, "system_specific");
  assert.equal(score?.signals.qualitySourceFamily, "legendary_ship");
});

test("inventory and reserve-shaped request state do not change acquisition probability", async () => {
  const baseline = await getRecommendations(stileronRequest());
  const withPlanningState = await getRecommendations(stileronRequest({
    inventory: [{ materialKey: "stileron", quantity: 999 }],
    reserves: [{ materialKey: "stileron", quantity: 999 }],
  }));
  const qualityChance = (response: Awaited<ReturnType<typeof getRecommendations>>) =>
    response.recommendations.find((entry) => entry.locationName === "Pyro Deep Space Asteroids")
      ?.routeScores?.find((entry) => entry.materialKey === "stileron")?.signals.qualityChance;

  assert.equal(qualityChance(withPlanningState), qualityChance(baseline));
});

test("fallback quality scope metadata is exposed without replacing quality chance", () => {
  const location: ScoredLocation = {
    locationKey: "test|fallback",
    locationName: "Fallback",
    locationKind: "provider_preset",
    systemName: "Test",
    spawnType: "ship_mineable",
    nearbyStations: [],
    materials: ["Stileron"],
    indexedResources: [{ materialId: STILERON_ID, materialName: "Stileron", miningType: "Ship" }],
    score: 1,
    coveredRequirements: [{
      materialKey: "stileron",
      materialId: "stileron",
      materialName: "Stileron",
      displayName: "Stileron",
      normalizedName: "stileron",
      slug: "stileron",
      requiredQuantity: 1,
      selectedQuality: 900,
    }],
    bestSources: [{
      materialId: STILERON_ID,
      materialName: "Stileron",
      probability: 0.01,
      relativeProbability: 2,
      groupProbability: 0.1,
      materialProbability: 1,
      composition: { averagePercentage: 12.7, maxPercentage: 15.7 },
      quality: {
        distributionName: "LegendaryShipMineable_QualityDistribution_Default",
        thresholdChances: { "900": 0.01 },
        qualitySourceScope: "default",
        qualitySourceFamily: "legendary_ship",
      },
    }],
  };

  const signals = formatRecommendations([location])[0]?.routeScores?.[0]?.signals;
  assert.equal(signals?.qualityChance, 0.01);
  assert.equal(signals?.qualitySourceScope, "default");
  assert.equal(signals?.qualitySourceFamily, "legendary_ship");
});
