import "@fontsource/ibm-plex-sans-condensed/400.css";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { PublicLocationEntry, RequiredMaterial } from "../../../features/mining/types";
import { getPlanetAsset, type PlanetAsset } from "../../../features/mining/planetAssets";
import { getLocationTopography } from "../../../features/mining/topographyAssets";
import { canonicalMiningMaterial, canonicalMiningMaterialKey } from "../../../features/mining/materialIdentity";
import {
  getStaticEncounterRankingRow,
  getStaticLocationAttemptedJoinKeys,
  getStaticLocationEnvironment,
  getStaticLocationDisplayName,
  getStaticMaterialQualityRow,
  getStaticMaterialKey,
  getStaticMethodBiasForLocation,
  getStaticResourcesForLocation,
  type StaticMiningIndex,
} from "../../../features/mining/staticMiningIndex";
import {
  buildMiningLocationSurveyPresentation,
  compareMiningMethodMaterialEntries,
  type MiningSpawnCompetitionMember,
  type MiningSelectedSpawnCompetitionPool,
} from "../../../features/mining/miningPresentationModels";
import {
  buildDemandRows,
  buildResourceRows,
  formatMiningProbability,
  miningMethodBadge,
  pickWeightedQualityChances,
  qualityChanceHeader,
  resourceRowMaterialKey,
} from "./miningFormatters";
import type { DemandRow, ResourceRow } from "./miningTypes";
import { MaterialNameCell } from "./MiningShared";
import MiningBookmarkIcon from "./MiningBookmarkIcon";
import StantonLagrangeChildrenSummary from "./StantonLagrangeChildrenSummary";
import { hasStantonLagrangeChildren } from "./stantonLagrangeChildren";
import { useMiningHoverTooltip } from "./MiningHoverTooltip";
import MiningEnvironmentStatus from "./MiningEnvironmentStatus";
import {
  buildMiningLocationCompetitionPools,
  formatMiningCompetitionPercentagePoints,
  miningCompetitionPoolCoverage,
  miningCompetitionMaterialColor,
  miningCompetitionProbabilitySummary,
  miningCompetitionSourceLabel,
  buildMiningLocationOccurrenceRatings,
  miningOccurrenceRatingForRow,
  type MiningOccurrenceRating,
} from "./miningCompetitionPresentation";
import { MiningDetailViewToggle, MiningGlossary, MiningOccurrencePips, MiningOccurrenceRatingLabel } from "./MiningReadingAids";
import { miningOccurrenceRatingTitle, useMiningDetailView, type MiningDetailView } from "./miningDetailView";
import { miningMethodPresentation } from "./miningMethodPresentation";
import { formatSignature, groupByMethod, mineableSignatureFor, partitionAlsoAtRows, sortByMaterialName, uniqueBestKey } from "./miningMaterialsPanel";
import MiningMethodIcon from "./MiningMethodIcon";

const HEADER_METHOD_SLOT_ORDER = ["Hand", "Ship", "Vehicle"] as const;

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

