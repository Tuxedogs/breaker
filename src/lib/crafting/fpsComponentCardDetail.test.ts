import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildFittingDetailFromFpsComponentCard } from "./fpsComponentCardDetail.ts";
import { buildItemSummaryDetailStatRows } from "../fitting/fittingStatProjection.ts";
import { buildDetailStatGroups } from "./detailStatGroups.ts";
import { buildBuildQueueFittingStatGroups } from "../../components/logistics/buildQueueStatsGroups.ts";
import type { ComponentCardIndexRecord } from "../componentCardIndex.ts";
import type { FittingComponentDetail } from "../fitting/fittingApi.ts";

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

function shipDetail(
  type: FittingComponentDetail["type"],
  stats: FittingComponentDetail["stats"],
  mitigation: FittingComponentDetail["mitigation"] = null,
): FittingComponentDetail {
  return {
    id: `ship-${type}`,
    name: `TEST_${type}`,
    displayName: `Test ${type}`,
    manufacturer: "Test",
    type,
    subtype: null,
    size: 2,
    grade: "A",
    class: "military",
    confidence: "high",
    stats,
    mitigation,
  };
}

test("FPS weapon card fallback produces at least one valid Build Queue stat group", () => {
  const card = loadCard("bd636d35-43fd-4782-a223-40ce0a727f39");
  const detail = buildFittingDetailFromFpsComponentCard(card);
  assert.ok(detail, "expected fps weapon detail from component card");
  assert.equal(detail.type, "fps_weapon");
  assert.equal(detail.stats.alphaDamage, 100);
  assert.equal(detail.stats.fireRateRpm, 55);

  const groups = buildBuildQueueFittingStatGroups(detail);
  assert.ok(groups.length >= 1, `expected >=1 group, got ${groups.length}`);
  assert.ok(groups.some((group) => group.title === "Ballistics / Damage"));
});

test("FPS armor card fallback produces at least one valid Build Queue stat group", () => {
  const card = loadCard("005d95db-96ca-45b7-9647-7e7537b8fac8");
  const detail = buildFittingDetailFromFpsComponentCard(card);
  assert.ok(detail, "expected fps armor detail from component card");
  assert.equal(detail.type, "fps_armor");

  const groups = buildBuildQueueFittingStatGroups(detail);
  assert.ok(groups.length >= 1, `expected >=1 group, got ${groups.length}`);
  assert.ok(groups.some((group) => group.kind === "matrix" && group.title === "Damage Taken Multipliers"));
});

test("ship weapon / shield / quantum / cooler / power plant projections remain unchanged", () => {
  const cases: Array<{ detail: FittingComponentDetail; expectedLabels: string[] }> = [
    {
      detail: shipDetail("ship_weapon", {
        alphaDamage: 120,
        damagePhysical: 120,
        fireRateRpm: 240,
        ammoCapacity: 80,
        projectileSpeed: 900,
        calculatedRange: 1800,
        health: 400,
        mass: 80,
      }, {
        kind: "weapon_projectile",
        damage: { physical: 120, energy: 0, distortion: 0, thermal: 0, biochemical: 0, stun: 0 },
        ammoPenetration: 2,
        basePenetrationDistance: 1.5,
        maxPenetrationThickness: null,
        penetrationParams: null,
      }),
      expectedLabels: ["Alpha Damage", "Physical Damage", "Fire Rate", "Ammo Capacity"],
    },
    {
      detail: shipDetail("shield", {
        shieldHp: 10000,
        regenRate: 200,
        powerDraw: 4,
        health: 500,
        mass: 200,
      }, {
        kind: "shield",
        shieldHp: 10000,
        maxShieldHealth: 10000,
        maxShieldRegen: 200,
        damagedRegenDelay: 3,
        shieldFaceCount: null,
        resistanceByDamageType: { physical: { min: 0, max: 0.2 } },
        absorptionByDamageType: { physical: { min: 0, max: 0.4 } },
        regenByPowerPip: null,
        regenPowerFormula: null,
        regenPowerFormulaConfidence: null,
      }),
      expectedLabels: ["Shield HP", "Regen Rate", "Power Draw"],
    },
    {
      detail: shipDetail("quantum_drive", {
        quantumSpeed: 0.22,
        spoolTime: 4,
        quantumCooldown: 10,
        fuelRate: 1.2,
        powerDraw: 3,
        health: 150,
        mass: 90,
      }),
      expectedLabels: ["Quantum Speed", "Spool Time", "Fuel Rate"],
    },
    {
      detail: shipDetail("cooler", {
        coolingGenerated: 16,
        powerDraw: 1,
        health: 53,
        mass: 43,
        electromagneticEmission: 375,
      }),
      expectedLabels: ["Coolant Generation", "Power Draw", "Component HP"],
    },
    {
      detail: shipDetail("power_plant", {
        powerGenerated: 8,
        powerDraw: 0,
        health: 120,
        mass: 70,
        heatGenerated: 40,
      }),
      expectedLabels: ["Power Generation", "Heat Generation", "Component HP"],
    },
  ];

  for (const { detail, expectedLabels } of cases) {
    const rows = buildItemSummaryDetailStatRows(detail);
    const labels = rows.map((row) => row.label);
    for (const expected of expectedLabels) {
      assert.ok(labels.includes(expected), `${detail.type} missing ${expected}`);
    }

    const groups = buildDetailStatGroups(detail, rows.map((row) => ({ ...row })));
    assert.ok(groups.length >= 1, `${detail.type} should keep grouped output`);
  }
});
