import { useMemo } from "react";
import type { ComponentRecipe, MaterialDemandEntry } from "../utils/craftingTypes";
import { computeMaterialDemand } from "../utils/craftingCalculations";

interface Props {
  recipes: ComponentRecipe[];
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="craft-bar-track">
      <div className="craft-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

function DemandTable({
  rows,
  valueKey,
  valueLabel,
  max,
  fmt,
}: {
  rows: MaterialDemandEntry[];
  valueKey: keyof MaterialDemandEntry;
  valueLabel: string;
  max: number;
  fmt: (v: MaterialDemandEntry) => string;
}) {
  return (
    <table className="craft-table">
      <thead>
        <tr>
          <th>Material</th>
          <th>{valueLabel}</th>
          <th style={{ width: "120px" }}></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.cost_id} className="craft-table-row">
            <td className="craft-cell-name">{r.material_name}</td>
            <td className="craft-cell-mono">{fmt(r)}</td>
            <td><Bar value={r[valueKey] as number} max={max} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function MaterialDemandAnalytics({ recipes }: Props) {
  const demand = useMemo(() => computeMaterialDemand(recipes), [recipes]);

  const topByQuantity = demand.slice(0, 10);
  const topByRecipes = [...demand].sort((a, b) => b.recipe_count - a.recipe_count).slice(0, 10);
  const topBySpread = [...demand].sort((a, b) => b.component_types.length - a.component_types.length).slice(0, 10);

  const maxQty = topByQuantity[0]?.total_quantity ?? 1;
  const maxRec = topByRecipes[0]?.recipe_count ?? 1;

  return (
    <div className="craft-section">
      <div className="craft-section-header">
        <span className="craft-section-title">Material Demand Analytics</span>
        <span className="craft-count">{demand.length} materials across {recipes.length} recipes</span>
      </div>

      <div className="craft-analytics-grid">
        <div className="craft-analytics-card">
          <div className="craft-analytics-card-title">Top by Total Quantity Required</div>
          <div className="craft-table-wrap">
            <DemandTable
              rows={topByQuantity}
              valueKey="total_quantity"
              valueLabel="Total Qty"
              max={maxQty}
              fmt={(r) => r.total_quantity.toFixed(2)}
            />
          </div>
        </div>

        <div className="craft-analytics-card">
          <div className="craft-analytics-card-title">Top by Recipe Appearances</div>
          <div className="craft-table-wrap">
            <DemandTable
              rows={topByRecipes}
              valueKey="recipe_count"
              valueLabel="Recipes"
              max={maxRec}
              fmt={(r) => `${r.recipe_count}`}
            />
          </div>
        </div>

        <div className="craft-analytics-card">
          <div className="craft-analytics-card-title">Top by Component Type Spread</div>
          <div className="craft-table-wrap">
            <table className="craft-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Types</th>
                  <th>Used In</th>
                </tr>
              </thead>
              <tbody>
                {topBySpread.map((r) => (
                  <tr key={r.cost_id} className="craft-table-row">
                    <td className="craft-cell-name">{r.material_name}</td>
                    <td className="craft-cell-mono">{r.component_types.length}</td>
                    <td>
                      <div className="craft-type-tags">
                        {r.component_types.map((t) => (
                          <span key={t} className="craft-badge craft-badge--type craft-badge--sm">{t}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
