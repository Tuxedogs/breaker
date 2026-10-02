import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFittingV2ComponentGroups,
  buildFittingV2PerformanceMetrics,
  fittingV2ComponentState,
} from "./fittingV2Presentation";
import type { FittingCalculateResult } from "../fitting/fittingApi";
import type { PortBreakdownRow } from "../fitting/fittingPortGrouping";

test("performance metrics expose current values and stock deltas without repeating stock values", () => {
  const calculateResult = {
    categories: {
      shields: { derived: { totalShieldHP: 104000, totalRegenRate: 612 } },
      power: { derived: { totalPowerGenerated: 12480, totalPowerRequired: 11400 } },
    },
    stockComparison: {
      available: true,
      deltas: {
        shields: { totalShieldHP: 12000, totalRegenRate: 48 },
        power: { totalPowerGenerated: 1080, totalPowerRequired: -200 },
      },
    },
  } as unknown as FittingCalculateResult;

  const metrics = buildFittingV2PerformanceMetrics({
    ship: { pitchRate: 32, cargoCapacityScu: 96 },
    hullHp: 90000,
    calculateResult,
  });

  assert.equal(metrics.find((entry) => entry.key === "shield-hp")?.value, 104000);
  assert.equal(metrics.find((entry) => entry.key === "shield-hp")?.delta, 12000);
  assert.equal(metrics.find((entry) => entry.key === "power-demand")?.deltaTone, "beneficial");
  assert.equal(metrics.find((entry) => entry.key === "pitch")?.delta, null);
});

test("component state preserves structural fitting semantics", () => {
  const base = {
    editable: false,
    locked: false,
    bespoke: false,
    compatibilityStatus: "resolved",
  } as PortBreakdownRow;

  assert.equal(fittingV2ComponentState({ ...base, editable: true }), "editable");
  assert.equal(fittingV2ComponentState({ ...base, locked: true }), "locked");
  assert.equal(fittingV2ComponentState({ ...base, bespoke: true }), "bespoke");
  assert.equal(fittingV2ComponentState({ ...base, compatibilityStatus: "unknown" }), "compatibility-unknown");
});

test("performance metrics normalize negative zero deltas", () => {
  const metrics = buildFittingV2PerformanceMetrics({
    ship: null,
    hullHp: null,
    calculateResult: {
      categories: {
        power: { derived: { totalPowerRequired: 12 } },
      },
      stockComparison: {
        available: true,
        deltas: { power: { totalPowerRequired: -0 } },
      },
    } as never,
  });

  assert.equal(metrics[0]?.delta, 0);
  assert.equal(Object.is(metrics[0]?.delta, -0), false);
});

test("component presentation hides controller noise and collapses equivalent hardpoints", () => {
  const row = (input: Partial<PortBreakdownRow>): PortBreakdownRow => ({
    shipKey: "ship",
    portId: "port",
    portName: null,
    portType: null,
    portSubtype: null,
    portCategory: null,
    ruleCategory: null,
    parentPortId: null,
    childPortIds: [],
    equippedComponentKey: null,
    equippedComponentName: null,
    componentCategory: null,
    componentManufacturer: null,
    componentSize: null,
    portExactSize: null,
    portMinSize: null,
    portMaxSize: null,
    componentSubtype: null,
    compatibilityStatus: "resolved",
    editable: false,
    bespoke: false,
    locked: false,
    warnings: [],
    confidence: "source-backed",
    ...input,
  });
  const presentation = buildFittingV2ComponentGroups([
    row({ portId: "hardpoint_controller_pilot_weapon", portName: "HARDPOINT_CONTROLLER_PILOT_WEAPON" }),
    row({ portId: "hardpoint_power_plant", portName: "Power Plant", ruleCategory: "power", equippedComponentKey: "power", equippedComponentName: "Stellate", componentCategory: "power_plant", componentSize: 4, editable: true }),
    row({ portId: "hardpoint_gun_left", portName: "Left Gun", ruleCategory: "weapon", equippedComponentKey: "gun", equippedComponentName: "CF-337 Panther", componentCategory: "ship_weapon", componentSubtype: "Laser Repeater", componentSize: 3, editable: true }),
    row({ portId: "hardpoint_gun_right", portName: "Right Gun", ruleCategory: "weapon", equippedComponentKey: "gun", equippedComponentName: "CF-337 Panther", componentCategory: "ship_weapon", componentSubtype: "Laser Repeater", componentSize: 3, editable: true }),
  ]);

  assert.equal(presentation.systemGroups.some((group) => group.label === "Power Plant"), true);
  assert.equal(presentation.hardpoints.length, 1);
  assert.equal(presentation.hardpoints[0]?.quantity, 2);
  assert.equal(presentation.hiddenInternalPortCount, 1);
});
