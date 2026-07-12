import type { BuildQueueItem } from "../../types/logistics";
import type { RecipeInputTemplate } from "../../data/logistics/seed";
import type { ComponentRecipe } from "../../components/industry/crafting/utils/craftingTypes";
import { getMaterialQualityKey } from "../../components/industry/crafting/utils/materialQuality";
import {
  getAllocationTotal,
  getRequirementLineKey,
  getWeightedEffectiveQuality,
} from "./buildQueueReservations";

function isModifiableMaterial(
  recipe: ComponentRecipe,
  inputIndex: number,
): boolean {
  const mat = recipe.materials[inputIndex];
  return (mat?.qualityModifiers?.length ?? 0) > 0;
}

export function buildAllocatedMaterialQualities(
  item: BuildQueueItem,
  recipe: ComponentRecipe,
  inputs: RecipeInputTemplate[],
): Record<string, number> {
  const qualities: Record<string, number> = {};

  for (const [inputIndex, input] of inputs.entries()) {
    if (!isModifiableMaterial(recipe, inputIndex)) continue;

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

export function buildTargetMaterialQualities(
  _item: BuildQueueItem,
  recipe: ComponentRecipe,
  inputs: RecipeInputTemplate[],
): Record<string, number> {
  const qualities: Record<string, number> = {};

  for (const [inputIndex, input] of inputs.entries()) {
    if (input.selectedQuality === undefined) continue;
    if (!isModifiableMaterial(recipe, inputIndex)) continue;

    const mat = recipe.materials[inputIndex];
    if (!mat) continue;

    qualities[getMaterialQualityKey(recipe, mat, inputIndex)] = input.selectedQuality;
  }

  return qualities;
}

export function hasConfiguredTargetQualities(
  recipe: ComponentRecipe,
  inputs: RecipeInputTemplate[],
): boolean {
  return inputs.some((input, inputIndex) => (
    isModifiableMaterial(recipe, inputIndex) && input.selectedQuality !== undefined
  ));
}

export function hasMaterialAllocations(
  item: BuildQueueItem,
  recipe: ComponentRecipe,
  inputs: RecipeInputTemplate[],
): boolean {
  return inputs.some((input, inputIndex) => {
    if (!isModifiableMaterial(recipe, inputIndex)) return false;
    const requirementId = getRequirementLineKey(item, input, inputIndex);
    const ownAllocations = (item.reservedAllocations ?? []).filter(
      (allocation) => allocation.requirementId === requirementId,
    );
    return getAllocationTotal(ownAllocations) > 0;
  });
}
