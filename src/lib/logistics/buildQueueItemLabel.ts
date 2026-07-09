import type { ComponentRecipe } from "@/components/industry/crafting/utils/craftingTypes";
import { getCardTypeLabel } from "@/components/industry/crafting/utils/componentCardSchema";

export function formatBuildQueueItemTypeLabel(recipe: ComponentRecipe): string {
  const typeLabel = getCardTypeLabel(recipe);
  const size = recipe.size;
  if (size) return `S${size} ${typeLabel}`;
  return typeLabel;
}
