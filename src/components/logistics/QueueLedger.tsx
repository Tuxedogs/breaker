import { memo } from "react";
import MaterialIcon from "./MaterialIcon";
import type { QueueLedgerModel } from "../../lib/logistics/queueLedger";
import type { Shortage } from "../../lib/logistics/shortages";

interface QueueLedgerProps {
  ledger: QueueLedgerModel;
  physicalCoverage: Shortage[];
  materialNameById?: Record<string, string>;
  formatValue?: (value: number) => string;
  collapsed?: boolean;
  mobile?: boolean;
  onToggleCollapse?: () => void;
}

function defaultFormatValue(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const LIST_LIMIT = 6;

const QueueLedger = memo(function QueueLedger({
  ledger: _ledger,
  physicalCoverage,
  materialNameById = {},
  formatValue = defaultFormatValue,
  collapsed = false,
  mobile = false,
  onToggleCollapse,
}: QueueLedgerProps) {
  void _ledger;
  const physicalLines = physicalCoverage.slice(0, LIST_LIMIT);
  const hasShortfall = physicalCoverage.some((line) => line.shortfall > 0);
  const panelClassName = [
    "bq-summary-col",
    "ops-primary-card",
    collapsed ? "bq-summary-col--collapsed" : "",
    mobile ? "bq-summary-col--mobile" : "",
    mobile && !collapsed ? "bq-summary-col--mobile-open" : "",
  ].filter(Boolean).join(" ");

  if (collapsed) {
    return (
      <aside className={panelClassName} aria-label="Queue fulfillment ledger">
        <button
          type="button"
          className="bq-summary-reopen"
          onClick={onToggleCollapse}
          aria-label="Open queue ledger"
          aria-expanded="false"
        >
          <span className="bq-summary-reopen-icon" aria-hidden="true" />
          <span className="bq-summary-reopen-label">Queue Ledger</span>
          {hasShortfall ? <span className="bq-summary-reopen-alert" aria-label="Shortfall exists" /> : null}
        </button>
      </aside>
    );
  }

  return (
    <aside className={panelClassName} aria-label="Queue fulfillment ledger">
      <header className="bq-summary-head">
        <h2>Queue Ledger</h2>
        <button type="button" className="bq-summary-collapse" onClick={onToggleCollapse} aria-label={mobile ? "Close queue ledger" : "Collapse queue ledger"} aria-expanded="true">
          <span>Collapse</span>
          <span className="bq-summary-collapse-icon" aria-hidden="true" />
        </button>
      </header>

      <section className="bq-ledger-section bq-ledger-section--physical" aria-labelledby="bq-summary-physical-title">
        <h3 className="bq-ledger-title" id="bq-summary-physical-title">Physical fulfillment</h3>
        <p className="bq-ledger-description">Valid reservations and quality-eligible physical boxes only.</p>
        {physicalLines.length > 0 ? physicalLines.map((line) => (
          <div className="bq-ledger-physical-line" key={`physical:${line.key}`}>
            <div className="bq-ledger-physical-head"><span className="bq-material-name-cell"><MaterialIcon materialName={materialNameById[line.materialId] ?? line.materialId} materialState="refined" size={17} /><span>{materialNameById[line.materialId] ?? line.materialId}</span></span><span className="bq-ledger-target">Target <strong>{line.selectedQuality === undefined ? "Any" : `Quality ${line.selectedQuality}`}</strong></span></div>
            <span className="bq-ledger-physical-metrics">
              <span><span>Required</span><strong>{formatValue(line.needed)} {line.unitType?.toUpperCase()}</strong></span>
              <span className={line.shortfall > 0 ? "is-missing" : "is-covered"}><span>Remaining</span><strong>{formatValue(line.shortfall)} {line.unitType?.toUpperCase()}</strong></span>
            </span>
          </div>
        )) : <div className="bq-ledger-empty">No active material requirements.</div>}
        {physicalCoverage.length > LIST_LIMIT ? <div className="bq-ledger-more">+ {physicalCoverage.length - LIST_LIMIT} more</div> : null}
      </section>

    </aside>
  );
});

export default QueueLedger;
