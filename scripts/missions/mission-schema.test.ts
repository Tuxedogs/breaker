import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildMissionGraphValidationV2 } from "./graph/mission-graph.mts";
import { normalizeRequiredItemsV2 } from "./normalize/required-items.mts";
import { projectBrowserCreditV2 } from "./normalize/rewards.mts";
import {
  buildMissionShardPathsV2,
  missionPayloadFileName,
  projectCompactMissionVariantV2,
} from "./project/browser-projection.mts";
import { publishImmutableMissionGeneration } from "./publication/write-artifacts.mts";
import { buildMissionGraphArtifactsV2 } from "./report/graph-report.mts";
import { normalizeCanonicalMissionVariantV2 } from "./schema/canonical-v2.mts";
import {
  parseMissionSourceCatalogV3,
  type MissionSourceCatalogV3,
  type MissionSourceEdgeV3,
  type MissionSourceRecordV3,
} from "./schema/source-v3.mts";

function edge(
  variantId: string,
  edgeId: string,
  type: string,
  values: Partial<MissionSourceEdgeV3> = {},
): MissionSourceEdgeV3 {
  return {
    edgeId,
    variantId,
    type,
    provenance: { sourceRef: "contracts/test.xml" },
    ...values,
  };
}

function record(contractId: string, values: Partial<MissionSourceRecordV3> = {}): MissionSourceRecordV3 {
  return {
    contractId,
    prerequisiteEdges: [],
    outcomeEdges: [],
    ...values,
  };
}

function catalog(records: MissionSourceRecordV3[]): MissionSourceCatalogV3 {
  return {
    schemaVersion: 3,
    generatedAt: "2026-07-30T00:00:00Z",
    sourceLatestModifiedAt: "2026-07-16T00:00:00Z",
    source: {
      channel: "LIVE",
      buildId: "4.9.0-live.test",
      sourceLatestModifiedAt: "2026-07-16T00:00:00Z",
      calculationInputsDigestSha256: "digest",
      calculationInputFiles: [],
    },
    records,
  };
}

test("source v3 guard rejects old schemas and duplicate identities", () => {
  assert.throws(
    () => parseMissionSourceCatalogV3({ ...catalog([]), schemaVersion: 1 }),
    /expected 3/,
  );
  assert.throws(
    () => parseMissionSourceCatalogV3(catalog([record("same"), record("same")])),
    /Duplicate mission contractId same/,
  );
});

test("resolved calculated payout preserves zero as a real base solo amount", () => {
  const source = record("zero", {
    calculatedPayout: {
      schemaVersion: 1,
      modelVersion: "sc_mission_calculated_payout_v1",
      calculationStatus: "resolved",
      formulaStatus: "resolved_source_backed",
      currency: "aUEC",
      baseSoloAmount: 0,
      resultCount: 1,
      aggregationStatus: "not_aggregated",
      resultLoopVerificationRequired: false,
      resultAmounts: [{
        resultIndex: 0,
        calculationStatus: "resolved",
        currency: "aUEC",
        baseSoloAmount: 0,
        missionResults: [true, false, false, false, false],
      }],
      unresolvedReasons: [],
      validationWarnings: ["non_positive_time_to_complete"],
      source: "creditRewardTypes[].calculatedContext",
    },
    creditRewardTypes: [{
      type: "ContractResult_CalculatedReward",
      sourceRefs: ["contracts/test.xml"],
    }],
  });
  const projection = projectBrowserCreditV2(source);
  assert.equal(projection.status, "calculated");
  assert.equal(projection.amount, 0);
  assert.equal(projection.displayText, "0 aUEC");
});

test("multiple calculated result branches remain unsummed and flagged", () => {
  const source = record("multi", {
    calculatedPayout: {
      schemaVersion: 1,
      modelVersion: "sc_mission_calculated_payout_v1",
      calculationStatus: "resolved",
      formulaStatus: "resolved_source_backed",
      currency: "aUEC",
      baseSoloAmount: 15250,
      resultCount: 2,
      aggregationStatus: "not_aggregated",
      resultLoopVerificationRequired: true,
      resultAmounts: [
        { resultIndex: 0, calculationStatus: "resolved", currency: "aUEC", baseSoloAmount: 15250, missionResults: [true] },
        { resultIndex: 1, calculationStatus: "resolved", currency: "aUEC", baseSoloAmount: 15250, missionResults: [false, true] },
      ],
      unresolvedReasons: [],
      validationWarnings: [],
      source: "creditRewardTypes[].calculatedContext",
    },
    creditRewardTypes: [{ type: "ContractResult_CalculatedReward", sourceRefs: ["contracts/test.xml"] }],
  });
  const projection = projectBrowserCreditV2(source);
  assert.equal(projection.status, "variable");
  assert.match(projection.unresolvedReason, /not summed/);
});

