import type {
  CraftStatComparisonColumnView,
  CraftStatComparisonRowView,
  CraftStatViewModel,
} from "../../lib/crafting/craftStatViewModel";

function ComparisonDelta({
  column,
}: {
  column: CraftStatComparisonColumnView;
}) {
  if (column.state !== "ready") return null;

  const delta = column.percentDelta ?? column.absoluteDelta;
  if (!delta) {
    return <span className="bq-stat-compare-delta bq-stat-compare-delta--neutral">0%</span>;
  }

  return (
    <span className={`bq-stat-compare-delta ${column.impactClass ?? "bq-stat-compare-delta--neutral"}`}>
      {delta}
    </span>
  );
}

function ComparisonColumn({
  column,
}: {
  column: CraftStatComparisonColumnView;
}) {
  if (column.state !== "ready") {
    return (
      <span className="bq-stat-compare-empty" data-bq-stat-state={column.state}>
        {column.emptyLabel ?? column.value}
      </span>
    );
  }

  return (
    <span className="bq-stat-compare-cell">
      <strong className="bq-stat-compare-value">{column.value}</strong>
      <ComparisonDelta column={column} />
    </span>
  );
}

function DirectionIndicator({ direction }: { direction: CraftStatComparisonRowView["benefitDirection"] }) {
  if (direction === "higher-is-better") {
    return <span className="bq-stat-direction bq-stat-direction--higher">↑ higher is better</span>;
  }
  if (direction === "lower-is-better") {
    return <span className="bq-stat-direction bq-stat-direction--lower">↓ lower is better</span>;
  }
  return <span className="bq-stat-direction bq-stat-direction--neutral">— neutral</span>;
}

function ComparisonTable({ rows }: { rows: CraftStatComparisonRowView[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="bq-stat-compare" role="table" aria-label="Base target allocation comparison">
      <div className="bq-stat-compare-head" role="row">
        <span role="columnheader">Stat</span>
        <span role="columnheader">Unit</span>
        <span role="columnheader">Base</span>
        <span role="columnheader">Target</span>
        <span role="columnheader">Allocation</span>
        <span role="columnheader">Direction</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.statId}
          className="bq-stat-compare-row"
          role="row"
          data-bq-benefit-direction={row.benefitDirection}
        >
          <span className="bq-stat-compare-label" role="rowheader">{row.label}</span>
          <span className="bq-stat-compare-unit" role="cell">{row.unit}</span>
          <strong className="bq-stat-compare-base" role="cell">{row.baseValue}</strong>
          <span className="bq-stat-compare-target" role="cell">
            <ComparisonColumn column={row.target} />
          </span>
          <span className="bq-stat-compare-allocation" role="cell">
            <ComparisonColumn column={row.allocation} />
          </span>
          <span className="bq-stat-compare-direction" role="cell">
            <DirectionIndicator direction={row.benefitDirection} />
          </span>
        </div>
      ))}
    </div>
  );
}

function StatsLegend() {
  return (
    <div className="bq-stat-legend" aria-label="Comparison color legend">
      <span className="bq-stat-legend-item bq-stat-legend-item--benefit">+ Beneficial</span>
      <span className="bq-stat-legend-item bq-stat-legend-item--harm">+ Harmful</span>
      <span className="bq-stat-legend-item bq-stat-legend-item--neutral">+ Neutral</span>
    </div>
  );
}

export function BuildQueueCraftOverviewPanel({ model }: { model: CraftStatViewModel }) {
  if (model.status === "loading") {
    return (
      <div className="bq-stats-overview bq-stats-panel--empty" data-bq-stats-status="loading">
        <p className="bq-stats-breakdown-empty">Loading stats...</p>
      </div>
    );
  }

  if (model.status !== "ready") {
    return (
      <div className="bq-stats-overview bq-stats-panel--empty" data-bq-stats-status="unavailable">
        <p className="bq-stats-breakdown-empty">{model.unavailableReason ?? "Stats unavailable"}</p>
      </div>
    );
  }

  return (
    <div
      className="bq-stats-overview"
      data-bq-stats-status="ready"
      data-bq-stats-category={model.category}
      aria-label="Component stock overview"
    >
      {model.identity.length > 0 ? (
        <div className="bq-stats-meta" aria-label="Component identity">
          {model.identity.map((badge) => (
            <span key={`${badge.label}:${badge.value}`} className="bq-stats-meta-badge">
              <span>{badge.label}</span>
              <strong>{badge.value}</strong>
            </span>
          ))}
        </div>
      ) : null}
      {model.overviewGroups.length > 0 ? (
        <div className="bq-stats-overview-groups">
          {model.overviewGroups.map((group) => (
            <section key={group.title} className="bq-stats-overview-group" aria-label={group.title}>
              <div className="bq-stats-overview-group-title">{group.title}</div>
              <div className="bq-stats-overview-grid">
                {group.stats.map((stat) => (
                  <div key={`${group.title}:${stat.label}`} className="bq-stats-overview-stat">
                    <span className="bq-stats-overview-stat-label">{stat.label}</span>
                    <strong className="bq-stats-overview-stat-value">{stat.value}</strong>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="bq-stats-breakdown-empty">No stock stats available</p>
      )}
    </div>
  );
}

export function BuildQueueCraftStatisticsPanel({ model }: { model: CraftStatViewModel }) {
  if (model.status === "loading") {
    return (
      <section className="bq-component-statistics bq-component-statistics--empty" data-bq-stats-status="loading">
        <p className="bq-stats-breakdown-empty">Loading component statistics...</p>
      </section>
    );
  }

  if (model.status !== "ready" || model.comparisonGroups.length === 0) {
    return (
      <section className="bq-component-statistics bq-component-statistics--empty" data-bq-stats-status="unavailable">
        <p className="bq-stats-breakdown-empty">{model.unavailableReason ?? "Component statistics unavailable"}</p>
      </section>
    );
  }

  return (
    <section
      className="bq-component-statistics"
      data-bq-stats-status="ready"
      data-bq-stats-category={model.category}
      aria-label="Component statistics"
    >
      <header className="bq-component-statistics-header">
        <h3 className="bq-component-statistics-title">Component Statistics</h3>
        <StatsLegend />
      </header>
      <div className="bq-component-statistics-body">
        {model.comparisonGroups.map((group) => (
          <div key={group.title} className="bq-stat-compare-group">
            <div className="bq-stat-compare-group-title">{group.title}</div>
            <ComparisonTable rows={group.rows} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** @deprecated Use BuildQueueCraftOverviewPanel or BuildQueueCraftStatisticsPanel */
export default function BuildQueueCraftStatsPanel({ model }: { model: CraftStatViewModel }) {
  return (
    <>
      <BuildQueueCraftOverviewPanel model={model} />
      <BuildQueueCraftStatisticsPanel model={model} />
    </>
  );
}
