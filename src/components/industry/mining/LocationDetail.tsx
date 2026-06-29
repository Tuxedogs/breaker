import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { PublicLocationEntry, RequiredMaterial } from "../../../features/mining/types";
import { canonicalMiningMaterial, canonicalMiningMaterialKey } from "../../../features/mining/materialIdentity";
import {
  getStaticEncounterRankingRow,
  getStaticLocationAttemptedJoinKeys,
  getStaticLocationDisplayName,
  getStaticMaterialQualityRow,
  getStaticMethodBiasForLocation,
  getStaticResourcesForLocation,
  type StaticMiningIndex,
} from "../../../features/mining/staticMiningIndex";
import type { CoveragePlan } from "../../../features/mining/coveragePlan";

import {
  buildDemandRows,
  buildResourceRows,
  formatPercent,
  methodBiasToneClass,
  miningMethodBadge,
  qualityChanceHeader,
  resourceRowMaterialKey,
  scoreToneClass,
  systemBadgeClass,
} from "./miningFormatters";
import type { DemandRow, ResourceRow } from "./miningTypes";
import { MaterialNameCell } from "./MiningShared";
import StantonLagrangeChildrenSummary from "./StantonLagrangeChildrenSummary";
import { hasStantonLagrangeChildren } from "./stantonLagrangeChildren";

