import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import LocationCard from '../../components/logistics/LocationCard';
import { mockInventory as initialInventory, mockLocations, mockMaterials } from '../../data/mock/logistics';
import InventoryEntryPanel from '../../components/logistics/InventoryEntryPanel';
import {
  formatQuantity,
  getGlobalTopQualityMaterials,
  getMaterialBreakdown,
  getPremiumStacks,
  summarizeLocation,
} from '../../lib/logistics/inventory';
import type { InventoryEntry } from '../../data/models';

type PanelState = { mode: 'new' } | { mode: 'edit'; entry: InventoryEntry };

function formatUpdatedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function LocationsPage() {
  const { locationId } = useParams();
  const selectedLocation = mockLocations.find((location) => location.id === locationId);
  const [entries, setEntries] = useState<InventoryEntry[]>(initialInventory);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const topQuality = useMemo(() => getGlobalTopQualityMaterials(entries, mockMaterials).slice(0, 5), [entries]);
  const premiumStacks = useMemo(() => getPremiumStacks(entries, mockMaterials, mockLocations), [entries]);
  const breakdown = useMemo(() => getMaterialBreakdown(entries, mockMaterials, mockLocations), [entries]);
  const editingEntry = panel?.mode === 'edit' ? panel.entry : null;

  function handleSave(updatedEntries: InventoryEntry[]) {
    setEntries((prev) => {
      return updatedEntries.reduce((next, updated) => {
        const exists = next.some((entry) => entry.id === updated.id);
        return exists ? next.map((entry) => (entry.id === updated.id ? updated : entry)) : [...next, updated];
      }, prev);
    });
    setPanel(null);
  }

  function handleDelete(id: string) {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
    if (panel?.mode === 'edit' && panel.entry.id === id) setPanel(null);
  }

  if (selectedLocation) {
    const summary = summarizeLocation(selectedLocation, entries, mockMaterials);
    return (
      <div className="logi-page">
        <div className="logi-page-header">
          <div>
            <div className="logi-breadcrumb">
              <Link to="/logistics" className="logi-breadcrumb-link">Logistics</Link>
              <span className="logi-breadcrumb-sep">/</span>
              <Link to="/logistics/locations" className="logi-breadcrumb-link">Locations</Link>
              <span className="logi-breadcrumb-sep">/</span>
              <span className="logi-breadcrumb-active">{selectedLocation.name}</span>
            </div>
            <h1 className="logi-page-title">{selectedLocation.name}</h1>
            <p className="logi-page-subtitle">{summary.uniqueMaterials} materials / {formatQuantity(summary.totalQuantity, undefined)} stored</p>
          </div>
          <button
            type="button"
            className="logi-btn-primary"
            onClick={() => setPanel({ mode: 'new' })}
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Entry
          </button>
        </div>

        <div className={`logi-inv-layout${panel ? ' logi-inv-layout--panel-open' : ''}`}>
          <div className="logi-inv-table-col">
            <div className="logi-shortage-section">
              <div className="logi-shortage-header">
                <span className="logi-shortage-title">Location Inventory</span>
                {summary.highestStack && <span className="logi-shortage-alert-count">Highest Q{summary.highestStack.quality}</span>}
              </div>
              <table className="logi-shortage-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Qty</th>
                    <th>Quality</th>
                    <th>Container</th>
                    <th>Updated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {summary.entries.map((entry) => {
                    const material = mockMaterials.find((item) => item.id === entry.materialId);
                    const materialName = material?.name ?? entry.materialId;
                    return (
                      <tr key={entry.id}>
                        <td>{materialName}</td>
                        <td>{formatQuantity(entry.quantity, material)}</td>
                        <td><span className="logi-quality-pill">Q{entry.quality}</span></td>
                        <td>{entry.containerName ?? '-'}</td>
                        <td>{formatUpdatedDate(entry.updatedAt)}</td>
                        <td>
                          <div className="logi-table-actions">
                            <button type="button" className="logi-action-btn" onClick={() => setPanel({ mode: 'edit', entry })} aria-label={`Edit ${materialName}`}>
                              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button type="button" className="logi-action-btn logi-action-btn--delete" onClick={() => handleDelete(entry.id)} aria-label={`Delete ${materialName}`}>
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
          </div>
          <div className="logi-inv-panel-col">
            {panel && (
              <InventoryEntryPanel
                key={panel.mode === 'edit' ? panel.entry.id : 'new'}
                entry={editingEntry}
                materials={mockMaterials}
                locations={mockLocations}
                onSave={handleSave}
                onCancel={() => setPanel(null)}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="logi-page">
      <div className="logi-page-header">
        <div>
          <div className="logi-breadcrumb">
            <Link to="/logistics" className="logi-breadcrumb-link">Logistics</Link>
            <span className="logi-breadcrumb-sep">/</span>
            <span className="logi-breadcrumb-active">Locations</span>
          </div>
          <h1 className="logi-page-title">Locations</h1>
          <p className="logi-page-subtitle">Location-based inventory control with quality-aware stack visibility.</p>
        </div>
        <button
          type="button"
          className="logi-btn-primary"
          onClick={() => setPanel({ mode: 'new' })}
        >
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Entry
        </button>
      </div>

      <div className={`logi-inv-layout${panel ? ' logi-inv-layout--panel-open' : ''}`}>
        <div className="logi-inv-table-col logi-location-content-col">
          <div className="logi-location-grid">
            {mockLocations.map((location) => (
              <LocationCard key={location.id} location={location} inventory={entries} materials={mockMaterials} />
            ))}
          </div>

          <div className="logi-insight-grid">
            <section className="logi-shortage-section">
              <div className="logi-shortage-header">
                <span className="logi-shortage-title">Global Top-Quality Materials</span>
              </div>
              <div className="logi-stack-list">
                {topQuality.map(({ entry, material }) => {
                  const location = mockLocations.find((item) => item.id === entry.locationId);
                  return (
                    <div key={entry.id} className="logi-stack-row">
                      <span>{material?.name ?? entry.materialId}</span>
                      <strong>Q{entry.quality}</strong>
                      <span>{location?.name ?? entry.locationId}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="logi-shortage-section logi-premium-widget">
              <div className="logi-shortage-header">
                <span className="logi-shortage-title">Premium Stash Q900+</span>
                <span className="logi-shortage-alert-count">{premiumStacks.length} stacks</span>
              </div>
              <div className="logi-stack-list">
                {premiumStacks.map((stack) => (
                  <div key={stack.id} className="logi-stack-row">
                    <span>{stack.material?.name ?? stack.materialId}</span>
                    <strong>Q{stack.quality}</strong>
                    <span>{formatQuantity(stack.quantity, stack.material)} / {stack.location?.name ?? stack.locationId}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="logi-shortage-section">
            <div className="logi-shortage-header">
              <span className="logi-shortage-title">Per-Material Stack Breakdown</span>
            </div>
            <table className="logi-shortage-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Quality</th>
                  <th>Location</th>
                  <th>Qty</th>
                  <th>Container</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {breakdown.map((stack) => (
                  <tr key={stack.id}>
                    <td>{stack.material?.name ?? stack.materialId}</td>
                    <td><span className="logi-quality-pill">Q{stack.quality}</span></td>
                    <td>{stack.location?.name ?? stack.locationId}</td>
                    <td>{formatQuantity(stack.quantity, stack.material)}</td>
                    <td>{stack.containerName ?? '-'}</td>
                    <td>
                      <div className="logi-table-actions">
                        <button type="button" className="logi-action-btn" onClick={() => setPanel({ mode: 'edit', entry: stack })} aria-label={`Edit ${stack.material?.name ?? stack.materialId}`}>
                          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button type="button" className="logi-action-btn logi-action-btn--delete" onClick={() => handleDelete(stack.id)} aria-label={`Delete ${stack.material?.name ?? stack.materialId}`}>
                          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
        <div className="logi-inv-panel-col">
          {panel && (
            <InventoryEntryPanel
              key={panel.mode === 'edit' ? panel.entry.id : 'new'}
              entry={editingEntry}
              materials={mockMaterials}
              locations={mockLocations}
              onSave={handleSave}
              onCancel={() => setPanel(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
