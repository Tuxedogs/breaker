import { useMemo } from 'react';
import type { InventoryEntry, InventoryLocation, MaterialTemplate } from '../../types/logistics';
import {
  formatEntryQuantity,
  materialTypeClass,
  qualityBadgeClass,
  resolveInventoryItemKind,
  resolveInventoryItemName,
} from '../../lib/logistics/inventory';

export type SortKey = 'quality' | 'quantity' | 'material' | 'location';

interface Props {
  entries: InventoryEntry[];
  materials: MaterialTemplate[];
  locations: InventoryLocation[];
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  onEdit: (entry: InventoryEntry) => void;
  manageMode?: boolean;
  manageLocationId?: string | null;
  selectedEntryIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  singleSelectedId?: string | null;
  onQuickDelete?: () => void;
  onQuickTransfer?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  ore: 'Ore', refined: 'Refined', raw: 'Raw', special: 'Special',
  material: 'Material', raw_mineable: 'Raw Mineable', ice: 'Ice', fps_weapon: 'FPS Weapon',
  fps_armor: 'FPS Armor', vehicle_component: 'Vehicle Component', crafted_item: 'Crafted Item',
  manual: 'Manual', unknown: 'Unknown',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getEntryLocationId(entry: InventoryEntry): string {
  return entry.locationId ?? '__unassigned__';
}

function SortChevron({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span aria-hidden style={{ marginLeft: 3, fontSize: '0.65em', opacity: active ? 0.9 : 0.22 }}>
      {!active ? '⇅' : dir === 'desc' ? '↓' : '↑'}
    </span>
  );
}

function SortTh({
  label, sortK, active, dir, onSort,
}: { label: string; sortK: SortKey; active: boolean; dir: 'asc' | 'desc'; onSort: (k: SortKey) => void }) {
  return (
    <th aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={`logi-th-sort${active ? ' logi-th-sort--active' : ''}`}
        onClick={() => onSort(sortK)}
      >
        {label}<SortChevron active={active} dir={dir} />
      </button>
    </th>
  );
}

function RowActionIcon({ kind }: { kind: 'edit' | 'delete' | 'transfer' }) {
  if (kind === 'edit') {
    return (
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    );
  }
  if (kind === 'delete') {
    return (
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
      </svg>
    );
  }
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

export default function InventoryTable({
  entries,
  materials,
  locations,
  sortKey,
  sortDir,
  onSort,
  onEdit,
  manageMode = false,
  manageLocationId = null,
  selectedEntryIds = new Set(),
  onToggleSelect,
  singleSelectedId = null,
  onQuickDelete,
  onQuickTransfer,
}: Props) {
  const bestIds = useMemo(() => {
    const best = new Map<string, { id: string; quality: number }>();
    for (const entry of entries) {
      const q = entry.quality ?? -1;
      const key = entry.materialId ?? entry.catalogItemId ?? entry.itemName ?? entry.id;
      const current = best.get(key);
      if (!current || q > current.quality) best.set(key, { id: entry.id, quality: q });
    }
    return new Set(Array.from(best.values()).map((v) => v.id));
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="logi-empty">
        <svg className="logi-empty-icon" aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        No entries match the current filters.
      </div>
    );
  }

  return (
    <div className="logi-table-wrap">
      <table className="logi-table">
        <thead>
          <tr>
            {manageMode && <th className="logi-inv-table-select-col" aria-label="Select" />}
            <SortTh label="Item" sortK="material" active={sortKey === 'material'} dir={sortDir} onSort={onSort} />
            <th>Type</th>
            <SortTh label="Quality" sortK="quality" active={sortKey === 'quality'} dir={sortDir} onSort={onSort} />
            <SortTh label="Qty" sortK="quantity" active={sortKey === 'quantity'} dir={sortDir} onSort={onSort} />
            <SortTh label="Location" sortK="location" active={sortKey === 'location'} dir={sortDir} onSort={onSort} />
            <th>Container</th>
            <th>Updated</th>
            {manageMode && <th aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const material = entry.materialId ? materials.find((m) => m.id === entry.materialId) : undefined;
            const location = locations.find((l) => l.id === entry.locationId);
            const materialName = resolveInventoryItemName(entry, material);
            const isBest = bestIds.has(entry.id);
            const typeKey = resolveInventoryItemKind(entry, material) === 'refined'
              ? 'refined'
              : entry.materialType ?? material?.materialType ?? resolveInventoryItemKind(entry, material);
            const entryLocationId = getEntryLocationId(entry);
            const rowSelectable = manageMode && manageLocationId === entryLocationId;
            const isSelected = rowSelectable && selectedEntryIds.has(entry.id);
            const showQuickActions = rowSelectable && singleSelectedId === entry.id;

            return (
              <tr
                key={entry.id}
                className={`${isBest ? 'logi-row--best' : ''}${isSelected ? ' logi-inv-row--selected' : ''}${rowSelectable ? ' logi-inv-row--selectable' : ''}`.trim() || undefined}
                onClick={rowSelectable && onToggleSelect ? () => onToggleSelect(entry.id) : undefined}
                onDoubleClick={!manageMode ? () => onEdit(entry) : undefined}
                onKeyDown={rowSelectable && onToggleSelect ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onToggleSelect(entry.id);
                  }
                } : undefined}
                tabIndex={rowSelectable ? 0 : undefined}
                role={rowSelectable ? 'checkbox' : undefined}
                aria-checked={rowSelectable ? isSelected : undefined}
              >
                {manageMode && (
                  <td className="logi-inv-table-select-col">
                    {rowSelectable ? (
                      <input
                        type="checkbox"
                        className="logi-inv-row-checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect?.(entry.id)}
                        onClick={(event) => event.stopPropagation()}
                        tabIndex={-1}
                        aria-label={`Select ${materialName}`}
                      />
                    ) : null}
                  </td>
                )}
                <td>
                  <div className="logi-mat-cell">
                    <span className="logi-mat-dot" aria-hidden />
                    {materialName}
                    {isBest && (
                      <span title="Highest quality stack for this material" style={{ marginLeft: 4, fontSize: '0.6rem', color: 'rgba(167,139,250,0.55)', fontFamily: 'var(--font-primary)', letterSpacing: '0.05em' }}>
                        BEST
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <span className={`logi-type-label ${materialTypeClass(material, entry.materialType)}`}>
                    {TYPE_LABELS[typeKey] ?? typeKey}
                  </span>
                </td>
                <td><span className={`logi-quality-pill ${qualityBadgeClass(entry)}`}>{entry.quality ?? '—'}</span></td>
                <td className={`logi-qty-cell ${materialTypeClass(material, entry.materialType)}`}>{formatEntryQuantity(entry, material)}</td>
                <td>{location?.name ?? <span className="logi-muted-cell">—</span>}</td>
                <td className="logi-muted-cell">{entry.container ?? '—'}</td>
                <td className="logi-muted-cell">{formatDate(entry.updatedAt)}</td>
                {manageMode && (
                  <td>
                    {showQuickActions && (
                      <div className="logi-table-actions">
                        <button type="button" className="logi-action-btn" onClick={(event) => { event.stopPropagation(); onEdit(entry); }} aria-label={`Edit ${materialName}`}>
                          <RowActionIcon kind="edit" />
                        </button>
                        <button type="button" className="logi-action-btn" onClick={(event) => { event.stopPropagation(); onQuickTransfer?.(); }} aria-label={`Transfer ${materialName}`}>
                          <RowActionIcon kind="transfer" />
                        </button>
                        <button type="button" className="logi-action-btn logi-action-btn--delete" onClick={(event) => { event.stopPropagation(); onQuickDelete?.(); }} aria-label={`Delete ${materialName}`}>
                          <RowActionIcon kind="delete" />
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
