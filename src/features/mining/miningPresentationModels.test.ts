import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  buildMiningEnvironmentPresentation,
  buildMiningLocationSurveyPresentation,
  buildMiningSpawnCompetitionPools,
} from "./miningPresentationModels";
import type { StaticLocationDistributionRow, StaticLocationMaterialRow } from "./staticMiningIndex";

const distributionRows = JSON.parse(
  readFileSync(resolve("server-data/mining/indexes/location-distribution.json"), "utf8"),
) as StaticLocationDistributionRow[];
const materialRows = JSON.parse(
  readFileSync(resolve("server-data/mining/indexes/location-material.json"), "utf8"),
) as StaticLocationMaterialRow[];

test("projects the exact delivered Pyro VI environment language", () => {
  const row = distributionRows.find((candidate) => candidate.locationDisplayName === "Pyro VI (Terminus)");
  assert.ok(row);
  const environment = buildMiningEnvironmentPresentation({
    sourceKey: row.locationDescriptionKey,
    sourceText: row.locationShortDescription,
  });

  assert.deepEqual(environment, {
    sourceKey: "@Pyro6_desc",
    sourceText: row.locationShortDescription,
    atmosphere: "Methane-laced",
    climate: "Frigid",
    habitability: "Barely habitable",
  });
});

test("keeps missing and null descriptions unavailable without manufacturing a value", () => {
  assert.deepEqual(buildMiningEnvironmentPresentation(null), {
    sourceKey: undefined,
    sourceText: undefined,
    atmosphere: null,
    climate: null,
    habitability: null,
  });
  assert.deepEqual(buildMiningEnvironmentPresentation({ sourceKey: null, sourceText: null }), {
    sourceKey: null,
    sourceText: null,
    atmosphere: null,
    climate: null,
    habitability: null,
  });
});

test("does not infer environment values when the delivered description has no supported phrase", () => {
  const environment = buildMiningEnvironmentPresentation({
    sourceKey: "@neutral",
    sourceText: "A rocky world containing rare deposits.",
  });
  assert.equal(environment.atmosphere, null);
  assert.equal(environment.climate, null);
  assert.equal(environment.habitability, null);
});

test("retains a full explicit multi-word climate phrase instead of truncating it", () => {
  const environment = buildMiningEnvironmentPresentation({
    sourceKey: "@climate",
    sourceText: "The colder than average climate makes the surface difficult to traverse.",
  });
  assert.equal(environment.climate, "Colder than average");
});

test("builds one shared source-backed survey projection for location cards and detail", () => {
  const survey = buildMiningLocationSurveyPresentation(
    {
      sourceKey: "@Pyro6_desc",
      sourceText: "A barely-habitable world with a frigid climate and methane-laced atmosphere.",
    },
    [
      { method: "Surface Ship", share: 0.8 },
      { method: "Hand", share: 0.2 },
      { method: "Unknown", share: 0 },
    ],
  );

  assert.deepEqual(survey.conditions, [
    { key: "atmosphere", label: "Atmosphere", compactLabel: "Atmo", value: "Methane-laced" },
    { key: "climate", label: "Climate", compactLabel: "Climate", value: "Frigid" },
    { key: "habitability", label: "Habitability", compactLabel: "Habitability", value: "Barely habitable" },
  ]);
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
