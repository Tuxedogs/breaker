import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BuildQueueItem, InventoryEntry, InventoryLocation, MaterialTemplate, RecipeTemplate, ReservedMaterialAllocation } from '../../types/logistics';
import type { RecipeInputTemplate } from '../../data/logistics/seed';
import {
  formatQuantity,
  getBuildQueueItemInputs,
  getInventoryStacks,
  getRecipeForQueueItem,
  materialTypeClass,
  rarityClass,
  type InventoryStack,
  type SourceStrategy,
} from '../../lib/logistics/inventory';
import {
  allocationMatchesRequirement,
  getAvailableQuantityForInventoryEntry,
  getBuildQueueMaterialNeedSummary,
  getMaterialReservationCoverage,
} from '../../lib/logistics/selectors';
import {
  getAllocationTotal,
  getLotAvailableAmountAfterReservations,
  getModifierProjectionFromQuality,
  getQualityProjectionStatus,
  getRemainingRequiredAmount,
  getRequirementLineKey,
  getWeightedEffectiveQuality,
} from '../../lib/logistics/buildQueueReservations';
import { FALLBACK_QUALITY_BANDS, findNearestBandForQuality, getBandEffectiveQuality, rarityClassFromBandIndex, rarityFromBandIndex, type QualityBand } from '../industry/crafting/utils/qualityBands';
import { formatModifierAtQuality, formatProperty, getModifiersAtQuality } from '../industry/crafting/utils/qualityModifiers';
import { apiUrl } from '../../lib/apiUrl';
import { getModifierImpact } from '../../lib/gameplay/propertyUtils';
import { parseJsonResponse } from '../../lib/safeJson';

import MaterialIcon from './MaterialIcon';
import { BuildQueueProductIcon } from './BuildQueueProductIcon';
import type { FittingIconMode } from '../../lib/fitting/fittingIconMode';

// ─── Helpers ────────────────────────────────────────────────────────────────





function getModifierTrendClass(property: string | undefined, value: number | undefined): 'is-better' | 'is-worse' | 'is-neutral' {
  if (value === undefined || !Number.isFinite(value) || value === 0) return 'is-neutral';

  const impact = property ? getModifierImpact(property, value) : 'neutral';
  if (impact === 'good') return 'is-better';
  if (impact === 'bad') return 'is-worse';
  return 'is-neutral';
}

type BuildQueueActiveDrawer = {
  type: 'quality' | 'reserve';
  requirementKey: string;
};

function isDrawerToggleExcluded(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('button,input,select,textarea,[data-bq-row-control="true"]'));
}

function useIsMobileTouchLayout() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px)');
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isMobile;
}

// ─── Quantization ────────────────────────────────────────────────────────────

const MATERIAL_QUANTIZATION_URL = '/api/crafting/material_quality_quantization.json';

type BQMaterialQuantization = {
  materialKey?: string;
  materialName?: string;
  materialId?: string;
  qualityOptions?: number[];
  bands?: QualityBand[];
};

function normalizeBQKey(value: string | null | undefined): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function qualityOptionsToBands(options: number[]): QualityBand[] {
  return options.map((v) => ({ start: v, end: v, mappedValue: v }));
}

function useBQQuantization() {
  const [byKey, setByKey] = useState<Map<string, BQMaterialQuantization>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const url = apiUrl(MATERIAL_QUANTIZATION_URL);
    fetch(url)
      .then(async (r) => {
        const data = await parseJsonResponse<BQMaterialQuantization[]>(r, {
          label: 'build queue material quantization',
          url,
        });
        if (!r.ok) throw new Error(`${MATERIAL_QUANTIZATION_URL} ${r.status}`);
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        const map = new Map<string, BQMaterialQuantization>();
        for (const item of Array.isArray(data) ? data : []) {
          for (const key of [item.materialKey, item.materialName, item.materialId]) {
            const k = normalizeBQKey(key);
            if (k) map.set(k, item);
          }
        }
        setByKey(map);
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.warn('[quality] failed to load material_quality_quantization.json', err);
      });
    return () => { cancelled = true; };
  }, []);

  const getBandsForMaterial = useCallback((materialName: string | null | undefined): QualityBand[] | null => {
    const key = normalizeBQKey(materialName);
    const entry = byKey.get(key);
    if (!entry) return null;
    if (entry.qualityOptions?.length) return qualityOptionsToBands(entry.qualityOptions);
    if (entry.bands?.length) return entry.bands;
    return null;
  }, [byKey]);

  return { getBandsForMaterial };
}

function getSavedBandIndex(input: RecipeInputTemplate, qualityBands: QualityBand[]): number | null {
  const bandNumber = input.qualityBand;
  if (!Number.isFinite(bandNumber)) return null;
  return Math.max(0, Math.min(Math.trunc(bandNumber as number) - 1, qualityBands.length - 1));
}

function getRequirementId(item: BuildQueueItem, input: RecipeInputTemplate, inputIndex: number): string {
  return getRequirementLineKey(item, input, inputIndex);
}

function sortStacks(stacks: InventoryStack[], strategy: SourceStrategy): InventoryStack[] {
  return stacks.slice().sort((a, b) => {
    if (strategy === 'highest-quality') return (b.quality ?? 0) - (a.quality ?? 0) || b.quantity - a.quantity;
    if (strategy === 'minimize-splits') return b.quantity - a.quantity || (b.quality ?? 0) - (a.quality ?? 0);
    return (a.location?.name ?? a.locationId ?? '').localeCompare(b.location?.name ?? b.locationId ?? '') || b.quantity - a.quantity;
  });
}

function getAllocationId(
  itemId: string, requirementId: string, materialId: string,
  selectedQuality: number | undefined, unitType: RecipeInputTemplate['unitType'] | undefined,
  stack: InventoryStack,
): string {
  return [itemId, requirementId, materialId, selectedQuality ?? 'any', unitType ?? 'unit', stack.id].join(':');
}

