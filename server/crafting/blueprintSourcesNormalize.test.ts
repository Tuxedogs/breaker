import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveBlueprintSourceRecords,
  deriveMissionBlueprintRewards,
  normalizeMissionBlueprintReward,
} from "./blueprintSourcesNormalize.ts";

const contractId = "11111111-1111-1111-1111-111111111111";
const poolGuid = "22222222-2222-2222-2222-222222222222";
const blueprintGuid = "33333333-3333-3333-3333-333333333333";
const catalog = {
  records: [{
    contractId,
    title: "Canonical Reward Mission",
    debugName: "CanonicalRewardMission",
    generatorName: "ContractGenerator.CanonicalRewardMission",
    factionReputationGuid: "44444444-4444-4444-4444-444444444444",
    factionName: "Fixture Faction",
    notForRelease: false,
    workInProgress: false,
    prerequisites: [],
    reputationRewards: [],
    creditRewardTypes: [],
    blueprintRewards: [{
      chance: 0.5,
      blueprintPoolGuid: poolGuid,
      missionResults: [true, false],
      difficulty: null,
    }],
  }],
};
const lookups = {
  blueprintPools: [{
    poolGuid,
    poolName: "BlueprintPoolRecord.BP_REWARDS_Fixture",
    displayName: "Fixture Rewards",
    rewards: [{
      blueprintGuid,
      displayName: "Fixture Blueprint",
      componentType: "weapon",
      weight: 1,
      poolChance: 0.25,
    }],
  }],
};

test("canonical contracts and reward pools derive mission reward membership", () => {
  const rewards = deriveMissionBlueprintRewards(catalog, lookups);
  assert.equal(rewards.length, 1);
  const normalized = normalizeMissionBlueprintReward(rewards[0]);
  assert.ok(normalized);
  assert.equal(normalized.missionId, contractId);
  assert.deepEqual(normalized.rewardPools, ["Fixture Rewards"]);
  assert.deepEqual(normalized.rewards, [{
    rewardKey: blueprintGuid,
    blueprintGuid,
    displayName: "Fixture Blueprint",
    componentType: "weapon",
    size: undefined,
    grade: undefined,
    itemClass: undefined,
    blueprintName: undefined,
    poolGuid,
    poolName: "Fixture Rewards",
    poolChance: 0.25,
    rewardChance: 0.5,
    chance: 0.125,
    weight: 1,
  }]);
});

test("canonical contracts derive the existing blueprint source relationship", () => {
  assert.deepEqual(deriveBlueprintSourceRecords(catalog, lookups), [{
    blueprintGuid,
    displayName: "Fixture Blueprint",
    componentType: "weapon",
    missions: [{
      contractId,
      contractTitle: "Canonical Reward Mission",
      contractDebugName: "CanonicalRewardMission",
      generatorName: "ContractGenerator.CanonicalRewardMission",
      factionGuid: "44444444-4444-4444-4444-444444444444",
      factionName: "Fixture Faction",
      poolGuid,
      poolName: "Fixture Rewards",
      poolChance: 0.25,
      rewardChance: 0.5,
    }],
  }]);
});
