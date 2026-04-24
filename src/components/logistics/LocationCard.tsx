import type { InventoryEntry, Material, Location, LocationType } from '../../data/models';

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
  const here = inventory.filter((e) => e.locationId === location.id);

  // Sum quantities per material
  const totals: Record<string, number> = {};
  for (const entry of here) {
    totals[entry.materialId] = (totals[entry.materialId] ?? 0) + entry.quantity;
  }

  const rows = Object.entries(totals).map(([materialId, qty]) => ({
    material: materials.find((m) => m.id === materialId),
    qty,
    materialId,
  }));

  const totalSCU = here
    .filter((e) => materials.find((m) => m.id === e.materialId)?.unitType === 'SCU')
    .reduce((sum, e) => sum + e.quantity, 0);

  return (
    <div className="logi-location-card">
      <div className="logi-location-card-header">
        <div>
          <div className="logi-location-name">{location.name}</div>
          <div className="logi-location-meta">{location.system} · {TYPE_LABELS[location.type]}</div>
        </div>
        <div className="logi-location-header-right">
          <span className={`logi-badge logi-badge--${location.type}`}>{TYPE_LABELS[location.type]}</span>
          {totalSCU > 0 && (
            <span className="logi-location-scu">{totalSCU.toFixed(2)} SCU</span>
          )}
        </div>
      </div>

      <div className="logi-location-card-body">
        {rows.length === 0 ? (
          <div className="logi-location-empty">No inventory recorded</div>
        ) : (
          rows.map(({ material, qty, materialId }) => {
            const unit = material?.unitType ?? 'units';
            const qtyStr = unit === 'count' ? `${qty}×` : `${qty.toFixed(2)} ${unit}`;
            return (
              <div key={materialId} className="logi-location-material-row">
                <span className="logi-mat-dot" aria-hidden />
                <span className="logi-location-material-name">{material?.name ?? materialId}</span>
                <span className="logi-location-material-qty">{qtyStr}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
