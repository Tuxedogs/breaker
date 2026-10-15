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
