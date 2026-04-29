import type { BuildQueueItem, InventoryEntry } from '../../types/logistics';
import type { RecipeInputTemplate } from '../../data/logistics/seed';

export interface Shortage {
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
    haveByMaterial[entry.materialId] = (haveByMaterial[entry.materialId] ?? 0) + entry.quantity;
  }

  const neededByMaterial: Record<string, number> = {};
  for (const item of queue) {
    if (item.status === 'complete') continue;
    const inputs = recipeInputsByRecipeId[item.recipeId] ?? [];
    for (const input of inputs) {
      neededByMaterial[input.materialId] =
        (neededByMaterial[input.materialId] ?? 0) + input.quantity * item.quantity;
    }
  }

  return Object.entries(neededByMaterial)
    .map(([materialId, needed]) => ({
      materialId,
      needed,
      have: haveByMaterial[materialId] ?? 0,
      shortfall: Math.max(0, needed - (haveByMaterial[materialId] ?? 0)),
    }))
    .filter((s) => s.shortfall > 0);
}
