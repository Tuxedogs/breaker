import MaterialIcon from "./MaterialIcon";
import type { QueueLedgerModel } from "../../lib/logistics/queueLedger";

interface QueueLedgerProps {
  ledger: QueueLedgerModel;
  formatValue?: (value: number) => string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

function defaultFormatValue(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const LIST_LIMIT = 6;

export default function QueueLedger({
  ledger,
  formatValue = defaultFormatValue,
  collapsed = false,
  onToggleCollapse,
}: QueueLedgerProps) {
  const noStockLines = ledger.refinedShortfallLines.filter((line) => line.totalAvailableEquivalent <= 0);
  const refinedLines = ledger.refinedShortfallLines.slice(0, LIST_LIMIT);
  const rawLines = ledger.rawOreRequirementLines.slice(0, LIST_LIMIT);
  const noStockPreview = noStockLines.slice(0, LIST_LIMIT);
  const hasShortfall = ledger.summary.refinedShortfall > 0 || ledger.summary.noStockLines > 0;

  if (collapsed) {
    return (
      <aside className="bq-summary-col bq-summary-col--collapsed ops-primary-card" aria-label="Queue summary">
        <button
          type="button"
          className="bq-summary-reopen"
          onClick={onToggleCollapse}
          aria-label="Expand queue summary"
        >
          <span className="bq-summary-reopen-icon" aria-hidden="true" />
          <span className="bq-summary-reopen-label">Queue Summary</span>
          {hasShortfall ? <span className="bq-summary-reopen-alert" aria-label="Shortfall exists" /> : null}
        </button>
      </aside>
    );
  }

  return (
    <aside className="bq-summary-col ops-primary-card" aria-label="Queue summary">
      <header className="bq-summary-head">
        <h2>Queue Summary</h2>
        <button type="button" className="bq-summary-collapse" onClick={onToggleCollapse} aria-label="Collapse queue summary">
          <span className="bq-summary-collapse-icon" aria-hidden="true" />
          <span>Collapse</span>
        </button>
      </header>

      <div className="bq-ledger-stats">
        <div className="bq-ledger-stat bq-ledger-stat--danger">
          <span>Refined Shortfall</span>
          <strong>{formatValue(ledger.summary.refinedShortfall)}</strong>
        </div>
        <div className="bq-ledger-stat bq-ledger-stat--success">
          <span>Reservable Lines</span>
          <strong>{ledger.summary.reservableLines}</strong>
        </div>
        <div className="bq-ledger-stat bq-ledger-stat--danger">
          <span>No Stock Lines</span>
          <strong>{ledger.summary.noStockLines}</strong>
        </div>
      </div>

      <section className="bq-ledger-section" aria-labelledby="bq-summary-refined-title">
        <h3 className="bq-ledger-title" id="bq-summary-refined-title">Refined Shortfall</h3>
        {refinedLines.length > 0 ? refinedLines.map((line) => (
          <div className="bq-ledger-line bq-ledger-line--danger" key={`refined:${line.materialKey}`}>
            <span className="bq-material-name-cell">
              <MaterialIcon materialName={line.displayName} materialState={line.isRefinable ? "refined" : "raw"} size={17} />
              <span>{line.displayName}</span>
            </span>
            <strong>{formatValue(line.netMissingRefined)}</strong>
          </div>
        )) : (
          <div className="bq-ledger-empty">No refined shortfall.</div>
        )}
        {ledger.refinedShortfallLines.length > LIST_LIMIT ? (
          <div className="bq-ledger-more">+ {ledger.refinedShortfallLines.length - LIST_LIMIT} more</div>
        ) : null}
      </section>

      <section className="bq-ledger-section bq-ledger-section--raw" aria-labelledby="bq-summary-raw-title">
        <h3 className="bq-ledger-title bq-ledger-title--raw" id="bq-summary-raw-title">Raw Ore Requirement</h3>
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
      </section>

      <section className="bq-ledger-section bq-ledger-section--nostock" aria-labelledby="bq-summary-nostock-title">
        <h3 className="bq-ledger-title bq-ledger-title--nostock" id="bq-summary-nostock-title">No Stock Lines</h3>
        {noStockPreview.length > 0 ? noStockPreview.map((line) => (
          <div className="bq-ledger-line bq-ledger-line--danger" key={`nostock:${line.materialKey}`}>
            <span className="bq-material-name-cell">
              <MaterialIcon materialName={line.displayName} materialState={line.isRefinable ? "refined" : "raw"} size={17} />
              <span>{line.displayName}</span>
            </span>
            <strong>{formatValue(line.netMissingRefined)}</strong>
          </div>
        )) : (
          <div className="bq-ledger-empty">No zero-stock shortage lines.</div>
        )}
        {noStockLines.length > LIST_LIMIT ? (
          <div className="bq-ledger-more">+ {noStockLines.length - LIST_LIMIT} more</div>
        ) : null}
      </section>
    </aside>
  );
}
