import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import CraftTabBar from "../crafting/CraftTabBar";
import {
  buildRecommendationRequest,
  getAllIndexedLocations,
  getMiningRecommendations,
  type RecommendationResponse,
} from "../../../features/mining/recommenderAdapter";
import { getBuildQueueRequirements } from "../../../features/buildQueue/buildQueueRequirementsApi";
import { useMiningPlannerState } from "../../../features/mining/useMiningPlannerState";
import {
  loadStantonLagrangeChildrenData,
  resolveRecommenderStantonLagrangeChildren,
} from "../../../features/locations/stantonLagrangeChildren";
import type {
  ManualMiningDemandItem,
  PublicLocationEntry,
  RequiredMaterial,
} from "../../../features/mining/types";
import "./mining.css";
import { useLogisticsStore } from "../../../stores/logisticsStore";
import { createMaterialResolver } from "../../../lib/logistics/materialResolver";
import { getBuildQueueShortageSummary } from "../../../lib/logistics/selectors";
import { MsbChip, MsbSection, MsbSidebar, ResourcesSection } from "../shared/MsbSidebar";
import { buildResourceGroups } from "../shared/msbResourceGroups";

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

// ── Access mode ───────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function isRefinableMaterial(material: unknown): boolean {
  return typeof material === "object" && material !== null && "isRefinable" in material
    ? Boolean((material as { isRefinable?: boolean }).isRefinable)
    : false;
}

function materialKeyOf(material: Pick<RequiredMaterial, "materialKey" | "materialId">): string {
  return material.materialKey ?? material.materialId;
}

function materialDisplayName(material: Pick<RequiredMaterial, "displayName" | "materialName" | "materialId">): string {
  return material.displayName ?? material.materialName ?? material.materialId;
}

const miningTypeOrder = ["Ship", "Ground Vehicle", "Hand", "Mixed", "Harvestable", "Other/Unknown"];

function normalizeOtherMiningType(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes("ship")) return "Ship";
  if (lower.includes("ground")) return "Ground Vehicle";
  if (lower.includes("hand") || lower.includes("fps")) return "Hand";
  if (lower.includes("harvest")) return "Harvestable";
  if (lower.includes("mixed")) return "Mixed";
  return "Other/Unknown";
}

function findRouteScoreForMaterial(entry: PublicLocationEntry, materialKey: string | null | undefined) {
  if (!materialKey) return null;
  return (entry.routeScores ?? []).find((score) =>
    score.materialKey === materialKey ||
    score.materialId === materialKey ||
    score.materialName === materialKey ||
    score.displayName === materialKey
  ) ?? null;
}

function getPrimaryRouteScore(entry: PublicLocationEntry, selectedMaterials: Set<string>) {
  if (selectedMaterials.size === 1) {
    return findRouteScoreForMaterial(entry, [...selectedMaterials][0]);
  }
  return entry.routeScores?.[0] ?? null;
}

function getPrimaryRecommendationScore(entry: PublicLocationEntry): number {
  if (Number.isFinite(entry.score)) return entry.score;
  return entry.routeTargetabilityScore ?? 0;
}

function getMatchedDemandCount(entry: PublicLocationEntry): number {
  return entry.requiredMaterials?.length ?? 0;
}

function compareLocationsByRecommendationScore(left: PublicLocationEntry, right: PublicLocationEntry): number {
  return getPrimaryRecommendationScore(right) - getPrimaryRecommendationScore(left) ||
    getMatchedDemandCount(right) - getMatchedDemandCount(left) ||
    left.locationName.localeCompare(right.locationName);
}

function formatRouteWhy(entry: PublicLocationEntry, routeScore: NonNullable<PublicLocationEntry["routeScores"]>[number]): string {
  const reasons = routeScore.reasons.slice(0, 3).join(", ");
  const comparison = routeScore.comparison ? `${routeScore.comparison}. ` : "";
  return `${comparison}${entry.locationName} is a ${routeScore.label.toLowerCase()} ${routeScore.displayName} route because it has ${reasons}.`;
}

function scoreToneClass(label?: string, score?: number): string {
  const normalized = label?.toLowerCase();
  if (normalized === "excellent" || normalized === "strong") return "mloc-score--best";
  if (normalized === "good") return "mloc-score--good";
  if (normalized === "weak") return "mloc-score--okay";
  if (normalized === "poor") return "mloc-score--poor";
  if (score === undefined) return "";
  if (score >= 80) return "mloc-score--best";
  if (score >= 60) return "mloc-score--good";
  if (score >= 35) return "mloc-score--okay";
  return "mloc-score--poor";
}

type RelativeScoreDisplay = {
  raw: number;
  relative: number;
  label: "Best" | "Strong" | "Good" | "Okay" | "Weak";
  toneClass: string;
};

type LocationScoreDisplay = {
  route?: RelativeScoreDisplay;
  yield?: RelativeScoreDisplay;
  quality?: RelativeScoreDisplay;
};

function relativeScoreLabel(score: number): RelativeScoreDisplay["label"] {
  if (score >= 90) return "Best";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Good";
  if (score >= 25) return "Okay";
  return "Weak";
}

function relativeScoreToneClass(score: number): string {
  if (score >= 90) return "mloc-score--best";
  if (score >= 70) return "mloc-score--good";
  if (score >= 50) return "mloc-score--okay";
  if (score >= 25) return "mloc-score--okay";
  return "mloc-score--poor";
}

function formatRawScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function highRawQualityFloor(raw: number): number {
  if (raw >= 99) return 70;
  if (raw >= 95) return 60;
  if (raw >= 90) return 50;
  if (raw >= 80) return 25;
  return 0;
}

function buildRelativeScores(
  values: Array<{ key: string; value: number }>,
  options: { highRawFloor?: boolean } = {},
): Map<string, RelativeScoreDisplay> {
  const map = new Map<string, RelativeScoreDisplay>();
  if (values.length === 0) return map;

  const rawValues = values.map((item) => item.value);
  const max = Math.max(...rawValues);
  const min = Math.min(...rawValues);

  for (const item of values) {
    const scaled = max === min ? 100 : Math.round(((item.value - min) / (max - min)) * 100);
    const relative = options.highRawFloor ? Math.max(scaled, highRawQualityFloor(item.value)) : scaled;
    map.set(item.key, {
      raw: item.value,
      relative,
      label: relativeScoreLabel(relative),
      toneClass: relativeScoreToneClass(relative),
    });
  }

  return map;
}

