import { Link } from 'react-router-dom';
import type { InventoryEntry, InventoryLocation, MaterialTemplate } from '../../types/logistics';
import { formatQuantity, materialTypeClass, rarityClass } from '../../lib/logistics/inventory';
import { getInventoryByMaterial, getLocationInventorySummary } from '../../lib/logistics/selectors';

interface Props {
  location: InventoryLocation;
  inventory: InventoryEntry[];
  materials: MaterialTemplate[];
  onEdit?: () => void;
  onDelete?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  station: 'Station',
  city: 'City',
  outpost: 'Outpost',
  ship: 'Ship',
};

export default function LocationCard({ location, inventory, materials, onEdit, onDelete }: Props) {
  const summary = getLocationInventorySummary(location, inventory);
  const materialGroups = getInventoryByMaterial(summary.entries, materials);
  const materialTotals = Array.from(materialGroups.values());
  const locationType = location.type ?? location.category ?? 'station';
  const locationTypeLabel = TYPE_LABELS[locationType] ?? location.category ?? 'Location';
  const locationMeta = location.system ? `${location.system} / ${locationTypeLabel}` : locationTypeLabel;
  const highestMaterial = summary.bestQualityStack
    ? materials.find((material) => material.id === summary.bestQualityStack?.materialId)
    : undefined;

  const cardBody = (
    <>
      <div className="logi-location-card-header">
        <div>
          <div className="logi-location-name">{location.name}</div>
          <div className="logi-location-meta">{locationMeta}</div>
        </div>
        <div className="logi-location-header-right">
          <span className={`logi-badge logi-badge--${locationType}`}>{locationTypeLabel}</span>
          <span className="logi-location-scu">{formatQuantity(summary.totalQuantity, undefined)}</span>
        </div>
      </div>

      <div className="logi-location-card-body">
        <div className="logi-location-metrics">
          <div>
            <span className="logi-stat-label">Unique Materials</span>
            <strong>{summary.materialCount}</strong>
          </div>
          <div>
            <span className="logi-stat-label">Highest Stack</span>
            <strong className={rarityClass(summary.bestQualityStack?.rarity)}>{summary.bestQualityStack ? summary.bestQualityStack.quality ?? 0 : '—'}</strong>
          </div>
        </div>
        {summary.bestQualityStack && (
          <div className="logi-location-feature">
            <span>{highestMaterial?.name ?? summary.bestQualityStack.materialId}</span>
            <span>{formatQuantity(summary.bestQualityStack.quantity, highestMaterial)}</span>
          </div>
        )}
        {materialTotals.length === 0 ? (
          <div className="logi-location-empty">No inventory recorded</div>
        ) : (
          materialTotals.slice(0, 4).map(({ material, totalQuantity, materialId }) => (
            <div key={materialId} className="logi-location-material-row">
              <span className="logi-mat-dot" aria-hidden />
              <span className="logi-location-material-name">{material?.name ?? materialId}</span>
              <span className={`logi-location-material-qty ${materialTypeClass(material)}`}>{formatQuantity(totalQuantity, material)}</span>
            </div>
          ))
        )}
      </div>
    </>
  );

  if (!onEdit && !onDelete) {
    return (
      <Link to={`/logistics/locations/${location.id}`} className="logi-location-card">
        {cardBody}
      </Link>
    );
  }

  return (
    <div className="logi-location-card-wrap">
      <Link to={`/logistics/locations/${location.id}`} className="logi-location-card">
        {cardBody}
      </Link>
      <div className="logi-location-card-footer">
        <Link
          to={`/logistics/locations/${location.id}`}
          style={{ fontSize: '0.68rem', color: 'rgba(160,180,220,0.35)', textDecoration: 'none', fontFamily: '"Share Tech Mono", monospace', letterSpacing: '0.08em' }}
        >
          VIEW →
        </Link>
        <div className="logi-table-actions">
          {onEdit && (
            <button type="button" className="logi-action-btn" onClick={onEdit} aria-label={`Edit ${location.name}`}>
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button type="button" className="logi-action-btn logi-action-btn--delete" onClick={onDelete} aria-label={`Delete ${location.name}`}>
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
