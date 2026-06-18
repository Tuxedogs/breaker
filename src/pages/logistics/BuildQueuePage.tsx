import { useState } from 'react';
import BuildQueueGroup from '../../components/logistics/BuildQueueGroup';
import {
  readFittingIconMode,
  writeFittingIconMode,
  type FittingIconMode,
} from '../../lib/fitting/fittingIconMode';
import type { SourceStrategy } from '../../lib/logistics/inventory';
import { getQueueLedgerModel } from '../../lib/logistics/queueLedger';
import { useLogisticsStore } from '../../stores/logisticsStore';
import QueueLedger from '../../components/logistics/QueueLedger';

import '../../components/logistics/logistics.css';
import '../../components/logistics/build-queue.css';

function formatSummaryNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function BuildQueuePage() {
  const [sourceStrategy] = useState<SourceStrategy>('minimize-splits');
  const [iconMode, setIconMode] = useState<FittingIconMode>(() => readFittingIconMode());

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
  const activeBuildQueue = buildQueue.filter((item) => item.status !== 'complete');
  const completedBuildQueue = buildQueue.filter((item) => item.status === 'complete');

  const groupQueueByCategory = (items: typeof buildQueue) => items.reduce<Partial<Record<string, typeof buildQueue>>>((acc, item) => {
    const recipe = recipes.find((e) => e.id === item.recipeId);
    const category = recipe?.category ?? 'other';
    (acc[category] ??= []).push(item);
    return acc;
  }, {});

  const grouped = groupQueueByCategory(activeBuildQueue);
  const completedGrouped = groupQueueByCategory(completedBuildQueue);

  for (const items of [...Object.values(grouped), ...Object.values(completedGrouped)]) {
    items?.sort((a, b) => Number(b.priorityActive ?? false) - Number(a.priorityActive ?? false) || (a.priority ?? 0) - (b.priority ?? 0));
  }

  const categories = Object.keys(grouped);
  const completedCategories = Object.keys(completedGrouped);

  return (
    <div className="bq-page">
      <div className="bq-main">
        <div className="bq-workspace">
          <div className="bq-shell">
            <header className="bq-stat-rail">
              <div className="bq-stat-rail-title">
                <span className="bq-section-kicker">Crafting Operations</span>
                <h1>Build Queue</h1>
              </div>
              <label className="bq-icon-mode-select">
                <span>Icon Mode</span>
                <select
                  value={iconMode}
                  onChange={(event) => {
                    const nextMode = event.target.value as FittingIconMode;
                    setIconMode(nextMode);
                    writeFittingIconMode(nextMode);
                  }}
                >
                  <option value="auto">Auto</option>
                  <option value="accent">Accent</option>
                  <option value="mono">Mono</option>
                </select>
              </label>
              <div className="bq-stats" aria-label="Build queue summary">
                <span className="bq-stat">
                  <em>Active Crafts</em>
                  <strong>{activeBuildQueue.length}</strong>
                </span>
                <span className="bq-stat bq-stat--success">
                  <em>Completed Crafts</em>
                  <strong>{completedBuildQueue.length}</strong>
                </span>
                <span className="bq-stat bq-stat--alert">
                  <em>Refined Shortfall</em>
                  <strong>{formatSummaryNumber(queueLedger.summary.refinedShortfall)}</strong>
                </span>
                <span className="bq-stat bq-stat--success">
                  <em>Reservable Lines</em>
                  <strong>{queueLedger.summary.reservableLines}</strong>
                </span>
                <span className="bq-stat bq-stat--alert">
                  <em>No Stock Lines</em>
                  <strong>{queueLedger.summary.noStockLines}</strong>
                </span>
              </div>
            </header>

            <div className="bq-queue-content">
              {categories.length === 0 && completedCategories.length === 0 ? (
                <div className="bq-empty-state">No builds queued yet.</div>
              ) : categories.length > 0 && (
                <section className="bq-queue-section" aria-label="Active crafts">
                  <div className="bq-queue-section-head">
                    <span>Active Crafts</span>
                    <strong>{activeBuildQueue.length}</strong>
                  </div>
                  {categories.map((category) => (
                    <BuildQueueGroup
                      key={category}
                      category={category}
                      items={grouped[category] ?? []}
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
                  ))}
                </section>
              )}
              {completedCategories.length > 0 && (
                <section className="bq-queue-section bq-completed-panel" aria-label="Completed crafts">
                  <div className="bq-queue-section-head bq-completed-panel-head">
                    <span>Completed Crafts</span>
                    <strong>{completedBuildQueue.length}</strong>
                  </div>
                  {completedCategories.map((category) => (
                    <BuildQueueGroup
                      key={`completed:${category}`}
                      category={category}
                      items={completedGrouped[category] ?? []}
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
                  ))}
                </section>
              )}
            </div>
          </div>
        </div>

        <QueueLedger ledger={queueLedger} formatValue={formatSummaryNumber} />
      </div>
    </div>
  );
}
