import { useState, useMemo, Fragment } from "react";
import type { QualityModifier } from "../utils/craftingTypes";
import { getComponentDisplayName } from "../utils/componentDisplayNames";
import { formatProperty, modifierValueAt } from "../utils/qualityModifiers";
import qualityRaw from "../data/quality-modifiers.json";

const ALL_MODIFIERS = qualityRaw as QualityModifier[];

const COMPONENT_TYPES = [
  "cooler", "mininglaser", "powerplant", "quantumdrive",
  "radar", "salvage", "shield", "tractorbeam", "weapons",
];

// -- Per-component group -----------------------------------------------

interface ComponentGroup {
  component_name: string;
  component_type: string;
  size: string;
  display_name: string;
  property_count: number;
  modifiers: QualityModifier[];
  effect_min: number;
  effect_max: number;
}

function buildGroups(modifiers: QualityModifier[]): ComponentGroup[] {
  const map = new Map<string, ComponentGroup>();

  for (const m of modifiers) {
    let g = map.get(m.component_name);
    if (!g) {
      g = {
        component_name: m.component_name,
        component_type: m.component_type,
        size: m.size,
        display_name: getComponentDisplayName(m.component_name),
        property_count: 0,
        modifiers: [],
        effect_min: Infinity,
        effect_max: -Infinity,
      };
      map.set(m.component_name, g);
    }
    g.modifiers.push(m);
    if (m.modifier_start_percent < g.effect_min) g.effect_min = m.modifier_start_percent;
    if (m.modifier_end_percent < g.effect_min) g.effect_min = m.modifier_end_percent;
    if (m.modifier_start_percent > g.effect_max) g.effect_max = m.modifier_start_percent;
    if (m.modifier_end_percent > g.effect_max) g.effect_max = m.modifier_end_percent;
  }

  for (const g of map.values()) {
    const props = new Set(g.modifiers.map((m) => `${m.slot}||${m.gameplay_property}`));
    g.property_count = props.size;
    if (!isFinite(g.effect_min)) g.effect_min = 0;
    if (!isFinite(g.effect_max)) g.effect_max = 0;
  }

  return Array.from(map.values()).sort((a, b) =>
    a.display_name.localeCompare(b.display_name)
  );
}

// -- Expanded property detail -----------------------------------------

function ComponentModifierDetail({ group }: { group: ComponentGroup }) {
  const byProp = new Map<string, QualityModifier[]>();
  for (const m of group.modifiers) {
    const key = `${m.slot}||${m.gameplay_property}`;
    const arr = byProp.get(key) ?? [];
    arr.push(m);
    byProp.set(key, arr);
  }

  return (
    <div className="craft-qmod-detail">
      <table className="craft-table craft-table--detail">
        <thead>
          <tr>
            <th>Slot</th>
            <th>Property</th>
            <th>At 0</th>
            <th>At 500</th>
            <th>At 1000</th>
          </tr>
        </thead>
        <tbody>
          {Array.from(byProp.entries()).map(([key, rows]) => {
            const first = rows[0];
            const v0 = modifierValueAt(rows, first.gameplay_property, first.slot, 0);
            const v500 = modifierValueAt(rows, first.gameplay_property, first.slot, 500);
            const v1000 = modifierValueAt(rows, first.gameplay_property, first.slot, 1000);
            const neg = (v: string) => v.startsWith("-");
            return (
              <tr key={key} className="craft-table-row">
                <td>
                  <span className="craft-badge craft-badge--slot craft-badge--sm">
                    {first.slot}
                  </span>
                </td>
                <td className="craft-cell-property">{formatProperty(first.gameplay_property)}</td>
                <td className={`craft-cell-mono ${neg(v0) ? "craft-shortage" : "craft-ok"}`}>{v0}</td>
                <td className={`craft-cell-mono ${neg(v500) ? "craft-shortage" : "craft-muted"}`}>{v500}</td>
                <td className={`craft-cell-mono ${neg(v1000) ? "craft-shortage" : "craft-ok"}`}>{v1000}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// -- Main viewer -------------------------------------------------------

export default function QualityModifierViewer() {
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const groups = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = ALL_MODIFIERS.filter((m) => {
      if (typeFilter && m.component_type !== typeFilter) return false;
      if (q) {
        const dn = getComponentDisplayName(m.component_name).toLowerCase();
        if (!dn.includes(q) && !m.component_name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    return buildGroups(filtered);
  }, [typeFilter, search]);

  return (
    <div className="craft-section">
      <div className="craft-section-header">
        <span className="craft-section-title">Quality Modifiers</span>
        <span className="craft-count">{groups.length} components</span>
      </div>

      <div className="craft-filter-bar">
        <div className="craft-search-wrap">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="craft-search-icon"
            width="14"
            height="14"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            className="craft-search-input"
            placeholder="Search component name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="craft-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          {COMPONENT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="craft-table-wrap">
        <table className="craft-table">
          <thead>
            <tr>
              <th>Component</th>
              <th>Type</th>
              <th>Size</th>
              <th>Properties</th>
              <th>Effect Range</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const isOpen = expanded === group.component_name;
              return (
                <Fragment key={group.component_name}>
                  <tr
                    className={`craft-table-row${isOpen ? " craft-table-row--open" : ""}`}
                    style={{ cursor: "pointer" }}
                    onClick={() => setExpanded(isOpen ? null : group.component_name)}
                  >
                    <td className="craft-cell-name" title={group.component_name}>
                      {group.display_name}
                    </td>
                    <td>
                      <span className="craft-badge craft-badge--type">
                        {group.component_type}
                      </span>
                    </td>
                    <td>
                      <span className="craft-badge craft-badge--size">
                        {group.size || "---"}
                      </span>
                    </td>
                    <td className="craft-cell-mono">{group.property_count}</td>
                    <td className="craft-cell-mono">
                      <span className={group.effect_min < 0 ? "craft-shortage" : "craft-ok"}>
                        {group.effect_min >= 0 ? "+" : ""}{group.effect_min.toFixed(1)}%
                      </span>
                      {" to "}
                      <span className={group.effect_max >= 0 ? "craft-ok" : "craft-shortage"}>
                        {group.effect_max >= 0 ? "+" : ""}{group.effect_max.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="craft-detail-row">
                      <td colSpan={5}>
                        <ComponentModifierDetail group={group} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {groups.length === 0 && (
              <tr>
                <td colSpan={5} className="craft-empty">
                  No modifiers match filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
