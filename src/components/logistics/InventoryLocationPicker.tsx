import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { InventoryEntry, InventoryLocation } from '../../types/logistics';
import { getActiveInventoryEntries } from '../../lib/logistics/inventory';
import { buildInventoryLocationLookup } from '../../lib/logistics/inventoryLocationOptions';

type Props = {
  locations: InventoryLocation[];
  entries: InventoryEntry[];
  selectedId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (location: InventoryLocation) => void;
  onCreateLocation: (name: string) => Promise<boolean>;
  isCreatingLocation: boolean;
};

const MAX_VISIBLE_LOCATIONS = 7;

function normalizeLookup(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function locationMeta(location: InventoryLocation) {
  return [location.system, location.type, location.category].filter(Boolean).join(' · ')
    || (location.source === 'custom' ? 'Custom location' : 'Known location');
}

/** Searchable inline combobox, matching item search. No nested scroll container. */
function InventoryLocationPicker({
  locations, entries, selectedId, open, onOpenChange, onSelect,
  onCreateLocation, isCreatingLocation,
}: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [creatingCustom, setCreatingCustom] = useState(false);

  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const entry of getActiveInventoryEntries(entries)) {
      if (entry.locationId) result.set(entry.locationId, (result.get(entry.locationId) ?? 0) + 1);
    }
    return result;
  }, [entries]);

  const sortedLocations = useMemo(() => locations.slice().sort((a, b) => {
    const systemA = a.system || (a.source === 'custom' ? 'Custom locations' : 'Other locations');
    const systemB = b.system || (b.source === 'custom' ? 'Custom locations' : 'Other locations');
    return systemA.localeCompare(systemB)
      || (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)
      || a.name.localeCompare(b.name);
  }), [locations, counts]);

  const selected = locations.find((location) => location.id === selectedId);
  const normalizedQuery = query.trim().toLowerCase();
  const matches = useMemo(() => sortedLocations.filter((location) => {
    if (!normalizedQuery) return true;
    return [location.name, location.system, location.category, location.type]
      .filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery);
  }), [normalizedQuery, sortedLocations]);
  const visible = matches.slice(0, MAX_VISIBLE_LOCATIONS);
  const lookup = useMemo(() => buildInventoryLocationLookup(locations), [locations]);
  const canCreate = Boolean(query.trim() && !lookup.get(normalizeLookup(query)));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        onOpenChange(false);
        setCreatingCustom(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onOpenChange(false);
      setCreatingCustom(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    // Capture Escape before the enclosing dialog's close handler.
    document.addEventListener('keydown', onEscape, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onEscape, true);
    };
  }, [open, onOpenChange]);

  const selectLocation = (location: InventoryLocation) => {
    onSelect(location);
    onOpenChange(false);
    setQuery('');
    setActiveIndex(0);
    setCreatingCustom(false);
    inputRef.current?.blur();
  };

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        onOpenChange(true);
      }
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) % Math.max(1, visible.length));
    } else if (event.key === 'Enter' && visible[activeIndex] && !creatingCustom) {
      event.preventDefault();
      selectLocation(visible[activeIndex]);
    }
  }

  return (
    <section ref={rootRef} className="bq-inv-add-location bq-inv-location-combobox" aria-label="Destination location">
      <label className="logi-form-label" htmlFor="inventory-location-search">Location</label>
      <div className="bq-inv-location-input-wrap">
        <input
          ref={inputRef}
          id="inventory-location-search"
          className="logi-form-input"
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls="inventory-location-results"
          aria-activedescendant={open && visible[activeIndex] ? `inventory-location-option-${visible[activeIndex].id}` : undefined}
          autoComplete="off"
          value={open ? query : selected?.name ?? ''}
          placeholder={creatingCustom ? 'Name custom location...' : 'Search locations...'}
          onFocus={() => {
            setQuery('');
            setActiveIndex(0);
            onOpenChange(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            onOpenChange(true);
          }}
          onKeyDown={handleKeyDown}
        />
        <button type="button" className="bq-inv-location-chevron"
          aria-label={open ? 'Close locations' : 'Search locations'}
          aria-expanded={open}
          onClick={() => {
            if (open) {
              onOpenChange(false);
              inputRef.current?.blur();
            } else inputRef.current?.focus();
          }}>{open ? '⌃' : '⌄'}</button>
      </div>
      {open && (
        <div className="bq-inv-add-location-picker" id="inventory-location-results">
          <div className="bq-inv-location-results" role="listbox" aria-label="Inventory locations">
            {visible.map((location, index) => {
              const system = location.system || (location.source === 'custom' ? 'Custom locations' : 'Other locations');
              const previous = visible[index - 1];
              const previousSystem = previous?.system || (previous?.source === 'custom' ? 'Custom locations' : 'Other locations');
              return (
                <div key={location.id}>
                  {(!previous || system !== previousSystem) &&
                    <div className="bq-inv-location-system" aria-hidden="true">{system}</div>}
                  <button
                    type="button"
                    id={`inventory-location-option-${location.id}`}
                    role="option"
                    aria-selected={location.id === selectedId}
                    className={`bq-inv-add-location-option${location.id === selectedId ? ' is-selected' : ''}${activeIndex === index ? ' is-active' : ''}`}
                    onPointerDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectLocation(location)}>
                    <span><strong>{location.name}</strong><small>{locationMeta(location)}</small></span>
                    <em>{location.id === selectedId ? '✓ Selected'
                      : (counts.get(location.id) ?? 0) > 0 ? `${counts.get(location.id)} records` : ''}</em>
                  </button>
                </div>
              );
            })}
            {matches.length === 0 &&
              <p className="bq-inv-add-location-empty">No matching locations</p>}
            {matches.length > visible.length &&
              <p className="bq-inv-location-more">Showing {visible.length} of {matches.length}. Type to narrow.</p>}
          </div>
          <button type="button" className="bq-inv-add-create" disabled={isCreatingLocation}
            onClick={() => {
              if (canCreate) {
                void onCreateLocation(query.trim()).then((created) => {
                  if (created) {
                    setQuery('');
                    setCreatingCustom(false);
                    onOpenChange(false);
                    inputRef.current?.blur();
                  }
                });
              } else {
                setCreatingCustom(true);
                setQuery('');
                inputRef.current?.focus();
              }
            }}>
            {isCreatingLocation ? 'Creating custom location…'
              : canCreate ? `+ Create custom location “${query.trim()}”` : '+ Create custom location'}
          </button>
        </div>
      )}
    </section>
  );
}

export default memo(InventoryLocationPicker);
