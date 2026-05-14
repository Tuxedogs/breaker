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
  const removeBuildQueueItem = useLogisticsStore((s) => s.removeBuildQueueItem);
  const toggleBuildQueueAllocation = useLogisticsStore((s) => s.toggleBuildQueueAllocation);
  const clearStaleBuildQueueItemAllocations = useLogisticsStore((s) => s.clearStaleBuildQueueItemAllocations);

  const queueLedger = getQueueLedgerModel({ buildQueue, inventoryEntries, materials, recipeInputsByRecipeId });

  const grouped = buildQueue.reduce<Partial<Record<string, typeof buildQueue>>>((acc, item) => {
    const recipe = recipes.find((e) => e.id === item.recipeId);
    const category = recipe?.category ?? 'other';
    (acc[category] ??= []).push(item);
    return acc;
  }, {});

  for (const items of Object.values(grouped)) {
    items?.sort((a, b) => Number(b.priorityActive ?? false) - Number(a.priorityActive ?? false) || (a.priority ?? 0) - (b.priority ?? 0));
  }

  const categories = Object.keys(grouped);
  const reservableShortages = queueLedger.summary.reservableLines;
  const materialsNeededCount = queueLedger.refinedShortfallLines.length;


  return (
    <div className="bq-page">

      {/* Stat Rail */}
      

      <div className="bq-main">
        <div className="bq-workspace">
          <div className="bq-shell">

            <div className="bq-shell-header">
              <div>
                <div className="bq-shell-title-row">
                  <span className="bq-shell-kicker">BUILD QUEUE</span>
                  <span className="bq-shell-count">{materialsNeededCount} materials</span>
                </div>
                <h1>Material Shortages</h1>
                <p>Active build demand, stock gaps, and reservation readiness.</p>
              </div>
            </div>

            <div className="bq-summary-grid" aria-label="Build queue summary metrics">
              <div className="bq-summary-card">
                <span>Queued Builds</span>
                <strong>{buildQueue.length}</strong>
                <em>Total build plans</em>
              </div>
              <div className="bq-summary-card bq-summary-card--danger">
                <span>Blocked Builds</span>
                <strong>{buildQueue.filter((item) => item.status !== 'complete').length}</strong>
                <em>Active demand with gaps</em>
              </div>
              <div className="bq-summary-card">
                <span>Materials Needed</span>
                <strong>{materialsNeededCount}</strong>
                <em>Unique shortage materials</em>
              </div>
              <div className="bq-summary-card bq-summary-card--success">
                <span>Ready to Reserve</span>
                <strong>{reservableShortages}</strong>
                <em>Shortage lines with stock</em>
              </div>
            </div>

            <>
              {categories.length === 0 ? (
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
                  onRemove={removeBuildQueueItem}
                  onToggleAllocation={toggleBuildQueueAllocation}
                  onClearStaleAllocations={clearStaleBuildQueueItemAllocations}
                />
              ))}
            </>

          </div>
        </div>

        <QueueLedger ledger={queueLedger} formatValue={formatSummaryNumber} />
      </div>
    </div>
  );
}
