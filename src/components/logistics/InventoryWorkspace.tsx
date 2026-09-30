import { Fragment, useMemo, useState, type DragEvent } from 'react';
import type { BuildQueueItem, InventoryEntry, InventoryLocation, MaterialTemplate } from '../../types/logistics';
import {
  formatEntryQuantity,
  formatInventoryQuantity,
  getActiveInventoryEntries,
  resolveInventoryItemKind,
  resolveInventoryItemName,
  resolveInventoryUnitType,
} from '../../lib/logistics/inventory';
import { getReservedAmountForInventoryLot } from '../../lib/logistics/buildQueueReservations';
import MaterialIcon from './MaterialIcon';
import { getInventoryRecordPresentation } from './inventoryRecordPresentation';

type InventoryWorkspaceProps = {
  entries: InventoryEntry[];
  locations: InventoryLocation[];
  materials: MaterialTemplate[];
  buildQueue: BuildQueueItem[];
  selectedLocationId: string | null;
  selectedLotId: string | null;
  readOnly: boolean;
  hasActiveFilters?: boolean;
  globalSearch?: string;
  globalQualityMin?: number;
  matchingLocationIds?: Set<string>;
  viewMode: InventoryWorkspaceViewMode;
  sortKey: InventoryWorkspaceSortKey;
  sortDir: 'asc' | 'desc';
  onGlobalSearchChange: (value: string) => void;
  onViewModeChange: (mode: InventoryWorkspaceViewMode) => void;
  onSortKeyChange: (key: InventoryWorkspaceSortKey) => void;
  onSortDirChange: () => void;
  onOpenFilters: () => void;
  onSelectLocation: (locationId: string) => void;
  onSelectLot: (lotId: string | null) => void;
  onEdit: (entry: InventoryEntry) => void;
  onMoveRequest: (entry: InventoryEntry) => void;
  onDelete: (entry: InventoryEntry) => void;
  onMoveLot: (entry: InventoryEntry, targetLocationId: string) => Promise<void>;
  onAddAtLocation?: (locationId: string) => void;
};

export type InventoryWorkspaceViewMode = 'grid' | 'list' | 'grouped';
export type InventoryWorkspaceSortKey = 'material' | 'quality' | 'quantity' | 'location';

type MoveState = {
  entryId: string;
  targetLocationId: string;
  error?: string;
};

const UNASSIGNED_LOCATION_ID = '__unassigned__';

function lotLocationId(entry: InventoryEntry): string {
  return entry.locationId ?? UNASSIGNED_LOCATION_ID;
}

function getLocationGroup(location: InventoryLocation): string {
  return location.system?.trim() || 'Other / Unknown';
}

function getLotState(entry: InventoryEntry, material?: MaterialTemplate): string {
  const kind = resolveInventoryItemKind(entry, material);
  if (kind === 'ore' || kind === 'raw_mineable' || entry.materialType === 'ore' || entry.materialType === 'raw') return 'Raw';
  if (kind === 'refined' || entry.materialType === 'refined') return 'Refined';
  return 'State not recorded';
}

function getLotStateIndicator(entry: InventoryEntry, material?: MaterialTemplate): { code: 'R' | 'U' | 'Re'; label: string; tone: 'raw' | 'unrefined' | 'refined' } | null {
  const state = getLotState(entry, material);
  if (state === 'Refined') {
    return { code: 'Re', label: 'Refined', tone: 'refined' };
  }
  if (state === 'Unrefined') {
    return { code: 'U', label: 'Unrefined', tone: 'unrefined' };
  }
  if (state === 'Raw') {
    return { code: 'R', label: 'Raw', tone: 'raw' };
  }
  return null;
}

function getReservationOwners(entryId: string, buildQueue: BuildQueueItem[]): string[] {
  const owners = new Set<string>();
  for (const item of buildQueue) {
    if (item.status === 'complete') continue;
    if (item.reservedAllocations?.some((allocation) => allocation.inventoryEntryId === entryId && allocation.quantityReserved > 0)) {
      owners.add(item.itemName ?? item.recipeId);
    }
  }
  return [...owners];
}

function locationMeta(location: InventoryLocation): string {
  const descriptors = [location.type, location.category].filter((value): value is string => Boolean(value));
  return [...new Set(descriptors)].join(' · ') || 'Location type not recorded';
}

