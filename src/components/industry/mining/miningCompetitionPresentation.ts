import { formatMiningProbability } from "./miningFormatters";
import {
  buildMiningSelectedSpawnCompetitionPools,
  type MiningSpawnCompetitionMember,
  type MiningSelectedSpawnCompetitionPool,
} from "../../../features/mining/miningPresentationModels";
import type { StaticLocationMaterialRow } from "../../../features/mining/staticMiningIndex";
import { resolveMaterialPresentation } from "../../../lib/materialPresentation";

export function formatMiningCompetitionPercentagePoints(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "Unavailable"
    : `${Number(value.toFixed(value >= 1 ? 2 : 3)).toString()}%`;
}

export function formatMiningCompetitionDecimalProbability(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "Unavailable"
    : formatMiningProbability(value);
}

export function miningCompetitionProbabilitySummary(member: MiningSpawnCompetitionMember): string {
  return [
    `Pool share: ${formatMiningCompetitionPercentagePoints(member.relativeProbability)}`,
    `Group probability: ${formatMiningCompetitionPercentagePoints(member.groupProbability)}`,
    `Material probability: ${formatMiningCompetitionDecimalProbability(member.materialProbability)}`,
    `Source probability: ${formatMiningCompetitionDecimalProbability(member.sourceProbability)}`,
  ].join(". ");
}

export type MiningCompetitionPoolCoverage = {
  knownShare: number;
  unrepresentedShare: number | null;
  hasUnavailableShare: boolean;
};

/**
 * Relative probabilities are delivered as percentage points of a 100% source
 * pool. Some location records publish only a subset of that pool. Keep the
 * remainder visibly unassigned instead of stretching known members to fill it.
 */
export function miningCompetitionPoolCoverage(
  members: readonly MiningSpawnCompetitionMember[],
): MiningCompetitionPoolCoverage {
  const knownShares = members
    .map((member) => member.relativeProbability)
    .filter((share): share is number => typeof share === "number" && Number.isFinite(share) && share >= 0);
  const knownShare = knownShares.reduce((total, share) => total + share, 0);
  const hasUnavailableShare = knownShares.length !== members.length;
  return {
    knownShare,
    unrepresentedShare: hasUnavailableShare || knownShare >= 100 ? null : 100 - knownShare,
    hasUnavailableShare,
  };
}

/**
 * Direct-spawn competition is only renderable when the location-specific
 * source index has loaded. The underlying pool builder is the canonical
 * source-membership check: materials absent from those records never produce
 * a synthetic competition target. Loading/error state remains visible through
 * the location reference status, rather than being misrepresented as absence.
 */
export function buildMiningLocationCompetitionPools({
  selectedMaterialKeys,
  staticResourceRows,
  staticIndexStatus,
}: {
  selectedMaterialKeys: Iterable<string>;
  staticResourceRows: StaticLocationMaterialRow[];
  staticIndexStatus: "loading" | "loaded" | "error";
}): MiningSelectedSpawnCompetitionPool[] {
  return staticIndexStatus === "loaded"
    ? buildMiningSelectedSpawnCompetitionPools(staticResourceRows, selectedMaterialKeys)
    : [];
}

export function miningCompetitionSourceLabel(sourceGroup: string): string {
  const normalized = sourceGroup.trim().toLowerCase();
  if (normalized.includes("spaceship")) return "Surface-ship spawn pool";
  if (normalized.includes("ground") || normalized.includes("vehicle")) return "Vehicle-mining spawn pool";
  if (normalized.includes("fps") || normalized.includes("hand")) return "Hand-mining spawn pool";
  return sourceGroup.replace(/[_-]+/g, " ");
}

export function miningCompetitionMaterialColor(materialIdentity: string): string {
  return resolveMaterialPresentation(materialIdentity).color;
}

export type MiningOccurrenceBand = "none" | "very-low" | "low" | "average" | "high" | "very-high";

export type MiningOccurrenceRating = {
  /** null when the pool cannot be rated fairly (partial or unavailable shares). */
  band: MiningOccurrenceBand | null;
  label: string;
  /** Pool share ÷ fair share (1 ÷ member count); null when unrated. */
  ratio: number | null;
  memberCount: number;
  /** Delivered pool share in percentage points. */
  share: number | null;
  reason: "rated" | "sole-member" | "partial-pool" | "unavailable";
};

const OCCURRENCE_BAND_LABEL: Record<MiningOccurrenceBand, string> = {
  none: "None",
  "very-low": "Very low",
  low: "Low",
  average: "Average",
  high: "High",
  "very-high": "Very high",
};

