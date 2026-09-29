import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { PublicLocationEntry, RequiredMaterial } from "../../../features/mining/types";
import { getPlanetAsset, type PlanetAsset } from "../../../features/mining/planetAssets";
import { canonicalMiningMaterial, canonicalMiningMaterialKey } from "../../../features/mining/materialIdentity";
import {
  getStaticEncounterRankingRow,
  getStaticLocationAttemptedJoinKeys,
  getStaticLocationDescription,
  getStaticLocationDisplayName,
  getStaticMaterialQualityRow,
  getStaticMethodBiasForLocation,
  getStaticResourcesForLocation,
  type StaticMiningIndex,
} from "../../../features/mining/staticMiningIndex";
import {
  buildMiningLocationSurveyPresentation,
  buildMiningSpawnCompetitionPools,
  type MiningSpawnCompetitionMember,
  type MiningSpawnCompetitionPool,
} from "../../../features/mining/miningPresentationModels";
import {
  buildDemandRows,
  buildResourceRows,
  formatMiningProbability,
  miningMethodBadge,
  qualityChanceHeader,
  resourceRowMaterialKey,
} from "./miningFormatters";
import type { DemandRow, ResourceRow } from "./miningTypes";
import { MaterialNameCell } from "./MiningShared";
import MiningBookmarkIcon from "./MiningBookmarkIcon";
import StantonLagrangeChildrenSummary from "./StantonLagrangeChildrenSummary";
import { hasStantonLagrangeChildren } from "./stantonLagrangeChildren";
import { useMiningHoverTooltip } from "./MiningHoverTooltip";
import {
  formatMiningCompetitionPercentagePoints,
  miningCompetitionEmptyMessage,
  miningCompetitionMaterialColor,
  miningCompetitionProbabilitySummary,
  miningCompetitionSourceLabel,
} from "./miningCompetitionPresentation";
import { miningMethodPresentation } from "./miningMethodPresentation";
import MiningMethodIcon from "./MiningMethodIcon";

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
    <div className="mdet-material-cell" title={row.name}>
      <MaterialNameCell name={row.name} miningMethod={row.miningType} iconSize={25} />
      <TraceMaterialList row={row} />
    </div>
  );
}

function MiningMethodCell({ value }: { row: DemandRow | ResourceRow; value: string }) {
  const label = miningMethodBadge(value)?.label ?? value;
  const presentation = miningMethodPresentation(value);
  return (
    <div className="mdet-method-cell">
      {presentation.iconKey ? <MiningMethodIcon methodKey={presentation.iconKey} /> : <MiningMethodDemandCell value={presentation.visibleLabel} />}
      {presentation.iconKey && <span className="sr-only">{label}</span>}
    </div>
  );
}

type CompetitionLinkProps = {
  active: boolean;
  accentColor: string;
  onBlur: (relatedTarget: EventTarget | null) => void;
  onFocus: () => void;
  onMouseEnter: () => void;
  onMouseLeave: (relatedTarget: EventTarget | null) => void;
};

function competitionAccentStyle(accentColor: string): CSSProperties {
  return { "--mdet-competition-color": accentColor } as CSSProperties;
}

function CompetitionMember({ member, target, link }: { member: MiningSpawnCompetitionMember; target: boolean; link: CompetitionLinkProps }) {
  const probabilitySummary = miningCompetitionProbabilitySummary(member);
  return (
    <li
      className={`mdet-competition-member${target ? " is-target" : ""}${link.active ? " is-linked-active" : ""}`}
      data-competition-material-key={member.materialKey}
      data-linked-active={link.active ? "true" : undefined}
      style={competitionAccentStyle(link.accentColor)}
      title={probabilitySummary}
      aria-label={`${member.materialName}. ${probabilitySummary}. ${target ? "Target" : "Competing material"}.`}
      tabIndex={0}
      onMouseEnter={link.onMouseEnter}
      onMouseLeave={(event) => link.onMouseLeave(event.relatedTarget)}
      onFocus={link.onFocus}
      onBlur={(event) => link.onBlur(event.relatedTarget)}
    >
      <MaterialNameCell name={member.materialName} iconSize={15} />
      <strong>{formatMiningCompetitionPercentagePoints(member.relativeProbability)}</strong>
    </li>
  );
}

