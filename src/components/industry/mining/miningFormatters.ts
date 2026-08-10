import type { PublicLocationEntry } from "../../../features/mining/types";
import {
  formatStaticMethodFit,
  formatStaticQualityChanceFromChances,
  formatStaticQualityChanceDecimalBelow1,
  getStaticDensityScore,
  getStaticEncounterRankingRow,
  getStaticMaterialQualityRow,
  getStaticMaterialKey,
  getStaticResourcesForLocation,
  sourceStrengthFromWeight,
  type StaticMiningIndex,
} from "../../../features/mining/staticMiningIndex";
import { canonicalMiningMaterial, canonicalMiningMaterialKey } from "../../../features/mining/materialIdentity";
import type { RequiredMaterial } from "../../../features/mining/types";
import type { MaterialOccurrenceDisplay, MiningQueueScope, QualityDisplay, DemandRow, ResourceRow } from "./miningTypes";
import { findRouteScoreForMaterial } from "./miningScoring";

export function spawnTypeLabel(spawnType: string): string {
  const s = spawnType.toLowerCase();
  if (s.includes("asteroid")) return "Asteroid";
  if (s.includes("ground")) return "Ground Vehicle";
  if (s.includes("ship") || s === "mineable") return "Ship";
  if (s.includes("surface")) return "Surface";
  if (s.includes("hand") || s.includes("fps")) return "Hand";
  if (s.includes("mixed")) return "Mixed";
  return spawnType.replace(/_/g, " ");
}

export function spawnTypeBadgeClass(spawnType: string): string {
  const s = spawnType.toLowerCase();
  if (s.includes("asteroid")) return "mloc-badge--asteroid";
  if (s.includes("ground")) return "mloc-badge--surface";
  if (s.includes("ship") || s === "mineable") return "mloc-badge--ship";
  if (s.includes("surface")) return "mloc-badge--surface";
  if (s.includes("hand") || s.includes("fps")) return "mloc-badge--hand";
  return "mloc-badge--mixed";
}

export function miningMethodBadge(value: string | null | undefined): { label: string; className: string } | null {
  switch (displayMiningMethodLabel(value)) {
    case "Asteroid":
    case "Ship":
    case "Surface Ship":
      return { label: "Ship", className: "mloc-badge--ship" };
    case "Vehicle":
    case "Surface Vehicle":
      return { label: "Vehicle", className: "mloc-badge--vehicle" };
    case "Hand":
      return { label: "Hand", className: "mloc-badge--hand" };
    default:
      return null;
  }
}

export function systemBadgeClass(systemName: string): string {
  const s = systemName.trim().toLowerCase();
  if (s === "stanton") return "mloc-system-badge--stanton";
  if (s === "nyx") return "mloc-system-badge--nyx";
  if (s === "pyro") return "mloc-system-badge--pyro";
  return "mloc-system-badge--neutral";
}

export function miningTypeFromSpawn(spawnType: string): string {
  const s = spawnType.toLowerCase();
  if (s.includes("ground")) return "Ground Vehicle";
  if (s.includes("ship") || s === "mineable") return "Ship";
  if (s.includes("surface")) return "Surface";
  if (s.includes("hand") || s.includes("fps")) return "Hand";
  return "Mixed";
}

export function materialKeyOf(material: Pick<RequiredMaterial, "materialKey" | "materialId">): string {
  return canonicalMiningMaterial({ materialKey: material.materialKey, materialId: material.materialId }).key;
}

export function getLocationCardKey(entry: PublicLocationEntry): string {
  return [
    entry.locationKey,
    (entry as { locationId?: string }).locationId,
    (entry as { sourceLocationId?: string }).sourceLocationId,
    (entry as { systemLocationId?: string }).systemLocationId,
    entry.systemName,
    entry.locationName,
    entry.spawnType,
  ].filter(Boolean).join(":");
}

