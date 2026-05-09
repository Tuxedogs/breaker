import { useState } from 'react';
import CraftTabBar from '../../components/industry/crafting/CraftTabBar';
import BuildQueueGroup from '../../components/logistics/BuildQueueGroup';
import type { SourceStrategy } from '../../lib/logistics/inventory';
import { formatRequirementQuantity, getBuildQueueItemInputs } from '../../lib/logistics/inventory';
import { getBuildQueueShortageSummary } from '../../lib/logistics/selectors';
import type { Shortage } from '../../lib/logistics/shortages';
import { useLogisticsStore } from '../../stores/logisticsStore';
import QuantityText from '../../components/logistics/QuantityText';


type ShortageGroup = {
  key: string;
  displayName: string;
  unitGroups: ShortageUnitGroup[];
  badges: ShortageRequirementBadge[];
};

type ShortageUnitGroup = {
  unitKey: string;
  have: number;
  needed: number;
  shortfall: number;
  materialId: string;
};

type ShortageRequirementBadge = {
  key: string;
  label: string;
  quantity: number;
  unitType: Shortage['unitType'];
  count: number;
  materialId: string;
};

function normalizeMaterialDisplayName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function getShortageUnitKey(unitType: Shortage['unitType']): string {
  return unitType === 'SCU' || unitType === 'scu' || unitType === 'cscu' ? 'scu' : 'unit';
}

