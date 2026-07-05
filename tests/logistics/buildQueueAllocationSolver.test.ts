import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getWeightedAverageQuality,
  solveBuildQueueAllocation,
  type AllocationSolverLot,
} from "../../src/lib/logistics/buildQueueAllocationSolver";

function lot(
  id: string,
  quality: number,
  availableScu: number,
  locationName = "Area 18",
): AllocationSolverLot {
  return {
    lotId: id,
    materialId: "laranite",
    quality,
    availableScu,
    locationId: `loc-${id}`,
    locationName,
  };
}

describe("buildQueueAllocationSolver", () => {
  it("proposes multiple same-quality lots and preserves lot IDs", () => {
    const plan = solveBuildQueueAllocation(
      {
        materialId: "laranite",
        requiredScu: 5,
        targetQuality: 500,
        existingAllocations: [],
      },
      [lot("box-a", 600, 2), lot("box-b", 600, 2), lot("box-c", 600, 2)],
    );

    assert.equal(plan.proposedLots.length, 3);
    assert.deepEqual(
      plan.proposedLots.map((entry) => entry.lotId).sort(),
      ["box-a", "box-b", "box-c"],
    );
    assert.equal(plan.totalProposedScu, 5);
    assert.equal(plan.meetsQuantity, true);
    assert.equal(plan.proposedLots.at(-1)?.proposedScu, 1);
  });

  it("partially uses the final lot", () => {
    const plan = solveBuildQueueAllocation(
      {
        materialId: "laranite",
        requiredScu: 3.5,
        existingAllocations: [],
      },
      [lot("box-a", 500, 2), lot("box-b", 500, 2)],
    );

    assert.equal(plan.totalProposedScu, 3.5);
    assert.equal(plan.proposedLots.at(-1)?.proposedScu, 1.5);
    assert.equal(plan.meetsQuantity, true);
  });

  it("includes existing allocations in projected average quality", () => {
    const plan = solveBuildQueueAllocation(
      {
        materialId: "laranite",
        requiredScu: 4,
        targetQuality: 700,
        existingAllocations: [{ lotId: "existing", quality: 900, allocatedScu: 2 }],
      },
      [lot("box-a", 500, 2)],
    );

    assert.equal(plan.alreadyAllocatedScu, 2);
    assert.equal(plan.remainingNeedScu, 2);
    assert.equal(plan.totalProposedScu, 2);
    assert.equal(plan.projectedAverageQuality, 700);
    assert.equal(plan.meetsTargetQuality, true);
  });

  it("warns when target quality cannot be met", () => {
    const plan = solveBuildQueueAllocation(
      {
        materialId: "laranite",
        requiredScu: 4,
        targetQuality: 800,
        existingAllocations: [],
      },
      [lot("box-a", 500, 2), lot("box-b", 600, 2)],
    );

    assert.equal(plan.meetsQuantity, true);
    assert.equal(plan.meetsTargetQuality, false);
    assert.ok(plan.warnings.some((warning) => warning.includes("Target quality 800 cannot be met")));
  });

  it("warns when quantity is short", () => {
    const plan = solveBuildQueueAllocation(
      {
        materialId: "laranite",
        requiredScu: 10,
        existingAllocations: [],
      },
      [lot("box-a", 500, 3), lot("box-b", 500, 2)],
    );

    assert.equal(plan.meetsQuantity, false);
    assert.equal(plan.totalProposedScu, 5);
    assert.ok(plan.warnings.some((warning) => warning.includes("Insufficient inventory")));
  });

  it("calculates weighted average quality correctly", () => {
    const average = getWeightedAverageQuality([
      { quality: 400, scu: 2 },
      { quality: 600, scu: 2 },
    ]);
    assert.equal(average, 500);
  });
});
