import { useEffect, useState } from "react";
import { formatMiningCompetitionPercentagePoints, type MiningOccurrenceRating } from "./miningCompetitionPresentation";

export type MiningDetailView = "simple" | "detailed";

const MINING_DETAIL_VIEW_STORAGE_KEY = "moonbreaker:mining-detail-view-v1";

function readStoredDetailView(): MiningDetailView {
  try {
    return localStorage.getItem(MINING_DETAIL_VIEW_STORAGE_KEY) === "detailed" ? "detailed" : "simple";
  } catch {
    return "simple";
  }
}

/** Simple is the default; the choice is a per-viewer local preference. */
export function useMiningDetailView() {
  const [view, setView] = useState<MiningDetailView>(readStoredDetailView);
  useEffect(() => {
    try { localStorage.setItem(MINING_DETAIL_VIEW_STORAGE_KEY, view); } catch { /* optional local preference */ }
  }, [view]);
  return [view, setView] as const;
}

export function miningOccurrenceRatingTitle(rating: MiningOccurrenceRating, materialName: string): string {
  if (rating.reason === "partial-pool") return `${materialName}: not rated. Only part of this spawn pool is published, so an even-split comparison is not possible.`;
  if (rating.reason === "unavailable") return `${materialName}: pool share unavailable.`;
  if (rating.reason === "sole-member") return `${materialName}: the only material in this spawn pool.`;
  return `${materialName}: ${rating.label}. ${formatMiningCompetitionPercentagePoints(rating.share)} of its spawn pool against an even split of ${(100 / rating.memberCount).toFixed(1)}% across ${rating.memberCount} materials.`;
}
