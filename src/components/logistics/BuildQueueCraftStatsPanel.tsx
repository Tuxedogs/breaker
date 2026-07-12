import type {
  CraftStatComparisonColumnView,
  CraftStatComparisonRowView,
  CraftStatGroupView,
  CraftStatValueView,
  CraftStatViewModel,
} from "../../lib/crafting/craftStatViewModel";

function ComparisonDelta({
  column,
}: {
  column: CraftStatComparisonColumnView;
}) {
  if (column.state !== "ready") return null;

  const delta = column.percentDelta ?? column.absoluteDelta;
  if (!delta) return <span className="bq-stat-compare-delta bq-stat-compare-delta--neutral">0%</span>;

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

function ComparisonTable({ rows }: { rows: CraftStatComparisonRowView[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="bq-stat-compare" role="table" aria-label="Base target allocation comparison">
      <div className="bq-stat-compare-head" role="row">
        <span role="columnheader">Stat</span>
        <span role="columnheader">Base</span>
        <span role="columnheader">Target</span>
        <span role="columnheader">Allocation</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.statId}
          className="bq-stat-compare-row"
          role="row"
          data-bq-benefit-direction={row.benefitDirection}
        >
          <span className="bq-stat-compare-label" role="rowheader">{row.label}</span>
          <strong className="bq-stat-compare-base" role="cell">{row.baseValue}</strong>
          <span className="bq-stat-compare-target" role="cell">
            <ComparisonColumn column={row.target} />
          </span>
          <span className="bq-stat-compare-allocation" role="cell">
            <ComparisonColumn column={row.allocation} />
          </span>
        </div>
      ))}
    </div>
  );
}

function StatValueRow({ stat }: { stat: CraftStatValueView }) {
  return (
    <span className="bq-detail-stat-row">
      <span className="bq-detail-stat-label">{stat.label}</span>
      <strong className="bq-detail-stat-value">
        <span>{stat.projectedValue}</span>
        {stat.delta ? (
          <span className={`bq-detail-stat-delta ${stat.impactClass ?? ""}`}>
            ({stat.delta})
          </span>
        ) : null}
      </strong>
      {stat.baseValue ? (
        <span className="bq-detail-stat-base">Base {stat.baseValue}</span>
      ) : null}
    </span>
  );
}

function StatMatrix({ group }: { group: Extract<CraftStatGroupView, { kind: "matrix" }> }) {
  return (
    <div className="bq-stat-matrix" role="table" aria-label={group.title}>
      <div className="bq-stat-matrix-head" role="row">
        <span role="columnheader">Type</span>
        {group.columns.map((column) => (
          <span key={column} role="columnheader">{column}</span>
        ))}
      </div>
      {group.rows.map((row) => (
        <div key={row.label} className="bq-stat-matrix-row" role="row">
          <span role="rowheader">{row.label}</span>
          {row.values.map((value, index) => (
            <strong key={`${row.label}:${group.columns[index] ?? index}`} role="cell">{value}</strong>
          ))}
        </div>
      ))}
    </div>
  );
}

function StatGroup({ group }: { group: CraftStatGroupView }) {
  return (
    <section className={`bq-stat-group bq-stat-group--${group.kind}`} aria-label={group.title}>
      <div className="bq-stat-group-title">{group.title}</div>
      {group.kind === "nested" ? (
        <div className="bq-stat-group-body">
          {group.subclusters.map((subcluster) => (
            <div key={subcluster.title} className="bq-stat-subcluster">
              <div className="bq-stat-subcluster-title">{subcluster.title}</div>
              {subcluster.comparisonRows ? <ComparisonTable rows={subcluster.comparisonRows} /> : null}
              {subcluster.stats.length > 0 ? (
                <div className="bq-stat-group-grid">
                  {subcluster.stats.map((stat) => (
                    <StatValueRow key={`${group.title}:${subcluster.title}:${stat.label}`} stat={stat} />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : group.kind === "matrix" ? (
        <StatMatrix group={group} />
      ) : (
        <>
          {group.comparisonRows ? <ComparisonTable rows={group.comparisonRows} /> : null}
          {group.stats.length > 0 ? (
            <div className="bq-stat-group-grid">
              {group.stats.map((stat) => (
                <StatValueRow key={`${group.title}:${stat.label}`} stat={stat} />
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

/**
 * Pure renderer for Build Queue selected-craft stats.
 * Accepts only a normalized view model — no knowledge of fixtures, APIs, or caches.
 */
export default function BuildQueueCraftStatsPanel({ model }: { model: CraftStatViewModel }) {
  if (model.status === "loading") {
    return (
      <div className="bq-stats-panel bq-stats-panel--empty" data-bq-stats-status="loading">
        <p className="bq-stats-breakdown-empty">Loading stats...</p>
      </div>
    );
  }

  if (model.status !== "ready" || model.groups.length === 0) {
    return (
      <div className="bq-stats-panel bq-stats-panel--empty" data-bq-stats-status="unavailable">
        <p className="bq-stats-breakdown-empty">{model.unavailableReason ?? "Stats unavailable"}</p>
      </div>
    );
  }

  return (
    <div
      className="bq-stats-panel"
      data-bq-stats-status="ready"
      data-bq-stats-category={model.category}
      aria-label={model.title}
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
      <div className="bq-stat-groups">
        {model.groups.map((group) => (
          <StatGroup key={group.title} group={group} />
        ))}
      </div>
    </div>
  );
}
