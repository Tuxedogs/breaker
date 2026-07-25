import type {
  CraftStatComparisonColumnView,
  CraftStatComparisonRowView,
  CraftStatViewModel,
} from "../../lib/crafting/craftStatViewModel";

type ConsolidatedStat =
  | { kind: "comparison"; row: CraftStatComparisonRowView }
  | { kind: "static"; label: string; value: string };

type ConsolidatedStatGroup = { title: string; stats: ConsolidatedStat[] };

const WEAPON_DAMAGE_CHANNEL_KEYS = new Set([
  "ballisticdamage",
  "physicaldamage",
  "energydamage",
  "distortiondamage",
  "thermaldamage",
  "biochemicaldamage",
  "stundamage",
]);

function normalizeStatKey(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalized === "componenthp" ? "health" : normalized;
}

function normalizeGroupKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatStatLabel(value: string): string {
  return value.replace(/\s*\/\s*/g, " and ");
}

function buildConsolidatedGroups(model: CraftStatViewModel): ConsolidatedStatGroup[] {
  const comparisonByGroup = new Map(
    model.comparisonGroups.map((group) => [normalizeGroupKey(group.title), group] as const),
  );
  const usedComparisonGroups = new Set<string>();
  const groups: ConsolidatedStatGroup[] = [];

  for (const overviewGroup of model.overviewGroups) {
    const groupKey = normalizeGroupKey(overviewGroup.title);
    const comparisonGroup = comparisonByGroup.get(groupKey);
    const comparisonKeys = new Set(
      comparisonGroup?.rows.map((row) => normalizeStatKey(row.label)) ?? [],
    );
    const hasAlphaDamage = comparisonKeys.has("alphadamage")
      || overviewGroup.stats.some((stat) => normalizeStatKey(stat.label) === "alphadamage");
    const stats: ConsolidatedStat[] = overviewGroup.stats
      .filter((stat) => {
        const statKey = normalizeStatKey(stat.label);
        return !comparisonKeys.has(statKey)
          && !(hasAlphaDamage && WEAPON_DAMAGE_CHANNEL_KEYS.has(statKey));
      })
      .map((stat) => ({ kind: "static", label: stat.label, value: stat.value }));

    if (comparisonGroup) {
      usedComparisonGroups.add(groupKey);
      stats.push(...comparisonGroup.rows.map((row) => ({ kind: "comparison" as const, row })));
    }

    if (stats.length > 0) groups.push({ title: overviewGroup.title, stats });
  }

  for (const comparisonGroup of model.comparisonGroups) {
    const groupKey = normalizeGroupKey(comparisonGroup.title);
    if (usedComparisonGroups.has(groupKey)) continue;
    groups.push({
      title: comparisonGroup.title,
      stats: comparisonGroup.rows.map((row) => ({ kind: "comparison", row })),
    });
  }

  return groups;
}

function ComparisonDelta({ column }: { column: CraftStatComparisonColumnView }) {
  if (column.state !== "ready") return null;
  const delta = column.percentDelta ?? column.absoluteDelta;
  if (!delta) return <span className="bq-stat-compare-delta bq-stat-compare-delta--neutral">(0%)</span>;
  return (
    <span className={`bq-stat-compare-delta ${column.impactClass ?? "bq-stat-compare-delta--neutral"}`}>
      ({delta})
    </span>
  );
}

function hasNonZeroDelta(value: string | undefined): boolean {
  if (!value) return false;
  const parsed = Number.parseFloat(value.replace(/[^0-9+.-]/g, ""));
  return Number.isFinite(parsed) && Math.abs(parsed) > 0.0001;
}

function columnDiffersFromBase(column: CraftStatComparisonColumnView, baseValue: string): boolean {
  if (column.state !== "ready") return false;
  return hasNonZeroDelta(column.percentDelta)
    || hasNonZeroDelta(column.absoluteDelta)
    || (column.percentDelta === undefined && column.absoluteDelta === undefined && column.value !== baseValue);
}

function comparisonIsModified(row: CraftStatComparisonRowView): boolean {
  return columnDiffersFromBase(row.target, row.baseValue)
    || columnDiffersFromBase(row.allocation, row.baseValue);
}

