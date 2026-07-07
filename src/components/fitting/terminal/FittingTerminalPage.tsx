import { useEffect, useMemo, useRef } from "react";
import type { FittingCalculateResult } from "../../../lib/fitting/fittingApi";
import {
  buildDefensiveGroups,
  buildOffensiveGroups,
  categoryLabel,
  portShortLabel,
  type FittingComponentRecord,
  type FittingShipDetail,
  type FittingShipSummary,
  type PortBreakdownRow,
} from "../../../lib/fitting/fittingPortGrouping";
import { useCombatAlphaBreakdown } from "../../../lib/fitting/useCombatAlphaBreakdown";
import type { FittingIconMode } from "../../../lib/fitting/fittingIconMode";
import { useFittingTerminalState } from "../../../lib/fitting/useFittingTerminalState";
import { pipAssignmentFromDraws } from "../../../lib/fitting/fittingPipPower";
import { usePipSystemPowerDraw } from "../../../lib/fitting/usePipSystemPowerDraw";
import CraftQualityDrawer from "./CraftQualityDrawer";
import FittingPerformanceGrid from "./FittingPerformanceGrid";
import FittingSystemsPanel from "./FittingSystemsPanel";
import FittingTopNav from "./FittingTopNav";
import ShipHeroPanel from "./ShipHeroPanel";
import WeaponStatsTab from "./WeaponStatsTab";

export type FittingTerminalPageProps = {
  shipId: string | null;
  ships: FittingShipSummary[];
  shipDetail: FittingShipDetail | null;
  portRows: PortBreakdownRow[];
  calculateResult: FittingCalculateResult | null;
  componentLookup: Map<string, FittingComponentRecord>;
  craftablePortIds: Set<string>;
  loading: boolean;
  iconMode: FittingIconMode;
  onSelectShip: (shipKey: string) => void;
  shipsLoading: boolean;
};

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="fit-term-placeholder">
      <h2>{label}</h2>
      <p>Not available in this prototype.</p>
    </div>
  );
}

