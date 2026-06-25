import type { FittingTerminalTab } from "../../../lib/fitting/fittingTerminalTypes";
import type { FittingShipSummary } from "../../../lib/fitting/fittingPortGrouping";

const tabs: Array<{ id: FittingTerminalTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "loadout", label: "Loadout" },
  { id: "compare", label: "Compare" },
  { id: "hardpoints", label: "Hardpoints" },
  { id: "shopping-list", label: "Shopping List" },
  { id: "damage-lab", label: "Damage Lab" },
  { id: "weapon-stats", label: "Weapon Stats" },
];

type FittingTopNavProps = {
  activeTab: FittingTerminalTab;
  onTabChange: (tab: FittingTerminalTab) => void;
  manufacturer: string | null;
  shipName: string;
  role: string | null;
  ships: FittingShipSummary[];
  selectedShipKey: string | null;
  onSelectShip: (shipKey: string) => void;
  shipsLoading: boolean;
};

export default function FittingTopNav({
  activeTab,
  onTabChange,
  manufacturer,
  shipName,
  role,
  ships,
  selectedShipKey,
  onSelectShip,
  shipsLoading,
}: FittingTopNavProps) {
  return (
    <header className="fit-term-head">
      <div className="fit-term-head-left">
        <div className="fit-term-ship-identity">
          <span>{manufacturer ?? "Unknown Manufacturer"}</span>
          <h1>{shipName}</h1>
          {role && <p>{role}</p>}
        </div>
        <label className="fit-term-ship-select">
          <span className="fit-term-kicker">Ship</span>
          <select
            value={selectedShipKey ?? ""}
            onChange={(event) => onSelectShip(event.target.value)}
            disabled={shipsLoading || ships.length === 0}
          >
            {ships.map((ship) => (
              <option key={ship.shipKey} value={ship.shipKey}>{ship.name}</option>
            ))}
          </select>
        </label>
      </div>
      <nav className="fit-term-tabs" aria-label="Fitting terminal sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "fit-term-tab is-active" : "fit-term-tab"}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
