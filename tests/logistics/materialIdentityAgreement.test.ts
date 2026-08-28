import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { canonicalMaterialDisplayName, canonicalMaterialKey } from "../../server/recommender/materialResolver";
import { createApiMaterialResolver } from "../../server/shared/materialResolver";
import { materialTemplates } from "../../src/data/logistics/seed";
import {
  canonicalMiningMaterialKey,
  configureMiningMaterialIdentities,
} from "../../src/features/mining/materialIdentity";
import {
  MATERIAL_IDENTITY_OVERRIDES,
  createMaterialIdentityResolver,
} from "../../src/lib/materialIdentity";
import type { MaterialIdentity } from "../../src/lib/logistics/materialIdentityIndex";
import { createMaterialResolver } from "../../src/lib/logistics/materialResolver";
import type { ApiWarning } from "../../server/shared/warnings";

const identityIndex = JSON.parse(
  await readFile("server-data/crafting/reference/material-identity-index.json", "utf8"),
) as { materials: MaterialIdentity[] };
const identities = identityIndex.materials;
const canonical = createMaterialIdentityResolver(identities);
const clientResolve = createMaterialResolver(materialTemplates, identities);
const serverWarnings: ApiWarning[] = [];
const serverResolve = await createApiMaterialResolver(serverWarnings);
configureMiningMaterialIdentities(identities);

function assertConsumerAgreement(value: string, expectedMaterialKey: string): void {
  assert.equal(clientResolve({ materialId: value, materialName: value })?.materialId, expectedMaterialKey, `client: ${value}`);
  assert.equal(serverResolve({ materialId: value, materialName: value })?.materialId, expectedMaterialKey, `server: ${value}`);
  assert.equal(canonicalMaterialKey(value, canonical), expectedMaterialKey, `recommender: ${value}`);
  assert.equal(canonicalMiningMaterialKey(value), expectedMaterialKey, `mining client: ${value}`);
}

test("generated GUID aliases resolve identically across client, server, mining, and recommender consumers", () => {
  assertConsumerAgreement("75b37a54-45c9-4f27-ac09-9830f092dd86", "torite");
  assertConsumerAgreement("93c8b7df-d6ac-4b4f-a115-b0e3afc238b8", "beryl");
  assertConsumerAgreement("fa79d61c-06ef-414a-bfd0-d8c248edb76e", "quantanium");
  assert.deepEqual(serverWarnings, []);
});

test("one shared exceptional table repairs legacy GUID and spelling aliases", () => {
  const cases = new Map([
    ["6426f04e-2f7d-4c8e-a615-64aa582eaa31", "savrilium"],
    ["Aluminium", "aluminum"],
    ["Quantainium", "quantanium"],
    ["Savrillium", "savrilium"],
    ["Hephaestonite", "hephaestanite"],
    ["Carinite Pure", "carinite-pure"],
    ["Jaclium Ore", "jaclium"],
    ["Saldynium Ore", "saldynium"],
  ]);

  for (const [value, expectedMaterialKey] of cases) {
    assertConsumerAgreement(value, expectedMaterialKey);
  }
  assert.equal(canonicalMaterialDisplayName("Quantainium", canonical), "Quantanium");
  assert.equal(MATERIAL_IDENTITY_OVERRIDES.length, 8);
});

test("generated raw/refined relationships retain the stable inventory canonical ID", () => {
  const rawIce = identities.find((identity) => identity.materialKey === "rawice");
  assert.equal(rawIce?.isRefinable, true);
  assert.equal(rawIce?.refinesToMaterialKey, "pressurizedice");

  assertConsumerAgreement("Raw Ice", "rawice");
  assertConsumerAgreement("Pressurized Ice", "rawice");
  assertConsumerAgreement("f9f3251a-8e48-408a-b957-f1e3d5d3e213", "rawice");
});
