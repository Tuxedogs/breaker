import assert from "node:assert/strict";
import test from "node:test";

import {
  missionOfferBookmarkMatches,
  missionOfferMatchesClientFilters,
} from "../../src/lib/missionOfferCompatibility.ts";
import type { MissionOfferView } from "../../src/lib/missionData.ts";
import {
  missionOfferUrl,
  resolveLegacyMissionConcept,
} from "../../src/lib/missionUrls.ts";

function offer(offerKey: string, displayTitle: string): MissionOfferView {
  return {
    offerSchemaVersion: 1,
    offerKey,
    identity: {
      version: "test",
      strategy: "provider_and_raw_title",
      providerIdentity: "@Provider_HeadHunters",
      titleIdentity: `@title_${offerKey}`,
      sourceTuple: ["@Provider_HeadHunters", `@title_${offerKey}`],
    },
    displayTitle,
    displayTitleTemplate: displayTitle,
    titleEvidence: {
      raw: `@title_${offerKey}`,
      localizationKey: `title_${offerKey}`,
      template: displayTitle,
      displayText: displayTitle,
      runtimeTokens: [],
      rendering: "static",
      resolution: "resolved",
      provenance: "source_backed",
    },
    provider: {
      sourceParam: "Contractor",
      displayRaw: "@Provider_HeadHunters",
      displayText: "Headhunters",
      organizationGuid: "provider-guid",
      displayResolution: "resolved",
      organizationResolution: "resolved",
      provenance: "source_backed",
    },
    providerKey: "headhunters",
    verificationStatus: "unknown",
    verificationStatuses: ["unknown"],
    variantKeys: [`variant-${offerKey}`],
    familyKeys: ["shared-family"],
    legacyConceptKeys: ["deep-space-hit"],
    objectiveTemplateKeys: [],
    missionTypes: ["Bounty"],
    rewardTypes: ["credits-calculated"],
    reputationRewardKeys: ["headhunters:bounty"],
    reputationRewardFacets: [{
      stableKey: "headhunters:bounty",
      factionKey: "headhunters",
      factionDisplayName: "Headhunters",
      scopeKey: "bounty",
      scopeDisplayName: "Bounty",
      confidence: "resolved",
      variantCount: 1,
      rewardPathCount: 1,
      amountSummary: {
        status: "exact",
        resolvedPathCount: 1,
        unresolvedPathCount: 0,
        minAmount: 100,
        maxAmount: 100,
      },
    }],
    releaseFlags: [],
    confidenceFlags: [],
    auditFlags: ["verification_unknown"],
    searchText: `${offerKey} ${displayTitle} headhunters`.toLowerCase(),
  };
}

test("schema-3 client search remains offer-local", () => {
  const primo = offer("headhunters:primo-target", "Primo Target");
  const sibling = offer("headhunters:deep-space-hit", "Deep Space Hit");

  assert.equal(missionOfferMatchesClientFilters(primo, { search: "Primo Target" }), true);
  assert.equal(missionOfferMatchesClientFilters(sibling, { search: "Primo Target" }), false);
});

test("schema-3 reputation filtering uses the structured stable facet key", () => {
  const primo = offer("headhunters:primo-target", "Primo Target");
  assert.equal(missionOfferMatchesClientFilters(primo, { repReward: "headhunters:bounty" }), true);
  assert.equal(missionOfferMatchesClientFilters(primo, { repReward: "guid-label-fragment" }), false);
});

test("legacy one-to-many concepts remain an explicit series", () => {
  const mapping = {
    "deep-space-hit": ["headhunters:deep-space-hit", "headhunters:primo-target", "headhunters:plug-a-traitor"],
  };
  assert.deepEqual(resolveLegacyMissionConcept("deep-space-hit", mapping), {
    kind: "series",
    conceptKey: "deep-space-hit",
    offerKeys: mapping["deep-space-hit"],
  });
});

test("one-to-one legacy concepts canonicalize and offer URLs retain exact variants", () => {
  assert.deepEqual(resolveLegacyMissionConcept("primo", { primo: ["headhunters:primo-target"] }), {
    kind: "offer",
    offerKey: "headhunters:primo-target",
  });
  assert.equal(
    missionOfferUrl({ offerKey: "headhunters:primo-target" }, "exact-contract-id"),
    "/industry/missions?offer=headhunters%3Aprimo-target&variant=exact-contract-id",
  );
});

test("legacy bookmarks resolve only across one-to-one aliases", () => {
  const bookmarks = new Set(["deep-space-hit", "concept:primo"]);
  assert.equal(missionOfferBookmarkMatches(bookmarks, "headhunters:primo-target", {
    primo: ["headhunters:primo-target"],
  }), true);
  assert.equal(missionOfferBookmarkMatches(bookmarks, "headhunters:deep-space-hit", {
    "deep-space-hit": ["headhunters:deep-space-hit", "headhunters:plug-a-traitor"],
  }), false);
});
