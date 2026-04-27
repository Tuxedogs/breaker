import type { InventoryEntry, Location, Material } from '../../data/models';
import { formatQuantity } from '../../lib/logistics/inventory';

interface Props {
  entries: InventoryEntry[];
  materials: Material[];
  locations: Location[];
  onEdit: (entry: InventoryEntry) => void;
  onDelete: (id: string) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function InventoryTable({ entries, materials, locations, onEdit, onDelete }: Props) {
  if (entries.length === 0) {
    return (
      <div className="logi-empty">
        <svg className="logi-empty-icon" aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        No entries match the current filters.
      </div>
    );
  }

  return (
    <div className="logi-table-wrap">
      <table className="logi-table">
        <thead>
          <tr>
            <th>Material</th>
            <th>Qty</th>
            <th>Quality</th>
            <th>Location</th>
            <th>Container</th>
            <th>Updated</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const material = materials.find((item) => item.id === entry.materialId);
            const location = locations.find((item) => item.id === entry.locationId);
            const materialName = material?.name ?? entry.materialId;
            return (
              <tr key={entry.id}>
                <td>
                  <div className="logi-mat-cell">
                    <span className="logi-mat-dot" aria-hidden />
                    {materialName}
                  </div>
                </td>
                <td className="logi-qty-cell">{formatQuantity(entry.quantity, material)}</td>
                <td><span className="logi-quality-pill">Q{entry.quality}</span></td>
                <td>{location?.name ?? entry.locationId}</td>
                <td className="logi-muted-cell">{entry.containerName ?? '-'}</td>
                <td className="logi-muted-cell">{formatDate(entry.updatedAt)}</td>
                <td>
                  <div className="logi-table-actions">
                    <button type="button" className="logi-action-btn" onClick={() => onEdit(entry)} aria-label={`Edit ${materialName}`}>
                      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button type="button" className="logi-action-btn logi-action-btn--delete" onClick={() => onDelete(entry.id)} aria-label={`Delete ${materialName}`}>
                      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
