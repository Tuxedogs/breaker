import { useEffect, useMemo, useRef, useState } from 'react';
import { createInventoryEntryDraft, useLogisticsStore } from '../../stores/logisticsStore';
import { getInventoryUnitLabel, resolveInventoryUnitType } from '../../lib/logistics/inventory';
import {
  buildInventoryLocationLookup,
  resolveInventoryLocationByInput,
} from '../../lib/logistics/inventoryLocationOptions';
import { getInventoryAddReadinessBlockReason } from '../../lib/logistics/inventoryFreshness';
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
  target?: InventoryQuickAddTarget;
  materials: MaterialTemplate[];
  locations: InventoryLocation[];
  onSave: (entries: InventoryEntry[]) => void | Promise<void>;
  onCancel: () => void;
  initialLocationId?: string;
  initialQuality?: number;
  lockMaterial?: boolean;
  subtitle?: string;
  fixture?: {
    locationId: string;
    qualityGroups: Array<{ quality: string; quantities: string[] }>;
    createEntryId: () => string;
    timestamp: string;
    bypassFreshnessGuard?: boolean;
    syncWarning?: string;
  };
};

type BoxQuantityDraft = {
  id: string;
  entryId: string;
  createdAt: string;
  value: string;
};

type QualityGroupDraft = {
  id: string;
  quality: string;
  boxes: BoxQuantityDraft[];
};

const MAX_QUALITY_GROUPS = 5;

