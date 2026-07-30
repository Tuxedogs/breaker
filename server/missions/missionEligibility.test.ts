import assert from "node:assert/strict";
import test from "node:test";

import { evaluateMissionEligibility } from "./missionEligibility.js";
import type {
  MissionPrerequisiteEdge,
  MissionSolverVariant,
  PlayerMissionState,
} from "./missionSolverTypes.js";

const provenance = { sourceRef: "contracts/test.xml", sourceElement: "fixture" };

function state(overrides: Partial<PlayerMissionState> = {}): PlayerMissionState {
  return {
    completedContracts: { knowledge: "complete", countsByContract: {} },
    completionTags: { knowledge: "complete", countsByTag: {} },
    reputation: [],
    crimeStat: { status: "known", value: 0 },
    location: {
      status: "known",
      locationId: "location-a",
      systemId: "system-a",
      localityIds: ["locality-a"],
      membershipKnowledge: "complete",
    },
    ...overrides,
  };
}

function edge(
  type: string,
  overrides: Partial<MissionPrerequisiteEdge> = {},
): MissionPrerequisiteEdge {
  return {
    edgeId: `edge-${type}`,
    variantId: "variant",
    ownerScope: "parent_eligibility",
    type,
    polarity: "required",
    identifiers: {},
    bounds: {},
    resolution: "source_backed",
    provenance,
    ...overrides,
  };
}

function variant(
  prerequisites: MissionPrerequisiteEdge[],
  availability = { notForRelease: false, workInProgress: false },
): MissionSolverVariant {
  return {
    identity: { variantId: "variant", familyId: "family", templateGuid: null },
    availability,
    prerequisites,
    outcomes: [],
  };
}

function tagEdge(
  polarity: "required" | "excluded",
  members: string[],
  threshold: number,
): MissionPrerequisiteEdge {
  return edge("completion_tag", {
    edgeId: `edge-tag-${polarity}-${members.join("-")}`,
    polarity,
    identifiers: { completionTag: members[0] },
    payload: {
      completionTagConstraint: {
        schemaVersion: 1,
        groupId: `group-${polarity}-${members.join("-")}`,
        polarity,
        memberCompletionTags: members,
        countField: polarity === "excluded" ? "excludedCountValue" : "requiredCountValue",
        threshold: { raw: String(threshold), value: threshold },
      },
    },
  });
}

test("returns every known blocker and preserves zero CrimeStat", () => {
  const result = evaluateMissionEligibility(
    variant([
      edge("crime_stat", {
        bounds: {
          minCrimeStat: { raw: "1", value: 1 },
          maxCrimeStat: { raw: "2", value: 2 },
        },
      }),
      tagEdge("required", ["tag-a"], 1),
    ]),
    state(),
  );

  assert.equal(result.status, "blocked");
  assert.deepEqual(result.blockers.map((entry) => entry.code), [
    "crime_stat_range",
    "completion_tag_group_count",
  ]);
});

test("evaluates grouped completion tags as count-based alternatives", () => {
  const grouped = tagEdge("required", ["tag-a", "tag-b"], 1);
  const duplicateMemberEdge = {
    ...grouped,
    edgeId: "edge-tag-second-member",
    identifiers: { completionTag: "tag-b" },
  };
  const result = evaluateMissionEligibility(
    variant([grouped, duplicateMemberEdge]),
    state({
      completionTags: {
        knowledge: "complete",
        countsByTag: { "tag-b": 1 },
      },
    }),
  );

  assert.equal(result.status, "eligible");
  assert.equal(result.explanations.length, 1);
});

test("partial completion history remains unresolved when known counts are insufficient", () => {
  const result = evaluateMissionEligibility(
    variant([tagEdge("required", ["tag-a", "tag-b"], 1)]),
    state({
      completionTags: {
        knowledge: "partial",
        countsByTag: {},
      },
    }),
  );
  assert.equal(result.status, "unresolved");
  assert.equal(result.unresolved[0]?.code, "completion_tag_state_partial");
});

test("triggered excluded tags exclude the exact variant", () => {
  const result = evaluateMissionEligibility(
    variant([tagEdge("excluded", ["tag-a"], 1)]),
    state({
      completionTags: {
        knowledge: "complete",
        countsByTag: { "tag-a": 1 },
      },
    }),
  );
  assert.equal(result.status, "excluded");
});

test("known spatial mismatch is unavailable while partial membership is unresolved", () => {
  const prerequisite = edge("locality", {
    identifiers: { localityAvailable: "locality-b" },
  });
  assert.equal(
    evaluateMissionEligibility(variant([prerequisite]), state()).status,
    "unavailable",
  );
  assert.equal(
    evaluateMissionEligibility(
      variant([prerequisite]),
      state({
        location: {
          status: "known",
          localityIds: ["locality-a"],
          membershipKnowledge: "partial",
        },
      }),
    ).status,
    "unresolved",
  );
});

test("standing GUIDs require a source-backed ordering", () => {
  const prerequisite = edge("reputation", {
    identifiers: {
      factionReputation: "faction",
      scope: "scope",
      minStanding: "standing-min",
      maxStanding: "standing-max",
    },
  });
  const player = state({
    reputation: [{
      factionId: "faction",
      scopeId: "scope",
      status: "known",
      standingId: "standing-current",
      reputationValue: 2_000,
    }],
  });
  assert.equal(evaluateMissionEligibility(variant([prerequisite]), player).status, "unresolved");
  assert.equal(
    evaluateMissionEligibility(
      variant([prerequisite]),
      player,
      { standingThresholdsById: { "standing-min": 1_000, "standing-current": 2_000, "standing-max": 3_000 } },
    ).status,
    "eligible",
  );
});

test("release and work-in-progress flags retain distinct semantics", () => {
  assert.equal(
    evaluateMissionEligibility(
      variant([], { notForRelease: true, workInProgress: false }),
      state(),
    ).status,
    "unavailable",
  );
  const workInProgress = evaluateMissionEligibility(
    variant([], { notForRelease: false, workInProgress: true }),
    state(),
  );
  assert.equal(workInProgress.status, "eligible");
  assert.equal(workInProgress.explanations[0]?.status, "informational");
});

test("subcontract-owned edges do not affect parent eligibility", () => {
  const result = evaluateMissionEligibility(
    variant([
      edge("completion_tag", {
        ownerScope: "subcontract",
        ownerId: "branch",
      }),
    ]),
    state(),
  );
  assert.equal(result.status, "eligible");
  assert.equal(result.explanations.length, 0);
});
