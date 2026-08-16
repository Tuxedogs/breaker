import assert from "node:assert/strict";
import test from "node:test";

import {
  assertRewardBearingContractOwnership,
  attachOfferKeysToBlueprintMissions,
  attachOfferKeysToNormalizedMissions,
  parseMissionBlueprintOfferJoin,
} from "./blueprint-offer-join.mts";

const contractId = "11111111-1111-1111-1111-111111111111";
const sourceLatestModifiedAt = "2026-07-16T00:00:00Z";

function legacyIndex() {
  return {
    schemaVersion: 2,
    sourceContractVersion: 3,
    generationId: "legacy-generation",
    sourceLatestModifiedAt,
    variantDetailFiles: { [contractId]: `variants/${contractId}.json` },
  };
}

function offerIndex() {
  return {
    schemaVersion: 3,
    sourceContractVersion: 4,
    offerSchemaVersion: 1,
    generationId: "offer-generation",
    sourceLatestModifiedAt,
    variantDetailFiles: { [contractId]: `variants/${contractId}.json` },
    variantOfferKeys: { [contractId]: "headhunters:ground-the-upstarts" },
  };
}

function manifest(index: ReturnType<typeof legacyIndex> | ReturnType<typeof offerIndex>) {
  return {
    schemaVersion: index.schemaVersion,
    sourceContractVersion: index.sourceContractVersion,
    offerSchemaVersion: "offerSchemaVersion" in index ? index.offerSchemaVersion : undefined,
    generationId: index.generationId,
  };
}

test("blueprint offer join keeps schema 2 contract-id fallback unchanged", () => {
  const index = legacyIndex();
  const join = parseMissionBlueprintOfferJoin(index, manifest(index), sourceLatestModifiedAt);
  const source = [{
    contractId,
    conceptKey: "legacy-concept",
    poolGuid: "pool-guid",
    poolName: "Pool B",
    poolChance: 0.25,
    rewardChance: 0.5,
    isDisabled: false,
  }];
  const normalized = [{ missionId: contractId, rewards: [] }];

  assert.equal(join.metadata.offerJoinStatus, "legacy_contract_id");
  assert.strictEqual(attachOfferKeysToBlueprintMissions(source, join), source);
  assert.strictEqual(attachOfferKeysToNormalizedMissions(normalized, join), normalized);
  assertRewardBearingContractOwnership([contractId], join);
});

test("blueprint offer join adds only exact offer ownership and preserves reward tuples", () => {
  const index = offerIndex();
  const join = parseMissionBlueprintOfferJoin(index, manifest(index), sourceLatestModifiedAt);
  const source = [{
    contractId,
    conceptKey: "legacy-concept",
    poolGuid: "pool-guid",
    poolName: "Pool B",
    poolChance: 0.25,
    rewardChance: 0.5,
    isDisabled: false,
    isWorkInProgress: true,
    member: {
      blueprintGuid: "blueprint-guid",
      displayName: "Blueprint Member",
      chance: 0.125,
    },
  }];
  const normalized = [{
    missionId: contractId,
    conceptKey: "legacy-concept",
    isDisabled: false,
    isWorkInProgress: true,
    rewards: [{
      blueprintGuid: "blueprint-guid",
      poolGuid: "pool-guid",
      poolName: "Pool B",
      poolChance: 0.25,
      rewardChance: 0.5,
      chance: 0.125,
    }],
  }];
  const joinedSource = attachOfferKeysToBlueprintMissions(source, join);
  const joinedNormalized = attachOfferKeysToNormalizedMissions(normalized, join);
  const { offerKey: sourceOfferKey, ...preservedSource } = joinedSource[0] as typeof source[0] & {
    offerKey: string;
  };
  const { offerKey: normalizedOfferKey, ...preservedNormalized } = joinedNormalized[0]!;
  const bookmarkBefore = `mission:${source[0].contractId}:${source[0].poolGuid}`;
  const bookmarkAfter = `mission:${preservedSource.contractId}:${preservedSource.poolGuid}`;

  assert.equal(join.metadata.offerJoinStatus, "joined_exact_variant");
  assert.equal(sourceOfferKey, "headhunters:ground-the-upstarts");
  assert.equal(normalizedOfferKey, sourceOfferKey);
  assert.deepEqual(preservedSource, source[0]);
  assert.deepEqual(preservedNormalized, normalized[0]);
  assert.equal(bookmarkAfter, bookmarkBefore);
});

test("blueprint offer join rejects missing exact variants, offers, and generation drift", () => {
  const exactMissing = offerIndex();
  exactMissing.variantDetailFiles = {};
  const exactMissingJoin = parseMissionBlueprintOfferJoin(
    exactMissing,
    manifest(exactMissing),
    sourceLatestModifiedAt,
  );
  assert.throws(
    () => assertRewardBearingContractOwnership([contractId], exactMissingJoin),
    /missing exact mission variant ownership/,
  );

  const offerMissing = offerIndex();
  offerMissing.variantOfferKeys = {};
  const offerMissingJoin = parseMissionBlueprintOfferJoin(
    offerMissing,
    manifest(offerMissing),
    sourceLatestModifiedAt,
  );
  assert.throws(
    () => assertRewardBearingContractOwnership([contractId], offerMissingJoin),
    /missing exact MissionOffer ownership/,
  );

  const index = offerIndex();
  assert.throws(
    () => parseMissionBlueprintOfferJoin(
      index,
      { ...manifest(index), generationId: "other-generation" },
      sourceLatestModifiedAt,
    ),
    /generation metadata disagree/,
  );
  assert.throws(
    () => parseMissionBlueprintOfferJoin(index, manifest(index), "other-snapshot"),
    /snapshot timestamps disagree/,
  );
});
