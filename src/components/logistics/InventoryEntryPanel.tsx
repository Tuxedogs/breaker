import { useEffect, useState } from 'react';
import type { InventoryEntry, Material, Location } from '../../data/models';

interface Props {
  entry: InventoryEntry | null;
  materials: Material[];
  locations: Location[];
  onSave: (entry: InventoryEntry) => void;
  onCancel: () => void;
}

export default function InventoryEntryPanel({ entry, materials, locations, onSave, onCancel }: Props) {
  const [materialId, setMaterialId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [quality, setQuality] = useState('');
  const [locationId, setLocationId] = useState('');
  const [containerName, setContainerName] = useState('');

  useEffect(() => {
    if (entry) {
      setMaterialId(entry.materialId);
      setQuantity(String(entry.quantity));
      setLocationId(entry.locationId);
      setContainerName(entry.containerName ?? '');
    } else {
      setMaterialId(materials[0]?.id ?? '');
      setQuantity('');
      setLocationId(locations[0]?.id ?? '');
      setContainerName('');
    }
  }, [entry, materials, locations]);

  function handleSave() {
    const qty = parseFloat(quantity);
    if (!materialId || !locationId || isNaN(qty) || qty <= 0) return;
    onSave({
      id: entry?.id ?? String(Date.now()),
      materialId,
      quantity: qty,
      quality: parseInt(quality) || 0,
      locationId,
      containerName: containerName.trim() || undefined,
      updatedAt: new Date().toISOString(),
    });
  }

  const isNew = entry === null;

  return (
    <div className="logi-entry-panel">
      <div className="logi-entry-panel-header">
        <span className="logi-entry-panel-title">{isNew ? 'Add Entry' : 'Edit Entry'}</span>
        <button type="button" className="logi-panel-close-btn" onClick={onCancel} aria-label="Close panel">
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="logi-form-field">
        <label htmlFor="inv-material" className="logi-form-label">Material</label>
        <select
          id="inv-material"
          className="logi-form-select"
          value={materialId}
          onChange={(e) => setMaterialId(e.target.value)}
        >
          {materials.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <div className="logi-form-field">
        <label htmlFor="inv-quantity" className="logi-form-label">Quantity</label>
        <input
          id="inv-quantity"
          type="number"
          className="logi-form-input"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="0.00"
          min="0"
          step="0.01"
        />
      </div>

      <div className="logi-form-field">
        <label htmlFor="inv-location" className="logi-form-label">Location</label>
        <select
          id="inv-location"
          className="logi-form-select"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
        >
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      <div className="logi-form-field">
        <label htmlFor="inv-quality" className="logi-form-label">Quality</label>
        <input
          id="inv-quality"
          type="number"
          className="logi-form-input"
          value={quality}
          onChange={(e) => setQuality(e.target.value)}
          placeholder="0"
          min="0"
          max="1000"
          step="1"
        />
      </div>

      

      <div className="logi-form-field">
        <label htmlFor="inv-container" className="logi-form-label">Container (optional)</label>
        <input
          id="inv-container"
          type="text"
          className="logi-form-input"
          value={containerName}
          onChange={(e) => setContainerName(e.target.value)}
          placeholder="Box A, Storage Unit 3…"
        />
      </div>

      <div className="logi-entry-panel-actions">
        <button type="button" className="logi-btn-primary" onClick={handleSave}>
          {isNew ? 'Add Entry' : 'Save Changes'}
        </button>
        <button type="button" className="logi-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
