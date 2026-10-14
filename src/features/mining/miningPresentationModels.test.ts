import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMiningEnvironmentPresentation,
  buildMiningLocationSurveyPresentation,
  buildMiningSelectedSpawnCompetitionPools,
  buildMiningSpawnCompetitionPools,
  compareMiningMethodMaterialEntries,
} from "./miningPresentationModels";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { StaticLocationMaterialRow } from "./staticMiningIndex";

const materialRows = JSON.parse(readFileSync(resolve("server-data/mining/indexes/location-material.json"), "utf8")) as StaticLocationMaterialRow[];

test("keeps missing or null environment fields visibly unknown without manufacturing a value", () => {
  assert.deepEqual(buildMiningEnvironmentPresentation(null), {
    breathability: "unknown",
    temperature: "unknown",
    temperatureCelsius: null,
  });
  assert.deepEqual(buildMiningEnvironmentPresentation({ breathable: null, temperatureClassification: null, temperatureCelsius: null }), {
    breathability: "unknown",
    temperature: "unknown",
    temperatureCelsius: null,
  });
});

test("uses only canonical environment fields and retains useful temperature detail", () => {
  const environment = buildMiningEnvironmentPresentation({
    breathable: false,
    temperatureClassification: "cold",
    temperatureCelsius: -42,
  });
  assert.deepEqual(environment, {
    breathability: "non-breathable",
    temperature: "cold",
    temperatureCelsius: -42,
  });
});

test("builds one shared source-backed survey projection for location cards and detail", () => {
  const survey = buildMiningLocationSurveyPresentation(
    {
      breathable: true,
      temperatureClassification: "optimal",
      temperatureCelsius: 22,
    },
    [
      { method: "Surface Ship", share: 0.8 },
      { method: "Hand", share: 0.2 },
      { method: "Unknown", share: 0 },
    ],
  );

  assert.deepEqual(survey.environment, { breathability: "breathable", temperature: "optimal", temperatureCelsius: 22 });
  assert.deepEqual(survey.methods, [
    { method: "Surface Ship", share: 0.8 },
    { method: "Hand", share: 0.2 },
  ]);
});

test("builds the source-backed Copper Pyro VI SpaceShip_Mineables pool", () => {
  const terminusRows = materialRows.filter((row) => row.systemKey === "Pyro" && row.locationDisplayName === "Pyro VI (Terminus)");
  const [pool] = buildMiningSpawnCompetitionPools(terminusRows, "copper", "SpaceShip_Mineables");
  assert.ok(pool);
  assert.equal(pool.members.length, 7);
  assert.equal(pool.competitorCount, 6);
  assert.deepEqual(pool.members.map((member) => [member.materialName, member.relativeProbability]), [
    ["Copper", 20.8],
    ["Raw Ice", 20.8],
    ["Gold", 18],
    ["Agricium", 14.2],
    ["Titanium", 14.2],
    ["Riccite", 10],
    ["Stileron", 2],
  ]);
  assert.deepEqual(pool.target, {
    materialKey: "copper",
    materialName: "Copper",
    groupProbability: 7.5,
    relativeProbability: 20.8,
    materialProbability: 1,
    sourceProbability: 0.015600000000000001,
  });
});

test("retains valid zero separately from missing and does not collapse delivered probabilities", () => {
  const rows = [
    { materialId: "a", materialName: "Target", sources: [{ materialKey: "target", materialName: "Target", groupName: "pool", groupProbability: 0, relativeProbability: 0, materialProbability: 1, sourceProbability: 0 }] },
    { materialId: "b", materialName: "Missing", sources: [{ materialKey: "missing", materialName: "Missing", groupName: "pool" }] },
  ] as StaticLocationMaterialRow[];
  const [pool] = buildMiningSpawnCompetitionPools(rows, "target");
  assert.equal(pool.target.groupProbability, 0);
  assert.equal(pool.target.relativeProbability, 0);
  assert.equal(pool.target.materialProbability, 1);
  assert.equal(pool.target.sourceProbability, 0);
  assert.equal(pool.competitors[0].relativeProbability, undefined);
});

