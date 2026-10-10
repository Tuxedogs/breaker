import { formatMiningProbability } from "./miningFormatters";
import {
  buildMiningSpawnCompetitionPools,
  type MiningSpawnCompetitionMember,
  type MiningSpawnCompetitionPool,
} from "../../../features/mining/miningPresentationModels";
import { canonicalMiningMaterial, canonicalMiningMaterialKey } from "../../../features/mining/materialIdentity";
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

export function miningCompetitionEmptyMessage(targetResolved: boolean): string {
  return targetResolved
    ? "Source-group competition is unavailable for the selected material at this location."
    : "Select a material to inspect its direct-spawn source-group competition.";
}

export type MiningCompetitionEvidenceState =
  | "loading"
  | "reference-unavailable"
  | "not-at-location"
  | "no-direct-spawn-evidence";

export type MiningCompetitionTargetPresentation = {
  materialKey: string;
  materialName: string;
  pools: MiningSpawnCompetitionPool[];
  evidenceState: MiningCompetitionEvidenceState | null;
};

/**
 * Competition probabilities are only meaningful for one material in one
 * source group. A multi-material route must therefore keep its selected
 * materials separate instead of implying an aggregate probability.
 */
export function miningCompetitionEvidenceMessage(
  materialName: string,
  state: MiningCompetitionEvidenceState,
): string {
  switch (state) {
    case "loading":
      return `Direct-spawn competition evidence for ${materialName} is loading.`;
    case "reference-unavailable":
      return `Direct-spawn competition evidence for ${materialName} is unavailable because the location reference index could not load.`;
    case "not-at-location":
      return `${materialName} is not represented in the source-backed material records for this location.`;
    case "no-direct-spawn-evidence":
      return `No direct-spawn source-group competition evidence is published for ${materialName} at this location.`;
  }
}

export function buildMiningCompetitionTargets({
  selectedMaterialKeys,
  selectedMaterialNames,
  focusedMaterialKey,
  staticResourceRows,
  staticIndexStatus,
}: {
  selectedMaterialKeys: Iterable<string>;
  selectedMaterialNames: ReadonlyMap<string, string>;
  focusedMaterialKey?: string | null;
  staticResourceRows: StaticLocationMaterialRow[];
  staticIndexStatus: "loading" | "loaded" | "error";
}): MiningCompetitionTargetPresentation[] {
  const focusedKey = focusedMaterialKey ? canonicalMiningMaterialKey(focusedMaterialKey) : null;
  const materialKeys = new Set(
    [...selectedMaterialKeys]
      .map((key) => canonicalMiningMaterialKey(key))
      .filter(Boolean),
  );

  return [...materialKeys]
    .sort((left, right) => Number(right === focusedKey) - Number(left === focusedKey) || left.localeCompare(right))
    .map((materialKey) => {
      const matchingRows = staticResourceRows.filter((row) => {
        const rowKey = canonicalMiningMaterial({ materialId: row.materialId, materialName: row.materialName }).key;
        if (rowKey === materialKey) return true;
        return row.sources?.some((source) => canonicalMiningMaterial({
          materialKey: source.materialKey,
          materialId: source.materialId,
          materialName: source.materialName,
        }).key === materialKey) ?? false;
      });
      const materialName = matchingRows[0]?.materialName
        ?? selectedMaterialNames.get(materialKey)
        ?? resolveMaterialPresentation(materialKey).displayName;
      const pools = staticIndexStatus === "loaded"
        ? buildMiningSpawnCompetitionPools(staticResourceRows, materialKey)
        : [];
      const evidenceState = pools.length > 0
        ? null
        : staticIndexStatus === "loading"
          ? "loading"
          : staticIndexStatus === "error"
            ? "reference-unavailable"
            : matchingRows.length === 0
              ? "not-at-location"
              : "no-direct-spawn-evidence";
      return { materialKey, materialName, pools, evidenceState };
    });
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
