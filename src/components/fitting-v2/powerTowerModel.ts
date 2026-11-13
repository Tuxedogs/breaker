export type PowerTowerRegion = {
  allocation: number;
  units: number;
  kind: "minimum" | "pip";
  assigned: boolean;
  disabled: boolean;
};

export function buildPowerTowerRegions(
  maxPips: number,
  minPips: number,
  allocation: number,
  exactPips: readonly number[] = [],
): PowerTowerRegion[] {
  const maximum = Math.max(0, Math.floor(maxPips));
  const minimum = Math.min(maximum, Math.max(0, Math.floor(minPips)));
  const current = Math.min(maximum, Math.max(0, Math.floor(allocation)));
  const exact = new Set(exactPips.filter((value) => Number.isInteger(value) && value >= 0));
  const hasExactCurve = exact.size > 0;
  const regions: PowerTowerRegion[] = [];

  if (minimum > 0) {
    regions.push({
      allocation: minimum,
      units: minimum,
      kind: "minimum",
      assigned: current >= minimum,
      disabled: hasExactCurve && !exact.has(minimum),
    });
  }

  for (let target = minimum + 1; target <= maximum; target += 1) {
    regions.push({
      allocation: target,
      units: 1,
      kind: "pip",
      assigned: current >= target,
      disabled: hasExactCurve && !exact.has(target),
    });
  }

  return regions;
}
