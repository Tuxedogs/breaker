import type { BuildQueueItem, InventoryEntry, ReservedMaterialAllocation } from "../../types/logistics";
import type { RecipeInputTemplate } from "../../data/logistics/seed";
import type { ModifierAtQuality } from "../../components/industry/crafting/utils/qualityModifiers";
import { getModifiersAtQuality } from "../../components/industry/crafting/utils/qualityModifiers";

export const MIN_MATERIAL_QUALITY = 1;
export const MAX_MATERIAL_QUALITY = 1000;

export interface BuildQueueRequirementIdentity {
  requirementId?: string;
  selectedQuality?: number;
  unitType?: RecipeInputTemplate["unitType"];
  allowLowerQuality?: boolean;
}

export interface ReservedAllocationValidation {
  allocation: ReservedMaterialAllocation;
  inventoryEntry: InventoryEntry | undefined;
  isStale: boolean;
  staleReason?: "missingStack" | "mismatchedMaterial" | "nonPositiveQuantity" | "exceedsStackQuantity";
}

export function clampMaterialQuality(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(MIN_MATERIAL_QUALITY, Math.min(MAX_MATERIAL_QUALITY, Math.trunc(parsed)));
}

export function getAllocationTotal(allocations: Pick<ReservedMaterialAllocation, "quantityReserved">[]): number {
  return allocations.reduce((sum, allocation) => sum + Math.max(0, allocation.quantityReserved), 0);
}

export type QualityAllocationBreakdownEntry = {
  quality: number;
  quantity: number;
};

export function getQualityAllocationBreakdown(
  allocations: Pick<ReservedMaterialAllocation, "quantityReserved" | "quality">[],
): QualityAllocationBreakdownEntry[] {
  const byQuality = new Map<number, number>();
  for (const allocation of allocations) {
    const quantity = Math.max(0, allocation.quantityReserved);
    const quality = clampMaterialQuality(allocation.quality);
    if (quantity <= 0 || quality === undefined) continue;
    byQuality.set(quality, (byQuality.get(quality) ?? 0) + quantity);
  }
  return [...byQuality.entries()]
    .map(([quality, quantity]) => ({ quality, quantity }))
    .sort((a, b) => a.quality - b.quality);
}

export function getWeightedEffectiveQuality(
  allocations: Pick<ReservedMaterialAllocation, "quantityReserved" | "quality">[],
): number | undefined {
  let weighted = 0;
  let total = 0;
  for (const allocation of allocations) {
    const amount = Math.max(0, allocation.quantityReserved);
    const quality = clampMaterialQuality(allocation.quality);
    if (amount <= 0 || quality === undefined) continue;
    weighted += amount * quality;
    total += amount;
  }
  return total > 0 ? weighted / total : undefined;
}

export function getRemainingRequiredAmount(requiredAmount: number, allocatedAmount: number): number {
  return Math.max(0, requiredAmount - Math.max(0, allocatedAmount));
}

export function allocationMatchesRequirement(
  allocation: ReservedMaterialAllocation,
  materialId: string,
  identity?: BuildQueueRequirementIdentity,
): boolean {
  if (allocation.materialId !== materialId) return false;
  if (!identity) return true;
  if (identity.requirementId !== undefined && allocation.requirementId !== identity.requirementId) return false;
  if (identity.unitType !== undefined && allocation.unitType !== identity.unitType) return false;
  return true;
}

export function validateReservedAllocations(
  allocations: ReservedMaterialAllocation[],
  inventoryEntries: InventoryEntry[],
): ReservedAllocationValidation[] {
  return allocations.map((allocation) => {
    const inventoryEntry = inventoryEntries.find((entry) => entry.id === allocation.inventoryEntryId);
    if (allocation.quantityReserved <= 0) {
      return { allocation, inventoryEntry, isStale: true, staleReason: "nonPositiveQuantity" };
    }
    if (!inventoryEntry) {
      return { allocation, inventoryEntry, isStale: true, staleReason: "missingStack" };
    }
    if (allocation.materialId !== inventoryEntry.materialId) {
      return { allocation, inventoryEntry, isStale: true, staleReason: "mismatchedMaterial" };
    }
    if (allocation.quantityReserved > inventoryEntry.quantity) {
      return { allocation, inventoryEntry, isStale: true, staleReason: "exceedsStackQuantity" };
    }
    return { allocation, inventoryEntry, isStale: false };
  });
}

export function isInventoryEntrySupportedForBuildQueuePhysicalAvailability(
  inventoryEntry: Pick<InventoryEntry, "itemKind" | "materialType">,
): boolean {
  return inventoryEntry.itemKind !== "ore" && inventoryEntry.materialType !== "ore";
}

/**
 * Canonical physical-lot reservation total.
 *
 * Every positive allocation on an active queue item consumes physical lot
 * capacity. `allowLowerQualityOverride` is quality-policy metadata and does
 * not change that physical reservation.
 */
