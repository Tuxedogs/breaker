import { useState } from 'react';
import BuildQueueGroup from '../../components/logistics/BuildQueueGroup';
import type { SourceStrategy } from '../../lib/logistics/inventory';
import { getBuildQueueItemInputs } from '../../lib/logistics/inventory';
import { getBuildQueueShortageSummary } from '../../lib/logistics/selectors';
import type { Shortage } from '../../lib/logistics/shortages';
import { useLogisticsStore } from '../../stores/logisticsStore';
import MaterialIcon from '../../components/logistics/MaterialIcon';

import '../../components/logistics/logistics.css';
import '../../components/logistics/build-queue.css';

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

  const shortageSummary = getBuildQueueShortageSummary(inventoryEntries, buildQueue, recipes, recipeInputsByRecipeId);
  const shortages = shortageSummary.shortages;

  const requirementBadgesByMaterial = buildQueue.reduce<Record<string, ShortageRequirementBadge[]>>((acc, item) => {
    if (item.status === 'complete') return acc;
    const recipe = recipes.find((e) => e.id === item.recipeId);
    const label = recipe?.name ?? item.itemName ?? item.recipeId;
    const inputs = getBuildQueueItemInputs(item, recipeInputsByRecipeId);
    for (const input of inputs) {
      const materialId = input.materialKey ?? input.materialId;
      const material = materials.find((e) => e.id === materialId);
      const displayName = material?.name ?? input.displayName ?? input.materialName ?? materialId;
      const groupKey = normalizeMaterialDisplayName(displayName);
      const unitKey = getShortageUnitKey(input.unitType);
      const badgeKey = `${label}:${unitKey}:${input.selectedQuality ?? 'any'}`;
      const quantity = input.quantity * item.quantity;
      const badges = acc[groupKey] ?? [];
      const existing = badges.find((b) => b.key === badgeKey);
      if (existing) { existing.quantity += quantity; existing.count += 1; }
      else badges.push({ key: badgeKey, label, quantity, unitType: input.unitType, count: 1, materialId });
      acc[groupKey] = badges;
    }
    return acc;
  }, {});

  const groupedShortages = shortages.reduce<ShortageGroup[]>((groups, shortage) => {
    const material = materials.find((m) => m.id === shortage.materialId);
    const displayName = material?.name ?? shortage.materialId;
    const groupKey = normalizeMaterialDisplayName(displayName);
    const unitKey = getShortageUnitKey(shortage.unitType);
    let group = groups.find((g) => g.key === groupKey);
    if (!group) {
      group = { key: groupKey, displayName, unitGroups: [], badges: requirementBadgesByMaterial[groupKey] ?? [] };
      groups.push(group);
    }
    let unitGroup = group.unitGroups.find((u) => u.unitKey === unitKey);
    if (!unitGroup) {
      unitGroup = { unitKey, have: 0, needed: 0, shortfall: 0, materialId: shortage.materialId };
      group.unitGroups.push(unitGroup);
    }
    unitGroup.have += shortage.have;
    unitGroup.needed += shortage.needed;
    unitGroup.shortfall += shortage.shortfall;
    return groups;
  }, []);

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
  const reservableShortages = shortages.filter((shortage) => shortage.have > 0).length;
  const noStockShortages = shortages.filter((shortage) => shortage.have <= 0).length;
  const materialsNeededCount = groupedShortages.length;
  const totalShortageDisplay = formatSummaryNumber(shortageSummary.totalShortfallQuantity);


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
            <span className="bq-shell-count">{groupedShortages.length} materials</span>
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
          <strong>{shortageSummary.activeQueueItems.length}</strong>
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

      {/* Shortage Panel */}
      <div className="bq-shortage-panel">
        <div className="bq-shortage-panel-head">
          <div className="bq-shortage-panel-head-left">
            <span>Material Shortages</span>
            {groupedShortages.length > 0 && (
              <span className="bq-shortage-count">{groupedShortages.length} materials</span>
            )}
          </div>
        </div>

        {shortages.length === 0 && (
          <div className="bq-shortage-all-clear">All materials covered for active builds.</div>
        )}
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
        <aside className="bq-ledger-panel" aria-label="Queue Ledger">
          <div className="bq-ledger-title">Queue Ledger</div>
          <div className="bq-ledger-stat bq-ledger-stat--danger">
            <span>Total Shortfall</span>
            <strong>{totalShortageDisplay}</strong>
          </div>
          <div className="bq-ledger-stat bq-ledger-stat--success">
            <span>Reservable Lines</span>
            <strong>{reservableShortages}</strong>
          </div>
          <div className="bq-ledger-stat bq-ledger-stat--danger">
            <span>No Stock Lines</span>
            <strong>{noStockShortages}</strong>
          </div>
          <div className="bq-ledger-title">Material Breakdown</div>
          {groupedShortages.map((group) => (
            <div className="bq-ledger-stat bq-ledger-stat--danger" key={`ledger:${group.key}`}>
              <span className="bq-material-name-cell">
                <MaterialIcon materialName={group.displayName} size={17} />
                <span>{group.displayName}</span>
              </span>
              <strong>{formatSummaryNumber(group.unitGroups.reduce((sum, unitGroup) => sum + unitGroup.shortfall, 0))}</strong>
            </div>
          ))}
        </aside>
        </div>
      </div>
    </div>
  );
}
