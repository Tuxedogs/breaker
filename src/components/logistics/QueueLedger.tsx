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

export default function QueueLedger({
  ledger,
  physicalCoverage,
  materialNameById = {},
  formatValue = defaultFormatValue,
  collapsed = false,
  mobile = false,
  onToggleCollapse,
}: QueueLedgerProps) {
  const physicalLines = physicalCoverage.slice(0, LIST_LIMIT);
  const refinedLines = ledger.refinedShortfallLines.slice(0, LIST_LIMIT);
  const rawLines = ledger.rawOreRequirementLines.slice(0, LIST_LIMIT);
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
          <span className="bq-summary-collapse-icon" aria-hidden="true" />
          <span>Collapse</span>
        </button>
      </header>

      <section className="bq-ledger-section bq-ledger-section--physical" aria-labelledby="bq-summary-physical-title">
        <h3 className="bq-ledger-title" id="bq-summary-physical-title">Physical fulfillment</h3>
        <p className="bq-ledger-description">Valid reservations and quality-eligible physical boxes only.</p>
        {physicalLines.length > 0 ? physicalLines.map((line) => (
          <div className="bq-ledger-physical-line" key={`physical:${line.key}`}>
            <span className="bq-material-name-cell">
              <MaterialIcon materialName={materialNameById[line.materialId] ?? line.materialId} materialState="refined" size={17} />
              <span>{materialNameById[line.materialId] ?? line.materialId}</span>
            </span>
            <span className="bq-ledger-physical-metrics">
              <span>Required <strong>{formatValue(line.needed)} {line.unitType?.toUpperCase()}</strong></span>
              <span>Target <strong>{line.selectedQuality === undefined ? "Any" : `Quality ${line.selectedQuality}`}</strong></span>
              <span>Valid reserved <strong>{formatValue(line.allocated)} {line.unitType?.toUpperCase()}</strong></span>
              <span>Eligible available <strong>{formatValue(line.available)} {line.unitType?.toUpperCase()}</strong></span>
              <span className={line.shortfall > 0 ? "is-missing" : "is-covered"}>Remaining <strong>{formatValue(line.shortfall)} {line.unitType?.toUpperCase()}</strong></span>
            </span>
          </div>
        )) : <div className="bq-ledger-empty">No active material requirements.</div>}
        {physicalCoverage.length > LIST_LIMIT ? <div className="bq-ledger-more">+ {physicalCoverage.length - LIST_LIMIT} more</div> : null}
      </section>

      <section className="bq-ledger-section bq-ledger-section--planning" aria-labelledby="bq-summary-planning-title">
        <h3 className="bq-ledger-title" id="bq-summary-planning-title">Planning</h3>
        <p className="bq-ledger-description">Owned stock and raw/refined conversion are planning equivalents, not physical fulfillment.</p>
      <div className="bq-ledger-stats">
        <div className="bq-ledger-stat bq-ledger-stat--danger">
          <span>Planning Shortfall</span>
          <strong>{formatValue(ledger.summary.refinedShortfall)}</strong>
        </div>
        <div className="bq-ledger-stat bq-ledger-stat--success">
          <span>Partially Stocked</span>
          <strong>{ledger.summary.partiallyStockedLines}</strong>
        </div>
        <div className="bq-ledger-stat bq-ledger-stat--danger">
          <span>No Owned Stock</span>
          <strong>{ledger.summary.noStockLines}</strong>
        </div>
      </div>

      <div className="bq-ledger-planning-subsection" aria-labelledby="bq-summary-refined-title">
        <h3 className="bq-ledger-title" id="bq-summary-refined-title">Refined-equivalent Planning Gap</h3>
        {refinedLines.length > 0 ? refinedLines.map((line) => (
          <div className="bq-ledger-line bq-ledger-line--danger" key={`refined:${line.materialKey}`}>
            <span className="bq-material-name-cell">
              <MaterialIcon materialName={line.displayName} materialState={line.isRefinable ? "refined" : "raw"} size={17} />
              <span>{line.displayName}</span>
            </span>
            <strong>{formatValue(line.netMissingRefined)}</strong>
          </div>
        )) : (
          <div className="bq-ledger-empty">No refined-equivalent planning gap.</div>
        )}
        {ledger.refinedShortfallLines.length > LIST_LIMIT ? (
          <div className="bq-ledger-more">+ {ledger.refinedShortfallLines.length - LIST_LIMIT} more</div>
        ) : null}
      </div>

      <div className="bq-ledger-planning-subsection bq-ledger-section--raw" aria-labelledby="bq-summary-raw-title">
        <h3 className="bq-ledger-title bq-ledger-title--raw" id="bq-summary-raw-title">Raw Ore Planning Need</h3>
        {rawLines.length > 0 ? rawLines.map((line) => (
          <div className="bq-ledger-line bq-ledger-line--raw" key={`raw:${line.materialKey}`}>
            <span className="bq-material-name-cell">
              <MaterialIcon materialName={line.displayName} materialState="raw" size={17} />
              <span>{line.displayName}</span>
            </span>
            <strong>{formatValue(line.rawOreNeeded)}</strong>
          </div>
        )) : (
          <div className="bq-ledger-empty bq-ledger-empty--raw">No raw ore required.</div>
        )}
        {ledger.rawOreRequirementLines.length > LIST_LIMIT ? (
          <div className="bq-ledger-more">+ {ledger.rawOreRequirementLines.length - LIST_LIMIT} more</div>
        ) : null}
      </div>
      </section>
    </aside>
  );
}
