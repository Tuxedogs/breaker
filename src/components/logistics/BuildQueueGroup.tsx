import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { BuildQueueItem, InventoryEntry, InventoryLocation, MaterialTemplate, RecipeTemplate, ReservedMaterialAllocation } from '../../types/logistics';
import type { RecipeInputTemplate } from '../../data/logistics/seed';
import {
  formatInventoryLocationLabel,
  formatInventoryLocationMetaLabel,
  formatQuantity,
  formatInventoryQuantity,
  getBuildQueueItemInputs,
  getInventoryStacks,
  getRecipeForQueueItem,
  materialTypeClass,
  qualityBadgeClass,
  resolveInventoryItemName,
  resolveInventoryUnitType,
  type InventoryStack,
  type SourceStrategy,
} from '../../lib/logistics/inventory';
import {
  allocationMatchesRequirement,
  getBuildQueueMaterialNeedSummary,
  getMaterialReservationCoverage,
} from '../../lib/logistics/selectors';
import {
  getAllocationTotal,
  getHighestAvailableInventoryQuality,
  getLotAvailableAmountAfterReservations,
  getQualityAllocationBreakdown,
  getRemainingRequiredAmount,
  getRequirementLineKey,
  getWeightedEffectiveQuality,
  type QualityAllocationBreakdownEntry,
} from '../../lib/logistics/buildQueueReservations';
import { getBuildQueueItemAllocationSummary } from '../../lib/logistics/buildQueueProgress';
import { groupReservableStacksByLocation } from '../../lib/logistics/inventoryHierarchy';
import {
  solveBuildQueueCraftAllocation,
  type AllocationSolverLot,
  type AllocationSolverPlan,
  type CraftAllocationRequirementInput,
  type CraftAllocationSolverPlan,
} from '../../lib/logistics/buildQueueAllocationSolver';
import { FALLBACK_QUALITY_BANDS, findNearestBandForQuality, getBandEffectiveQuality, rarityClassFromBandIndex, rarityFromBandIndex, type QualityBand } from '../industry/crafting/utils/qualityBands';
import { getModifiersAtQuality } from '../industry/crafting/utils/qualityModifiers';
import { apiUrl } from '../../lib/apiUrl';
import { loadBlueprintSourceMissions } from '../../lib/craftingBlueprintSourcesApi';
import { parseJsonResponse } from '../../lib/safeJson';

import MaterialIcon from './MaterialIcon';
import { BuildQueueProductIcon } from './BuildQueueProductIcon';
import {
  BuildQueueCraftHeaderSummary,
  BuildQueueCraftIdentity,
  BuildQueueCraftOutcome,
  BuildQueueCraftStatistics,
  BuildQueueCraftTargetQuality,
  BuildQueueStatsProvider,
} from './BuildQueueStatsBreakdown';
import InventoryAddModal, { type InventoryQuickAddTarget } from './InventoryAddModal';
import type { FittingIconMode } from '../../lib/fitting/fittingIconMode';
import { getCompletedPresentationItem } from '../../lib/logistics/buildQueueEntries';
import { createMaterialResolver } from '../../lib/logistics/materialResolver';
import { formatMaterialDisplayName } from '../../lib/crafting/materialDisplayName';
import TargetQualitySlider from '../shared/TargetQualitySlider';

// ─── Helpers ────────────────────────────────────────────────────────────────

type BuildQueueActiveDrawer = {
  type: 'reserve';
  requirementKey: string;
};

type BlueprintMissionLink = {
  href: string;
  id: string;
  label: string;
};

function readMissionString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function normalizeBlueprintMissionLink(value: unknown): BlueprintMissionLink | null {
  if (typeof value !== 'object' || value === null) return null;
  const mission = value as Record<string, unknown>;
  const conceptKey = readMissionString(mission, 'conceptKey');
  const missionId = readMissionString(mission, 'missionId', 'contractId');
  const label = readMissionString(mission, 'contractTitle', 'title', 'contractDebugName', 'debugName');
  const routeKey = conceptKey ?? missionId;
  if (!routeKey || !label) return null;
  const params = new URLSearchParams(conceptKey ? { concept: conceptKey } : { search: routeKey });
  return {
    href: `/industry/missions?${params.toString()}`,
    id: `${conceptKey ? 'concept' : 'mission'}:${routeKey}`,
    label: label.replace(/~mission\(([^)]+)\)/g, '$1'),
  };
}

function BlueprintSourceDisplay({ blueprintId, fallbackLabel }: { blueprintId?: string; fallbackLabel: string }) {
  const [missionLinks, setMissionLinks] = useState<BlueprintMissionLink[] | null>(null);

  useEffect(() => {
    const normalizedBlueprintId = blueprintId?.trim();
    if (!normalizedBlueprintId) {
      queueMicrotask(() => setMissionLinks([]));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setMissionLinks(null);
    });
    loadBlueprintSourceMissions(normalizedBlueprintId)
      .then((missions) => {
        if (cancelled) return;
        const links = missions
          .map(normalizeBlueprintMissionLink)
          .filter((link): link is BlueprintMissionLink => Boolean(link))
          .filter((link, index, all) => all.findIndex((candidate) => candidate.href === link.href) === index);
        setMissionLinks(links);
      })
      .catch(() => {
        if (!cancelled) setMissionLinks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [blueprintId]);

  if (!missionLinks?.length) {
    return <span className="bq-item-blueprint" title={fallbackLabel}>{fallbackLabel}</span>;
  }

  return (
    <span className="bq-item-blueprint-links" title={missionLinks.map((mission) => mission.label).join(', ')}>
      {missionLinks.map((mission, index) => (
        <span key={mission.id} className="bq-item-blueprint-link-wrap">
          {index > 0 ? ", " : null}
          <Link className="bq-item-blueprint-link" to={mission.href}>{mission.label}</Link>
        </span>
      ))}
    </span>
  );
}

function useIsMobileTouchLayout() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isMobile;
}

// ─── Quantization ────────────────────────────────────────────────────────────

import { CRAFTING_REFERENCE_API_URLS } from '../../lib/craftingReferenceApi';

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
    const url = apiUrl(CRAFTING_REFERENCE_API_URLS.materialQualityQuantization);
    fetch(url)
      .then(async (r) => {
        const data = await parseJsonResponse<BQMaterialQuantization[]>(r, {
          label: 'build queue material quantization',
          url,
        });
        if (!r.ok) throw new Error(`${CRAFTING_REFERENCE_API_URLS.materialQualityQuantization} ${r.status}`);
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
        if (import.meta.env.DEV) console.warn('[quality] failed to load material quality quantization', err);
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
    return formatInventoryLocationLabel(a).localeCompare(formatInventoryLocationLabel(b)) || b.quantity - a.quantity;
  });
}

function getAllocationId(
  itemId: string, requirementId: string, materialId: string,
  selectedQuality: number | undefined, unitType: RecipeInputTemplate['unitType'] | undefined,
  stack: InventoryStack,
): string {
  return [itemId, requirementId, materialId, selectedQuality ?? 'any', unitType ?? 'unit', stack.id].join(':');
}

type RequirementReserveContext = {
  requirementId: string;
  materialKey: string;
  requirementSelectedQuality: number | undefined;
  input: RecipeInputTemplate;
  material: MaterialTemplate | undefined;
  required: number;
  ownAllocations: ReservedMaterialAllocation[];
  allocatedAmount: number;
};

type StackReservationAssignment = {
  item: BuildQueueItem;
  allocation: ReservedMaterialAllocation;
  itemName: string;
  requirementName?: string;
  isCurrentItem: boolean;
  isCurrentRequirement: boolean;
};

type PendingReassignment = {
  stack: InventoryStack;
  from: StackReservationAssignment;
  quantity: number;
  sourceOwnerLabel: string;
  destinationOwnerLabel: string;
  materialLabel: string;
  targetItemId: string;
  targetAllocation: ReservedMaterialAllocation;
  targetExistingAllocation?: ReservedMaterialAllocation;
};

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
    boxSize: stack.boxSize,
    locationId: stack.locationId,
    container: stack.container,
    unitType,
    allowLowerQualityOverride,
  };
}

