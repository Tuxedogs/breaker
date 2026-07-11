import { Fragment } from "react";
import type { StatCardView, StatRowView, StatSectionView } from "../../../lib/fitting/mockup/fittingMockupViewTypes";
import PowerStatusHeader from "./PowerStatusHeader";

function StatRow({ row }: { row: StatRowView }) {
  return (
    <div className={["fm-stat-row", row.tone && row.tone !== "default" ? `is-${row.tone}` : ""].filter(Boolean).join(" ")}>
      <span className="fm-stat-label">{row.label}</span>
      <span className="fm-stat-value">{row.value}</span>
    </div>
  );
}

function StatSection({ section }: { section: StatSectionView }) {
  return (
    <section className="fm-stat-section">
      <h4 className="fm-stat-section-title">{section.title}</h4>
      <div className="fm-stat-section-body">
        {section.rows.map((row) => <StatRow key={row.label} row={row} />)}
        {section.thresholdReadout ? (
          <div className="fm-stat-threshold">
            <div className="fm-stat-threshold-head">
              <span>{section.thresholdReadout.label}</span>
              <strong>{section.thresholdReadout.valueLabel}</strong>
            </div>
            <div className="fm-stat-threshold-track" aria-hidden>
              <span
                className="fm-stat-threshold-fill"
                style={{ width: `${section.thresholdReadout.fillPct}%` }}
              />
            </div>
          </div>
        ) : null}
        {section.resistanceGrid ? (
          <div
            className="fm-stat-resist-grid"
            style={{ gridTemplateColumns: `minmax(0, 1.1fr) repeat(${section.resistanceGrid.columns.length}, minmax(0, 1fr))` }}
          >
            <span className="fm-stat-mini-head" />
            {section.resistanceGrid.columns.map((column) => (
              <span key={column} className="fm-stat-mini-head">{column}</span>
            ))}
            {section.resistanceGrid.rows.map((row) => (
              <Fragment key={row.label}>
                <span className="fm-stat-mini-label">{row.label}</span>
                {row.values.map((value, index) => (
                  <span key={`${row.label}-${index}`} className="fm-stat-mini-value">{value}</span>
                ))}
              </Fragment>
            ))}
          </div>
        ) : null}
        {section.miniGrid ? (
          <div
            className="fm-stat-mini-grid"
            style={{ gridTemplateColumns: `minmax(0, 1.1fr) repeat(${section.miniGrid.columns.length}, minmax(0, 1fr))` }}
          >
            <span className="fm-stat-mini-head" />
            {section.miniGrid.columns.map((column) => (
              <span key={column} className="fm-stat-mini-head">{column}</span>
            ))}
            {section.miniGrid.rows.map((row) => (
              <Fragment key={row.label}>
                <span className="fm-stat-mini-label">{row.label}</span>
                {row.values.map((value, index) => (
                  <span key={`${row.label}-${index}`} className="fm-stat-mini-value">{value}</span>
                ))}
              </Fragment>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

type FittingStatCardProps = {
  card: StatCardView;
  onAction?: () => void;
};

export default function FittingStatCard({ card, onAction }: FittingStatCardProps) {
  if (card.key === "power") {
    return (
      <article className="fm-stat-card is-power">
        <div className="fm-stat-card-body">
          {card.content ?? (
            <>
              {card.powerHeader ? <PowerStatusHeader header={card.powerHeader} /> : null}
              {card.footer ? <div className="fm-stat-card-footer">{card.footer}</div> : null}
            </>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className={["fm-stat-card", card.key === "power" ? "is-power" : ""].filter(Boolean).join(" ")}>
      <header className="fm-stat-card-head">
        <h3>{card.title}</h3>
        {card.actionLabel ? (
          <button
            type="button"
            className="fm-stat-card-action"
            onClick={onAction}
            disabled={card.actionDisabled}
          >
            {card.actionLabel}
          </button>
        ) : null}
      </header>
      <div className="fm-stat-card-body">
        {card.rows?.map((row) => <StatRow key={row.label} row={row} />)}
        {card.sections?.map((section) => (
          <StatSection key={section.title} section={section} />
        ))}
        {card.footer ? <div className="fm-stat-card-footer">{card.footer}</div> : null}
      </div>
    </article>
  );
}
