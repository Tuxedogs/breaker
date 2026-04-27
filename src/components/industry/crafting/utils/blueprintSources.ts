import type { BlueprintReward, ComponentRecipe } from "./craftingTypes";

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getBlueprintSourcesForRecipe(
  recipe: Pick<ComponentRecipe, "blueprint_id" | "component_name">,
  blueprintRewards: BlueprintReward[]
): BlueprintReward[] {
  // blueprint-rewards.json has no blueprint_id or output_entityClass fields —
  // only blueprint_name. Use exact normalized name match to avoid false positives.
  const normalizedComponent = normalizeName(recipe.component_name);

  return blueprintRewards.filter(
    (r) => normalizeName(r.blueprint_name) === normalizedComponent
  );
}
