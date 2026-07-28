import assert from "node:assert/strict";
import test from "node:test";
import { formatMaterialDisplayName } from "./materialDisplayName";

test("canonicalizes lowercase material names without changing established casing", () => {
  assert.equal(formatMaterialDisplayName("hadanite"), "Hadanite");
  assert.equal(formatMaterialDisplayName("hephaestanite"), "Hephaestanite");
  assert.equal(formatMaterialDisplayName("pressurized ice"), "Pressurized Ice");
  assert.equal(formatMaterialDisplayName("RMC"), "RMC");
});
