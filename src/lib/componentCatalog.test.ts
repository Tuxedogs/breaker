import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { buildComponentCatalogStatMetrics } from "../components/industry/crafting/utils/componentCardSchema.ts";
import type { ComponentCardIndexRecord } from "./componentCardIndex.ts";
import { validateComponentCatalogGeneration } from "./componentCatalogGeneration.ts";
import {
  classifyRecipeInput,
  getRecipeInputDisplayName,
} from "./crafting/recipeInputClassification.ts";

function loadCard(id: string): ComponentCardIndexRecord {
  return JSON.parse(readFileSync(path.join(
    process.cwd(),
    "server-data",
    "crafting",
    "component-cards",
    "by-id",
    `${id}.json`,
  ), "utf8")) as ComponentCardIndexRecord;
}

function loadJson(...segments: string[]): unknown {
  return JSON.parse(readFileSync(path.join(process.cwd(), ...segments), "utf8")) as unknown;
}

const typedCases = [
  ["radar", "68e93890-885c-41ab-850a-73047781c37b", "Ping Cooldown"],
  ["power plant", "093d67a2-c4d2-4141-9b9e-8dd9978e96b2", "Power Generation"],
  ["cooler", "93d6786c-83fa-4d42-8c7b-87c87adb2b13", "Coolant Generation"],
  ["shield", "6f72bc54-ddc6-4a08-b68e-0b8506cd43a8", "Shield HP"],
  ["FPS ammo", "e5dbfcd7-031c-4483-82f5-37a616d327d1", "Magazine Capacity"],
  ["FPS armor", "172f6f26-9a96-450e-b379-9ccb734ed744", "Physical Res"],
  ["FPS weapon", "6180c2b5-0f14-45d7-afbb-49dac80fb317", "Alpha Damage"],
] as const;

for (const [label, id, expectedMetric] of typedCases) {
  test(`${label} exposes categorized catalog base stats`, () => {
    const metrics = buildComponentCatalogStatMetrics(loadCard(id));
    assert.ok(metrics.some((metric) => metric.label === expectedMetric), JSON.stringify(metrics));
  });
}

test("tractor and utility records retain common catalog stats without Fitting", () => {
  for (const id of [
    "14ef0bfc-2c60-41d4-a2b7-36bb43027816",
    "40e0d74b-2449-4102-a856-514c4c62400b",
  ]) {
    const metrics = buildComponentCatalogStatMetrics(loadCard(id));
    assert.ok(metrics.some((metric) => metric.label === "Component HP"), JSON.stringify(metrics));
    assert.ok(metrics.some((metric) => metric.label === "Mass"), JSON.stringify(metrics));
  }
});

test("Insulative Liner remains a named recipe part, not an inventory material", () => {
  const input = {
    costId: "fde0cd65-8827-4b23-804d-cc8845dfa7ac",
    materialKey: "insulativelinermaterial",
    costType: "resource",
    slotDisplayName: "Insulative Liner",
    materialName: "Insulative Liner Material",
  };
  assert.equal(classifyRecipeInput(input), "part");
  assert.equal(getRecipeInputDisplayName(input), "Insulative Liner");
  assert.equal(classifyRecipeInput({ costId: "f386a33c-ac9a-400a-a7b8-fe1fc7c8d270", costType: "resource" }), "material");
  assert.equal(classifyRecipeInput({
    costId: "125dd723-95ad-488d-830f-62c954445ca1",
    materialKey: "hadanite",
    materialName: "Hadanite",
    costType: "item",
  }), "material");

  const recipeShard = loadJson(
    "server-data",
    "crafting",
    "recipes",
    "by-blueprint",
    "02858dde-eb44-4326-84ca-bd1abc53b4fe.json",
  ) as { record?: { materials?: Array<{ inputKind?: string; materialName?: string }> } };
  const liner = recipeShard.record?.materials?.find((material) => material.inputKind === "part");
  assert.deepEqual(liner && { inputKind: liner.inputKind, materialName: liner.materialName }, {
    inputKind: "part",
    materialName: "Insulative Liner",
  });

  const facets = loadJson(
    "server-data",
    "crafting",
    "component-cards",
    "facets.json",
  ) as { facets?: { materials?: Array<{ value?: string; label?: string }> } };
  const materialFacets = facets.facets?.materials ?? [];
  assert.ok(materialFacets.some((material) => material.label === "Iron"));
  assert.ok(!materialFacets.some((material) => /insulative liner/i.test(material.label ?? "")));

  const armorCard = loadCard("005d95db-96ca-45b7-9647-7e7537b8fac8");
  assert.ok(!armorCard.materials?.some((material) => /insulative liner/i.test(material.name)));
  assert.ok(!armorCard.card.materialsPreview.some((material) => /insulative liner/i.test(material.name)));
});

test("current recipes missing from the upstream snapshot receive catalog cards", () => {
  const shipWeapon = loadCard("ad3568b3-9a28-441e-b8cd-af572cd52e3f");
  assert.equal(shipWeapon.name, "CF-117 Bulldog \"Hazard-Zone\" Repeater");
  assert.ok(buildComponentCatalogStatMetrics(shipWeapon).some((metric) => metric.label === "Alpha Damage"));
  assert.ok(shipWeapon.materials?.some((material) => material.materialKey === "hadanite"));

  const fpsArmor = loadCard("5fa322e9-ddb3-4696-94fb-45725aca6aef");
  assert.ok(buildComponentCatalogStatMetrics(fpsArmor).some((metric) => metric.label === "Armor Slot"));
  assert.ok(!fpsArmor.materials?.some((material) => /insulative liner/i.test(material.name)));

  const fpsWeapon = loadCard("b488199e-f0fc-4e8b-89bd-d3a435d6dce1");
  assert.ok(buildComponentCatalogStatMetrics(fpsWeapon).some((metric) => metric.label === "Weapon Class"));
});

test("mixed component catalog generations are rejected", () => {
  assert.doesNotThrow(() => validateComponentCatalogGeneration(
    "2026-07-16T00:00:00.000Z",
    { generatedAt: "2026-07-16T00:00:00.000Z" },
  ));
  assert.throws(() => validateComponentCatalogGeneration(
    "2026-07-16T00:00:00.000Z",
    { generatedAt: "2026-06-23T00:00:00.000Z" },
  ), /generation mismatch/);
});
