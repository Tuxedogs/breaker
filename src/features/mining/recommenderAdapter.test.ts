import assert from "node:assert/strict";
import test from "node:test";

import { buildIndexedDiscovery, buildStaticRecommendations, staticQualityEvidence } from "./recommenderAdapter.js";
import type { MiningRecommendationRequest } from "./types.js";
import { getStaticResourcesForLocation, type StaticLocationMaterialRow, type StaticMiningIndex } from "./staticMiningIndex.js";
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
      staticRow(materialName, "Unknown Quality", "Shipborne", 0.05),
    ]),
    rankings: [], resourcesByLocationJoinKey: new Map(), materialKeysByLocationJoinKey: new Map(),
    locationKeysByDisplayName: new Map(), materialResources: [], rankingByRowKey: new Map(),
    encounterScoreRangeByMaterialKey: new Map(), poolShareRangeByMaterialKey: new Map(),
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
      source(materialName, "Unknown Quality", 0.05),
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

test("static fallback preserves ship eligibility and retains unknown quality", () => {
  const response = buildStaticRecommendations(request("quality"), fixtureStaticIndex());
  assert.deepEqual(response.recommendations.map((entry) => entry.locationName).sort(), ["Quality Ridge", "Quantity Basin", "Unknown Quality"]);
  assert.ok(response.recommendations.flatMap((entry) => entry.routeScores ?? []).every((route) => route.selectedQuality === 900));
});

