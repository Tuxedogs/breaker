import type { BuildQueueItem, InventoryEntry } from '../../types/logistics';
import type { RecipeInputTemplate } from '../../data/logistics/seed';
import { getBuildQueueItemInputs } from './inventory';

export interface Shortage {
  materialKey: string;
  materialId: string;
  selectedQuality?: number;
  allowLowerQuality?: boolean;
  unitType?: RecipeInputTemplate["unitType"];
  needed: number;
  have: number;
  shortfall: number;
}

function getShortageKey(
  materialKey: string,
  _selectedQuality?: number,
  _allowLowerQuality?: boolean,
  unitType?: RecipeInputTemplate["unitType"],
): string {
  return `${materialKey}:amount-only:${unitType ?? 'unit'}`;
}

function isEligible(entry: InventoryEntry, materialId: string, _selectedQuality?: number, _allowLowerQuality = false): boolean {
  if (entry.materialId !== materialId) return false;
  if (entry.quantity <= 0) return false;
  return true;
}

export function computeShortages(
  inventory: InventoryEntry[],
  queue: BuildQueueItem[],
  recipeInputsByRecipeId: Record<string, RecipeInputTemplate[]>,
): Shortage[] {
  const neededByMaterial: Record<string, { materialId: string; selectedQuality?: number; allowLowerQuality?: boolean; unitType?: RecipeInputTemplate["unitType"]; needed: number }> = {};
  for (const item of queue) {
    if (item.status === 'complete') continue;
    const inputs = getBuildQueueItemInputs(item, recipeInputsByRecipeId);
    for (const input of inputs) {
      const materialKey = input.materialKey ?? input.materialId;
      const key = getShortageKey(materialKey, input.selectedQuality, false, input.unitType);
      const current = neededByMaterial[key] ?? {
        materialId: materialKey,
        selectedQuality: input.selectedQuality,
        allowLowerQuality: true,
        unitType: input.unitType,
        needed: 0,
      };
      neededByMaterial[key] = {
        ...current,
        needed: current.needed + input.quantity * item.quantity,
      };
    }
  }

  return Object.entries(neededByMaterial)
    .map(([materialKey, requirement]) => {
      const have = inventory
        .filter((entry) => isEligible(entry, requirement.materialId, requirement.selectedQuality, requirement.allowLowerQuality))
        .reduce((sum, entry) => sum + entry.quantity, 0);
      return {
        materialKey,
        materialId: requirement.materialId,
        selectedQuality: requirement.selectedQuality,
        unitType: requirement.unitType,
        needed: requirement.needed,
        have,
        shortfall: Math.max(0, requirement.needed - have),
      };
    })
    .filter((s) => s.shortfall > 0);
}
