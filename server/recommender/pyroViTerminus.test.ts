import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeMiningLocationName } from "./locationNormalization";
import { getRecommendations } from "./recommender.service";

const PYRO_VI_MATERIALS = [
  "Agricium",
  "Aphorite",
  "Copper",
  "Dolivine",
  "Feynmaline",
  "Gold",
  "Janalite",
  "Raw Ice",
  "Riccite",
  "Stileron",
  "Titanium",
];

const PYRO_V_MOON_MATERIALS: Record<string, string[]> = {
  "Pyro V-a (Ignis)": ["Aphorite", "Dolivine", "Feynmaline", "Gold", "Hadanite", "Riccite", "Silicon", "Tin"],
  "Pyro V-b (Vatra)": ["Aphorite", "Beradom", "Dolivine", "Glacosite", "Gold", "Hadanite", "Iron", "Riccite", "Silicon"],
  "Pyro V-c (Adir)": ["Aphorite", "Borase", "Dolivine", "Glacosite", "Hadanite", "Iron", "Riccite", "Tungsten"],
  "Pyro V-d (Fairo)": ["Aphorite", "Beradom", "Bexalite", "Dolivine", "Gold", "Hadanite", "Iron", "Silicon", "Tungsten"],
  "Pyro V-e (Fuego)": ["Aphorite", "Aslarite", "Bexalite", "Borase", "Dolivine", "Feynmaline", "Hephaestanite", "Iron", "Janalite"],
  "Pyro V-f (Vuur)": ["Agricium", "Aphorite", "Aslarite", "Bexalite", "Dolivine", "Glacosite", "Hadanite", "Hephaestanite", "Iron"],
};

test("Pyro6 and Terminus normalize to Pyro VI without consuming Terminus Ring", () => {
  assert.equal(normalizeMiningLocationName("Pyro", "Pyro6"), "Pyro VI (Terminus)");
  assert.equal(normalizeMiningLocationName("Pyro", "Terminus"), "Pyro VI (Terminus)");
  assert.equal(normalizeMiningLocationName("Pyro", "Terminus VI"), "Pyro VI (Terminus)");
  assert.equal(normalizeMiningLocationName("Pyro", "Pyro VI (Terminus)"), "Pyro VI (Terminus)");
  assert.equal(normalizeMiningLocationName("Pyro", "Terminus Ring"), "Terminus Ring");
});

test("every extracted Pyro VI material can produce a Pyro VI recommendation", async () => {
  for (const materialName of PYRO_VI_MATERIALS) {
    const response = await getRecommendations({
      materialRequirements: [{
        materialName,
        displayName: materialName,
        requiredQuantity: 1,
        selectedQuality: 900,
      }],
    });

    const route = response.recommendations.find((entry) => entry.locationName === "Pyro VI (Terminus)");
    assert.ok(route, `${materialName} should recommend Pyro VI (Terminus)`);
    assert.ok(route.matchedLocationCodes?.includes("Pyro6"), `${materialName} should retain the Pyro6 source identity`);
  }
});

test("published mining index keeps Pyro VI source rows separate from Terminus Ring", async () => {
  const rows = JSON.parse(await readFile("server-data/mining/indexes/location-material.json", "utf8")) as Array<{
    systemKey?: string;
    locationKey?: string;
    materialName?: string;
  }>;
  const pyroViMaterials = rows
    .filter((row) => row.systemKey === "Pyro" && row.locationKey === "Pyro VI (Terminus)")
    .map((row) => row.materialName)
    .sort();
  const ringMaterials = rows
    .filter((row) => row.systemKey === "Pyro" && row.locationKey === "Terminus Ring")
    .map((row) => row.materialName)
    .sort();

  assert.deepEqual(pyroViMaterials, [...PYRO_VI_MATERIALS].sort());
  assert.deepEqual(ringMaterials, []);
});

test("published mining index retains every extracted Pyro V moon material", async () => {
  const rows = JSON.parse(await readFile("server-data/mining/indexes/location-material.json", "utf8")) as Array<{
    systemKey?: string;
    locationKey?: string;
    materialName?: string;
  }>;

  for (const [locationKey, expectedMaterials] of Object.entries(PYRO_V_MOON_MATERIALS)) {
    const actualMaterials = rows
      .filter((row) => row.systemKey === "Pyro" && row.locationKey === locationKey)
      .map((row) => row.materialName)
      .sort();
    assert.deepEqual(actualMaterials, [...expectedMaterials].sort(), `${locationKey} should remain indexed`);
  }
});
