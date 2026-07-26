import assert from "node:assert/strict";
import test from "node:test";
import { buildBuildQueueFittingStatGroups } from "../../components/logistics/buildQueueStatsGroups.ts";
import type { FittingComponentDetail } from "../../lib/fitting/fittingApi.ts";

test("buildBuildQueueFittingStatGroups groups cooler fitting stats", () => {
  const detail: FittingComponentDetail = {
    id: "7db13b34-c8b1-4e1a-9aba-3dcd7087e995",
    name: "COOL_TEST",
    displayName: "Test Cooler",
    manufacturer: "Behring",
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
      electromagneticEmission: 375,
    },
    mitigation: null,
  };

  const groups = buildBuildQueueFittingStatGroups(detail);
  const labels = groups.map((group) => group.title);

  assert.ok(labels.includes("Output"));
  assert.ok(labels.includes("Power & Thermal"));
  assert.ok(labels.includes("Signatures"));
  assert.ok(labels.includes("Durability / Physical"));

  const output = groups.find((group) => group.title === "Output");
  assert.equal(output?.kind, "flat");
  if (output?.kind === "flat") {
    assert.ok(output.stats.some((row) => row.label === "Coolant Generation"));
  }
});

test("buildBuildQueueFittingStatGroups structures shield resistance and absorption", () => {
  const detail: FittingComponentDetail = {
    id: "shield-test",
    name: "SHIELD_TEST",
    displayName: "Test Shield",
    manufacturer: "Gorgon",
    type: "shield",
    subtype: null,
    size: 3,
    grade: "A",
    class: "military",
    confidence: "high",
    stats: {
      shieldHp: 105600,
      regenRate: 23232,
      powerDraw: 5,
      health: 2100,
      mass: 1100,
    },
    mitigation: {
      kind: "shield",
      shieldHp: 105600,
      maxShieldHealth: 105600,
      maxShieldRegen: 23232,
      damagedRegenDelay: 5.8,
      downedRegenDelay: null,
      shieldFaceCount: null,
      resistanceByDamageType: {
        physical: { min: 0, max: 0.25 },
        distortion: { min: 0.75, max: 0.95 },
      },
      absorptionByDamageType: {
        physical: { min: 0, max: 0.45 },
      },
      regenByPowerPip: null,
      regenPowerFormula: null,
      regenPowerFormulaConfidence: null,
    },
  };

  const groups = buildBuildQueueFittingStatGroups(detail);
  assert.deepEqual(groups.map((group) => group.title).slice(0, 2), ["Shield Performance", "Resistance / Absorption"]);
  const matrix = groups.find((group) => group.title === "Resistance / Absorption");
  assert.equal(matrix?.kind, "matrix");
  if (matrix?.kind === "matrix") {
    assert.deepEqual(matrix.columns, ["Resistance", "Absorption"]);
    assert.ok(matrix.rows.some((row) => row.label === "Physical" && row.values[0] === "0%-25%" && row.values[1] === "0%-45%"));
    assert.ok(matrix.rows.some((row) => row.label === "Distortion" && row.values[0] === "75%-95%" && row.values[1] === "-"));
  }
});

test("buildBuildQueueFittingStatGroups returns empty for missing detail", () => {
  assert.deepEqual(buildBuildQueueFittingStatGroups(null), []);
});
