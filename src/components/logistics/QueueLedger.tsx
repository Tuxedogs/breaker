import { memo } from "react";
import { Link } from "react-router-dom";
import MaterialIcon from "./MaterialIcon";
import type { QueueLedgerModel } from "../../lib/logistics/queueLedger";
import type { Shortage } from "../../lib/logistics/shortages";
import type { PotentialSourceLocation } from "../../lib/logistics/queuePotentialSources";

interface QueueLedgerProps {
  ledger: QueueLedgerModel;
  selectedItemName?: string | null;
  physicalCoverage: Shortage[];
  potentialSources?: PotentialSourceLocation[];
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
  selectedItemName,
  physicalCoverage,
  potentialSources = [],
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
          <span className="bq-summary-reopen-label">Inventory sourcing</span>
          {hasShortfall ? <span className="bq-summary-reopen-alert" aria-label="Shortfall exists" /> : null}
        </button>
      </aside>
    );
  }

  return (
    <aside className={panelClassName} aria-label="Queue fulfillment ledger">
      <section className="bq-ledger-section bq-ledger-section--physical" aria-labelledby="bq-summary-physical-title">
        <div className="bq-v31-sourcing-context">
          <span>Current selected build</span>
          <strong>{selectedItemName ?? "No build selected"}</strong>
          <Link to="/logistics/inventory">Open Inventory</Link>
          <button type="button" className="bq-summary-collapse bq-summary-collapse--sourcing" onClick={onToggleCollapse} aria-label={mobile ? "Close queue ledger" : "Collapse queue ledger"} aria-expanded="true">
          <span>Collapse</span>
          <span className="bq-summary-collapse-icon" aria-hidden="true" />
        </button>
        </div>
        <h3 className="bq-ledger-title" id="bq-summary-physical-title">Lot reservations</h3>
        <p className="bq-ledger-description">Requirements for this build only. Counts reflect valid physical allocations, never other queued crafts.</p>
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

      <section className="bq-ledger-section bq-v31-potential-sources" aria-label="Potential physical sources">
        <div className="bq-v31-potential-head">
          <h3 className="bq-ledger-title">Potential sources</h3>
          <span>From stored physical lots</span>
        </div>
        <p className="bq-ledger-description">
          Eligible, unreserved physical boxes at known inventory locations. Mining spawns and unverified stock are not included.
        </p>
        {potentialSources.length ? (
          <div className="bq-v31-location-sources">
            {potentialSources.slice(0, 5).map((location) => (
              <div className="bq-v31-location-source" key={location.id}>
                <div className="bq-v31-location-source-head">
                  <strong>{location.name}</strong>
                  <span>{location.lotCount} eligible {location.lotCount === 1 ? "lot" : "lots"}</span>
                </div>
                <div className="bq-v31-location-source-materials">
                  {location.materials.slice(0, 4).map((material) => (
                    <div key={material.materialId + material.unitType}>
                      <span><MaterialIcon materialName={materialNameById[material.materialId] ?? material.materialId}
                        materialState="refined" size={15} /> {materialNameById[material.materialId] ?? material.materialId}</span>
                      <strong>{formatValue(material.available)} {material.unitType.toUpperCase()}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {potentialSources.length > 5 ? <div className="bq-ledger-more">+ {potentialSources.length - 5} more inventory locations</div> : null}
          </div>
        ) : (
          <div className="bq-ledger-empty">
            No eligible, unreserved physical lots were found at stored inventory locations for this build.
          </div>
        )}
        <Link className="bq-v31-potential-inventory-link" to="/logistics/inventory">Inspect inventory lots</Link>
      </section>

    </aside>
  );
});

export default QueueLedger;
