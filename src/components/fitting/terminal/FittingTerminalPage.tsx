import { useMemo } from "react";
import type { FittingCalculateResult } from "../../../lib/fitting/fittingApi";
import {
  buildDefensiveGroups,
  buildOffensiveGroups,
  categoryLabel,
  type FittingComponentRecord,
  type FittingShipDetail,
  type FittingShipSummary,
  type PortBreakdownRow,
} from "../../../lib/fitting/fittingPortGrouping";
import type { FittingIconMode } from "../../../lib/fitting/fittingIconMode";
import { useFittingTerminalState } from "../../../lib/fitting/useFittingTerminalState";
import CraftQualityModal from "./CraftQualityModal";
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
              <td>{row.portName ?? row.portId}</td>
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
  const ship = shipDetail?.ship;
  const offensiveGroups = useMemo(() => buildOffensiveGroups(portRows), [portRows]);
  const defensiveGroups = useMemo(() => buildDefensiveGroups(portRows), [portRows]);
  const craftOverridePortIds = useMemo(
    () => new Set(Object.keys(terminal.craftOverrides)),
    [terminal.craftOverrides],
  );

  const selectedRow = portRows.find((row) => row.portId === terminal.selectedPortId) ?? null;
  const selectedLabel = selectedRow
    ? selectedRow.equippedComponentName ?? selectedRow.portName ?? selectedRow.portId
    : null;

  const totalAlpha = (() => {
    const value = calculateResult?.categories?.weapons?.derived?.weaponAlphaTotal;
    return typeof value === "number" ? value : null;
  })();

  const activeCraftRow = terminal.activeCraftPortId
    ? portRows.find((row) => row.portId === terminal.activeCraftPortId) ?? null
    : null;

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
          <FittingSystemsPanel
            title="Offensive Systems"
            groups={offensiveGroups}
            selectedPortId={terminal.selectedPortId}
            craftOverridePortIds={craftOverridePortIds}
            craftablePortIds={craftablePortIds}
            iconMode={iconMode}
            onSelectPort={terminal.selectComponent}
            onCraftPort={terminal.setActiveCraftPortId}
          />
          <div className="fit-term-center">
            <ShipHeroPanel
              manufacturer={ship?.manufacturer ?? null}
              shipName={ship?.name ?? "Ship"}
              focusTarget={terminal.focusTarget}
              selectedLabel={selectedLabel}
            />
          </div>
          <FittingSystemsPanel
            title="Defensive / Support Systems"
            groups={defensiveGroups}
            selectedPortId={terminal.selectedPortId}
            craftOverridePortIds={craftOverridePortIds}
            craftablePortIds={craftablePortIds}
            iconMode={iconMode}
            onSelectPort={terminal.selectComponent}
            onCraftPort={terminal.setActiveCraftPortId}
          />
          <FittingPerformanceGrid
            calculateResult={calculateResult}
            shipPerformance={ship ?? null}
            pipAssignment={terminal.pipAssignment}
            onPipChange={terminal.updatePip}
            shieldThresholdPercent={terminal.shieldThresholdPercent}
            onThresholdChange={terminal.setShieldThresholdPercent}
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

      {activeCraftRow && (
        <CraftQualityModal
          portRow={activeCraftRow}
          existingOverride={terminal.craftOverrides[activeCraftRow.portId] ?? null}
          onClose={() => terminal.setActiveCraftPortId(null)}
          onApply={terminal.applyCraftOverride}
          onReset={() => {
            terminal.resetCraftOverride(activeCraftRow.portId);
            terminal.setActiveCraftPortId(null);
          }}
        />
      )}
    </div>
  );
}
