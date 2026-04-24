import type { UnitType, ItemCategory } from './shared';

/** One material input required by a recipe. */
export interface RecipeInput {
  /** References Material.id */
  materialId: string;
  quantity: number;
  unitType: UnitType;
}

export interface CraftingRecipe {
  id: string;
  itemName: string;
  category: ItemCategory;
  inputs: RecipeInput[];
  outputQty: number;
  /** Estimated crafting duration in seconds. */
  craftTime: number;
}