function ComparisonColumn({ column }: { column: CraftStatComparisonColumnView }) {
  if (column.state !== "ready") {
    return (
      <span className="bq-stat-compare-empty" data-bq-stat-state={column.state}>
        {column.emptyLabel ?? column.value}
      </span>
    );
  }
  return (
    <span className="bq-stat-compare-cell">
      <strong className={`bq-stat-compare-value ${column.impactClass ?? "bq-stat-compare-value--neutral"}`}>
        {column.value}
      </strong>
      <ComparisonDelta column={column} />
    </span>
  );
}

function DirectionIndicator({ direction }: { direction: CraftStatComparisonRowView["benefitDirection"] }) {
  if (direction === "higher-is-better") {
    return <span className="bq-stat-direction bq-stat-direction--higher">Higher is better</span>;
  }
  if (direction === "lower-is-better") {
    return <span className="bq-stat-direction bq-stat-direction--lower">Lower is better</span>;
  }
  return <span className="bq-stat-direction bq-stat-direction--neutral">Neutral</span>;
}

function ComparisonStat({ row }: { row: CraftStatComparisonRowView }) {
  return (
    <article className="bq-stat-compare-row" data-bq-benefit-direction={row.benefitDirection} aria-label={`${row.label} comparison`}>
      <div className="bq-stat-compare-heading">
        <strong className="bq-stat-compare-label">{formatStatLabel(row.label)}</strong>
        {row.unit !== "-" ? <span className="bq-stat-compare-unit">{row.unit}</span> : null}
      </div>
      <div className="bq-stat-compare-values">
        <span className="bq-stat-compare-slot bq-stat-compare-base">
          <span className="bq-stat-compare-slot-label">Base</span>
          <strong>{row.baseValue}</strong>
        </span>
        <span className="bq-stat-compare-slot bq-stat-compare-target">
          <span className="bq-stat-compare-slot-label">Target</span>
          <span className="bq-stat-compare-slot-content"><ComparisonColumn column={row.target} /></span>
        </span>
        <span className="bq-stat-compare-slot bq-stat-compare-allocation">
          <span className="bq-stat-compare-slot-label">Allocation</span>
          <span className="bq-stat-compare-slot-content"><ComparisonColumn column={row.allocation} /></span>
        </span>
      </div>
      <div className="bq-stat-compare-direction"><DirectionIndicator direction={row.benefitDirection} /></div>
    </article>
  );
}

function getEndProductColumn(row: CraftStatComparisonRowView): CraftStatComparisonColumnView | null {
  if (row.allocation.state === "ready") return row.allocation;
  if (row.target.state === "ready") return row.target;
  return null;
}

function CompactStat({
  label,
  value,
  unit,
  impactClass,
}: {
  label: string;
  value: string;
  unit?: string;
  impactClass?: string;
}) {
  return (
    <div className="bq-stat-compact-row" role="listitem" aria-label={`${label}: ${value}${unit && unit !== "-" ? ` ${unit}` : ""}`}>
      <span className="bq-stat-compact-label">{formatStatLabel(label)}</span>
      <strong className={`bq-stat-compact-value ${impactClass ?? ""}`.trim()}>{value}</strong>
      {unit && unit !== "-" ? <span className="bq-stat-compact-unit">{unit}</span> : null}
    </div>
  );
}

function getModifiedStats(group: ConsolidatedStatGroup) {
  return group.stats.filter((stat): stat is Extract<ConsolidatedStat, { kind: "comparison" }> => (
    stat.kind === "comparison" && comparisonIsModified(stat.row)
  ));
}

function EndProductStatGroup({ group }: { group: ConsolidatedStatGroup }) {
  if (group.stats.length === 0) return null;
  return (
    <section className="bq-stat-unmodified-group" aria-label={`${formatStatLabel(group.title)} end product statistics`}>
      <h4 className="bq-stat-compare-group-title">{formatStatLabel(group.title)}</h4>
      <div className="bq-stat-compact-list" role="list">
        {group.stats.map((stat) => {
          if (stat.kind === "static") {
            return <CompactStat key={`${group.title}:${stat.label}`} label={stat.label} value={stat.value} />;
          }
          const endProduct = getEndProductColumn(stat.row);
          return (
            <CompactStat
              key={stat.row.statId}
              label={stat.row.label}
              value={endProduct?.value ?? stat.row.baseValue}
              unit={stat.row.unit}
              impactClass={endProduct?.impactClass}
            />
          );
        })}
      </div>
    </section>
  );
}

