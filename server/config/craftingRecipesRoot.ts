import path from "node:path";

export function getCraftingRecipesRoot(): string {
  if (process.env.CRAFTING_RECIPES_ROOT) {
    return path.resolve(process.env.CRAFTING_RECIPES_ROOT);
  }
  return path.resolve(process.cwd(), "server-data", "crafting", "recipes");
}