function createAllocation(
  itemId: string, requirementId: string, selectedQuality: number | undefined,
  unitType: RecipeInputTemplate['unitType'] | undefined, stack: InventoryStack,
  materialName: string | undefined, quantityReserved: number, allowLowerQualityOverride = false,
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

function getItemFulfillmentState(item: BuildQueueItem, inputs: RecipeInputTemplate[], inventory: InventoryEntry[]): 'complete' | 'partial' | 'missing' {
  if (inputs.length === 0) return 'missing';
  let covered = 0;
  let missing = 0;
  for (const [inputIndex, input] of inputs.entries()) {
    const materialKey = input.materialKey ?? input.materialId;
    const coverage = getMaterialReservationCoverage(item, materialKey, input.quantity * item.quantity, inventory, {
      requirementId: getRequirementId(item, input, inputIndex),
      unitType: input.unitType,
    });
    if (coverage.coverageState === 'covered' || coverage.coverageState === 'overReserved') covered += 1;
    else missing += 1;
  }
  if (covered > 0 && missing > 0) return 'partial';
  if (covered > 0) return 'complete';
  return 'missing';
}

function getCoverageLabel(state: string): string {
  if (state === 'covered') return 'Covered';
  if (state === 'partial') return 'Partial';
  if (state === 'overReserved') return 'Over';
  if (state === 'stale') return 'Stale';
  return 'Missing';
}

function getReserveStatusLabel(state: string, qualityState: ReturnType<typeof getQualityProjectionStatus>): string {
  if (state === 'missing') return 'Missing';
  if (state === 'partial') return 'Partial';
  if (state === 'stale') return 'Stale';
  if (state === 'overReserved') return 'Over';
  if (qualityState === 'below') return 'Covered · Below target quality';
  if (qualityState === 'above') return 'Covered · Above target quality';
  return 'Covered · Meets target quality';
}

function getGroupedCoverageState(states: string[]): 'covered' | 'partial' | 'missing' {
  const isCovered = (s: string) => s === 'covered' || s === 'overReserved';
  if (states.length > 0 && states.every(isCovered)) return 'covered';
  if (states.length === 0 || states.every((s) => s === 'missing')) return 'missing';
  return 'partial';
}

function isRefinableMaterial(material: MaterialTemplate | undefined): boolean {
  const flagged = material as (MaterialTemplate & {
    isRefinable?: boolean;
    canComeFromRefinery?: boolean;
    sourceGroups?: string[];
  }) | undefined;
  return Boolean(
    flagged?.isRefinable === true ||
    flagged?.canComeFromRefinery === true ||
    flagged?.sourceGroups?.includes('ores'),
  );
}

function formatDecimal(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function getQualityValueFromBand(band: QualityBand | undefined): number | null {
  if (!band) return null;
  const value = Number(band.mappedValue ?? band.start);
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1000, Math.round(value)));
}

function getQualityRangeMin(qualityBands: QualityBand[] | null): number | null {
  return getQualityValueFromBand(qualityBands?.[0]);
}

function clampQualityForBands(value: number, qualityBands: QualityBand[]): number {
  const min = getQualityRangeMin(qualityBands) ?? getQualityValueFromBand(qualityBands[0]) ?? 0;
  return Math.max(min, Math.min(1000, Math.round(value)));
}

