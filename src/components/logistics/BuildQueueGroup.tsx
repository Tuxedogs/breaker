import { useMemo, useState } from 'react';
import type { BuildQueueItem, InventoryEntry, InventoryLocation, MaterialTemplate, RecipeTemplate, ReservedMaterialAllocation } from '../../types/logistics';
import type { RecipeInputTemplate } from '../../data/logistics/seed';
import { formatQuantity, formatRequirementQuantity, getBuildQueueItemInputs, getInventoryStacks, getRecipeForQueueItem, materialTypeClass, rarityClass, type InventoryStack, type SourceStrategy } from '../../lib/logistics/inventory';
import {
  getAvailableQuantityForInventoryEntry,
  getBuildQueueMaterialNeedSummary,
  getMaterialReservationCoverage,
} from '../../lib/logistics/selectors';
import { FALLBACK_QUALITY_BANDS, findNearestBandForQuality, getBandEffectiveQuality } from '../industry/crafting/utils/qualityBands';
import { formatModifierAtQuality, formatProperty, getModifiersAtQuality } from '../industry/crafting/utils/qualityModifiers';
import { getDirectionLabel, getModifierImpact } from '../../lib/gameplay/propertyUtils';

function AllocationQtyInput({ value, max, onCommit }: { value: number; max: number; onCommit: (val: number) => void }) {
  return (
    <input
      type="number"
      className="logi-source-qty"
      aria-label="Reserved quantity"
      min={0}
      max={max}
      step="0.01"
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const nextValue = e.target.value === '' ? 0 : Number(e.target.value);
        onCommit(Number.isFinite(nextValue) ? nextValue : value);
      }}
    />
  );
}

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
  onMaterialRequirementChange: (id: string, requirementId: string, input: RecipeInputTemplate) => void;
  onRemove: (id: string) => void;
  onToggleAllocation: (buildQueueItemId: string, allocation: ReservedMaterialAllocation) => void;
  onUpdateAllocationQuantity: (buildQueueItemId: string, inventoryEntryId: string, quantity: number) => void;
  onClearAllocations: (buildQueueItemId: string) => void;
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

const STATUS_CLASS: Record<NonNullable<BuildQueueItem['status']>, string> = {
  queued: 'logi-badge--queued',
  active: 'logi-badge--in-progress',
  paused: 'logi-badge--paused',
  complete: 'logi-badge--complete',
};

