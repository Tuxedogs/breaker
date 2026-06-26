import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicLocationEntry, RequiredMaterial } from "../../../features/mining/types";
import { canonicalMiningMaterial, canonicalMiningMaterialKey } from "../../../features/mining/materialIdentity";
import {
  getStaticDensityScore,
  getStaticEncounterRankingRow,
  getStaticLocationAttemptedJoinKeys,
  getStaticLocationDisplayName,
  getStaticMaterialQualityRow,
  getStaticMethodBiasForLocation,
  getStaticMaterialKey,
  getStaticResourcesForLocation,
  type StaticMiningIndex,
} from "../../../features/mining/staticMiningIndex";
import type { CoveragePlan } from "../../../features/mining/coveragePlan";

import {
  buildDemandRows,
  buildResourceRows,
  buildQualityDisplay,
  encounterSignalFromWeight,
  formatEncounterTier,
  formatPercent,
  methodBiasToneClass,
  qualityChanceHeader,
  qualityChanceTooltip,
  qualitySourceFamilyDisplayLabel,
  qualitySourceScopeDisplayLabel,
  resourceRowMaterialKey,
  scoreToneClass,
  spawnTypeBadgeClass,
  spawnTypeLabel,
  systemBadgeClass,
} from "./miningFormatters";
import type { ResourceRow } from "./miningTypes";
import { MaterialNameCell } from "./MiningShared";
import StantonLagrangeChildrenSummary from "./StantonLagrangeChildrenSummary";
import { hasStantonLagrangeChildren } from "./stantonLagrangeChildren";

export function InfoTip({ text }: { text: string }) {
  return (
    <details className="mdet-infotip-wrap">
      <summary className="mdet-infotip" aria-label={text}>?</summary>
      <div className="mdet-infotip-popover">{text}</div>
    </details>
  );
}

