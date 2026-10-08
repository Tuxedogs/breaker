import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PIP_ASSIGNMENT } from "../fitting/fittingTerminalTypes";
import { displayedPhysicalPowerAllocation } from "./fittingV2PhysicalPowerPresentation";

test("quantum power zeros displayed physical shield allocations without discarding their saved values", () => {
  assert.equal(displayedPhysicalPowerAllocation("shields", 4, { ...DEFAULT_PIP_ASSIGNMENT, quantum: 3 }), 0);
  assert.equal(displayedPhysicalPowerAllocation("shields", 4, DEFAULT_PIP_ASSIGNMENT), 4);
  assert.equal(displayedPhysicalPowerAllocation("cooler1", 4, { ...DEFAULT_PIP_ASSIGNMENT, quantum: 3 }), 4);
});
