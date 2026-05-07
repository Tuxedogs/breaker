import type { BuildQueueItem, InventoryEntry } from '../../types/logistics';
import type { RecipeInputTemplate } from '../../data/logistics/seed';
import { getBuildQueueItemInputs } from './inventory';

export interface Shortage {
  materialKey: string;
  materialId: string;
  needed: number;
  have: number;
  shortfall: number;
}

export function computeShortages(
  inventory: InventoryEntry[],
  queue: BuildQueueItem[],
  recipeInputsByRecipeId: Record<string, RecipeInputTemplate[]>,
): Shortage[] {
  const haveByMaterial: Record<string, number> = {};
  for (const entry of inventory) {
    if (!entry.materialId) continue;
    const materialKey = entry.materialId;
    haveByMaterial[materialKey] = (haveByMaterial[materialKey] ?? 0) + entry.quantity;
  }

  const neededByMaterial: Record<string, number> = {};
  for (const item of queue) {
    if (item.status === 'complete') continue;
    const inputs = getBuildQueueItemInputs(item, recipeInputsByRecipeId);
    for (const input of inputs) {
      const materialKey = input.materialKey ?? input.materialId;
      neededByMaterial[materialKey] =
        (neededByMaterial[materialKey] ?? 0) + input.quantity * item.quantity;
    }
  }

  return Object.entries(neededByMaterial)
    .map(([materialKey, needed]) => ({
      materialKey,
      materialId: materialKey,
      needed,
      have: haveByMaterial[materialKey] ?? 0,
      shortfall: Math.max(0, needed - (haveByMaterial[materialKey] ?? 0)),
    }))
    .filter((s) => s.shortfall > 0);
}
