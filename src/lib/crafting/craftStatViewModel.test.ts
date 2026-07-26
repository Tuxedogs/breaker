import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  buildCraftStatViewModel,
  listAmbiguousBenefitDirectionProperties,
  type CraftStatComparisonRowView,
} from "./craftStatViewModel.ts";
import { buildFittingDetailFromFpsComponentCard } from "./fpsComponentCardDetail.ts";
import type { ComponentCardIndexRecord } from "../componentCardIndex.ts";
import type { ComponentRecipe } from "../../components/industry/crafting/utils/craftingTypes.ts";
import type { FittingComponentDetail } from "../fitting/fittingApi.ts";
import type { TotalModifierRow } from "../../components/industry/crafting/utils/recipeQuality.ts";

function loadCard(blueprintId: string): ComponentCardIndexRecord {
  const filePath = path.join(
    process.cwd(),
    "server-data",
    "crafting",
    "component-cards",
    "by-id",
    `${blueprintId}.json`,
  );
  return JSON.parse(readFileSync(filePath, "utf8")) as ComponentCardIndexRecord;
}

function shieldDetail(): FittingComponentDetail {
  return {
    id: "shield-test",
    name: "SHIELD_TEST",
    displayName: "Test Shield",
    manufacturer: "Gorgon",
    type: "shield",
    subtype: null,
    size: 1,
    grade: "A",
    class: "military",
    confidence: "high",
    stats: {
      shieldHp: 3168,
      regenRate: 697,
      powerDraw: 3,
      health: 270,
      mass: 120,
    },
    mitigation: {
      kind: "shield",
      shieldHp: 3168,
      maxShieldHealth: 3168,
      maxShieldRegen: 697,
      damagedRegenDelay: 5,
      downedRegenDelay: null,
      shieldFaceCount: null,
      resistanceByDamageType: null,
      absorptionByDamageType: null,
      regenByPowerPip: null,
      regenPowerFormula: null,
      regenPowerFormulaConfidence: null,
    },
  };
}

function shieldRecipe(): ComponentRecipe {
  return {
    blueprint_id: "shield-blueprint",
    component_type: "shield",
    component_name: "SHIELD_TEST",
    size: "1",
    craft_time_seconds: 10,
    output_entityClass: "shield.xml",
    materials: [{
      slot: "shell",
      cost_type: "material",
      material_name: "Stileron",
      cost_id: "stileron",
      quantity: 1,
      qualityModifiers: [{
        component_type: "shield",
        component_name: "SHIELD_TEST",
        size: "1",
        slot: "shell",
        gameplay_property: "GPP_Shield_MaxHealth",
        start_quality: 500,
        end_quality: 900,
        modifier_start: 0,
        modifier_end: 10,
        modifier_start_percent: 0,
        modifier_end_percent: 10,
        gameplay_property_id: "id",
        blueprint_id: "shield-blueprint",
      }],
    }],
  };
}

function findComparisonRow(model: ReturnType<typeof buildCraftStatViewModel>, label: string): CraftStatComparisonRowView | undefined {
  for (const group of model.comparisonGroups) {
    const row = group.rows.find((entry) => entry.label === label);
    if (row) return row;
  }

  for (const group of model.groups) {
    if (group.kind === "flat" && group.comparisonRows) {
      const row = group.comparisonRows.find((entry) => entry.label === label);
      if (row) return row;
    }
    if (group.kind === "nested") {
      for (const subcluster of group.subclusters) {
        const row = subcluster.comparisonRows?.find((entry) => entry.label === label);
        if (row) return row;
      }
    }
  }
  return undefined;
}

