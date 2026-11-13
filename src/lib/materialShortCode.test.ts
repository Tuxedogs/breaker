import assert from "node:assert/strict";
import test from "node:test";
import { resolveMaterialPresentation } from "./materialPresentation";
import { materialShortCode } from "./materialIdentity";

test("V31b material codes resolve collision overrides and aliases through shared identity", () => {
  for (const [name, code] of [["Titanium", "Ti"], ["Tin", "Tin"], ["Beryl", "Byl"], ["Beradom", "Bdm"], ["Carinite", "Car"], ["Pure Carinite", "Pur"], ["Carinite Pure", "Pur"], ["Copper", "Cop"], ["Corundum", "Cor"]]) {
    assert.equal(materialShortCode(name), code);
  }
  assert.equal(resolveMaterialPresentation("Titanium").color, "#5B5A58");
});

test("material short codes capitalize and normalize unknown names", () => {
  assert.equal(materialShortCode("quantanium"), "Qtm");
  assert.equal(materialShortCode("TITANIUM"), "Ti");
  assert.equal(materialShortCode("mystery"), "Mys");
  assert.equal(materialShortCode("MYSTERY"), "Mys");
  assert.equal(materialShortCode("  mystery  "), "Mys");
  assert.equal(materialShortCode(""), "");
  assert.equal(materialShortCode("   "), "");
});

test("condition states preserve missing and confirmed absence", async () => {
  const { miningConditionState } = await import("../features/mining/miningEnvironmentMetadata");
  assert.equal(miningConditionState(null), "unknown");
  assert.equal(miningConditionState(undefined), "unknown");
  assert.equal(miningConditionState(false), "off");
  assert.equal(miningConditionState(true), "on");
});
