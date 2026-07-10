import { useEffect, useRef, useState } from "react";
import type { TopBarView } from "../../../lib/fitting/mockup/fittingMockupViewTypes";

type FittingTopBarProps = {
  view: TopBarView;
  onSelectShip: (shipKey: string) => void;
  onSaveLoadout?: () => void;
};

function manufacturerMonogram(manufacturer: string | null, shipName: string): string {
  if (manufacturer) {
    const parts = manufacturer.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
    return manufacturer.slice(0, 3).toUpperCase();
  }
  const prefix = shipName.trim().split(/\s+/)[0];
  return prefix ? prefix.slice(0, 3).toUpperCase() : "SC";
}

export default function FittingTopBar({ view, onSelectShip, onSaveLoadout }: FittingTopBarProps) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toolsOpen) return;
    const handlePointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setToolsOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, [toolsOpen]);

  return (
    <header className="fm-topbar">
      <div className="fm-topbar-id">
        <span className="fm-topbar-emblem" aria-hidden>
          {manufacturerMonogram(view.manufacturer, view.shipName)}
        </span>
        <div className="fm-topbar-copy">
          {view.manufacturer ? <span className="fm-topbar-mfg">{view.manufacturer}</span> : null}
          <h1>{view.shipName}</h1>
          <span className="fm-topbar-role">{view.roleLine}</span>
        </div>
      </div>

      <nav className="fm-topbar-tabs" aria-label="Fitting sections">
        {view.tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={["fm-topbar-tab", view.activeTab === tab ? "is-active" : ""].filter(Boolean).join(" ")}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="fm-topbar-actions">
        <div className="fm-topbar-wallet" aria-hidden>
          <span className="fm-topbar-wallet-chip"><i>◆</i> — UEC</span>
          <span className="fm-topbar-wallet-chip is-rec"><i>◇</i> — REC</span>
        </div>
        <div className="fm-topbar-icons" aria-hidden>
          <button type="button" className="fm-topbar-icon-btn" aria-label="Notifications">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" /><path d="M9.5 17a2.5 2.5 0 005 0" /></svg>
          </button>
          <button type="button" className="fm-topbar-icon-btn" aria-label="Messages">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="1" /><path d="M3 7l9 6 9-6" /></svg>
          </button>
          <button type="button" className="fm-topbar-icon-btn" aria-label="Profile">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 2v10" /><path d="M8.5 8.5L12 12l3.5-3.5" /><path d="M4 14v4h16v-4" /></svg>
          </button>
        </div>

        <div className="fm-topbar-ship-menu" ref={menuRef}>
          <button
            type="button"
            className={["fm-topbar-ship-menu-btn", toolsOpen ? "is-open" : ""].filter(Boolean).join(" ")}
            aria-label="Ship and loadout tools"
            aria-expanded={toolsOpen}
            onClick={() => setToolsOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h10" />
            </svg>
          </button>
          {toolsOpen ? (
            <div className="fm-topbar-ship-menu-panel">
              <span className="fm-topbar-ship-menu-label">Ship / Loadout</span>
              <select
                className="fm-topbar-ship-menu-select"
                value={view.selectedShipKey ?? ""}
                onChange={(event) => onSelectShip(event.target.value)}
                aria-label="Select ship"
                disabled={view.shipsLoading}
              >
                {view.ships.map((entry) => (
                  <option key={entry.shipKey} value={entry.shipKey}>{entry.name}</option>
                ))}
              </select>
              <button
                type="button"
                className="fm-topbar-ship-menu-save"
                disabled={!view.isModified}
                onClick={onSaveLoadout}
              >
                Save Loadout
              </button>
              {view.isModified ? <span className="fm-topbar-ship-menu-flag">Modified</span> : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
