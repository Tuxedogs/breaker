import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLogisticsStore } from '../../stores/logisticsStore';
import type { InventoryEntry } from '../../types/logistics';
import InventoryTable from '../../components/logistics/InventoryTable';
import InventoryEntryPanel from '../../components/logistics/InventoryEntryPanel';

type PanelState = { mode: 'new' } | { mode: 'edit'; entry: InventoryEntry };

export default function InventoryPage() {
  const entries = useLogisticsStore((state) => state.inventoryEntries);
  const materials = useLogisticsStore((state) => state.materialTemplates);
  const locations = useLogisticsStore((state) => state.locations);
  const addInventoryEntries = useLogisticsStore((state) => state.addInventoryEntries);
  const updateInventoryEntry = useLogisticsStore((state) => state.updateInventoryEntry);
  const deleteInventoryEntry = useLogisticsStore((state) => state.deleteInventoryEntry);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [search, setSearch] = useState('');
  const [materialFilter, setMaterialFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (materialFilter && e.materialId !== materialFilter) return false;
      if (locationFilter && e.locationId !== locationFilter) return false;
      if (search) {
        const mat = materials.find((m) => m.id === e.materialId);
        const loc = locations.find((l) => l.id === e.locationId);
        const q = search.toLowerCase();
        const hit =
          (mat?.name.toLowerCase().includes(q) ?? false) ||
          (loc?.name.toLowerCase().includes(q) ?? false) ||
          (e.container?.toLowerCase().includes(q) ?? false);
        if (!hit) return false;
      }
      return true;
    });
  }, [entries, materials, locations, search, materialFilter, locationFilter]);

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

  const editingEntry = panel?.mode === 'edit' ? panel.entry : null;

  return (
    <div className="logi-page">
      <div className="logi-page-header">
        <div>
          <div className="logi-breadcrumb">
            <Link to="/logistics" className="logi-breadcrumb-link">Logistics</Link>
            <span className="logi-breadcrumb-sep">/</span>
            <span className="logi-breadcrumb-active">Inventory</span>
          </div>
          <h1 className="logi-page-title">Inventory</h1>
          <p className="logi-page-subtitle">Fast-add stacks by location, material, quality, and quantity.</p>
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

      <div className="logi-filter-bar">
        <div className="logi-search-wrap">
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="logi-search-icon">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            className="logi-search-input"
            placeholder="Search materials, locations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search inventory"
          />
        </div>

        <select
          className="logi-select"
          value={materialFilter}
          onChange={(e) => setMaterialFilter(e.target.value)}
          aria-label="Filter by material"
        >
          <option value="">All Materials</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <select
          className="logi-select"
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          aria-label="Filter by location"
        >
          <option value="">All Locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>

        <span className="logi-filter-count">{filtered.length} of {entries.length}</span>
      </div>

      <div className={`logi-inv-layout${panel ? ' logi-inv-layout--panel-open' : ''}`}>
        <div className="logi-inv-table-col">
          <InventoryTable
            entries={filtered}
            materials={materials}
            locations={locations}
            onEdit={(entry) => setPanel({ mode: 'edit', entry })}
            onDelete={handleDelete}
          />
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
