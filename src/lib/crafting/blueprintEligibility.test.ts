import assert from "node:assert/strict";
import test from "node:test";
import {
  isEligibleCraftingBlueprint,
  isEligibleCraftingMission,
  isWikeloMissionProvider,
} from "./blueprintEligibility.ts";

test("Crafting eligibility normalizes blueprint identifiers against the canonical source index", () => {
  const eligibleBlueprintGuids = new Set(["a1b2c3"]);
  assert.equal(isEligibleCraftingBlueprint(" A1B2C3 ", eligibleBlueprintGuids), true);
  assert.equal(isEligibleCraftingBlueprint("unlinked", eligibleBlueprintGuids), false);
});

test("Mission eligibility accepts only source-linked offers plus the explicit Wikelo exception", () => {
  const eligibleMissionOfferKeys = new Set(["crusader:blueprint-reward"]);
  assert.equal(isEligibleCraftingMission({ offerKey: "crusader:blueprint-reward", providerKey: "crusader" }, eligibleMissionOfferKeys), true);
  assert.equal(isEligibleCraftingMission({ offerKey: "other:credits-only", providerKey: "other" }, eligibleMissionOfferKeys), false);
  assert.equal(isEligibleCraftingMission({ offerKey: "wikelo:trade", providerKey: "wikelo" }, eligibleMissionOfferKeys), true);
  assert.equal(isWikeloMissionProvider("WiKeLo"), true);
});
