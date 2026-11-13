import { useLayoutEffect, useMemo, useRef, type CSSProperties } from "react";
import type {
  CraftStatComparisonColumnView,
  CraftStatViewModel,
} from "@/lib/crafting/craftStatViewModel";
import { getStatGroupIconSrc } from "@/components/logistics/componentStatGroupIcons";
import {
  CompactCraftStatRow,
  CraftStatComparisonRow,
  CraftStatSection,
} from "./CraftStatisticsPresentation";
import {
  buildConsolidatedGroups,
  comparisonIsModified,
  formatCompactStatLabel,
  formatStatLabel,
  normalizeGroupKey,
  type ConsolidatedStatGroup,
} from "./craftStatisticsGroups";
import "./craft-statistics-cards.css";

export type CraftStatisticsView = "all" | "performance" | "engineering";

const STATISTICS_CARD_GAP = 12;

const ENGINEERING_GROUP_KEYS = new Set([
  "thermalandpower", "thermalpower", "powerandthermal", "powerthermal", "signatureanddetection",
  "signaturedetection", "signatures", "durabilityandphysical", "durabilityphysical", "repair", "fireactions",
]);

function getStatGroupIcon(title: string) {
  const src = getStatGroupIconSrc(normalizeGroupKey(title));
  return src ? <img className="craft-stat-group-icon" src={src} alt="" /> : undefined;
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
