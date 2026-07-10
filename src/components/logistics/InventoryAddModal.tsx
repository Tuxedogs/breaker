import { useEffect, useMemo, useState } from 'react';
import { createInventoryEntryDraft, useLogisticsStore } from '../../stores/logisticsStore';
import { getInventoryUnitLabel, resolveInventoryUnitType } from '../../lib/logistics/inventory';
import {
  buildInventoryLocationLookup,
  resolveInventoryLocationByInput,
} from '../../lib/logistics/inventoryLocationOptions';
import { getInventoryMutationBlockReason } from '../../lib/logistics/inventoryFreshness';
import { getOnlinePersistenceAuth } from '../../lib/userOnlinePersistence';
import { type MaterialIdentity, useMaterialIdentityIndex } from '../../lib/logistics/materialIdentityIndex';
import type {
  InventoryCatalogSource,
  InventoryEntry,
  InventoryItemKind,
  InventoryLocation,
  InventoryUnitType,
  MaterialTemplate,
} from '../../types/logistics';

export type InventoryQuickAddTarget = {
  materialId: string;
  displayName: string;
  material?: MaterialTemplate;
};

type Props = {
  target: InventoryQuickAddTarget;
  materials: MaterialTemplate[];
  locations: InventoryLocation[];
  onSave: (entries: InventoryEntry[]) => void;
  onCancel: () => void;
};