export default function InventoryWorkspace({
  entries,
  locations,
  materials,
  buildQueue,
  selectedLocationId,
  selectedLotId,
  readOnly,
  hasActiveFilters = false,
  globalSearch = '',
  globalQualityMin = 0,
  matchingLocationIds,
  viewMode,
  sortKey,
  sortDir,
  onGlobalSearchChange,
  onViewModeChange,
  onSortKeyChange,
  onSortDirChange,
  onOpenFilters,
  onSelectLocation,
  onSelectLot,
  onEdit,
  onMoveRequest,
  onDelete,
  onMoveLot,
  onAddAtLocation,
}: InventoryWorkspaceProps) {
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null);
  const [armedLocationId, setArmedLocationId] = useState<string | null>(null);
  const [moveState, setMoveState] = useState<MoveState | null>(null);

  const activeEntries = useMemo(() => getActiveInventoryEntries(entries), [entries]);
  const materialById = useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials]);
  const entriesByLocation = useMemo(() => {
    const grouped = new Map<string, InventoryEntry[]>();
    for (const entry of activeEntries) {
      const locationId = lotLocationId(entry);
      const rows = grouped.get(locationId) ?? [];
      rows.push(entry);
      grouped.set(locationId, rows);
    }
    return grouped;
  }, [activeEntries]);
  const locationGroups = useMemo(() => {
    const grouped = new Map<string, InventoryLocation[]>();
    for (const location of locations) {
      const group = getLocationGroup(location);
      const rows = grouped.get(group) ?? [];
      rows.push(location);
      grouped.set(group, rows);
    }
    return [...grouped.entries()]
      .map(([system, groupLocations]) => ({ system, locations: groupLocations.sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.system.localeCompare(b.system));
  }, [locations]);
  const selectedLocation = locations.find((location) => location.id === selectedLocationId) ?? null;
  const selectedEntries = useMemo(
    () => selectedLocationId ? entriesByLocation.get(selectedLocationId) ?? [] : [],
    [entriesByLocation, selectedLocationId],
  );
  const selectedLot = activeEntries.find((entry) => entry.id === selectedLotId) ?? null;
  const groupedSelectedEntries = useMemo(() => {
    const groups = new Map<string, InventoryEntry[]>();
    for (const entry of selectedEntries) {
      const material = entry.materialId ? materialById.get(entry.materialId) : undefined;
      const name = resolveInventoryItemName(entry, material);
      const rows = groups.get(name) ?? [];
      rows.push(entry);
      groups.set(name, rows);
    }
    return [...groups.entries()].map(([name, groupEntries]) => ({ name, entries: groupEntries }));
  }, [materialById, selectedEntries]);
  const displayedEntryGroups = viewMode === 'grouped'
    ? groupedSelectedEntries
    : [{ name: '', entries: selectedEntries }];

  function endDrag() {
    setDraggedEntryId(null);
    setArmedLocationId(null);
  }

  function handleDragStart(event: DragEvent<HTMLElement>, entry: InventoryEntry) {
    if (readOnly) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', entry.id);
    setDraggedEntryId(entry.id);
    setMoveState(null);
  }

  function isValidTarget(locationId: string): boolean {
    const source = draggedEntryId ? activeEntries.find((entry) => entry.id === draggedEntryId) : null;
    return Boolean(source && lotLocationId(source) !== locationId && locationId !== UNASSIGNED_LOCATION_ID && !readOnly);
  }

  async function handleDrop(event: DragEvent<HTMLElement>, targetLocationId: string) {
    event.preventDefault();
    const entryId = event.dataTransfer.getData('text/plain') || draggedEntryId;
    const entry = activeEntries.find((candidate) => candidate.id === entryId);
    setArmedLocationId(null);
    if (!entry || lotLocationId(entry) === targetLocationId || targetLocationId === UNASSIGNED_LOCATION_ID || readOnly) {
      endDrag();
      return;
    }
    setMoveState({ entryId: entry.id, targetLocationId });
    try {
      await onMoveLot(entry, targetLocationId);
      setMoveState(null);
    } catch (error) {
      const recordPresentation = getInventoryRecordPresentation(entry);
      setMoveState({
        entryId: entry.id,
        targetLocationId,
        error: error instanceof Error ? error.message : `Unable to move this ${recordPresentation.moveNoun}. Try again.`,
      });
    } finally {
      setDraggedEntryId(null);
    }
  }

  return (
    <section className="logi-inv-workspace" data-testid="inventory-workspace">
      <aside className="logi-inv-workspace-location-rail" aria-label="Inventory locations">
        <div className="logi-inv-workspace-rail-heading">
          <div>
            <p className="logi-inv-workspace-eyebrow">Inventory</p>
            <h2>Locations</h2>
          </div>
        </div>
        <label className="logi-inv-workspace-global-search">
          <span className="sr-only">Search all inventory locations and items</span>
          <input
            type="search"
            value={globalSearch}
            onChange={(event) => onGlobalSearchChange(event.target.value)}
            placeholder="Search locations or items"
            aria-label="Search all inventory locations and items"
          />
        </label>
        {globalQualityMin > 0 ? <p className="logi-inv-workspace-search-state" role="status">Quality ≥ {globalQualityMin}</p> : null}
        <div className="logi-inv-workspace-location-groups">
          {locationGroups.map((group) => (
            <section className="logi-inv-workspace-location-group" key={group.system} aria-label={`${group.system} locations`}>
              <h3>{group.system}</h3>
              {group.locations.map((location) => {
                const validTarget = isValidTarget(location.id);
                const armed = armedLocationId === location.id && validTarget;
                const pending = moveState?.targetLocationId === location.id && !moveState.error;
                const error = moveState?.targetLocationId === location.id && Boolean(moveState.error);
                const matchesSearch = !globalSearch.trim() || matchingLocationIds?.has(location.id);
                return (
                  <button
                    key={location.id}
                    type="button"
                    className={[
                      'logi-inv-workspace-location',
                      selectedLocationId === location.id ? 'is-selected' : '',
                      validTarget ? 'is-valid-drop-target' : '',
                      armed ? 'is-drop-armed' : '',
                      pending ? 'is-move-pending' : '',
                      error ? 'is-move-error' : '',
                      matchesSearch ? 'is-search-match' : 'is-search-miss',
                    ].filter(Boolean).join(' ')}
                    data-location-id={location.id}
                    data-drop-valid={validTarget ? 'true' : 'false'}
                    data-drop-armed={armed ? 'true' : 'false'}
                    data-search-match={matchesSearch ? 'true' : 'false'}
                    onClick={() => onSelectLocation(location.id)}
                    onDragOver={(event) => {
                      if (!validTarget) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      setArmedLocationId(location.id);
                    }}
                    onDragLeave={() => armed && setArmedLocationId(null)}
                    onDrop={(event) => void handleDrop(event, location.id)}
                  >
                    <span className="logi-inv-workspace-location-name">{location.name}</span>
                    <span className="logi-inv-workspace-location-meta">{[location.system, locationMeta(location)].filter(Boolean).join(' · ')}</span>
                    <span className="logi-inv-workspace-location-count">{entriesByLocation.get(location.id)?.length ?? 0} records</span>
                    {validTarget ? <span className="logi-inv-workspace-location-drop-label" aria-hidden="true">{armed ? 'Release to move' : 'Drop here'}</span> : null}
                    {error ? <span className="logi-inv-workspace-location-error" role="alert">{moveState?.error}</span> : null}
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      </aside>

      <main className="logi-inv-workspace-lots" aria-label="Selected location inventory">
        <header className="logi-inv-workspace-lots-heading">
          <div>
            <p className="logi-inv-workspace-eyebrow">Selected location</p>
            <h1>{selectedLocation?.name ?? 'Select a location'}</h1>
            {selectedLocation ? <p>{[selectedLocation.system, locationMeta(selectedLocation)].filter(Boolean).join(' · ')}</p> : null}
          </div>
          {selectedLocation && onAddAtLocation ? (
            <button type="button" className="logi-inv-workspace-add" onClick={() => onAddAtLocation(selectedLocation.id)} disabled={readOnly}>
              Add Item
            </button>
          ) : null}
        </header>
        <div className="logi-inv-workspace-controls" aria-label="Inventory workspace controls">
          <div className="logi-inv-workspace-view-controls" role="group" aria-label="Inventory view">
            {(['grid', 'list', 'grouped'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`logi-inv-workspace-view-control${viewMode === mode ? ' is-selected' : ''}`}
                aria-pressed={viewMode === mode}
                onClick={() => onViewModeChange(mode)}
              >
                {mode[0].toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          <label className="logi-inv-workspace-sort-control">
            <span>Sort</span>
            <select value={sortKey} onChange={(event) => onSortKeyChange(event.target.value as InventoryWorkspaceSortKey)} aria-label="Sort inventory">
              <option value="material">Name</option>
              <option value="quality">Quality</option>
              <option value="quantity">Quantity</option>
              <option value="location">Location</option>
            </select>
          </label>
          <button type="button" className="logi-inv-workspace-sort-direction" onClick={onSortDirChange} aria-label={`Sort ${sortDir === 'asc' ? 'descending' : 'ascending'}`}>
            {sortDir === 'asc' ? 'Ascending' : 'Descending'}
          </button>
          <button type="button" className={`logi-inv-workspace-filter-control${hasActiveFilters ? ' is-active' : ''}`} onClick={onOpenFilters}>
            Filters{hasActiveFilters ? ' active' : ''}
          </button>
        </div>
        {selectedLocation ? (
          selectedEntries.length ? (
            <div className={`logi-inv-workspace-lot-grid is-${viewMode}-view`} data-testid="inventory-lot-grid" data-view-mode={viewMode}>
              {displayedEntryGroups.map((group) => (
                <Fragment key={group.name || 'all'}>
                  {viewMode === 'grouped' ? (
                    <h2 className="logi-inv-workspace-lot-group-heading">
                      <span>{group.name}</span>
                      <small>{group.entries.length} record{group.entries.length === 1 ? '' : 's'}</small>
                    </h2>
                  ) : null}
                  {group.entries.map((entry) => {
                const material = entry.materialId ? materialById.get(entry.materialId) : undefined;
                const itemName = resolveInventoryItemName(entry, material);
                const reservedQuantity = getReservedAmountForInventoryLot(buildQueue, entry.id);
                const owners = getReservationOwners(entry.id, buildQueue);
                const unitType = resolveInventoryUnitType(entry, material);
                const recordPresentation = getInventoryRecordPresentation(entry);
                const stateIndicator = getLotStateIndicator(entry, material);
                const reservationLabel = reservedQuantity > 0
                  ? `${formatInventoryQuantity(Math.min(entry.quantity, reservedQuantity), unitType)} reserved${owners.length ? ` by ${owners.join(', ')}` : ''}`
                  : 'Available';
                return (
                  <article
                    key={entry.id}
                    className={[
                      'logi-inv-workspace-lot',
                      'is-draggable',
                      entry.id === selectedLotId ? 'is-selected' : '',
                      draggedEntryId === entry.id ? 'is-dragging' : '',
                      reservedQuantity > 0 ? 'is-reserved' : 'is-available',
                      moveState?.entryId === entry.id && !moveState.error ? 'is-move-pending' : '',
                      moveState?.entryId === entry.id && moveState.error ? 'is-move-error' : '',
                    ].filter(Boolean).join(' ')}
                    data-lot-id={entry.id}
                    data-location-id={lotLocationId(entry)}
                    data-record-kind={recordPresentation.isPhysicalBox ? 'box' : 'aggregate'}
                    data-quality={entry.quality ?? 'not-recorded'}
                    data-reservation-state={reservedQuantity > 0 ? 'reserved' : 'available'}
                    data-draggable={!readOnly ? 'true' : 'false'}
                    draggable={!readOnly}
                    onDragStart={(event) => handleDragStart(event, entry)}
                    onDragEnd={endDrag}
                  >
                    <button type="button" className="logi-inv-workspace-lot-select lot-primary" onClick={() => onSelectLot(entry.id)} aria-pressed={entry.id === selectedLotId} title={itemName}>
                      <span className="logi-inv-workspace-lot-visual lot-visual"><MaterialIcon className="logi-inv-workspace-lot-art" size={68} materialName={itemName} materialState={getLotState(entry, material) === 'Refined' ? 'refined' : getLotState(entry, material) === 'Raw' ? 'raw' : undefined} />
                        <span className="logi-inv-workspace-lot-quality-badge" aria-label={entry.quality == null ? 'Quality not recorded' : `Quality ${entry.quality}`} title={entry.quality == null ? 'Quality not recorded' : `Quality ${entry.quality}`}>{entry.quality ?? '—'}</span>
                      </span>
                      <span className="logi-inv-workspace-lot-name">{itemName}</span>
                    </button>
                    {stateIndicator ? <span className={`logi-inv-workspace-lot-state is-${stateIndicator.tone}`} aria-label={stateIndicator.label} title={stateIndicator.label}>{stateIndicator.code}</span> : null}
                    <dl className="logi-inv-workspace-lot-facts">
                      <div><dt>Quantity</dt><dd>{formatEntryQuantity(entry, material)}</dd></div>
                      <div><dt>Quality</dt><dd>{entry.quality == null ? 'Quality not recorded' : `Quality ${entry.quality}`}</dd></div>
                      <div><dt>State</dt><dd>{getLotState(entry, material)}</dd></div>
                      <div><dt>Record</dt><dd>{recordPresentation.label}</dd></div>
                    </dl>
                    <p className="logi-inv-workspace-lot-reservation lot-badges">{reservationLabel}</p>
                    {moveState?.entryId === entry.id && moveState.error ? <p className="logi-inv-workspace-lot-error" role="alert">{moveState.error}</p> : null}
                  </article>
                );
                  })}
                </Fragment>
              ))}
            </div>
          ) : <p className="logi-inv-workspace-empty" data-testid="inventory-empty-location">{hasActiveFilters ? 'No physical inventory boxes match the current search or filters.' : 'No physical inventory boxes are recorded here.'}</p>
        ) : <p className="logi-inv-workspace-empty">Choose a location to view its physical boxes and aggregate stock.</p>}
      </main>

      <aside
        className={`logi-inv-workspace-inspector${selectedLot ? ' has-selection' : ''}`}
        aria-label={selectedLot && !getInventoryRecordPresentation(selectedLot).isPhysicalBox ? 'Selected aggregate stock' : 'Selected inventory box'}
      >
        {selectedLot ? (() => {
          const material = selectedLot.materialId ? materialById.get(selectedLot.materialId) : undefined;
          const itemName = resolveInventoryItemName(selectedLot, material);
          const reservedQuantity = getReservedAmountForInventoryLot(buildQueue, selectedLot.id);
          const owners = getReservationOwners(selectedLot.id, buildQueue);
          const location = locations.find((candidate) => candidate.id === selectedLot.locationId);
          const recordPresentation = getInventoryRecordPresentation(selectedLot);
          return (
            <>
              <div className="logi-inv-workspace-inspector-heading logi-inv-workspace-inspector-hero inspector-hero">
                <p className="logi-inv-workspace-eyebrow">{recordPresentation.label}</p>
                <button type="button" className="logi-inv-workspace-inspector-close" onClick={() => onSelectLot(null)} aria-label={recordPresentation.isPhysicalBox ? 'Close inventory box inspector' : 'Close aggregate stock inspector'}>Close</button>
              </div>
              <div className="logi-inv-workspace-inspector-visual inspector-visual"><MaterialIcon materialName={itemName} materialState={getLotState(selectedLot, material) === 'Refined' ? 'refined' : getLotState(selectedLot, material) === 'Raw' ? 'raw' : undefined} /></div>
              <h2>{itemName}</h2>
              <div className="logi-inv-workspace-inspector-badges inspector-badges">
                <span>{selectedLot.quality == null ? 'Quality not recorded' : `Quality ${selectedLot.quality}`}</span>
                <span>{getLotState(selectedLot, material)}</span>
                {reservedQuantity > 0 ? <span>Reserved</span> : null}
              </div>
              <dl className="logi-inv-workspace-inspector-facts">
                <div><dt>Quantity</dt><dd>{formatEntryQuantity(selectedLot, material)}</dd></div>
                <div><dt>Quality</dt><dd>{selectedLot.quality == null ? 'Quality not recorded' : `Quality ${selectedLot.quality}`}</dd></div>
                <div><dt>State</dt><dd>{getLotState(selectedLot, material)}</dd></div>
                <div><dt>Location</dt><dd>{location?.name ?? (selectedLot.locationId ? 'Unknown Location' : 'Unassigned Stock')}</dd></div>
                <div><dt>Reservation</dt><dd>{reservedQuantity > 0 ? `${formatInventoryQuantity(Math.min(selectedLot.quantity, reservedQuantity), resolveInventoryUnitType(selectedLot, material))} reserved${owners.length ? ` by ${owners.join(', ')}` : ''}` : 'Available'}</dd></div>
                {recordPresentation.isPhysicalBox && selectedLot.container ? <div><dt>Container</dt><dd>{selectedLot.container}</dd></div> : null}
              </dl>
              <div className="logi-inv-workspace-inspector-actions inspector-actions-footer">
                <button type="button" onClick={() => onEdit(selectedLot)} disabled={readOnly}>Edit</button>
                <button type="button" onClick={() => onMoveRequest(selectedLot)} disabled={readOnly}>Move</button>
                <button type="button" onClick={() => onDelete(selectedLot)} disabled={readOnly}>Delete</button>
              </div>
            </>
          );
        })() : <p className="logi-inv-workspace-empty">Select an inventory record to inspect and manage it.</p>}
      </aside>
    </section>
  );
}
