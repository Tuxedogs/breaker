import { clampMaterialQuality } from "./buildQueueReservations";

export const ALLOCATION_SOLVER_SCU_EPSILON = 1e-6;

export interface AllocationSolverLot {
  lotId: string;
  materialId: string;
  quality?: number;
  availableScu: number;
  locationId?: string;
  locationName: string;
}

export interface AllocationSolverExistingAllocation {
  lotId: string;
  quality?: number;
  allocatedScu: number;
}

export interface AllocationSolverInput {
  materialId: string;
  requiredScu: number;
  targetQuality?: number;
  existingAllocations: AllocationSolverExistingAllocation[];
}

export interface ProposedLotAllocation {
  lotId: string;
  materialId: string;
  quality?: number;
  availableScu: number;
  proposedScu: number;
  locationId?: string;
  locationName: string;
}

export interface AllocationSolverPlan {
  materialId: string;
  requiredScu: number;
  alreadyAllocatedScu: number;
  remainingNeedScu: number;
  targetQuality?: number;
  proposedLots: ProposedLotAllocation[];
  totalProposedScu: number;
  projectedTotalAllocatedScu: number;
  projectedAverageQuality?: number;
  meetsQuantity: boolean;
  meetsTargetQuality: boolean;
  warnings: string[];
}

type QualityScuEntry = { quality?: number; scu: number };

