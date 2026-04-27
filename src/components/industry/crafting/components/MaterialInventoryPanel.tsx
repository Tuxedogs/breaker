import { useState, useMemo } from "react";
import type { MaterialInventory, AggregatedMaterial } from "../utils/craftingTypes";

interface Props {
  inventory: MaterialInventory;
  needed: AggregatedMaterial[];
  onSetAmount: (key: string, amount: number) => void;
  onClear: () => void;
}

export default function MaterialInventoryPanel({ inventory, needed, onSetAmount, onClear }: Props) {
  const [search, setSearch] = useState("");

  // Materials to show: all that appear in the aggregated need list + any already in inventory
  const allKeys = useMemo(() => {
    const keys = new Map<string, string>();
    for (const m of needed) keys.set(m.cost_id, m.material_name);
    for (const key of Object.keys(inventory)) {
      if (!keys.has(key)) keys.set(key, key);
    }
    return Array.from(keys.entries()).map(([id, name]) => ({ id, name }));
  }, [needed, inventory]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? allKeys.filter((k) => k.name.toLowerCase().includes(q)) : allKeys;
  }, [allKeys, search]);

  return (
    <div className="craft-section">
      <div className="craft-section-header">
        <span className="craft-section-title">Material Inventory</span>
        <div className="craft-section-actions">
          {Object.keys(inventory).length > 0 && (
            <button type="button" className="craft-btn-ghost" onClick={onClear}>
              Reset
            </button>
          )}
        </div>
      </div>

      {allKeys.length === 0 ? (
        <div className="craft-empty-state">
          <p>Add components to the build queue to populate material inputs.</p>
        </div>
      ) : (
        <>
          <div className="craft-filter-bar">
            <div className="craft-search-wrap">
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="craft-search-icon" width="14" height="14">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="search"
                className="craft-search-input"
                placeholder="Filter materials…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="craft-inventory-grid">
            {filtered.map(({ id, name }) => {
              const qty = inventory[id] ?? 0;
              const agg = needed.find((m) => m.cost_id === id);
              const short = agg && qty < agg.needed;
              return (
                <div key={id} className={`craft-inv-row${short ? " craft-inv-row--short" : ""}`}>
                  <span className="craft-inv-name">{name}</span>
                  {agg && (
                    <span className="craft-muted craft-cell-mono craft-inv-need">
                      / {agg.needed.toFixed(2)}
                    </span>
                  )}
                  <input
                    type="number"
                    className="craft-inv-input"
                    min={0}
                    step={0.01}
                    value={qty || ""}
                    placeholder="0"
                    onChange={(e) => onSetAmount(id, parseFloat(e.target.value) || 0)}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