function buildLocationScoreDisplay(
  locations: PublicLocationEntry[],
  selectedMaterials: Set<string>,
): Map<string, LocationScoreDisplay> {
  const routeValues: Array<{ key: string; value: number }> = [];
  const yieldValues: Array<{ key: string; value: number }> = [];
  const qualityValues: Array<{ key: string; value: number }> = [];

  for (const entry of locations) {
    const routeScore = getPrimaryRouteScore(entry, selectedMaterials);
    const routeValue = routeScore?.overallTargetabilityScore ?? entry.routeTargetabilityScore;
    if (routeValue !== undefined) routeValues.push({ key: entry.locationKey, value: routeValue });
    if (routeScore) {
      yieldValues.push({ key: entry.locationKey, value: routeScore.yieldRouteScore });
      qualityValues.push({ key: entry.locationKey, value: routeScore.qualityRouteScore });
    }
  }

  const routeMap = buildRelativeScores(routeValues);
  const yieldMap = buildRelativeScores(yieldValues);
  const qualityMap = buildRelativeScores(qualityValues, { highRawFloor: true });
  const map = new Map<string, LocationScoreDisplay>();

  for (const entry of locations) {
    map.set(entry.locationKey, {
      route: routeMap.get(entry.locationKey),
      yield: yieldMap.get(entry.locationKey),
      quality: qualityMap.get(entry.locationKey),
    });
  }

  return map;
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
  return (indexedMaterialKeysByLocationKey.get(location.locationKey) ?? []).includes(materialKey);
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

function getStileronRemovalReason(
  location: Pick<PublicLocationEntry, "locationKey" | "systemName"> & { miningType: string },
  selectedSystems: Set<string>,
  selectedMiningTypes: Set<string>,
  selectedMaterials: Set<string>,
  indexedMaterialKeysByLocationKey: Map<string, string[]>,
  finalVisibleKeys: Set<string>,
  filteredLocationKeys: Set<string>,
): string {
  if (finalVisibleKeys.has(location.locationKey)) return "visible";
  if (selectedSystems.size > 0 && !selectedSystems.has(location.systemName)) return "system filter";
  if (selectedMiningTypes.size > 0 && !selectedMiningTypes.has(location.miningType)) return "mining type filter";
  if (
    selectedMaterials.size > 0 &&
    !(indexedMaterialKeysByLocationKey.get(location.locationKey) ?? []).some((key) => selectedMaterials.has(key))
  ) {
    return "resource filter";
  }
  if (filteredLocationKeys.has(location.locationKey)) return "after top-card slice";
  return "not present in recommendation response";
}


// ── Load state ────────────────────────────────────────────────────────────────

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: RecommendationResponse };

// ── Location strip panel ──────────────────────────────────────────────────────

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

