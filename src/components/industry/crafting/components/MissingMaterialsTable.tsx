import type { AggregatedMaterial } from "../utils/craftingTypes";

interface Props {
  materials: AggregatedMaterial[];
}

export default function MissingMaterialsTable({ materials }: Props) {
  const hasMissing = materials.some((m) => m.missing > 0);

  if (materials.length === 0) {
    return (
      <div className="craft-section">
        <div className="craft-section-header">
          <span className="craft-section-title">Missing Materials</span>
        </div>
        <div className="craft-empty-state">
          <p>Add components to the build queue to calculate material requirements.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="craft-section">
      <div className="craft-section-header">
        <span className="craft-section-title">Missing Materials</span>
        {hasMissing ? (
          <span className="craft-badge craft-badge--alert">
            {materials.filter((m) => m.missing > 0).length} short
          </span>
        ) : (
          <span className="craft-badge craft-badge--ok">All covered</span>
        )}
      </div>

      <div className="craft-table-wrap">
        <table className="craft-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Owned</th>
              <th>Needed</th>
              <th>Missing</th>
            </tr>
          </thead>
          <tbody>
            {materials
              .sort((a, b) => b.missing - a.missing)
              .map((m) => (
                <tr
                  key={m.cost_id}
                  className={`craft-table-row${m.missing > 0 ? " craft-table-row--alert" : ""}`}
                >
                  <td className="craft-cell-name">{m.material_name}</td>
                  <td className="craft-cell-mono">{m.owned.toFixed(2)}</td>
                  <td className="craft-cell-mono">{m.needed.toFixed(2)}</td>
                  <td className="craft-cell-mono">
                    {m.missing > 0 ? (
                      <span className="craft-shortage">−{m.missing.toFixed(2)}</span>
                    ) : (
                      <span className="craft-ok">✓</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