test("fixed non-aUEC currency and required items remain distinct canonical evidence", () => {
  const source = record("mer", {
    creditRewardTypes: [{
      type: "ContractResult_Reward",
      fixedReward: { reward: 3000, max: 5000, currencyType: "MER" },
      sourceRefs: ["contracts/test.xml"],
    }],
    requiredItemEvidence: [{
      evidenceId: "req-1",
      variantId: "mer",
      sourceScope: "contract",
      sourceOwnerId: "mer",
      requirementRole: "hauling_order",
      roleStatus: "explicit_order",
      requirementStatus: "source_backed_order",
      content: { type: "hauling_orders", logic: "all_of", entries: [] },
      provenance: { sourceRef: "contracts/test.xml" },
    }],
  });
  const credit = projectBrowserCreditV2(source);
  assert.equal(credit.status, "fixed");
  assert.equal(credit.currency, "MER");
  assert.equal(credit.displayText, "3,000 MER");
  const requiredItems = normalizeRequiredItemsV2(source);
  assert.equal(requiredItems.haulingOrderCount, 1);
  assert.equal(requiredItems.status, "present");
});

test("canonical v2 keeps fixed and calculated reputation outcomes separate", () => {
  const source = record("rep", {
    creditRewardTypes: [{
      type: "ContractResult_CalculatedReward",
      calculatedContext: {
        schemaVersion: 1,
        modelVersion: "sc_mission_calculated_payout_v1",
        calculationStatus: "resolved",
        formulaStatus: "resolved_source_backed",
        currency: "aUEC",
        baseSoloAmount: 1000,
        amount: 1000,
        resultIndex: 0,
        resultCount: 1,
        aggregationStatus: "not_aggregated",
        resultLoopVerificationRequired: false,
        unresolvedReasons: [],
        validationWarnings: [],
        contractBuyInAmount: { raw: "500", value: 500 },
        provenance: { buildId: "build" },
      },
    }],
    fixedReputationRewards: [{ type: "ContractResult_Reputation" }],
    calculatedReputationRewards: [{ type: "ContractResult_CalculatedReputation" }],
    familyId: "family",
    outcomeEdges: [
      edge("rep", "fixed-rep", "fixed_reputation"),
      edge("rep", "calc-rep", "calculated_reputation"),
    ],
  });
  const normalized = normalizeCanonicalMissionVariantV2(catalog([source]), source);
  assert.equal(normalized.identity.variantId, "rep");
  assert.equal(normalized.identity.familyId, "family");
  assert.deepEqual(normalized.rewards.fixedReputation.map((item) => item.edgeId), ["fixed-rep"]);
  assert.deepEqual(normalized.rewards.calculatedReputation.map((item) => item.edgeId), ["calc-rep"]);
  assert.equal(normalized.reputationOutcomes.fixed.length, 1);
  assert.equal(normalized.reputationOutcomes.calculated.length, 1);
  assert.equal(normalized.financials.buyIns[0]?.contractBuyInAmount.value, 500);
});

