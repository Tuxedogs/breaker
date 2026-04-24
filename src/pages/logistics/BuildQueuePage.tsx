import { Link } from 'react-router-dom';
import type { ItemCategory } from '../../data/models';
import { mockBuildQueue, mockInventory, mockRecipes, mockMaterials } from '../../data/mock/logistics';
import { computeShortages } from '../../lib/logistics/shortages';
import BuildQueueGroup from '../../components/logistics/BuildQueueGroup';

export default function BuildQueuePage() {
  const shortages = computeShortages(mockInventory, mockBuildQueue, mockRecipes);

  // Group by category, sorted by priority within each group
  const grouped = mockBuildQueue.reduce<Partial<Record<ItemCategory, typeof mockBuildQueue>>>(
    (acc, item) => {
      (acc[item.category] ??= []).push(item);
      return acc;
    },
    {},
  );
  for (const items of Object.values(grouped)) {
    items?.sort((a, b) => a.priority - b.priority);
  }
  const categories = Object.keys(grouped) as ItemCategory[];

  return (
    <div className="logi-page">
      <div className="logi-page-header">
        <div>
          <div className="logi-breadcrumb">
            <Link to="/logistics" className="logi-breadcrumb-link">Logistics</Link>
            <span className="logi-breadcrumb-sep">/</span>
            <span className="logi-breadcrumb-active">Build Queue</span>
          </div>
          <h1 className="logi-page-title">Build Queue</h1>
          <p className="logi-page-subtitle">
            {mockBuildQueue.length} items · {shortages.length} material {shortages.length === 1 ? 'shortage' : 'shortages'}
          </p>
        </div>
      </div>

      {/* Shortages */}
      <div className="logi-shortage-section">
        <div className="logi-shortage-header">
          <span className="logi-shortage-title">Material Shortages</span>
          {shortages.length > 0 && (
            <span className="logi-shortage-alert-count">{shortages.length} materials</span>
          )}
        </div>
        {shortages.length === 0 ? (
          <div className="logi-shortage-no-items">
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            All materials covered for active builds.
          </div>
        ) : (
          <table className="logi-shortage-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Have</th>
                <th>Needed</th>
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
        )}
      </div>

      {/* Queue by category */}
      <div className="logi-bq-section">
        <div className="logi-section-label">Queue by Category</div>
        {categories.map((cat) => (
          <BuildQueueGroup
            key={cat}
            category={cat}
            items={grouped[cat] ?? []}
          />
        ))}
      </div>
    </div>
  );
}