test("buildCraftStatViewModel exposes base target allocation comparison rows", () => {
  const detail = shieldDetail();
  const recipe = shieldRecipe();
  const targetModifiers: TotalModifierRow[] = [{
    property: "GPP_Shield_MaxHealth",
    totalValue: 1.77,
    contributions: [{ materialName: "Stileron", value: 1.77 }],
  }];
  const allocationModifiers: TotalModifierRow[] = [{
    property: "GPP_Shield_MaxHealth",
    totalValue: 1.17,
    contributions: [{ materialName: "Stileron", value: 1.17 }],
  }];

  const model = buildCraftStatViewModel({
    detail,
    recipe,
    targetModifiers,
    allocationModifiers,
    targetConfigured: true,
    allocationConfigured: true,
  });

  assert.equal(model.status, "ready");
  const row = findComparisonRow(model, "Shield HP");
  assert.ok(row);
  assert.equal(row.baseValue, "3,168");
  assert.equal(row.target.state, "ready");
  assert.equal(row.allocation.state, "ready");
  assert.equal(row.target.value, "3,224.07");
  assert.equal(row.allocation.value, "3,205.07");
  assert.equal(row.target.percentDelta, "+1.8%");
  assert.equal(row.allocation.percentDelta, "+1.2%");
  assert.equal(row.target.impactClass, "craft-ok");
  assert.equal(row.allocation.impactClass, "craft-ok");
  assert.equal(row.benefitDirection, "higher-is-better");
});

test("buildCraftStatViewModel colors lower-is-better improvements as beneficial", () => {
  const detail: FittingComponentDetail = {
    ...shieldDetail(),
    type: "quantum_drive",
    stats: { quantumFuelRequirement: 100, normalJumpSpeed: 200000000 },
  };
  const recipe: ComponentRecipe = {
    ...shieldRecipe(),
    component_type: "quantum_drive",
    materials: [{
      slot: "frame",
      cost_type: "material",
      material_name: "Iron",
      cost_id: "iron",
      quantity: 1,
      qualityModifiers: [{
        component_type: "quantum_drive",
        component_name: "SHIELD_TEST",
        size: "1",
        slot: "frame",
        gameplay_property: "GPP_Quantum_FuelRequirement",
        start_quality: 500,
        end_quality: 900,
        modifier_start: 0,
        modifier_end: -10,
        modifier_start_percent: 0,
        modifier_end_percent: -10,
        gameplay_property_id: "id",
        blueprint_id: "shield-blueprint",
      }],
    }],
  };

  const model = buildCraftStatViewModel({
    detail,
    recipe,
    targetModifiers: [{ property: "GPP_Quantum_FuelRequirement", totalValue: -5, contributions: [] }],
    allocationModifiers: [{ property: "GPP_Quantum_FuelRequirement", totalValue: 5, contributions: [] }],
    targetConfigured: true,
    allocationConfigured: true,
  });

  const row = findComparisonRow(model, "Quantum Fuel Req.");
  assert.ok(row);
  assert.equal(row.benefitDirection, "lower-is-better");
  assert.equal(row.target.impactClass, "craft-ok");
  assert.equal(row.allocation.impactClass, "craft-shortage");
});

test("buildCraftStatViewModel shows zero deltas and empty target/allocation states", () => {
  const model = buildCraftStatViewModel({
    detail: shieldDetail(),
    recipe: shieldRecipe(),
    targetModifiers: [],
    allocationModifiers: [],
    targetConfigured: false,
    allocationConfigured: false,
  });

  const row = findComparisonRow(model, "Shield HP");
  assert.ok(row);
  assert.equal(row.target.state, "not_set");
  assert.equal(row.target.emptyLabel, "Not set");
  assert.equal(row.allocation.state, "no_allocation");
  assert.equal(row.allocation.emptyLabel, "No allocation");
});

test("buildCraftStatViewModel keeps neutral impact for zero modifiers", () => {
  const model = buildCraftStatViewModel({
    detail: shieldDetail(),
    recipe: shieldRecipe(),
    targetModifiers: [{ property: "GPP_Shield_MaxHealth", totalValue: 0, contributions: [] }],
    allocationModifiers: [{ property: "GPP_Shield_MaxHealth", totalValue: 0, contributions: [] }],
    targetConfigured: true,
    allocationConfigured: true,
  });

  const row = findComparisonRow(model, "Shield HP");
  assert.ok(row);
  assert.equal(row.target.value, "3,168");
  assert.equal(row.allocation.value, "3,168");
  assert.equal(row.target.impactClass, "");
  assert.equal(row.allocation.impactClass, "");
});