function ModifiedStatGroup({ group }: { group: ConsolidatedStatGroup }) {
  const modifiedStats = getModifiedStats(group);
  if (modifiedStats.length === 0) return null;
  return (
    <section className="bq-stat-modified-group" aria-label={`${formatStatLabel(group.title)} modified statistics`}>
      <h5>{formatStatLabel(group.title)}</h5>
      <div className="bq-stat-compare bq-stat-modified-list" role="list">
        {modifiedStats.map((stat) => <ComparisonStat key={stat.row.statId} row={stat.row} />)}
      </div>
    </section>
  );
}

function StatsLegend() {
  return (
    <div className="bq-stat-legend" aria-label="Comparison color legend">
      <span className="bq-stat-legend-item bq-stat-legend-item--benefit">+ Beneficial</span>
      <span className="bq-stat-legend-item bq-stat-legend-item--harm">− Detrimental</span>
    </div>
  );
}

export function BuildQueueCraftOverviewPanel({ model }: { model: CraftStatViewModel }) {
  if (model.status === "loading") {
    return <div className="bq-stats-overview bq-stats-panel--empty" data-bq-stats-status="loading"><p className="bq-stats-breakdown-empty">Loading stats...</p></div>;
  }
  if (model.status !== "ready") {
    return <div className="bq-stats-overview bq-stats-panel--empty" data-bq-stats-status="unavailable"><p className="bq-stats-breakdown-empty">{model.unavailableReason ?? "Stats unavailable"}</p></div>;
  }
  return <div className="bq-stats-overview" data-bq-stats-status="ready" data-bq-stats-category={model.category}><BuildQueueCraftIdentityPanel model={model} /></div>;
}

export function BuildQueueCraftIdentityPanel({ model }: { model: CraftStatViewModel }) {
  if (model.status !== "ready" || model.identity.length === 0) return null;
  return (
    <div className="bq-stats-meta bq-stats-meta--header" aria-label="Component identity">
      {model.identity.map((badge) => (
        <span key={`${badge.label}:${badge.value}`} className="bq-stats-meta-badge">
          <span>{badge.label}</span><strong>{badge.value}</strong>
        </span>
      ))}
    </div>
  );
}

export function BuildQueueCraftStatisticsPanel({ model }: { model: CraftStatViewModel }) {
  if (model.status === "loading") {
    return <section className="bq-component-statistics bq-component-statistics--empty bq-workspace-card" data-bq-stats-status="loading"><p className="bq-stats-breakdown-empty">Loading component statistics...</p></section>;
  }
  if (model.status !== "ready" || (model.comparisonGroups.length === 0 && model.overviewGroups.length === 0)) {
    return <section className="bq-component-statistics bq-component-statistics--empty bq-workspace-card" data-bq-stats-status="unavailable"><p className="bq-stats-breakdown-empty">{model.unavailableReason ?? "Component statistics unavailable"}</p></section>;
  }

  const consolidatedGroups = buildConsolidatedGroups(model);
  const hasModifiedStats = consolidatedGroups.some((group) => getModifiedStats(group).length > 0);
  return (
    <section className="bq-component-statistics bq-workspace-card" data-bq-stats-status="ready" data-bq-stats-category={model.category} aria-label="Component statistics">
      <header className="bq-component-statistics-header">
        <h3 className="bq-component-statistics-title">Component Statistics</h3>
        <StatsLegend />
      </header>
      <div className="bq-component-statistics-body">
        <div className="bq-stat-unmodified-column" aria-label="End product statistics">
          {consolidatedGroups.map((group) => <EndProductStatGroup key={group.title} group={group} />)}
        </div>
        {hasModifiedStats ? (
          <aside className="bq-stat-modified-card" aria-label="Modified statistics">
            <h4>Modified</h4>
            {consolidatedGroups.map((group) => <ModifiedStatGroup key={group.title} group={group} />)}
          </aside>
        ) : null}
      </div>
    </section>
  );
}

/** @deprecated Use BuildQueueCraftOverviewPanel or BuildQueueCraftStatisticsPanel */
export default function BuildQueueCraftStatsPanel({ model }: { model: CraftStatViewModel }) {
  return <><BuildQueueCraftOverviewPanel model={model} /><BuildQueueCraftStatisticsPanel model={model} /></>;
}