function LocationPanel({
  rank,
  entry,
  selectedMaterials,
  buildQueueMaterialKeys,
  displayNameByKey,
  locationMaterialKeys,
  resourceKeyByName,
  rankingMode,
  scoreDisplay,
  starred,
  selected,
  onSelect,
  onToggleStar,
}: {
  rank: number;
  entry: PublicLocationEntry;
  selectedMaterials: Set<string>;
  buildQueueMaterialKeys: Set<string>;
  displayNameByKey: Map<string, string>;
  locationMaterialKeys: string[];
  resourceKeyByName: Map<string, string>;
  rankingMode: MiningRankingMode;
  scoreDisplay?: LocationScoreDisplay;
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

  const primaryCovered = selectedMaterials.size > 0 ? coveredSelected : coveredBQ;
  const totalRelevant = selectedMaterials.size > 0 ? selectedMaterials.size : buildQueueMaterialKeys.size;
  const coveragePct = totalRelevant > 0 ? Math.round((primaryCovered.length / totalRelevant) * 100) : 0;
  const primaryRouteScore = selectedMaterials.size === 1
    ? getPrimaryRouteScore(entry, selectedMaterials)
    : null;
  const displayRouteScore = primaryRouteScore ?? entry.routeScores?.[0] ?? null;
  const specialSignal = displayRouteScore?.specialSignals?.[0];
  const browseResources = useMemo(() => {
    if (totalRelevant > 0) return [];
    const seen = new Set<string>();
    return (entry.indexedResources ?? []).filter((resource) => {
      const key = `${resource.materialId ?? ""}|${resource.materialName}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [entry.indexedResources, totalRelevant]);

  const chipLimit = 4;
  const chips = primaryCovered.slice(0, chipLimit);
  const browseChips = browseResources.slice(0, chipLimit);
  const extraCount = totalRelevant > 0 ? primaryCovered.length - chipLimit : browseResources.length - chipLimit;
  const [showOtherResources, setShowOtherResources] = useState(false);
  const matchedNameByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const material of entry.requiredMaterials ?? []) {
      const key = material.materialKey ?? material.materialId;
      map.set(key, material.displayName ?? material.materialName);
      map.set(material.materialName, material.displayName ?? material.materialName);
    }
    return map;
  }, [entry.requiredMaterials]);

  const otherResourceGroups = useMemo(() => {
    const matchedQueueKeys = new Set(coveredBQ);
    const seen = new Set<string>();
    const groups = new Map<string, Array<{ name: string; key: string }>>();

    for (const resource of entry.indexedResources ?? []) {
      const key = resource.materialId ?? resourceKeyByName.get(resource.materialName) ?? resource.materialName;
      if (matchedQueueKeys.has(key) || matchedQueueKeys.has(resource.materialName)) continue;
      const dedupeKey = `${key}|${resource.materialName}`.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const miningType = normalizeOtherMiningType(resource.miningType);
      const resources = groups.get(miningType) ?? [];
      resources.push({ name: resource.materialName, key });
      groups.set(miningType, resources);
    }

    return miningTypeOrder
      .map((miningType) => ({
        miningType,
        resources: (groups.get(miningType) ?? []).sort((left, right) => left.name.localeCompare(right.name)),
      }))
      .filter((group) => group.resources.length > 0);
  }, [coveredBQ, displayNameByKey, entry.indexedResources, resourceKeyByName]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      className={`mloc-panel${selected ? " mloc-panel--selected" : ""}${starred ? " mloc-panel--starred" : ""}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="mloc-panel-topbar">
        <span className="mloc-rank-pill">#{rank}</span>
        <span className="mloc-panel-system">
          {entry.systemName}{entry.locationKind ? ` / ${entry.locationKind.replace(/_/g, " ")}` : ""}
        </span>
        <span className={`mloc-badge ${spawnTypeBadgeClass(entry.spawnType)}`}>
          {spawnTypeLabel(entry.spawnType)}
        </span>
        <button
          className={`mloc-star-btn${starred ? " mloc-star-btn--on" : ""}`}
          onClick={onToggleStar}
          title={starred ? "Unstar" : "Star"}
          aria-label={starred ? "Unstar" : "Star"}
        >
          {starred ? "★" : "☆"}
        </button>
      </div>

      <div className="mloc-panel-name">{entry.locationName}</div>
      <StantonLagrangeChildrenSummary entry={entry} compact />

      {specialSignal && (
        <div className="mloc-special-signal" title={specialSignal.reason}>
          <span>{specialSignal.label}</span>
          {specialSignal.reason && <em>{specialSignal.reason}</em>}
        </div>
      )}

      <div className="mloc-result-metrics">
        {(displayRouteScore || entry.routeTargetabilityScore !== undefined) && (
          <div className={`mloc-result-metric ${scoreDisplay?.route?.toneClass ?? scoreToneClass(displayRouteScore?.label ?? entry.routeTargetabilityLabel, displayRouteScore?.overallTargetabilityScore ?? entry.routeTargetabilityScore)}`}>
            <span>Route</span>
            <strong>{scoreDisplay?.route ? scoreDisplay.route.label : displayRouteScore?.overallTargetabilityScore ?? entry.routeTargetabilityScore}</strong>
            {scoreDisplay?.route && <em>{scoreDisplay.route.relative} / raw {formatRawScore(scoreDisplay.route.raw)}</em>}
          </div>
        )}
        {totalRelevant > 0 && (
          <div className={`mloc-result-metric ${scoreToneClass(undefined, coveragePct)}`}>
            <span>Demand</span>
            <strong>{primaryCovered.length}/{totalRelevant}</strong>
          </div>
        )}
        {displayRouteScore && (
          <>
            <div className={`mloc-result-metric ${scoreDisplay?.yield?.toneClass ?? scoreToneClass(undefined, displayRouteScore.yieldRouteScore)}${rankingMode === "quantity" || rankingMode === "balanced" ? " mloc-result-metric--emphasis" : ""}`}>
              <span>Yield</span>
              <strong>{scoreDisplay?.yield ? scoreDisplay.yield.label : displayRouteScore.yieldRouteScore}</strong>
              {scoreDisplay?.yield && <em>{scoreDisplay.yield.relative} / raw {formatRawScore(scoreDisplay.yield.raw)}</em>}
            </div>
            <div className={`mloc-result-metric ${scoreDisplay?.quality?.toneClass ?? scoreToneClass(undefined, displayRouteScore.qualityRouteScore)}${rankingMode === "quality" || rankingMode === "balanced" ? " mloc-result-metric--emphasis" : ""}`}>
              <span>Quality</span>
              <strong>{scoreDisplay?.quality ? scoreDisplay.quality.label : displayRouteScore.qualityRouteScore}</strong>
              {scoreDisplay?.quality && <em>{scoreDisplay.quality.relative} / raw {formatRawScore(scoreDisplay.quality.raw)}</em>}
            </div>
          </>
        )}
      </div>

      {chips.length > 0 && (
        <div className="mloc-resource-row">
          <span className="mloc-resource-row-label">Matched</span>
          <div className="mloc-panel-chips">
            {chips.map((key, index) => (
              <span key={`${entry.locationKey}:panel:${key}:${index}`} className="mloc-mat-chip mloc-mat-chip--bq">
                {matchedNameByKey.get(key) ?? displayNameByKey.get(key) ?? "Indexed resource"}
              </span>
            ))}
            {extraCount > 0 && <span className="mloc-mat-chip mloc-mat-chip--more">+{extraCount}</span>}
          </div>
        </div>
      )}
      {totalRelevant === 0 && browseChips.length > 0 && (
        <div className="mloc-resource-row mloc-resource-row--quiet">
          <span className="mloc-resource-row-label">Known</span>
          <div className="mloc-panel-chips">
            {browseChips.map((resource, index) => (
              <span key={`${entry.locationKey}:panel:indexed:${resource.materialId ?? resource.materialName}:${index}`} className="mloc-mat-chip">
                {resource.materialName}
              </span>
            ))}
            {extraCount > 0 && <span className="mloc-mat-chip mloc-mat-chip--more">+{extraCount}</span>}
          </div>
        </div>
      )}
      {chips.length === 0 && browseChips.length === 0 && (
        <span className="mloc-empty-chips">No indexed resources</span>
      )}

      {otherResourceGroups.length > 0 && (
        <div className="mloc-other">
          <button
            className="mloc-other-toggle"
            onClick={(event) => {
              event.stopPropagation();
              setShowOtherResources((previous) => !previous);
            }}
            aria-expanded={showOtherResources}
          >
            <span className="mloc-other-toggle-label">Other resources</span>
            <span className="mloc-other-count">{otherResourceGroups.reduce((sum, g) => sum + g.resources.length, 0)}</span>
            <span className="mloc-other-arrow">{showOtherResources ? "▲" : "▼"}</span>
          </button>
          {showOtherResources && (
            <div className="mloc-other-body">
              {otherResourceGroups.map((group) => (
                <div key={`${entry.locationKey}:other:${group.miningType}`} className="mloc-other-group">
                  <span className="mloc-other-label">{group.miningType}</span>
                  <div className="mloc-other-chips">
                    {group.resources.slice(0, 10).map((resource) => (
                      <span key={`${entry.locationKey}:other:${group.miningType}:${resource.key}`} className="mloc-mat-chip">
                        {resource.name}
                      </span>
                    ))}
                    {group.resources.length > 10 && (
                      <span className="mloc-mat-chip">+{group.resources.length - 10}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Location detail panel ─────────────────────────────────────────────────────

function LocationDetail({
  entry,
  buildQueueMaterialKeys,
  locationMaterialKeys,
  selectedMaterials,
}: {
  entry: PublicLocationEntry;
  buildQueueMaterialKeys: Set<string>;
  locationMaterialKeys: string[];
  selectedMaterials: Set<string>;
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

  const totalOther = useMemo(() => {
    const matchedSet = new Set(coveredBQ);
    const seen = new Set<string>();
    let count = 0;
    for (const resource of entry.indexedResources ?? []) {
      const key = resource.materialId ?? resource.materialName;
      if (matchedSet.has(key) || matchedSet.has(resource.materialName)) continue;
      const dedupeKey = `${key}|${resource.materialName}`.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      count += 1;
    }
    return count;
  }, [coveredBQ, entry.indexedResources]);
  const focusedMaterialKey = selectedMaterials.size === 1
    ? [...selectedMaterials][0]
    : coveredBQ.length === 1
      ? coveredBQ[0]
      : null;
  const focusedRouteScore = findRouteScoreForMaterial(entry, focusedMaterialKey);
  const visibleRouteScores = focusedRouteScore ? [focusedRouteScore] : (entry.routeScores ?? []).slice(0, 3);

  return (
    <div className="mloc-detail">
      {/* Header */}
      <div className="mloc-detail-header">
        <div className="mloc-detail-title-group">
          <div className="mloc-detail-name">{entry.locationName}</div>
          <div className="mloc-detail-meta">
            <span className="mloc-detail-system">{entry.systemName}</span>
            {entry.locationKind && (
              <span className="mloc-detail-kind">{entry.locationKind.replace(/_/g, " ")}</span>
            )}
            <span className={`mloc-badge ${spawnTypeBadgeClass(entry.spawnType)}`}>
              {spawnTypeLabel(entry.spawnType)} Mining
            </span>
          </div>
        </div>
        {entry.nearbyStations.length > 0 && (
          <div className="mloc-detail-stations">
            <span className="mloc-stations-label">Nearby</span>
            {entry.nearbyStations.map((s, index) => (
              <span key={`${entry.locationKey}:nearby:${s}:${index}`} className="mloc-station-chip">{s}</span>
            ))}
          </div>
        )}
      </div>

      <StantonLagrangeChildrenSummary entry={entry} />

      {/* Coverage summary strip */}
      {total > 0 && (
        <div className="mloc-detail-coverage-strip">
          <div className="mloc-detail-cov-bar">
            <div
              className={`mloc-detail-cov-fill${coveragePct === 100 ? " mloc-detail-cov-fill--full" : ""}`}
              style={{ width: `${coveragePct}%` }}
            />
          </div>
          <div className="mloc-detail-cov-stats">
            <span className={`mloc-detail-cov-num${coveragePct === 100 ? " mloc-detail-cov-num--full" : ""}`}>
              {coveragePct}%
            </span>
            <span className="mloc-detail-cov-label">coverage</span>
            <span className="mloc-detail-cov-chip">{coveredBQ.length}/{total} demand</span>
            <span className="mloc-detail-cov-chip">{missingBQ.length} missing</span>
            {totalOther > 0 && <span className="mloc-detail-cov-chip">{totalOther} other</span>}
            {entry.nearbyStations.length > 0 && <span className="mloc-detail-cov-chip">{entry.nearbyStations.length} nearby</span>}
            {totalOther > 0 && (
              <span className="mloc-detail-cov-other">· {totalOther} other resources</span>
            )}
          </div>
        </div>
      )}

      {visibleRouteScores.length > 0 && (
        <div className="mloc-route-lanes" aria-label="Relative route scores">
          <div className="mloc-route-lanes-head">
            <div className="mloc-route-lanes-title-wrap">
              <span className="mloc-route-lanes-title">Route Intelligence</span>
              <span className="mloc-route-lanes-location">{entry.locationName}</span>
            </div>
            <span className="mloc-route-lanes-note">Relative scores, not spawn chance %</span>
          </div>
          <div className="mloc-route-card-grid">
            {visibleRouteScores.map((routeScore) => {
              const routeWhy = formatRouteWhy(entry, routeScore);
              const locationIndex = routeWhy.indexOf(entry.locationName);
              const routeWhyBeforeLocation = locationIndex >= 0 ? routeWhy.slice(0, locationIndex) : "";
              const routeWhyAfterLocation = locationIndex >= 0 ? routeWhy.slice(locationIndex + entry.locationName.length) : routeWhy;

              return (
                <div
                  key={`${entry.locationKey}:route-score:${routeScore.materialKey}`}
                  className={`mloc-route-card mloc-route-card--${routeScore.label.toLowerCase()}`}
                >
                  <div className="mloc-route-card-top">
                    <span className="mloc-route-card-material">{routeScore.displayName}</span>
                    <span className="mloc-route-card-tier">{routeScore.label}</span>
                  </div>

                  <div className="mloc-route-card-hero">
                    <span className="mloc-route-card-hero-label">Route Targetability</span>
                    <strong>{routeScore.overallTargetabilityScore}</strong>
                  </div>

                  <div className="mloc-route-chip-grid">
                    <div className="mloc-route-chip">
                      <span>Quality Fit</span>
                      <strong>{routeScore.qualityRouteScore}</strong>
                    </div>
                    <div className="mloc-route-chip">
                      <span>Yield Potential</span>
                      <strong>{routeScore.yieldRouteScore}</strong>
                    </div>
                    <div className="mloc-route-chip">
                      <span>Source Weight</span>
                      <strong>{routeScore.signals.sourceWeight}</strong>
                    </div>
                  </div>

                  <p className="mloc-route-card-copy">
                    {routeWhyBeforeLocation}
                    {locationIndex >= 0 && <strong>{entry.locationName}</strong>}
                    {routeWhyAfterLocation}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No queue context */}
      {buildQueueMaterialKeys.size === 0 && selectedMaterials.size === 0 && (
        <div className="mloc-detail-all-mats">
          <span className="mloc-detail-all-label">Indexed resources ({(entry.indexedResources ?? []).length || entry.materials.length})</span>
          <div className="mloc-panel-chips mloc-panel-chips--dense">
            {(entry.indexedResources ?? []).length > 0
              ? entry.indexedResources!.map((r, index) => (
                  <span key={`${entry.locationKey}:all:${r.materialId ?? r.materialName}:${index}`} className="mloc-mat-chip">{r.materialName}</span>
                ))
              : entry.materials.map((m, index) => (
                  <span key={`${entry.locationKey}:all:${m}:${index}`} className="mloc-mat-chip">{m}</span>
                ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ── Collapsible panel ─────────────────────────────────────────────────────────

function CollapsiblePanel({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="msb-collapsible">
      <button className="msb-collapsible-header" onClick={() => setOpen((p) => !p)}>
        <span className="msb-section-label">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="msb-count-pill">{count}</span>
        )}
        <span className="msb-collapse-arrow">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="msb-collapsible-body">{children}</div>}
    </div>
  );
}

// ── Manual Demand (compact) ───────────────────────────────────────────────────

function ManualDemandCompact({
  items,
  materials,
  onAdd,
  onRemove,
  onClear,
}: {
  items: ManualMiningDemandItem[];
  materials: string[];
  onAdd: (opts: Omit<ManualMiningDemandItem, "id" | "createdAt">) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [name, setName] = useState("");
  const [quality, setQuality] = useState("");
  const [ore, setOre] = useState("");
  const [error, setError] = useState("");
  const materialListId = "mining-manual-materials";

  function handleAdd() {
    const trimName = name.trim();
    const parsedQuality = parseFloat(quality);
    if (!trimName) { setError("Name required"); return; }
    if (isNaN(parsedQuality) || parsedQuality < 0) { setError("Quality required"); return; }
    setError("");
    onAdd({ materialName: trimName, desiredQuantity: parsedQuality, sourceType: "ore", notes: ore.trim(), addToPriority: false });
    setName(""); setQuality(""); setOre("");
  }

  return (
    <div className="msb-demand-wrap">
      <div className="msb-demand-form">
        <input className="mine-input" list={materialListId} placeholder="Search materials" value={name} onChange={(e) => setName(e.target.value)} />
        <datalist id={materialListId}>
          {materials.map((material, index) => <option key={`manual-material:${material}:${index}`} value={material} />)}
        </datalist>
        <input className="mine-input mine-input--short mine-input--no-spinner" placeholder="Quality" type="number" min="0" max="100" step="any" value={quality} onChange={(e) => setQuality(e.target.value)} />
        <input className="mine-input mine-input--short" placeholder="Ore" value={ore} onChange={(e) => setOre(e.target.value)} />
        <button className="mine-add-btn" onClick={handleAdd}>Add</button>
      </div>
      {error && <div className="mine-form-error">{error}</div>}
      {items.length > 0 && (
        <div className="msb-demand-list">
          {items.map((item) => (
            <div key={item.id} className="msb-demand-row">
              <span className="msb-demand-name">{item.materialName}</span>
              <span className="msb-demand-qty">Q {item.desiredQuantity}</span>
              {item.notes && <span className="msb-demand-qty">{item.notes}</span>}
              <button className="mine-remove-btn" onClick={() => onRemove(item.id)}>✕</button>
            </div>
          ))}
          <button className="mine-clear-btn msb-demand-clear" onClick={onClear}>Clear all</button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MiningModule() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [, setLagrangeChildrenDataVersion] = useState(0);
  const planner = useMiningPlannerState();
  const [rankingMode, setRankingMode] = useState<MiningRankingMode>(() => readStoredRankingMode());
  const buildQueue = useLogisticsStore((store) => store.buildQueue);
  const recipeInputsByRecipeId = useLogisticsStore((store) => store.recipeInputTemplates);
  const recipes = useLogisticsStore((store) => store.recipeTemplates);
  const inventoryEntries = useLogisticsStore((store) => store.inventoryEntries);
  const materials = useLogisticsStore((store) => store.materialTemplates);

  const initialSidebarState = useMemo(
    () => readStoredSidebarState(MINING_FILTER_STORAGE_KEY, EMPTY_MINING_SIDEBAR_STATE),
    [],
  );
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(() => {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const valid = initialSidebarState.resources.filter((r) => !uuidPattern.test(r));
    return new Set(valid);
  });
  const [selectedSystems, setSelectedSystems] = useState<Set<string>>(
    () => new Set(initialSidebarState.systems.filter((system) => MINING_SYSTEM_FILTERS.includes(system))),
  );
  const [selectedMiningTypes, setSelectedMiningTypes] = useState<Set<string>>(() => new Set(initialSidebarState.miningTypes));
  const [selectedLocationKey, setSelectedLocationKey] = useState<string | null>(null);
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [buildQueueSelectionActive, setBuildQueueSelectionActive] = useState(initialSidebarState.buildQueueActive);
  const [allLocations, setAllLocations] = useState<PublicLocationEntry[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(MINING_RANKING_MODE_STORAGE_KEY, rankingMode);
    } catch {
      // ignore
    }
  }, [rankingMode]);

  useEffect(() => {
    getAllIndexedLocations().then((result) => setAllLocations(result.locations)).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
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

  const [requirementState, setRequirementState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; data: RequiredMaterial[] }
  >({ status: "loading" });

  useEffect(() => {
    setRequirementState((prev) => prev.status === "loading" ? prev : { status: "loading" });
    getBuildQueueRequirements({ buildQueue, recipeInputTemplates: recipeInputsByRecipeId, inventoryEntries })
      .then((data) => {
        if (debugMiningIdentity) {
          console.groupCollapsed("[mining] build queue material resolution");
          console.debug("raw build queue requirements", data.requirements);
          console.debug("unmatched refs", data.warnings.filter((warning) => warning.code.includes("unresolved")));
          console.groupEnd();
        }
        setRequirementState({
          status: "ok",
          data: data.requirements.map((requirement) => {
            const material = materials.find((entry) => entry.id === requirement.materialId);
            const resolvedRequirement = {
              ...requirement,
              materialKey: requirement.materialKey ?? requirement.materialId,
              displayName: requirement.displayName ?? material?.name ?? requirement.materialName,
              materialName: requirement.displayName ?? material?.name ?? requirement.materialName,
              estimatedRawOreNeeded: isRefinableMaterial(material) ? Math.ceil(requirement.requiredQuantity * 2.5) : undefined,
            };
            if (debugMiningIdentity) console.debug("resolved requirement", resolvedRequirement);
            return resolvedRequirement;
          }),
        });
      })
      .catch((err) => setRequirementState({ status: "error", message: String(err) }));
  }, [buildQueue, inventoryEntries, materials, recipeInputsByRecipeId]);

  const miningRequiredMaterials = useMemo(
    () => requirementState.status === "ok" ? requirementState.data : [],
    [requirementState],
  );
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

  const allMaterialResources = useMemo(() => {
    const byKey = new Map<string, { id: string; label: string; miningType?: string }>();

    for (const mat of materials) {
      if (!isIndexableMiningResource(mat.name)) continue;
      const sourceGroups = (mat as { sourceGroups?: string[] }).sourceGroups;
      let miningType: string | undefined;
      if (sourceGroups?.includes("vehicleMining")) miningType = "Ground Vehicle";
      else if (sourceGroups?.includes("fpsMining")) miningType = "Hand";
      else if (sourceGroups?.includes("ores")) miningType = "Ship";
      byKey.set(mat.id, { id: mat.id, label: mat.name, miningType });
    }

    for (const req of miningRequiredMaterials) {
      const key = materialKeyOf(req);
      const label = materialDisplayName(req);
      if (!byKey.has(key) && isIndexableMiningResource(label)) {
        byKey.set(key, { id: key, label, miningType: undefined });
      }
    }

    for (const demand of planner.manualDemand) {
      const key = (demand as { materialKey?: string; materialId?: string }).materialKey
        ?? (demand as { materialKey?: string; materialId?: string }).materialId
        ?? (demand as { materialName?: string }).materialName ?? "";
      const label = (demand as { displayName?: string; materialName?: string }).displayName
        ?? (demand as { materialName?: string }).materialName ?? key;
      if (key && !byKey.has(key) && isIndexableMiningResource(label)) {
        byKey.set(key, { id: key, label, miningType: undefined });
      }
    }

    return [...byKey.values()].sort((left, right) => left.label.localeCompare(right.label));
  }, [materials, miningRequiredMaterials, planner.manualDemand]);

  const allMaterials = useMemo(
    () => allMaterialResources.map((resource) => resource.label),
    [allMaterialResources],
  );

  // Canonical lookup: key → { id, label } — source of truth for display names in sidebar
  const materialOptionByKey = useMemo(
    () => new Map(allMaterialResources.map((r) => [r.id, r])),
    [allMaterialResources],
  );

  // One-time migration: drop stored keys that don't resolve to a known material option.
  const migrationDoneRef = useRef(false);
  useEffect(() => {
    if (migrationDoneRef.current || materialOptionByKey.size === 0) return;
    migrationDoneRef.current = true;
    setSelectedMaterials((prev) => {
      const cleaned = new Set([...prev].filter((key) => materialOptionByKey.has(key)));
      return cleaned.size === prev.size ? prev : cleaned;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialOptionByKey]);

  const resourceGroups = useMemo(
    () => buildResourceGroups(allMaterialResources),
    [allMaterialResources],
  );

  // Sidebar-selected materials merged into recommender demand (always, not BQ-gated).
  const sidebarOnlyMaterials = useMemo<RequiredMaterial[]>(() => {
    const bqKeys = new Set(miningRequiredMaterials.map(materialKeyOf));
    return [...selectedMaterials]
      .filter((key) => !bqKeys.has(key))
      .map((key) => {
        const label = materialOptionByKey.get(key)?.label ?? key;
        return {
          materialId: key,
          materialKey: key,
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

  useEffect(() => {
    const request = buildRecommendationRequest({
      priorityStack: planner.priorityStack,
      manualDemand: planner.manualDemand,
      favoriteLocationIds: planner.favorites.map((favorite) => favorite.key),
      filters: planner.filters,
    }, null, recommenderRequiredMaterials);
    setState((prev) => prev.status === "loading" ? prev : { status: "loading" });
    getMiningRecommendations(request)
      .then((data) => {
        if (debugMiningIdentity) {
          console.groupCollapsed("[mining] recommender material coverage");
          console.debug("raw API recommendation count", data.recommendations.length);
          console.debug("raw API cards", data.recommendations.map((entry) => ({
            locationName: entry.locationName,
            score: entry.score,
            matchedDemand: entry.requiredMaterials?.length ?? 0,
            requiredMaterials: entry.requiredMaterials,
            indexedResources: entry.indexedResources,
          })));
          console.debug("active buildQueue demand count", recommenderRequiredMaterials.length);
          console.debug("demand", request.requiredMaterials.map((material) => ({
            materialKey: material.materialKey ?? material.materialId,
            displayName: material.displayName ?? material.materialName,
            miningType: data.diagnostics?.materialCoverage.find((entry) =>
              entry.materialKey === (material.materialKey ?? material.materialId)
            )?.miningType,
            unit: material.unitType,
          })));
          console.debug("all location resource keys matching stileron", data.diagnostics?.materialCoverage
            .flatMap((entry) => entry.matchingResourceKeys)
            .filter((key) => key.toLowerCase().includes("stileron")));
          console.debug("final candidate locations per demanded material", data.diagnostics?.materialCoverage.map((entry) => ({
            materialKey: entry.materialKey,
            displayName: entry.displayName,
            sourceCount: entry.sourceCount,
            candidates: entry.candidateLocations,
          })));
          console.groupEnd();
        }
        setState({ status: "ok", data });
      })
      .catch((err) => setState({ status: "error", message: String(err) }));
  }, [recommenderRequiredMaterials, planner.favorites, planner.filters, planner.manualDemand, planner.priorityStack]);

  const locations = useMemo(
    () => state.status === "ok"
      ? [...state.data.recommendations].sort(compareLocationsByRecommendationScore)
      : [],
    [state],
  );

  const allMiningTypes = useMemo(
    () => Array.from(new Set(allLocations.map((l) => miningTypeFromSpawn(l.spawnType)))).sort(),
    [allLocations]
  );

  const materialKeyByDisplayName = useMemo(() => {
    const resolve = createMaterialResolver(materials);
    return new Map(allMaterials.map((name) => [name, resolve({ displayName: name, materialName: name })?.materialKey ?? name]));
  }, [allMaterials, materials]);

  const displayNameByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const material of materials) map.set(material.id, material.name);
    for (const requirement of miningRequiredMaterials) map.set(materialKeyOf(requirement), materialDisplayName(requirement));
    for (const [name, key] of materialKeyByDisplayName) {
      if (!map.has(key)) map.set(key, name);
    }
    // Ensure every resource in the sidebar list has a display name entry
    for (const resource of allMaterialResources) {
      if (!map.has(resource.id)) map.set(resource.id, resource.label);
    }
    return map;
  }, [allMaterialResources, materialKeyByDisplayName, materials, miningRequiredMaterials]);

  const locationMaterialKeysByLocationKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const location of locations) {
      const keys = (location.requiredMaterials ?? []).map((material) => material.materialKey ?? material.materialId);
      map.set(location.locationKey, Array.from(new Set(keys)));
    }
    return map;
  }, [locations]);

  const indexedMaterialKeysByLocationKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const location of locations) {
      const indexedKeys = (location.indexedResources ?? []).flatMap((resource) => {
        const keys: string[] = [resource.materialName];
        if (resource.materialId && resource.materialId !== resource.materialName) {
          keys.push(resource.materialId);
        }
        const resolvedKey = materialKeyByDisplayName.get(resource.materialName);
        if (resolvedKey && resolvedKey !== resource.materialName) {
          keys.push(resolvedKey);
        }
        return keys;
      });
      const matchedKeys = locationMaterialKeysByLocationKey.get(location.locationKey) ?? [];
      map.set(location.locationKey, Array.from(new Set([...matchedKeys, ...indexedKeys])));
    }
    return map;
  }, [locations, locationMaterialKeysByLocationKey, materialKeyByDisplayName]);

  const filteredLocations = useMemo(() => {
    let result = locations;
    if (selectedSystems.size > 0) result = result.filter((l) => selectedSystems.has(l.systemName));
    if (selectedMiningTypes.size > 0) result = result.filter((l) => selectedMiningTypes.has(miningTypeFromSpawn(l.spawnType)));
    if (selectedMaterials.size > 0) result = result.filter((l) =>
      (indexedMaterialKeysByLocationKey.get(l.locationKey) ?? []).some((key) => selectedMaterials.has(key))
    );
    if (planner.filters.showOnlyStarred) {
      result = result.filter((l) =>
        planner.isFavorite({ system: l.systemName, location: l.locationName, spawnType: l.spawnType })
      );
    }
    return [...result].sort(compareLocationsByRecommendationScore);
  }, [locations, selectedSystems, selectedMiningTypes, selectedMaterials, indexedMaterialKeysByLocationKey, planner.filters.showOnlyStarred, planner.isFavorite]);

  const activeDiversityMaterialKeys = selectedMaterials.size > 0 ? selectedMaterials : activeBuildQueueMaterialKeys;
  const rankedFilteredLocations = useMemo(() => {
    const ranked = selectedMaterials.size === 1
      ? [...filteredLocations]
      : diversifyLocationsByMaterials(filteredLocations, activeDiversityMaterialKeys, indexedMaterialKeysByLocationKey);

    return ranked.sort(compareLocationsByRecommendationScore);
  }, [activeDiversityMaterialKeys, filteredLocations, indexedMaterialKeysByLocationKey, selectedMaterials]);

  const diagnosticsByMaterialKey = useMemo(() => {
    const map = new Map<string, NonNullable<RecommendationResponse["diagnostics"]>["materialCoverage"][number]>();
    if (state.status !== "ok") return map;
    for (const diagnostic of state.data.diagnostics?.materialCoverage ?? []) {
      map.set(diagnostic.materialKey, diagnostic);
      map.set(diagnostic.materialId, diagnostic);
    }
    return map;
  }, [state]);

  const stripLocations = showAllLocations ? rankedFilteredLocations : rankedFilteredLocations.slice(0, 4);
  const scoreDisplayByLocation = useMemo(
    () => buildLocationScoreDisplay(rankedFilteredLocations, selectedMaterials),
    [rankedFilteredLocations, selectedMaterials],
  );

  const selectedEntry = useMemo(() => {
    if (selectedLocationKey) {
      return rankedFilteredLocations.find((l) => l.locationKey === selectedLocationKey) ?? rankedFilteredLocations[0] ?? null;
    }
    return rankedFilteredLocations[0] ?? null;
  }, [selectedLocationKey, rankedFilteredLocations]);

  useEffect(() => {
    setSelectedLocationKey(null);
  }, [selectedMaterials, selectedSystems, selectedMiningTypes]);

  function toggleMaterial(mat: string) {
    setSelectedMaterials((prev) => {
      const next = new Set(prev);
      if (next.has(mat)) next.delete(mat); else next.add(mat);
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

  function toggleMiningType(type: string) {
    setSelectedMiningTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
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

  const activeQueue = buildQueue.filter((item) => item.status !== "complete");
  const queueBadge = activeQueue.length > 0 ? activeQueue.length : null;
  const { shortages } = getBuildQueueShortageSummary(
    inventoryEntries,
    buildQueue,
    recipes,
    recipeInputsByRecipeId,
  );

  const visibleCards = useMemo(() => rankedFilteredLocations.slice(0, 4), [rankedFilteredLocations]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.debug("[mining] location card render order", visibleCards.map((entry, index) => ({
      rank: index + 1,
      displayName: `${entry.locationName} (${entry.systemName})`,
      score: getPrimaryRecommendationScore(entry),
      matchedDemand: getMatchedDemandCount(entry),
    })));
  }, [visibleCards]);
  const filteredLocationKeys = useMemo(
    () => new Set(filteredLocations.map((location) => location.locationKey)),
    [filteredLocations],
  );
  const finalVisibleKeys = useMemo(
    () => new Set(visibleCards.map((location) => location.locationKey)),
    [visibleCards],
  );

  useEffect(() => {
    if (!debugMiningIdentity) return;
    const stileronDiagnostics = [...diagnosticsByMaterialKey.values()].filter((entry) =>
      entry.displayName.toLowerCase().includes("stileron") ||
      entry.materialKey.toLowerCase().includes("stileron") ||
      entry.materialId.toLowerCase().includes("stileron") ||
      entry.matchingResourceKeys.some((key) => key.toLowerCase().includes("stileron"))
    );
    const stileronDiagnosticLocations = stileronDiagnostics.flatMap((entry) => entry.candidateLocations);
    const stileronIndexedLocations = locations
      .filter((entry) => (entry.indexedResources ?? []).some((resource) => resource.materialName.toLowerCase().includes("stileron")))
      .map((entry) => ({
        locationKey: entry.locationKey,
        locationName: entry.locationName,
        systemName: entry.systemName,
        spawnType: entry.spawnType,
        miningType: miningTypeFromSpawn(entry.spawnType),
      }));
    const stileronLocations = [...stileronDiagnosticLocations, ...stileronIndexedLocations].filter((entry, index, entries) =>
      entries.findIndex((candidate) => candidate.locationKey === entry.locationKey) === index
    );
    const visibleSummary = visibleCards.map((entry) => ({
      locationName: entry.locationName,
      requiredMaterials: entry.requiredMaterials,
      indexedResources: entry.indexedResources,
    }));

    console.groupCollapsed("[mining] frontend recommendation path");
    console.debug("active buildQueue demand count", recommenderRequiredMaterials.length);
    console.debug("active selectedMaterials", [...selectedMaterials]);
    console.debug("active selectedSystems", [...selectedSystems]);
    console.debug("active selectedMiningTypes", [...selectedMiningTypes]);
    console.debug("filtered recommendation count", filteredLocations.length);
    console.debug("final visible card list", visibleSummary);
    console.debug("location material keys", Object.fromEntries([...locationMaterialKeysByLocationKey]));
    console.debug("indexed material keys", Object.fromEntries([...indexedMaterialKeysByLocationKey]));
    console.debug("Stileron removal reasons", stileronLocations
      .map((location) => ({
        ...location,
        reason: getStileronRemovalReason(
          location,
          selectedSystems,
          selectedMiningTypes,
          selectedMaterials,
          indexedMaterialKeysByLocationKey,
          finalVisibleKeys,
          filteredLocationKeys,
        ),
      })));
    console.groupEnd();
  }, [
    diagnosticsByMaterialKey,
    filteredLocationKeys,
    filteredLocations.length,
    finalVisibleKeys,
    indexedMaterialKeysByLocationKey,
    locationMaterialKeysByLocationKey,
    locations,
    recommenderRequiredMaterials.length,
    selectedMaterials,
    selectedMiningTypes,
    selectedSystems,
    visibleCards,
  ]);

  return (
    <div className="mine-page">

      <CraftTabBar activeTab="mining" queueBadge={queueBadge} missingCount={shortages.length} />

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

      {state.status === "ok" && (
        <div className="mloc-layout">

          {/* ── Filter sidebar ──────────────────────────────────────── */}
          <MsbSidebar title="Mining Filters" onClear={clearAllFilters}>
            <div className="msb-section">
              <div className="msb-chip-grid">
                <MsbChip
                  label="Build Queue"
                  active={buildQueueSelectionActive}
                  onClick={selectBuildQueueMaterials}
                  className="msb-chip--full"
                />
              </div>
            </div>

            <MsbSection label="System">
              {MINING_SYSTEM_FILTERS.map((sys) => (
                <MsbChip
                  key={sys}
                  label={sys}
                  active={selectedSystems.has(sys)}
                  onClick={() => toggleSystem(sys)}
                />
              ))}
            </MsbSection>

            {allMaterials.length > 0 && (
              <ResourcesSection groups={resourceGroups} selectedIds={selectedMaterials} onToggle={toggleMaterial} />
            )}

            {allMiningTypes.length > 0 && (
              <MsbSection label="Mining Type">
                {allMiningTypes.map((type) => (
                  <MsbChip
                    key={type}
                    label={type}
                    active={selectedMiningTypes.has(type)}
                    onClick={() => toggleMiningType(type)}
                  />
                ))}
              </MsbSection>
            )}

            {false && selectedMaterials.size > 0 && (
              <div className="msb-section">
                <div className="msb-section-label-row">
                  <span className="msb-section-label">SELECTED</span>
                  <button className="mine-clear-btn" onClick={() => {
                    setBuildQueueSelectionActive(false);
                    setSelectedMaterials(new Set());
                  }}>Clear</button>
                </div>
                <div className="msb-chip-rail">
                  {[...selectedMaterials].flatMap((m) => {
                    const option = materialOptionByKey.get(m);
                    if (!option) return [];
                    return [
                      <button
                        key={`selected-resource:${m}`}
                        className="msb-chip msb-chip--selected"
                        onClick={() => toggleMaterial(m)}
                      >
                        {option.label} <span className="msb-chip-x">×</span>
                      </button>,
                    ];
                  })}
                </div>
              </div>
            )}

            {false && <div className="msb-divider" />}

            {false && <CollapsiblePanel title="MANUAL DEMAND" count={planner.manualDemand.length}>
              <ManualDemandCompact
                items={planner.manualDemand}
                materials={allMaterials}
                onAdd={planner.addManualDemand}
                onRemove={planner.removeManualDemand}
                onClear={planner.clearManualDemand}
              />
            </CollapsiblePanel>}
          </MsbSidebar>

          {/* ── Main content ───────────────────────────────────────── */}
          <div className="mloc-main">
        
      

            {filteredLocations.length === 0 ? (
              <div className="mine-empty-state">
                <p className="mine-empty-text">
                  {planner.filters.showOnlyStarred
                    ? "No starred locations. Click ☆ on a panel to star it."
                    : "No locations match the current filters."}
                </p>
              </div>
            ) : (
              <>
                {/* ── Location strip ─────────────────────────────── */}
                <div className="mloc-strip-section">
                  <div className="mloc-strip-header">
                    <div className="mloc-strip-title-wrap">
                      <span className="mloc-strip-label">RECOMMENDED LOCATIONS</span>
                      <span className="mloc-strip-count">{filteredLocations.length} total</span>
                    </div>
                    <div className="mloc-rank-toggle" role="group" aria-label="Ranking mode">
                      {MINING_RANKING_MODES.map((mode) => (
                        <button
                          key={mode.value}
                          type="button"
                          className={`mloc-rank-btn${rankingMode === mode.value ? " is-active" : ""}`}
                          aria-pressed={rankingMode === mode.value}
                          onClick={() => setRankingMode(mode.value)}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mloc-strip">
                    {stripLocations.map((entry) => (
                      <LocationPanel
                        key={entry.locationKey}
                        rank={filteredLocations.findIndex((item) => item.locationKey === entry.locationKey) + 1}
                        entry={entry}
                        selectedMaterials={selectedMaterials}
                        buildQueueMaterialKeys={activeBuildQueueMaterialKeys}
                        displayNameByKey={displayNameByKey}
                        locationMaterialKeys={locationMaterialKeysByLocationKey.get(entry.locationKey) ?? []}
                        resourceKeyByName={materialKeyByDisplayName}
                        rankingMode={rankingMode}
                        scoreDisplay={scoreDisplayByLocation.get(entry.locationKey)}
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
                  </div>
                  {filteredLocations.length > 4 && (
                    <button
                      className="mloc-view-all-btn"
                      onClick={() => setShowAllLocations((p) => !p)}
                    >
                      {showAllLocations
                        ? "Show top 4 ↑"
                        : `View all ${filteredLocations.length} locations ↓`}
                    </button>
                  )}
                </div>

                {/* ── Selected location detail ───────────────────── */}
                {selectedEntry && (
                  <LocationDetail
                    entry={selectedEntry}
                    buildQueueMaterialKeys={activeBuildQueueMaterialKeys}
                    locationMaterialKeys={locationMaterialKeysByLocationKey.get(selectedEntry.locationKey) ?? []}
                    selectedMaterials={selectedMaterials}
                  />
                )}
              </>
            )}

            {showAdvancedScores && (
              <div className="mex-fixture-note">Advanced scoring active · fixture data</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
