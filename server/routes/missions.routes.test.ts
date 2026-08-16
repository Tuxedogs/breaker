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

type OfferFixtureOptions = {
  detailPathOverride?: string;
  detailEnvelopeGenerationId?: string;
  manifestGenerationId?: string;
};

async function writeOfferGeneration(
  offerGenerationId: string,
  options: OfferFixtureOptions = {},
): Promise<void> {
  const offerRoot = path.join(root, "generations", offerGenerationId);
  await mkdir(path.join(offerRoot, "offers"), { recursive: true });
  await mkdir(path.join(offerRoot, "offer-variants"), { recursive: true });

  const offers = [
    {
      offerKey: "headhunters:deep-space-hit",
      displayTitle: "Deep Space Hit",
      variantKey: "deep-contract",
      rewardTypes: ["credits-calculated"],
    },
    {
      offerKey: "headhunters:primo-target",
      displayTitle: "Primo Target",
      variantKey: "primo-contract",
      rewardTypes: ["credits-calculated"],
    },
    {
      offerKey: "headhunters:plug-a-traitor",
      displayTitle: "Plug a Traitor",
      variantKey: "plug-contract",
      rewardTypes: ["credits-calculated"],
    },
    {
      offerKey: "headhunters:ground-the-upstarts",
      displayTitle: "Ground the Upstarts",
      variantKey: "ground-contract",
      rewardTypes: ["blueprints", "credits-calculated"],
    },
  ].map((fixture) => ({
    offerSchemaVersion: 1 as const,
    offerKey: fixture.offerKey,
    displayTitle: fixture.displayTitle,
    displayTitleTemplate: fixture.displayTitle,
    provider: {
      organizationGuid: null,
      displayRaw: "@headhunters_from",
      displayText: "Headhunters",
      displayResolution: "source_backed",
      organizationResolution: "unresolved_no_explicit_organization_guid",
      provenance: "source_backed",
    },
    verificationStatus: "unknown" as const,
    variantKeys: [fixture.variantKey],
    familyKeys: ["shared-family"],
    legacyConceptKeys: ["legacy-shared-series"],
    objectiveTemplateKeys: ["shared-objective"],
    auditFlags: [],
    searchText: `${fixture.displayTitle} Headhunters ${fixture.variantKey}`.toLowerCase(),
    providerKey: "headhunters",
    missionTypes: ["Bounty"],
    rewardTypes: fixture.rewardTypes,
    reputationRewardKeys: ["headhunters:ship-combat"],
    reputationRewardFacets: [{
      stableKey: "headhunters:ship-combat",
      factionKey: "headhunters",
      factionDisplayName: "Headhunters",
      scopeKey: "ship-combat",
      scopeDisplayName: "Ship Combat",
      confidence: "resolved" as const,
      variantCount: 1,
      rewardPathCount: 1,
      amountSummary: {
        status: "exact" as const,
        resolvedPathCount: 1,
        unresolvedPathCount: 0,
        minAmount: 100,
        maxAmount: 100,
      },
    }],
    releaseFlags: ["released"],
    confidenceFlags: [],
    verificationStatuses: ["unknown" as const],
  }));
  const offersByKey = Object.fromEntries(offers.map((offer) => [offer.offerKey, offer]));
  const offerDetailFiles = Object.fromEntries(
    offers.map((offer) => [
      offer.offerKey,
      offer.offerKey === "headhunters:primo-target" && options.detailPathOverride
        ? options.detailPathOverride
        : `offers/${offer.offerKey.replace(/[^a-z0-9]+/g, "-")}.json`,
    ]),
  );
  const offerVariantFiles = Object.fromEntries(
    offers.map((offer) => [
      offer.offerKey,
      `offer-variants/${offer.offerKey.replace(/[^a-z0-9]+/g, "-")}.json`,
    ]),
  );
  const variantOfferKeys = Object.fromEntries(
    offers.flatMap((offer) => offer.variantKeys.map((variantKey) => [variantKey, offer.offerKey])),
  );
  const family = {
    familyKey: "shared-family",
    provider: "Headhunters",
    missionType: "Bounty",
    releaseFlags: ["released"],
    blueprintRewards: ["Blueprint Pool B"],
    reputationRewards: [],
    creditRewardSummary: "Varies",
    creditRewardStatuses: ["calculated"],
    itemRewardStatus: "none",
    rewardedReputationPaths: [{ scopeDisplayName: "Ship Combat" }],
    confidenceFlags: [],
    unresolvedReferences: [],
    unresolvedLocationTokens: [],
    unresolvedRewardFields: [],
    crimeStatRequirement: "unknown",
    lawfulClassification: "unknown",
    variantCount: offers.length,
    searchText: offers.map((offer) => offer.displayTitle).join(" ").toLowerCase(),
  };

  await writeFile(path.join(offerRoot, "mission_browser_index.json"), JSON.stringify({
    schemaVersion: 3,
    sourceContractVersion: 4,
    offerSchemaVersion: 1,
    generationId: offerGenerationId,
    generatedAt: "2026-08-16T00:00:00Z",
    sourceLatestModifiedAt: "2026-07-16T00:00:00Z",
    sourceFiles: [],
    summary: { familyCount: 1, variantCount: offers.length, offerCount: offers.length },
    familiesByKey: { "shared-family": family },
    conceptsByKey: {
      "legacy-shared-series": {
        conceptKey: "legacy-shared-series",
        familyKeys: ["shared-family"],
      },
    },
    offersByKey,
    offerDetailFiles,
    offerVariantFiles,
    variantOfferKeys,
    legacyConceptOfferKeys: {
      "legacy-shared-series": offers.map((offer) => offer.offerKey),
    },
    missionBrowseGroups: [],
  }));
  await writeFile(path.join(offerRoot, "mission_shard_manifest.json"), JSON.stringify({
    schemaVersion: 3,
    sourceContractVersion: 4,
    offerSchemaVersion: 1,
    generationId: options.manifestGenerationId ?? offerGenerationId,
    offerDetailFiles,
    offerVariantFiles,
  }));
  for (const offer of offers) {
    const detailPath = offerDetailFiles[offer.offerKey];
    if (detailPath && !detailPath.startsWith("..")) {
      await writeFile(path.join(offerRoot, detailPath), JSON.stringify({
        schemaVersion: 3,
        sourceContractVersion: 4,
        offerSchemaVersion: 1,
        generationId: options.detailEnvelopeGenerationId ?? offerGenerationId,
        offer,
      }));
    }
    await writeFile(path.join(offerRoot, offerVariantFiles[offer.offerKey]!), JSON.stringify({
      schemaVersion: 3,
      sourceContractVersion: 4,
      offerSchemaVersion: 1,
      generationId: offerGenerationId,
      offerKey: offer.offerKey,
      variants: offer.variantKeys.map((variantKey) => ({ variantKey })),
    }));
  }
}

