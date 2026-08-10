import { useEffect, useId, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { PublicLocationEntry, RequiredMaterial } from "../../../features/mining/types";
import { getPlanetAsset, type PlanetAsset } from "../../../features/mining/planetAssets";
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
import {
  buildDemandRows,
  buildResourceRows,
  formatPercent,
  methodBiasToneClass,
  miningMethodBadge,
  qualityChanceHeader,
  resourceRowMaterialKey,
  scoreToneClass,
} from "./miningFormatters";
import type { DemandRow, ResourceRow } from "./miningTypes";
import { MaterialNameCell } from "./MiningShared";
import MiningBookmarkIcon from "./MiningBookmarkIcon";
import StantonLagrangeChildrenSummary from "./StantonLagrangeChildrenSummary";
import { hasStantonLagrangeChildren } from "./stantonLagrangeChildren";
import { useMiningHoverTooltip } from "./MiningHoverTooltip";

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
  const encounterTier = densityLabel.trim().toLowerCase();
  return (
    <span className={`mining-source-text mining-source-text--${status} mining-source-text--tier-${encounterTier}`} title={title}>
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
  return <span className="mdet-method-text">{value || "Unknown"}</span>;
}

function MiningOccurrenceCell({ row }: { row: DemandRow | ResourceRow }) {
  if (row.occurrence.mode === "legacy") {
    return <MiningSourceBadge status={row.status} densityLabel={row.densityLabel} sourceWeight={row.sourceWeight} title={"sourceTitle" in row ? row.sourceTitle : undefined} />;
  }
  const title = `Primary share: ${row.occurrence.primaryRockShareLabel} of primary rocks in this mining pool are ${row.name}. Spawn roll: ${row.occurrence.spawnRollProbabilityLabel} is the chance that one game-data roll selects both the pool and ${row.name}. Location rank: ${row.occurrence.locationRankLabel} among places using the same mining method. These values describe game-data weights, not a guaranteed percentage of scanned rocks.`;
  return (
    <div className="mdet-occurrence" title={title}>
      <strong>{row.occurrence.primaryRockShareLabel} primary</strong>
      <span>{row.occurrence.spawnRollProbabilityLabel} spawn roll</span>
      <span>{row.occurrence.locationRankLabel}</span>
    </div>
  );
}

function TraceMaterialList({ row, mobile = false }: { row: DemandRow | ResourceRow; mobile?: boolean }) {
  if (row.occurrence.mode !== "probability" || row.occurrence.traceMaterials.length === 0) return null;
  return (
    <ul className={`mdet-trace-list${mobile ? " mdet-trace-list--mobile" : ""}`} aria-label={`Trace materials found with ${row.name}`}>
      {row.occurrence.traceMaterials.map((trace) => (
        <li key={`${row.key}:trace:${trace.name}`}>
          <span className="mdet-trace-branch" aria-hidden="true">↳</span>
          <span className="mdet-trace-copy">
            <strong>{trace.name}</strong>
            <span>{trace.compositionRangeLabel} · {trace.qualityRangeLabel}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function MiningMaterialCell({ row }: { row: DemandRow | ResourceRow }) {
  return (
    <div className="mdet-material-cell">
      <MaterialNameCell name={row.name} miningMethod={row.miningType} />
      <TraceMaterialList row={row} />
    </div>
  );
}

function MiningMethodCell({ row, value }: { row: DemandRow | ResourceRow; value: string }) {
  return (
    <div className="mdet-method-cell">
      <MiningMethodDemandCell value={value} />
      {row.occurrence.mode === "probability" && (
        <span className="mdet-method-availability">{row.occurrence.methodAvailabilityLabel} available</span>
      )}
    </div>
  );
}

function MiningMethodIcon({ method }: { method: string }) {
  const normalized = method.toLowerCase();
  if (normalized.includes("vehicle")) {
    return <svg className="mdet-method-icon mdet-method-icon--vehicle" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h16l-2-5H8l-4 5Z" /><path d="M6 14v3m12-3v3" /><circle cx="7" cy="18" r="1.5" /><circle cx="17" cy="18" r="1.5" /></svg>;
  }
  if (normalized.includes("hand")) {
    return <svg className="mdet-method-icon mdet-method-icon--hand" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4 20 9.5 9 20.5 3.5 15 14.5 4Z" /><path d="m9 9 6 6" /></svg>;
  }
  return <svg className="mdet-method-icon mdet-method-icon--ship" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 14 8-9 8 9-8-2-8 2Z" /><path d="M12 12v7M8 19h8" /></svg>;
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
  const probabilityOccurrence = row.occurrence.mode === "probability";

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
          {probabilityOccurrence
            ? <MobileMaterialStatusPill label={`${row.occurrence.primaryRockShareLabel} primary`} status={row.status} />
            : <MobileMaterialStatusPill label={row.densityLabel} status={row.status} />}
        </div>
        <TraceMaterialList row={row} mobile />
      </div>
      <div
        className="mdet-mobile-stat-grid"
        title={"sourceTitle" in row ? row.sourceTitle : undefined}
      >
        {probabilityOccurrence && <MiningMobileStat label="Spawn Roll" value={row.occurrence.spawnRollProbabilityLabel} />}
        {probabilityOccurrence && <MiningMobileStat label="Location Rank" value={row.occurrence.locationRankLabel} />}
        {probabilityOccurrence && <MiningMobileStat label="Method Available" value={row.occurrence.methodAvailabilityLabel} />}
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
  planetAssetMap,
  starred,
  onToggleStar,
  hideHeader = false,
  contextSummary,
}: {
  entry: PublicLocationEntry;
  activeDemandMaterials: RequiredMaterial[];
  buildQueueMaterialKeys: Set<string>;
  locationMaterialKeys: string[];
  staticMiningIndex: StaticMiningIndex | null;
  planetAssetMap?: Map<string, PlanetAsset> | null;
  starred?: boolean;
  onToggleStar?: (e: MouseEvent<HTMLButtonElement>) => void;
  hideHeader?: boolean;
  contextSummary?: {
    scopeLabel: string;
    selectedMaterialCount: number;
    totalMaterialCount: number;
    rankedLocationCount: number;
  };
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

  const coveredDemandRows = useMemo(() => demandRows.filter((r) => r.status !== "missing"), [demandRows]);

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
  const planetAsset = getPlanetAsset(planetAssetMap ?? null, locationDisplayName) ?? getPlanetAsset(planetAssetMap ?? null, entry.locationName);
  const bookmarkTooltip = useMiningHoverTooltip(starred ? "Remove saved" : "Save", { align: "end" });
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

  const materialProfileTitle = hasBuildQueueTarget ? "Other materials at this location" : "Material profile";
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
          <div className="mdet-thumb" aria-hidden="true">
            {planetAsset ? (
              <img
                src={planetAsset.main}
                srcSet={`${planetAsset.main2x} 2x`}
                alt=""
                className="mdet-thumb-img"
              />
            ) : (
              <span className="mdet-thumb-name">{locationDisplayName.slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div className="mdet-header-left">
            <div className="mdet-label">Location Profile</div>
            <div className="mdet-name" title={locationDisplayName !== entry.locationName ? `Raw key: ${entry.locationName}` : undefined}>
              {locationDisplayName}
            </div>
            <div className="mdet-meta">
              {!isLagrangeChildGroup && (
                <span className="mdet-system-text">{entry.systemName} <span>system</span></span>
              )}
              <StantonLagrangeChildrenSummary entry={entry} compact />
            </div>
          </div>
          {locationMethodMixItems.length > 0 && (
            <div className="location-method-stat-grid">
              {locationMethodMixItems.map((item) => {
                const displayMethod = miningMethodBadge(item.method)?.label ?? item.method;
                return (
                  <div key={`method-mix:${item.method}`} className={`location-stat-chip location-method-stat-chip location-method-stat-chip--${displayMethod.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}>
                    <div className="location-stat-label"><InfoTip text="Location-wide mining method distribution at this location."><span className="mdet-method-label"><MiningMethodIcon method={item.method} />{displayMethod}</span></InfoTip></div>
                    <div
                      className={`location-stat-value ${methodBiasToneClass(item.share)}`}
                      title={`Location Method Mix: ${item.method} ${formatPercent(item.share)}`}
                    >
                      {formatPercent(item.share)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {onToggleStar && (
            <>
              <button
                type="button"
                className={`mloc-bookmark-btn mdet-bookmark-btn${starred ? " is-active" : ""}`}
                onClick={onToggleStar}
                aria-pressed={starred}
                aria-label={starred ? "Remove saved" : "Save"}
                aria-describedby={bookmarkTooltip.open ? bookmarkTooltip.tooltipId : undefined}
                {...bookmarkTooltip.triggerProps}
              >
                <MiningBookmarkIcon />
              </button>
              {bookmarkTooltip.tooltip}
            </>
          )}
        </div>
      )}

      {!hideHeader && contextSummary && (
        <div className="mining-detail-context" aria-label="Mining view context">
          <span className="mining-detail-context__item mining-detail-context__item--scope">{contextSummary.scopeLabel}</span>
          <span className="mining-detail-context__item"><strong>{contextSummary.selectedMaterialCount}</strong> selected</span>
          <span className="mining-detail-context__item"><strong>{contextSummary.totalMaterialCount}</strong> materials</span>
          <span className="mining-detail-context__item"><strong>{contextSummary.rankedLocationCount}</strong> ranked locations</span>
        </div>
      )}

      {((!hasMultipleDemandMaterials && total > 0) || hasMultipleDemandMaterials || hasSingleDemandMaterial) && (
        <div className={`location-stat-chip-grid${hasMultipleDemandMaterials ? " location-stat-chip-grid--coverage" : " location-stat-chip-grid--single"}${hasSingleDemandMaterial && selectedDemandRow?.occurrence.mode === "probability" ? " location-stat-chip-grid--probability" : ""}`}>
          <div className="location-stat-ledger-label">{hasMultipleDemandMaterials ? "Queue Coverage" : "Material Fit"}</div>
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
              <div className="location-coverage-progress">
                <span><strong>{coveredBQ.length} of {total}</strong> materials</span>
                <span>{coveragePct}%</span>
                <span className="location-coverage-track"><span style={{ width: `${coveragePct}%` }} /></span>
              </div>
            </>
          )}

          {hasSingleDemandMaterial && selectedDemandRow && (
            <>
              <div className="location-stat-chip">
                <div className="location-stat-label"><InfoTip text="Mining method for the selected material at this location.">METHOD</InfoTip></div>
                <div className="location-stat-value">{singleDemandMethodLabel}</div>
                {selectedDemandRow.occurrence.mode === "probability" && (
                  <div className="location-stat-subvalue">{selectedDemandRow.occurrence.methodAvailabilityLabel} available</div>
                )}
              </div>
              {selectedDemandRow.occurrence.mode === "probability" ? (
                <>
                  <div className="location-stat-chip">
                    <div className="location-stat-label"><InfoTip text={`Of the primary rocks in this mining pool, ${selectedDemandRow.occurrence.primaryRockShareLabel} are ${selectedDemandRow.name}.`}>PRIMARY ROCK SHARE</InfoTip></div>
                    <div className="location-stat-value">{selectedDemandRow.occurrence.primaryRockShareLabel}</div>
                  </div>
                  <div className="location-stat-chip">
                    <div className="location-stat-label"><InfoTip text={`A single game-data spawn roll has a ${selectedDemandRow.occurrence.spawnRollProbabilityLabel} chance to select both this mining pool and ${selectedDemandRow.name}. This is not the percentage of scanned rocks you are guaranteed to see.`}>SPAWN ROLL</InfoTip></div>
                    <div className="location-stat-value">{selectedDemandRow.occurrence.spawnRollProbabilityLabel}</div>
                  </div>
                  <div className="location-stat-chip">
                    <div className="location-stat-label"><InfoTip text={`This location is ${selectedDemandRow.occurrence.locationRankLabel} for ${selectedDemandRow.name} when compared only with locations using the same mining method.`}>LOCATION RANK</InfoTip></div>
                    <div className={`location-stat-value ${scoreToneClass(undefined, selectedDemandRow.sourceWeight)}`}>{selectedDemandRow.occurrence.locationRankLabel}</div>
                  </div>
                </>
              ) : (
                <div className="location-stat-chip">
                  <div className="location-stat-label"><InfoTip text="Location-specific encounter presentation retained for this material.">ENCOUNTER TIER</InfoTip></div>
                  <div className={`location-stat-value ${scoreToneClass(undefined, selectedDemandRow.sourceWeight)}`}>{selectedDemandRow.densityLabel}</div>
                </div>
              )}
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
        </div>
      )}

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
          <div className="mdet-section-label mdet-section-label--demand">Selected materials at this location</div>
          <table className="mining-resource-index-table">
            <colgroup>
              <col className="mining-resource-col--material" /><col className="mining-resource-col--method" />
              <col className="mining-resource-col--encounter" /><col className="mining-resource-col--quality" />
              <col className="mining-resource-col--quality" /><col className="mining-resource-col--yield" />
            </colgroup>
            <thead>
              <tr>
                <th>Material</th><th>Method</th>
                <th><span className="mdet-th-wrap"><InfoTip text="Shows three separate values: how often this is the primary material inside its mining pool, the chance that one game-data spawn roll selects it, and this location's rank against places using the same mining method.">Occurrence</InfoTip></span></th>
                <th><span className="mdet-th-wrap"><InfoTip text={qualityProbabilityTooltip(qualityHeader)}>{qualityHeader}</InfoTip></span></th>
                <th><span className="mdet-th-wrap"><InfoTip text={qualityProbabilityTooltip("900+")}>900+</InfoTip></span></th>
                <th><span className="mdet-th-wrap"><InfoTip text="Average material composition inside an encountered source. This is not encounter chance.">Composition</InfoTip></span></th>
              </tr>
            </thead>
            <tbody>
              {coveredDemandRows.map((row) => (
                <tr key={row.key} className={`mining-resource-row mining-resource-row--${row.status}`}>
                  <td className="mdet-mat-name"><MiningMaterialCell row={row} /></td>
                  <td className="mdet-mat-demand"><MiningMethodCell row={row} value={row.coverage === "Missing" ? "Missing" : row.miningType} /></td>
                  <td><MiningOccurrenceCell row={row} /></td>
                  <td className="mdet-mat-score">{row.targetQualityChanceLabel}</td>
                  <td className="mdet-mat-score">{row.quality900Label}</td>
                  <td className="mdet-mat-score">{row.compositionLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <MiningMobileMaterialList rows={coveredDemandRows} mode="demand" qualityHeader={qualityHeader} />
        </div>
      )}

      {otherLocationMaterialRows.length > 0 && (
        <div className="mining-resource-index">
          <div className="mdet-section-label">
            {materialProfileTitle}
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
                <th><span className="mdet-th-wrap"><InfoTip text="Shows three separate values: how often this is the primary material inside its mining pool, the chance that one game-data spawn roll selects it, and this location's rank against places using the same mining method.">Occurrence</InfoTip></span></th>
                <th><span className="mdet-th-wrap"><InfoTip text={qualityProbabilityTooltip("800+")}>800+</InfoTip></span></th>
                <th><span className="mdet-th-wrap"><InfoTip text={qualityProbabilityTooltip("900+")}>900+</InfoTip></span></th>
                <th><span className="mdet-th-wrap"><InfoTip text="Average material composition inside an encountered source. This is not encounter chance.">Composition</InfoTip></span></th>
              </tr>
            </thead>
            <tbody>
              {otherLocationMaterialRows.map((row) => (
                <tr key={row.key} className={`mining-resource-row mining-resource-row--${row.status}`}>
                  <td className="mdet-mat-name"><MiningMaterialCell row={row} /></td>
                  <td className="mdet-mat-demand"><MiningMethodCell row={row} value={row.miningType || "Unknown"} /></td>
                  <td><MiningOccurrenceCell row={row} /></td>
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
