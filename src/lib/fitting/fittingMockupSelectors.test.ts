import assert from "node:assert/strict";
import test from "node:test";
import type { FittingComponentMitigation } from "./fittingApi.ts";
import {
  computeMockupHpSummary,
  powerSummaryFromCalculate,
  sumArmorHp,
} from "./fittingMockupSelectors.ts";

function armor(health: number | null): Extract<FittingComponentMitigation, { kind: "armor" }> {
  return {
    kind: "armor",
    health,
    basePenetrationReduction: null,
    damageMultiplierByDamageType: null,
    deflectionThresholdByDamageType: null,
    penetrationAbsorptionByDamageType: null,
    resistanceByDamageType: null,
  };
}

test("HP summary is unavailable when an expected contributor is missing", () => {
  const result = computeMockupHpSummary({
    hullHP: 100,
    shieldHp: 50,
    armorMitigations: [armor(20), armor(null)],
  });

  assert.equal(result.armorHp, null);
  assert.equal(result.totalHp, null);
});

test("HP summary totals only complete source-backed contributors", () => {
  assert.equal(sumArmorHp([armor(20), armor(30)]), 50);
  assert.equal(computeMockupHpSummary({
    hullHP: 100,
    shieldHp: 50,
    armorMitigations: [armor(20), armor(30)],
  }).totalHp, 200);
  assert.equal(computeMockupHpSummary({
    hullHP: 100,
    shieldHp: 50,
    armorMitigations: [],
  }).totalHp, 150);
});

test("legacy power summary does not claim megawatt units", () => {
  const result = {
    categories: {
      power: {
        derived: { totalPowerGenerated: 17 },
      },
    },
  } as never;

  assert.equal(powerSummaryFromCalculate(result), "17 segments");
});