function MiningOccurrenceCell({ row }: { row: DemandRow | ResourceRow }) {
  if (row.occurrence.mode === "legacy") {
    return <MiningSourceBadge status={row.status} densityLabel={row.densityLabel} sourceWeight={row.sourceWeight} title={"sourceTitle" in row ? row.sourceTitle : undefined} />;
  }
  const title = `Primary share: ${row.occurrence.primaryRockShareLabel} of primary rocks in this mining pool are ${row.name}. This is a game-data weight, not a guaranteed percentage of scanned rocks.`;
  return (
    <div className="mdet-occurrence" title={title}>
      <strong>{row.occurrence.primaryRockShareLabel}</strong>
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
            <span title={trace.compositionRangeLabel +  " \u00b7 " + trace.qualityRangeLabel}>{mobile
                ? trace.compositionRangeLabel +  " \u00b7 " + trace.qualityRangeLabel
                : trace.compositionRangeLabel.replace(/\s*composition$/i, "")}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function materialRowSource(row: DemandRow | ResourceRow, staticResourceRows: ReturnType<typeof getStaticResourcesForLocation>) {
  return staticResourceRows.find((candidate) =>
    `${getStaticMaterialKey(candidate)}:${candidate.resolvedMineableClass}:${(candidate.sources ?? []).map((item) => item.groupName ?? item.spawnType ?? "unknown").sort().join("|")}` === row.associationKey);
}

export type MiningMaterialsTableVariant = "selected" | "also" | "profile";

// Display-only table. Values come from the static index rows and the existing
// MINEABLE_SIGNATURES source; formatting happens here at render time only.
export function MiningMaterialsTable({ rows, staticResourceRows, staticMiningIndex, label, variant, view = "simple", ratings }: {
  rows: Array<DemandRow | ResourceRow>;
  label: string;
  variant: MiningMaterialsTableVariant;
  view?: MiningDetailView;
  ratings?: ReadonlyMap<string, MiningOccurrenceRating>;
  staticResourceRows: ReturnType<typeof getStaticResourcesForLocation>;
  staticMiningIndex: StaticMiningIndex | null;
}) {
  const items = rows.map((row) => {
    const source = materialRowSource(row, staticResourceRows);
    const chances = source ? pickWeightedQualityChances(getStaticMaterialQualityRow(source, staticMiningIndex), source) : undefined;
    return {
      row,
      method: miningMethodBadge(row.miningType)?.label ?? row.miningType,
      encounter: row.occurrence.mode === "probability" ? source?.primaryRockShare : undefined,
      rating: row.occurrence.mode === "probability" && ratings ? miningOccurrenceRatingForRow(source, ratings) : undefined,
      locationRank: source?.candidateMaterialEncounterRank ?? null,
      locationRankOutOf: source?.candidateMaterialEncounterRankOutOf ?? null,
      bestLocationOutOf: source?.candidateMaterialEncounterRank === 1 ? source.candidateMaterialEncounterRankOutOf ?? null : undefined,
      quality800: chances?.["800"],
      quality900: chances?.["900"],
      composition: source?.compositionAveragePercentage,
      signature: mineableSignatureFor(row.name),
    };
  });
  type Item = (typeof items)[number];
  const keyOf = (item: Item) => item.row.associationKey;
  const highlight = variant !== "also";
  const best = {
    encounter: highlight ? uniqueBestKey(items, keyOf, (item) => item.encounter) : undefined,
    quality800: highlight ? uniqueBestKey(items, keyOf, (item) => item.quality800) : undefined,
    quality900: highlight ? uniqueBestKey(items, keyOf, (item) => item.quality900) : undefined,
  };
  const groups = variant === "selected" ? [{ method: "", items }] : groupByMethod(items, (item) => item.method);
  const detailed = view === "detailed";
  const showComposition = variant === "profile" && detailed;
  const showRank = variant === "selected" && detailed;
  const columnCount = showComposition || showRank ? 6 : 5;
  const percent = (value: number | null | undefined, decimals: number, scale = 100) =>
    typeof value === "number" && Number.isFinite(value) ? `${(value * scale).toFixed(decimals)}%` : "Unknown";
  const bestClass = (key: string | undefined, rowKey: string) => key === rowKey ? "mining-selected-best" : undefined;
  const traceText = (row: DemandRow | ResourceRow) => row.occurrence.traceMaterials
    .map((trace) => `${trace.name} ${trace.compositionRangeLabel.replace(/\s*composition$/i, "")}`).join(" · ");

  return <table className={`mining-resource-index-table mining-selected-table mining-selected-table--${variant}`}
    style={{ "--mb-font-numeric": '"IBM Plex Sans Condensed", sans-serif' } as CSSProperties}
    aria-label={label}>
    <colgroup>
      <col className="mining-resource-col--material" /><col className="mining-resource-col--encounter" />
      <col className="mining-resource-col--quality" /><col className="mining-resource-col--quality" />
      <col className="mining-resource-col--signatures" />
      {(showComposition || showRank) && <col className="mining-resource-col--yield" />}
    </colgroup>
    <thead>
      <tr className="mining-selected-quality-header">
        <td colSpan={2} aria-hidden="true" />
        <th scope="colgroup" colSpan={2}>Quality</th>
        <td colSpan={showComposition || showRank ? 2 : 1} aria-hidden="true" />
      </tr>
      <tr>
        <th scope="col">Material</th>
        <th scope="col">Encounter</th>
        <th scope="col" title={qualityProbabilityTooltip("800+")}>800+</th>
        <th scope="col" title={qualityProbabilityTooltip("900+")}>900+</th>
        <th scope="col">{variant === "selected" ? "Signature · ×2 · ×3" : "Signature"}</th>
        {showComposition && <th scope="col">Composition</th>}
        {showRank && <th scope="col" title="This location ranked against every location that has the material">Location rank</th>}
      </tr>
    </thead>
    {groups.map((group) => <tbody key={group.method || "selected"}>
      {group.method && <tr className="mining-selected-group"><th scope="rowgroup" colSpan={columnCount}>{group.method}</th></tr>}
      {group.items.map(({ row, encounter, rating, bestLocationOutOf, locationRank, locationRankOutOf, quality800, quality900, composition, signature }) => <tr key={row.associationKey} className={`mining-resource-row mining-resource-row--${row.status}`}>
        <td className="mdet-mat-name">
          {variant === "selected" ? <>
            <div className="mining-materials-name-line">
              <MaterialNameCell name={row.name} miningMethod={row.miningType} iconSize={16} />
              {bestLocationOutOf !== undefined && <span className="mining-best-location" title={`Ranked first of ${bestLocationOutOf ?? "all"} locations for ${row.name}`}>
                <span aria-hidden="true">★</span> Best location{bestLocationOutOf ? ` · 1 of ${bestLocationOutOf}` : ""}
              </span>}
            </div>
            {detailed && row.occurrence.traceMaterials.length > 0 && <div className="mining-selected-traces" title={row.occurrence.traceMaterialsLabel}>{traceText(row)}</div>}
          </> : <div className="mining-materials-name-line">
            <MaterialNameCell name={row.name} miningMethod={row.miningType} iconSize={variant === "also" ? 14 : 16} />
            {detailed && row.occurrence.traceMaterials.length > 0 && <span className="mining-selected-traces" title={row.occurrence.traceMaterialsLabel}>{traceText(row)}</span>}
          </div>}
        </td>
        <td className={bestClass(best.encounter, row.associationKey)}>
          {rating ? <span className="mining-selected-encounter">
            <MiningOccurrenceRatingLabel rating={rating} materialName={row.name} />
            {detailed && <span className="mining-selected-encounter-share">{typeof encounter === "number" && Number.isFinite(encounter) ? percent(encounter, 1) : formatMiningCompetitionPercentagePoints(rating.share)}</span>}
          </span> : typeof encounter === "number" && Number.isFinite(encounter) ? <span className="mining-selected-encounter">
            <span className="mining-selected-bar-track" aria-hidden="true"><span className="mining-selected-bar" style={{ width: `${Math.min(100, Math.max(0, encounter * 100))}%`, minWidth: encounter > 0 ? 2 : 0 }} /></span>
            <span>{percent(encounter, 1)}</span>
          </span> : <MiningOccurrenceCell row={row} />}
        </td>
        <td className={bestClass(best.quality800, row.associationKey)}>{percent(quality800, 1)}</td>
        <td className={bestClass(best.quality900, row.associationKey)}>{percent(quality900, 2)}</td>
        <td className="mdet-signatures-cell">
          {signature ? <>
            <span className="mining-materials-signature-base">{formatSignature(signature.base)}</span>
            {variant === "selected" && (signature.x2 !== undefined || signature.x3 !== undefined) && <span className="mining-materials-signature-multiples">
              {signature.x2 !== undefined && <span>×2 {formatSignature(signature.x2)}</span>}
              {signature.x3 !== undefined && <span>×3 {formatSignature(signature.x3)}</span>}
            </span>}
          </> : "—"}
        </td>
        {showComposition && <td className="mining-materials-composition">{percent(composition, 1, 1)}</td>}
        {showRank && <td className="mining-materials-composition">{typeof locationRank === "number" ? `${locationRank} of ${locationRankOutOf ?? "?"}` : "Unknown"}</td>}
      </tr>)}
    </tbody>)}
  </table>;
}

const POOL_NOUN: Record<string, string> = { hand: "hand", ship: "ship", vehicle: "vehicle" };

/** Simple view: one card per selected material found here. Display only. */
function MiningMaterialCards({ rows, staticResourceRows, staticMiningIndex, ratings }: {
  rows: Array<DemandRow | ResourceRow>;
  staticResourceRows: ReturnType<typeof getStaticResourcesForLocation>;
  staticMiningIndex: StaticMiningIndex | null;
  ratings: ReadonlyMap<string, MiningOccurrenceRating>;
}) {
  const percent = (value: number | null | undefined, decimals: number) =>
    typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(decimals)}%` : "Unknown";
  return <div className="mining-material-cards" role="list" aria-label="Selected materials at this location">
    {rows.map((row) => {
      const source = materialRowSource(row, staticResourceRows);
      const chances = source ? pickWeightedQualityChances(getStaticMaterialQualityRow(source, staticMiningIndex), source) : undefined;
      const rating = row.occurrence.mode === "probability" ? miningOccurrenceRatingForRow(source, ratings) : undefined;
      const presentation = miningMethodPresentation(row.miningType);
      const methodLabel = miningMethodBadge(row.miningType)?.label ?? row.miningType;
      const pool = presentation.iconKey ? POOL_NOUN[presentation.iconKey] : methodLabel.toLowerCase();
      const signature = mineableSignatureFor(row.name);
      const bestOutOf = source?.candidateMaterialEncounterRank === 1 ? source.candidateMaterialEncounterRankOutOf ?? null : undefined;
      const share = rating?.share ?? null;
      return <article key={row.associationKey} role="listitem" className={`mining-material-card mining-resource-row--${row.status}`}>
        <div className="mining-material-card-top">
          <MaterialNameCell name={row.name} miningMethod={row.miningType} iconSize={18} />
          {presentation.iconKey
            ? <span className="mining-material-card-method" title={`${methodLabel} mining`}><MiningMethodIcon methodKey={presentation.iconKey} className="mining-material-card-method-icon" /><span className="sr-only">{methodLabel} mining</span></span>
            : <span className="mining-material-card-method">{methodLabel}</span>}
        </div>
        {rating ? <div className="mining-material-card-occ" title={miningOccurrenceRatingTitle(rating, row.name)}>
          <div className="mining-material-card-occ-word">
            <b className={rating.band ? undefined : "is-unrated"}>{rating.label}</b>
            {share !== null && <span>{formatMiningCompetitionPercentagePoints(share)} of {pool} rocks</span>}
          </div>
          <MiningOccurrencePips rating={rating} />
        </div> : <div className="mining-material-card-occ"><MiningOccurrenceCell row={row} /></div>}
        <div className="mining-material-card-facts">
          <div>Quality 800+<strong>{percent(chances?.["800"], 1)}</strong></div>
          <div>Signature<strong>{signature ? formatSignature(signature.base) : "\u2014"}</strong></div>
        </div>
        {bestOutOf !== undefined && <div><span className="mining-best-location" title={`Ranked first of ${bestOutOf ?? "all"} locations for ${row.name}`}>
          <span aria-hidden="true">★</span> Best location{bestOutOf ? ` \u00b7 1 of ${bestOutOf}` : ""}
        </span></div>}
      </article>;
    })}
  </div>;
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

function CompetitionMember({ member, selected, link }: { member: MiningSpawnCompetitionMember; selected: boolean; link: CompetitionLinkProps }) {
  const probabilitySummary = miningCompetitionProbabilitySummary(member);
  return (
    <li
      className={`mdet-competition-member${selected ? " is-target" : ""}${link.active ? " is-linked-active" : ""}`}
      data-competition-material-key={member.materialKey}
      data-linked-active={link.active ? "true" : undefined}
      style={competitionAccentStyle(link.accentColor)}
      title={probabilitySummary}
      aria-label={`${member.materialName}. ${probabilitySummary}. ${selected ? "Selected material" : "Other pool material"}.`}
      tabIndex={0}
      onMouseEnter={link.onMouseEnter}
      onMouseLeave={(event) => link.onMouseLeave(event.relatedTarget)}
      onFocus={link.onFocus}
      onBlur={(event) => link.onBlur(event.relatedTarget)}
    >
      <span className="mdet-competition-key" aria-hidden="true" />
      <span className="mdet-competition-member-name">{member.materialName}</span>
      <span className="sr-only">{selected ? "Selected" : "Competing"}</span>
      <strong>{formatMiningCompetitionPercentagePoints(member.relativeProbability)}</strong>
    </li>
  );
}

function MiningCompetitionPool({ pool }: { pool: MiningSelectedSpawnCompetitionPool }) {
  const [activeMaterialKey, setActiveMaterialKey] = useState<string | null>(null);
  const coverage = miningCompetitionPoolCoverage(pool.members);
  const coverageSummary = coverage.hasUnavailableShare
    ? "One or more published pool shares are unavailable."
    : coverage.unrepresentedShare && coverage.unrepresentedShare > 0
      ? `${formatMiningCompetitionPercentagePoints(coverage.knownShare)} of this source pool is represented by published location records; ${formatMiningCompetitionPercentagePoints(coverage.unrepresentedShare)} remains unrepresented.`
      : null;
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

  const sourceLabel = miningCompetitionSourceLabel(pool.sourceGroup).replace(/-mining spawn pool$/i, " pool").replace(/ spawn pool$/i, " pool");
  // Legend: selected members first (with values), competitors after, quieter.
  const legendMembers = [...pool.selectedMembers, ...pool.members.filter((member) => !pool.selectedMembers.includes(member))];
  return (
    <div className="mdet-competition-pool">
      <div className="mdet-competition-copy">
        <strong className="mdet-competition-target" title={`Source group: ${pool.sourceGroup}`}>{sourceLabel}</strong>
        <small title={coverageSummary ?? undefined}>
          {pool.competitorCount} competing{coverage.unrepresentedShare && coverage.unrepresentedShare > 0 ? ` · ${formatMiningCompetitionPercentagePoints(coverage.unrepresentedShare)} unrepresented` : coverage.hasUnavailableShare ? " · shares unavailable" : ` resource${pool.competitorCount === 1 ? "" : "s"}`}
        </small>
      </div>
      <div className="mdet-competition-bar" role="list" aria-label={`Spawn-pool shares for ${sourceLabel}${coverageSummary ? `. ${coverageSummary}` : ""}`}>
        {pool.members.map((member) => {
          const share = typeof member.relativeProbability === "number" && Number.isFinite(member.relativeProbability)
            ? Math.max(member.relativeProbability, 0)
            : 0;
          const link = linkProps(member);
          const probabilitySummary = miningCompetitionProbabilitySummary(member);
          const selected = pool.selectedMembers.includes(member);
          return (
            <span
              key={`${pool.sourceGroup}:${member.materialKey}:bar`}
              className={`mdet-competition-segment${selected ? " is-target" : ""}${link.active ? " is-linked-active" : ""}`}
              role="listitem"
              tabIndex={0}
              data-competition-material-key={member.materialKey}
              data-linked-active={link.active ? "true" : undefined}
              style={{ ...competitionAccentStyle(link.accentColor), width: `${share}%` }}
              title={`${member.materialName}. ${probabilitySummary}`}
              aria-label={`${member.materialName}. ${probabilitySummary}. ${selected ? "Selected material" : "Other pool material"}.`}
              onMouseEnter={link.onMouseEnter}
              onMouseLeave={(event) => link.onMouseLeave(event.relatedTarget)}
              onFocus={link.onFocus}
              onBlur={(event) => link.onBlur(event.relatedTarget)}
            />
          );
        })}
        {coverage.unrepresentedShare !== null && coverage.unrepresentedShare > 0 && (
          <span
            className="mdet-competition-segment mdet-competition-segment--unrepresented"
            role="listitem"
            style={{ width: `${coverage.unrepresentedShare}%` }}
            title={`Unrepresented in published location records: ${formatMiningCompetitionPercentagePoints(coverage.unrepresentedShare)}`}
            aria-label={`Unrepresented in published location records: ${formatMiningCompetitionPercentagePoints(coverage.unrepresentedShare)}. No resources are inferred for this share.`}
          />
        )}
      </div>
      <ul className="mdet-competition-members">
        {legendMembers.map((member) => (
          <CompetitionMember key={`${pool.sourceGroup}:${member.materialKey}`} member={member} selected={pool.selectedMembers.includes(member)} link={linkProps(member)} />
        ))}
        {coverage.unrepresentedShare !== null && coverage.unrepresentedShare > 0 && (
          <li className="mdet-competition-member mdet-competition-member--unrepresented">
            <span className="mdet-competition-key" aria-hidden="true" />
            <span className="mdet-competition-member-name">Unrepresented</span>
            <strong>{formatMiningCompetitionPercentagePoints(coverage.unrepresentedShare)}</strong>
          </li>
        )}
      </ul>
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
  view,
  rating,
}: {
  row: DemandRow | ResourceRow;
  mode: "demand" | "resource";
  qualityHeader: string;
  view: MiningDetailView;
  rating?: MiningOccurrenceRating;
}) {
  const detailed = view === "detailed";
  const methodValue = row.miningType || "Unknown";
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
          {"coverage" in row && row.coverage !== "Covered" && row.coverage !== row.densityLabel && <MobileMaterialStatusPill label={row.coverage} status={row.status} />}
          {rating
            ? <span className="mdet-mobile-occurrence"><MiningOccurrenceRatingLabel rating={rating} materialName={row.name} />{detailed && <small>{row.occurrence.primaryRockShareLabel}</small>}</span>
            : probabilityOccurrence
              ? <MobileMaterialStatusPill label={`${row.occurrence.primaryRockShareLabel} primary`} status={row.status} />
              : <MobileMaterialStatusPill label={row.densityLabel} status={row.status} />}
        </div>
        {detailed && <TraceMaterialList row={row} mobile />}
      </div>
      <div
        className="mdet-mobile-stat-grid"
        title={"sourceTitle" in row ? row.sourceTitle : undefined}
      >
        {detailed && probabilityOccurrence && <MiningMobileStat label="Method Available" value={row.occurrence.methodAvailabilityLabel} />}
        <MiningMobileStat label={qualityHeader} value={primaryQualityLabel} />
        <MiningMobileStat label="900+ Quality" value={row.quality900Label} />
        {detailed && <MiningMobileStat label="Composition" value={row.compositionLabel} />}
         <div className="mdet-mobile-signatures" aria-label="Signatures pending">
           <span className="mdet-mobile-stat-label">Sigs</span>
           <div className="mdet-signature-badges" aria-hidden="true" />
         </div>
      </div>
    </article>
  );
}

function MiningMobileMaterialList({
  rows,
  mode,
  qualityHeader,
  view,
  ratings,
  staticResourceRows,
}: {
  rows: Array<DemandRow | ResourceRow>;
  mode: "demand" | "resource";
  qualityHeader: string;
  view: MiningDetailView;
  ratings: ReadonlyMap<string, MiningOccurrenceRating>;
  staticResourceRows: ReturnType<typeof getStaticResourcesForLocation>;
}) {
  return (
    <div className="mdet-mobile-material-list">
      {rows.map((row) => (
        <MiningMobileMaterialCard
          key={row.key}
          row={row}
          mode={mode}
          qualityHeader={qualityHeader}
          view={view}
          rating={row.occurrence.mode === "probability" ? miningOccurrenceRatingForRow(materialRowSource(row, staticResourceRows), ratings) : undefined}
        />
      ))}
    </div>
  );
}

export function LocationDetail({
  entry,
  activeDemandMaterials,
  buildQueueMaterialKeys,
  selectedMaterials,
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
  selectedMaterials: Set<string>;
  locationMaterialKeys: string[];
  staticMiningIndex: StaticMiningIndex | null;
  staticIndexStatus: "loading" | "loaded" | "error";
  planetAssetMap?: Map<string, PlanetAsset> | null;
  starred?: boolean;
  onToggleStar?: (e: MouseEvent<HTMLButtonElement>) => void;
  hideHeader?: boolean;
  /** Ranked-list coverage for this location (same projection as the "N of M" row readout). */
  coverage?: { covered: number; total: number };
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

  const activeMaterialKeys = useMemo(() => new Set([...selectedMaterials, ...buildQueueMaterialKeys]), [selectedMaterials, buildQueueMaterialKeys]);

  // Pure transform — no hooks inside
  const demandRows = useMemo(
    () => buildDemandRows(entry, activeMaterialKeys, locationMaterialKeys, demandMaterialByKey, staticResourceRows, staticMiningIndex, staticIndexStatus),
    [entry, activeMaterialKeys, locationMaterialKeys, demandMaterialByKey, staticResourceRows, staticMiningIndex, staticIndexStatus],
  );

  const resourceRows = useMemo(
    () => buildResourceRows(entry, staticResourceRows, staticMiningIndex),
    [entry, staticResourceRows, staticMiningIndex],
  );

  // The profile tables describe materials found at this location. Missing or
  // unresolved selections remain visible in the coverage chips, not as source rows.
  const selectedDemandRows = useMemo(
    () => demandRows
      .filter((row) => row.coverage === "Covered" || row.coverage === "Indexed · Not eligible")
      .sort(compareMiningMethodMaterialEntries),
    [demandRows],
  );

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
  // Location records do not expose a verified celestial parent for orbital areas.
  // Resolve body maps by exact CIG display/alias names; use location-matched art
  // or a neutral orbital backdrop when no surface map exists.
  const topographyHero = getLocationTopography(entry.systemName, locationDisplayName)
    ?? getLocationTopography(entry.systemName, entry.locationName);
  const heroBackdrop = topographyHero ?? planetAsset?.headerImage2x ?? planetAsset?.headerImage ?? null;
  const locationArtworkStyle = planetAsset
    ? {
      "--mdet-header-art-fit": planetAsset.headerFit,
      "--mdet-header-art-position": `${planetAsset.headerPositionX}% ${planetAsset.headerPositionY}%`,
      "--mdet-header-art-width": `${planetAsset.headerArtWidth}%`,
    } as CSSProperties
    : undefined;
  const bookmarkTooltip = useMiningHoverTooltip(starred ? "Remove saved" : "Save", { align: "end" });
  const locationMethodBias = useMemo(
    () => getStaticMethodBiasForLocation(entry, staticMiningIndex),
    [entry, staticMiningIndex],
  );
  const survey = useMemo(
    () => buildMiningLocationSurveyPresentation(
      getStaticLocationEnvironment(entry, staticMiningIndex),
      locationMethodBias,
    ),
    [entry, locationMethodBias, staticMiningIndex],
  );
  const surveyMethodsBySlot = useMemo(() => {
    const methodsBySlot = new Map<string, (typeof locationMethodBias)[number]>();
    for (const item of locationMethodBias) {
      const slot = miningMethodBadge(item.method)?.label;
      if (slot && !methodsBySlot.has(slot)) methodsBySlot.set(slot, item);
    }
    return methodsBySlot;
  }, [locationMethodBias]);
  const qualityHeader = qualityChanceHeader();
  const competitionPools = useMemo(
    () => buildMiningLocationCompetitionPools({
      selectedMaterialKeys: activeMaterialKeys,
      staticResourceRows,
      staticIndexStatus,
    }),
    [activeMaterialKeys, staticIndexStatus, staticResourceRows],
  );
  const demandedMaterialKeys = useMemo(
    () => new Set(demandRows.map((row) => canonicalMiningMaterialKey(row.key))),
    [demandRows],
  );
  // State A (selection present at this location): Also-at excludes every selected
  // material. State B (no selection here): one Material Profile with every row.
  const hasSelectedRows = selectedDemandRows.length > 0;
  // Selected rows read alphabetically by material on desktop and mobile alike.
  const selectedRowsByName = useMemo(
    () => sortByMaterialName(selectedDemandRows, (row) => row.name),
    [selectedDemandRows],
  );
  const otherLocationMaterialRows = useMemo(() => {
    const rows = hasSelectedRows
      ? partitionAlsoAtRows(resourceRows, demandedMaterialKeys, resourceRowMaterialKey)
      : resourceRows;
    return [...rows].sort(compareMiningMethodMaterialEntries);
  }, [demandedMaterialKeys, hasSelectedRows, resourceRows]);
  const [detailView, setDetailView] = useMiningDetailView();
  const detailed = detailView === "detailed";
  const occurrenceRatings = useMemo(
    () => staticIndexStatus === "loaded" ? buildMiningLocationOccurrenceRatings(staticResourceRows) : new Map<string, MiningOccurrenceRating>(),
    [staticIndexStatus, staticResourceRows],
  );
  const heroPlatesContent = <>
    <MiningEnvironmentStatus environment={survey.environment} locationKind={entry.locationKind} />
    <div className={`mdet-plate mdet-plate--equipment mdet-method-rack${locationMethodBias.length === 0 ? " is-unavailable" : ""}`} aria-label="Source-backed location mining method eligibility. It does not verify ship equipment-specific fracture feasibility, scanned-rock success, or recoverable or refined SCU.">
      <span className="mdet-plate-key">Equipment · share of rocks</span>
      <span className="mdet-equipment-row">
        {HEADER_METHOD_SLOT_ORDER.map((slot) => {
          const item = surveyMethodsBySlot.get(slot);
          if (!item) return null;
          const label = miningMethodBadge(item.method)?.label ?? item.method;
          const presentation = miningMethodPresentation(item.method);
          return <span className={`mdet-method-rack-item${item.share > 0 ? "" : " is-absent"}`} key={item.method} title={`${label}: ${formatMiningProbability(item.share)} modeled source share. Method eligibility does not verify equipped-head fracture feasibility, scanned-rock success, or recovered/refined SCU.`}>
            {presentation.iconKey ? <MiningMethodIcon methodKey={presentation.iconKey} /> : null}
            <span className="mdet-method-label">{label}</span>
            <em className="mdet-method-rack-value">{formatMiningProbability(item.share)}</em>
          </span>;
        })}
        {locationMethodBias.length === 0 && <span className="mdet-method-rack-unavailable">Methods unavailable</span>}
      </span>
    </div>
  </>;
  const viewTools = <span className="mdet-section-tools">
    <MiningGlossary />
    <MiningDetailViewToggle view={detailView} onChange={setDetailView} />
  </span>;
  const heroPlates = <div className="mdet-hero-plates">{heroPlatesContent}</div>;
  // Found = selected materials with a location row here (eligible or not).
  const foundSelectedCount = new Set(selectedDemandRows.map((row) => row.key)).size;
  const missingSelectedNames = [...activeMaterialKeys]
    .filter((key) => !selectedDemandRows.some((row) => row.key === key))
    .map((key) => demandRows.find((row) => row.key === key)?.name ?? canonicalMiningMaterial({ materialKey: key }).label);
  return (
    <div className={`mdet-panel${hideHeader ? " mdet-panel--inline-mobile" : ""}`}>
      <div className={`mdet-survey-stage${planetAsset ? " mdet-survey-stage--artwork" : ""}${hideHeader ? " mdet-survey-stage--inline" : ""}`} style={locationArtworkStyle}>
        {!hideHeader && (
          <div className={`mdet-header mdet-source-card has-art${topographyHero ? " has-topography" : heroBackdrop ? " has-location-art" : " has-orbital-background"}`}>
            {heroBackdrop ? (
              <div className="mdet-hero-topography" aria-hidden="true"
                style={{ backgroundImage: `url("${heroBackdrop}")` }} />
            ) : (
              <div className="mdet-hero-orbital" aria-hidden="true" />
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
            <div className="mdet-header-left">
              <div className="mdet-label"><span className="mdet-label-system">{entry.systemName} system</span></div>
              <div className="mdet-name" title={locationDisplayName !== entry.locationName ? `Raw key: ${entry.locationName}` : undefined}>
                {locationTitle}
                {locationSubtitle && <small>{locationSubtitle}</small>}
              </div>
              {isLagrangeChildGroup && <div className="mdet-meta">
                <StantonLagrangeChildrenSummary entry={entry} compact />
              </div>}
            </div>
            {heroPlates}
          </div>
        )}
        {hideHeader && <div className="mdet-hero-plates mdet-hero-plates--inline">{heroPlatesContent}</div>}
      </div>

      {detailed && survey.methods.length > 0 && (
        <p className="mdet-method-breakdown mdet-method-breakdown--standalone" title="Modeled source share by mining method. Method eligibility only; it does not verify equipped-head fracture feasibility, scanned-rock success, or recovered/refined SCU.">
          <span className="mdet-method-breakdown-label">Source share</span>
          {survey.methods.map((item) => (
            <span key={item.method} className={item.share > 0 ? "is-present" : undefined}>
              {item.method} <strong>{formatMiningProbability(item.share)}</strong>
            </span>
          ))}
        </p>
      )}

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

      {entry.nearbyStations.length > 0 && (
        <div className="mdet-stations">
          <span className="mdet-stations-label">Nearby</span>
          {entry.nearbyStations.map((s, i) => (
            <span key={`${entry.locationKey}:nearby:${s}:${i}`} className="mloc-station-chip">{s}</span>
          ))}
        </div>
      )}

  
      {hasSelectedRows && (
        <div className="mining-demand-breakdown">
          <div className="mdet-section-label">
            <span>{detailed ? "Selected materials" : "Your materials here"} <span className="mining-materials-section-meta">· {foundSelectedCount} of {activeMaterialKeys.size} found{missingSelectedNames.length > 0 ? ` · ${missingSelectedNames.join(", ")} not found here` : ""}</span></span>
            {viewTools}
          </div>
          {!detailed && <MiningMaterialCards rows={selectedRowsByName} staticResourceRows={staticResourceRows} staticMiningIndex={staticMiningIndex} ratings={occurrenceRatings} />}
          {detailed && <><MiningMaterialsTable variant="selected" label="Selected materials at this location" rows={selectedRowsByName} staticResourceRows={staticResourceRows} staticMiningIndex={staticMiningIndex} view={detailView} ratings={occurrenceRatings} />
          <MiningMobileMaterialList rows={selectedRowsByName} mode="demand" qualityHeader={qualityHeader} view={detailView} ratings={occurrenceRatings} staticResourceRows={staticResourceRows} /></>}
        </div>
      )}

      {competitionPools.length > 0 && (
        <section className="mdet-competition" aria-label="Direct spawn competition">
          <div className="mdet-competition-head">
            <span className="mdet-competition-heading">What else spawns in the same pool</span>
            <span className="mdet-competition-hint">Direct Spawn Competition</span>
          </div>
          {competitionPools.map((pool) => <MiningCompetitionPool key={pool.sourceGroup} pool={pool} />)}
        </section>
      )}

      {hasSelectedRows && otherLocationMaterialRows.length > 0 && (
        <div className="mining-resource-index mining-materials-also">
          <div className="mdet-section-label">
            <span>{detailed ? "Other materials at this location" : "Also found here"}</span>
            {!detailed && <button type="button" className="mining-materials-linkbtn" onClick={() => setDetailView("detailed")}>Show full table</button>}
          </div>
          {!detailed ? (
            <ul className="mining-materials-also-chips" aria-label="Also found here">
              {otherLocationMaterialRows.map((row) => {
                const rating = row.occurrence.mode === "probability" ? miningOccurrenceRatingForRow(materialRowSource(row, staticResourceRows), occurrenceRatings) : undefined;
                const method = (miningMethodBadge(row.miningType)?.label ?? row.miningType).toLowerCase();
                return <li key={row.associationKey} title={rating ? miningOccurrenceRatingTitle(rating, row.name) : undefined}>
                  <MaterialNameCell name={row.name} miningMethod={row.miningType} iconSize={14} />
                  <em>{rating ? `${rating.label} · ${method}` : method}</em>
                </li>;
              })}
            </ul>
          ) : <>
            <MiningMaterialsTable variant="also" label="Other materials at this location" rows={otherLocationMaterialRows} staticResourceRows={staticResourceRows} staticMiningIndex={staticMiningIndex} view={detailView} ratings={occurrenceRatings} />
            <MiningMobileMaterialList rows={otherLocationMaterialRows} mode="resource" qualityHeader="800+" view={detailView} ratings={occurrenceRatings} staticResourceRows={staticResourceRows} />
          </>}
        </div>
      )}

      {!hasSelectedRows && otherLocationMaterialRows.length > 0 && (
        <div className="mining-resource-index">
          <div className="mdet-section-label">
            <span>Material profile <span className="mining-materials-section-meta">· {otherLocationMaterialRows.length} materials at {locationTitle}</span></span>
            {viewTools}
          </div>
          <MiningMaterialsTable variant="profile" label="Material profile at this location" rows={otherLocationMaterialRows} staticResourceRows={staticResourceRows} staticMiningIndex={staticMiningIndex} view={detailView} ratings={occurrenceRatings} />
          <MiningMobileMaterialList rows={otherLocationMaterialRows} mode="resource" qualityHeader="800+" view={detailView} ratings={occurrenceRatings} staticResourceRows={staticResourceRows} />
        </div>
      )}

      {selectedDemandRows.length === 0 && otherLocationMaterialRows.length === 0 && (
        <p className="mdet-empty-readout">No material rows are available for this location.</p>
      )}
    </div>
  );
}
