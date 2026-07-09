import { useCallback, useEffect, useRef, useState } from 'react';
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
  getLotAvailableAmountAfterReservations,
  getQualityAllocationBreakdown,
  getRemainingRequiredAmount,
  getRequirementLineKey,
  getWeightedEffectiveQuality,
  type QualityAllocationBreakdownEntry,
} from '../../lib/logistics/buildQueueReservations';
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
import { parseJsonResponse } from '../../lib/safeJson';

import MaterialIcon from './MaterialIcon';
import { BuildQueueProductIcon } from './BuildQueueProductIcon';
import BuildQueueStatsBreakdown from './BuildQueueStatsBreakdown';
import type { FittingIconMode } from '../../lib/fitting/fittingIconMode';

// ─── Helpers ────────────────────────────────────────────────────────────────

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
    (queueItem.reservedAllocations ?? [])
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

type BuildQueueHeaderBadge = {
  key: string;
  label: string;
  className: string;
};

function materialsTargetMet(item: BuildQueueItem, inputs: RecipeInputTemplate[]): boolean {
  if (inputs.length === 0) return false;

  let hasQualityTarget = false;
  for (const [inputIndex, input] of inputs.entries()) {
    const target = input.selectedQuality;
    if (target === undefined || !Number.isFinite(target)) continue;

    hasQualityTarget = true;
    const requirementId = getRequirementId(item, input, inputIndex);
    const ownAllocations = (item.reservedAllocations ?? []).filter(
      (allocation) => allocation.requirementId === requirementId && allocation.quantityReserved > 0,
    );
    if (ownAllocations.length === 0) return false;

    const effectiveQuality = getWeightedEffectiveQuality(ownAllocations);
    if (effectiveQuality === undefined || effectiveQuality < target) return false;
  }

  return hasQualityTarget;
}