test("excludes the resolved target when the caller identifies it by material ID", () => {
  const rows = [
    { materialId: "target-id", materialName: "Target", sources: [{ materialKey: "target-key", materialName: "Target", groupName: "pool", relativeProbability: 80 }] },
    { materialId: "peer-id", materialName: "Peer", sources: [{ materialKey: "peer-key", materialName: "Peer", groupName: "pool", relativeProbability: 20 }] },
  ] as StaticLocationMaterialRow[];
  const [pool] = buildMiningSpawnCompetitionPools(rows, "target-id");
  assert.equal(pool.target.materialKey, "target-key");
  assert.equal(pool.competitorCount, 1);
  assert.deepEqual(pool.competitors.map((member) => member.materialKey), ["peer-key"]);
});

test("orders pools deterministically and returns every target source group", () => {
  const rows = [
    { materialId: "a", materialName: "Target", sources: [{ materialKey: "target", materialName: "Target", groupName: "Beta", relativeProbability: 2 }, { materialKey: "target", materialName: "Target", groupName: "Alpha", relativeProbability: 2 }] },
    { materialId: "b", materialName: "Zulu", sources: [{ materialKey: "zulu", materialName: "Zulu", groupName: "Alpha", relativeProbability: 2 }] },
    { materialId: "c", materialName: "Able", sources: [{ materialKey: "able", materialName: "Able", groupName: "Alpha", relativeProbability: 2 }] },
  ] as StaticLocationMaterialRow[];
  const pools = buildMiningSpawnCompetitionPools(rows, "target");
  assert.deepEqual(pools.map((pool) => pool.sourceGroup), ["Alpha", "Beta"]);
  assert.deepEqual(pools[0].members.map((member) => member.materialName), ["Able", "Target", "Zulu"]);
});

test("coalesces selected materials only within their shared delivered source pool", () => {
  const rows = [
    { materialId: "copper", materialName: "Copper", sources: [{ materialKey: "copper", materialName: "Copper", groupName: "ship", relativeProbability: 60 }] },
    { materialId: "gold", materialName: "Gold", sources: [{ materialKey: "gold", materialName: "Gold", groupName: "ship", relativeProbability: 30 }, { materialKey: "gold", materialName: "Gold", groupName: "hand", relativeProbability: 50 }] },
    { materialId: "iron", materialName: "Iron", sources: [{ materialKey: "iron", materialName: "Iron", groupName: "ship", relativeProbability: 10 }, { materialKey: "iron", materialName: "Iron", groupName: "hand", relativeProbability: 50 }] },
  ] as StaticLocationMaterialRow[];
  const pools = buildMiningSelectedSpawnCompetitionPools(rows, ["copper", "gold"]);
  assert.deepEqual(pools.map((pool) => [pool.sourceGroup, pool.selectedMembers.map((member) => member.materialName), pool.competitorCount]), [
    ["hand", ["Gold"], 1],
    ["ship", ["Copper", "Gold"], 1],
  ]);
  assert.deepEqual(pools[1].members.map((member) => [member.materialName, member.relativeProbability]), [
    ["Copper", 60], ["Gold", 30], ["Iron", 10],
  ]);
});

test("omits an absent selected material instead of manufacturing a competition pool", () => {
  const rows = [
    { materialId: "copper", materialName: "Copper", sources: [{ materialKey: "copper", materialName: "Copper", groupName: "ship", relativeProbability: 60 }] },
    { materialId: "iron", materialName: "Iron", sources: [{ materialKey: "iron", materialName: "Iron", groupName: "ship", relativeProbability: 40 }] },
  ] as StaticLocationMaterialRow[];

  assert.deepEqual(buildMiningSelectedSpawnCompetitionPools(rows, ["beryl"]), []);
});

