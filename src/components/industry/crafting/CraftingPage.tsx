import { useEffect, useState, lazy, Suspense, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import type { ComponentRecipe } from "./utils/craftingTypes";
import { useLogisticsStore } from "../../../stores/logisticsStore";
import { getCraftingItemsByBlueprintGuids } from "../../../lib/craftingData";
import { useCraftingContext } from "./CraftingContext";

import ComponentRecipeTable, { type FinalProductQuality } from "./components/ComponentRecipeTable";
import ComponentResultsBrowser from "./components/ComponentResultsBrowser";
import CraftingBrowserWorkspace from "./components/CraftingBrowserWorkspace";
import CraftingFilterBar from "./components/CraftingFilterBar";
import CraftingInspectionBayEmptyState from "./components/CraftingInspectionBayEmptyState";
import MaterialDemandAnalytics from "./components/MaterialDemandAnalytics";
import { getModifiersAtQuality } from "./utils/qualityModifiers";
import { getMaterialQualityKey } from "./utils/materialQuality";
import { clampQuality } from "./utils/qualityBands";
import { getActiveInventoryEntries, getInventoryUnitLabel } from "../../../lib/logistics/inventory";
import { useMaterialIdentityIndex } from "../../../lib/logistics/materialIdentityIndex";
import { createMaterialResolver } from "../../../lib/logistics/materialResolver";
import { useCraftingBrowserLayoutMode } from "./utils/craftingBrowserLayout";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const previewId = blueprintId ? null : searchParams.get("preview");
  const targetBlueprintId = blueprintId ?? previewId;
  const [tab] = useState<Tab>("recipes");
  const [recipes, setRecipes] = useState<ComponentRecipe[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const layoutMode = useCraftingBrowserLayoutMode();

  // Component card index comes from CraftingLayout via context
  const { componentCards, browserPage, loading: cardsLoading, error: cardsError } = useCraftingContext();
  const browserComponentCards = browserPage?.records ?? [];

  const buildQueue = useLogisticsStore((state) => state.buildQueue);
  const allInventoryEntries = useLogisticsStore((state) => state.inventoryEntries);
  const inventoryEntries = useMemo(() => getActiveInventoryEntries(allInventoryEntries), [allInventoryEntries]);
  const materialTemplates = useLogisticsStore((state) => state.materialTemplates);
  const materialIdentities = useMaterialIdentityIndex();
  const registerCraftingRecipe = useLogisticsStore((state) => state.registerCraftingRecipe);
  const addBuildQueueItem = useLogisticsStore((state) => state.addBuildQueueItem);

  useEffect(() => {
    if (!previewId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const next = new URLSearchParams(window.location.search);
      next.delete("preview");
      setSearchParams(next, { replace: true });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewId, setSearchParams]);

  // Detail surfaces load a single shaped recipe shard. The full vehicle and FPS
  // catalogs remain reserved for workflows that genuinely need every recipe.
  useEffect(() => {
    if (!targetBlueprintId) {
      queueMicrotask(() => setRecipes([]));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setDetailLoading(true);
      setDetailError(null);
    });
    const familyRecipeIds = browserPage?.familyRecipeIdsById[targetBlueprintId]
      ?? [targetBlueprintId];
    const recipeIds = familyRecipeIds.includes(targetBlueprintId)
      ? familyRecipeIds
      : [targetBlueprintId, ...familyRecipeIds];

    getCraftingItemsByBlueprintGuids(recipeIds)
      .then((items) => {
        if (!cancelled) {
          setRecipes(items);
          setDetailError(
            items.some((recipe) => recipe.blueprint_id === targetBlueprintId)
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
  }, [browserPage?.familyRecipeIdsById, targetBlueprintId]);

  const handleAddToQueue = useCallback((
    recipe: ComponentRecipe,
    selectedQualities: Record<string, { quality: number; bandNumber?: number; bands?: { start: string | number; end: string | number; mappedValue: string | number }[] }>,
    finalProductQuality: FinalProductQuality,
  ) => {
    const recipeId = `craft-${recipe.blueprint_id}`;
    const category = recipe.component_type ?? recipe.item_kind ?? "component";
    const resolveMaterial = createMaterialResolver(materialTemplates, materialIdentities);

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
  }, [materialIdentities, materialTemplates, registerCraftingRecipe, addBuildQueueItem]);

  const activeQueue = buildQueue.filter((item) => item.status !== "complete");
  const queuedRecipeIds = useMemo(
    () => new Set(activeQueue.map((item) => item.recipeId)),
    [activeQueue],
  );

  const closePreview = useCallback(() => {
    const next = new URLSearchParams(window.location.search);
    next.delete("preview");
    setSearchParams(next, { replace: true });
  }, [setSearchParams]);

  const previewRecord = useCallback((record: { id: string }) => {
    const next = new URLSearchParams(window.location.search);
    next.set("preview", record.id);
    setSearchParams(next, { replace: false });
  }, [setSearchParams]);

  const loadError = blueprintId ? detailError : cardsError;
  const previewRecipeReady = previewId
    ? recipes.some((recipe) => recipe.blueprint_id === previewId)
    : false;
  const previewLoading = Boolean(previewId) && (detailLoading || (!previewRecipeReady && !detailError));
  const resultCount = browserPage?.totalRecords ?? 0;

  const detailContent = !previewId ? (
    <CraftingInspectionBayEmptyState />
  ) : detailError ? (
    <div className="craft-detail-drawer-state craft-detail-drawer-state--error">
      <span>Detail unavailable</span>
      <p>{detailError}</p>
      <button type="button" onClick={closePreview}>Return to standby</button>
    </div>
  ) : previewLoading ? (
    <div className="craft-detail-drawer-state" aria-busy="true">
      <span>Loading inspection data</span>
      <div className="craft-detail-drawer-loader" aria-hidden="true" />
    </div>
  ) : previewRecipeReady ? (
    <ComponentRecipeTable
      recipes={recipes}
      inventoryEntries={inventoryEntries}
      materialTemplates={materialTemplates}
      componentCards={componentCards}
      initialBlueprintId={previewId}
      presentation="drawer"
      onClose={closePreview}
      onAddToQueue={handleAddToQueue}
      isRecipeQueued={(recipe) => queuedRecipeIds.has(`craft-${recipe.blueprint_id}`)}
    />
  ) : null;

  return (
    <>
      {loadError && blueprintId && (
        <div className="craft-empty-state">
          <p>{loadError}</p>
        </div>
      )}

      {tab === "recipes" && !blueprintId && (
        <CraftingBrowserWorkspace
          selectedId={previewId}
          detailReady={previewRecipeReady}
          layoutMode={layoutMode}
          toolbar={<CraftingFilterBar records={browserComponentCards} resultCount={resultCount} />}
          results={(
            <ComponentResultsBrowser
              records={browserComponentCards}
              loading={cardsLoading}
              error={cardsError}
              isRecipeQueued={(record) => queuedRecipeIds.has(`craft-${record.id}`)}
              previewId={previewId}
              onPreviewRecord={previewRecord}
              autoSelectFirstRecord={false}
              layoutMode={layoutMode}
              serverPage={browserPage}
            />
          )}
          detail={detailContent}
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
