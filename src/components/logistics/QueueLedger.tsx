import MaterialIcon from "./MaterialIcon";
import type { QueueLedgerModel } from "../../lib/logistics/queueLedger";

interface QueueLedgerProps {
  ledger: QueueLedgerModel;
  formatValue?: (value: number) => string;
}

function defaultFormatValue(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function QueueLedger({ ledger, formatValue = defaultFormatValue }: QueueLedgerProps) {
  return (
    <aside className="bq-ledger-panel" aria-label="Queue Ledger">
      <div className="bq-ledger-title">Queue Ledger</div>
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

      <section className="bq-ledger-section bq-ledger-section--refined" aria-labelledby="bq-ledger-refined-title">
        <div className="bq-ledger-title" id="bq-ledger-refined-title">Refined Shortfall</div>
        {ledger.refinedShortfallLines.length > 0 ? ledger.refinedShortfallLines.map((line) => (
          <div className="bq-ledger-stat bq-ledger-stat--danger" key={`refined:${line.materialKey}`}>
            <span className="bq-material-name-cell">
              <MaterialIcon materialName={line.displayName} materialState={line.isRefinable ? "refined" : "raw"} size={17} />
              <span>{line.displayName}</span>
            </span>
            <strong>{formatValue(line.netMissingRefined)}</strong>
          </div>
        )) : (
          <div className="bq-ledger-empty">No refined shortfall.</div>
        )}
      </section>

      <section className="bq-ledger-section bq-ledger-section--raw" aria-labelledby="bq-ledger-raw-title">
        <div className="bq-ledger-title bq-ledger-title--raw" id="bq-ledger-raw-title">Raw Ore Requirement</div>
        {ledger.rawOreRequirementLines.length > 0 ? ledger.rawOreRequirementLines.map((line) => (
          <div className="bq-ledger-stat bq-ledger-stat--raw" key={`raw:${line.materialKey}`}>
            <span className="bq-material-name-cell">
              <MaterialIcon materialName={line.displayName} materialState="raw" size={17} />
              <span>{line.displayName}</span>
            </span>
            <strong>{formatValue(line.rawOreNeeded)}</strong>
          </div>
        )) : (
          <div className="bq-ledger-empty bq-ledger-empty--raw">No raw ore required.</div>
        )}
      </section>
    </aside>
  );
}
