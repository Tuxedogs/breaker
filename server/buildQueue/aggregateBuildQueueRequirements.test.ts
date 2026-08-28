import assert from "node:assert/strict";
import test from "node:test";

import { aggregateBuildQueueRequirements } from "./aggregateBuildQueueRequirements";
import type { BuildQueueRequirementsRequest } from "./buildQueue.types";

function request(allowLowerQualityOverride: boolean): BuildQueueRequirementsRequest {
  return {
    buildQueue: [{
      id: "instance-a",
      recipeId: "same-recipe",
      quantity: 1,
      materialRequirements: [{
        requirementId: "requirement-a",
        materialKey: "test-material",
        materialId: "test-material",
        materialName: "Test Material",
        quantity: 10,
        selectedQuality: 800,
      }],
      reservedAllocations: [{
        materialId: "test-material",
        quantityReserved: 3,
        selectedQuality: 800,
        allowLowerQualityOverride,
      }],
    }],
    inventoryEntries: [],
  };
}

test("server quality-eligible planning distinguishes lower-quality overrides from physical reservations", async () => {
  const normal = await aggregateBuildQueueRequirements(request(false), []);
  const belowTargetOverride = await aggregateBuildQueueRequirements(request(true), []);

  assert.equal(normal[0]?.requiredQuantity, 7);
  assert.equal(belowTargetOverride[0]?.requiredQuantity, 10);
});
