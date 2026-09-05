import type { RecipeInputTemplate } from "../../data/logistics/seed";
import { getBuildQueueItemInputs } from "../../lib/logistics/inventory";
import { createMaterialResolver } from "../../lib/logistics/materialResolver";
import type { BuildQueueItem, MaterialTemplate } from "../../types/logistics";
import { canonicalMiningMaterial } from "./materialIdentity";
import type { RequiredMaterial } from "./types";

/**
 * Projects active Build Queue intent into Mining demand. This intentionally
 * does not inspect inventory or reservations: mining defaults to the gross
 * requirement the queue still intends to source.
 */
export function projectQueueMiningDemand(input: {
  buildQueue: BuildQueueItem[];
  materials: MaterialTemplate[];
  recipeInputsByRecipeId: Record<string, RecipeInputTemplate[]>;
  focusItemId?: string;
}): RequiredMaterial[] {
  const resolveMaterial = createMaterialResolver(input.materials);
  const demandByRequirementPolicy = new Map<string, RequiredMaterial>();

  for (const item of input.buildQueue) {
    if (item.status === "complete") continue;
    if (input.focusItemId && item.id !== input.focusItemId) continue;

    for (const requirement of getBuildQueueItemInputs(item, input.recipeInputsByRecipeId)) {
      const quantity = Math.max(0, requirement.quantity * item.quantity);
      if (quantity <= 0) continue;

      const resolved = resolveMaterial(requirement);
      const canonical = canonicalMiningMaterial({
        materialKey: resolved?.materialKey ?? requirement.materialKey,
        materialId: resolved?.materialId ?? requirement.materialId,
        displayName: resolved?.displayName ?? requirement.displayName ?? requirement.materialName,
        materialName: requirement.materialName ?? requirement.displayName ?? resolved?.displayName,
      });
      if (!canonical.key) continue;

      const selectedQuality = requirement.selectedQuality;
      const unitType = requirement.unitType ?? resolved?.unitType;
      // A quality threshold and unit are part of the requirement policy. Do
      // not merge separate policies for the same material into one demand.
      const policyKey = [canonical.key, selectedQuality ?? "any-quality", unitType ?? "unit"].join(":");
      const existing = demandByRequirementPolicy.get(policyKey);

      if (existing) {
        existing.quantity = (existing.quantity ?? existing.requiredQuantity) + quantity;
        existing.originalRequiredQuantity = (existing.originalRequiredQuantity ?? existing.requiredQuantity) + quantity;
        existing.requiredQuantity += quantity;
        continue;
      }

      demandByRequirementPolicy.set(policyKey, {
        materialKey: canonical.key,
        materialId: canonical.key,
        materialName: canonical.label,
        displayName: canonical.label,
        quantity,
        originalRequiredQuantity: quantity,
        requiredQuantity: quantity,
        selectedQuality,
        unitType,
        usedBy: [],
        slots: [],
      });
    }
  }

  return [...demandByRequirementPolicy.values()].sort((left, right) =>
    left.materialName.localeCompare(right.materialName)
    || (left.selectedQuality ?? -1) - (right.selectedQuality ?? -1)
    || (left.unitType ?? "").localeCompare(right.unitType ?? ""),
  );
}
