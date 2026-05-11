import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLogisticsStore } from '../../stores/logisticsStore';
import type { InventoryEntry } from '../../types/logistics';
import InventoryTable, { type SortKey } from '../../components/logistics/InventoryTable';
import InventoryEntryPanel from '../../components/logistics/InventoryEntryPanel';
import ScreenshotImportButton from '../../components/logistics/ScreenshotImportButton';
import { resolveInventoryItemName } from '../../lib/logistics/inventory';
import '../../components/logistics/logistics.css';
import '../../components/logistics/inventory.css';

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
  const [qualityMin, setQualityMin] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>('quality');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const filtered = useMemo(() => {
    const data = entries.filter((e) => {
      if (materialFilter && e.materialId !== materialFilter) return false;
      if (locationFilter && e.locationId !== locationFilter) return false;
      if (qualityMin > 0 && (e.quality ?? 0) < qualityMin) return false;
      if (search) {
        const mat = e.materialId ? materials.find((m) => m.id === e.materialId) : undefined;
        const loc = locations.find((l) => l.id === e.locationId);
        const q = search.toLowerCase();
        const hit =
          resolveInventoryItemName(e, mat).toLowerCase().includes(q) ||
          (loc?.name.toLowerCase().includes(q) ?? false) ||
          (e.container?.toLowerCase().includes(q) ?? false) ||
          (e.notes?.toLowerCase().includes(q) ?? false);
        if (!hit) return false;
      }
      return true;
    });

    data.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'quality':
          cmp = (a.quality ?? -1) - (b.quality ?? -1);
          break;
        case 'quantity':
          cmp = a.quantity - b.quantity;
          break;
        case 'material': {
          const ma = resolveInventoryItemName(a, a.materialId ? materials.find((m) => m.id === a.materialId) : undefined);
          const mb = resolveInventoryItemName(b, b.materialId ? materials.find((m) => m.id === b.materialId) : undefined);
          cmp = ma.localeCompare(mb);
          break;
        }
        case 'location': {
          const la = locations.find((l) => l.id === a.locationId)?.name ?? '';
          const lb = locations.find((l) => l.id === b.locationId)?.name ?? '';
          cmp = la.localeCompare(lb);
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return data;
  }, [entries, materials, locations, search, materialFilter, locationFilter, qualityMin, sortKey, sortDir]);

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
          <p className="logi-page-subtitle">All recorded inventory across locations.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
          <ScreenshotImportButton source="inventory" />
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

      <div className="logi-filter-bar">
        <div className="logi-search-wrap">
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="logi-search-icon">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            className="logi-search-input"
            placeholder="Search material, location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search inventory"
          />
        </div>

        <select
          className="logi-select"
          value={materialFilter}
          onChange={(e) => setMaterialFilter(e.target.value)}
          aria-label="Filter by item"
        >
          <option value="">All Items</option>
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

        <div className="logi-search-wrap" style={{ maxWidth: 120, minWidth: 90, gap: '0.35rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'rgba(160,180,220,0.4)', fontFamily: 'var(--font-primary)', letterSpacing: '0.06em', flexShrink: 0 }}>Q≥</span>
          <input
            type="number"
            className="logi-search-input"
            placeholder="0"
            min={0}
            max={1000}
            step={50}
            value={qualityMin || ''}
            onChange={(e) => setQualityMin(parseInt(e.target.value) || 0)}
            aria-label="Minimum quality"
            style={{ width: 40 }}
          />
        </div>

        <span className="logi-filter-count">{filtered.length} of {entries.length}</span>
      </div>

      <div className="logi-inv-layout">
        <div className="logi-inv-table-col">
          <InventoryTable
            entries={filtered}
            materials={materials}
            locations={locations}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            onEdit={(entry) => setPanel({ mode: 'edit', entry })}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {/* Slide-over drawer */}
      {panel && (
        <div className="logi-drawer-overlay" onClick={() => setPanel(null)} aria-hidden />
      )}
      <div className={`logi-drawer${panel ? ' logi-drawer--open' : ''}`} role="dialog" aria-modal aria-label={panel?.mode === 'edit' ? 'Edit Stack' : 'Add Stack'}>
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
  );
}