export default function BuildQueuePage() {
  const [sourceStrategy] = useState<SourceStrategy>('minimize-splits');
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
  const requirementBadgesByMaterial = buildQueue.reduce<Record<string, ShortageRequirementBadge[]>>((acc, item) => {
    if (item.status === 'complete') return acc;
    const recipe = recipes.find((entry) => entry.id === item.recipeId);
    const label = recipe?.name ?? item.recipeId;
    const inputs = getBuildQueueItemInputs(item, recipeInputsByRecipeId);

    for (const input of inputs) {
      const materialId = input.materialKey ?? input.materialId;
      const material = materials.find((entry) => entry.id === materialId);
      const displayName = material?.name ?? input.displayName ?? input.materialName ?? materialId;
      const groupKey = normalizeMaterialDisplayName(displayName);
      const unitKey = getShortageUnitKey(input.unitType);
      const badgeKey = `${label}:${unitKey}:${input.selectedQuality ?? 'any'}`;
      const quantity = input.quantity * item.quantity;
      const badges = acc[groupKey] ?? [];
      const existing = badges.find((badge) => badge.key === badgeKey);

      if (existing) {
        existing.quantity += quantity;
        existing.count += 1;
      } else {
        badges.push({
          key: badgeKey,
          label,
          quantity,
          unitType: input.unitType,
          count: 1,
          materialId,
        });
      }
      acc[groupKey] = badges;
    }

    return acc;
  }, {});
  const groupedShortages = shortages.reduce<ShortageGroup[]>((groups, shortage) => {
    const material = materials.find((item) => item.id === shortage.materialId);
    const displayName = material?.name ?? shortage.materialId;
    const groupKey = normalizeMaterialDisplayName(displayName);
    const unitKey = getShortageUnitKey(shortage.unitType);
    let group = groups.find((entry) => entry.key === groupKey);
    if (!group) {
      group = {
        key: groupKey,
        displayName,
        unitGroups: [],
        badges: requirementBadgesByMaterial[groupKey] ?? [],
      };
      groups.push(group);
    }
    let unitGroup = group.unitGroups.find((entry) => entry.unitKey === unitKey);
    if (!unitGroup) {
      unitGroup = {
        unitKey,
        have: 0,
        needed: 0,
        shortfall: 0,
        materialId: shortage.materialId,
      };
      group.unitGroups.push(unitGroup);
    }
    unitGroup.have += shortage.have;
    unitGroup.needed += shortage.needed;
    unitGroup.shortfall += shortage.shortfall;
    return groups;
  }, []);
  const sortedShortageGroups = [...groupedShortages].sort((a, b) => {
    const aShortfall = a.unitGroups.reduce((sum, group) => sum + group.shortfall, 0);
    const bShortfall = b.unitGroups.reduce((sum, group) => sum + group.shortfall, 0);
    return bShortfall - aShortfall || a.displayName.localeCompare(b.displayName);
  });
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
  const activeQueueCount = shortageSummary.activeQueueItems.length;
  const totalQueueQuantity = buildQueue.reduce((sum, item) => sum + item.quantity, 0);
  const totalShortfall = shortageSummary.totalShortfallQuantity;
  const totalRequirementLines = buildQueue.reduce((sum, item) => {
    if (item.status === 'complete') return sum;
    return sum + getBuildQueueItemInputs(item, recipeInputsByRecipeId).length;
  }, 0);

  return (
    <div className="logi-page logi-build-queue-page">

      <CraftTabBar activeTab="queue" missingCount={shortages.length} queueBadge={buildQueue.length > 0 ? buildQueue.length : null} />

      <section className="queue-detail">
        <div className="build-overview">
          <div className="build-overview-copy">
            <span className="build-overview-kicker">Operational Hub</span>
            <h1 className="build-overview-title">Build Queue</h1>
            <p className="build-overview-text">Resolve shortages, tune material quality, and reserve inventory before moving sourcing decisions to mining.</p>
          </div>
          <div className="build-overview-stats" aria-label="Build queue overview">
            <span><em>Active Items</em><strong>{activeQueueCount}</strong></span>
            <span><em>Total Qty</em><strong>{totalQueueQuantity}</strong></span>
            <span><em>Material Lines</em><strong>{totalRequirementLines}</strong></span>
            <span className={totalShortfall > 0 ? 'is-missing' : ''}><em>Shortfall</em><strong><QuantityText value={formatRequirementQuantity(totalShortfall, 'unit', undefined)} /></strong></span>
          </div>
        </div>

      <div className="build-shortage-panel logi-shortage-section">
        <div className="build-shortage-header logi-shortage-header">
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
          <div className="logi-shortage-compact-list">
            <div className="logi-shortage-ledger-head" aria-hidden="true">
              <span>Material</span>
              <span>Owned</span>
              <span>Needed</span>
              <span>Short</span>
              <span>Used By</span>
            </div>
            {sortedShortageGroups.map((group) => (
              <article className="build-shortage-row logi-shortage-compact-row" key={`shortage-group:${group.key}`}>
                <div className="logi-shortage-compact-name">{group.displayName}</div>
                <div className="logi-shortage-ledger-cell">
                  {group.unitGroups.map((unitGroup) => {
                    const material = materials.find((item) => item.id === unitGroup.materialId);
                    const unitType = unitGroup.unitKey === 'scu' ? 'scu' : 'unit';
                    return (
                      <span key={`${group.key}:${unitGroup.unitKey}:owned`}><QuantityText value={formatRequirementQuantity(unitGroup.have, unitType, material)} /></span>
                    );
                  })}
                </div>
                <div className="logi-shortage-ledger-cell">
                  {group.unitGroups.map((unitGroup) => {
                    const material = materials.find((item) => item.id === unitGroup.materialId);
                    const unitType = unitGroup.unitKey === 'scu' ? 'scu' : 'unit';
                    return (
                      <span key={`${group.key}:${unitGroup.unitKey}:needed`}><QuantityText value={formatRequirementQuantity(unitGroup.needed, unitType, material)} /></span>
                    );
                  })}
                </div>
                <div className="logi-shortage-ledger-cell logi-shortage-compact-missing">
                  {group.unitGroups.map((unitGroup) => {
                    const material = materials.find((item) => item.id === unitGroup.materialId);
                    const unitType = unitGroup.unitKey === 'scu' ? 'scu' : 'unit';
                    return (
                      <span key={`${group.key}:${unitGroup.unitKey}:short`}><QuantityText value={formatRequirementQuantity(unitGroup.shortfall, unitType, material)} /></span>
                    );
                  })}
                </div>
                <div className="logi-shortage-compact-refs" aria-label={`${group.displayName} requirement entries`}>
                  {group.badges.map((badge) => {
                    const material = materials.find((item) => item.id === badge.materialId);
                    return (
                      <span className="logi-shortage-ref-badge" key={badge.key}>
                        <span className="logi-shortage-ref-name">
                          {badge.label}{badge.count > 1 ? ` x${badge.count}` : ''}:
                        </span>
                        <QuantityText value={formatRequirementQuantity(badge.quantity, badge.unitType, material)} />
                      </span>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="build-category-list logi-bq-section">
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
      </section>
    </div>
  );
}
