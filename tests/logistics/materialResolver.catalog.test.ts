import assert from "node:assert/strict";
import test from "node:test";

import { materialTemplates } from "../../src/data/logistics/seed";
import { createMaterialResolver } from "../../src/lib/logistics/materialResolver";
import type { MaterialIdentity } from "../../src/lib/logistics/materialIdentityIndex";

const materialIdentities: MaterialIdentity[] = [
  {
    materialKey: "rawice",
    canonicalName: "Ice",
    displayName: "Ice",
    rawName: "Ice",
    refinedName: "Pressurized Ice",
    materialForm: "raw",
    unitType: "scu",
    isRefinable: true,
    refinesToMaterialKey: "pressurizedice",
    aliases: ["Ice", "Pressurized Ice"],
  },
  {
    materialKey: "pressurizedice",
    canonicalName: "Ice",
    displayName: "Pressurized Ice",
    rawName: "Ice",
    refinedName: "Pressurized Ice",
    materialForm: "refined",
    unitType: "scu",
    aliases: ["Pressurized Ice"],
  },
];

test("resolves raw and refined ice names to the existing Ice material identity", () => {
  const resolve = createMaterialResolver(materialTemplates, materialIdentities);

  assert.equal(resolve({ materialName: "Ice" })?.materialId, "rawice");
  assert.equal(resolve({ materialName: "Pressurized Ice" })?.materialId, "rawice");
  assert.equal(resolve({ materialName: "pressurized ice" })?.materialId, "rawice");
});

test("does not fuzzy-match unknown material typos", () => {
  const resolve = createMaterialResolver(materialTemplates, materialIdentities);

  assert.equal(resolve({ materialName: "Pressurized Iec" }), null);
});
