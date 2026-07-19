import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBrowseStatPreviewFromFitting,
  buildDetailStatRowsFromFitting,
  buildFittingIdentityMetricRows,
  buildItemSummaryDetailStatRows,
  getFittingModifierBaseValue,
  inferPrimaryShipWeaponDamageType,
  modifierDetailStatLabelKeys,
} from "./fittingStatProjection.ts";
import type { FittingComponentDetail } from "./fittingApi.ts";

function coolerDetail(): FittingComponentDetail {
  return {
    id: "7db13b34-c8b1-4e1a-9aba-3dcd7087e995",
    name: "COOL_TEST",
    displayName: "Test Cooler",
    manufacturer: null,
    type: "cooler",
    subtype: null,
    size: 2,
    grade: "B",
    class: "civilian",
    confidence: "high",
    stats: {
      coolingGenerated: 16,
      health: 53,
      mass: 43,
      powerDraw: 1,
      fuelRate: null,
    },
    mitigation: null,
  };
}

test("getFittingModifierBaseValue maps coolant generation", () => {
  const detail = coolerDetail();
  assert.equal(
    getFittingModifierBaseValue(detail, "GPP_ItemResource_CoolantGeneration"),
    16,
  );
});

test("getFittingModifierBaseValue omits null quantum fuel rate", () => {
  const detail = coolerDetail();
  assert.equal(getFittingModifierBaseValue(detail, "GPP_Quantum_FuelRequirement"), undefined);
});

test("buildDetailStatRowsFromFitting omits null fitting fields", () => {
  const rows = buildDetailStatRowsFromFitting({
    ...coolerDetail(),
    type: "ship_weapon",
    stats: {
      alphaDamage: 567,
      damageEnergy: 567,
      fireRateRpm: null,
      dps: null,
      projectileSpeed: 1200,
      health: 100,
      mass: 10,
    },
    mitigation: {
      kind: "weapon_projectile",
      damage: {
        physical: 0,
        energy: 567,
        distortion: 0,
        thermal: 0,
        biochemical: 0,
        stun: 0,
      },
      ammoPenetration: null,
      basePenetrationDistance: 2.4,
      maxPenetrationThickness: null,
      penetrationParams: null,
    },
  });

  const labels = rows.map((row) => row.label);
  assert.ok(labels.includes("Alpha Damage"));
  assert.ok(labels.includes("Energy Damage"));
  assert.ok(labels.includes("Projectile Speed"));
  assert.ok(labels.includes("Penetration Distance"));
  assert.equal(labels.includes("Physical Damage"), false);
  assert.equal(labels.includes("Fire Rate"), false);
  assert.equal(labels.includes("DPS"), false);
  assert.equal(labels.includes("Distortion Damage"), false);
});

test("buildDetailStatRowsFromFitting projects live weapon stat labels and grouping fields", () => {
  const rows = buildDetailStatRowsFromFitting({
    ...coolerDetail(),
    type: "ship_weapon",
    stats: {
      alphaDamage: 72.99,
      damagePhysical: 72.99,
      damageEnergy: 0,
      damageDistortion: 0,
      damageThermal: 0,
      damageBiochemical: 0,
      damageStun: 0,
      fireRateRpm: 750,
      maxAmmoCount: 1200,
      projectileSpeed: 1196,
      projectileMaxTravel: 2702.96,
      heatPerShot: 2.4,
      cooldownRate: null,
      powerConsumptionNominal: 0.1,
      maxPenetrationThickness: 0.5,
      health: 850,
      mass: 192,
    },
    mitigation: {
      kind: "weapon_projectile",
      damage: {
        physical: 72.99,
        energy: 0,
        distortion: 0,
        thermal: 0,
        biochemical: 0,
        stun: 0,
      },
      ammoPenetration: null,
      basePenetrationDistance: 2.64,
      maxPenetrationThickness: 0.5,
      penetrationParams: null,
    },
  });

  const labels = rows.map((row) => row.label);
  assert.deepEqual(labels, [
    "Alpha Damage",
    "Physical Damage",
    "Fire Rate",
    "Ballistic Reserve",
    "Projectile Speed",
    "Projectile Max Travel",
    "Penetration",
    "Penetration Distance",
    "Heat Per Shot",
    "Power Nominal",
    "Component HP",
    "Mass",
  ]);
});

test("buildBrowseStatPreviewFromFitting omits meta duplicate labels", () => {
  const preview = buildBrowseStatPreviewFromFitting({
    ...coolerDetail(),
    type: "cooler",
  });

  const labels = preview.map((row) => row.label);
  assert.equal(labels.includes("Size"), false);
  assert.equal(labels.includes("Grade"), false);
  assert.ok(labels.includes("Coolant Generation"));
});