const STATUS_LABELS: Record<NonNullable<BuildQueueItem['status']>, string> = {
  queued: 'Queued',
  active: 'In Progress',
  paused: 'Paused',
  complete: 'Complete',
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

function createAllocation(stack: InventoryStack, materialName: string | undefined, quantityReserved: number): ReservedMaterialAllocation {
  if (!stack.materialId) throw new Error('Cannot allocate inventory stack without a materialId');
  return {
    id: `${stack.id}-${stack.materialId}`,
    materialId: stack.materialId,
    inventoryEntryId: stack.id,
    quantityReserved,
    materialName,
    quality: stack.quality,
    rarity: stack.rarity,
    locationId: stack.locationId,
    container: stack.container,
  };
}

function qualityToRarity(quality: number, isQuantanium?: boolean): string {
  if (isQuantanium) return 'quantanium';
  if (quality >= 900) return 'legendary';
  if (quality >= 800) return 'epic';
  if (quality >= 750) return 'rare';
  if (quality >= 650) return 'uncommon';
  return 'common';
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

const FULFILLMENT_SUMMARY_CLASS: Record<'complete' | 'partial' | 'missing', string> = {
  complete: 'logi-bq-summary-card--complete',
  partial: 'logi-bq-summary-card--partial',
  missing: 'logi-bq-summary-card--missing',
};

const FULFILLMENT_BADGE_CLASS: Record<'complete' | 'partial' | 'missing', string> = {
  complete: 'logi-badge--complete',
  partial: 'logi-badge--paused',
  missing: 'logi-badge--shortage',
};

const FULFILLMENT_LABELS: Record<'complete' | 'partial' | 'missing', string> = {
  complete: 'Complete',
  partial: 'Partial',
  missing: 'Missing',
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

  return (
    <div className="craft-matq-card">
      <div className="craft-matq-header">
        <div className="craft-matq-identity">
          <span className="craft-matq-name">{input.displayName ?? input.materialName ?? input.materialId}</span>
        </div>
        <div className="craft-matq-quality-header">
          <span className="craft-matq-quality-label">Band {safeBandIndex + 1}</span>
          <span className="craft-matq-quality-value">{quality}</span>
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
          <div className="craft-matq-rail">
            <div
              className="craft-matq-rail-fill"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              style={{ '--selected-pct': `${Math.max(0, Math.min(100, (quality / 1000) * 100))}%` } as any}
            />
            {railMarkers.map((marker) => (
              <button
                type="button"
                key={`${marker.index}-${marker.mappedValue}`}
                className={`craft-matq-band-marker${marker.index === safeBandIndex ? ' is-active' : ''}`}
                style={{ left: `${marker.left}%` }}
                data-edge={marker.edge}
                onClick={() => onBandChange(marker.index)}
                aria-label={`Use mapped quality ${marker.mappedValue}`}
              >
                <span className="craft-matq-dot" />
                <span className="craft-matq-marker-value">{marker.mappedValue}</span>
              </button>
            ))}
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
                  <span className={`craft-matq-mod-val ${getImpactClass(impact)}`}>
                    {formatModifierAtQuality(m)}{getImpactWord(impact) ? ` ${getImpactWord(impact)}` : ''}
                  </span>
                </div>
                {directionLabel && <div className="craft-matq-mod-hint">{directionLabel}</div>}
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
  onMaterialRequirementChange,
  onRemove,
  onToggleAllocation,
  onUpdateAllocationQuantity,
  onClearAllocations,
  onClearStaleAllocations,
}: Props) {
  // editingItemId: which queue item has quality editing open
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  // draft band indices: itemId:requirementId -> bandIndex
  const [draftBandIndices, setDraftBandIndices] = useState<Record<string, number>>({});

  function openEdit(item: BuildQueueItem, inputs: RecipeInputTemplate[]) {
    // Initialise draft indices from current selected qualities
    const initial: Record<string, number> = {};
    inputs.forEach((input, inputIndex) => {
      const materialKey = input.materialKey ?? input.materialId;
      const requirementId = input.requirementId ?? `${item.id}:${inputIndex}:${materialKey}:${input.modifierName ?? input.modifierType ?? 'material'}`;
      const bands = input.qualityBands?.length ? input.qualityBands : FALLBACK_QUALITY_BANDS;
      initial[requirementId] = findNearestBandForQuality(bands, input.selectedQuality ?? 500);
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
        modifierName: draftModifier?.property ?? input.modifierName,
        modifierType: draftModifier?.modifierMode ?? input.modifierType,
        modifierValue: draftModifier?.value ?? input.modifierValue,
      });
    });
    setEditingItemId(null);
  }

  return (
    <div className="logi-bq-group">
      <div className="logi-bq-group-header">
        <span className="logi-bq-group-label">{CATEGORY_LABELS[category] ?? category}</span>
        <span className="logi-bq-group-count">{items.length}</span>
      </div>
      {items.map((item) => {
        const recipe = getRecipeForQueueItem(item.recipeId, recipes);
        const itemName = item.itemName ?? recipe?.name ?? item.recipeId;
        const status = item.status ?? 'queued';
        const inputs = getBuildQueueItemInputs(item, recipeInputsByRecipeId);
        const isEditingThisItem = editingItemId === item.id;

        const fulfillment = getItemFulfillmentState(item, inputs, inventory);

        // Rarity from highest effective quality across inputs (using draft when editing)
        const maxQuality = inputs.reduce((max, input, inputIndex) => {
          const materialKey = input.materialKey ?? input.materialId;
          const requirementId = input.requirementId ?? `${item.id}:${inputIndex}:${materialKey}:${input.modifierName ?? input.modifierType ?? 'material'}`;
          const bands = input.qualityBands?.length ? input.qualityBands : FALLBACK_QUALITY_BANDS;
          const bandIndex = isEditingThisItem
            ? (draftBandIndices[requirementId] ?? findNearestBandForQuality(bands, input.selectedQuality ?? 500))
            : findNearestBandForQuality(bands, input.selectedQuality ?? 500);
          const q = getBandEffectiveQuality(bands, bandIndex);
          return q > max ? q : max;
        }, 0);
        const firstMaterialKey = inputs[0]?.materialKey ?? inputs[0]?.materialId;
        const firstMaterial = firstMaterialKey ? materials.find((m) => m.id === firstMaterialKey) : undefined;
        const itemRarity = qualityToRarity(maxQuality, firstMaterial?.isQuantanium);

        const coveredCount = inputs.filter((input) => {
          const materialKey = input.materialKey ?? input.materialId;
          const required = input.quantity * item.quantity;
          const coverage = getMaterialReservationCoverage(item, materialKey, required, inventory);
          return coverage.coverageState === 'covered' || coverage.coverageState === 'overReserved';
        }).length;

        return (
          <div key={item.id} className="logi-bq-item-row">

            {/* ── Summary card ── */}
            <div className={`logi-bq-summary-card ${FULFILLMENT_SUMMARY_CLASS[fulfillment]}`}>
              <div className="logi-bq-summary-name">{itemName}</div>

              <div className="logi-bq-summary-badges">
                <span className={`logi-quality-pill logi-rarity--${itemRarity}`}>{maxQuality}</span>
              </div>

              <div className="logi-bq-summary-status-row">
                <span className={`logi-badge ${FULFILLMENT_BADGE_CLASS[fulfillment]}`}>{FULFILLMENT_LABELS[fulfillment]}</span>
                <span className={`logi-badge ${STATUS_CLASS[status]}`}>{STATUS_LABELS[status]}</span>
              </div>

              <div className="logi-bq-summary-totals">
                <span className="logi-mat-amount-label">Materials</span>
                <span className="logi-bq-summary-total-val">{coveredCount}/{inputs.length}</span>
              </div>

              <div className="logi-bq-summary-controls">
                <div className="logi-bq-qty-control">
                  <QtyStepBtn onClick={() => onQuantityChange(item.id, item.quantity - 1)} disabled={item.quantity <= 1}>−</QtyStepBtn>
                  <span className="logi-bq-qty-value">{item.quantity}×</span>
                  <QtyStepBtn onClick={() => onQuantityChange(item.id, item.quantity + 1)}>+</QtyStepBtn>
                </div>
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

              <div className="logi-bq-summary-actions">
                {(item.reservedAllocations?.length ?? 0) > 0 && (
                  <button type="button" className="logi-btn-ghost" onClick={() => onClearAllocations(item.id)}>
                    Clear
                  </button>
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
            {recipe ? (
              <div className="logi-source-grid logi-bq-material-grid">
                {inputs.map((input, inputIndex) => {
                  const materialKey = input.materialKey ?? input.materialId;
                  const requirementId = input.requirementId ?? `${item.id}:${inputIndex}:${materialKey}:${input.modifierName ?? input.modifierType ?? 'material'}`;
                  const material = materials.find((m) => m.id === materialKey);
                  const displayName = input.displayName ?? input.materialName ?? material?.name ?? `Unresolved: ${input.rawName ?? materialKey}`;
                  const required = input.quantity * item.quantity;
                  const qualityBands = input.qualityBands?.length ? input.qualityBands : FALLBACK_QUALITY_BANDS;

                  // When editing, use draft; otherwise use saved
                  const savedBandIndex = findNearestBandForQuality(qualityBands, input.selectedQuality ?? 500);
                  const draftBandIndex = isEditingThisItem
                    ? (draftBandIndices[requirementId] ?? savedBandIndex)
                    : savedBandIndex;
                  const selectedQuality = getBandEffectiveQuality(qualityBands, draftBandIndex);
                  const selectedQualityRarity = qualityToRarity(selectedQuality, material?.isQuantanium);

                  const modifierAtQuality = getModifiersAtQuality(input.qualityModifiers ?? [], selectedQuality)[0];
                  const modifierPreview = modifierAtQuality
                    ? `${formatProperty(modifierAtQuality.property)} ${formatModifierAtQuality(modifierAtQuality)}`
                    : input.modifierName && input.modifierValue !== undefined
                      ? `${formatProperty(input.modifierName)} ${formatModifierAtQuality({ slot: '', property: input.modifierName, value: input.modifierValue, modifierMode: input.modifierType })}`
                      : undefined;

                  const coverage = getMaterialReservationCoverage(item, materialKey, required, inventory);
                  const needSummary = getBuildQueueMaterialNeedSummary(item, materialKey, required, inventory, buildQueue);
                  const ownAllocations = item.reservedAllocations?.filter((a) => a.materialId === materialKey) ?? [];
                  const ownReservedByStack = new Map(ownAllocations.map((a) => [a.inventoryEntryId, a.quantityReserved]));
                  const remainingRequired = Math.max(0, required - coverage.reservedQuantity);
                  const stacks = sortStacks(
                    getInventoryStacks(
                      inventory.filter((e) => e.materialId === materialKey && e.quantity > 0),
                      materials,
                      locations,
                    ),
                    strategy,
                  ).filter((stack) => getAvailableQuantityForInventoryEntry(stack, buildQueue, item.id) > 0 || ownReservedByStack.has(stack.id));
                  const staleAllocations = coverage.validations.filter((v) => v.isStale);
                  const coverageClass =
                    coverage.coverageState === 'covered' ? 'logi-badge--complete'
                    : coverage.coverageState === 'missing' ? 'logi-badge--shortage'
                    : 'logi-badge--paused';

                  return (
                    <div key={requirementId} className={`logi-source-card${coverage.coverageState === 'missing' ? ' logi-source-card--missing' : ''}${isEditingThisItem ? ' logi-source-card--quality-edit' : ''}`}>

                      {isEditingThisItem ? (
                        /* Flip to quality slider when this item is being edited */
                        <MaterialQualitySlider
                          input={input}
                          draftBandIndex={draftBandIndex}
                          onBandChange={(bandIndex) =>
                            setDraftBandIndices((prev) => ({ ...prev, [requirementId]: bandIndex }))
                          }
                        />
                      ) : (
                        <>
                          {/* Material name + coverage badge */}
                          <div className="logi-mat-head">
                            <span className="logi-mat-name">{displayName}</span>
                            <span className={`logi-badge ${coverageClass}`}>{COVERAGE_LABELS[coverage.coverageState]}</span>
                          </div>

                          <div className="logi-mat-quality-row">
                            <span className={`logi-quality-pill logi-rarity--${selectedQualityRarity}`}>{selectedQuality}</span>
                            {modifierPreview && <span className="logi-mat-modifier">{modifierPreview}</span>}
                          </div>

                          {/* Reserved / Required summary */}
                          <div className="logi-mat-amounts">
                            <div className="logi-mat-amount-group">
                              <span className="logi-mat-amount-label">Reserved</span>
                              <span className={`logi-mat-amount-value ${materialTypeClass(material)}`}>
                                {formatQuantity(coverage.reservedQuantity, material)}
                              </span>
                            </div>
                            <span className="logi-mat-amount-sep">/</span>
                            <div className="logi-mat-amount-group">
                              <span className="logi-mat-amount-label">Required</span>
                              <span className={`logi-mat-amount-value ${materialTypeClass(material)}`}>
                                {formatRequirementQuantity(required, input.unitType, material)}
                              </span>
                            </div>
                          </div>

                          {/* Owned / Available / Still needed */}
                          <div className="logi-mat-inventory-row">
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
                            {stacks.length > 0 ? (
                              stacks.map((stack) => {
                                const reservedQuantity = ownReservedByStack.get(stack.id) ?? 0;
                                const availableQuantity = getAvailableQuantityForInventoryEntry(stack, buildQueue, item.id);
                                const availableAfterThisReservation = Math.max(0, availableQuantity - reservedQuantity);
                                const maxReservedQuantity = availableAfterThisReservation + reservedQuantity;
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
                                        onToggleAllocation(item.id, createAllocation(stack, material?.name, quantityReserved));
                                      }}
                                    />
                                    <span className="logi-source-loc">{stack.location?.name ?? stack.locationId}</span>
                                    <span className="logi-source-container">{stack.container ?? '—'}</span>
                                    <span className={rarityClass(stack.rarity)}>{stack.quality}</span>
                                    <span style={{ color: stack.rarity.colorToken }}>{stack.rarity.label}</span>
                                    {checked ? (
                                      <span className="logi-source-qty-cell">
                                        Reserved
                                        <AllocationQtyInput
                                          value={reservedQuantity}
                                          max={maxReservedQuantity}
                                          onCommit={(val) => onUpdateAllocationQuantity(item.id, stack.id, val)}
                                        />
                                      </span>
                                    ) : (
                                      <span className={materialTypeClass(material)}>
                                        {formatQuantity(reservedQuantity, material)} / {formatQuantity(stack.quantity, material)}
                                      </span>
                                    )}
                                    <span className={materialTypeClass(material)}>{formatQuantity(availableAfterThisReservation, material)} avail</span>
                                  </label>
                                );
                              })
                            ) : (
                              <div className="logi-source-empty">No stored stack available</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="logi-source-empty">No recipe mapped for source selection.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
