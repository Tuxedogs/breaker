import { useMemo, useState } from "react";
import type { BuildQueueProductQualitySummary } from "../../lib/logistics/buildQueueCraftStats";
import type {
  CraftStatComparisonColumnView,
  CraftStatComparisonRowView,
  CraftStatViewModel,
} from "../../lib/crafting/craftStatViewModel";
import {
  CompactCraftStatRow,
  CraftStatSection,
} from "../shared/CraftStatisticsPresentation";
import { getStatGroupIconSrc } from "./componentStatGroupIcons";

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
  const src = getStatGroupIconSrc(normalizeGroupKey(title));
  if (!src) return undefined;
  return <img className="bq-stat-group-icon" src={src} alt="" />;
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

function getEndProductColumn(row: CraftStatComparisonRowView): CraftStatComparisonColumnView | null {
  if (row.allocation.state === "ready") return row.allocation;
  if (row.target.state === "ready") return row.target;
  return null;
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

const ENGINEERING_GROUP_KEYS = new Set([
  "thermalandpower",
  "thermalpower",
  "powerandthermal",
  "powerthermal",
  "signatureanddetection",
  "signaturedetection",
  "signatures",
  "durabilityandphysical",
  "durabilityphysical",
  "repair",
]);

function getAllocationModifiedRows(groups: ConsolidatedStatGroup[]) {
  return groups.flatMap((group) => group.stats.flatMap((stat) => (
    stat.kind === "comparison" && columnDiffersFromBase(stat.row.allocation, stat.row.baseValue)
      ? [stat.row]
      : []
  )));
}

function formatProductQuality(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function getQualityDifference(productQuality: BuildQueueProductQualitySummary): string {
  const target = productQuality.target?.averageBand;
  const predicted = productQuality.predicted?.averageBand;
  if (target === undefined || predicted === undefined) return "—";
  const difference = predicted - target;
  if (Math.abs(difference) < 0.005) return "0";
  return `${difference > 0 ? "+" : ""}${formatProductQuality(difference)}`;
}

export function BuildQueueCraftTargetQualityPanel({ productQuality }: { productQuality: BuildQueueProductQualitySummary }) {
  return (
    <span className="bq-selected-target-quality">
      <span>Target Quality</span>
      <strong>{formatProductQuality(productQuality.target?.averageBand)}</strong>
    </span>
  );
}

export function BuildQueueCraftHeaderSummaryPanel({
  model,
  productQuality,
  materialsLabel,
  allocationPercentage,
}: {
  model: CraftStatViewModel;
  productQuality: BuildQueueProductQualitySummary;
  materialsLabel: string;
  allocationPercentage: number;
}) {
  const modifiedCount = model.status === "ready"
    ? getAllocationModifiedRows(buildConsolidatedGroups(model)).length
    : 0;
  return (
    <div className="bq-selected-summary-strip" aria-label="Selected craft summary">
      <span><small>Materials</small><strong>{materialsLabel}</strong></span>
      <span><small>Allocated</small><strong>{Math.max(0, Math.min(100, Math.round(allocationPercentage)))}%</strong></span>
      <span><small>Predicted Quality</small><strong>{formatProductQuality(productQuality.predicted?.averageBand)}</strong></span>
      <span><small>Modified Stats</small><strong>{modifiedCount}</strong></span>
    </div>
  );
}

export function BuildQueueCraftOutcomePanel({
  model,
  productQuality,
}: {
  model: CraftStatViewModel;
  productQuality: BuildQueueProductQualitySummary;
}) {
  const modifiedRows = model.status === "ready"
    ? getAllocationModifiedRows(buildConsolidatedGroups(model))
    : [];
  return (
    <section className="bq-craft-outcome bq-workspace-card" aria-label="Craft outcome">
      <header className="bq-craft-outcome-header">
        <h3>Craft Outcome</h3>
      </header>
      <div className="bq-craft-outcome-quality-grid">
        <span className="bq-craft-outcome-quality bq-craft-outcome-quality--target">
          <small>Target Quality</small>
          <strong>{formatProductQuality(productQuality.target?.averageBand)}</strong>
        </span>
        <span className="bq-craft-outcome-quality">
          <small>Predicted Quality</small>
          <strong>{formatProductQuality(productQuality.predicted?.averageBand)}</strong>
        </span>
        <span className="bq-craft-outcome-quality">
          <small>Difference</small>
          <strong>{getQualityDifference(productQuality)}</strong>
        </span>
      </div>
      <div className="bq-craft-outcome-stats">
        <div className="bq-craft-outcome-stats-head">
          <h4>Stat Changes</h4>
          <span>{modifiedRows.length} modified</span>
        </div>
        {model.status === "loading" ? (
          <p className="bq-craft-outcome-empty" data-bq-outcome-state="loading">Loading affected statistics…</p>
        ) : model.status !== "ready" ? (
          <p className="bq-craft-outcome-empty" data-bq-outcome-state="unavailable">Affected statistics unavailable.</p>
        ) : modifiedRows.length === 0 ? (
          <p className="bq-craft-outcome-empty" data-bq-outcome-state="unallocated">Allocate materials to preview affected statistics.</p>
        ) : (
          <div className="bq-craft-outcome-stat-list" role="list">
            {modifiedRows.slice(0, 4).map((row) => (
              <CompactCraftStatRow
                key={row.statId}
                label={formatStatLabel(row.label)}
                value={row.allocation.value}
                baseValue={row.baseValue}
                delta={row.allocation.percentDelta ?? row.allocation.absoluteDelta}
                unit={row.unit}
                valueClassName={row.allocation.impactClass}
              />
            ))}
            {modifiedRows.length > 4 ? (
              <p className="bq-craft-outcome-more">+ {modifiedRows.length - 4} more shown inline below</p>
            ) : null}
          </div>
        )}
      </div>
    </section>
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
  const [activeView, setActiveView] = useState<"performance" | "engineering">("performance");
  const consolidatedGroups = useMemo(
    () => model.status === "ready" ? buildConsolidatedGroups(model) : [],
    [model],
  );
  const visibleGroups = consolidatedGroups.filter((group) => (
    activeView === "engineering"
      ? ENGINEERING_GROUP_KEYS.has(normalizeGroupKey(group.title))
      : !ENGINEERING_GROUP_KEYS.has(normalizeGroupKey(group.title))
  ));

  if (model.status === "loading") {
    return <section className="bq-component-statistics bq-component-statistics--empty bq-workspace-card" data-bq-stats-status="loading"><p className="bq-stats-breakdown-empty">Loading component statistics...</p></section>;
  }
  if (model.status !== "ready" || (model.comparisonGroups.length === 0 && model.overviewGroups.length === 0)) {
    return <section className="bq-component-statistics bq-component-statistics--empty bq-workspace-card" data-bq-stats-status="unavailable"><p className="bq-stats-breakdown-empty">{model.unavailableReason ?? "Component statistics unavailable"}</p></section>;
  }

  return (
    <section className="bq-component-statistics bq-workspace-card" data-bq-stats-status="ready" data-bq-stats-category={model.category} aria-label="Component statistics">
      <header className="bq-component-statistics-header">
        <h3 className="bq-component-statistics-title">Component Statistics</h3>
        <div className="bq-stat-view-tabs" role="tablist" aria-label="Component statistic views">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "performance"}
            className={activeView === "performance" ? "is-active" : ""}
            onClick={() => setActiveView("performance")}
          >Performance</button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "engineering"}
            className={activeView === "engineering" ? "is-active" : ""}
            onClick={() => setActiveView("engineering")}
          >Engineering</button>
        </div>
      </header>
      <div className="bq-component-statistics-body">
        <div className="bq-stat-unmodified-column" aria-label={`${activeView} end product statistics`}>
          {visibleGroups.length > 0
            ? visibleGroups.map((group) => <EndProductStatGroup key={group.title} group={group} />)
            : <p className="bq-stats-breakdown-empty">No {activeView} statistics are available for this component.</p>}
        </div>
      </div>
    </section>
  );
}

/** @deprecated Use BuildQueueCraftOverviewPanel or BuildQueueCraftStatisticsPanel */
export default function BuildQueueCraftStatsPanel({ model }: { model: CraftStatViewModel }) {
  return <><BuildQueueCraftOverviewPanel model={model} /><BuildQueueCraftStatisticsPanel model={model} /></>;
}
