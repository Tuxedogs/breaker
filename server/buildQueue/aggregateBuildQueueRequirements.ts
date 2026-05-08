import { createApiMaterialResolver } from "../shared/materialResolver";
import { formatRequirementQuantity } from "../shared/quantityFormatter";
import { addWarning } from "../shared/warnings";
import type {
  BuildQueueRequirementsRequest,
  BuildQueueWarning,
  NormalizedRequirement,
} from "./buildQueue.types";

function contextKey(input: {
  itemId: string;
  requirementId: string;
  materialId: string;
  selectedQuality?: number;
  slot?: string;
  modifierName?: string;
  modifierType?: string;
  modifierValue?: number;
  unitType?: string;
}) {
  return [
    input.itemId,
    input.requirementId,
    input.slot ?? "",
    input.materialId,
    input.selectedQuality ?? "",
    input.modifierName ?? "",
    input.modifierType ?? "",
    input.modifierValue ?? "",
    input.unitType ?? "",
  ].join("|");
}

function requirementAvailabilityKey(input: { materialId: string; selectedQuality?: number; allowLowerQuality?: boolean; unitType?: string }) {
  return [
    input.materialId,
    input.allowLowerQuality ? "lower-ok" : input.selectedQuality ?? "any",
    input.unitType ?? "",
  ].join("|");
}

function inventoryEntryIsEligible(
  entry: { materialId?: string; quantity: number; quality?: number },
  materialId: string,
  selectedQuality?: number,
  allowLowerQuality = false,
) {
  if (entry.materialId !== materialId) return false;
  if (entry.quantity <= 0) return false;
  if (allowLowerQuality) return true;
  if (selectedQuality === undefined) return true;
  return entry.quality !== undefined && entry.quality >= selectedQuality;
}

export async function aggregateBuildQueueRequirements(
  request: BuildQueueRequirementsRequest,
  warnings: BuildQueueWarning[],
): Promise<NormalizedRequirement[]> {
  const resolve = await createApiMaterialResolver(warnings);
  const byRequirement = new Map<string, NormalizedRequirement>();
  const reservedByRequirement = new Map<string, number>();

  for (const item of request.buildQueue ?? []) {
    if (item.status === "complete") continue;
    for (const allocation of item.reservedAllocations ?? []) {
      if (allocation.allowLowerQualityOverride) continue;
      const key = requirementAvailabilityKey({
        materialId: allocation.materialId,
        selectedQuality: allocation.selectedQuality,
        allowLowerQuality: false,
        unitType: allocation.unitType,
      });
      reservedByRequirement.set(key, (reservedByRequirement.get(key) ?? 0) + allocation.quantityReserved);
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
      const allowLowerQuality = false;
      const unitType = input.unitType ?? resolved?.unitType;
      const originalRequired = input.quantity * item.quantity;
      const slot = input.displayName ?? input.materialName ?? materialName;
      const requirementId = input.requirementId ?? `${item.id}:${inputIndex}:${materialId}:${slot}:${input.modifierName ?? input.modifierType ?? "material"}`;
      const key = contextKey({
        itemId: item.id,
        requirementId,
        materialId,
        selectedQuality,
        slot,
        modifierName: input.modifierName,
        modifierType: input.modifierType,
        modifierValue: input.modifierValue,
        unitType,
      });
      const usedBy = {
        requirementId,
        blueprintGuid: item.itemId ?? item.recipeId,
        displayName: item.itemName ?? item.recipeId,
        componentType: "",
        size: "",
        quantity: item.quantity,
        slot,
        materialQuantity: originalRequired,
        selectedQuality,
        allowLowerQuality,
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

  const remainingByRequirement = new Map<string, number>();
  for (const requirement of byRequirement.values()) {
    const allowLowerQuality = requirement.usedBy.some((usage) => usage.allowLowerQuality === true);
    const remainingKey = requirementAvailabilityKey({ ...requirement, allowLowerQuality });
    if (!remainingByRequirement.has(remainingKey)) {
      const totalForMaterial = Array.from(byRequirement.values())
        .filter((entry) => requirementAvailabilityKey({ ...entry, allowLowerQuality: entry.usedBy.some((usage) => usage.allowLowerQuality === true) }) === remainingKey)
        .reduce((sum, entry) => sum + entry.originalRequiredQuantity, 0);
      const eligibleInventory = (request.inventoryEntries ?? [])
        .filter((entry) => inventoryEntryIsEligible(entry, requirement.materialId, requirement.selectedQuality, allowLowerQuality))
        .reduce((sum, entry) => sum + entry.quantity, 0);
      remainingByRequirement.set(
        remainingKey,
        Math.max(0, totalForMaterial - (reservedByRequirement.get(remainingKey) ?? 0) - eligibleInventory),
      );
    }
  }

  for (const remainingKey of new Set(Array.from(byRequirement.values()).map((entry) =>
    requirementAvailabilityKey({ ...entry, allowLowerQuality: entry.usedBy.some((usage) => usage.allowLowerQuality === true) }),
  ))) {
    let remaining = remainingByRequirement.get(remainingKey) ?? 0;
    for (const requirement of Array.from(byRequirement.values()).filter((entry) =>
      requirementAvailabilityKey({ ...entry, allowLowerQuality: entry.usedBy.some((usage) => usage.allowLowerQuality === true) }) === remainingKey
    )) {
      const quantity = Math.min(requirement.originalRequiredQuantity, remaining);
      requirement.requiredQuantity = quantity;
      requirement.displayQuantity = formatRequirementQuantity(quantity, requirement.unitType);
      remaining -= quantity;
    }
  }

  return Array.from(byRequirement.values()).filter((requirement) => requirement.requiredQuantity > 0);
}
