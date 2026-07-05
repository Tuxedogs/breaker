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

function manufacturerMonogram(manufacturer: string | null): string {
  if (!manufacturer) return "SC";
  const parts = manufacturer.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  return manufacturer.slice(0, 2).toUpperCase();
}

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
      <div className="fit-term-head-row">
        <div className="fit-term-ship-identity">
          <span className="fit-term-ship-logo" aria-hidden>
            {manufacturerMonogram(manufacturer)}
          </span>
          <div className="fit-term-ship-identity-text">
            <span className="fit-term-manufacturer">{manufacturer ?? "Unknown Manufacturer"}</span>
            <h1>{shipName}</h1>
            {role && <span className="fit-term-ship-role">{role}</span>}
          </div>
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

        <div className="fit-term-head-actions">
          <div className="fit-term-wallet" title="Prototype — wallet not connected">
            <span className="fit-term-wallet-item fit-term-wallet-item--uec">
              <i aria-hidden>◆</i> — UEC
            </span>
            <span className="fit-term-wallet-item fit-term-wallet-item--auec">
              <i aria-hidden>◇</i> — aUEC
            </span>
          </div>
          <label className="fit-term-ship-select">
            <select
              value={selectedShipKey ?? ""}
              onChange={(event) => onSelectShip(event.target.value)}
              disabled={shipsLoading || ships.length === 0}
              aria-label="Select ship"
            >
              {ships.map((ship) => (
                <option key={ship.shipKey} value={ship.shipKey}>{ship.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}
