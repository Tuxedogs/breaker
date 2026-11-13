import { useEffect, useState, lazy, Suspense, useCallback, useMemo, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import type { ComponentRecipe } from "./utils/craftingTypes";
import { useLogisticsStore } from "../../../stores/logisticsStore";
import { getCraftingItemsByBlueprintGuids } from "../../../lib/craftingData";
import { loadBlueprintSourceGuidSet } from "../../../lib/craftingBlueprintSourcesApi";
import { isEligibleCraftingBlueprint, normalizeBlueprintGuid } from "../../../lib/crafting/blueprintEligibility";
import { loadMissionDetailMap } from "./utils/blueprintTrackerStore";
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
import { isCraftingPhoneViewport, useCraftingBrowserLayoutMode } from "./utils/craftingBrowserLayout";

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
  const navigate = useNavigate();
  const previewId = blueprintId ? null : searchParams.get("preview");
  // True while the open phone detail was pushed by a row tap, so its back
  // control can pop that history entry instead of stacking another list entry.
  const userPushedPreviewRef = useRef(false);
  const targetBlueprintId = blueprintId ?? previewId;
  const [tab] = useState<Tab>("recipes");
  const [recipes, setRecipes] = useState<ComponentRecipe[]>([]);
  const didInitializePreviewRef = useRef(Boolean(targetBlueprintId));
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [verifiedBlueprintSources, setVerifiedBlueprintSources] = useState<ReadonlySet<string> | null>(null);
  useEffect(() => {
    let active = true;
    loadBlueprintSourceGuidSet().then((guids) => {
      if (active) setVerifiedBlueprintSources(guids);
    }).catch(() => {
      // Local fixtures intentionally block source APIs. Unknown is not evidence of unavailability.
      if (active) setVerifiedBlueprintSources(null);
    });
    return () => { active = false; };
  }, []);
  // Blueprints whose every mission source is disabled (release state or
  // not-for-release), the same rule the detail's "Unavailable" source label uses.
  const [disabledSourceBlueprints, setDisabledSourceBlueprints] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    let active = true;
    loadMissionDetailMap().then((missionMap) => {
      const disabled = new Set<string>();
      for (const [guid, missions] of missionMap) {
        if (missions.length > 0 && missions.every((mission) => mission.isDisabled)) disabled.add(guid);
      }
      if (active) setDisabledSourceBlueprints(disabled);
    });
    return () => { active = false; };
  }, []);
  const sourceVerification = useCallback((recipe: ComponentRecipe): boolean | null =>
    verifiedBlueprintSources === null ? null : isEligibleCraftingBlueprint(recipe.blueprint_id, verifiedBlueprintSources),
  [verifiedBlueprintSources]);
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
    quantity = 1,
  ) => {
    // Do not queue extracted recipes with no source-backed in-game blueprint path.
    // Unknown availability remains explorable while the source API is unavailable.
    if (verifiedBlueprintSources && !isEligibleCraftingBlueprint(recipe.blueprint_id, verifiedBlueprintSources)) return;
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
    addBuildQueueItem(recipeId, Math.max(1, Math.min(99, Math.trunc(quantity))), {
      blueprint_id: recipe.blueprint_id,
      itemId: getRecipeItemId(recipe),
      itemName: recipe.component_name,
      finalProductQualityBand: finalProductQuality.band,
      finalProductQualityAverage: finalProductQuality.averageBand,
      finalProductRarity: finalProductQuality.rarity,
      blueprintSources: getBlueprintSourcesForQueue(recipe),
      materialRequirements: inputs,
    });
  }, [materialIdentities, materialTemplates, registerCraftingRecipe, addBuildQueueItem, verifiedBlueprintSources]);

  const activeQueue = buildQueue.filter((item) => item.status !== "complete");
  const queuedRecipeIds = useMemo(
    () => new Set(activeQueue.map((item) => item.recipeId)),
    [activeQueue],
  );

  useEffect(() => {
    if (!previewId) userPushedPreviewRef.current = false;
  }, [previewId]);

  const closePreview = useCallback(() => {
    if (userPushedPreviewRef.current && isCraftingPhoneViewport()) {
      userPushedPreviewRef.current = false;
      navigate(-1);
      return;
    }
    const next = new URLSearchParams(window.location.search);
    next.delete("preview");
    setSearchParams(next, { replace: true });
  }, [navigate, setSearchParams]);

  const previewRecord = useCallback((record: { id: string }) => {
    const next = new URLSearchParams(window.location.search);
    next.set("preview", record.id);
    setSearchParams(next, { replace: false });
  }, [setSearchParams]);

  const openPreviewFromList = useCallback((record: { id: string }) => {
    userPushedPreviewRef.current = true;
    previewRecord(record);
  }, [previewRecord]);

  // V31 opens with an inspected recipe. Initialize once from real catalog data,
  // retaining URL deep links and respecting an explicit user-close thereafter.
  useEffect(() => {
    if (didInitializePreviewRef.current || blueprintId || previewId || cardsLoading || !browserComponentCards.length) return;
    didInitializePreviewRef.current = true;
    // Phones open on the blueprint list; a detail opens only when the user picks one.
    if (isCraftingPhoneViewport()) return;
    // Prefer a real, source-indexed power plant for the default lab scenario.
    // A deep link or a user-selected item always takes precedence.
    const initialRecord = browserComponentCards.find((record) => record.name.trim().toUpperCase() === "JS-300")
      ?? browserComponentCards[0];
    previewRecord(initialRecord);
  }, [blueprintId, previewId, cardsLoading, browserComponentCards, previewRecord]);

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
      isBlueprintSourceVerified={sourceVerification}
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
          detailLoading={previewLoading}
          layoutMode={layoutMode}
          toolbar={<CraftingFilterBar records={browserComponentCards} resultCount={resultCount} sidebarMode />}
          results={(
            <ComponentResultsBrowser
              presentation="index"
              records={browserComponentCards}
              loading={cardsLoading}
              error={cardsError}
              isRecipeQueued={(record) => queuedRecipeIds.has(`craft-${record.id}`)}
              isBlueprintSourceVerified={(record) => verifiedBlueprintSources === null ? null : isEligibleCraftingBlueprint(record.id, verifiedBlueprintSources)}
              isBlueprintUnavailable={(record) => disabledSourceBlueprints.has(normalizeBlueprintGuid(record.id))}
              previewId={previewId}
              onPreviewRecord={openPreviewFromList}
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