export function LocationDetail({
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
    [locationMaterialKeys, buildQueueMaterialKeys],
  );
  const missingBQ = useMemo(
    () => [...buildQueueMaterialKeys].filter((key) => !locationMaterialKeys.includes(key)),
    [locationMaterialKeys, buildQueueMaterialKeys],
  );
  const total = coveredBQ.length + missingBQ.length;
  const coveragePct = total > 0 ? Math.round((coveredBQ.length / total) * 100) : 0;
  const primaryRouteScore = entry.routeScores?.[0] ?? null;
  const debugJoinLogKeyRef = useRef<string | null>(null);

  const staticResourceRows = useMemo(
    () => getStaticResourcesForLocation(entry, staticMiningIndex),
    [entry, staticMiningIndex],
  );

  // Normalize demand materials to a key→material map
  const demandMaterialByKey = useMemo(() => {
    const map = new Map<string, RequiredMaterial>();
    for (const material of activeDemandMaterials) {
      const canonical = canonicalMiningMaterial({
        materialKey: material.materialKey,
        materialId: material.materialId,
        displayName: material.displayName,
        materialName: material.materialName,
      });
      if (canonical.unresolvedUuid || !canonical.key) continue;
      map.set(canonical.key, material);
    }
    return map;
  }, [activeDemandMaterials]);

  const demandedStaticRowsForInsights = useMemo(
    () => staticResourceRows.filter((row) => buildQueueMaterialKeys.has(getStaticMaterialKey(row))),
    [buildQueueMaterialKeys, staticResourceRows],
  );

  const insights = useMemo(() => {
    const list: Array<{ type: "positive" | "warning" | "neutral"; text: string }> = [];
    const encounterWeights = demandedStaticRowsForInsights
      .map((row) => getStaticDensityScore(row, staticMiningIndex))
      .filter((w): w is number => typeof w === "number" && Number.isFinite(w));
    const avg = encounterWeights.length > 0
      ? encounterWeights.reduce((sum, w) => sum + w, 0) / encounterWeights.length
      : undefined;
    const signal = encounterSignalFromWeight(avg);
    if (signal !== "Unknown") {
      list.push({ type: avg !== undefined && avg < 60 ? "warning" : "positive", text: `${signal} average encounter tier for covered demand materials` });
    }
    if (entry.nearbyStations.length > 0) {
      list.push({ type: "positive", text: `${entry.nearbyStations.length} nearby station${entry.nearbyStations.length > 1 ? "s" : ""} for refined ore delivery` });
    }
    if (missingBQ.length > 0) {
      list.push({ type: "warning", text: `${missingBQ.length} demanded material${missingBQ.length > 1 ? "s" : ""} not covered at this location` });
    }
    return list;
  }, [missingBQ, demandedStaticRowsForInsights, staticMiningIndex, entry.nearbyStations]);

  // Pure transform — no hooks inside
  const demandRows = useMemo(
    () => buildDemandRows(entry, buildQueueMaterialKeys, locationMaterialKeys, demandMaterialByKey, staticResourceRows, staticMiningIndex),
    [entry, buildQueueMaterialKeys, locationMaterialKeys, demandMaterialByKey, staticResourceRows, staticMiningIndex],
  );

  const resourceRows = useMemo(
    () => buildResourceRows(entry, staticResourceRows, staticMiningIndex),
    [entry, staticResourceRows, staticMiningIndex],
  );

  const [showMissingDemandRows, setShowMissingDemandRows] = useState(false);
  const coveredDemandRows = useMemo(() => demandRows.filter((r) => r.status !== "missing"), [demandRows]);
  const missingDemandRows = useMemo(() => demandRows.filter((r) => r.status === "missing"), [demandRows]);

  // Dev-mode logging
  useEffect(() => {
    if (!import.meta.env.DEV || !staticMiningIndex || staticResourceRows.length > 0) return;
    const attemptedJoinKeys = getStaticLocationAttemptedJoinKeys(entry);
    const displayLookupKey = entry.locationName.trim().toLowerCase().replace(/\s+/g, " ");
    if (!staticMiningIndex.locationKeysByDisplayName.get(displayLookupKey)?.includes(entry.locationKey)) {
      console.warn("[mining] selected location display name could not resolve to locationKey", { locationKey: entry.locationKey, locationDisplayName: entry.locationName, materialId: undefined, materialName: undefined, source: "LocationDetail location_hierarchy join" });
    }
    console.warn("[mining] no static resources matched selected location", { systemName: entry.systemName, locationName: entry.locationName, locationKey: entry.locationKey, materialId: undefined, materialName: undefined, attemptedJoinKeys, source: "LocationDetail from location_material_index.json" });
    if ((entry.indexedResources?.length ?? 0) > 0 || entry.materials.length > 0) {
      console.warn("[mining] selected location has recommender data but no static index rows", { systemName: entry.systemName, locationName: entry.locationName, locationKey: entry.locationKey, indexedResources: entry.indexedResources?.length ?? 0, materials: entry.materials.length });
    }
  }, [entry, staticMiningIndex, staticResourceRows.length]);

  useEffect(() => {
    if (!import.meta.env.DEV || !staticMiningIndex) return;
    const row = staticResourceRows[0];
    if (!row) return;
    const logKey = `${entry.locationKey}:${row.materialId}:${row.materialName}:${row.resolvedMineableClass}`;
    if (debugJoinLogKeyRef.current === logKey) return;
    debugJoinLogKeyRef.current = logKey;
    console.debug("[mining] selected material static index join", { locationKey: entry.locationKey, locationName: entry.locationName, locationDisplayName: row.locationDisplayName, materialName: row.materialName, materialId: row.materialId, matchedLocationMaterialRow: row, matchedEncounterRankingRow: getStaticEncounterRankingRow(row, staticMiningIndex), matchedQualityRow: getStaticMaterialQualityRow(row, staticMiningIndex), qualityIndexLoaded: staticMiningIndex.qualityRows.length, distributionIndexLoaded: staticMiningIndex.distributionRows.length });
  }, [entry, staticMiningIndex, staticResourceRows]);

  const locationDisplayName = getStaticLocationDisplayName(entry, staticMiningIndex);
  const isLagrangeChildGroup = hasStantonLagrangeChildren(entry);
  const locationMethodMixItems = useMemo(
    () => getStaticMethodBiasForLocation(entry, staticMiningIndex)
      .filter((item) => Number.isFinite(item.share) && item.share > 0)
      .sort((a, b) => b.share - a.share),
    [entry, staticMiningIndex],
  );
  const hasBuildQueueTarget = buildQueueMaterialKeys.size > 0;
  const hasSelectedQualityTarget = activeDemandMaterials.some((m) => m.selectedQuality !== undefined);
  const qualityHeader = qualityChanceHeader(hasSelectedQualityTarget);
  const primaryQualitySignals = primaryRouteScore?.signals;
  const qualitySourceDetails = primaryQualitySignals?.qualitySourceScope
    ? ` Source: ${qualitySourceScopeDisplayLabel(primaryQualitySignals.qualitySourceScope)}${primaryQualitySignals.qualitySourceFamily ? ` / ${qualitySourceFamilyDisplayLabel(primaryQualitySignals.qualitySourceFamily)}` : ""}.`
    : "";
  const qualityTooltip = `${qualityChanceTooltip(hasSelectedQualityTarget)}${qualitySourceDetails}`;
  const demandedMaterialKeys = useMemo(
    () => new Set(demandRows.map((row) => canonicalMiningMaterialKey(row.key))),
    [demandRows],
  );
  const otherLocationMaterialRows = useMemo(() => {
    const rows = hasBuildQueueTarget
      ? resourceRows.filter((row) => !demandedMaterialKeys.has(resourceRowMaterialKey(row)))
      : resourceRows;
    const byMaterial = new Map<string, ResourceRow>();
    for (const row of rows) {
      const key = resourceRowMaterialKey(row);
      const existing = byMaterial.get(key);
      if (!existing || (row.sourceWeight ?? -1) > (existing.sourceWeight ?? -1)) byMaterial.set(key, row);
    }
    return [...byMaterial.values()];
  }, [demandedMaterialKeys, hasBuildQueueTarget, resourceRows]);

  const materialProfileTitle = hasBuildQueueTarget ? "OTHER MATERIALS AT THIS LOCATION" : "MATERIAL PROFILE";
  const coveredEncounterScores = demandRows
    .filter((row) => row.coverage !== "Missing" && typeof row.sourceWeight === "number" && Number.isFinite(row.sourceWeight))
    .map((row) => row.sourceWeight as number);
  const encounterTierScore = coveredEncounterScores.length > 0
    ? coveredEncounterScores.reduce((sum, s) => sum + s, 0) / coveredEncounterScores.length
    : primaryRouteScore?.yieldRouteScore;

  return (
    <div className="mdet-panel">
      <div className="mdet-header">
        <div className="mdet-header-left">
          <div className="mdet-label">SELECTED LOCATION</div>
          <div className="mdet-name" title={locationDisplayName !== entry.locationName ? `Raw key: ${entry.locationName}` : undefined}>
            {locationDisplayName}
          </div>
          <StantonLagrangeChildrenSummary entry={entry} />
          {!isLagrangeChildGroup && (
            <div className="mdet-meta">
              <span className={`mloc-system-badge ${systemBadgeClass(entry.systemName)}`}>{entry.systemName}</span>
              <span className={`mloc-badge ${spawnTypeBadgeClass(entry.spawnType)}`}>{spawnTypeLabel(entry.spawnType)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mdet-metric-row">
        {total > 0 && (
          <div className="mdet-metric-card">
            <div className="mdet-metric-label">COVERAGE<InfoTip text="Selected material coverage is tracked separately from Fit. Missing materials do not lower Encounter Tier or covered-material Fit." /></div>
            <div className={`mdet-metric-val ${coveragePct === 100 ? "mloc-score--best" : coveragePct > 0 ? "mloc-score--okay" : "mloc-score--poor"}`}>{coveredBQ.length} / {total}</div>
          </div>
        )}
        {primaryRouteScore && (() => {
          const qd = buildQualityDisplay(primaryRouteScore.signals, primaryRouteScore.materialKey ?? primaryRouteScore.materialId ?? "");
          return qd.kind !== "none" ? (
            <div className="mdet-metric-card">
              <div className="mdet-metric-label">{qualityHeader}<InfoTip text={qualityTooltip} /></div>
              <div className="mdet-metric-val">{qd.kind === "ignored" ? "N/A" : qd.label}</div>
            </div>
          ) : null;
        })()}
        {typeof encounterTierScore === "number" && Number.isFinite(encounterTierScore) && (
          <div className="mdet-metric-card">
            <div className="mdet-metric-label">ENCOUNTER TIER<InfoTip text="Bucketed encounter strength for covered selected materials only. Missing materials affect Coverage, not this tier." /></div>
            <div className={`mdet-metric-val ${scoreToneClass(undefined, encounterTierScore)}`}>{formatEncounterTier(encounterTierScore)}</div>
          </div>
        )}
        {locationMethodMixItems.map((item) => (
          <div key={`method-mix:${item.method}`} className="mdet-metric-card">
            <div className="mdet-metric-label">{item.method.toUpperCase()}<InfoTip text="Location-wide mining method mix. This does not necessarily describe the selected material." /></div>
            <div className={`mdet-metric-val ${methodBiasToneClass(item.share)}`} title={`Location Method Mix: ${item.method} ${formatPercent(item.share)}`}>{formatPercent(item.share)}</div>
          </div>
        ))}
      </div>

      {entry.nearbyStations.length > 0 && (
        <div className="mdet-stations">
          <span className="mdet-stations-label">Nearby</span>
          {entry.nearbyStations.map((s, i) => (
            <span key={`${entry.locationKey}:nearby:${s}:${i}`} className="mloc-station-chip">{s}</span>
          ))}
        </div>
      )}

      {insights.length > 0 && (
        <div className="mdet-insights">
          <div className="mdet-section-label">LOCATION INSIGHTS</div>
          <div className="mdet-insights-list">
            {insights.map((insight, i) => (
              <div key={i} className={`mdet-insight mdet-insight--${insight.type}`}>
                <span className="mdet-insight-icon">{insight.type === "positive" ? "+" : insight.type === "warning" ? "△" : "·"}</span>
                <span className="mdet-insight-text">{insight.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {demandRows.length > 0 && (
        <div className="mining-demand-breakdown">
          <div className="mdet-section-label">
            SELECTED MATERIAL COVERAGE
            <span className="mdet-section-count">({demandRows.length} material{demandRows.length !== 1 ? "s" : ""})</span>
          </div>
          <table className="mining-resource-index-table">
            <colgroup>
              <col className="mining-resource-col--material" /><col className="mining-resource-col--method" />
              <col className="mining-resource-col--encounter" /><col className="mining-resource-col--quality" />
              <col className="mining-resource-col--quality" /><col className="mining-resource-col--yield" />
            </colgroup>
            <thead>
              <tr>
                <th>Material</th><th>Method</th>
                <th><span className="mdet-th-wrap">Encounter Tier<InfoTip text="Bucketed encounter strength for this material at this location: Low, Medium, or High." /></span></th>
                <th><span className="mdet-th-wrap">{qualityHeader}<InfoTip text={qualityTooltip} /></span></th>
                <th>900+ Quality</th>
                <th><span className="mdet-th-wrap">Composition / Yield<InfoTip text="Average material composition inside an encountered source. This is not encounter chance." /></span></th>
              </tr>
            </thead>
            <tbody>
              {coveredDemandRows.map((row) => (
                <tr key={row.key} className={`mining-resource-row mining-resource-row--${row.status}`}>
                  <td className="mdet-mat-name"><MaterialNameCell name={row.name} miningMethod={row.miningType} /></td>
                  <td className="mdet-mat-demand">{row.coverage === "Missing" ? "Missing" : row.miningType}</td>
                  <td><span className={`mining-source-badge mining-source-badge--${row.status}`}>{row.densityLabel}{row.sourceWeight !== undefined && <span className="mdet-source-bar-wrap"><span className="mdet-source-bar" style={{ width: `${Math.min(100, row.sourceWeight)}%` }} /></span>}</span></td>
                  <td className="mdet-mat-score">{row.targetQualityChanceLabel}</td>
                  <td className="mdet-mat-score">{row.quality900Label}</td>
                  <td className="mdet-mat-score">{row.compositionLabel}</td>
                </tr>
              ))}
              {missingDemandRows.length > 0 && (
                <tr className="mining-resource-row mining-resource-row--missing-toggle">
                  <td colSpan={6}>
                    <button type="button" className="mining-missing-material-toggle" onClick={() => setShowMissingDemandRows((o) => !o)} aria-expanded={showMissingDemandRows}>
                      <span>{showMissingDemandRows ? "Hide" : "Show"} Missing Material</span>
                      <strong>{missingDemandRows.length}</strong>
                    </button>
                  </td>
                </tr>
              )}
              {showMissingDemandRows && missingDemandRows.map((row) => (
                <tr key={row.key} className={`mining-resource-row mining-resource-row--${row.status}`}>
                  <td className="mdet-mat-name"><MaterialNameCell name={row.name} miningMethod={row.miningType} /></td>
                  <td className="mdet-mat-demand">{row.coverage === "Missing" ? "Missing" : row.miningType}</td>
                  <td><span className={`mining-source-badge mining-source-badge--${row.status}`}>{row.densityLabel}{row.sourceWeight !== undefined && <span className="mdet-source-bar-wrap"><span className="mdet-source-bar" style={{ width: `${Math.min(100, row.sourceWeight)}%` }} /></span>}</span></td>
                  <td className="mdet-mat-score">{row.targetQualityChanceLabel}</td>
                  <td className="mdet-mat-score">{row.compositionLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {otherLocationMaterialRows.length > 0 && (
        <div className="mining-resource-index">
          <div className="mdet-section-label">
            {materialProfileTitle}
            <span className="mdet-section-count">({otherLocationMaterialRows.length} resource{otherLocationMaterialRows.length !== 1 ? "s" : ""})</span>
          </div>
          <table className="mining-resource-index-table mining-resource-index-table--continuation">
            <colgroup>
              <col className="mining-resource-col--material" /><col className="mining-resource-col--method" />
              <col className="mining-resource-col--encounter" /><col className="mining-resource-col--quality" />
              <col className="mining-resource-col--quality" /><col className="mining-resource-col--yield" />
            </colgroup>
            <thead>
              <tr>
                <th>Material</th><th>Method</th>
                <th><span className="mdet-th-wrap">Encounter Tier<InfoTip text="Bucketed encounter strength for this material at this location: Low, Medium, or High." /></span></th>
                <th>800+ Quality</th>
                <th>900+ Quality</th>
                <th><span className="mdet-th-wrap">Composition / Yield<InfoTip text="Average material composition inside an encountered source. This is not encounter chance." /></span></th>
              </tr>
            </thead>
            <tbody>
              {otherLocationMaterialRows.map((row) => (
                <tr key={row.key} className={`mining-resource-row mining-resource-row--${row.status}`}>
                  <td className="mdet-mat-name"><MaterialNameCell name={row.name} miningMethod={row.miningType} /></td>
                  <td className="mdet-mat-demand">{row.miningType || "Unknown"}</td>
                  <td title={row.sourceTitle}><span className={`mining-source-badge mining-source-badge--${row.status}`}>{row.densityLabel}{row.sourceWeight !== undefined && <span className="mdet-source-bar-wrap"><span className="mdet-source-bar" style={{ width: `${Math.min(100, row.sourceWeight)}%` }} /></span>}</span></td>
                  <td className="mdet-mat-score">{row.qualityLabel}</td>
                  <td className="mdet-mat-score">{row.quality900Label}</td>
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

export function CoveragePlanSummaryPanel({ plan, unfilteredPlan }: { plan: CoveragePlan | null; unfilteredPlan: CoveragePlan | null }) {
  if (!plan || plan.totalMaterials === 0) return null;
  const missingCount = plan.totalMaterials - plan.coveredCount;
  const filteredOutCount = unfilteredPlan ? Math.max(0, unfilteredPlan.coveredCount - plan.coveredCount) : 0;
  const rareMissing = plan.materialRows.filter((r) => r.status === "missing" && r.candidateCount <= 2).slice(0, 3).map((r) => r.displayName);
  const matrixRows = [...plan.materialRows]
    .filter((r) => r.status !== "covered")
    .sort((a, b) => Number(a.status === "covered") - Number(b.status === "covered") || a.candidateCount - b.candidateCount || a.displayName.localeCompare(b.displayName))
    .slice(0, 12);
  return (
    <div className="mcoverage-summary" aria-label="Build queue coverage summary">
      <div className="mcoverage-summary-main">
        <div className="mcoverage-summary-label">Route Coverage</div>
        <div className="mcoverage-summary-title">{plan.summary.headline}</div>
      </div>
      <details className="mcoverage-details">
        <summary>Details</summary>
        <div className="mcoverage-summary-detail">{plan.summary.detail}</div>
        {rareMissing.length > 0 && <div className="mcoverage-warning">Scarce missing materials: {rareMissing.join(", ")}</div>}
        {filteredOutCount > 0 && <div className="mcoverage-warning">Current filters hide coverage for {filteredOutCount} material{filteredOutCount === 1 ? "" : "s"}.</div>}
        <div className="mcoverage-matrix" aria-label="Material coverage matrix">
          <div className="mcoverage-metric"><span>Coverage</span><strong className={plan.coveredPct >= 100 ? "mloc-score--best" : plan.coveredPct > 0 ? "mloc-score--okay" : "mloc-score--poor"}>{plan.coveredPct}%</strong></div>
          {plan.summary.completionText && <div className="mcoverage-metric"><span>Stop</span><strong>{plan.summary.completionText}</strong></div>}
          {plan.summary.noSingleLocationText && <div className="mcoverage-metric"><span>Why Multiple</span><strong>{plan.summary.noSingleLocationText}</strong></div>}
          {missingCount > 0 && <div className="mcoverage-metric mcoverage-metric--warn"><span>Remaining</span><strong>{missingCount}</strong></div>}
          {matrixRows.map((row) => (
            <div key={row.materialKey} className={`mcoverage-cell${row.status === "covered" ? " is-covered" : " is-missing"}`} title={`${row.displayName}: ${row.status === "covered" ? "covered" : "missing"} / ${row.candidateCount} candidate locations`}>
              <span>{row.displayName}</span>
              <strong>{row.status === "covered" ? "Covered" : "Missing"} / {row.candidateCount}</strong>
            </div>
          ))}
          {plan.materialRows.length > matrixRows.length && (
            <div className="mcoverage-cell mcoverage-cell--more"><span>More materials</span><strong>+{plan.materialRows.length - matrixRows.length}</strong></div>
          )}
        </div>
      </details>
    </div>
  );
}
