import { useState, useMemo, lazy, Suspense } from "react";
import "./crafting.css";

import type { ComponentRecipe } from "./utils/craftingTypes";
import { aggregateMaterials } from "./utils/craftingCalculations";
import { useBuildQueue } from "./hooks/useBuildQueue";
import { useMaterialInventory } from "./hooks/useMaterialInventory";

import ComponentRecipeTable from "./components/ComponentRecipeTable";
import BuildQueuePanel from "./components/BuildQueuePanel";
import MaterialInventoryPanel from "./components/MaterialInventoryPanel";
import MissingMaterialsTable from "./components/MissingMaterialsTable";
import MaterialDemandAnalytics from "./components/MaterialDemandAnalytics";
import MaterialSourcePlaceholder from "./components/MaterialSourcePlaceholder";

// Heavy data — lazy so the crafting chunk doesn't bloat the main bundle
const QualityModifierViewer = lazy(() => import("./components/QualityModifierViewer"));

import recipesRaw from "./data/components-long.json";

const recipes = recipesRaw as ComponentRecipe[];

type Tab = "recipes" | "queue" | "analytics" | "quality" | "sources";

const TABS: { id: Tab; label: string }[] = [
  { id: "recipes", label: "Recipe Browser" },
  { id: "queue", label: "Build Queue" },
  { id: "analytics", label: "Demand Analytics" },
  { id: "quality", label: "Quality Modifiers" },
  { id: "sources", label: "Material Sources" },
];

export default function CraftingModule() {
  const [tab, setTab] = useState<Tab>("recipes");

  const { queue, addItem, setQuantity, removeItem, clearQueue } = useBuildQueue();
  const { inventory, setAmount, clearInventory } = useMaterialInventory();

  const aggregated = useMemo(
    () => aggregateMaterials(queue, recipes, inventory),
    [queue, inventory]
  );

  function handleAddToQueue(recipe: ComponentRecipe) {
    addItem({
      blueprint_id: recipe.blueprint_id,
      component_name: recipe.component_name,
      component_type: recipe.component_type,
      size: recipe.size,
    });
  }

  const queueBadge = queue.length > 0 ? queue.length : null;
  const missingCount = aggregated.filter((m) => m.missing > 0).length;

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
            <div className="craft-stat-label">Queue Items</div>
            <div className="craft-stat-value">{queue.reduce((s, i) => s + i.quantity, 0)}</div>
          </div>
          <div className={`craft-stat${missingCount > 0 ? " craft-stat--alert" : ""}`}>
            <div className="craft-stat-label">Shortages</div>
            <div className={`craft-stat-value${missingCount > 0 ? " craft-stat-value--alert" : ""}`}>
              {missingCount}
            </div>
          </div>
        </div>
      </div>

      <div className="craft-tab-bar">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`craft-tab${tab === id ? " craft-tab--active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
            {id === "queue" && queueBadge !== null && (
              <span className="craft-tab-badge">{queueBadge}</span>
            )}
            {id === "queue" && missingCount > 0 && (
              <span className="craft-tab-badge craft-tab-badge--alert">{missingCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="craft-tab-content">
        {tab === "recipes" && (
          <ComponentRecipeTable recipes={recipes} onAddToQueue={handleAddToQueue} />
        )}

        {tab === "queue" && (
          <div className="craft-queue-layout">
            <div className="craft-queue-main">
              <BuildQueuePanel
                queue={queue}
                recipes={recipes}
                onSetQuantity={setQuantity}
                onRemove={removeItem}
                onClear={clearQueue}
              />
              <MissingMaterialsTable materials={aggregated} />
            </div>
            <div className="craft-queue-side">
              <MaterialInventoryPanel
                inventory={inventory}
                needed={aggregated}
                onSetAmount={setAmount}
                onClear={clearInventory}
              />
            </div>
          </div>
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
