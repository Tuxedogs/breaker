import { useEffect, useState, lazy, Suspense, useCallback, useMemo } from "react";
import "./recipe-browser.css";

import type { ComponentRecipe } from "./utils/craftingTypes";
import { useLogisticsStore } from "../../../stores/logisticsStore";
import { getCraftingItems } from "../../../lib/craftingData";

import ComponentRecipeTable, { type FinalProductQuality } from "./components/ComponentRecipeTable";
import MaterialDemandAnalytics from "./components/MaterialDemandAnalytics";
import { getModifiersAtQuality } from "./utils/qualityModifiers";
import { getMaterialQualityKey } from "./utils/materialQuality";
import { clampQuality } from "./utils/qualityBands";
import { getInventoryUnitLabel } from "../../../lib/logistics/inventory";
import { createMaterialResolver } from "../../../lib/logistics/materialResolver";

// Heavy data — lazy so the crafting chunk doesn't bloat the main bundle
const QualityModifierViewer = lazy(() => import("./components/QualityModifierViewer"));

type Tab = "recipes" | "analytics" | "quality";

type RecipeRewardPool = {
  poolName?: string;
  poolGuid?: string;
  sourceFolder?: string;
  displayName?: string;
  weight?: number;
};

function getRecipeItemId(recipe: ComponentRecipe): string {
  return recipe.internal_name ?? recipe.blueprint_id;
}

function isRecipeRewardPool(value: unknown): value is RecipeRewardPool {
  return typeof value === "object" && value !== null;
}

function getBlueprintSourcesForQueue(recipe: ComponentRecipe) {
  return (recipe.rewardPools ?? [])
    .filter(isRecipeRewardPool)
    .map((pool) => ({
      poolName: pool.poolName,
      poolGuid: pool.poolGuid,
      sourceFolder: pool.sourceFolder,
      displayName: pool.displayName ?? "Unknown blueprint source",
      weight: typeof pool.weight === "number" ? pool.weight : undefined,
    }))
    .filter((pool) => pool.displayName.trim().length > 0);
}

export default function CraftingModule() {
  const [tab] = useState<Tab>("recipes");
  const [recipes, setRecipes] = useState<ComponentRecipe[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const buildQueue = useLogisticsStore((state) => state.buildQueue);
  const inventoryEntries = useLogisticsStore((state) => state.inventoryEntries);
  const materialTemplates = useLogisticsStore((state) => state.materialTemplates);
  const registerCraftingRecipe = useLogisticsStore((state) => state.registerCraftingRecipe);
  const addBuildQueueItem = useLogisticsStore((state) => state.addBuildQueueItem);

  useEffect(() => {
    let cancelled = false;
    getCraftingItems()
      .then((items) => {
        if (!cancelled) setRecipes(items);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Failed to load crafting data");
        }
      });
    return () => { cancelled = true; };
  }, []);

  const handleAddToQueue = useCallback((
    recipe: ComponentRecipe,
    selectedQualities: Record<string, { quality: number; bandNumber?: number; bands?: { start: string | number; end: string | number; mappedValue: string | number }[] }>,
    finalProductQuality: FinalProductQuality,
  ) => {
    const recipeId = `craft-${recipe.blueprint_id}`;
    const category = recipe.component_type ?? recipe.item_kind ?? "component";
    const resolveMaterial = createMaterialResolver(materialTemplates);

    const inputs = (recipe.materials ?? []).flatMap((mat, rowIndex) => {
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
      const qualitySnapshot = selectedQualities[getMaterialQualityKey(recipe, mat, rowIndex)];
      const selectedQuality = clampQuality(qualitySnapshot?.quality ?? 500);
      const modifier = getModifiersAtQuality(mat.qualityModifiers ?? [], selectedQuality)[0];
      const displayName = String(mat.material_name ?? resolved.displayName);
      const modifierKey = modifier?.property ?? mat.slot ?? "material";
      return [{
        requirementId: `${recipeId}:${rowIndex}:${resolved.materialKey}:${modifierKey}:${modifier?.modifierMode ?? ""}`,
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
        selectedQuality,
        mappedQuality: selectedQuality,
        qualityBand: qualitySnapshot?.bandNumber,
        modifierName: modifier?.property,
        modifierType: modifier?.modifierMode,
        modifierValue: modifier?.value,
        qualityModifiers: mat.qualityModifiers,
        qualityBands: qualitySnapshot?.bands,
      }];
    });

    registerCraftingRecipe({ recipeId, name: recipe.component_name, category, inputs });
    addBuildQueueItem(recipeId, 1, {
      blueprint_id: recipe.blueprint_id,
      itemId: getRecipeItemId(recipe),
      itemName: recipe.component_name,
      finalProductQualityBand: finalProductQuality.band,
      finalProductQualityAverage: finalProductQuality.averageBand,
      finalProductRarity: finalProductQuality.rarity,
      blueprintSources: getBlueprintSourcesForQueue(recipe),
      materialRequirements: inputs,
    });
  }, [materialTemplates, registerCraftingRecipe, addBuildQueueItem]);


  const activeQueue = buildQueue.filter((item) => item.status !== "complete");
  const queuedRecipeIds = useMemo(
    () => new Set(activeQueue.map((item) => item.recipeId)),
    [activeQueue],
  );

  return (
    <>
      {loadError && (
        <div className="craft-empty-state">
          <p>{loadError}</p>
        </div>
      )}

      {tab === "recipes" && (
        <ComponentRecipeTable
          recipes={recipes}
          inventoryEntries={inventoryEntries}
          materialTemplates={materialTemplates}
          onAddToQueue={handleAddToQueue}
          isRecipeQueued={(recipe) => queuedRecipeIds.has(`craft-${recipe.blueprint_id}`)}
        />
      )}

      {tab === "analytics" && (
        <MaterialDemandAnalytics recipes={recipes} />
      )}

      {tab === "quality" && (
        <Suspense fallback={<div className="craft-empty-state">Loading quality data…</div>}>
          <QualityModifierViewer />
        </Suspense>
      )}

    </>
  );
}
