import { useLayoutEffect, useMemo, useRef, type CSSProperties } from "react";
import { toCraftStatDisplayLabel } from "@/lib/crafting/craftingDetailStats";
import type {
  CraftStatComparisonColumnView,
  CraftStatComparisonRowView,
  CraftStatViewModel,
} from "@/lib/crafting/craftStatViewModel";
import { getStatGroupIconSrc } from "@/components/logistics/componentStatGroupIcons";
import {
  CompactCraftStatRow,
  CraftStatComparisonRow,
  CraftStatSection,
} from "./CraftStatisticsPresentation";
import "./craft-statistics-cards.css";

type ConsolidatedStat =
  | { kind: "comparison"; row: CraftStatComparisonRowView }
  | { kind: "static"; label: string; value: string };

type ConsolidatedStatGroup = { title: string; stats: ConsolidatedStat[] };
export type CraftStatisticsView = "all" | "performance" | "engineering";

const STATISTICS_CARD_GAP = 12;

const WEAPON_DAMAGE_CHANNEL_KEYS = new Set([
  "ballisticdamage", "physicaldamage", "energydamage", "distortiondamage", "thermaldamage",
  "biochemicaldamage", "stundamage",
]);

const ENGINEERING_GROUP_KEYS = new Set([
  "thermalandpower", "thermalpower", "powerandthermal", "powerthermal", "signatureanddetection",
  "signaturedetection", "signatures", "durabilityandphysical", "durabilityphysical", "repair", "fireactions",
]);

function normalizeStatKey(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized === "componenthp") return "health";
  if (normalized.startsWith("weaponrecoil")) return normalized.slice("weapon".length);
  return normalized;
}

function normalizeGroupKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatStatLabel(value: string): string {
  return toCraftStatDisplayLabel(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s*\/\s*/g, " and ");
}

function getStatGroupIcon(title: string) {
  const src = getStatGroupIconSrc(normalizeGroupKey(title));
  return src ? <img className="craft-stat-group-icon" src={src} alt="" /> : undefined;
}

function formatCompactStatLabel(value: string): { label: string; metadata?: string } {
  const formatted = formatStatLabel(value);
  const derivedMatch = formatted.match(/^(.*?)(\s*\(derived\))$/i);
  return derivedMatch ? { label: derivedMatch[1].trim(), metadata: derivedMatch[2].trim() } : { label: formatted };
}

function prioritizeAlphaDamage(stats: ConsolidatedStat[]): ConsolidatedStat[] {
  const index = stats.findIndex((stat) => normalizeStatKey(stat.kind === "comparison" ? stat.row.label : stat.label) === "alphadamage");
  return index <= 0 ? stats : [stats[index], ...stats.slice(0, index), ...stats.slice(index + 1)];
}

function buildConsolidatedGroups(model: CraftStatViewModel): ConsolidatedStatGroup[] {
  const comparisons = new Map(model.comparisonGroups.map((group) => [normalizeGroupKey(group.title), group] as const));
  const allComparisonKeys = new Set(model.comparisonGroups.flatMap((group) => group.rows.map((row) => normalizeStatKey(row.label))));
  const used = new Set<string>();
  const groups: ConsolidatedStatGroup[] = [];

  for (const overview of model.overviewGroups) {
    const key = normalizeGroupKey(overview.title);
    const comparison = comparisons.get(key);
    const comparisonKeys = new Set(comparison?.rows.map((row) => normalizeStatKey(row.label)) ?? []);
    const hasAlpha = comparisonKeys.has("alphadamage") || overview.stats.some((stat) => normalizeStatKey(stat.label) === "alphadamage");
    const stats: ConsolidatedStat[] = overview.stats
      .filter((stat) => !allComparisonKeys.has(normalizeStatKey(stat.label)) && !(hasAlpha && WEAPON_DAMAGE_CHANNEL_KEYS.has(normalizeStatKey(stat.label))))
      .map((stat) => ({ kind: "static", label: stat.label, value: stat.value }));
    if (comparison) {
      used.add(key);
      stats.push(...comparison.rows.map((row) => ({ kind: "comparison" as const, row })));
    }
    if (stats.length > 0) groups.push({ title: overview.title, stats: prioritizeAlphaDamage(stats) });
  }

  for (const comparison of model.comparisonGroups) {
    if (used.has(normalizeGroupKey(comparison.title))) continue;
    groups.push({ title: comparison.title, stats: prioritizeAlphaDamage(comparison.rows.map((row) => ({ kind: "comparison", row }))) });
  }
  return groups;
}

function hasNonZeroDelta(value: string | undefined): boolean {
  const parsed = Number.parseFloat(value?.replace(/[^0-9+.-]/g, "") ?? "");
  return Number.isFinite(parsed) && Math.abs(parsed) > 0.0001;
}

function comparisonIsModified(row: CraftStatComparisonRowView): boolean {
  const differs = (column: CraftStatComparisonColumnView) => column.state === "ready" && (
    hasNonZeroDelta(column.percentDelta) || hasNonZeroDelta(column.absoluteDelta)
    || (column.percentDelta === undefined && column.absoluteDelta === undefined && column.value !== row.baseValue)
  );
  return differs(row.target) || differs(row.allocation);
}

function ComparisonValue({ column }: { column: CraftStatComparisonColumnView }) {
  if (column.state !== "ready") return <span className="craft-stat-comparison-empty">{column.emptyLabel ?? "—"}</span>;
  return <span className={`craft-stat-comparison-value ${column.impactClass ?? ""}`.trim()}>{column.value}{column.absoluteDelta ?? column.percentDelta ? <span className={`craft-stat-comparison-delta ${column.impactClass ?? ""}`.trim()}>{column.absoluteDelta ?? column.percentDelta}</span> : null}</span>;
}

