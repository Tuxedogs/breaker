import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildSourceCatalog } from "./sourceCatalog.js";

test("Source catalog preserves quantified mineable evidence without filling unsupported categories", () => {
  const catalog = buildSourceCatalog([{
    materialId: "material-1",
    materialName: "Exampleium",
    primaryMaterialKey: "exampleium",
    sources: [{
      providerGuid: "provider-1",
      providerName: "HPP_Example",
      harvestableGuid: "member-1",
      harvestableName: "Mining_Exampleium",
      compositionGuid: "composition-1",
      entityClass: "entity-1",
      mineableEntity: "MineableRock_Exampleium",
      spawnType: "ship_mineable",
      groupName: "SpaceShip_Mineables",
      system: "Pyro",
      location: "Pyro VI",
      locationType: "planet",
      sourceLocationId: "location-1",
      sourceLocationParentIds: ["system-1"],
      systemLocationId: "system-1",
      groupProbability: 7.5,
      relativeProbability: 14.2,
      materialProbability: 1,
      probability: 0.1065,
      locationResolution: { method: "mining_compendium_material_location", confidence: "medium", providerAmbiguous: true },
    }],
  }]);

  assert.deepEqual(catalog.categories, {
    mineable: { availability: "present" },
    hand_harvestable: { availability: "unknown" },
    wildlife: { availability: "unknown" },
  });
  assert.equal(catalog.records.length, 1);
  assert.equal(catalog.records[0]?.source.groupName, "SpaceShip_Mineables");
  assert.deepEqual(catalog.records[0]?.competitionPool, {
    quantified: true,
    groupProbability: 7.5,
    relativeProbability: 14.2,
    materialProbability: 1,
    probability: 0.1065,
  });
  assert.equal(catalog.records[0]?.location.evidence, "exact");
  assert.deepEqual(catalog.records[0]?.provenance, {
    source: "published_scintel_mining_registry",
    locationResolution: {
      status: "present",
      method: "mining_compendium_material_location",
      confidence: "medium",
      providerAmbiguous: true,
    },
  });
});

test("Source catalog preserves an unknown location instead of asserting absence", () => {
  const catalog = buildSourceCatalog([{
    materialName: "Unresolved",
    sources: [{ providerName: "unresolved-provider", location: "unresolved-location" }],
  }]);

  assert.equal(catalog.records[0]?.location.evidence, "unknown");
  assert.equal(catalog.records[0]?.location.sourceLocationId, null);
  assert.equal(catalog.records[0]?.provenance.locationResolution.status, "unknown");
  assert.equal(catalog.records[0]?.provenance.locationResolution.confidence, "unknown");
});

test("Source catalog distinguishes parent-only location evidence", () => {
  const catalog = buildSourceCatalog([{
    materialId: "material-2",
    sources: [{ providerGuid: "provider-2", sourceLocationParentIds: ["system-2"] }],
  }]);

  assert.equal(catalog.records[0]?.location.evidence, "parent_only");
  assert.deepEqual(catalog.records[0]?.location.sourceLocationParentIds, ["system-2"]);
});

test("Source catalog does not call an incomplete delivered pool quantified", () => {
  const catalog = buildSourceCatalog([{
    materialId: "material-3",
    sources: [{ providerGuid: "provider-3", groupProbability: 7.5, relativeProbability: 20 }],
  }]);

  assert.equal(catalog.records[0]?.competitionPool.quantified, false);
});

test("published mining registry projects only its delivered mineable records", async () => {
  const input = JSON.parse(await readFile(
    new URL("../../server-data/mining/recommender/material-sources-quality-enriched.json", import.meta.url),
    "utf8",
  )) as Parameters<typeof buildSourceCatalog>[0];
  const catalog = buildSourceCatalog(input);
  const deliveredCount = input.reduce((count, group) => count + (group.sources?.length ?? 0), 0);

  assert.equal(catalog.records.length, deliveredCount);
  assert.equal(catalog.records.every((record) => record.category === "mineable" && record.recordStatus === "present"), true);
  assert.equal(catalog.categories.hand_harvestable.availability, "unknown");
  assert.equal(catalog.categories.wildlife.availability, "unknown");
});
