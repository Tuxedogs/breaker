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
    left.rawRequired - right.rawRequired ||
    left.refineryName.localeCompare(right.refineryName) ||
    left.refineryId.localeCompare(right.refineryId)
  );
}

function totalRawRequired(calculations: RefineryMaterialCalculation[]): number {
  return calculations.reduce((total, calculation) => total + calculation.rawRequired, 0);
}

export function getFinalYieldMultiplier(bonusPercent: number): number {
  requireFinite(bonusPercent, "bonusPercent");
  const multiplier = BASE_REFINERY_YIELD * (1 + bonusPercent / 100);
  if (multiplier <= 0) {
    throw new RangeError("Final refinery yield multiplier must be greater than zero.");
  }
  return multiplier;
}

export function getRawRequired(desiredRefinedAmount: number, bonusPercent: number): number {
  requireFinite(desiredRefinedAmount, "desiredRefinedAmount");
  if (desiredRefinedAmount < 0) {
    throw new RangeError("desiredRefinedAmount must not be negative.");
  }
  const multiplier = getFinalYieldMultiplier(bonusPercent);
  if (desiredRefinedAmount === 0) return 0;
  return desiredRefinedAmount / multiplier;
}

export function calculateMaterialAtRefinery(
  refinery: RefineryRecord,
  target: RefineryTarget,
): RefineryMaterialCalculation {
  const bonusPercent = refinery.materialBonuses[target.materialId];
  requireFinite(bonusPercent, `Bonus for ${target.materialId} at ${refinery.name}`);
  return {
    ...target,
    refineryId: refinery.id,
    refineryName: refinery.name,
    bonusPercent,
    finalYieldMultiplier: getFinalYieldMultiplier(bonusPercent),
    rawRequired: getRawRequired(target.desiredRefinedAmount, bonusPercent),
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
    totalRawRequired: totalRawRequired(calculations),
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
    totalRawRequired: totalRawRequired(calculations),
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
      return left.totalRawRequired - right.totalRawRequired || compareRefineries(leftRefinery, rightRefinery);
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
