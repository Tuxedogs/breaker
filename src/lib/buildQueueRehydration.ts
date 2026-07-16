import type { RecipeInputTemplate } from "../data/logistics/seed";
import type { ComponentRecipe } from "../components/industry/crafting/utils/craftingTypes";
import type { BuildQueueItem, BlueprintSourceSnapshot, MaterialTemplate, RecipeTemplate } from "../types/logistics";
import type { UserBuildQueueItem } from "./userBuildQueue";
import { getInventoryUnitLabel } from "./logistics/inventory";
import { createMaterialResolver } from "./logistics/materialResolver";

type RehydratedBuildQueue = {
  buildQueue: BuildQueueItem[];
  recipeTemplates: RecipeTemplate[];
  recipeInputTemplates: Record<string, RecipeInputTemplate[]>;
};

function getRecipeId(recipe: ComponentRecipe): string {
  return `craft-${recipe.blueprint_id}`;
}

function getRecipeItemId(recipe: ComponentRecipe): string {
  return recipe.internal_name ?? recipe.blueprint_id;
}

function getBlueprintSources(recipe: ComponentRecipe): BlueprintSourceSnapshot[] {
  return (recipe.rewardPools ?? [])
    .filter((pool): pool is Record<string, unknown> => typeof pool === "object" && pool !== null)
    .map((pool) => ({
      poolName: typeof pool.poolName === "string" ? pool.poolName : undefined,
      poolGuid: typeof pool.poolGuid === "string" ? pool.poolGuid : undefined,
      sourceFolder: typeof pool.sourceFolder === "string" ? pool.sourceFolder : undefined,
      displayName: typeof pool.displayName === "string" && pool.displayName.trim()
        ? pool.displayName
        : "Unknown blueprint source",
      weight: typeof pool.weight === "number" ? pool.weight : undefined,
    }))
    .filter((pool) => pool.displayName.trim().length > 0);
}

function buildRecipeInputs(recipeId: string, recipe: ComponentRecipe, materials: MaterialTemplate[]): RecipeInputTemplate[] {
  const resolveMaterial = createMaterialResolver(materials);

  return (recipe.materials ?? []).flatMap((mat, rowIndex) => {
    const resolved = resolveMaterial({
      materialGuid: mat.cost_id,
      costId: mat.cost_id,
      materialName: mat.material_name,
      rawName: mat.material_name,
      sourceName: mat.material_name,
      sourceType: mat.cost_type,
    });
    if (!resolved) return [];

    const material = resolved.material;
    const displayName = String(mat.material_name ?? resolved.displayName);
    return [{
      requirementId: `${recipeId}:${rowIndex}:${resolved.materialKey}:${mat.slot ?? "material"}`,
      materialKey: resolved.materialKey,
      materialId: resolved.materialId,
      costId: resolved.costId ?? mat.cost_id,
      materialGuid: resolved.guid ?? mat.cost_id,
      displayName,
      materialName: displayName,
      rawName: mat.material_name,
      sourceName: mat.material_name,
      sourceType: mat.cost_type,
      quantity: mat.quantity,
      unitType: getInventoryUnitLabel(material),
      selectedQuality: 500,
      mappedQuality: 500,
      qualityModifiers: mat.qualityModifiers,
    }];
  });
}

export function rehydrateBuildQueueItems(
  rows: UserBuildQueueItem[],
  recipes: ComponentRecipe[],
  materials: MaterialTemplate[],
): RehydratedBuildQueue {
  const recipesById = new Map(recipes.map((recipe) => [getRecipeId(recipe), recipe]));
  const recipeTemplates: RecipeTemplate[] = [];
  const recipeInputTemplates: Record<string, RecipeInputTemplate[]> = {};

  const buildQueue = rows.flatMap<BuildQueueItem>((row, index) => {
    const recipe = recipesById.get(row.recipeId);
    if (!recipe) return [];

    const category = recipe.component_type ?? recipe.item_kind ?? "component";
    const inputs = buildRecipeInputs(row.recipeId, recipe, materials);
    recipeTemplates.push({
      id: row.recipeId,
      name: recipe.component_name,
      category,
    });
    recipeInputTemplates[row.recipeId] = inputs;

    return [{
      id: `db-${row.id}`,
      queueId: row.queueId,
      recipeId: row.recipeId,
      blueprint_id: recipe.blueprint_id,
      itemId: getRecipeItemId(recipe),
      itemName: recipe.component_name,
      quantity: Math.max(1, Math.trunc(row.quantity)),
      allowLowerQuality: false,
      status: "queued",
      priority: index + 1,
      priorityActive: false,
      blueprintSources: getBlueprintSources(recipe),
      materialRequirements: inputs,
    }];
  });

  return { buildQueue, recipeTemplates, recipeInputTemplates };
}
