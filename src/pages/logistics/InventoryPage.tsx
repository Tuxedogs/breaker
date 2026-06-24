import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLogisticsStore } from '../../stores/logisticsStore';
import type { InventoryEntry, MaterialTemplate } from '../../types/logistics';
import InventoryTable, { type SortKey } from '../../components/logistics/InventoryTable';
import InventoryEntryPanel from '../../components/logistics/InventoryEntryPanel';
import MaterialIcon from '../../components/logistics/MaterialIcon';
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
type UnknownRecord = Record<string, unknown>;

const WINDOW_GROUP_SIZE = 4;
const WINDOW_STACK_CHUNK_SIZE = 25;

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
};

type DrawerMaterialGroup = {
  id: string;
  name: string;
  entries: DrawerEntryRow[];
  total: number;
  unitType: 'scu' | 'unit';
  totalLabel: string;
  kindLabels: string[];
  stackCount: number;
  stackRangeLabel?: string;
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

function getQualityClass(quality: number | null | undefined): string {
  if (quality == null || !Number.isFinite(quality)) return '';
  if (quality >= 950) return 'logi-quality--legendary';
  if (quality >= 900) return 'logi-quality--premium';
  if (quality >= 800) return 'logi-quality--strong';
  if (quality >= 650) return 'logi-quality--mid';
  return 'logi-quality--low';
}

function QualityPill({ quality }: { quality?: number | null }) {
  if (quality == null || !Number.isFinite(quality)) return <span className="logi-quality-pill logi-quality-pill--empty">—</span>;
  return <span className={`logi-quality-pill ${getQualityClass(quality)}`}>{quality}</span>;
}

type InventoryMaterialGroupProps = {
  group: DrawerMaterialGroup;
  onEdit: (entry: InventoryEntry) => void;
  onRequestDelete: (entryId: string) => void;
};

const InventoryMaterialCard = memo(function InventoryMaterialCard({ group, onEdit, onRequestDelete }: InventoryMaterialGroupProps) {
  return (
    <article className="logi-location-material-card">
      <div className="logi-location-material-card-head">
        <div className="logi-location-material-card-title">
          <MaterialIcon
            materialName={group.name}
            materialState={group.entries.every((row) => row.kind === 'refined') ? 'refined' : 'raw'}
            size={18}
          />
          <h3>{group.name}</h3>
          <span className="logi-location-material-card-total">{group.totalLabel}</span>
        </div>
        <div className="logi-location-material-card-badges" aria-label="Item types">
          {group.kindLabels.map((label) => (
            <span key={label} className="logi-location-kind">{label}</span>
          ))}
        </div>
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

type LocationCardProps = {
  group: LocationGroup;
  isSelected: boolean;
  onToggle: (locationId: string) => void;
};

const InventoryLocationCard = memo(function InventoryLocationCard({
  group,
  isSelected,
  onToggle,
}: LocationCardProps) {
  return (
    <article className={`logi-location-card${group.entries.length === 0 ? ' logi-location-card--empty' : ''}`}>
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


      <div className="logi-location-card-actions">
        <button
          type="button"
          className="logi-location-details-btn"
          onClick={() => onToggle(group.id)}
          aria-expanded={isSelected}
          aria-controls="inventory-location-detail"
        >
          {isSelected ? 'Collapse' : 'View Details'}
        </button>
      </div>
    </article>
  );
});

function splitLargeMaterialGroups(groups: DrawerMaterialGroup[]): DrawerMaterialGroup[] {
  return groups.flatMap((group) => {
    if (group.entries.length <= WINDOW_STACK_CHUNK_SIZE) return group;
    const chunks: DrawerMaterialGroup[] = [];
    for (let index = 0; index < group.entries.length; index += WINDOW_STACK_CHUNK_SIZE) {
      chunks.push({
        ...group,
        id: `${group.id}:${index}`,
        entries: group.entries.slice(index, index + WINDOW_STACK_CHUNK_SIZE),
        stackRangeLabel: `${index + 1}-${Math.min(index + WINDOW_STACK_CHUNK_SIZE, group.stackCount)} of ${group.stackCount}`,
      });
    }
    return chunks;
  });
}

function chunkGroups(groups: DrawerMaterialGroup[]): DrawerMaterialGroup[][] {
  const chunks: DrawerMaterialGroup[][] = [];
  for (let index = 0; index < groups.length; index += WINDOW_GROUP_SIZE) {
    chunks.push(groups.slice(index, index + WINDOW_GROUP_SIZE));
  }
  return chunks;
}

function estimateWindowHeight(groups: DrawerMaterialGroup[]): number {
  return groups.reduce(
    (height, group) => height + 178 + group.entries.length * 31,
    0,
  );
}

type WindowedGroupBlockProps = {
  groups: DrawerMaterialGroup[];
  root: HTMLDivElement | null;
  initiallyVisible: boolean;
  onEdit: (entry: InventoryEntry) => void;
  onRequestDelete: (entryId: string) => void;
};

const WindowedGroupBlock = memo(function WindowedGroupBlock({
  groups,
  root,
  initiallyVisible,
  onEdit,
  onRequestDelete,
}: WindowedGroupBlockProps) {
  const blockRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(initiallyVisible || typeof IntersectionObserver === 'undefined');
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const estimatedHeight = useMemo(() => estimateWindowHeight(groups), [groups]);

  useEffect(() => {
    const block = blockRef.current;
    if (!block || !root || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { root, rootMargin: '560px 0px' },
    );
    observer.observe(block);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    const block = blockRef.current;
    if (!block || !isVisible || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const height = Math.ceil(entry.contentRect.height);
      if (height > 0) setMeasuredHeight(height);
    });
    observer.observe(block);
    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <div
      ref={blockRef}
      className="logi-location-window-block logi-location-window-block--cards"
      style={!isVisible ? { minHeight: measuredHeight ?? estimatedHeight } : undefined}
    >
      {isVisible && groups.map((group) => (
        <InventoryMaterialCard key={group.id} group={group} onEdit={onEdit} onRequestDelete={onRequestDelete} />
      ))}
    </div>
  );
});

type WindowedMaterialGroupsProps = {
  groups: DrawerMaterialGroup[];
  onEdit: (entry: InventoryEntry) => void;
  onRequestDelete: (entryId: string) => void;
};

const WindowedMaterialGroups = memo(function WindowedMaterialGroups({
  groups,
  onEdit,
  onRequestDelete,
}: WindowedMaterialGroupsProps) {
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const blocks = useMemo(() => chunkGroups(splitLargeMaterialGroups(groups)), [groups]);

  return (
    <div
      ref={setScrollRoot}
      className="logi-location-stack-table-wrap logi-location-stack-table-wrap--cards"
    >
      {blocks.map((block, index) => (
        <WindowedGroupBlock
          key={block[0]?.id ?? index}
          groups={block}
          root={scrollRoot}
          initiallyVisible={index === 0}
          onEdit={onEdit}
          onRequestDelete={onRequestDelete}
        />
      ))}
    </div>
  );
});

type SelectedLocationDetailProps = {
  selectedLocation: LocationGroup;
  drawerMaterialGroups: DrawerMaterialGroup[];
  pendingDeleteEntryId: string | null;
  materialById: Map<string, MaterialTemplate>;
  onCollapse: (locationId: string) => void;
  onEdit: (entry: InventoryEntry) => void;
  onRequestDelete: (entryId: string) => void;
  onDelete: (entryId: string) => void;
  onCancelDelete: () => void;
};

const SelectedLocationDetail = memo(function SelectedLocationDetail({
  selectedLocation,
  drawerMaterialGroups,
  pendingDeleteEntryId,
  materialById,
  onCollapse,
  onEdit,
  onRequestDelete,
  onDelete,
  onCancelDelete,
}: SelectedLocationDetailProps) {
  const pendingEntry = pendingDeleteEntryId
    ? selectedLocation.entries.find((entry) => entry.id === pendingDeleteEntryId)
    : undefined;

  return (
    <section id="inventory-location-detail" className="logi-location-detail" aria-label={`${selectedLocation.name} inventory details`}>
      <div className="logi-location-detail-head">
        <div>
          <div className="logi-location-detail-title-row">
            <h2>{selectedLocation.name}</h2>
            <span className="logi-location-active-badge">Active</span>
          </div>
        </div>
        <button type="button" className="logi-location-collapse-btn" onClick={() => onCollapse(selectedLocation.id)}>Collapse</button>
      </div>


      {drawerMaterialGroups.length > 0 ? (
        <WindowedMaterialGroups groups={drawerMaterialGroups} onEdit={onEdit} onRequestDelete={onRequestDelete} />
      ) : (
        <div className="logi-location-stack-table-wrap logi-location-stack-table-wrap--cards">
          <div className="logi-location-detail-empty">
            {selectedLocation.id === '__unassigned__'
              ? 'No stacks without assigned location.'
              : 'No stacks recorded at this location.'}
          </div>
        </div>
      )}

      {pendingEntry && (
        <div className="logi-location-delete-confirm" role="alertdialog" aria-modal="false" aria-label="Confirm inventory deletion">
          <div className="logi-location-delete-panel">
            <span className="logi-location-delete-kicker">Are you sure?</span>
            <strong>{resolveInventoryItemName(pendingEntry, pendingEntry.materialId ? materialById.get(pendingEntry.materialId) : undefined)}</strong>
            <p>This inventory item will be deleted from {selectedLocation.name}.</p>
            <div className="logi-location-delete-actions">
              <button type="button" className="logi-location-delete-yes" onClick={() => onDelete(pendingEntry.id)}>Yes</button>
              <button type="button" onClick={onCancelDelete}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </section>
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
  const [pendingDeleteEntryId, setPendingDeleteEntryId] = useState<string | null>(null);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const materialById = useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials]);
  const locationById = useMemo(() => new Map(locations.map((location) => [location.id, location])), [locations]);

  const filtered = useMemo(() => {
    const data = entries.filter((e) => {
      if (materialFilter && toRecord(e).materialId !== materialFilter) return false;
      if (locationFilter && getEntryLocationId(e) !== locationFilter) return false;
      if (qualityMin > 0 && (e.quality ?? 0) < qualityMin) return false;
      if (search) {
        const mat = e.materialId ? materialById.get(e.materialId) : undefined;
        const loc = e.locationId ? locationById.get(e.locationId) : undefined;
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
          const ma = resolveInventoryItemName(a, a.materialId ? materialById.get(a.materialId) : undefined);
          const mb = resolveInventoryItemName(b, b.materialId ? materialById.get(b.materialId) : undefined);
          cmp = ma.localeCompare(mb);
          break;
        }
        case 'location': {
          const la = a.locationId ? locationById.get(a.locationId)?.name ?? '' : '';
          const lb = b.locationId ? locationById.get(b.locationId)?.name ?? '' : '';
          cmp = la.localeCompare(lb);
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return data;
  }, [entries, materialById, locationById, search, materialFilter, locationFilter, qualityMin, sortKey, sortDir]);

  const unassignedCount = useMemo(
    () => entries.filter((entry) => getEntryLocationId(entry) === '__unassigned__').length,
    [entries],
  );

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
    });

    for (const entry of filtered) {
      const locId = getEntryLocationId(entry);
      const group = map.get(locId) ?? map.get('__unassigned__');
      if (!group) continue;
      group.entries.push(entry);
    }

    for (const group of map.values()) {
      const uniqueMaterialIds = new Set<string>();
      for (const entry of group.entries) {
        uniqueMaterialIds.add(getEntryMaterialId(entry));
        const material = entry.materialId ? materialById.get(entry.materialId) : undefined;
        if (resolveInventoryUnitType(entry, material) === 'scu') group.totalScu += entry.quantity;
        else group.totalUnits += entry.quantity;
        if (entry.quality != null) {
          group.highestQuality = group.highestQuality == null ? entry.quality : Math.max(group.highestQuality, entry.quality);
          if (entry.quality >= 900) group.premiumCount += 1;
        }
      }
      group.uniqueItems = uniqueMaterialIds.size;
    }

    return [...map.values()]
      .filter((group) => group.entries.length > 0 || group.isManual || group.id === '__unassigned__')
      .sort((a, b) => (b.entries.length > 0 ? 1 : 0) - (a.entries.length > 0 ? 1 : 0) || b.entries.length - a.entries.length || a.name.localeCompare(b.name));
  }, [filtered, locations, materialById]);

  const selectedLocation = useMemo(
    () => locationGroups.find((group) => group.id === selectedLocationId) ?? null,
    [locationGroups, selectedLocationId],
  );

  const selectedLocationRows = useMemo<DrawerEntryRow[]>(() => {
    if (!selectedLocation) return [];
    return selectedLocation.entries.map((entry) => {
      const materialId = asString(toRecord(entry).materialId);
      const material = materialId ? materialById.get(materialId) : undefined;
      const kind = getEntryKind(entry, material);

      return {
        id: entry.id,
        materialId: getEntryMaterialId(entry),
        materialName: resolveInventoryItemName(entry, material),
        entry,
        kind,
        kindLabel: kind === 'ore' ? 'Raw' : titleCase(kind),
        quantityLabel: formatEntryQuantity(entry, material),
        containerLabel: entry.container || '-',
      };
    });
  }, [selectedLocation, materialById]);

  const drawerRows = useMemo(() => {
    return [...selectedLocationRows].sort(
      (a, b) => ((b.entry.quality ?? -1) - (a.entry.quality ?? -1)) || a.materialName.localeCompare(b.materialName),
    );
  }, [selectedLocationRows]);

  const drawerMaterialGroups = useMemo(() => {
    const groups = new Map<string, DrawerMaterialGroup>();
    for (const row of drawerRows) {
      const existing = groups.get(row.materialId);
      if (existing) {
        existing.entries.push(row);
        existing.total += row.entry.quantity;
        existing.stackCount += 1;
        if (!existing.kindLabels.includes(row.kindLabel)) existing.kindLabels.push(row.kindLabel);
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
          kindLabels: [row.kindLabel],
          stackCount: 1,
        });
      }
    }
    return [...groups.values()].map((group) => ({
      ...group,
      totalLabel: formatInventoryQuantity(group.total, group.unitType),
    }));
  }, [drawerRows, materialById]);

  const toggleLocationDrawer = useCallback((locationId: string) => {
    setSelectedLocationId((current) => current === locationId ? null : locationId);
    setPendingDeleteEntryId(null);
  }, []);

  const handleEditDrawerEntry = useCallback((entry: InventoryEntry) => {
    setPanel({ mode: 'edit', entry });
  }, []);

  const handleRequestDrawerDelete = useCallback((entryId: string) => {
    setPendingDeleteEntryId(entryId);
  }, []);

  const handleCancelDrawerDelete = useCallback(() => {
    setPendingDeleteEntryId(null);
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

  const handleDelete = useCallback((id: string) => {
    deleteInventoryEntry(id);
    setPendingDeleteEntryId(null);
    setPanel((current) => current?.mode === 'edit' && current.entry.id === id ? null : current);
  }, [deleteInventoryEntry]);

  const editingEntry = panel?.mode === 'edit' ? panel.entry : null;

  return (
    <div className="logi-page logi-inv-page">
      <div className="logi-page-header logi-inv-header page-compact-header">
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
          {unassignedCount > 0 && <option value="__unassigned__">Unassigned Stock</option>}
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
            {locationGroups.map((group) => (
              <InventoryLocationCard
                key={group.id}
                group={group}
                isSelected={selectedLocationId === group.id}
                onToggle={toggleLocationDrawer}
              />
            ))}
          </div>

          {selectedLocation && (
            <SelectedLocationDetail
              selectedLocation={selectedLocation}
              drawerMaterialGroups={drawerMaterialGroups}
              pendingDeleteEntryId={pendingDeleteEntryId}
              materialById={materialById}
              onCollapse={toggleLocationDrawer}
              onEdit={handleEditDrawerEntry}
              onRequestDelete={handleRequestDrawerDelete}
              onDelete={handleDelete}
              onCancelDelete={handleCancelDrawerDelete}
            />
          )}

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
