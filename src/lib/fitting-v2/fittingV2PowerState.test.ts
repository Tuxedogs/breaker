import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_PIP_ASSIGNMENT } from "../fitting/fittingTerminalTypes.ts";
import { applyFittingV2PowerRequest } from "./fittingV2PowerState.ts";

test("power requests normalize nonzero allocations to the source-backed minimum", () => {
  const current = { ...DEFAULT_PIP_ASSIGNMENT };
  assert.equal(applyFittingV2PowerRequest(current, "weapons", 1, { minimum: 3, maximum: 6 }).weapons, 3);
  assert.equal(applyFittingV2PowerRequest(current, "weapons", 0, { minimum: 3, maximum: 6 }).weapons, 0);
  assert.equal(applyFittingV2PowerRequest(current, "weapons", 5, { minimum: 3, maximum: 6 }).weapons, 5);
});

test("power requests retain the ship-specific maximum", () => {
  const current = { ...DEFAULT_PIP_ASSIGNMENT };
  assert.equal(applyFittingV2PowerRequest(current, "weapons", 8, { minimum: 3, maximum: 6 }).weapons, 6);
});

test("power requests do not mutate unavailable systems", () => {
  const current = { ...DEFAULT_PIP_ASSIGNMENT, engines: 4 };
  assert.equal(applyFittingV2PowerRequest(current, "engines", 0, { minimum: null, maximum: null }), current);
});

test("powering quantum on powers shields off without restoring shields when quantum turns off", () => {
  const current = { ...DEFAULT_PIP_ASSIGNMENT, shields: 4 };
  const quantumOn = applyFittingV2PowerRequest(current, "quantum", 3, { minimum: 3, maximum: 6 });
  assert.equal(quantumOn.quantum, 3);
  assert.equal(quantumOn.shields, 0);
  const quantumOff = applyFittingV2PowerRequest(quantumOn, "quantum", 0, { minimum: 3, maximum: 6 });
  assert.equal(quantumOff.quantum, 0);
  assert.equal(quantumOff.shields, 0);
});
