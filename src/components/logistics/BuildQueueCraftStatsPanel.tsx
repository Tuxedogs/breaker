import type {
  CraftStatGroupView,
  CraftStatValueView,
  CraftStatViewModel,
} from "../../lib/crafting/craftStatViewModel";

function shouldShowDelta(delta?: string): boolean {
  if (!delta) return false;
  const normalized = delta.replace(/[()\s,+%]/g, "");
  if (!normalized) return false;
  const numeric = Number.parseFloat(normalized);
  return !Number.isFinite(numeric) || Math.abs(numeric) >= 0.005;
}

function StatValueRow({ stat }: { stat: CraftStatValueView }) {
  return (
    <span className="bq-detail-stat-row">
      <span className="bq-detail-stat-label">{stat.label}</span>
      <strong className="bq-detail-stat-value">
        <span className={stat.valueImpactClass ?? ""}>{stat.projectedValue}</span>
        {shouldShowDelta(stat.delta) ? (
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
              <div className="bq-stat-group-grid">
                {subcluster.stats.map((stat) => (
                  <StatValueRow key={`${group.title}:${subcluster.title}:${stat.label}`} stat={stat} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : group.kind === "matrix" ? (
        <StatMatrix group={group} />
      ) : (
        <div className="bq-stat-group-grid">
          {group.stats.map((stat) => (
            <StatValueRow key={`${group.title}:${stat.label}`} stat={stat} />
          ))}
        </div>
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
