import type { ComponentRecipe, ComponentMaterial } from "./craftingTypes";

export type RecipeMaterialQualityState = Record<string, number>;

export function getMaterialQualityKey(
  recipe: Pick<ComponentRecipe, "blueprint_id">,
  material: Pick<ComponentMaterial, "cost_id" | "cost_type" | "material_name" | "slot">,
  inputIndex?: number,
): string {
  const slotKey = material.slot || "material";
  const indexKey = inputIndex === undefined ? "" : `:${inputIndex}`;
  if (material.cost_id) {
    return `${recipe.blueprint_id}${indexKey}:${slotKey}:${material.cost_id}`;
  }
  return `${recipe.blueprint_id}${indexKey}:${slotKey}:${material.cost_type}:${material.material_name}`;
}

export function getDefaultMaterialQualities(
  recipe: Pick<ComponentRecipe, "blueprint_id">,
  materials: ComponentMaterial[]
): RecipeMaterialQualityState {
  const state: RecipeMaterialQualityState = {};
  for (const [index, mat] of materials.entries()) {
    const key = getMaterialQualityKey(recipe, mat, index);
    if (!(key in state)) {
      state[key] = 500;
    }
  }
  return state;
}

export function updateMaterialQuality(
  state: RecipeMaterialQualityState,
  key: string,
  value: number
): RecipeMaterialQualityState {
  return { ...state, [key]: value };
}
