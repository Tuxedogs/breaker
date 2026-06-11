import { memo, useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLogisticsStore } from '../../stores/logisticsStore';
import type { InventoryEntry, InventoryItemKind } from '../../types/logistics';
import InventoryTable, { type SortKey } from '../../components/logistics/InventoryTable';
import InventoryEntryPanel from '../../components/logistics/InventoryEntryPanel';
import {
  formatEntryQuantity,
  formatInventoryQuantity,
  resolveInventoryItemName,
  resolveInventoryUnitType,
} from '../../lib/logistics/inventory';
import '../../components/logistics/logistics.css';
import '../../components/logistics/inventory.css';

type PanelState = { mode: 'new' } | { mode: 'edit'; entry: InventoryEntry };
type ViewMode = 'cards' | 'list';
type DrawerViewMode = 'cards' | 'table';
type DrawerSortKey = 'material' | 'quality' | 'quantity' | 'container' | 'updated';
type DrawerFilter = 'all' | 'premium' | 'raw' | 'refined' | 'unassigned';
type UnknownRecord = Record<string, unknown>;

const MINABLE_KINDS = new Set<InventoryItemKind>(['ore', 'refined', 'raw_mineable', 'ice', 'material']);

type LocationGroup = {
  id: string;
  name: string;
  type: string;
  subtitle: string;
  isManual: boolean;
  entries: InventoryEntry[];
  uniqueItems: number;
  totalScu: number;
  totalUnits: number;
  highestQuality: number | null;
  premiumCount: number;
  topStacks: InventoryEntry[];
  lastUpdated: string | null;
};

type DrawerMaterialGroup = {
  id: string;
  name: string;
  entries: DrawerEntryRow[];
  total: number;
  unitType: 'scu' | 'unit';
  totalLabel: string;
  glyphQuality: number | null | undefined;
  bestQuality: number | null;
  kindLabels: string[];
  lastUpdatedLabel: string;
  lastUpdatedTime: number;
};

