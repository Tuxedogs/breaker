import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import {
  buildRecommendationRequest,
  getMiningRecommendations,
  type RecommendationResponse,
} from "../../../features/mining/recommenderAdapter";
import { useMiningPlannerState } from "../../../features/mining/useMiningPlannerState";
import {
  loadStantonLagrangeChildrenData,
  resolveRecommenderStantonLagrangeChildren,
} from "../../../features/locations/stantonLagrangeChildren";
import type {
  PublicLocationEntry,
  RequiredMaterial,
} from "../../../features/mining/types";
import {
  canonicalMiningMaterial,
  canonicalMiningMaterialKey,
  canonicalMiningMaterialName,
} from "../../../features/mining/materialIdentity";
import {
  formatStaticEncounterSignal,
  formatStaticMethodFit,
  formatStaticQualityChanceFromChances,
  getStaticEncounterRankingRow,
  getStaticDensityScore,
  getStaticLocationAttemptedJoinKeys,
  getStaticLocationDisplayName,
  getStaticLocationMaterialKeys,
  getStaticMaterialQualityRow,
  getStaticMethodBiasForLocation,
  getStaticMaterialKey,
  getStaticResourcesForLocation,
  loadStaticMiningIndex,
  sourceStrengthFromWeight,
  type StaticMiningIndex,
} from "../../../features/mining/staticMiningIndex";
import "./mining.css";
import { useLogisticsStore } from "../../../stores/logisticsStore";
import { createMaterialResolver } from "../../../lib/logistics/materialResolver";
import { getQueueLedgerModel } from "../../../lib/logistics/queueLedger";
import { buildResourceGroups } from "../shared/msbResourceGroups";
import MaterialIcon from "../../logistics/MaterialIcon";

function readStoredSidebarState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredSidebarState<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

// Access mode

const accessMode = "public";
const showAdvancedScores = accessMode !== "public";
const debugMiningIdentity = Boolean(
  import.meta.env.DEV &&
  typeof localStorage !== "undefined" &&
  localStorage.getItem("debug:mining-materials") === "1"
);
const MINING_FILTER_STORAGE_KEY = "scintel:mining:msb-sidebar:v1";
const MINING_RANKING_MODE_STORAGE_KEY = "scintel:mining:ranking-mode:v1";

type MiningRankingMode = "quality" | "quantity" | "balanced";

const MINING_RANKING_MODES: Array<{ value: MiningRankingMode; label: string }> = [
  { value: "quality", label: "Quality" },
  { value: "quantity", label: "Quantity" },
  { value: "balanced", label: "Balanced" },
];
const MINING_SYSTEM_FILTERS = ["Stanton", "Nyx", "Pyro"];

type MiningSidebarState = {
  buildQueueActive: boolean;
  systems: string[];
  miningTypes: string[];
  resources: string[];
};

const EMPTY_MINING_SIDEBAR_STATE: MiningSidebarState = {
  buildQueueActive: false,
  systems: [],
  miningTypes: [],
  resources: [],
};

function readStoredRankingMode(): MiningRankingMode {
  try {
    const raw = localStorage.getItem(MINING_RANKING_MODE_STORAGE_KEY);
    return raw === "quantity" || raw === "balanced" || raw === "quality" ? raw : "quality";
  } catch {
    return "quality";
  }
}

// Helpers

function spawnTypeLabel(spawnType: string): string {
  const s = spawnType.toLowerCase();
  if (s.includes("ground")) return "Ground Vehicle";
  if (s.includes("ship") || s === "mineable") return "Ship";
  if (s.includes("surface")) return "Surface";
  if (s.includes("hand") || s.includes("fps")) return "Hand";
  if (s.includes("mixed")) return "Mixed";
  return spawnType.replace(/_/g, " ");
}

function spawnTypeBadgeClass(spawnType: string): string {
  const s = spawnType.toLowerCase();
  if (s.includes("ground")) return "mloc-badge--surface";
  if (s.includes("ship") || s === "mineable") return "mloc-badge--ship";
  if (s.includes("surface")) return "mloc-badge--surface";
  if (s.includes("hand") || s.includes("fps")) return "mloc-badge--hand";
  return "mloc-badge--mixed";
}

function miningTypeFromSpawn(spawnType: string): string {
  const s = spawnType.toLowerCase();
  if (s.includes("ground")) return "Ground Vehicle";
  if (s.includes("ship") || s === "mineable") return "Ship";
  if (s.includes("surface")) return "Surface";
  if (s.includes("hand") || s.includes("fps")) return "Hand";
  return "Mixed";
}

function materialKeyOf(material: Pick<RequiredMaterial, "materialKey" | "materialId">): string {
  return canonicalMiningMaterial({ materialKey: material.materialKey, materialId: material.materialId }).key;
}

function findRouteScoreForMaterial(entry: PublicLocationEntry, materialKey: string | null | undefined) {
  if (!materialKey) return null;
  const selectedKey = canonicalMiningMaterialKey(materialKey);
  return (entry.routeScores ?? []).find((score) =>
    canonicalMiningMaterialKey(score.materialKey) === selectedKey ||
    canonicalMiningMaterialKey(score.materialId) === selectedKey ||
    canonicalMiningMaterialKey(score.materialName) === selectedKey ||
    canonicalMiningMaterialKey(score.displayName) === selectedKey
  ) ?? null;
}

function getPrimaryRouteScore(entry: PublicLocationEntry, selectedMaterials: Set<string>) {
  if (selectedMaterials.size === 1) {
    return findRouteScoreForMaterial(entry, [...selectedMaterials][0]);
  }
  return entry.routeScores?.[0] ?? null;
}

function getLocationSortScore(entry: PublicLocationEntry): number {
  if (Number.isFinite(entry.routeTargetabilityScore)) return entry.routeTargetabilityScore ?? 0;
  if (Number.isFinite(entry.score)) return entry.score;
  return 0;
}

function getMatchedDemandCount(entry: PublicLocationEntry): number {
  return entry.requiredMaterials?.length ?? 0;
}

function compareLocationsByRecommendationScore(left: PublicLocationEntry, right: PublicLocationEntry): number {
  return getLocationSortScore(right) - getLocationSortScore(left) ||
    getMatchedDemandCount(right) - getMatchedDemandCount(left) ||
    left.locationName.localeCompare(right.locationName);
}

const scoringWeightsByMode: Record<MiningRankingMode, { encounter: number; quality: number; composition: number; methodFit: number }> = {
  quality: { encounter: 0.35, quality: 0.45, composition: 0.10, methodFit: 0.10 },
  quantity: { encounter: 0.55, quality: 0.10, composition: 0.25, methodFit: 0.10 },
  balanced: { encounter: 0.40, quality: 0.25, composition: 0.20, methodFit: 0.15 },
};

