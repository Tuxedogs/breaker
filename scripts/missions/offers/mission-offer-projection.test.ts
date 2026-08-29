import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

import {
  assertMissionOfferGoldensV1,
  buildMissionOfferShardPathsV1,
  buildMissionOffersV1,
  computeMissionOfferInvariantHashesV1,
  missionOfferMatchesSearchV1,
  safeMissionOfferTitleV1,
  type MissionOfferVariantProjectionV1,
} from "./mission-offer-projection.mts";
import type { MissionSourceRecordV4 } from "../schema/source-v4.mts";
import { parseMissionSourceCatalogV4 } from "../schema/source-v4.mts";

function record(
  contractId: string,
  titleRaw: string | null,
  title: string | null,
  options: { providerRaw?: string | null; providerText?: string | null; runtime?: boolean } = {},
): MissionSourceRecordV4 {
  const runtimeTokens = options.runtime
    ? [{ raw: "~mission(TargetName)", expression: "TargetName", segments: ["TargetName"] }]
    : [];
  return {
    contractId,
    prerequisiteEdges: [],
    outcomeEdges: [],
    offerEvidence: {
      schemaVersion: 1,
      variantId: contractId,
      provider: {
        sourceParam: "Contractor",
        displayRaw: options.providerRaw === undefined ? "@headhunters_from_001" : options.providerRaw,
        displayText: options.providerText === undefined ? "Headhunters" : options.providerText,
        organizationGuid: null,
        displayResolution: "source_backed",
        organizationResolution: "unresolved",
        provenance: options.providerRaw === null ? "unresolved" : "source_backed",
      },
      reputationFaction: { guid: null, resolution: "unresolved", provenance: "unresolved" },
      title: {
        raw: titleRaw,
        localizationKey: titleRaw?.replace(/^@/, "") ?? null,
        template: title,
        displayText: title,
        runtimeTokens,
        rendering: options.runtime ? "runtime_templated" : title ? "static" : "unresolved",
        resolution: titleRaw ? "source_backed" : "unresolved",
        provenance: titleRaw ? "source_backed" : "unresolved",
      },
      verification: {
        vocabulary: "verified_unverified",
        status: "unknown",
        effectiveIllegal: null,
        effectiveResolution: "unresolved_precedence",
        rawEvidence: {
          handlerIllegal: null,
          contractIllegal: null,
          templateIllegal: false,
          comparison: "template_only",
        },
        provenance: "unresolved",
      },
      availabilityBranches: [],
      reputationPrerequisites: [],
    },
  };
}

function variant(
  variantKey: string,
  concept = "legacy-concept",
  amount: number | null = 100,
  confidence: "resolved" | "partial" | "unresolved" = "resolved",
): MissionOfferVariantProjectionV1 {
  return {
    variantKey,
    familyKey: "family",
    legacyConceptKey: concept,
    missionType: "Bounty",
    rewardTypes: ["credit"],
    reputationRewardFacets: [{
      stableKey: "headhunters:ship-combat",
      factionKey: "headhunters",
      factionDisplayName: "Headhunters",
      scopeKey: "ship-combat",
      scopeDisplayName: "Ship Combat",
      ...(amount === null ? {} : { amount }),
      confidence,
    }],
    releaseFlags: ["Released"],
    confidenceFlags: [],
    objectiveTemplateKeys: ["template-guid"],
  };
}

test("projects structured offer-owned reputation facets from exact reward paths", () => {
  const records = [
    record("variant-a", "@title_001", "Primo Target"),
    record("variant-b", "@title_001", "Primo Target"),
  ];
  const projection = buildMissionOffersV1(records, [
    variant("variant-a", "legacy-concept", 100),
    variant("variant-b", "legacy-concept", 200),
  ]);
  assert.deepEqual(projection.offers[0]?.reputationRewardFacets, [{
    stableKey: "headhunters:ship-combat",
    factionKey: "headhunters",
    factionDisplayName: "Headhunters",
    scopeKey: "ship-combat",
    scopeDisplayName: "Ship Combat",
    confidence: "resolved",
    variantCount: 2,
    rewardPathCount: 2,
    amountSummary: {
      status: "range",
      resolvedPathCount: 2,
      unresolvedPathCount: 0,
      minAmount: 100,
      maxAmount: 200,
    },
  }]);
  assert.deepEqual(projection.offers[0]?.reputationRewardKeys, ["headhunters:ship-combat"]);
});