function cleanLabel(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function getBuildQueueItemNumber(item: BuildQueueItem, buildQueue: BuildQueueItem[]): number | undefined {
  const index = buildQueue.findIndex((entry) => entry.id === item.id);
  return index >= 0 ? index + 1 : undefined;
}

function getBuildQueueItemLabel(
  item: BuildQueueItem,
  recipes: RecipeTemplate[],
  buildQueue?: BuildQueueItem[],
  fallback = 'another craft',
): string {
  const recipeName = recipes.find((recipe) => recipe.id === item.recipeId)?.name;
  const queueNumber = buildQueue ? getBuildQueueItemNumber(item, buildQueue) : undefined;
  return (
    cleanLabel(item.itemName) ??
    cleanLabel(recipeName) ??
    cleanLabel(item.itemId) ??
    cleanLabel(item.blueprint_id) ??
    (queueNumber ? `Queue item #${queueNumber}` : undefined) ??
    fallback
  );
}

function getSourceOwnerLabel(item: BuildQueueItem, recipes: RecipeTemplate[], buildQueue: BuildQueueItem[]): string {
  return getBuildQueueItemLabel(item, recipes, buildQueue, 'another craft');
}

function getDestinationOwnerLabel(item: BuildQueueItem, recipes: RecipeTemplate[], buildQueue: BuildQueueItem[]): string {
  const recipeName = recipes.find((recipe) => recipe.id === item.recipeId)?.name;
  const queueNumber = getBuildQueueItemNumber(item, buildQueue);
  return (
    cleanLabel(item.itemName) ??
    cleanLabel(recipeName) ??
    cleanLabel(item.itemId) ??
    cleanLabel(item.blueprint_id) ??
    (queueNumber ? `selected queue item #${queueNumber}` : undefined) ??
    'this craft'
  );
}

function getRequirementLabel(
  item: BuildQueueItem,
  allocation: ReservedMaterialAllocation,
  recipeInputsByRecipeId: Record<string, RecipeInputTemplate[]>,
): string | undefined {
  const inputs = item.materialRequirements?.length
    ? item.materialRequirements
    : recipeInputsByRecipeId[item.recipeId] ?? [];
  const input = inputs.find((entry, index) => {
    const requirementId = getRequirementLineKey(item, entry, index);
    return requirementId === allocation.requirementId;
  });
  return input?.displayName ?? input?.materialName ?? allocation.materialName;
}

function getAssignmentLabel(assignment: StackReservationAssignment | undefined): string {
  if (!assignment) return 'Reserved';
  if (assignment.isCurrentRequirement) return 'Assigned here';
  return assignment.itemName ?? 'another craft';
}

function getAssignmentTooltip(assignment: StackReservationAssignment | undefined): string | undefined {
  if (!assignment) return undefined;
  if (assignment.isCurrentRequirement) return 'Assigned here';
  return `Assigned to ${assignment.itemName ?? 'another craft'}`;
}

function getStackMaterialLabel(stack: InventoryStack): string {
  return resolveInventoryItemName(stack, stack.material);
}

function formatStackQuantity(quantity: number, stack: InventoryStack): string {
  return formatInventoryQuantity(quantity, resolveInventoryUnitType(stack, stack.material));
}

function getStackReservationAssignments(
  stack: InventoryStack,
  buildQueue: BuildQueueItem[],
  recipes: RecipeTemplate[],
  recipeInputsByRecipeId: Record<string, RecipeInputTemplate[]>,
  currentItemId: string,
  currentRequirementId: string,
): StackReservationAssignment[] {
  return buildQueue.flatMap((queueItem) =>
    queueItem.status === 'complete' ? [] : (queueItem.reservedAllocations ?? [])
      .filter((allocation) => allocation.inventoryEntryId === stack.id && allocation.quantityReserved > 0)
      .map((allocation) => {
        const itemName = getSourceOwnerLabel(queueItem, recipes, buildQueue);
        return {
          item: queueItem,
          allocation,
          itemName,
          requirementName: getRequirementLabel(queueItem, allocation, recipeInputsByRecipeId),
          isCurrentItem: queueItem.id === currentItemId,
          isCurrentRequirement: queueItem.id === currentItemId && allocation.requirementId === currentRequirementId,
        };
      }),
  );
}

function sortReservableStacks(
  stacks: InventoryStack[],
  buildQueue: BuildQueueItem[],
  item: BuildQueueItem,
  req: RequirementReserveContext,
  recipes: RecipeTemplate[],
  recipeInputsByRecipeId: Record<string, RecipeInputTemplate[]>,
): InventoryStack[] {
  const rankStack = (stack: InventoryStack) => {
    const ownReserved = req.ownAllocations.some((allocation) => allocation.inventoryEntryId === stack.id && allocation.quantityReserved > 0);
    const assignments = getStackReservationAssignments(stack, buildQueue, recipes, recipeInputsByRecipeId, item.id, req.requirementId);
    const reservedElsewhere = assignments.some((assignment) => !assignment.isCurrentRequirement);
    const available = getLotAvailableAmountAfterReservations(stack, buildQueue, item.id, req.ownAllocations);
    const usableAvailable = available > 0 && !ownReserved && !reservedElsewhere;
    let group = 5;
    if (usableAvailable) group = 0;
    else if (ownReserved) group = 3;
    else if (reservedElsewhere) group = 4;
    return { group, available };
  };
  return stacks.slice().sort((a, b) => {
    const aRank = rankStack(a);
    const bRank = rankStack(b);
    return (
      aRank.group - bRank.group ||
      (b.quality ?? 0) - (a.quality ?? 0) ||
      bRank.available - aRank.available ||
      formatInventoryLocationLabel(a).localeCompare(formatInventoryLocationLabel(b))
    );
  });
}

function getReserveStatusLabel(state: string, qualityState: string): string {
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

function formatAverageQuality(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? '—' : String(Math.round(value));
}

function formatTargetQuality(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? '—' : String(Math.round(value));
}

function getAverageQualityTone(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return 'empty';
  if (value >= 900) return 'purple';
  if (value >= 800) return 'blue';
  if (value >= 700) return 'cyan';
  return 'low';
}

function getTargetQualityTone(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return 'empty';
  if (value >= 900) return 'purple';
  if (value >= 800) return 'blue';
  if (value >= 700) return 'cyan';
  return 'low';
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

function clampTargetQuality(value: number): number {
  return Math.max(1, Math.min(1000, Math.round(value)));
}

const SCU_QUANTITY_EPSILON = 1e-6;

function isPartialLotAllocation(reservedQuantity: number, lotQuantity: number): boolean {
  return reservedQuantity > SCU_QUANTITY_EPSILON && lotQuantity - reservedQuantity > SCU_QUANTITY_EPSILON;
}

function buildSolverCandidateLots(
  stacks: InventoryStack[],
  buildQueue: BuildQueueItem[],
  item: BuildQueueItem,
  req: RequirementReserveContext,
  recipes: RecipeTemplate[],
  recipeInputsByRecipeId: Record<string, RecipeInputTemplate[]>,
): AllocationSolverLot[] {
  return stacks.flatMap((stack) => {
    if (!stack.materialId) return [];
    const assignments = getStackReservationAssignments(stack, buildQueue, recipes, recipeInputsByRecipeId, item.id, req.requirementId);
    const reservedElsewhere = assignments.some((assignment) => !assignment.isCurrentRequirement);
    if (reservedElsewhere) return [];
    const availableScu = getLotAvailableAmountAfterReservations(stack, buildQueue, item.id, req.ownAllocations);
    if (availableScu <= SCU_QUANTITY_EPSILON) return [];
    return [{
      lotId: stack.id,
      materialId: stack.materialId,
      quality: stack.quality,
      availableScu,
      locationId: stack.locationId,
      locationName: formatInventoryLocationLabel(stack),
    }];
  });
}

function applyCraftAllocationSolverPlan(
  item: BuildQueueItem,
  buildQueue: BuildQueueItem[],
  craftPlan: CraftAllocationSolverPlan,
  requirementContexts: Map<string, { req: RequirementReserveContext; stacksById: Map<string, InventoryStack> }>,
  onToggleAllocation: Props['onToggleAllocation'],
  onUpdateAllocationQuantity: Props['onUpdateAllocationQuantity'],
): void {
  for (const materialPlan of craftPlan.materials) {
    if (materialPlan.proposedLots.length === 0) continue;
    const context = requirementContexts.get(materialPlan.requirementId);
    if (!context) continue;
    applyAllocationSolverPlan(
      item,
      buildQueue,
      context.req,
      materialPlan,
      context.stacksById,
      onToggleAllocation,
      onUpdateAllocationQuantity,
    );
  }
}

function applyAllocationSolverPlan(
  item: BuildQueueItem,
  buildQueue: BuildQueueItem[],
  req: RequirementReserveContext,
  plan: AllocationSolverPlan,
  stacksById: Map<string, InventoryStack>,
  onToggleAllocation: Props['onToggleAllocation'],
  onUpdateAllocationQuantity: Props['onUpdateAllocationQuantity'],
): void {
  let runningAllocatedAmount = req.allocatedAmount;
  let runningAllocations = req.ownAllocations;

  for (const proposed of plan.proposedLots) {
    const stack = stacksById.get(proposed.lotId);
    if (!stack) continue;

    const existingAllocation = runningAllocations.find((allocation) => allocation.inventoryEntryId === proposed.lotId);
    const desiredQuantity = Math.round(((existingAllocation?.quantityReserved ?? 0) + proposed.proposedScu) * 100) / 100;
    const adjustedReq: RequirementReserveContext = {
      ...req,
      allocatedAmount: runningAllocatedAmount,
      ownAllocations: runningAllocations,
    };
    const previousQuantity = existingAllocation?.quantityReserved ?? 0;

    commitStackReservation(
      item,
      buildQueue,
      adjustedReq,
      stack,
      desiredQuantity,
      onToggleAllocation,
      onUpdateAllocationQuantity,
    );

    const appliedDelta = Math.max(0, desiredQuantity - previousQuantity);
    runningAllocatedAmount += appliedDelta;
    if (existingAllocation) {
      runningAllocations = runningAllocations.map((allocation) =>
        allocation.inventoryEntryId === proposed.lotId
          ? { ...allocation, quantityReserved: desiredQuantity }
          : allocation,
      );
    } else if (appliedDelta > 0) {
      const isBelowTarget = req.requirementSelectedQuality !== undefined && (stack.quality ?? 0) < req.requirementSelectedQuality;
      runningAllocations = [
        ...runningAllocations,
        createAllocation(
          item.id,
          req.requirementId,
          req.requirementSelectedQuality,
          req.input.unitType,
          stack,
          req.material?.name,
          desiredQuantity,
          isBelowTarget,
        ),
      ];
    }
  }
}

function commitStackReservation(
  item: BuildQueueItem,
  buildQueue: BuildQueueItem[],
  req: RequirementReserveContext,
  stack: InventoryStack,
  desiredQuantity: number,
  onToggleAllocation: Props['onToggleAllocation'],
  onUpdateAllocationQuantity: Props['onUpdateAllocationQuantity'],
): void {
  const existingAllocation = req.ownAllocations.find((allocation) => allocation.inventoryEntryId === stack.id);
  const reservedQuantity = existingAllocation?.quantityReserved ?? 0;
  const availableAfterThisReservation = getLotAvailableAmountAfterReservations(stack, buildQueue, item.id, req.ownAllocations);
  const maxLotQuantity = Math.max(0, reservedQuantity + availableAfterThisReservation);
  const otherAllocated = req.allocatedAmount - reservedQuantity;
  const remainingCapacity = Math.max(0, req.required - otherAllocated);
  const quantityReserved = Math.max(0, Math.min(desiredQuantity, maxLotQuantity, remainingCapacity));
  const isBelowTarget = req.requirementSelectedQuality !== undefined && (stack.quality ?? 0) < req.requirementSelectedQuality;

  if (quantityReserved <= 0) {
    if (existingAllocation) onToggleAllocation(item.id, existingAllocation);
    return;
  }
  if (existingAllocation) {
    if (existingAllocation.quantityReserved !== quantityReserved) {
      onUpdateAllocationQuantity(item.id, existingAllocation.id, quantityReserved);
    }
    return;
  }
  onToggleAllocation(
    item.id,
    createAllocation(
      item.id,
      req.requirementId,
      req.requirementSelectedQuality,
      req.input.unitType,
      stack,
      req.material?.name,
      quantityReserved,
      isBelowTarget,
    ),
  );
}

function getStackFillQuantity(
  req: RequirementReserveContext,
  stack: InventoryStack,
  buildQueue: BuildQueueItem[],
  itemId: string,
): number {
  const existingAllocation = req.ownAllocations.find((allocation) => allocation.inventoryEntryId === stack.id);
  const reservedQuantity = existingAllocation?.quantityReserved ?? 0;
  const availableAfterThisReservation = getLotAvailableAmountAfterReservations(stack, buildQueue, itemId, req.ownAllocations);
  const maxQuantity = Math.max(0, reservedQuantity + availableAfterThisReservation);
  return Math.min(maxQuantity, Math.max(0, req.required - (req.allocatedAmount - reservedQuantity)));
}

function QualityAllocationChips({
  breakdown,
  material,
  qualityBands,
}: {
  breakdown: QualityAllocationBreakdownEntry[];
  material: MaterialTemplate | undefined;
  qualityBands: QualityBand[] | null;
}) {
  if (breakdown.length === 0) return null;
  const totalQuantity = breakdown.reduce((sum, entry) => sum + entry.quantity, 0);
  return (
    <div className="bq-quality-chips">
      {breakdown.map(({ quality, quantity }) => {
        const bandIndex = qualityBands ? findNearestBandForQuality(qualityBands, quality) : 0;
        const percent = totalQuantity > 0 ? Math.round((quantity / totalQuantity) * 100) : 0;
        return (
          <span
            key={quality}
            className={`bq-quality-chip bq-badge bq-badge--quality ${rarityClassFromBandIndex(bandIndex + 1)}`}
            title={`Quality ${quality}`}
          >
            <strong>{quality}</strong>
            <span>
              <em>{formatQuantity(quantity, material)}</em>
              <em>{percent}%</em>
            </span>
          </span>
        );
      })}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg className="bq-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg className="bq-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 4 3 20h18L12 4Z" />
      <path d="M12 9v5M12 17h.01" />
    </svg>
  );
}

function SwapIcon() {
  return (
    <svg className="bq-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 7h11l-3-3" />
      <path d="M18 7l-3 3" />
      <path d="M17 17H6l3 3" />
      <path d="M6 17l3-3" />
    </svg>
  );
}

function LocationPinIcon() {
  return (
    <svg className="bq-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="10" r="3" />
      <path d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`bq-action-icon bq-action-icon--chevron${open ? ' is-open' : ''}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function BuildQueueReserveHierarchy({
  stacks,
  renderStack,
}: {
  stacks: InventoryStack[];
  renderStack: (stack: InventoryStack) => ReactNode;
}) {
  const locations = groupReservableStacksByLocation(stacks);
  return (
    <div className="bq-reserve-tree">
      {locations.map((location, locationIndex) => (
        <details key={location.key} className="bq-reserve-location-folder" open={locationIndex === 0}>
          <summary>
            <span className="bq-reserve-location-icon"><LocationPinIcon /></span>
            <span className="bq-reserve-location-text">
              <strong>{location.label}</strong>
              {location.locationMeta ? <em>{location.locationMeta}</em> : null}
            </span>
            <span>{location.qualities.length} {location.qualities.length === 1 ? 'quality' : 'qualities'}</span>
            <ChevronIcon open />
          </summary>
          <div className="bq-reserve-location-body">
            {location.qualities.map((quality) => {
              const first = quality.stacks[0];
              const unitType = resolveInventoryUnitType(first, first.material);
              const total = quality.stacks.reduce((sum, stack) => sum + stack.quantity, 0);
              const aggregateOnly = quality.stacks.every((stack) => stack.recordKind !== 'box');
              return (
                <details key={quality.key} className="bq-reserve-quality-folder">
                  <summary>
                    <span className={`bq-reserve-quality-value ${qualityBadgeClass(first)}`}>
                      {quality.quality == null ? 'Quality not recorded' : `Quality ${quality.quality}`}
                    </span>
                    <span>{formatInventoryQuantity(total, unitType)}</span>
                    <ChevronIcon open />
                  </summary>
                  <div className={`bq-reserve-quality-body${aggregateOnly ? ' is-aggregate-only' : ''}`}>
                    {quality.stacks.map((stack) => renderStack(stack))}
                  </div>
                </details>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}

function SolveIcon() {
  return (
    <svg className="bq-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3 9.5 8.5 4 11l5.5 2.5L12 19l2.5-5.5L20 11l-5.5-2.5L12 3Z" />
      <path d="M5 19h3M16 19h3" />
    </svg>
  );
}

function getMaterialPlanStatusLabel(status: CraftAllocationSolverPlan['materials'][number]['status']): string {
  switch (status) {
    case 'complete':
      return 'Complete';
    case 'ready':
      return 'Ready to reserve';
    case 'quantity-short':
      return 'Quantity short';
    case 'quality-short':
      return 'Target not met';
    case 'no-inventory':
      return 'No usable inventory';
    default:
      return status;
  }
}

function CraftAllocationSolverPreview({
  plan,
  itemName,
  materials,
  onApply,
  onCancel,
}: {
  plan: CraftAllocationSolverPlan;
  itemName: string;
  materials: MaterialTemplate[];
  onApply: () => void;
  onCancel: () => void;
}) {
  const actionableMaterials = plan.materials.filter((material) => material.proposedLots.length > 0);
  const getMaterial = (materialId: string) => materials.find((entry) => entry.id === materialId);
  const readyCount = plan.materials.filter((material) => material.status === 'ready' || material.status === 'quality-short').length;
  const completeCount = plan.materials.filter((material) => material.status === 'complete').length;
  const blockedCount = plan.materials.filter((material) => material.status === 'quantity-short' || material.status === 'no-inventory').length;
  const proposedTotal = plan.materials.reduce((sum, material) => sum + material.totalProposedScu, 0);
  const proposedBoxCount = plan.materials.reduce((sum, material) => sum + material.proposedLots.length, 0);

  return (
    <div className="bq-solve-modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="bq-solve-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bq-solve-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel();
        }}
      >
        <div className="bq-solve-modal-head">
          <div>
            <h3 id="bq-solve-modal-title">Auto Reserve Preview</h3>
            <p className="bq-solve-modal-subtitle">{itemName}</p>
          </div>
          <button type="button" className="bq-solve-close" aria-label="Close auto reserve preview" onClick={onCancel}>×</button>
        </div>

        <div className="bq-solve-summary" aria-label="Auto reserve summary">
          <span className="is-ready"><strong>{readyCount}</strong> Ready</span>
          <span className="is-complete"><strong>{completeCount}</strong> Complete</span>
          <span className="is-blocked"><strong>{blockedCount}</strong> Blocked</span>
          <span className="is-proposed"><strong>{formatDecimal(proposedTotal)} SCU</strong> Proposed</span>
        </div>

        {plan.warnings.length > 0 ? (
          <ul className="bq-solve-preview-warnings bq-solve-preview-warnings--modal">
            {plan.warnings.map((warning) => (
              <li key={warning}>
                <WarningIcon />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="bq-solve-modal-body">
          <div className="bq-solve-table-head" aria-hidden="true">
            <span>Material</span><span>Status</span><span>Allocated</span><span>Proposed</span><span>Required</span><span>Projected Avg</span><span>Target Quality</span>
          </div>
          {plan.materials.map((materialPlan) => {
            const material = getMaterial(materialPlan.materialId);
            const projectedQualityLabel = materialPlan.projectedAverageQuality !== undefined
              ? formatDecimal(materialPlan.projectedAverageQuality)
              : '—';

            return (
              <section
                key={materialPlan.requirementId}
                className={[
                  'bq-solve-material',
                  `bq-solve-material--${materialPlan.status}`,
                ].join(' ')}
              >
                <div className="bq-solve-material-head">
                  <div className="bq-solve-material-name">
                    <strong>{materialPlan.materialName}</strong>
                  </div>
                  <span className={`bq-solve-material-status bq-solve-material-status--${materialPlan.status}`}>
                      {getMaterialPlanStatusLabel(materialPlan.status)}
                  </span>
                  <strong>{formatQuantity(materialPlan.alreadyAllocatedScu, material)}</strong>
                  <strong>{formatQuantity(materialPlan.totalProposedScu, material)}</strong>
                  <strong>{formatQuantity(materialPlan.requiredScu, material)}</strong>
                  <strong>{projectedQualityLabel}</strong>
                  <strong>{materialPlan.targetQuality ?? 'Any'} · {materialPlan.meetsTargetQuality ? 'Met' : 'Not met'}</strong>
                </div>

                {materialPlan.warnings.length > 0 ? (
                  <ul className="bq-solve-preview-warnings">
                    {materialPlan.warnings.map((warning) => (
                      <li key={warning}>
                        <WarningIcon />
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {materialPlan.proposedLots.length > 0 ? (
                  <div className="bq-solve-preview-lots">
                    <div className="bq-solve-preview-lots-head" aria-hidden="true">
                      <span>Box</span>
                      <span>Location</span>
                      <span>Quality</span>
                      <span>Proposed</span>
                    </div>
                    {materialPlan.proposedLots.map((proposedLot) => (
                      <div key={proposedLot.lotId} className="bq-solve-preview-lot-row">
                        <span>{proposedLot.lotId}</span>
                        <span className="bq-solve-preview-location" title={proposedLot.locationName}>
                          {proposedLot.locationName}
                        </span>
                        <span className="bq-solve-preview-quality">{proposedLot.quality ?? '—'}</span>
                        <span className="bq-solve-preview-scu">{formatQuantity(proposedLot.proposedScu, material)}</span>
                      </div>
                    ))}
                  </div>
                ) : materialPlan.status === 'complete' ? (
                  <div className="bq-empty-inline">Already fully allocated.</div>
                ) : (
                  <div className="bq-empty-inline">No lots proposed for this material.</div>
                )}
              </section>
            );
          })}
        </div>

        <div className="bq-solve-modal-actions">
          <span className="bq-solve-footer-summary"><strong>{formatDecimal(proposedTotal)} SCU</strong> across <strong>{proposedBoxCount}</strong> individual {proposedBoxCount === 1 ? 'box' : 'boxes'} will be reserved</span>
          <button type="button" className="bq-btn" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className="bq-btn bq-btn--confirm"
            disabled={actionableMaterials.length === 0}
            onClick={onApply}
          >
            Reserve These
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Group ───────────────────────────────────────────────────────────────────

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

interface Props {
  category: string;
  itemTypeLabel?: string;
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
  onAllocationOwnerHighlightChange?: (itemId: string | null) => void;
  onQuickAddInventory: (entries: InventoryEntry[]) => void | Promise<void>;
  iconMode: FittingIconMode;
  inventoryEnabled: boolean;
  onInventoryEnabledChange: (enabled: boolean) => void;
}

// ─── Target Quality Popover ──────────────────────────────────────────────────

// ─── Group ───────────────────────────────────────────────────────────────────

export default function BuildQueueGroup({
  category, itemTypeLabel, items, recipes, recipeInputsByRecipeId, buildQueue, inventory,
  materials, locations, strategy, onQuantityChange,
  onMaterialRequirementChange, onStatusChange, onRemove, onToggleAllocation, onUpdateAllocationQuantity,   onClearStaleAllocations,
  onAllocationOwnerHighlightChange,
  onQuickAddInventory,
  iconMode,
  inventoryEnabled,
  onInventoryEnabledChange,
}: Props) {
  const [activeDrawersByItem, setActiveDrawersByItem] = useState<Record<string, BuildQueueActiveDrawer | undefined>>({});
  const [quickAddTarget, setQuickAddTarget] = useState<InventoryQuickAddTarget | null>(null);
  const [pendingReassignment, setPendingReassignment] = useState<PendingReassignment | null>(null);
  const [pendingCraftSolverPlan, setPendingCraftSolverPlan] = useState<{
    itemId: string;
    plan: CraftAllocationSolverPlan;
  } | null>(null);
  const [solverPlanning, setSolverPlanning] = useState(false);
  const [focusedAssignmentItemId, setFocusedAssignmentItemId] = useState<string | null>(null);
  const [reserveSearch, setReserveSearch] = useState('');
  const [reserveEligibleOnly, setReserveEligibleOnly] = useState(true);
  const [reserveMeetTargetOnly, setReserveMeetTargetOnly] = useState(false);
  const [reserveSort, setReserveSort] = useState<'quality-high' | 'quality-low' | 'location'>('quality-high');
  const isMobileTouchLayout = useIsMobileTouchLayout();
  const { getBandsForMaterial: getQuantizedBands } = useBQQuantization();
  const resolveMaterial = useMemo(() => createMaterialResolver(materials), [materials]);

  const setAllocationOwnerHighlight = useCallback((itemId: string | null) => {
    setFocusedAssignmentItemId(itemId);
    onAllocationOwnerHighlightChange?.(itemId);
  }, [onAllocationOwnerHighlightChange]);

  useEffect(() => () => {
    onAllocationOwnerHighlightChange?.(null);
  }, [onAllocationOwnerHighlightChange]);

  function toggleReserveDrawer(itemId: string, requirementKey: string, isOpen: boolean) {
    setActiveDrawersByItem((prev) => ({ ...prev, [itemId]: isOpen ? undefined : { type: 'reserve', requirementKey } }));
  }

  function openQuickAdd(materialId: string, displayName: string, material: MaterialTemplate | undefined) {
    setQuickAddTarget({ materialId, displayName, material });
  }

  function closeQuickAdd() {
    setQuickAddTarget(null);
  }

  async function handleQuickAddSave(entries: InventoryEntry[]) {
    await onQuickAddInventory(entries);
    closeQuickAdd();
  }

  function confirmPendingReassignment() {
    if (!pendingReassignment) return;
    const { from, quantity, targetAllocation, targetExistingAllocation } = pendingReassignment;
    const previousQuantity = Math.max(0, from.allocation.quantityReserved - quantity);
    onUpdateAllocationQuantity(from.item.id, from.allocation.id, previousQuantity);
    if (targetExistingAllocation) {
      onUpdateAllocationQuantity(
        pendingReassignment.targetItemId,
        targetExistingAllocation.id,
        targetExistingAllocation.quantityReserved + quantity,
      );
    } else {
      onToggleAllocation(pendingReassignment.targetItemId, targetAllocation);
    }
    setPendingReassignment(null);
    setAllocationOwnerHighlight(null);
  }

  function cancelPendingReassignment() {
    setPendingReassignment(null);
    setAllocationOwnerHighlight(null);
  }

  function updateTargetQuality(
    item: BuildQueueItem,
    input: RecipeInputTemplate,
    requirementId: string,
    qualityBands: QualityBand[],
    value: number,
  ) {
    const draftQuality = clampTargetQuality(value);
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
  }

  function commitTargetQuality(
    item: BuildQueueItem,
    value: number,
    ownAllocations: ReservedMaterialAllocation[],
    effectiveReservedQuality: number | undefined,
  ) {
    const draftQuality = clampTargetQuality(value);
    if (Number.isFinite(effectiveReservedQuality) && draftQuality > Number(effectiveReservedQuality)) {
      ownAllocations.forEach((allocation) => onToggleAllocation(item.id, allocation));
    }
  }

  return (
    <div className="bq-category">
      {quickAddTarget ? (
        <InventoryAddModal
          target={quickAddTarget}
          materials={materials}
          locations={locations}
          onSave={handleQuickAddSave}
          onCancel={closeQuickAdd}
        />
      ) : null}
      {pendingReassignment ? (
        <div className="bq-reassign-modal-backdrop" role="presentation" onMouseDown={cancelPendingReassignment}>
          <div
            className="bq-reassign-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bq-reassign-title"
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') cancelPendingReassignment();
            }}
          >
            <h3 id="bq-reassign-title">Reassign Allocation</h3>
            <div className="bq-reassign-transfer" aria-label={`${pendingReassignment.sourceOwnerLabel} to ${pendingReassignment.destinationOwnerLabel}`}>
              <span className="bq-reassign-owner bq-reassign-owner--source">{pendingReassignment.sourceOwnerLabel}</span>
              <span className="bq-reassign-swap" aria-hidden="true">
                <SwapIcon />
              </span>
              <span className="bq-reassign-owner bq-reassign-owner--destination">{pendingReassignment.destinationOwnerLabel}</span>
            </div>
            <p>
              Move {formatStackQuantity(pendingReassignment.quantity, pendingReassignment.stack)} {pendingReassignment.materialLabel} from {pendingReassignment.sourceOwnerLabel} to {pendingReassignment.destinationOwnerLabel}?
            </p>
            <div className="bq-reassign-actions">
              <button type="button" className="bq-btn" onClick={cancelPendingReassignment}>Cancel</button>
              <button type="button" className="bq-btn bq-btn--confirm" onClick={confirmPendingReassignment}>Reassign</button>
            </div>
          </div>
        </div>
      ) : null}
      {items.map((storedItem) => {
        const item = getCompletedPresentationItem(storedItem);
        const recipe = getRecipeForQueueItem(item.recipeId, recipes);
        const itemName = item.itemName ?? recipe?.name ?? item.recipeId;
        const inputs = getBuildQueueItemInputs(item, recipeInputsByRecipeId);
        const hasMaterialInputs = inputs.length > 0;
        const isCompletedCraft = item.status === 'complete';
        const blueprintSources = item.blueprintSources ?? [];
        const allocationSummary = getBuildQueueItemAllocationSummary(item, inputs, inventory);
        const fulfillment = allocationSummary.fulfillment;
        const readableType = itemTypeLabel ?? CATEGORY_LABELS[category] ?? category;

        const recipeDefaultInputs = recipeInputsByRecipeId[item.recipeId] ?? [];
        const materialRequirementRows = inputs.map((input, inputIndex) => {
          const materialKey = input.materialKey ?? input.materialId;
          const requirementId = getRequirementId(item, input, inputIndex);
          const groupKey = `${item.id}:${requirementId}`;
          const requirementCardKey = `${groupKey}:${requirementId}:${inputIndex}`;
          const material = resolveMaterial({
            materialKey,
            materialId: input.materialId,
            displayName: input.displayName,
            materialName: input.materialName,
          })?.material ?? materials.find((e) => e.id === materialKey);
          const displayName = material?.name ?? formatMaterialDisplayName(input.displayName ?? input.materialName ?? `Unresolved: ${input.rawName ?? materialKey}`);
          const required = input.quantity * item.quantity;
          const qualityBands = getQuantizedBands(displayName) ?? (input.qualityBands?.length ? input.qualityBands : null);
          const recipeDefaultInput =
            recipeDefaultInputs.find((entry) => entry.requirementId && entry.requirementId === input.requirementId) ??
            recipeDefaultInputs[inputIndex];
          const savedBandIndex = qualityBands
            ? (getSavedBandIndex(input, qualityBands) ?? findNearestBandForQuality(qualityBands, input.selectedQuality ?? 500))
            : 0;
          const recipeDefaultBandIndex = qualityBands && recipeDefaultInput
            ? (getSavedBandIndex(recipeDefaultInput, qualityBands) ?? findNearestBandForQuality(qualityBands, recipeDefaultInput.selectedQuality ?? 500))
            : 0;
          const selectedQuality = qualityBands
            ? clampQualityForBands(input.selectedQuality ?? getBandEffectiveQuality(qualityBands, savedBandIndex), qualityBands)
            : (input.selectedQuality ?? 0);
          const recipeTargetQuality = recipeDefaultInput?.selectedQuality !== undefined
            ? clampTargetQuality(recipeDefaultInput.selectedQuality)
            : recipeDefaultInput && qualityBands
              ? getBandEffectiveQuality(qualityBands, recipeDefaultBandIndex)
              : 500;
          const requirementSelectedQuality = input.selectedQuality;
          const selectedQualityRarity = rarityFromBandIndex(savedBandIndex + 1);
          const allowLowerQuality = Boolean(item.allowLowerQuality);
          const requirementIdentity = { requirementId, selectedQuality: requirementSelectedQuality, unitType: input.unitType };
          const effectiveRequirementIdentity = { ...requirementIdentity, allowLowerQuality };
          const liveCoverage = getMaterialReservationCoverage(item, materialKey, required, inventory, effectiveRequirementIdentity);
          const coverage = isCompletedCraft
            ? { ...liveCoverage, reservedQuantity: required, coverageState: 'covered' as const, validations: [] }
            : liveCoverage;
          const liveNeedSummary = getBuildQueueMaterialNeedSummary(item, materialKey, required, inventory, buildQueue, effectiveRequirementIdentity);
          const needSummary = isCompletedCraft
            ? { ...liveNeedSummary, reservedByThisQueueItem: required, stillNeeded: 0 }
            : liveNeedSummary;
          const ownAllocations = item.reservedAllocations?.filter((a) => allocationMatchesRequirement(a, materialKey, effectiveRequirementIdentity)) ?? [];
          const ownReservedByStack = new Map(ownAllocations.map((a) => [a.inventoryEntryId, a.quantityReserved]));
          const effectiveReservedQuality = getWeightedEffectiveQuality(ownAllocations);
          const allocatedAmount = getAllocationTotal(ownAllocations);
          const remainingRequired = getRemainingRequiredAmount(required, allocatedAmount);
          const reserveStatusLabel = getReserveStatusLabel(coverage.coverageState, 'meets');
          const allMaterialStacks = sortStacks(
            getInventoryStacks(inventory.filter((e) => e.materialId === materialKey && e.quantity > 0), materials, locations),
            strategy,
          );
          const reserveContext: RequirementReserveContext = {
            requirementId,
            materialKey,
            requirementSelectedQuality,
            input,
            material,
            required,
            ownAllocations,
            allocatedAmount,
          };
          const reservableStacks = sortReservableStacks(
            allMaterialStacks,
            buildQueue,
            item,
            reserveContext,
            recipes,
            recipeInputsByRecipeId,
          );

          return {
            input, materialKey, requirementId, groupKey, requirementCardKey, material, displayName, qualityBands,
            required, selectedQuality, requirementSelectedQuality, recipeTargetQuality, selectedQualityRarity,
            allowLowerQuality, coverage, needSummary, ownAllocations, ownReservedByStack,
            allocatedAmount, remainingRequired, effectiveReservedQuality, reserveStatusLabel,
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
          const groupAllocations = group.requirements.flatMap((row) => row.ownAllocations);
          const qualityBreakdown = getQualityAllocationBreakdown(groupAllocations);
          const inventoryEffectiveQuality = getWeightedEffectiveQuality(groupAllocations);
          return {
            ...group,
            displayName: first.displayName,
            material: first.material,
            selectedQuality: first.selectedQuality,
            targetQuality: first.requirementSelectedQuality,
            recipeTargetQuality: first.recipeTargetQuality,
            selectedQualityRarity: first.selectedQualityRarity,
            qualityBands: first.qualityBands,
            qualityBreakdown,
            averageQuality: inventoryEffectiveQuality,
            highestAvailableQuality: getHighestAvailableInventoryQuality(
              group.requirements.flatMap((row) => row.allMaterialStacks),
              buildQueue,
              item.id,
              groupAllocations,
            ),
            rowTone: isCompletedCraft ? 'covered' : getGroupedCoverageState(group.requirements.map((r) => r.coverage.coverageState)),
            reserveStatusLabel: first.reserveStatusLabel,
            requiredTotal: group.requirements.reduce((s, r) => s + r.required, 0),
            reservedTotal: group.requirements.reduce((s, r) => s + r.coverage.reservedQuantity, 0),
            allocatedTotal: group.requirements.reduce((s, r) => s + r.allocatedAmount, 0),
            ownedQuantity: Math.max(0, ...group.requirements.map((r) => r.needSummary.ownedQuantity)),
            availableQuantity: Math.max(0, ...group.requirements.map((r) => r.needSummary.availableQuantity)),
            needTotal: isCompletedCraft ? 0 : group.requirements.reduce((s, r) => s + r.needSummary.stillNeeded, 0),
            hasStock: group.requirements.some((r) => r.allMaterialStacks.length > 0),
          };
        });

        const normalizeSummaryUnit = (unit: RecipeInputTemplate['unitType'] | undefined) => (
          String(unit ?? 'unit').toLowerCase() === 'scu' || String(unit ?? '').toLowerCase() === 'cscu'
            ? 'scu' as const
            : 'unit' as const
        );
        const requirementUnits = new Set(materialRequirementRows.map((row) => normalizeSummaryUnit(row.input.unitType)));
        const summaryUnit = normalizeSummaryUnit(materialRequirementRows[0]?.input.unitType);
        const totalRequiredAmount = materialRequirementRows.reduce((sum, row) => sum + row.required, 0);
        const totalAllocatedAmount = materialRequirementRows.reduce((sum, row) => sum + Math.min(row.allocatedAmount, row.required), 0);
        const materialsAllocatedLabel = requirementUnits.size === 1
          ? `${formatInventoryQuantity(totalAllocatedAmount, summaryUnit)} / ${formatInventoryQuantity(totalRequiredAmount, summaryUnit)}`
          : `${materialRequirementRows.filter((row) => row.remainingRequired <= SCU_QUANTITY_EPSILON).length} / ${materialRequirementRows.length} requirements`;
        const allocationPercentage = allocationSummary.progressPercent ?? 0;
        const firstInventoryTarget = materialGroups.find((group) => group.needTotal > 0) ?? materialGroups[0];

        const craftSolverRequirementContexts = new Map(
          materialRequirementRows.map((row) => {
            const reserveContext: RequirementReserveContext = {
              requirementId: row.requirementId,
              materialKey: row.materialKey,
              requirementSelectedQuality: row.requirementSelectedQuality,
              input: row.input,
              material: row.material,
              required: row.required,
              ownAllocations: row.ownAllocations,
              allocatedAmount: row.allocatedAmount,
            };
            return [
              row.requirementId,
              {
                req: reserveContext,
                stacksById: new Map(row.allMaterialStacks.map((stack) => [stack.id, stack])),
              },
            ] as const;
          }),
        );

        const craftSolverRequirements: CraftAllocationRequirementInput[] = materialRequirementRows.map((row) => {
          const reserveContext = craftSolverRequirementContexts.get(row.requirementId)?.req;
          if (!reserveContext) {
            return {
              requirementId: row.requirementId,
              materialId: row.materialKey,
              materialName: row.displayName,
              requiredScu: row.required,
              targetQuality: row.requirementSelectedQuality,
              existingAllocations: row.ownAllocations.map((allocation) => ({
                lotId: allocation.inventoryEntryId,
                quality: allocation.quality,
                allocatedScu: allocation.quantityReserved,
              })),
              candidateLots: [],
            };
          }
          return {
            requirementId: row.requirementId,
            materialId: row.materialKey,
            materialName: row.displayName,
            requiredScu: row.required,
            targetQuality: row.requirementSelectedQuality,
            existingAllocations: row.ownAllocations.map((allocation) => ({
              lotId: allocation.inventoryEntryId,
              quality: allocation.quality,
              allocatedScu: allocation.quantityReserved,
            })),
            candidateLots: buildSolverCandidateLots(
              row.allMaterialStacks,
              buildQueue,
              item,
              reserveContext,
              recipes,
              recipeInputsByRecipeId,
            ),
          };
        });

        const allRequirementsComplete = materialRequirementRows.every(
          (row) => row.remainingRequired <= SCU_QUANTITY_EPSILON,
        );
        const autoReserveDisabled =
          !hasMaterialInputs ||
          isCompletedCraft ||
          allRequirementsComplete;

        const runCraftSolver = () => {
          setSolverPlanning(true);
          window.requestAnimationFrame(() => {
            const plan = solveBuildQueueCraftAllocation(craftSolverRequirements);
            setPendingCraftSolverPlan({ itemId: item.id, plan });
            setSolverPlanning(false);
          });
        };

        const applyCraftSolverPlan = () => {
          if (!pendingCraftSolverPlan || pendingCraftSolverPlan.itemId !== item.id) return;
          applyCraftAllocationSolverPlan(
            item,
            buildQueue,
            pendingCraftSolverPlan.plan,
            craftSolverRequirementContexts,
            onToggleAllocation,
            onUpdateAllocationQuantity,
          );
          setPendingCraftSolverPlan(null);
        };

        const blueprintLabel = blueprintSources.length === 0
          ? 'Unknown Blueprint Source'
          : blueprintSources.map((s) => s.displayName).join(', ');
        const toggleInventory = () => {
          onInventoryEnabledChange(!inventoryEnabled);
          setActiveDrawersByItem({});
        };
        return (
          <article
            key={item.id}
            className={[
              'bq-item',
              `bq-item--${isCompletedCraft ? 'completed-craft' : fulfillment}`,
              focusedAssignmentItemId === item.id ? 'bq-item--assignment-focus' : '',
              pendingReassignment?.targetItemId === item.id ? 'bq-item--reassign-destination' : '',
              isMobileTouchLayout ? 'bq-item--mobile-touch' : '',
              inventoryEnabled ? 'bq-item--inventory-on' : 'bq-item--inventory-off',
              'bq-item--target-workspace',
            ].filter(Boolean).join(' ')}
            data-bq-item-id={item.id}
          >

            <BuildQueueStatsProvider blueprintId={item.blueprint_id} item={item} inputs={inputs}>
            {/* ── Selected craft command card ── */}
            <section className="bq-item-sidebar bq-item-header bq-workspace-card bq-selected-craft-card" aria-label={`Selected craft: ${itemName}`}>
              <div className="bq-selected-craft-body">
                <div className="bq-item-visual">
                  <BuildQueueProductIcon
                    item={item}
                    recipe={recipe}
                    preferredMode={iconMode}
                    layout={isMobileTouchLayout ? 'mobile' : 'desktop'}
                    alt={itemName}
                  />
                </div>

                <div className="bq-item-identity">
                  <div className="bq-item-name-block">
                    <span className="bq-item-cat">{readableType}</span>
                    <h2 className="bq-item-name">{itemName}</h2>
                  </div>

                  <BuildQueueCraftIdentity />

                  <div className="bq-selected-craft-state-line">
                    <span className={`bq-selected-craft-state bq-selected-craft-state--${isCompletedCraft ? 'ready' : fulfillment}`}>
                      {isCompletedCraft ? 'Completed' : fulfillment === 'ready' ? 'Ready' : fulfillment === 'partial' ? 'Partially Allocated' : 'Materials Missing'}
                    </span>
                    <BuildQueueCraftTargetQuality />
                  </div>

                  <div className="bq-item-mission">
                    <span className="bq-item-mission-label">Blueprint Source</span>
                    <BlueprintSourceDisplay blueprintId={item.blueprint_id} fallbackLabel={blueprintLabel} />
                  </div>
                </div>

                <div className="bq-selected-craft-actions">
                  <button
                    type="button"
                    className="bq-btn bq-btn--header-action"
                    disabled={isCompletedCraft || !firstInventoryTarget}
                    onClick={() => firstInventoryTarget && openQuickAdd(
                      firstInventoryTarget.material?.id ?? firstInventoryTarget.requirements[0]?.materialKey ?? '',
                      firstInventoryTarget.displayName,
                      firstInventoryTarget.material,
                    )}
                  >
                    <PlusIcon />
                    <span>Inventory</span>
                  </button>
                  <button
                    type="button"
                    className="bq-btn bq-btn--header-action"
                    disabled={autoReserveDisabled || solverPlanning || !inventoryEnabled}
                    aria-label={`Auto reserve inventory for ${itemName}`}
                    onClick={runCraftSolver}
                  >
                    <SolveIcon />
                    <span>{solverPlanning ? 'Planning…' : 'Reserve Materials'}</span>
                  </button>
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

              <footer className="bq-selected-craft-footer">
                <BuildQueueCraftHeaderSummary materialsLabel={materialsAllocatedLabel} allocationPercentage={allocationPercentage} />
                <div className="bq-qty" aria-label="Craft quantity">
                  <button type="button" className="bq-qty-btn" onClick={() => onQuantityChange(item.id, item.quantity - 1)} disabled={isCompletedCraft || item.quantity <= 1} aria-label="Decrease quantity">-</button>
                  <span className="bq-qty-val">{item.quantity}x</span>
                  <button type="button" className="bq-qty-btn" onClick={() => onQuantityChange(item.id, item.quantity + 1)} disabled={isCompletedCraft} aria-label="Increase quantity">+</button>
                </div>
              </footer>
            </section>

            {/* Primary allocation and outcome workspace */}
            <div className="bq-primary-workspace-grid">
            <div className="bq-item-body bq-workspace-card bq-materials-card">
              {hasMaterialInputs ? (
              <section className="bq-materials-section">
                <div className="bq-materials-section-header">
                  <h3 className="bq-materials-section-title">{inventoryEnabled ? 'Material Allocation' : 'Material Requirements'}</h3>
                  <div className="bq-materials-section-actions">
                    <button
                      type="button"
                      className={`bq-inventory-toggle${inventoryEnabled ? ' is-active' : ''}`}
                      aria-pressed={inventoryEnabled}
                      onClick={toggleInventory}
                    >
                      <span className="bq-inventory-toggle-indicator" aria-hidden="true" />
                      <span>Inventory {inventoryEnabled ? 'On' : 'Off'}</span>
                    </button>
                    {!inventoryEnabled ? <span className="bq-planning-mode-label">Planning Mode</span> : null}
                  </div>
                </div>
              <div className="bq-mat-table">
                <div className={`bq-mat-table-head${inventoryEnabled ? '' : ' bq-mat-table-head--planning'}`} aria-hidden="true">
                  <span>Material</span>
                  <span>Required</span>
                  <span>Target{inventoryEnabled ? '' : ' Quality'}</span>
                  {inventoryEnabled ? <><span>Reserved</span><span>Highest Quality</span><span>Shortfall</span><span>Actions</span></> : <span>Quality Input</span>}
                </div>
                {materialGroups.map((group) => {
                  const activeDrawer = activeDrawersByItem[item.id];
                  const reserveExpanded =
                    activeDrawer?.type === 'reserve' &&
                    activeDrawer.requirementKey === group.groupKey;
                  const qualityRequirement = group.requirements[0];
                  const targetEditorQuality = clampTargetQuality(group.targetQuality ?? group.selectedQuality ?? 500);
                  const targetEditorBands = qualityRequirement.qualityBands ?? FALLBACK_QUALITY_BANDS;
                  const shortfallAmount = isCompletedCraft
                    ? 0
                    : Math.max(group.requiredTotal - group.allocatedTotal, 0);
                  const hasShortfall = shortfallAmount > 0;
                  const totalNeedLabel = formatQuantity(group.requiredTotal, group.material);
                  const shortfallLabel = formatQuantity(shortfallAmount, group.material);
                  const targetQualityLabel = formatTargetQuality(targetEditorQuality);
                  const targetQualityTone = getTargetQualityTone(targetEditorQuality);
                  const averageQualityLabel = formatAverageQuality(group.averageQuality);
                  const highestAvailableQualityLabel = formatAverageQuality(group.highestAvailableQuality);
                  const highestAvailableQualityTone = getAverageQualityTone(group.highestAvailableQuality);
                  const highestAvailableBelowTarget =
                    !isCompletedCraft &&
                    group.highestAvailableQuality !== undefined &&
                    Number.isFinite(group.highestAvailableQuality) &&
                    group.highestAvailableQuality < targetEditorQuality;
                  const openReserve = () => {
                    if (!isCompletedCraft) toggleReserveDrawer(item.id, group.groupKey, reserveExpanded);
                  };
                  return (
                    <section
                      key={group.groupKey}
                      className={[
                        'bq-mat-group',
                        group.needTotal > 0 ? 'bq-mat-group--missing' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <div className={`bq-mat-row bq-mat-row--mobile-card bq-mat-row--touch${inventoryEnabled ? '' : ' bq-mat-row--planning'}`}>
                        <div className="bq-mat-card-head">
                        <div className="bq-mat-identity">
                          <div className="bq-mat-name">
                            <span className="bq-material-name-cell">
                              <MaterialIcon materialName={group.displayName} materialState={isRefinableMaterial(group.material) ? 'refined' : 'raw'} size={34} />
                              <strong>{group.displayName}</strong>
                              <span className="bq-mat-card-total-need" aria-label={`Total Need ${totalNeedLabel}`}>
                                {totalNeedLabel}
                              </span>
                            </span>
                            {group.requirements.length > 1 ? (
                              <span>{group.requirements.length} requirements</span>
                            ) : null}
                          </div>
                          {inventoryEnabled ? <div className="bq-mat-card-metrics">
                            <span className="bq-mat-available">
                              <em>Inventory</em>
                              <strong>{formatQuantity(group.availableQuantity, group.material)}</strong>
                            </span>
                            <span className={`bq-avg-quality bq-avg-quality--${highestAvailableQualityTone}`}>
                              <em>Highest Quality</em>
                              <span>{highestAvailableQualityLabel}</span>
                              {highestAvailableBelowTarget ? <small>below target</small> : null}
                            </span>
                          </div> : null}
                        </div>
                          <div className="bq-target-cell">
                          <TargetQualitySlider
                            label={targetQualityLabel}
                            tone={targetQualityTone}
                            materialName={group.displayName}
                            value={targetEditorQuality}
                            layout="input"
                            disabled={isCompletedCraft}
                            onChange={(value) => updateTargetQuality(
                              item,
                              qualityRequirement.input,
                              qualityRequirement.requirementId,
                              targetEditorBands,
                              value,
                            )}
                            onCommit={(value) => commitTargetQuality(
                              item,
                              value,
                              qualityRequirement.ownAllocations,
                              qualityRequirement.effectiveReservedQuality,
                            )}
                          />
                          </div>
                        </div>
                        <div className="bq-mat-allocation-summary">
                          <strong className="bq-mat-required">
                            {inventoryEnabled ? (
                              <>
                                <span>{formatDecimal(group.allocatedTotal)}</span>
                                <span className="bq-mat-required-suffix"> / {totalNeedLabel} required</span>
                              </>
                            ) : totalNeedLabel}
                          </strong>
                          {inventoryEnabled ? (
                            <progress
                              className="bq-mat-progress"
                              max={Math.max(group.requiredTotal, SCU_QUANTITY_EPSILON)}
                              value={Math.min(group.allocatedTotal, group.requiredTotal)}
                              aria-label={`${group.displayName} allocation progress`}
                            />
                          ) : null}
                          {inventoryEnabled ? (
                            <span className="bq-mat-reserved">
                              <em>Allocated</em>
                              <strong>{formatQuantity(group.allocatedTotal, group.material)}</strong>
                            </span>
                          ) : null}
                          {inventoryEnabled ? (
                            <span className={`bq-mat-card-status bq-balance bq-balance--${hasShortfall ? 'short' : 'met'} ${materialTypeClass(group.material)}`}>
                              <em>Remaining</em>
                              <strong>{shortfallLabel}</strong>
                            </span>
                          ) : null}
                        </div>
                        {inventoryEnabled ? <div className="bq-mat-card-footer">
                          <div className={`bq-mat-card-allocation-bar${group.qualityBreakdown.length === 0 ? ' bq-mat-card-allocation-bar--empty' : ''}`}>
                            <span className="bq-mat-card-quality-label">Quality Allocation</span>
                            <div className="bq-mat-card-quality">
                            {group.qualityBreakdown.length > 0 ? (
                              <QualityAllocationChips
                                breakdown={group.qualityBreakdown}
                                material={group.material}
                                qualityBands={qualityRequirement.qualityBands}
                              />
                            ) : null}
                            <button
                              type="button"
                              className="bq-quality-add"
                              aria-label={`Add quality allocation for ${group.displayName}`}
                              disabled={isCompletedCraft}
                              onClick={(event) => {
                                event.stopPropagation();
                                openReserve();
                              }}
                            >
                              <PlusIcon />
                              {group.qualityBreakdown.length === 0 ? <span>Add allocation</span> : null}
                            </button>
                            </div>
                          </div>
                          <div className="bq-mat-actions" data-bq-row-control="true">
                            <button
                              type="button"
                              className={`bq-icon-action bq-icon-action--add${quickAddTarget?.materialId === (group.material?.id ?? group.requirements[0]?.materialKey) && quickAddTarget?.displayName === group.displayName ? ' is-active' : ''}`}
                              aria-label={`Add inventory for ${group.displayName}`}
                              data-bq-row-control="true"
                              onClick={(event) => {
                                event.stopPropagation();
                                openQuickAdd(
                                  group.material?.id ?? group.requirements[0]?.materialKey ?? '',
                                  group.displayName,
                                  group.material,
                                );
                              }}
                            >
                              <PlusIcon />
                              <span>Inventory</span>
                            </button>
                            <button
                              type="button"
                              className={`bq-icon-action bq-icon-action--drawer${reserveExpanded ? ' is-active' : ''}`}
                              aria-label={`${reserveExpanded ? 'Collapse' : 'Expand'} reserve drawer for ${group.displayName}`}
                              aria-expanded={reserveExpanded}
                              data-bq-row-control="true"
                              onClick={(event) => {
                                event.stopPropagation();
                                openReserve();
                              }}
                            >
                              <ChevronIcon open={reserveExpanded} />
                              <span>Reserve</span>
                            </button>
                          </div>
                        </div> : null}
                      </div>

                      {inventoryEnabled && !isCompletedCraft && group.requirements.flatMap((req) => req.staleAllocations).map(({ allocation, staleReason }) => (
                        <div key={allocation.id} className="bq-stale-line">
                          <span>Stale: {allocation.materialName ?? allocation.materialId} ({STALE_REASON_LABELS[staleReason ?? ''] ?? 'invalid'})</span>
                          <button type="button" className="bq-btn" onClick={() => onClearStaleAllocations(item.id)}>Remove stale</button>
                        </div>
                      ))}

                      {inventoryEnabled && reserveExpanded && (
                        <>
                        <button type="button" className="bq-reserve-backdrop" aria-label="Close reserve drawer" onClick={openReserve} />
                        <aside className="bq-reserve-panel" role="dialog" aria-modal="true" aria-label={`Reserve ${group.displayName}`}>
                          <header className="bq-reserve-drawer-head">
                            <div>
                              <h3>Reserve {group.displayName}</h3>
                              <p>{itemName} · Material requirement</p>
                            </div>
                            <button type="button" className="bq-reserve-close" aria-label="Close reserve drawer" onClick={openReserve}>×</button>
                          </header>
                          <div className="bq-reserve-summary">
                            <span><small>Required</small><strong>{totalNeedLabel}</strong></span>
                            <span><small>Reserved</small><strong>{formatQuantity(group.allocatedTotal, group.material)}</strong></span>
                            <span><small>Remaining</small><strong className={hasShortfall ? 'is-short' : ''}>{shortfallLabel}</strong></span>
                            <span><small>Target Quality</small><strong>{targetEditorQuality}</strong></span>
                            <span><small>Current Avg</small><strong>{averageQualityLabel}</strong></span>
                          </div>
                          <div className="bq-reserve-filters">
                            <label className="bq-reserve-search"><span aria-hidden="true">⌕</span><input value={reserveSearch} onChange={(event) => setReserveSearch(event.target.value)} placeholder="Search boxes or locations" /></label>
                            <label><input type="checkbox" checked={reserveEligibleOnly} onChange={(event) => setReserveEligibleOnly(event.target.checked)} /> Eligible only</label>
                            <label><input type="checkbox" checked={reserveMeetTargetOnly} onChange={(event) => setReserveMeetTargetOnly(event.target.checked)} /> Meet target</label>
                            <select value={reserveSort} onChange={(event) => setReserveSort(event.target.value as typeof reserveSort)} aria-label="Sort reserve boxes">
                              <option value="quality-high">Quality high</option>
                              <option value="quality-low">Quality low</option>
                              <option value="location">Location</option>
                            </select>
                          </div>
                          <div className="bq-reserve-material-strip">
                            <span className="bq-material-name-cell"><MaterialIcon materialName={group.displayName} materialState={isRefinableMaterial(group.material) ? 'refined' : 'raw'} size={28} /><strong>{group.displayName}</strong></span>
                            <strong>{shortfallLabel} remaining</strong>
                          </div>
                          <div className="bq-reserve-drawer-body">
                          {group.requirements.map((req) => {
                            const reserveContext: RequirementReserveContext = {
                              requirementId: req.requirementId,
                              materialKey: req.materialKey,
                              requirementSelectedQuality: req.requirementSelectedQuality,
                              input: req.input,
                              material: req.material,
                              required: req.required,
                              ownAllocations: req.ownAllocations,
                              allocatedAmount: req.allocatedAmount,
                            };
                            const applyStackQuantity = (stack: InventoryStack, desiredQuantity: number) => {
                              commitStackReservation(
                                item,
                                buildQueue,
                                reserveContext,
                                stack,
                                desiredQuantity,
                                onToggleAllocation,
                                onUpdateAllocationQuantity,
                              );
                            };
                            return (
                              <div key={`${req.requirementCardKey}:reserve`} className="bq-reserve-req">
                                {group.requirements.length > 1 && (
                                  <div className="bq-reserve-req-head">
                                    <span>{req.displayName}</span>
                                    <span className={`bq-reserve-status bq-reserve-status--${req.remainingRequired > 0 ? 'short' : req.allocatedAmount > req.required ? 'over' : 'met'}`}>
                                      {formatQuantity(req.allocatedAmount, req.material)} / {formatQuantity(req.required, req.material)}
                                    </span>
                                  </div>
                                )}

                                {req.reservableStacks.length > 0 ? (
                                  <BuildQueueReserveHierarchy
                                    stacks={req.reservableStacks
                                      .filter((stack) => {
                                        const query = reserveSearch.trim().toLowerCase();
                                        const location = formatInventoryLocationLabel(stack).toLowerCase();
                                        const box = (stack.container ?? '').toLowerCase();
                                        const available = getLotAvailableAmountAfterReservations(stack, buildQueue, item.id, req.ownAllocations);
                                        if (query && !location.includes(query) && !box.includes(query)) return false;
                                        if (reserveEligibleOnly && available <= 0 && !req.ownAllocations.some((allocation) => allocation.inventoryEntryId === stack.id)) return false;
                                        if (reserveMeetTargetOnly && req.requirementSelectedQuality !== undefined && (stack.quality ?? 0) < req.requirementSelectedQuality) return false;
                                        return true;
                                      })
                                      .sort((left, right) => reserveSort === 'location'
                                        ? formatInventoryLocationLabel(left).localeCompare(formatInventoryLocationLabel(right))
                                        : reserveSort === 'quality-low'
                                          ? (left.quality ?? 0) - (right.quality ?? 0)
                                          : (right.quality ?? 0) - (left.quality ?? 0))}
                                    renderStack={(stack) => {
                                      const existingAllocation = req.ownAllocations.find((allocation) => allocation.inventoryEntryId === stack.id);
                                      const reservedQuantity = existingAllocation?.quantityReserved ?? 0;
                                      const availableAfterThisReservation = getLotAvailableAmountAfterReservations(stack, buildQueue, item.id, req.ownAllocations);
                                      const checked = reservedQuantity > 0;
                                      const fillQuantity = getStackFillQuantity(reserveContext, stack, buildQueue, item.id);
                                      const assignments = getStackReservationAssignments(stack, buildQueue, recipes, recipeInputsByRecipeId, item.id, req.requirementId);
                                      const currentAssignment = existingAllocation
                                        ? assignments.find((assignment) => assignment.allocation.id === existingAllocation.id)
                                        : undefined;
                                      const otherAssignment = assignments.find((assignment) => !assignment.isCurrentRequirement);
                                      const ownerAssignment = currentAssignment ?? otherAssignment;
                                      const reassignSourceLabel = getAssignmentLabel(otherAssignment);
                                      const isAssignedHere = Boolean(currentAssignment);
                                      const isPartialAssignment = isAssignedHere && isPartialLotAllocation(reservedQuantity, stack.quantity);
                                      const remainderQuantity = isPartialAssignment
                                        ? Math.max(0, stack.quantity - reservedQuantity)
                                        : 0;
                                      const isReservedElsewhere = Boolean(otherAssignment);
                                      const isZeroAvailable = availableAfterThisReservation <= 0 && !isAssignedHere;
                                      const reassignQuantity = otherAssignment
                                        ? Math.min(otherAssignment.allocation.quantityReserved, Math.max(0, req.required - req.allocatedAmount))
                                        : 0;
                                      const disabled = (!checked && fillQuantity <= 0) || (isReservedElsewhere && !isAssignedHere);
                                      const isBelowTarget = req.requirementSelectedQuality !== undefined && (stack.quality ?? 0) < req.requirementSelectedQuality;
                                      const locationName = formatInventoryLocationLabel(stack);
                                      const locationMeta = formatInventoryLocationMetaLabel(stack);
                                      const boxLabel = stack.container?.trim() ||
                                        (stack.recordKind === 'box' ? 'Physical box' : 'Aggregate stock');
                                      const assignmentTitle = getAssignmentTooltip(ownerAssignment);
                                      const locationTitle = [locationName, locationMeta].filter(Boolean).join(' - ');
                                      const beginReassignment = () => {
                                        if (!otherAssignment || reassignQuantity <= 0) return;
                                        const isBelowReassignTarget = req.requirementSelectedQuality !== undefined && (stack.quality ?? 0) < req.requirementSelectedQuality;
                                        setPendingReassignment({
                                          stack,
                                          from: otherAssignment,
                                          quantity: reassignQuantity,
                                          sourceOwnerLabel: getSourceOwnerLabel(otherAssignment.item, recipes, buildQueue),
                                          destinationOwnerLabel: getDestinationOwnerLabel(item, recipes, buildQueue),
                                          materialLabel: getStackMaterialLabel(stack),
                                          targetItemId: item.id,
                                          targetExistingAllocation: existingAllocation,
                                          targetAllocation: createAllocation(
                                            item.id,
                                            req.requirementId,
                                            req.requirementSelectedQuality,
                                            req.input.unitType,
                                            stack,
                                            req.material?.name,
                                            reassignQuantity,
                                            isBelowReassignTarget,
                                          ),
                                        });
                                        setAllocationOwnerHighlight(otherAssignment.item.id);
                                      };
                                      return (
                                        <div key={stack.id} className="bq-reserve-stack-wrap">
                                          <div
                                            className={[
                                              'bq-reserve-stack-row',
                                              checked ? 'is-selected' : '',
                                              isBelowTarget ? 'bq-reserve-stack-row--below-target' : '',
                                              isAssignedHere ? 'bq-reserve-stack-row--assigned-here' : '',
                                              isReservedElsewhere && !isAssignedHere ? 'bq-reserve-stack-row--reserved-elsewhere' : '',
                                              otherAssignment?.item.id === focusedAssignmentItemId ? 'allocation-owner-highlight' : '',
                                              isZeroAvailable ? 'bq-reserve-stack-row--zero-available' : '',
                                            ].filter(Boolean).join(' ')}
                                            title={assignmentTitle}
                                            onMouseEnter={() => setAllocationOwnerHighlight(otherAssignment?.item.id ?? null)}
                                            onMouseLeave={() => {
                                              if (!pendingReassignment) setAllocationOwnerHighlight(null);
                                            }}
                                            onFocus={() => setAllocationOwnerHighlight(otherAssignment?.item.id ?? null)}
                                            onBlur={() => {
                                              if (!pendingReassignment) setAllocationOwnerHighlight(null);
                                            }}
                                          >
                                            <span className="bq-reserve-col-select">
                                              <input
                                                type="checkbox"
                                                className="bq-stack-cb"
                                                checked={checked}
                                                disabled={disabled}
                                                aria-label={`Reserve ${boxLabel} at ${locationName}`}
                                                onChange={() => {
                                                  if (checked) {
                                                    applyStackQuantity(stack, 0);
                                                  } else {
                                                    applyStackQuantity(stack, fillQuantity);
                                                  }
                                                }}
                                              />
                                            </span>
                                            <span className="bq-reserve-col-location" title={assignmentTitle ? undefined : locationTitle || undefined}>
                                              <span className="bq-reserve-location-icon">
                                                <LocationPinIcon />
                                              </span>
                                              <span className="bq-reserve-location-text">
                                                <strong>{boxLabel}</strong>
                                                {stack.recordKind === 'box' ? <em>Individual box</em> : null}
                                              </span>
                                            </span>
                                            <span className={`bq-reserve-col-quality ${qualityBadgeClass(stack)}`}>
                                              {stack.quality ?? '—'}
                                            </span>
                                            <span className={`bq-reserve-col-available ${materialTypeClass(req.material)}`}>
                                              <small>Available</small>
                                              <strong>{formatQuantity(availableAfterThisReservation, req.material)}</strong>
                                            </span>
                                            <span className={`bq-reserve-col-reserved ${materialTypeClass(req.material)}`}>
                                              <small>Amount</small>
                                              <strong>{formatQuantity(stack.quantity, req.material)}</strong>
                                            </span>
                                            <span className="bq-reserve-col-assign">
                                              <small>Reserved here</small>
                                              {isReservedElsewhere && !isAssignedHere ? (
                                                <button
                                                  type="button"
                                                  className="bq-reserve-reassign"
                                                  disabled={reassignQuantity <= 0}
                                                  aria-label={`Reassign allocation from ${reassignSourceLabel} to ${getDestinationOwnerLabel(item, recipes, buildQueue)}`}
                                                  title={reassignQuantity > 0 ? `Reassign allocation from ${reassignSourceLabel}` : 'Current requirement is already filled'}
                                                  onClick={beginReassignment}
                                                >
                                                  <SwapIcon />
                                                  <span>Reassign</span>
                                                </button>
                                              ) : isAssignedHere && reservedQuantity > 0 ? (
                                                <span
                                                  className={[
                                                    'bq-reserve-assigned-display',
                                                    isPartialAssignment ? 'bq-reserve-assigned-display--partial' : '',
                                                  ].filter(Boolean).join(' ')}
                                                >
                                                  <strong>{formatQuantity(reservedQuantity, req.material)}</strong>
                                                  {isPartialAssignment ? (
                                                    <em>{formatQuantity(remainderQuantity, req.material)} left</em>
                                                  ) : null}
                                                </span>
                                              ) : (
                                                <span className="bq-reserve-assigned-display bq-reserve-assigned-display--empty">—</span>
                                              )}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    }}
                                  />
                                ) : (
                                  <div className="bq-empty-inline">No stored stock available for this material.</div>
                                )}
                              </div>
                            );
                          })}
                          </div>
                          <footer className="bq-reserve-drawer-foot">
                            <span><strong>{formatQuantity(group.allocatedTotal, group.material)}</strong> reserved · {hasShortfall ? `${shortfallLabel} remaining` : 'Requirement filled'}</span>
                            <div><button type="button" className="bq-btn" onClick={openReserve}>Cancel</button><button type="button" className="bq-btn bq-btn--confirm" onClick={openReserve}>Reserve Selected</button></div>
                          </footer>
                        </aside>
                        </>
                      )}
                    </section>
                  );
                })}
              </div>
              </section>
            ) : null}

            </div>{/* bq-item-body */}
            <BuildQueueCraftOutcome />
            </div>{/* bq-primary-workspace-grid */}

            <BuildQueueCraftStatistics />

            {pendingCraftSolverPlan?.itemId === item.id ? (
              <CraftAllocationSolverPreview
                plan={pendingCraftSolverPlan.plan}
                itemName={itemName}
                materials={materials}
                onApply={applyCraftSolverPlan}
                onCancel={() => setPendingCraftSolverPlan(null)}
              />
            ) : null}
            </BuildQueueStatsProvider>
          </article>
        );
      })}
    </div>
  );
}