function clampScore(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function compositionPctFromRow(row: { compositionAveragePercentage?: number | null } | null | undefined): number {
  const value = row?.compositionAveragePercentage;
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return clampScore(value > 1 ? value : value * 100);
}

function methodFitPctFromRow(row: { methodFit?: number | null; locationClassDistributionShare?: number | null } | null | undefined): number {
  const value = row?.methodFit ?? row?.locationClassDistributionShare;
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return clampScore(value > 1 ? value : value * 100);
}

function demandWeightedLocationScore(
  entry: PublicLocationEntry,
  demandMaterials: RequiredMaterial[],
  locationMaterialKeysByLocationKey: Map<string, string[]>,
  staticMiningIndex: StaticMiningIndex | null,
  rankingMode: MiningRankingMode,
): { covered: number; score: number } {
  if (demandMaterials.length === 0) return { covered: 0, score: getLocationSortScore(entry) };
  const coveredKeys = new Set(locationMaterialKeysByLocationKey.get(entry.locationKey) ?? []);
  const staticRowsByKey = new Map(
    getStaticResourcesForLocation(entry, staticMiningIndex).map((row) => [getStaticMaterialKey(row), row])
  );
  let covered = 0;
  let weightedFit = 0;
  let coveredDemandWeight = 0;
  let totalDemandWeight = 0;
  for (const material of demandMaterials) {
    const canonical = canonicalMiningMaterial({
      materialKey: material.materialKey,
      materialId: material.materialId,
      displayName: material.displayName,
      materialName: material.materialName,
    });
    if (canonical.unresolvedUuid || !canonical.key) continue;
    const quantityWeight = Math.max(1, Number(material.requiredQuantity) || 1);
    totalDemandWeight += quantityWeight;
    if (!coveredKeys.has(canonical.key)) {
      continue;
    }
    covered += 1;
    const row = staticRowsByKey.get(canonical.key);
    const qualityRow = row ? getStaticMaterialQualityRow(row, staticMiningIndex) : null;
    const threshold = material.selectedQuality ?? 800;
    const qualityChance = qualityRow?.qualityThresholdChancesWeighted?.[String(threshold)]
      ?? qualityRow?.thresholdChances?.[String(threshold)]
      ?? row?.qualityThresholdChancesWeighted?.[String(threshold)]
      ?? 0;
    const weights = scoringWeightsByMode[rankingMode];
    const fit = (
      clampScore(row ? getStaticDensityScore(row, staticMiningIndex) : 0) * weights.encounter +
      clampScore(qualityChance * 100) * weights.quality +
      compositionPctFromRow(row) * weights.composition +
      methodFitPctFromRow(row) * weights.methodFit
    );
    weightedFit += fit * quantityWeight;
    coveredDemandWeight += quantityWeight;
  }
  const locationFit = coveredDemandWeight > 0 ? weightedFit / coveredDemandWeight : 0;
  return { covered, score: locationFit };
}

function getLocationCardKey(entry: PublicLocationEntry): string {
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

function scoreToneClass(label?: string, score?: number | null): string {
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

function MaterialNameCell({ name, miningMethod, iconSize = 16 }: { name: string; miningMethod?: string; iconSize?: number }) {
  return (
    <span className="mining-material-name-cell">
      <MaterialIcon materialName={name} miningMethod={miningMethod} size={iconSize} className="mining-material-icon" />
      <span className="mining-material-name-text">{name}</span>
    </span>
  );
}

function isIndexableMiningResource(name: string): boolean {
  const lower = name.toLowerCase();
  return ![
    "drug",
    "commodity",
    "consumable",
    "modifier",
    "damage",
    "duration",
    "crafting",
    "blueprint",
  ].some((term) => lower.includes(term));
}

function locationMatchesMaterialKey(
  location: PublicLocationEntry,
  materialKey: string,
  indexedMaterialKeysByLocationKey: Map<string, string[]>,
): boolean {
  return (indexedMaterialKeysByLocationKey.get(location.locationKey) ?? []).includes(canonicalMiningMaterialKey(materialKey));
}

function diversifyLocationsByMaterials(
  locations: PublicLocationEntry[],
  materialKeys: Set<string>,
  indexedMaterialKeysByLocationKey: Map<string, string[]>,
): PublicLocationEntry[] {
  if (materialKeys.size < 2 || locations.length < 2) return locations;

  const selected: PublicLocationEntry[] = [];
  const selectedKeys = new Set<string>();
  const keys = [...materialKeys];

  for (const materialKey of keys) {
    const nextLocation = locations.find((location) =>
      !selectedKeys.has(location.locationKey) &&
      locationMatchesMaterialKey(location, materialKey, indexedMaterialKeysByLocationKey)
    );
    if (!nextLocation) continue;
    selected.push(nextLocation);
    selectedKeys.add(nextLocation.locationKey);
  }

  for (const location of locations) {
    if (!selectedKeys.has(location.locationKey)) selected.push(location);
  }

  return selected;
}

// Load state

type LoadState =
  | { status: "loading"; data?: RecommendationResponse }
  | { status: "error"; message: string; data?: RecommendationResponse }
  | { status: "ok"; data: RecommendationResponse };

// Lagrange children summary

function StantonLagrangeChildrenSummary({
  entry,
  compact = false,
}: {
  entry: PublicLocationEntry;
  compact?: boolean;
}) {
  if (entry.systemName.toLowerCase() !== "stanton") return null;

  const resolved = resolveRecommenderStantonLagrangeChildren(
    entry.locationName,
    entry.matchedLocationCodes,
  );

  if (resolved.points.length === 0) return null;

  return (
    <div className={`mloc-lagrange-children${compact ? " mloc-lagrange-children--compact" : ""}`}>
      {resolved.points.map((point) => (
        <div key={`${entry.locationKey}:lagrange:${point.code}`} className="mloc-lagrange-point">
          <div className="mloc-lagrange-point-head">
            <span>{point.code}</span>
            <span>{point.bodyName}</span>
            <span>{point.pointKey}</span>
            {point.children.length > 0 && (
              <span className="mdet-kind">
                {point.children.length} {point.children.length === 1 ? "child" : "children"}
              </span>
            )}
          </div>
          <div className="mloc-lagrange-child-list">
            {point.children.map((child) => (
              <span key={`${entry.locationKey}:lagrange:${point.code}:${child.id}`}>
                {child.recordName}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Ranked location list item

function LocationListItem({
  rank,
  entry,
  selectedMaterials,
  activeDemandMaterials,
  buildQueueMaterialKeys,
  locationMaterialKeys,
  staticMiningIndex,
  starred,
  selected,
  onSelect,
  onToggleStar,
}: {
  rank: number;
  entry: PublicLocationEntry;
  selectedMaterials: Set<string>;
  activeDemandMaterials: RequiredMaterial[];
  buildQueueMaterialKeys: Set<string>;
  locationMaterialKeys: string[];
  staticMiningIndex: StaticMiningIndex | null;
  starred: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggleStar: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  const coveredBQ = useMemo(
    () => locationMaterialKeys.filter((key) => buildQueueMaterialKeys.has(key)),
    [locationMaterialKeys, buildQueueMaterialKeys]
  );
  const coveredSelected = useMemo(
    () => locationMaterialKeys.filter((key) => selectedMaterials.has(key)),
    [locationMaterialKeys, selectedMaterials]
  );

  const hasBuildQueueDemand = buildQueueMaterialKeys.size > 0;
  const primaryCovered = hasBuildQueueDemand ? coveredBQ : coveredSelected;
  const totalRelevant = hasBuildQueueDemand ? buildQueueMaterialKeys.size : selectedMaterials.size;
  const coveragePct = totalRelevant > 0 ? Math.round((primaryCovered.length / totalRelevant) * 100) : 0;
  const relevantMaterialKeys = hasBuildQueueDemand ? buildQueueMaterialKeys : selectedMaterials;
  const primaryRouteScore = getPrimaryRouteScore(entry, relevantMaterialKeys);
  const displayRouteScore = primaryRouteScore ?? entry.routeScores?.[0] ?? null;
  const locationDisplayName = getStaticLocationDisplayName(entry, staticMiningIndex);
  const activeDemandByKey = useMemo(() => {
    const map = new Map<string, RequiredMaterial>();
    for (const material of activeDemandMaterials) {
      const canonical = canonicalMiningMaterial({
        materialKey: material.materialKey,
        materialId: material.materialId,
        displayName: material.displayName,
        materialName: material.materialName,
      });
      if (!canonical.unresolvedUuid && canonical.key) map.set(canonical.key, material);
    }
    return map;
  }, [activeDemandMaterials]);
  const demandedStaticRows = useMemo(() => {
    if (!staticMiningIndex || relevantMaterialKeys.size === 0) return [];
    return getStaticResourcesForLocation(entry, staticMiningIndex)
      .filter((row) => relevantMaterialKeys.has(getStaticMaterialKey(row)));
  }, [entry, relevantMaterialKeys, staticMiningIndex]);
  const demandedSummary = useMemo(() => {
    if (relevantMaterialKeys.size === 0) return null;
    const staticRowsByKey = new Map(demandedStaticRows.map((row) => [getStaticMaterialKey(row), row]));
    const coveredNames = [...relevantMaterialKeys]
      .filter((key) => locationMaterialKeys.includes(key))
      .map((key) => staticRowsByKey.get(key)?.materialName ?? demandMaterialLabel(activeDemandByKey.get(key), key));
    const weights = demandedStaticRows
      .map((row) => getStaticDensityScore(row, staticMiningIndex))
      .filter((weight): weight is number => typeof weight === "number" && Number.isFinite(weight));
    const qualityValues = demandedStaticRows
      .map((row) => pickWeightedQualityChances(getStaticMaterialQualityRow(row, staticMiningIndex), row)?.["800"])
      .filter((chance): chance is number => typeof chance === "number" && Number.isFinite(chance));
    const avgWeight = weights.length > 0 ? weights.reduce((sum, value) => sum + value, 0) / weights.length : undefined;
    const avgQuality = qualityValues.length > 0 ? qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length : undefined;
    return {
      topCovered: coveredNames.slice(0, 3).join(", "),
      missingCount: Math.max(0, relevantMaterialKeys.size - primaryCovered.length),
      encounterSignal: encounterSignalFromWeight(avgWeight),
      qualityLabel: avgQuality === undefined ? "Unknown" : `${Math.round(avgQuality * 100)}%`,
    };
  }, [activeDemandByKey, demandedStaticRows, locationMaterialKeys, primaryCovered.length, relevantMaterialKeys, staticMiningIndex]);


  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  const demandBar = totalRelevant > 0 ? coveragePct : null;
  const listQualityDisplay = buildQualityDisplay(
    displayRouteScore?.signals,
    displayRouteScore?.materialKey ?? displayRouteScore?.materialId ?? "",
  );
  const yieldVal = displayRouteScore?.yieldRouteScore ?? null;

  return (
    <div
      className={`mlist-item${selected ? " mlist-item--selected" : ""}${starred ? " mlist-item--starred" : ""}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Select ${locationDisplayName} mining location`}
    >
      <div className="mlist-item-rank">{rank}</div>
      <div className="mlist-item-body">
        <div className="mlist-item-head">
          <span className="mlist-item-name" title={locationDisplayName !== entry.locationName ? `Raw key: ${entry.locationName}` : undefined}>
            {locationDisplayName}
          </span>
        </div>
        <div className="mlist-item-sub">
          <span className="mlist-item-system">{entry.systemName}</span>
          {entry.locationKind && (
            <span className="mlist-item-kind">{entry.locationKind.replace(/_/g, " ")}</span>
          )}
          <span className={`mloc-badge ${spawnTypeBadgeClass(entry.spawnType)} mlist-item-badge`}>
            {spawnTypeLabel(entry.spawnType)}
          </span>
        </div>
        <div className="mlist-item-bars">
          {demandBar !== null && (
            <div className="mlist-bar-row">
              <span className="mlist-bar-label">Coverage</span>
              <div className="mlist-bar-track">
                <div
                  className={`mlist-bar-fill${demandBar >= 100 ? " mlist-bar-fill--full" : demandBar >= 60 ? " mlist-bar-fill--good" : ""}`}
                  style={{ width: `${demandBar}%` }}
                />
              </div>
              <span className="mlist-bar-val">{primaryCovered.length} / {totalRelevant}</span>
            </div>
          )}
          {demandedSummary?.topCovered && (
            <div className="mlist-bar-row">
              <span className="mlist-bar-label">Covered</span>
              <span className="mlist-bar-val mlist-bar-val--text" title={demandedSummary.topCovered}>
                {demandedSummary.topCovered}
              </span>
            </div>
          )}
          {demandedSummary && demandedSummary.missingCount > 0 && (
            <div className="mlist-bar-row">
              <span className="mlist-bar-label">Missing</span>
              <span className="mlist-bar-val mlist-bar-val--text">{demandedSummary.missingCount}</span>
            </div>
          )}
          {demandedSummary ? (
            <div className="mlist-bar-row">
              <span className="mlist-bar-label">Quality</span>
              <span className="mlist-bar-val mlist-bar-val--text">{demandedSummary.qualityLabel}</span>
            </div>
          ) : listQualityDisplay.kind !== "none" && (
            <div className="mlist-bar-row">
              <span className="mlist-bar-label">Quality</span>
              <span className="mlist-bar-val mlist-bar-val--text">
                {listQualityDisplay.kind === "ignored" ? "N/A" : listQualityDisplay.label}
              </span>
            </div>
          )}
          {demandedSummary ? (
            <div className="mlist-bar-row">
              <span className="mlist-bar-label">Encounter</span>
              <span className="mlist-bar-val mlist-bar-val--text">{demandedSummary.encounterSignal}</span>
            </div>
          ) : yieldVal !== null && (
            <div className="mlist-bar-row">
              <span className="mlist-bar-label">Encounter</span>
              <div className="mlist-bar-track">
                <div
                  className={`mlist-bar-fill${yieldVal >= 75 ? " mlist-bar-fill--best" : yieldVal >= 55 ? " mlist-bar-fill--good" : ""}`}
                  style={{ width: `${Math.min(100, yieldVal)}%` }}
                />
              </div>
              <span className="mlist-bar-val">{yieldVal}</span>
            </div>
          )}
        </div>
      </div>
      <button
        type="button"
        className={`mloc-star-btn${starred ? " mloc-star-btn--on" : ""}`}
        onClick={onToggleStar}
        title={starred ? "Unstar" : "Star"}
        aria-label={starred ? "Unstar" : "Star"}
      >
        {starred ? "★" : "☆"}
      </button>
    </div>
  );
}

// Selected location detail panel

type QualityDisplay =
  | { kind: "ignored" }               // qualityIgnored === true -> "N/A"
  | { kind: "chance"; label: string } // "900+: 27%" or "< threshold: 0%"
  | { kind: "none" };                 // no data -> "-"

function isQuantaniumKey(key: string): boolean {
  const k = canonicalMiningMaterialKey(key);
  return k === "quantanium" || k === "quantainium";
}

function buildQualityDisplay(
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

function formatThresholdChance(chances: Record<string, number> | null | undefined, threshold = 800, includeThreshold = false): string {
  const chance = chances?.[String(threshold)];
  if (typeof chance !== "number" || !Number.isFinite(chance)) return "Unknown";
  const label = `${Math.round(chance * 100)}%`;
  return includeThreshold ? `${threshold}+: ${label}` : label;
}

function pickWeightedQualityChances(
  qualityRow: ReturnType<typeof getStaticMaterialQualityRow>,
  staticRow: { qualityThresholdChancesWeighted?: Record<string, number> } | null | undefined,
): Record<string, number> | undefined {
  return qualityRow?.qualityThresholdChancesWeighted
    ?? qualityRow?.thresholdChances
    ?? staticRow?.qualityThresholdChancesWeighted;
}

function encounterSignalFromWeight(sourceWeight: number | null | undefined): "High" | "Medium" | "Low" | "Unknown" {
  if (sourceWeight === null || sourceWeight === undefined || !Number.isFinite(sourceWeight)) return "Unknown";
  if (sourceWeight >= 67) return "High";
  if (sourceWeight >= 35) return "Medium";
  return "Low";
}

function encounterStatusFromSignal(signal: string): "strong" | "moderate" | "low" | "none" {
  if (signal === "High") return "strong";
  if (signal === "Medium") return "moderate";
  if (signal === "Low") return "low";
  return "none";
}

function displayMiningMethodLabel(value: string | null | undefined): string {
  switch (value) {
    case "Orbitborne":
    case "Space":
    case "Asteroid":
    case "Space / Asteroid":
      return "Space / Asteroid";
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

function demandMaterialLabel(material: RequiredMaterial | undefined, fallbackKey: string): string {
  return material?.displayName
    ?? material?.materialName
    ?? canonicalMiningMaterialName(fallbackKey);
}

// Demand rows surface encounter strength already normalized by the recommender.
type DemandRow = {
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

type ResourceRow = {
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

function resourceRowMaterialKey(row: Pick<ResourceRow, "key" | "name">): string {
  return canonicalMiningMaterial({
    materialKey: row.key.includes(":") ? undefined : row.key,
    materialId: row.key.includes(":") ? undefined : row.key,
    materialName: row.name,
    displayName: row.name,
  }).key;
}

function InfoTip({ text }: { text: string }) {
  return (
    <button type="button" className="mdet-infotip" title={text} aria-label={text}>?</button>
  );
}

function sourceStatus(sourceWeight: number | undefined): "strong" | "moderate" | "low" | "none" {
  if (sourceWeight === undefined) return "none";
  if (sourceWeight >= 60) return "strong";
  if (sourceWeight >= 30) return "moderate";
  return "low";
}

function qualityChanceHeader(hasBuildQueueTarget: boolean): string {
  return hasBuildQueueTarget ? "Target Quality Chance" : "800+ Quality Chance";
}

function qualityChanceTooltip(hasBuildQueueTarget: boolean): string {
  return hasBuildQueueTarget
    ? "Chance that an encountered source meets the selected build queue quality requirement. This is not the chance to find the material."
    : "Chance that an encountered source meets the default high-quality threshold. This is not the chance to find the material.";
}

function formatPercent(value: number): string {
  return `${Number((value * 100).toFixed(1)).toString()}%`;
}

function formatEncounterTier(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Not indexed";
  return encounterSignalFromWeight(value);
}

function formatCompositionYield(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Unknown";
  const pct = value > 1 ? value : value * 100;
  return `${Number(pct.toFixed(1)).toString()}%`;
}

function methodBiasToneClass(share: number | null | undefined): string {
  if (share === null || share === undefined || !Number.isFinite(share)) return "";
  if (share >= 0.67) return "mloc-score--best";
  if (share >= 0.34) return "mloc-score--good";
  return "mloc-score--okay";
}

function qualitySourceScopeLabel(sourceName: string | undefined, overrideApplied: boolean): string {
  const lower = sourceName?.toLowerCase() ?? "";
  if (overrideApplied && lower.includes("location")) return "Location override";
  if (overrideApplied || lower.includes("override")) return lower.includes("pyro") || lower.includes("stanton")
    ? "System-specific distribution"
    : "Material override";
  if (lower.includes("default")) return "Default distribution";
  return "Default distribution";
}

function qualitySourceScopeDisplayLabel(scope: string): string {
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

function qualitySourceFamilyDisplayLabel(family: string): string {
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

function qualitySourceFamilyLabel(sourceName: string | undefined): string {
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

function LocationDetail({
  entry,
  activeDemandMaterials,
  buildQueueMaterialKeys,
  locationMaterialKeys,
  staticMiningIndex,
}: {
  entry: PublicLocationEntry;
  activeDemandMaterials: RequiredMaterial[];
  buildQueueMaterialKeys: Set<string>;
  locationMaterialKeys: string[];
  staticMiningIndex: StaticMiningIndex | null;
}) {
  const coveredBQ = useMemo(
    () => locationMaterialKeys.filter((key) => buildQueueMaterialKeys.has(key)),
    [locationMaterialKeys, buildQueueMaterialKeys]
  );
  const missingBQ = useMemo(
    () => [...buildQueueMaterialKeys].filter((key) => !locationMaterialKeys.includes(key)),
    [locationMaterialKeys, buildQueueMaterialKeys]
  );

  const total = coveredBQ.length + missingBQ.length;
  const coveragePct = total > 0 ? Math.round((coveredBQ.length / total) * 100) : 0;
  const primaryRouteScore = entry.routeScores?.[0] ?? null;
  const debugJoinLogKeyRef = useRef<string | null>(null);
  const staticResourceRows = useMemo(
    () => getStaticResourcesForLocation(entry, staticMiningIndex),
    [entry, staticMiningIndex],
  );
  const demandMaterialByKey = useMemo(() => {
    const map = new Map<string, RequiredMaterial>();
    for (const material of activeDemandMaterials) {
      const canonical = canonicalMiningMaterial({
        materialKey: material.materialKey,
        materialId: material.materialId,
        displayName: material.displayName,
        materialName: material.materialName,
      });
      if (canonical.unresolvedUuid || !canonical.key) {
        if (import.meta.env.DEV) {
          console.warn("[mining] demanded material could not be normalized", {
            locationKey: entry.locationKey,
            locationDisplayName: getStaticLocationDisplayName(entry, staticMiningIndex),
            materialId: material.materialId,
            materialName: material.materialName ?? material.displayName,
            source: "MiningPage.LocationDetail activeDemandMaterials",
          });
        }
        continue;
      }
      map.set(canonical.key, material);
    }
    return map;
  }, [activeDemandMaterials, entry, staticMiningIndex]);
  const demandedStaticRowsForInsights = useMemo(
    () => staticResourceRows.filter((row) => buildQueueMaterialKeys.has(getStaticMaterialKey(row))),
    [buildQueueMaterialKeys, staticResourceRows],
  );

  // Location insights
  const insights = useMemo(() => {
    const list: Array<{ type: "positive" | "warning" | "neutral"; text: string }> = [];
    if (total > 0 && coveragePct >= 80) {
      list.push({ type: "positive", text: `High coverage for ${coveredBQ.length} of ${total} active demand materials` });
    } else if (total > 0) {
      list.push({ type: "neutral", text: `Covers ${coveredBQ.length} of ${total} active demand materials` });
    }
    const encounterWeights = demandedStaticRowsForInsights
      .map((row) => getStaticDensityScore(row, staticMiningIndex))
      .filter((weight): weight is number => typeof weight === "number" && Number.isFinite(weight));
    const averageEncounterWeight = encounterWeights.length > 0
      ? encounterWeights.reduce((sum, weight) => sum + weight, 0) / encounterWeights.length
      : undefined;
    const encounterSignal = encounterSignalFromWeight(averageEncounterWeight);
    if (encounterSignal !== "Unknown") {
      list.push({ type: averageEncounterWeight !== undefined && averageEncounterWeight >= 60 ? "positive" : "neutral", text: `${encounterSignal} average encounter tier for covered demand materials` });
    }
    if (entry.nearbyStations.length > 0) {
      list.push({ type: "positive", text: `${entry.nearbyStations.length} nearby station${entry.nearbyStations.length > 1 ? "s" : ""} for refined ore delivery` });
    }
    if (missingBQ.length > 0) {
      list.push({ type: "warning", text: `${missingBQ.length} demanded material${missingBQ.length > 1 ? "s" : ""} not covered at this location` });
    }
    return list;
  }, [total, coveragePct, coveredBQ, missingBQ, demandedStaticRowsForInsights, staticMiningIndex, entry.nearbyStations]);

  // Demand Coverage Breakdown: user-relevant materials only
  const demandRows = useMemo((): DemandRow[] => {
    const activeKeys = buildQueueMaterialKeys;
    if (activeKeys.size === 0) return [];

    const coveredSet = new Set(locationMaterialKeys);
    const staticRowsByKey = new Map(staticResourceRows.map((row) => [getStaticMaterialKey(row), row]));
    const rows: DemandRow[] = [];

    for (const key of activeKeys) {
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
      if (import.meta.env.DEV && covered && !staticRow) {
        console.warn("[mining] coverage says demanded material is covered but no detail row was found", {
          locationKey: entry.locationKey,
          locationDisplayName: getStaticLocationDisplayName(entry, staticMiningIndex),
          materialId: demandMaterial?.materialId ?? routeScoreEntry?.materialId,
          materialName: demandMaterial?.materialName ?? demandMaterial?.displayName ?? routeScoreEntry?.displayName ?? routeScoreEntry?.materialName,
          source: "MiningPage demandRows from location_material_index.json",
        });
      }
      if (import.meta.env.DEV && staticMiningIndex && covered && staticRow && !qualityRow && staticMiningIndex.qualityRows.length > 0) {
        console.warn("[mining] demanded material is using location row quality fallback while quality index data exists", {
          locationKey: entry.locationKey,
          locationDisplayName: getStaticLocationDisplayName(entry, staticMiningIndex),
          materialId: staticRow.materialId,
          materialName: staticRow.materialName,
          source: "MiningPage demandRows material_quality_index.json join",
        });
      }
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
  }, [buildQueueMaterialKeys, demandMaterialByKey, entry, locationMaterialKeys, staticMiningIndex, staticResourceRows]);

  // Planet Resource Index: all indexed resources, scored where possible
  useEffect(() => {
    if (!import.meta.env.DEV || !staticMiningIndex || staticResourceRows.length > 0) return;
    const attemptedJoinKeys = getStaticLocationAttemptedJoinKeys(entry);
    const displayLookupKey = entry.locationName.trim().toLowerCase().replace(/\s+/g, " ");
    if (!staticMiningIndex.locationKeysByDisplayName.get(displayLookupKey)?.includes(entry.locationKey)) {
      console.warn("[mining] selected location display name could not resolve to locationKey", {
        locationKey: entry.locationKey,
        locationDisplayName: entry.locationName,
        materialId: undefined,
        materialName: undefined,
        source: "MiningPage LocationDetail location_hierarchy/location_material join",
      });
    }
    console.warn("[mining] no static resources matched selected location", {
      systemName: entry.systemName,
      locationName: entry.locationName,
      locationKey: entry.locationKey,
      locationDisplayName: entry.locationName,
      materialId: undefined,
      materialName: undefined,
      attemptedJoinKeys,
      source: "MiningPage LocationDetail from location_material_index.json",
    });
    if ((entry.indexedResources?.length ?? 0) > 0 || entry.materials.length > 0) {
      console.warn("[mining] selected location has recommender data but no static index rows", {
        systemName: entry.systemName,
        locationName: entry.locationName,
        locationKey: entry.locationKey,
        indexedResources: entry.indexedResources?.length ?? 0,
        materials: entry.materials.length,
      });
    }
  }, [entry, staticMiningIndex, staticResourceRows.length]);

  useEffect(() => {
    if (!import.meta.env.DEV || !staticMiningIndex) return;
    const row = staticResourceRows[0];
    if (!row) return;
    const logKey = `${entry.locationKey}:${row.materialId}:${row.materialName}:${row.resolvedMineableClass}`;
    if (debugJoinLogKeyRef.current === logKey) return;
    debugJoinLogKeyRef.current = logKey;
    const ranking = getStaticEncounterRankingRow(row, staticMiningIndex);
    const qualityRow = getStaticMaterialQualityRow(row, staticMiningIndex);
    console.debug("[mining] selected material static index join", {
      locationKey: entry.locationKey,
      locationName: entry.locationName,
      locationDisplayName: row.locationDisplayName,
      materialName: row.materialName,
      materialId: row.materialId,
      materialKey: row.sources?.find((source) => source.materialKey)?.materialKey,
      method: row.resolvedMineableClass,
      matchedLocationMaterialRow: row,
      matchedEncounterRankingRow: ranking,
      matchedQualityRow: qualityRow,
      qualityIndexLoaded: staticMiningIndex.qualityRows.length,
      distributionIndexLoaded: staticMiningIndex.distributionRows.length,
    });
  }, [entry, staticMiningIndex, staticResourceRows]);

  const resourceRows = useMemo((): ResourceRow[] => {
    if (staticResourceRows.length > 0 && staticMiningIndex) {
      return staticResourceRows.map((row) => {
        const canonical = canonicalMiningMaterial({
          materialKey: row.sources?.[0]?.materialKey,
          materialId: row.materialId,
          materialName: row.materialName,
          displayName: row.materialName,
        });
        const key = getStaticMaterialKey(row);
        if (import.meta.env.DEV && (!key || canonical.unresolvedUuid)) {
          console.warn("[mining] static resource material key resolution failed", {
            materialId: row.materialId,
            materialName: row.materialName,
            sourceMaterialKey: row.sources?.[0]?.materialKey,
          });
        }

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
          qualityLabel: formatStaticQualityChanceFromChances(
            pickWeightedQualityChances(qualityRow, row),
          ),
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
      if (import.meta.env.DEV && staticMiningIndex?.rows.length) {
        console.warn("[mining] resource row is using fallback data while recommendation index data exists", {
          locationKey: entry.locationKey,
          locationDisplayName: getStaticLocationDisplayName(entry, staticMiningIndex),
          materialId: r.materialId,
          materialName: r.materialName,
          source: "MiningPage resourceRows fallback from recommender indexedResources/materials",
        });
      }
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
  }, [entry, staticMiningIndex, staticResourceRows]);

  const locationDisplayName = getStaticLocationDisplayName(entry, staticMiningIndex);
  const methodBiasItems = useMemo(
    () => getStaticMethodBiasForLocation(entry, staticMiningIndex),
    [entry, staticMiningIndex],
  );
  const locationMethodMixItems = useMemo(() => {
    return methodBiasItems
      .filter((item) => Number.isFinite(item.share) && item.share > 0)
      .sort((left, right) => right.share - left.share);
  }, [methodBiasItems]);
  const hasBuildQueueTarget = buildQueueMaterialKeys.size > 0;
  const hasSelectedQualityTarget = activeDemandMaterials.some((material) => material.selectedQuality !== undefined);
  const qualityHeader = qualityChanceHeader(hasSelectedQualityTarget);
  const qualityTooltip = qualityChanceTooltip(hasSelectedQualityTarget);
  const demandedMaterialKeys = useMemo(
    () => new Set(demandRows.map((row) => canonicalMiningMaterialKey(row.key))),
    [demandRows],
  );
  const otherLocationMaterialRows = useMemo(
    () => {
      const rows = hasBuildQueueTarget
        ? resourceRows.filter((row) => !demandedMaterialKeys.has(resourceRowMaterialKey(row)))
        : resourceRows;
      const byMaterial = new Map<string, ResourceRow>();
      for (const row of rows) {
        const key = resourceRowMaterialKey(row);
        const existing = byMaterial.get(key);
        if (!existing || (row.sourceWeight ?? -1) > (existing.sourceWeight ?? -1)) {
          byMaterial.set(key, row);
        }
      }
      return [...byMaterial.values()];
    },
    [demandedMaterialKeys, hasBuildQueueTarget, resourceRows],
  );
  const materialProfileTitle = hasBuildQueueTarget ? "OTHER MATERIALS AT THIS LOCATION" : "MATERIAL PROFILE";
  const coveredEncounterScores = demandRows
    .filter((row) => row.coverage !== "Missing" && typeof row.sourceWeight === "number" && Number.isFinite(row.sourceWeight))
    .map((row) => row.sourceWeight as number);
  const encounterTierScore = coveredEncounterScores.length > 0
    ? coveredEncounterScores.reduce((sum, score) => sum + score, 0) / coveredEncounterScores.length
    : primaryRouteScore?.yieldRouteScore;
  return (
    <div className="mdet-panel">
      {/* Header */}
      <div className="mdet-header">
        <div className="mdet-header-left">
          <div className="mdet-label">SELECTED LOCATION</div>
          <div className="mdet-name" title={locationDisplayName !== entry.locationName ? `Raw key: ${entry.locationName}` : undefined}>
            {locationDisplayName}
          </div>
          <div className="mdet-meta">
            <span className="mdet-system">{entry.systemName}</span>
            {entry.locationKind && (
              <span className="mdet-kind">{entry.locationKind.replace(/_/g, " ")}</span>
            )}
          </div>
        </div>
        <div className="mdet-header-right">
          <div className="mdet-thumb" aria-hidden="true">
            <div className="mdet-thumb-inner">
              <span className="mdet-thumb-name">{locationDisplayName.slice(0, 2).toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metric cards row */}
      <div className="mdet-metric-row">
        {total > 0 && (
          <div className="mdet-metric-card">
            <div className="mdet-metric-label">
              COVERAGE
              <InfoTip text="Selected material coverage is tracked separately from Fit. Missing materials do not lower Encounter Tier or covered-material Fit." />
            </div>
            <div className={`mdet-metric-val ${coveragePct === 100 ? "mloc-score--best" : coveragePct > 0 ? "mloc-score--okay" : "mloc-score--poor"}`}>
              {coveredBQ.length} / {total}
            </div>
          </div>
        )}
        {primaryRouteScore && (() => {
          const primaryMaterialKey = primaryRouteScore.materialKey ?? primaryRouteScore.materialId ?? "";
          const qd = buildQualityDisplay(primaryRouteScore.signals, primaryMaterialKey);
          return (
            <>
              {qd.kind !== "none" && (
                <div className="mdet-metric-card">
                  <div className="mdet-metric-label">
                    {qualityHeader}
                    <InfoTip text={qualityTooltip} />
                  </div>
                  <div className="mdet-metric-val">
                    {qd.kind === "ignored" ? "N/A" : qd.label}
                  </div>
                </div>
              )}
            </>
          );
        })()}
        {typeof encounterTierScore === "number" && Number.isFinite(encounterTierScore) && (
          <div className="mdet-metric-card">
            <div className="mdet-metric-label">
              ENCOUNTER TIER
              <InfoTip text="Bucketed encounter strength for covered selected materials only. Missing materials affect Coverage, not this tier." />
            </div>
            <div className={`mdet-metric-val ${scoreToneClass(undefined, encounterTierScore)}`}>
              {formatEncounterTier(encounterTierScore)}
            </div>
          </div>
        )}
        {locationMethodMixItems.map((item) => (
          <div key={`method-mix:${item.method}`} className="mdet-metric-card">
            <div className="mdet-metric-label">
              {item.method.toUpperCase()}
              <InfoTip text="Location-wide mining method mix. This does not necessarily describe the selected material." />
            </div>
            <div className={`mdet-metric-val ${methodBiasToneClass(item.share)}`} title={`Location Method Mix: ${item.method} ${formatPercent(item.share)}`}>
              {formatPercent(item.share)}
            </div>
          </div>
        ))}
      </div>

      <StantonLagrangeChildrenSummary entry={entry} />

      {/* Nearby stations */}
      {entry.nearbyStations.length > 0 && (
        <div className="mdet-stations">
          <span className="mdet-stations-label">Nearby</span>
          {entry.nearbyStations.map((s, i) => (
            <span key={`${entry.locationKey}:nearby:${s}:${i}`} className="mloc-station-chip">{s}</span>
          ))}
        </div>
      )}

      {/* Location insights */}
      {insights.length > 0 && (
        <div className="mdet-insights">
          <div className="mdet-section-label">LOCATION INSIGHTS</div>
          <div className="mdet-insights-list">
            {insights.map((insight, i) => (
              <div key={i} className={`mdet-insight mdet-insight--${insight.type}`}>
                <span className="mdet-insight-icon">
                  {insight.type === "positive" ? "+" : insight.type === "warning" ? "△" : "·"}
                </span>
                <span className="mdet-insight-text">{insight.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Demand Coverage Breakdown */}
      {demandRows.length > 0 && (
        <div className="mining-demand-breakdown">
          <div className="mdet-section-label">
            SELECTED MATERIAL COVERAGE
            <span className="mdet-section-count">({demandRows.length} material{demandRows.length !== 1 ? "s" : ""})</span>
          </div>
          <table className="mining-resource-index-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Method</th>
                <th><span className="mdet-th-wrap">Encounter Tier<InfoTip text="Bucketed encounter strength for this material at this location: Low, Medium, or High." /></span></th>
                <th><span className="mdet-th-wrap">{qualityHeader}<InfoTip text={qualityTooltip} /></span></th>
                <th><span className="mdet-th-wrap">Composition / Yield<InfoTip text="Average material composition inside an encountered source. This is not encounter chance." /></span></th>
              </tr>
            </thead>
            <tbody>
              {demandRows.map((row) => (
                <tr key={row.key} className={`mining-resource-row mining-resource-row--${row.status}`}>
                  <td className="mdet-mat-name">
                    <MaterialNameCell name={row.name} miningMethod={row.miningType} />
                  </td>
                  <td className="mdet-mat-demand">{row.coverage === "Missing" ? "Missing" : row.miningType}</td>
                  <td>
                    <span className={`mining-source-badge mining-source-badge--${row.status}`}>
                      {row.densityLabel}
                      {row.sourceWeight !== undefined && (
                        <span className="mdet-source-bar-wrap">
                          <span className="mdet-source-bar" style={{ width: `${Math.min(100, row.sourceWeight)}%` }} />
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="mdet-mat-score">
                    {row.targetQualityChanceLabel}
                  </td>
                  <td className="mdet-mat-score">{row.compositionLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Material Profile */}
      {otherLocationMaterialRows.length > 0 && (
        <div className="mining-resource-index">
          <div className="mdet-section-label">
            {materialProfileTitle}
            <InfoTip text="Materials known to appear at this location from the static mining source index." />
            <span className="mdet-section-count">({otherLocationMaterialRows.length} resource{otherLocationMaterialRows.length !== 1 ? "s" : ""})</span>
          </div>
          <table className="mining-resource-index-table">
            <thead>
              <tr>
                <th>Material</th>
                <th><span className="mdet-th-wrap">Method<InfoTip text="Mining method required for this material source." /></span></th>
                <th><span className="mdet-th-wrap">Encounter Tier<InfoTip text="Bucketed encounter strength for this material at this location: Low, Medium, or High." /></span></th>
                <th><span className="mdet-th-wrap">{qualityChanceHeader(false)}<InfoTip text={qualityChanceTooltip(false)} /></span></th>
                <th><span className="mdet-th-wrap">Composition / Yield<InfoTip text="Average material composition inside an encountered source. This is not encounter chance." /></span></th>
              </tr>
            </thead>
            <tbody>
              {otherLocationMaterialRows.map((row) => (
                <tr key={row.key} className={`mining-resource-row mining-resource-row--${row.status}`}>
                  <td className="mdet-mat-name">
                    <MaterialNameCell name={row.name} miningMethod={row.miningType} />
                  </td>
                  <td className="mdet-mat-demand">{row.miningType || "Unknown"}</td>
                  <td title={row.sourceTitle}>
                    <span className={`mining-source-badge mining-source-badge--${row.status}`}>
                      {row.densityLabel}
                      {row.sourceWeight !== undefined && (
                        <span className="mdet-source-bar-wrap">
                          <span className="mdet-source-bar" style={{ width: `${Math.min(100, row.sourceWeight)}%` }} />
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="mdet-mat-score">{row.qualityLabel}</td>
                  <td className="mdet-mat-score">{row.compositionLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Main component

export default function MiningModule() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [staticMiningIndex, setStaticMiningIndex] = useState<StaticMiningIndex | null>(null);
  const recommendationRequestSeqRef = useRef(0);
  const [, setLagrangeChildrenDataVersion] = useState(0);
  const planner = useMiningPlannerState();
  const [rankingMode, setRankingMode] = useState<MiningRankingMode>(() => readStoredRankingMode());
  const buildQueue = useLogisticsStore((store) => store.buildQueue);
  const recipeInputsByRecipeId = useLogisticsStore((store) => store.recipeInputTemplates);
  const inventoryEntries = useLogisticsStore((store) => store.inventoryEntries);
  const materials = useLogisticsStore((store) => store.materialTemplates);

  const initialSidebarState = useMemo(
    () => readStoredSidebarState(MINING_FILTER_STORAGE_KEY, EMPTY_MINING_SIDEBAR_STATE),
    [],
  );
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(() => {
    const canonical = initialSidebarState.resources
      .map((resource) => canonicalMiningMaterial({ id: resource, label: resource }))
      .filter((resource) => !resource.unresolvedUuid)
      .map((resource) => resource.key);
    return new Set(canonical);
  });
  const [selectedSystems, setSelectedSystems] = useState<Set<string>>(
    () => new Set(initialSidebarState.systems.filter((system) => MINING_SYSTEM_FILTERS.includes(system))),
  );
  const [selectedMiningTypes, setSelectedMiningTypes] = useState<Set<string>>(() => new Set(initialSidebarState.miningTypes));
  const [selectedLocationKey, setSelectedLocationKey] = useState<string | null>(null);
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [buildQueueSelectionActive, setBuildQueueSelectionActive] = useState(initialSidebarState.buildQueueActive);
  useEffect(() => {
    try {
      localStorage.setItem(MINING_RANKING_MODE_STORAGE_KEY, rankingMode);
    } catch {
      // ignore
    }
  }, [rankingMode]);

  useEffect(() => {
    let cancelled = false;
    loadStaticMiningIndex()
      .then((index) => {
        if (!cancelled) setStaticMiningIndex(index);
      })
      .catch((error) => {
        if (import.meta.env.DEV) console.warn("[mining] static index failed to load", error);
      });
    loadStantonLagrangeChildrenData()
      .then(() => {
        if (!cancelled) setLagrangeChildrenDataVersion((version) => version + 1);
      })
      .catch((error) => {
        if (debugMiningIdentity) console.warn("[mining] failed to load Stanton Lagrange children", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const queueLedger = useMemo(
    () => getQueueLedgerModel({ buildQueue, inventoryEntries, materials, recipeInputsByRecipeId }),
    [buildQueue, inventoryEntries, materials, recipeInputsByRecipeId],
  );

  const miningRequiredMaterials = useMemo<RequiredMaterial[]>(() => {
    const requirements = queueLedger.refinedShortfallLines.map((line) => {
      const miningTargetQuantity = line.isRefinable ? line.rawOreNeeded : line.netMissingRefined;
      const canonical = canonicalMiningMaterial({
        materialKey: line.materialKey,
        materialId: line.materialId,
        displayName: line.displayName,
        materialName: line.displayName,
      });
      return {
        materialKey: canonical.key,
        materialId: canonical.key,
        displayName: canonical.label,
        materialName: canonical.label,
        quantity: miningTargetQuantity,
        originalRequiredQuantity: line.grossRequired,
        requiredQuantity: miningTargetQuantity,
        estimatedRawOreNeeded: line.isRefinable ? line.rawOreNeeded : undefined,
        unitType: line.unitType,
        usedBy: [],
        slots: [],
      };
    }).filter((requirement) => requirement.requiredQuantity > 0);
    if (debugMiningIdentity) {
      console.groupCollapsed("[mining] build queue raw ore requirements");
      console.debug("queue ledger", queueLedger);
      console.debug("mining targets", requirements);
      console.groupEnd();
    }
    return requirements;
  }, [queueLedger]);
  const buildQueueMaterials = useMemo<Set<string>>(() => {
    return new Set(miningRequiredMaterials.map(materialKeyOf));
  }, [miningRequiredMaterials]);

  const buildQueueMaterialsKey = [...buildQueueMaterials].sort().join(",");
  useEffect(() => {
    if (!buildQueueSelectionActive || buildQueueMaterials.size === 0) return;
    setSelectedMaterials((prev) => new Set([...prev, ...buildQueueMaterials]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildQueueMaterialsKey, buildQueueSelectionActive]);

  useEffect(() => {
    writeStoredSidebarState<MiningSidebarState>(MINING_FILTER_STORAGE_KEY, {
      buildQueueActive: buildQueueSelectionActive,
      systems: [...selectedSystems],
      miningTypes: [...selectedMiningTypes],
      resources: [...selectedMaterials],
    });
  }, [buildQueueSelectionActive, selectedMaterials, selectedMiningTypes, selectedSystems]);

  const activeBuildQueueMaterialKeys = useMemo(
    () => buildQueueSelectionActive ? buildQueueMaterials : new Set<string>(),
    [buildQueueMaterials, buildQueueSelectionActive],
  );
  const activeBuildQueueDemandMaterials = useMemo(
    () => buildQueueSelectionActive ? miningRequiredMaterials : [],
    [buildQueueSelectionActive, miningRequiredMaterials],
  );

  const recommendationData = "data" in state ? state.data : undefined;
  const locations = useMemo(
    () => recommendationData
      ? [...recommendationData.recommendations].sort(compareLocationsByRecommendationScore)
      : [],
    [recommendationData],
  );
  const hasRecommendationData = recommendationData !== undefined;

  // Built from the materials store + BQ requirements + manual demand only.
  // Must NOT depend on `locations`; that would feed the API response back into
  // the request pipeline and create a render loop (new locations -> new request
  // payload -> new fetch -> new locations -> ...).
  const allMaterialResources = useMemo(() => {
    const byKey = new Map<string, { id: string; label: string; miningType?: string }>();

    for (const mat of materials) {
      if (!isIndexableMiningResource(mat.name)) continue;
      const sourceGroups = (mat as { sourceGroups?: string[] }).sourceGroups;
      let miningType: string | undefined;
      if (sourceGroups?.includes("vehicleMining")) miningType = "Ground Vehicle";
      else if (sourceGroups?.includes("fpsMining")) miningType = "Hand";
      else if (sourceGroups?.includes("ores")) miningType = "Ship";
      const canonical = canonicalMiningMaterial({ materialId: mat.id, displayName: mat.name, materialName: mat.name });
      if (!canonical.key || canonical.unresolvedUuid) continue;
      byKey.set(canonical.key, { id: canonical.key, label: canonical.label, miningType });
    }

    for (const req of miningRequiredMaterials) {
      const canonical = canonicalMiningMaterial({
        materialKey: req.materialKey,
        materialId: req.materialId,
        displayName: req.displayName,
        materialName: req.materialName,
      });
      if (!canonical.unresolvedUuid && !byKey.has(canonical.key) && isIndexableMiningResource(canonical.label)) {
        byKey.set(canonical.key, { id: canonical.key, label: canonical.label, miningType: undefined });
      }
    }

    for (const demand of planner.manualDemand) {
      const canonical = canonicalMiningMaterial({
        materialKey: (demand as { materialKey?: string }).materialKey,
        materialId: (demand as { materialId?: string }).materialId,
        displayName: (demand as { displayName?: string }).displayName,
        materialName: demand.materialName,
      });
      if (!canonical.unresolvedUuid && canonical.key && !byKey.has(canonical.key) && isIndexableMiningResource(canonical.label)) {
        byKey.set(canonical.key, { id: canonical.key, label: canonical.label, miningType: undefined });
      }
    }

    for (const resource of staticMiningIndex?.materialResources ?? []) {
      if (!resource.id || byKey.has(resource.id) || !isIndexableMiningResource(resource.label)) continue;
      byKey.set(resource.id, resource);
    }

    return [...byKey.values()].sort((left, right) => left.label.localeCompare(right.label));
  }, [materials, miningRequiredMaterials, planner.manualDemand, staticMiningIndex]);

  const allMaterials = useMemo(
    () => allMaterialResources.map((resource) => resource.label),
    [allMaterialResources],
  );

  const materialOptionByKey = useMemo(
    () => new Map(allMaterialResources.map((r) => [r.id, r])),
    [allMaterialResources],
  );

  const migrationDoneRef = useRef(false);
  useEffect(() => {
    if (migrationDoneRef.current || materialOptionByKey.size === 0) return;
    migrationDoneRef.current = true;
    setSelectedMaterials((prev) => {
      const cleaned = new Set(
        [...prev]
          .map((key) => canonicalMiningMaterial({ id: key, label: key }))
          .filter((material) => !material.unresolvedUuid && materialOptionByKey.has(material.key))
          .map((material) => material.key),
      );
      return cleaned.size === prev.size && [...cleaned].every((key) => prev.has(key)) ? prev : cleaned;
    });
  }, [materialOptionByKey]);

  const resourceGroups = useMemo(
    () => buildResourceGroups(allMaterialResources),
    [allMaterialResources],
  );

  const sidebarOnlyMaterials = useMemo<RequiredMaterial[]>(() => {
    const bqKeys = new Set(miningRequiredMaterials.map(materialKeyOf));
    return [...selectedMaterials]
      .filter((key) => !bqKeys.has(key))
      .map((key) => {
        const canonical = canonicalMiningMaterial({
          materialKey: key,
          displayName: materialOptionByKey.get(key)?.label,
          materialName: materialOptionByKey.get(key)?.label,
        });
        const label = canonical.label;
        return {
          materialId: canonical.key,
          materialKey: canonical.key,
          materialName: label,
          displayName: label,
          requiredQuantity: 1,
          usedBy: [],
          slots: [],
        };
      });
  }, [materialOptionByKey, miningRequiredMaterials, selectedMaterials]);

  const recommenderRequiredMaterials = useMemo(
    () => [
      ...(buildQueueSelectionActive ? miningRequiredMaterials : []),
      ...sidebarOnlyMaterials,
    ],
    [buildQueueSelectionActive, miningRequiredMaterials, sidebarOnlyMaterials],
  );

  const favoriteLocationIds = useMemo(
    () => planner.favorites.map((favorite) => favorite.key),
    [planner.favorites],
  );

  // Serialize to a stable string key so the request object only changes when
  // the actual payload content changes, not on every reference churn.
  const recommendationRequestKey = useMemo(() => {
    const payload = {
      materials: recommenderRequiredMaterials.map((m) => ({ key: m.materialKey ?? m.materialId, qty: m.requiredQuantity })),
      favorites: favoriteLocationIds,
      filters: planner.filters,
      rankingMode,
      priorityStack: planner.priorityStack.map((p) => p.id),
      manualDemand: planner.manualDemand.map((d) => d.id),
    };
    return JSON.stringify(payload);
  }, [recommenderRequiredMaterials, favoriteLocationIds, planner.filters, rankingMode, planner.priorityStack, planner.manualDemand]);

  const recommendationRequestRef = useRef(
    buildRecommendationRequest({
      priorityStack: planner.priorityStack,
      manualDemand: planner.manualDemand,
      favoriteLocationIds,
      filters: planner.filters,
    }, null, recommenderRequiredMaterials, rankingMode)
  );
  const recommendationRequestKeyRef = useRef<string | null>(null);
  if (recommendationRequestKeyRef.current !== recommendationRequestKey) {
    recommendationRequestKeyRef.current = recommendationRequestKey;
    recommendationRequestRef.current = buildRecommendationRequest({
      priorityStack: planner.priorityStack,
      manualDemand: planner.manualDemand,
      favoriteLocationIds,
      filters: planner.filters,
    }, null, recommenderRequiredMaterials, rankingMode);
  }

  useEffect(() => {
    const controller = new AbortController();
    const requestSeq = recommendationRequestSeqRef.current + 1;
    recommendationRequestSeqRef.current = requestSeq;

    setState((prev) => {
      if (prev.status === "loading") return prev;
      return { status: "loading", data: "data" in prev ? prev.data : undefined };
    });

    getMiningRecommendations(recommendationRequestRef.current, controller.signal)
      .then((data) => {
        if (requestSeq !== recommendationRequestSeqRef.current) return;
        if (debugMiningIdentity) {
          console.groupCollapsed("[mining] recommender material coverage");
          console.debug("raw API recommendation count", data.recommendations.length);
          console.debug("active buildQueue demand count", recommenderRequiredMaterials.length);
          console.groupEnd();
        }
        setState({ status: "ok", data });
      })
      .catch((err) => {
        if (controller.signal.aborted || requestSeq !== recommendationRequestSeqRef.current) return;
        setState((prev) => ({
          status: "error",
          message: String(err),
          data: "data" in prev ? prev.data : undefined,
        }));
      });

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendationRequestKey]);

  const materialKeyByDisplayName = useMemo(() => {
    const resolve = createMaterialResolver(materials);
    return new Map(allMaterials.map((name) => [
      name,
      canonicalMiningMaterialKey(resolve({ displayName: name, materialName: name })?.materialKey ?? name),
    ]));
  }, [allMaterials, materials]);

  const locationMaterialKeysByLocationKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const location of locations) {
      const staticKeys = getStaticLocationMaterialKeys(location, staticMiningIndex);
      map.set(location.locationKey, staticKeys);
    }
    return map;
  }, [locations, staticMiningIndex]);

  const indexedMaterialKeysByLocationKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const location of locations) {
      const staticKeys = getStaticLocationMaterialKeys(location, staticMiningIndex);
      const indexedKeys = (location.indexedResources ?? []).flatMap((resource) => {
        const keys: string[] = [canonicalMiningMaterial({
          materialId: resource.materialId,
          materialName: resource.materialName,
          displayName: resource.materialName,
        }).key];
        const resolvedKey = materialKeyByDisplayName.get(resource.materialName);
        if (resolvedKey) {
          keys.push(resolvedKey);
        }
        return keys;
      });
      const matchedKeys = locationMaterialKeysByLocationKey.get(location.locationKey) ?? [];
      map.set(location.locationKey, Array.from(new Set([...matchedKeys, ...staticKeys, ...indexedKeys])));
    }
    return map;
  }, [locations, locationMaterialKeysByLocationKey, materialKeyByDisplayName, staticMiningIndex]);

  const materialFilterKeys = useMemo(
    () => buildQueueSelectionActive ? buildQueueMaterials : selectedMaterials,
    [buildQueueMaterials, buildQueueSelectionActive, selectedMaterials],
  );
  const showOnlyStarred = planner.filters.showOnlyStarred;
  const isFavoriteLocation = planner.isFavorite;

  const filteredLocations = useMemo(() => {
    let result = locations;
    if (selectedSystems.size > 0) result = result.filter((l) => selectedSystems.has(l.systemName));
    if (selectedMiningTypes.size > 0) result = result.filter((l) => selectedMiningTypes.has(miningTypeFromSpawn(l.spawnType)));
    if (materialFilterKeys.size > 0) result = result.filter((l) =>
      (indexedMaterialKeysByLocationKey.get(l.locationKey) ?? []).some((key) => materialFilterKeys.has(key))
    );
    if (showOnlyStarred) {
      result = result.filter((l) =>
        isFavoriteLocation({ system: l.systemName, location: l.locationName, spawnType: l.spawnType })
      );
    }
    return [...result].sort(compareLocationsByRecommendationScore);
  }, [locations, selectedSystems, selectedMiningTypes, materialFilterKeys, indexedMaterialKeysByLocationKey, showOnlyStarred, isFavoriteLocation]);

  const activeDiversityMaterialKeys = buildQueueSelectionActive
    ? activeBuildQueueMaterialKeys
    : selectedMaterials.size > 0
      ? selectedMaterials
      : activeBuildQueueMaterialKeys;
  const rankedFilteredLocations = useMemo(() => {
    const ranked = activeDiversityMaterialKeys.size === 1
      ? [...filteredLocations]
      : diversifyLocationsByMaterials(filteredLocations, activeDiversityMaterialKeys, indexedMaterialKeysByLocationKey);
    const modeDemandMaterials = activeBuildQueueDemandMaterials.length > 0 ? activeBuildQueueDemandMaterials : sidebarOnlyMaterials;
    if (modeDemandMaterials.length > 0) {
      return ranked.sort((left, right) => {
        const leftScore = demandWeightedLocationScore(left, modeDemandMaterials, locationMaterialKeysByLocationKey, staticMiningIndex, rankingMode);
        const rightScore = demandWeightedLocationScore(right, modeDemandMaterials, locationMaterialKeysByLocationKey, staticMiningIndex, rankingMode);
        return rightScore.covered - leftScore.covered ||
          rightScore.score - leftScore.score ||
          left.locationName.localeCompare(right.locationName);
      });
    }
    return ranked.sort(compareLocationsByRecommendationScore);
  }, [activeBuildQueueDemandMaterials, activeDiversityMaterialKeys, filteredLocations, indexedMaterialKeysByLocationKey, locationMaterialKeysByLocationKey, rankingMode, sidebarOnlyMaterials, staticMiningIndex]);

  const previousRankedLocationsRef = useRef<PublicLocationEntry[]>([]);
  useEffect(() => {
    if (state.status !== "loading" && rankedFilteredLocations.length > 0) {
      previousRankedLocationsRef.current = rankedFilteredLocations;
    }
  }, [rankedFilteredLocations, state.status]);

  const displayRankedFilteredLocations =
    state.status === "loading" &&
    rankedFilteredLocations.length === 0 &&
    previousRankedLocationsRef.current.length > 0
      ? previousRankedLocationsRef.current
      : rankedFilteredLocations;

  const listLocations = showAllLocations ? displayRankedFilteredLocations : displayRankedFilteredLocations.slice(0, 12);

  const selectedEntry = useMemo(() => {
    if (selectedLocationKey) {
      return displayRankedFilteredLocations.find((l) => l.locationKey === selectedLocationKey) ?? displayRankedFilteredLocations[0] ?? null;
    }
    return displayRankedFilteredLocations[0] ?? null;
  }, [selectedLocationKey, displayRankedFilteredLocations]);

  useEffect(() => {
    setSelectedLocationKey(null);
  }, [selectedMaterials, selectedSystems, selectedMiningTypes]);

  function toggleMaterial(mat: string) {
    const materialKey = canonicalMiningMaterialKey(mat);
    setSelectedMaterials((prev) => {
      const next = new Set(prev);
      if (next.has(materialKey)) next.delete(materialKey); else next.add(materialKey);
      if (next.size === 0) setBuildQueueSelectionActive(false);
      return next;
    });
  }

  function toggleSystem(sys: string) {
    setSelectedSystems((prev) => {
      const next = new Set(prev);
      if (next.has(sys)) next.delete(sys); else next.add(sys);
      return next;
    });
  }

  function selectBuildQueueMaterials() {
    setBuildQueueSelectionActive((active) => {
      if (active) return false;
      setSelectedMaterials((prev) => new Set([...prev, ...buildQueueMaterials]));
      return true;
    });
  }

  function clearAllFilters() {
    setBuildQueueSelectionActive(false);
    setSelectedMaterials(new Set());
    setSelectedSystems(new Set());
    setSelectedMiningTypes(new Set());
  }

  const hasActiveFilters = selectedSystems.size > 0 || selectedMaterials.size > 0 || selectedMiningTypes.size > 0 || buildQueueSelectionActive;

  // Co-availability: build material -> location set from the current response.
  // This only affects chip UI (enabled/disabled); it never feeds back into the request.
  const materialToLocations = useMemo((): Map<string, Set<string>> => {
    const map = new Map<string, Set<string>>();
    for (const [locationKey, matKeys] of indexedMaterialKeysByLocationKey) {
      for (const matKey of matKeys) {
        let set = map.get(matKey);
        if (!set) { set = new Set(); map.set(matKey, set); }
        set.add(locationKey);
      }
    }
    return map;
  }, [indexedMaterialKeysByLocationKey]);

  // Intersection of location sets for all currently selected materials.
  const selectedLocationIntersection = useMemo((): Set<string> | null => {
    if (selectedMaterials.size === 0) return null;
    let intersection: Set<string> | null = null;
    for (const key of selectedMaterials) {
      const locs = materialToLocations.get(key);
      if (!locs || locs.size === 0) return new Set(); // nothing co-available
      if (intersection === null) {
        intersection = new Set<string>(locs);
      } else {
        for (const loc of intersection) {
          if (!locs.has(loc)) intersection.delete(loc);
        }
      }
    }
    return intersection;
  }, [selectedMaterials, materialToLocations]);

  function isChipEnabled(chipKey: string): boolean {
    if (selectedMaterials.has(chipKey)) return true;       // already selected
    if (selectedLocationIntersection === null) return true; // nothing selected yet
    if (selectedLocationIntersection.size === 0) return false;
    const chipLocs = materialToLocations.get(chipKey);
    if (!chipLocs) return false;
    for (const loc of selectedLocationIntersection) {
      if (chipLocs.has(loc)) return true;
    }
    return false;
  }


  return (
    <div className="mine-page mine-page--v2">

      {state.status === "loading" && (
        <div className="mine-status-state">
          <span className="mine-status-text">Loading recommendations…</span>
        </div>
      )}
      {state.status === "error" && (
        <div className="mine-status-state mine-status-state--error">
          <span className="mine-status-text">Failed to load: {state.message}</span>
        </div>
      )}

      {hasRecommendationData && (
        <>
          {/* Top filter rail */}
          <div className="mining-filter-rail">

            {/* Left: System + Mode + Clear All */}
            <div className="mining-filter-group--left">
              <span className="mining-filter-label">System</span>
              <div className="mining-frl-chips">
                {MINING_SYSTEM_FILTERS.map((sys) => (
                  <button
                    key={sys}
                    type="button"
                    className={`mfr-chip${selectedSystems.has(sys) ? " mfr-chip--active" : ""}`}
                    onClick={() => toggleSystem(sys)}
                  >
                    {sys}
                  </button>
                ))}
              </div>
              <span className="mining-filter-label">Mode</span>
              <div className="mining-frl-chips">
                <button
                  type="button"
                  className={`mfr-chip${!buildQueueSelectionActive && selectedMaterials.size === 0 && !planner.filters.showOnlyStarred ? " mfr-chip--active" : ""}`}
                  onClick={clearAllFilters}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`mfr-chip${buildQueueSelectionActive ? " mfr-chip--active mfr-chip--bq" : ""}`}
                  onClick={selectBuildQueueMaterials}
                >
                  Build Queue
                  {buildQueueMaterials.size > 0 && (
                    <span className="mfr-chip-count">{buildQueueMaterials.size}</span>
                  )}
                </button>
                <button
                  type="button"
                  className={`mfr-chip${planner.filters.showOnlyStarred ? " mfr-chip--active" : ""}`}
                  onClick={() => planner.toggleShowOnlyStarred()}
                >
                  Starred
                </button>
              </div>
              <button
                type="button"
                className="mfr-clear-btn"
                onClick={clearAllFilters}
                disabled={!hasActiveFilters}
              >
                Clear All
              </button>
            </div>

            {/* Ship Mineables */}
            {resourceGroups.shipAndHarvestable.length > 0 && (
              <div className="mining-filter-group--ship">
                <span className="mining-filter-label">Ship Mineables</span>
                <div className="mining-chip-wrap">
                  {resourceGroups.shipAndHarvestable.map((chip) => {
                    const enabled = isChipEnabled(chip.id);
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        className={`mfr-chip${selectedMaterials.has(chip.id) ? " mfr-chip--active" : ""}${!enabled ? " mfr-chip--disabled" : ""}`}
                        onClick={enabled ? () => toggleMaterial(chip.id) : undefined}
                        disabled={!enabled}
                        title={!enabled ? "Not available with current selected materials" : undefined}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Vehicle */}
            {resourceGroups.vehicle.length > 0 && (
              <div className="mining-filter-group--vehicle">
                <span className="mining-filter-label">Vehicle</span>
                <div className="mining-chip-wrap">
                  {resourceGroups.vehicle.map((chip) => {
                    const enabled = isChipEnabled(chip.id);
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        className={`mfr-chip${selectedMaterials.has(chip.id) ? " mfr-chip--active" : ""}${!enabled ? " mfr-chip--disabled" : ""}`}
                        onClick={enabled ? () => toggleMaterial(chip.id) : undefined}
                        disabled={!enabled}
                        title={!enabled ? "Not available with current selected materials" : undefined}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Hand */}
            {resourceGroups.hand.length > 0 && (
              <div className="mining-filter-group--hand">
                <span className="mining-filter-label">Hand</span>
                <div className="mining-chip-wrap">
                  {resourceGroups.hand
                    .filter((chip) => chip.label.trim().toLowerCase() !== "pure carinite")
                    .map((chip) => {
                      const enabled = isChipEnabled(chip.id);
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          className={`mfr-chip${selectedMaterials.has(chip.id) ? " mfr-chip--active" : ""}${!enabled ? " mfr-chip--disabled" : ""}`}
                          onClick={enabled ? () => toggleMaterial(chip.id) : undefined}
                          disabled={!enabled}
                          title={!enabled ? "Not available with current selected materials" : undefined}
                        >
                          {chip.label}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}


          </div>

          {/* Main 3-column console */}
          {displayRankedFilteredLocations.length === 0 ? (
            <div className="mine-empty-state">
              <p className="mine-empty-text">
                {planner.filters.showOnlyStarred
                  ? "No starred locations. Click ☆ on a location to star it."
                  : "No locations match the current filters."}
              </p>
            </div>
          ) : (
            <div className="mconsole-layout">

              {/* Left: ranked list */}
              <div className="mlist-panel">
                <div className="mlist-header">
                  <span className="mlist-header-label">RECOMMENDED LOCATIONS</span>
                  <span className="mlist-header-count">{displayRankedFilteredLocations.length}</span>
                </div>
                <div className="mlist-header-rank">
                  <div className="mlist-rank-toggle" role="group" aria-label="Ranking mode">
                    {MINING_RANKING_MODES.map((mode) => (
                      <button
                        key={mode.value}
                        type="button"
                        className={`mlist-rank-btn${rankingMode === mode.value ? " is-active" : ""}`}
                        aria-pressed={rankingMode === mode.value}
                        onClick={() => setRankingMode(mode.value)}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mlist-items">
                  {listLocations.map((entry) => (
                    <LocationListItem
                      key={getLocationCardKey(entry)}
                      rank={displayRankedFilteredLocations.findIndex((item) => item.locationKey === entry.locationKey) + 1}
                      entry={entry}
                      selectedMaterials={materialFilterKeys}
                      activeDemandMaterials={activeBuildQueueDemandMaterials}
                      buildQueueMaterialKeys={activeBuildQueueMaterialKeys}
                      locationMaterialKeys={locationMaterialKeysByLocationKey.get(entry.locationKey) ?? []}
                      staticMiningIndex={staticMiningIndex}
                      starred={planner.isFavorite({
                        system: entry.systemName,
                        location: entry.locationName,
                        spawnType: entry.spawnType,
                      })}
                      selected={selectedEntry?.locationKey === entry.locationKey}
                      onSelect={() => setSelectedLocationKey(entry.locationKey)}
                      onToggleStar={(e) => {
                        e.stopPropagation();
                        planner.toggleFavorite({
                          system: entry.systemName,
                          location: entry.locationName,
                          spawnType: entry.spawnType,
                        });
                      }}
                    />
                  ))}
                  {displayRankedFilteredLocations.length > 12 && (
                    <button
                      type="button"
                      className="mlist-view-all-btn"
                      onClick={() => setShowAllLocations((p) => !p)}
                    >
                      {showAllLocations
                        ? "Show top 12 ↑"
                        : `View all ${displayRankedFilteredLocations.length} locations ↓`}
                    </button>
                  )}
                </div>
              </div>

              {/* Center: selected detail */}
              <div className="mdet-col">
                {selectedEntry ? (
                  <LocationDetail
                    entry={selectedEntry}
                    activeDemandMaterials={buildQueueSelectionActive ? activeBuildQueueDemandMaterials : sidebarOnlyMaterials}
                    buildQueueMaterialKeys={materialFilterKeys}
                    locationMaterialKeys={locationMaterialKeysByLocationKey.get(selectedEntry.locationKey) ?? []}
                    staticMiningIndex={staticMiningIndex}
                  />
                ) : (
                  <div className="mdet-empty">
                    <span>Select a location to view details</span>
                  </div>
                )}
              </div>

            </div>
          )}

          {showAdvancedScores && (
            <div className="mex-fixture-note">Advanced scoring active · fixture data</div>
          )}
        </>
      )}
    </div>
  );
}