test("marks reputation amount summaries partial without inventing unresolved values", () => {
  const records = [
    record("variant-a", "@title_001", "Primo Target"),
    record("variant-b", "@title_001", "Primo Target"),
  ];
  const projection = buildMissionOffersV1(records, [
    variant("variant-a", "legacy-concept", 100),
    variant("variant-b", "legacy-concept", null, "unresolved"),
  ]);
  assert.deepEqual(projection.offers[0]?.reputationRewardFacets[0]?.amountSummary, {
    status: "partial",
    resolvedPathCount: 1,
    unresolvedPathCount: 1,
    minAmount: 100,
    maxAmount: 100,
  });
  assert.equal(projection.offers[0]?.reputationRewardFacets[0]?.confidence, "partial");
});

test("groups exact variants only by source-backed provider and raw title identity", () => {
  const records = [
    record("variant-a", "@title_001", "Primo Target"),
    record("variant-b", "@title_001", "Primo Target"),
    record("variant-c", "@title_002", "Plug a Traitor"),
  ];
  const projection = buildMissionOffersV1(records, records.map((item) => variant(item.contractId)));
  assert.equal(projection.offers.length, 2);
  assert.deepEqual(projection.offersByKey["headhunters:primo-target"]?.variantKeys, ["variant-a", "variant-b"]);
  assert.equal(projection.variantOfferKeys["variant-c"], "headhunters:plug-a-traitor");
  assert.deepEqual(projection.legacyConceptOfferKeys["legacy-concept"], [
    "headhunters:plug-a-traitor",
    "headhunters:primo-target",
  ]);
});

test("uses a collision-safe exact-variant fallback for unresolved identities", () => {
  const records = [
    record("variant-a", null, "Same display"),
    record("variant-b", null, "Same display"),
  ];
  const projection = buildMissionOffersV1(records, records.map((item) => variant(item.contractId)));
  assert.equal(projection.offers.length, 2);
  assert.equal(projection.identityReport.fallbackOfferCount, 2);
  assert.match(projection.variantOfferKeys["variant-a"]!, /exact-variant-a$/);
  assert.notEqual(projection.variantOfferKeys["variant-a"], projection.variantOfferKeys["variant-b"]);
});

test("preserves runtime tokens as placeholders and keeps search offer-local", () => {
  const ghost = record(
    "ghost-variant",
    "@Headhunters_EliminateSpecific_PAF_title_001",
    "Ghost ~mission(TargetName)",
    { runtime: true },
  );
  assert.equal(safeMissionOfferTitleV1(ghost.offerEvidence.title), "Ghost [TargetName]");
  const projection = buildMissionOffersV1([ghost], [variant(ghost.contractId)]);
  const offer = projection.offers[0]!;
  assert.equal(offer.offerKey, "headhunters:ghost-target-name");
  assert.equal(missionOfferMatchesSearchV1(offer, "Ghost [TargetName]"), true);
  assert.equal(missionOfferMatchesSearchV1(offer, "Deep Space Hit"), false);
  assert.equal(offer.searchText.includes("legacy-concept"), false);
  assertMissionOfferGoldensV1(projection, [{
    offerKey: "headhunters:ghost-target-name",
    providerKey: "headhunters",
    titleRaw: "@Headhunters_EliminateSpecific_PAF_title_001",
    displayTitle: "Ghost [TargetName]",
    exactVariantIds: ["ghost-variant"],
  }]);
});