function parseDraftNumber(value: string): number | null {
  if (value.trim() === '' || value === '.' || value === '0.') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getItemQualitySummary(item: BuildQueueItem, inputs: RecipeInputTemplate[]) {
  const finalProductQuality = item.finalProductQuality;
  const snapshotAverage = Number(item.finalProductQualityAverage ?? finalProductQuality?.averageBand ?? finalProductQuality?.average ?? finalProductQuality?.quality);
  const snapshotBand = Number(item.finalProductQualityBand ?? finalProductQuality?.band);

  if (Number.isFinite(snapshotAverage)) {
    const bandForRarity = Number.isFinite(snapshotBand) ? snapshotBand : Math.max(1, Math.min(8, Math.floor(snapshotAverage)));
    return {
      label: `Band ${formatDecimal(snapshotAverage)}`,
      rarity: rarityFromBandIndex(bandForRarity),
      title: `Final product quality ${formatDecimal(snapshotAverage)}`,
    };
  }

  const bands = inputs.map((input) => {
    const qualityBands = input.qualityBands?.length ? input.qualityBands : FALLBACK_QUALITY_BANDS;
    const bandIndex = getSavedBandIndex(input, qualityBands) ?? findNearestBandForQuality(qualityBands, input.selectedQuality ?? 500);
    return bandIndex + 1;
  });
  const average = bands.length ? bands.reduce((s, b) => s + b, 0) / bands.length : 1;
  return {
    label: `Band ${formatDecimal(average)}`,
    rarity: rarityFromBandIndex(Math.max(1, Math.min(8, Math.floor(average)))),
    title: `Average selected material band ${formatDecimal(average)}`,
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  component: 'Component',
  weapon: 'Weapon',
  armor: 'Armor',
  consumable: 'Consumable',
  ship_part: 'Ship Part',
  other: 'Other',
};

const STALE_REASON_LABELS: Record<string, string> = {
  missingStack: 'missing stack',
  mismatchedMaterial: 'material changed',
  nonPositiveQuantity: 'empty reservation',
  exceedsStackQuantity: 'exceeds current stack',
};

type BuildQueueSummaryMetrics = { coveredCount: number; totalShortfall: number };

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
  onStatusChange: (id: string, status: NonNullable<BuildQueueItem['status']>) => void;
  onRemove: (id: string) => void;
  onToggleAllocation: (buildQueueItemId: string, allocation: ReservedMaterialAllocation) => void;
  onUpdateAllocationQuantity: (buildQueueItemId: string, allocationId: string, quantity: number) => void;
  onClearStaleAllocations: (buildQueueItemId: string) => void;
  iconMode: FittingIconMode;
}

// ─── Quality Slider ──────────────────────────────────────────────────────────

function MaterialQualityEditor({
  draftQuality, onDraftQualityChange, onApply, onCancel, onReset, quantizedBands,
}: {
  draftQuality: string;
  onDraftQualityChange: (value: string) => void;
  onApply: () => void;
  onCancel: () => void;
  onReset: () => void;
  quantizedBands: QualityBand[] | null;
}) {
  const qualityBands: QualityBand[] | null = quantizedBands;

  const minQuality = getQualityRangeMin(qualityBands);
  const parsedQuality = parseDraftNumber(draftQuality);
  const quality = qualityBands && parsedQuality !== null ? clampQualityForBands(parsedQuality, qualityBands) : null;
  const activeBandIndex = qualityBands && quality !== null ? findNearestBandForQuality(qualityBands, quality) : 0;
  const selectedQualityTierClass = rarityClassFromBandIndex(activeBandIndex + 1);

  const railMarkers = useMemo(() => {
    if (!qualityBands || minQuality === null) return [];
    const range = Math.max(1, 1000 - minQuality);
    return qualityBands.map((band, i) => {
      const val = getQualityValueFromBand(band) ?? minQuality;
      const left = Math.max(0, Math.min(100, ((val - minQuality) / range) * 100));
      return { index: i, mappedValue: val, left, edge: left < 4 ? 'start' : left > 96 ? 'end' : 'middle' };
    });
  }, [minQuality, qualityBands]);

  const bandOnePct = Math.max(0, Math.min(100, railMarkers[0]?.left ?? 0));
  const selectedPct = quality !== null && minQuality !== null ? Math.max(0, Math.min(100, ((quality - minQuality) / Math.max(1, 1000 - minQuality)) * 100)) : 0;
  const fillPct = Math.max(0, selectedPct - bandOnePct);

  if (!qualityBands || minQuality === null) {
    if (import.meta.env.DEV) console.warn('[quality] no quantization data for build queue material');
    return null;
  }

  return (
    <div className="bq-quality-panel">
      <div className="craft-quality-control craft-matq-slider-wrap bq-quality-control">
        <div className="craft-quality-rail-wrap craft-matq-rail-wrap bq-quality-rail-wrap">
        <input
          type="range"
          min={minQuality} max={1000} step={1}
          value={quality ?? minQuality}
          onChange={(e) => onDraftQualityChange(e.target.value)}
          className="craft-quality-input craft-matq-slider bq-quality-range"
          aria-label="Material quality"
        />
        <div className={`craft-quality-rail craft-matq-rail bq-quality-rail ${selectedQualityTierClass}`} style={{ '--band-one-pct': `${bandOnePct}%` } as React.CSSProperties}>
          <div
            className={`craft-quality-rail-fill craft-matq-rail-fill bq-quality-rail-fill ${selectedQualityTierClass}`}
            style={{ '--band-one-pct': `${bandOnePct}%`, '--fill-pct': `${fillPct}%` } as React.CSSProperties}
          />
          {railMarkers.map((marker) => {
            const markerTierClass = rarityClassFromBandIndex(marker.index + 1);
            const markerState =
              marker.mappedValue < (quality ?? minQuality)
                ? ' is-before-active'
                : marker.index === activeBandIndex
                  ? ' is-active'
                  : '';
            return (
              <span
                key={`${marker.index}-${marker.mappedValue}`}
                className={`craft-quality-marker craft-matq-band-marker bq-quality-marker ${markerTierClass}${markerState}`}
                style={{ left: `${marker.left}%` }}
                data-edge={marker.edge}
                aria-label={`Band guide ${marker.mappedValue}`}
              >
                <span className="craft-quality-marker-line craft-matq-dot bq-quality-marker-line" />
                <span className={`craft-quality-marker-value craft-matq-marker-value bq-quality-marker-value ${markerTierClass}`}>{marker.mappedValue}</span>
              </span>
            );
          })}
        </div>
        </div>
      </div>
      <div className="bq-quality-actions">
        <button type="button" className="bq-btn" onClick={onReset}>Reset to recipe target</button>
        <button type="button" className="bq-btn" onClick={onCancel}>Cancel</button>
        <button type="button" className="bq-btn bq-btn--confirm" onClick={onApply}>Apply</button>
      </div>
    </div>
  );
}

// ─── Group ───────────────────────────────────────────────────────────────────

export default function BuildQueueGroup({
  category, items, recipes, recipeInputsByRecipeId, buildQueue, inventory,
  materials, locations, strategy, onQuantityChange,
  onMaterialRequirementChange, onStatusChange, onRemove, onToggleAllocation, onUpdateAllocationQuantity, onClearStaleAllocations,
  iconMode,
}: Props) {
  const [activeDrawersByItem, setActiveDrawersByItem] = useState<Record<string, BuildQueueActiveDrawer | undefined>>({});
  const [qualityDrafts, setQualityDrafts] = useState<Record<string, string>>({});
  const [reserveDrafts, setReserveDrafts] = useState<Record<string, string>>({});
  const isMobileTouchLayout = useIsMobileTouchLayout();
  const { getBandsForMaterial: getQuantizedBands } = useBQQuantization();

  function openQualityEditor(itemId: string, editorKey: string, selectedQuality: number) {
    const alreadyOpen =
      activeDrawersByItem[itemId]?.type === 'quality' &&
      activeDrawersByItem[itemId]?.requirementKey === editorKey;
    setActiveDrawersByItem((prev) => ({ ...prev, [itemId]: alreadyOpen ? undefined : { type: 'quality', requirementKey: editorKey } }));
    setQualityDrafts((prev) => {
      const next = { ...prev };
      delete next[editorKey];
      if (!alreadyOpen) next[editorKey] = String(Math.round(selectedQuality));
      return next;
    });
  }

  function toggleReserveDrawer(itemId: string, requirementKey: string, isOpen: boolean) {
    setActiveDrawersByItem((prev) => ({ ...prev, [itemId]: isOpen ? undefined : { type: 'reserve', requirementKey } }));
  }

  function clampQualityDraft(editorKey: string, qualityBands: QualityBand[]) {
    const parsed = parseDraftNumber(qualityDrafts[editorKey] ?? '');
    if (parsed === null) return;
    setQualityDrafts((prev) => ({ ...prev, [editorKey]: String(clampQualityForBands(parsed, qualityBands)) }));
  }

  function cancelQualityEditor(itemId: string, editorKey: string) {
    if (
      activeDrawersByItem[itemId]?.type === 'quality' &&
      activeDrawersByItem[itemId]?.requirementKey === editorKey
    ) {
      setActiveDrawersByItem((prev) => ({ ...prev, [itemId]: undefined }));
    }
    setQualityDrafts((prev) => {
      const next = { ...prev };
      delete next[editorKey];
      return next;
    });
  }

  function applyQualityEditor(
    item: BuildQueueItem,
    input: RecipeInputTemplate,
    requirementId: string,
    editorKey: string,
    qualityBands: QualityBand[],
    ownAllocations: ReservedMaterialAllocation[],
    effectiveReservedQuality: number | undefined,
  ) {
    const parsed = parseDraftNumber(qualityDrafts[editorKey] ?? '');
    if (parsed === null) return;
    const draftQuality = clampQualityForBands(parsed, qualityBands);
    const bandIndex = findNearestBandForQuality(qualityBands, draftQuality);
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
    if (Number.isFinite(effectiveReservedQuality) && draftQuality > Number(effectiveReservedQuality)) {
      ownAllocations.forEach((allocation) => onToggleAllocation(item.id, allocation));
    }
    cancelQualityEditor(item.id, editorKey);
  }

  return (
    <div className="bq-category">
      {items.map((item) => {
        const recipe = getRecipeForQueueItem(item.recipeId, recipes);
        const itemName = item.itemName ?? recipe?.name ?? item.recipeId;
        const inputs = getBuildQueueItemInputs(item, recipeInputsByRecipeId);
        const hasMaterialInputs = inputs.length > 0;
        const showRecipeUnmappedBadge = !hasMaterialInputs && item.status !== 'complete';
        const isCompletedCraft = item.status === 'complete';
        const blueprintSources = item.blueprintSources ?? [];
        const fulfillment = getItemFulfillmentState(item, inputs, inventory);
        const qualitySummary = getItemQualitySummary(item, inputs);

        const summaryMetrics = inputs.reduce<BuildQueueSummaryMetrics>((metrics, input, inputIndex) => {
          const materialKey = input.materialKey ?? input.materialId;
          const required = input.quantity * item.quantity;
          const requirementIdentity = {
            requirementId: getRequirementId(item, input, inputIndex),
            selectedQuality: input.selectedQuality,
            unitType: input.unitType,
            allowLowerQuality: Boolean(item.allowLowerQuality),
          };
          const coverage = getMaterialReservationCoverage(item, materialKey, required, inventory, requirementIdentity);
          const needSummary = getBuildQueueMaterialNeedSummary(item, materialKey, required, inventory, buildQueue, requirementIdentity);
          const isCovered = coverage.coverageState === 'covered' || coverage.coverageState === 'overReserved';
          return {
            coveredCount: metrics.coveredCount + (isCovered ? 1 : 0),
            totalShortfall: metrics.totalShortfall + needSummary.stillNeeded,
          };
        }, { coveredCount: 0, totalShortfall: 0 });

        const coveragePercent = inputs.length > 0 ? Math.round((summaryMetrics.coveredCount / inputs.length) * 100) : 0;

        const materialRequirementRows = inputs.map((input, inputIndex) => {
          const materialKey = input.materialKey ?? input.materialId;
          const requirementId = getRequirementId(item, input, inputIndex);
          const groupKey = `${item.id}:${requirementId}`;
          const requirementCardKey = `${groupKey}:${requirementId}:${inputIndex}`;
          const material = materials.find((e) => e.id === materialKey);
          const displayName = input.displayName ?? input.materialName ?? material?.name ?? `Unresolved: ${input.rawName ?? materialKey}`;
          const required = input.quantity * item.quantity;
          const qualityBands = getQuantizedBands(displayName) ?? (input.qualityBands?.length ? input.qualityBands : null);
          const savedBandIndex = qualityBands
            ? (getSavedBandIndex(input, qualityBands) ?? findNearestBandForQuality(qualityBands, input.selectedQuality ?? 500))
            : 0;
          const selectedQuality = qualityBands
            ? clampQualityForBands(input.selectedQuality ?? getBandEffectiveQuality(qualityBands, savedBandIndex), qualityBands)
            : (input.selectedQuality ?? 0);
          const requirementSelectedQuality = input.selectedQuality;
          const selectedQualityRarity = rarityFromBandIndex(savedBandIndex + 1);
          const modifierAtQuality = getModifierProjectionFromQuality(input, selectedQuality);
          const modifierLabel = modifierAtQuality?.property ?? input.modifierName;
          const modifierValue = modifierAtQuality?.value ?? input.modifierValue;
          const modifierDisplayLabel = modifierLabel ? formatProperty(modifierLabel) : '-';
          const modifierDisplayValue = modifierAtQuality
            ? formatModifierAtQuality(modifierAtQuality)
            : input.modifierName && input.modifierValue !== undefined
              ? formatModifierAtQuality({ slot: '', property: input.modifierName, value: input.modifierValue, modifierMode: input.modifierType })
              : '';
          const modifierPreview = modifierDisplayValue ? `${modifierDisplayLabel} ${modifierDisplayValue}` : modifierDisplayLabel;
          const modifierTone = getModifierTrendClass(modifierLabel, modifierValue);
          const allowLowerQuality = Boolean(item.allowLowerQuality);
          const requirementIdentity = { requirementId, selectedQuality: requirementSelectedQuality, unitType: input.unitType };
          const effectiveRequirementIdentity = { ...requirementIdentity, allowLowerQuality };
          const coverage = getMaterialReservationCoverage(item, materialKey, required, inventory, effectiveRequirementIdentity);
          const needSummary = getBuildQueueMaterialNeedSummary(item, materialKey, required, inventory, buildQueue, effectiveRequirementIdentity);
          const ownAllocations = item.reservedAllocations?.filter((a) => allocationMatchesRequirement(a, materialKey, effectiveRequirementIdentity)) ?? [];
          const ownReservedByStack = new Map(ownAllocations.map((a) => [a.inventoryEntryId, a.quantityReserved]));
          const effectiveReservedQuality = getWeightedEffectiveQuality(ownAllocations);
          const allocatedAmount = getAllocationTotal(ownAllocations);
          const remainingRequired = getRemainingRequiredAmount(required, allocatedAmount);
          const qualityProjectionState = getQualityProjectionStatus(allocatedAmount, required, effectiveReservedQuality, requirementSelectedQuality);
          const reserveStatusLabel = getReserveStatusLabel(coverage.coverageState, qualityProjectionState);
          const allMaterialStacks = sortStacks(
            getInventoryStacks(inventory.filter((e) => e.materialId === materialKey && e.quantity > 0), materials, locations),
            strategy,
          );
          const reservableStacks = allMaterialStacks
            .filter((stack) => getAvailableQuantityForInventoryEntry(stack, buildQueue, item.id) > 0 || ownReservedByStack.has(stack.id))
            .sort((a, b) => {
              if (requirementSelectedQuality === undefined) return 0;
              const aBelow = (a.quality ?? 0) < requirementSelectedQuality;
              const bBelow = (b.quality ?? 0) < requirementSelectedQuality;
              return Number(aBelow) - Number(bBelow);
            });

          return {
            input, materialKey, requirementId, groupKey, requirementCardKey, material, displayName, qualityBands,
            required, selectedQuality, requirementSelectedQuality, selectedQualityRarity, modifierPreview, modifierLabel, modifierValue, modifierDisplayLabel, modifierDisplayValue, modifierTone,
            allowLowerQuality, coverage, needSummary, ownAllocations, ownReservedByStack,
            allocatedAmount, remainingRequired, effectiveReservedQuality, qualityProjectionState, reserveStatusLabel,
            allMaterialStacks, reservableStacks, ineligibleStacks: [] as InventoryStack[],
            staleAllocations: coverage.validations.filter((v) => v.isStale),
          };
        });

        const materialGroups = Array.from(
          materialRequirementRows.reduce((groups, row) => {
            const existing = groups.get(row.groupKey);
            if (existing) existing.requirements.push(row);
            else groups.set(row.groupKey, { groupKey: row.groupKey, requirements: [row] });
            return groups;
          }, new Map<string, { groupKey: string; requirements: typeof materialRequirementRows }>()),
        ).map(([, group]) => {
          const first = group.requirements[0];
          return {
            ...group,
            displayName: first.displayName,
            material: first.material,
            selectedQuality: first.selectedQuality,
            selectedQualityRarity: first.selectedQualityRarity,
            qualityBands: first.qualityBands,
            rowTone: getGroupedCoverageState(group.requirements.map((r) => r.coverage.coverageState)),
            reserveStatusLabel: first.reserveStatusLabel,
            requiredTotal: group.requirements.reduce((s, r) => s + r.required, 0),
            reservedTotal: group.requirements.reduce((s, r) => s + r.coverage.reservedQuantity, 0),
            ownedQuantity: Math.max(0, ...group.requirements.map((r) => r.needSummary.ownedQuantity)),
            availableQuantity: Math.max(0, ...group.requirements.map((r) => r.needSummary.availableQuantity)),
            needTotal: group.requirements.reduce((s, r) => s + r.needSummary.stillNeeded, 0),
            hasStock: group.requirements.some((r) => r.allMaterialStacks.length > 0),
          };
        });

        const blueprintLabel = blueprintSources.length === 0
          ? 'Unknown blueprint'
          : blueprintSources.map((s) => s.displayName).join(', ');

        return (
          <article
            key={item.id}
            className={[
              'bq-item',
              `bq-item--${isCompletedCraft ? 'completed-craft' : fulfillment}`,
              isMobileTouchLayout ? 'bq-item--mobile-touch' : '',
            ].filter(Boolean).join(' ')}
          >

            {/* ── Component header: summary | product visual | controls ── */}
            <div className="bq-item-sidebar bq-item-header">
              <div className="bq-item-summary">
                <div className="bq-item-name-block">
                  <div className="bq-item-name-top">
                    <span className="bq-item-cat">{CATEGORY_LABELS[category] ?? category}</span>
                  </div>
                  <h2 className="bq-item-name">{itemName}</h2>
                </div>

                <div className="bq-item-badges">
                  {isCompletedCraft && (
                    <span className="bq-badge bq-badge--complete">Completed Craft</span>
                  )}
                  <span className={`bq-badge bq-badge--${fulfillment === 'complete' ? 'covered' : fulfillment}`}>
                    {fulfillment === 'complete' ? 'Covered' : fulfillment === 'partial' ? 'Partial' : 'Missing'}
                  </span>
                  <span className={`bq-badge bq-badge--quality logi-rarity--${qualitySummary.rarity}`} title={qualitySummary.title}>
                    {qualitySummary.label}
                  </span>
                  {showRecipeUnmappedBadge ? (
                    <span className="bq-badge bq-badge--neutral" title="Material requirements are unavailable until this craft is linked to a recipe.">
                      Recipe not mapped
                    </span>
                  ) : null}
                  <span className="bq-item-blueprint" title={blueprintLabel}>
                    {blueprintLabel}
                  </span>
                </div>
              </div>

              <div className="bq-item-visual" aria-hidden="true">
                <BuildQueueProductIcon
                  item={item}
                  recipe={recipe}
                  preferredMode={iconMode}
                  layout={isMobileTouchLayout ? 'mobile' : 'desktop'}
                  alt={itemName}
                />
              </div>

              <div className="bq-item-controls">
                <div className="bq-qty">
                  <button type="button" className="bq-qty-btn" onClick={() => onQuantityChange(item.id, item.quantity - 1)} disabled={item.quantity <= 1} aria-label="Decrease quantity">−</button>
                  <span className="bq-qty-val">{item.quantity}×</span>
                  <button type="button" className="bq-qty-btn" onClick={() => onQuantityChange(item.id, item.quantity + 1)} aria-label="Increase quantity">+</button>
                </div>
          
                <div className="bq-btn-row">
                  <button
                    type="button"
                    className={`bq-btn${isCompletedCraft ? '' : ' bq-btn--confirm'}`}
                    onClick={() => onStatusChange(item.id, isCompletedCraft ? 'queued' : 'complete')}
                    aria-label={isCompletedCraft ? `Move ${itemName} back to build queue` : `Complete ${itemName}`}
                  >
                    {isCompletedCraft ? 'Reopen' : 'Complete'}
                  </button>
                  <button type="button" className="bq-btn bq-btn--danger" onClick={() => onRemove(item.id)} aria-label={`Remove ${itemName}`}>Remove</button>
                </div>
              </div>
            </div>

            {/* ── Right body ── */}
            <div className="bq-item-body">
              {/* Coverage bar */}
              <div className="bq-coverage" aria-label={`${itemName} material coverage`}>
                <span>{summaryMetrics.coveredCount}/{inputs.length} covered</span>
                <div className="bq-coverage-track">
                  <div className="bq-coverage-fill" style={{ width: `${coveragePercent}%` }} />
                </div>
                {summaryMetrics.totalShortfall > 0 && (
                  <span className="bq-coverage-short">{formatQuantity(summaryMetrics.totalShortfall, undefined)} short</span>
                )}
              </div>

              {/* Material table */}
              {hasMaterialInputs ? (
              <section className="bq-materials-section">
                {isMobileTouchLayout ? (
                  <h3 className="bq-materials-section-label">Required Materials</h3>
                ) : null}
              <div className="bq-mat-table">
                {!isMobileTouchLayout ? (
                <div className="bq-mat-head" aria-hidden="true">
                  <span>Material</span>
                  <span>Status</span>
                  <span>Quality</span>
                  <span>Modifier</span>
                  <span>Available</span>
                  <span>Need</span>
                  <span>Quality</span>
                </div>
                ) : null}

                {materialGroups.map((group) => {
                  const activeDrawer = activeDrawersByItem[item.id];
                  const reserveExpanded =
                    activeDrawer?.type === 'reserve' &&
                    activeDrawer.requirementKey === group.groupKey;
                  const qualityExpanded =
                    activeDrawer?.type === 'quality' &&
                    activeDrawer.requirementKey === group.groupKey;
                  const qualityRequirement = group.requirements[0];
                  const qualityDraft = qualityExpanded
                    ? (qualityDrafts[group.groupKey] ?? String(group.selectedQuality))
                    : String(group.selectedQuality);
                  const parsedQualityDraft = parseDraftNumber(qualityDraft);
                  const previewQuality = qualityExpanded && qualityRequirement.qualityBands && parsedQualityDraft !== null
                    ? clampQualityForBands(parsedQualityDraft, qualityRequirement.qualityBands)
                    : group.selectedQuality;
                  const previewQualityRarity = qualityRequirement.qualityBands
                    ? rarityFromBandIndex(findNearestBandForQuality(qualityRequirement.qualityBands, previewQuality) + 1)
                    : group.selectedQualityRarity;
                  const materialStatusLabel = group.reserveStatusLabel ?? getCoverageLabel(group.rowTone);
                  const hideMaterialStatus = isMobileTouchLayout
                    && fulfillment === 'missing'
                    && (materialStatusLabel === 'Missing' || group.rowTone === 'missing');
                  const coveredScu = Math.max(0, group.requiredTotal - group.needTotal);
                  const primaryModifier = group.requirements.map((req) => {
                    const rowQuality = qualityExpanded && req.requirementCardKey === qualityRequirement.requirementCardKey
                      ? previewQuality
                      : req.selectedQuality;
                    const rowModifierAtQuality = getModifierProjectionFromQuality(req.input, rowQuality);
                    const rowModifierDisplayLabel = rowModifierAtQuality?.property ? formatProperty(rowModifierAtQuality.property) : req.modifierDisplayLabel;
                    const rowModifierDisplayValue = rowModifierAtQuality ? formatModifierAtQuality(rowModifierAtQuality) : req.modifierDisplayValue;
                    const rowModifierPreview = rowModifierDisplayValue ? `${rowModifierDisplayLabel} ${rowModifierDisplayValue}` : rowModifierDisplayLabel;
                    const rowModifierTone = getModifierTrendClass(
                      rowModifierAtQuality?.property ?? req.modifierLabel,
                      rowModifierAtQuality?.value ?? req.modifierValue,
                    );
                    return {
                      key: `${req.requirementCardKey}:mod`,
                      preview: rowModifierPreview,
                      tone: rowModifierTone,
                    };
                  });
                  const primaryAffix = primaryModifier[0];
                  return (
                    <section
                      key={group.groupKey}
                      className={[
                        'bq-mat-group',
                        group.needTotal > 0 ? 'bq-mat-group--missing' : '',
                        isMobileTouchLayout ? 'bq-mat-group--mobile-card' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      {isMobileTouchLayout ? (
                      <div className="bq-mat-row bq-mat-row--mobile-card bq-mat-row--touch">
                        <div className="bq-mat-card-head">
                          <div className="bq-mat-name">
                            <span className="bq-material-name-cell">
                              <MaterialIcon materialName={group.displayName} materialState={isRefinableMaterial(group.material) ? 'refined' : 'raw'} />
                              <strong>{group.displayName}</strong>
                            </span>
                            {group.requirements.length > 1 ? (
                              <span>{group.requirements.length} requirements</span>
                            ) : null}
                          </div>
                          {!hideMaterialStatus ? (
                            <span className={`bq-mat-status bq-mat-status--${group.rowTone}`}>{materialStatusLabel}</span>
                          ) : null}
                        </div>
                        <div className="bq-mat-card-metrics">
                          <span className={`bq-mat-card-scu ${materialTypeClass(group.material)}`}>
                            <em>{formatQuantity(coveredScu, group.material)}</em>
                            {' / '}
                            {formatQuantity(group.requiredTotal, group.material)} SCU
                          </span>
                          {qualityExpanded && qualityRequirement.qualityBands ? (
                            <input
                              type="text"
                              inputMode="numeric"
                              className={`bq-quality-inline-input bq-badge bq-badge--quality logi-rarity--${previewQualityRarity} is-active`}
                              value={qualityDraft}
                              aria-label="Material quality"
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => setQualityDrafts((prev) => ({ ...prev, [group.groupKey]: event.target.value }))}
                              onBlur={() => clampQualityDraft(group.groupKey, qualityRequirement.qualityBands as QualityBand[])}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  applyQualityEditor(
                                    item,
                                    qualityRequirement.input,
                                    qualityRequirement.requirementId,
                                    group.groupKey,
                                    qualityRequirement.qualityBands as QualityBand[],
                                    qualityRequirement.ownAllocations,
                                    qualityRequirement.effectiveReservedQuality,
                                  );
                                }
                                if (event.key === 'Escape') cancelQualityEditor(item.id, group.groupKey);
                              }}
                            />
                          ) : (
                            <button
                              type="button"
                              className={`bq-mat-card-quality bq-quality-badge bq-badge bq-badge--quality logi-rarity--${group.selectedQualityRarity}`}
                              aria-expanded={qualityExpanded}
                              onClick={(event) => {
                                event.stopPropagation();
                                openQualityEditor(item.id, group.groupKey, group.selectedQuality);
                              }}
                            >
                              Q{group.selectedQuality}
                            </button>
                          )}
                        </div>
                        {primaryAffix ? (
                          <div className="bq-mat-card-affix">
                            <span className={`bq-mat-modifier-entry ${primaryAffix.tone}`}>
                              <span className="bq-mat-modifier-label">{primaryAffix.preview}</span>
                            </span>
                          </div>
                        ) : null}
                        {group.needTotal > 0 ? (
                          <span className={`bq-mat-card-short${fulfillment === 'missing' ? ' bq-mat-card-short--critical' : ''} ${materialTypeClass(group.material)}`}>
                            {formatQuantity(group.needTotal, group.material)} short
                          </span>
                        ) : null}
                        <div className="bq-mat-actions" data-bq-row-control="true">
                          <button
                            type="button"
                            className={`bq-reserve-open-btn${reserveExpanded ? ' is-active' : ''}`}
                            aria-expanded={reserveExpanded}
                            data-bq-row-control="true"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleReserveDrawer(item.id, group.groupKey, reserveExpanded);
                            }}
                          >
                            {reserveExpanded ? 'Hide' : 'Reserve'}
                          </button>
                          <button
                            type="button"
                            className={`bq-quality-toggle-btn${qualityExpanded ? ' is-active' : ''}`}
                            aria-expanded={qualityExpanded}
                            data-bq-row-control="true"
                            onClick={(event) => {
                              event.stopPropagation();
                              openQualityEditor(item.id, group.groupKey, group.selectedQuality);
                            }}
                          >
                            {qualityExpanded ? 'Hide' : 'Quality'}
                          </button>
                        </div>
                      </div>
                      ) : (
                      <div
                        className="bq-mat-row"
                        onClick={(event) => {
                          if (isDrawerToggleExcluded(event.target)) return;
                          toggleReserveDrawer(item.id, group.groupKey, reserveExpanded);
                        }}
                      >
                        <div className="bq-mat-name">
                          <span className="bq-material-name-cell">
                            <MaterialIcon materialName={group.displayName} materialState={isRefinableMaterial(group.material) ? 'refined' : 'raw'} />
                            <strong>{group.displayName}</strong>
                          </span>
                          {group.requirements.length > 1 && <span>{group.requirements.length} requirements</span>}
                        </div>
                        <span className={`bq-mat-status bq-mat-status--${group.rowTone}`}>{materialStatusLabel}</span>
                        {qualityExpanded && qualityRequirement.qualityBands ? (
                          <input
                            type="text"
                            inputMode="numeric"
                            className={`bq-quality-inline-input bq-badge bq-badge--quality logi-rarity--${previewQualityRarity} is-active`}
                            value={qualityDraft}
                            aria-label="Material quality"
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => setQualityDrafts((prev) => ({ ...prev, [group.groupKey]: event.target.value }))}
                            onBlur={() => clampQualityDraft(group.groupKey, qualityRequirement.qualityBands as QualityBand[])}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                applyQualityEditor(
                                  item,
                                  qualityRequirement.input,
                                  qualityRequirement.requirementId,
                                  group.groupKey,
                                  qualityRequirement.qualityBands as QualityBand[],
                                  qualityRequirement.ownAllocations,
                                  qualityRequirement.effectiveReservedQuality,
                                );
                              }
                              if (event.key === 'Escape') cancelQualityEditor(item.id, group.groupKey);
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className={`bq-quality-badge bq-badge bq-badge--quality logi-rarity--${group.selectedQualityRarity}`}
                            aria-expanded={qualityExpanded}
                            onClick={(event) => {
                              event.stopPropagation();
                              openQualityEditor(item.id, group.groupKey, group.selectedQuality);
                            }}
                          >
                            {group.selectedQuality}
                          </button>
                        )}
                        <div className="bq-mat-modifier">
                          {primaryModifier.map((entry) => (
                            <span
                              className={`bq-mat-modifier-entry ${entry.tone}`}
                              key={entry.key}
                            >
                              <span className="bq-mat-modifier-label">{entry.preview}</span>
                            </span>
                          ))}
                        </div>
                        <span className={`bq-qty-cell ${materialTypeClass(group.material)}`}>{formatQuantity(group.availableQuantity, group.material)}</span>
                        <span className={`bq-qty-cell${group.needTotal > 0 ? ' bq-qty-cell--short' : ''} ${materialTypeClass(group.material)}`}>{formatQuantity(group.needTotal, group.material)}</span>
                        <div className="bq-mat-actions" data-bq-row-control="true">
                          <button
                            type="button"
                            className={`bq-reserve-open-btn${reserveExpanded ? ' is-active' : ''}`}
                            aria-expanded={reserveExpanded}
                            data-bq-row-control="true"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleReserveDrawer(item.id, group.groupKey, reserveExpanded);
                            }}
                          >
                            {reserveExpanded ? 'Hide' : 'Reserve'}
                          </button>
                          <button
                            type="button"
                            className={`bq-quality-toggle-btn${qualityExpanded ? ' is-active' : ''}`}
                            aria-expanded={qualityExpanded}
                            data-bq-row-control="true"
                            onClick={(event) => {
                              event.stopPropagation();
                              openQualityEditor(item.id, group.groupKey, group.selectedQuality);
                            }}
                          >
                            {qualityExpanded ? 'Hide' : 'Quality'}
                          </button>
                        </div>
                      </div>
                      )}

                      {group.requirements.flatMap((req) => req.staleAllocations).map(({ allocation, staleReason }) => (
                        <div key={allocation.id} className="bq-stale-line">
                          <span>Stale: {allocation.materialName ?? allocation.materialId} ({STALE_REASON_LABELS[staleReason ?? ''] ?? 'invalid'})</span>
                          <button type="button" className="bq-btn" onClick={() => onClearStaleAllocations(item.id)}>Remove stale</button>
                        </div>
                      ))}

                      {qualityExpanded && qualityRequirement.qualityBands && (
                        <div className="bq-quality-inline-drawer">
                          <MaterialQualityEditor
                            draftQuality={qualityDraft}
                            quantizedBands={qualityRequirement.qualityBands}
                            onDraftQualityChange={(value) => setQualityDrafts((prev) => ({ ...prev, [group.groupKey]: value }))}
                            onApply={() => applyQualityEditor(
                              item,
                              qualityRequirement.input,
                              qualityRequirement.requirementId,
                              group.groupKey,
                              qualityRequirement.qualityBands as QualityBand[],
                              qualityRequirement.ownAllocations,
                              qualityRequirement.effectiveReservedQuality,
                            )}
                            onCancel={() => cancelQualityEditor(item.id, group.groupKey)}
                            onReset={() => setQualityDrafts((prev) => ({ ...prev, [group.groupKey]: String(qualityRequirement.input.selectedQuality ?? group.selectedQuality) }))}
                          />
                        </div>
                      )}

                      {reserveExpanded && (
                        <div className="bq-reserve-panel">
                          <div className="bq-reserve-panel-label">Reserve from inventory</div>
                          {group.requirements.map((req) => {
                            const getDraftAllocationValue = (allocationId: string, reservedQuantity: number) =>
                              reserveDrafts[allocationId] ?? (reservedQuantity ? String(reservedQuantity) : '');
                            const getDraftQuantity = (allocationId: string, reservedQuantity: number) => {
                              const parsed = parseDraftNumber(getDraftAllocationValue(allocationId, reservedQuantity));
                              return parsed ?? reservedQuantity;
                            };
                            const saveReserve = () => {
                              let committedTotal = 0;
                              for (const stack of req.reservableStacks) {
                                const allocationId = getAllocationId(item.id, req.requirementId, req.materialKey, req.requirementSelectedQuality, req.input.unitType, stack);
                                const existingAllocation = req.ownAllocations.find((allocation) => allocation.inventoryEntryId === stack.id);
                                const reservedQuantity = existingAllocation?.quantityReserved ?? 0;
                                const availableAfterThisReservation = getLotAvailableAmountAfterReservations(stack, buildQueue, item.id, req.ownAllocations);
                                const maxLotQuantity = Math.max(0, reservedQuantity + availableAfterThisReservation);
                                const parsed = parseDraftNumber(getDraftAllocationValue(allocationId, reservedQuantity));
                                const desiredQuantity = parsed === null ? reservedQuantity : parsed;
                                const remainingCapacity = Math.max(0, req.required - committedTotal);
                                const quantityReserved = Math.max(0, Math.min(desiredQuantity, maxLotQuantity, remainingCapacity));
                                committedTotal += quantityReserved;
                                const isBelowTarget = req.requirementSelectedQuality !== undefined && (stack.quality ?? 0) < req.requirementSelectedQuality;
                                if (quantityReserved <= 0) {
                                  if (existingAllocation) onToggleAllocation(item.id, existingAllocation);
                                } else if (existingAllocation) {
                                  if (existingAllocation.quantityReserved !== quantityReserved) {
                                    onUpdateAllocationQuantity(item.id, existingAllocation.id, quantityReserved);
                                  }
                                } else {
                                  onToggleAllocation(item.id, createAllocation(item.id, req.requirementId, req.requirementSelectedQuality, req.input.unitType, stack, req.material?.name, quantityReserved, isBelowTarget));
                                }
                              }
                              setActiveDrawersByItem((prev) => ({ ...prev, [item.id]: undefined }));
                            };
                            const clearReserve = () => {
                              req.ownAllocations.forEach((allocation) => onToggleAllocation(item.id, allocation));
                              setReserveDrafts((prev) => {
                                const next = { ...prev };
                                for (const stack of req.reservableStacks) {
                                  delete next[getAllocationId(item.id, req.requirementId, req.materialKey, req.requirementSelectedQuality, req.input.unitType, stack)];
                                }
                                return next;
                              });
                            };
                            const cancelReserve = () => {
                              setActiveDrawersByItem((prev) => ({ ...prev, [item.id]: undefined }));
                              setReserveDrafts((prev) => {
                                const next = { ...prev };
                                for (const stack of req.reservableStacks) {
                                  delete next[getAllocationId(item.id, req.requirementId, req.materialKey, req.requirementSelectedQuality, req.input.unitType, stack)];
                                }
                                return next;
                              });
                            };
                            return (
                              <div key={`${req.requirementCardKey}:reserve`} className="bq-reserve-req">
                                {group.requirements.length > 1 && (
                                  <div className="bq-reserve-req-head">                       
                                  </div>
                                )}

                                {req.reservableStacks.length > 0 ? req.reservableStacks.map((stack, stackIndex) => {
                                  const existingAllocation = req.ownAllocations.find((allocation) => allocation.inventoryEntryId === stack.id);
                                  const reservedQuantity = existingAllocation?.quantityReserved ?? 0;
                                  const availableAfterThisReservation = getLotAvailableAmountAfterReservations(stack, buildQueue, item.id, req.ownAllocations);
                                  const maxQuantity = Math.max(0, reservedQuantity + availableAfterThisReservation);
                                  const allocationId = getAllocationId(item.id, req.requirementId, req.materialKey, req.requirementSelectedQuality, req.input.unitType, stack);
                                  const draftValue = getDraftAllocationValue(allocationId, reservedQuantity);
                                  const draftQuantity = getDraftQuantity(allocationId, reservedQuantity);
                                  const checked = draftQuantity > 0;
                                  const nextQuantity = Math.min(maxQuantity, Math.max(0, req.required - (req.allocatedAmount - reservedQuantity)));
                                  const disabled = !checked && nextQuantity <= 0;
                                  const isBelowTarget = req.requirementSelectedQuality !== undefined && (stack.quality ?? 0) < req.requirementSelectedQuality;
                                  const previousStack = req.reservableStacks[stackIndex - 1];
                                  const previousBelowTarget = previousStack ? req.requirementSelectedQuality !== undefined && (previousStack.quality ?? 0) < req.requirementSelectedQuality : null;
                                  const showSectionTitle = stackIndex === 0 || previousBelowTarget !== isBelowTarget;
                                  const handleQuantityChange = (rawValue: string) => {
                                    setReserveDrafts((prev) => ({ ...prev, [allocationId]: rawValue }));
                                  };
                                  return (
                                    <div key={stack.id} className="bq-reserve-stack-wrap">
                                      {showSectionTitle && (
                                        <div className={`bq-reserve-stock-title${isBelowTarget ? ' bq-reserve-stock-title--below' : ''}`}>
                                          {isBelowTarget ? 'Below target quality' : 'Meets or exceeds target'}
                                        </div>
                                      )}
                                    <label className={`bq-stack-line${checked ? ' is-selected' : ''}${isBelowTarget ? ' bq-stack-line--below-target' : ''}`}>
                                      <div className="bq-stack-line-top">
                                        <input
                                          type="checkbox"
                                          className="bq-stack-cb"
                                          checked={checked}
                                          disabled={disabled}
                                          onChange={() => {
                                            setReserveDrafts((prev) => ({ ...prev, [allocationId]: checked ? '' : String(nextQuantity) }));
                                          }}
                                        />
                                        <span className="bq-stack-location">{stack.location?.name ?? stack.locationId}</span>
                                        <span className="bq-stack-container">{stack.container ?? '—'}</span>
                                      </div>
                                      <span className={`bq-stack-quality ${rarityClass(stack.rarity)}`}>
                                        Q{stack.quality ?? '—'}{isBelowTarget ? ' · Below target' : ''}
                                      </span>
                                      <span className={`bq-stack-available ${materialTypeClass(req.material)}`}>
                                        {formatQuantity(availableAfterThisReservation, req.material)} SCU avail
                                      </span>
                                      <span className={`bq-stack-reserved ${materialTypeClass(req.material)}`}>
                                        {formatQuantity(reservedQuantity, req.material)} SCU reserved
                                      </span>
                                      <div className="bq-reserve-input-wrap">
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          className="bq-reserve-amount-input"
                                          value={draftValue}
                                          placeholder="0"
                                          aria-label={`Reserved SCU for ${stack.location?.name ?? stack.locationId}`}
                                          disabled={disabled}
                                          onBlur={() => {
                                            const parsed = parseDraftNumber(draftValue);
                                            if (parsed !== null) setReserveDrafts((prev) => ({ ...prev, [allocationId]: String(Math.max(0, Math.min(parsed, maxQuantity))) }));
                                          }}
                                          onKeyDown={(event) => {
                                            if (event.key === 'Enter') saveReserve();
                                            if (event.key === 'Escape') cancelReserve();
                                          }}
                                          onChange={(event) => handleQuantityChange(event.target.value)}
                                        />
                                        <button
                                          type="button"
                                          className="bq-reserve-quick-fill"
                                          disabled={nextQuantity <= 0}
                                          onClick={() => setReserveDrafts((prev) => ({ ...prev, [allocationId]: String(nextQuantity) }))}
                                        >
                                          Fill
                                        </button>
                                        {checked ? (
                                          <button
                                            type="button"
                                            className="bq-reserve-clear-row"
                                            aria-label="Clear reservation for this stack"
                                            onClick={() => setReserveDrafts((prev) => ({ ...prev, [allocationId]: '' }))}
                                          >
                                            −
                                          </button>
                                        ) : null}
                                      </div>
                                    </label>
                                    </div>
                                  );
                                }) : (
                                  <div className="bq-empty-inline">No stored stock available for this material.</div>
                                )}

                                <div className="bq-reserve-actions">
                                  <button type="button" className="bq-btn bq-btn--confirm" onClick={saveReserve}>Save Reserve</button>
                                  <button type="button" className="bq-btn" onClick={cancelReserve}>Cancel</button>
                                  <button type="button" className="bq-btn bq-btn--danger" onClick={clearReserve}>Clear Reserve</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
              </section>
            ) : null}
            </div>{/* bq-item-body */}
          </article>
        );
      })}
    </div>
  );
}
