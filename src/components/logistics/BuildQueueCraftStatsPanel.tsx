import { useState } from "react";
import type { BuildQueueProductQualitySummary } from "../../lib/logistics/buildQueueCraftStats";
import type { CraftStatViewModel } from "../../lib/crafting/craftStatViewModel";
import { CraftStatisticsCards } from "../shared/CraftStatisticsCards";

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

export function BuildQueueCraftOutcomePanel({
  productQuality,
}: {
  productQuality: BuildQueueProductQualitySummary;
}) {
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

function isPresentableIdentityBadge(badge: { label: string; value: string }): boolean {
  const value = badge.value.trim();
  if (!value || value === "-") return false;
  if (/^invalid\b/i.test(value) || /^invalid\b/i.test(badge.label.trim())) return false;
  return true;
}

export function BuildQueueCraftIdentityPanel({ model }: { model: CraftStatViewModel }) {
  if (model.status !== "ready") return null;
  const badges = model.identity.filter(isPresentableIdentityBadge);
  if (badges.length === 0) return null;
  return (
    <div className="bq-stats-meta bq-stats-meta--header" aria-label="Component identity">
      {badges.map((badge) => (
        <span key={`${badge.label}:${badge.value}`} className="bq-stats-meta-badge">
          <span>{badge.label}</span><strong>{badge.value}</strong>
        </span>
      ))}
    </div>
  );
}

export function BuildQueueCraftStatisticsPanel({ model, selectionId = model.title, hasError = false }: { model: CraftStatViewModel; selectionId?: string; hasError?: boolean }) {
  const [activeView, setActiveView] = useState<"performance" | "engineering">("performance");
  const hasStatistics = model.comparisonGroups.length > 0 || model.overviewGroups.length > 0;
  const phase = model.status === "loading" ? "loading" : model.status !== "ready" ? (hasError ? "error" : "unavailable") : hasStatistics ? "ready" : "empty";

  return (
    <section className={`bq-component-statistics bq-component-statistics--${phase} bq-workspace-card`} data-bq-stats-status={phase} data-bq-stats-category={model.category} data-bq-stats-selection={selectionId} aria-label="Component statistics" aria-busy={phase === "loading"}>
      <header className="bq-component-statistics-header">
        <h3 className="bq-component-statistics-title">Component Statistics</h3>
        <div className="bq-stat-view-tabs" role="tablist" aria-label="Component statistic views">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "performance"}
            className={activeView === "performance" ? "is-active" : ""}
            onClick={() => setActiveView("performance")} disabled={phase === "loading"}
          >Performance</button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "engineering"}
            className={activeView === "engineering" ? "is-active" : ""}
            onClick={() => setActiveView("engineering")} disabled={phase === "loading"}
          >Engineering</button>
        </div>
      </header>
      <div key={`${selectionId}:${phase}:${activeView}`} className="bq-component-statistics-body bq-component-statistics-content">
        <CraftStatisticsCards model={model} view={activeView} hasError={hasError} className="bq-stat-unmodified-column" />
      </div>
    </section>
  );
}

/** @deprecated Use BuildQueueCraftOverviewPanel or BuildQueueCraftStatisticsPanel */
export default function BuildQueueCraftStatsPanel({ model }: { model: CraftStatViewModel }) {
  return <><BuildQueueCraftOverviewPanel model={model} /><BuildQueueCraftStatisticsPanel model={model} /></>;
}