test("uses the semantic runtime-title segment instead of exposing the Contractor selector", () => {
  assert.equal(safeMissionOfferTitleV1({
    raw: "@blackbox_recover_title_M_001",
    localizationKey: "blackbox_recover_title_M_001",
    template: "~mission(Contractor|BlackBoxRecoverTitleMedium)",
    displayText: "~mission(Contractor|BlackBoxRecoverTitleMedium)",
    runtimeTokens: [{
      raw: "~mission(Contractor|BlackBoxRecoverTitleMedium)",
      expression: "Contractor|BlackBoxRecoverTitleMedium",
      segments: ["Contractor", "BlackBoxRecoverTitleMedium"],
    }],
    rendering: "runtime_templated",
    resolution: "source_backed",
    provenance: "source_backed",
  }), "[Black Box Recovery — Medium]");
});

test("disambiguates display-key collisions without merging provider/title identities", () => {
  const records = [
    record("variant-a", "@title_a", "Same title"),
    record("variant-b", "@title_b", "Same title"),
  ];
  const projection = buildMissionOffersV1(records, records.map((item) => variant(item.contractId)));
  assert.equal(projection.offers.length, 2);
  assert.equal(projection.identityReport.collisionDisambiguatedOfferCount, 2);
  assert.ok(projection.offers.every((offer) => /^headhunters:same-title--[0-9a-f]{10}$/.test(offer.offerKey)));
});

test("builds deterministic offer detail and membership shard paths", () => {
  assert.deepEqual(buildMissionOfferShardPathsV1(["headhunters:primo-target"]), {
    offerDetailFiles: {
      "headhunters:primo-target": "offers/4ad71a031184828e.json",
    },
    offerVariantFiles: {
      "headhunters:primo-target": "offer-variants/4ad71a031184828e.json",
    },
  });
});

test("accepted source artifact is the exact externally audited invariant input", async () => {
  const [sourceText, manifestText] = await Promise.all([
    readFile("server-data/missions/source/mission_contracts.json", "utf8"),
    readFile("docs/mission-build-generation-audit-live-4.9.0-fdfd54f65b1f84a621899b21.json", "utf8"),
  ]);
  const manifest = JSON.parse(manifestText) as {
    goldenMissionOffers: Array<{ exactVariants: Array<{ variantId: string }> }>;
    targetSourceV4: {
      artifacts: Array<{ name: string; sha256: string }>;
      invariantResults: { protectedFieldMismatchCount: number; result: string };
    };
    invariantHashTargets: { targets: Array<{ name: string; baselineSha256: string }> };
  };
  const auditedSource = manifest.targetSourceV4.artifacts.find((artifact) =>
    artifact.name === "mission_contracts.json"
  );
  assert.equal(createHash("sha256").update(sourceText).digest("hex"), auditedSource?.sha256);
  assert.deepEqual(manifest.targetSourceV4.invariantResults, {
    ...manifest.targetSourceV4.invariantResults,
    protectedFieldMismatchCount: 0,
    result: "pass",
  });
  assert.deepEqual(Object.fromEntries(manifest.invariantHashTargets.targets.map((target) => [
    target.name,
    target.baselineSha256,
  ])), {
    auec_solver_projection: "143f769a57cb6b0bb0e42ad00e9fe1b356f16d6ad247f2c081d9c7bf02f3f8af",
    blueprint_pool_rewards: "945b992067d584731f5a9953ebc0a422c4e02b107583a5b755a489967905d2d7",
    reputation_eligibility_and_rewards: "cbdb90b16bd32418a9e61a5a5dfad1807a6323bb668dbd663d1cf8a2ba5a058e",
    release_and_availability_branches: "5df86951f16a9a9b2d57ea6365e088b4df347fd3da3ccd4b095db05ba5da7405",
  });
  const source = parseMissionSourceCatalogV4(JSON.parse(sourceText));
  const auditedVariantIds = manifest.goldenMissionOffers.flatMap((offer) =>
    offer.exactVariants.map((variant) => variant.variantId)
  );
  assert.deepEqual(
    computeMissionOfferInvariantHashesV1(source.records, auditedVariantIds),
    Object.fromEntries(manifest.invariantHashTargets.targets
      .filter((target) => target.name !== "auec_solver_projection")
      .map((target) => [target.name, target.baselineSha256])),
  );
});
