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
  isInventoryEntryEligibleForRequirement,
} from '../../lib/logistics/selectors';
import { FALLBACK_QUALITY_BANDS, findNearestBandForQuality, getBandEffectiveQuality, rarityClassFromBandIndex, rarityFromBandIndex, type QualityBand } from '../industry/crafting/utils/qualityBands';
import { formatModifierAtQuality, formatProperty, getModifiersAtQuality } from '../industry/crafting/utils/qualityModifiers';
import { apiUrl } from '../../lib/apiUrl';
import { getModifierImpact } from '../../lib/gameplay/propertyUtils';
import { parseJsonResponse } from '../../lib/safeJson';

import QuantityText from './QuantityText';
import MaterialIcon from './MaterialIcon';

// ─── Helpers ────────────────────────────────────────────────────────────────





function getModifierTrendClass(property: string | undefined, value: number | undefined): 'is-better' | 'is-worse' | 'is-neutral' {
  if (value === undefined || !Number.isFinite(value) || value === 0) return 'is-neutral';

  const impact = property ? getModifierImpact(property, value) : 'neutral';
  if (impact === 'good') return 'is-better';
  if (impact === 'bad') return 'is-worse';
  return 'is-neutral';
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
  const materialKey = input.materialKey ?? input.materialId;
  return input.requirementId ?? `${item.id}:${inputIndex}:${materialKey}:${input.modifierName ?? input.modifierType ?? 'material'}`;
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
  for (const input of inputs) {
    const materialKey = input.materialKey ?? input.materialId;
    const coverage = getMaterialReservationCoverage(item, materialKey, input.quantity * item.quantity, inventory);
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

function getItemQualitySummary(item: BuildQueueItem, inputs: RecipeInputTemplate[], draftBandIndices: Record<string, number>, isEditing: boolean) {
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

  const bands = inputs.map((input, inputIndex) => {
    const requirementId = getRequirementId(item, input, inputIndex);
    const qualityBands = input.qualityBands?.length ? input.qualityBands : FALLBACK_QUALITY_BANDS;
    const bandIndex = isEditing
      ? (draftBandIndices[requirementId] ?? getSavedBandIndex(input, qualityBands) ?? findNearestBandForQuality(qualityBands, input.selectedQuality ?? 500))
      : (getSavedBandIndex(input, qualityBands) ?? findNearestBandForQuality(qualityBands, input.selectedQuality ?? 500));
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
  onClearStaleAllocations: (buildQueueItemId: string) => void;
}

// ─── Quality Slider ──────────────────────────────────────────────────────────

function MaterialQualitySlider({
  input, draftBandIndex, onBandChange, quantizedBands,
}: {
  input: RecipeInputTemplate;
  draftBandIndex: number;
  onBandChange: (bandIndex: number) => void;
  quantizedBands: QualityBand[] | null;
}) {
  // Prefer quantized bands from API; fall back to stored recipe bands; never use FALLBACK_QUALITY_BANDS arbitrary values
  const qualityBands: QualityBand[] | null = quantizedBands ?? (input.qualityBands?.length ? input.qualityBands : null);

  const safeBandIndex = qualityBands ? Math.max(0, Math.min(draftBandIndex, qualityBands.length - 1)) : 0;
  const selectedQualityTierClass = rarityClassFromBandIndex(safeBandIndex + 1);
  const quality = qualityBands ? getBandEffectiveQuality(qualityBands, safeBandIndex) : null;

  const railMarkers = useMemo(() => {
    if (!qualityBands) return [];
    return qualityBands.map((band, i) => {
      const val = Number(band.mappedValue ?? 0);
      const left = Math.max(0, Math.min(100, (val / 1000) * 100));
      return { index: i, mappedValue: val, left, edge: left < 4 ? 'start' : left > 96 ? 'end' : 'middle' };
    });
  }, [qualityBands]);

  const bandOnePct = Math.max(0, Math.min(100, railMarkers[0]?.left ?? 0));
  const selectedPct = quality !== null ? Math.max(0, Math.min(100, (quality / 1000) * 100)) : 0;
  const fillPct = Math.max(0, selectedPct - bandOnePct);

  if (!qualityBands || quality === null) {
    if (import.meta.env.DEV) console.warn(`[quality] no quantization data for "${input.displayName ?? input.materialName ?? input.materialId}"`);
    return (
      <div className="bq-quality-panel">
        <div className="bq-quality-panel-head">
          <span className="bq-quality-panel-name">{input.displayName ?? input.materialName ?? input.materialId}</span>
          <span className="bq-quality-panel-val">Quality data unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bq-quality-panel">
      <div className="bq-quality-panel-head">
        <span className="bq-quality-panel-name">{input.displayName ?? input.materialName ?? input.materialId}</span>
        <span className={`bq-quality-panel-val ${selectedQualityTierClass}`}>Band {safeBandIndex + 1} / {quality}</span>
      </div>
      <div className="bq-quality-rail-wrap">
        <input
          type="range"
          min={0} max={1000} step={1}
          value={quality}
          onChange={(e) => onBandChange(findNearestBandForQuality(qualityBands, Number(e.target.value)))}
          className="bq-quality-range"
          aria-label={`Quality band for ${input.displayName ?? input.materialName}`}
        />
        <div className={`bq-quality-rail ${selectedQualityTierClass}`} style={{ '--band-one-pct': `${bandOnePct}%` } as React.CSSProperties}>
          <div
            className={`bq-quality-rail-fill ${selectedQualityTierClass}`}
            style={{ '--band-one-pct': `${bandOnePct}%`, '--fill-pct': `${fillPct}%` } as React.CSSProperties}
          />
          {railMarkers.map((marker) => {
            const markerTierClass = rarityClassFromBandIndex(marker.index + 1);
            return (
              <button
                type="button"
                key={`${marker.index}-${marker.mappedValue}`}
                className={`bq-quality-marker ${markerTierClass}${marker.index === safeBandIndex ? ' is-active' : ''}`}
                style={{ left: `${marker.left}%` }}
                data-edge={marker.edge}
                onClick={() => onBandChange(marker.index)}
                aria-label={`Quality ${marker.mappedValue}`}
              >
                <span className="bq-quality-marker-line" />
          
              </button>
            );
          })}
        </div>
      </div>
     
    </div>
  );
}

// ─── Group ───────────────────────────────────────────────────────────────────

export default function BuildQueueGroup({
  category, items, recipes, recipeInputsByRecipeId, buildQueue, inventory,
  materials, locations, strategy, onQuantityChange,
  onMaterialRequirementChange, onStatusChange, onRemove, onToggleAllocation, onClearStaleAllocations,
}: Props) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [draftBandIndices, setDraftBandIndices] = useState<Record<string, number>>({});
  const [expandedReserveRows, setExpandedReserveRows] = useState<Record<string, boolean>>({});
  const [expandedLowerQuality, setExpandedLowerQuality] = useState<Record<string, boolean>>({});
  const { getBandsForMaterial: getQuantizedBands } = useBQQuantization();

  function openEdit(item: BuildQueueItem, inputs: RecipeInputTemplate[]) {
    const initial: Record<string, number> = {};
    inputs.forEach((input, inputIndex) => {
      const requirementId = getRequirementId(item, input, inputIndex);
      const bands = getQuantizedBands(input.displayName ?? input.materialName ?? input.materialId) ?? (input.qualityBands?.length ? input.qualityBands : null);
      if (!bands) { initial[requirementId] = 0; return; }
      initial[requirementId] = getSavedBandIndex(input, bands) ?? findNearestBandForQuality(bands, input.selectedQuality ?? 500);
    });
    setDraftBandIndices(initial);
    setEditingItemId(item.id);
  }

  function commitEdit(item: BuildQueueItem, inputs: RecipeInputTemplate[]) {
    inputs.forEach((input, inputIndex) => {
      const requirementId = getRequirementId(item, input, inputIndex);
      const bands = getQuantizedBands(input.displayName ?? input.materialName ?? input.materialId) ?? (input.qualityBands?.length ? input.qualityBands : null);
      if (!bands) return;
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
    <div className="bq-category">
      {items.map((item) => {
        const recipe = getRecipeForQueueItem(item.recipeId, recipes);
        const itemName = item.itemName ?? recipe?.name ?? item.recipeId;
        const inputs = getBuildQueueItemInputs(item, recipeInputsByRecipeId);
        const isEditingThisItem = editingItemId === item.id;
        const isCompletedCraft = item.status === 'complete';
        const blueprintSources = item.blueprintSources ?? [];
        const fulfillment = getItemFulfillmentState(item, inputs, inventory);
        const qualitySummary = getItemQualitySummary(item, inputs, draftBandIndices, isEditingThisItem);

        const summaryMetrics = inputs.reduce<BuildQueueSummaryMetrics>((metrics, input) => {
          const materialKey = input.materialKey ?? input.materialId;
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
          return {
            coveredCount: metrics.coveredCount + (isCovered ? 1 : 0),
            totalShortfall: metrics.totalShortfall + needSummary.stillNeeded,
          };
        }, { coveredCount: 0, totalShortfall: 0 });

        const coveragePercent = inputs.length > 0 ? Math.round((summaryMetrics.coveredCount / inputs.length) * 100) : 0;

        const materialRequirementRows = inputs.map((input, inputIndex) => {
          const materialKey = input.materialKey ?? input.materialId;
          const requirementId = getRequirementId(item, input, inputIndex);
          const groupKey = `${item.id}:${materialKey}:${input.selectedQuality ?? 'any'}:${input.unitType ?? 'unit'}`;
          const requirementCardKey = `${groupKey}:${requirementId}:${inputIndex}`;
          const material = materials.find((e) => e.id === materialKey);
          const displayName = input.displayName ?? input.materialName ?? material?.name ?? `Unresolved: ${input.rawName ?? materialKey}`;
          const required = input.quantity * item.quantity;
          const qualityBands = getQuantizedBands(displayName) ?? (input.qualityBands?.length ? input.qualityBands : null);
          const savedBandIndex = qualityBands
            ? (getSavedBandIndex(input, qualityBands) ?? findNearestBandForQuality(qualityBands, input.selectedQuality ?? 500))
            : 0;
          const draftBandIndex = isEditingThisItem ? (draftBandIndices[requirementId] ?? savedBandIndex) : savedBandIndex;
          const selectedQuality = qualityBands ? getBandEffectiveQuality(qualityBands, draftBandIndex) : (input.selectedQuality ?? 0);
          const requirementSelectedQuality = input.selectedQuality;
          const selectedQualityRarity = rarityFromBandIndex(draftBandIndex + 1);
          const modifierAtQuality = getModifiersAtQuality(input.qualityModifiers ?? [], selectedQuality)[0];
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
          const allMaterialStacks = sortStacks(
            getInventoryStacks(inventory.filter((e) => e.materialId === materialKey && e.quantity > 0), materials, locations),
            strategy,
          );
          const eligibleStacks = allMaterialStacks.filter((stack) =>
            isInventoryEntryEligibleForRequirement(stack, materialKey, requirementSelectedQuality) &&
            (getAvailableQuantityForInventoryEntry(stack, buildQueue, item.id) > 0 || ownReservedByStack.has(stack.id)),
          );
          const ineligibleStacks = allMaterialStacks.filter((stack) => !isInventoryEntryEligibleForRequirement(stack, materialKey, requirementSelectedQuality));

          return {
            input, materialKey, requirementId, groupKey, requirementCardKey, material, displayName,
            required, selectedQuality, requirementSelectedQuality, selectedQualityRarity, modifierPreview, modifierLabel, modifierValue, modifierDisplayLabel, modifierDisplayValue, modifierTone,
            allowLowerQuality, coverage, needSummary, ownReservedByStack,
            remainingRequired: Math.max(0, required - coverage.reservedQuantity),
            allMaterialStacks, eligibleStacks, ineligibleStacks,
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
            rowTone: getGroupedCoverageState(group.requirements.map((r) => r.coverage.coverageState)),
            requiredTotal: group.requirements.reduce((s, r) => s + r.required, 0),
            reservedTotal: group.requirements.reduce((s, r) => s + r.coverage.reservedQuantity, 0),
            ownedQuantity: Math.max(0, ...group.requirements.map((r) => r.needSummary.ownedQuantity)),
            availableQuantity: Math.max(0, ...group.requirements.map((r) => r.needSummary.availableQuantity)),
            needTotal: group.requirements.reduce((s, r) => s + r.needSummary.stillNeeded, 0),
            hasStock: group.requirements.some((r) => r.allMaterialStacks.length > 0),
          };
        });

        return (
          <article key={item.id} className={`bq-item bq-item--${isCompletedCraft ? 'completed-craft' : fulfillment}`}>

            {/* ── Left sidebar: name + controls ── */}
            <div className="bq-item-sidebar">
              <div className="bq-item-name-block">
                <div className="bq-item-name-top">
                  <span className="bq-item-cat">{CATEGORY_LABELS[category] ?? category}</span>
                  <span className="bq-item-blueprint">
                    {blueprintSources.length === 0
                      ? 'Unknown blueprint'
                      : blueprintSources.map((s) => s.displayName).join(', ')}
                  </span>
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
              </div>

              <div className="bq-item-controls">
                <div className="bq-qty">
                  <button type="button" className="bq-qty-btn" onClick={() => onQuantityChange(item.id, item.quantity - 1)} disabled={item.quantity <= 1} aria-label="Decrease quantity">−</button>
                  <span className="bq-qty-val">{item.quantity}×</span>
                  <button type="button" className="bq-qty-btn" onClick={() => onQuantityChange(item.id, item.quantity + 1)} aria-label="Increase quantity">+</button>
                </div>
          
                <div className="bq-btn-row">
                  {inputs.length > 0 && (
                    isEditingThisItem ? (
                      <>
                        <button type="button" className="bq-btn" onClick={() => setEditingItemId(null)}>Cancel</button>
                        <button type="button" className="bq-btn bq-btn--confirm" onClick={() => commitEdit(item, inputs)}>Done</button>
                      </>
                    ) : (
                      <button type="button" className="bq-btn" onClick={() => openEdit(item, inputs)}>Quality</button>
                    )
                  )}
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

              {/* Quality edit grid */}
              {isEditingThisItem && inputs.length > 0 && (
                <div className="bq-quality-grid" aria-label={`Quality adjustment for ${itemName}`}>
                  {inputs.map((input, inputIndex) => {
                    const requirementId = getRequirementId(item, input, inputIndex);
                    const quantizedBands = getQuantizedBands(input.displayName ?? input.materialName ?? input.materialId);
                    const effectiveBands = quantizedBands ?? (input.qualityBands?.length ? input.qualityBands : null);
                    const savedBandIndex = effectiveBands
                      ? (getSavedBandIndex(input, effectiveBands) ?? findNearestBandForQuality(effectiveBands, input.selectedQuality ?? 500))
                      : 0;
                    const draftBandIndex = draftBandIndices[requirementId] ?? savedBandIndex;
                    return (
                      <MaterialQualitySlider
                        key={`quality:${item.id}:${requirementId}:${inputIndex}`}
                        input={input}
                        draftBandIndex={draftBandIndex}
                        quantizedBands={quantizedBands}
                        onBandChange={(bandIndex) => setDraftBandIndices((prev) => ({ ...prev, [requirementId]: bandIndex }))}
                      />
                    );
                  })}
                </div>
              )}

              {/* Material table */}
              {recipe ? (
              <div className="bq-mat-table">
                <div className="bq-mat-head" aria-hidden="true">
                  <span>Material</span>
                  <span>Status</span>
                  <span>Quality</span>
                  <span>Modifier</span>
                  <span>Available</span>
                  <span>Need</span>
                  <span>Reserve</span>
                </div>

                {materialGroups.map((group) => {
                  const reserveExpanded = expandedReserveRows[group.groupKey] ?? false;
                  return (
                    <section key={group.groupKey} className={`bq-mat-group${group.needTotal > 0 ? ' bq-mat-group--missing' : ''}`}>
                      <div className="bq-mat-row">
                        <div className="bq-mat-name">
                          <span className="bq-material-name-cell">
                            <MaterialIcon materialName={group.displayName} materialState={isRefinableMaterial(group.material) ? 'refined' : 'raw'} />
                            <strong>{group.displayName}</strong>
                          </span>
                          {group.requirements.length > 1 && <span>{group.requirements.length} requirements</span>}
                        </div>
                        <span className={`bq-mat-status bq-mat-status--${group.rowTone}`}>{getCoverageLabel(group.rowTone)}</span>
                        <span className={`bq-badge bq-badge--quality logi-rarity--${group.selectedQualityRarity}`}>{group.selectedQuality}</span>
                        <div className="bq-mat-modifier">
                          {group.requirements.map((req) => (
                            <span
                              className="bq-mat-modifier-entry"
                              key={`${req.requirementCardKey}:mod`}
                            >
                              <span className="bq-mat-modifier-label">{req.modifierDisplayLabel}</span>
                              {req.modifierDisplayValue && (
                                <span className={`bq-mat-modifier-value ${req.modifierTone}`}>
                                  {req.modifierDisplayValue}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                        <span className={`bq-qty-cell ${materialTypeClass(group.material)}`}>{formatQuantity(group.availableQuantity, group.material)}</span>
                        <span className={`bq-qty-cell${group.needTotal > 0 ? ' bq-qty-cell--short' : ''} ${materialTypeClass(group.material)}`}>{formatQuantity(group.needTotal, group.material)}</span>
                        <button
                          type="button"
                          className="bq-reserve-btn"
                          aria-expanded={reserveExpanded}
                          disabled={!group.hasStock && !reserveExpanded}
                          onClick={() => setExpandedReserveRows((prev) => ({ ...prev, [group.groupKey]: !reserveExpanded }))}
                        >
                          {reserveExpanded ? 'Hide' : group.hasStock ? 'Reserve' : 'No stock'}
                        </button>
                      </div>

                      {group.requirements.flatMap((req) => req.staleAllocations).map(({ allocation, staleReason }) => (
                        <div key={allocation.id} className="bq-stale-line">
                          <span>Stale: {allocation.materialName ?? allocation.materialId} ({STALE_REASON_LABELS[staleReason ?? ''] ?? 'invalid'})</span>
                          <button type="button" className="bq-btn" onClick={() => onClearStaleAllocations(item.id)}>Remove stale</button>
                        </div>
                      ))}

                      {reserveExpanded && (
                        <div className="bq-reserve-panel">
                          <div className="bq-reserve-panel-label">Reserve from inventory</div>
                          {group.requirements.map((req) => {
                            const lowerQualityExpanded = expandedLowerQuality[req.requirementCardKey] ?? false;
                            return (
                              <div key={`${req.requirementCardKey}:reserve`} className="bq-reserve-req">
                                {group.requirements.length > 1 && (
                                  <div className="bq-reserve-req-head">                       
                                  </div>
                                )}

                                {req.eligibleStacks.length > 0 ? req.eligibleStacks.map((stack) => {
                                  const allocationId = getAllocationId(item.id, req.requirementId, req.materialKey, req.requirementSelectedQuality, req.input.unitType, stack);
                                  const reservedQuantity = req.ownReservedByStack.get(stack.id) ?? 0;
                                  const reservedByThisItemOtherSlots = (item.reservedAllocations ?? [])
                                    .filter((a) => a.inventoryEntryId === stack.id && a.id !== allocationId)
                                    .reduce((s, a) => s + a.quantityReserved, 0);
                                  const availableQuantity = getAvailableQuantityForInventoryEntry(stack, buildQueue, item.id);
                                  const availableAfterThisReservation = Math.max(0, availableQuantity - reservedByThisItemOtherSlots - reservedQuantity);
                                  const checked = reservedQuantity > 0;
                                  const nextQuantity = Math.min(req.remainingRequired, availableAfterThisReservation);
                                  const disabled = !checked && nextQuantity <= 0;
                                  return (
                                    <label key={stack.id} className="bq-stack-line">
                                      <input
                                        type="checkbox"
                                        className="bq-stack-cb"
                                        checked={checked}
                                        disabled={disabled}
                                        onChange={() => {
                                          const quantityReserved = checked ? reservedQuantity : nextQuantity;
                                          if (quantityReserved <= 0) return;
                                          onToggleAllocation(item.id, createAllocation(item.id, req.requirementId, req.requirementSelectedQuality, req.input.unitType, stack, req.material?.name, quantityReserved));
                                        }}
                                      />
                                      <span>{stack.location?.name ?? stack.locationId}</span>
                                      <span>{stack.container ?? '—'}</span>
                                      <span className={rarityClass(stack.rarity)}>{stack.quality}</span>
  <span className={materialTypeClass(req.material)}>{formatQuantity(availableAfterThisReservation, req.material)} avail</span>
                                      <span className={materialTypeClass(req.material)}><QuantityText value={formatQuantity(reservedQuantity, req.material)} /> / <QuantityText value={formatQuantity(stack.quantity, req.material)} /></span>
                                    
                                    </label>
                                  );
                                }) : (
                                  <div className="bq-empty-inline">No eligible stored stack available.</div>
                                )}

                                {req.ineligibleStacks.length > 0 && (
                                  <div className="bq-lower-quality">
                                    <button
                                      type="button"
                                      className="bq-lower-toggle"
                                      aria-expanded={lowerQualityExpanded}
                                      onClick={() => setExpandedLowerQuality((prev) => ({ ...prev, [req.requirementCardKey]: !lowerQualityExpanded }))}
                                    >
                                      <span>{lowerQualityExpanded ? '▾' : '▸'}</span>
                                      <b>Lower quality / ineligible</b>
                                      <em>{req.ineligibleStacks.length} {req.ineligibleStacks.length === 1 ? 'stack' : 'stacks'}</em>
                                    </button>

                                    {lowerQualityExpanded && req.ineligibleStacks.map((stack) => {
                                      const allocationId = getAllocationId(item.id, req.requirementId, req.materialKey, req.requirementSelectedQuality, req.input.unitType, stack);
                                      const reservedQuantity = req.ownReservedByStack.get(stack.id) ?? 0;
                                      const reservedByThisItemOtherSlots = (item.reservedAllocations ?? [])
                                        .filter((a) => a.inventoryEntryId === stack.id && a.id !== allocationId)
                                        .reduce((s, a) => s + a.quantityReserved, 0);
                                      const availableQuantity = getAvailableQuantityForInventoryEntry(stack, buildQueue, item.id);
                                      const availableAfterThisReservation = Math.max(0, availableQuantity - reservedByThisItemOtherSlots - reservedQuantity);
                                      const checked = reservedQuantity > 0;
                                      const nextQuantity = Math.min(req.remainingRequired, availableAfterThisReservation);
                                      const disabled = !req.allowLowerQuality || (!checked && nextQuantity <= 0);
                                      return (
                                        <label key={`ineligible:${stack.id}`} className={`bq-stack-line bq-stack-line--lower${disabled ? ' is-disabled' : ''}${checked ? ' is-selected' : ''}`}>
                                          <input
                                            type="checkbox"
                                            className="bq-stack-cb"
                                            checked={checked}
                                            disabled={disabled}
                                            onChange={() => {
                                              const quantityReserved = checked ? reservedQuantity : nextQuantity;
                                              if (quantityReserved <= 0) return;
                                              onToggleAllocation(item.id, createAllocation(item.id, req.requirementId, req.requirementSelectedQuality, req.input.unitType, stack, req.material?.name, quantityReserved, true));
                                            }}
                                          />
                                          <span>{stack.location?.name ?? stack.locationId}</span>
                                          <span>{stack.container ?? '—'}</span>
                                          <span className={rarityClass(stack.rarity)}>{stack.quality}</span>
                                          <span style={{ color: stack.rarity.colorToken }}>{stack.rarity.label}</span>
                                          <span className={materialTypeClass(req.material)}><QuantityText value={formatQuantity(reservedQuantity, req.material)} /> / <QuantityText value={formatQuantity(stack.quantity, req.material)} /></span>
                                          <span className={materialTypeClass(req.material)}>{formatQuantity(availableAfterThisReservation, req.material)} avail</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="bq-empty-inline">No recipe mapped for source selection.</div>
            )}
            </div>{/* bq-item-body */}
          </article>
        );
      })}
    </div>
  );
}
