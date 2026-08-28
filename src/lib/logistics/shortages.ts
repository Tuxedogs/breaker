import type { BuildQueueItem, InventoryEntry, ReservedMaterialAllocation } from '../../types/logistics';
import type { RecipeInputTemplate } from '../../data/logistics/seed';
import { getBuildQueueItemInputs } from './inventory';
import {
  allocationMatchesRequirement,
  clampMaterialQuality,
  getLotAvailableAmountAfterReservations,
  getRequirementLineKey,
  isInventoryEntrySupportedForBuildQueuePhysicalAvailability,
  validateReservedAllocations,
} from './buildQueueReservations';

export interface Shortage {
  key: string;
  materialKey: string;
  materialId: string;
  selectedQuality?: number;
  allowLowerQuality?: boolean;
  unitType?: RecipeInputTemplate["unitType"];
  needed: number;
  allocated: number;
  available: number;
  have: number;
  shortfall: number;
}

type ShortageAccumulator = Omit<Shortage, 'have' | 'shortfall'>;

function getShortageKey(
  materialKey: string,
  selectedQuality: number | undefined,
  allowLowerQuality: boolean,
  unitType?: RecipeInputTemplate["unitType"],
): string {
  return [materialKey, allowLowerQuality ? 'lower-ok' : selectedQuality ?? 'any-quality', unitType ?? 'unit'].join(':');
}

function inventoryEntryIsEligible(
  entry: InventoryEntry,
  materialId: string,
  selectedQuality: number | undefined,
  allowLowerQuality: boolean,
): boolean {
  if (entry.materialId !== materialId || entry.quantity <= 0) return false;
  if (!isInventoryEntrySupportedForBuildQueuePhysicalAvailability(entry)) return false;
  if (allowLowerQuality || selectedQuality === undefined) return true;
  const quality = clampMaterialQuality(entry.quality);
  return quality !== undefined && quality >= selectedQuality;
}

function allocationSatisfiesRequirement(
  allocation: ReservedMaterialAllocation,
  selectedQuality: number | undefined,
  allowLowerQuality: boolean,
): boolean {
  if (allowLowerQuality || allocation.allowLowerQualityOverride || selectedQuality === undefined) return true;
  const quality = clampMaterialQuality(allocation.quality);
  return quality !== undefined && quality >= selectedQuality;
}

/**
 * Reports physical reservation/availability shortfall in queue order.
 *
 * Existing valid allocations cover their own requirement. Remaining physical
 * lot capacity is then consumed once across competing queue instances, with
 * each requirement's quality policy applied. Raw/refined conversion is not
 * part of this metric; that remains a separate planning ledger.
 */
export function computePhysicalAvailabilityShortages(
  inventory: InventoryEntry[],
  queue: BuildQueueItem[],
  recipeInputsByRecipeId: Record<string, RecipeInputTemplate[]>,
): Shortage[] {
  const remainingByInventoryEntry = new Map(
    inventory.map((entry) => [entry.id, getLotAvailableAmountAfterReservations(entry, queue)]),
  );
  const shortageByRequirementPolicy = new Map<string, ShortageAccumulator>();

  for (const item of queue) {
    if (item.status === 'complete') continue;
    const inputs = getBuildQueueItemInputs(item, recipeInputsByRecipeId);
    for (const [inputIndex, input] of inputs.entries()) {
      const materialId = input.materialKey ?? input.materialId;
      const required = Math.max(0, input.quantity * item.quantity);
      if (!materialId || required <= 0) continue;

      const requirementId = getRequirementLineKey(item, input, inputIndex);
      const allowLowerQuality = item.allowLowerQuality === true;
      const matchingAllocations = (item.reservedAllocations ?? []).filter((allocation) =>
        allocationMatchesRequirement(allocation, materialId, { requirementId, unitType: input.unitType }),
      );
      const allocated = validateReservedAllocations(matchingAllocations, inventory)
        .filter((validation) =>
          !validation.isStale &&
          validation.inventoryEntry !== undefined &&
          isInventoryEntrySupportedForBuildQueuePhysicalAvailability(validation.inventoryEntry) &&
          allocationSatisfiesRequirement(validation.allocation, input.selectedQuality, allowLowerQuality),
        )
        .reduce((sum, validation) => sum + Math.max(0, validation.allocation.quantityReserved), 0);
      let remainingNeed = Math.max(0, required - Math.min(required, allocated));
      let available = 0;

      for (const entry of inventory) {
        if (remainingNeed <= 0) break;
        if (!inventoryEntryIsEligible(entry, materialId, input.selectedQuality, allowLowerQuality)) continue;
        const remainingInLot = remainingByInventoryEntry.get(entry.id) ?? 0;
        if (remainingInLot <= 0) continue;
        const consumed = Math.min(remainingNeed, remainingInLot);
        available += consumed;
        remainingNeed -= consumed;
        remainingByInventoryEntry.set(entry.id, remainingInLot - consumed);
      }

      const key = getShortageKey(materialId, input.selectedQuality, allowLowerQuality, input.unitType);
      const current = shortageByRequirementPolicy.get(key) ?? {
        key,
        materialKey: materialId,
        materialId,
        selectedQuality: input.selectedQuality,
        allowLowerQuality,
        unitType: input.unitType,
        needed: 0,
        allocated: 0,
        available: 0,
      };
      current.needed += required;
      current.allocated += Math.min(required, allocated);
      current.available += available;
      shortageByRequirementPolicy.set(key, current);
    }
  }

  return [...shortageByRequirementPolicy.values()]
    .map((shortage) => {
      const have = shortage.allocated + shortage.available;
      return { ...shortage, have, shortfall: Math.max(0, shortage.needed - have) };
    })
    .filter((shortage) => shortage.shortfall > 0);
}
