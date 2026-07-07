export type ThresholdInputs = {
  shieldHp: number;
  armorHp: number;
  hullHp?: number | null;
};

export type ThresholdBreakdown = {
  shieldPool: number;
  armorPool: number;
  totalBeforeHull: number;
  hullPool: number;
  totalSurvivability: number;
  armorThresholdShare: number | null;
};

export function computeThresholdBreakdown(input: ThresholdInputs): ThresholdBreakdown {
  const shieldPool = Math.max(0, input.shieldHp);
  const armorPool = Math.max(0, input.armorHp);
  const hullPool = Math.max(0, input.hullHp ?? 0);
  const totalBeforeHull = shieldPool + armorPool;
  const totalSurvivability = totalBeforeHull + hullPool;
  const armorThresholdShare = totalBeforeHull > 0 ? (armorPool / totalBeforeHull) * 100 : null;

  return {
    shieldPool,
    armorPool,
    totalBeforeHull,
    hullPool,
    totalSurvivability,
    armorThresholdShare,
  };
}

export function sliderMaxForHp(base: number | null, fallback = 10000, ceiling = 100000): number {
  if (base != null && base > 0) return Math.min(Math.ceil(base * 2), ceiling);
  return Math.min(fallback, ceiling);
}

/** Stable slider ceiling from fitted stats — never derived from the live slider value. */
export function thresholdSliderMax(
  ...bases: Array<number | null | undefined>
): number {
  const fallback = 15000;
  const ceiling = 100000;
  const base = bases.find((value) => typeof value === "number" && Number.isFinite(value) && value > 0) ?? null;
  return sliderMaxForHp(base, fallback, ceiling);
}

export function clampThresholdSliderValue(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(value)));
}

export function thresholdSliderStep(max: number): number {
  if (max <= 1000) return 10;
  if (max <= 10000) return 50;
  if (max <= 50000) return 100;
  return 250;
}
