import type { BuildQueueItem } from "../../types/logistics";
import type { RecipeInputTemplate } from "../../data/logistics/seed";
import type { ComponentRecipe } from "../../components/industry/crafting/utils/craftingTypes";
import { getMaterialQualityKey } from "../../components/industry/crafting/utils/materialQuality";
import {
  DEFAULT_BAND_INDEX,
  resolveQualityBandNumber,
} from "../../components/industry/crafting/utils/qualityBands";
import {
  deriveFinalProductQuality,
  type FinalProductQuality,
} from "../../components/industry/crafting/utils/recipeQuality";
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

export type BuildQueueProductQualitySummary = {
  target: FinalProductQuality | null;
  predicted: FinalProductQuality | null;
};

/**
 * Projects Build Queue material targets and completed allocations through the
 * same final-product band calculation used by Crafting Detail.
 */
export function buildBuildQueueProductQualitySummary(
  item: BuildQueueItem,
  recipe: ComponentRecipe | null | undefined,
  inputs: RecipeInputTemplate[],
): BuildQueueProductQualitySummary {
  if (!recipe || recipe.materials.length === 0 || inputs.length === 0) {
    return { target: null, predicted: null };
  }

  const targetBandByKey = new Map<string, number>();
  const predictedBandByKey = new Map<string, number>();
  let allocationComplete = true;

  for (const [inputIndex, input] of inputs.entries()) {
    const material = recipe.materials[inputIndex];
    if (!material) continue;

    const qualityKey = getMaterialQualityKey(recipe, material, inputIndex);
    const targetBand = resolveQualityBandNumber(
      input.selectedQuality,
      input.qualityBand,
      input.qualityBands,
    );
    if (targetBand !== null) targetBandByKey.set(qualityKey, targetBand - 1);

    const requirementId = getRequirementLineKey(item, input, inputIndex);
    const allocations = (item.reservedAllocations ?? []).filter(
      (allocation) => allocation.requirementId === requirementId,
    );
    const requiredAmount = input.quantity * item.quantity;
    if (getAllocationTotal(allocations) + 0.0001 < requiredAmount) {
      allocationComplete = false;
      continue;
    }

    const allocatedQuality = getWeightedEffectiveQuality(allocations);
    const allocatedBand = resolveQualityBandNumber(
      allocatedQuality,
      undefined,
      input.qualityBands,
    );
    if (allocatedBand === null) {
      allocationComplete = false;
      continue;
    }
    predictedBandByKey.set(qualityKey, allocatedBand - 1);
  }

  const target = deriveFinalProductQuality(
    recipe,
    (key) => targetBandByKey.get(key) ?? DEFAULT_BAND_INDEX,
  );
  const predicted = allocationComplete
    ? deriveFinalProductQuality(
      recipe,
      (key) => predictedBandByKey.get(key) ?? DEFAULT_BAND_INDEX,
    )
    : null;

  return { target, predicted };
}
