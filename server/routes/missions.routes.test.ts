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
    producer: {
      missionId: "producer",
      variantId: "producer",
      familyId: "family",
      familyKey: "family",
      detailFile: "variants/producer.json",
      familyDetailFile: "families/family.json",
      familyVariantsFile: "family-variants/family.json",
    },
    consumer: {
      missionId: "consumer",
      variantId: "consumer",
      familyId: "family",
      familyKey: "family",
      detailFile: "variants/consumer.json",
      familyDetailFile: "families/family.json",
      familyVariantsFile: "family-variants/family.json",
    },
  },
}));
await writeFile(path.join(generationRoot, "families", "family.json"), JSON.stringify({ schemaVersion: 2, generationId, family: { familyKey: "family" } }));
await writeFile(path.join(generationRoot, "family-variants", "family.json"), JSON.stringify({ schemaVersion: 2, generationId, familyKey: "family", variants: [] }));
await writeFile(path.join(generationRoot, "variants", "variant.json"), JSON.stringify({
  schemaVersion: 2,
  sourceContractVersion: 3,
  generationId,
  familyKey: "family",
  variant: {
    variantKey: "variant",
    canonical: {
      identity: { variantId: "variant", familyId: "family", templateGuid: null },
      availability: { notForRelease: false, workInProgress: false },
      prerequisites: [{
        edgeId: "crime",
        variantId: "variant",
        type: "crime_stat",
        polarity: "required",
        identifiers: {},
        bounds: {
          minCrimeStat: { raw: "0", value: 0 },
          maxCrimeStat: { raw: "2", value: 2 },
        },
        resolution: "source_backed",
        provenance: { sourceRef: "fixture.xml", sourceElement: "ContractPrerequisite_CrimeStat" },
      }],
      outcomes: [],
    },
  },
}));
await writeFile(path.join(generationRoot, "variants", "producer.json"), JSON.stringify({
  schemaVersion: 2,
  sourceContractVersion: 3,
  generationId,
  familyKey: "family",
  variant: {
    variantKey: "producer",
    canonical: {
      identity: { variantId: "producer", familyId: "family", templateGuid: null },
      availability: { notForRelease: false, workInProgress: false },
      prerequisites: [],
      outcomes: [{
        edgeId: "producer-grants-unlock",
        variantId: "producer",
        type: "completion_tag",
        payload: { tag: "unlock-tag", count: 1, missionResults: [true, false, false, false, false] },
        provenance: { sourceRef: "fixture.xml", sourceElement: "ContractResult_CompletionTag" },
      }],
    },
  },
}));
await writeFile(path.join(generationRoot, "variants", "consumer.json"), JSON.stringify({
  schemaVersion: 2,
  sourceContractVersion: 3,
  generationId,
  familyKey: "family",
  variant: {
    variantKey: "consumer",
    canonical: {
      identity: { variantId: "consumer", familyId: "family", templateGuid: null },
      availability: { notForRelease: false, workInProgress: false },
      prerequisites: [{
        edgeId: "consumer-requires-unlock",
        variantId: "consumer",
        ownerScope: "parent_eligibility",
        type: "completion_tag",
        polarity: "required",
        identifiers: { completionTag: "unlock-tag" },
        bounds: {},
        payload: {
          completionTagConstraint: {
            schemaVersion: 1,
            groupId: "consumer-unlock",
            polarity: "required",
            memberCompletionTags: ["unlock-tag"],
            threshold: { raw: "1", value: 1 },
          },
        },
        resolution: "source_backed",
        provenance: { sourceRef: "fixture.xml", sourceElement: "ContractPrerequisite_CompletedContractTags" },
      }],
      outcomes: [],
    },
  },
}));
await writeFile(path.join(generationRoot, "mission_graph.json"), JSON.stringify({
  schemaVersion: 2,
  sourceContractVersion: 3,
  generationId,
  nodeCount: 3,
  dependencies: [{
    prerequisiteEdgeId: "consumer-requires-unlock",
    consumerVariantId: "consumer",
    completionTag: "unlock-tag",
    producerVariantIds: ["producer"],
    resolution: "resolved_unique",
  }],
  arcs: [{
    producerVariantId: "producer",
    consumerVariantId: "consumer",
    completionTag: "unlock-tag",
    prerequisiteEdgeId: "consumer-requires-unlock",
  }],
}));
await writeFile(path.join(generationRoot, "mission_graph_validation_report.json"), JSON.stringify({
  schemaVersion: 2,
  sourceContractVersion: 3,
  generationId,
  summary: {
    requiredTagCount: 1,
    danglingRequiredTagCount: 0,
    excludedTagCount: 0,
    danglingExcludedTagCount: 0,
    alternateProducerTagCount: 0,
    branchRequiredTagCount: 0,
    danglingBranchTagCount: 0,
    cycleComponentCount: 0,
  },
  cycles: [],
}));
await writeFile(path.join(generationRoot, "mission_solver_reference.json"), JSON.stringify({
  schemaVersion: 1,
  missionSchemaVersion: 2,
  sourceContractVersion: 3,
  generationId,
  standingThresholdsById: {},
}));

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

