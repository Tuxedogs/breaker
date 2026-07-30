import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const root = await mkdtemp(path.join(os.tmpdir(), "moonbreaker-mission-route-"));
const generationId = "test-generation";
const generationRoot = path.join(root, "generations", generationId);
await mkdir(path.join(generationRoot, "families"), { recursive: true });
await mkdir(path.join(generationRoot, "family-variants"), { recursive: true });
await mkdir(path.join(generationRoot, "variants"), { recursive: true });
await writeFile(path.join(root, "current.json"), JSON.stringify({
  schemaVersion: 1,
  missionSchemaVersion: 2,
  sourceContractVersion: 3,
  generationId,
  generationPath: `generations/${generationId}`,
}));
await writeFile(path.join(generationRoot, "mission_browser_index.json"), JSON.stringify({
  schemaVersion: 2,
  sourceContractVersion: 3,
  generationId,
  generatedAt: "2026-07-30T00:00:00Z",
  sourceLatestModifiedAt: "2026-07-16T00:00:00Z",
  sourceFiles: [],
  summary: { familyCount: 1, variantCount: 1 },
  familiesByKey: {
    family: {
      familyKey: "family",
      provider: "Provider",
      missionType: "Type",
      releaseFlags: [],
      blueprintRewards: [],
      reputationRewards: [],
      creditRewardSummary: "1,000 aUEC",
      creditRewardStatuses: ["calculated"],
      itemRewardStatus: "none",
      rewardedReputationPaths: [],
      confidenceFlags: [],
      unresolvedReferences: [],
      unresolvedLocationTokens: [],
      unresolvedRewardFields: [],
      crimeStatRequirement: "notRequired",
      lawfulClassification: "unknown",
      variantCount: 1,
      searchText: "test mission",
    },
  },
  conceptsByKey: {},
  familyDetailFiles: { family: "families/family.json" },
  familyVariantFiles: { family: "family-variants/family.json" },
  variantDetailFiles: { variant: "variants/variant.json" },
  missionBrowseGroups: [],
}));
await writeFile(path.join(generationRoot, "mission_shard_manifest.json"), JSON.stringify({
  schemaVersion: 2,
  sourceContractVersion: 3,
  generationId,
  familyFilesByFamilyId: {
    family: {
      familyKey: "family",
      detailFile: "families/family.json",
      variantsFile: "family-variants/family.json",
    },
  },
  variantFilesByMissionId: {
    variant: {
      missionId: "variant",
      variantId: "variant",
      familyId: "family",
      familyKey: "family",
      detailFile: "variants/variant.json",
      familyDetailFile: "families/family.json",
      familyVariantsFile: "family-variants/family.json",
    },
  },
}));
await writeFile(path.join(generationRoot, "families", "family.json"), JSON.stringify({ schemaVersion: 2, generationId, family: { familyKey: "family" } }));
await writeFile(path.join(generationRoot, "family-variants", "family.json"), JSON.stringify({ schemaVersion: 2, generationId, familyKey: "family", variants: [] }));
await writeFile(path.join(generationRoot, "variants", "variant.json"), JSON.stringify({ schemaVersion: 2, generationId, familyKey: "family", variant: { variantKey: "variant" } }));

process.env.MISSION_DATA_ROOT = root;
const { handleMissionsRoute } = await import("./missions.routes.js");

after(async () => {
  delete process.env.MISSION_DATA_ROOT;
  await rm(root, { recursive: true, force: true });
});

test("mission routes resolve a coherent immutable generation", async () => {
  const browser = await handleMissionsRoute("GET", "/api/missions/browser");
  assert.equal(browser?.status, 200);
  assert.equal((browser?.body as { generationId?: string }).generationId, generationId);

  const family = await handleMissionsRoute("GET", "/api/missions/family/family");
  assert.equal(family?.status, 200);

  const variants = await handleMissionsRoute("GET", "/api/missions/family/family/variants");
  assert.equal(variants?.status, 200);

  const variant = await handleMissionsRoute("GET", "/api/missions/variant/variant");
  assert.equal(variant?.status, 200);
});

test("mission routes pick up an atomic current-generation switch", async () => {
  const nextGenerationId = "next-generation";
  const nextRoot = path.join(root, "generations", nextGenerationId);
  await cp(generationRoot, nextRoot, { recursive: true });
  for (const fileName of ["mission_browser_index.json", "mission_shard_manifest.json"]) {
    const filePath = path.join(nextRoot, fileName);
    const payload = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
    payload.generationId = nextGenerationId;
    await writeFile(filePath, JSON.stringify(payload));
  }
  await writeFile(path.join(root, "current.json"), JSON.stringify({
    schemaVersion: 1,
    missionSchemaVersion: 2,
    sourceContractVersion: 3,
    generationId: nextGenerationId,
    generationPath: `generations/${nextGenerationId}`,
  }));

  const browser = await handleMissionsRoute("GET", "/api/missions/browser");
  assert.equal(browser?.status, 200);
  assert.equal((browser?.body as { generationId?: string }).generationId, nextGenerationId);
});

test("mission routes preserve method and missing-record behavior", async () => {
  assert.equal((await handleMissionsRoute("POST", "/api/missions/browser"))?.status, 405);
  assert.equal((await handleMissionsRoute("GET", "/api/missions/variant/missing"))?.status, 404);
  assert.equal(await handleMissionsRoute("GET", "/api/not-missions"), null);
});
