import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  configureGeneratedLagrangeGroups,
  normalizeMiningLocationName,
} from "./locationNormalization";
import { getRecommendations } from "./recommender.service";

type TestLagrangeGroups = {
  groups: Array<{
    label: string;
    letter: string;
    locations: string[];
    materials: string[];
  }>;
};

async function loadLagrangeGroups(): Promise<TestLagrangeGroups> {
  return JSON.parse(
    await readFile("server-data/mining/locations/lagrange-groups.json", "utf8"),
  ) as TestLagrangeGroups;
}

test("physical Stanton Lagrange locations normalize from the generated CIG groups", async () => {
  const data = await loadLagrangeGroups();
  configureGeneratedLagrangeGroups(data);

  for (const group of data.groups) {
    assert.equal(normalizeMiningLocationName("Stanton", group.label), group.label);
    for (const locationCode of group.locations) {
      assert.equal(normalizeMiningLocationName("Stanton", locationCode), group.label, locationCode);
    }
  }
});

test("recommendations expose Lagrange parents with physical matched-location badges", async () => {
  const data = await loadLagrangeGroups();
  const response = await getRecommendations({
    materialRequirements: [{
      materialName: "Gold",
      displayName: "Gold",
      requiredQuantity: 1,
      selectedQuality: 800,
    }],
  });

  const expectedGroups = data.groups.filter((group) => group.materials.includes("Gold"));
  assert.ok(expectedGroups.length > 0, "generated groups should include Gold locations");
  for (const group of expectedGroups) {
    const route = response.recommendations.find((entry) => entry.locationName === group.label);
    assert.ok(route, `${group.label} should be returned for Gold`);
    for (const physicalCode of group.locations) {
      assert.ok(route.matchedLocationCodes?.includes(physicalCode), `${group.label} should retain ${physicalCode}`);
    }
  }
});
