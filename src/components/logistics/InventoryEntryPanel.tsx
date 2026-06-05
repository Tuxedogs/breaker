import { useMemo, useState } from 'react';
import { createInventoryEntryDraft } from '../../stores/logisticsStore';
import type {
  InventoryCatalogSource,
  InventoryEntry,
  InventoryItemKind,
  InventoryLocation,
  InventoryUnitType,
  MaterialTemplate,
} from '../../types/logistics';

interface Props {
  entry: InventoryEntry | null;
  materials: MaterialTemplate[];
  locations: InventoryLocation[];
  onSave: (entries: InventoryEntry[]) => void;
  onCancel: () => void;
}

// Default unitType per itemKind
const KIND_DEFAULT_UNIT: Record<InventoryItemKind, InventoryUnitType> = {
  material: 'scu',
  ore: 'scu',
  raw_mineable: 'unit',
  ice: 'unit',
  fps_weapon: 'unit',
  fps_armor: 'unit',
  vehicle_component: 'unit',
  crafted_item: 'unit',
  manual: 'unit',
  unknown: 'unit',
};

const KIND_LABELS: Record<InventoryItemKind, string> = {
  material: 'Refined Material',
  ore: 'Ore',
  raw_mineable: 'Raw Mineable',
  ice: 'Ice',
  fps_weapon: 'FPS Weapon',
  fps_armor: 'FPS Armor',
  vehicle_component: 'Vehicle Component',
  crafted_item: 'Crafted Item Tracking',
  manual: 'Misc / Custom',
  unknown: 'Unknown',
};

const ALL_KINDS: InventoryItemKind[] = [
  'ore', 'material', 'raw_mineable', 'ice',
  'fps_weapon', 'fps_armor', 'vehicle_component', 'crafted_item', 'manual',
];

// Map itemKind → which materialTypes match it in the catalog
function kindMatchesMaterial(kind: InventoryItemKind, mat: MaterialTemplate): boolean {
  if (mat.id === 'rawice') return kind === 'ice';
  switch (kind) {
    case 'ore': return mat.materialType === 'ore' || mat.materialType === 'refined';
    case 'material': return mat.materialType === 'refined' || mat.materialType === 'ore';
    case 'raw_mineable': return mat.materialType === 'raw' || mat.materialType === 'special';
    case 'ice': return mat.id === 'rawice';
    default: return false; // fps_weapon, fps_armor, vehicle_component, crafted_item, manual → no catalog entries yet
  }
}

// Derive unit from catalog material, falling back to kind default
function resolveUnitFromMaterial(mat: MaterialTemplate | undefined, kind: InventoryItemKind): InventoryUnitType {
  if (!mat) return KIND_DEFAULT_UNIT[kind];
  if (mat.materialType === 'ore' || mat.materialType === 'refined') return 'scu';
  if (mat.materialType === 'raw' || mat.materialType === 'special') return 'unit';
  return KIND_DEFAULT_UNIT[kind];
}

function parseOptionalQuality(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.min(1000, parsed));
}

function deriveKindFromMaterial(mat: MaterialTemplate | undefined): InventoryItemKind {
  if (!mat) return 'manual';
  if (mat.id === 'rawice') return 'ice';
  if (mat.materialType === 'ore' || mat.materialType === 'refined') return 'ore';
  if (mat.materialType === 'raw' || mat.materialType === 'special') return 'raw_mineable';
  return 'material';
}

function deriveKindFromEntry(entry: InventoryEntry, mat?: MaterialTemplate): InventoryItemKind {
  return entry.itemKind ?? deriveKindFromMaterial(mat);
}

// ─── Single-entry draft state ─────────────────────────────────────────────────

interface DraftState {
  // catalog lookup (legacy materialId path)
  catalogMode: 'catalog' | 'manual';
  materialId: string;      // only used when catalogMode === 'catalog'
  // manual / generalized
  itemName: string;
  itemKind: InventoryItemKind;
  unitType: InventoryUnitType;
  quantity: string;
  quality: string;
  locationId: string;
  locationSearch: string;  // text field value for location typeahead
  container: string;
  notes: string;
}

