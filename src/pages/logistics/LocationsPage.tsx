import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import LocationCard from '../../components/logistics/LocationCard';
import InventoryEntryPanel from '../../components/logistics/InventoryEntryPanel';
import ScreenshotImportButton from '../../components/logistics/ScreenshotImportButton';
import { useLogisticsStore } from '../../stores/logisticsStore';
import { formatQuantity, getInventoryStacks, materialTypeClass } from '../../lib/logistics/inventory';
import {
  getBestAvailableStacksForMaterial,
  getInventoryByMaterial,
  getInventoryQualitySummary,
  getLocationInventorySummary,
} from '../../lib/logistics/selectors';
import type { InventoryEntry, InventoryLocation } from '../../types/logistics';

type PanelState = { mode: 'new' } | { mode: 'edit'; entry: InventoryEntry };
type LocationFormState = { mode: 'new' } | { mode: 'edit'; location: InventoryLocation };

function formatUpdatedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const LOCATION_TYPES: Array<{ value: NonNullable<InventoryLocation['type']>; label: string }> = [
  { value: 'station', label: 'Station' },
  { value: 'city', label: 'City' },
  { value: 'outpost', label: 'Outpost' },
  { value: 'ship', label: 'Ship' },
];

export default function LocationsPage() {
  const { locationId } = useParams();
  const entries = useLogisticsStore((state) => state.inventoryEntries);
  const locations = useLogisticsStore((state) => state.locations);
  const materials = useLogisticsStore((state) => state.materialTemplates);
  const addInventoryEntries = useLogisticsStore((state) => state.addInventoryEntries);
  const updateInventoryEntry = useLogisticsStore((state) => state.updateInventoryEntry);
  const deleteInventoryEntry = useLogisticsStore((state) => state.deleteInventoryEntry);
  const addLocation = useLogisticsStore((state) => state.addLocation);
  const updateLocation = useLogisticsStore((state) => state.updateLocation);
  const deleteLocation = useLogisticsStore((state) => state.deleteLocation);

  const selectedLocation = locations.find((location) => location.id === locationId);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [locationForm, setLocationForm] = useState<LocationFormState | null>(null);
  const [locName, setLocName] = useState('');
  const [locSystem, setLocSystem] = useState('');
  const [locType, setLocType] = useState<NonNullable<InventoryLocation['type']>>('station');

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

  function openAddLocation() {
    setLocName('');
    setLocSystem('');
    setLocType('station');
    setLocationForm({ mode: 'new' });
  }

  function openEditLocation(location: InventoryLocation) {
    setLocName(location.name);
    setLocSystem(location.system ?? '');
    setLocType(location.type ?? 'station');
    setLocationForm({ mode: 'edit', location });
  }

  function handleSaveLocation() {
    const name = locName.trim();
    if (!name) return;
    if (locationForm?.mode === 'new') {
      addLocation({
        id: `loc-${Date.now()}`,
        name,
        system: locSystem.trim() || undefined,
        type: locType,
        category: locType,
      });
    } else if (locationForm?.mode === 'edit') {
      updateLocation({
        ...locationForm.location,
        name,
        system: locSystem.trim() || undefined,
        type: locType,
        category: locType,
      });
    }
    setLocationForm(null);
  }

  function handleDeleteLocation(location: InventoryLocation) {
    const hasEntries = entries.some((e) => e.locationId === location.id);
    if (hasEntries) {
      const ok = window.confirm(
        `"${location.name}" has inventory stacks. Stacks will become unassigned. Delete location anyway?`,
      );
      if (!ok) return;
    }
    deleteLocation(location.id);
  }

  // ── Location detail view ───────────────────────────────────────────
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
            <p className="logi-page-subtitle">
              {summary.materialCount} materials · {formatQuantity(summary.totalQuantity, undefined)} stored
              {summary.bestQualityStack && ` · Best Q${summary.bestQualityStack.quality ?? 0}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
            <ScreenshotImportButton source="locations" />
            <button
              type="button"
              className="logi-btn-primary"
              onClick={() => setPanel({ mode: 'new' })}
            >
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Stack
            </button>
          </div>
        </div>

        <div className={`logi-inv-layout${panel ? ' logi-inv-layout--panel-open' : ''}`}>
          <div className="logi-inv-table-col">
            <div className="logi-shortage-section">
              <div className="logi-shortage-header">
                <span className="logi-shortage-title">Location Inventory</span>
                {summary.bestQualityStack && (
                  <span className="logi-shortage-alert-count">Best Q{summary.bestQualityStack.quality ?? 0}</span>
                )}
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
                  {summary.entries.length === 0 ? (
                    <tr><td colSpan={6}><div className="logi-empty" style={{ padding: '1.5rem' }}>No stacks at this location.</div></td></tr>
                  ) : summary.entries.map((entry) => {
                    const material = materials.find((item) => item.id === entry.materialId);
                    const materialName = material?.name ?? entry.materialId;
                    return (
                      <tr key={entry.id}>
                        <td>{materialName}</td>
                        <td className={materialTypeClass(material, entry.materialType)}>{formatQuantity(entry.quantity, material)}</td>
                        <td><span className={`logi-quality-pill ${materialTypeClass(material, entry.materialType)}`}>Q{entry.quality ?? 0}</span></td>
                        <td>{entry.container ?? '—'}</td>
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

  // ── Location list view ─────────────────────────────────────────────
  return (
    <div className="logi-page">
      <div className="logi-page-header">
        <div>
          <div className="logi-breadcrumb">
            <Link to="/logistics" className="logi-breadcrumb-link">Logistics</Link>
            <span className="logi-breadcrumb-sep">/</span>
            <span className="logi-breadcrumb-active">Inventory Locations</span>
          </div>
          <h1 className="logi-page-title">Inventory Locations</h1>
          <p className="logi-page-subtitle">{locations.length} locations · quality-aware stack visibility</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
          <ScreenshotImportButton source="locations" />
          <button
            type="button"
            className="logi-btn-ghost"
            onClick={openAddLocation}
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Location
          </button>
          <button
            type="button"
            className="logi-btn-primary"
            onClick={() => setPanel({ mode: 'new' })}
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Stack
          </button>
        </div>
      </div>

      {/* Inline location add/edit form */}
      {locationForm && (
        <div className="logi-loc-form">
          <div className="logi-loc-form-title">
            {locationForm.mode === 'new' ? 'New Location' : `Edit — ${locationForm.mode === 'edit' ? locationForm.location.name : ''}`}
          </div>
          <div className="logi-loc-form-row">
            <div className="logi-form-field" style={{ marginBottom: 0 }}>
              <label className="logi-form-label" htmlFor="loc-name">Name</label>
              <input
                id="loc-name"
                type="text"
                className="logi-form-input"
                value={locName}
                onChange={(e) => setLocName(e.target.value)}
                placeholder="Everus Harbor"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLocation(); }}
                autoFocus
              />
            </div>
            <div className="logi-form-field" style={{ marginBottom: 0 }}>
              <label className="logi-form-label" htmlFor="loc-system">System</label>
              <input
                id="loc-system"
                type="text"
                className="logi-form-input"
                value={locSystem}
                onChange={(e) => setLocSystem(e.target.value)}
                placeholder="Stanton"
              />
            </div>
            <div className="logi-form-field" style={{ marginBottom: 0 }}>
              <label className="logi-form-label" htmlFor="loc-type">Type</label>
              <select
                id="loc-type"
                className="logi-form-select"
                value={locType}
                onChange={(e) => setLocType(e.target.value as NonNullable<InventoryLocation['type']>)}
              >
                {LOCATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="logi-loc-form-actions">
            <button type="button" className="logi-btn-primary" onClick={handleSaveLocation} disabled={!locName.trim()}>
              {locationForm.mode === 'new' ? 'Add Location' : 'Save Changes'}
            </button>
            <button type="button" className="logi-btn-ghost" onClick={() => setLocationForm(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className={`logi-inv-layout${panel ? ' logi-inv-layout--panel-open' : ''}`}>
        <div className="logi-inv-table-col logi-location-content-col">
          <div className="logi-location-grid">
            {locations.map((location) => (
              <LocationCard
                key={location.id}
                location={location}
                inventory={entries}
                materials={materials}
                onEdit={() => openEditLocation(location)}
                onDelete={() => handleDeleteLocation(location)}
              />
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
                    <div key={entry.id} className={`logi-stack-row ${materialTypeClass(material, entry.materialType)}`}>
                      <span>{material?.name ?? entry.materialId}</span>
                      <strong className={materialTypeClass(material, entry.materialType)}>Q{entry.quality ?? 0}</strong>
                      <span>{location?.name ?? '—'}</span>
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
                  <div key={stack.id} className={`logi-stack-row ${materialTypeClass(stack.material, stack.materialType)}`}>
                    <span>{stack.material?.name ?? stack.materialId}</span>
                    <strong className={materialTypeClass(stack.material, stack.materialType)}>Q{stack.quality ?? 0}</strong>
                    <span>{formatQuantity(stack.quantity, stack.material)} / {stack.location?.name ?? '—'}</span>
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
                    <td><span className={`logi-quality-pill ${materialTypeClass(stack.material, stack.materialType)}`}>Q{stack.quality ?? 0}</span></td>
                    <td>{stack.location?.name ?? '—'}</td>
                    <td className={materialTypeClass(stack.material, stack.materialType)}>{formatQuantity(stack.quantity, stack.material)}</td>
                    <td>{stack.container ?? '—'}</td>
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
