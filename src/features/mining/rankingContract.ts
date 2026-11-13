export type MiningRankingMode = "quality" | "quantity" | "balanced";

/**
 * The decision-quality modes intentionally rank only two normalized evidence
 * domains: explicit threshold probability and yield opportunity.  Callers may
 * derive yield opportunity from different published indexes, but must not add
 * a third hidden weighting scheme.
 */
export function rankEvidence(
  mode: MiningRankingMode,
  qualityFit: number,
  yieldFit: number,
): number {
  const weights = mode === "quantity"
    ? { quality: 0.2, yield: 0.8 }
    : mode === "balanced"
      ? { quality: 0.5, yield: 0.5 }
      : { quality: 0.8, yield: 0.2 };
  return qualityFit * weights.quality + yieldFit * weights.yield;
}

/** Highest threshold shared by all sources that publish quality evidence. */
export function commonQualityThreshold(chanceSets: Array<Record<string, number> | undefined>): number | undefined {
  const sets = chanceSets.map((chances) => Object.entries(chances ?? {})
    .filter(([key, value]) => Number.isFinite(Number(key)) && Number.isFinite(value))
    .map(([key]) => Number(key))).filter((keys) => keys.length > 0);
  if (!sets.length) return undefined;
  return sets[0].filter((threshold) => sets.every((keys) => keys.includes(threshold)))
    .sort((a, b) => b - a)[0];
}
