import type { BuildQueueItem } from "@/types/logistics";
import type { RecipeInputTemplate } from "@/data/logistics/seed";
import type { ComponentRecipe } from "@/components/industry/crafting/utils/craftingTypes";
import { getMaterialQualityKey } from "@/components/industry/crafting/utils/materialQuality";
import {
  getAllocationTotal,
  getRequirementLineKey,
  getWeightedEffectiveQuality,
} from "@/lib/logistics/buildQueueReservations";

export function buildAllocatedMaterialQualities(
  item: BuildQueueItem,
  recipe: ComponentRecipe,
  inputs: RecipeInputTemplate[],
): Record<string, number> {
  const qualities: Record<string, number> = {};

  for (const [inputIndex, input] of inputs.entries()) {
    const requirementId = getRequirementLineKey(item, input, inputIndex);
    const ownAllocations = (item.reservedAllocations ?? []).filter(
      (allocation) => allocation.requirementId === requirementId,
    );
    if (getAllocationTotal(ownAllocations) <= 0) continue;

    const effectiveQuality = getWeightedEffectiveQuality(ownAllocations);
    if (effectiveQuality === undefined) continue;

    const mat = recipe.materials[inputIndex];
    if (!mat) continue;

    qualities[getMaterialQualityKey(recipe, mat, inputIndex)] = effectiveQuality;
  }

  return qualities;
}
