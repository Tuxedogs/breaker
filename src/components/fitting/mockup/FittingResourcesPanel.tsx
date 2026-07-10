import type { ReactNode } from "react";
import type { ResourceSummaryView } from "../../../lib/fitting/mockup/fittingMockupViewTypes";

type FittingResourcesPanelProps = {
  summary: ResourceSummaryView;
  selectedDetail?: ReactNode;
};

export default function FittingResourcesPanel({ summary, selectedDetail }: FittingResourcesPanelProps) {
  return (
    <div className="fm-resources-wrap">
      <section className="fm-resources" aria-label="Fitting status and resources">
        <div className="fm-resources-status">
          <h3>Fitting Status</h3>
          <span className={["fm-resources-pill", summary.fittingValid ? "is-valid" : "is-invalid"].filter(Boolean).join(" ")}>
            <span className="fm-resources-dot" aria-hidden />
            {summary.fittingValid ? "Valid" : "Unavailable"}
          </span>
          <button type="button" className="fm-resources-link" disabled>View Full Stats</button>
        </div>

        <h3 className="fm-resources-title">Resources</h3>

        {summary.blocks.map((block) => (
          <div key={block.key} className="fm-resource-block">
            <h4>{block.title}</h4>
            <div className={["fm-resource-metrics", block.stacked ? "is-stacked" : ""].filter(Boolean).join(" ")}>
              {block.metrics.map((metric) => (
                <span key={metric.label} className={metric.highlighted ? "is-margin" : ""}>
                  <em>{metric.label}</em>
                  <strong>{metric.value}</strong>
                </span>
              ))}
            </div>
            {block.barKind ? (
              <div className="fm-resource-bar" aria-hidden>
                <span
                  className={["fm-resource-bar-fill", `is-${block.barKind}`].join(" ")}
                  style={{ width: `${block.barFillPct ?? 0}%` }}
                />
              </div>
            ) : null}
          </div>
        ))}
      </section>

      {selectedDetail ? (
        <section className="fm-selected-detail">{selectedDetail}</section>
      ) : null}
    </div>
  );
}
