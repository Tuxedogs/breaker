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
  return material.materialKey ?? material.materialId;
}

function materialDisplayName(material: Pick<RequiredMaterial, "displayName" | "materialName" | "materialId">): string {
  return material.displayName ?? material.materialName ?? material.materialId;
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

// ── Load state ────────────────────────────────────────────────────────────────

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
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
  const qualityVal = displayRouteScore?.qualityRouteScore ?? null;
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
              <span className="mlist-bar-label">Demand</span>
              <div className="mlist-bar-track">
                <div
                  className={`mlist-bar-fill${demandBar >= 100 ? " mlist-bar-fill--full" : demandBar >= 60 ? " mlist-bar-fill--good" : ""}`}
                  style={{ width: `${demandBar}%` }}
                />
              </div>
              <span className="mlist-bar-val">{demandBar}%</span>
            </div>
          )}
          {qualityVal !== null && (
            <div className="mlist-bar-row">
              <span className="mlist-bar-label">Quality</span>
              <div className="mlist-bar-track">
                <div
                  className={`mlist-bar-fill${qualityVal >= 75 ? " mlist-bar-fill--best" : qualityVal >= 55 ? " mlist-bar-fill--good" : ""}`}
                  style={{ width: `${Math.min(100, qualityVal)}%` }}
                />
              </div>
              <span className="mlist-bar-val">{qualityVal}</span>
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

type DemandRow = {
  name: string;
  key: string;
  demand: string;
  qualityFit: number | null;
  yieldFit: number | null;
  sourceStrength: string;
  sourceWeight: number | undefined;
  status: "strong" | "moderate" | "low" | "missing";
};

type ResourceRow = {
  name: string;
  key: string;
  miningType: string;
  qualityFit: number | null;
  yieldFit: number | null;
  sourceStrength: string;
  sourceWeight: number | undefined;
  status: "strong" | "moderate" | "low" | "none";
};

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
        name: routeScoreEntry?.displayName ?? key,
        key,
        demand: "—",
        qualityFit: routeScoreEntry?.qualityRouteScore ?? null,
        yieldFit: routeScoreEntry?.yieldRouteScore ?? null,
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
        qualityFit: routeScoreEntry?.qualityRouteScore ?? null,
        yieldFit: routeScoreEntry?.yieldRouteScore ?? null,
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
            <div className="mdet-metric-label">ROUTE SCORE</div>
            <div className={`mdet-metric-val ${scoreToneClass(primaryRouteScore?.label, routeScore)}`}>
              {Math.round(routeScore)}
            </div>
          </div>
        )}
        {total > 0 && (
          <div className="mdet-metric-card">
            <div className="mdet-metric-label">DEMAND COVERAGE</div>
            <div className={`mdet-metric-val ${scoreToneClass(undefined, coveragePct)}`}>{coveragePct}%</div>
          </div>
        )}
        {primaryRouteScore && (
          <>
            <div className="mdet-metric-card">
              <div className="mdet-metric-label">QUALITY FIT</div>
              <div className={`mdet-metric-val ${scoreToneClass(undefined, primaryRouteScore.qualityRouteScore)}`}>
                {primaryRouteScore.qualityRouteScore}
              </div>
            </div>
            <div className="mdet-metric-card">
              <div className="mdet-metric-label">YIELD FIT</div>
              <div className={`mdet-metric-val ${scoreToneClass(undefined, primaryRouteScore.yieldRouteScore)}`}>
                {primaryRouteScore.yieldRouteScore}
              </div>
            </div>
          </>
        )}
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
            DEMAND COVERAGE BREAKDOWN
            <span className="mdet-section-count">({demandRows.length} material{demandRows.length !== 1 ? "s" : ""})</span>
          </div>
          <table className="mining-resource-index-table">
            <thead>
              <tr>
                <th>MATERIAL</th>
                <th>DEMAND</th>
                <th>QUALITY FIT</th>
                <th>YIELD FIT</th>
                <th>SOURCE</th>
              </tr>
            </thead>
            <tbody>
              {demandRows.map((row) => (
                <tr key={row.key} className={`mining-resource-row mining-resource-row--${row.status}`}>
                  <td className="mdet-mat-name">{row.name}</td>
                  <td className="mdet-mat-demand">{row.demand}</td>
                  <td className={`mdet-mat-score ${scoreToneClass(undefined, row.qualityFit ?? undefined)}`}>
                    {row.qualityFit ?? "—"}
                  </td>
                  <td className={`mdet-mat-score ${scoreToneClass(undefined, row.yieldFit ?? undefined)}`}>
                    {row.yieldFit ?? "—"}
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

      {/* Planet Resource Index */}
      {resourceRows.length > 0 && (
        <div className="mining-resource-index">
          <div className="mdet-section-label">
            PLANET RESOURCE INDEX
            <span className="mdet-section-count">({resourceRows.length} resource{resourceRows.length !== 1 ? "s" : ""})</span>
          </div>
          <table className="mining-resource-index-table">
            <thead>
              <tr>
                <th>MATERIAL</th>
                <th>TYPE</th>
                <th>QUALITY FIT</th>
                <th>YIELD FIT</th>
                <th>SOURCE</th>
              </tr>
            </thead>
            <tbody>
              {resourceRows.map((row) => (
                <tr key={row.key} className={`mining-resource-row mining-resource-row--${row.status}`}>
                  <td className="mdet-mat-name">{row.name}</td>
                  <td className="mdet-mat-demand">{row.miningType || "—"}</td>
                  <td className={`mdet-mat-score ${scoreToneClass(undefined, row.qualityFit ?? undefined)}`}>
                    {row.qualityFit ?? "—"}
                  </td>
                  <td className={`mdet-mat-score ${scoreToneClass(undefined, row.yieldFit ?? undefined)}`}>
                    {row.yieldFit ?? "—"}
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

  const materialOptionByKey = useMemo(
    () => new Map(allMaterialResources.map((r) => [r.id, r])),
    [allMaterialResources],
  );

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
          console.debug("active buildQueue demand count", recommenderRequiredMaterials.length);
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

  const materialKeyByDisplayName = useMemo(() => {
    const resolve = createMaterialResolver(materials);
    return new Map(allMaterials.map((name) => [name, resolve({ displayName: name, materialName: name })?.materialKey ?? name]));
  }, [allMaterials, materials]);

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

  const listLocations = showAllLocations ? rankedFilteredLocations : rankedFilteredLocations.slice(0, 12);

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

      {state.status === "ok" && (
        <>
          {/* ── Top filter rail ──────────────────────────────────── */}
          <div className="mining-filter-rail">

            {/* Left column: System + Mode */}
            <div className="mining-filter-group mining-filter-group--left">
              <span className="mining-filter-label">System</span>
              <div className="mining-chip-row">
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
              <div className="mining-chip-row">
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
            </div>

            {/* Center column: categorized mineables — each category is a grid column */}
            <div className="mining-filter-group--mineables">
              {resourceGroups.shipAndHarvestable.length > 0 && (
                <div className="mining-filter-category">
                  <span className="mining-filter-label">Ship Mineables</span>
                  <div className="mining-chip-wrap">
                    {resourceGroups.shipAndHarvestable.map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        className={`mfr-chip${selectedMaterials.has(chip.id) ? " mfr-chip--active" : ""}`}
                        onClick={() => toggleMaterial(chip.id)}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {resourceGroups.vehicle.length > 0 && (
                <div className="mining-filter-category">
                  <span className="mining-filter-label">Vehicle</span>
                  <div className="mining-chip-wrap">
                    {resourceGroups.vehicle.map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        className={`mfr-chip${selectedMaterials.has(chip.id) ? " mfr-chip--active" : ""}`}
                        onClick={() => toggleMaterial(chip.id)}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {resourceGroups.hand.length > 0 && (
                <div className="mining-filter-category">
                  <span className="mining-filter-label">Hand</span>
                  <div className="mining-chip-wrap">
                    {resourceGroups.hand.map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        className={`mfr-chip${selectedMaterials.has(chip.id) ? " mfr-chip--active" : ""}`}
                        onClick={() => toggleMaterial(chip.id)}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right actions */}
            {hasActiveFilters && (
              <div className="mining-filter-actions">
                <button type="button" className="mfr-clear-btn" onClick={clearAllFilters}>
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* ── Main 3-column console ───────────────────────────── */}
          {filteredLocations.length === 0 ? (
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
                  <span className="mlist-header-count">{filteredLocations.length}</span>
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
                  {listLocations.map((entry, idx) => (
                    <LocationListItem
                      key={entry.locationKey}
                      rank={filteredLocations.findIndex((item) => item.locationKey === entry.locationKey) + 1}
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
                  {filteredLocations.length > 12 && (
                    <button
                      className="mlist-view-all-btn"
                      onClick={() => setShowAllLocations((p) => !p)}
                    >
                      {showAllLocations
                        ? "Show top 12 ↑"
                        : `View all ${filteredLocations.length} locations ↓`}
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