export function InfoTip({ text, children }: { text: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [desktopPosition, setDesktopPosition] = useState<{ top: number; left: number; maxWidth: number } | null>(null);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      if (!wrapRef.current || typeof window === "undefined") return;
      if (window.innerWidth <= 760) {
        setDesktopPosition(null);
        return;
      }
      const triggerRect = wrapRef.current.getBoundingClientRect();
      const popoverHeight = popoverRef.current?.offsetHeight ?? 120;
      const viewportPadding = 12;
      const gap = 8;
      const maxWidth = Math.min(280, window.innerWidth - viewportPadding * 2);
      const centeredLeft = triggerRect.left + triggerRect.width / 2 - maxWidth / 2;
      const left = Math.min(
        Math.max(viewportPadding, centeredLeft),
        Math.max(viewportPadding, window.innerWidth - maxWidth - viewportPadding),
      );
      const placeBelow = triggerRect.bottom + gap + popoverHeight <= window.innerHeight - viewportPadding;
      const top = placeBelow
        ? Math.min(window.innerHeight - popoverHeight - viewportPadding, triggerRect.bottom + gap)
        : Math.max(viewportPadding, triggerRect.top - popoverHeight - gap);
      setDesktopPosition({ top, left, maxWidth });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (wrapRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const popover = open && typeof document !== "undefined"
    ? createPortal(
      <div
        ref={popoverRef}
        id={tooltipId}
        className="mdet-infotip-popover mdet-infotip-popover--portal"
        role="tooltip"
        style={desktopPosition ? { top: `${desktopPosition.top}px`, left: `${desktopPosition.left}px`, maxWidth: `${desktopPosition.maxWidth}px` } : undefined}
      >
        {text}
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      <span
        ref={wrapRef}
        className="mdet-infotip-wrap"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <button
          type="button"
          className="mdet-infotip"
          aria-label={text}
          aria-describedby={open ? tooltipId : undefined}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          onFocus={() => setOpen(true)}
          onBlur={(event) => {
            const relatedTarget = event.relatedTarget as Node | null;
            if (relatedTarget && wrapRef.current?.contains(relatedTarget)) return;
            if (relatedTarget && popoverRef.current?.contains(relatedTarget)) return;
            setOpen(false);
          }}
        >
          {children}
        </button>
      </span>
      {popover}
    </>
  );
}

function qualityProbabilityTooltip(qualityLabel: string) {
  const qualityThreshold = qualityLabel.replace("+", "");
  return `Probability that when you find a material, it is over ${qualityThreshold} quality.`;
}

function MiningSourceBadge({
  status,
  densityLabel,
  sourceWeight,
  title,
}: {
  status: DemandRow["status"] | ResourceRow["status"];
  densityLabel: string;
  sourceWeight: number | undefined;
  title?: string;
}) {
  return (
    <span className={`mining-source-badge mining-source-badge--${status}`} title={title}>
      {densityLabel}
      {sourceWeight !== undefined && (
        <span className="mdet-source-bar-wrap">
          <span className="mdet-source-bar" style={{ width: `${Math.min(100, sourceWeight)}%` }} />
        </span>
      )}
    </span>
  );
}

function MiningMethodDemandCell({ value }: { value: string | null | undefined }) {
  const badge = miningMethodBadge(value);
  if (badge) return <span className={`mloc-badge ${badge.className}`}>{badge.label}</span>;
  return <span>{value || "Unknown"}</span>;
}

function MiningMobileStat({ label, value, toneClass }: { label: string; value: string; toneClass?: string }) {
  return (
    <div className="mdet-mobile-stat">
      <span className="mdet-mobile-stat-label">{label}</span>
      <strong className={toneClass}>{value}</strong>
    </div>
  );
}

function MobileMaterialStatusPill({
  label,
  status,
}: {
  label: string;
  status: DemandRow["status"] | ResourceRow["status"];
}) {
  return (
    <span className={`mdet-mobile-status-pill mdet-mobile-status-pill--${status}`}>
      {label}
    </span>
  );
}

function MiningMobileMaterialCard({
  row,
  mode,
  qualityHeader,
}: {
  row: DemandRow | ResourceRow;
  mode: "demand" | "resource";
  qualityHeader: string;
}) {
  const methodValue = mode === "demand"
    ? (row as DemandRow).coverage === "Missing"
      ? "Missing"
      : row.miningType
    : row.miningType || "Unknown";
  const methodBadge = miningMethodBadge(methodValue);
  const methodLabel = methodBadge?.label ?? (methodValue || "Unknown");
  const primaryQualityLabel = mode === "demand"
    ? (row as DemandRow).targetQualityChanceLabel
    : (row as ResourceRow).qualityLabel;

  return (
    <article className={`mdet-mobile-material-card mining-resource-row--${row.status}`}>
      <div className="mdet-mobile-material-main">
        <div className="mdet-mobile-material-head">
          <div className="mdet-mobile-material-title">
            <MaterialNameCell name={row.name} miningMethod={row.miningType} iconSize={18} />
          </div>
        </div>
        <div className="mdet-mobile-material-meta">
          <span className={`mdet-mobile-source-chip${methodBadge ? ` mloc-badge ${methodBadge.className}` : ""}`}>
            {methodLabel}
          </span>
          <MobileMaterialStatusPill label={row.densityLabel} status={row.status} />
        </div>
      </div>
      <div
        className="mdet-mobile-stat-grid"
        title={"sourceTitle" in row ? row.sourceTitle : undefined}
      >
        <MiningMobileStat label={qualityHeader} value={primaryQualityLabel} />
        <MiningMobileStat label="900+ Quality" value={row.quality900Label} />
        <MiningMobileStat label="Composition" value={row.compositionLabel} />
      </div>
    </article>
  );
}

function MiningMobileMaterialList({
  rows,
  mode,
  qualityHeader,
}: {
  rows: Array<DemandRow | ResourceRow>;
  mode: "demand" | "resource";
  qualityHeader: string;
}) {
  return (
    <div className="mdet-mobile-material-list">
      {rows.map((row) => (
        <MiningMobileMaterialCard
          key={row.key}
          row={row}
          mode={mode}
          qualityHeader={qualityHeader}
        />
      ))}
    </div>
  );
}

export function LocationDetail({
  entry,
  activeDemandMaterials,
  buildQueueMaterialKeys,
  locationMaterialKeys,
  staticMiningIndex,
  hideHeader = false,
}: {
  entry: PublicLocationEntry;
  activeDemandMaterials: RequiredMaterial[];
  buildQueueMaterialKeys: Set<string>;
  locationMaterialKeys: string[];
  staticMiningIndex: StaticMiningIndex | null;
  hideHeader?: boolean;
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
  const selectedDemandMaterialCount = activeDemandMaterials.length;
  const hasSingleDemandMaterial = selectedDemandMaterialCount === 1 && demandRows.length === 1;
  const hasMultipleDemandMaterials = selectedDemandMaterialCount > 1;
  const selectedDemandRow = hasSingleDemandMaterial ? demandRows[0] : null;
  const singleDemandMethodLabel = selectedDemandRow?.coverage === "Missing"
    ? "Missing"
    : selectedDemandRow?.miningType || "Unknown";

  return (
    <div className={`mdet-panel${hideHeader ? " mdet-panel--inline-mobile" : ""}`}>
      {!hideHeader && (
        <div className="mdet-header">
          <div className="mdet-header-left">
            <div className="mdet-label">SELECTED LOCATION</div>
            <div className="mdet-name" title={locationDisplayName !== entry.locationName ? `Raw key: ${entry.locationName}` : undefined}>
              {locationDisplayName}
            </div>
            <div className="mdet-meta">
              {!isLagrangeChildGroup && (
                <span className={`mloc-system-badge ${systemBadgeClass(entry.systemName)}`}>{entry.systemName}</span>
              )}
              <StantonLagrangeChildrenSummary entry={entry} compact />
            </div>
          </div>
        </div>
      )}

      <div className="location-stat-chip-grid">
        {!hasMultipleDemandMaterials && total > 0 && (
          <div className="location-stat-chip">
            <div className="location-stat-label"><InfoTip text="Selected material coverage is tracked separately from Fit. Missing materials do not lower Encounter Tier or covered-material Fit.">COVERAGE</InfoTip></div>
            <div className={`location-stat-value ${coveragePct === 100 ? "mloc-score--best" : coveragePct > 0 ? "mloc-score--okay" : "mloc-score--poor"}`}>{coveredBQ.length} / {total}</div>
          </div>
        )}

        {hasMultipleDemandMaterials && (
          <>
            <div className="location-stat-chip">
              <div className="location-stat-label">COVERED</div>
              <div className={`location-stat-value ${coveredBQ.length > 0 ? "mloc-score--best" : "mloc-score--poor"}`}>{coveredBQ.length}</div>
            </div>
            <div className="location-stat-chip">
              <div className="location-stat-label">MISSING</div>
              <div className={`location-stat-value ${missingBQ.length > 0 ? "mloc-score--poor" : "mloc-score--best"}`}>{missingBQ.length}</div>
            </div>
          </>
        )}

        {hasSingleDemandMaterial && selectedDemandRow && (
          <>
            <div className="location-stat-chip">
              <div className="location-stat-label"><InfoTip text="Mining method for the selected material at this location.">METHOD</InfoTip></div>
              <div className="location-stat-value">{singleDemandMethodLabel}</div>
            </div>
            <div className="location-stat-chip">
              <div className="location-stat-label"><InfoTip text="Bucketed encounter strength for the selected material at this location.">ENCOUNTER TIER</InfoTip></div>
              <div className={`location-stat-value ${scoreToneClass(undefined, selectedDemandRow.sourceWeight)}`}>{selectedDemandRow.densityLabel}</div>
            </div>
            <div className="location-stat-chip">
              <div className="location-stat-label"><InfoTip text={qualityProbabilityTooltip(qualityHeader)}>{qualityHeader}</InfoTip></div>
              <div className="location-stat-value">{selectedDemandRow.targetQualityChanceLabel}</div>
            </div>
            <div className="location-stat-chip">
              <div className="location-stat-label"><InfoTip text={qualityProbabilityTooltip("900+")}>900+</InfoTip></div>
              <div className="location-stat-value">{selectedDemandRow.quality900Label}</div>
            </div>
            <div className="location-stat-chip">
              <div className="location-stat-label"><InfoTip text="Average material composition inside an encountered source for the selected material. This is not encounter chance.">COMPOSITION / YIELD</InfoTip></div>
              <div className="location-stat-value">{selectedDemandRow.compositionLabel}</div>
            </div>
          </>
        )}

        {locationMethodMixItems.map((item) => (
          <div key={`method-mix:${item.method}`} className="location-stat-chip">
            <div className="location-stat-label"><InfoTip text="Location-wide mining method distribution at this location.">{item.method.toUpperCase()}</InfoTip></div>
            <div className={`location-stat-value ${methodBiasToneClass(item.share)}`} title={`Location Method Mix: ${item.method} ${formatPercent(item.share)}`}>{formatPercent(item.share)}</div>
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

  
      {demandRows.length > 0 && (
        <div className="mining-demand-breakdown">
          <table className="mining-resource-index-table">
            <colgroup>
              <col className="mining-resource-col--material" /><col className="mining-resource-col--method" />
              <col className="mining-resource-col--encounter" /><col className="mining-resource-col--quality" />
              <col className="mining-resource-col--quality" /><col className="mining-resource-col--yield" />
            </colgroup>
            <thead>
              <tr>
                <th>Material</th><th>Method</th>
                <th><span className="mdet-th-wrap"><InfoTip text="Bucketed encounter strength for this material at this location: Low, Medium, or High.">Encounter Tier</InfoTip></span></th>
                <th><span className="mdet-th-wrap"><InfoTip text={qualityProbabilityTooltip(qualityHeader)}>{qualityHeader}</InfoTip></span></th>
                <th><span className="mdet-th-wrap"><InfoTip text={qualityProbabilityTooltip("900+")}>900+</InfoTip></span></th>
                <th><span className="mdet-th-wrap"><InfoTip text="Average material composition inside an encountered source. This is not encounter chance.">Composition</InfoTip></span></th>
              </tr>
            </thead>
            <tbody>
              {coveredDemandRows.map((row) => (
                <tr key={row.key} className={`mining-resource-row mining-resource-row--${row.status}`}>
                  <td className="mdet-mat-name"><MaterialNameCell name={row.name} miningMethod={row.miningType} /></td>
                  <td className="mdet-mat-demand"><MiningMethodDemandCell value={row.coverage === "Missing" ? "Missing" : row.miningType} /></td>
                  <td><MiningSourceBadge status={row.status} densityLabel={row.densityLabel} sourceWeight={row.sourceWeight} /></td>
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
                  <td className="mdet-mat-demand"><MiningMethodDemandCell value={row.coverage === "Missing" ? "Missing" : row.miningType} /></td>
                  <td><MiningSourceBadge status={row.status} densityLabel={row.densityLabel} sourceWeight={row.sourceWeight} /></td>
                  <td className="mdet-mat-score">{row.targetQualityChanceLabel}</td>
                  <td className="mdet-mat-score">{row.compositionLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <MiningMobileMaterialList rows={coveredDemandRows} mode="demand" qualityHeader={qualityHeader} />
          {missingDemandRows.length > 0 && (
            <div className="mdet-mobile-missing-block">
              <button type="button" className="mining-missing-material-toggle" onClick={() => setShowMissingDemandRows((o) => !o)} aria-expanded={showMissingDemandRows}>
                <span>{showMissingDemandRows ? "Hide" : "Show"} Missing Material</span>
                <strong>{missingDemandRows.length}</strong>
              </button>
              {showMissingDemandRows && (
                <MiningMobileMaterialList rows={missingDemandRows} mode="demand" qualityHeader={qualityHeader} />
              )}
            </div>
          )}
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
                <th><span className="mdet-th-wrap"><InfoTip text="Bucketed encounter strength for this material at this location: Low, Medium, or High.">Encounter Tier</InfoTip></span></th>
                <th><span className="mdet-th-wrap"><InfoTip text={qualityProbabilityTooltip("800+")}>800+</InfoTip></span></th>
                <th><span className="mdet-th-wrap"><InfoTip text={qualityProbabilityTooltip("900+")}>900+</InfoTip></span></th>
                <th><span className="mdet-th-wrap"><InfoTip text="Average material composition inside an encountered source. This is not encounter chance.">Composition</InfoTip></span></th>
              </tr>
            </thead>
            <tbody>
              {otherLocationMaterialRows.map((row) => (
                <tr key={row.key} className={`mining-resource-row mining-resource-row--${row.status}`}>
                  <td className="mdet-mat-name"><MaterialNameCell name={row.name} miningMethod={row.miningType} /></td>
                  <td className="mdet-mat-demand"><MiningMethodDemandCell value={row.miningType || "Unknown"} /></td>
                  <td><MiningSourceBadge status={row.status} densityLabel={row.densityLabel} sourceWeight={row.sourceWeight} title={row.sourceTitle} /></td>
                  <td className="mdet-mat-score">{row.qualityLabel}</td>
                  <td className="mdet-mat-score">{row.quality900Label}</td>
                  <td className="mdet-mat-score">{row.compositionLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <MiningMobileMaterialList rows={otherLocationMaterialRows} mode="resource" qualityHeader="800+" />
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
