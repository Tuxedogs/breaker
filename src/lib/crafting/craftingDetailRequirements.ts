import type { ComponentRecipe } from "../../components/industry/crafting/utils/craftingTypes";

type RecipeRequirement = ComponentRecipe["materials"][number];

export type CraftingDetailRequirement = {
  inputIndex: number;
  requirement: RecipeRequirement;
  renderKind: "material-quality";
  editableQuality: true;
};

export function projectCraftingDetailMaterialRows(
  recipe: Pick<ComponentRecipe, "materials">,
): CraftingDetailRequirement[] {
  return recipe.materials.map((requirement, inputIndex) => ({
    inputIndex,
    requirement,
    renderKind: "material-quality",
    editableQuality: true,
  }));
}
