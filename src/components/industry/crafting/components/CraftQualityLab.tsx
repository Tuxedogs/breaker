import { startTransition, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { ComponentRecipe } from "../utils/craftingTypes";
import { hasEffectiveModifierValue } from "../utils/qualityModifiers";
import type { MaterialEffectAtQuality } from "../utils/materialEffects";
import { getTotalModifierKey, type TotalModifierRow } from "../utils/recipeQuality";
import {
  clampQuality,
  findNearestBandForQuality,
  getBandEffectiveQuality,
  getQualityTierFromBand,
  type QualityBand,
} from "../utils/qualityBands";
import { magneticQualityAtFraction, placeMarkerLabels } from "../utils/qualityMagnet";
import { getModifierImpact } from "@/lib/gameplay/propertyUtils";
import {
  formatCraftingCompactNumber,
  formatCraftingContributionValue,
  formatMaterialModifierDisplay,
  getCraftingImpactClass,
  getCraftingModifierBaseValue,
  getModifierStatBindingLabel,
} from "@/lib/crafting/craftingDetailStats";
import { buildCraftStatViewModel } from "@/lib/crafting/craftStatViewModel";
import { getStatGroupIconSrc } from "@/components/logistics/componentStatGroupIcons";
import { formatMaterialDisplayName } from "@/lib/crafting/materialDisplayName";
import { resolveMaterialPresentation } from "@/lib/materialPresentation";
import type { FittingComponentDetail } from "@/lib/fitting/fittingApi";
import {
  buildConsolidatedGroups,
  comparisonIsModified,
  formatCompactStatLabel,
  formatStatLabel,
  normalizeStatKey,
} from "@/components/shared/craftStatisticsGroups";

/* V31b Quality Laboratory presentation. Every value comes from the existing
   band, modifier and statistics owners; nothing here calculates gameplay. */

type RecipeMaterial = ComponentRecipe["materials"][number];

const SLIDER_MAX_QUALITY = 1000;
/** Half the 16px slider thumb; ticks and pointer mapping share this inset. */
const THUMB_HALF_PX = 8;
/** Pointer distance (px) within which a quantization marker gently holds the handle. */
const MAGNET_RADIUS_PX = 9;

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export type LabIconName = "quality" | "stat" | "materials" | "time" | "source" | "details";

/** Small 14px line icons for scanning; decorative, colour from currentColor. */
export function LabIcon({ name }: { name: LabIconName }) {
  const paths: Record<LabIconName, string> = {
    quality: "M7 1.5 8.7 5l3.8.5-2.8 2.6.7 3.8L7 10.1 3.6 11.9l.7-3.8L1.5 5.5 5.3 5Z",
    stat: "M1.5 12.5h11M3 10l3-3.5 2.2 2L12 4M9.5 4H12v2.5",
    materials: "M7 1.5 12.5 4.5v5L7 12.5 1.5 9.5v-5ZM1.5 4.5 7 7.5l5.5-3M7 7.5v5",
    time: "M7 1.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM7 4v3.2l2.2 1.4",
    source: "M3 1.5h8v11L7 10l-4 2.5Z",
    details: "M2 3.5h10M2 7h10M2 10.5h6",
  };
  return (
    <svg className="craft-v31-icon" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false">
      <path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MaterialMark({ name }: { name: string }) {
  const presentation = resolveMaterialPresentation(name);
  return presentation.iconSrc
    ? <img className="craft-v31-material-mark" src={presentation.iconSrc} alt="" />
    : <span className="craft-v31-material-mark" style={{ backgroundColor: presentation.color }} aria-hidden="true" />;
}

function trackProgress(value: number, min: number, max: number): number {
  return max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
}

/**
 * Continuous quality slider from the start of Band 1 through quality 1000.
 * The native range input owns keyboard and assistive-technology access (exact
 * integer steps, no magnet); the rail owns pointer and touch dragging, which
 * passes through the deterministic marker magnet in `qualityMagnet.ts`.
 */
function QualitySlider({
  name,
  quality,
  bands,
  bandIndex,
  onQualityChange,
}: {
  name: string;
  quality: number;
  bands: QualityBand[];
  bandIndex: number;
  onQualityChange: (quality: number) => void;
}) {
  const min = clampQuality(Number(bands[0]?.start ?? 0));
  const max = SLIDER_MAX_QUALITY;
  const markers = useMemo(() => bands.map((band) => clampQuality(Number(band.start))), [bands]);
  const inputRef = useRef<HTMLInputElement>(null);
  const draggingPointer = useRef<number | null>(null);
  const lastSent = useRef<number | null>(null);
  // Local handle position while dragging, so the thumb never waits on the
  // laboratory's recalculation; the parent update runs as a transition.
  const [dragQuality, setDragQuality] = useState<number | null>(null);
  const shown = dragQuality ?? quality;

  const qualityAtPointer = (clientX: number): number | null => {
    const input = inputRef.current;
    if (!input) return null;
    const rect = input.getBoundingClientRect();
    const travel = rect.width - THUMB_HALF_PX * 2;
    if (!(travel > 0)) return null;
    const radius = MAGNET_RADIUS_PX * ((max - min) / travel);
    return magneticQualityAtFraction((clientX - rect.left - THUMB_HALF_PX) / travel, min, max, markers, radius);
  };
  const preview = (value: number | null) => {
    if (value === null) return;
    setDragQuality(value);
    if (value === lastSent.current) return;
    lastSent.current = value;
    startTransition(() => onQualityChange(value));
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (draggingPointer.current !== event.pointerId) return;
    draggingPointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    // Commit the settled value urgently so the handle never flashes back.
    if (lastSent.current !== null) onQualityChange(lastSent.current);
    lastSent.current = null;
    setDragQuality(null);
  };

  const progress = trackProgress(shown, min, max);
  const bandLabel = bandIndex >= 0 ? `Band ${bandIndex + 1}` : null;

  // Rail width drives label collision layout; updates only on resize.
  const [railWidth, setRailWidth] = useState(0);
  const railRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setRailWidth(Math.round(entry.contentRect.width)));
    observer.observe(rail);
    return () => observer.disconnect();
  }, []);
  const placements = useMemo(() => {
    if (!(railWidth > THUMB_HALF_PX * 2)) return markers.map(() => ({ anchor: "center" as const, row: 0 as const }));
    const travel = railWidth - THUMB_HALF_PX * 2;
    return placeMarkerLabels(
      markers.map((marker) => THUMB_HALF_PX + travel * trackProgress(marker, min, max)),
      bands.map((band) => String(band.start)),
      railWidth,
    );
  }, [bands, markers, max, min, railWidth]);
  const staggered = placements.some((placement) => placement.row === 1);

  return (
    <div className="craft-v31-band-rail" ref={railRef}>
      <div
        className="craft-v31-quality-track"
        onPointerDown={(event) => {
          if (event.button !== 0 || draggingPointer.current !== null) return;
          event.preventDefault();
          inputRef.current?.focus({ preventScroll: true });
          draggingPointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          preview(qualityAtPointer(event.clientX));
        }}
        onPointerMove={(event) => {
          if (draggingPointer.current !== event.pointerId) return;
          preview(qualityAtPointer(event.clientX));
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
      >
        <input
          ref={inputRef}
          type="range"
          className="craft-v31-band-range"
          min={min}
          max={max}
          step={1}
          value={shown}
          aria-label={`Quality for ${name}`}
          aria-valuetext={bandLabel ? `Quality ${shown}, ${bandLabel}` : `Quality ${shown}`}
          style={{ "--quality-progress": progress } as CSSProperties}
          onChange={(event) => onQualityChange(clampQuality(Number(event.target.value)))}
        />
      </div>
      <div className={`craft-v31-band-ticks${staggered ? " is-staggered" : ""}`}>
        {bands.map((band, index) => {
          const markerProgress = trackProgress(markers[index], min, max);
          return (
            <button
              key={`${band.start}:${index}`}
              type="button"
              // Each marker sits at its band's starting quality on the linear track.
              style={{ "--tick-progress": markerProgress } as CSSProperties}
              data-anchor={placements[index]?.anchor ?? "center"}
              data-row={placements[index]?.row ?? 0}
              className={index === bandIndex ? "is-active" : undefined}
              aria-pressed={index === bandIndex}
              aria-label={`Set ${name} to quality band ${index + 1} (${band.start}–${band.end})`}
              title={`Band ${index + 1}: ${band.start}–${band.end}; representative quality ${band.mappedValue}`}
              onClick={() => onQualityChange(getBandEffectiveQuality(bands, index))}
            >
              <i aria-hidden="true" />
              <span>{band.start}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CraftLabMaterialCard({
  mat,
  quality,
  bands,
  effects,
  onQualityChange,
}: {
  mat: RecipeMaterial;
  quality: number;
  bands: QualityBand[];
  effects: MaterialEffectAtQuality[];
  onQualityChange: (quality: number) => void;
}) {
  const name = formatMaterialDisplayName(mat.material_name);
  const bandIndex = bands.length ? findNearestBandForQuality(bands, quality) : -1;
  // null while not editing, so the box always shows the live quality.
  const [draft, setDraft] = useState<string | null>(null);
  const commitDraft = () => {
    const parsed = Number(draft);
    setDraft(null);
    if (draft === null || draft.trim() === "" || !Number.isFinite(parsed)) return;
    onQualityChange(clampQuality(parsed));
  };
  const quantity = Number.isFinite(mat.quantity) ? mat.quantity : null;

  return (
    <div className="craft-v31-material" data-craft-material={name}>
      <div className="craft-v31-material-head">
        <MaterialMark name={mat.material_name} />
        <div className="craft-v31-material-title">
          <b title={mat.slot ? `${mat.slot} slot` : undefined}>{name}</b>
          <span>{mat.slot ? `${mat.slot} · ` : ""}{quantity === null ? "Quantity unknown" : `× ${formatCraftingCompactNumber(quantity)}`}</span>
        </div>
        {effects.length > 0 ? (
          <div className="craft-v31-material-effect" aria-label={`${name} quality effects`}>
            {effects.map((effect) => (
              <span key={effect.key} className="craft-v31-material-effect-item">
                {effect.label} <strong className={effect.impactClass}>{effect.value}</strong>
              </span>
            ))}
          </div>
        ) : (
          <span className="craft-v31-material-effect craft-v31-material-effect--none" title="No quality modifier">
            <span aria-hidden="true">—</span>
            <span className="craft-v31-visually-hidden">No quality modifier</span>
          </span>
        )}
        <div className="craft-v31-material-quality">
          {bandIndex >= 0 ? <span className="craft-v31-visually-hidden">Band {bandIndex + 1} · {titleCase(getQualityTierFromBand(bandIndex + 1))}</span> : null}
          <input
            type="number"
            min={0}
            max={SLIDER_MAX_QUALITY}
            step={1}
            className="craft-v31-exact-quality"
            value={draft ?? String(quality)}
            aria-label={`Exact quality for ${name}`}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                setDraft(null);
                event.currentTarget.blur();
              }
            }}
          />
        </div>
      </div>
      {bands.length > 0 ? (
        <QualitySlider name={name} quality={quality} bands={bands} bandIndex={bandIndex} onQualityChange={onQualityChange} />
      ) : (
        <p className="craft-v31-band-unavailable">Quality bands are unavailable for this material.</p>
      )}
    </div>
  );
}

type PerformanceRow = {
  key: string;
  label: string;
  metadata?: string;
  base: string;
  atQuality: string;
  /** Signed absolute change, in the statistic's display units. */
  absolute?: string;
  /** Signed percentage change, when the base allows one. */
  percent?: string;
  changed: boolean;
  impactClass?: string;
  title?: string;
};

type PerformanceGroup = { title: string; rows: PerformanceRow[]; changed: number };

const DIRECTION_TITLE = {
  "higher-is-better": "Higher is better",
  "lower-is-better": "Lower is better",
  neutral: "No directional preference",
} as const;

/** Outcome word from the shared impact class: benefit, not numeric sign. */
/** Category bands show every stat without hiding or duplicate summaries. */
function PerformanceCategory({ group }: { group: PerformanceGroup }) {
  const iconSrc = getStatGroupIconSrc(group.title.toLowerCase().replace(/[^a-z0-9]/g, ""));
  return (
    <section className={"craft-v31-spec-band" + (group.changed ? " has-changes" : "")} aria-label={group.title}>
      <div className="craft-v31-spec-band-label">
        <h4>{iconSrc ? <img className="craft-v31-spec-band-icon" src={iconSrc} alt="" /> : null}<span>{group.title}</span></h4>
        {group.changed > 0 ? <span>{group.changed} changed</span> : null}
      </div>
      <div className="craft-v31-spec-band-values">
        {group.rows.map((row) => {
          const hasBase = !["", "-", "—", "Not extracted"].includes(row.base.trim());
          const showBase = row.changed && hasBase && row.base !== row.atQuality;
          return (
            <div key={row.key} className={"craft-v31-spec-metric" + (row.changed ? " is-changed" : "")} title={row.title}>
              <span className="craft-v31-spec-metric-label">{row.label}{row.metadata ? <small> {row.metadata}</small> : null}</span>
              <div className="craft-v31-spec-metric-result">
                <strong>{row.atQuality}</strong>
                {row.changed && (row.percent ?? row.absolute) ? (
                  <span className={"craft-v31-spec-metric-delta " + (row.impactClass ?? "")}>{row.percent ?? row.absolute}</span>
                ) : null}
              </div>
              {showBase ? <span className="craft-v31-spec-metric-base">Base {row.base}{row.absolute && row.percent ? " · " + row.absolute : ""}</span> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** All real component statistics are visible, grouped and aligned. */
export function CraftLabPerformance({
  recipe,
  fittingDetail,
  fittingStatsLoading,
  fittingStatsMissing,
  fittingStatsError,
  totalModifiers,
  comparison,
}: {
  recipe: ComponentRecipe;
  fittingDetail?: FittingComponentDetail | null;
  fittingStatsLoading?: boolean;
  fittingStatsMissing?: boolean;
  fittingStatsError?: string | null;
  totalModifiers: TotalModifierRow[];
  /** Optional comparison control, beside the visible statistics heading. */
  comparison?: ReactNode;
}) {
  const model = useMemo(() => buildCraftStatViewModel({
    detail: fittingDetail,
    recipe,
    targetModifiers: totalModifiers,
    allocationModifiers: totalModifiers,
    targetConfigured: true,
    loading: fittingStatsLoading,
    missing: fittingStatsMissing,
    error: fittingStatsError,
  }), [fittingDetail, fittingStatsError, fittingStatsLoading, fittingStatsMissing, recipe, totalModifiers]);

  const groups = useMemo<PerformanceGroup[]>(() => {
    const seen = new Set<string>();
    const result: PerformanceGroup[] = [];
    if (model.status === "ready") {
      for (const group of buildConsolidatedGroups(model)) {
        const rows: PerformanceRow[] = [];
        for (const stat of group.stats) {
          if (stat.kind === "static") {
            const label = formatCompactStatLabel(stat.label);
            seen.add(normalizeStatKey(stat.label));
            rows.push({ key: `${group.title}:${stat.label}`, label: label.label, metadata: label.metadata, base: stat.value, atQuality: stat.value, changed: false, title: "No quality modifier applies" });
            continue;
          }
          const row = stat.row;
          if (row.baseValue === "-" && !comparisonIsModified(row)) continue;
          const label = formatCompactStatLabel(row.label);
          seen.add(normalizeStatKey(row.label));
          const ready = row.target.state === "ready";
          const absolute = ready ? row.target.absoluteDelta : undefined;
          const percent = ready ? row.target.percentDelta : undefined;
          rows.push({
            key: row.statId,
            label: label.label,
            metadata: label.metadata,
            base: row.baseValue,
            atQuality: ready ? row.target.value : row.target.emptyLabel ?? "—",
            absolute,
            percent,
            changed: ready && comparisonIsModified(row) && Boolean(absolute ?? percent),
            impactClass: ready ? row.target.impactClass : undefined,
            title: DIRECTION_TITLE[row.benefitDirection],
          });
        }
        if (rows.length) result.push({ title: formatStatLabel(group.title), rows, changed: rows.filter((row) => row.changed).length });
      }
    }
    // Extracted quality modifiers whose statistic is not in the component data
    // stay visible rather than disappearing from the projection.
    const unmatched = totalModifiers
      .filter((modifier) => hasEffectiveModifierValue(modifier.totalValue, modifier.modifierMode))
      .filter((modifier) => !seen.has(normalizeStatKey(getModifierStatBindingLabel(modifier.property))))
      .map<PerformanceRow>((modifier) => {
        const display = formatMaterialModifierDisplay(modifier.property, getCraftingModifierBaseValue(fittingDetail, modifier.property), modifier.totalValue, modifier.modifierMode);
        const extracted = Boolean(display.total);
        return {
          key: getTotalModifierKey(modifier.property, modifier.modifierMode),
          label: getModifierStatBindingLabel(modifier.property),
          base: display.base ?? "Not extracted",
          atQuality: display.total ?? "Not extracted",
          absolute: extracted ? display.modifier : `${formatCraftingContributionValue(modifier.totalValue, modifier.modifierMode)} modifier`,
          percent: extracted && display.modifierPercent !== display.modifier ? display.modifierPercent : undefined,
          changed: true,
          impactClass: getCraftingImpactClass(getModifierImpact(modifier.property, modifier.totalValue)),
        };
      });
    if (unmatched.length) result.push({ title: "Other quality modifiers", rows: unmatched, changed: unmatched.length });
    return result;
  }, [fittingDetail, model, totalModifiers]);

  const loading = model.status === "loading";
  // Changing materials should surface the affected group before unchanged specifications.
  const displayGroups = [...groups].sort((a, b) => b.changed - a.changed);

  return (
    <section className="craft-v31-performance-panel" aria-label="Component statistics">
      <div className="craft-v31-performance-heading">
        <LabIcon name="stat" />
        <h3>Performance</h3>
        {comparison}
      </div>
      {loading ? (
        <p className="craft-v31-table-state" aria-busy="true">Loading component statistics…</p>
      ) : groups.length === 0 ? (
        <p className="craft-v31-table-state" role={fittingStatsError ? "alert" : undefined}>
          {model.unavailableReason ?? "No component statistics are available."}
        </p>
      ) : (
        <div className="craft-v31-spec-bands">
          {displayGroups.map((group) => <PerformanceCategory key={group.title} group={group} />)}
        </div>
      )}
    </section>
  );
}

export type ModifierInvestigationRow = {
  key: string;
  material: string;
  slot?: string;
  quality: number;
  effects: MaterialEffectAtQuality[];
};

/** Material slot → modifier → quality → effect, behind a compact Modifier Details disclosure. */
export function CraftLabModifierDetails({ rows }: { rows: ModifierInvestigationRow[] }) {
  const activeEffects = rows.reduce((sum, row) => sum + row.effects.length, 0);
  const unaffected = rows.filter((row) => row.effects.length === 0).length;
  return (
    <details className="craft-v31-disclosure craft-v31-modifier-details">
      <summary>
        <LabIcon name="details" />
        <span>Modifier details</span>
        <small>
          {activeEffects} active {activeEffects === 1 ? "modifier" : "modifiers"}
          {unaffected > 0 ? ` · ${unaffected} ${unaffected === 1 ? "material" : "materials"} without quality effect` : ""}
        </small>
      </summary>
      <div className="craft-v31-table-wrap">
        <table className="craft-v31-data-table craft-v31-modifier-table" aria-label="Material modifier investigation">
          <thead><tr><th scope="col">Material slot</th><th scope="col">Modifier</th><th scope="col">Quality</th><th scope="col">Effect</th></tr></thead>
          <tbody>
            {rows.flatMap((row) => (row.effects.length ? row.effects : [null]).map((effect, index) => (
              <tr key={`${row.key}:${effect?.key ?? "none"}`}>
                {index === 0 ? (
                  <th scope="row" rowSpan={Math.max(1, row.effects.length)}>
                    <span className="craft-v31-modifier-material"><MaterialMark name={row.material} />{formatMaterialDisplayName(row.material)}</span>
                    {row.slot ? <small>{row.slot}</small> : null}
                  </th>
                ) : null}
                <td>{effect?.label ?? "No quality modifier"}</td>
                <td>{row.quality}</td>
                <td className={`craft-v31-change ${effect?.impactClass ?? ""}`.trim()}>{effect?.value ?? "—"}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
