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
  getTotalUserLoadedScu,
  getRemainingCapacity,
  allocateUserLoadsToRooms,
  buildCrateList,
  calculateServiceCapability,
} from "./carrierLogisticsPlanner";
import CarrierCargoRooms from "./CarrierCargoRooms";

const DEFAULT_CARRIER: CarrierId = "ironclad";
const EMPTY_LOADS: Record<CommodityKey, number> = {
  ammoS2: 0, ammoS3: 0, ammoS4: 0, noise: 0, decoy: 0, rmc: 0,
};

function getDefaultMode(carrierId: CarrierId): CarrierMode {
  if (carrierId === "idrisP") return "cargoRoomsOnly";
  return "all";
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

  // ── User resource loadout ──────────────────────
  const [userLoads, setUserLoads] = useState<Record<CommodityKey, number>>({ ...EMPTY_LOADS });

  // ── Derived: carrier ───────────────────────────
  const preset = getCarrierPreset(carrierId);
  const capacity = getCarrierCapacity(preset, carrierMode, manualOverride ? manualCapacity : null);
  const activeRooms = useMemo(() => getActiveRooms(carrierId, carrierMode), [carrierId, carrierMode]);

  // ── Derived: totals ────────────────────────────
  const totalUserLoaded = useMemo(() => getTotalUserLoadedScu(userLoads), [userLoads]);
  const remainingScu = useMemo(() => getRemainingCapacity(capacity, totalUserLoaded), [capacity, totalUserLoaded]);
  const fillPct = capacity > 0 ? Math.min(100, (totalUserLoaded / capacity) * 100) : 0;
  const isOverCapacity = remainingScu < 0;

  // ── Derived: room plans ────────────────────────
  const roomPlans = useMemo(
    () => allocateUserLoadsToRooms(userLoads, activeRooms),
    [userLoads, activeRooms]
  );

  // ── Derived: crate list ────────────────────────
  const crateList = useMemo(() => buildCrateList(userLoads), [userLoads]);

  // ── Derived: service capability ────────────────
  const serviceCapability = useMemo(
    () => calculateServiceCapability(SHIP_PROFILES, userLoads),
    [userLoads]
  );

  // ── Handlers ──────────────────────────────────
  function handleCarrierChange(id: CarrierId) {
    setCarrierId(id);
    const newMode = getDefaultMode(id);
    setCarrierMode(newMode);
    const p = getCarrierPreset(id);
    const newCap = getCarrierCapacity(p, newMode, null);
    setManualCapacity(newCap);
    // Clamp all loads to new capacity
    const total = getTotalUserLoadedScu(userLoads);
    if (total > newCap) setUserLoads({ ...EMPTY_LOADS });
  }

  function handleModeChange(mode: CarrierMode) {
    setCarrierMode(mode);
    const newCap = getCarrierCapacity(preset, mode, null);
    setManualCapacity(newCap);
    const total = getTotalUserLoadedScu(userLoads);
    if (total > newCap) setUserLoads({ ...EMPTY_LOADS });
  }

  // Clamped setter: ensures total never exceeds capacity
  function setUserLoad(key: CommodityKey, rawValue: number) {
    const others = COMMODITY_ORDER
      .filter((k) => k !== key)
      .reduce((s, k) => s + (userLoads[k] ?? 0), 0);
    const max = Math.max(0, capacity - others);
    const clamped = Math.max(0, Math.min(rawValue, max));
    setUserLoads((prev) => ({ ...prev, [key]: clamped }));
  }

  function fillRemaining(key: CommodityKey) {
    const others = COMMODITY_ORDER
      .filter((k) => k !== key)
      .reduce((s, k) => s + (userLoads[k] ?? 0), 0);
    const available = Math.max(0, capacity - others);
    setUserLoads((prev) => ({ ...prev, [key]: available }));
  }

  function clearLoad(key: CommodityKey) {
    setUserLoads((prev) => ({ ...prev, [key]: 0 }));
  }

  function getSliderMax(key: CommodityKey): number {
    const others = COMMODITY_ORDER
      .filter((k) => k !== key)
      .reduce((s, k) => s + (userLoads[k] ?? 0), 0);
    return Math.max(0, capacity - others);
  }

  // ── Render ─────────────────────────────────────
  return (
    <div className="clog-layout">

      {/* ══ TOP ROW: carrier controls + cargo rooms + summary ══ */}
      <div className="clog-top-row">

        {/* Left: carrier selector strip */}
        <div className="clog-carrier-strip">
          <div className="clog-panel clog-panel--carrier">
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
                  Manual Cap
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

            {/* Capacity bar */}
            <div className="clog-cap-bar-wrap">
              <div className="clog-cap-bar-track">
                <div
                  className={`clog-cap-bar-fill${isOverCapacity ? " clog-cap-bar-fill--over" : fillPct > 85 ? " clog-cap-bar-fill--high" : ""}`}
                  style={{ width: `${Math.min(fillPct, 100)}%` }}
                />
              </div>
              <div className="clog-cap-bar-labels">
                <span className="clog-cap-bar-loaded">{totalUserLoaded} SCU loaded</span>
                <span className="clog-cap-bar-total">{capacity} SCU</span>
              </div>
            </div>

            {/* Summary cards inline */}
            <div className="clog-inline-summary">
              <div className="clog-inline-card">
                <div className="clog-inline-card-label">Remaining</div>
                <div className={`clog-inline-card-value${isOverCapacity ? " clog-inline-card-value--danger" : remainingScu === 0 ? " clog-inline-card-value--warn" : " clog-inline-card-value--ok"}`}>
                  {Math.max(0, remainingScu)} <span className="clog-inline-card-unit">SCU</span>
                </div>
              </div>
              <div className="clog-inline-card">
                <div className="clog-inline-card-label">Fill</div>
                <div className={`clog-inline-card-value${fillPct >= 100 ? " clog-inline-card-value--warn" : ""}`}>
                  {fillPct.toFixed(0)}<span className="clog-inline-card-unit">%</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Center: cargo rooms — primary visual */}
        <div className="clog-rooms-main">
          <div className="clog-panel clog-panel--rooms">
            <div className="clog-cargo-rooms-header">
              <div className="clog-panel-title">{preset.label} — Cargo Rooms</div>
              <div className="clog-resource-legend clog-resource-legend--inline">
                {COMMODITY_ORDER.map((key) => (
                  <div key={key} className="clog-legend-item">
                    <span className={`clog-legend-swatch clog-legend-swatch--${commodityCssKey(key)}`} />
                    {COMMODITY_LABELS[key]}
                  </div>
                ))}
              </div>
            </div>
            <CarrierCargoRooms roomPlans={roomPlans} overloadedScu={isOverCapacity ? Math.abs(remainingScu) : 0} />
          </div>
        </div>

      </div>

      {/* ══ BOTTOM ROW: resource loadout + service capability ══ */}
      <div className="clog-bottom-row">

        {/* Resource loadout */}
        <div className="clog-panel clog-panel--loadout">
          <div className="clog-panel-title">Resource Loadout</div>
          <div className="clog-loadout-grid">
            {COMMODITY_ORDER.map((key) => {
              const loaded = userLoads[key] ?? 0;
              const sliderMax = getSliderMax(key);
              const pctOfCap = capacity > 0 ? (loaded / capacity) * 100 : 0;
              const crates = crateList[key];
              return (
                <div key={key} className="clog-loadout-row">
                  <div className="clog-loadout-name">
                    <span className={`clog-loadout-swatch clog-loadout-swatch--${commodityCssKey(key)}`} />
                    <span className="clog-loadout-label">{COMMODITY_LABELS[key]}</span>
                  </div>

                  <div className="clog-loadout-control-group">
                    <input type="range" className="clog-slider"
                      min={0} max={sliderMax} step={1}
                      value={loaded}
                      onChange={(e) => setUserLoad(key, Number(e.target.value))}
                    />
                    <input type="number" className="clog-number-input clog-number-input--wide"
                      min={0}
                      value={loaded}
                      onChange={(e) => setUserLoad(key, Number(e.target.value))}
                    />
                    <span className="clog-loadout-pct">{pctOfCap.toFixed(0)}%</span>
                  </div>

                  <div className="clog-loadout-actions">
                    <button type="button" className="clog-quick-btn"
                      title="Fill all remaining carrier capacity with this resource"
                      onClick={() => fillRemaining(key)}
                      disabled={sliderMax === 0 && loaded === 0}>
                      Fill
                    </button>
                    <button type="button" className="clog-quick-btn clog-quick-btn--clear"
                      title="Clear this resource"
                      onClick={() => clearLoad(key)}
                      disabled={loaded === 0}>
                      ×
                    </button>
                  </div>

                  {crates.length > 0 && (
                    <div className="clog-loadout-crates">
                      {crates.map((scu, i) => (
                        <span key={i} className={`clog-crate-chip clog-crate-chip--${commodityCssKey(key)}`}>{scu}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Service capability */}
        <div className="clog-panel clog-panel--capability">
          <div className="clog-panel-title">Service Capability</div>
          <p className="clog-capability-desc">
            Values show how many full empty-to-full reloads or repairs the current loaded SCU can support.
            Countermeasure numbers may be very high because their per-ship SCU cost is extremely small.
          </p>
          <div className="clog-capability-grid">
            {serviceCapability.map((cap) => {
              const profile = SHIP_PROFILES.find((p) => p.id === cap.shipId)!;
              const ammoCostScu = profile.rearm.ammoS2 + profile.rearm.ammoS3 + profile.rearm.ammoS4;
              const rows: { label: string; value: number; sublabel: string; combined?: boolean }[] = [
                { label: "Ammo Reloads",  value: cap.ammoReloads,   sublabel: `${ammoCostScu.toFixed(3)} SCU per reload` },
                { label: "Noise Refills", value: cap.noiseReloads,  sublabel: `${profile.rearm.noise.toFixed(4)} SCU per refill` },
                { label: "Decoy Refills", value: cap.decoyReloads,  sublabel: `${profile.rearm.decoy.toFixed(4)} SCU per refill` },
                { label: "Full Repairs",  value: cap.repairs,       sublabel: `${profile.repair.fullRepairRmcScu.toFixed(3)} SCU per repair` },
                { label: "Full Rearms",   value: cap.fullRearms,    sublabel: "ammo + noise + decoy combined", combined: true },
                { label: "Full Service",  value: cap.fullServices,  sublabel: "rearm + repair combined",       combined: true },
              ];
              return (
                <div key={cap.shipId} className="clog-capability-card">
                  <div className="clog-capability-ship">{cap.label}</div>
                  <div className="clog-capability-rows">
                    {rows.map((row) => (
                      <div key={row.label} className={`clog-cap-row${row.combined ? " clog-cap-row--combined" : ""}`}>
                        <span className="clog-cap-row-label">{row.label}</span>
                        <div className="clog-cap-row-right">
                          <span className={`clog-cap-row-value${row.value > 0 ? " clog-cap-row-value--ok" : " clog-cap-row-value--zero"}`}>
                            {row.value}
                          </span>
                          <span className="clog-cap-row-sublabel">{row.sublabel}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
