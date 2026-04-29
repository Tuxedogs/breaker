import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import LocationCard from '../../components/logistics/LocationCard';
import InventoryEntryPanel from '../../components/logistics/InventoryEntryPanel';
import { useLogisticsStore } from '../../stores/logisticsStore';
import { formatQuantity, getInventoryStacks } from '../../lib/logistics/inventory';
import {
  getBestAvailableStacksForMaterial,
  getInventoryByMaterial,
  getInventoryQualitySummary,
  getLocationInventorySummary,
} from '../../lib/logistics/selectors';
import type { InventoryEntry } from '../../types/logistics';

type PanelState = { mode: 'new' } | { mode: 'edit'; entry: InventoryEntry };

function formatUpdatedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function LocationsPage() {
  const { locationId } = useParams();
  const entries = useLogisticsStore((state) => state.inventoryEntries);
  const locations = useLogisticsStore((state) => state.locations);
  const materials = useLogisticsStore((state) => state.materialTemplates);
  const addInventoryEntries = useLogisticsStore((state) => state.addInventoryEntries);
  const updateInventoryEntry = useLogisticsStore((state) => state.updateInventoryEntry);
  const deleteInventoryEntry = useLogisticsStore((state) => state.deleteInventoryEntry);
  const selectedLocation = locations.find((location) => location.id === locationId);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const qualitySummary = useMemo(() => getInventoryQualitySummary(entries, materials), [entries, materials]);
  const topQuality = useMemo(() => qualitySummary.bestStacksByMaterial.slice(0, 5), [qualitySummary]);
  const premiumStacks = useMemo(() => {
    const premiumStackIds = new Set(
      Array.from(getInventoryByMaterial(entries, materials).keys())
        .flatMap((materialId) => getBestAvailableStacksForMaterial(materialId, entries, materials, locations))
        .filter((stack) => (stack.quality ?? 0) >= 900)
        .map((stack) => stack.id),
    );
    return getInventoryStacks(entries, materials, locations)
      .filter((stack) => premiumStackIds.has(stack.id))
      .sort((a, b) => (b.quality ?? 0) - (a.quality ?? 0));
  }, [entries, materials, locations]);
  const breakdown = useMemo(() => {
    const groups = Array.from(getInventoryByMaterial(entries, materials).values())
      .sort((a, b) => (a.material?.name ?? a.materialId).localeCompare(b.material?.name ?? b.materialId));
    return groups.flatMap((group) =>
      getBestAvailableStacksForMaterial(group.materialId, entries, materials, locations),
    );
  }, [entries, materials, locations]);
  const editingEntry = panel?.mode === 'edit' ? panel.entry : null;

  function handleSave(updatedEntries: InventoryEntry[]) {
    const additions = updatedEntries.filter((updated) => !entries.some((entry) => entry.id === updated.id));
    updatedEntries
      .filter((updated) => entries.some((entry) => entry.id === updated.id))
      .forEach(updateInventoryEntry);
    if (additions.length > 0) addInventoryEntries(additions);
    setPanel(null);
  }

  function handleDelete(id: string) {
    deleteInventoryEntry(id);
    if (panel?.mode === 'edit' && panel.entry.id === id) setPanel(null);
  }

  if (selectedLocation) {
    const summary = getLocationInventorySummary(selectedLocation, entries);
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
            <p className="logi-page-subtitle">{summary.materialCount} materials / {formatQuantity(summary.totalQuantity, undefined)} stored</p>
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
                {summary.bestQualityStack && <span className="logi-shortage-alert-count">Highest Q{summary.bestQualityStack.quality}</span>}
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
                    const material = materials.find((item) => item.id === entry.materialId);
                    const materialName = material?.name ?? entry.materialId;
                    return (
                      <tr key={entry.id}>
                        <td>{materialName}</td>
                        <td>{formatQuantity(entry.quantity, material)}</td>
                        <td><span className="logi-quality-pill">Q{entry.quality ?? 0}</span></td>
                        <td>{entry.container ?? '-'}</td>
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
                materials={materials}
                locations={locations}
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
            {locations.map((location) => (
              <LocationCard key={location.id} location={location} inventory={entries} materials={materials} />
            ))}
          </div>

          <div className="logi-insight-grid">
            <section className="logi-shortage-section">
              <div className="logi-shortage-header">
                <span className="logi-shortage-title">Global Top-Quality Materials</span>
              </div>
              <div className="logi-stack-list">
                {topQuality.map(({ entry, material }) => {
                  const location = locations.find((item) => item.id === entry.locationId);
                  return (
                    <div key={entry.id} className="logi-stack-row">
                      <span>{material?.name ?? entry.materialId}</span>
                      <strong>Q{entry.quality ?? 0}</strong>
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
                    <strong>Q{stack.quality ?? 0}</strong>
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
                    <td><span className="logi-quality-pill">Q{stack.quality ?? 0}</span></td>
                    <td>{stack.location?.name ?? stack.locationId}</td>
                    <td>{formatQuantity(stack.quantity, stack.material)}</td>
                    <td>{stack.container ?? '-'}</td>
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
              materials={materials}
              locations={locations}
              onSave={handleSave}
              onCancel={() => setPanel(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
