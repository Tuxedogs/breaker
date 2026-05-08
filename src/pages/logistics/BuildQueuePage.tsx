import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CraftTabBar from '../../components/industry/crafting/CraftTabBar';
import BuildQueueGroup from '../../components/logistics/BuildQueueGroup';
import { qualityToRarity } from '../../components/logistics/BuildQueueGroup';
import type { SourceStrategy } from '../../lib/logistics/inventory';
import { formatQuantity } from '../../lib/logistics/inventory';
import { getBuildQueueShortageSummary } from '../../lib/logistics/selectors';
import type { Shortage } from '../../lib/logistics/shortages';
import { useLogisticsStore } from '../../stores/logisticsStore';
import ScreenshotImportButton from '../../components/logistics/ScreenshotImportButton';
import { getBuildQueueRequirements } from '../../features/buildQueue/buildQueueRequirementsApi';
import QuantityText from '../../components/logistics/QuantityText';


type ShortageGroup = {
  materialId: string;
  have: number;
  needed: number;
  shortfall: number;
  rows: Shortage[];
};

function formatCompactShortageQuantity(quantity: number): string {
  const roundedQuantity = Math.round(Math.abs(quantity) * 100) / 100;
  const displayQuantity = Number.isInteger(roundedQuantity)
    ? String(roundedQuantity)
    : roundedQuantity.toFixed(2).replace(/\.?0+$/, '');

  return `${quantity < 0 ? '-' : ''}${displayQuantity}`;
}