function normalizeItemLookup(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function createNewInventoryId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

type MineableRuntimeFields = MaterialTemplate & {
  isRefinable?: boolean;
  canComeFromRefinery?: boolean;
  sourceGroups?: string[];
};

function findIdentityForMaterial(
  material: MaterialTemplate | undefined,
  identities: MaterialIdentity[],
): MaterialIdentity | undefined {
  if (!material) return undefined;
  const idKey = normalizeItemLookup(material.id);
  const nameKey = normalizeItemLookup(material.name);
  return identities.find((identity) => {
    const identityKey = normalizeItemLookup(identity.materialKey);
    const displayKey = normalizeItemLookup(identity.displayName);
    return identityKey === idKey || displayKey === nameKey;
  });
}

function isRefinableScuMineable(material: MaterialTemplate | undefined, identity?: MaterialIdentity): boolean {
  if (!material) return false;
  const flagged = material as MineableRuntimeFields;
  const hasRefinerySource = flagged.isRefinable === true ||
    flagged.canComeFromRefinery === true ||
    flagged.sourceGroups?.includes('ores') === true;
  const usesScu = identity?.unitType === 'scu' ||
    material.materialType === 'ore' ||
    material.materialType === 'refined';
  return hasRefinerySource && usesScu;
}

function resizeBoxQuantities(current: string[], nextCount: number): string[] {
  const count = Math.max(1, Math.min(24, Math.trunc(nextCount) || 1));
  if (current.length === count) return current;
  if (current.length < count) {
    return [...current, ...Array.from({ length: count - current.length }, () => '')];
  }
  return current.slice(0, count);
}

function LocationField({
  locations,
  locationId,
  locationSearch,
  hasError,
  onLocationIdChange,
  onLocationSearchChange,
}: {
  locations: InventoryLocation[];
  locationId: string;
  locationSearch: string;
  hasError: boolean;
  onLocationIdChange: (id: string) => void;
  onLocationSearchChange: (search: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const query = locationSearch.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!query) return locations.slice(0, 12);
    return locations
      .filter((location) => {
        const haystack = [location.name, location.system, location.category, location.type]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 12);
  }, [locations, query]);

  return (
    <div className="logi-form-field bq-inv-quick-location">
      <label htmlFor="bq-inv-quick-location" className="logi-form-label">Location</label>
      <input
        id="bq-inv-quick-location"
        type="text"
        className={`logi-form-input${locationId ? ' logi-form-input--selected' : ''}${hasError ? ' logi-form-input--error' : ''}`}
        value={locationSearch}
        onChange={(event) => {
          onLocationSearchChange(event.target.value);
          onLocationIdChange('');
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder="Search or type location..."
        autoComplete="off"
      />
      {open && suggestions.length > 0 ? (
        <ul className="bq-inv-quick-location-list" role="listbox">
          {suggestions.map((location) => (
            <li key={location.id}>
              <button
                type="button"
                role="option"
                className="bq-inv-quick-location-option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onLocationIdChange(location.id);
                  onLocationSearchChange(location.name);
                  setOpen(false);
                }}
              >
                <span>{location.name}</span>
                {location.system ? <em>{location.system}</em> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function InventoryAddModal({
  target,
  materials,
  locations,
  onSave,
  onCancel,
}: Props) {
  const materialIdentities = useMaterialIdentityIndex();
  const inventorySync = useLogisticsStore((state) => state.inventorySync);
  const material = target.material ?? materials.find((entry) => entry.id === target.materialId);
  const identity = findIdentityForMaterial(material, materialIdentities);
  const showUnrefined = isRefinableScuMineable(material, identity);
  const unitType: InventoryUnitType = material
    ? resolveInventoryUnitType(material)
    : 'scu';
  const unitLabel = material ? getInventoryUnitLabel(material) : (unitType === 'scu' ? 'SCU' : 'unit');

  const [locationId, setLocationId] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [boxCount, setBoxCount] = useState('1');
  const [boxQuantities, setBoxQuantities] = useState<string[]>(['']);
  const [quality, setQuality] = useState('');
  const [unrefined, setUnrefined] = useState(false);
  const [hasTriedSave, setHasTriedSave] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const locationLookup = useMemo(() => buildInventoryLocationLookup(locations), [locations]);

  const resolvedLocationId = (() => {
    if (locationId) return locationId;
    const search = locationSearch.trim();
    if (!search) return '';
    const resolved = resolveInventoryLocationByInput(search, locationLookup);
    if (resolved) return resolved.id;
    const matches = locations.filter((location) => location.name.toLowerCase() === search.toLowerCase());
    return matches.length === 1 ? matches[0].id : '';
  })();

  useEffect(() => {
    const parsedCount = Math.max(1, Math.min(24, parseInt(boxCount, 10) || 1));
    setBoxQuantities((current) => resizeBoxQuantities(current, parsedCount));
  }, [boxCount]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  function buildEntries(): InventoryEntry[] | null {
    if (!material || !resolvedLocationId) return null;

    const parsedQuality = parseOptionalQuality(quality);
    const entries: InventoryEntry[] = [];

    for (const quantityValue of boxQuantities) {
      const quantity = parseFloat(quantityValue);
      if (!Number.isFinite(quantity) || quantity <= 0) return null;

      if (showUnrefined) {
        const itemKind: InventoryItemKind = unrefined ? 'ore' : 'refined';
        entries.push(createInventoryEntryDraft({
          id: createNewInventoryId(),
          materialId: material.id,
          materialType: unrefined ? 'ore' : 'refined',
          itemName: target.displayName,
          itemKind,
          unitType: 'scu',
          catalogSource: 'api' as InventoryCatalogSource,
          quality: parsedQuality,
          quantity,
          locationId: resolvedLocationId,
          updatedAt: new Date().toISOString(),
        }));
        continue;
      }

      const itemKind = deriveKindFromMaterial(material);
      entries.push(createInventoryEntryDraft({
        id: createNewInventoryId(),
        materialId: material.id,
        materialType: material.materialType,
        itemName: target.displayName,
        itemKind,
        unitType: unitType,
        catalogSource: 'api' as InventoryCatalogSource,
        quality: parsedQuality,
        quantity,
        locationId: resolvedLocationId,
        updatedAt: new Date().toISOString(),
      }));
    }

    return entries.length > 0 ? entries : null;
  }

  function handleSave() {
    setHasTriedSave(true);
    setErrorMessage('');

    const auth = getOnlinePersistenceAuth();
    const blockReason = getInventoryMutationBlockReason(
      inventorySync,
      auth.userId,
      {
        hasAccessToken: Boolean(auth.accessToken),
        hasHydratedPersist: inventorySync.hasHydratedPersist,
      },
    );
    if (blockReason) {
      setErrorMessage(blockReason);
      return;
    }

    const entries = buildEntries();
    if (!entries) {
      if (!resolvedLocationId) {
        setErrorMessage('Choose a known inventory location.');
        return;
      }
      setErrorMessage('Enter a quantity greater than zero for each box.');
      return;
    }

    onSave(entries);
  }

  const quantityError = boxQuantities.some((value) => {
    const parsed = parseFloat(value);
    return !Number.isFinite(parsed) || parsed <= 0;
  });

  return (
    <div className="bq-inv-quick-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="bq-inv-quick-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bq-inv-quick-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="bq-inv-quick-head">
          <div>
            <h3 id="bq-inv-quick-title">Add Inventory</h3>
            <p className="bq-inv-quick-subtitle">Quick add for build queue material</p>
          </div>
          <button type="button" className="bq-btn bq-btn--compact" onClick={onCancel}>Cancel</button>
        </div>

        <div className="bq-inv-quick-body">
          <div className="logi-form-field">
            <span className="logi-form-label">Material</span>
            <input
              type="text"
              className="logi-form-input logi-form-input--selected"
              value={target.displayName}
              readOnly
              aria-readonly="true"
            />
          </div>

          <LocationField
            locations={locations}
            locationId={locationId}
            locationSearch={locationSearch}
            hasError={hasTriedSave && !resolvedLocationId}
            onLocationIdChange={setLocationId}
            onLocationSearchChange={setLocationSearch}
          />
          {hasTriedSave && !resolvedLocationId ? (
            <span className="logi-form-error">Choose a known inventory location.</span>
          ) : null}

          <div className="logi-form-row-pair">
            <div className="logi-form-field">
              <label htmlFor="bq-inv-quick-box-count" className="logi-form-label">Number of boxes</label>
              <input
                id="bq-inv-quick-box-count"
                type="number"
                className="logi-form-input"
                min={1}
                max={24}
                step={1}
                value={boxCount}
                onChange={(event) => setBoxCount(event.target.value)}
              />
            </div>
            <div className="logi-form-field">
              <label htmlFor="bq-inv-quick-quality" className="logi-form-label">
                Quality <span className="logi-form-label-sub">(0-1000)</span>
              </label>
              <input
                id="bq-inv-quick-quality"
                type="number"
                className="logi-form-input"
                value={quality}
                onChange={(event) => setQuality(event.target.value)}
                placeholder="Optional"
                min={0}
                max={1000}
                step={1}
              />
            </div>
          </div>

          {showUnrefined ? (
            <label className="bq-inv-quick-check">
              <input
                type="checkbox"
                checked={unrefined}
                onChange={(event) => setUnrefined(event.target.checked)}
              />
              <span>Unrefined (raw ore)</span>
            </label>
          ) : null}

          <div className="bq-inv-quick-boxes">
            <span className="logi-form-label">Quantity per box ({unitLabel})</span>
            {boxQuantities.map((value, index) => (
              <div key={`box-${index}`} className="bq-inv-quick-box-row">
                <label htmlFor={`bq-inv-quick-qty-${index}`} className="bq-inv-quick-box-label">
                  Box {index + 1}
                </label>
                <input
                  id={`bq-inv-quick-qty-${index}`}
                  type="number"
                  className={`logi-form-input${hasTriedSave && quantityError ? ' logi-form-input--error' : ''}`}
                  value={value}
                  onChange={(event) => {
                    const next = [...boxQuantities];
                    next[index] = event.target.value;
                    setBoxQuantities(next);
                  }}
                  placeholder="0.00"
                  min={0}
                  step={unitType === 'scu' ? 0.01 : 1}
                />
              </div>
            ))}
          </div>
          {hasTriedSave && quantityError ? (
            <span className="logi-form-error">Enter a quantity greater than zero for each box.</span>
          ) : null}
          {errorMessage ? <span className="logi-form-error">{errorMessage}</span> : null}
        </div>

        <div className="bq-inv-quick-actions">
          <button type="button" className="bq-btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="bq-btn bq-btn--confirm" onClick={handleSave}>Add to inventory</button>
        </div>
      </div>
    </div>
  );
}
