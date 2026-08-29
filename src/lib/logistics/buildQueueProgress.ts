import type { BuildQueueItem, InventoryEntry } from "../../types/logistics";
import type { RecipeInputTemplate } from "../../data/logistics/seed";
import { getBuildQueueItemInputs } from "./inventory";
import {
  allocationMatchesRequirement,
  getAllocationTotal,
  getRequirementLineKey,
  isInventoryEntrySupportedForBuildQueuePhysicalAvailability,
  validateReservedAllocations,
} from "./buildQueueReservations";

export type BuildQueueItemFulfillmentState = "ready" | "partial" | "missing";

export interface BuildQueueItemAllocationSummary {
  basis: "valid-physical-lot-allocation";
  fulfillment: BuildQueueItemFulfillmentState;
  progressPercent: number | null;
}

/**
 * Canonical Build Queue readiness/progress read model.
 *
 * Both values describe valid physical-lot allocation coverage. Owned but
 * unallocated inventory is deliberately excluded, as are stale allocations.
 */
export function getBuildQueueItemAllocationSummary(
  item: BuildQueueItem,
  inputs: RecipeInputTemplate[],
  inventoryEntries: InventoryEntry[],
): BuildQueueItemAllocationSummary {
  if (inputs.length === 0) {
    return { basis: "valid-physical-lot-allocation", fulfillment: "missing", progressPercent: null };
  }

  const ratios = inputs.map((input, inputIndex) => {
    const required = input.quantity * item.quantity;
    if (required <= 0) return 1;
    const materialId = input.materialKey ?? input.materialId;
    const requirementId = getRequirementLineKey(item, input, inputIndex);
    const allocations = (item.reservedAllocations ?? []).filter((allocation) =>
      allocationMatchesRequirement(allocation, materialId, { requirementId, unitType: input.unitType }),
    );
    const validAllocations = validateReservedAllocations(allocations, inventoryEntries)
      .filter((validation) =>
        !validation.isStale &&
        validation.inventoryEntry !== undefined &&
        isInventoryEntrySupportedForBuildQueuePhysicalAvailability(validation.inventoryEntry),
      )
      .map((validation) => validation.allocation);
    return Math.max(0, Math.min(1, getAllocationTotal(validAllocations) / required));
  });

  const fulfillment: BuildQueueItemFulfillmentState = ratios.every((ratio) => ratio >= 1)
    ? "ready"
    : ratios.some((ratio) => ratio > 0)
      ? "partial"
      : "missing";
  const averageRatio = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;

  return {
    basis: "valid-physical-lot-allocation",
    fulfillment,
    progressPercent: Math.round(averageRatio * 100),
  };
}

export function getBuildQueueItemFulfillmentState(
  item: BuildQueueItem,
  inputs: RecipeInputTemplate[],
  inventoryEntries: InventoryEntry[],
): BuildQueueItemFulfillmentState {
  return getBuildQueueItemAllocationSummary(item, inputs, inventoryEntries).fulfillment;
}

export function getBuildQueueItemAllocationProgress(
  item: BuildQueueItem,
  recipeInputsByRecipeId: Record<string, RecipeInputTemplate[]>,
  inventoryEntries: InventoryEntry[],
): number | null {
  const inputs = getBuildQueueItemInputs(item, recipeInputsByRecipeId);
  return getBuildQueueItemAllocationSummary(item, inputs, inventoryEntries).progressPercent;
}
