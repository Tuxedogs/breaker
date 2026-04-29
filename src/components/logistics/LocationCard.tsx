import { Link } from 'react-router-dom';
import type { InventoryEntry, InventoryLocation, MaterialTemplate } from '../../types/logistics';
import { formatQuantity } from '../../lib/logistics/inventory';
import { getInventoryByMaterial, getLocationInventorySummary } from '../../lib/logistics/selectors';

interface Props {
  location: InventoryLocation;
  inventory: InventoryEntry[];
  materials: MaterialTemplate[];
}

const TYPE_LABELS: Record<string, string> = {
  station: 'Station',
  city: 'City',
  outpost: 'Outpost',
  ship: 'Ship',
};

export default function LocationCard({ location, inventory, materials }: Props) {
  const summary = getLocationInventorySummary(location, inventory);
  const materialGroups = getInventoryByMaterial(summary.entries, materials);
  const materialTotals = Array.from(materialGroups.values());
  const locationType = location.type ?? location.category ?? 'station';
  const locationTypeLabel = TYPE_LABELS[locationType] ?? location.category ?? 'Location';
  const locationMeta = location.system ? `${location.system} / ${locationTypeLabel}` : locationTypeLabel;
  const highestMaterial = summary.bestQualityStack
    ? materials.find((material) => material.id === summary.bestQualityStack?.materialId)
    : undefined;

  return (
    <Link to={`/logistics/locations/${location.id}`} className="logi-location-card">
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
            <strong>{summary.bestQualityStack ? `Q${summary.bestQualityStack.quality ?? 0}` : '-'}</strong>
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
              <span className="logi-location-material-qty">{formatQuantity(totalQuantity, material)}</span>
            </div>
          ))
        )}
      </div>
    </Link>
  );
}
