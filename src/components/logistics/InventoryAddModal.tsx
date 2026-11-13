import './inventory-add-modal.css';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createInventoryEntryDraft, useLogisticsStore } from '../../stores/logisticsStore';
import { resolveInventoryUnitType } from '../../lib/logistics/inventory';
import InventoryLocationPicker from './InventoryLocationPicker';
import { getInventoryAddReadinessBlockReason } from '../../lib/logistics/inventoryFreshness';
import { getOnlinePersistenceAuth } from '../../lib/userOnlinePersistence';
import { type MaterialIdentity, useMaterialIdentityIndex } from '../../lib/logistics/materialIdentityIndex';
import type { InventoryCatalogSource, InventoryEntry, InventoryItemKind, InventoryLocation, InventoryUnitType, ItemTemplate, MaterialTemplate } from '../../types/logistics';

export type InventoryQuickAddTarget = { materialId: string; displayName: string; material?: MaterialTemplate };
type Props = { target?: InventoryQuickAddTarget; materials: MaterialTemplate[]; locations: InventoryLocation[]; onSave: (entries: InventoryEntry[]) => void | Promise<void>; onCancel: () => void; initialLocationId?: string; initialQuality?: number; lockMaterial?: boolean; subtitle?: string; fixture?: { locationId: string; qualityGroups: Array<{ quality: string; quantities: string[] }>; createEntryId: () => string; timestamp: string; bypassFreshnessGuard?: boolean; syncWarning?: string; }; };
type QualityLotDraft = { id: string; entryId: string; createdAt: string; quality: string; amount: string };
type ItemDraft = { id: string; catalogKey: string; search: string; lots: QualityLotDraft[]; unrefined: boolean };
type CatalogItem = { key: string; id: string; name: string; kind: InventoryItemKind; category?: string; source: 'material' | 'item'; material?: MaterialTemplate; item?: ItemTemplate };
const MAX_QUALITY_LOTS = 5;

function normalizeLookup(value: string): string { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ''); }
function createNewInventoryId(): string { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function parseQuality(value: string): number | undefined { if (!value.trim()) return undefined; const parsed = Number(value.trim()); return Number.isInteger(parsed) && parsed >= 0 && parsed <= 1000 ? parsed : undefined; }
function materialKind(material: MaterialTemplate): InventoryItemKind { if (material.id === 'rawice') return 'ice'; if (material.materialType === 'ore' || material.materialType === 'refined') return 'ore'; return material.materialType === 'raw' || material.materialType === 'special' ? 'raw_mineable' : 'material'; }
function catalogItemKind(item: ItemTemplate): InventoryItemKind { return item.category === 'weapon' ? 'fps_weapon' : item.category === 'ship_part' ? 'vehicle_component' : 'crafted_item'; }
type MineableFields = MaterialTemplate & { isRefinable?: boolean; canComeFromRefinery?: boolean; sourceGroups?: string[] };
function findIdentity(material: MaterialTemplate | undefined, identities: MaterialIdentity[]) { if (!material) return undefined; const id = normalizeLookup(material.id); const name = normalizeLookup(material.name); return identities.find((identity) => normalizeLookup(identity.materialKey) === id || normalizeLookup(identity.displayName) === name); }
function isRefinable(material: MaterialTemplate | undefined, identity?: MaterialIdentity) { if (!material) return false; const fields = material as MineableFields; return (fields.isRefinable === true || fields.canComeFromRefinery === true || fields.sourceGroups?.includes('ores') === true) && (identity?.unitType === 'scu' || material.materialType === 'ore' || material.materialType === 'refined'); }

function ItemSearch({ item, catalog, locked, hasError, onTextChange, onSelect, onSelectCustom }: { item: ItemDraft; catalog: CatalogItem[]; locked: boolean; hasError: boolean; onTextChange: (value: string) => void; onSelect: (key: string) => void; onSelectCustom: () => void }) {
  const [open, setOpen] = useState(false);
  const itemSearchRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !itemSearchRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onEscape, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onEscape, true);
    };
  }, [open]);
  const selected = catalog.find((entry) => entry.key === item.catalogKey); const query = item.search.trim().toLowerCase(); const results = query ? catalog.filter((entry) => `${entry.name} ${entry.category ?? ''}`.toLowerCase().includes(query)).slice(0, 6) : catalog.slice(0, 5); const exactCanonical = Boolean(query && catalog.some((entry) => normalizeLookup(entry.name) === normalizeLookup(item.search)));
  if (locked && selected) return <div className="bq-inv-add-item-locked"><strong>{selected.name}</strong><span>Locked build queue material</span></div>;
  return <div ref={itemSearchRef} className="bq-inv-add-item-search"><input className={`logi-form-input${hasError ? ' logi-form-input--error' : ''}`} value={item.search} onFocus={() => setOpen(true)} onChange={(event) => { onTextChange(event.target.value); setOpen(true); }} placeholder="Search item..." aria-label="Search item" autoComplete="off" />{open ? <div className="bq-inv-add-item-results">{results.map((entry) => <button key={entry.key} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onSelect(entry.key); setOpen(false); }}><strong>{entry.name}</strong><span>{entry.source === 'material' ? 'Material' : entry.category ?? 'Catalog item'}</span></button>)}{query && !exactCanonical ? <button type="button" className="bq-inv-add-custom-item" onMouseDown={(event) => event.preventDefault()} onClick={() => { onSelectCustom(); setOpen(false); }}>+ Create custom item “{item.search.trim()}”</button> : null}</div> : null}</div>;
}

