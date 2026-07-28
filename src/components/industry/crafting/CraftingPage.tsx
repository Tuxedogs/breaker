import { useEffect, useState, lazy, Suspense, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";

import type { ComponentRecipe } from "./utils/craftingTypes";
import { useLogisticsStore } from "../../../stores/logisticsStore";
import { getCraftingItemsByBlueprintGuids } from "../../../lib/craftingData";
import { useCraftingContext } from "./CraftingContext";

import ComponentRecipeTable, { type FinalProductQuality } from "./components/ComponentRecipeTable";
import ComponentResultsBrowser from "./components/ComponentResultsBrowser";
import MaterialDemandAnalytics from "./components/MaterialDemandAnalytics";
import { getModifiersAtQuality } from "./utils/qualityModifiers";
import { getMaterialQualityKey } from "./utils/materialQuality";
import { clampQuality } from "./utils/qualityBands";
import { getActiveInventoryEntries, getInventoryUnitLabel } from "../../../lib/logistics/inventory";
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
  const { blueprintId } = useParams<{ blueprintId?: string }>();
  const [tab] = useState<Tab>("recipes");
  const [recipes, setRecipes] = useState<ComponentRecipe[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Component card index comes from CraftingLayout via context
  const { componentCards, loading: cardsLoading, error: cardsError } = useCraftingContext();

  const buildQueue = useLogisticsStore((state) => state.buildQueue);
  const allInventoryEntries = useLogisticsStore((state) => state.inventoryEntries);
  const inventoryEntries = useMemo(() => getActiveInventoryEntries(allInventoryEntries), [allInventoryEntries]);
  const materialTemplates = useLogisticsStore((state) => state.materialTemplates);
  const registerCraftingRecipe = useLogisticsStore((state) => state.registerCraftingRecipe);
  const addBuildQueueItem = useLogisticsStore((state) => state.addBuildQueueItem);

  // Detail pages load a single shaped recipe shard. The full vehicle and FPS
  // catalogs remain reserved for workflows that genuinely need every recipe.
  useEffect(() => {
    if (!blueprintId) {
      queueMicrotask(() => setRecipes([]));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setDetailLoading(true);
      setDetailError(null);
    });
    const selectedCard = componentCards.find((card) => card.id === blueprintId);
    const familyRecipeIds = selectedCard?.familyKey
      ? componentCards
        .filter((card) => (
          card.kind === selectedCard.kind
          && card.type === selectedCard.type
          && card.familyKey === selectedCard.familyKey
        ))
        .map((card) => card.id)
      : [blueprintId];
    const recipeIds = familyRecipeIds.includes(blueprintId)
      ? familyRecipeIds
      : [blueprintId, ...familyRecipeIds];

    getCraftingItemsByBlueprintGuids(recipeIds)
      .then((items) => {
        if (!cancelled) {
          setRecipes(items);
          setDetailError(
            items.some((recipe) => recipe.blueprint_id === blueprintId)
              ? null
              : "Crafting recipe not found",
          );
          setDetailLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDetailError(error instanceof Error ? error.message : "Failed to load crafting data");
          setDetailLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [blueprintId, componentCards]);

  const handleAddToQueue = useCallback((
    recipe: ComponentRecipe,
    selectedQualities: Record<string, { quality: number; bandNumber?: number; bands?: { start: string | number; end: string | number; mappedValue: string | number }[] }>,
    finalProductQuality: FinalProductQuality,
  ) => {
    const recipeId = `craft-${recipe.blueprint_id}`;
    const category = recipe.component_type ?? recipe.item_kind ?? "component";
    const resolveMaterial = createMaterialResolver(materialTemplates);

    const inputs = (recipe.materials ?? []).flatMap((mat, rowIndex) => {
      if (mat.input_kind === "part") return [];
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

  const loading = blueprintId ? detailLoading : cardsLoading;
  const loadError = blueprintId ? detailError : cardsError;

  return (
    <>
      {loadError && blueprintId && (
        <div className="craft-empty-state">
          <p>{loadError}</p>
        </div>
      )}

      {tab === "recipes" && !blueprintId && (
        <ComponentResultsBrowser
          records={componentCards}
          loading={loading}
          error={loadError}
          isRecipeQueued={(record) => queuedRecipeIds.has(`craft-${record.id}`)}
        />
      )}

      {tab === "recipes" && blueprintId && (
        <ComponentRecipeTable
          recipes={recipes}
          inventoryEntries={inventoryEntries}
          materialTemplates={materialTemplates}
          componentCards={componentCards}
          initialBlueprintId={blueprintId}
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