async function selectOfferGeneration(offerGenerationId: string): Promise<void> {
  await writeFile(path.join(root, "current.json"), JSON.stringify({
    schemaVersion: 1,
    missionSchemaVersion: 3,
    sourceContractVersion: 4,
    offerSchemaVersion: 1,
    generationId: offerGenerationId,
    generationPath: `generations/${offerGenerationId}`,
  }));
}

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

test("schema 3 offer routes and browser search stay isolated to exact offer evidence", async () => {
  const offerGenerationId = "offer-generation";
  await writeOfferGeneration(offerGenerationId);
  await selectOfferGeneration(offerGenerationId);

  async function visibleOfferKeys(query: string): Promise<string[]> {
    const response = await handleMissionsRoute("GET", `/api/missions/browser?${query}`);
    assert.equal(response?.status, 200);
    return Object.keys((response?.body as {
      offersByKey: Record<string, unknown>;
    }).offersByKey);
  }

  assert.deepEqual(
    await visibleOfferKeys("search=Primo%20Target"),
    ["headhunters:primo-target"],
  );
  assert.deepEqual(
    await visibleOfferKeys("search=Plug%20a%20Traitor"),
    ["headhunters:plug-a-traitor"],
  );
  assert.deepEqual(
    await visibleOfferKeys("search=Ground%20the%20Upstarts"),
    ["headhunters:ground-the-upstarts"],
  );
  assert.deepEqual(
    await visibleOfferKeys("search=primo-contract"),
    ["headhunters:primo-target"],
  );
  assert.deepEqual(
    await visibleOfferKeys("reward=blueprints"),
    ["headhunters:ground-the-upstarts"],
  );
  assert.deepEqual(
    await visibleOfferKeys("repReward=headhunters%3Aship-combat"),
    [
      "headhunters:deep-space-hit",
      "headhunters:primo-target",
      "headhunters:plug-a-traitor",
      "headhunters:ground-the-upstarts",
    ],
  );
  assert.deepEqual(
    await visibleOfferKeys("provider=headhunters&verification=unknown"),
    [
      "headhunters:deep-space-hit",
      "headhunters:primo-target",
      "headhunters:plug-a-traitor",
      "headhunters:ground-the-upstarts",
    ],
  );

  const browser = await handleMissionsRoute(
    "GET",
    "/api/missions/browser?search=Primo%20Target",
  );
  const browserBody = browser?.body as {
    variantOfferKeys: Record<string, string>;
    legacyConceptOfferKeys: Record<string, string[]>;
    familiesByKey: Record<string, { searchText: string }>;
  };
  assert.deepEqual(browserBody.variantOfferKeys, {
    "primo-contract": "headhunters:primo-target",
  });
  assert.deepEqual(browserBody.legacyConceptOfferKeys, {
    "legacy-shared-series": ["headhunters:primo-target"],
  });
  assert.match(browserBody.familiesByKey["shared-family"]!.searchText, /deep space hit/);

  const detail = await handleMissionsRoute(
    "GET",
    "/api/missions/offer/headhunters%3Aprimo-target",
  );
  assert.equal(detail?.status, 200);
  assert.equal((detail?.body as {
    generationId: string;
    offer: { offerKey: string };
  }).generationId, offerGenerationId);
  assert.equal(
    (detail?.body as { offer: { offerKey: string } }).offer.offerKey,
    "headhunters:primo-target",
  );
  assert.equal(
    (detail?.body as { offer: { reputationRewardFacets: Array<{ scopeDisplayName: string }> } })
      .offer.reputationRewardFacets[0]?.scopeDisplayName,
    "Ship Combat",
  );

  const variants = await handleMissionsRoute(
    "GET",
    "/api/missions/offers/headhunters%3Aprimo-target/variants",
  );
  assert.equal(variants?.status, 200);
  assert.deepEqual(
    (variants?.body as { variants: Array<{ variantKey: string }> }).variants,
    [{ variantKey: "primo-contract" }],
  );

  assert.equal((await handleMissionsRoute(
    "GET",
    "/api/missions/offer/missing",
  ))?.status, 404);
  assert.equal((await handleMissionsRoute(
    "GET",
    "/api/missions/offer/missing/variants",
  ))?.status, 404);
  assert.equal((await handleMissionsRoute(
    "POST",
    "/api/missions/offer/headhunters%3Aprimo-target",
  ))?.status, 405);
  assert.equal(
    await handleMissionsRoute(
      "GET",
      "/api/missions/offer/headhunters%3Aprimo-target/eligibility",
    ),
    null,
  );
});

