import type { BuildQueueItem, InventoryEntry } from "../../types/logistics";
import type { RecipeInputTemplate } from "../../data/logistics/seed";
import { getBuildQueueItemInputs } from "./inventory";

function getOwnedQuantityForRequirement(materialId: string, inventoryEntries: InventoryEntry[]) {
  return inventoryEntries
    .filter((entry) => (entry.materialId ?? entry.catalogItemId) === materialId && entry.quantity > 0)
    .reduce((sum, entry) => sum + entry.quantity, 0);
}

export function getBuildQueueItemProgress(
  item: BuildQueueItem,
  inventoryEntries: InventoryEntry[],
  recipeInputsByRecipeId: Record<string, RecipeInputTemplate[]>,
): number | null {
  const inputs = getBuildQueueItemInputs(item, recipeInputsByRecipeId);
  const required = inputs.reduce((sum, input) => sum + input.quantity * item.quantity, 0);
  if (required <= 0) return null;
  const covered = inputs.reduce((sum, input) => {
    const materialId = input.materialId ?? input.materialKey;
    if (!materialId) return sum;
    const lineRequired = input.quantity * item.quantity;
    return sum + Math.min(lineRequired, getOwnedQuantityForRequirement(materialId, inventoryEntries));
  }, 0);
  return Math.max(0, Math.min(100, Math.round((covered / required) * 100)));
}
