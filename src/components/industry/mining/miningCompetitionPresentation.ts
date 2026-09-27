import { formatMiningProbability } from "./miningFormatters";
import type { MiningSpawnCompetitionMember } from "../../../features/mining/miningPresentationModels";

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

export function miningCompetitionEmptyMessage(targetResolved: boolean): string {
  return targetResolved
    ? "Source-group competition is unavailable for the selected material at this location."
    : "Select exactly one material available at this location to inspect its source-group competition.";
}
