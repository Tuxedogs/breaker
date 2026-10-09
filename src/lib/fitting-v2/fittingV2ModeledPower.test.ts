import assert from "node:assert/strict";
import test from "node:test";
import { applyFittingV2ModeledPowerRequest } from "./fittingV2ModeledPower";

test("modeled QED and EMP enablement is retained in shared fitting assignment state", () => {
  const qed = applyFittingV2ModeledPowerRequest({}, "qed:port-qed", 1);
  const both = applyFittingV2ModeledPowerRequest(qed, "emp:port-emp", 1);
  const empOff = applyFittingV2ModeledPowerRequest(both, "emp:port-emp", 0);

  assert.deepEqual(qed["qed:port-qed"], { allocation: 1, behavior: "binary_enable", provenance: "MODELED_GAMEPLAY" });
  assert.equal(empOff["qed:port-qed"]?.allocation, 1);
  assert.deepEqual(empOff["emp:port-emp"], { allocation: 0, behavior: "binary_enable", provenance: "MODELED_GAMEPLAY" });
});
