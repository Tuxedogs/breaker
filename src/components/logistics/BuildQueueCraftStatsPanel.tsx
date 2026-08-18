import type {
  CraftStatComparisonColumnView,
  CraftStatComparisonRowView,
  CraftStatViewModel,
} from "../../lib/crafting/craftStatViewModel";
import {
  CompactCraftStatRow,
  CraftStatComparisonRow,
  CraftStatSection,
} from "../shared/CraftStatisticsPresentation";

type ConsolidatedStat =
  | { kind: "comparison"; row: CraftStatComparisonRowView }
  | { kind: "static"; label: string; value: string };

type ConsolidatedStatGroup = { title: string; stats: ConsolidatedStat[] };

const STAT_GROUP_ICONS = new Map<string, number>([
  ["ballisticsdamage", 1],
  ["ballisticsanddamage", 1],
  ["damageoutput", 2],
  ["projectile", 3],
  ["penetration", 4],
  ["spread", 5],
  ["handling", 6],
  ["fireactions", 7],
  ["thermalpower", 8],
  ["thermalandpower", 8],
  ["signaturedetection", 9],
  ["signatureanddetection", 9],
  ["shieldperformance", 10],
  ["resistanceabsorption", 11],
  ["resistanceandabsorption", 11],
  ["output", 12],
  ["quantumtravel", 13],
  ["radarperformance", 14],
  ["powerthermal", 15],
  ["powerandthermal", 15],
  ["signatures", 16],
  ["repair", 17],
  ["durabilityphysical", 18],
  ["durabilityandphysical", 18],
  ["tooloutput", 19],
  ["beamrange", 20],
  ["identity", 21],
  ["damagetakenmultipliers", 22],
  ["protection", 23],
  ["environment", 24],
  ["additional", 25],
]);

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
  if (normalized === "componenthp") return "health";
  if (normalized.startsWith("weaponrecoil")) return normalized.slice("weapon".length);
  return normalized;
}

function normalizeGroupKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatStatLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s*\/\s*/g, " and ");
}

function getStatGroupIcon(title: string) {
  const iconIndex = STAT_GROUP_ICONS.get(normalizeGroupKey(title));
  if (!iconIndex) return undefined;
  return <span className={`bq-stat-group-icon bq-stat-group-icon--${String(iconIndex).padStart(2, "0")}`} />;
}

function formatCompactStatLabel(value: string): { label: string; metadata?: string } {
  const formatted = formatStatLabel(value);
  const derivedMatch = formatted.match(/^(.*?)(\s*\(derived\))$/i);
  if (!derivedMatch) return { label: formatted };
  return { label: derivedMatch[1].trim(), metadata: derivedMatch[2].trim() };
}

function prioritizeAlphaDamage(stats: ConsolidatedStat[]): ConsolidatedStat[] {
  const alphaIndex = stats.findIndex((stat) => (
    normalizeStatKey(stat.kind === "comparison" ? stat.row.label : stat.label) === "alphadamage"
  ));
  if (alphaIndex <= 0) return stats;
  return [
    stats[alphaIndex],
    ...stats.slice(0, alphaIndex),
    ...stats.slice(alphaIndex + 1),
  ];
}

function buildConsolidatedGroups(model: CraftStatViewModel): ConsolidatedStatGroup[] {
  const comparisonByGroup = new Map(
    model.comparisonGroups.map((group) => [normalizeGroupKey(group.title), group] as const),
  );
  const allComparisonKeys = new Set(
    model.comparisonGroups.flatMap((group) => group.rows.map((row) => normalizeStatKey(row.label))),
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
        return !allComparisonKeys.has(statKey)
          && !(hasAlphaDamage && WEAPON_DAMAGE_CHANNEL_KEYS.has(statKey));
      })
      .map((stat) => ({ kind: "static", label: stat.label, value: stat.value }));

    if (comparisonGroup) {
      usedComparisonGroups.add(groupKey);
      stats.push(...comparisonGroup.rows.map((row) => ({ kind: "comparison" as const, row })));
    }

    if (stats.length > 0) {
      groups.push({ title: overviewGroup.title, stats: prioritizeAlphaDamage(stats) });
    }
  }

  for (const comparisonGroup of model.comparisonGroups) {
    const groupKey = normalizeGroupKey(comparisonGroup.title);
    if (usedComparisonGroups.has(groupKey)) continue;
    groups.push({
      title: comparisonGroup.title,
      stats: prioritizeAlphaDamage(
        comparisonGroup.rows.map((row) => ({ kind: "comparison", row })),
      ),
    });
  }

  return groups;
}

