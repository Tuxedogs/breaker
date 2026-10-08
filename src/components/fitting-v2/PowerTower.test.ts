import assert from "node:assert/strict";
import test from "node:test";

import { buildPowerTowerRegions } from "./powerTowerModel.ts";

test("power tower keeps the fused minimum visible while allocation is zero", () => {
  assert.deepEqual(buildPowerTowerRegions(6, 3, 0), [
    { allocation: 3, units: 3, kind: "minimum", assigned: false, disabled: false },
    { allocation: 4, units: 1, kind: "pip", assigned: false, disabled: false },
    { allocation: 5, units: 1, kind: "pip", assigned: false, disabled: false },
    { allocation: 6, units: 1, kind: "pip", assigned: false, disabled: false },
  ]);
});

test("power tower assigns the fused minimum and only cumulative pips above it", () => {
  assert.deepEqual(buildPowerTowerRegions(6, 3, 4).map(({ allocation, units, kind, assigned }) => ({ allocation, units, kind, assigned })), [
    { allocation: 3, units: 3, kind: "minimum", assigned: true },
    { allocation: 4, units: 1, kind: "pip", assigned: true },
    { allocation: 5, units: 1, kind: "pip", assigned: false },
    { allocation: 6, units: 1, kind: "pip", assigned: false },
  ]);
});

test("power tower preserves a five-pip minimum with one independent pip above it", () => {
  assert.deepEqual(buildPowerTowerRegions(6, 5, 5).map(({ allocation, units, kind, assigned }) => ({ allocation, units, kind, assigned })), [
    { allocation: 5, units: 5, kind: "minimum", assigned: true },
    { allocation: 6, units: 1, kind: "pip", assigned: false },
  ]);
});

test("power tower disables unsupported exact-curve allocations without changing geometry", () => {
  assert.deepEqual(buildPowerTowerRegions(4, 2, 2, [0, 2, 4]).map(({ allocation, disabled }) => ({ allocation, disabled })), [
    { allocation: 2, disabled: false },
    { allocation: 3, disabled: true },
    { allocation: 4, disabled: false },
  ]);
});
