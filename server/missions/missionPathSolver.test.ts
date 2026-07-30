import assert from "node:assert/strict";
import test from "node:test";

import { solveMissionPath } from "./missionPathSolver.js";
import type {
  MissionGraphValidationReport,
  MissionPrerequisiteEdge,
  MissionSolverGraph,
  MissionSolverVariant,
  PlayerMissionState,
} from "./missionSolverTypes.js";

const provenance = { sourceRef: "contracts/path-fixture.xml", sourceElement: "fixture" };

function player(tags: Record<string, number> = {}): PlayerMissionState {
  return {
    completedContracts: { knowledge: "complete", countsByContract: {} },
    completionTags: { knowledge: "complete", countsByTag: tags },
    reputation: [],
    crimeStat: { status: "known", value: 0 },
    location: {
      status: "known",
      localityIds: [],
      membershipKnowledge: "complete",
    },
  };
}

function tagPrerequisite(
  variantId: string,
  groupId: string,
  members: string[],
  threshold = 1,
  polarity: "required" | "excluded" = "required",
): MissionPrerequisiteEdge {
  return {
    edgeId: `pre-${variantId}-${groupId}-${members[0]}`,
    variantId,
    ownerScope: "parent_eligibility",
    type: "completion_tag",
    polarity,
    identifiers: { completionTag: members[0] },
    bounds: {},
    payload: {
      completionTagConstraint: {
        schemaVersion: 1,
        groupId,
        polarity,
        memberCompletionTags: members,
        threshold: { raw: String(threshold), value: threshold },
      },
    },
    resolution: "source_backed",
    provenance,
  };
}

function mission(
  variantId: string,
  requiredGroups: Array<{ id: string; tags: string[]; threshold?: number }> = [],
  grants: Record<string, number> = {},
  extraPrerequisites: MissionPrerequisiteEdge[] = [],
): MissionSolverVariant {
  return {
    identity: { variantId, familyId: `family-${variantId}`, templateGuid: null },
    availability: { notForRelease: false, workInProgress: false },
    prerequisites: [
      ...requiredGroups.flatMap((group) =>
        group.tags.map((tag) => ({
          ...tagPrerequisite(variantId, group.id, group.tags, group.threshold),
          edgeId: `pre-${variantId}-${group.id}-${tag}`,
          identifiers: { completionTag: tag },
        }))
      ),
      ...extraPrerequisites,
    ],
    outcomes: Object.entries(grants).map(([tag, count]) => ({
      edgeId: `out-${variantId}-${tag}`,
      variantId,
      type: "completion_tag",
      payload: { tag, count, missionResults: [true, false, false, false, false] },
      provenance,
    })),
  };
}

function graph(
  variants: MissionSolverVariant[],
  tagProducers: Record<string, string[]>,
): MissionSolverGraph {
  const dependencies = variants.flatMap((variant) =>
    variant.prerequisites
      .filter((edge) => edge.type === "completion_tag" && edge.polarity === "required")
      .map((edge) => {
        const tag = String(edge.identifiers?.completionTag ?? "");
        const producers = tagProducers[tag] ?? [];
        return {
          prerequisiteEdgeId: edge.edgeId,
          consumerVariantId: variant.identity.variantId,
          completionTag: tag,
          producerVariantIds: producers,
          resolution: producers.length > 1 ? "resolved_alternatives" : producers.length === 1 ? "resolved_unique" : "dangling",
        };
      })
  );
  return {
    schemaVersion: 2,
    sourceContractVersion: 3,
    generationId: "generation",
    nodeCount: variants.length,
    dependencies,
    arcs: dependencies.flatMap((dependency) =>
      dependency.producerVariantIds.map((producerVariantId) => ({
        producerVariantId,
        consumerVariantId: dependency.consumerVariantId,
        completionTag: dependency.completionTag,
        prerequisiteEdgeId: dependency.prerequisiteEdgeId,
      }))
    ),
  };
}

function report(): MissionGraphValidationReport {
  return {
    schemaVersion: 2,
    sourceContractVersion: 3,
    generationId: "generation",
    summary: {
      requiredTagCount: 0,
      danglingRequiredTagCount: 0,
      excludedTagCount: 0,
      danglingExcludedTagCount: 0,
      alternateProducerTagCount: 0,
      branchRequiredTagCount: 0,
      danglingBranchTagCount: 0,
      cycleComponentCount: 0,
    },
    cycles: [],
  };
}

test("returns a zero-step result when the goal is already satisfied", () => {
  const result = solveMissionPath({
    generationId: "generation",
    graph: graph([], {}),
    validationReport: report(),
    variants: new Map(),
    playerState: player({ goal: 1 }),
    goal: { type: "completion_tag", completionTag: "goal" },
  });
  assert.equal(result.status, "satisfied");
  assert.equal(result.minimumMissionCount, 0);
});

test("finds the golden-style one-mission path to variant eligibility", () => {
  const producer = mission("producer", [], { unlock: 1 });
  const consumer = mission("consumer", [{ id: "consumer-unlock", tags: ["unlock"] }]);
  const variants = new Map([producer, consumer].map((entry) => [entry.identity.variantId, entry]));
  const result = solveMissionPath({
    generationId: "generation",
    graph: graph([producer, consumer], { unlock: ["producer"] }),
    validationReport: report(),
    variants,
    playerState: player(),
    goal: { type: "variant_eligibility", variantId: "consumer" },
  });
  assert.equal(result.status, "path_found");
  assert.equal(result.minimumMissionCount, 1);
  assert.deepEqual(result.primaryPlan?.steps.map((step) => step.variantId), ["producer"]);
});

