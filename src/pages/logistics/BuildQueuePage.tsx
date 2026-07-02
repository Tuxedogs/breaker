import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BuildQueueGroup from "../../components/logistics/BuildQueueGroup";
import BuildQueueCraftCard from "../../components/logistics/BuildQueueCraftCard";
import {
  readFittingIconMode,
  type FittingIconMode,
} from "../../lib/fitting/fittingIconMode";
import type { SourceStrategy } from "../../lib/logistics/inventory";
import { getQueueLedgerModel } from "../../lib/logistics/queueLedger";
import { useLogisticsStore } from "../../stores/logisticsStore";
import QueueLedger from "../../components/logistics/QueueLedger";
import type { BuildQueueItem } from "../../types/logistics";

import "../../components/logistics/logistics.css";
import "../../components/logistics/build-queue.css";

const MAX_QUEUE_SLOTS = 12;

function formatSummaryNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

type QueueRow = {
  item: BuildQueueItem;
  category: string;
  completed: boolean;
};

function sortQueueItems(items: BuildQueueItem[]) {
  return items.slice().sort(
    (a, b) => Number(b.priorityActive ?? false) - Number(a.priorityActive ?? false) || (a.priority ?? 0) - (b.priority ?? 0),
  );
}

export default function BuildQueuePage() {
  const [sourceStrategy] = useState<SourceStrategy>("minimize-splits");
  const [iconMode] = useState<FittingIconMode>(() => readFittingIconMode());
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const [addCraftOpen, setAddCraftOpen] = useState(false);

  const inventoryEntries = useLogisticsStore((s) => s.inventoryEntries);
  const buildQueue = useLogisticsStore((s) => s.buildQueue);
  const locations = useLogisticsStore((s) => s.locations);
  const materials = useLogisticsStore((s) => s.materialTemplates);
  const recipes = useLogisticsStore((s) => s.recipeTemplates);
  const recipeInputsByRecipeId = useLogisticsStore((s) => s.recipeInputTemplates);
  const updateBuildQueueItemQuantity = useLogisticsStore((s) => s.updateBuildQueueItemQuantity);
  const updateBuildQueueItemAllowLowerQuality = useLogisticsStore((s) => s.updateBuildQueueItemAllowLowerQuality);
  const updateBuildQueueMaterialRequirement = useLogisticsStore((s) => s.updateBuildQueueMaterialRequirement);
  const updateBuildQueueItemStatus = useLogisticsStore((s) => s.updateBuildQueueItemStatus);
  const removeBuildQueueItem = useLogisticsStore((s) => s.removeBuildQueueItem);
  const toggleBuildQueueAllocation = useLogisticsStore((s) => s.toggleBuildQueueAllocation);
  const updateBuildQueueAllocationQuantity = useLogisticsStore((s) => s.updateBuildQueueAllocationQuantity);
  const clearStaleBuildQueueItemAllocations = useLogisticsStore((s) => s.clearStaleBuildQueueItemAllocations);

  const queueLedger = getQueueLedgerModel({ buildQueue, inventoryEntries, materials, recipeInputsByRecipeId });

  const queueRows = useMemo(() => {
    const rows: QueueRow[] = [];
    const active = sortQueueItems(buildQueue.filter((item) => item.status !== "complete"));
    const completed = sortQueueItems(buildQueue.filter((item) => item.status === "complete"));

    for (const item of active) {
      const recipe = recipes.find((entry) => entry.id === item.recipeId);
      rows.push({ item, category: recipe?.category ?? "other", completed: false });
    }
    for (const item of completed) {
      const recipe = recipes.find((entry) => entry.id === item.recipeId);
      rows.push({ item, category: recipe?.category ?? "other", completed: true });
    }
    return rows;
  }, [buildQueue, recipes]);

  const resolvedSelectedItemId = useMemo(() => {
    if (queueRows.length === 0) return null;
    if (selectedItemId && queueRows.some((row) => row.item.id === selectedItemId)) {
      return selectedItemId;
    }
    return queueRows[0]?.item.id ?? null;
  }, [queueRows, selectedItemId]);

  const selectedRow = queueRows.find((row) => row.item.id === resolvedSelectedItemId) ?? null;

  return (
    <div className="bq-page">
      <div className={`bq-layout${summaryCollapsed ? " bq-layout--summary-collapsed" : ""}`}>
        <aside className="bq-queue-col" aria-label="Build queue list">
          <header className="bq-queue-col-head">
            <span className="bq-queue-col-title">
              Queue <em>({queueRows.length}/{MAX_QUEUE_SLOTS})</em>
            </span>
            <div className="bq-add-craft-wrap">
              <button
                type="button"
                className="bq-add-craft-btn"
                aria-expanded={addCraftOpen}
                onClick={() => setAddCraftOpen((open) => !open)}
              >
                Add Craft
              </button>
              {addCraftOpen ? (
                <div className="bq-add-craft-menu" role="menu">
                  <Link className="bq-add-craft-option" to="/industry/crafting" role="menuitem" onClick={() => setAddCraftOpen(false)}>
                    Individual Items
                  </Link>
                  <Link className="bq-add-craft-option" to="/fitting" role="menuitem" onClick={() => setAddCraftOpen(false)}>
                    Ship Fits
                  </Link>
                </div>
              ) : null}
            </div>
          </header>

          <div className="bq-queue-list">
            {queueRows.length === 0 ? (
              <div className="bq-empty-state">No builds queued yet.</div>
            ) : queueRows.map((row, index) => (
              <BuildQueueCraftCard
                key={row.item.id}
                index={index + 1}
                item={row.item}
                category={row.category}
                recipes={recipes}
                recipeInputsByRecipeId={recipeInputsByRecipeId}
                inventory={inventoryEntries}
                locations={locations}
                materials={materials}
                selected={row.item.id === resolvedSelectedItemId}
                iconMode={iconMode}
                onSelect={setSelectedItemId}
                onQuantityChange={updateBuildQueueItemQuantity}
              />
            ))}
          </div>

          <footer className="bq-queue-col-foot">
            <Link className="bq-add-another-btn" to="/industry/crafting">
              + Add Another Craft
            </Link>
          </footer>
        </aside>

        <section className="bq-center-col" aria-label="Selected craft workspace">
          {selectedRow ? (
            <div className="bq-center-shell">
            <BuildQueueGroup
              category={selectedRow.category}
              items={[selectedRow.item]}
              recipes={recipes}
              recipeInputsByRecipeId={recipeInputsByRecipeId}
              buildQueue={buildQueue}
              inventory={inventoryEntries}
              materials={materials}
              locations={locations}
              strategy={sourceStrategy}
              onQuantityChange={updateBuildQueueItemQuantity}
              onAllowLowerQualityChange={updateBuildQueueItemAllowLowerQuality}
              onMaterialRequirementChange={updateBuildQueueMaterialRequirement}
              onStatusChange={updateBuildQueueItemStatus}
              onRemove={removeBuildQueueItem}
              onToggleAllocation={toggleBuildQueueAllocation}
              onUpdateAllocationQuantity={updateBuildQueueAllocationQuantity}
              onClearStaleAllocations={clearStaleBuildQueueItemAllocations}
              iconMode={iconMode}
            />
            </div>
          ) : (
            <div className="bq-empty-state bq-empty-state--center">Select a craft from the queue to begin allocation.</div>
          )}
        </section>

        <QueueLedger
          ledger={queueLedger}
          formatValue={formatSummaryNumber}
          collapsed={summaryCollapsed}
          onToggleCollapse={() => setSummaryCollapsed((value) => !value)}
        />
      </div>
    </div>
  );
}
