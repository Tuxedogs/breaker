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

// Heavy data — lazy so the crafting chunk doesn't bloat the main bundle
const QualityModifierViewer = lazy(() => import("./components/QualityModifierViewer"));

type Tab = "recipes" | "analytics" | "quality" | "sources";

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
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

  const handleAddToQueue = useCallback((recipe: ComponentRecipe) => {
    const recipeId = `craft-${recipe.blueprint_id}`;
    const category = recipe.component_type ?? recipe.item_kind ?? "component";

    const inputs = (recipe.materials ?? []).flatMap((mat) => {
      // Try exact name match first, then slug match
      const material =
        materialTemplates.find((m) => m.name.toLowerCase() === mat.material_name.toLowerCase()) ??
        materialTemplates.find((m) => m.id === nameToSlug(mat.material_name));
      if (!material) return [];
      return [{ materialId: material.id, quantity: mat.quantity }];
    });

    registerCraftingRecipe({ recipeId, name: recipe.component_name, category, inputs });
    addBuildQueueItem(recipeId);
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
