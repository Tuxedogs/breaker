import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLogisticsStore } from '../../stores/logisticsStore';
import type { InventoryEntry, InventoryItemKind } from '../../types/logistics';
import InventoryTable, { type SortKey } from '../../components/logistics/InventoryTable';
import InventoryEntryPanel from '../../components/logistics/InventoryEntryPanel';
import { resolveInventoryItemName } from '../../lib/logistics/inventory';
import '../../components/logistics/logistics.css';
import '../../components/logistics/inventory.css';

type PanelState = { mode: 'new' } | { mode: 'edit'; entry: InventoryEntry };
type ViewMode = 'cards' | 'list';
type UnknownRecord = Record<string, unknown>;

const MINABLE_KINDS = new Set<InventoryItemKind>(['ore', 'raw_mineable', 'ice', 'material']);

type LocationGroup = {
  id: string;
  name: string;
  type: string;
  subtitle: string;
  entries: InventoryEntry[];
  uniqueItems: number;
  totalQuantity: number;
  highestQuality: number | null;
  premiumCount: number;
  topStacks: InventoryEntry[];
};

function toRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null ? value as UnknownRecord : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function getLocationName(location: unknown): string {
  const loc = toRecord(location);
  return asString(loc.name) ?? asString(loc.displayName) ?? asString(loc.label) ?? 'Unknown Location';
}

function getLocationType(location: unknown): string {
  const loc = toRecord(location);
  const raw = asString(loc.type) ?? asString(loc.locationType) ?? asString(loc.kind) ?? asString(loc.category) ?? 'Custom';
  return titleCase(raw);
}

function getLocationSubtitle(location: unknown): string {
  const loc = toRecord(location);
  const system = asString(loc.system) ?? asString(loc.systemName) ?? asString(loc.parentSystem);
  const parent = asString(loc.parent) ?? asString(loc.parentName) ?? asString(loc.zone);
  return [system, parent].filter(Boolean).join(' / ') || 'Stored inventory location';
}

function getEntryLocationId(entry: InventoryEntry): string {
  const rec = toRecord(entry);
  return asString(rec.locationId) ?? '__unassigned__';
}

function getEntryMaterialId(entry: InventoryEntry): string {
  const rec = toRecord(entry);
  return asString(rec.materialId) ?? asString(rec.itemId) ?? asString(rec.customName) ?? entry.id;
}

function getEntryKind(entry: InventoryEntry, material: unknown): 'ore' | 'refined' | 'personal' | 'unknown' {
  const entryRec = toRecord(entry);
  const materialRec = toRecord(material);
  const raw = [
    asString(entryRec.kind),
    asString(entryRec.itemKind),
    asString(entryRec.type),
    asString(entryRec.sourceType),
    asString(materialRec.kind),
    asString(materialRec.itemKind),
    asString(materialRec.type),
    asString(materialRec.category),
    Array.isArray(materialRec.sourceGroups) ? materialRec.sourceGroups.join(' ') : undefined,
  ].filter(Boolean).join(' ').toLowerCase();

  if (raw.includes('refined')) return 'refined';
  if (raw.includes('ore') || raw.includes('mining') || raw.includes('mineable')) return 'ore';
  if (raw.includes('personal') || raw.includes('custom')) return 'personal';
  return 'unknown';
}

function getMaterialForEntry<T extends { id: string }>(entry: InventoryEntry, materials: T[]): T | undefined {
  const materialId = asString(toRecord(entry).materialId);
  return materialId ? materials.find((material) => material.id === materialId) : undefined;
}

function getQualityClass(quality: number | null | undefined): string {
  if (quality == null || !Number.isFinite(quality)) return '';
  if (quality >= 950) return 'logi-quality--legendary';
  if (quality >= 900) return 'logi-quality--premium';
  if (quality >= 800) return 'logi-quality--strong';
  if (quality >= 650) return 'logi-quality--mid';
  return 'logi-quality--low';
}

function MaterialGlyph({ quality }: { quality?: number | null }) {
  return (
    <span className={`logi-mat-glyph ${getQualityClass(quality)}`} aria-hidden>
      <svg viewBox="0 0 20 20" fill="none">
        <path d="M10 1.8 17.4 6v8L10 18.2 2.6 14V6L10 1.8Z" />
        <path d="M10 1.8v16.4M2.6 6 10 10.1 17.4 6M2.6 14l7.4-3.9 7.4 3.9" />
      </svg>
    </span>
  );
}