function roundScu(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeScu(value: number): number {
  return roundScu(Math.max(0, value));
}

function getLotQuality(quality: number | undefined): number | undefined {
  return clampMaterialQuality(quality);
}

export function getWeightedAverageQuality(entries: QualityScuEntry[]): number | undefined {
  let weighted = 0;
  let total = 0;
  for (const entry of entries) {
    const scu = normalizeScu(entry.scu);
    const quality = getLotQuality(entry.quality);
    if (scu <= ALLOCATION_SOLVER_SCU_EPSILON || quality === undefined) continue;
    weighted += quality * scu;
    total += scu;
  }
  return total > ALLOCATION_SOLVER_SCU_EPSILON ? weighted / total : undefined;
}

function getExistingTotals(existingAllocations: AllocationSolverExistingAllocation[]) {
  const alreadyAllocatedScu = roundScu(
    existingAllocations.reduce((sum, allocation) => sum + normalizeScu(allocation.allocatedScu), 0),
  );
  const existingWeight = existingAllocations.reduce((sum, allocation) => {
    const scu = normalizeScu(allocation.allocatedScu);
    const quality = getLotQuality(allocation.quality);
    if (scu <= ALLOCATION_SOLVER_SCU_EPSILON || quality === undefined) return sum;
    return sum + quality * scu;
  }, 0);
  return { alreadyAllocatedScu, existingWeight };
}

function getMinimumRequiredAverageForRemainder(
  existingWeight: number,
  existingTotal: number,
  remainderScu: number,
  targetQuality: number,
): number {
  if (remainderScu <= ALLOCATION_SOLVER_SCU_EPSILON) return 0;
  const needed = (targetQuality * (existingTotal + remainderScu) - existingWeight) / remainderScu;
  return Math.max(0, needed);
}

function compareLotsByQualityAscThenSizeDesc(a: AllocationSolverLot, b: AllocationSolverLot): number {
  return (
    (getLotQuality(a.quality) ?? 0) - (getLotQuality(b.quality) ?? 0) ||
    b.availableScu - a.availableScu ||
    a.locationName.localeCompare(b.locationName) ||
    a.lotId.localeCompare(b.lotId)
  );
}

function compareLotsBySizeDescThenQualityAsc(a: AllocationSolverLot, b: AllocationSolverLot): number {
  return (
    b.availableScu - a.availableScu ||
    (getLotQuality(a.quality) ?? 0) - (getLotQuality(b.quality) ?? 0) ||
    a.locationName.localeCompare(b.locationName) ||
    a.lotId.localeCompare(b.lotId)
  );
}

function compareLotsByQualityDescThenSizeDesc(a: AllocationSolverLot, b: AllocationSolverLot): number {
  return (
    (getLotQuality(b.quality) ?? 0) - (getLotQuality(a.quality) ?? 0) ||
    b.availableScu - a.availableScu ||
    a.locationName.localeCompare(b.locationName) ||
    a.lotId.localeCompare(b.lotId)
  );
}

function greedyAllocateFromLots(
  needScu: number,
  lots: AllocationSolverLot[],
  sortLots: (a: AllocationSolverLot, b: AllocationSolverLot) => number,
): ProposedLotAllocation[] {
  if (needScu <= ALLOCATION_SOLVER_SCU_EPSILON) return [];

  const sortedLots = lots
    .filter((lot) => lot.availableScu > ALLOCATION_SOLVER_SCU_EPSILON)
    .slice()
    .sort(sortLots);

  const proposedLots: ProposedLotAllocation[] = [];
  let remaining = needScu;

  for (const lot of sortedLots) {
    if (remaining <= ALLOCATION_SOLVER_SCU_EPSILON) break;
    const proposedScu = roundScu(Math.min(lot.availableScu, remaining));
    if (proposedScu <= ALLOCATION_SOLVER_SCU_EPSILON) continue;
    proposedLots.push({
      lotId: lot.lotId,
      materialId: lot.materialId,
      quality: lot.quality,
      availableScu: lot.availableScu,
      proposedScu,
      locationId: lot.locationId,
      locationName: lot.locationName,
    });
    remaining = roundScu(remaining - proposedScu);
  }

  return proposedLots;
}

function buildPlan(
  input: AllocationSolverInput,
  proposedLots: ProposedLotAllocation[],
  alreadyAllocatedScu: number,
  remainingNeedScu: number,
): AllocationSolverPlan {
  const totalProposedScu = roundScu(proposedLots.reduce((sum, lot) => sum + lot.proposedScu, 0));
  const projectedTotalAllocatedScu = roundScu(alreadyAllocatedScu + totalProposedScu);
  const projectedAverageQuality = getWeightedAverageQuality([
    ...input.existingAllocations.map((allocation) => ({
      quality: allocation.quality,
      scu: allocation.allocatedScu,
    })),
    ...proposedLots.map((lot) => ({
      quality: lot.quality,
      scu: lot.proposedScu,
    })),
  ]);

  const meetsQuantity = projectedTotalAllocatedScu + ALLOCATION_SOLVER_SCU_EPSILON >= input.requiredScu;
  const meetsTargetQuality =
    input.targetQuality === undefined ||
    projectedAverageQuality === undefined ||
    projectedAverageQuality + 0.0001 >= input.targetQuality;

  const warnings: string[] = [];
  if (!meetsQuantity) {
    const shortfall = roundScu(input.requiredScu - projectedTotalAllocatedScu);
    warnings.push(`Insufficient inventory: short by ${shortfall} SCU.`);
  }
  if (input.targetQuality !== undefined && projectedAverageQuality !== undefined && !meetsTargetQuality) {
    warnings.push(
      `Target quality ${input.targetQuality} cannot be met; projected average ${roundProjectedQuality(projectedAverageQuality)}.`,
    );
  } else if (
    input.targetQuality !== undefined &&
    proposedLots.some((lot) => (getLotQuality(lot.quality) ?? 0) < input.targetQuality!)
  ) {
    warnings.push("Some proposed lots are below the target quality.");
  }

  return {
    materialId: input.materialId,
    requiredScu: input.requiredScu,
    alreadyAllocatedScu,
    remainingNeedScu,
    targetQuality: input.targetQuality,
    proposedLots,
    totalProposedScu,
    projectedTotalAllocatedScu,
    projectedAverageQuality,
    meetsQuantity,
    meetsTargetQuality,
    warnings,
  };
}

function roundProjectedQuality(value: number): number {
  return Math.round(value * 100) / 100;
}

function getQualityOverspend(plan: AllocationSolverPlan): number {
  if (plan.targetQuality === undefined) return 0;
  const entries: QualityScuEntry[] = [
    ...plan.proposedLots.map((lot) => ({ quality: lot.quality, scu: lot.proposedScu })),
  ];
  return entries.reduce((sum, entry) => {
    const quality = getLotQuality(entry.quality);
    const scu = normalizeScu(entry.scu);
    if (quality === undefined || scu <= ALLOCATION_SOLVER_SCU_EPSILON) return sum;
    return sum + Math.max(0, quality - plan.targetQuality!) * scu;
  }, 0);
}

function getExcessScu(plan: AllocationSolverPlan): number {
  return Math.max(0, plan.projectedTotalAllocatedScu - plan.requiredScu);
}

function comparePlans(a: AllocationSolverPlan, b: AllocationSolverPlan): number {
  if (a.meetsQuantity !== b.meetsQuantity) return a.meetsQuantity ? 1 : -1;
  if (a.meetsTargetQuality !== b.meetsTargetQuality) return a.meetsTargetQuality ? 1 : -1;

  const excessDelta = getExcessScu(b) - getExcessScu(a);
  if (Math.abs(excessDelta) > ALLOCATION_SOLVER_SCU_EPSILON) return excessDelta;

  const overspendDelta = getQualityOverspend(b) - getQualityOverspend(a);
  if (Math.abs(overspendDelta) > 0.01) return overspendDelta;

  if (a.proposedLots.length !== b.proposedLots.length) {
    return b.proposedLots.length - a.proposedLots.length;
  }

  return a.proposedLots.map((lot) => lot.lotId).join(",").localeCompare(b.proposedLots.map((lot) => lot.lotId).join(","));
}

function allocateForTargetQuality(
  input: AllocationSolverInput,
  candidateLots: AllocationSolverLot[],
  alreadyAllocatedScu: number,
  remainingNeedScu: number,
  existingWeight: number,
): ProposedLotAllocation[] {
  const targetQuality = input.targetQuality;
  if (targetQuality === undefined) {
    return greedyAllocateFromLots(remainingNeedScu, candidateLots, compareLotsBySizeDescThenQualityAsc);
  }

  const minRequiredAverage = getMinimumRequiredAverageForRemainder(
    existingWeight,
    alreadyAllocatedScu,
    remainingNeedScu,
    targetQuality,
  );

  const qualifyingLots = candidateLots.filter((lot) => (getLotQuality(lot.quality) ?? 0) + 0.0001 >= minRequiredAverage);
  const belowTargetLots = candidateLots.filter((lot) => (getLotQuality(lot.quality) ?? 0) + 0.0001 < minRequiredAverage);

  const primary = greedyAllocateFromLots(remainingNeedScu, qualifyingLots, compareLotsByQualityAscThenSizeDesc);
  const primaryTotal = roundScu(primary.reduce((sum, lot) => sum + lot.proposedScu, 0));
  const stillNeeded = roundScu(remainingNeedScu - primaryTotal);

  if (stillNeeded <= ALLOCATION_SOLVER_SCU_EPSILON) return primary;

  const usedLotIds = new Set(primary.map((lot) => lot.lotId));
  const fallbackLots = belowTargetLots.filter((lot) => !usedLotIds.has(lot.lotId));
  const fallback = greedyAllocateFromLots(stillNeeded, fallbackLots, compareLotsByQualityDescThenSizeDesc);

  return [...primary, ...fallback];
}

function buildCandidatePlans(
  input: AllocationSolverInput,
  candidateLots: AllocationSolverLot[],
  alreadyAllocatedScu: number,
  remainingNeedScu: number,
  existingWeight: number,
): AllocationSolverPlan[] {
  const usableLots = candidateLots.filter(
    (lot) =>
      lot.materialId === input.materialId &&
      lot.availableScu > ALLOCATION_SOLVER_SCU_EPSILON,
  );

  const strategies: ProposedLotAllocation[][] = [
    greedyAllocateFromLots(remainingNeedScu, usableLots, compareLotsBySizeDescThenQualityAsc),
    allocateForTargetQuality(input, usableLots, alreadyAllocatedScu, remainingNeedScu, existingWeight),
    greedyAllocateFromLots(remainingNeedScu, usableLots, compareLotsByQualityAscThenSizeDesc),
    greedyAllocateFromLots(remainingNeedScu, usableLots, compareLotsByQualityDescThenSizeDesc),
  ];

  return strategies.map((proposedLots) =>
    buildPlan(input, proposedLots, alreadyAllocatedScu, remainingNeedScu),
  );
}

export function solveBuildQueueAllocation(
  input: AllocationSolverInput,
  candidateLots: AllocationSolverLot[],
): AllocationSolverPlan {
  const { alreadyAllocatedScu, existingWeight } = getExistingTotals(input.existingAllocations);
  const remainingNeedScu = roundScu(Math.max(0, input.requiredScu - alreadyAllocatedScu));

  if (remainingNeedScu <= ALLOCATION_SOLVER_SCU_EPSILON) {
    return buildPlan(input, [], alreadyAllocatedScu, remainingNeedScu);
  }

  const candidatePlans = buildCandidatePlans(
    input,
    candidateLots,
    alreadyAllocatedScu,
    remainingNeedScu,
    existingWeight,
  );

  const bestPlan = candidatePlans.reduce((best, plan) => (comparePlans(plan, best) > 0 ? plan : best));
  return bestPlan;
}

export function buildSolverLotsFromInventoryStacks(
  stacks: Array<{
    id: string;
    materialId?: string;
    quality?: number;
    quantity: number;
    locationId?: string;
  }>,
  getAvailableScu: (stackId: string) => number,
  getLocationName: (stack: { locationId?: string }) => string,
): AllocationSolverLot[] {
  return stacks
    .filter((stack) => stack.materialId && getAvailableScu(stack.id) > ALLOCATION_SOLVER_SCU_EPSILON)
    .map((stack) => ({
      lotId: stack.id,
      materialId: stack.materialId!,
      quality: stack.quality,
      availableScu: roundScu(getAvailableScu(stack.id)),
      locationId: stack.locationId,
      locationName: getLocationName(stack),
    }));
}
