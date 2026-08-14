import {
  classifyRecipeInput,
  type RecipeInputClassification,
} from "../../src/lib/crafting/recipeInputClassification.ts";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null ? value as JsonRecord : null;
}

function classificationFor(record: JsonRecord): RecipeInputClassification {
  return {
    costId: record.costId ?? record.cost_id,
    materialId: record.materialId ?? record.material_id,
    materialKey: record.materialKey ?? record.material_key,
    costType: record.costType ?? record.cost_type,
    inputKind: record.inputKind ?? record.input_kind,
    slot: record.slot,
    slotDisplayName: record.slotDisplayName ?? record.slot_display_name,
    materialName: record.materialName ?? record.material_name ?? record.name,
  };
}

export function filterInventoryRecipeInputs(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.filter((rawRequirement) => {
    const requirement = asRecord(rawRequirement);
    return !requirement || classifyRecipeInput(classificationFor(requirement)) === "material";
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function searchablePartValues(requirement: JsonRecord): string[] {
  return [
    requirement.costId,
    requirement.cost_id,
    requirement.materialId,
    requirement.material_id,
    requirement.materialKey,
    requirement.material_key,
    requirement.materialName,
    requirement.material_name,
    requirement.name,
    requirement.slotDisplayName,
    requirement.slot_display_name,
    requirement.slot,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

export function stripNonInventoryRecipePartsFromSearchText(
  searchText: unknown,
  recipeRequirements: unknown,
): string {
  let sanitized = typeof searchText === "string" ? searchText.toLowerCase() : "";
  if (!Array.isArray(recipeRequirements) || !sanitized) return sanitized.trim();

  const removedValues = recipeRequirements.flatMap((rawRequirement) => {
    const requirement = asRecord(rawRequirement);
    if (!requirement || classifyRecipeInput(classificationFor(requirement)) !== "part") return [];
    return searchablePartValues(requirement);
  });

  const candidates = [...new Set(removedValues.flatMap((value) => {
    const normalized = value.trim().toLowerCase();
    const compact = normalized.replace(/[^a-z0-9]+/g, "");
    return compact && compact !== normalized ? [normalized, compact] : [normalized];
  }))].sort((left, right) => right.length - left.length);

  for (const candidate of candidates) {
    sanitized = sanitized.replace(new RegExp(escapeRegExp(candidate), "g"), " ");
  }

  return sanitized.replace(/\s+/g, " ").trim();
}