function QualityPill({ quality }: { quality?: number | null }) {
  if (quality == null || !Number.isFinite(quality)) return <span className="logi-quality-pill logi-quality-pill--empty">Q —</span>;
  return <span className={`logi-quality-pill ${getQualityClass(quality)}`}>Q {quality}</span>;
}

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
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [cardEdits, setCardEdits] = useState<Record<string, { quantity: string; quality: string; container: string; notes: string }>>({});

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
      if (materialFilter && toRecord(e).materialId !== materialFilter) return false;
      if (locationFilter && toRecord(e).locationId !== locationFilter) return false;
      if (qualityMin > 0 && (e.quality ?? 0) < qualityMin) return false;
      if (search) {
        const mat = getMaterialForEntry(e, materials);
        const loc = locations.find((l) => l.id === toRecord(e).locationId);
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
          const ma = resolveInventoryItemName(a, getMaterialForEntry(a, materials));
          const mb = resolveInventoryItemName(b, getMaterialForEntry(b, materials));
          cmp = ma.localeCompare(mb);
          break;
        }
        case 'location': {
          const la = locations.find((l) => l.id === toRecord(a).locationId)?.name ?? '';
          const lb = locations.find((l) => l.id === toRecord(b).locationId)?.name ?? '';
          cmp = la.localeCompare(lb);
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return data;
  }, [entries, materials, locations, search, materialFilter, locationFilter, qualityMin, sortKey, sortDir]);

  const summary = useMemo(() => {
    const locationIds = new Set<string>();
    let oreScu = 0;
    let refinedScu = 0;
    let premiumCount = 0;
    let unassigned = 0;
    let bestQuality: { quality: number; name: string } | null = null;

    for (const entry of entries) {
      const locId = getEntryLocationId(entry);
      if (locId === '__unassigned__') unassigned += 1;
      else locationIds.add(locId);

      const material = getMaterialForEntry(entry, materials);
      const kind = getEntryKind(entry, material);
      if (kind === 'ore') oreScu += entry.quantity;
      if (kind === 'refined') refinedScu += entry.quantity;
      if ((entry.quality ?? 0) >= 900) premiumCount += 1;
      if (entry.quality != null && (!bestQuality || entry.quality > bestQuality.quality)) {
        bestQuality = { quality: entry.quality, name: resolveInventoryItemName(entry, material) };
      }
    }

    return {
      locations: locationIds.size,
      totalItems: entries.length,
      oreScu,
      refinedScu,
      premiumCount,
      unassigned,
      bestQuality,
    };
  }, [entries, materials]);

  const locationGroups = useMemo<LocationGroup[]>(() => {
    const map = new Map<string, LocationGroup>();

    for (const location of locations) {
      map.set(location.id, {
        id: location.id,
        name: getLocationName(location),
        type: getLocationType(location),
        subtitle: getLocationSubtitle(location),
        entries: [],
        uniqueItems: 0,
        totalQuantity: 0,
        highestQuality: null,
        premiumCount: 0,
        topStacks: [],
      });
    }

    map.set('__unassigned__', {
      id: '__unassigned__',
      name: 'Unassigned Stock',
      type: 'Unassigned',
      subtitle: 'Stacks without a storage location',
      entries: [],
      uniqueItems: 0,
      totalQuantity: 0,
      highestQuality: null,
      premiumCount: 0,
      topStacks: [],
    });

    for (const entry of filtered) {
      const locId = getEntryLocationId(entry);
      const group = map.get(locId) ?? map.get('__unassigned__');
      if (!group) continue;
      group.entries.push(entry);
    }

    for (const group of map.values()) {
      const unique = new Set(group.entries.map(getEntryMaterialId));
      group.uniqueItems = unique.size;
      group.totalQuantity = group.entries.reduce((sum, entry) => sum + entry.quantity, 0);
      group.highestQuality = group.entries.reduce<number | null>((best, entry) => {
        if (entry.quality == null) return best;
        return best == null ? entry.quality : Math.max(best, entry.quality);
      }, null);
      group.premiumCount = group.entries.filter((entry) => (entry.quality ?? 0) >= 900).length;
      group.topStacks = [...group.entries]
        .sort((a, b) => ((b.quality ?? -1) - (a.quality ?? -1)) || (b.quantity - a.quantity))
        .slice(0, 6);
    }

    return [...map.values()]
      .filter((group) => group.id !== '__unassigned__' || group.entries.length > 0)
      .sort((a, b) => (b.entries.length > 0 ? 1 : 0) - (a.entries.length > 0 ? 1 : 0) || b.totalQuantity - a.totalQuantity || a.name.localeCompare(b.name));
  }, [filtered, locations]);

  const topQualityStacks = useMemo(() => {
    return [...entries]
      .filter((entry) => {
        if (entry.quality == null || entry.quality < 800) return false;
        const kind = entry.itemKind ?? (entry.materialId ? 'material' : undefined);
        return kind == null || MINABLE_KINDS.has(kind);
      })
      .sort((a, b) => ((b.quality ?? -1) - (a.quality ?? -1)) || b.quantity - a.quantity)
      .slice(0, 8);
  }, [entries]);

  const premiumStacks = useMemo(() => {
    return [...entries]
      .filter((entry) => {
        if ((entry.quality ?? 0) < 900) return false;
        const kind = entry.itemKind ?? (entry.materialId ? 'material' : undefined);
        return kind != null && !MINABLE_KINDS.has(kind);
      })
      .sort((a, b) => ((b.quality ?? -1) - (a.quality ?? -1)) || b.quantity - a.quantity)
      .slice(0, 8);
  }, [entries]);

  function toggleExpanded(cardId: string) {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  function startCardEdit(group: LocationGroup) {
    const edits: Record<string, { quantity: string; quality: string; container: string; notes: string }> = {};
    for (const entry of group.entries) {
      edits[entry.id] = {
        quantity: String(entry.quantity),
        quality: entry.quality != null ? String(entry.quality) : '',
        container: entry.container ?? '',
        notes: entry.notes ?? '',
      };
    }
    setCardEdits(edits);
    setEditingCard(group.id);
  }

  function cancelCardEdit() {
    setEditingCard(null);
    setCardEdits({});
  }

  function saveCardEdit(group: LocationGroup) {
    for (const entry of group.entries) {
      const edit = cardEdits[entry.id];
      if (!edit) continue;
      const qty = parseFloat(edit.quantity);
      const qual = edit.quality.trim() ? parseInt(edit.quality) : undefined;
      updateInventoryEntry({
        ...entry,
        quantity: Number.isFinite(qty) ? qty : entry.quantity,
        quality: qual != null && Number.isFinite(qual) ? qual : entry.quality,
        container: edit.container.trim() || undefined,
        notes: edit.notes.trim() || undefined,
        updatedAt: new Date().toISOString(),
      });
    }
    setEditingCard(null);
    setCardEdits({});
  }

  function handleSave(updatedEntries: InventoryEntry[]) {
    const additions = updatedEntries.filter((updated) => !entries.some((entry) => entry.id === updated.id));
    updatedEntries
      .filter((updated) => entries.some((entry) => entry.id === updated.id))
      .forEach(updateInventoryEntry);
    if (additions.length > 0) addInventoryEntries(additions);

    if (panel?.mode === 'edit') setPanel(null);
    // In new mode, keep the drawer open so users can add multiple stacks quickly.
  }

  function handleDelete(id: string) {
    deleteInventoryEntry(id);
    if (panel?.mode === 'edit' && panel.entry.id === id) setPanel(null);
  }

  const editingEntry = panel?.mode === 'edit' ? panel.entry : null;

  return (
    <div className="logi-page logi-inv-page">
      <div className="logi-page-header logi-inv-header">
        <div>
          <div className="logi-breadcrumb">
            <Link to="/logistics" className="logi-breadcrumb-link">Logistics</Link>
            <span className="logi-breadcrumb-sep">/</span>
            <span className="logi-breadcrumb-active">Inventory</span>
          </div>
          <h1 className="logi-page-title">Inventory</h1>
          <p className="logi-page-subtitle">Quality-aware stock visibility.</p>
        </div>
        <div className="logi-inv-header-actions">
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

      <div className="logi-inv-summary-grid" aria-label="Inventory summary">
        <div className="logi-inv-summary-card">
          <span>Locations</span>
          <strong>{summary.locations}</strong>
          <small>with assigned stock</small>
        </div>
        <div className="logi-inv-summary-card">
          <span>Total Items</span>
          <strong>{summary.totalItems}</strong>
          <small>recorded stacks</small>
        </div>
        <div className="logi-inv-summary-card">
          <span>Total Ore SCU</span>
          <strong>{formatQuantity(summary.oreScu)}</strong>
          <small>raw mining stock</small>
        </div>
        <div className="logi-inv-summary-card">
          <span>Total Refined SCU</span>
          <strong>{formatQuantity(summary.refinedScu)}</strong>
          <small>refined inventory</small>
        </div>
        <div className="logi-inv-summary-card logi-inv-summary-card--premium">
          <span>Premium 900+</span>
          <strong>{summary.premiumCount}</strong>
          <small>{summary.bestQuality ? `${summary.bestQuality.name} Q${summary.bestQuality.quality}` : 'no premium stacks'}</small>
        </div>
        <div className={`logi-inv-summary-card${summary.unassigned > 0 ? ' logi-inv-summary-card--warn' : ''}`}>
          <span>Unassigned</span>
          <strong>{summary.unassigned}</strong>
          <small>needs location</small>
        </div>
      </div>

      <div className="logi-filter-bar logi-inv-filter-bar">
        <div className="logi-search-wrap">
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="logi-search-icon">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            className="logi-search-input"
            placeholder="Search material, location, container…"
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

        <div className="logi-search-wrap logi-inv-quality-filter">
          <span>Q≥</span>
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
          />
        </div>

        <div className="logi-inv-view-toggle" role="group" aria-label="Inventory view mode">
          <button type="button" className={viewMode === 'cards' ? 'is-active' : ''} onClick={() => setViewMode('cards')}>Location Cards</button>
          <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')}>List View</button>
        </div>

        <span className="logi-filter-count">{filtered.length} of {entries.length}</span>
      </div>

      {viewMode === 'cards' ? (
        <>
          <div className="logi-location-card-grid">
            {locationGroups.map((group) => (
              <article key={group.id} className={`logi-location-card${group.entries.length === 0 ? ' logi-location-card--empty' : ''}${group.premiumCount > 0 ? ' logi-location-card--premium' : ''}`}>
                <div className="logi-location-card-head">
                  <div>
                    <div className="logi-location-card-kicker">{group.subtitle}</div>
                    <h2>{group.name}</h2>
                  </div>
                  <span className="logi-location-type-badge">{group.type}</span>
                </div>

                <div className="logi-location-stat-grid">
                  <div><span>Unique</span><strong>{group.uniqueItems}</strong></div>
                  <div><span>Total</span><strong>{formatQuantity(group.totalQuantity)}<em> SCU</em></strong></div>
                  <div><span>Best Q</span><strong>{group.highestQuality ?? '—'}</strong></div>
                  <div><span>900+</span><strong>{group.premiumCount}</strong></div>
                </div>

                {(() => {
                  const isExpanded = expandedCards.has(group.id);
                  const isEditing = editingCard === group.id;
                  const visibleStacks = isExpanded ? group.entries : group.topStacks;
                  return group.topStacks.length > 0 ? (
                    <div
                      className="logi-location-stack-list"
                      onKeyDown={isEditing ? (e) => { if (e.key === 'Enter') { e.preventDefault(); saveCardEdit(group); } } : undefined}
                    >
                      {visibleStacks.map((entry) => {
                        const material = getMaterialForEntry(entry, materials);
                        if (isEditing) {
                          const edit = cardEdits[entry.id] ?? { quantity: String(entry.quantity), quality: entry.quality != null ? String(entry.quality) : '', container: entry.container ?? '', notes: entry.notes ?? '' };
                          return (
                            <div key={entry.id} className="logi-location-stack-row logi-location-stack-row--editing">
                              <div className="logi-location-stack-main">
                                <MaterialGlyph quality={entry.quality} />
                                <span className="logi-stack-edit-name">{resolveInventoryItemName(entry, material)}</span>
                              </div>
                              <div className="logi-stack-edit-fields">
                                <input
                                  type="number"
                                  className="logi-stack-edit-input"
                                  value={edit.quantity}
                                  min={0}
                                  step={0.01}
                                  placeholder="SCU"
                                  aria-label="Quantity"
                                  onChange={(e) => setCardEdits((prev) => ({ ...prev, [entry.id]: { ...edit, quantity: e.target.value } }))}
                                />
                                <input
                                  type="number"
                                  className="logi-stack-edit-input"
                                  value={edit.quality}
                                  min={0}
                                  max={1000}
                                  placeholder="Q"
                                  aria-label="Quality"
                                  onChange={(e) => setCardEdits((prev) => ({ ...prev, [entry.id]: { ...edit, quality: e.target.value } }))}
                                />
                                <input
                                  type="text"
                                  className="logi-stack-edit-input logi-stack-edit-input--wide"
                                  value={edit.container}
                                  placeholder="Container"
                                  aria-label="Container"
                                  onChange={(e) => setCardEdits((prev) => ({ ...prev, [entry.id]: { ...edit, container: e.target.value } }))}
                                />
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div key={entry.id} className="logi-location-stack-row">
                            <div className="logi-location-stack-main">
                              <MaterialGlyph quality={entry.quality} />
                              <span>{resolveInventoryItemName(entry, material)}</span>
                            </div>
                            <QualityPill quality={entry.quality} />
                            <span className="logi-location-stack-qty">{formatQuantity(entry.quantity)} SCU</span>
                          </div>
                        );
                      })}
                      {!isExpanded && group.entries.length > group.topStacks.length && (
                        <button type="button" className="logi-location-more logi-location-more--btn" onClick={() => toggleExpanded(group.id)}>
                          +{group.entries.length - group.topStacks.length} more stacks
                        </button>
                      )}
                      {isExpanded && group.entries.length > group.topStacks.length && (
                        <button type="button" className="logi-location-more logi-location-more--btn" onClick={() => toggleExpanded(group.id)}>
                          Show less
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="logi-location-empty-state">
                      <span>No inventory recorded</span>
                      <button type="button" onClick={() => setPanel({ mode: 'new' })}>Add stock</button>
                    </div>
                  );
                })()}

                <div className="logi-location-card-actions">
                  {editingCard === group.id ? (
                    <>
                      <button type="button" className="logi-card-save-btn" onClick={() => saveCardEdit(group)}>Save</button>
                      <button type="button" onClick={cancelCardEdit}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => toggleExpanded(group.id)}>
                        {expandedCards.has(group.id) ? 'Collapse' : 'View'}
                      </button>
                      {group.entries.length > 0 && (
                        <button type="button" onClick={() => startCardEdit(group)}>Edit</button>
                      )}
                      <button type="button" disabled={group.entries.length > 0} title={group.entries.length > 0 ? 'Delete location after moving stock' : 'Delete location'}>Delete</button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="logi-inv-secondary-grid">
            <section className="logi-inv-panel">
              <div className="logi-inv-panel-head">
                <span>Global Top-Quality Materials</span>
                <small>{topQualityStacks.length} tracked</small>
              </div>
              {topQualityStacks.length > 0 ? topQualityStacks.map((entry) => {
                const material = getMaterialForEntry(entry, materials);
                const loc = locations.find((location) => location.id === getEntryLocationId(entry));
                return (
                  <div key={entry.id} className="logi-inv-mini-row">
                    <div className="logi-inv-mini-main"><MaterialGlyph quality={entry.quality} /><span>{resolveInventoryItemName(entry, material)}</span></div>
                    <QualityPill quality={entry.quality} />
                    <span>{loc?.name ?? 'Unassigned'}</span>
                  </div>
                );
              }) : <div className="logi-inv-empty-panel">No quality values recorded yet.</div>}
            </section>

            <section className="logi-inv-panel">
              <div className="logi-inv-panel-head">
                <span>Premium Stash 900+</span>
                <small>{premiumStacks.length} stacks</small>
              </div>
              {premiumStacks.length > 0 ? premiumStacks.map((entry) => {
                const material = getMaterialForEntry(entry, materials);
                const loc = locations.find((location) => location.id === getEntryLocationId(entry));
                return (
                  <div key={entry.id} className="logi-inv-mini-row">
                    <div className="logi-inv-mini-main"><MaterialGlyph quality={entry.quality} /><span>{resolveInventoryItemName(entry, material)}</span></div>
                    <QualityPill quality={entry.quality} />
                    <span>{formatQuantity(entry.quantity)} SCU · {loc?.name ?? 'Unassigned'}</span>
                  </div>
                );
              }) : <div className="logi-inv-empty-panel">No premium 900+ stacks recorded.</div>}
            </section>
          </div>
        </>
      ) : (
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
      )}

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
