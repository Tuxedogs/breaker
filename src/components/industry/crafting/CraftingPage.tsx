import { useEffect, useState, lazy, Suspense, useCallback } from "react";
import "./crafting.css";

import type { ComponentRecipe } from "./utils/craftingTypes";
import { useLogisticsStore } from "../../../stores/logisticsStore";
import { getBuildQueueShortageSummary } from "../../../lib/logistics/selectors";
import { getCraftingItems } from "../../../lib/craftingData";

import ComponentRecipeTable from "./components/ComponentRecipeTable";
import MaterialDemandAnalytics from "./components/MaterialDemandAnalytics";
import MaterialSourcePlaceholder from "./components/MaterialSourcePlaceholder";
import CraftTabBar from "./CraftTabBar";
import { getModifiersAtQuality } from "./utils/qualityModifiers";
import { getMaterialQualityKey } from "./utils/materialQuality";
import { clampQuality } from "./utils/qualityBands";
import { getInventoryUnitLabel } from "../../../lib/logistics/inventory";
import { createMaterialResolver } from "../../../lib/logistics/materialResolver";

// Heavy data — lazy so the crafting chunk doesn't bloat the main bundle
const QualityModifierViewer = lazy(() => import("./components/QualityModifierViewer"));

type Tab = "recipes" | "analytics" | "quality" | "sources";

function getRecipeItemId(recipe: ComponentRecipe): string {
  return recipe.internal_name ?? recipe.blueprint_id;
}

export default function CraftingModule() {
  const [tab, setTab] = useState<Tab>("recipes");
  const [recipes, setRecipes] = useState<ComponentRecipe[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const buildQueue = useLogisticsStore((state) => state.buildQueue);
  const inventoryEntries = useLogisticsStore((state) => state.inventoryEntries);
  const materialTemplates = useLogisticsStore((state) => state.materialTemplates);
  const recipeTemplates = useLogisticsStore((state) => state.recipeTemplates);
  const recipeInputsByRecipeId = useLogisticsStore((state) => state.recipeInputTemplates);
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

  const handleAddToQueue = useCallback((recipe: ComponentRecipe, selectedQualities: Record<string, { quality: number; bands?: { start: string | number; end: string | number; mappedValue: string | number }[] }>) => {
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
        modifierName: modifier?.property,
        modifierType: modifier?.modifierMode,
        modifierValue: modifier?.value,
        qualityModifiers: mat.qualityModifiers,
        qualityBands: qualitySnapshot?.bands,
      }];
    });

    registerCraftingRecipe({ recipeId, name: recipe.component_name, category, inputs });
    addBuildQueueItem(recipeId, 1, {
      itemId: getRecipeItemId(recipe),
      itemName: recipe.component_name,
      materialRequirements: inputs,
    });
  }, [materialTemplates, registerCraftingRecipe, addBuildQueueItem]);

  const { shortages } = getBuildQueueShortageSummary(
    inventoryEntries, buildQueue, recipeTemplates, recipeInputsByRecipeId,
  );
  const activeQueue = buildQueue.filter((item) => item.status !== "complete");
  const queueBadge = activeQueue.length > 0 ? activeQueue.length : null;
  const missingCount = shortages.length;

  return (
    <div className="craft-page">
      <div className="craft-page-header">
        <div>
          <div className="craft-breadcrumb">
            <span className="craft-breadcrumb-root">Industry</span>
            <span className="craft-breadcrumb-sep">/</span>
            <span className="craft-breadcrumb-active">Crafting</span>
          </div>
          <h1 className="craft-page-title">Component Crafting</h1>
          <p className="craft-page-subtitle">
            {recipes.length} blueprints · vehicle gear components · live game data
          </p>
        </div>

        <div className="craft-stats-strip">
          <div className="craft-stat">
            <div className="craft-stat-label">Blueprints</div>
            <div className="craft-stat-value">{recipes.length}</div>
          </div>
          <div className="craft-stat">
            <div className="craft-stat-label">Queued</div>
            <div className="craft-stat-value">{activeQueue.reduce((s, i) => s + i.quantity, 0)}</div>
          </div>
          <div className={`craft-stat${missingCount > 0 ? " craft-stat--alert" : ""}`}>
            <div className="craft-stat-label">Shortages</div>
            <div className={`craft-stat-value${missingCount > 0 ? " craft-stat-value--alert" : ""}`}>
              {missingCount}
            </div>
          </div>
        </div>
      </div>

      <CraftTabBar
        activeTab={tab as "recipes" | "queue" | "analytics" | "quality" | "sources"}
        onTabChange={(t) => {
          if (t !== "queue") setTab(t as Tab);
        }}
        queueBadge={queueBadge}
        missingCount={missingCount}
      />

      <div className="craft-tab-content">
        {loadError && (
          <div className="craft-empty-state">
            <p>{loadError}</p>
          </div>
        )}

        {tab === "recipes" && (
          <ComponentRecipeTable recipes={recipes} onAddToQueue={handleAddToQueue} />
        )}

        {tab === "analytics" && (
          <MaterialDemandAnalytics recipes={recipes} />
        )}

        {tab === "quality" && (
          <Suspense fallback={<div className="craft-empty-state">Loading quality data…</div>}>
            <QualityModifierViewer />
          </Suspense>
        )}

        {tab === "sources" && (
          <MaterialSourcePlaceholder />
        )}
      </div>
    </div>
  );
}
