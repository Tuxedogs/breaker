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

function normalized(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isNonInventoryRecipePart(input: RecipeInputClassification): boolean {
  return normalized(input.inputKind) === "part";
}

export function classifyRecipeInput(input: RecipeInputClassification): RecipeInputKind {
  const explicitKind = normalized(input.inputKind);
  if (explicitKind === "part" || explicitKind === "material") return explicitKind;
  // Gems are inventory materials even though Foundry encodes their costs as items.
  // Only an explicit upstream inputKind may leave the material path.
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
