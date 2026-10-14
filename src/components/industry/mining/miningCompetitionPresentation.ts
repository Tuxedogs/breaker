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
