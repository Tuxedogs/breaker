import { useState } from 'react';
import { Link } from 'react-router-dom';
import BuildQueueGroup from '../../components/logistics/BuildQueueGroup';
import { mockBuildQueue, mockInventory, mockLocations, mockMaterials, mockRecipes } from '../../data/mock/logistics';
import type { ItemCategory } from '../../data/models';
import { computeShortages } from '../../lib/logistics/shortages';
import type { SourceStrategy } from '../../lib/logistics/inventory';

const SOURCE_OPTIONS: Array<{ id: SourceStrategy; label: string }> = [
  { id: 'nearest', label: 'Nearest / single location mats' },
  { id: 'highest-quality', label: 'Highest quality mats' },
  { id: 'minimize-splits', label: 'Minimize split locations' },
];

export default function BuildQueuePage() {
  const [sourceStrategy, setSourceStrategy] = useState<SourceStrategy>('minimize-splits');
  const shortages = computeShortages(mockInventory, mockBuildQueue, mockRecipes);
  const grouped = mockBuildQueue.reduce<Partial<Record<ItemCategory, typeof mockBuildQueue>>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  for (const items of Object.values(grouped)) items?.sort((a, b) => a.priority - b.priority);
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
            {mockBuildQueue.length} items / {shortages.length} material {shortages.length === 1 ? 'shortage' : 'shortages'}
          </p>
        </div>
      </div>

      <div className="logi-strategy-bar" aria-label="Material source optimization">
        {SOURCE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`logi-strategy-btn${sourceStrategy === option.id ? ' logi-strategy-btn--active' : ''}`}
            onClick={() => setSourceStrategy(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="logi-shortage-section">
        <div className="logi-shortage-header">
          <span className="logi-shortage-title">Material Shortages</span>
          {shortages.length > 0 && <span className="logi-shortage-alert-count">{shortages.length} materials</span>}
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
              {shortages.map((shortage) => {
                const material = mockMaterials.find((item) => item.id === shortage.materialId);
                const fmt = (quantity: number) => material?.unitType === 'count' ? `${quantity}x` : `${quantity.toFixed(2)} ${material?.unitType ?? 'units'}`;
                return (
                  <tr key={shortage.materialId}>
                    <td>{material?.name ?? shortage.materialId}</td>
                    <td>{fmt(shortage.have)}</td>
                    <td>{fmt(shortage.needed)}</td>
                    <td><span className="logi-badge logi-badge--shortage">-{fmt(shortage.shortfall)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="logi-bq-section">
        <div className="logi-section-label">Queue by Category</div>
        {categories.map((category) => (
          <BuildQueueGroup
            key={category}
            category={category}
            items={grouped[category] ?? []}
            recipes={mockRecipes}
            inventory={mockInventory}
            materials={mockMaterials}
            locations={mockLocations}
            strategy={sourceStrategy}
          />
        ))}
      </div>
    </div>
  );
}