function getBuildQueueHeaderBadges(
  fulfillment: 'complete' | 'partial' | 'missing',
  isCompletedCraft: boolean,
  targetMet: boolean,
): BuildQueueHeaderBadge[] {
  if (isCompletedCraft) {
    return [{ key: 'complete', label: 'Complete', className: 'bq-badge--complete' }];
  }

  const badges: BuildQueueHeaderBadge[] = [];
  if (fulfillment === 'missing') {
    badges.push({ key: 'missing', label: 'Missing', className: 'bq-badge--missing' });
  } else if (fulfillment === 'partial') {
    badges.push({ key: 'partial', label: 'Partial', className: 'bq-badge--partial' });
  } else {
    badges.push({ key: 'possible', label: 'Possible', className: 'bq-badge--covered' });
  }

  if (targetMet) {
    badges.push({ key: 'target-met', label: 'Target Met', className: 'bq-badge--target-met' });
  }

  return badges;
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
  return value === undefined || !Number.isFinite(value) ? '—' : `${Math.round(value)}+`;
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

function parseTargetQualityDraft(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTargetQualityDraft(value: string): string {
  return value.replace(/\D/g, '');
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

function EditIcon() {
  return (
    <svg className="bq-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
      <path d="m13.5 6.5 3 3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="bq-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="bq-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 6h18M8 6V4h8v2M10 11v6M14 11v6M6 6l1 15h10l1-15" />
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
          <button type="button" className="bq-btn bq-btn--compact" onClick={onCancel}>Cancel</button>
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
                  <div>
                    <strong>{materialPlan.materialName}</strong>
                    <span className={`bq-solve-material-status bq-solve-material-status--${materialPlan.status}`}>
                      {getMaterialPlanStatusLabel(materialPlan.status)}
                    </span>
                  </div>
                  <div className="bq-solve-material-metrics">
                    <span>{formatQuantity(materialPlan.alreadyAllocatedScu, material)} allocated</span>
                    <span>{formatQuantity(materialPlan.totalProposedScu, material)} proposed</span>
                    <span>{formatQuantity(materialPlan.requiredScu, material)} required</span>
                  </div>
                </div>

                <div className="bq-solve-preview-metrics bq-solve-preview-metrics--material">
                  <span>
                    Projected avg <strong>{projectedQualityLabel}</strong>
                  </span>
                  <span className={materialPlan.meetsTargetQuality ? 'bq-solve-status--met' : 'bq-solve-status--warn'}>
                    Target {materialPlan.targetQuality ?? 'any'}: {materialPlan.meetsTargetQuality ? 'Met' : 'Not met'}
                  </span>
                  <span className={materialPlan.meetsQuantity ? 'bq-solve-status--met' : 'bq-solve-status--short'}>
                    {formatQuantity(materialPlan.projectedTotalAllocatedScu, material)} / {formatQuantity(materialPlan.requiredScu, material)}
                  </span>
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
                      <span>Location</span>
                      <span>Quality</span>
                      <span>Proposed</span>
                    </div>
                    {materialPlan.proposedLots.map((proposedLot) => (
                      <div key={proposedLot.lotId} className="bq-solve-preview-lot-row">
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

type BuildQueueSummaryMetrics = { coveredCount: number; totalShortfall: number };

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
  iconMode: FittingIconMode;
}

// ─── Target Quality Popover ──────────────────────────────────────────────────

function TargetQualityEditor({
  label,
  tone,
  isOpen,
  inline,
  draftQuality,
  recipeTargetQuality,
  onOpen,
  onDraftQualityChange,
  onApply,
  onCancel,
}: {
  label: string;
  tone: string;
  isOpen: boolean;
  inline?: boolean;
  draftQuality: string;
  recipeTargetQuality: number;
  onOpen: () => void;
  onDraftQualityChange: (value: string) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const canApply = parseTargetQualityDraft(draftQuality) !== null;

  useEffect(() => {
    if (inline) {
      if (!isOpen) return;
      const frame = window.requestAnimationFrame(() => {
        inputRef.current?.focus({ preventScroll: true });
      });
      return () => window.cancelAnimationFrame(frame);
    }
    if (inline) return;
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [inline, isOpen]);

  useEffect(() => {
    if (inline) return;
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      onCancel();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [inline, isOpen, onCancel]);

  const setPreset = (value: number) => onDraftQualityChange(String(clampTargetQuality(value)));
  const commitInline = () => {
    if (canApply) onApply();
    else onCancel();
  };

  return (
    <span className={`bq-target-editor${inline ? ' bq-target-editor--inline' : ''}`} ref={rootRef} data-bq-row-control="true">
      {inline && isOpen ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className={`bq-target-inline-input bq-target-inline-input--${tone}`}
          value={draftQuality}
          aria-label="Exact target quality"
          data-bq-row-control="true"
          onChange={(event) => onDraftQualityChange(normalizeTargetQualityDraft(event.target.value))}
          onBlur={commitInline}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitInline();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
          }}
        />
      ) : (
        <button
          type="button"
          className={`bq-target-quality bq-target-quality--${tone}${isOpen ? ' is-active' : ''}`}
          aria-label="Edit target quality"
          aria-expanded={isOpen}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          <span>{label}</span>
          <EditIcon />
        </button>
      )}
      {!inline && isOpen ? (
        <div
          className="bq-target-popover"
          role="dialog"
          aria-label="Target Quality"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
          }}
        >
          <h4>Target Quality</h4>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draftQuality}
            aria-label="Exact target quality"
            onChange={(event) => onDraftQualityChange(normalizeTargetQualityDraft(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && canApply) {
                event.preventDefault();
                onApply();
              }
            }}
          />
          <div className="bq-target-presets" aria-label="Target quality presets">
            <button type="button" onClick={() => setPreset(800)}>800+</button>
            <button type="button" onClick={() => setPreset(900)}>900+</button>
            <button type="button" onClick={() => setPreset(recipeTargetQuality)}>Recipe</button>
          </div>
          <div className="bq-target-popover-actions">
            <button type="button" className="bq-btn" onClick={onCancel}>Cancel</button>
            <button type="button" className="bq-btn bq-btn--confirm" disabled={!canApply} onClick={onApply}>Apply</button>
          </div>
        </div>
      ) : null}
    </span>
  );
}

// ─── Group ───────────────────────────────────────────────────────────────────

export default function BuildQueueGroup({
  category, itemTypeLabel, items, recipes, recipeInputsByRecipeId, buildQueue, inventory,
  materials, locations, strategy, onQuantityChange,
  onMaterialRequirementChange, onStatusChange, onRemove, onToggleAllocation, onUpdateAllocationQuantity, onClearStaleAllocations,
  onAllocationOwnerHighlightChange,
  iconMode,
}: Props) {
  const [activeDrawersByItem, setActiveDrawersByItem] = useState<Record<string, BuildQueueActiveDrawer | undefined>>({});
  const [qualityDrafts, setQualityDrafts] = useState<Record<string, string>>({});
  const [pendingReassignment, setPendingReassignment] = useState<PendingReassignment | null>(null);
  const [pendingCraftSolverPlan, setPendingCraftSolverPlan] = useState<{
    itemId: string;
    plan: CraftAllocationSolverPlan;
  } | null>(null);
  const [solverPlanning, setSolverPlanning] = useState(false);
  const [focusedAssignmentItemId, setFocusedAssignmentItemId] = useState<string | null>(null);
  const isMobileTouchLayout = useIsMobileTouchLayout();
  const { getBandsForMaterial: getQuantizedBands } = useBQQuantization();

  const setAllocationOwnerHighlight = useCallback((itemId: string | null) => {
    setFocusedAssignmentItemId(itemId);
    onAllocationOwnerHighlightChange?.(itemId);
  }, [onAllocationOwnerHighlightChange]);

  useEffect(() => () => {
    onAllocationOwnerHighlightChange?.(null);
  }, [onAllocationOwnerHighlightChange]);

  function openQualityEditor(itemId: string, editorKey: string, selectedQuality: number | undefined) {
    const alreadyOpen =
      activeDrawersByItem[itemId]?.type === 'quality' &&
      activeDrawersByItem[itemId]?.requirementKey === editorKey;
    setActiveDrawersByItem((prev) => ({ ...prev, [itemId]: alreadyOpen ? undefined : { type: 'quality', requirementKey: editorKey } }));
    setQualityDrafts((prev) => {
      const next = { ...prev };
      delete next[editorKey];
      if (!alreadyOpen) next[editorKey] = String(clampTargetQuality(selectedQuality ?? 500));
      return next;
    });
  }

  function toggleReserveDrawer(itemId: string, requirementKey: string, isOpen: boolean) {
    setActiveDrawersByItem((prev) => ({ ...prev, [itemId]: isOpen ? undefined : { type: 'reserve', requirementKey } }));
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
    const parsed = parseTargetQualityDraft(qualityDrafts[editorKey] ?? '');
    if (parsed === null) return;
    const draftQuality = clampTargetQuality(parsed);
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
      {items.map((item) => {
        const recipe = getRecipeForQueueItem(item.recipeId, recipes);
        const itemName = item.itemName ?? recipe?.name ?? item.recipeId;
        const inputs = getBuildQueueItemInputs(item, recipeInputsByRecipeId);
        const hasMaterialInputs = inputs.length > 0;
        const isCompletedCraft = item.status === 'complete';
        const blueprintSources = item.blueprintSources ?? [];
        const fulfillment = getItemFulfillmentState(item, inputs, inventory);
        const readableType = itemTypeLabel ?? CATEGORY_LABELS[category] ?? category;

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

        const recipeDefaultInputs = recipeInputsByRecipeId[item.recipeId] ?? [];
        const materialRequirementRows = inputs.map((input, inputIndex) => {
          const materialKey = input.materialKey ?? input.materialId;
          const requirementId = getRequirementId(item, input, inputIndex);
          const groupKey = `${item.id}:${requirementId}`;
          const requirementCardKey = `${groupKey}:${requirementId}:${inputIndex}`;
          const material = materials.find((e) => e.id === materialKey);
          const displayName = input.displayName ?? input.materialName ?? material?.name ?? `Unresolved: ${input.rawName ?? materialKey}`;
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
          const coverage = getMaterialReservationCoverage(item, materialKey, required, inventory, effectiveRequirementIdentity);
          const needSummary = getBuildQueueMaterialNeedSummary(item, materialKey, required, inventory, buildQueue, effectiveRequirementIdentity);
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
            rowTone: getGroupedCoverageState(group.requirements.map((r) => r.coverage.coverageState)),
            reserveStatusLabel: first.reserveStatusLabel,
            requiredTotal: group.requirements.reduce((s, r) => s + r.required, 0),
            reservedTotal: group.requirements.reduce((s, r) => s + r.coverage.reservedQuantity, 0),
            allocatedTotal: group.requirements.reduce((s, r) => s + r.allocatedAmount, 0),
            ownedQuantity: Math.max(0, ...group.requirements.map((r) => r.needSummary.ownedQuantity)),
            availableQuantity: Math.max(0, ...group.requirements.map((r) => r.needSummary.availableQuantity)),
            needTotal: group.requirements.reduce((s, r) => s + r.needSummary.stillNeeded, 0),
            hasStock: group.requirements.some((r) => r.allMaterialStacks.length > 0),
          };
        });

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
        const autoReserveTitle = allRequirementsComplete
          ? 'All material requirements are already fully allocated'
          : isCompletedCraft
            ? 'Completed crafts cannot be auto-reserved'
            : 'Propose inventory lots for all underfilled materials';

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
        const headerBadges = getBuildQueueHeaderBadges(
          fulfillment,
          isCompletedCraft,
          materialsTargetMet(item, inputs),
        );

        return (
          <article
            key={item.id}
            className={[
              'bq-item',
              `bq-item--${isCompletedCraft ? 'completed-craft' : fulfillment}`,
              focusedAssignmentItemId === item.id ? 'bq-item--assignment-focus' : '',
              pendingReassignment?.targetItemId === item.id ? 'bq-item--reassign-destination' : '',
              isMobileTouchLayout ? 'bq-item--mobile-touch' : '',
            ].filter(Boolean).join(' ')}
            data-bq-item-id={item.id}
          >

            {/* ── Craft header: identity | stats | icon ── */}
            <div className="bq-item-sidebar bq-item-header">
              <div className="bq-item-identity">
                <div className="bq-item-name-block">
                  <span className="bq-item-cat">{readableType}</span>
                  <h2 className="bq-item-name">{itemName}</h2>
                </div>

                <div className="bq-item-badges" aria-label="Craft status">
                  {headerBadges.map((badge) => (
                    <span key={badge.key} className={`bq-badge ${badge.className}`}>
                      {badge.label}
                    </span>
                  ))}
                </div>

                <div className="bq-item-mission">
                  <span className="bq-item-mission-label">Blueprint Source</span>
                  <span className="bq-item-blueprint" title={blueprintLabel}>
                    {blueprintLabel}
                  </span>
                </div>

                <div className="bq-item-footer">
                  <div className="bq-item-actions">
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

                <div className="bq-qty" aria-label="Craft quantity">
                  <button type="button" className="bq-qty-btn" onClick={() => onQuantityChange(item.id, item.quantity - 1)} disabled={isCompletedCraft || item.quantity <= 1} aria-label="Decrease quantity">-</button>
                  <span className="bq-qty-val">{item.quantity}x</span>
                  <button type="button" className="bq-qty-btn" onClick={() => onQuantityChange(item.id, item.quantity + 1)} disabled={isCompletedCraft} aria-label="Increase quantity">+</button>
                </div>
              </div>

              <div className="bq-item-stats">
                <BuildQueueStatsBreakdown
                  blueprintId={item.blueprint_id}
                  item={item}
                  inputs={inputs}
                />
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
            </div>

            {/* Right body */}
            <div className="bq-item-body">
              {hasMaterialInputs ? (
              <section className="bq-materials-section">
                <div className="bq-materials-section-header">
                  <div className="bq-materials-section-heading">
                    <h3 className="bq-materials-section-title">Material Allocation</h3>
                    <p className="bq-materials-section-summary">
                      {summaryMetrics.coveredCount}/{inputs.length} covered
                      {summaryMetrics.totalShortfall > 0
                        ? ` · ${formatQuantity(summaryMetrics.totalShortfall, undefined)} short`
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="bq-auto-reserve-btn"
                    disabled={autoReserveDisabled || solverPlanning}
                    aria-label={`Auto reserve inventory for ${itemName}`}
                    title={autoReserveTitle}
                    onClick={runCraftSolver}
                  >
                    <SolveIcon />
                    <span>{solverPlanning ? 'Planning…' : 'Auto Reserve'}</span>
                  </button>
                </div>
              <div className="bq-mat-table">
                {!isMobileTouchLayout ? (
                <div className="bq-mat-head" aria-hidden="true">
                  <span>Material</span>
                  <span>Total Need</span>
                  <span>Allocated</span>
                  <span>Target</span>
                  <span>Avg Quality</span>
                  <span>Shortfall / Excess</span>
                  <span>Quality Allocation</span>
                  <span>Actions</span>
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
                  const targetEditorQuality = clampTargetQuality(group.targetQuality ?? group.selectedQuality ?? 500);
                  const targetEditorBands = qualityRequirement.qualityBands ?? FALLBACK_QUALITY_BANDS;
                  const qualityDraft = qualityExpanded
                    ? (qualityDrafts[group.groupKey] ?? String(clampTargetQuality(targetEditorQuality)))
                    : String(clampTargetQuality(targetEditorQuality));
                  const balanceAmount = group.allocatedTotal - group.requiredTotal;
                  const balanceTone = balanceAmount < 0 ? 'short' : balanceAmount > 0 ? 'excess' : 'met';
                  const balanceLabel = formatQuantity(Math.abs(balanceAmount), group.material);
                  const balanceStateLabel = balanceTone === 'short' ? 'short' : balanceTone === 'excess' ? 'excess' : 'balanced';
                  const targetQualityLabel = formatTargetQuality(targetEditorQuality);
                  const targetQualityTone = getTargetQualityTone(targetEditorQuality);
                  const averageQualityLabel = formatAverageQuality(group.averageQuality);
                  const averageQualityTone = getAverageQualityTone(group.averageQuality);
                  const averageBelowTarget =
                    group.averageQuality !== undefined &&
                    Number.isFinite(group.averageQuality) &&
                    group.averageQuality < targetEditorQuality;
                  const hasBelowTargetStock = group.requirements.some((req) =>
                    req.requirementSelectedQuality !== undefined &&
                    req.reservableStacks.some((stack) => (stack.quality ?? 0) < (req.requirementSelectedQuality as number)),
                  );
                  const hasReserveAllocations = group.requirements.some((req) => req.ownAllocations.length > 0);
                  const clearGroupReserve = () => {
                    group.requirements.forEach((req) => {
                      req.ownAllocations.forEach((allocation) => onToggleAllocation(item.id, allocation));
                    });
                  };
                  const openReserve = () => toggleReserveDrawer(item.id, group.groupKey, reserveExpanded);
                  return (
                    <section
                      key={group.groupKey}
                      className={[
                        'bq-mat-group',
                        group.needTotal > 0 ? 'bq-mat-group--missing' : '',
                        qualityExpanded ? 'bq-mat-group--target-open' : '',
                        isMobileTouchLayout ? 'bq-mat-group--mobile-card' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      {isMobileTouchLayout ? (
                      <div className="bq-mat-row bq-mat-row--mobile-card bq-mat-row--touch">
                        <div className="bq-mat-card-head">
                          <div className="bq-mat-name">
                            <span className="bq-material-name-cell">
                              <MaterialIcon materialName={group.displayName} materialState={isRefinableMaterial(group.material) ? 'refined' : 'raw'} size={34} />
                              <strong>{group.displayName}</strong>
                            </span>
                            {group.requirements.length > 1 ? (
                              <span>{group.requirements.length} requirements</span>
                            ) : null}
                          </div>
                          <div className="bq-mat-actions" data-bq-row-control="true">
                            <button
                              type="button"
                              className={`bq-icon-action bq-icon-action--reserve${reserveExpanded ? ' is-active' : ''}`}
                              aria-label={`${reserveExpanded ? 'Hide' : 'Adjust'} allocations for ${group.displayName}`}
                              aria-expanded={reserveExpanded}
                              data-bq-row-control="true"
                              onClick={(event) => {
                                event.stopPropagation();
                                openReserve();
                              }}
                            >
                              <PlusIcon />
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
                            </button>
                          </div>
                        </div>
                        <div className="bq-mat-card-metrics">
                          <span><em>Need</em>{formatQuantity(group.requiredTotal, group.material)}</span>
                          <span className={`bq-qty-cell--allocated ${materialTypeClass(group.material)}`}><em>Allocated</em>{formatQuantity(group.allocatedTotal, group.material)}</span>
                          <span className="bq-target-quality-cell">
                            <em>Target</em>
                            <TargetQualityEditor
                              label={targetQualityLabel}
                              tone={targetQualityTone}
                              isOpen={qualityExpanded}
                              inline={isMobileTouchLayout}
                              draftQuality={qualityDraft}
                              recipeTargetQuality={group.recipeTargetQuality}
                              onOpen={() => openQualityEditor(item.id, group.groupKey, targetEditorQuality)}
                              onDraftQualityChange={(value) => setQualityDrafts((prev) => ({ ...prev, [group.groupKey]: value }))}
                              onApply={() => applyQualityEditor(
                                item,
                                qualityRequirement.input,
                                qualityRequirement.requirementId,
                                group.groupKey,
                                targetEditorBands,
                                qualityRequirement.ownAllocations,
                                qualityRequirement.effectiveReservedQuality,
                              )}
                              onCancel={() => cancelQualityEditor(item.id, group.groupKey)}
                            />
                          </span>
                          <span className={`bq-avg-quality bq-avg-quality--${averageQualityTone}`}>
                            <em>Avg Quality</em>
                            <span>{averageQualityLabel}</span>
                            {averageBelowTarget ? <small>below target</small> : null}
                          </span>
                        </div>
                        <div className={`bq-mat-card-status bq-balance bq-balance--${balanceTone} ${materialTypeClass(group.material)}`}>
                          <em>{balanceTone === 'short' ? 'Remaining' : balanceStateLabel}</em>
                          <strong>{balanceTone === 'met' ? formatQuantity(0, group.material) : balanceLabel}</strong>
                          {balanceTone === 'short' ? <span>short</span> : null}
                        </div>
                        {group.qualityBreakdown.length > 0 ? (
                          <div className="bq-mat-card-quality">
                            <QualityAllocationChips
                              breakdown={group.qualityBreakdown}
                              material={group.material}
                              qualityBands={qualityRequirement.qualityBands}
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="bq-mat-card-quality bq-quality-empty"
                            onClick={(event) => {
                              event.stopPropagation();
                              openReserve();
                            }}
                          >
                            No allocation
                          </button>
                        )}
                      </div>
                      ) : (
                      <div
                        className="bq-mat-row"
                        onClick={(event) => {
                          if (isDrawerToggleExcluded(event.target)) return;
                          openReserve();
                        }}
                      >
                        <div className="bq-mat-name">
                          <span className="bq-material-name-cell">
                            <MaterialIcon materialName={group.displayName} materialState={isRefinableMaterial(group.material) ? 'refined' : 'raw'} size={34} />
                            <strong>{group.displayName}</strong>
                          </span>
                          {group.requirements.length > 1 && <span>{group.requirements.length} requirements</span>}
                        </div>
                        <span className={`bq-qty-cell ${materialTypeClass(group.material)}`}>{formatQuantity(group.requiredTotal, group.material)}</span>
                        <span className={`bq-qty-cell bq-qty-cell--allocated ${materialTypeClass(group.material)}`}>{formatQuantity(group.allocatedTotal, group.material)}</span>
                        <TargetQualityEditor
                          label={targetQualityLabel}
                          tone={targetQualityTone}
                          isOpen={qualityExpanded}
                          inline={isMobileTouchLayout}
                          draftQuality={qualityDraft}
                          recipeTargetQuality={group.recipeTargetQuality}
                          onOpen={() => openQualityEditor(item.id, group.groupKey, targetEditorQuality)}
                          onDraftQualityChange={(value) => setQualityDrafts((prev) => ({ ...prev, [group.groupKey]: value }))}
                          onApply={() => applyQualityEditor(
                            item,
                            qualityRequirement.input,
                            qualityRequirement.requirementId,
                            group.groupKey,
                            targetEditorBands,
                            qualityRequirement.ownAllocations,
                            qualityRequirement.effectiveReservedQuality,
                          )}
                          onCancel={() => cancelQualityEditor(item.id, group.groupKey)}
                        />
                        <span className={`bq-avg-quality bq-avg-quality--${averageQualityTone}`}>
                          <span><i aria-hidden="true" />{averageQualityLabel}</span>
                          <em>avg</em>
                          {averageBelowTarget ? <small>below target</small> : null}
                        </span>
                        <span className={`bq-balance bq-balance--${balanceTone} ${materialTypeClass(group.material)}`}>
                          <strong>{balanceTone === 'met' ? formatQuantity(0, group.material) : balanceLabel}</strong>
                          <em>{balanceStateLabel}</em>
                        </span>
                        <div className="bq-quality-allocation-cell">
                          {group.qualityBreakdown.length > 0 ? (
                            <QualityAllocationChips
                              breakdown={group.qualityBreakdown}
                              material={group.material}
                              qualityBands={qualityRequirement.qualityBands}
                            />
                          ) : (
                            <button
                              type="button"
                              className="bq-quality-empty"
                              onClick={(event) => {
                                event.stopPropagation();
                                openReserve();
                              }}
                            >
                              —
                            </button>
                          )}
                        </div>
                        <div className="bq-mat-actions" data-bq-row-control="true">
                          <button
                            type="button"
                            className={`bq-icon-action bq-icon-action--reserve${reserveExpanded ? ' is-active' : ''}`}
                            aria-label={`${reserveExpanded ? 'Hide' : 'Adjust'} allocations for ${group.displayName}`}
                            aria-expanded={reserveExpanded}
                            data-bq-row-control="true"
                            onClick={(event) => {
                              event.stopPropagation();
                              openReserve();
                            }}
                          >
                            <PlusIcon />
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

                      {reserveExpanded && (
                        <div className="bq-reserve-panel">
                          <div className="bq-reserve-panel-head">
                            <div className="bq-reserve-panel-title">
                              {hasBelowTargetStock ? (
                                <span className="bq-reserve-warning">
                                  <WarningIcon />
                                  Below Target Quality
                                </span>
                              ) : null}
                              <span className="bq-reserve-panel-label">Reserve from inventory</span>
                            </div>
                            {hasReserveAllocations ? (
                              <button
                                type="button"
                                className="bq-reserve-clear-icon"
                                aria-label={`Clear reservations for ${group.displayName}`}
                                title="Clear reservations"
                                onClick={clearGroupReserve}
                              >
                                <TrashIcon />
                              </button>
                            ) : null}
                          </div>
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
                                  <>
                                    <div className="bq-reserve-stack-head" aria-hidden="true">
                                      <span className="bq-reserve-col-select" />
                                      <span className="bq-reserve-col-location">Location</span>
                                      <span className="bq-reserve-col-quality">Quality</span>
                                      <span className="bq-reserve-col-available">Available</span>
                                      <span className="bq-reserve-col-reserved">Reserved</span>
                                      <span className="bq-reserve-col-assign">Assigned</span>
                                    </div>
                                    {req.reservableStacks.map((stack) => {
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
                                      const assignmentLabel = ownerAssignment ? getAssignmentLabel(ownerAssignment) : undefined;
                                      const reassignSourceLabel = getAssignmentLabel(otherAssignment);
                                      const isAssignedHere = Boolean(currentAssignment);
                                      const isPartialAssignment = isAssignedHere && isPartialLotAllocation(reservedQuantity, stack.quantity);
                                      const remainderQuantity = isPartialAssignment
                                        ? Math.max(0, stack.quantity - reservedQuantity)
                                        : 0;
                                      const isReservedElsewhere = Boolean(otherAssignment);
                                      const isZeroAvailable = availableAfterThisReservation <= 0 && !isAssignedHere;
                                      const reservedDisplayQuantity = isAssignedHere
                                        ? reservedQuantity
                                        : assignments.reduce((sum, assignment) => sum + assignment.allocation.quantityReserved, 0);
                                      const reassignQuantity = otherAssignment
                                        ? Math.min(otherAssignment.allocation.quantityReserved, Math.max(0, req.required - req.allocatedAmount))
                                        : 0;
                                      const disabled = (!checked && fillQuantity <= 0) || (isReservedElsewhere && !isAssignedHere);
                                      const isBelowTarget = req.requirementSelectedQuality !== undefined && (stack.quality ?? 0) < req.requirementSelectedQuality;
                                      const locationName = formatInventoryLocationLabel(stack);
                                      const locationMeta = formatInventoryLocationMetaLabel(stack);
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
                                                aria-label={`Reserve ${locationName}`}
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
                                                <strong>{locationName}</strong>
                                                {locationMeta ? <em>{locationMeta}</em> : null}
                                              </span>
                                            </span>
                                            <span className={`bq-reserve-col-quality ${qualityBadgeClass(stack)}`}>
                                              {stack.quality ?? '—'}
                                            </span>
                                            <span className={`bq-reserve-col-available ${materialTypeClass(req.material)}`}>
                                              {formatQuantity(availableAfterThisReservation, req.material)}
                                            </span>
                                            <span className={`bq-reserve-col-reserved ${materialTypeClass(req.material)}`}>
                                              <strong>{formatQuantity(reservedDisplayQuantity, req.material)}</strong>
                                              {assignmentLabel ? <em>{assignmentLabel}</em> : null}
                                            </span>
                                            <span className="bq-reserve-col-assign">
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
                                    })}
                                  </>
                                ) : (
                                  <div className="bq-empty-inline">No stored stock available for this material.</div>
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
              </section>
            ) : null}

            </div>{/* bq-item-body */}

            {pendingCraftSolverPlan?.itemId === item.id ? (
              <CraftAllocationSolverPreview
                plan={pendingCraftSolverPlan.plan}
                itemName={itemName}
                materials={materials}
                onApply={applyCraftSolverPlan}
                onCancel={() => setPendingCraftSolverPlan(null)}
              />
            ) : null}
          </article>
        );
      })}
    </div>
  );
}