test("static fallback coverage excludes disallowed methods and retains missing-quality rows", () => {
  const index = fixtureStaticIndex();
  index.rows = [
    staticRow("Agricium", "Mixed Ridge", "Handborne", 1, 0.99),
    staticRow("Agricium", "Mixed Ridge", "Shipborne", 0.4, 0.8),
    staticRow("Bexalite", "Mixed Ridge", "Shipborne", 0.8),
  ];
  const mixed = buildStaticRecommendations(request("quality"), index).recommendations.find((entry) => entry.locationName === "Mixed Ridge");
  assert.ok(mixed);
  assert.deepEqual(mixed.requiredMaterials?.map((material) => material.materialKey), ["agricium", "bexalite"]);
  assert.deepEqual(mixed.materials.sort(), ["Agricium", "Bexalite"]);
  assert.equal(mixed.routeScores?.find((route) => route.materialKey === "agricium")?.signals.qualityChance, 0.8);
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

test("static ranking uses pool share without method-fit penalty and relative quality", () => {
  // Delivered Iron evidence: belts publish methodFit 1, Pyro planets ~0.33.
  const iron = (location: string, method: string, poolShare: number, methodFit: number, chance800: number): StaticLocationMaterialRow => ({
    ...staticRow("Iron", location, method, 0, undefined),
    compositionAveragePercentage: 12.7,
    qualityThresholdChancesWeighted: { "800": chance800 },
    locationClassDistributionShare: methodFit, methodFit,
    materialBiasSignal: poolShare, materialEncounterScore: poolShare * methodFit, encounterScore: poolShare * methodFit,
  });
  const index = fixtureStaticIndex();
  index.rows = [
    iron("Nyx Glaciemring", "Orbitborne", 20.75, 1, 0.03607),
    iron("Stanton2c Belt", "Orbitborne", 20.5, 1, 0.03607),
    iron("Monox", "Shipborne", 32.6, 0.324, 0.044005),
    iron("Adir", "Shipborne", 43.5, 0.333, 0.044005),
  ];
  index.poolShareRangeByMaterialKey.set("iron", { min: 20.5, max: 43.5 });
  for (const mode of ["quality", "quantity", "balanced", undefined] as const) {
    const req = request("quality");
    req.rankingMode = mode;
    req.requiredMaterials = [{ materialId: "iron", materialName: "Iron", requiredQuantity: 1, selectedQuality: 800 }];
    const order = buildStaticRecommendations(req, index).recommendations.map((entry) => entry.locationName);
    assert.deepEqual(order, ["Adir", "Monox", "Nyx Glaciemring", "Stanton2c Belt"], String(mode));
  }
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


test("exact quality evidence distinguishes zero, missing thresholds and absent sources", () => {
  const index = fixtureStaticIndex();
  const row = staticRow("Agricium", "Zero", "Shipborne", 0.2, 0);
  assert.deepEqual(staticQualityEvidence(row, index, 900), { status: "known", chance: 0 });
  assert.deepEqual(staticQualityEvidence(row, index, 902), { status: "missing" });
  assert.deepEqual(staticQualityEvidence(row, index, 950), { status: "missing" });
  assert.deepEqual(staticQualityEvidence(undefined, index, 900), { status: "absent" });
  for (const quality of [902, 950]) {
    const req = request("quality");
    req.requiredMaterials = req.requiredMaterials.map((material) => ({ ...material, selectedQuality: quality }));
    const ranked = buildStaticRecommendations(req, index).recommendations;
    assert.ok(ranked.some((entry) => entry.locationName === "Quality Ridge"));
    assert.equal(ranked.find((entry) => entry.locationName === "Quality Ridge")?.routeScores?.[0]?.signals.qualityThreshold, 900);
  }
});

test("discovery retains physical membership and does not alter eligible scores or coverage", () => {
  const index = fixtureStaticIndex();
  const req = request("quality");
  const ranked = buildStaticRecommendations(req, index).recommendations;
  // Populate the same canonical lookup used by the loaded index.
  for (const row of index.rows) {
    const key = `${row.systemKey}::${row.locationKey}`;
    index.resourcesByLocationJoinKey.set(key, index.rows.filter((candidate) => candidate.locationKey === row.locationKey));
    index.resourcesByLocationJoinKey.set(`test system::${row.locationKey}`, index.rows.filter((candidate) => candidate.locationKey === row.locationKey));
  }
  const snapshot = JSON.stringify(ranked);
  const discovered = buildIndexedDiscovery(req, index, ranked);
  assert.deepEqual(discovered.map(({ entry }) => entry.locationName).sort(), ["Hand Jackpot"]);
  assert.ok(discovered.find(({ entry }) => entry.locationName === "Hand Jackpot")?.reasons.includes("method excluded"));
  assert.equal(JSON.stringify(ranked), snapshot);
  for (const { entry } of discovered) {
    assert.ok(index.rows.some((row) => row.locationKey === entry.locationKey));
    assert.ok(getStaticResourcesForLocation(entry, index).length > 0);
    assert.equal(entry.discoveryStatus, "unranked");
    assert.equal(entry.score, undefined);
  }
});

test("Beryl remains covered for arbitrary targets with only 900+ evidence", () => {
  const index = fixtureStaticIndex();
  index.rows = [staticRow("Beryl", "Beryl Ridge", "Shipborne", 0.5, 0)];
  const snapshots = [];
  for (const target of [902, 947, 967]) {
    const req = request("quality");
    req.requiredMaterials = [{ materialId: "beryl", materialName: "Beryl", requiredQuantity: 1, selectedQuality: target }];
    const response = buildStaticRecommendations(req, index);
    const entry = response.recommendations[0];
    assert.equal(entry?.requiredMaterials?.[0]?.materialKey, "beryl");
    assert.equal(entry?.routeScores?.[0]?.signals.qualityThreshold, 900);
    assert.equal(entry?.routeScores?.[0]?.signals.thresholdChance, 0);
    snapshots.push(entry?.score);
  }
  assert.deepEqual(snapshots, [snapshots[0], snapshots[0], snapshots[0]]);
});

test("static fallback deduplicates material demand across different queue qualities", () => {
  const req = request("quality");
  req.requiredMaterials = [
    { materialId: "agricium", materialName: "Agricium", requiredQuantity: 2, selectedQuality: 902 },
    { materialId: "agricium", materialName: "Agricium", requiredQuantity: 3, selectedQuality: 947 },
  ];
  const ridge = buildStaticRecommendations(req, fixtureStaticIndex()).recommendations
    .find((location) => location.locationName === "Quality Ridge");
  assert.ok(ridge);
  assert.equal(ridge.requiredMaterials?.length, 1);
  assert.equal(ridge.routeScores?.length, 1);
  assert.equal(ridge.requiredMaterials?.[0]?.requiredQuantity, 5);
});