export function targetabilityLabel(score: number): NonNullable<PublicLocationEntry["routeTargetabilityLabel"]> {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Strong";
  if (score >= 40) return "Good";
  if (score >= 20) return "Weak";
  return "Poor";
}

export function scoreToneClass(label?: string, score?: number | null): string {
  const normalized = label?.toLowerCase();
  if (normalized === "excellent" || normalized === "strong") return "mloc-score--best";
  if (normalized === "good") return "mloc-score--good";
  if (normalized === "weak") return "mloc-score--okay";
  if (normalized === "poor") return "mloc-score--poor";
  if (score === undefined || score === null) return "";
  if (score >= 80) return "mloc-score--best";
  if (score >= 60) return "mloc-score--good";
  if (score >= 35) return "mloc-score--okay";
  return "mloc-score--poor";
}

export function isQuantaniumKey(key: string): boolean {
  const k = canonicalMiningMaterialKey(key);
  return k === "quantanium" || k === "quantainium";
}

export function buildQualityDisplay(
  signals: { qualityChance?: number | null; qualityIgnored?: boolean; thresholdChance?: number | null; selectedQuality?: number } | undefined,
  materialKey: string,
): QualityDisplay {
  if (!signals) return { kind: "none" };
  if (isQuantaniumKey(materialKey) || signals.qualityIgnored) return { kind: "ignored" };
  const chance = signals.qualityChance ?? signals.thresholdChance;
  if (chance === null || chance === undefined) return { kind: "none" };
  const pct = Math.round(chance * 100);
  const threshold = signals.selectedQuality;
  const prefix = threshold != null ? `${threshold}+: ` : "";
  return { kind: "chance", label: `${prefix}${pct}%` };
}

export function formatThresholdChance(chances: Record<string, number> | null | undefined, threshold = 800, includeThreshold = false): string {
  const chance = chances?.[String(threshold)];
  if (typeof chance !== "number" || !Number.isFinite(chance)) return "Unknown";
  const label = `${Math.round(chance * 100)}%`;
  return includeThreshold ? `${threshold}+: ${label}` : label;
}

export function pickWeightedQualityChances(
  qualityRow: ReturnType<typeof getStaticMaterialQualityRow>,
  staticRow: { qualityThresholdChancesWeighted?: Record<string, number> } | null | undefined,
): Record<string, number> | undefined {
  return qualityRow?.qualityThresholdChancesWeighted
    ?? qualityRow?.thresholdChances
    ?? staticRow?.qualityThresholdChancesWeighted;
}

export function encounterSignalFromWeight(sourceWeight: number | null | undefined): "High" | "Medium" | "Low" | "Unknown" {
  if (sourceWeight === null || sourceWeight === undefined || !Number.isFinite(sourceWeight)) return "Unknown";
  if (sourceWeight >= 67) return "High";
  if (sourceWeight >= 35) return "Medium";
  return "Low";
}

export function encounterStatusFromSignal(signal: string): "strong" | "moderate" | "low" | "none" {
  if (signal === "High") return "strong";
  if (signal === "Medium") return "moderate";
  if (signal === "Low") return "low";
  return "none";
}

export function displayMiningMethodLabel(value: string | null | undefined): string {
  switch (value) {
    case "Orbitborne":
    case "Space":
    case "Asteroid":
    case "Space / Asteroid":
      return "Asteroid";
    case "Ship":
      return "Ship";
    case "Geoborne":
    case "Ground Vehicle":
    case "Vehicle":
      return "Vehicle";
    case "Handborne":
    case "Hand":
      return "Hand";
    case "Shipborne":
    case "Surface":
    case "Surface Ship":
      return "Surface Ship";
    case "Surface Vehicle":
      return "Surface Vehicle";
    default:
      return "Unknown";
  }
}

export function demandMaterialLabel(material: RequiredMaterial | undefined, fallbackKey: string): string {
  return material?.displayName
    ?? material?.materialName
    ?? fallbackKey;
}

