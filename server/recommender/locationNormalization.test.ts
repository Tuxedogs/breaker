import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMiningLocationName } from "./locationNormalization";
import { getRecommendations } from "./recommender.service";

const EXPECTED_LAGRANGE_GROUPS: Record<string, string[]> = {
  "Lagrange A": ["HUR-L3"],
  "Lagrange B": ["CRU-L1", "CRU-L2"],
  "Lagrange C": ["CRU-L5"],
  "Lagrange D": ["ARC-L5"],
  "Lagrange E": ["CRU-L3", "MIC-L1", "MIC-L2", "MIC-L5"],
  "Lagrange F": ["CRU-L4"],
  "Lagrange G": ["ARC-L1", "ARC-L2", "HUR-L2"],
  "Lagrange H": ["HUR-L1", "HUR-L4", "HUR-L5"],
  "Lagrange I": ["MIC-L4"],
  "Lagrange J": ["ARC-L3"],
  "Lagrange K": ["ARC-L4"],
  "Lagrange L": ["MIC-L3"],
};

test("physical Stanton Lagrange locations normalize to the A-L parent groups", () => {
  for (const [groupLabel, locationCodes] of Object.entries(EXPECTED_LAGRANGE_GROUPS)) {
    assert.equal(normalizeMiningLocationName("Stanton", groupLabel), groupLabel);
    for (const locationCode of locationCodes) {
      assert.equal(normalizeMiningLocationName("Stanton", locationCode), groupLabel, locationCode);
    }
  }
});

test("recommendations expose Lagrange parents with physical matched-location badges", async () => {
  const response = await getRecommendations({
    materialRequirements: [{
      materialName: "Gold",
      displayName: "Gold",
      requiredQuantity: 1,
      selectedQuality: 800,
    }],
  });

  const expectedRoutes: Record<string, string> = {
    "Lagrange D": "ARC-L5",
    "Lagrange F": "CRU-L4",
    "Lagrange L": "MIC-L3",
  };
  for (const [locationName, physicalCode] of Object.entries(expectedRoutes)) {
    const route = response.recommendations.find((entry) => entry.locationName === locationName);
    assert.ok(route, `${locationName} should be returned for Gold`);
    assert.ok(route.matchedLocationCodes?.includes(physicalCode), `${locationName} should retain ${physicalCode}`);
  }
});