test("buildCraftStatViewModel groups FPS armor resistance as a matrix", () => {
  const detail = buildFittingDetailFromFpsComponentCard(loadCard("005d95db-96ca-45b7-9647-7e7537b8fac8"));
  assert.ok(detail);
  const model = buildCraftStatViewModel({ detail });
  assert.equal(model.status, "ready");
  assert.ok(model.groups.some((group) => group.kind === "matrix"));
});

test("buildCraftStatViewModel exposes matrix and additional statistics in its overview", () => {
  const shield = shieldDetail();
  shield.mitigation = {
    ...shield.mitigation!,
    kind: "shield",
    resistanceByDamageType: {
      physical: { min: 0.1, max: 0.2 },
      distortion: { value: 0.35 },
    },
    absorptionByDamageType: {
      physical: { min: 0.4, max: 0.5 },
    },
  };
  const shieldModel = buildCraftStatViewModel({ detail: shield });
  const resistanceStats = shieldModel.overviewGroups
    .find((group) => group.title === "Resistance / Absorption")
    ?.stats ?? [];
  assert.ok(resistanceStats.some((stat) => stat.label === "Physical Resistance" && stat.value === "10%-20%"));
  assert.ok(resistanceStats.some((stat) => stat.label === "Distortion Resistance" && stat.value === "35%"));
  assert.ok(resistanceStats.some((stat) => stat.label === "Physical Absorption" && stat.value === "40%-50%"));

  const generic: FittingComponentDetail = {
    ...shieldDetail(),
    type: "missile_launcher",
    stats: { health: 450, powerDraw: 5 },
    mitigation: null,
  };
  const genericModel = buildCraftStatViewModel({ detail: generic });
  const additional = genericModel.overviewGroups.find((group) => group.title === "Additional");
  assert.ok(additional?.stats.some((stat) => stat.label === "Component HP" && stat.value === "450"));
  assert.ok(additional?.stats.some((stat) => stat.label === "Power Draw" && stat.value === "5"));
});

test("buildCraftStatViewModel preserves FPS weapon trait groups in its overview", () => {
  const detail = buildFittingDetailFromFpsComponentCard(loadCard("1a85280e-7b8f-4486-a563-17cd2549d268"));
  assert.ok(detail);
  const model = buildCraftStatViewModel({ detail });

  assert.deepEqual(
    model.overviewGroups.slice(0, 5).map((group) => group.title),
    ["Damage Output", "Projectile", "Penetration", "Spread", "Thermal / Power"],
  );
  assert.ok(model.overviewGroups
    .find((group) => group.title === "Spread")
    ?.stats.some((stat) => stat.label === "Spread Min–Max"));
});

test("buildCraftStatViewModel prefers loading over stale detail", () => {
  const model = buildCraftStatViewModel({
    detail: shieldDetail(),
    loading: true,
  });
  assert.equal(model.status, "loading");
  assert.equal(model.comparisonGroups.length, 0);
  assert.equal(model.overviewGroups.length, 0);
});

test("listAmbiguousBenefitDirectionProperties reports unknown GPP directions", () => {
  const recipe: ComponentRecipe = {
    ...shieldRecipe(),
    materials: [{
      slot: "frame",
      cost_type: "material",
      material_name: "Iron",
      cost_id: "iron",
      quantity: 1,
      qualityModifiers: [{
        component_type: "shield",
        component_name: "SHIELD_TEST",
        size: "1",
        slot: "frame",
        gameplay_property: "GPP_Weapon_Tractor_Force",
        start_quality: 500,
        end_quality: 900,
        modifier_start: 0,
        modifier_end: 5,
        modifier_start_percent: 0,
        modifier_end_percent: 5,
        gameplay_property_id: "id",
        blueprint_id: "shield-blueprint",
      }],
    }],
  };

  assert.deepEqual(listAmbiguousBenefitDirectionProperties(recipe), ["GPP_Weapon_Tractor_Force"]);
});
