import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import {
  buildRecommendationRequest,
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
  PublicLocationEntry,
  RequiredMaterial,
} from "../../../features/mining/types";
import {
  canonicalMiningMaterial,
  canonicalMiningMaterialKey,
  canonicalMiningMaterialName,
} from "../../../features/mining/materialIdentity";
import "./mining.css";
import { useLogisticsStore } from "../../../stores/logisticsStore";
import { createMaterialResolver } from "../../../lib/logistics/materialResolver";
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

// ── Load state ────────────────────────────────────────────────────────────────

type LoadState =
  | { status: "loading"; data?: RecommendationResponse }
  | { status: "error"; message: string; data?: RecommendationResponse }
  | { status: "ok"; data: RecommendationResponse };

// ── Lagrange children summary ─────────────────────────────────────────────────

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

// ── Ranked location list item ─────────────────────────────────────────────────

function LocationListItem({
  rank,
  entry,
  selectedMaterials,
  buildQueueMaterialKeys,
  locationMaterialKeys,
  starred,
  selected,
  onSelect,
  onToggleStar,
}: {
  rank: number;
  entry: PublicLocationEntry;
  selectedMaterials: Set<string>;
  buildQueueMaterialKeys: Set<string>;
  locationMaterialKeys: string[];
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
  const primaryRouteScore = getPrimaryRouteScore(entry, selectedMaterials);
  const displayRouteScore = primaryRouteScore ?? entry.routeScores?.[0] ?? null;
  const routeScore = getPrimaryRecommendationScore(entry);


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
    >
      <div className="mlist-item-rank">{rank}</div>
      <div className="mlist-item-body">
        <div className="mlist-item-head">
          <span className="mlist-item-name">{entry.locationName}</span>
          <span className={`mlist-item-score ${scoreToneClass(displayRouteScore?.label, routeScore)}`}>
            {Math.round(routeScore)}
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
              <span className="mlist-bar-val">{demandBar}%</span>
            </div>
          )}
          {listQualityDisplay.kind !== "none" && (
            <div className="mlist-bar-row">
              <span className="mlist-bar-label">Quality</span>
              <span className="mlist-bar-val mlist-bar-val--text">
                {listQualityDisplay.kind === "ignored" ? "N/A" : listQualityDisplay.label}
              </span>
            </div>
          )}
          {yieldVal !== null && (
            <div className="mlist-bar-row">
              <span className="mlist-bar-label">Yield</span>
              <div className="mlist-bar-track">
                <div
                  className={`mlist-bar-fill${yieldVal >= 75 ? " mlist-bar-fill--best" : yieldVal >= 55 ? " mlist-bar-fill--good" : ""}`}
                  style={{ width: `${Math.min(100, yieldVal)}%` }}
                />
              </div>
              <span className="mlist-bar-val">{yieldVal}</span>
            </div>
          )}
          {displayRouteScore?.label && (
            <div className="mlist-item-strength">
              <span className={`mlist-strength-label ${scoreToneClass(displayRouteScore.label)}`}>
                {displayRouteScore.label.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>
      <button
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

// ── Selected location detail panel ───────────────────────────────────────────

type QualityDisplay =
  | { kind: "ignored" }               // qualityIgnored === true → "N/A"
  | { kind: "chance"; label: string } // "900+: 27%" or "< threshold: 0%"
  | { kind: "none" };                 // no data → "—"

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

// yieldRank is candidate-relative (normalized within the recommendation response).
// A future scoring pass should normalize against all known locations per material.
type DemandRow = {
  name: string;
  key: string;
  coverage: string;
  qualityDisplay: QualityDisplay;
  yieldRank: number | null;
  sourceStrength: string;
  sourceWeight: number | undefined;
  status: "strong" | "moderate" | "low" | "missing";
};

type ResourceRow = {
  name: string;
  key: string;
  miningType: string;
  qualityDisplay: QualityDisplay;
  yieldRank: number | null;
  sourceStrength: string;
  sourceWeight: number | undefined;
  status: "strong" | "moderate" | "low" | "none";
};

function InfoTip({ text }: { text: string }) {
  return (
    <span className="mdet-infotip" title={text} aria-label={text}>?</span>
  );
}

function sourceStatus(sourceWeight: number | undefined): "strong" | "moderate" | "low" | "none" {
  if (sourceWeight === undefined) return "none";
  if (sourceWeight >= 60) return "strong";
  if (sourceWeight >= 30) return "moderate";
  return "low";
}

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
  const primaryRouteScore = entry.routeScores?.[0] ?? null;
  const routeScore = getPrimaryRecommendationScore(entry);

  // Location insights
  const insights = useMemo(() => {
    const list: Array<{ type: "positive" | "warning" | "neutral"; text: string }> = [];
    if (total > 0 && coveragePct >= 80) {
      list.push({ type: "positive", text: `High coverage for ${coveredBQ.length} of ${total} active demand materials` });
    } else if (total > 0) {
      list.push({ type: "neutral", text: `Covers ${coveredBQ.length} of ${total} active demand materials` });
    }
    if (primaryRouteScore?.signals.sourceWeight !== undefined && primaryRouteScore.signals.sourceWeight >= 60) {
      list.push({ type: "positive", text: "Strong source density with consistent respawn rates" });
    }
    if (entry.nearbyStations.length > 0) {
      list.push({ type: "positive", text: `${entry.nearbyStations.length} nearby station${entry.nearbyStations.length > 1 ? "s" : ""} for refined ore delivery` });
    }
    if (missingBQ.length > 0) {
      list.push({ type: "warning", text: `${missingBQ.length} demanded material${missingBQ.length > 1 ? "s" : ""} not covered at this location` });
    }
    return list;
  }, [total, coveragePct, coveredBQ, missingBQ, primaryRouteScore, entry.nearbyStations]);

  // Demand Coverage Breakdown — user-relevant materials only
  const demandRows = useMemo((): DemandRow[] => {
    const activeKeys = selectedMaterials.size > 0
      ? selectedMaterials
      : buildQueueMaterialKeys;
    if (activeKeys.size === 0) return [];

    const coveredSet = new Set(locationMaterialKeys);
    const rows: DemandRow[] = [];

    for (const key of activeKeys) {
      const routeScoreEntry = findRouteScoreForMaterial(entry, key);
      const covered = coveredSet.has(key);
      const sw = routeScoreEntry?.signals.sourceWeight;
      const st = covered ? sourceStatus(sw) : "missing";
      rows.push({
        name: routeScoreEntry?.displayName ?? canonicalMiningMaterialName(key),
        key,
        coverage: "—",
        qualityDisplay: buildQualityDisplay(routeScoreEntry?.signals, key),
        yieldRank: routeScoreEntry?.yieldRouteScore ?? null,
        sourceStrength: st === "strong" ? "STRONG" : st === "moderate" ? "MODERATE" : st === "low" ? "LOW" : "MISSING",
        sourceWeight: sw,
        status: st as "strong" | "moderate" | "low" | "missing",
      });
    }

    return rows;
  }, [entry, selectedMaterials, buildQueueMaterialKeys, locationMaterialKeys]);

  // Planet Resource Index — all indexed resources, scored where possible
  const resourceRows = useMemo((): ResourceRow[] => {
    const indexed = entry.indexedResources ?? [];
    if (indexed.length === 0 && entry.materials.length === 0) return [];

    const items = indexed.length > 0 ? indexed : entry.materials.map((m) => ({ materialName: m, materialId: undefined, miningType: "" }));

    return items.map((r) => {
      const key = r.materialId ?? r.materialName;
      const routeScoreEntry = findRouteScoreForMaterial(entry, key) ?? findRouteScoreForMaterial(entry, r.materialName);
      const sw = routeScoreEntry?.signals.sourceWeight;
      const st = sourceStatus(sw);
      return {
        name: r.materialName,
        key,
        miningType: (r as { miningType?: string }).miningType ?? "",
        qualityDisplay: buildQualityDisplay(routeScoreEntry?.signals, key),
        yieldRank: routeScoreEntry?.yieldRouteScore ?? null,
        sourceStrength: st === "strong" ? "STRONG" : st === "moderate" ? "MODERATE" : st === "low" ? "LOW" : "—",
        sourceWeight: sw,
        status: st,
      };
    });
  }, [entry]);

  return (
    <div className="mdet-panel">
      {/* Header */}
      <div className="mdet-header">
        <div className="mdet-header-left">
          <div className="mdet-label">SELECTED LOCATION</div>
          <div className="mdet-name">{entry.locationName}</div>
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
              <span className="mdet-thumb-name">{entry.locationName.slice(0, 2).toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metric cards row */}
      <div className="mdet-metric-row">
        {Number.isFinite(routeScore) && (
          <div className="mdet-metric-card">
            <div className="mdet-metric-label">
              ROUTE RANK
              <InfoTip text="Overall location rank after coverage, quality, yield, and source strength are combined." />
            </div>
            <div className={`mdet-metric-val ${scoreToneClass(primaryRouteScore?.label, routeScore)}`}>
              {Math.round(routeScore)}
            </div>
          </div>
        )}
        {total > 0 && (
          <div className="mdet-metric-card">
            <div className="mdet-metric-label">
              COVERAGE
              <InfoTip text="How much of your selected or needed material list this location can satisfy." />
            </div>
            <div className={`mdet-metric-val ${scoreToneClass(undefined, coveragePct)}`}>{coveragePct}%</div>
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
                    TARGET QUALITY CHANCE
                    <InfoTip text="Chance that the source meets your selected quality threshold after you find it. This is not the chance to find the source." />
                  </div>
                  <div className="mdet-metric-val">
                    {qd.kind === "ignored" ? "N/A" : qd.label}
                  </div>
                </div>
              )}
              <div className="mdet-metric-card">
                <div className="mdet-metric-label">
                  YIELD RANK
                  <InfoTip text="Relative yield score for this material compared with other locations where the same material appears. This is not an encounter probability." />
                </div>
                <div className={`mdet-metric-val ${scoreToneClass(undefined, primaryRouteScore.yieldRouteScore)}`}>
                  {primaryRouteScore.yieldRouteScore}
                </div>
              </div>
            </>
          );
        })()}
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
                <th>MATERIAL</th>
                <th>COVERAGE</th>
                <th><span className="mdet-th-wrap">TARGET QUALITY CHANCE<InfoTip text="Chance that the source meets your selected quality threshold after you find it. This is not the chance to find the source." /></span></th>
                <th><span className="mdet-th-wrap">YIELD RANK<InfoTip text="Relative yield score for this material compared with other locations where the same material appears. This is not an encounter probability." /></span></th>
                <th>SOURCE</th>
              </tr>
            </thead>
            <tbody>
              {demandRows.map((row) => (
                <tr key={row.key} className={`mining-resource-row mining-resource-row--${row.status}`}>
                  <td className="mdet-mat-name">{row.name}</td>
                  <td className="mdet-mat-demand">{row.coverage}</td>
                  <td className="mdet-mat-score">
                    {row.qualityDisplay.kind === "ignored" ? "N/A"
                      : row.qualityDisplay.kind === "chance" ? row.qualityDisplay.label
                      : "—"}
                  </td>
                  <td className={`mdet-mat-score ${scoreToneClass(undefined, row.yieldRank ?? undefined)}`}>
                    {row.yieldRank ?? "—"}
                  </td>
                  <td>
                    <span className={`mining-source-badge mining-source-badge--${row.status}`}>
                      {row.sourceStrength}
                      {row.sourceWeight !== undefined && (
                        <span className="mdet-source-bar-wrap">
                          <span className="mdet-source-bar" style={{ width: `${Math.min(100, row.sourceWeight)}%` }} />
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Available Resources on Location */}
      {resourceRows.length > 0 && (
        <div className="mining-resource-index">
          <div className="mdet-section-label">
            <span className="mdet-th-wrap">
              AVAILABLE RESOURCES ON LOCATION
              <InfoTip text="Static list of resources known at this location, independent of your selected demand." />
            </span>
            <span className="mdet-section-count">({resourceRows.length} resource{resourceRows.length !== 1 ? "s" : ""})</span>
          </div>
          <table className="mining-resource-index-table">
            <thead>
              <tr>
                <th>MATERIAL</th>
                <th>TYPE</th>
                <th><span className="mdet-th-wrap">TARGET QUALITY CHANCE<InfoTip text="Chance that the source meets your selected quality threshold after you find it. This is not the chance to find the source." /></span></th>
                <th><span className="mdet-th-wrap">YIELD RANK<InfoTip text="Relative yield score for this material compared with other locations where the same material appears. This is not an encounter probability." /></span></th>
                <th>SOURCE</th>
              </tr>
            </thead>
            <tbody>
              {resourceRows.map((row) => (
                <tr key={row.key} className={`mining-resource-row mining-resource-row--${row.status}`}>
                  <td className="mdet-mat-name">{row.name}</td>
                  <td className="mdet-mat-demand">{row.miningType || "—"}</td>
                  <td className="mdet-mat-score">
                    {row.qualityDisplay.kind === "ignored" ? "N/A"
                      : row.qualityDisplay.kind === "chance" ? row.qualityDisplay.label
                      : "—"}
                  </td>
                  <td className={`mdet-mat-score ${scoreToneClass(undefined, row.yieldRank ?? undefined)}`}>
                    {row.yieldRank ?? "—"}
                  </td>
                  <td>
                    <span className={`mining-source-badge mining-source-badge--${row.status}`}>
                      {row.sourceStrength}
                      {row.sourceWeight !== undefined && (
                        <span className="mdet-source-bar-wrap">
                          <span className="mdet-source-bar" style={{ width: `${Math.min(100, row.sourceWeight)}%` }} />
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MiningModule() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
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
            const canonical = canonicalMiningMaterial({
              materialKey: requirement.materialKey,
              materialId: requirement.materialId,
              displayName: requirement.displayName,
              materialName: requirement.materialName ?? material?.name,
            });
            const resolvedRequirement = {
              ...requirement,
              materialKey: canonical.key,
              materialId: canonical.key,
              displayName: canonical.label,
              materialName: canonical.label,
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

  const recommendationData = "data" in state ? state.data : undefined;
  const locations = useMemo(
    () => recommendationData
      ? [...recommendationData.recommendations].sort(compareLocationsByRecommendationScore)
      : [],
    [recommendationData],
  );
  const hasRecommendationData = recommendationData !== undefined;

  // Built from the materials store + BQ requirements + manual demand only.
  // Must NOT depend on `locations` — that would feed the API response back into
  // the request pipeline and create a render loop (new locations → new request
  // payload → new fetch → new locations → ...).
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

    return [...byKey.values()].sort((left, right) => left.label.localeCompare(right.label));
  }, [materials, miningRequiredMaterials, planner.manualDemand]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // the actual payload content changes — not on every reference churn.
  const recommendationRequestKey = useMemo(() => {
    const payload = {
      materials: recommenderRequiredMaterials.map((m) => ({ key: m.materialKey ?? m.materialId, qty: m.requiredQuantity })),
      favorites: favoriteLocationIds,
      filters: planner.filters,
      priorityStack: planner.priorityStack.map((p) => p.id),
      manualDemand: planner.manualDemand.map((d) => d.id),
    };
    return JSON.stringify(payload);
  }, [recommenderRequiredMaterials, favoriteLocationIds, planner.filters, planner.priorityStack, planner.manualDemand]);

  const recommendationRequestRef = useRef(
    buildRecommendationRequest({
      priorityStack: planner.priorityStack,
      manualDemand: planner.manualDemand,
      favoriteLocationIds,
      filters: planner.filters,
    }, null, recommenderRequiredMaterials)
  );
  const recommendationRequestKeyRef = useRef<string | null>(null);
  if (recommendationRequestKeyRef.current !== recommendationRequestKey) {
    recommendationRequestKeyRef.current = recommendationRequestKey;
    recommendationRequestRef.current = buildRecommendationRequest({
      priorityStack: planner.priorityStack,
      manualDemand: planner.manualDemand,
      favoriteLocationIds,
      filters: planner.filters,
    }, null, recommenderRequiredMaterials);
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
      const keys = (location.requiredMaterials ?? []).map((material) => canonicalMiningMaterial({
        materialKey: material.materialKey,
        materialId: material.materialId,
        displayName: material.displayName,
        materialName: material.materialName,
      }).key);
      map.set(location.locationKey, Array.from(new Set(keys)));
    }
    return map;
  }, [locations]);

  const indexedMaterialKeysByLocationKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const location of locations) {
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

  // Co-availability: build material → location set from the current response.
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
          {/* ── Top filter rail ──────────────────────────────────── */}
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

          {/* ── Main 3-column console ───────────────────────────── */}
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

              {/* ── Left: ranked list ─────────────────────────── */}
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
                      selectedMaterials={selectedMaterials}
                      buildQueueMaterialKeys={activeBuildQueueMaterialKeys}
                      locationMaterialKeys={locationMaterialKeysByLocationKey.get(entry.locationKey) ?? []}
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

              {/* ── Center: selected detail ───────────────────── */}
              <div className="mdet-col">
                {selectedEntry ? (
                  <LocationDetail
                    entry={selectedEntry}
                    buildQueueMaterialKeys={activeBuildQueueMaterialKeys}
                    locationMaterialKeys={locationMaterialKeysByLocationKey.get(selectedEntry.locationKey) ?? []}
                    selectedMaterials={selectedMaterials}
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
