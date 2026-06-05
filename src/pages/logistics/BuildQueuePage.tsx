import { useState } from 'react';
import BuildQueueGroup from '../../components/logistics/BuildQueueGroup';
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

      {/* Stat Rail */}
      

      <div className="bq-main">
        <div className="bq-workspace">
          <div className="bq-shell">

            <>
              {categories.length === 0 && completedCategories.length === 0 ? (
                <div className="bq-empty-state">No builds queued yet.</div>
              ) : categories.map((category) => (
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
                />
              ))}
              {completedCategories.length > 0 && (
                <section className="bq-completed-panel" aria-label="Completed crafts">
                  <div className="bq-completed-panel-head">
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
                    />
                  ))}
                </section>
              )}
            </>

          </div>
        </div>

        <QueueLedger ledger={queueLedger} formatValue={formatSummaryNumber} />
      </div>
    </div>
  );
}
