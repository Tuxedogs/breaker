import { Link } from 'react-router-dom';
import '../../components/logistics/logistics.css';
import { useLogisticsStore } from '../../stores/logisticsStore';
import { getInventoryUnitLabel } from '../../lib/logistics/inventory';
import { getBuildQueueShortageSummary } from '../../lib/logistics/selectors';

export default function LogisticsPage() {
  const inventoryEntries = useLogisticsStore((state) => state.inventoryEntries);
  const locations = useLogisticsStore((state) => state.locations);
  const buildQueue = useLogisticsStore((state) => state.buildQueue);
  const materialTemplates = useLogisticsStore((state) => state.materialTemplates);
  const recipeTemplates = useLogisticsStore((state) => state.recipeTemplates);
  const recipeInputTemplates = useLogisticsStore((state) => state.recipeInputTemplates);
  const shortageSummary = getBuildQueueShortageSummary(inventoryEntries, buildQueue, recipeTemplates, recipeInputTemplates);
  const shortages = shortageSummary.shortages;
  const activeQueueCount = shortageSummary.activeQueueItems.length;

  const totalSCU = inventoryEntries
    .filter((e) => getInventoryUnitLabel(materialTemplates.find((m) => m.id === e.materialId)) === 'SCU')
    .reduce((sum, e) => sum + e.quantity, 0);

  return (
    <div className="logi-page">
      <div className="logi-page-header">
        <div>
          <div className="logi-breadcrumb">
            <span className="logi-breadcrumb-active">Logistics</span>
          </div>
          <h1 className="logi-page-title">Logistics Hub</h1>
          <p className="logi-page-subtitle">Inventory, locations, and build operations.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="logi-stats-row">
        <div className="logi-stat-card">
          <div className="logi-stat-label">Materials Tracked</div>
          <div className="logi-stat-value">{materialTemplates.length}</div>
        </div>
        <div className="logi-stat-card">
          <div className="logi-stat-label">Total Stored</div>
          <div className="logi-stat-value">
            {totalSCU.toFixed(2)}
            <span className="logi-stat-unit">SCU</span>
          </div>
        </div>
        <div className="logi-stat-card">
          <div className="logi-stat-label">Active Locations</div>
          <div className="logi-stat-value">{locations.length}</div>
        </div>
        <div className={`logi-stat-card${shortages.length > 0 ? ' logi-stat-card--alert' : ''}`}>
          <div className="logi-stat-label">Shortages</div>
          <div className={`logi-stat-value${shortages.length > 0 ? ' logi-stat-value--shortage' : ''}`}>
            {shortages.length}
          </div>
        </div>
      </div>

      {/* Nav cards */}
      <div className="logi-nav-grid">
        <Link to="/logistics/inventory" className="logi-nav-card">
          <div className="logi-nav-card-icon">
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-4 5h4m-4 4h8" />
            </svg>
          </div>
          <div className="logi-nav-card-label">Inventory</div>
          <div className="logi-nav-card-count">{inventoryEntries.length} entries</div>
        </Link>

        <Link to="/logistics/locations" className="logi-nav-card">
          <div className="logi-nav-card-icon">
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
            </svg>
          </div>
          <div className="logi-nav-card-label">Locations</div>
          <div className="logi-nav-card-count">{locations.length} active</div>
        </Link>

        <Link to="/logistics/build-queue" className="logi-nav-card">
          <div className="logi-nav-card-icon">
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
          </div>
          <div className="logi-nav-card-label">Build Queue</div>
          <div className="logi-nav-card-count">{activeQueueCount} active</div>
        </Link>

        <Link to="/logistics/refinery-import" className="logi-nav-card">
          <div className="logi-nav-card-icon">
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <path d="M4 16l4-4 4 4 4-8 4 4M2 20h20" />
            </svg>
          </div>
          <div className="logi-nav-card-label">Refinery Import</div>
          <div className="logi-nav-card-count">Screenshot → inventory</div>
        </Link>
      </div>

      {/* Shortages quick view */}
      {shortages.length > 0 && (
        <div className="logi-shortage-section">
          <div className="logi-shortage-header">
            <span className="logi-shortage-title">Active Shortages</span>
            <span className="logi-shortage-alert-count">{shortages.length} materials</span>
          </div>
          <table className="logi-shortage-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Have</th>
                <th>Need</th>
                <th>Shortfall</th>
              </tr>
            </thead>
            <tbody>
              {shortages.map((s) => {
                const mat = materialTemplates.find((m) => m.id === s.materialId);
                const unit = getInventoryUnitLabel(mat);
                const fmt = (n: number) => unit === 'unit' ? `${n}` : `${n.toFixed(2)} ${unit}`;
                return (
                  <tr key={s.materialId}>
                    <td>{mat?.name ?? s.materialId}</td>
                    <td>{fmt(s.have)}</td>
                    <td>{fmt(s.needed)}</td>
                    <td>
                      <span className="logi-badge logi-badge--shortage">−{fmt(s.shortfall)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