export default function InventoryAddModal({ target, materials, locations, onSave, onCancel, initialLocationId, initialQuality, lockMaterial = target !== undefined, subtitle = target ? 'Quick add for build queue material' : 'Add physical boxes to inventory', fixture }: Props) {
  const identities = useMaterialIdentityIndex(); const itemTemplates = useLogisticsStore((state) => state.itemTemplates); const inventoryEntries = useLogisticsStore((state) => state.inventoryEntries); const inventorySync = useLogisticsStore((state) => state.inventorySync); const createCustomInventoryLocationAsync = useLogisticsStore((state) => state.createCustomInventoryLocationAsync); const nextId = useRef(1);
  const draftId = (kind: 'item' | 'lot') => `${kind}-${nextId.current++}`; const newLot = (quality = '', amount = ''): QualityLotDraft => ({ id: draftId('lot'), entryId: fixture?.createEntryId() ?? createNewInventoryId(), createdAt: fixture?.timestamp ?? new Date().toISOString(), quality, amount });
  const catalog = useMemo<CatalogItem[]>(() => [...materials.map((material) => ({ key: `material:${material.id}`, id: material.id, name: material.name, kind: materialKind(material), category: material.materialType, source: 'material' as const, material })), ...itemTemplates.map((item) => ({ key: `item:${item.id}`, id: item.id, name: item.name, kind: catalogItemKind(item), category: item.category, source: 'item' as const, item }))].sort((a, b) => a.source === b.source ? a.name.localeCompare(b.name) : a.source === 'material' ? -1 : 1), [materials, itemTemplates]);
  const initialLots = () => (fixture?.qualityGroups ?? [{ quality: initialQuality === undefined ? '' : String(initialQuality), quantities: [''] }]).flatMap((group) => group.quantities.map((amount) => newLot(group.quality, amount)));
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [locationId, setLocationId] = useState(fixture?.locationId ?? initialLocationId ?? ''); const [items, setItems] = useState<ItemDraft[]>(() => [{ id: 'item-initial', catalogKey: target ? `material:${target.materialId}` : '', search: target?.displayName ?? '', lots: initialLots(), unrefined: false }]); const [hasTriedSave, setHasTriedSave] = useState(false); const [errorMessage, setErrorMessage] = useState(fixture?.syncWarning ?? ''); const [isSaving, setIsSaving] = useState(false); const [isCreatingLocation, setIsCreatingLocation] = useState(false);
  const location = locations.find((entry) => entry.id === locationId);
  const selectLocation = useCallback((selected: InventoryLocation) => setLocationId(selected.id), []);
  const dialogRef = useRef<HTMLDivElement>(null);

  const backdropRef = useRef<HTMLDivElement>(null);
  // iOS Safari's visual viewport shrinks and shifts independently of 100vh
  // when its browser chrome or keyboard appears. Keep the modal inside it.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const updateViewport = () => {
      const backdrop = backdropRef.current;
      if (!backdrop) return;
      backdrop.style.setProperty('--inventory-visual-top', `${viewport.offsetTop}px`);
      backdrop.style.setProperty('--inventory-visual-left', `${viewport.offsetLeft}px`);
      backdrop.style.setProperty('--inventory-visual-width', `${viewport.width}px`);
      backdrop.style.setProperty('--inventory-visual-height', `${viewport.height}px`);
    };
    updateViewport();
    viewport.addEventListener('resize', updateViewport);
    viewport.addEventListener('scroll', updateViewport);
    return () => {
      viewport.removeEventListener('resize', updateViewport);
      viewport.removeEventListener('scroll', updateViewport);
    };
  }, []);
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLButtonElement>('.bq-inv-quick-close')?.focus();
    return () => { if (trigger?.isConnected) trigger.focus(); };
  }, []);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !isSaving && !isCreatingLocation) onCancel();
    if (event.key === 'Tab') {
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') ?? []).filter((node) => node.getClientRects().length > 0);
      const first = controls[0]; const last = controls[controls.length - 1];
      if (first && last && (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    } }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown); }, [isSaving, isCreatingLocation, onCancel]);
  function mutateItem(id: string, update: (item: ItemDraft) => ItemDraft) { setItems((current) => current.map((item) => item.id === id ? update(item) : item)); }
  function selectedItem(item: ItemDraft) { return catalog.find((entry) => entry.key === item.catalogKey); }
  function customItem(item: ItemDraft) { return item.catalogKey.startsWith('manual:') && Boolean(item.search.trim()); }
  function addItem() { setItems((current) => [...current, { id: draftId('item'), catalogKey: '', search: '', lots: [newLot()], unrefined: false }]); }
  function buildEntries(): InventoryEntry[] | null { if (!location || !items.length) return null; const entries: InventoryEntry[] = []; for (const item of items) { const selected = selectedItem(item); if ((!selected && !customItem(item)) || !item.lots.length) return null; for (const lot of item.lots) { const quality = parseQuality(lot.quality); const quantity = Number(lot.amount); if (quality === undefined || !Number.isFinite(quantity) || quantity <= 0) return null; const common = { id: lot.entryId, recordKind: 'box' as const, quality, quantity, boxSize: quantity, locationId: location.id, createdAt: lot.createdAt, updatedAt: lot.createdAt }; if (!selected) entries.push(createInventoryEntryDraft({ ...common, catalogItemId: item.catalogKey, catalogSource: 'manual' as InventoryCatalogSource, itemName: item.search.trim(), itemKind: 'manual', unitType: 'unit' })); else if (selected.material) { const refinable = isRefinable(selected.material, findIdentity(selected.material, identities)); const unrefined = refinable && item.unrefined; entries.push(createInventoryEntryDraft({ ...common, materialId: selected.material.id, materialType: refinable ? (unrefined ? 'ore' : 'refined') : selected.material.materialType, catalogItemId: selected.material.id, catalogSource: 'api' as InventoryCatalogSource, itemName: selected.name, itemKind: unrefined ? 'ore' : selected.kind, unitType: unrefined ? 'scu' : resolveInventoryUnitType(selected.material) })); } else entries.push(createInventoryEntryDraft({ ...common, catalogItemId: selected.id, catalogSource: 'seed' as InventoryCatalogSource, itemName: selected.name, itemKind: selected.kind, category: selected.category, unitType: 'unit' })); } } return entries.length ? entries : null; }
  async function handleSave() { if (isSaving) return; setHasTriedSave(true); setErrorMessage(''); const entries = buildEntries(); if (!entries) { setErrorMessage(!location ? 'Choose a known inventory location.' : 'Choose an item and enter a valid quality and amount for every lot.'); return; } if (!fixture?.bypassFreshnessGuard) { const auth = getOnlinePersistenceAuth(); const reason = getInventoryAddReadinessBlockReason(inventorySync, auth.userId, { hasAccessToken: Boolean(auth.accessToken), hasHydratedPersist: inventorySync.hasHydratedPersist }); if (reason) { setErrorMessage(reason); return; } } setIsSaving(true); try { await onSave(entries); } catch (error) { setErrorMessage(error instanceof Error ? error.message : String(error)); } finally { setIsSaving(false); } }
  const createLocation = useCallback(async (name: string): Promise<boolean> => {
    if (isCreatingLocation || isSaving) return false;
    setErrorMessage('');
    setIsCreatingLocation(true);
    try {
      const created = await createCustomInventoryLocationAsync(name);
      setLocationId(created.id);
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setIsCreatingLocation(false);
    }
  }, [createCustomInventoryLocationAsync, isCreatingLocation, isSaving]);
  const invalidItems = items.some((item) => (!selectedItem(item) && !customItem(item)) || !item.lots.length || item.lots.some((lot) => parseQuality(lot.quality) === undefined || !Number.isFinite(Number(lot.amount)) || Number(lot.amount) <= 0)); const canSave = Boolean(location && items.length && !invalidItems && !isSaving && !isCreatingLocation);
  return createPortal(<div ref={backdropRef} className="bq-inv-quick-backdrop" role="presentation" onMouseDown={() => { if (locationPickerOpen) setLocationPickerOpen(false); else if (!isSaving && !isCreatingLocation) onCancel(); }}><div ref={dialogRef} className="bq-inv-quick-modal bq-inv-add-modal" role="dialog" aria-modal="true" aria-labelledby="bq-inv-quick-title" aria-busy={isSaving || isCreatingLocation} onMouseDown={(event) => event.stopPropagation()}><div className="bq-inv-quick-head"><div><h3 id="bq-inv-quick-title">Add Inventory</h3><p className="bq-inv-quick-subtitle">{subtitle}</p></div><button type="button" className="bq-inv-quick-close" aria-label="Close add inventory" disabled={isSaving || isCreatingLocation} onClick={onCancel}>×</button></div><div className="bq-inv-quick-body bq-inv-add-body"><InventoryLocationPicker locations={locations} entries={inventoryEntries} selectedId={locationId} open={locationPickerOpen} onOpenChange={setLocationPickerOpen} onSelect={selectLocation} onCreateLocation={createLocation} isCreatingLocation={isCreatingLocation} /><section className="bq-inv-add-items"><div className="bq-inv-add-section-head"><span className="logi-form-label">Items</span><span>{items.length} item{items.length === 1 ? '' : 's'}</span></div>{items.map((item, index) => { const selected = selectedItem(item); const material = selected?.material; const unitType: InventoryUnitType = material ? resolveInventoryUnitType(material) : 'unit'; const showUnrefined = isRefinable(material, findIdentity(material, identities)); const invalid = !selected && !customItem(item); return <section key={item.id} className="bq-inv-add-item-block" aria-label={`Item ${index + 1}`}><div className="bq-inv-add-item-head"><strong>Item {index + 1}</strong>{items.length > 1 ? <button type="button" className="bq-inv-add-link bq-inv-add-remove-item" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}>Remove item</button> : null}</div><ItemSearch item={item} catalog={catalog} locked={Boolean(lockMaterial && index === 0)} hasError={hasTriedSave && invalid} onTextChange={(value) => mutateItem(item.id, (current) => ({ ...current, catalogKey: '', search: value }))} onSelect={(key) => { const result = catalog.find((entry) => entry.key === key); if (result) mutateItem(item.id, (current) => ({ ...current, catalogKey: key, search: result.name, unrefined: false })); }} onSelectCustom={() => mutateItem(item.id, (current) => ({ ...current, catalogKey: `manual:${normalizeLookup(current.search)}`, search: current.search.trim(), unrefined: false }))} />{hasTriedSave && invalid ? <span className="logi-form-error">Choose a catalog item or create a custom item.</span> : null}{showUnrefined ? <label className="bq-inv-quick-check"><input type="checkbox" checked={item.unrefined} onChange={(event) => mutateItem(item.id, (current) => ({ ...current, unrefined: event.target.checked }))} /><span>Unrefined (raw ore)</span></label> : null}<div className="bq-inv-add-lots">{item.lots.map((lot, lotIndex) => { const invalidLot = hasTriedSave && (parseQuality(lot.quality) === undefined || !Number.isFinite(Number(lot.amount)) || Number(lot.amount) <= 0); return <div key={lot.id} className="bq-inv-add-lot-row"><input type="number" className={`logi-form-input${invalidLot && parseQuality(lot.quality) === undefined ? ' logi-form-input--error' : ''}`} value={lot.quality} onChange={(event) => mutateItem(item.id, (current) => ({ ...current, lots: current.lots.map((entry) => entry.id === lot.id ? { ...entry, quality: event.target.value } : entry) }))} placeholder="Quality" min={0} max={1000} step={1} aria-label={`Quality for item ${index + 1} lot ${lotIndex + 1}`} /><input type="number" className={`logi-form-input${invalidLot && (!Number.isFinite(Number(lot.amount)) || Number(lot.amount) <= 0) ? ' logi-form-input--error' : ''}`} value={lot.amount} onChange={(event) => mutateItem(item.id, (current) => ({ ...current, lots: current.lots.map((entry) => entry.id === lot.id ? { ...entry, amount: event.target.value } : entry) }))} placeholder="Amount" min={0} step={unitType === 'scu' ? 0.01 : 1} aria-label={`Amount for item ${index + 1} lot ${lotIndex + 1}`} /><button type="button" className="bq-inv-quick-remove" disabled={item.lots.length === 1} onClick={() => mutateItem(item.id, (current) => ({ ...current, lots: current.lots.filter((entry) => entry.id !== lot.id) }))} aria-label={`Remove quality lot ${lotIndex + 1}`}>×</button></div>; })}</div><button type="button" className="bq-inv-quick-add-quality" disabled={item.lots.length >= MAX_QUALITY_LOTS} onClick={() => mutateItem(item.id, (current) => current.lots.length >= MAX_QUALITY_LOTS ? current : { ...current, lots: [...current.lots, newLot()] })}>+ Add another quality</button></section>; })}{!lockMaterial ? <button type="button" className="bq-inv-add-another-item" onClick={addItem}>+ Add another item</button> : null}</section></div><div className="bq-inv-quick-actions"><div className="bq-inv-quick-feedback" aria-live="polite">{errorMessage ? <span className="logi-form-error">{errorMessage}</span> : null}</div><div className="bq-inv-quick-action-buttons"><button type="button" className="bq-btn" onClick={onCancel} disabled={isSaving || isCreatingLocation}>Cancel</button><button type="button" className="bq-btn bq-btn--confirm" onClick={() => void handleSave()} disabled={!canSave}>{isSaving ? 'Adding…' : 'Add Inventory'}</button></div></div></div></div>, document.body);
}
