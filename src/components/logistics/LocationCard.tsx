import { Link } from 'react-router-dom';
import type { InventoryEntry, Location, LocationType, Material } from '../../data/models';
import { formatQuantity, summarizeLocation } from '../../lib/logistics/inventory';

interface Props {
  location: Location;
  inventory: InventoryEntry[];
  materials: Material[];
}

const TYPE_LABELS: Record<LocationType, string> = {
  station: 'Station',
  city: 'City',
  outpost: 'Outpost',
  ship: 'Ship',
};

export default function LocationCard({ location, inventory, materials }: Props) {
  const summary = summarizeLocation(location, inventory, materials);
  const highestMaterial = summary.highestStack
    ? materials.find((material) => material.id === summary.highestStack?.materialId)
    : undefined;

  return (
    <Link to={`/logistics/locations/${location.id}`} className="logi-location-card">
      <div className="logi-location-card-header">
        <div>
          <div className="logi-location-name">{location.name}</div>
          <div className="logi-location-meta">{location.system} / {TYPE_LABELS[location.type]}</div>
        </div>
        <div className="logi-location-header-right">
          <span className={`logi-badge logi-badge--${location.type}`}>{TYPE_LABELS[location.type]}</span>
          <span className="logi-location-scu">{formatQuantity(summary.totalQuantity, undefined)}</span>
        </div>
      </div>

      <div className="logi-location-card-body">
        <div className="logi-location-metrics">
          <div>
            <span className="logi-stat-label">Unique Materials</span>
            <strong>{summary.uniqueMaterials}</strong>
          </div>
          <div>
            <span className="logi-stat-label">Highest Stack</span>
            <strong>{summary.highestStack ? `Q${summary.highestStack.quality}` : '-'}</strong>
          </div>
        </div>
        {summary.highestStack && (
          <div className="logi-location-feature">
            <span>{highestMaterial?.name ?? summary.highestStack.materialId}</span>
            <span>{formatQuantity(summary.highestStack.quantity, highestMaterial)}</span>
          </div>
        )}
        {summary.materialTotals.length === 0 ? (
          <div className="logi-location-empty">No inventory recorded</div>
        ) : (
          summary.materialTotals.slice(0, 4).map(({ material, quantity, materialId }) => (
            <div key={materialId} className="logi-location-material-row">
              <span className="logi-mat-dot" aria-hidden />
              <span className="logi-location-material-name">{material?.name ?? materialId}</span>
              <span className="logi-location-material-qty">{formatQuantity(quantity, material)}</span>
            </div>
          ))
        )}
      </div>
    </Link>
  );
}
