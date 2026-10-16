import assert from "node:assert/strict";
import test from "node:test";

import { buildCoveragePlan } from "../../../features/mining/coveragePlan.js";
import type { PublicLocationEntry, RequiredMaterial } from "../../../features/mining/types.js";
import { compareLocationsForDemand, withRecommendationDemandScores } from "./miningScoring.js";

const demand = (key: string, quantity = 1): RequiredMaterial => ({
  materialKey: key,
  materialId: key,
  materialName: key,
  displayName: key,
  requiredQuantity: quantity,
  selectedQuality: 900,
  usedBy: [],
  slots: [],
});

function recommendation(
  locationName: string,
  routeScores: Record<string, number>,
  eligible = Object.keys(routeScores),
): PublicLocationEntry {
  return {
    locationKey: locationName.toLowerCase().replace(/ /g, "-"),
    locationName,
    systemName: "Test",
    locationKind: "location",
    spawnType: "ship_mineable",
    nearbyStations: [],
    materials: ["Agricium", "Bexalite"],
    score: 50,
    routeTargetabilityScore: 50,
    requiredMaterials: eligible.map((key) => ({ ...demand(key), displayQuantity: "1" })),
    routeScores: Object.entries(routeScores).map(([key, overallTargetabilityScore]) => ({
      materialKey: key,
      materialId: key,
      materialName: key,
      displayName: key,
      qualityRouteScore: null,
      yieldRouteScore: overallTargetabilityScore,
      demandMatchScore: 1,
      overallTargetabilityScore,
      label: "Good",
      reasons: [],
      signals: { qualityFit: null, yieldPotential: overallTargetabilityScore, sourceWeight: 1, routeTargetability: overallTargetabilityScore },
    })),
  };
}

test("visible demand ordering and displayed score retain canonical quality, quantity, and balanced recommendation results", () => {
  const requested = [demand("agricium", 2)];
  const cases = [
    { mode: "quality", quality: 92, quantity: 31, expected: "Quality Ridge" },
    { mode: "quantity", quality: 18, quantity: 89, expected: "Quantity Basin" },
    { mode: "balanced", quality: 60, quantity: 65, expected: "Quantity Basin" },
  ] as const;

  for (const fixture of cases) {
    // Raw static encounter rows for this fixture would favour Quantity Basin
    // (90 over 10) in every mode. The entries below are the already-ranked
    // recommendation response, whose per-material evidence is authoritative.
    const quality = recommendation("Quality Ridge", { agricium: fixture.quality });
    const quantity = recommendation("Quantity Basin", { agricium: fixture.quantity });
    const ordered = [quality, quantity].sort((left, right) => compareLocationsForDemand(left, right, requested));
    const displayed = withRecommendationDemandScores(ordered, requested, () => "Good");

    assert.equal(ordered[0]?.locationName, fixture.expected, fixture.mode);
    assert.equal(displayed[0]?.score, fixture.expected === "Quality Ridge" ? fixture.quality : fixture.quantity, fixture.mode);
  }
});

test("coverage remains coverage-first but ignores a physically present ineligible material when tie-breaking", () => {
  const requested = [demand("agricium"), demand("bexalite")];
  const partial = recommendation("Partial Ridge", { agricium: 99, bexalite: 99 }, ["agricium"]);
  const complete = recommendation("Complete Ridge", { agricium: 40, bexalite: 40 });
  const ordered = [partial, complete].sort((left, right) => compareLocationsForDemand(left, right, requested));
  const displayed = withRecommendationDemandScores(ordered, requested, () => "Good");
  const eligible = new Map(displayed.map((entry) => [
    entry.locationKey,
    entry.requiredMaterials!.map((material) => material.materialKey!),
  ]));
  const plan = buildCoveragePlan({ mode: "complete-set", demandMaterials: requested, locations: displayed, locationMaterialKeysByLocationKey: eligible });

  assert.equal(ordered[0]?.locationName, "Complete Ridge");
  assert.equal(plan.locations[0]?.entry.locationName, "Complete Ridge");
  assert.equal(plan.completionLocationKey, complete.locationKey);
  assert.equal(plan.coveredCount, 2);
});

test("no-demand browsing leaves canonical recommendation scores unchanged", () => {
  const entry = recommendation("Explore Ridge", { agricium: 73 });
  const displayed = withRecommendationDemandScores([entry], [], () => "Poor");

  assert.equal(displayed[0], entry);
  assert.equal(displayed[0]?.score, 50);
  assert.equal(displayed[0]?.routeTargetabilityScore, 50);
});
