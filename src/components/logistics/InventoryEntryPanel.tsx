import { useMemo, useState } from 'react';
import { createInventoryEntryDraft } from '../../stores/logisticsStore';
import { formatEntryQuantity } from '../../lib/logistics/inventory';
import { type MaterialIdentity, useMaterialIdentityIndex } from '../../lib/logistics/materialIdentityIndex';
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
  refined: 'scu',
  raw_mineable: 'unit',
  ice: 'unit',
  fps_weapon: 'unit',
  fps_armor: 'unit',
  vehicle_component: 'unit',
  crafted_item: 'unit',
  manual: 'unit',
  unknown: 'unit',
};

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

function normalizeItemLookup(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function createNewInventoryId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ─── Single-entry draft state ─────────────────────────────────────────────────

interface DraftState {
  // catalog lookup (legacy materialId path)
  catalogMode: 'catalog' | 'manual';
  materialId: string;      // only used when catalogMode === 'catalog'
  mineableForm: MineableFormChoice;
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
    mineableForm: kind === 'ore' ? 'raw' : kind === 'refined' || entry.materialType === 'refined' ? 'refined' : '',
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
    mineableForm: '',
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

type MineableFormChoice = '' | 'raw' | 'refined';

type MineableRuntimeFields = MaterialTemplate & {
  isRefinable?: boolean;
  canComeFromRefinery?: boolean;
  sourceGroups?: string[];
};

type ResolvedMineable = {
  identity: MaterialIdentity | undefined;
  material: MaterialTemplate;
};

type MineableSuggestion = {
  identity: MaterialIdentity;
  material: MaterialTemplate;
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

function isKnownMineable(material: MaterialTemplate | undefined): material is MaterialTemplate {
  return Boolean(
    material &&
    (material.materialType === 'ore' ||
      material.materialType === 'refined' ||
      material.materialType === 'raw' ||
      material.materialType === 'special'),
  );
}

function isRefinableScuMineable(material: MaterialTemplate | undefined, identity?: MaterialIdentity): boolean {
  if (!isKnownMineable(material)) return false;
  const flagged = material as MineableRuntimeFields;
  const hasRefinerySource = flagged.isRefinable === true ||
    flagged.canComeFromRefinery === true ||
    flagged.sourceGroups?.includes('ores') === true;
  const usesScu = identity?.unitType === 'scu' || material.materialType === 'ore' || material.materialType === 'refined';
  return hasRefinerySource && usesScu;
}

function deriveInventoryKindFromForm(choice: MineableFormChoice): InventoryItemKind | undefined {
  if (choice === 'raw') return 'ore';
  if (choice === 'refined') return 'refined';
  return undefined;
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

  const materialIdentities = useMaterialIdentityIndex();
  const [draft, setDraft] = useState<DraftState>(() =>
    entry
      ? initDraftFromEntry(entry, materials, locations)
      : initBlankDraft(),
  );
  const [locationOpen, setLocationOpen] = useState(false);
  const [clearLocationOnNextFocus, setClearLocationOnNextFocus] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const identityByLookup = useMemo(() => {
    const lookup = new Map<string, MaterialIdentity>();
    for (const identity of materialIdentities) {
      lookup.set(normalizeItemLookup(identity.displayName), identity);
      lookup.set(normalizeItemLookup(identity.materialKey), identity);
    }
    return lookup;
  }, [materialIdentities]);

  const materialByLookup = useMemo(() => {
    const lookup = new Map<string, MaterialTemplate>();
    for (const material of materials) {
      if (!isKnownMineable(material)) continue;
      lookup.set(normalizeItemLookup(material.id), material);
      lookup.set(normalizeItemLookup(material.name), material);
    }
    return lookup;
  }, [materials]);

  const mineableIdentities = useMemo(() => {
    return materialIdentities
      .map<MineableSuggestion | null>((identity) => {
        const material = materialByLookup.get(normalizeItemLookup(identity.materialKey)) ??
          materialByLookup.get(normalizeItemLookup(identity.displayName));
        return material ? { identity, material } : null;
      })
      .filter((item): item is MineableSuggestion => item !== null)
      .sort((left, right) => left.identity.displayName.localeCompare(right.identity.displayName));
  }, [materialByLookup, materialIdentities]);

  function patch(updates: Partial<DraftState>) {
    setDraft((d) => ({ ...d, ...updates }));
  }

  function findMineableIdentity(itemName: string): ResolvedMineable | undefined {
    const key = normalizeItemLookup(itemName);
    if (!key) return undefined;
    const identity = identityByLookup.get(key);
    if (identity) {
      const material = materialByLookup.get(normalizeItemLookup(identity.materialKey)) ??
        materialByLookup.get(normalizeItemLookup(identity.displayName));
      if (material) return { identity, material };
    }
    const material = materialByLookup.get(key);
    if (!material) return undefined;
    return { identity: undefined, material };
  }

  function resolveKnownItem(itemName: string): Partial<DraftState> {
    const resolved = findMineableIdentity(itemName);
    if (!resolved) {
      return {
        catalogMode: 'manual',
        itemName,
        materialId: '',
        mineableForm: '',
        itemKind: 'manual',
        unitType: 'unit',
      };
    }
    const { identity, material } = resolved;
    const isRefinable = isRefinableScuMineable(material, identity);
    const nextForm = isRefinable ? draft.mineableForm : '';
    const nextKind = deriveInventoryKindFromForm(nextForm) ?? (isRefinable ? 'unknown' : deriveKindFromMaterial(material));
    return {
      catalogMode: 'catalog',
      itemName: identity?.displayName ?? material.name,
      materialId: material.id,
      mineableForm: nextForm,
      itemKind: nextKind,
      unitType: isRefinable ? 'scu' : resolveUnitFromMaterial(material, nextKind),
    };
  }

  function buildEntry(overrideId?: string): InventoryEntry | null {
    const qty = parseFloat(draft.quantity);
    if (isNaN(qty) || qty <= 0) return null;
    if (!resolvedLocationId) return null;

    const resolvedMineable = findMineableIdentity(draft.itemName);
    if (!resolvedMineable) {
      const customName = draft.itemName.trim();
      if (!customName) return null;
      return createInventoryEntryDraft({
        id: overrideId ?? entry?.id ?? createNewInventoryId(),
        itemName: customName,
        itemKind: 'manual',
        unitType: 'unit',
        catalogSource: 'manual',
        quality: parseOptionalQuality(draft.quality),
        quantity: qty,
        locationId: resolvedLocationId,
        container: draft.container.trim() || undefined,
        notes: draft.notes.trim() || undefined,
        createdAt: entry?.createdAt,
        updatedAt: new Date().toISOString(),
      });
    }

    if (!isRefinableScuMineable(resolvedMineable.material, resolvedMineable.identity)) {
      const resolvedItemName = resolvedMineable.identity?.displayName ?? resolvedMineable.material.name;
      return createInventoryEntryDraft({
        id: overrideId ?? entry?.id ?? createNewInventoryId(),
        materialId: resolvedMineable.material.id,
        materialType: resolvedMineable.material.materialType,
        itemName: resolvedItemName,
        itemKind: deriveKindFromMaterial(resolvedMineable.material),
        unitType: resolveUnitFromMaterial(resolvedMineable.material, deriveKindFromMaterial(resolvedMineable.material)),
        catalogSource: 'api',
        quality: parseOptionalQuality(draft.quality),
        quantity: qty,
        locationId: resolvedLocationId,
        container: draft.container.trim() || undefined,
        notes: draft.notes.trim() || undefined,
        createdAt: entry?.createdAt,
        updatedAt: new Date().toISOString(),
      });
    }

    const derivedKind = deriveInventoryKindFromForm(draft.mineableForm);
    if (!derivedKind) return null;

    const resolvedItemName = resolvedMineable.identity?.displayName ?? resolvedMineable.material.name;
    if (!resolvedItemName) return null;
    const resolvedMaterialId = resolvedMineable.material.id;
    const catalogSource: InventoryCatalogSource = 'api';

    return createInventoryEntryDraft({
      id: overrideId ?? entry?.id ?? createNewInventoryId(),
      materialId: resolvedMaterialId,
      materialType: draft.mineableForm === 'refined' ? 'refined' : 'ore',
      itemName: resolvedItemName,
      itemKind: derivedKind,
      unitType: 'scu',
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
    setErrorMessage('');
    const built = buildEntry();
    if (!built) {
      const qty = parseFloat(draft.quantity);
      const resolvedMineable = findMineableIdentity(draft.itemName);
      const message = !draft.itemName.trim()
        ? 'Enter an item name.'
        : isNaN(qty) || qty <= 0
          ? 'Enter a quantity greater than zero.'
          : !resolvedLocationId
            ? 'Choose a known inventory location.'
            : resolvedMineable && isRefinableScuMineable(resolvedMineable.material, resolvedMineable.identity) && !deriveInventoryKindFromForm(draft.mineableForm)
              ? 'Choose Raw or Refined for this known mineable.'
              : 'Inventory item could not be saved.';
      setErrorMessage(message);
      return;
    }
    onSave([built]);
    if (isNew) {
      const locationName = locations.find((location) => location.id === built.locationId)?.name;
      const details = [
        formatEntryQuantity(built, built.materialId ? materials.find((material) => material.id === built.materialId) : undefined),
        locationName ? `at ${locationName}` : undefined,
        built.container ? `in ${built.container}` : undefined,
        built.quality !== undefined ? `quality ${built.quality}` : undefined,
      ].filter(Boolean).join(' / ');
      setSuccessMessage(`Added ${built.itemName ?? built.materialName ?? 'item'}: ${details}`);
      setDraft((current) => ({
        ...current,
        catalogMode: 'catalog',
        materialId: '',
        mineableForm: '',
        itemName: '',
        itemKind: 'manual',
        quantity: '',
        quality: '',
        unitType: 'unit',
      }));
      setClearLocationOnNextFocus(false);
    }
  }

  function handleLocationFocus() {
    if (clearLocationOnNextFocus && draft.locationSearch.trim()) {
      patch({ locationId: '', locationSearch: '' });
      setClearLocationOnNextFocus(false);
    }
    setLocationOpen(true);
  }

  const selectedMineable = findMineableIdentity(draft.itemName);
  const selectedMaterial = selectedMineable?.material;
  const selectedIsKnownMineable = isKnownMineable(selectedMaterial);
  const selectedIsRefinableScu = isRefinableScuMineable(selectedMaterial, selectedMineable?.identity);
  const derivedUnitType: InventoryUnitType = selectedIsRefinableScu ? 'scu' : resolveUnitFromMaterial(selectedMaterial, draft.itemKind);
  const qty = parseFloat(draft.quantity);
  const quantityPreview = isNaN(qty) || qty <= 0
    ? null
    : derivedUnitType === 'scu'
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
    if (!draft.itemName.trim()) return false;
    if (!selectedIsKnownMineable) return true;
    if (!selectedIsRefinableScu) return true;
    return Boolean(deriveInventoryKindFromForm(draft.mineableForm));
  }, [draft.itemName, draft.mineableForm, draft.quantity, resolvedLocationId, selectedIsKnownMineable, selectedIsRefinableScu]);

  const itemHint = !draft.itemName.trim()
    ? 'Search known mineables or type a custom item name.'
    : !selectedIsKnownMineable
      ? 'Custom inventory item / not used for raw/refined material matching.'
      : !selectedIsRefinableScu
        ? `Known mineable / ${selectedMaterial?.id} / single pipeline state`
        : draft.mineableForm
          ? `Known mineable / ${selectedMaterial?.id} / ${draft.mineableForm === 'raw' ? 'Raw ore' : 'Refined material'}`
          : 'Choose Raw or Refined before adding this material.';

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

      <div className="logi-form-field">
        <label htmlFor="inv-item-name" className="logi-form-label">Item Name</label>
        <input
          id="inv-item-name"
          type="text"
          list="inv-known-items"
          className={`logi-form-input${draft.materialId ? ' logi-form-input--selected' : ''}`}
          value={draft.itemName}
          onChange={(event) => {
            patch(resolveKnownItem(event.target.value));
            setSuccessMessage('');
            setErrorMessage('');
          }}
          onBlur={(event) => patch(resolveKnownItem(event.target.value))}
          placeholder="Search mineable material..."
          autoFocus={isNew}
        />
        <datalist id="inv-known-items">
          {mineableIdentities.map(({ identity }) => (
            <option key={identity.materialKey} value={identity.displayName} />
          ))}
        </datalist>
        <span className="logi-form-hint">
          {itemHint}
        </span>
      </div>

      {selectedIsRefinableScu && (
        <div className="logi-form-field">
          <span className="logi-form-label">Raw / Refined</span>
          <div className="logi-inv-segmented" role="group" aria-label="Raw or refined material">
            <button
              type="button"
              className={`logi-inv-segmented-btn${draft.mineableForm === 'raw' ? ' logi-inv-segmented-btn--active' : ''}`}
              onClick={() => patch({ mineableForm: 'raw', itemKind: 'ore', unitType: 'scu' })}
            >
              Raw
            </button>
            <button
              type="button"
              className={`logi-inv-segmented-btn${draft.mineableForm === 'refined' ? ' logi-inv-segmented-btn--active' : ''}`}
              onClick={() => patch({ mineableForm: 'refined', itemKind: 'material', unitType: 'scu' })}
            >
              Refined
            </button>
          </div>
        </div>
      )}

      {/* Quality + Quantity */}
      <div className="logi-form-row-pair">
        <div className="logi-form-field">
          <label htmlFor="inv-quality" className="logi-form-label">Quality <span className="logi-form-label-sub">(0-1000)</span></label>
          <input
            id="inv-quality"
            type="number"
            className="logi-form-input"
            value={draft.quality}
            onChange={(e) => patch({ quality: e.target.value })}
            placeholder="Optional"
            min="0"
            max="1000"
            step="1"
          />
          <span className="logi-form-hint">Blank shows no accent</span>
        </div>
        <div className="logi-form-field">
          <label htmlFor="inv-quantity" className="logi-form-label">Quantity</label>
          <input
            id="inv-quantity"
            type="number"
            className="logi-form-input"
            value={draft.quantity}
            onChange={(e) => patch({ quantity: e.target.value })}
            placeholder="0.00"
            min="0"
            step="0.01"
          />
          {quantityPreview && (
            <span className="logi-form-hint logi-form-hint--value">{quantityPreview}</span>
          )}
        </div>
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
        {successMessage && (
          <div className="logi-inventory-add-success" role="status" aria-live="polite">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="logi-inventory-add-error" role="alert">
            {errorMessage}
          </div>
        )}
        <button
          type="button"
          className="logi-btn-primary"
          onClick={handleSave}
          aria-disabled={!canSave}
        >
          {isNew ? 'Add to Inventory' : 'Save Changes'}
        </button>
        <button type="button" className="logi-btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
