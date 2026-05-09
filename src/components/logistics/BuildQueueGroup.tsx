import { useMemo, useState } from 'react';
import type { BuildQueueItem, InventoryEntry, InventoryLocation, MaterialTemplate, RecipeTemplate, ReservedMaterialAllocation } from '../../types/logistics';
import type { RecipeInputTemplate } from '../../data/logistics/seed';
import { formatQuantity, formatRequirementQuantity, getBuildQueueItemInputs, getInventoryStacks, getRecipeForQueueItem, materialTypeClass, rarityClass, type InventoryStack, type SourceStrategy } from '../../lib/logistics/inventory';
import {
  getAvailableQuantityForInventoryEntry,
  allocationMatchesRequirement,
  getBuildQueueMaterialNeedSummary,
  getMaterialReservationCoverage,
  isInventoryEntryEligibleForRequirement,
} from '../../lib/logistics/selectors';
import { FALLBACK_QUALITY_BANDS, findNearestBandForQuality, getBandEffectiveQuality, rarityClassFromBandIndex, rarityFromBandIndex, type QualityBand } from '../industry/crafting/utils/qualityBands';
import { formatModifierAtQuality, formatProperty, getModifiersAtQuality } from '../industry/crafting/utils/qualityModifiers';
import { getDirectionLabel, getModifierImpact } from '../../lib/gameplay/propertyUtils';
import QuantityText from './QuantityText';

function QtyStepBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="logi-bq-qty-step" onClick={onClick} disabled={disabled} aria-label={String(children)}>
      {children}
    </button>
  );
}

function getImpactClass(impact: 'good' | 'bad' | 'neutral'): string {
  if (impact === 'good') return 'craft-matq-mod-val--good';
  if (impact === 'bad') return 'craft-matq-mod-val--bad';
  return 'craft-matq-mod-val--neutral';
}

function getImpactWord(impact: 'good' | 'bad' | 'neutral'): string {
  if (impact === 'good') return '▲';
  if (impact === 'bad') return '▼';
  return '';
}

function getSavedBandIndex(input: RecipeInputTemplate, qualityBands: QualityBand[]): number | null {
  const bandNumber = input.qualityBand;
  if (!Number.isFinite(bandNumber)) return null;
  return Math.max(0, Math.min(Math.trunc(bandNumber as number) - 1, qualityBands.length - 1));
}