function EndProductStatGroup({ group }: { group: ConsolidatedStatGroup }) {
  const visible = group.stats.filter((stat) => stat.kind === "static" || stat.row.baseValue !== "-" || comparisonIsModified(stat.row));
  if (visible.length === 0) return null;
  return <CraftStatSection title={formatStatLabel(group.title)} ariaLabel={`${formatStatLabel(group.title)} end product statistics`} variant="compact" icon={getStatGroupIcon(group.title)}>
    {visible.map((stat) => {
      if (stat.kind === "static") {
        const label = formatCompactStatLabel(stat.label);
        return <CompactCraftStatRow key={`${group.title}:${stat.label}`} label={label.label} labelMetadata={label.metadata} value={stat.value} />;
      }
      const label = formatCompactStatLabel(stat.row.label);
      return <CraftStatComparisonRow key={stat.row.statId} label={`${label.label}${label.metadata ? ` ${label.metadata}` : ""}`} base={<span className="craft-stat-comparison-value">{stat.row.baseValue}</span>} target={<ComparisonValue column={stat.row.target} />} allocation={<ComparisonValue column={stat.row.allocation} />} direction={<span className="craft-stat-direction">{stat.row.benefitDirection === "higher-is-better" ? "Higher is better" : stat.row.benefitDirection === "lower-is-better" ? "Lower is better" : "No directional preference"}</span>} benefitDirection={stat.row.benefitDirection} />;
    })}
  </CraftStatSection>;
}

function usePackedStatisticsLayout(enabled: boolean, dependencyKey: string) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reset = () => {
      container.style.removeProperty("height");
      container.style.removeProperty("position");
      for (const card of Array.from(container.querySelectorAll<HTMLElement>(":scope > .craft-stat-section"))) {
        card.style.removeProperty("position");
        card.style.removeProperty("width");
        card.style.removeProperty("transform");
      }
    };

    if (!enabled) {
      reset();
      return reset;
    }

    let frame = 0;
    const layout = () => {
      const cards = Array.from(container.querySelectorAll<HTMLElement>(":scope > .craft-stat-section"));
      const columnCount = getComputedStyle(container).gridTemplateColumns.split(" ").filter(Boolean).length;
      if (columnCount <= 1 || cards.length === 0) {
        reset();
        return;
      }

      const columnWidth = (container.clientWidth - ((columnCount - 1) * STATISTICS_CARD_GAP)) / columnCount;
      const columnHeights = Array.from({ length: columnCount }, () => 0);

      container.style.position = "relative";
      for (const [index, card] of cards.entries()) {
        const column = index % columnCount;
        const top = columnHeights[column];
        card.style.position = "absolute";
        card.style.width = `${columnWidth}px`;
        card.style.transform = `translate(${column * (columnWidth + STATISTICS_CARD_GAP)}px, ${top}px)`;
        columnHeights[column] += card.offsetHeight + STATISTICS_CARD_GAP;
      }
      container.style.height = `${Math.max(...columnHeights) - STATISTICS_CARD_GAP}px`;
    };

    const scheduleLayout = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(layout);
    };

    const observer = new ResizeObserver(scheduleLayout);
    observer.observe(container);
    for (const card of Array.from(container.querySelectorAll<HTMLElement>(":scope > .craft-stat-section"))) observer.observe(card);
    window.addEventListener("resize", scheduleLayout);
    scheduleLayout();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", scheduleLayout);
      reset();
    };
  }, [dependencyKey, enabled]);

  return containerRef;
}

export function CraftStatisticsCards({ model, view = "all", hasError = false, className }: { model: CraftStatViewModel; view?: CraftStatisticsView; hasError?: boolean; className?: string }) {
  const groups = useMemo(() => model.status === "ready" ? buildConsolidatedGroups(model) : [], [model]);
  const visibleGroups = groups.filter((group) => view === "all" || (view === "engineering" ? ENGINEERING_GROUP_KEYS.has(normalizeGroupKey(group.title)) : !ENGINEERING_GROUP_KEYS.has(normalizeGroupKey(group.title))));
  const hasStatistics = model.comparisonGroups.length > 0 || model.overviewGroups.length > 0;
  const phase = model.status === "loading" ? "loading" : model.status !== "ready" ? (hasError ? "error" : "unavailable") : hasStatistics ? "ready" : "empty";
  const viewLabel = view === "all" ? "component" : view;
  const layoutStyle = model.desktopColumns
    ? {
      "--craft-statistics-desktop-columns": model.desktopColumns,
      "--craft-statistics-tablet-columns": 2,
    } as CSSProperties
    : undefined;
  const containerRef = usePackedStatisticsLayout(phase === "ready", `${phase}:${visibleGroups.map((group) => group.title).join("|")}`);

  return <div ref={containerRef} className={`craft-statistics-cards craft-statistics-cards--${phase} ${className ?? ""}`.trim()} style={layoutStyle} data-craft-statistics-status={phase} data-craft-statistics-category={model.category} aria-label={`${viewLabel} end product statistics`} aria-busy={phase === "loading"}>
    {phase === "loading" ? <div className="craft-statistics-loading" aria-label="Loading component statistics"><span /><span /><span /></div>
      : phase === "error" ? <p className="craft-statistics-empty" role="alert">{model.unavailableReason ?? "Component statistics could not be loaded."}</p>
      : phase !== "ready" ? <p className="craft-statistics-empty">{phase === "empty" ? "No component statistics are available." : model.unavailableReason ?? "Component statistics unavailable"}</p>
      : visibleGroups.length > 0 ? visibleGroups.map((group) => <EndProductStatGroup key={group.title} group={group} />) : <p className="craft-statistics-empty">No {viewLabel} statistics are available for this component.</p>}
  </div>;
}