/** Ratio cut-offs against an even split of the pool. Lower bound inclusive. */
export const MINING_OCCURRENCE_RATIO_BANDS: ReadonlyArray<{ band: MiningOccurrenceBand; min: number }> = [
  { band: "very-high", min: 2 },
  { band: "high", min: 1.2 },
  { band: "average", min: 0.8 },
  { band: "low", min: 0.35 },
  { band: "very-low", min: 0 },
];

/** A pool is only rated when its published shares account for the whole pool. */
const POOL_COMPLETE_TOLERANCE = 0.5;

export function miningOccurrenceBandLabel(band: MiningOccurrenceBand): string {
  return OCCURRENCE_BAND_LABEL[band];
}

/**
 * Fair-share occurrence: compares one material's delivered pool share with an
 * even split across every member of the same source pool. Pools whose
 * published members do not account for the full 100% are not rated, because
 * the member count (and so the fair share) is unknown.
 */
export function rateMiningPoolShare(
  share: number | null | undefined,
  members: readonly MiningSpawnCompetitionMember[],
): MiningOccurrenceRating {
  const memberCount = members.length;
  const known = typeof share === "number" && Number.isFinite(share) && share >= 0 ? share : null;
  const unrated = (reason: MiningOccurrenceRating["reason"], label: string): MiningOccurrenceRating =>
    ({ band: null, label, ratio: null, memberCount, share: known, reason });
  if (known === null || memberCount === 0) return unrated("unavailable", "Unknown");
  const coverage = miningCompetitionPoolCoverage(members);
  if (coverage.hasUnavailableShare) return unrated("unavailable", "Unknown");
  if ((coverage.unrepresentedShare ?? 0) > POOL_COMPLETE_TOLERANCE) return unrated("partial-pool", "Not rated");
  if (known === 0) return { band: "none", label: OCCURRENCE_BAND_LABEL.none, ratio: 0, memberCount, share: known, reason: "rated" };
  if (memberCount === 1) return { band: "very-high", label: OCCURRENCE_BAND_LABEL["very-high"], ratio: 1, memberCount, share: known, reason: "sole-member" };
  const ratio = known / (100 / memberCount);
  const band = MINING_OCCURRENCE_RATIO_BANDS.find((item) => ratio >= item.min)?.band ?? "very-low";
  return { band, label: OCCURRENCE_BAND_LABEL[band], ratio, memberCount, share: known, reason: "rated" };
}

function normalizeIdentity(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function poolMemberKey(sourceGroup: string, materialKey: string): string {
  return `${normalizeIdentity(sourceGroup)}::${normalizeIdentity(materialKey)}`;
}

/** Ratings for every published pool member at one location, keyed by pool and material. */
export function buildMiningLocationOccurrenceRatings(
  staticResourceRows: StaticLocationMaterialRow[],
): Map<string, MiningOccurrenceRating> {
  const identities = staticResourceRows.flatMap((row) => (row.sources ?? []).map((source) =>
    source.materialKey ?? source.materialId ?? source.materialName ?? row.materialId ?? row.materialName));
  const ratings = new Map<string, MiningOccurrenceRating>();
  for (const pool of buildMiningSelectedSpawnCompetitionPools(staticResourceRows, identities)) {
    for (const member of pool.members) {
      ratings.set(poolMemberKey(pool.sourceGroup, member.materialKey), rateMiningPoolShare(member.relativeProbability, pool.members));
    }
  }
  return ratings;
}

const RATING_PRIORITY: Record<MiningOccurrenceRating["reason"], number> = { "sole-member": 3, rated: 3, "partial-pool": 1, unavailable: 0 };

/**
 * The rating for one location material row. A material that appears in more
 * than one source pool takes its strongest rated pool; rated pools always win
 * over unrated ones.
 */
export function miningOccurrenceRatingForRow(
  row: StaticLocationMaterialRow | undefined,
  ratings: ReadonlyMap<string, MiningOccurrenceRating>,
): MiningOccurrenceRating | undefined {
  let best: MiningOccurrenceRating | undefined;
  for (const source of row?.sources ?? []) {
    if (!source.groupName) continue;
    const identity = source.materialKey?.trim() || (source.materialKey ?? source.materialId ?? source.materialName ?? row?.materialId ?? row?.materialName);
    const rating = ratings.get(poolMemberKey(source.groupName, identity ?? ""));
    if (!rating) continue;
    if (!best
      || RATING_PRIORITY[rating.reason] > RATING_PRIORITY[best.reason]
      || (RATING_PRIORITY[rating.reason] === RATING_PRIORITY[best.reason] && (rating.ratio ?? -1) > (best.ratio ?? -1))) best = rating;
  }
  return best;
}