test("buildDetailStatRowsFromFitting renders modeled DPS and action-aware timing", () => {
  const rows = buildDetailStatRowsFromFitting({
    ...coolerDetail(),
    type: "ship_weapon",
    stats: {
      alphaDamage: 100,
      theoreticalDps: 200,
      sustainedDps60: 150,
      damageOver60Seconds: 9000,
      maxAmmoLoad: 25,
      maxRegenPerSec: 3,
      regenerationCooldown: 0.75,
      spreadMin: 0.1,
      spreadMax: 0.2,
      coolingPerSecond: 12,
      timeTillCoolingStarts: 0.5,
    },
    mitigation: null,
    weapon: {
      recordSchemaVersion: 2,
      dpsModelVersion: "foundry-weapon-dps-v1",
      dpsAssumptions: [],
      dpsConfidence: "medium",
      dpsPolicy: null,
      actions: [{
        kind: "rapid", name: "Rapid", actionIndex: 0, sourcePath: "weapon/action",
        fireRateRpm: 120, heatPerShot: 1, heatPerSecond: null, ammoCost: 1,
        pelletCount: 1, damageMultiplier: 1, spreadMin: 0.1, spreadMax: 0.2,
        spreadFirstAttack: 0.01, spreadPerAttack: 0.02, spreadDecay: 0.03,
        chargeTime: null, chargeUpTime: null, chargeDownTime: null, cooldownTime: null,
        spinUpTime: 0.4, spinDownTime: 0.8, fireDuringSpinUp: true,
        fullDamageRange: null, zeroDamageRange: null, damagePerSecondTotal: null,
      }],
    },
  });
  const labels = rows.map((row) => row.label);
  for (const label of ["Theoretical DPS", "60s Sustained DPS", "Damage Over 60s", "Energy Maximum Load", "Spread Min–Max", "Cooling Rate", "Rapid Spin-Up", "Rapid Spin-Down"]) {
    assert.ok(labels.includes(label), `missing ${label}`);
  }
});

test("buildBrowseStatPreviewFromFitting keeps Alpha Damage and omits an identical damage channel", () => {
  const preview = buildBrowseStatPreviewFromFitting({
    ...coolerDetail(),
    type: "ship_weapon",
    stats: {
      alphaDamage: 72.99,
      damagePhysical: 72.99,
      fireRateRpm: 750,
      maxAmmoCount: 1200,
      projectileSpeed: 1196,
      projectileMaxTravel: 2702.96,
    },
    mitigation: null,
  });

  const labels = preview.map((row) => row.label);
  assert.deepEqual(labels, [
    "Alpha Damage",
    "Fire Rate",
    "Ballistic Reserve",
    "Projectile Speed",
    "Projectile Max Travel",
  ]);
});

test("inferPrimaryShipWeaponDamageType picks highest non-zero channel", () => {
  const detail: FittingComponentDetail = {
    ...coolerDetail(),
    type: "ship_weapon",
    stats: {
      damagePhysical: 0,
      damageEnergy: 567,
      damageDistortion: 12,
    },
  };

  assert.equal(inferPrimaryShipWeaponDamageType(detail), "Energy");
});

test("getFittingModifierBaseValue maps shield hp from mitigation", () => {
  const detail: FittingComponentDetail = {
    ...coolerDetail(),
    type: "shield",
    stats: {
      shieldHp: null,
      health: 1100,
    },
    mitigation: {
      kind: "shield",
      shieldHp: 100000,
      maxShieldHealth: 100000,
      maxShieldRegen: null,
      damagedRegenDelay: 6,
      shieldFaceCount: null,
      resistanceByDamageType: null,
      absorptionByDamageType: null,
      regenByPowerPip: null,
      regenPowerFormula: null,
      regenPowerFormulaConfidence: null,
    },
  };

  assert.equal(getFittingModifierBaseValue(detail, "GPP_Shield_MaxHealth"), 100000);
});

test("buildItemSummaryDetailStatRows mirrors buildDetailStatRowsFromFitting", () => {
  const detail = coolerDetail();
  const summaryRows = buildItemSummaryDetailStatRows(detail);
  const detailRows = buildDetailStatRowsFromFitting(detail);
  assert.deepEqual(summaryRows, detailRows);
  assert.ok(summaryRows.some((row) => row.label === "Coolant Generation"));
  assert.ok(summaryRows.some((row) => row.label === "Mass"));
});

test("buildFittingIdentityMetricRows projects size grade class from fitting", () => {
  const rows = buildFittingIdentityMetricRows({
    ...coolerDetail(),
    size: 2,
    grade: "B",
    class: "civilian",
  });
  assert.deepEqual(rows, [
    { label: "Size", value: "S2" },
    { label: "Grade", value: "B" },
    { label: "Class", value: "Civilian" },
  ]);
});

test("modifierDetailStatLabelKeys maps Health to Component HP", () => {
  assert.deepEqual(modifierDetailStatLabelKeys("Health"), ["health", "componenthp"]);
});