export function resourceRowMaterialKey(row: Pick<ResourceRow, "key" | "name">): string {
  return canonicalMiningMaterial({
    materialKey: row.key.includes(":") ? undefined : row.key,
    materialId: row.key.includes(":") ? undefined : row.key,
    materialName: row.name,
    displayName: row.name,
  }).key;
}


export function sourceStatus(sourceWeight: number | undefined): "strong" | "moderate" | "low" | "none" {
  if (sourceWeight === undefined) return "none";
  if (sourceWeight >= 60) return "strong";
  if (sourceWeight >= 30) return "moderate";
  return "low";
}

export function qualityChanceHeader(hasBuildQueueTarget: boolean): string {
  return hasBuildQueueTarget ? "Target Quality Chance" : "800+";
}

export function qualityChanceTooltip(hasBuildQueueTarget: boolean): string {
  return hasBuildQueueTarget
    ? "Chance that an encountered source meets 800+ quality. This is not the chance to find the material."
    : "Chance that an encountered source meets 800+ quality. This is not the chance to find the material.";
}

export function queueScopeDescription(scope: MiningQueueScope, count: number, total: number): string {
  const prefix = `${count} / ${total}`;
  switch (scope) {
    case "critical-missing":
      return `${prefix} shortfall materials have no usable stock.`;
    case "refinable-only":
      return `${prefix} shortfall materials can be mined as raw ore.`;
    case "partial-stock":
      return `${prefix} shortfall materials already have partial coverage.`;
    case "all-shortfalls":
    default:
      return `${prefix} active shortfall materials are in scope.`;
  }
}

export function buildQueueFocusLabel(item: { itemName?: string; recipeId: string; quantity: number }): string {
  const name = item.itemName?.trim() || item.recipeId;
  return item.quantity > 1 ? `${name} x${item.quantity}` : name;
}

export function formatPercent(value: number): string {
  return `${Number((value * 100).toFixed(1)).toString()}%`;
}

const SPECIFIC_LOCATION_MATERIAL_KEYS = new Set(["carinite-pure", "saldynium", "jaclium", "sadaryx"]);

export function usesSpecificLocationOccurrence(materialKey: string): boolean {
  return SPECIFIC_LOCATION_MATERIAL_KEYS.has(canonicalMiningMaterialKey(materialKey));
}

export function formatMiningProbability(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Unknown";
  const pct = value * 100;
  const decimals = pct >= 10 ? 1 : pct >= 1 ? 2 : pct >= 0.1 ? 2 : pct >= 0.01 ? 3 : 4;
  return `${Number(pct.toFixed(decimals)).toString()}%`;
}

function primaryRockShare(row: Parameters<typeof getStaticEncounterRankingRow>[0]): number | null {
  if (typeof row.primaryRockShare === "number" && Number.isFinite(row.primaryRockShare)) return row.primaryRockShare;
  let weightedShare = 0;
  let totalGroupWeight = 0;
  for (const source of row.sources ?? []) {
    if (!Number.isFinite(source.groupProbability) || !Number.isFinite(source.relativeProbability)) continue;
    const groupWeight = Number(source.groupProbability) / 100;
    const materialProbability = Number.isFinite(source.materialProbability) ? Number(source.materialProbability) : 1;
    weightedShare += groupWeight * (Number(source.relativeProbability) / 100) * materialProbability;
    totalGroupWeight += groupWeight;
  }
  return totalGroupWeight > 0 ? weightedShare / totalGroupWeight : null;
}

