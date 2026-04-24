import type { InventoryEntry, BuildQueueItem, CraftingRecipe } from '../../data/models';

export interface Shortage {
  materialId: string;
  needed: number;
  have: number;
  shortfall: number;
}

export function computeShortages(
  inventory: InventoryEntry[],
  queue: BuildQueueItem[],
  recipes: CraftingRecipe[],
): Shortage[] {
  const haveByMaterial: Record<string, number> = {};
  for (const entry of inventory) {
    haveByMaterial[entry.materialId] = (haveByMaterial[entry.materialId] ?? 0) + entry.quantity;
  }

  const neededByMaterial: Record<string, number> = {};
  for (const item of queue) {
    if (item.status === 'cancelled' || item.status === 'complete') continue;
    const recipe = recipes.find((r) => r.itemName === item.itemName);
    if (!recipe) continue;
    for (const input of recipe.inputs) {
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