type DrawerEntryRow = {
  id: string;
  materialId: string;
  materialName: string;
  entry: InventoryEntry;
  kind: 'ore' | 'refined' | 'personal' | 'unknown';
  kindLabel: string;
  quantityLabel: string;
  containerLabel: string;
  updatedLabel: string;
  updatedTime: number;
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

function isManuallyAddedLocation(location: unknown): boolean {
  const loc = toRecord(location);
  const category = asString(loc.category)?.toLowerCase();
  const source = asString(loc.source)?.toLowerCase();
  return loc.isManual === true || loc.userCreated === true || category === 'manual' || source === 'manual';
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
  if (raw.includes('ore') || raw.includes('raw') || raw.includes('mining') || raw.includes('mineable')) return 'ore';
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
  if (quality == null || !Number.isFinite(quality)) return <span className="logi-quality-pill logi-quality-pill--empty">—</span>;
  return <span className={`logi-quality-pill ${getQualityClass(quality)}`}>{quality}</span>;
}

type InventoryDetailRowProps = {
  row: DrawerEntryRow;
  onEdit: (entry: InventoryEntry) => void;
  onRequestDelete: (entryId: string) => void;
};

const InventoryDetailRow = memo(function InventoryDetailRow({ row, onEdit, onRequestDelete }: InventoryDetailRowProps) {
  return (
    <div className="logi-location-detail-row">
      <QualityPill quality={row.entry.quality} />
      <span>{row.quantityLabel}</span>
      <span>{row.containerLabel}</span>
      <span className={`logi-location-kind logi-location-kind--${row.kind}`}>{row.kindLabel}</span>
      <span>{row.updatedLabel}</span>
      <span className="logi-location-row-actions">
        <button type="button" onClick={() => onEdit(row.entry)}>Edit</button>
        <button type="button" className="is-delete" onClick={() => onRequestDelete(row.id)}>Delete</button>
      </span>
    </div>
  );
});

type InventoryMaterialGroupProps = {
  group: DrawerMaterialGroup;
  onEdit: (entry: InventoryEntry) => void;
  onRequestDelete: (entryId: string) => void;
};

const InventoryMaterialGroup = memo(function InventoryMaterialGroup({ group, onEdit, onRequestDelete }: InventoryMaterialGroupProps) {
  return (
    <div className="logi-location-material-group">
      <div className="logi-location-material-head">
        <span><MaterialGlyph quality={group.glyphQuality} />{group.name}</span>
        <small>{group.entries.length} {group.entries.length === 1 ? 'stack' : 'stacks'} - {group.totalLabel}</small>
      </div>
      {group.entries.map((row) => (
        <InventoryDetailRow key={row.id} row={row} onEdit={onEdit} onRequestDelete={onRequestDelete} />
      ))}
    </div>
  );
});

const InventoryMaterialCard = memo(function InventoryMaterialCard({ group, onEdit, onRequestDelete }: InventoryMaterialGroupProps) {
  return (
    <article className="logi-location-material-card">
      <div className="logi-location-material-card-head">
        <div className="logi-location-material-card-title">
          <MaterialGlyph quality={group.glyphQuality} />
          <h3>{group.name}</h3>
        </div>
        <div className="logi-location-material-card-badges" aria-label="Item types">
          {group.kindLabels.map((label) => (
            <span key={label} className="logi-location-kind">{label}</span>
          ))}
        </div>
      </div>

      <div className="logi-location-material-card-meta">
        <span><small>Total</small><strong>{group.totalLabel}</strong></span>
        <span><small>Stacks</small><strong>{group.entries.length}</strong></span>
        <span><small>Best</small><strong>{group.bestQuality ?? '-'}</strong></span>
        <span><small>Updated</small><strong>{group.lastUpdatedLabel}</strong></span>
      </div>

      <div className="logi-location-material-card-rows">
        {group.entries.map((row) => (
          <div key={row.id} className="logi-location-card-stack-row">
            <QualityPill quality={row.entry.quality} />
            <span className="logi-location-card-stack-qty">{row.quantityLabel}</span>
            {row.containerLabel !== '-' && <span className="logi-location-card-stack-container">{row.containerLabel}</span>}
            {group.kindLabels.length > 1 && <span className={`logi-location-kind logi-location-kind--${row.kind}`}>{row.kindLabel}</span>}
            <span className="logi-location-row-actions">
              <button type="button" onClick={() => onEdit(row.entry)}>Edit</button>
              <button type="button" className="is-delete" onClick={() => onRequestDelete(row.id)}>Delete</button>
            </span>
          </div>
        ))}
      </div>
    </article>
  );
});

export default function InventoryPage() {
  const [searchParams] = useSearchParams();
  const entries = useLogisticsStore((state) => state.inventoryEntries);
  const materials = useLogisticsStore((state) => state.materialTemplates);
  const locations = useLogisticsStore((state) => state.locations);
  const addInventoryEntries = useLogisticsStore((state) => state.addInventoryEntries);
  const updateInventoryEntry = useLogisticsStore((state) => state.updateInventoryEntry);
  const deleteInventoryEntry = useLogisticsStore((state) => state.deleteInventoryEntry);

  const [panel, setPanel] = useState<PanelState | null>(null);
  const [search, setSearch] = useState('');
  const [materialFilter, setMaterialFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState(() => searchParams.get('location') ?? '');
  const [qualityMin, setQualityMin] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>('quality');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [drawerViewMode, setDrawerViewMode] = useState<DrawerViewMode>('cards');
  const [drawerSortKey, setDrawerSortKey] = useState<DrawerSortKey>('quality');
  const [drawerSortDir, setDrawerSortDir] = useState<'asc' | 'desc'>('desc');
  const [drawerFilter, setDrawerFilter] = useState<DrawerFilter>('all');
  const [pendingDeleteEntryId, setPendingDeleteEntryId] = useState<string | null>(null);

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
      if (locationFilter && getEntryLocationId(e) !== locationFilter) return false;
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
      const unitType = resolveInventoryUnitType(entry, material);
      if (kind === 'ore' && unitType === 'scu') oreScu += entry.quantity;
      if (kind === 'refined' && unitType === 'scu') refinedScu += entry.quantity;
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

  const materialById = useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials]);

  const locationGroups = useMemo<LocationGroup[]>(() => {
    const map = new Map<string, LocationGroup>();

    for (const location of locations) {
      map.set(location.id, {
        id: location.id,
        name: getLocationName(location),
        type: getLocationType(location),
        subtitle: getLocationSubtitle(location),
        isManual: isManuallyAddedLocation(location),
        entries: [],
        uniqueItems: 0,
        totalScu: 0,
        totalUnits: 0,
        highestQuality: null,
        premiumCount: 0,
        topStacks: [],
        lastUpdated: null,
      });
    }

    map.set('__unassigned__', {
      id: '__unassigned__',
      name: 'Unassigned Stock',
      type: 'Unassigned',
      subtitle: 'Stacks without a storage location',
      isManual: false,
      entries: [],
      uniqueItems: 0,
      totalScu: 0,
      totalUnits: 0,
      highestQuality: null,
      premiumCount: 0,
      topStacks: [],
      lastUpdated: null,
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
      group.totalScu = group.entries.reduce((sum, entry) => {
        const material = getMaterialForEntry(entry, materials);
        return resolveInventoryUnitType(entry, material) === 'scu' ? sum + entry.quantity : sum;
      }, 0);
      group.totalUnits = group.entries.reduce((sum, entry) => {
        const material = getMaterialForEntry(entry, materials);
        return resolveInventoryUnitType(entry, material) === 'unit' ? sum + entry.quantity : sum;
      }, 0);
      group.highestQuality = group.entries.reduce<number | null>((best, entry) => {
        if (entry.quality == null) return best;
        return best == null ? entry.quality : Math.max(best, entry.quality);
      }, null);
      group.premiumCount = group.entries.filter((entry) => (entry.quality ?? 0) >= 900).length;
      group.topStacks = [...group.entries]
        .sort((a, b) => ((b.quality ?? -1) - (a.quality ?? -1)) || (b.quantity - a.quantity))
        .filter((entry, index, sorted) => sorted.findIndex((candidate) => getEntryMaterialId(candidate) === getEntryMaterialId(entry)) === index)
        .slice(0, 3);
      group.lastUpdated = group.entries.reduce<string | null>((latest, entry) => {
        if (!entry.updatedAt) return latest;
        return !latest || Date.parse(entry.updatedAt) > Date.parse(latest) ? entry.updatedAt : latest;
      }, null);
    }

    return [...map.values()]
      .filter((group) => group.entries.length > 0 || group.isManual || group.id === '__unassigned__')
      .sort((a, b) => (b.entries.length > 0 ? 1 : 0) - (a.entries.length > 0 ? 1 : 0) || b.entries.length - a.entries.length || a.name.localeCompare(b.name));
  }, [filtered, locations, materials]);

  const selectedLocation = useMemo(
    () => locationGroups.find((group) => group.id === selectedLocationId) ?? null,
    [locationGroups, selectedLocationId],
  );

  const drawerAvailableFilters = useMemo(() => {
    if (!selectedLocation) return new Set<DrawerFilter>(['all']);
    const available = new Set<DrawerFilter>(['all']);
    for (const entry of selectedLocation.entries) {
      const materialId = asString(toRecord(entry).materialId);
      const kind = getEntryKind(entry, materialId ? materialById.get(materialId) : undefined);
      if ((entry.quality ?? 0) >= 900) available.add('premium');
      if (kind === 'ore') available.add('raw');
      if (kind === 'refined') available.add('refined');
      if (getEntryLocationId(entry) === '__unassigned__') available.add('unassigned');
    }
    return available;
  }, [selectedLocation, materialById]);

  const effectiveDrawerFilter = drawerAvailableFilters.has(drawerFilter) ? drawerFilter : 'all';

  const selectedLocationRows = useMemo<DrawerEntryRow[]>(() => {
    if (!selectedLocation) return [];
    return selectedLocation.entries.map((entry) => {
      const materialId = asString(toRecord(entry).materialId);
      const material = materialId ? materialById.get(materialId) : undefined;
      const kind = getEntryKind(entry, material);
      const updatedTime = Date.parse(entry.updatedAt);

      return {
        id: entry.id,
        materialId: getEntryMaterialId(entry),
        materialName: resolveInventoryItemName(entry, material),
        entry,
        kind,
        kindLabel: kind === 'ore' ? 'Raw' : titleCase(kind),
        quantityLabel: formatEntryQuantity(entry, material),
        containerLabel: entry.container || '-',
        updatedLabel: Number.isFinite(updatedTime) ? new Date(updatedTime).toLocaleDateString() : '-',
        updatedTime: Number.isFinite(updatedTime) ? updatedTime : 0,
      };
    });
  }, [selectedLocation, materialById]);

  const drawerRows = useMemo(() => {
    const query = drawerSearch.trim().toLowerCase();
    const next = selectedLocationRows.filter((row) => {
      if (effectiveDrawerFilter === 'premium' && (row.entry.quality ?? 0) < 900) return false;
      if (effectiveDrawerFilter === 'raw' && row.kind !== 'ore') return false;
      if (effectiveDrawerFilter === 'refined' && row.kind !== 'refined') return false;
      if (effectiveDrawerFilter === 'unassigned' && getEntryLocationId(row.entry) !== '__unassigned__') return false;
      if (!query) return true;
      return row.materialName.toLowerCase().includes(query)
        || (row.entry.container?.toLowerCase().includes(query) ?? false)
        || (row.entry.notes?.toLowerCase().includes(query) ?? false);
    });

    return [...next].sort((a, b) => {
      let comparison = 0;
      switch (drawerSortKey) {
        case 'material':
          comparison = a.materialName.localeCompare(b.materialName);
          break;
        case 'quality':
          comparison = (a.entry.quality ?? -1) - (b.entry.quality ?? -1);
          break;
        case 'quantity':
          comparison = a.entry.quantity - b.entry.quantity;
          break;
        case 'container':
          comparison = (a.entry.container ?? '').localeCompare(b.entry.container ?? '');
          break;
        case 'updated':
          comparison = a.updatedTime - b.updatedTime;
          break;
      }
      return drawerSortDir === 'asc' ? comparison : -comparison;
    });
  }, [selectedLocationRows, drawerSearch, effectiveDrawerFilter, drawerSortKey, drawerSortDir]);

  const drawerMaterialGroups = useMemo(() => {
    const groups = new Map<string, DrawerMaterialGroup>();
    for (const row of drawerRows) {
      const existing = groups.get(row.materialId);
      if (existing) {
        existing.entries.push(row);
        existing.total += row.entry.quantity;
        existing.totalLabel = formatInventoryQuantity(existing.total, existing.unitType);
        if (row.entry.quality != null) {
          existing.bestQuality = existing.bestQuality == null ? row.entry.quality : Math.max(existing.bestQuality, row.entry.quality);
        }
        if (!existing.kindLabels.includes(row.kindLabel)) existing.kindLabels.push(row.kindLabel);
        if (row.updatedTime > existing.lastUpdatedTime) {
          existing.lastUpdatedTime = row.updatedTime;
          existing.lastUpdatedLabel = row.updatedLabel;
        }
      } else {
        const materialId = asString(toRecord(row.entry).materialId);
        const unitType = resolveInventoryUnitType(row.entry, materialId ? materialById.get(materialId) : undefined);
        groups.set(row.materialId, {
          id: row.materialId,
          name: row.materialName,
          entries: [row],
          total: row.entry.quantity,
          unitType,
          totalLabel: formatInventoryQuantity(row.entry.quantity, unitType),
          glyphQuality: row.entry.quality,
          bestQuality: row.entry.quality ?? null,
          kindLabels: [row.kindLabel],
          lastUpdatedLabel: row.updatedLabel,
          lastUpdatedTime: row.updatedTime,
        });
      }
    }
    return [...groups.values()];
  }, [drawerRows, materialById]);

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

  function toggleLocationDrawer(locationId: string) {
    setSelectedLocationId((current) => current === locationId ? null : locationId);
    setDrawerSearch('');
    setDrawerFilter('all');
    setPendingDeleteEntryId(null);
  }

  const handleEditDrawerEntry = useCallback((entry: InventoryEntry) => {
    setPanel({ mode: 'edit', entry });
  }, []);

  const handleRequestDrawerDelete = useCallback((entryId: string) => {
    setPendingDeleteEntryId(entryId);
  }, []);

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
    setPendingDeleteEntryId(null);
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
          <Link
            to="/logistics/inventory/refinery-import"
            className="logi-btn-secondary"
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="M17 8 12 3 7 8" />
              <path d="M12 3v12" />
            </svg>
            Import Screenshot
          </Link>
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
          <small>{summary.bestQuality ? `${summary.bestQuality.name} ${summary.bestQuality.quality}` : 'no premium stacks'}</small>
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
          {summary.unassigned > 0 && <option value="__unassigned__">Unassigned Stock</option>}
        </select>

        <div className="logi-search-wrap logi-inv-quality-filter">
          <span>Min</span>
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
            {locationGroups.map((group) => {
              const isSelected = selectedLocationId === group.id;

              return (
                <article key={group.id} className={`logi-location-card${group.entries.length === 0 ? ' logi-location-card--empty' : ''}`}>
                <div className="logi-location-card-head">
                  <div>
                    <div className="logi-location-card-kicker">{group.subtitle}</div>
                    <h2>{group.name}</h2>
                  </div>
                  <div className="logi-location-card-badges">
                    {isSelected && <span className="logi-location-active-badge">Active</span>}
                    <span className="logi-location-type-badge">{group.type}</span>
                  </div>
                </div>

                <div className="logi-location-stat-grid">
                  <div><span>Unique</span><strong>{group.uniqueItems}</strong></div>
                  <div>
                    <span>Total</span>
                    <strong>{[
                      group.totalScu > 0 ? formatInventoryQuantity(group.totalScu, 'scu') : '',
                      group.totalUnits > 0 ? formatInventoryQuantity(group.totalUnits, 'unit') : '',
                    ].filter(Boolean).join(' / ') || '0'}</strong>
                  </div>
                  <div><span>Best</span><strong>{group.highestQuality ?? '—'}</strong></div>
                  <div><span>900+</span><strong>{group.premiumCount}</strong></div>
                </div>

                {group.topStacks.length > 0 ? (
                  <div className="logi-location-stack-list" aria-label="Top materials preview">
                    <span className="logi-location-preview-label">Top materials</span>
                    {group.topStacks.map((entry) => {
                      const material = getMaterialForEntry(entry, materials);
                      return (
                        <div key={entry.id} className="logi-location-stack-row">
                          <div className="logi-location-stack-main">
                            <MaterialGlyph quality={entry.quality} />
                            <span>{resolveInventoryItemName(entry, material)}</span>
                          </div>
                          <QualityPill quality={entry.quality} />
                          <span className="logi-location-stack-qty">{formatEntryQuantity(entry, material)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="logi-location-empty-state">
                    <span>{group.id === '__unassigned__' ? 'No stacks without assigned location.' : 'No stacks recorded at this location.'}</span>
                  </div>
                )}

                <div className="logi-location-card-actions">
                  <button
                    type="button"
                    className="logi-location-details-btn"
                    onClick={() => toggleLocationDrawer(group.id)}
                    aria-expanded={isSelected}
                    aria-controls="inventory-location-detail"
                  >
                    {isSelected ? 'Collapse' : 'View Details'}
                  </button>
                </div>
                </article>
              );
            })}
          </div>

          {selectedLocation && (
            <section id="inventory-location-detail" className="logi-location-detail" aria-label={`${selectedLocation.name} inventory details`}>
              <div className="logi-location-detail-head">
                <div>
                  <div className="logi-location-detail-title-row">
                    <h2>{selectedLocation.name}</h2>
                    <span className="logi-location-active-badge">Active</span>
                  </div>
                  <div className="logi-location-detail-stats">
                    <span><small>Unique materials</small><strong>{selectedLocation.uniqueItems}</strong></span>
                    <span><small>Total</small><strong>{[
                      selectedLocation.totalScu > 0 ? formatInventoryQuantity(selectedLocation.totalScu, 'scu') : '',
                      selectedLocation.totalUnits > 0 ? formatInventoryQuantity(selectedLocation.totalUnits, 'unit') : '',
                    ].filter(Boolean).join(' / ') || '0'}</strong></span>
                    <span><small>Best quality</small><strong>{selectedLocation.highestQuality ?? '—'}</strong></span>
                    <span><small>900+ stacks</small><strong>{selectedLocation.premiumCount}</strong></span>
                    <span><small>Last updated</small><strong>{selectedLocation.lastUpdated ? new Date(selectedLocation.lastUpdated).toLocaleString() : '—'}</strong></span>
                  </div>
                </div>
                <button type="button" className="logi-location-collapse-btn" onClick={() => toggleLocationDrawer(selectedLocation.id)}>
                  Collapse
                </button>
              </div>

              <div className="logi-location-detail-controls">
                <div className="logi-search-wrap">
                  <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="logi-search-icon">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    type="search"
                    className="logi-search-input"
                    placeholder="Search within this location..."
                    value={drawerSearch}
                    onChange={(event) => setDrawerSearch(event.target.value)}
                    aria-label="Search within selected location"
                  />
                </div>
                <label className="logi-location-detail-sort">
                  <span>Sort by</span>
                  <select className="logi-select" value={drawerSortKey} onChange={(event) => setDrawerSortKey(event.target.value as DrawerSortKey)}>
                    <option value="material">Material</option>
                    <option value="quality">Quality</option>
                    <option value="quantity">SCU / Quantity</option>
                    <option value="container">Container</option>
                    <option value="updated">Updated</option>
                  </select>
                  <button type="button" onClick={() => setDrawerSortDir((direction) => direction === 'asc' ? 'desc' : 'asc')} aria-label={`Sort ${drawerSortDir === 'asc' ? 'descending' : 'ascending'}`}>
                    {drawerSortDir === 'asc' ? '↑' : '↓'}
                  </button>
                </label>
                <div className="logi-location-detail-filters" role="group" aria-label="Filter selected location stacks">
                  {([
                    ['all', 'All'],
                    ['premium', '900+'],
                    ['raw', 'Raw'],
                    ['refined', 'Refined'],
                    ['unassigned', 'Unassigned'],
                  ] as [DrawerFilter, string][]).filter(([value]) => drawerAvailableFilters.has(value)).map(([value, label]) => (
                    <button key={value} type="button" className={drawerFilter === value ? 'is-active' : ''} onClick={() => setDrawerFilter(value)}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="logi-location-detail-view-toggle" role="group" aria-label="Selected location detail view">
                  <button type="button" className={drawerViewMode === 'cards' ? 'is-active' : ''} onClick={() => setDrawerViewMode('cards')}>
                    Cards
                  </button>
                  <button type="button" className={drawerViewMode === 'table' ? 'is-active' : ''} onClick={() => setDrawerViewMode('table')}>
                    Table
                  </button>
                </div>
              </div>

              {drawerViewMode === 'table' && (
                <div className="logi-location-stack-table-head" aria-hidden>
                  <span>Quality</span>
                  <span>SCU / Qty</span>
                  <span>Container</span>
                  <span>Type</span>
                  <span>Updated</span>
                  <span>Actions</span>
                </div>
              )}
              <div className={`logi-location-stack-table-wrap logi-location-stack-table-wrap--${drawerViewMode}`}>
                {drawerMaterialGroups.length > 0 ? drawerMaterialGroups.map((materialGroup) => (
                  drawerViewMode === 'cards' ? (
                    <InventoryMaterialCard
                      key={materialGroup.id}
                      group={materialGroup}
                      onEdit={handleEditDrawerEntry}
                      onRequestDelete={handleRequestDrawerDelete}
                    />
                  ) : (
                    <InventoryMaterialGroup
                      key={materialGroup.id}
                      group={materialGroup}
                      onEdit={handleEditDrawerEntry}
                      onRequestDelete={handleRequestDrawerDelete}
                    />
                  )
                )) : (
                  <div className="logi-location-detail-empty">
                    {selectedLocation.id === '__unassigned__' && drawerSearch === '' && drawerFilter === 'all'
                      ? 'No stacks without assigned location.'
                      : selectedLocation.entries.length === 0
                        ? 'No stacks recorded at this location.'
                        : 'No stacks match the selected location filters.'}
                  </div>
                )}
              </div>

              {pendingDeleteEntryId && selectedLocation.entries.some((entry) => entry.id === pendingDeleteEntryId) && (() => {
                const pendingEntry = selectedLocation.entries.find((entry) => entry.id === pendingDeleteEntryId);
                if (!pendingEntry) return null;
                return (
                  <div className="logi-location-delete-confirm" role="alertdialog" aria-modal="false" aria-label="Confirm inventory deletion">
                    <div className="logi-location-delete-panel">
                      <span className="logi-location-delete-kicker">Are you sure?</span>
                      <strong>{resolveInventoryItemName(pendingEntry, getMaterialForEntry(pendingEntry, materials))}</strong>
                      <p>This inventory item will be deleted from {selectedLocation.name}.</p>
                      <div className="logi-location-delete-actions">
                        <button type="button" className="logi-location-delete-yes" onClick={() => handleDelete(pendingEntry.id)}>Yes</button>
                        <button type="button" onClick={() => setPendingDeleteEntryId(null)}>Cancel</button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </section>
          )}

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
                    <span>{formatEntryQuantity(entry, material)} · {loc?.name ?? 'Unassigned'}</span>
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