function MiningCompetitionPool({ pool }: { pool: MiningSpawnCompetitionPool }) {
  const [activeMaterialKey, setActiveMaterialKey] = useState<string | null>(null);
  const linkProps = (member: MiningSpawnCompetitionMember): CompetitionLinkProps => {
    const materialKey = member.materialKey;
    const clearUnlessLinked = (relatedTarget: EventTarget | null) => {
      const linkedKey = typeof HTMLElement !== "undefined" && relatedTarget instanceof HTMLElement
        ? relatedTarget.dataset.competitionMaterialKey
        : undefined;
      if (linkedKey === materialKey) return;
      setActiveMaterialKey((current) => current === materialKey ? null : current);
    };
    return {
      active: activeMaterialKey === materialKey,
      accentColor: miningCompetitionMaterialColor(member.materialKey || member.materialName),
      onBlur: clearUnlessLinked,
      onFocus: () => setActiveMaterialKey(materialKey),
      onMouseEnter: () => setActiveMaterialKey(materialKey),
      onMouseLeave: clearUnlessLinked,
    };
  };

  return (
    <div className="mdet-competition-pool">
      <div className="mdet-competition-copy">
        <span>Direct spawn competition</span>
        <div className="mdet-competition-target" title={`Source group: ${pool.sourceGroup}`}>
          <MaterialNameCell name={pool.target.materialName} iconSize={27} />
          <small>{miningCompetitionSourceLabel(pool.sourceGroup)}</small>
        </div>
        <strong>{pool.competitorCount} competing resource{pool.competitorCount === 1 ? "" : "s"}</strong>
        <p>{pool.members.length} primary materials share this source pool.</p>
      </div>
      <div className="mdet-competition-readout">
        <div className="mdet-competition-bar" role="list" aria-label={`Spawn-pool shares for ${pool.target.materialName}`}>
          {pool.members.map((member) => {
            const share = typeof member.relativeProbability === "number" && Number.isFinite(member.relativeProbability)
              ? Math.max(member.relativeProbability, 0)
              : 0;
            const link = linkProps(member);
            const probabilitySummary = miningCompetitionProbabilitySummary(member);
            return (
              <span
                key={`${pool.sourceGroup}:${member.materialKey}:bar`}
                className={`mdet-competition-segment${member === pool.target ? " is-target" : ""}${link.active ? " is-linked-active" : ""}`}
                role="listitem"
                tabIndex={0}
                data-competition-material-key={member.materialKey}
                data-linked-active={link.active ? "true" : undefined}
                style={{ ...competitionAccentStyle(link.accentColor), flexGrow: share }}
                title={`${member.materialName}. ${probabilitySummary}`}
                aria-label={`${member.materialName}. ${probabilitySummary}. ${member === pool.target ? "Target" : "Competing material"}.`}
                onMouseEnter={link.onMouseEnter}
                onMouseLeave={(event) => link.onMouseLeave(event.relatedTarget)}
                onFocus={link.onFocus}
                onBlur={(event) => link.onBlur(event.relatedTarget)}
              />
            );
          })}
        </div>
        <ul className="mdet-competition-members">
          {pool.members.map((member) => (
            <CompetitionMember key={`${pool.sourceGroup}:${member.materialKey}`} member={member} target={member === pool.target} link={linkProps(member)} />
          ))}
        </ul>
      </div>
    </div>
  );
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
  focusedMaterialKey,
  locationMaterialKeys,
  staticMiningIndex,
  staticIndexStatus,
  planetAssetMap,
  starred,
  onToggleStar,
  hideHeader = false,
}: {
  entry: PublicLocationEntry;
  activeDemandMaterials: RequiredMaterial[];
  buildQueueMaterialKeys: Set<string>;
  focusedMaterialKey?: string | null;
  locationMaterialKeys: string[];
  staticMiningIndex: StaticMiningIndex | null;
  staticIndexStatus: "loading" | "loaded" | "error";
  planetAssetMap?: Map<string, PlanetAsset> | null;
  starred?: boolean;
  onToggleStar?: (e: MouseEvent<HTMLButtonElement>) => void;
  hideHeader?: boolean;
}) {
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
  const locationTitleMatch = locationDisplayName.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  const locationTitle = locationTitleMatch?.[1] ?? locationDisplayName;
  const locationSubtitle = locationTitleMatch?.[2] ?? null;
  const isLagrangeChildGroup = hasStantonLagrangeChildren(entry);
  const planetAsset = getPlanetAsset(planetAssetMap ?? null, locationDisplayName) ?? getPlanetAsset(planetAssetMap ?? null, entry.locationName);
  const bookmarkTooltip = useMiningHoverTooltip(starred ? "Remove saved" : "Save", { align: "end" });
  const survey = useMemo(
    () => buildMiningLocationSurveyPresentation(
      getStaticLocationDescription(entry, staticMiningIndex),
      getStaticMethodBiasForLocation(entry, staticMiningIndex),
    ),
    [entry, staticMiningIndex],
  );
  const hasBuildQueueTarget = buildQueueMaterialKeys.size > 0;
  const hasSelectedQualityTarget = activeDemandMaterials.some((m) => m.selectedQuality !== undefined);
  const qualityHeader = qualityChanceHeader(hasSelectedQualityTarget);
  const competitionTarget = useMemo(() => {
    const selectedKey = focusedMaterialKey
      ? canonicalMiningMaterialKey(focusedMaterialKey)
      : buildQueueMaterialKeys.size === 1
        ? canonicalMiningMaterialKey([...buildQueueMaterialKeys][0])
        : null;
    if (!selectedKey || !buildQueueMaterialKeys.has(selectedKey)) return null;
    const matchingRows = staticResourceRows.filter(
      (row) => canonicalMiningMaterial({ materialId: row.materialId, materialName: row.materialName }).key === canonicalMiningMaterialKey(selectedKey),
    );
    if (matchingRows.length === 0) return null;
    return canonicalMiningMaterialKey(selectedKey);
  }, [buildQueueMaterialKeys, focusedMaterialKey, staticResourceRows]);
  const competitionPools = useMemo(
    () => competitionTarget ? buildMiningSpawnCompetitionPools(staticResourceRows, competitionTarget) : [],
    [competitionTarget, staticResourceRows],
  );
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
  return (
    <div className={`mdet-panel${hideHeader ? " mdet-panel--inline-mobile" : ""}`}>
      <div className={`mdet-survey-stage${hideHeader ? " mdet-survey-stage--inline" : ""}`}>
        {!hideHeader && (
          <div className="mdet-header">
            <div className="mdet-stage-top">
              <span>Location profile</span>
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
            <span className="mdet-scan-reticle" aria-hidden="true" />
            <div className="mdet-header-left">
              <div className="mdet-label">{entry.systemName} system</div>
              <div className="mdet-name" title={locationDisplayName !== entry.locationName ? `Raw key: ${entry.locationName}` : undefined}>
                {locationTitle}
                {locationSubtitle && <small>{locationSubtitle}</small>}
              </div>
              {isLagrangeChildGroup && <div className="mdet-meta">
                <StantonLagrangeChildrenSummary entry={entry} compact />
              </div>}
            </div>
          </div>
        )}

        <section className="mdet-survey-readout" aria-label="Survey conditions and mining methods">
          <div className="mdet-environment">
            <div className="mdet-environment-grid">
              {survey.conditions.map((condition) => (
                <div className={`mdet-environment-item mdet-environment-item--${condition.key}`} key={condition.key}>
                  <span>{condition.label}</span><strong>{condition.value ?? "Unavailable"}</strong>
                </div>
              ))}
            </div>
            {!survey.environment.sourceText && <p className="mdet-environment-note">No source-backed location description is available for these conditions.</p>}
          </div>
          <div className="mdet-method-rack mdet-method-rack--prominent" aria-label="Location mining method availability">
            {survey.methods.length > 0 ? survey.methods.map((item) => {
              const label = miningMethodBadge(item.method)?.label ?? item.method;
              const presentation = miningMethodPresentation(item.method);
              return <div className="mdet-method-rack-item" key={item.method} title={`${label}: ${formatMiningProbability(item.share)} available`}>
                {presentation.iconKey ? <MiningMethodIcon methodKey={presentation.iconKey} /> : <span className="mdet-method-fallback">{presentation.visibleLabel}</span>}
                {presentation.iconKey && <span className="sr-only">{label}</span>}
                <strong className="mdet-method-rack-value">{formatMiningProbability(item.share)}</strong>
              </div>;
            }) : <span className="mdet-unavailable">Unavailable</span>}
          </div>
        </section>
      </div>

      {staticIndexStatus === "loading" && (
        <p className="mdet-reference-note" role="status">
          Loading source-backed location detail…
        </p>
      )}
      {staticIndexStatus === "error" && (
        <p className="mdet-reference-note" role="status">
          The location reference index is unavailable. Source-backed detail fields may be unavailable.
        </p>
      )}

      <section className="mdet-competition" aria-label="Direct spawn competition">
        {competitionPools.length > 0
          ? competitionPools.map((pool) => <MiningCompetitionPool key={pool.sourceGroup} pool={pool} />)
          : <p className="mdet-competition-empty">{miningCompetitionEmptyMessage(Boolean(competitionTarget))}</p>}
      </section>

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

      {demandRows.length === 0 && otherLocationMaterialRows.length === 0 && (
        <p className="mdet-empty-readout">No material rows are available for this location.</p>
      )}
    </div>
  );
}
