import type { PublicLocationEntry } from "../../../features/mining/types";
import {
  formatStaticEncounterSignal,
  formatStaticMethodFit,
  formatStaticQualityChanceFromChances,
  getStaticDensityScore,
  getStaticLocationDisplayName,
  getStaticMaterialQualityRow,
  getStaticMaterialKey,
  getStaticResourcesForLocation,
  sourceStrengthFromWeight,
  type StaticMiningIndex,
} from "../../../features/mining/staticMiningIndex";
import { canonicalMiningMaterial, canonicalMiningMaterialKey } from "../../../features/mining/materialIdentity";
import type { RequiredMaterial } from "../../../features/mining/types";
import type { QueueLedgerLine } from "../../../lib/logistics/queueLedger";
import type { MiningQueueScope, QualityDisplay, DemandRow, ResourceRow } from "./miningTypes";
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
    ?? canonicalMiningMaterialName(fallbackKey);
}

// Demand rows surface encounter strength already normalized by the recommender.
export type DemandRow = {
  name: string;
  key: string;
  miningType: string;
  coverage: string;
  targetQualityChanceLabel: string;
  densityLabel: string;
  compositionLabel: string;
  sourceStrength: string;
  sourceWeight: number | undefined;
  status: "strong" | "moderate" | "low" | "missing";
};

export type ResourceRow = {
  name: string;
  key: string;
  miningType: string;
  qualityLabel: string;
  densityLabel: string;
  compositionLabel: string;
  sourceStrength: string;
  sourceWeight: number | undefined;
  sourceTitle?: string;
  status: "strong" | "moderate" | "low" | "none";
};

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
  return hasBuildQueueTarget ? "Target Quality Chance" : "800+ Quality Chance";
}

export function qualityChanceTooltip(hasBuildQueueTarget: boolean): string {
  return hasBuildQueueTarget
    ? "Chance that an encountered source meets the selected build queue quality requirement. This is not the chance to find the material."
    : "Chance that an encountered source meets the default high-quality threshold. This is not the chance to find the material.";
}

export function queueScopeMatches(line: QueueLedgerLine, scope: MiningQueueScope): boolean {
  switch (scope) {
    case "critical-missing":
      return line.totalAvailableEquivalent <= 0;
    case "refinable-only":
      return line.isRefinable && line.rawOreNeeded > 0;
    case "partial-stock":
      return line.totalAvailableEquivalent > 0 && line.netMissingRefined > 0;
    case "all-shortfalls":
    default:
      return true;
  }
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
    const sw = densityScore ?? (covered ? routeScoreEntry?.signals.sourceWeight : undefined);
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
      densityLabel: covered ? formatEncounterTier(sw) : "Missing",
      compositionLabel: covered && staticRow ? formatCompositionYield(staticRow.compositionAveragePercentage) : "Unknown",
      sourceStrength: signal,
      sourceWeight: sw,
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
      const sourceWeight = densityScore ?? undefined;
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
      return {
        name: row.materialName || canonical.label || "Unknown Material",
        key: key || `${row.systemKey}:${row.locationKey}:${row.materialId || row.materialName}`,
        miningType: displayMiningMethodLabel(row.resolvedMineableClass),
        qualityLabel: formatStaticQualityChanceFromChances(pickWeightedQualityChances(qualityRow, row)),
        densityLabel: formatEncounterTier(sourceWeight),
        compositionLabel: formatCompositionYield(row.compositionAveragePercentage),
        sourceStrength: encounterSignalFromWeight(sourceWeight),
        sourceWeight,
        sourceTitle: `Encounter tier uses indexed density ${formatStaticEncounterSignal(row)}. Method mix share for ${displayMiningMethodLabel(row.resolvedMineableClass)} is ${formatStaticMethodFit(row)}. Sources: ${row.sourceCount}. ${qualityDetails}. ${compositionDetails}`,
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
      densityLabel: sw === undefined ? "Not indexed" : formatEncounterTier(sw),
      compositionLabel: "Unknown",
      sourceStrength: st === "strong" ? "STRONG" : st === "moderate" ? "MODERATE" : st === "low" ? "LOW" : "-",
      sourceWeight: sw,
      status: st,
    };
  });
}