function HardpointsTab({ portRows }: { portRows: PortBreakdownRow[] }) {
  return (
    <div className="fit-term-hardpoints">
      <table className="fit-term-table">
        <thead>
          <tr>
            <th>Port</th>
            <th>Category</th>
            <th>Component</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {portRows.map((row) => (
            <tr key={row.portId}>
              <td>{portShortLabel(row)}</td>
              <td>{categoryLabel(row.ruleCategory ?? row.portCategory)}</td>
              <td>{row.equippedComponentName ?? "Empty"}</td>
              <td>{row.compatibilityStatus ?? "unknown"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FittingTerminalPage({
  shipId,
  ships,
  shipDetail,
  portRows,
  calculateResult,
  craftablePortIds,
  loading,
  iconMode,
  onSelectShip,
  shipsLoading,
}: FittingTerminalPageProps) {
  const terminal = useFittingTerminalState(shipId);
  const pipPower = usePipSystemPowerDraw(portRows);
  const pipSyncedShipRef = useRef<string | null>(null);
  const combatAlpha = useCombatAlphaBreakdown(portRows);
  const { syncPipsFromDraws } = terminal;
  const ship = shipDetail?.ship;
  const offensiveGroups = useMemo(() => buildOffensiveGroups(portRows), [portRows]);
  const defensiveGroups = useMemo(() => buildDefensiveGroups(portRows), [portRows]);
  const defensiveCoreGroups = useMemo(
    () => defensiveGroups.filter((group) => ["shields", "armor", "hull"].includes(group.key) && group.rows.length > 0),
    [defensiveGroups],
  );
  const supportGroups = useMemo(
    () => defensiveGroups.filter((group) => !["shields", "armor", "hull"].includes(group.key) && group.rows.length > 0),
    [defensiveGroups],
  );
  const craftOverridePortIds = useMemo(
    () => new Set(Object.keys(terminal.craftOverrides)),
    [terminal.craftOverrides],
  );
  const portLookup = useMemo(
    () => new Map(portRows.map((row) => [row.portId, row])),
    [portRows],
  );

  const selectedRow = portRows.find((row) => row.portId === terminal.selectedPortId) ?? null;
  const selectedLabel = selectedRow
    ? selectedRow.equippedComponentName ?? selectedRow.portName ?? null
    : null;
  const selectedMeta = selectedRow
    ? [selectedRow.componentManufacturer, selectedRow.componentSize != null ? `S${selectedRow.componentSize}` : null]
      .filter(Boolean)
      .join(" · ") || null
    : null;

  const totalAlpha = (() => {
    const value = calculateResult?.categories?.weapons?.derived?.weaponAlphaTotal;
    return typeof value === "number" ? value : null;
  })();

  const activeCraftRow = terminal.activeCraftPortId
    ? portRows.find((row) => row.portId === terminal.activeCraftPortId) ?? null
    : null;

  const offensivePortIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of offensiveGroups) {
      for (const row of group.rows) ids.add(row.portId);
    }
    return ids;
  }, [offensiveGroups]);

  const craftSide = activeCraftRow
    ? offensivePortIds.has(activeCraftRow.portId) ? "left" : "right"
    : null;

  const handleCraftPort = (portId: string) => {
    const row = portLookup.get(portId);
    if (row) terminal.selectComponent(portId, row.equippedComponentKey ?? null);
    terminal.toggleCraftPort(portId);
  };

  const craftDrawer = activeCraftRow && craftSide ? (
    <CraftQualityDrawer
      side={craftSide}
      portRow={activeCraftRow}
      existingOverride={terminal.craftOverrides[activeCraftRow.portId] ?? null}
      onClose={() => terminal.setActiveCraftPortId(null)}
      onApply={terminal.applyCraftOverride}
      onReset={() => {
        terminal.resetCraftOverride(activeCraftRow.portId);
        terminal.setActiveCraftPortId(null);
      }}
    />
  ) : null;

  useEffect(() => {
    pipSyncedShipRef.current = null;
  }, [shipId]);

  useEffect(() => {
    if (!shipId || !pipPower.ready || pipSyncedShipRef.current === shipId) return;
    pipSyncedShipRef.current = shipId;
    syncPipsFromDraws(pipAssignmentFromDraws(pipPower.draws));
  }, [shipId, pipPower.ready, pipPower.draws, syncPipsFromDraws]);

  return (
    <div className="fit-page fit-term-page">
      <FittingTopNav
        activeTab={terminal.activeTab}
        onTabChange={terminal.setActiveTab}
        manufacturer={ship?.manufacturer ?? null}
        shipName={ship?.name ?? "Select a ship"}
        role={ship?.role ?? ship?.career ?? null}
        ships={ships}
        selectedShipKey={shipId}
        onSelectShip={onSelectShip}
        shipsLoading={shipsLoading}
      />

      {loading && <p className="fit-term-loading">Loading fitting data…</p>}

      {terminal.activeTab === "overview" && !loading && (
        <div className="fit-term-body">
          <div className={["fit-term-col", "fit-term-col--left", craftSide === "left" ? "is-craft-open" : ""].filter(Boolean).join(" ")}>
            <FittingSystemsPanel
              title="Offensive Systems"
              groups={offensiveGroups}
              portLookup={portLookup}
              selectedPortId={terminal.selectedPortId}
              activeCraftPortId={terminal.activeCraftPortId}
              craftOverridePortIds={craftOverridePortIds}
              craftablePortIds={craftablePortIds}
              iconMode={iconMode}
              onSelectPort={terminal.selectComponent}
              onCraftPort={handleCraftPort}
            />
            {craftSide === "left" ? craftDrawer : null}
          </div>
          <div className="fit-term-center">
            <ShipHeroPanel
              shipId={shipId}
              manufacturer={ship?.manufacturer ?? null}
              shipName={ship?.name ?? "Ship"}
              focusTarget={terminal.focusTarget}
              selectedLabel={selectedLabel}
              selectedMeta={selectedMeta}
            />
          </div>
          <div className={["fit-term-col", "fit-term-col--right", craftSide === "right" ? "is-craft-open" : ""].filter(Boolean).join(" ")}>
            <FittingSystemsPanel
              title="Defensive Systems"
              groups={defensiveCoreGroups}
              portLookup={portLookup}
              selectedPortId={terminal.selectedPortId}
              activeCraftPortId={terminal.activeCraftPortId}
              craftOverridePortIds={craftOverridePortIds}
              craftablePortIds={craftablePortIds}
              iconMode={iconMode}
              onSelectPort={terminal.selectComponent}
              onCraftPort={handleCraftPort}
              compact
            />
            <FittingSystemsPanel
              title="Support Systems"
              groups={supportGroups}
              portLookup={portLookup}
              selectedPortId={terminal.selectedPortId}
              activeCraftPortId={terminal.activeCraftPortId}
              craftOverridePortIds={craftOverridePortIds}
              craftablePortIds={craftablePortIds}
              iconMode={iconMode}
              onSelectPort={terminal.selectComponent}
              onCraftPort={handleCraftPort}
              compact
            />
            <footer className="fit-term-col-foot">
              <div className="fit-term-fitting-status">
                <span className="fit-term-meta-label">Fitting Status</span>
                <span className="fit-term-status-pill fit-term-status-pill--valid">
                  <i aria-hidden />
                  Valid
                </span>
              </div>
              <button type="button" className="fit-term-foot-btn">View Full Stats</button>
            </footer>
            {craftSide === "right" ? craftDrawer : null}
          </div>
          <FittingPerformanceGrid
            calculateResult={calculateResult}
            shipPerformance={ship ?? null}
            hullHP={shipDetail?.hullHP ?? null}
            cargoCapacityScu={ship?.cargoCapacityScu ?? null}
            portRows={portRows}
            combatAlpha={combatAlpha}
            pipAssignment={terminal.pipAssignment}
            systemDraws={pipPower.draws}
            onPipChange={terminal.updatePip}
            onViewWeaponStats={() => terminal.setActiveTab("weapon-stats")}
          />
        </div>
      )}

      {terminal.activeTab === "weapon-stats" && !loading && (
        <WeaponStatsTab portRows={portRows} totalAlpha={totalAlpha} />
      )}

      {terminal.activeTab === "hardpoints" && !loading && (
        <HardpointsTab portRows={portRows} />
      )}

      {terminal.activeTab === "loadout" && <PlaceholderTab label="Loadout" />}
      {terminal.activeTab === "compare" && <PlaceholderTab label="Compare" />}
      {terminal.activeTab === "shopping-list" && <PlaceholderTab label="Shopping List" />}
      {terminal.activeTab === "damage-lab" && <PlaceholderTab label="Damage Lab" />}
    </div>
  );
}