test("graph validation separates required, excluded, branch, ambiguity, dangling, and cycles", () => {
  const producerA = record("producer-a", {
    prerequisiteEdges: [
      edge("producer-a", "pre-cycle-a", "completion_tag", {
        polarity: "required",
        identifiers: { completionTag: "tag-b" },
      }),
      edge("producer-a", "excluded", "completion_tag", {
        polarity: "excluded",
        identifiers: { completionTag: "missing-excluded" },
      }),
    ],
    outcomeEdges: [
      edge("producer-a", "out-a", "completion_tag", { payload: { tag: "tag-a" } }),
      edge("producer-a", "out-shared-a", "completion_tag", { payload: { tag: "tag-shared" } }),
    ],
  });
  const producerB = record("producer-b", {
    prerequisiteEdges: [
      edge("producer-b", "pre-cycle-b", "completion_tag", {
        polarity: "required",
        identifiers: { completionTag: "tag-a" },
      }),
    ],
    outcomeEdges: [
      edge("producer-b", "out-b", "completion_tag", { payload: { tag: "tag-b" } }),
      edge("producer-b", "out-shared-b", "completion_tag", { payload: { tag: "tag-shared" } }),
    ],
  });
  const consumer = record("consumer", {
    prerequisiteEdges: [
      edge("consumer", "pre-shared", "completion_tag", {
        polarity: "required",
        identifiers: { completionTag: "tag-shared" },
      }),
      edge("consumer", "pre-missing", "completion_tag", {
        polarity: "required",
        identifiers: { completionTag: "missing" },
      }),
    ],
    subContractPrerequisiteEdges: {
      branch: [
        edge("consumer", "branch-missing", "completion_tag", {
          polarity: "required",
          identifiers: { completionTag: "missing-branch" },
        }),
      ],
    },
  });

  const graph = buildMissionGraphValidationV2([producerA, producerB, consumer]);
  assert.equal(graph.summary.danglingRequiredTagCount, 1);
  assert.equal(graph.summary.danglingExcludedTagCount, 1);
  assert.equal(graph.summary.danglingBranchTagCount, 1);
  assert.equal(graph.summary.alternateProducerTagCount, 1);
  assert.equal(graph.summary.cycleComponentCount, 1);
  assert.equal(
    graph.dependencies.find((item) => item.prerequisiteEdgeId === "pre-shared")?.resolution,
    "resolved_alternatives",
  );
  const artifacts = buildMissionGraphArtifactsV2({
    schemaVersion: 2,
    sourceContractVersion: 3,
    generationId: "generation",
    generatedAt: "2026-07-30T00:00:00Z",
    sourceLatestModifiedAt: "2026-07-16T00:00:00Z",
  }, graph);
  assert.equal(artifacts.graph.generationId, "generation");
  assert.equal(artifacts.report.summary.cycleComponentCount, 1);
});

test("browser shard projection is deterministic and keeps exact bodies out of the index map", () => {
  assert.equal(missionPayloadFileName("variant"), missionPayloadFileName("variant"));
  const paths = buildMissionShardPathsV2(["family"], ["variant"]);
  assert.match(paths.familyDetailFiles.family!, /^families\/[a-f0-9]{16}\.json$/);
  assert.match(paths.familyVariantFiles.family!, /^family-variants\/[a-f0-9]{16}\.json$/);
  assert.match(paths.variantDetailFiles.variant!, /^variants\/[a-f0-9]{16}\.json$/);
  const compact = projectCompactMissionVariantV2({
    variantKey: "variant",
    canonical: { expensive: "evidence" },
    requiredItems: {
      status: "present",
      evidence: [{ expensive: "evidence" }],
      haulingOrderCount: 1,
      selectorCount: 2,
    },
  });
  assert.equal("canonical" in compact, false);
  assert.equal("requiredItems" in compact, false);
  assert.deepEqual(compact.requiredItemSummary, {
    status: "present",
    haulingOrderCount: 1,
    selectorCount: 2,
  });
});

test("immutable publication switches the pointer only after the generation exists and removes legacy shards", async () => {
  const missionRoot = await mkdtemp(path.join(os.tmpdir(), "moonbreaker-mission-publish-"));
  const generationId = "generation";
  const stagingRoot = path.join(missionRoot, ".staging");
  try {
    await mkdir(path.join(stagingRoot, "variants"), { recursive: true });
    await writeFile(path.join(stagingRoot, "mission_browser_index.json"), "{}");
    await writeFile(path.join(missionRoot, "legacy.json"), "{}");
    await mkdir(path.join(missionRoot, "variants"), { recursive: true });
    await writeFile(path.join(missionRoot, "variants", "stale.json"), "{}");

    const pointer = await publishImmutableMissionGeneration({
      missionRoot,
      stagingRoot,
      generationId,
      shaperVersion: "test-shaper",
      legacyRootFiles: ["legacy.json"],
      legacyShardDirectories: ["variants"],
    });
    assert.equal(pointer.generationId, generationId);
    assert.deepEqual(
      JSON.parse(await readFile(path.join(missionRoot, "current.json"), "utf8")),
      pointer,
    );
    await assert.rejects(readFile(path.join(missionRoot, "legacy.json"), "utf8"));
    await assert.rejects(readFile(path.join(missionRoot, "variants", "stale.json"), "utf8"));
    assert.equal(
      await readFile(
        path.join(missionRoot, "generations", generationId, "mission_browser_index.json"),
        "utf8",
      ),
      "{}",
    );
  } finally {
    await rm(missionRoot, { recursive: true, force: true });
  }
});