interface Props {
  category: string;
  items: BuildQueueItem[];
  recipes: RecipeTemplate[];
  recipeInputsByRecipeId: Record<string, RecipeInputTemplate[]>;
  buildQueue: BuildQueueItem[];
  inventory: InventoryEntry[];
  materials: MaterialTemplate[];
  locations: InventoryLocation[];
  strategy: SourceStrategy;
  onQuantityChange: (id: string, quantity: number) => void;
  onAllowLowerQualityChange: (id: string, allowLowerQuality: boolean) => void;
  onMaterialRequirementChange: (id: string, requirementId: string, input: RecipeInputTemplate) => void;
  onRemove: (id: string) => void;
  onToggleAllocation: (buildQueueItemId: string, allocation: ReservedMaterialAllocation) => void;
  onClearStaleAllocations: (buildQueueItemId: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  component: 'Component',
  weapon: 'Weapon',
  armor: 'Armor',
  consumable: 'Consumable',
  ship_part: 'Ship Part',
  other: 'Other',
};

const COVERAGE_LABELS = {
  covered: 'Covered',
  partial: 'Partial',
  missing: 'Missing',
  overReserved: 'Over-reserved',
  stale: 'Stale',
};

const STALE_REASON_LABELS: Record<string, string> = {
  missingStack: 'missing stack',
  mismatchedMaterial: 'material changed',
  nonPositiveQuantity: 'empty reservation',
  exceedsStackQuantity: 'exceeds current stack',
};

function sortStacks(stacks: InventoryStack[], strategy: SourceStrategy): InventoryStack[] {
  return stacks.slice().sort((a, b) => {
    if (strategy === 'highest-quality') return (b.quality ?? 0) - (a.quality ?? 0) || b.quantity - a.quantity;
    if (strategy === 'minimize-splits') return b.quantity - a.quantity || (b.quality ?? 0) - (a.quality ?? 0);
    return (a.location?.name ?? a.locationId ?? '').localeCompare(b.location?.name ?? b.locationId ?? '') || b.quantity - a.quantity;
  });
}

function getAllocationId(
  itemId: string,
  requirementId: string,
  materialId: string,
  selectedQuality: number | undefined,
  unitType: RecipeInputTemplate['unitType'] | undefined,
  stack: InventoryStack,
): string {
  return [
    itemId,
    requirementId,
    materialId,
    selectedQuality ?? 'any',
    unitType ?? 'unit',
    stack.id,
  ].join(':');
}

function createAllocation(
  itemId: string,
  requirementId: string,
  selectedQuality: number | undefined,
  unitType: RecipeInputTemplate['unitType'] | undefined,
  stack: InventoryStack,
  materialName: string | undefined,
  quantityReserved: number,
  allowLowerQualityOverride = false,
): ReservedMaterialAllocation {
  if (!stack.materialId) throw new Error('Cannot allocate inventory stack without a materialId');
  return {
    id: getAllocationId(itemId, requirementId, stack.materialId, selectedQuality, unitType, stack),
    materialId: stack.materialId,
    requirementId,
    inventoryEntryId: stack.id,
    quantityReserved,
    materialName,
    selectedQuality,
    quality: stack.quality,
    qualityBand: stack.qualityBand,
    rarity: stack.rarity,
    locationId: stack.locationId,
    container: stack.container,
    unitType,
    allowLowerQualityOverride,
  };
}

function getItemFulfillmentState(
  item: BuildQueueItem,
  inputs: RecipeInputTemplate[],
  inventory: InventoryEntry[],
): 'complete' | 'partial' | 'missing' {
  if (inputs.length === 0) return 'missing';
  let anyMissing = false;
  let anyCovered = false;
  for (const input of inputs) {
    const materialKey = input.materialKey ?? input.materialId;
    const required = input.quantity * item.quantity;
    const coverage = getMaterialReservationCoverage(item, materialKey, required, inventory);
    if (coverage.coverageState === 'covered' || coverage.coverageState === 'overReserved') {
      anyCovered = true;
    } else if (coverage.coverageState === 'missing') {
      anyMissing = true;
    } else {
      anyMissing = true;
      anyCovered = true;
    }
  }
  if (anyCovered && anyMissing) return 'partial';
  if (anyCovered) return 'complete';
  return 'missing';
}

const FULFILLMENT_BADGE_CLASS: Record<'complete' | 'partial' | 'missing', string> = {
  complete: 'logi-badge--complete',
  partial: 'logi-badge--paused',
  missing: 'logi-badge--shortage',
};

const FULFILLMENT_LABELS: Record<'complete' | 'partial' | 'missing', string> = {
  complete: 'Covered',
  partial: 'Partial',
  missing: 'Missing',
};

type BuildQueueSummaryMetrics = {
  coveredCount: number;
  totalRequired: number;
  totalOwned: number;
  totalAvailable: number;
  totalShortfall: number;
  missingRequirementCount: number;
  unavailableCount: number;
  shortageNames: string[];
};

/** Quality slider panel mirroring the craft-matq-* slider from ComponentRecipeTable */
function MaterialQualitySlider({
  input,
  draftBandIndex,
  onBandChange,
}: {
  input: RecipeInputTemplate;
  draftBandIndex: number;
  onBandChange: (bandIndex: number) => void;
}) {
  const qualityBands = input.qualityBands?.length ? input.qualityBands : FALLBACK_QUALITY_BANDS;
  const safeBandIndex = Math.max(0, Math.min(draftBandIndex, qualityBands.length - 1));
  const selectedQualityTierClass = rarityClassFromBandIndex(safeBandIndex + 1);
  const quality = getBandEffectiveQuality(qualityBands, safeBandIndex);

  const atQuality = useMemo(() => {
    const mods = getModifiersAtQuality(input.qualityModifiers ?? [], quality);
    return [...mods].sort((a, b) => {
      const order = (p: string) =>
        p === 'WeaponRecoilKick' ? 0 : p === 'WeaponRecoilSmoothness' ? 1 : 2;
      return order(a.property) - order(b.property);
    });
  }, [input.qualityModifiers, quality]);

  const railMarkers = useMemo(
    () =>
      qualityBands.map((band, i) => {
        const mappedValue = Number(band.mappedValue ?? 0);
        const left = Math.max(0, Math.min(100, (mappedValue / 1000) * 100));
        const edge = left < 4 ? 'start' : left > 96 ? 'end' : 'middle';
        return { index: i, mappedValue, left, edge };
      }),
    [qualityBands],
  );
  const bandOnePct = Math.max(0, Math.min(100, railMarkers[0]?.left ?? 0));
  const selectedPct = Math.max(0, Math.min(100, (quality / 1000) * 100));
  const fillPct = Math.max(0, selectedPct - bandOnePct);

  return (
    <div className="craft-matq-card" data-band={safeBandIndex}>
      <div className="craft-matq-header">
        <div className="craft-matq-identity">
          <span className="craft-matq-name">{input.displayName ?? input.materialName ?? input.materialId}</span>
        </div>
        <div className="craft-matq-quality-header">
          <span className="craft-matq-quality-label">Band {safeBandIndex + 1}</span>
          <span className={`craft-matq-quality-value ${selectedQualityTierClass}`}>{quality}</span>
        </div>
      </div>

      <div className="craft-matq-slider-wrap">
        <div className="craft-matq-rail-wrap">
          <input
            type="range"
            min={0}
            max={1000}
            step={1}
            value={quality}
            onChange={(e) => {
              const nearest = findNearestBandForQuality(qualityBands, Number(e.target.value));
              onBandChange(nearest);
            }}
            className="craft-matq-slider"
            aria-label={`Quality band for ${input.displayName ?? input.materialName}`}
          />
          <div
            className={`craft-matq-rail ${selectedQualityTierClass}`}
            style={{ '--band-one-pct': `${bandOnePct}%` } as any}
          >
            <div
              className={`craft-matq-rail-fill ${selectedQualityTierClass}`}
              style={{ '--band-one-pct': `${bandOnePct}%`, '--fill-pct': `${fillPct}%` } as any}
            />
            {railMarkers.map((marker) => {
              const markerTierClass = rarityClassFromBandIndex(marker.index + 1);
              return (
                <button
                  type="button"
                  key={`${marker.index}-${marker.mappedValue}`}
                  className={`craft-matq-band-marker ${markerTierClass}${marker.index === safeBandIndex ? ' is-active' : ''}`}
                  style={{ left: `${marker.left}%` }}
                  data-edge={marker.edge}
                  onClick={() => onBandChange(marker.index)}
                  aria-label={`Use mapped quality ${marker.mappedValue}`}
                >
                  {marker.index === safeBandIndex ? (
                    <span className="craft-matq-dot" />
                  ) : (
                    marker.mappedValue > quality && <span className="craft-matq-threshold-dot" />
                  )}
                  <span className={`craft-matq-marker-value ${markerTierClass}`}>{marker.mappedValue}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {atQuality.length > 0 && (
        <div className="craft-matq-mods">
          {atQuality.map((m, i) => {
            const impact = getModifierImpact(m.property, m.value);
            const directionLabel = getDirectionLabel(m.property);
            return (
              <div key={i} className="craft-matq-mod-card">
                <div className="craft-matq-mod-top">
                  <span className="craft-matq-mod-prop">{formatProperty(m.property)}</span>
                  <span className={`craft-matq-mod-val ${getImpactClass(impact)} ${selectedQualityTierClass}`}>
                    {formatModifierAtQuality(m)}{getImpactWord(impact) ? ` ${getImpactWord(impact)}` : ''}
                  </span>
                  {directionLabel && <span className="craft-matq-mod-hint">{directionLabel}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function BuildQueueGroup({
  category,
  items,
  recipes,
  recipeInputsByRecipeId,
  buildQueue,
  inventory,
  materials,
  locations,
  strategy,
  onQuantityChange,
  onAllowLowerQualityChange,
  onMaterialRequirementChange,
  onRemove,
  onToggleAllocation,
  onClearStaleAllocations,
}: Props) {
  // editingItemId: which queue item has quality editing open
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  // draft band indices: itemId:requirementId -> bandIndex
  const [draftBandIndices, setDraftBandIndices] = useState<Record<string, number>>({});
  const [expandedLowerQuality, setExpandedLowerQuality] = useState<Record<string, boolean>>({});

  function openEdit(item: BuildQueueItem, inputs: RecipeInputTemplate[]) {
    // Initialise draft indices from current selected qualities
    const initial: Record<string, number> = {};
    inputs.forEach((input, inputIndex) => {
      const materialKey = input.materialKey ?? input.materialId;
      const requirementId = input.requirementId ?? `${item.id}:${inputIndex}:${materialKey}:${input.modifierName ?? input.modifierType ?? 'material'}`;
      const bands = input.qualityBands?.length ? input.qualityBands : FALLBACK_QUALITY_BANDS;
      initial[requirementId] = getSavedBandIndex(input, bands) ?? findNearestBandForQuality(bands, input.selectedQuality ?? 500);
    });
    setDraftBandIndices(initial);
    setEditingItemId(item.id);
  }

  function commitEdit(item: BuildQueueItem, inputs: RecipeInputTemplate[]) {
    inputs.forEach((input, inputIndex) => {
      const materialKey = input.materialKey ?? input.materialId;
      const requirementId = input.requirementId ?? `${item.id}:${inputIndex}:${materialKey}:${input.modifierName ?? input.modifierType ?? 'material'}`;
      const bands = input.qualityBands?.length ? input.qualityBands : FALLBACK_QUALITY_BANDS;
      const bandIndex = draftBandIndices[requirementId] ?? findNearestBandForQuality(bands, input.selectedQuality ?? 500);
      const draftQuality = getBandEffectiveQuality(bands, bandIndex);
      const draftModifier = getModifiersAtQuality(input.qualityModifiers ?? [], draftQuality)[0];
      onMaterialRequirementChange(item.id, requirementId, {
        ...input,
        requirementId,
        selectedQuality: draftQuality,
        qualityBand: bandIndex + 1,
        modifierName: draftModifier?.property ?? input.modifierName,
        modifierType: draftModifier?.modifierMode ?? input.modifierType,
        modifierValue: draftModifier?.value ?? input.modifierValue,
      });
    });
    setEditingItemId(null);
  }

  return (
    <div className="build-category-section logi-bq-group">
      <div className="build-category-header logi-bq-group-header">
        <span className="logi-bq-group-label">{CATEGORY_LABELS[category] ?? category}</span>
        <span className="logi-bq-group-count">{items.length}</span>
      </div>
      {items.map((item) => {
        const recipe = getRecipeForQueueItem(item.recipeId, recipes);
        const itemName = item.itemName ?? recipe?.name ?? item.recipeId;
        const inputs = getBuildQueueItemInputs(item, recipeInputsByRecipeId);
        const isEditingThisItem = editingItemId === item.id;

        const fulfillment = getItemFulfillmentState(item, inputs, inventory);

        // Rarity comes from the selected input bands; quality remains display-only.
        const itemQuality = inputs.reduce((max, input, inputIndex) => {
          const materialKey = input.materialKey ?? input.materialId;
          const requirementId = input.requirementId ?? `${item.id}:${inputIndex}:${materialKey}:${input.modifierName ?? input.modifierType ?? 'material'}`;
          const bands = input.qualityBands?.length ? input.qualityBands : FALLBACK_QUALITY_BANDS;
          const bandIndex = isEditingThisItem
            ? (draftBandIndices[requirementId] ?? findNearestBandForQuality(bands, input.selectedQuality ?? 500))
            : findNearestBandForQuality(bands, input.selectedQuality ?? 500);
          const q = getBandEffectiveQuality(bands, bandIndex);
          return q > max ? q : max;
        }, 0);
        const itemBandNumber = inputs.reduce((max, input, inputIndex) => {
          const materialKey = input.materialKey ?? input.materialId;
          const requirementId = input.requirementId ?? `${item.id}:${inputIndex}:${materialKey}:${input.modifierName ?? input.modifierType ?? 'material'}`;
          const bands = input.qualityBands?.length ? input.qualityBands : FALLBACK_QUALITY_BANDS;
          const bandIndex = isEditingThisItem
            ? (draftBandIndices[requirementId] ?? findNearestBandForQuality(bands, input.selectedQuality ?? 500))
            : getSavedBandIndex(input, bands) ?? -1;
          return Math.max(max, bandIndex + 1);
        }, 1);
        const itemRarity = rarityFromBandIndex(itemBandNumber);

        const summaryMetrics = inputs.reduce<BuildQueueSummaryMetrics>((metrics, input) => {
          const materialKey = input.materialKey ?? input.materialId;
          const material = materials.find((m) => m.id === materialKey);
          const displayName = input.displayName ?? input.materialName ?? material?.name ?? materialKey;
          const required = input.quantity * item.quantity;
          const requirementIdentity = {
            requirementId: input.requirementId,
            selectedQuality: input.selectedQuality,
            unitType: input.unitType,
            allowLowerQuality: Boolean(item.allowLowerQuality),
          };
          const coverage = getMaterialReservationCoverage(item, materialKey, required, inventory, requirementIdentity);
          const needSummary = getBuildQueueMaterialNeedSummary(item, materialKey, required, inventory, buildQueue, requirementIdentity);
          const isCovered = coverage.coverageState === 'covered' || coverage.coverageState === 'overReserved';
          const hasShortfall = needSummary.stillNeeded > 0;

          return {
            coveredCount: metrics.coveredCount + (isCovered ? 1 : 0),
            totalRequired: metrics.totalRequired + required,
            totalOwned: metrics.totalOwned + needSummary.ownedQuantity,
            totalAvailable: metrics.totalAvailable + needSummary.availableQuantity,
            totalShortfall: metrics.totalShortfall + needSummary.stillNeeded,
            missingRequirementCount: metrics.missingRequirementCount + (!isCovered ? 1 : 0),
            unavailableCount: metrics.unavailableCount + (hasShortfall && needSummary.availableQuantity <= 0 ? 1 : 0),
            shortageNames: hasShortfall ? [...metrics.shortageNames, displayName] : metrics.shortageNames,
          };
        }, {
          coveredCount: 0,
          totalRequired: 0,
          totalOwned: 0,
          totalAvailable: 0,
          totalShortfall: 0,
          missingRequirementCount: 0,
          unavailableCount: 0,
          shortageNames: [],
        });
        const coveragePercent = inputs.length > 0 ? Math.round((summaryMetrics.coveredCount / inputs.length) * 100) : 0;
        const worstShortageNames = summaryMetrics.shortageNames.slice(0, 3);

        return (
          <section key={item.id} className={`bq-card bq-card--${fulfillment === 'complete' ? 'covered' : fulfillment}`}>

            {/* ── Summary card ── */}
            <div className="bq-card-header">
              <div className="bq-card-title-block">
                <div className="bq-card-title">{itemName}</div>
                <div className="bq-card-badges">
                  <span className={`bq-category-badge logi-rarity--${itemRarity}`}>{CATEGORY_LABELS[category] ?? category}</span>
                  <span className={`bq-status-badge ${FULFILLMENT_BADGE_CLASS[fulfillment]}`}>{FULFILLMENT_LABELS[fulfillment]}</span>
                  <span className={`logi-quality-pill logi-rarity--${itemRarity}`} title={`Selected quality ${itemQuality}`}>Q{itemQuality}</span>
                </div>
              </div>

              <div className="bq-card-controls">
                {inputs.length > 0 && (
                  <label className={`logi-bq-lower-quality-toggle${item.allowLowerQuality ? ' is-enabled' : ''}`}>
                    <input
                      type="checkbox"
                      checked={Boolean(item.allowLowerQuality)}
                      onChange={(event) => onAllowLowerQualityChange(item.id, event.target.checked)}
                    />
                    <span>Lower quality</span>
                  </label>
                )}
                <div className="logi-bq-qty-control">
                  <QtyStepBtn onClick={() => onQuantityChange(item.id, item.quantity - 1)} disabled={item.quantity <= 1}>-</QtyStepBtn>
                  <span className="logi-bq-qty-value">{item.quantity}x</span>
                  <QtyStepBtn onClick={() => onQuantityChange(item.id, item.quantity + 1)}>+</QtyStepBtn>
                </div>

              {/* Edit Quality toggle on summary card only */}
              {inputs.length > 0 && (
                isEditingThisItem ? (
                  <div className="logi-bq-summary-edit-actions">
                    <button type="button" className="logi-btn-ghost" onClick={() => setEditingItemId(null)}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="logi-btn-ghost logi-mat-quality-done-btn"
                      onClick={() => commitEdit(item, inputs)}
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="logi-btn-ghost logi-bq-summary-edit-quality-btn"
                    onClick={() => openEdit(item, inputs)}
                  >
                    Adjust Quality
                  </button>
                )
              )}

              

                <button
                  type="button"
                  className="logi-action-btn logi-action-btn--delete"
                  onClick={() => onRemove(item.id)}
                  aria-label={`Remove ${itemName}`}
                >
                  <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                  </svg>
                </button>
              </div>
            </div>

            {/* ── Material cards ── */}
            <div className="bq-summary-strip">
              <div className="bq-coverage-block">
                <div className="logi-bq-coverage-copy">
                  <span className="logi-bq-coverage-num">{coveragePercent}%</span>
                  <span className="logi-bq-coverage-label">material coverage</span>
                </div>
                <div className="logi-bq-coverage-bar" aria-hidden="true">
                  <span
                    className={`logi-bq-coverage-fill ${fulfillment === 'complete' ? 'logi-bq-coverage-fill--complete' : fulfillment === 'partial' ? 'logi-bq-coverage-fill--partial' : 'logi-bq-coverage-fill--missing'}`}
                    style={{ width: `${coveragePercent}%` }}
                  />
                </div>
                <div className="build-coverage-metrics" aria-label={`${itemName} material totals`}>
                  <span><em>Materials</em><strong>{summaryMetrics.coveredCount}/{inputs.length}</strong></span>
                  <span><em>Required</em><strong><QuantityText value={formatQuantity(summaryMetrics.totalRequired, undefined)} /></strong></span>
                  <span><em>Owned / Avail</em><strong><QuantityText value={formatQuantity(summaryMetrics.totalOwned, undefined)} /> / <QuantityText value={formatQuantity(summaryMetrics.totalAvailable, undefined)} /></strong></span>
                  <span className={summaryMetrics.totalShortfall > 0 ? 'logi-bq-summary-shortfall' : ''}>
                    <em>Shortfall</em><strong><QuantityText value={formatQuantity(summaryMetrics.totalShortfall, undefined)} /></strong>
                  </span>
                </div>
              </div>

              <div className="bq-intel-note">
                <div className="logi-bq-intel-title">Build Intelligence</div>
                <div className="logi-bq-intel-copy">
                  {fulfillment === 'complete'
                    ? 'All material requirements are covered by current reservations.'
                    : fulfillment === 'partial'
                      ? `${summaryMetrics.missingRequirementCount} material requirement${summaryMetrics.missingRequirementCount === 1 ? '' : 's'} still need coverage.`
                      : 'No material requirement is fully covered yet.'}
                  {worstShortageNames.length > 0 && (
                    <span> Worst shortages: {worstShortageNames.join(', ')}{summaryMetrics.shortageNames.length > worstShortageNames.length ? ` +${summaryMetrics.shortageNames.length - worstShortageNames.length}` : ''}.</span>
                  )}
                  {summaryMetrics.unavailableCount > 0 && (
                    <span> {summaryMetrics.unavailableCount} shortage{summaryMetrics.unavailableCount === 1 ? ' has' : 's have'} no available stored stack.</span>
                  )}
                  <span> Lower-quality sourcing is {item.allowLowerQuality ? 'allowed' : 'locked to selected quality'}.</span>
                </div>
              </div>
            </div>

            {isEditingThisItem && inputs.length > 0 && (
              <div className="bq-quality-drawer" aria-label={`Quality adjustment for ${itemName}`}>
                {inputs.map((input, inputIndex) => {
                  const materialKey = input.materialKey ?? input.materialId;
                  const requirementId = input.requirementId ?? `${item.id}:${inputIndex}:${materialKey}:${input.modifierName ?? input.modifierType ?? 'material'}`;
                  const qualityBands = input.qualityBands?.length ? input.qualityBands : FALLBACK_QUALITY_BANDS;
                  const savedBandIndex = getSavedBandIndex(input, qualityBands) ?? findNearestBandForQuality(qualityBands, input.selectedQuality ?? 500);
                  const draftBandIndex = draftBandIndices[requirementId] ?? savedBandIndex;

                  return (
                    <MaterialQualitySlider
                      key={`quality:${item.id}:${requirementId}:${inputIndex}`}
                      input={input}
                      draftBandIndex={draftBandIndex}
                      onBandChange={(bandIndex) =>
                        setDraftBandIndices((prev) => ({ ...prev, [requirementId]: bandIndex }))
                      }
                    />
                  );
                })}
              </div>
            )}

            {recipe ? (
              <div className="bq-requirements">
                <div className="bq-requirements-head" aria-label={`${inputs.length} material requirement${inputs.length === 1 ? '' : 's'}`}>
                  <span>Material</span>
                  <span>Quality / Modifier</span>
                  <span>Inventory</span>
                </div>
                <div className="bq-requirements-list">
                  {inputs.map((input, inputIndex) => {
                  const materialKey = input.materialKey ?? input.materialId;
                  const requirementId = input.requirementId ?? `${item.id}:${inputIndex}:${materialKey}:${input.modifierName ?? input.modifierType ?? 'material'}`;
                  const requirementCardKey = `${item.id}:${requirementId}:${materialKey}:${input.selectedQuality ?? 'any'}:${input.unitType ?? 'unit'}:${inputIndex}`;
                  const material = materials.find((m) => m.id === materialKey);
                  const displayName = input.displayName ?? input.materialName ?? material?.name ?? `Unresolved: ${input.rawName ?? materialKey}`;
                  const required = input.quantity * item.quantity;
                  const qualityBands = input.qualityBands?.length ? input.qualityBands : FALLBACK_QUALITY_BANDS;

                  // When editing, use draft; otherwise use saved
                  const savedBandIndex = getSavedBandIndex(input, qualityBands) ?? findNearestBandForQuality(qualityBands, input.selectedQuality ?? 500);
                  const draftBandIndex = isEditingThisItem
                    ? (draftBandIndices[requirementId] ?? savedBandIndex)
                    : savedBandIndex;
                  const selectedQuality = getBandEffectiveQuality(qualityBands, draftBandIndex);
                  const requirementSelectedQuality = input.selectedQuality;
                  const selectedQualityRarity = rarityFromBandIndex(draftBandIndex + 1);

                  const modifierAtQuality = getModifiersAtQuality(input.qualityModifiers ?? [], selectedQuality)[0];
                  const modifierPreview = modifierAtQuality
                    ? `${formatProperty(modifierAtQuality.property)} ${formatModifierAtQuality(modifierAtQuality)}`
                    : input.modifierName && input.modifierValue !== undefined
                      ? `${formatProperty(input.modifierName)} ${formatModifierAtQuality({ slot: '', property: input.modifierName, value: input.modifierValue, modifierMode: input.modifierType })}`
                      : undefined;

                  const allowLowerQuality = Boolean(item.allowLowerQuality);
                  const requirementIdentity = {
                    requirementId,
                    selectedQuality: requirementSelectedQuality,
                    unitType: input.unitType,
                  };
                  const effectiveRequirementIdentity = { ...requirementIdentity, allowLowerQuality };
                  const coverage = getMaterialReservationCoverage(item, materialKey, required, inventory, effectiveRequirementIdentity);
                  const needSummary = getBuildQueueMaterialNeedSummary(item, materialKey, required, inventory, buildQueue, effectiveRequirementIdentity);
                  const ownAllocations = item.reservedAllocations?.filter((a) => allocationMatchesRequirement(a, materialKey, effectiveRequirementIdentity)) ?? [];
                  const ownReservedByStack = new Map(ownAllocations.map((a) => [a.inventoryEntryId, a.quantityReserved]));
                  const remainingRequired = Math.max(0, required - coverage.reservedQuantity);
                  const allMaterialStacks = sortStacks(
                    getInventoryStacks(
                      inventory.filter((e) => e.materialId === materialKey && e.quantity > 0),
                      materials,
                      locations,
                    ),
                    strategy,
                  );
                  const eligibleStacks = allMaterialStacks.filter((stack) =>
                    isInventoryEntryEligibleForRequirement(stack, materialKey, requirementSelectedQuality) &&
                    (getAvailableQuantityForInventoryEntry(stack, buildQueue, item.id) > 0 || ownReservedByStack.has(stack.id))
                  );
                  const ineligibleStacks = allMaterialStacks.filter((stack) =>
                    !isInventoryEntryEligibleForRequirement(stack, materialKey, requirementSelectedQuality)
                  );
                  const staleAllocations = coverage.validations.filter((v) => v.isStale);
                  const coverageClass =
                    coverage.coverageState === 'covered' || coverage.coverageState === 'overReserved' ? 'logi-badge--complete'
                    : coverage.coverageState === 'missing' ? 'logi-badge--shortage'
                    : 'logi-badge--paused';
                  const lowerQualityExpanded = expandedLowerQuality[requirementCardKey] ?? false;
                  const reserveNote = staleAllocations.length > 0
                    ? `${staleAllocations.length} stale reservation${staleAllocations.length === 1 ? '' : 's'}`
                    : allMaterialStacks.length === 0
                      ? 'No stored stock'
                      : eligibleStacks.length === 0
                        ? 'No eligible stock'
                        : `${eligibleStacks.length} reservable stack${eligibleStacks.length === 1 ? '' : 's'}`;

                  return (
                    <div key={requirementCardKey} className={`bq-requirement-row bq-requirement-row--${coverage.coverageState === 'covered' || coverage.coverageState === 'overReserved' ? 'covered' : coverage.coverageState === 'partial' ? 'partial' : 'missing'}`}>
                      <>
                          {/* Material name + coverage badge */}
                          <div className="bq-requirement-main">
                            <div className="bq-requirement-material">
                              <div className="bq-requirement-title-row">
                                <span className="logi-mat-name">{displayName}</span>
                                <span className={`logi-badge ${coverageClass}`}>{COVERAGE_LABELS[coverage.coverageState]}</span>
                              </div>
                              <span className={`bq-requirement-note${eligibleStacks.length === 0 ? ' bq-requirement-note--empty' : ''}`}>{reserveNote}</span>
                            </div>
                            <div className="bq-requirement-quality">
                              <span className={`logi-quality-pill logi-rarity--${selectedQualityRarity}`}>{selectedQuality}</span>
                              <span className={`logi-mat-modifier logi-rarity--${selectedQualityRarity}`}>{modifierPreview ?? '-'}</span>
                            </div>

                          {/* Reserved / Required summary */}
                          <div className="bq-requirement-numbers">
                            <span className="logi-mat-amount-group">
                              <span className="logi-mat-amount-label">Reserved</span>
                              <span className={`logi-mat-amount-value ${materialTypeClass(material)}`}>
                                {formatQuantity(coverage.reservedQuantity, material)}
                              </span>
                            </span>
                            <span className="logi-mat-amount-group">
                              <span className="logi-mat-amount-label">Required</span>
                              <span className={`logi-mat-amount-value ${materialTypeClass(material)}`}>
                                {formatRequirementQuantity(required, input.unitType, material)}
                              </span>
                            </span>
                            <span className="logi-mat-inv-item">
                              <span className="logi-mat-amount-label">Owned</span>
                              <span className={materialTypeClass(material)}>{formatQuantity(needSummary.ownedQuantity, material)}</span>
                            </span>
                            <span className="logi-mat-inv-sep">·</span>
                            <span className="logi-mat-inv-item">
                              <span className="logi-mat-amount-label">Avail</span>
                              <span className={materialTypeClass(material)}>{formatQuantity(needSummary.availableQuantity, material)}</span>
                            </span>
                            <span className="logi-mat-inv-sep">·</span>
                            <span className="logi-mat-inv-item">
                              <span className="logi-mat-amount-label">Need</span>
                              <span className={`${materialTypeClass(material)} ${needSummary.stillNeeded > 0 ? 'logi-mat-still-needed' : ''}`}>
                                {formatQuantity(needSummary.stillNeeded, material)}
                              </span>
                            </span>
                          </div>
                          </div>

                          {/* Stale allocation warnings */}
                          {staleAllocations.map(({ allocation, staleReason }) => (
                            <div key={allocation.id} className="logi-source-empty logi-source-stale">
                              <span>Stale: {allocation.materialName ?? allocation.materialId} ({STALE_REASON_LABELS[staleReason ?? ''] ?? 'invalid'})</span>
                              <button type="button" className="logi-btn-ghost" onClick={() => onClearStaleAllocations(item.id)}>
                                Remove
                              </button>
                            </div>
                          ))}

                          {/* Reserve stacks */}
                          <div className="logi-reserve-section">
                            <span className="logi-reserve-label">Reserve from inventory</span>
                            {eligibleStacks.length > 0 ? (
                              eligibleStacks.map((stack) => {
                                const allocationId = getAllocationId(item.id, requirementId, materialKey, requirementSelectedQuality, input.unitType, stack);
                                const reservedQuantity = ownReservedByStack.get(stack.id) ?? 0;
                                const reservedByThisItemOtherSlots = (item.reservedAllocations ?? [])
                                  .filter((allocation) => allocation.inventoryEntryId === stack.id && allocation.id !== allocationId)
                                  .reduce((sum, allocation) => sum + allocation.quantityReserved, 0);
                                const availableQuantity = getAvailableQuantityForInventoryEntry(stack, buildQueue, item.id);
                                const availableAfterThisReservation = Math.max(0, availableQuantity - reservedByThisItemOtherSlots - reservedQuantity);
                                const checked = reservedQuantity > 0;
                                const nextQuantity = Math.min(remainingRequired, availableAfterThisReservation);
                                const disabled = !checked && nextQuantity <= 0;
                                return (
                                  <label key={stack.id} className="logi-source-option">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={disabled}
                                      onChange={() => {
                                        const quantityReserved = checked ? reservedQuantity : nextQuantity;
                                        if (quantityReserved <= 0) return;
                                        onToggleAllocation(item.id, createAllocation(item.id, requirementId, requirementSelectedQuality, input.unitType, stack, material?.name, quantityReserved));
                                      }}
                                    />
                                    <span className="logi-source-loc">{stack.location?.name ?? stack.locationId}</span>
                                    <span className="logi-source-container">{stack.container ?? '—'}</span>
                                    <span className={rarityClass(stack.rarity)}>{stack.quality}</span>
                                    <span style={{ color: stack.rarity.colorToken }}>{stack.rarity.label}</span>
                                    <span className={materialTypeClass(material)}>
                                      <QuantityText value={formatQuantity(reservedQuantity, material)} /> / <QuantityText value={formatQuantity(stack.quantity, material)} />
                                    </span>
                                    <span className={materialTypeClass(material)}>{formatQuantity(availableAfterThisReservation, material)} avail</span>
                                  </label>
                                );
                              })
                            ) : (
                              <div className="logi-source-empty">No stored stack available</div>
                            )}
                            {ineligibleStacks.length > 0 && (
                              <div className="logi-lower-quality-section">
                                <button
                                  type="button"
                                  className="logi-lower-quality-toggle"
                                  aria-expanded={lowerQualityExpanded}
                                  onClick={() => setExpandedLowerQuality((prev) => ({ ...prev, [requirementCardKey]: !lowerQualityExpanded }))}
                                >
                                  <span className="logi-lower-quality-chevron" aria-hidden="true">{lowerQualityExpanded ? '▾' : '▸'}</span>
                                  <span>Lower quality / ineligible</span>
                                  <span className="logi-lower-quality-count">
                                    {ineligibleStacks.length} {ineligibleStacks.length === 1 ? 'stack' : 'stacks'}
                                  </span>
                                </button>
                                {lowerQualityExpanded && ineligibleStacks.map((stack) => {
                                  const allocationId = getAllocationId(item.id, requirementId, materialKey, requirementSelectedQuality, input.unitType, stack);
                                  const reservedQuantity = ownReservedByStack.get(stack.id) ?? 0;
                                  const reservedByThisItemOtherSlots = (item.reservedAllocations ?? [])
                                    .filter((allocation) => allocation.inventoryEntryId === stack.id && allocation.id !== allocationId)
                                    .reduce((sum, allocation) => sum + allocation.quantityReserved, 0);
                                  const availableQuantity = getAvailableQuantityForInventoryEntry(stack, buildQueue, item.id);
                                  const availableAfterThisReservation = Math.max(0, availableQuantity - reservedByThisItemOtherSlots - reservedQuantity);
                                  const checked = reservedQuantity > 0;
                                  const nextQuantity = Math.min(remainingRequired, availableAfterThisReservation);
                                  const disabled = !allowLowerQuality || (!checked && nextQuantity <= 0);
                                  return (
                                    <label key={`ineligible:${stack.id}`} className={`logi-source-option logi-source-option--lower${disabled ? ' logi-source-option--disabled' : ''}${checked ? ' logi-source-option--override-selected' : ''}`}>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={disabled}
                                        onChange={() => {
                                          const quantityReserved = checked ? reservedQuantity : nextQuantity;
                                          if (quantityReserved <= 0) return;
                                          onToggleAllocation(item.id, createAllocation(item.id, requirementId, requirementSelectedQuality, input.unitType, stack, material?.name, quantityReserved, true));
                                        }}
                                      />
                                      <span className="logi-source-loc">{stack.location?.name ?? stack.locationId}</span>
                                      <span className="logi-source-quality-rarity">
                                        {stack.quality !== undefined && <span className={rarityClass(stack.rarity)}>{stack.quality}</span>}
                                        <span style={{ color: stack.rarity.colorToken }}>{stack.rarity.label}</span>
                                      </span>
                                      <span className={materialTypeClass(material)}>
                                        <QuantityText value={formatQuantity(reservedQuantity, material)} /> / <QuantityText value={formatQuantity(stack.quantity, material)} />
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                      </>
                    </div>
                  );
                  })}
                </div>
              </div>
            ) : (
              <div className="logi-source-empty">No recipe mapped for source selection.</div>
            )}
          </section>
        );
      })}
    </div>
  );
}