test("keeps selected materials in separate delivered pools when they do not share a source group", () => {
  const rows = [
    { materialId: "copper", materialName: "Copper", sources: [{ materialKey: "copper", materialName: "Copper", groupName: "ship", relativeProbability: 60 }] },
    { materialId: "gold", materialName: "Gold", sources: [{ materialKey: "gold", materialName: "Gold", groupName: "hand", relativeProbability: 50 }] },
    { materialId: "iron", materialName: "Iron", sources: [{ materialKey: "iron", materialName: "Iron", groupName: "ship", relativeProbability: 40 }] },
    { materialId: "hadanite", materialName: "Hadanite", sources: [{ materialKey: "hadanite", materialName: "Hadanite", groupName: "hand", relativeProbability: 50 }] },
  ] as StaticLocationMaterialRow[];

  const pools = buildMiningSelectedSpawnCompetitionPools(rows, ["copper", "gold"]);
  assert.deepEqual(pools.map((pool) => [pool.sourceGroup, pool.selectedMembers.map((member) => member.materialKey)]), [
    ["hand", ["gold"]],
    ["ship", ["copper"]],
  ]);
});

test("returns no competition section data when none of the selected materials are present", () => {
  const rows = [
    { materialId: "copper", materialName: "Copper", sources: [{ materialKey: "copper", materialName: "Copper", groupName: "ship", relativeProbability: 60 }] },
  ] as StaticLocationMaterialRow[];

  assert.deepEqual(buildMiningSelectedSpawnCompetitionPools(rows, ["beryl", "carinite"]), []);
});

test("suppresses duplicate source pools when selected identities repeat", () => {
  const rows = [
    { materialId: "copper", materialName: "Copper", sources: [{ materialKey: "copper", materialName: "Copper", groupName: "ship", relativeProbability: 60 }] },
    { materialId: "gold", materialName: "Gold", sources: [{ materialKey: "gold", materialName: "Gold", groupName: "ship", relativeProbability: 40 }] },
  ] as StaticLocationMaterialRow[];

  const pools = buildMiningSelectedSpawnCompetitionPools(rows, ["copper", "Copper", "copper"]);
  assert.equal(pools.length, 1);
  assert.deepEqual(pools[0].selectedMembers.map((member) => member.materialKey), ["copper"]);
});

test("Magda renders only the delivered Hand, Vehicle, and Surface Ship pools for mixed selected coverage", () => {
  const magdaRows = materialRows.filter((row) => row.systemKey === "Stanton" && row.locationDisplayName === "Magda");
  const pools = buildMiningSelectedSpawnCompetitionPools(magdaRows, [
    "aluminum", "beryl", "quantanium", "stileron", "tin", "carinite", "feynmaline", "aphorite",
  ]);

  assert.deepEqual(pools.map((pool) => [pool.sourceGroup, pool.selectedMembers.map((member) => member.materialName)]), [
    ["FPS_Mineables", ["Aphorite"]],
    ["GroundVehicle_Mineables", ["Feynmaline"]],
    ["SpaceShip_Mineables", ["Aluminum", "Quantanium"]],
  ]);
  assert.equal(pools.flatMap((pool) => pool.selectedMembers).some((member) => ["Beryl", "Carinite", "Stileron", "Tin"].includes(member.materialName)), false);
});

test("orders method-associated material rows without collapsing identical materials", () => {
  const entries = [
    { name: "Beryl", miningType: "Hand", associationKey: "beryl:hand" },
    { name: "Copper", miningType: "Vehicle", associationKey: "copper:vehicle" },
    { name: "Copper", miningType: "Ship", associationKey: "copper:ship" },
    { name: "Aluminum", miningType: "Surface Ship", associationKey: "aluminum:ship" },
  ].sort(compareMiningMethodMaterialEntries);
  assert.deepEqual(entries.map((entry) => entry.associationKey), ["aluminum:ship", "copper:ship", "copper:vehicle", "beryl:hand"]);
});