function formatTraceMaterials(row: Parameters<typeof getStaticEncounterRankingRow>[0]): MaterialOccurrenceDisplay["traceMaterials"] {
  const details = row.traceMaterialDetails ?? row.sources?.flatMap((source) => source.traceMaterialDetails ?? []) ?? [];
  const traces = new Map<string, MaterialOccurrenceDisplay["traceMaterials"][number]>();
  for (const detail of details) {
    const name = detail.materialName?.trim();
    if (!name) continue;
    const min = detail.minPercentage;
    const max = detail.maxPercentage;
    let qualityFloor = detail.qualityFloor;
    let qualityCeiling = detail.qualityCeiling;
    if (!Number.isFinite(qualityFloor) || !Number.isFinite(qualityCeiling)) {
      const qualityRanges = (row.sources ?? []).flatMap((source) => (source.traceMaterialDetails ?? [])
        .filter((sourceDetail) => sourceDetail.materialName?.trim().toLowerCase() === name.toLowerCase())
        .map((sourceDetail) => {
          const scale = sourceDetail.qualityScale;
          return {
            floor: Number.isFinite(scale) && Number.isFinite(source.quality?.min) ? Number(scale) * Number(source.quality?.min) : null,
            ceiling: Number.isFinite(scale) && Number.isFinite(source.quality?.max) ? Number(scale) * Number(source.quality?.max) : null,
          };
        }));
      const floors = qualityRanges.map((range) => range.floor).filter((value): value is number => value !== null);
      const ceilings = qualityRanges.map((range) => range.ceiling).filter((value): value is number => value !== null);
      qualityFloor = floors.length > 0 ? Math.min(...floors) : qualityFloor;
      qualityCeiling = ceilings.length > 0 ? Math.max(...ceilings) : qualityCeiling;
    }
    traces.set(name.toLowerCase(), {
      name,
      compositionRangeLabel: Number.isFinite(min) && Number.isFinite(max)
        ? `${Number(min).toString()}–${Number(max).toString()}% composition`
        : "Composition range unknown",
      qualityRangeLabel: Number.isFinite(qualityFloor) && Number.isFinite(qualityCeiling)
        ? `Quality ${Math.round(Number(qualityFloor))}–${Math.round(Number(qualityCeiling))}`
        : "Quality range unknown",
    });
  }
  for (const name of row.traceMaterials ?? row.sources?.flatMap((source) => source.traceMaterials ?? []) ?? []) {
    const trimmed = name.trim();
    if (trimmed && !traces.has(trimmed.toLowerCase())) {
      traces.set(trimmed.toLowerCase(), {
        name: trimmed,
        compositionRangeLabel: "Composition range unknown",
        qualityRangeLabel: "Quality range unknown",
      });
    }
  }
  return [...traces.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function buildOccurrenceDisplay(
  row: Parameters<typeof getStaticEncounterRankingRow>[0],
  index: StaticMiningIndex | null,
  materialKey = getStaticMaterialKey(row),
): MaterialOccurrenceDisplay {
  const traceMaterials = formatTraceMaterials(row);
  const traceMaterialsLabel = traceMaterials.length > 0
    ? traceMaterials.map((trace) => `${trace.name} · ${trace.compositionRangeLabel} · ${trace.qualityRangeLabel}`).join(", ")
    : "None indexed";
  if (usesSpecificLocationOccurrence(materialKey)) {
    return {
      mode: "legacy",
      primaryRockShareLabel: "Not applicable",
      spawnRollProbabilityLabel: "Not applicable",
      locationRankLabel: "Location-specific",
      methodAvailabilityLabel: formatStaticMethodFit(row),
      traceMaterialsLabel,
      traceMaterials,
    };
  }
  const ranking = getStaticEncounterRankingRow(row, index);
  return {
    mode: "probability",
    primaryRockShareLabel: formatMiningProbability(primaryRockShare(row)),
    spawnRollProbabilityLabel: formatMiningProbability(row.providerWeightedSignal ?? row.sourceProbabilitySum),
    locationRankLabel: ranking ? `#${ranking.encounterRank} of ${ranking.encounterRankOutOf}` : "Not ranked",
    methodAvailabilityLabel: formatStaticMethodFit(row),
    traceMaterialsLabel,
    traceMaterials,
  };
}

function occurrenceRankWeight(row: Parameters<typeof getStaticEncounterRankingRow>[0], index: StaticMiningIndex | null): number | undefined {
  const ranking = getStaticEncounterRankingRow(row, index);
  if (!ranking?.encounterRank || !ranking.encounterRankOutOf) return undefined;
  return ((ranking.encounterRankOutOf - ranking.encounterRank + 1) / ranking.encounterRankOutOf) * 100;
}

export function formatEncounterTier(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Not indexed";
  return encounterSignalFromWeight(value);
}

export function formatCompositionYield(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Unknown";
  const pct = value > 1 ? value : value * 100;
  return `${Number(pct.toFixed(1)).toString()}%`;
}

export function methodBiasToneClass(share: number | null | undefined): string {
  if (share === null || share === undefined || !Number.isFinite(share)) return "";
  if (share >= 0.67) return "mloc-score--best";
  if (share >= 0.34) return "mloc-score--good";
  return "mloc-score--okay";
}

export function qualitySourceScopeLabel(sourceName: string | undefined, overrideApplied: boolean): string {
  const lower = sourceName?.toLowerCase() ?? "";
  if (overrideApplied && lower.includes("location")) return "Location override";
  if (overrideApplied || lower.includes("override")) return lower.includes("pyro") || lower.includes("stanton")
    ? "System-specific distribution"
    : "Material override";
  if (lower.includes("default")) return "Default distribution";
  return "Default distribution";
}

export function qualitySourceScopeDisplayLabel(scope: string): string {
  switch (scope) {
    case "default":
      return "Default distribution";
    case "system_specific":
      return "System-specific distribution";
    case "material_override":
      return "Material override";
    case "location_override":
      return "Location override";
    default:
      return qualitySourceScopeLabel(scope, scope.toLowerCase().includes("override"));
  }
}

export function qualitySourceFamilyDisplayLabel(family: string): string {
  switch (family) {
    case "fps":
      return "Hand mining";
    case "ground":
      return "Vehicle mining";
    case "ship":
      return "Ship mining";
    case "common_ship":
      return "Common ship mineable";
    case "uncommon_ship":
      return "Uncommon ship mineable";
    case "rare_ship":
      return "Rare ship mineable";
    case "epic_ship":
      return "Epic ship mineable";
    case "legendary_ship":
      return "Legendary ship mineable";
    default:
      return qualitySourceFamilyLabel(family);
  }
}

export function qualitySourceFamilyLabel(sourceName: string | undefined): string {
  const lower = sourceName?.toLowerCase() ?? "";
  if (lower.includes("fps") || lower.includes("hand")) return "Hand mining";
  if (lower.includes("ground") || lower.includes("geoborne")) return "Vehicle mining";
  if (lower.includes("commonship")) return "Common ship mineable";
  if (lower.includes("uncommonship")) return "Uncommon ship mineable";
  if (lower.includes("rareship")) return "Rare ship mineable";
  if (lower.includes("epicship")) return "Epic ship mineable";
  if (lower.includes("legendaryship")) return "Legendary ship mineable";
  if (lower.includes("ship")) return "Ship mining";
  return "Default distribution";
}

export function buildDemandRows(
  entry: PublicLocationEntry,
  buildQueueMaterialKeys: Set<string>,
  locationMaterialKeys: string[],
  demandMaterialByKey: Map<string, RequiredMaterial>,
  staticResourceRows: ReturnType<typeof getStaticResourcesForLocation>,
  staticMiningIndex: StaticMiningIndex | null,
): DemandRow[] {
  if (buildQueueMaterialKeys.size === 0) return [];
  const coveredSet = new Set(locationMaterialKeys);
  const staticRowsByKey = new Map(staticResourceRows.map((row) => [getStaticMaterialKey(row), row]));
  const rows: DemandRow[] = [];
  for (const key of buildQueueMaterialKeys) {
    const routeScoreEntry = findRouteScoreForMaterial(entry, key);
    const covered = coveredSet.has(key);
    const staticRow = staticRowsByKey.get(key);
    const qualityRow = staticRow ? getStaticMaterialQualityRow(staticRow, staticMiningIndex) : null;
    const demandMaterial = demandMaterialByKey.get(key);
    const targetThreshold = demandMaterial?.selectedQuality ?? routeScoreEntry?.selectedQuality ?? routeScoreEntry?.signals.selectedQuality ?? 800;
    const densityScore = staticRow ? getStaticDensityScore(staticRow, staticMiningIndex) ?? routeScoreEntry?.signals.encounterPct : routeScoreEntry?.signals.encounterPct;
    const occurrence = staticRow ? buildOccurrenceDisplay(staticRow, staticMiningIndex, key) : null;
    const sw = staticRow && occurrence?.mode === "probability"
      ? occurrenceRankWeight(staticRow, staticMiningIndex)
      : densityScore ?? (covered ? routeScoreEntry?.signals.sourceWeight : undefined);
    const signal = covered ? encounterSignalFromWeight(sw) : "Unknown";
    const st = covered ? encounterStatusFromSignal(signal) : "missing";
    const rowStatus = st === "none" ? "low" : st;
    rows.push({
      name: staticRow?.materialName ?? demandMaterialLabel(demandMaterial, routeScoreEntry?.displayName ?? key),
      key,
      miningType: staticRow ? displayMiningMethodLabel(staticRow.resolvedMineableClass) : routeScoreEntry?.signals.selectedMethod ?? "Not indexed",
      coverage: covered ? "Covered" : "Missing",
      targetQualityChanceLabel: covered && staticRow
        ? formatThresholdChance(pickWeightedQualityChances(qualityRow, staticRow), targetThreshold)
        : "Unknown",
      quality900Label: covered && staticRow
        ? formatStaticQualityChanceDecimalBelow1(pickWeightedQualityChances(qualityRow, staticRow), "900")
        : "Unknown",
      densityLabel: covered ? formatEncounterTier(sw) : "Missing",
      compositionLabel: covered && staticRow ? formatCompositionYield(staticRow.compositionAveragePercentage) : "Unknown",
      sourceStrength: signal,
      sourceWeight: sw,
      occurrence: occurrence ?? {
        mode: "legacy",
        primaryRockShareLabel: "Unknown",
        spawnRollProbabilityLabel: "Unknown",
        locationRankLabel: "Not ranked",
        methodAvailabilityLabel: "Unknown",
        traceMaterialsLabel: "None indexed",
        traceMaterials: [],
      },
      status: rowStatus as "strong" | "moderate" | "low" | "missing",
    });
  }
  return rows;
}

export function buildResourceRows(
  entry: PublicLocationEntry,
  staticResourceRows: ReturnType<typeof getStaticResourcesForLocation>,
  staticMiningIndex: StaticMiningIndex | null,
): ResourceRow[] {
  if (staticResourceRows.length > 0 && staticMiningIndex) {
    return staticResourceRows.map((row) => {
      const canonical = canonicalMiningMaterial({
        materialKey: row.sources?.[0]?.materialKey,
        materialId: row.materialId,
        materialName: row.materialName,
        displayName: row.materialName,
      });
      const key = getStaticMaterialKey(row);
      const qualityRow = getStaticMaterialQualityRow(row, staticMiningIndex);
      const densityScore = getStaticDensityScore(row, staticMiningIndex);
      const occurrence = buildOccurrenceDisplay(row, staticMiningIndex, key);
      const sourceWeight = occurrence.mode === "probability"
        ? occurrenceRankWeight(row, staticMiningIndex)
        : densityScore ?? undefined;
      const sourceStrength = sourceStrengthFromWeight(sourceWeight);
      const qualitySourceName = qualityRow?.qualityDistributionSourceName ?? qualityRow?.qualityDistributionSourceNames?.[0] ?? row.qualityDistributionSourceNames?.[0];
      const qualityOverrideApplied = qualityRow?.qualityOverrideApplied ?? row.qualityOverrideApplied;
      const qualityDetails = [
        `Quality: ${qualityRow?.qualitySourceScope ? qualitySourceScopeDisplayLabel(qualityRow.qualitySourceScope) : qualitySourceScopeLabel(qualitySourceName, qualityOverrideApplied)}`,
        `Family: ${qualityRow?.qualitySourceFamily ? qualitySourceFamilyDisplayLabel(qualityRow.qualitySourceFamily) : qualitySourceFamilyLabel(qualitySourceName)}`,
        qualityOverrideApplied ? "Override applied" : "No quality override",
      ].join(". ");
      const compositionDetails = typeof row.compositionAveragePercentage === "number" && Number.isFinite(row.compositionAveragePercentage)
        ? `Composition: ${Number(row.compositionAveragePercentage.toFixed(2)).toString()}%. Average material composition inside the encountered deposit/source. This is not the chance to find the material.`
        : "Composition: Unknown.";
      const status = sourceStrength === "STRONG" ? "strong"
        : sourceStrength === "MODERATE" ? "moderate"
        : sourceStrength === "LOW" ? "low"
        : "none";
      const weightedChances = pickWeightedQualityChances(qualityRow, row);
      return {
        name: row.materialName || canonical.label || "Unknown Material",
        key: key || `${row.systemKey}:${row.locationKey}:${row.materialId || row.materialName}`,
        miningType: displayMiningMethodLabel(row.resolvedMineableClass),
        qualityLabel: formatStaticQualityChanceFromChances(weightedChances),
        quality900Label: formatStaticQualityChanceDecimalBelow1(weightedChances, "900"),
        densityLabel: formatEncounterTier(sourceWeight),
        compositionLabel: formatCompositionYield(row.compositionAveragePercentage),
        sourceStrength: encounterSignalFromWeight(sourceWeight),
        sourceWeight,
        occurrence,
        sourceTitle: occurrence.mode === "probability"
          ? `Primary share: ${occurrence.primaryRockShareLabel} of primary rocks in this mining pool are ${row.materialName}. Spawn roll: ${occurrence.spawnRollProbabilityLabel} is the chance that one provider roll selects both this pool and ${row.materialName}. Rank: ${occurrence.locationRankLabel} among locations using the same mining method. These are game-data weights, not a guarantee about scanned rocks.`
          : `This material appears only at specific locations, so Moonbreaker keeps its location-specific encounter rating. Sources: ${row.sourceCount}. ${qualityDetails}. ${compositionDetails}`,
        status,
      };
    });
  }
  const indexed = entry.indexedResources ?? [];
  if (indexed.length === 0 && entry.materials.length === 0) return [];
  const items = indexed.length > 0 ? indexed : entry.materials.map((m) => ({ materialName: m, materialId: undefined, miningType: "" }));
  return items.map((r) => {
    const key = r.materialId ?? r.materialName;
    const routeScoreEntry = findRouteScoreForMaterial(entry, key) ?? findRouteScoreForMaterial(entry, r.materialName);
    const sw = routeScoreEntry?.signals.sourceWeight;
    const st = sourceStatus(sw);
    const qualityDisplay = buildQualityDisplay(routeScoreEntry?.signals, key);
    return {
      name: r.materialName,
      key,
      miningType: displayMiningMethodLabel((r as { miningType?: string }).miningType ?? ""),
      qualityLabel: qualityDisplay.kind === "ignored" ? "N/A" : qualityDisplay.kind === "chance" ? qualityDisplay.label : "Unknown",
      quality900Label: "Unknown",
      densityLabel: sw === undefined ? "Not indexed" : formatEncounterTier(sw),
      compositionLabel: "Unknown",
      sourceStrength: st === "strong" ? "STRONG" : st === "moderate" ? "MODERATE" : st === "low" ? "LOW" : "-",
      sourceWeight: sw,
      occurrence: {
        mode: "legacy",
        primaryRockShareLabel: "Unknown",
        spawnRollProbabilityLabel: "Unknown",
        locationRankLabel: "Not ranked",
        methodAvailabilityLabel: "Unknown",
        traceMaterialsLabel: "None indexed",
        traceMaterials: [],
      },
      status: st,
    };
  });
}
