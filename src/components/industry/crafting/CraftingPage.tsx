import { useEffect, useState, lazy, Suspense, useCallback, useMemo } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

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
import { useMaterialIdentityIndex } from "../../../lib/logistics/materialIdentityIndex";
import { createMaterialResolver } from "../../../lib/logistics/materialResolver";

// Heavy data — lazy so the crafting chunk doesn't bloat the main bundle
const QualityModifierViewer = lazy(() => import("./components/QualityModifierViewer"));

type Tab = "recipes" | "analytics" | "quality";

const CRAFTING_DRAWER_MEDIA_QUERY = "(min-width: 1600px)";

function useMediaQuery(queryText: string): boolean {
  const [matches, setMatches] = useState(() => (
    typeof window !== "undefined" && window.matchMedia(queryText).matches
  ));

  useEffect(() => {
    const query = window.matchMedia(queryText);
    const update = () => setMatches(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [queryText]);

  return matches;
}

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
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const drawerCapable = useMediaQuery(CRAFTING_DRAWER_MEDIA_QUERY);
  const requestedPreviewId = blueprintId ? null : searchParams.get("preview");
  const previewId = drawerCapable ? requestedPreviewId : null;
  const targetBlueprintId = blueprintId ?? previewId;
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
  const materialIdentities = useMaterialIdentityIndex();
  const registerCraftingRecipe = useLogisticsStore((state) => state.registerCraftingRecipe);
  const addBuildQueueItem = useLogisticsStore((state) => state.addBuildQueueItem);

  useEffect(() => {
    if (!requestedPreviewId || drawerCapable || blueprintId) return;
    const next = new URLSearchParams(searchParams);
    next.delete("preview");
    navigate({
      pathname: `/industry/crafting/${requestedPreviewId}`,
      search: next.toString() ? `?${next.toString()}` : "",
    }, {
      replace: true,
      state: { from: `${location.pathname}${next.toString() ? `?${next.toString()}` : ""}` },
    });
  }, [blueprintId, drawerCapable, location.pathname, navigate, requestedPreviewId, searchParams]);

  useEffect(() => {
    if (!previewId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        next.delete("preview");
        return next;
      }, { replace: true });
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
    const selectedCard = componentCards.find((card) => card.id === targetBlueprintId);
    const familyRecipeIds = selectedCard?.familyKey
      ? componentCards
        .filter((card) => (
          card.kind === selectedCard.kind
          && card.type === selectedCard.type
          && card.familyKey === selectedCard.familyKey
        ))
        .map((card) => card.id)
      : [targetBlueprintId];
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
  }, [componentCards, targetBlueprintId]);

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
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("preview");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const previewRecord = useCallback((record: { id: string }) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("preview", record.id);
      return next;
    }, { replace: false });
  }, [setSearchParams]);

  const loadError = blueprintId ? detailError : cardsError;
  const previewRecipeReady = previewId
    ? recipes.some((recipe) => recipe.blueprint_id === previewId)
    : false;
  const previewLoading = Boolean(previewId) && (detailLoading || (!previewRecipeReady && !detailError));

  return (
    <>
      {loadError && blueprintId && (
        <div className="craft-empty-state">
          <p>{loadError}</p>
        </div>
      )}

      {tab === "recipes" && !blueprintId && (
        <div className={`craft-browser-workspace${drawerCapable ? " craft-browser-workspace--drawer" : ""}`}>
          <ComponentResultsBrowser
            records={componentCards}
            loading={cardsLoading}
            error={cardsError}
            isRecipeQueued={(record) => queuedRecipeIds.has(`craft-${record.id}`)}
            previewId={previewId}
            onPreviewRecord={previewRecord}
          />
          {drawerCapable && (
            <div
              className={`craft-detail-drawer-region${previewRecipeReady ? " craft-detail-drawer-region--ready" : ""}`}
              aria-label="Recipe detail preview"
              aria-busy={previewLoading}
            >
              {previewId && detailError ? (
                <div className="craft-detail-drawer-state craft-detail-drawer-state--error">{detailError}</div>
              ) : previewId && previewRecipeReady ? (
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
              ) : null}
            </div>
          )}
        </div>
      )}

      {tab === "recipes" && blueprintId && (
        <ComponentRecipeTable
          recipes={recipes}
          inventoryEntries={inventoryEntries}
          materialTemplates={materialTemplates}
          componentCards={componentCards}
          initialBlueprintId={blueprintId}
          presentation="page"
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
