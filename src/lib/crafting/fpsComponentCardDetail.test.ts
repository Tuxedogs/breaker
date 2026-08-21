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

test("CQ7 card fallback exposes its extracted combat and spread statistics", () => {
  const card = loadCard("1a85280e-7b8f-4486-a563-17cd2549d268");
  const detail = buildFittingDetailFromFpsComponentCard(card);
  assert.ok(detail, "expected CQ7 fitting detail from component card");
  assert.equal(detail.type, "fps_weapon");
  assert.equal(detail.stats.alphaDamage, 18);
  assert.equal(detail.stats.dps, 195);
  assert.equal(detail.stats.fireRateRpm, 650);
  assert.equal(detail.stats.ammoCapacity, 40);
  assert.equal(detail.stats.spreadMin, 0.18);
  assert.equal(detail.stats.spreadMax, 3);
  assert.equal(detail.stats.falloffStart, 65);

  const labels = buildItemSummaryDetailStatRows(detail).map((row) => row.label);
  for (const label of ["Alpha Damage", "DPS", "Fire Rate", "Burst Size", "Spread Min–Max", "Damage Falloff Start"]) {
    assert.ok(labels.includes(label), `CQ7 missing ${label}`);
  }
});

test("FPS ammunition cards expose their extracted projectile statistics", () => {
  const card = loadCard("e5dbfcd7-031c-4483-82f5-37a616d327d1");
  const detail = buildFittingDetailFromFpsComponentCard(card);
  assert.ok(detail, "expected FPS ammunition detail from component card");
  assert.equal(detail.type, "fps_ammo");
  assert.equal(detail.stats.alphaDamage, 42.5);
  assert.equal(detail.stats.ammoCapacity, 15);
  assert.equal(detail.stats.projectileSpeed, 800);

  const labels = buildItemSummaryDetailStatRows(detail).map((row) => row.label);
  for (const label of ["Alpha Damage", "Loaded Rounds", "Projectile Speed", "Damage Falloff Start"]) {
    assert.ok(labels.includes(label), `FPS ammunition missing ${label}`);
  }
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

test("vehicle ship-weapon cards cannot become fitting detail fallbacks", () => {
  const legacyShipWeaponCard = {
    id: "legacy-ship-weapon",
    entityClass: "44444444-4444-4444-8444-444444444444",
    kind: "vehicle",
    type: "weapons",
    name: "Legacy Weapon",
    stats: { weapon: { dps: 999999, ammoCapacity: 999999 } },
  };
  assert.equal(buildFittingDetailFromFpsComponentCard(legacyShipWeaponCard as never), null);
});

test("ship weapon and established component projections expose their current labels", () => {
  const cases: Array<{ detail: FittingComponentDetail; expectedLabels: string[] }> = [
    {
      detail: shipDetail("ship_weapon", {
        alphaDamage: 120,
        damagePhysical: 120,
        fireRateRpm: 240,
        maxAmmoCount: 80,
        projectileSpeed: 900,
        projectileMaxTravel: 1800,
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
      expectedLabels: ["Alpha Damage", "Physical Damage", "Fire Rate", "Ballistic Reserve"],
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
        downedRegenDelay: null,
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
      expectedLabels: ["Quantum Speed", "Spool Time", "Fuel Requirement"],
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

function flattenGroupStats(groups: ReturnType<typeof buildDetailStatGroups>): Map<string, string[]> {
  const byTitle = new Map<string, string[]>();
  for (const group of groups) {
    if (group.kind === "nested") {
      for (const subcluster of group.subclusters) {
        byTitle.set(subcluster.title, subcluster.stats.map((stat) => stat.label));
      }
      continue;
    }
    if (group.kind === "flat") {
      byTitle.set(group.title, group.stats.map((stat) => stat.label));
    }
  }
  return byTitle;
}

test("FPS weapons move falloff stats into Falloff and never receive Ammunition", () => {
  const detail = buildFittingDetailFromFpsComponentCard(loadCard("1a85280e-7b8f-4486-a563-17cd2549d268"));
  assert.ok(detail);
  const groups = flattenGroupStats(buildDetailStatGroups(detail, buildItemSummaryDetailStatRows(detail)));
  const falloff = groups.get("Falloff") ?? [];
  assert.deepEqual(falloff, [
    "Impulse Falloff Start",
    "Impulse Drop Falloff",
    "Impulse Maximum Falloff",
    "Damage Falloff Start",
    "Damage Drop Per Meter",
    "Minimum Damage After Falloff",
  ]);
  assert.equal(groups.has("Ammunition"), false);
  assert.equal((groups.get("Projectile") ?? []).some((label) => label.includes("Falloff")), false);
  assert.equal((groups.get("Penetration") ?? []).some((label) => label.includes("Falloff")), false);
});

test("ship energy weapons keep energy ammunition stats and omit ballistic-only ammunition", () => {
  const detail = shipDetail("ship_weapon", {
    alphaDamage: 90,
    fireRateRpm: 200,
    maxAmmoLoad: 120,
    ammoCostPerShot: 4,
    maxRegenPerSec: 12,
    regenerationCooldown: 1.5,
    maxAmmoCount: 80,
    projectileSpeed: 1400,
  });
  const groups = flattenGroupStats(buildDetailStatGroups(detail, buildItemSummaryDetailStatRows(detail)));
  const ammunition = groups.get("Ammunition") ?? [];
  assert.deepEqual(ammunition, [
    "Energy Maximum Load",
    "Energy Cost Per Shot",
    "Energy Recharge Rate",
    "Recharge Cooldown",
  ]);
  assert.equal(ammunition.includes("Ballistic Reserve"), false);
  assert.equal(ammunition.includes("Ammo Count"), false);
  assert.equal((groups.get("Damage Output") ?? []).includes("Energy Maximum Load"), false);
  assert.equal(groups.has("Falloff"), false);
});

test("ship ballistic weapons keep ballistic ammunition stats and omit energy-only ammunition", () => {
  const detail = shipDetail("ship_weapon", {
    alphaDamage: 40,
    fireRateRpm: 1200,
    maxAmmoCount: 250,
    ammoCostPerShot: 1,
    maxAmmoLoad: null,
    maxRegenPerSec: null,
    regenerationCooldown: 2,
    projectileSpeed: 900,
  });
  const groups = flattenGroupStats(buildDetailStatGroups(detail, buildItemSummaryDetailStatRows(detail)));
  const ammunition = groups.get("Ammunition") ?? [];
  assert.deepEqual(ammunition, [
    "Ballistic Reserve",
    "Energy Cost Per Shot",
  ]);
  assert.equal(ammunition.includes("Energy Maximum Load"), false);
  assert.equal(ammunition.includes("Energy Recharge Rate"), false);
  assert.equal(ammunition.includes("Recharge Cooldown"), false);
  assert.equal((groups.get("Damage Output") ?? []).includes("Ballistic Reserve"), false);
  assert.equal(groups.has("Falloff"), false);
});
