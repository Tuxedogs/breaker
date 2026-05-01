import type {
  BuildQueueItem,
  ComponentRecipe,
  MaterialInventory,
  AggregatedMaterial,
  MaterialDemandEntry,
} from "./craftingTypes";

// Aggregate total material requirements across all queued items.
export function aggregateMaterials(
  queue: BuildQueueItem[],
  recipes: ComponentRecipe[],
  inventory: MaterialInventory
): AggregatedMaterial[] {
  const totals = new Map<string, { material_name: string; needed: number }>();

  for (const item of queue) {
    const recipe = recipes.find((r) => r.blueprint_id === item.blueprint_id);
    const materials = recipe?.materials ?? item.materials ?? [];
    if (materials.length === 0) continue;
    for (const mat of materials) {
      const key = mat.cost_id || mat.material_name;
      const existing = totals.get(key);
      const add = mat.quantity * item.quantity;
      if (existing) {
        existing.needed += add;
      } else {
        totals.set(key, { material_name: mat.material_name, needed: add });
      }
    }
  }

  return Array.from(totals.entries()).map(([key, { material_name, needed }]) => {
    const owned = inventory[key] ?? 0;
    return {
      cost_id: key,
      material_name,
      needed,
      owned,
      missing: Math.max(needed - owned, 0),
    };
  });
}

// Compute demand analytics across all recipes (not just queue).
export function computeMaterialDemand(recipes: ComponentRecipe[]): MaterialDemandEntry[] {
  const map = new Map<
    string,
    { material_name: string; total_quantity: number; recipe_count: number; types: Set<string> }
  >();

  for (const recipe of recipes) {
    for (const mat of recipe.materials) {
      const key = mat.cost_id || mat.material_name;
      const entry = map.get(key);
      if (entry) {
        entry.total_quantity += mat.quantity;
        entry.recipe_count += 1;
        entry.types.add(recipe.component_type);
      } else {
        map.set(key, {
          material_name: mat.material_name,
          total_quantity: mat.quantity,
          recipe_count: 1,
          types: new Set([recipe.component_type]),
        });
      }
    }
  }

  return Array.from(map.entries())
    .map(([key, { material_name, total_quantity, recipe_count, types }]) => ({
      cost_id: key,
      material_name,
      total_quantity,
      recipe_count,
      component_types: Array.from(types),
    }))
    .sort((a, b) => b.total_quantity - a.total_quantity);
}

export function formatCraftTime(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}
