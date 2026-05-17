import { useState, useMemo } from "react";
import type { CarrierId, CarrierMode, CommodityKey } from "./carrierLogisticsData";
import {
  CARRIER_PRESETS,
  SHIP_PROFILES,
  COMMODITY_LABELS,
  COMMODITY_ORDER,
} from "./carrierLogisticsData";
import {
  getCarrierPreset,
  getCarrierCapacity,
  getActiveRooms,
  calculateCommodityTotals,
  buildRecommendedLoadPlan,
  getTotalUserLoadedScu,
  getRemainingCapacity,
  getOverloadedScu,
  allocateUserLoadsToRooms,
  buildCrateList,
} from "./carrierLogisticsPlanner";
import CarrierCargoRooms from "./CarrierCargoRooms";

const DEFAULT_CARRIER: CarrierId = "ironclad";
const EMPTY_LOADS: Record<CommodityKey, number> = {
  ammoS2: 0, ammoS3: 0, ammoS4: 0, noise: 0, decoy: 0, rmc: 0,
};

function getDefaultMode(carrierId: CarrierId): CarrierMode {
  if (carrierId === "ironclad") return "mainOnly";
  if (carrierId === "idrisP") return "cargoRoomsOnly";
  return "all";
}

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function commodityCssKey(key: CommodityKey): string {
  return key.replace(/([A-Z])/g, "-$1").toLowerCase();
}

