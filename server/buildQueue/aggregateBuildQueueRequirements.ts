import { createApiMaterialResolver } from "../shared/materialResolver";
import { formatRequirementQuantity } from "../shared/quantityFormatter";
import { addWarning } from "../shared/warnings";
import type {
  BuildQueueRequirementsRequest,
  BuildQueueWarning,
  NormalizedRequirement,
} from "./buildQueue.types";

function contextKey(input: {
  materialId: string;
  selectedQuality?: number;
  modifierName?: string;
  modifierType?: string;
  modifierValue?: number;
  unitType?: string;
}) {
  return [
    input.materialId,
    input.selectedQuality ?? "",
    input.modifierName ?? "",
    input.modifierType ?? "",
    input.modifierValue ?? "",
    input.unitType ?? "",
  ].join("|");
}

export async function aggregateBuildQueueRequirements(
  request: BuildQueueRequirementsRequest,
  warnings: BuildQueueWarning[],
): Promise<NormalizedRequirement[]> {
  const resolve = await createApiMaterialResolver(warnings);
  const byRequirement = new Map<string, NormalizedRequirement>();
  const inventoryByMaterial = new Map<string, number>();
  const reservedByMaterial = new Map<string, number>();

  for (const entry of request.inventoryEntries ?? []) {
    if (!entry.materialId) continue;
    inventoryByMaterial.set(entry.materialId, (inventoryByMaterial.get(entry.materialId) ?? 0) + entry.quantity);
  }

  for (const item of request.buildQueue ?? []) {
    if (item.status === "complete") continue;
    for (const allocation of item.reservedAllocations ?? []) {
      reservedByMaterial.set(
        allocation.materialId,
        (reservedByMaterial.get(allocation.materialId) ?? 0) + allocation.quantityReserved,
      );
    }
  }

  for (const item of request.buildQueue ?? []) {
    if (item.status === "complete") continue;
    const inputs = item.materialRequirements ?? request.recipeInputTemplates?.[item.recipeId] ?? [];
    for (const [inputIndex, input] of inputs.entries()) {
      const resolved = resolve(input);
      const materialId = resolved?.materialId ?? input.materialKey ?? input.materialId ?? input.materialName ?? input.displayName;
      const materialName = resolved?.materialName ?? input.displayName ?? input.materialName ?? input.rawName ?? materialId;

      if (!resolved) {
        addWarning(warnings, {
          code: "build_queue_material_unresolved",
          message: `Could not resolve build queue material ${materialName ?? "unknown material"}.`,
          materialId,
          materialName,
        });
      }
      if (!materialId || !materialName) continue;

      const selectedQuality = input.selectedQuality;
      const unitType = input.unitType ?? resolved?.unitType;
      const originalRequired = input.quantity * item.quantity;
      const key = contextKey({
        materialId,
        selectedQuality,
        modifierName: input.modifierName,
        modifierType: input.modifierType,
        modifierValue: input.modifierValue,
        unitType,
      });
      const slot = input.displayName ?? input.materialName ?? materialName;
      const usedBy = {
        requirementId: input.requirementId ?? `${item.id}:${inputIndex}:${materialId}:${input.modifierName ?? input.modifierType ?? "material"}`,
        blueprintGuid: item.itemId ?? item.recipeId,
        displayName: item.itemName ?? item.recipeId,
        componentType: "",
        size: "",
        quantity: item.quantity,
        slot,
        materialQuantity: originalRequired,
        selectedQuality,
        unitType,
      };

      const existing = byRequirement.get(key);
      if (existing) {
        existing.originalRequiredQuantity += originalRequired;
        existing.usedBy.push(usedBy);
        if (!existing.slots.includes(slot)) existing.slots.push(slot);
      } else {
        byRequirement.set(key, {
          requirementKey: key,
          materialId,
          materialName,
          requiredQuantity: originalRequired,
          originalRequiredQuantity: originalRequired,
          selectedQuality,
          unitType,
          displayQuantity: formatRequirementQuantity(originalRequired, unitType),
          modifierName: input.modifierName,
          modifierType: input.modifierType,
          modifierValue: input.modifierValue,
          slots: [slot],
          usedBy: [usedBy],
        });
      }
    }
  }

  const remainingByMaterial = new Map<string, number>();
  for (const requirement of byRequirement.values()) {
    if (!remainingByMaterial.has(requirement.materialId)) {
      const totalForMaterial = Array.from(byRequirement.values())
        .filter((entry) => entry.materialId === requirement.materialId)
        .reduce((sum, entry) => sum + entry.originalRequiredQuantity, 0);
      remainingByMaterial.set(
        requirement.materialId,
        Math.max(0, totalForMaterial - (reservedByMaterial.get(requirement.materialId) ?? 0) - (inventoryByMaterial.get(requirement.materialId) ?? 0)),
      );
    }
  }

  for (const materialId of new Set(Array.from(byRequirement.values()).map((entry) => entry.materialId))) {
    let remaining = remainingByMaterial.get(materialId) ?? 0;
    for (const requirement of Array.from(byRequirement.values()).filter((entry) => entry.materialId === materialId)) {
      const quantity = Math.min(requirement.originalRequiredQuantity, remaining);
      requirement.requiredQuantity = quantity;
      requirement.displayQuantity = formatRequirementQuantity(quantity, requirement.unitType);
      remaining -= quantity;
    }
  }

  return Array.from(byRequirement.values()).filter((requirement) => requirement.requiredQuantity > 0);
}
