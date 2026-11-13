import assert from "node:assert/strict";
import test from "node:test";

import { getRecommendationEligibleMaterialKeys } from "../../components/industry/mining/useMiningLocations.js";
import { buildCoveragePlan } from "./coveragePlan.js";
import type { PublicLocationEntry, RequiredMaterial } from "./types.js";

const demand = (materialKey: string): RequiredMaterial => ({
  materialKey,
  materialId: materialKey,
  materialName: materialKey,
  displayName: materialKey,
  requiredQuantity: 1,
  selectedQuality: 900,
  usedBy: [],
  slots: [],
});

function location(key: string, eligible: string[] | undefined): PublicLocationEntry {
  return {
    locationKey: key,
    locationName: key,
    systemName: "Test",
    spawnType: "mixed",
    score: 50,
    materials: ["Agricium", "Bexalite"],
    nearbyStations: [],
    requiredMaterials: eligible?.map(demand),
  };
}

test("coverage ignores physically present materials excluded for missing quality evidence", () => {
  const partial = location("Partial Ridge", ["agricium"]);
  const eligible = getRecommendationEligibleMaterialKeys(partial);
  assert.deepEqual(eligible, ["agricium"]);

  const plan = buildCoveragePlan({
    mode: "complete-set",
    demandMaterials: [demand("agricium"), demand("bexalite")],
    locations: [partial],
    locationMaterialKeysByLocationKey: new Map([[partial.locationKey, eligible!]]),
  });

  assert.equal(plan.coveredCount, 1);
  assert.equal(plan.coveredPct, 50);
  assert.equal(plan.completionLocationKey, null);
  assert.equal(plan.locations[0]?.isCompletionLocation, false);
  assert.equal(plan.summary.headline, "1 / 2 materials covered");
  assert.match(plan.summary.detail, /50% coverage/);
  assert.equal(plan.materialRows.find((row) => row.materialKey === "bexalite")?.status, "missing");
});

test("coverage uses the allowed ship source, not a disallowed hand sibling", () => {
  const mixed = location("Mixed Ridge", ["agricium"]);
  const plan = buildCoveragePlan({
    mode: "complete-set",
    demandMaterials: [demand("agricium"), demand("bexalite")],
    locations: [mixed],
    locationMaterialKeysByLocationKey: new Map([[mixed.locationKey, getRecommendationEligibleMaterialKeys(mixed)!]]),
  });

  assert.deepEqual(plan.locations[0]?.coveredMaterialKeys, ["agricium"]);
  assert.equal(plan.coveredCount, 1);
  assert.equal(plan.completionLocationKey, null);
  assert.equal(plan.summary.completionText, null);
});

test("fully eligible coverage retains complete route semantics", () => {
  const complete = location("Complete Ridge", ["agricium", "bexalite"]);
  const plan = buildCoveragePlan({
    mode: "complete-set",
    demandMaterials: [demand("agricium"), demand("bexalite")],
    locations: [complete],
    locationMaterialKeysByLocationKey: new Map([[complete.locationKey, getRecommendationEligibleMaterialKeys(complete)!]]),
  });

  assert.equal(plan.coveredCount, 2);
  assert.equal(plan.coveredPct, 100);
  assert.equal(plan.completionLocationKey, complete.locationKey);
  assert.equal(plan.locations[0]?.isCompletionLocation, true);
  assert.equal(plan.summary.headline, "2 / 2 materials covered");
  assert.equal(plan.summary.completionText, "Complete after 1 location");
});