function initDraftFromEntry(
  entry: InventoryEntry,
  materials: MaterialTemplate[],
  locations: InventoryLocation[],
): DraftState {
  const mat = entry.materialId ? materials.find((m) => m.id === entry.materialId) : undefined;
  const kind = deriveKindFromEntry(entry, mat);
  const isCatalog = !!entry.materialId && !!mat;
  const locationName = locations.find((l) => l.id === entry.locationId)?.name ?? '';
  return {
    catalogMode: isCatalog ? 'catalog' : 'manual',
    materialId: entry.materialId ?? '',
    itemName: entry.itemName ?? entry.materialName ?? mat?.name ?? '',
    itemKind: kind,
    unitType: entry.unitType ?? KIND_DEFAULT_UNIT[kind],
    quantity: entry.quantity > 0 ? String(entry.quantity) : '',
    quality: entry.quality !== undefined ? String(entry.quality) : '',
    locationId: entry.locationId ?? '',
    locationSearch: locationName,
    container: entry.container ?? '',
    notes: entry.notes ?? '',
  };
}

function initBlankDraft(): DraftState {
  return {
    catalogMode: 'catalog',
    materialId: '',
    itemName: '',
    itemKind: 'ore',
    unitType: KIND_DEFAULT_UNIT['ore'],
    quantity: '',
    quality: '',
    locationId: '',
    locationSearch: '',
    container: '',
    notes: '',
  };
}

// ─── Location Typeahead ───────────────────────────────────────────────────────

interface LocationTypeaheadProps {
  locations: InventoryLocation[];
  locationId: string;
  locationSearch: string;
  open: boolean;
  onSearchChange: (search: string) => void;
  onSelect: (id: string, name: string) => void;
  onOpen: () => void;
  onClose: () => void;
}

type LocationSuggestion = InventoryLocation & {
  categoryLabel: string;
  searchText: string;
};

type LocationCategoryGroup = {
  category: string;
  locations: LocationSuggestion[];
};

type LocationSystemGroup = {
  system: string;
  categories: LocationCategoryGroup[];
};

const CATEGORY_LABELS: Record<string, string> = {
  refinery: 'Refineries',
  refineries: 'Refineries',
  city: 'Cities',
  cities: 'Cities',
  station: 'Stations',
  stations: 'Stations',
  planet: 'Planets',
  planets: 'Planets',
  lagrange: 'Lagrange',
  asteroid: 'Asteroids / Belts',
  asteroids: 'Asteroids / Belts',
  belt: 'Asteroids / Belts',
  belts: 'Asteroids / Belts',
  outpost: 'Outposts',
  outposts: 'Outposts',
};

const CATEGORY_ORDER = ['Refineries', 'Cities', 'Stations', 'Planets', 'Lagrange', 'Asteroids / Belts', 'Outposts'];

function compareCategoryLabel(a: string, b: string): number {
  const ai = CATEGORY_ORDER.indexOf(a);
  const bi = CATEGORY_ORDER.indexOf(b);
  if (ai !== -1 || bi !== -1) return (ai === -1 ? CATEGORY_ORDER.length : ai) - (bi === -1 ? CATEGORY_ORDER.length : bi);
  return a.localeCompare(b);
}

