import { Link } from 'react-router-dom';
import { mockInventory, mockLocations, mockBuildQueue, mockMaterials, mockRecipes } from '../../data/mock/logistics';
import { computeShortages } from '../../lib/logistics/shortages';

export default function LogisticsPage() {
  const shortages = computeShortages(mockInventory, mockBuildQueue, mockRecipes);

  const activeQueueCount = mockBuildQueue.filter(
    (i) => i.status !== 'complete' && i.status !== 'cancelled',
  ).length;

  const totalSCU = mockInventory
    .filter((e) => mockMaterials.find((m) => m.id === e.materialId)?.unitType === 'SCU')
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
          <div className="logi-stat-value">{mockMaterials.length}</div>
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
          <div className="logi-stat-value">{mockLocations.length}</div>
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
          <div className="logi-nav-card-count">{mockInventory.length} entries</div>
        </Link>

        <Link to="/logistics/locations" className="logi-nav-card">
          <div className="logi-nav-card-icon">
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
            </svg>
          </div>
          <div className="logi-nav-card-label">Locations</div>
          <div className="logi-nav-card-count">{mockLocations.length} active</div>
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

        <div className="logi-nav-card logi-nav-card--wip">
          <div className="logi-nav-card-icon logi-nav-card-icon--wip">
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <path d="M14.5 4l5.5 5.5-11 11L3.5 15 14.5 4zM9 9l6 6" />
            </svg>
          </div>
          <div className="logi-nav-card-label">Mining Planner</div>
          <div className="logi-nav-card-count logi-nav-card-count--wip">Coming soon</div>
        </div>
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
                const mat = mockMaterials.find((m) => m.id === s.materialId);
                const unit = mat?.unitType ?? 'units';
                const fmt = (n: number) => unit === 'count' ? `${n}×` : `${n.toFixed(2)} ${unit}`;
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