function splitStatGroupsAcrossColumns(groups: ConsolidatedStatGroup[]): ConsolidatedStatGroup[][] {
  const columns = [
    { groups: [] as ConsolidatedStatGroup[], weight: 0 },
    { groups: [] as ConsolidatedStatGroup[], weight: 0 },
    { groups: [] as ConsolidatedStatGroup[], weight: 0 },
  ];

  const preferredColumnByGroup = new Map<string, number>([
    ["damageoutput", 0],
    ["ballisticsanddamage", 0],
    ["thermalandpower", 1],
    ["thermalpower", 1],
    ["durabilityandphysical", 2],
    ["durabilityphysical", 2],
  ]);
  const assignedGroups = new Set<ConsolidatedStatGroup>();

  for (const group of groups) {
    const preferredColumn = preferredColumnByGroup.get(normalizeGroupKey(group.title));
    if (preferredColumn === undefined || columns[preferredColumn].groups.length > 0) continue;
    columns[preferredColumn].groups.push(group);
    columns[preferredColumn].weight += group.stats.length + 1;
    assignedGroups.add(group);
  }

  for (const group of groups) {
    if (assignedGroups.has(group)) continue;
    const target = columns.reduce((lightest, column) => column.weight < lightest.weight ? column : lightest, columns[0]);
    target.groups.push(group);
    target.weight += group.stats.length + 1;
  }

  return columns.map((column) => column.groups);
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
    <CraftStatComparisonRow
      label={formatStatLabel(row.label)}
      unit={row.unit}
      base={<strong>{row.baseValue}</strong>}
      target={<ComparisonColumn column={row.target} />}
      allocation={<ComparisonColumn column={row.allocation} />}
      direction={<DirectionIndicator direction={row.benefitDirection} />}
      benefitDirection={row.benefitDirection}
    />
  );
}

function getEndProductColumn(row: CraftStatComparisonRowView): CraftStatComparisonColumnView | null {
  if (row.allocation.state === "ready") return row.allocation;
  if (row.target.state === "ready") return row.target;
  return null;
}

function getModifiedStats(group: ConsolidatedStatGroup) {
  return group.stats.filter((stat): stat is Extract<ConsolidatedStat, { kind: "comparison" }> => (
    stat.kind === "comparison" && comparisonIsModified(stat.row)
  ));
}

function EndProductStatGroup({ group }: { group: ConsolidatedStatGroup }) {
  const visibleStats = group.stats.filter((stat) => (
    stat.kind === "static"
    || stat.row.baseValue !== "-"
    || comparisonIsModified(stat.row)
  ));
  if (visibleStats.length === 0) return null;
  return (
    <CraftStatSection
      title={formatStatLabel(group.title)}
      ariaLabel={`${formatStatLabel(group.title)} end product statistics`}
      variant="compact"
      icon={getStatGroupIcon(group.title)}
    >
      {visibleStats.map((stat) => {
        if (stat.kind === "static") {
          const displayLabel = formatCompactStatLabel(stat.label);
          return (
            <CompactCraftStatRow
              key={`${group.title}:${stat.label}`}
              label={displayLabel.label}
              labelMetadata={displayLabel.metadata}
              value={stat.value}
            />
          );
        }
        const endProduct = getEndProductColumn(stat.row);
        const isModified = endProduct
          ? columnDiffersFromBase(endProduct, stat.row.baseValue)
          : false;
        const displayLabel = formatCompactStatLabel(stat.row.label);
        return (
          <CompactCraftStatRow
            key={stat.row.statId}
            label={displayLabel.label}
            labelMetadata={displayLabel.metadata}
            value={isModified ? endProduct?.value ?? stat.row.baseValue : stat.row.baseValue}
            baseValue={isModified ? stat.row.baseValue : undefined}
            delta={isModified ? endProduct?.absoluteDelta ?? endProduct?.percentDelta : undefined}
            unit={stat.row.unit}
            valueClassName={isModified ? endProduct?.impactClass : undefined}
          />
        );
      })}
    </CraftStatSection>
  );
}

function ModifiedStatGroup({ group }: { group: ConsolidatedStatGroup }) {
  const modifiedStats = getModifiedStats(group);
  if (modifiedStats.length === 0) return null;
  return (
    <CraftStatSection
      title={formatStatLabel(group.title)}
      ariaLabel={`${formatStatLabel(group.title)} modified statistics`}
      variant="comparison"
      icon={getStatGroupIcon(group.title)}
    >
      {modifiedStats.map((stat) => <ComparisonStat key={stat.row.statId} row={stat.row} />)}
    </CraftStatSection>
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
  const traitColumns = splitStatGroupsAcrossColumns(consolidatedGroups)
    .filter((column) => column.length > 0);
  return (
    <section className="bq-component-statistics bq-workspace-card" data-bq-stats-status="ready" data-bq-stats-category={model.category} aria-label="Component statistics">
      <header className="bq-component-statistics-header">
        <h3 className="bq-component-statistics-title">Component Statistics</h3>
        <StatsLegend />
      </header>
      <div className="bq-component-statistics-body">
        <div
          className={`bq-stat-unmodified-column${traitColumns.length === 1 ? " bq-stat-unmodified-column--single" : ""}`}
          aria-label="End product statistics"
        >
          {traitColumns.map((column, index) => (
            <div key={`trait-column-${index}`} className="bq-stat-trait-column">
              {column.map((group) => <EndProductStatGroup key={group.title} group={group} />)}
            </div>
          ))}
        </div>
        {hasModifiedStats ? (
          <aside className="bq-stat-modified-card" aria-label="Modified statistics">
            <h4>Modified Statistics</h4>
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