function normalizeItemLookup(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function createNewInventoryId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseQuality(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1000) return undefined;
  return parsed;
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
  initialLocationId,
  initialQuality,
  lockMaterial = target !== undefined,
  subtitle = target ? 'Quick add for build queue material' : 'Add physical boxes to inventory',
  fixture,
}: Props) {
  const materialIdentities = useMaterialIdentityIndex();
  const inventorySync = useLogisticsStore((state) => state.inventorySync);
  const [selectedMaterialId, setSelectedMaterialId] = useState(target?.materialId ?? '');
  const material = target?.material ?? materials.find((entry) => entry.id === selectedMaterialId);
  const displayName = target?.displayName ?? material?.name ?? '';
  const identity = findIdentityForMaterial(material, materialIdentities);
  const showUnrefined = isRefinableScuMineable(material, identity);
  const unitType: InventoryUnitType = material
    ? resolveInventoryUnitType(material)
    : 'scu';
  const unitLabel = material ? getInventoryUnitLabel(material) : (unitType === 'scu' ? 'SCU' : 'unit');

  const nextDraftId = useRef(1);
  const createDraftId = (kind: 'quality' | 'box') => `${kind}-${nextDraftId.current++}`;
  const createBoxDraft = (value = ''): BoxQuantityDraft => ({
    id: createDraftId('box'),
    entryId: fixture?.createEntryId() ?? createNewInventoryId(),
    createdAt: fixture?.timestamp ?? new Date().toISOString(),
    value,
  });
  const [locationId, setLocationId] = useState(fixture?.locationId ?? initialLocationId ?? '');
  const [locationSearch, setLocationSearch] = useState(
    () => locations.find((entry) => entry.id === (fixture?.locationId ?? initialLocationId))?.name ?? '',
  );
  const [qualityGroups, setQualityGroups] = useState<QualityGroupDraft[]>(() => {
    const initial = fixture?.qualityGroups ?? [{
      quality: initialQuality === undefined ? '' : String(initialQuality),
      quantities: [''],
    }];
    return initial.map((group, groupIndex) => ({
      id: `quality-initial-${groupIndex + 1}`,
      quality: group.quality,
      boxes: group.quantities.map((value) => createBoxDraft(value)),
    }));
  });
  const [unrefined, setUnrefined] = useState(false);
  const [hasTriedSave, setHasTriedSave] = useState(false);
  const [errorMessage, setErrorMessage] = useState(fixture?.syncWarning ?? '');
  const [isSaving, setIsSaving] = useState(false);

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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSaving, onCancel]);

  function addQualityGroup() {
    setQualityGroups((current) => current.length >= MAX_QUALITY_GROUPS
      ? current
      : [...current, {
          id: createDraftId('quality'),
          quality: '',
          boxes: [createBoxDraft()],
        }]);
  }

  function removeQualityGroup(groupId: string) {
    setQualityGroups((current) => current.filter((group) => group.id !== groupId));
  }

  function updateQuality(groupId: string, value: string) {
    setQualityGroups((current) => current.map((group) => (
      group.id === groupId ? { ...group, quality: value } : group
    )));
  }

  function addBox(groupId: string) {
    setQualityGroups((current) => current.map((group) => (
      group.id === groupId
        ? { ...group, boxes: [...group.boxes, createBoxDraft()] }
        : group
    )));
  }

  function removeBox(groupId: string, boxId: string) {
    setQualityGroups((current) => current.map((group) => (
      group.id === groupId
        ? { ...group, boxes: group.boxes.filter((box) => box.id !== boxId) }
        : group
    )));
  }

  function updateBox(groupId: string, boxId: string, value: string) {
    setQualityGroups((current) => current.map((group) => (
      group.id === groupId
        ? {
            ...group,
            boxes: group.boxes.map((box) => box.id === boxId ? { ...box, value } : box),
          }
        : group
    )));
  }

  function buildEntries(): InventoryEntry[] | null {
    if (!material || !resolvedLocationId) return null;

    const entries: InventoryEntry[] = [];

    if (qualityGroups.length === 0) return null;
    for (const group of qualityGroups) {
      const parsedQuality = parseQuality(group.quality);
      if (parsedQuality === undefined || group.boxes.length === 0) return null;

      for (const box of group.boxes) {
        const quantity = Number(box.value);
        if (!Number.isFinite(quantity) || quantity <= 0) return null;
        const timestamp = box.createdAt;
        const id = box.entryId;

        if (showUnrefined) {
          const itemKind: InventoryItemKind = unrefined ? 'ore' : 'refined';
          entries.push(createInventoryEntryDraft({
            id,
            recordKind: 'box',
            materialId: material.id,
            materialType: unrefined ? 'ore' : 'refined',
            itemName: displayName,
            itemKind,
            unitType: 'scu',
            catalogSource: 'api' as InventoryCatalogSource,
            quality: parsedQuality,
            quantity,
            boxSize: quantity,
            locationId: resolvedLocationId,
            createdAt: timestamp,
            updatedAt: timestamp,
          }));
          continue;
        }

        const itemKind = deriveKindFromMaterial(material);
        entries.push(createInventoryEntryDraft({
          id,
          recordKind: 'box',
          materialId: material.id,
          materialType: material.materialType,
          itemName: displayName,
          itemKind,
          unitType: unitType,
          catalogSource: 'api' as InventoryCatalogSource,
          quality: parsedQuality,
          quantity,
          boxSize: quantity,
          locationId: resolvedLocationId,
          createdAt: timestamp,
          updatedAt: timestamp,
        }));
      }
    }

    return entries.length > 0 ? entries : null;
  }

  async function handleSave() {
    if (isSaving) return;
    setHasTriedSave(true);
    setErrorMessage('');

    const entries = buildEntries();
    if (!entries) {
      if (!resolvedLocationId) {
        setErrorMessage('Choose a known inventory location.');
        return;
      }
      if (!material) {
        setErrorMessage('Choose a known inventory item.');
        return;
      }
      setErrorMessage('Enter a valid quality and a quantity greater than zero for every box.');
      return;
    }

    if (!fixture?.bypassFreshnessGuard) {
      const auth = getOnlinePersistenceAuth();
      const blockReason = getInventoryAddReadinessBlockReason(
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
    }

    setIsSaving(true);
    try {
      await onSave(entries);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  }

  const qualityError = qualityGroups.some((group) => parseQuality(group.quality) === undefined);
  const quantityError = qualityGroups.some((group) => group.boxes.length === 0 || group.boxes.some((box) => {
    const parsed = Number(box.value);
    return !Number.isFinite(parsed) || parsed <= 0;
  }));
  const previewGroups = qualityGroups.map((group) => ({
    quality: parseQuality(group.quality),
    quantity: group.boxes.reduce((sum, box) => {
      const value = Number(box.value);
      return sum + (Number.isFinite(value) && value > 0 ? value : 0);
    }, 0),
    boxes: group.boxes.filter((box) => Number(box.value) > 0).length,
  }));
  const previewBoxCount = previewGroups.reduce((sum, group) => sum + group.boxes, 0);
  const previewTotal = previewGroups.reduce((sum, group) => sum + group.quantity, 0);
  const previewLocation = locations.find((entry) => entry.id === resolvedLocationId)?.name || locationSearch.trim() || 'Choose a location';

  return (
    <div
      className="bq-inv-quick-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!isSaving) onCancel();
      }}
    >
      <div
        className="bq-inv-quick-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bq-inv-quick-title"
        aria-busy={isSaving}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="bq-inv-quick-head">
          <div>
            <h3 id="bq-inv-quick-title">Add Inventory</h3>
            <p className="bq-inv-quick-subtitle">{subtitle}</p>
          </div>
          <button type="button" className="bq-inv-quick-close" aria-label="Close add inventory" onClick={onCancel}>×</button>
        </div>

        <div className="bq-inv-quick-body">
          <div className="bq-inv-quick-context">
            <div>
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
            </div>

            <div className="logi-form-field">
              <span className="logi-form-label">Material</span>
              {lockMaterial && material ? (
                <>
                  <div className="bq-inv-quick-material-value" aria-label={`Material ${displayName}`}>
                    <span>{displayName}</span>
                    <span className="bq-inv-quick-material-lock" aria-hidden="true">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
                        <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
                      </svg>
                      Locked
                    </span>
                  </div>
                  {target ? <span className="bq-inv-quick-material-helper">Add other materials from the Inventory page.</span> : null}
                </>
              ) : (
                <select
                  className={`logi-form-select${hasTriedSave && !material ? ' logi-form-input--error' : ''}`}
                  value={selectedMaterialId}
                  onChange={(event) => {
                    setSelectedMaterialId(event.target.value);
                    setUnrefined(false);
                  }}
                  aria-label="Item"
                >
                  <option value="">Choose an item</option>
                  {materials.slice().sort((left, right) => left.name.localeCompare(right.name)).map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.name}</option>
                  ))}
                </select>
              )}
              {hasTriedSave && !material ? <span className="logi-form-error">Choose a known inventory item.</span> : null}
            </div>
          </div>

          <div className="bq-inv-quick-workspace">

          <div className="bq-inv-quick-quality-groups">
            <div className="bq-inv-quick-quality-title-row">
              <div>
                <strong>Individual Boxes</strong>
                <span>Group physical boxes by quality. Each amount creates a separate inventory record.</span>
              </div>
              <span className="bq-inv-quick-quality-count">{qualityGroups.length} / {MAX_QUALITY_GROUPS} qualities</span>
            </div>
            {qualityGroups.map((group, groupIndex) => {
              const groupQualityError = hasTriedSave && parseQuality(group.quality) === undefined;
              const groupPreview = previewGroups[groupIndex];
              return (
                <section key={group.id} className="bq-inv-quick-quality-group" aria-label={`Quality group ${groupIndex + 1}`}>
                  <div className="bq-inv-quick-quality-head">
                    <label htmlFor={`bq-inv-quick-quality-${group.id}`} className="bq-inv-quick-quality-value">
                      <span>Quality (0–1000)</span>
                      <input
                        id={`bq-inv-quick-quality-${group.id}`}
                        type="number"
                        className={`logi-form-input${groupQualityError ? ' logi-form-input--error' : ''}`}
                        value={group.quality}
                        onChange={(event) => updateQuality(group.id, event.target.value)}
                        placeholder="500"
                        aria-label={`Quality group ${groupIndex + 1} value`}
                        min={0}
                        max={1000}
                        step={1}
                      />
                    </label>
                    <span className="bq-inv-quick-quality-summary">
                      {groupPreview.boxes} {groupPreview.boxes === 1 ? 'box' : 'boxes'}
                      <i aria-hidden="true">·</i>
                      {groupPreview.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unitLabel}
                    </span>
                    <button
                      type="button"
                      className="bq-inv-quick-remove"
                      onClick={() => removeQualityGroup(group.id)}
                      aria-label={`Remove quality group ${groupIndex + 1}`}
                    >×</button>
                  </div>

                  <div className="bq-inv-quick-boxes">
                    <div className="bq-inv-quick-box-head" aria-hidden="true">
                      <span>Box</span>
                      <span>Amount ({unitLabel})</span>
                    </div>
                    {group.boxes.map((box, boxIndex) => {
                      const parsedQuantity = Number(box.value);
                      const boxError = hasTriedSave && (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0);
                      return (
                        <div key={box.id} className="bq-inv-quick-box-row">
                          <span className="bq-inv-quick-box-marker">Box {String(boxIndex + 1).padStart(2, '0')}</span>
                          <label htmlFor={`bq-inv-quick-qty-${box.id}`} className="bq-inv-quick-box-input">
                          <input
                            id={`bq-inv-quick-qty-${box.id}`}
                            type="number"
                            className={`logi-form-input${boxError ? ' logi-form-input--error' : ''}`}
                            value={box.value}
                            onChange={(event) => updateBox(group.id, box.id, event.target.value)}
                            placeholder={`Quantity (${unitLabel})`}
                            aria-label={`Box ${boxIndex + 1} amount at Quality ${group.quality || 'unset'}`}
                            min={0}
                            step={unitType === 'scu' ? 0.01 : 1}
                          />
                          </label>
                          <button
                            type="button"
                            className="bq-inv-quick-remove"
                            onClick={() => removeBox(group.id, box.id)}
                            aria-label={`Remove box ${boxIndex + 1} from quality group ${groupIndex + 1}`}
                          >×</button>
                        </div>
                      );
                    })}
                    <button type="button" className="bq-inv-quick-add-box" onClick={() => addBox(group.id)}>+ Add Box</button>
                  </div>
                </section>
              );
            })}
            <button
              type="button"
              className="bq-inv-quick-add-quality"
              onClick={addQualityGroup}
              disabled={qualityGroups.length >= MAX_QUALITY_GROUPS}
            >+ Add Quality (up to 5)</button>
          </div>

          <aside className="bq-inv-quick-preview" aria-label="Inventory preview">
            <h4>Inventory Preview</h4>
            <div className="bq-inv-preview-card bq-inv-preview-card--primary">
              <span className="bq-inv-preview-icon" aria-hidden="true">◇</span>
              <div><strong>{previewBoxCount} individual {previewBoxCount === 1 ? 'box' : 'boxes'}</strong><span>{previewTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unitLabel} total</span></div>
            </div>
            <div className="bq-inv-preview-card">
              <span className="bq-inv-preview-icon" aria-hidden="true">⌖</span>
              <div><small>Location</small><strong>{previewLocation}</strong></div>
            </div>
            <div className="bq-inv-preview-card bq-inv-preview-distribution">
              <div><small>Quality distribution</small></div>
              {previewGroups.filter((group) => group.quality !== undefined && group.quantity > 0).map((group) => (
                <div key={group.quality}><span>Quality {group.quality}</span><strong>{group.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unitLabel}</strong></div>
              ))}
              <div className="bq-inv-preview-total"><span>Total</span><strong>{previewTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unitLabel}</strong></div>
            </div>
            <div className="bq-inv-preview-note">Individual boxes remain separate inventory records.</div>
          </aside>
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

        </div>

        <div className="bq-inv-quick-actions">
          <div className="bq-inv-quick-feedback" aria-live="polite">
            {hasTriedSave && (qualityError || quantityError) ? (
              <span className="logi-form-error">Enter a valid quality and a quantity greater than zero for every box.</span>
            ) : null}
            {errorMessage ? <span className="logi-form-error">{errorMessage}</span> : null}
          </div>
          <div className="bq-inv-quick-action-buttons">
            <button type="button" className="bq-btn" onClick={onCancel} disabled={isSaving}>Cancel</button>
            <button
              type="button"
              className="bq-btn bq-btn--confirm"
              onClick={() => void handleSave()}
              disabled={isSaving}
            >
              {isSaving ? 'Adding…' : 'Add to inventory'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