test("mission eligibility route validates player state and evaluates exact variants", async () => {
  const playerState = {
    completedContracts: { knowledge: "complete", countsByContract: {} },
    completionTags: { knowledge: "complete", countsByTag: {} },
    reputation: [],
    crimeStat: { status: "known", value: 1 },
    location: { status: "unknown" },
  };
  const eligible = await handleMissionsRoute(
    "POST",
    "/api/missions/variant/variant/eligibility",
    { playerState },
  );
  assert.equal(eligible?.status, 200);
  assert.equal((eligible?.body as {
    generationId: string;
    result: { status: string };
  }).generationId, generationId);
  assert.equal((eligible?.body as { result: { status: string } }).result.status, "eligible");

  const blocked = await handleMissionsRoute(
    "POST",
    "/api/missions/variant/variant/eligibility",
    { playerState: { ...playerState, crimeStat: { status: "known", value: 3 } } },
  );
  assert.equal((blocked?.body as { result: { status: string } }).result.status, "blocked");

  assert.equal((await handleMissionsRoute(
    "POST",
    "/api/missions/variant/variant/eligibility",
    { playerState: { crimeStat: { status: "unknown" } } },
  ))?.status, 400);
  assert.equal((await handleMissionsRoute(
    "POST",
    "/api/missions/variant/missing/eligibility",
    { playerState },
  ))?.status, 404);
  assert.equal((await handleMissionsRoute(
    "GET",
    "/api/missions/variant/variant/eligibility",
  ))?.status, 405);
});

test("mission prerequisite path route returns proven exact-variant steps", async () => {
  const playerState = {
    completedContracts: { knowledge: "complete" as const, countsByContract: {} },
    completionTags: { knowledge: "complete" as const, countsByTag: {} },
    reputation: [],
    crimeStat: { status: "known" as const, value: 0 },
    location: { status: "unknown" as const },
  };
  const pathResult = await handleMissionsRoute(
    "POST",
    "/api/missions/variant/consumer/prerequisite-path",
    { playerState },
  );
  assert.equal(pathResult?.status, 200);
  assert.equal((pathResult?.body as { generationId: string }).generationId, generationId);
  assert.equal((pathResult?.body as {
    result: { status: string; minimumMissionCount: number; primaryPlan: { steps: Array<{ variantId: string }> } };
  }).result.status, "path_found");
  assert.equal((pathResult?.body as {
    result: { minimumMissionCount: number };
  }).result.minimumMissionCount, 1);
  assert.deepEqual((pathResult?.body as {
    result: { primaryPlan: { steps: Array<{ variantId: string }> } };
  }).result.primaryPlan.steps.map((step) => step.variantId), ["producer"]);

  const satisfied = await handleMissionsRoute(
    "POST",
    "/api/missions/variant/consumer/prerequisite-path",
    {
      playerState: {
        ...playerState,
        completionTags: { knowledge: "complete", countsByTag: { "unlock-tag": 1 } },
      },
    },
  );
  assert.equal((satisfied?.body as {
    result: { status: string; minimumMissionCount: number; primaryPlan: { steps: unknown[] } };
  }).result.status, "satisfied");
  assert.equal((satisfied?.body as {
    result: { minimumMissionCount: number };
  }).result.minimumMissionCount, 0);
  assert.deepEqual((satisfied?.body as {
    result: { primaryPlan: { steps: unknown[] } };
  }).result.primaryPlan.steps, []);

  assert.equal((await handleMissionsRoute(
    "POST",
    "/api/missions/variant/consumer/prerequisite-path",
    { playerState: { crimeStat: { status: "unknown" } } },
  ))?.status, 400);
  assert.equal((await handleMissionsRoute(
    "POST",
    "/api/missions/variant/missing/prerequisite-path",
    { playerState },
  ))?.status, 404);
  assert.equal((await handleMissionsRoute(
    "GET",
    "/api/missions/variant/consumer/prerequisite-path",
  ))?.status, 405);
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