function normalizeLocationCategory(location: InventoryLocation): string {
  const raw = (location.category || location.type || 'station').trim().toLowerCase();
  return CATEGORY_LABELS[raw] ?? raw.replace(/[_-]+/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

function getLocationAliases(location: InventoryLocation): string[] {
  const raw = location as InventoryLocation & { aliases?: unknown; parent?: unknown; parentName?: unknown; bodyName?: unknown };
  const aliases = Array.isArray(raw.aliases) ? raw.aliases.filter((alias): alias is string => typeof alias === 'string') : [];
  return [
    ...aliases,
    typeof raw.parent === 'string' ? raw.parent : undefined,
    typeof raw.parentName === 'string' ? raw.parentName : undefined,
    typeof raw.bodyName === 'string' ? raw.bodyName : undefined,
  ].filter((value): value is string => Boolean(value));
}

function buildLocationSuggestionGroups(locations: InventoryLocation[], query: string): LocationSystemGroup[] {
  const q = query.trim().toLowerCase();
  const bySystem = new Map<string, Map<string, LocationSuggestion[]>>();

  for (const location of locations) {
    const system = location.system?.trim() || 'Unknown System';
    const categoryLabel = normalizeLocationCategory(location);
    const searchText = [location.name, system, categoryLabel, location.category, location.type, ...getLocationAliases(location)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (q && !searchText.includes(q)) continue;

    const systemGroup = bySystem.get(system) ?? new Map<string, LocationSuggestion[]>();
    const categoryGroup = systemGroup.get(categoryLabel) ?? [];
    categoryGroup.push({ ...location, categoryLabel, searchText });
    systemGroup.set(categoryLabel, categoryGroup);
    bySystem.set(system, systemGroup);
  }

  return [...bySystem.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([system, categoryMap]) => ({
      system,
      categories: [...categoryMap.entries()]
        .sort(([a], [b]) => compareCategoryLabel(a, b))
        .map(([category, groupedLocations]) => ({
          category,
          locations: groupedLocations.sort((a, b) => a.name.localeCompare(b.name)),
        })),
    }));
}

function LocationTypeahead({
  locations, locationId, locationSearch, open,
  onSearchChange, onSelect, onOpen, onClose,
}: LocationTypeaheadProps) {
  const groupedSuggestions = useMemo(
    () => buildLocationSuggestionGroups(locations, locationSearch),
    [locations, locationSearch],
  );
  const hasSuggestions = groupedSuggestions.some((group) => group.categories.some((category) => category.locations.length > 0));

  const selectedName = locationId ? locations.find((l) => l.id === locationId)?.name : undefined;

  return (
    <div className="logi-form-field">
      <label htmlFor="inv-location-search" className="logi-form-label">Location</label>
      <div className="logi-location-typeahead">
        <input
          id="inv-location-search"
          type="text"
          className={`logi-form-input${locationId ? ' logi-form-input--selected' : ''}`}
          value={locationSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={onOpen}
          onBlur={() => setTimeout(onClose, 150)}
          placeholder="Search or type location…"
          autoComplete="off"
        />
        {locationId && selectedName && (
          <span className="logi-form-hint logi-form-hint--value">{selectedName}</span>
        )}
        {open && hasSuggestions && (
          <ul className="logi-location-suggestions" role="listbox">
            {groupedSuggestions.map((systemGroup) => (
              <li key={systemGroup.system} className="logi-location-suggestion-system" aria-disabled="true">
                <span>{systemGroup.system}</span>
                {systemGroup.categories.map((categoryGroup) => (
                  <div key={categoryGroup.category} className="logi-location-suggestion-category">
                    <span className="logi-location-suggestion-category-label">{categoryGroup.category}</span>
                    {categoryGroup.locations.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        role="option"
                        aria-selected={l.id === locationId}
                        className={`logi-location-suggestion${l.id === locationId ? ' logi-location-suggestion--active' : ''}`}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          onSelect(l.id, l.name);
                        }}
                      >
                        <span className="logi-location-suggestion-name">{l.name}</span>
                        <span className="logi-location-suggestion-meta">{l.categoryLabel}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
        {open && !hasSuggestions && locationSearch.trim() && (
          <div className="logi-location-suggestions logi-location-suggestions--empty">
            No matching locations — add one in Locations first
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InventoryEntryPanel({ entry, materials, locations, onSave, onCancel }: Props) {
  const isNew = entry === null;

  const [newEntryId] = useState(() => String(Date.now()));
  const [draft, setDraft] = useState<DraftState>(() =>
    entry
      ? initDraftFromEntry(entry, materials, locations)
      : initBlankDraft(),
  );
  const [locationOpen, setLocationOpen] = useState(false);
  const [clearLocationOnNextFocus, setClearLocationOnNextFocus] = useState(false);

  function patch(updates: Partial<DraftState>) {
    setDraft((d) => ({ ...d, ...updates }));
  }

  // Kind changed: clear selected item, keep kind-default unitType.
  // Does NOT switch catalogMode.
  function handleKindChange(kind: InventoryItemKind) {
    patch({ itemKind: kind, materialId: '', itemName: '', unitType: KIND_DEFAULT_UNIT[kind] });
  }

  function handleCatalogModeChange(mode: 'catalog' | 'manual') {
    if (mode === 'catalog') {
      patch({ catalogMode: 'catalog', materialId: '', unitType: KIND_DEFAULT_UNIT[draft.itemKind] });
    } else {
      patch({ catalogMode: 'manual', materialId: '' });
    }
  }

  // Catalog item selected: derive unitType from catalog. Do NOT overwrite user's itemKind.
  function handleMaterialSelect(materialId: string) {
    const mat = materials.find((m) => m.id === materialId);
    patch({
      materialId,
      itemName: mat?.name ?? '',
      unitType: resolveUnitFromMaterial(mat, draft.itemKind),
    });
  }

  function buildEntry(overrideId?: string): InventoryEntry | null {
    const qty = parseFloat(draft.quantity);
    if (isNaN(qty) || qty <= 0) return null;
    if (!resolvedLocationId) return null;

    let resolvedMaterialId: string | undefined;
    let resolvedItemName: string | undefined;
    let catalogSource: InventoryCatalogSource;

    const usingCatalog = draft.catalogMode === 'catalog' &&
      materials.filter((m) => kindMatchesMaterial(draft.itemKind, m)).length > 0;

    if (usingCatalog) {
      const mat = materials.find((m) => m.id === draft.materialId);
      if (!mat) return null;
      resolvedMaterialId = mat.id;
      resolvedItemName = mat.name;
      catalogSource = 'seed';
    } else {
      const name = draft.itemName.trim();
      if (!name) return null;
      resolvedMaterialId = undefined;
      resolvedItemName = name;
      catalogSource = 'manual';
    }

    return createInventoryEntryDraft({
      id: overrideId ?? entry?.id ?? newEntryId,
      materialId: resolvedMaterialId,
      itemName: resolvedItemName,
      itemKind: draft.itemKind,
      unitType: draft.unitType,
      catalogSource,
      quality: parseOptionalQuality(draft.quality),
      quantity: qty,
      locationId: resolvedLocationId,
      container: draft.container.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      createdAt: entry?.createdAt,
      updatedAt: new Date().toISOString(),
    });
  }

  function handleSave() {
    const built = buildEntry();
    if (!built) return;
    onSave([built]);
    if (isNew && draft.locationSearch.trim()) setClearLocationOnNextFocus(true);
  }

  function handleLocationFocus() {
    if (clearLocationOnNextFocus && draft.locationSearch.trim()) {
      patch({ locationId: '', locationSearch: '' });
      setClearLocationOnNextFocus(false);
    }
    setLocationOpen(true);
  }

  // Derived preview: unitType label
  const unitLabel = draft.unitType === 'scu' ? 'SCU' : 'units';
  const qty = parseFloat(draft.quantity);
  const quantityPreview = isNaN(qty) || qty <= 0
    ? null
    : draft.unitType === 'scu'
      ? `${qty} SCU`
      : `×${qty}`;

  // Resolve locationId: exact pick, or single-match from search text
  const resolvedLocationId = (() => {
    if (draft.locationId) return draft.locationId;
    const q = draft.locationSearch.trim().toLowerCase();
    if (!q) return '';
    const matches = locations.filter((l) => l.name.toLowerCase() === q);
    return matches.length === 1 ? matches[0].id : '';
  })();

  const canSave = useMemo(() => {
    const q = parseFloat(draft.quantity);
    if (isNaN(q) || q <= 0) return false;
    if (!resolvedLocationId) return false;
    const usingCatalog = draft.catalogMode === 'catalog' && materials.filter((m) => kindMatchesMaterial(draft.itemKind, m)).length > 0;
    if (usingCatalog) return !!draft.materialId;
    return draft.itemName.trim().length > 0;
  }, [draft, materials, resolvedLocationId]);

  const filteredCatalogItems = useMemo(
    () => materials.filter((m) => kindMatchesMaterial(draft.itemKind, m)),
    [materials, draft.itemKind],
  );

  const selectedMat = draft.catalogMode === 'catalog'
    ? materials.find((m) => m.id === draft.materialId)
    : undefined;

  // In catalog mode, kinds with no catalog entries force manual
  const hasCatalogForKind = filteredCatalogItems.length > 0;

  return (
    <div className="logi-entry-panel">
      <div className="logi-entry-panel-header">
        <span className="logi-entry-panel-title">{isNew ? 'Add Inventory Item' : 'Edit Inventory Item'}</span>
        <button type="button" className="logi-panel-close-btn" onClick={onCancel} aria-label="Close panel">
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 1. Item Source */}
      <div className="logi-form-field">
        <span className="logi-form-label">Item Source</span>
        <div className="logi-inv-mode-toggle">
          <button
            type="button"
            className={`logi-inv-mode-btn${draft.catalogMode === 'catalog' ? ' logi-inv-mode-btn--active' : ''}`}
            onClick={() => handleCatalogModeChange('catalog')}
          >
            Catalog
          </button>
          <button
            type="button"
            className={`logi-inv-mode-btn${draft.catalogMode === 'manual' ? ' logi-inv-mode-btn--active' : ''}`}
            onClick={() => handleCatalogModeChange('manual')}
          >
            Manual / Custom
          </button>
        </div>
      </div>

      {/* 2. Item Kind */}
      <div className="logi-form-field">
        <label htmlFor="inv-item-kind" className="logi-form-label">Item Kind</label>
        <select
          id="inv-item-kind"
          className="logi-form-select"
          value={draft.itemKind}
          onChange={(e) => handleKindChange(e.target.value as InventoryItemKind)}
        >
          {ALL_KINDS.map((k) => (
            <option key={k} value={k}>{KIND_LABELS[k]}</option>
          ))}
        </select>
      </div>

      {/* 3. Item — filtered by kind in catalog mode; free-text in manual mode */}
      {draft.catalogMode === 'catalog' && hasCatalogForKind ? (
        <div className="logi-form-field">
          <label htmlFor="inv-material" className="logi-form-label">Item</label>
          <select
            id="inv-material"
            className="logi-form-select"
            value={draft.materialId}
            onChange={(e) => e.target.value ? handleMaterialSelect(e.target.value) : patch({ materialId: '', itemName: '' })}
          >
            <option value="">Select item…</option>
            {filteredCatalogItems.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          {selectedMat && (
            <span className="logi-form-hint">{selectedMat.materialType}</span>
          )}
        </div>
      ) : (
        <div className="logi-form-field">
          <label htmlFor="inv-item-name" className="logi-form-label">Item Name</label>
          <input
            id="inv-item-name"
            type="text"
            className="logi-form-input"
            value={draft.itemName}
            onChange={(e) => patch({ itemName: e.target.value })}
            placeholder={
              draft.itemKind === 'fps_weapon' ? 'e.g. Nightstalker P4-AR, S38 Combine…' :
              draft.itemKind === 'fps_armor' ? 'e.g. Caldera Medium Helmet…' :
              draft.itemKind === 'ice' ? 'e.g. Raw Ice, Pressurized Ice…' :
              draft.itemKind === 'raw_mineable' ? 'e.g. Aphorite, Feynmaline…' :
              'Item name…'
            }
            autoFocus={isNew}
          />
          {draft.catalogMode === 'catalog' && !hasCatalogForKind && (
            <span className="logi-form-hint">No catalog entries for this kind — enter manually</span>
          )}
        </div>
      )}

      {/* Quantity + Unit Type */}
      <div className="logi-form-row-pair">
        <div className="logi-form-field">
          <label htmlFor="inv-quantity" className="logi-form-label">Quantity</label>
          <input
            id="inv-quantity"
            type="number"
            className="logi-form-input"
            value={draft.quantity}
            onChange={(e) => patch({ quantity: e.target.value })}
            placeholder={draft.unitType === 'scu' ? '0.00' : '1'}
            min="0"
            step={draft.unitType === 'scu' ? '0.01' : '1'}
          />
          {quantityPreview && (
            <span className="logi-form-hint logi-form-hint--value">{quantityPreview}</span>
          )}
        </div>
        <div className="logi-form-field">
          <label htmlFor="inv-unit-type" className="logi-form-label">Unit</label>
          <select
            id="inv-unit-type"
            className="logi-form-select"
            value={draft.unitType}
            onChange={(e) => patch({ unitType: e.target.value as InventoryUnitType })}
          >
            <option value="scu">SCU (cargo volume)</option>
            <option value="unit">Units / items (×)</option>
          </select>
          <span className="logi-form-hint">Displays as: {unitLabel}</span>
        </div>
      </div>

      {/* Quality (accent only) */}
      <div className="logi-form-field">
        <label htmlFor="inv-quality" className="logi-form-label">Quality <span className="logi-form-label-sub">(0–1000, accent color only)</span></label>
        <input
          id="inv-quality"
          type="number"
          className="logi-form-input"
          value={draft.quality}
          onChange={(e) => patch({ quality: e.target.value })}
          placeholder="Leave blank if unknown"
          min="0"
          max="1000"
          step="1"
        />
        <span className="logi-form-hint">Blank quality shows as — (no color accent)</span>
      </div>

      {/* Location — typeahead */}
      <LocationTypeahead
        locations={locations}
        locationId={draft.locationId}
        locationSearch={draft.locationSearch}
        open={locationOpen}
        onSearchChange={(search) => {
          patch({ locationSearch: search, locationId: '' });
          setClearLocationOnNextFocus(false);
          setLocationOpen(true);
        }}
        onSelect={(id, name) => {
          patch({ locationId: id, locationSearch: name });
          setClearLocationOnNextFocus(false);
          setLocationOpen(false);
        }}
        onOpen={handleLocationFocus}
        onClose={() => setLocationOpen(false)}
      />

      {/* Container */}
      <div className="logi-form-field">
        <label htmlFor="inv-container" className="logi-form-label">Container <span className="logi-form-label-sub">(optional)</span></label>
        <input
          id="inv-container"
          type="text"
          className="logi-form-input"
          value={draft.container}
          onChange={(e) => patch({ container: e.target.value })}
          placeholder="Box A, Hold 3, Storage Unit…"
        />
      </div>

      {/* Notes */}
      <div className="logi-form-field">
        <label htmlFor="inv-notes" className="logi-form-label">Notes <span className="logi-form-label-sub">(optional)</span></label>
        <input
          id="inv-notes"
          type="text"
          className="logi-form-input"
          value={draft.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="e.g. from PvP loot, mission reward…"
        />
      </div>

      <div className="logi-entry-panel-actions">
        <button
          type="button"
          className="logi-btn-primary"
          onClick={handleSave}
          disabled={!canSave}
        >
          {isNew ? 'Add to Inventory' : 'Save Changes'}
        </button>
        <button type="button" className="logi-btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