test("preserves deterministic equal-cost alternate producers", () => {
  const alpha = mission("alpha", [], { unlock: 1 });
  const beta = mission("beta", [], { unlock: 1 });
  const consumer = mission("consumer", [{ id: "consumer-unlock", tags: ["unlock"] }]);
  const variants = new Map([beta, consumer, alpha].map((entry) => [entry.identity.variantId, entry]));
  const result = solveMissionPath({
    generationId: "generation",
    graph: graph([consumer, beta, alpha], { unlock: ["beta", "alpha"] }),
    validationReport: report(),
    variants,
    playerState: player(),
    goal: { type: "variant_eligibility", variantId: "consumer" },
  });
  assert.deepEqual(result.primaryPlan?.steps.map((step) => step.variantId), ["alpha"]);
  assert.deepEqual(result.alternatePlans[0]?.steps.map((step) => step.variantId), ["beta"]);
});

test("uses grouped tag members as alternatives rather than an AND gate", () => {
  const alpha = mission("alpha", [], { "tag-a": 1 });
  const target = mission("target", [{ id: "either-tag", tags: ["tag-a", "tag-b"] }]);
  const variants = new Map([alpha, target].map((entry) => [entry.identity.variantId, entry]));
  const result = solveMissionPath({
    generationId: "generation",
    graph: graph([alpha, target], { "tag-a": ["alpha"], "tag-b": [] }),
    validationReport: report(),
    variants,
    playerState: player(),
    goal: { type: "variant_eligibility", variantId: "target" },
  });
  assert.equal(result.status, "path_found");
  assert.equal(result.minimumMissionCount, 1);
});

test("reports dangling completion-tag evidence as unresolved", () => {
  const target = mission("target", [{ id: "missing-tag", tags: ["missing"] }]);
  const result = solveMissionPath({
    generationId: "generation",
    graph: graph([target], { missing: [] }),
    validationReport: report(),
    variants: new Map([["target", target]]),
    playerState: player(),
    goal: { type: "variant_eligibility", variantId: "target" },
  });
  assert.equal(result.status, "unresolved");
  assert.equal(result.failures.some((failure) => failure.code === "dangling_completion_tag"), true);
});

test("does not traverse a producer blocked by a fixed non-tag prerequisite", () => {
  const crimeGate: MissionPrerequisiteEdge = {
    edgeId: "crime-gate",
    variantId: "producer",
    ownerScope: "parent_eligibility",
    type: "crime_stat",
    polarity: "required",
    identifiers: {},
    bounds: {
      minCrimeStat: { raw: "3", value: 3 },
      maxCrimeStat: { raw: "5", value: 5 },
    },
    resolution: "source_backed",
    provenance,
  };
  const producer = mission("producer", [], { unlock: 1 }, [crimeGate]);
  const target = mission("target", [{ id: "target-unlock", tags: ["unlock"] }]);
  const variants = new Map([producer, target].map((entry) => [entry.identity.variantId, entry]));
  const result = solveMissionPath({
    generationId: "generation",
    graph: graph([producer, target], { unlock: ["producer"] }),
    validationReport: report(),
    variants,
    playerState: player(),
    goal: { type: "variant_eligibility", variantId: "target" },
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.failures.some((failure) => failure.code === "producer_blocked"), true);
});

test("reports a relevant dependency cycle instead of breaking it heuristically", () => {
  const alpha = mission("alpha", [{ id: "needs-beta", tags: ["tag-beta"] }], { "tag-alpha": 1 });
  const beta = mission("beta", [{ id: "needs-alpha", tags: ["tag-alpha"] }], { "tag-beta": 1 });
  const target = mission("target", [{ id: "needs-alpha-target", tags: ["tag-alpha"] }]);
  const variants = new Map([alpha, beta, target].map((entry) => [entry.identity.variantId, entry]));
  const validation = report();
  validation.summary.cycleComponentCount = 1;
  validation.cycles = [{
    variantIds: ["alpha", "beta"],
    arcs: [
      {
        producerVariantId: "alpha",
        consumerVariantId: "beta",
        completionTag: "tag-alpha",
        prerequisiteEdgeId: "pre-beta-needs-alpha-tag-alpha",
      },
      {
        producerVariantId: "beta",
        consumerVariantId: "alpha",
        completionTag: "tag-beta",
        prerequisiteEdgeId: "pre-alpha-needs-beta-tag-beta",
      },
    ],
  }];
  const result = solveMissionPath({
    generationId: "generation",
    graph: graph(
      [alpha, beta, target],
      { "tag-alpha": ["alpha"], "tag-beta": ["beta"] },
    ),
    validationReport: validation,
    variants,
    playerState: player(),
    goal: { type: "variant_eligibility", variantId: "target" },
  });
  assert.equal(result.status, "unresolved");
  assert.equal(result.failures.some((failure) => failure.code === "relevant_cycle"), true);
});
