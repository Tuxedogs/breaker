import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateCurrentMissionEligibility,
  solveCurrentMissionPath,
} from "./missionSolverData.js";
import type { PlayerMissionState } from "./missionSolverTypes.js";

const introVariantId = "1035d0f0-82e7-4cee-8d10-789925b3d138";
const consumerVariantId = "1136e707-15cb-49b9-9943-c3a2de91d3f2";
const unlockTag = "ab960018-6478-4e5d-9c74-175662c57129";

function goldenState(tags: Record<string, number> = {}): PlayerMissionState {
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

test("current generation evaluates the Rayari intro exclusion and consumer gate", async () => {
  assert.equal(
    (await evaluateCurrentMissionEligibility(introVariantId, goldenState())).status,
    "eligible",
  );
  assert.equal(
    (await evaluateCurrentMissionEligibility(
      introVariantId,
      goldenState({ [unlockTag]: 1 }),
    )).status,
    "excluded",
  );
  assert.equal(
    (await evaluateCurrentMissionEligibility(consumerVariantId, goldenState())).status,
    "blocked",
  );
  assert.equal(
    (await evaluateCurrentMissionEligibility(
      consumerVariantId,
      goldenState({ [unlockTag]: 1 }),
    )).status,
    "eligible",
  );
});

test("current generation finds the proven one-mission Rayari unlock path", async () => {
  const result = await solveCurrentMissionPath(
    { type: "variant_eligibility", variantId: consumerVariantId },
    goldenState(),
  );
  assert.equal(result.status, "path_found");
  assert.equal(result.minimumMissionCount, 1);
  assert.deepEqual(
    result.primaryPlan?.steps.map((step) => step.variantId),
    [introVariantId],
  );
});

test("current generation uses published standing thresholds for reputation eligibility", async () => {
  const state = goldenState();
  state.location = {
    status: "known",
    locationId: "b9b1a547-c415-44cb-826b-6c28cbd0c0bb",
    localityIds: [],
    membershipKnowledge: "complete",
  };
  state.reputation = [{
    factionId: "cfe06ba5-968d-4e27-b738-7cc7abfb511f",
    scopeId: "f340b011-c40c-4229-b9c1-ce6a3eb1df77",
    status: "known",
    reputationValue: 0,
  }];
  const result = await evaluateCurrentMissionEligibility(
    "1464ed09-2099-4102-8672-25f764e278d2",
    state,
  );
  assert.equal(result.status, "eligible");
});
