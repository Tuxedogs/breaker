import { useState } from 'react';
import { Link } from 'react-router-dom';
import CraftTabBar from '../../components/industry/crafting/CraftTabBar';
import BuildQueueGroup from '../../components/logistics/BuildQueueGroup';
import type { SourceStrategy } from '../../lib/logistics/inventory';
import { getInventoryUnitLabel } from '../../lib/logistics/inventory';
import { getBuildQueueShortageSummary } from '../../lib/logistics/selectors';
import { useLogisticsStore } from '../../stores/logisticsStore';
import ScreenshotImportButton from '../../components/logistics/ScreenshotImportButton';


export default function BuildQueuePage() {
  const [sourceStrategy] = useState<SourceStrategy>('minimize-splits');
  const inventoryEntries = useLogisticsStore((state) => state.inventoryEntries);
  const buildQueue = useLogisticsStore((state) => state.buildQueue);
  const locations = useLogisticsStore((state) => state.locations);
  const materials = useLogisticsStore((state) => state.materialTemplates);
  const recipes = useLogisticsStore((state) => state.recipeTemplates);
  const recipeInputsByRecipeId = useLogisticsStore((state) => state.recipeInputTemplates);
  const updateBuildQueueItemPriority = useLogisticsStore((state) => state.updateBuildQueueItemPriority);
  const removeBuildQueueItem = useLogisticsStore((state) => state.removeBuildQueueItem);
  const toggleBuildQueueAllocation = useLogisticsStore((state) => state.toggleBuildQueueAllocation);
  const updateBuildQueueAllocationQuantity = useLogisticsStore((state) => state.updateBuildQueueAllocationQuantity);
  const clearBuildQueueItemAllocations = useLogisticsStore((state) => state.clearBuildQueueItemAllocations);
  const clearStaleBuildQueueItemAllocations = useLogisticsStore((state) => state.clearStaleBuildQueueItemAllocations);
  const shortageSummary = getBuildQueueShortageSummary(inventoryEntries, buildQueue, recipes, recipeInputsByRecipeId);
  const shortages = shortageSummary.shortages;
  const grouped = buildQueue.reduce<Partial<Record<string, typeof buildQueue>>>((acc, item) => {
    const recipe = recipes.find((entry) => entry.id === item.recipeId);
    const category = recipe?.category ?? 'other';
    (acc[category] ??= []).push(item);
    return acc;
  }, {});

  for (const items of Object.values(grouped)) items?.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  const categories = Object.keys(grouped);

  return (
    <div className="logi-page">
      <div className="logi-page-header">
        <div>
          <div className="logi-breadcrumb">
            <Link to="/logistics" className="logi-breadcrumb-link">Logistics</Link>
            <span className="logi-breadcrumb-sep">/</span>
            <span className="logi-breadcrumb-active">Build Queue</span>
          </div>
          <h1 className="logi-page-title">Build Queue</h1>
          <p className="logi-page-subtitle">
            {buildQueue.length} items / {shortages.length} material {shortages.length === 1 ? 'shortage' : 'shortages'}
          </p>
        </div>
        <ScreenshotImportButton source="build-queue" />
      </div>

      <CraftTabBar activeTab="queue" missingCount={shortages.length} queueBadge={buildQueue.length > 0 ? buildQueue.length : null} />

      <div className="logi-shortage-section">
        <div className="logi-shortage-header">
          <span className="logi-shortage-title">Material Shortages</span>
          {shortages.length > 0 && <span className="logi-shortage-alert-count">{shortages.length} materials</span>}
        </div>
        {shortages.length === 0 ? (
          <div className="logi-shortage-no-items">
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            All materials covered for active builds.
          </div>
        ) : (
          <table className="logi-shortage-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Owned</th>
                <th>Needed</th>
                <th>Shortfall</th>
              </tr>
            </thead>
            <tbody>
              {shortages.map((shortage) => {
                const material = materials.find((item) => item.id === shortage.materialId);
                const fmt = (quantity: number) => getInventoryUnitLabel(material) === 'count' ? `${quantity}x` : `${quantity.toFixed(2)} ${getInventoryUnitLabel(material)}`;
                return (
                  <tr key={shortage.materialId}>
                    <td>{material?.name ?? shortage.materialId}</td>
                    <td>{fmt(shortage.have)}</td>
                    <td>{fmt(shortage.needed)}</td>
                    <td><span className="logi-badge logi-badge--shortage">-{fmt(shortage.shortfall)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="logi-bq-section">
        <div className="logi-section-label">Queue by Category</div>
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
            onPriorityChange={updateBuildQueueItemPriority}
            onRemove={removeBuildQueueItem}
            onToggleAllocation={toggleBuildQueueAllocation}
            onUpdateAllocationQuantity={updateBuildQueueAllocationQuantity}
            onClearAllocations={clearBuildQueueItemAllocations}
            onClearStaleAllocations={clearStaleBuildQueueItemAllocations}
          />
        ))}
      </div>
    </div>
  );
}
