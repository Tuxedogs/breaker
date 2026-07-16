export type RecipeInputKind = "material" | "part";

export type RecipeInputClassification = {
  costId?: unknown;
  materialId?: unknown;
  materialKey?: unknown;
  costType?: unknown;
  inputKind?: unknown;
  slot?: unknown;
  slotDisplayName?: unknown;
  materialName?: unknown;
};

// Some Foundry recipes encode manufactured sub-parts with CraftingCost_Resource.
// Keep those rows in the recipe, but never expose them as inventory materials.
const NON_INVENTORY_RECIPE_PART_IDS = new Set([
  "fde0cd65-8827-4b23-804d-cc8845dfa7ac", // Insulative Liner
]);

const NON_INVENTORY_RECIPE_PART_KEYS = new Set([
  "insulativeliner",
  "insulativelinermaterial",
]);

function normalized(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isNonInventoryRecipePart(input: RecipeInputClassification): boolean {
  const ids = [input.costId, input.materialId].map(normalized);
  if (ids.some((id) => NON_INVENTORY_RECIPE_PART_IDS.has(id))) return true;

  const keys = [input.materialKey, input.materialName]
    .map((value) => normalized(value).replace(/[^a-z0-9]+/g, ""));
  return keys.some((key) => NON_INVENTORY_RECIPE_PART_KEYS.has(key));
}

export function classifyRecipeInput(input: RecipeInputClassification): RecipeInputKind {
  const explicitKind = normalized(input.inputKind);
  if (explicitKind === "part" || explicitKind === "material") return explicitKind;
  if (isNonInventoryRecipePart(input)) return "part";
  // Gems are inventory materials even though Foundry encodes their costs as items.
  // Only explicit or known manufactured sub-parts should leave the material path.
  return "material";
}

export function getRecipeInputDisplayName(input: RecipeInputClassification): string {
  if (classifyRecipeInput(input) === "part") {
    const slotName = [input.slotDisplayName, input.slot]
      .find((value) => typeof value === "string" && value.trim());
    if (typeof slotName === "string") return slotName.trim();
  }

  return typeof input.materialName === "string" ? input.materialName.trim() : "";
}