test("schema 3 offer routes enforce path containment and generation coherence", async () => {
  const escapeGenerationId = "offer-path-escape";
  await writeOfferGeneration(escapeGenerationId, {
    detailPathOverride: "../escape.json",
  });
  await selectOfferGeneration(escapeGenerationId);
  await assert.rejects(
    handleMissionsRoute(
      "GET",
      "/api/missions/offer/headhunters%3Aprimo-target",
    ),
    /Invalid mission data path/,
  );

  const incoherentManifestId = "offer-incoherent-manifest";
  await writeOfferGeneration(incoherentManifestId, {
    manifestGenerationId: "other-generation",
  });
  await selectOfferGeneration(incoherentManifestId);
  await assert.rejects(
    handleMissionsRoute("GET", "/api/missions/browser"),
    /different generations/,
  );

  const incoherentShardId = "offer-incoherent-shard";
  await writeOfferGeneration(incoherentShardId, {
    detailEnvelopeGenerationId: "other-generation",
  });
  await selectOfferGeneration(incoherentShardId);
  await assert.rejects(
    handleMissionsRoute(
      "GET",
      "/api/missions/offer/headhunters%3Aprimo-target",
    ),
    /different generation or schema/,
  );
});

test("schema 2 source 3 remains a valid rollback generation", async () => {
  const rollbackGenerationId = "next-generation";
  await writeFile(path.join(root, "current.json"), JSON.stringify({
    schemaVersion: 1,
    missionSchemaVersion: 2,
    sourceContractVersion: 3,
    generationId: rollbackGenerationId,
    generationPath: `generations/${rollbackGenerationId}`,
  }));

  const browser = await handleMissionsRoute("GET", "/api/missions/browser?search=test");
  assert.equal(browser?.status, 200);
  assert.equal((browser?.body as { schemaVersion: number }).schemaVersion, 2);
  assert.equal(
    Object.prototype.hasOwnProperty.call(browser?.body, "offersByKey"),
    false,
  );
  assert.equal((await handleMissionsRoute(
    "GET",
    "/api/missions/offer/headhunters%3Aprimo-target",
  ))?.status, 404);
});

test("mission routes preserve method and missing-record behavior", async () => {
  assert.equal((await handleMissionsRoute("POST", "/api/missions/browser"))?.status, 405);
  assert.equal((await handleMissionsRoute("GET", "/api/missions/variant/missing"))?.status, 404);
  assert.equal(await handleMissionsRoute("GET", "/api/not-missions"), null);
});
