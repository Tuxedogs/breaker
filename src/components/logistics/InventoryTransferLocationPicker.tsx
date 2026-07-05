import { useId, useMemo, useRef, useState } from 'react';
import type { InventoryLocation } from '../../types/logistics';
import {
  buildTransferLocationGroups,
  flattenTransferLocationGroups,
} from '../../lib/logistics/inventoryTransferLocations';

type Props = {
  locations: InventoryLocation[];
  excludeLocationId: string;
  selectedLocationId: string | null;
  onSelect: (locationId: string | null) => void;
};

export default function InventoryTransferLocationPicker({
  locations,
  excludeLocationId,
  selectedLocationId,
  onSelect,
}: Props) {
  const inputId = useId();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const groups = useMemo(
    () => buildTransferLocationGroups(locations, { excludeLocationId, query }),
    [excludeLocationId, locations, query],
  );
  const flatOptions = useMemo(() => flattenTransferLocationGroups(groups), [groups]);
  const selectedLocation = selectedLocationId
    ? locations.find((location) => location.id === selectedLocationId)
    : undefined;
  const hasSuggestions = flatOptions.length > 0;
  const activeHighlightIndex = flatOptions.length
    ? Math.min(highlightIndex, flatOptions.length - 1)
    : 0;

  function selectLocation(location: InventoryLocation) {
    onSelect(location.id);
    setQuery(location.name);
    setOpen(false);
    setHighlightIndex(0);
  }

  function handleInputChange(value: string) {
    setQuery(value);
    setOpen(true);
    setHighlightIndex(0);
    if (selectedLocationId) onSelect(null);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!flatOptions.length) return;
      setHighlightIndex((current) => (current + 1) % flatOptions.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!flatOptions.length) return;
      setHighlightIndex((current) => (current - 1 + flatOptions.length) % flatOptions.length);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const highlighted = flatOptions[activeHighlightIndex];
      if (highlighted) selectLocation(highlighted);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  }

  let optionIndex = -1;

  return (
    <div className="logi-inv-transfer-picker">
      <label htmlFor={inputId} className="logi-inv-modal-label">Target location</label>
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        className={`logi-inv-transfer-picker-input${selectedLocation ? ' is-selected' : ''}`}
        value={query}
        onChange={(event) => handleInputChange(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder="Search locations…"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && flatOptions[activeHighlightIndex] ? `${listId}-${flatOptions[activeHighlightIndex].id}` : undefined}
        autoComplete="off"
      />
      {selectedLocation && !open ? (
        <p className="logi-inv-transfer-picker-selected" aria-live="polite">
          Selected: <strong>{selectedLocation.name}</strong>
        </p>
      ) : null}
      {open ? (
        <div
          id={listId}
          className="logi-inv-transfer-picker-list"
          role="listbox"
          aria-label="Transfer target locations"
        >
          {!hasSuggestions ? (
            <div className="logi-inv-transfer-picker-empty" role="status">
              {query.trim() ? 'No matching locations.' : 'No other locations available.'}
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.system} className="logi-inv-transfer-picker-group">
                <div className="logi-inv-transfer-picker-group-label" aria-hidden>{group.system}</div>
                {group.locations.map((location) => {
                  optionIndex += 1;
                  const currentIndex = optionIndex;
                  const isHighlighted = currentIndex === activeHighlightIndex;
                  const isSelected = location.id === selectedLocationId;
                  return (
                    <button
                      key={location.id}
                      id={`${listId}-${location.id}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`logi-inv-transfer-picker-option${isHighlighted ? ' is-highlighted' : ''}${isSelected ? ' is-selected' : ''}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectLocation(location)}
                      onMouseEnter={() => setHighlightIndex(currentIndex)}
                    >
                      <span className="logi-inv-transfer-picker-option-name">{location.name}</span>
                      {location.category || location.type ? (
                        <span className="logi-inv-transfer-picker-option-meta">
                          {location.category ?? location.type}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