export default function BuildQueuePage() {
  const [sourceStrategy] = useState<SourceStrategy>('minimize-splits');
  const [serverRequirementWarningCount, setServerRequirementWarningCount] = useState(0);
  const [expandedShortageGroups, setExpandedShortageGroups] = useState<Set<string>>(new Set());
  const inventoryEntries = useLogisticsStore((state) => state.inventoryEntries);
  const buildQueue = useLogisticsStore((state) => state.buildQueue);
  const locations = useLogisticsStore((state) => state.locations);
  const materials = useLogisticsStore((state) => state.materialTemplates);
  const recipes = useLogisticsStore((state) => state.recipeTemplates);
  const recipeInputsByRecipeId = useLogisticsStore((state) => state.recipeInputTemplates);
  const updateBuildQueueItemQuantity = useLogisticsStore((state) => state.updateBuildQueueItemQuantity);
  const updateBuildQueueItemAllowLowerQuality = useLogisticsStore((state) => state.updateBuildQueueItemAllowLowerQuality);
  const updateBuildQueueMaterialRequirement = useLogisticsStore((state) => state.updateBuildQueueMaterialRequirement);
  const removeBuildQueueItem = useLogisticsStore((state) => state.removeBuildQueueItem);
  const toggleBuildQueueAllocation = useLogisticsStore((state) => state.toggleBuildQueueAllocation);
  const clearStaleBuildQueueItemAllocations = useLogisticsStore((state) => state.clearStaleBuildQueueItemAllocations);
  const shortageSummary = getBuildQueueShortageSummary(inventoryEntries, buildQueue, recipes, recipeInputsByRecipeId);
  const shortages = shortageSummary.shortages;
  const groupedShortages = shortages.reduce<ShortageGroup[]>((groups, shortage) => {
    let group = groups.find((entry) => entry.materialId === shortage.materialId);
    if (!group) {
      group = {
        materialId: shortage.materialId,
        have: 0,
        needed: 0,
        shortfall: 0,
        rows: [],
      };
      groups.push(group);
    }
    group.have += shortage.have;
    group.needed += shortage.needed;
    group.shortfall += shortage.shortfall;
    group.rows.push(shortage);
    return groups;
  }, []);
  const grouped = buildQueue.reduce<Partial<Record<string, typeof buildQueue>>>((acc, item) => {
    const recipe = recipes.find((entry) => entry.id === item.recipeId);
    const category = recipe?.category ?? 'other';
    (acc[category] ??= []).push(item);
    return acc;
  }, {});

  for (const items of Object.values(grouped)) {
    items?.sort((a, b) => Number(b.priorityActive ?? false) - Number(a.priorityActive ?? false) || (a.priority ?? 0) - (b.priority ?? 0));
  }
  const categories = Object.keys(grouped);

  function toggleShortageGroup(groupKey: string) {
    setExpandedShortageGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    getBuildQueueRequirements({ buildQueue, recipeInputTemplates: recipeInputsByRecipeId, inventoryEntries })
      .then((response) => {
        if (!cancelled) setServerRequirementWarningCount(response.warnings.length);
      })
      .catch(() => {
        if (!cancelled) setServerRequirementWarningCount(1);
      });
    return () => {
      cancelled = true;
    };
  }, [buildQueue, inventoryEntries, recipeInputsByRecipeId]);

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
            {serverRequirementWarningCount > 0 ? ` / ${serverRequirementWarningCount} requirement warning${serverRequirementWarningCount === 1 ? '' : 's'}` : ''}
          </p>
        </div>
        <ScreenshotImportButton source="build-queue" />
      </div>

      <CraftTabBar activeTab="queue" missingCount={shortages.length} queueBadge={buildQueue.length > 0 ? buildQueue.length : null} />

      <div className="logi-shortage-section">
        <div className="logi-shortage-header">
          <span className="logi-shortage-title">Material Shortages</span>
          {groupedShortages.length > 0 && <span className="logi-shortage-alert-count">{groupedShortages.length} materials</span>}
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
              {groupedShortages.map((group) => {
                const material = materials.find((item) => item.id === group.materialId);
                const groupKey = group.materialId;
                const isExpanded = expandedShortageGroups.has(groupKey);
                return (
                  <Fragment key={`shortage-group:${groupKey}`}>
                    <tr
                      className="logi-shortage-parent-row"
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onClick={() => toggleShortageGroup(groupKey)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          toggleShortageGroup(groupKey);
                        }
                      }}
                    >
                      <td>
                        <span className="logi-shortage-parent-material">
                          <button
                            type="button"
                            className="logi-shortage-toggle"
                            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${material?.name ?? group.materialId}`}
                            aria-expanded={isExpanded}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleShortageGroup(groupKey);
                            }}
                          >
                            <span className="logi-shortage-caret" aria-hidden="true" />
                          </button>
                          <span>{material?.name ?? group.materialId}</span>
                        </span>
                      </td>
                      <td><QuantityText value={formatQuantity(group.have, material)} /></td>
                      <td><QuantityText value={formatQuantity(group.needed, material)} /></td>
                      <td><span className="logi-badge logi-badge--shortage"><QuantityText value={formatQuantity(-group.shortfall, material)} /></span></td>
                    </tr>
                    {isExpanded && group.rows.map((shortage, index) => {
                      const rarityClassName = shortage.selectedQuality === undefined
                        ? ''
                        : ` logi-rarity--${qualityToRarity(shortage.selectedQuality, material?.isQuantanium)}`;
                      return (
                        <tr
                          key={`shortage:${shortage.materialKey}:${shortage.selectedQuality ?? 'any'}:${shortage.unitType ?? 'unit'}:${index}`}
                          className={`logi-shortage-child-row${rarityClassName}`}
                        >
                          <td>{shortage.selectedQuality ?? 'Any'}</td>
                          <td>{formatCompactShortageQuantity(shortage.have)}</td>
                          <td>{formatCompactShortageQuantity(shortage.needed)}</td>
                          <td>{formatCompactShortageQuantity(-shortage.shortfall)}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
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
            onQuantityChange={updateBuildQueueItemQuantity}
            onAllowLowerQualityChange={updateBuildQueueItemAllowLowerQuality}
            onMaterialRequirementChange={updateBuildQueueMaterialRequirement}
            onRemove={removeBuildQueueItem}
            onToggleAllocation={toggleBuildQueueAllocation}
            onClearStaleAllocations={clearStaleBuildQueueItemAllocations}
          />
        ))}
      </div>
    </div>
  );
}
