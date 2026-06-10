import type {
  RefineryMaterialCalculation,
  RefineryOptimizationResult,
  RefineryRecord,
  RefinerySingleScore,
  RefineryTarget,
} from "../types/refinery";

export const BASE_REFINERY_YIELD = 0.4;

function requireFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number.`);
  }
}

function compareRefineries(left: RefineryRecord, right: RefineryRecord): number {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function compareCalculations(
  left: RefineryMaterialCalculation,
  right: RefineryMaterialCalculation,
): number {
  return (
    right.refinedOutputScu - left.refinedOutputScu ||
    left.refineryName.localeCompare(right.refineryName) ||
    left.refineryId.localeCompare(right.refineryId)
  );
}

function totalRefinedOutput(calculations: RefineryMaterialCalculation[]): number {
  return calculations.reduce((total, calculation) => total + calculation.refinedOutputScu, 0);
}

export function getFinalYieldMultiplier(bonusPercent: number): number {
  requireFinite(bonusPercent, "bonusPercent");
  const multiplier = BASE_REFINERY_YIELD * (1 + bonusPercent / 100);
  if (multiplier <= 0) {
    throw new RangeError("Final refinery yield multiplier must be greater than zero.");
  }
  return multiplier;
}

export function getRefinedOutput(rawInputScu: number, bonusPercent: number): number {
  requireFinite(rawInputScu, "rawInputScu");
  if (rawInputScu < 0) {
    throw new RangeError("rawInputScu must not be negative.");
  }
  const multiplier = getFinalYieldMultiplier(bonusPercent);
  if (rawInputScu === 0) return 0;
  return rawInputScu * multiplier;
}

export function calculateMaterialAtRefinery(
  refinery: RefineryRecord,
  target: RefineryTarget,
): RefineryMaterialCalculation {
  const rawBonusPercent = refinery.materialBonuses[target.materialId];
  const hasRefineryBonus = Number.isFinite(rawBonusPercent);
  const bonusPercent = hasRefineryBonus ? rawBonusPercent : 0;
  return {
    ...target,
    refineryId: refinery.id,
    refineryName: refinery.name,
    bonusPercent,
    hasRefineryBonus,
    baseYieldScu: target.rawInputScu * BASE_REFINERY_YIELD,
    refinedOutputScu: getRefinedOutput(target.rawInputScu, bonusPercent),
  };
}

export function optimizePerMaterial(
  refineries: RefineryRecord[],
  targets: RefineryTarget[],
): RefineryOptimizationResult | null {
  if (refineries.length === 0) return null;
  const calculations = targets.map((target) =>
    refineries
      .map((refinery) => calculateMaterialAtRefinery(refinery, target))
      .sort(compareCalculations)[0],
  );
  return {
    calculations,
    totalRefinedOutputScu: totalRefinedOutput(calculations),
  };
}

export function scoreSingleRefinery(
  refinery: RefineryRecord,
  targets: RefineryTarget[],
): RefinerySingleScore {
  const calculations = targets.map((target) => calculateMaterialAtRefinery(refinery, target));
  return {
    refineryId: refinery.id,
    refineryName: refinery.name,
    calculations,
    totalRefinedOutputScu: totalRefinedOutput(calculations),
  };
}

export function findBestSingleRefinery(
  refineries: RefineryRecord[],
  targets: RefineryTarget[],
): RefinerySingleScore | null {
  if (refineries.length === 0) return null;
  const refineryById = new Map(refineries.map((refinery) => [refinery.id, refinery]));
  return refineries
    .map((refinery) => scoreSingleRefinery(refinery, targets))
    .sort((left, right) => {
      const leftRefinery = refineryById.get(left.refineryId);
      const rightRefinery = refineryById.get(right.refineryId);
      if (!leftRefinery || !rightRefinery) return 0;
      return right.totalRefinedOutputScu - left.totalRefinedOutputScu || compareRefineries(leftRefinery, rightRefinery);
    })[0];
}

export function optimizeSelectedRoute(
  refineries: RefineryRecord[],
  selectedRefineryIds: string[],
  targets: RefineryTarget[],
): RefineryOptimizationResult | null {
  const selectedIds = new Set(selectedRefineryIds);
  return optimizePerMaterial(
    refineries.filter((refinery) => selectedIds.has(refinery.id)),
    targets,
  );
}