export function getReservedAmountForInventoryLot(
  buildQueue: BuildQueueItem[],
  inventoryEntryId: string,
  options?: {
    excludeBuildQueueItemId?: string;
    excludeAllocationIds?: Set<string>;
  },
): number {
  return buildQueue.reduce((sum, item) => {
    if (item.status === "complete" || item.id === options?.excludeBuildQueueItemId) return sum;
    return sum + (item.reservedAllocations ?? [])
      .filter((allocation) =>
        allocation.inventoryEntryId === inventoryEntryId &&
        allocation.quantityReserved > 0 &&
        !options?.excludeAllocationIds?.has(allocation.id)
      )
      .reduce((allocationSum, allocation) => allocationSum + Math.max(0, allocation.quantityReserved), 0);
  }, 0);
}

export function getLotAvailableAmountAfterReservations(
  inventoryEntry: Pick<InventoryEntry, "id" | "quantity">,
  buildQueue: BuildQueueItem[],
  currentBuildQueueItemId?: string,
  currentLineAllocations: Pick<ReservedMaterialAllocation, "id" | "inventoryEntryId" | "quantityReserved">[] = [],
): number {
  // With a current item ID, availability is the capacity that item may use:
  // its persisted allocations are replaced by the supplied candidate set.
  const currentLineAllocationIds = new Set(currentLineAllocations.map((allocation) => allocation.id));
  const reservedByOthers = getReservedAmountForInventoryLot(buildQueue, inventoryEntry.id, {
    excludeBuildQueueItemId: currentBuildQueueItemId,
    excludeAllocationIds: currentLineAllocationIds,
  });
  const currentItemIsComplete = currentBuildQueueItemId !== undefined
    && buildQueue.some((item) => item.id === currentBuildQueueItemId && item.status === "complete");
  const reservedByCurrentLine = currentItemIsComplete
    ? 0
    : currentLineAllocations
        .filter((allocation) => allocation.inventoryEntryId === inventoryEntry.id)
        .reduce((sum, allocation) => sum + Math.max(0, allocation.quantityReserved), 0);
  return Math.max(0, inventoryEntry.quantity - reservedByOthers - reservedByCurrentLine);
}

export function getHighestAvailableInventoryQuality(
  stacks: Array<Pick<InventoryEntry, "id" | "quantity" | "quality">>,
  buildQueue: BuildQueueItem[],
  currentBuildQueueItemId: string,
  currentLineAllocations: Pick<ReservedMaterialAllocation, "id" | "inventoryEntryId" | "quantityReserved">[] = [],
): number | undefined {
  let highest: number | undefined;
  const seen = new Set<string>();
  for (const stack of stacks) {
    if (seen.has(stack.id)) continue;
    seen.add(stack.id);
    if (getLotAvailableAmountAfterReservations(stack, buildQueue, currentBuildQueueItemId, currentLineAllocations) <= 0) {
      continue;
    }
    const quality = clampMaterialQuality(stack.quality);
    if (quality === undefined) continue;
    if (highest === undefined || quality > highest) highest = quality;
  }
  return highest;
}

export function getRequirementLineKey(
  item: Pick<BuildQueueItem, "id" | "recipeId" | "blueprint_id">,
  input: RecipeInputTemplate,
  inputIndex: number,
): string {
  if (input.requirementId) return input.requirementId;
  return [
    item.id,
    item.recipeId,
    item.blueprint_id ?? "no-blueprint",
    input.materialKey ?? input.materialId,
    inputIndex,
    input.modifierName ?? input.modifierType ?? "material",
    input.selectedQuality ?? "any",
  ].join(":");
}

export function getModifierProjectionFromQuality(
  input: Pick<RecipeInputTemplate, "qualityModifiers" | "modifierName" | "modifierType" | "modifierValue">,
  quality: number | undefined,
): ModifierAtQuality | undefined {
  if (quality !== undefined && input.qualityModifiers?.length) {
    return getModifiersAtQuality(input.qualityModifiers, quality)[0];
  }
  if (input.modifierName && input.modifierValue !== undefined) {
    return {
      slot: "",
      property: input.modifierName,
      value: input.modifierValue,
      modifierMode: input.modifierType,
    };
  }
  return undefined;
}

export function getQualityProjectionStatus(
  allocatedAmount: number,
  requiredAmount: number,
  effectiveQuality: number | undefined,
  targetQuality: number | undefined,
): "unreserved" | "pending" | "below" | "meets" | "above" {
  if (allocatedAmount <= 0 || effectiveQuality === undefined) return "unreserved";
  if (allocatedAmount < requiredAmount) return "pending";
  if (targetQuality === undefined) return "meets";
  if (effectiveQuality < targetQuality) return "below";
  if (effectiveQuality > targetQuality) return "above";
  return "meets";
}