export default function CarrierLogisticsPanel() {
  // ── Carrier state ──────────────────────────────
  const [carrierId, setCarrierId] = useState<CarrierId>(DEFAULT_CARRIER);
  const [carrierMode, setCarrierMode] = useState<CarrierMode>(getDefaultMode(DEFAULT_CARRIER));
  const [manualOverride, setManualOverride] = useState(false);
  const [manualCapacity, setManualCapacity] = useState(2160);

  // ── Ship service state ─────────────────────────
  const [shipCounts, setShipCounts] = useState<Record<string, number>>({
    gladius: 0, hornet: 0, f8c: 0,
  });
  const [repairPercents, setRepairPercents] = useState<Record<string, number>>({
    gladius: 0, hornet: 0, f8c: 0,
  });

  // ── User resource loadout ──────────────────────
  const [userLoads, setUserLoads] = useState<Record<CommodityKey, number>>({ ...EMPTY_LOADS });

  // ── Derived: carrier ───────────────────────────
  const preset = getCarrierPreset(carrierId);
  const capacity = getCarrierCapacity(preset, carrierMode, manualOverride ? manualCapacity : null);
  const activeRooms = useMemo(() => getActiveRooms(carrierId, carrierMode), [carrierId, carrierMode]);

  // ── Derived: service requirements ─────────────
  const shipStates = useMemo(
    () => SHIP_PROFILES.map((p) => ({
      profile: p,
      count: shipCounts[p.id] ?? 0,
      repairPercent: repairPercents[p.id] ?? 0,
    })),
    [shipCounts, repairPercents]
  );
  const totals = useMemo(() => calculateCommodityTotals(shipStates), [shipStates]);
  const resourceLoads = useMemo(
    () => buildRecommendedLoadPlan(totals, userLoads),
    [totals, userLoads]
  );

  // ── Derived: user loadout summary ─────────────
  const totalUserLoaded = useMemo(() => getTotalUserLoadedScu(userLoads), [userLoads]);
  const remainingScu = useMemo(() => getRemainingCapacity(capacity, totalUserLoaded), [capacity, totalUserLoaded]);
  const overloadedScu = useMemo(() => getOverloadedScu(capacity, totalUserLoaded), [capacity, totalUserLoaded]);
  const isOverCapacity = overloadedScu > 0;

  // ── Derived: cargo rooms fill ──────────────────
  const roomPlans = useMemo(
    () => allocateUserLoadsToRooms(userLoads, activeRooms),
    [userLoads, activeRooms]
  );

  // ── Derived: crate breakdown ───────────────────
  const crateList = useMemo(() => buildCrateList(userLoads), [userLoads]);

  // ── Handlers ──────────────────────────────────
  function handleCarrierChange(id: CarrierId) {
    setCarrierId(id);
    const newMode = getDefaultMode(id);
    setCarrierMode(newMode);
    const p = getCarrierPreset(id);
    setManualCapacity(getCarrierCapacity(p, newMode, null));
  }

  function handleModeChange(mode: CarrierMode) {
    setCarrierMode(mode);
    setManualCapacity(getCarrierCapacity(preset, mode, null));
  }

  function setUserLoad(key: CommodityKey, value: number) {
    setUserLoads((prev) => ({ ...prev, [key]: Math.max(0, value) }));
  }

  function setToRecommended(key: CommodityKey, recommended: number) {
    setUserLoads((prev) => ({ ...prev, [key]: recommended }));
  }

  function fillRemaining(key: CommodityKey) {
    const currentOthers = COMMODITY_ORDER
      .filter((k) => k !== key)
      .reduce((s, k) => s + (userLoads[k] ?? 0), 0);
    const available = Math.max(0, capacity - currentOthers);
    setUserLoads((prev) => ({ ...prev, [key]: available }));
  }

  function clearLoad(key: CommodityKey) {
    setUserLoads((prev) => ({ ...prev, [key]: 0 }));
  }

  // ── Render ─────────────────────────────────────
  return (
    <div className="clog-layout">

      {/* ── Left column: carrier + ships ── */}
      <aside className="clog-col-left">

        {/* Carrier selector */}
        <div className="clog-panel">
          <div className="clog-panel-title">Carrier</div>

          <div className="clog-field">
            <label className="clog-field-label">Platform</label>
            <select
              className="clog-select"
              value={carrierId}
              onChange={(e) => handleCarrierChange(e.target.value as CarrierId)}
            >
              {CARRIER_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          {carrierId === "ironclad" && (
            <div className="clog-field">
              <label className="clog-field-label">Cargo Mode</label>
              <div className="clog-toggle-row">
                <button type="button"
                  className={`clog-toggle-btn${carrierMode === "mainOnly" ? " clog-toggle-btn--active" : ""}`}
                  onClick={() => handleModeChange("mainOnly")}>
                  Main Only
                </button>
                <button type="button"
                  className={`clog-toggle-btn${carrierMode === "all" ? " clog-toggle-btn--active" : ""}`}
                  onClick={() => handleModeChange("all")}>
                  + Secure
                </button>
              </div>
            </div>
          )}

          {carrierId === "idrisP" && (
            <div className="clog-field">
              <label className="clog-field-label">Cargo Mode</label>
              <div className="clog-toggle-row">
                <button type="button"
                  className={`clog-toggle-btn${carrierMode === "cargoRoomsOnly" ? " clog-toggle-btn--active" : ""}`}
                  onClick={() => handleModeChange("cargoRoomsOnly")}>
                  Cargo Rooms
                </button>
                <button type="button"
                  className={`clog-toggle-btn${carrierMode === "all" ? " clog-toggle-btn--active" : ""}`}
                  onClick={() => handleModeChange("all")}>
                  All Grids
                </button>
              </div>
            </div>
          )}

          <div className="clog-field">
            <div className="clog-override-row">
              <input
                id="clog-override-check"
                type="checkbox"
                className="clog-override-check"
                checked={manualOverride}
                onChange={(e) => setManualOverride(e.target.checked)}
              />
              <label htmlFor="clog-override-check" className="clog-override-label">
                Manual Capacity
              </label>
              {manualOverride && (
                <input
                  type="number"
                  className="clog-number-input clog-number-input--wide"
                  value={manualCapacity}
                  min={0}
                  max={99999}
                  onChange={(e) => setManualCapacity(Number(e.target.value))}
                />
              )}
            </div>
          </div>
        </div>

        {/* Service requirement calculator */}
        <div className="clog-panel">
          <div className="clog-panel-title">Service Requirement</div>
          {SHIP_PROFILES.map((profile) => (
            <div key={profile.id} className="clog-ship-block">
              <div className="clog-ship-name">{profile.label}</div>
              <div className="clog-field">
                <label className="clog-field-label">Count</label>
                <div className="clog-slider-row">
                  <input type="range" className="clog-slider"
                    min={0} max={24} step={1}
                    value={shipCounts[profile.id] ?? 0}
                    onChange={(e) => setShipCounts((p) => ({ ...p, [profile.id]: Number(e.target.value) }))}
                  />
                  <input type="number" className="clog-number-input"
                    min={0} max={24}
                    value={shipCounts[profile.id] ?? 0}
                    onChange={(e) => setShipCounts((p) => ({ ...p, [profile.id]: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="clog-field">
                <label className="clog-field-label">Repair %</label>
                <div className="clog-slider-row">
                  <input type="range" className="clog-slider"
                    min={0} max={100} step={5}
                    value={repairPercents[profile.id] ?? 0}
                    onChange={(e) => setRepairPercents((p) => ({ ...p, [profile.id]: Number(e.target.value) }))}
                  />
                  <input type="number" className="clog-number-input"
                    min={0} max={100}
                    value={repairPercents[profile.id] ?? 0}
                    onChange={(e) => setRepairPercents((p) => ({ ...p, [profile.id]: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Center: resource loadout + cargo rooms ── */}
      <section className="clog-col-center">

        {/* Resource loadout controls */}
        <div className="clog-panel">
          <div className="clog-panel-title">Resource Loadout</div>
          <div className="clog-loadout-grid">
            {resourceLoads.map((rl) => (
              <div key={rl.commodity} className="clog-loadout-row">
                <div className="clog-loadout-name">
                  <span className={`clog-loadout-swatch clog-loadout-swatch--${commodityCssKey(rl.commodity)}`} />
                  {rl.label}
                </div>

                <div className="clog-loadout-meta">
                  <span className="clog-loadout-meta-item" title="Exact consumed SCU from service requirements">
                    <span className="clog-loadout-meta-label">Consumed</span>
                    <span className="clog-loadout-meta-value">{rl.exactConsumedScu > 0 ? fmt(rl.exactConsumedScu) : "—"}</span>
                  </span>
                  <span className="clog-loadout-meta-item" title="Recommended crate-rounded loaded SCU">
                    <span className="clog-loadout-meta-label">Recommended</span>
                    <span className="clog-loadout-meta-value clog-loadout-meta-value--rec">
                      {rl.recommendedLoadedScu > 0 ? `${rl.recommendedLoadedScu}` : "—"}
                    </span>
                  </span>
                  <span className="clog-loadout-meta-item" title="Reserve = loaded minus consumed">
                    <span className="clog-loadout-meta-label">Reserve</span>
                    <span className={`clog-loadout-meta-value${rl.userLoadedScu > 0 ? " clog-loadout-meta-value--reserve" : ""}`}>
                      {rl.userLoadedScu > 0 ? fmt(Math.max(0, rl.reserveScu)) : "—"}
                    </span>
                  </span>
                </div>

                <div className="clog-loadout-control">
                  <input type="range" className="clog-slider"
                    min={0} max={capacity} step={1}
                    value={userLoads[rl.commodity] ?? 0}
                    onChange={(e) => setUserLoad(rl.commodity, Number(e.target.value))}
                  />
                  <input type="number" className="clog-number-input clog-number-input--wide"
                    min={0} max={capacity * 2}
                    value={userLoads[rl.commodity] ?? 0}
                    onChange={(e) => setUserLoad(rl.commodity, Number(e.target.value))}
                  />
                </div>

                <div className="clog-loadout-actions">
                  <button type="button" className="clog-quick-btn"
                    title="Set to recommended crate amount"
                    onClick={() => setToRecommended(rl.commodity, rl.recommendedLoadedScu)}
                    disabled={rl.recommendedLoadedScu === 0}>
                    Rec
                  </button>
                  <button type="button" className="clog-quick-btn"
                    title="Fill remaining carrier capacity with this resource"
                    onClick={() => fillRemaining(rl.commodity)}>
                    Fill
                  </button>
                  <button type="button" className="clog-quick-btn clog-quick-btn--clear"
                    title="Clear this resource"
                    onClick={() => clearLoad(rl.commodity)}
                    disabled={userLoads[rl.commodity] === 0}>
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cargo rooms visualization */}
        <div className="clog-panel">
          <div className="clog-panel-title">{preset.label} — Cargo Rooms</div>
          <CarrierCargoRooms roomPlans={roomPlans} overloadedScu={overloadedScu} />
        </div>

      </section>

      {/* ── Right column: summary + tables ── */}
      <aside className="clog-col-right">

        {/* Summary cards */}
        <div className="clog-panel">
          <div className="clog-panel-title">Summary</div>
          <div className="clog-summary-cards">
            <div className="clog-summary-card">
              <div className="clog-summary-card-label">Carrier Capacity</div>
              <div className="clog-summary-card-value">
                {capacity}<span className="clog-summary-card-unit">SCU</span>
              </div>
            </div>
            <div className="clog-summary-card">
              <div className="clog-summary-card-label">User Loaded SCU</div>
              <div className={`clog-summary-card-value${isOverCapacity ? " clog-summary-card-value--danger" : ""}`}>
                {fmt(totalUserLoaded, 0)}<span className="clog-summary-card-unit">SCU</span>
              </div>
            </div>
            <div className="clog-summary-card">
              <div className="clog-summary-card-label">Exact Consumed SCU</div>
              <div className="clog-summary-card-value">
                {fmt(resourceLoads.reduce((s, r) => s + r.exactConsumedScu, 0))}<span className="clog-summary-card-unit">SCU</span>
              </div>
            </div>
            <div className="clog-summary-card">
              <div className="clog-summary-card-label">Recommended Loaded</div>
              <div className="clog-summary-card-value clog-summary-card-value--rec">
                {resourceLoads.reduce((s, r) => s + r.recommendedLoadedScu, 0)}<span className="clog-summary-card-unit">SCU</span>
              </div>
            </div>
            <div className="clog-summary-card">
              <div className="clog-summary-card-label">Reserve SCU</div>
              <div className="clog-summary-card-value clog-summary-card-value--warn">
                {fmt(Math.max(0, totalUserLoaded - resourceLoads.reduce((s, r) => s + r.exactConsumedScu, 0)))}<span className="clog-summary-card-unit">SCU</span>
              </div>
            </div>
            <div className="clog-summary-card">
              <div className="clog-summary-card-label">Remaining Capacity</div>
              <div className={`clog-summary-card-value${isOverCapacity ? " clog-summary-card-value--danger" : " clog-summary-card-value--ok"}`}>
                {fmt(remainingScu, 0)}<span className="clog-summary-card-unit">SCU</span>
              </div>
            </div>

            {isOverCapacity ? (
              <div className="clog-over-capacity-badge">⚠ Over Capacity +{fmt(overloadedScu, 0)} SCU</div>
            ) : (
              <div className="clog-ok-badge">✓ Within Capacity</div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="clog-panel">
          <div className="clog-panel-title">Legend</div>
          <div className="clog-legend">
            {COMMODITY_ORDER.map((key) => (
              <div key={key} className="clog-legend-item">
                <span className={`clog-legend-swatch clog-legend-swatch--${commodityCssKey(key)}`} />
                {COMMODITY_LABELS[key]}
              </div>
            ))}
          </div>
        </div>

        {/* Crate breakdown */}
        <div className="clog-panel">
          <div className="clog-panel-title">Crate Breakdown</div>
          <div className="clog-crate-list">
            {COMMODITY_ORDER.map((key) => {
              const crates = crateList[key];
              if (crates.length === 0) return null;
              return (
                <div key={key} className="clog-crate-row">
                  <span className={`clog-loadout-swatch clog-loadout-swatch--${commodityCssKey(key)}`} />
                  <span className="clog-crate-row-label">{COMMODITY_LABELS[key]}</span>
                  <div className="clog-crate-chips">
                    {crates.map((scu, i) => (
                      <span key={i} className={`clog-crate-chip clog-crate-chip--${commodityCssKey(key)}`}>{scu}</span>
                    ))}
                  </div>
                </div>
              );
            })}
            {COMMODITY_ORDER.every((k) => crateList[k].length === 0) && (
              <span className="clog-dim-text">No resources loaded.</span>
            )}
          </div>
        </div>

      </aside>

      {/* ── Full-width: tables ── */}
      <div className="clog-col-tables">

        {/* Commodity breakdown table */}
        <div className="clog-panel clog-table-section">
          <div className="clog-panel-title">Commodity Breakdown</div>
          <table className="clog-table">
            <thead>
              <tr>
                <th>Commodity</th>
                <th className="clog-th--right">Exact Consumed</th>
                <th className="clog-th--right">Recommended</th>
                <th className="clog-th--right">User Loaded</th>
                <th className="clog-th--right">Reserve</th>
              </tr>
            </thead>
            <tbody>
              {resourceLoads.map((rl) => (
                <tr key={rl.commodity}>
                  <td>
                    <span className="clog-td-swatch-wrap">
                      <span className={`clog-loadout-swatch clog-loadout-swatch--${commodityCssKey(rl.commodity)}`} />
                      {rl.label}
                    </span>
                  </td>
                  <td className={rl.exactConsumedScu > 0 ? "clog-td--num" : "clog-td--num clog-td--dim"}>
                    {rl.exactConsumedScu > 0 ? fmt(rl.exactConsumedScu) : "—"}
                  </td>
                  <td className={rl.recommendedLoadedScu > 0 ? "clog-td--num" : "clog-td--num clog-td--dim"}>
                    {rl.recommendedLoadedScu > 0 ? `${rl.recommendedLoadedScu}` : "—"}
                  </td>
                  <td className={rl.userLoadedScu > 0 ? "clog-td--num clog-td--loaded" : "clog-td--num clog-td--dim"}>
                    {rl.userLoadedScu > 0 ? `${rl.userLoadedScu}` : "—"}
                  </td>
                  <td className={rl.userLoadedScu > 0 ? "clog-td--num clog-td--warn" : "clog-td--num clog-td--dim"}>
                    {rl.userLoadedScu > 0 ? fmt(Math.max(0, rl.reserveScu)) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Ship service breakdown table */}
        <div className="clog-panel clog-table-section">
          <div className="clog-panel-title">Serviced Ship Breakdown</div>
          <table className="clog-table">
            <thead>
              <tr>
                <th>Ship</th>
                <th className="clog-th--right">Count</th>
                <th className="clog-th--right">Reload Consumed</th>
                <th className="clog-th--right">Repair %</th>
                <th className="clog-th--right">Repair Consumed</th>
                <th className="clog-th--right">Total Consumed</th>
              </tr>
            </thead>
            <tbody>
              {SHIP_PROFILES.map((profile) => {
                const count = shipCounts[profile.id] ?? 0;
                const repair = repairPercents[profile.id] ?? 0;
                const reloadConsumed = (["ammoS2", "ammoS3", "ammoS4", "noise", "decoy"] as const)
                  .reduce((sum, k) => sum + profile.rearm[k] * count, 0);
                const repairConsumed = count * profile.repair.fullRepairRmcScu * (repair / 100);
                const totalConsumed = reloadConsumed + repairConsumed;
                const active = count > 0;
                return (
                  <tr key={profile.id}>
                    <td>{profile.label}</td>
                    <td className={active ? "clog-td--num" : "clog-td--num clog-td--dim"}>{count}</td>
                    <td className={active ? "clog-td--num" : "clog-td--num clog-td--dim"}>{active ? fmt(reloadConsumed) : "—"}</td>
                    <td className={active ? "clog-td--num" : "clog-td--num clog-td--dim"}>{active ? `${repair}%` : "—"}</td>
                    <td className={active ? "clog-td--num" : "clog-td--num clog-td--dim"}>
                      {active && repair > 0 ? fmt(repairConsumed) : "—"}
                    </td>
                    <td className={active ? "clog-td--num clog-td--ok" : "clog-td--num clog-td--dim"}>
                      {active ? fmt(totalConsumed) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
