import { useMemo, useState } from 'react';
import { createInventoryEntryDraft } from '../../stores/logisticsStore';
import type { InventoryEntry, InventoryLocation, MaterialTemplate } from '../../types/logistics';

interface Props {
  entry: InventoryEntry | null;
  materials: MaterialTemplate[];
  locations: InventoryLocation[];
  onSave: (entries: InventoryEntry[]) => void;
  onCancel: () => void;
}

interface DraftRow {
  id: string;
  locationId: string;
  materialId: string;
  quality: string;
  quantity: string;
  container: string;
}

function createDraftRow(locationId: string, materialId: string): DraftRow {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    locationId,
    materialId,
    quality: '',
    quantity: '',
    container: '',
  };
}

export default function InventoryEntryPanel({ entry, materials, locations, onSave, onCancel }: Props) {
  const defaultMaterialId = materials[0]?.id ?? '';
  const defaultLocationId = locations[0]?.id ?? '';
  const [stickyLocationId, setStickyLocationId] = useState(defaultLocationId);
  const [rows, setRows] = useState<DraftRow[]>(() => [createDraftRow(defaultLocationId, defaultMaterialId)]);
  const [materialId, setMaterialId] = useState(entry?.materialId ?? defaultMaterialId);
  const [quantity, setQuantity] = useState(entry ? String(entry.quantity) : '');
  const [quality, setQuality] = useState(entry ? String(entry.quality) : '');
  const [locationId, setLocationId] = useState(entry?.locationId ?? defaultLocationId);
  const [container, setContainer] = useState(entry?.container ?? '');

  function handleSave() {
    const qty = parseFloat(quantity);
    if (!materialId || !locationId || isNaN(qty) || qty <= 0) return;
    onSave([createInventoryEntryDraft({
      id: entry?.id ?? String(Date.now()),
      materialId,
      quantity: qty,
      quality: Math.max(0, Math.min(1000, parseInt(quality) || 0)),
      locationId,
      container: container.trim() || undefined,
      createdAt: entry?.createdAt,
      updatedAt: new Date().toISOString(),
    })]);
  }

  function updateRow(id: string, patch: Partial<DraftRow>) {
    setRows((current) => current.map((row) => {
      if (row.id !== id) return row;
      if (patch.locationId) setStickyLocationId(patch.locationId);
      return { ...row, ...patch };
    }));
  }

  function addRow(location = stickyLocationId) {
    setRows((current) => [...current, createDraftRow(location || defaultLocationId, defaultMaterialId)]);
  }

  function removeRow(id: string) {
    setRows((current) => current.length === 1 ? current : current.filter((row) => row.id !== id));
  }

  function handleBatchSave() {
    const timestamp = new Date().toISOString();
    const nextEntries: InventoryEntry[] = [];
    rows.forEach((row, index) => {
      const qty = parseFloat(row.quantity);
      if (!row.locationId || !row.materialId || isNaN(qty) || qty <= 0) return;
      nextEntries.push(createInventoryEntryDraft({
        id: `inv-${Date.now()}-${index}`,
        materialId: row.materialId,
        quantity: qty,
        quality: Math.max(0, Math.min(1000, parseInt(row.quality) || 0)),
        locationId: row.locationId,
        container: row.container.trim() || undefined,
        updatedAt: timestamp,
      }));
    });

    if (nextEntries.length === 0) return;
    onSave(nextEntries);
    setRows([createDraftRow(stickyLocationId || defaultLocationId, defaultMaterialId)]);
  }

  const isNew = entry === null;
  const validBatchRows = useMemo(
    () => rows.filter((row) => parseFloat(row.quantity) > 0 && row.locationId && row.materialId).length,
    [rows],
  );

  return (
    <div className="logi-entry-panel">
      <div className="logi-entry-panel-header">
        <span className="logi-entry-panel-title">{isNew ? 'Fast Add Inventory' : 'Edit Stack'}</span>
        <button type="button" className="logi-panel-close-btn" onClick={onCancel} aria-label="Close panel">
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {isNew ? (
        <>
          <div className="logi-fast-add-grid" role="group" aria-label="Fast add inventory rows">
            {rows.map((row, index) => (
              <div key={row.id} className="logi-fast-add-row">
                <div className="logi-fast-add-row-head">
                  <span>Stack {index + 1}</span>
                  <button type="button" className="logi-panel-close-btn" onClick={() => removeRow(row.id)} aria-label={`Remove row ${index + 1}`}>
                    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="logi-form-field">
                  <label htmlFor={`fast-location-${row.id}`} className="logi-form-label">Location</label>
                  <select id={`fast-location-${row.id}`} className="logi-form-select" value={row.locationId} onChange={(event) => updateRow(row.id, { locationId: event.target.value })}>
                    {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                  </select>
                </div>
                <div className="logi-form-field">
                  <label htmlFor={`fast-material-${row.id}`} className="logi-form-label">Material</label>
                  <select id={`fast-material-${row.id}`} className="logi-form-select" value={row.materialId} onChange={(event) => updateRow(row.id, { materialId: event.target.value })}>
                    {materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
                  </select>
                </div>
                <div className="logi-fast-add-pair">
                  <div className="logi-form-field">
                    <label htmlFor={`fast-quality-${row.id}`} className="logi-form-label">Quality</label>
                    <input id={`fast-quality-${row.id}`} type="number" className="logi-form-input" value={row.quality} onChange={(event) => updateRow(row.id, { quality: event.target.value })} placeholder="900" min="0" max="1000" step="1" />
                  </div>
                  <div className="logi-form-field">
                    <label htmlFor={`fast-quantity-${row.id}`} className="logi-form-label">Quantity</label>
                    <input id={`fast-quantity-${row.id}`} type="number" className="logi-form-input" value={row.quantity} onChange={(event) => updateRow(row.id, { quantity: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') addRow(row.locationId); }} placeholder="0.00" min="0" step="0.01" />
                  </div>
                </div>
                <div className="logi-form-field">
                  <label htmlFor={`fast-container-${row.id}`} className="logi-form-label">Container (optional)</label>
                  <input id={`fast-container-${row.id}`} type="text" className="logi-form-input" value={row.container} onChange={(event) => updateRow(row.id, { container: event.target.value })} placeholder="Box A, hold 3" />
                </div>
              </div>
            ))}
          </div>
          <div className="logi-entry-panel-actions">
            <button type="button" className="logi-btn-primary" onClick={handleBatchSave}>Add {validBatchRows || ''} Stack{validBatchRows === 1 ? '' : 's'}</button>
            <button type="button" className="logi-btn-ghost" onClick={() => addRow()}>Add Row</button>
            <button type="button" className="logi-btn-ghost" onClick={onCancel}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <div className="logi-form-field">
            <label htmlFor="inv-location" className="logi-form-label">Location</label>
            <select id="inv-location" className="logi-form-select" value={locationId} onChange={(event) => setLocationId(event.target.value)}>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
          </div>
          <div className="logi-form-field">
            <label htmlFor="inv-material" className="logi-form-label">Material</label>
            <select id="inv-material" className="logi-form-select" value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
              {materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
            </select>
          </div>
          <div className="logi-form-field">
            <label htmlFor="inv-quality" className="logi-form-label">Quality</label>
            <input id="inv-quality" type="number" className="logi-form-input" value={quality} onChange={(event) => setQuality(event.target.value)} placeholder="0" min="0" max="1000" step="1" />
          </div>
          <div className="logi-form-field">
            <label htmlFor="inv-quantity" className="logi-form-label">Quantity</label>
            <input id="inv-quantity" type="number" className="logi-form-input" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="0.00" min="0" step="0.01" />
          </div>
          <div className="logi-form-field">
            <label htmlFor="inv-container" className="logi-form-label">Container (optional)</label>
            <input id="inv-container" type="text" className="logi-form-input" value={container} onChange={(event) => setContainer(event.target.value)} placeholder="Box A, Storage Unit 3" />
          </div>
          <div className="logi-entry-panel-actions">
            <button type="button" className="logi-btn-primary" onClick={handleSave}>Save Changes</button>
            <button type="button" className="logi-btn-ghost" onClick={onCancel}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}
