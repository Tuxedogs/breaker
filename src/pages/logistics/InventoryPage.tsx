import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { createInventoryEntryDraft, type InventorySyncState, type InventoryUiState, useLogisticsStore } from '../../stores/logisticsStore';
import type { BuildQueueItem, InventoryEntry, InventoryItemKind, InventoryLocation, InventoryUnitType, MaterialTemplate } from '../../types/logistics';
import type { SortKey } from '../../components/logistics/InventoryTable';
import InventoryTransferDialog from '../../components/logistics/InventoryTransferDialog';
import InventoryEntryPanel from '../../components/logistics/InventoryEntryPanel';
import InventoryAddModal from '../../components/logistics/InventoryAddModal';
import InventoryHierarchy, { type InventoryAddContext } from '../../components/logistics/InventoryHierarchy';
import MaterialIcon from '../../components/logistics/MaterialIcon';
import {
  formatEntryQuantity,
  formatInventoryQuantity,
  getActiveInventoryEntries,
  resolveInventoryItemName,
  resolveInventoryUnitType,
} from '../../lib/logistics/inventory';
import {
  getInventoryFreshnessBlockReason,
  isInventoryServerFetchStale,
} from '../../lib/logistics/inventoryFreshness';
import {
  buildInventorySyncBeginPatch,
  createInventorySyncRequestId,
  logInventorySyncDev,
  markInventoryFetchFinished,
  markInventoryFetchStarted,
  SESSION_EXPIRED_SYNC_MESSAGE,
  shouldSkipInventoryFetch,
} from '../../lib/logistics/inventorySyncLifecycle';
import { isAuthRecoveryFailed } from '../../lib/auth/authSessionRecovery';
import {
  buildInventoryLocationLookup,
  normalizeInventoryLocationLookup,
  resolveInventoryLocationByInput,
} from '../../lib/logistics/inventoryLocationOptions';
import { useAuthSession } from '../../lib/auth/useAuthSession';
import { useMaterialIdentityIndex, type MaterialIdentity } from '../../lib/logistics/materialIdentityIndex';
import { createMaterialResolver } from '../../lib/logistics/materialResolver';
import {
  expectedInventoryCsvUnit,
  inventoryCsvUnitMismatchMessage,
  isRawIceInventoryInput,
  resolveInventoryCsvUnit,
} from '../../lib/logistics/inventoryCsvImport';
import { fetchOnlinePersistenceState } from '../../lib/userOnlinePersistence';
import { buildInventoryHierarchy } from '../../lib/logistics/inventoryHierarchy';
import QualityTierBadge from '../../components/shared/QualityTierBadge';
import '../../components/logistics/logistics.css';
import '../../components/logistics/inventory.css';

type PanelState = { mode: 'new' } | { mode: 'edit'; entry: InventoryEntry };
type ViewMode = 'location' | 'item' | 'list';

export type InventoryPageFixture = {
  entries: InventoryEntry[];
  locations: InventoryLocation[];
  materials: MaterialTemplate[];
  buildQueue?: BuildQueueItem[];
  selectedLocationId: string;
  inventoryUi?: Partial<InventoryUiState>;
};

type InventoryUndoAction =
  | { kind: 'delete'; entries: InventoryEntry[] }
  | { kind: 'transfer'; moves: Array<{ snapshot: InventoryEntry; fromLocationId: string }> }
  | { kind: 'add'; entryIds: string[] }
  | { kind: 'import'; batchId: string };

type InventoryUndoLedgerEntry = {
  id: string;
  label: string;
  action: InventoryUndoAction;
};

type InventorySuccessNotice = {
  message: string;
};
type UnknownRecord = Record<string, unknown>;
type ImportMode = 'append' | 'replace_matching_materials_location' | 'replace_locations' | 'replace_all';

const INVENTORY_SYNC_FAILED_LABEL = 'Sync failed, retry';

type ReservedLotInfo = { quantity: number; owners: Set<string> };

const WINDOW_GROUP_SIZE = 4;
const WINDOW_STACK_CHUNK_SIZE = 25;
const QUALITY_GROUP_BOX_PREVIEW = 4;

type DrawerEntryRow = {
  id: string;
  materialId: string;
  materialName: string;
  entry: InventoryEntry;
  kind: 'ore' | 'refined' | 'personal' | 'unknown';
  kindLabel: string;
  quantityLabel: string;
  containerLabel: string;
};

type QualityLotGroup = {
  quality: number | null;
  qualityBand?: number | null;
  kind: DrawerEntryRow['kind'];
  kindLabel: string;
  totalQuantity: number;
  unitType: 'scu' | 'unit';
  totalLabel: string;
  boxCount: number;
  lots: Array<DrawerEntryRow & { originalIndex: number }>;
};

type LocationGroup = {
  id: string;
  name: string;
  type: string;
  subtitle: string;
  isManual: boolean;
  entries: InventoryEntry[];
  uniqueItems: number;
  totalScu: number;
  totalUnits: number;
  highestQuality: number | null;
  premiumCount: number;
};

type DrawerMaterialGroup = {
  id: string;
  name: string;
  entries: DrawerEntryRow[];
  total: number;
  unitType: 'scu' | 'unit';
  totalLabel: string;
  kindLabels: string[];
  stackCount: number;
  stackRangeLabel?: string;
};

function groupLotsByQuality(
  rows: DrawerEntryRow[],
  unitType: 'scu' | 'unit',
  separateByKind: boolean,
): QualityLotGroup[] {
  const groups = new Map<string, QualityLotGroup>();
  const order: string[] = [];
  rows.forEach((row, originalIndex) => {
    const key = `${row.entry.quality ?? 'none'}:${separateByKind ? row.kind : 'all'}`;
    const current = groups.get(key);
    if (current) {
      current.totalQuantity += row.entry.quantity;
      current.boxCount += 1;
      current.lots.push({ ...row, originalIndex });
    } else {
      order.push(key);
      groups.set(key, {
        quality: row.entry.quality ?? null,
        qualityBand: row.entry.qualityBand,
        kind: row.kind,
        kindLabel: row.kindLabel,
        totalQuantity: row.entry.quantity,
        unitType,
        totalLabel: '',
        boxCount: 1,
        lots: [{ ...row, originalIndex }],
      });
    }
  });
  return order.map((key) => {
    const group = groups.get(key)!;
    group.totalLabel = formatInventoryQuantity(group.totalQuantity, group.unitType);
    return group;
  }).sort((left, right) => (right.quality ?? -1) - (left.quality ?? -1));
}

function estimateQualityGroupHeight(group: QualityLotGroup): number {
  const previewCount = Math.min(QUALITY_GROUP_BOX_PREVIEW, group.lots.length);
  return 34 + Math.ceil(previewCount / 4) * 52 + (group.lots.length > QUALITY_GROUP_BOX_PREVIEW ? 24 : 0);
}

type CsvRawRow = Record<string, string>;

type CsvParsedRow = {
  rowNumber: number;
  materialInput: string;
  quantityInput: string;
  unitInput: string;
  qualityInput: string;
  boxSizeInput: string;
  locationInput: string;
  container: string;
  notes: string;
  source: string;
  refined: string;
  method: string;
};

type CsvPreviewRow = {
  id: string;
  rowNumbers: number[];
  status: 'valid' | 'warning' | 'error';
  materialName: string;
  materialId?: string;
  materialType?: MaterialTemplate['materialType'];
  itemKind: InventoryItemKind;
  quantity: number;
  boxSize: number | null;
  unitType: InventoryUnitType;
  unitLabel: string;
  quality?: number;
  locationName: string;
  locationId?: string;
  container: string;
  notes?: string;
  generatedLotIndex?: number;
  generatedLotCount?: number;
  generatedQuantitiesLabel?: string;
  errors: string[];
  warnings: string[];
};

type CsvImportResult = {
  batchId: string;
  imported: number;
  replaced: number;
  skipped: number;
  locationsUpdated: number;
  materialsUpdated: number;
  undone?: boolean;
};

type CsvReplacementPreview = {
  entry: InventoryEntry;
  materialName: string;
  locationName: string;
  reservedQuantity: number;
  reservedBy: string[];
};

const CSV_MAX_ROWS = 1000;

type CsvTextColumn = Exclude<keyof CsvParsedRow, 'rowNumber'>;

const CSV_COLUMN_ALIASES: Record<string, CsvTextColumn> = {
  material: 'materialInput',
  name: 'materialInput',
  commodity: 'materialInput',
  item: 'materialInput',
  quantity: 'quantityInput',
  qty: 'quantityInput',
  amount: 'quantityInput',
  unit: 'unitInput',
  type: 'unitInput',
  quality: 'qualityInput',
  q: 'qualityInput',
  box_size: 'boxSizeInput',
  'box size': 'boxSizeInput',
  boxsize: 'boxSizeInput',
  location: 'locationInput',
  station: 'locationInput',
  city: 'locationInput',
  storage: 'locationInput',
  container: 'container',
  notes: 'notes',
  source: 'source',
  refined: 'refined',
  method: 'method',
};

function toRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null ? value as UnknownRecord : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getLocationName(location: unknown): string {
  const loc = toRecord(location);
  return asString(loc.name) ?? asString(loc.displayName) ?? asString(loc.label) ?? 'Unknown Location';
}

function getLocationType(location: unknown): string {
  const loc = toRecord(location);
  const raw = asString(loc.type) ?? asString(loc.locationType) ?? asString(loc.kind) ?? asString(loc.category) ?? 'Custom';
  return titleCase(raw);
}

function getLocationSubtitle(location: unknown): string {
  const loc = toRecord(location);
  const system = asString(loc.system) ?? asString(loc.systemName) ?? asString(loc.parentSystem);
  const parent = asString(loc.parent) ?? asString(loc.parentName) ?? asString(loc.zone);
  return [system, parent].filter(Boolean).join(' / ') || 'Stored inventory location';
}

function isManuallyAddedLocation(location: unknown): boolean {
  const loc = toRecord(location);
  const category = asString(loc.category)?.toLowerCase();
  const source = asString(loc.source)?.toLowerCase();
  return loc.isManual === true || loc.userCreated === true || category === 'manual' || source === 'manual';
}

function getEntryLocationId(entry: InventoryEntry): string {
  const rec = toRecord(entry);
  return asString(rec.locationId) ?? '__unassigned__';
}

function getEntryMaterialId(entry: InventoryEntry): string {
  const rec = toRecord(entry);
  return asString(rec.materialId) ?? asString(rec.itemId) ?? asString(rec.customName) ?? entry.id;
}

function getEntryKind(entry: InventoryEntry, material: unknown): 'ore' | 'refined' | 'personal' | 'unknown' {
  const entryRec = toRecord(entry);
  const materialRec = toRecord(material);
  const raw = [
    asString(entryRec.kind),
    asString(entryRec.itemKind),
    asString(entryRec.type),
    asString(entryRec.sourceType),
    asString(materialRec.kind),
    asString(materialRec.itemKind),
    asString(materialRec.type),
    asString(materialRec.category),
    Array.isArray(materialRec.sourceGroups) ? materialRec.sourceGroups.join(' ') : undefined,
  ].filter(Boolean).join(' ').toLowerCase();

  if (raw.includes('refined')) return 'refined';
  if (raw.includes('ore') || raw.includes('raw') || raw.includes('mining') || raw.includes('mineable')) return 'ore';
  if (raw.includes('personal') || raw.includes('custom')) return 'personal';
  return 'unknown';
}

function normalizeLookup(value: string): string {
  return normalizeInventoryLocationLookup(value);
}

function createNewInventoryId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createCsvImportBatchId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `csv-${crypto.randomUUID()}`;
  }

  return `csv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createNewLocationId(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  return `import-${slug || 'location'}-${Date.now().toString(36)}`;
}

function formatInventorySyncLabel(sync: {
  isFetching: boolean;
  isSyncing: boolean;
  lastFetchedAt?: string;
  syncError?: string;
  hasUnsyncedChanges: boolean;
  hasFetchedServerInventory: boolean;
}): string {
  if (sync.isFetching && !sync.hasFetchedServerInventory) return 'Loading inventory';
  if (sync.isSyncing) return 'Syncing';
  if (sync.hasUnsyncedChanges) return 'Unsynced changes';
  if (sync.syncError === SESSION_EXPIRED_SYNC_MESSAGE) return sync.syncError;
  if (sync.syncError) return INVENTORY_SYNC_FAILED_LABEL;
  if (!sync.hasFetchedServerInventory || !sync.lastFetchedAt) return 'Loading inventory';

  const ageMs = Date.now() - Date.parse(sync.lastFetchedAt);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs < 60_000) return 'Synced just now';
  const minutes = Math.max(1, Math.floor(ageMs / 60_000));
  return `Synced ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
}

function getInventorySyncTone(sync: {
  isFetching: boolean;
  isSyncing: boolean;
  syncError?: string;
  hasUnsyncedChanges: boolean;
  hasFetchedServerInventory: boolean;
}): 'loading' | 'synced' | 'warning' | 'error' {
  if (sync.syncError) return 'error';
  if (sync.hasUnsyncedChanges) return 'warning';
  if (sync.isFetching || sync.isSyncing || !sync.hasFetchedServerInventory) return 'loading';
  return 'synced';
}

function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((cells) => cells.some((value) => value.trim()));
}

function mapCsvRows(rows: string[][]): CsvRawRow[] {
  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  return rows.slice(1).map((cells) => {
    const raw: CsvRawRow = {};
    headers.forEach((header, index) => {
      raw[header] = (cells[index] ?? '').trim();
    });
    return raw;
  });
}

function normalizeCsvRawRows(rawRows: CsvRawRow[]): CsvParsedRow[] {
  return rawRows.map((raw, index) => {
    const parsed: CsvParsedRow = {
      rowNumber: index + 2,
      materialInput: '',
      quantityInput: '',
      unitInput: '',
      qualityInput: '',
      boxSizeInput: '',
      locationInput: '',
      container: '',
      notes: '',
      source: '',
      refined: '',
      method: '',
    };
    for (const [rawKey, value] of Object.entries(raw)) {
      const key = CSV_COLUMN_ALIASES[rawKey.trim().toLowerCase()];
      if (key && !parsed[key]) parsed[key] = value.trim();
    }
    return parsed;
  });
}

function parseCsvNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsvInteger(value: string): number | null {
  const parsed = parseCsvNumber(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function roundCsvQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function formatCsvNumber(value: number): string {
  return roundCsvQuantity(value).toFixed(6).replace(/\.?0+$/, '');
}

function splitCsvLots(quantity: number, boxSize: number | null, unitType: InventoryUnitType | undefined): number[] {
  if (unitType !== 'scu' || boxSize === null || quantity <= boxSize) return [quantity];
  const fullLots = Math.floor(quantity / boxSize);
  const lots = Array.from({ length: fullLots }, () => boxSize);
  const remainder = roundCsvQuantity(quantity - (fullLots * boxSize));
  if (remainder > 0) lots.push(remainder);
  return lots.length ? lots : [quantity];
}

function getCsvMaterialLocationPairs(rows: CsvPreviewRow[]): Set<string> {
  return new Set(rows
    .filter((row) => !row.errors.length && row.materialId && row.locationId)
    .map((row) => `${row.materialId}|${row.locationId}`));
}

function getReservedInventoryMap(buildQueue: BuildQueueItem[]): Map<string, { quantity: number; owners: Set<string> }> {
  const reserved = new Map<string, { quantity: number; owners: Set<string> }>();
  for (const item of buildQueue) {
    if (item.status === 'complete') continue;
    const owner = item.itemName ?? item.recipeId;
    for (const allocation of item.reservedAllocations ?? []) {
      if (allocation.quantityReserved <= 0) continue;
      const current = reserved.get(allocation.inventoryEntryId) ?? { quantity: 0, owners: new Set<string>() };
      current.quantity += allocation.quantityReserved;
      current.owners.add(owner);
      reserved.set(allocation.inventoryEntryId, current);
    }
  }
  return reserved;
}

function buildReplacementPreview(
  mode: ImportMode,
  validRows: CsvPreviewRow[],
  entries: InventoryEntry[],
  locations: InventoryLocation[],
  materialById: Map<string, MaterialTemplate>,
  buildQueue: BuildQueueItem[],
): CsvReplacementPreview[] {
  if (mode === 'append') return [];
  const activeEntries = getActiveInventoryEntries(entries);
  const reserved = getReservedInventoryMap(buildQueue);
  const locationIds = new Set(validRows.map((row) => row.locationId).filter((id): id is string => Boolean(id)));
  const materialLocationPairs = getCsvMaterialLocationPairs(validRows);
  const targets = activeEntries.filter((entry) => {
    if (mode === 'replace_all') return true;
    if (!entry.locationId) return false;
    if (mode === 'replace_locations') return locationIds.has(entry.locationId);
    if (!entry.materialId) return false;
    return materialLocationPairs.has(`${entry.materialId}|${entry.locationId}`);
  });
  return targets.map((entry) => {
    const material = entry.materialId ? materialById.get(entry.materialId) : undefined;
    const reserve = reserved.get(entry.id);
    return {
      entry,
      materialName: resolveInventoryItemName(entry, material),
      locationName: entry.locationId ? locations.find((location) => location.id === entry.locationId)?.name ?? 'Unknown Location' : 'Unassigned Stock',
      reservedQuantity: reserve?.quantity ?? 0,
      reservedBy: Array.from(reserve?.owners ?? []),
    };
  }).sort((a, b) => a.locationName.localeCompare(b.locationName) || a.materialName.localeCompare(b.materialName));
}

function buildLocationLookup(locations: InventoryLocation[]): Map<string, InventoryLocation> {
  return buildInventoryLocationLookup(locations);
}

function getIdentityMaterialId(identity: MaterialIdentity, sourceKeyByOutput: Map<string, string>): string {
  return sourceKeyByOutput.get(identity.materialKey) ?? identity.materialKey;
}

function buildSourceKeyByOutput(materialIdentities: MaterialIdentity[], materials: MaterialTemplate[]): Map<string, string> {
  const materialIds = new Set(materials.map((material) => material.id));
  const sourceKeyByOutput = new Map<string, string>();
  for (const identity of materialIdentities) {
    if (identity.isRefinable && identity.refinesToMaterialKey && materialIds.has(identity.materialKey)) {
      sourceKeyByOutput.set(identity.refinesToMaterialKey, identity.materialKey);
    }
  }
  return sourceKeyByOutput;
}

function getMatchedRefinedName(input: string, material: MaterialTemplate, materialIdentities: MaterialIdentity[], sourceKeyByOutput: Map<string, string>): string | undefined {
  const inputKey = normalizeLookup(input);
  for (const identity of materialIdentities) {
    if (getIdentityMaterialId(identity, sourceKeyByOutput) !== material.id) continue;
    const refinedNames = [identity.refinedName, identity.commodityName, identity.materialForm === 'refined' ? identity.displayName : undefined]
      .filter((value): value is string => Boolean(value));
    const matched = refinedNames.find((name) => normalizeLookup(name) === inputKey);
    if (matched && normalizeLookup(material.name) !== inputKey) return matched;
  }
  return undefined;
}

function validateCsvRows(
  rows: CsvParsedRow[],
  materials: MaterialTemplate[],
  materialIdentities: MaterialIdentity[],
  locations: InventoryLocation[],
): CsvPreviewRow[] {
  const resolveMaterial = createMaterialResolver(materials, materialIdentities);
  const sourceKeyByOutput = buildSourceKeyByOutput(materialIdentities, materials);
  const locationLookup = buildLocationLookup(locations);
  return rows.flatMap<CsvPreviewRow>((row) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const materialNameInput = row.materialInput.trim();
    const locationNameInput = row.locationInput.trim();
    const resolvedMaterial = materialNameInput ? resolveMaterial({ materialName: materialNameInput, displayName: materialNameInput }) : null;
    const material = resolvedMaterial?.material;
    const refinedName = material ? getMatchedRefinedName(materialNameInput, material, materialIdentities, sourceKeyByOutput) : undefined;
    const location = locationNameInput
      ? resolveInventoryLocationByInput(locationNameInput, locationLookup)
      : undefined;
    const unit = resolveInventoryCsvUnit(row.unitInput);
    const parsedQuantity = parseCsvNumber(row.quantityInput);
    const parsedQuality = parseCsvInteger(row.qualityInput);
    const parsedBoxSize = parseCsvNumber(row.boxSizeInput);
    const quantity = parsedQuantity === null ? 0 : roundCsvQuantity(parsedQuantity * unit.multiplier);
    const boxSize = !row.boxSizeInput.trim() || unit.unitType === 'unit'
      ? null
      : parsedBoxSize === null
        ? null
        : roundCsvQuantity(parsedBoxSize * unit.multiplier);
    const quality = parsedQuality ?? undefined;

    const rawIceInput = isRawIceInventoryInput(materialNameInput);
    if (!materialNameInput) errors.push('Missing material.');
    else if (!material) errors.push('Unknown material.');
    else if (rawIceInput) errors.push('Raw Ice import requires unrefined inventory support.');
    else if (normalizeLookup(material.name) !== normalizeLookup(materialNameInput)) {
      warnings.push(refinedName
        ? `Matched refined material name: ${refinedName}.`
        : `Material name normalized to ${material.name}.`);
    }

    if (!row.quantityInput.trim()) errors.push('Missing quantity.');
    else if (parsedQuantity === null || parsedQuantity <= 0) errors.push('Invalid quantity.');

    if (!row.unitInput.trim()) errors.push('Missing unit.');
    else if (!unit.unitType) errors.push('Unsupported unit.');
    else {
      if (material) {
        const mismatch = inventoryCsvUnitMismatchMessage(material, unit.unitType);
        if (mismatch) errors.push(mismatch);
      }
      if (unit.warning) warnings.push(unit.warning);
    }

    if (!row.qualityInput.trim()) errors.push('Missing quality.');
    else if (parsedQuality === null || parsedQuality < 0 || parsedQuality > 1000) errors.push('Invalid quality.');

    if (row.boxSizeInput.trim()) {
      if (unit.unitType === 'unit') warnings.push('Box size ignored for unit rows.');
      else if (parsedBoxSize === null || parsedBoxSize <= 0) errors.push('Invalid box size.');
    }

    if (!locationNameInput) errors.push('Missing location.');
    else if (!location) warnings.push('New location will be created.');
    else if (location.name !== locationNameInput) warnings.push(`Location name normalized to ${location.name}.`);

    const expectedUnitType = material ? expectedInventoryCsvUnit(material) : unit.unitType ?? 'unit';
    const baseRow: CsvPreviewRow = {
      id: `csv-row-${row.rowNumber}`,
      rowNumbers: [row.rowNumber],
      status: errors.length ? 'error' : warnings.length ? 'warning' : 'valid',
      materialName: refinedName ?? material?.name ?? materialNameInput,
      materialId: material?.id,
      materialType: expectedUnitType === 'scu' ? 'refined' : material?.materialType,
      itemKind: expectedUnitType === 'scu' ? 'refined' : 'raw_mineable',
      quantity,
      boxSize,
      unitType: unit.unitType ?? 'unit',
      unitLabel: unit.label ?? row.unitInput.trim(),
      quality,
      locationName: location?.name ?? locationNameInput,
      locationId: location?.id,
      container: row.container.trim(),
      notes: row.notes.trim() || row.source.trim() || row.method.trim() || undefined,
      errors,
      warnings,
    };

    if (errors.length) return [baseRow];

    const lots = splitCsvLots(quantity, boxSize, unit.unitType);
    const generatedQuantitiesLabel = lots.map(formatCsvNumber).join(' + ');
    return lots.map((lotQuantity, index) => {
      return {
        ...baseRow,
        id: `csv-row-${row.rowNumber}-lot-${index + 1}`,
        quantity: lotQuantity,
        status: warnings.length ? 'warning' : 'valid',
        generatedLotIndex: index + 1,
        generatedLotCount: lots.length,
        generatedQuantitiesLabel,
        warnings,
      };
    });
  });
}

function buildInventoryEntryFromPreviewRow(row: CsvPreviewRow, locationId: string, importBatchId: string): InventoryEntry {
  return createInventoryEntryDraft({
    id: createNewInventoryId(),
    materialId: row.materialId,
    materialName: row.materialName,
    materialType: row.materialType,
    itemName: row.materialName,
    itemKind: row.itemKind,
    unitType: row.unitType,
    catalogSource: 'api',
    quality: row.quality,
    quantity: row.quantity,
    boxSize: row.boxSize,
    locationId,
    container: row.container || undefined,
    notes: row.notes,
    source: 'csv_import',
    sourceHistory: ['csv_import'],
    importSourceType: 'inventory_csv',
    importBatchId,
    importRowNumber: row.rowNumbers[0],
    importLotIndex: row.generatedLotIndex,
    importLotCount: row.generatedLotCount,
  });
}

type CsvImportModalProps = {
  entries: InventoryEntry[];
  buildQueue: BuildQueueItem[];
  materials: MaterialTemplate[];
  locations: InventoryLocation[];
  materialById: Map<string, MaterialTemplate>;
  onClose: () => void;
  onApplyBatch: (input: {
    batchId: string;
    additions: InventoryEntry[];
    replaceEntryIds?: string[];
    locations?: InventoryLocation[];
  }) => Promise<void>;
  onUndoBatch: (batchId: string) => void;
  onImportTracked?: (batchId: string, importedCount: number) => void;
  initialMode: ImportMode;
  onModeChange: (mode: ImportMode) => void;
  freshnessBlockReason: string | null;
};

function CsvImportModal({
  entries,
  buildQueue,
  materials,
  locations,
  materialById,
  onClose,
  onApplyBatch,
  onUndoBatch,
  onImportTracked,
  initialMode,
  onModeChange,
  freshnessBlockReason,
}: CsvImportModalProps) {
  const materialIdentities = useMaterialIdentityIndex();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<CsvPreviewRow[]>([]);
  const [originalRowCount, setOriginalRowCount] = useState(0);
  const [parseError, setParseError] = useState('');
  const [mode, setMode] = useState<ImportMode>(initialMode);
  const [confirmWarnings, setConfirmWarnings] = useState(false);
  const [confirmReplaceLocations, setConfirmReplaceLocations] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);

  const validRows = rows.filter((row) => !row.errors.length);
  const warningCount = rows.filter((row) => row.warnings.length && !row.errors.length).length;
  const errorCount = rows.filter((row) => row.errors.length).length;
  const affectedLocations = new Set(validRows.map((row) => row.locationName)).size;
  const affectedMaterials = new Set(validRows.map((row) => row.materialName)).size;
  const replacementPreview = buildReplacementPreview(mode, validRows, entries, locations, materialById, buildQueue);
  const replacementConflicts = replacementPreview.filter((row) => row.reservedQuantity > 0);
  const importFreshnessBlock = freshnessBlockReason;
  const canImport = validRows.length > 0 &&
    errorCount === 0 &&
    (warningCount === 0 || confirmWarnings) &&
    replacementConflicts.length === 0 &&
    !importFreshnessBlock &&
    ((mode !== 'replace_locations' && mode !== 'replace_all') || confirmReplaceLocations);

  function handleFile(file: File | undefined) {
    setResult(null);
    setConfirmWarnings(false);
    setConfirmReplaceLocations(false);
    setRows([]);
    setOriginalRowCount(0);
    setParseError('');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setParseError('Select a CSV file.');
      return;
    }
    setFileName(file.name);
    void file.text()
      .then((text) => {
        const parsed = normalizeCsvRawRows(mapCsvRows(parseCsvText(text)));
        if (parsed.length > CSV_MAX_ROWS) {
          setParseError(`CSV imports are limited to ${CSV_MAX_ROWS} rows.`);
          return;
        }
        setOriginalRowCount(parsed.length);
        setRows(validateCsvRows(parsed, materials, materialIdentities, locations));
      })
      .catch(() => setParseError('CSV file could not be read.'));
  }

  function downloadTemplate() {
    const content = [
      'NAME,QUANTITY,UNIT,QUALITY,BOX_SIZE,LOCATION',
      'Beryl,3.4,SCU,860,1,Levski',
      'Feynmaline,39,UNIT,965,,Levski',
    ].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'inventory-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!canImport) return;
    const importBatchId = createCsvImportBatchId();
    const newLocations = new Map<string, InventoryLocation>();
    const locationLookup = buildLocationLookup(locations);
    const resolveLocationId = (row: CsvPreviewRow) => {
      if (row.locationId) return row.locationId;
      const resolved = resolveInventoryLocationByInput(row.locationName, locationLookup);
      if (resolved) return resolved.id;
      const key = normalizeLookup(row.locationName);
      const existing = newLocations.get(key);
      if (existing) return existing.id;
      const location: InventoryLocation = {
        id: createNewLocationId(row.locationName),
        name: row.locationName,
        category: 'manual',
        type: 'station',
      };
      newLocations.set(key, location);
      return location.id;
    };

    const additions: InventoryEntry[] = [];
    const touchedLocationIds = new Set<string>();
    const touchedMaterials = new Set<string>();

    for (const row of validRows) {
      const locationId = resolveLocationId(row);
      touchedLocationIds.add(locationId);
      touchedMaterials.add(row.materialId ?? row.materialName);
      additions.push(buildInventoryEntryFromPreviewRow(row, locationId, importBatchId));
    }

    const createdLocations = Array.from(newLocations.values());
    const replaceEntryIds = replacementPreview.map((row) => row.entry.id);
    try {
      await onApplyBatch({
        batchId: importBatchId,
        additions,
        replaceEntryIds,
        locations: createdLocations,
      });
    } catch (error) {
      setParseError(error instanceof Error ? error.message : String(error));
      return;
    }
    onImportTracked?.(importBatchId, additions.length);
    setResult({
      batchId: importBatchId,
      imported: additions.length,
      replaced: replaceEntryIds.length,
      skipped: errorCount,
      locationsUpdated: touchedLocationIds.size,
      materialsUpdated: touchedMaterials.size,
    });
  }

  function resetImportFlow() {
    setResult(null);
    setFileName('');
    setRows([]);
    setOriginalRowCount(0);
    setParseError('');
    setConfirmWarnings(false);
    setConfirmReplaceLocations(false);
  }

  const importComplete = result != null;

  return (
    <>
      <div className="logi-drawer-overlay" onClick={onClose} aria-hidden />
      <div className="logi-csv-modal" role="dialog" aria-modal="true" aria-label="Import CSV">
        <div className="logi-csv-modal-head">
          <div>
            <span className="logi-csv-kicker">Inventory Import</span>
            <h2>{importComplete ? 'Import Complete' : 'Import CSV'}</h2>
          </div>
          <button type="button" className="logi-panel-close-btn" onClick={onClose} aria-label="Close import">
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {importComplete ? (
          <div className="logi-csv-success" role="status">
            {result.undone ? (
              <>
                <p className="logi-csv-success-lead">Import undone</p>
                <p className="logi-csv-success-detail">
                  The imported lots from this batch were removed. Your inventory is back to its prior state.
                </p>
              </>
            ) : (
              <>
                <p className="logi-csv-success-lead">Inventory updated</p>
                <p className="logi-csv-success-detail">
                  Imported {result.imported} lot{result.imported === 1 ? '' : 's'}
                  {result.replaced > 0 ? `, replaced ${result.replaced}` : ''}
                  {result.skipped > 0 ? `, skipped ${result.skipped}` : ''}.
                  {' '}
                  {result.locationsUpdated} location{result.locationsUpdated === 1 ? '' : 's'} and{' '}
                  {result.materialsUpdated} material{result.materialsUpdated === 1 ? '' : 's'} updated.
                </p>
              </>
            )}
            <div className="logi-csv-success-stats">
              <div><span>Imported lots</span><strong>{result.imported}</strong></div>
              <div><span>Replaced</span><strong>{result.replaced}</strong></div>
              <div><span>Locations</span><strong>{result.locationsUpdated}</strong></div>
              <div><span>Materials</span><strong>{result.materialsUpdated}</strong></div>
            </div>
            <p className="logi-csv-success-hint">
              {result.undone
                ? 'You can import another CSV or close this dialog to continue working.'
                : 'Review your inventory list, import another file, or undo this batch if something looks wrong.'}
            </p>
          </div>
        ) : (
          <div className="logi-csv-modal-body">
            <div className="logi-csv-controls">
              <label className="logi-csv-file">
                <span>{fileName || 'Select CSV file'}</span>
                <input type="file" accept=".csv,text/csv" onChange={(event) => handleFile(event.target.files?.[0])} />
              </label>
              <button type="button" className="logi-btn-ghost" onClick={downloadTemplate}>Download CSV Template</button>
              <select
                className="logi-select"
                value={mode}
                onChange={(event) => {
                  const nextMode = event.target.value as ImportMode;
                  setMode(nextMode);
                  onModeChange(nextMode);
                }}
                aria-label="CSV import mode"
              >
                <option value="append">Append</option>
                <option value="replace_matching_materials_location">Replace matching materials/location</option>
                <option value="replace_locations">Replace location inventory</option>
                <option value="replace_all">Replace all inventory</option>
              </select>
            </div>

            {parseError && <div className="logi-csv-error" role="alert">{parseError}</div>}

            <div className="logi-csv-summary">
              <div><span>Input rows</span><strong>{originalRowCount}</strong></div>
              <div><span>Generated lots</span><strong>{validRows.length}</strong></div>
              <div><span>Warnings</span><strong>{warningCount}</strong></div>
              <div><span>Errors</span><strong>{errorCount}</strong></div>
              <div><span>Locations</span><strong>{affectedLocations}</strong></div>
              <div><span>Materials</span><strong>{affectedMaterials}</strong></div>
            </div>

            {replacementConflicts.length > 0 && (
              <div className="logi-csv-error" role="alert">
                Import blocked: {replacementConflicts.length} matching active lot{replacementConflicts.length === 1 ? '' : 's'} are reserved by Build Queue.
              </div>
            )}

            {importFreshnessBlock && (
              <div className="logi-csv-error" role="alert">{importFreshnessBlock}</div>
            )}

            {(replacementPreview.length > 0 || rows.length > 0) && (
              <div className="logi-csv-scroll" tabIndex={0} aria-label="CSV preview">
                {replacementPreview.length > 0 && (
                  <div className="logi-csv-table-wrap">
                    <table className="logi-csv-table">
                      <thead>
                        <tr>
                          <th>Replace</th>
                          <th>Material</th>
                          <th>Quantity</th>
                          <th>Quality</th>
                          <th>Location</th>
                          <th>Reserved</th>
                        </tr>
                      </thead>
                      <tbody>
                        {replacementPreview.map((row) => (
                          <tr key={row.entry.id} className={row.reservedQuantity > 0 ? 'logi-csv-row--error' : undefined}>
                            <td>{row.entry.id}</td>
                            <td>{row.materialName}</td>
                            <td>{formatCsvNumber(row.entry.quantity)}</td>
                            <td><QualityTierBadge quality={row.entry.quality} qualityBand={row.entry.qualityBand} /></td>
                            <td>{row.locationName}</td>
                            <td>{row.reservedQuantity > 0 ? `${formatCsvNumber(row.reservedQuantity)} by ${row.reservedBy.join(', ')}` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {rows.length > 0 && (
                  <div className="logi-csv-table-wrap">
                    <table className="logi-csv-table">
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Input Row</th>
                          <th>Lot</th>
                          <th>Material</th>
                          <th>Quantity</th>
                          <th>Unit</th>
                          <th>Quality</th>
                          <th>Box</th>
                          <th>Location</th>
                          <th>Container</th>
                          <th>Issue / action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.id} className={`logi-csv-row--${row.status}`}>
                            <td>{row.status}</td>
                            <td>{row.rowNumbers.join(', ')}</td>
                            <td>{row.generatedLotIndex && row.generatedLotCount ? `${row.generatedLotIndex}/${row.generatedLotCount}` : '-'}</td>
                            <td>{row.materialName || '-'}</td>
                            <td>{row.quantity ? formatCsvNumber(row.quantity) : '-'}</td>
                            <td>{row.unitLabel || '-'}</td>
                            <td><QualityTierBadge quality={row.quality} /></td>
                            <td>{row.boxSize == null ? '-' : formatCsvNumber(row.boxSize)}</td>
                            <td>{row.locationName || '-'}</td>
                            <td>{row.container || '-'}</td>
                            <td>{[...row.errors, ...row.warnings].join(' ') || (row.generatedQuantitiesLabel ? `Generated: ${row.generatedQuantitiesLabel}` : `Rows ${row.rowNumbers.join(', ')}`)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="logi-csv-modal-foot">
          {importComplete ? (
            <div className="logi-csv-actions logi-csv-actions--success">
              <button type="button" className="logi-btn-primary" onClick={onClose}>Done</button>
              <button type="button" className="logi-btn-ghost" onClick={onClose}>Review inventory</button>
              <button type="button" className="logi-btn-ghost" onClick={resetImportFlow}>Import another CSV</button>
              {!result.undone && (
                <button
                  type="button"
                  className="logi-btn-ghost logi-csv-btn-danger"
                  onClick={() => {
                    onUndoBatch(result.batchId);
                    setResult({ ...result, undone: true });
                  }}
                >
                  Undo import
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="logi-csv-confirm">
                {warningCount > 0 && (
                  <label>
                    <input type="checkbox" checked={confirmWarnings} onChange={(event) => setConfirmWarnings(event.target.checked)} />
                    Confirm warning rows
                  </label>
                )}
                {(mode === 'replace_locations' || mode === 'replace_all') && (
                  <label>
                    <input type="checkbox" checked={confirmReplaceLocations} onChange={(event) => setConfirmReplaceLocations(event.target.checked)} />
                    Confirm replacing {mode === 'replace_all' ? 'all active inventory' : 'inventory at CSV locations'}
                  </label>
                )}
              </div>
              <div className="logi-csv-actions">
                <button type="button" className="logi-btn-primary" onClick={handleImport} disabled={!canImport} aria-disabled={!canImport}>Confirm Import</button>
                <button type="button" className="logi-btn-ghost" onClick={onClose}>Cancel</button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function QualityPill({ quality, qualityBand }: { quality?: number | null; qualityBand?: number | null }) {
  return <QualityTierBadge quality={quality} qualityBand={qualityBand} />;
}

function ManageSelectIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function CargoBoxIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" />
      <path d="M12 12v8M4 8.5 12 13l8-4.5" />
    </svg>
  );
}

function RowActionIcon({ kind }: { kind: 'edit' | 'delete' | 'transfer' }) {
  if (kind === 'edit') {
    return (
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    );
  }
  if (kind === 'delete') {
    return (
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
      </svg>
    );
  }
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

type InventoryLotReserveProps = {
  reservedByLotId: Map<string, ReservedLotInfo>;
};

type InventoryBoxTileProps = InventoryLotReserveProps & {
  row: DrawerEntryRow;
  manageMode: boolean;
  isSelected: boolean;
  showQuickActions: boolean;
  onToggleSelect: (entryId: string) => void;
  onEdit: (entry: InventoryEntry) => void;
  onQuickDelete: () => void;
  onQuickTransfer: () => void;
};

const InventoryBoxTile = memo(function InventoryBoxTile({
  row,
  manageMode,
  isSelected,
  showQuickActions,
  reservedByLotId,
  onToggleSelect,
  onEdit,
  onQuickDelete,
  onQuickTransfer,
}: InventoryBoxTileProps) {
  const reserve = reservedByLotId.get(row.id);
  const reservedQuantity = reserve?.quantity ?? 0;
  const isReserved = reservedQuantity > 0;
  const isFullyReserved = isReserved && reservedQuantity >= row.entry.quantity;
  const reserveTitle = isReserved
    ? `Reserved ${formatInventoryQuantity(reservedQuantity, resolveInventoryUnitType(row.entry))}${reserve?.owners.size ? ` by ${Array.from(reserve.owners).join(', ')}` : ''}`
    : undefined;

  return (
    <div
      className={[
        'logi-inv-box-tile',
        manageMode ? 'logi-inv-row--selectable' : '',
        isSelected ? 'logi-inv-row--selected' : '',
        isReserved ? 'logi-inv-box-tile--reserved' : '',
        isFullyReserved ? 'logi-inv-box-tile--unavailable' : '',
      ].filter(Boolean).join(' ')}
      onClick={manageMode ? () => onToggleSelect(row.id) : undefined}
      onDoubleClick={!manageMode ? () => onEdit(row.entry) : undefined}
      onKeyDown={manageMode ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggleSelect(row.id);
        }
      } : undefined}
      tabIndex={manageMode ? 0 : undefined}
      role={manageMode ? 'checkbox' : undefined}
      aria-checked={manageMode ? isSelected : undefined}
      aria-label={manageMode ? `Select ${row.materialName} box ${row.quantityLabel}` : `${row.materialName} box ${row.quantityLabel}`}
      title={reserveTitle}
    >
      {manageMode && (
        <input
          type="checkbox"
          className="logi-inv-box-tile-checkbox logi-inv-row-checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(row.id)}
          onClick={(event) => event.stopPropagation()}
          tabIndex={-1}
          aria-hidden
        />
      )}
      <span className="logi-inv-box-tile-body">
        <span className="logi-inv-box-tile-icon" aria-hidden>
          <CargoBoxIcon />
        </span>
        <span className="logi-inv-box-tile-qty">{row.quantityLabel}</span>
      </span>
      {isReserved && <span className="logi-inv-box-tile-reserve-dot" aria-hidden />}
      {showQuickActions && (
        <span className="logi-inv-box-tile-actions">
          <button type="button" className="logi-inv-row-icon-btn" onClick={(event) => { event.stopPropagation(); onEdit(row.entry); }} aria-label={`Edit ${row.materialName}`}>
            <RowActionIcon kind="edit" />
          </button>
          <button type="button" className="logi-inv-row-icon-btn" onClick={(event) => { event.stopPropagation(); onQuickTransfer(); }} aria-label={`Transfer ${row.materialName}`}>
            <RowActionIcon kind="transfer" />
          </button>
          <button type="button" className="logi-inv-row-icon-btn is-delete" onClick={(event) => { event.stopPropagation(); onQuickDelete(); }} aria-label={`Delete ${row.materialName}`}>
            <RowActionIcon kind="delete" />
          </button>
        </span>
      )}
    </div>
  );
});

type InventoryQualityGroupSectionProps = InventoryLotReserveProps & {
  qualityGroup: QualityLotGroup;
  showKindLabel: boolean;
  manageMode: boolean;
  selectedIds: Set<string>;
  singleSelectedId: string | null;
  onToggleSelect: (entryId: string) => void;
  onEdit: (entry: InventoryEntry) => void;
  onQuickDelete: () => void;
  onQuickTransfer: () => void;
};

const InventoryQualityGroupSection = memo(function InventoryQualityGroupSection({
  qualityGroup,
  showKindLabel,
  manageMode,
  selectedIds,
  singleSelectedId,
  reservedByLotId,
  onToggleSelect,
  onEdit,
  onQuickDelete,
  onQuickTransfer,
}: InventoryQualityGroupSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = Math.max(0, qualityGroup.lots.length - QUALITY_GROUP_BOX_PREVIEW);
  const visibleLots = expanded ? qualityGroup.lots : qualityGroup.lots.slice(0, QUALITY_GROUP_BOX_PREVIEW);
  const boxCountLabel = `${qualityGroup.boxCount} ${qualityGroup.boxCount === 1 ? 'box' : 'boxes'}`;

  return (
    <section className="logi-inv-quality-group" aria-label={`Quality ${qualityGroup.quality ?? 'unknown'} group`}>
      <div className="logi-inv-quality-group-head">
        <QualityPill quality={qualityGroup.quality} qualityBand={qualityGroup.qualityBand} />
        <span className="logi-inv-quality-group-total">{qualityGroup.totalLabel}</span>
        <span className="logi-inv-quality-group-count">{boxCountLabel}</span>
        {showKindLabel && (
          <span className={`logi-location-kind logi-location-kind--${qualityGroup.kind}`}>{qualityGroup.kindLabel}</span>
        )}
      </div>

      <div className="logi-inv-box-tile-grid">
        {visibleLots.map((row) => (
          <InventoryBoxTile
            key={row.id}
            row={row}
            manageMode={manageMode}
            isSelected={selectedIds.has(row.id)}
            showQuickActions={manageMode && singleSelectedId === row.id}
            reservedByLotId={reservedByLotId}
            onToggleSelect={onToggleSelect}
            onEdit={onEdit}
            onQuickDelete={onQuickDelete}
            onQuickTransfer={onQuickTransfer}
          />
        ))}
      </div>

      {hiddenCount > 0 && !expanded && (
        <button
          type="button"
          className="logi-inv-quality-group-expand"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
        >
          +{hiddenCount} more
        </button>
      )}
      {expanded && hiddenCount > 0 && (
        <button
          type="button"
          className="logi-inv-quality-group-expand"
          onClick={() => setExpanded(false)}
          aria-expanded
        >
          Show less
        </button>
      )}
    </section>
  );
});

type InventoryMaterialGroupProps = InventoryLotReserveProps & {
  group: DrawerMaterialGroup;
  manageMode: boolean;
  selectedIds: Set<string>;
  singleSelectedId: string | null;
  onToggleSelect: (entryId: string) => void;
  onEdit: (entry: InventoryEntry) => void;
  onQuickDelete: () => void;
  onQuickTransfer: () => void;
};

const InventoryMaterialCard = memo(function InventoryMaterialCard({
  group,
  manageMode,
  selectedIds,
  singleSelectedId,
  reservedByLotId,
  onToggleSelect,
  onEdit,
  onQuickDelete,
  onQuickTransfer,
}: InventoryMaterialGroupProps) {
  const separateByKind = group.kindLabels.length > 1;
  const qualityGroups = useMemo(
    () => groupLotsByQuality(group.entries, group.unitType, separateByKind),
    [group.entries, group.unitType, separateByKind],
  );

  return (
    <article className="logi-location-material-card">
      <div className="logi-location-material-card-head">
        <div className="logi-location-material-card-title">
          <MaterialIcon
            materialName={group.name}
            materialState={group.entries.every((row) => row.kind === 'refined') ? 'refined' : 'raw'}
            size={18}
          />
          <h3>{group.name}</h3>
          <span className="logi-location-material-card-total">{group.totalLabel}</span>
        </div>
        <div className="logi-location-material-card-badges" aria-label="Item types">
          {group.kindLabels.map((label) => (
            <span key={label} className="logi-location-kind">{label}</span>
          ))}
        </div>
      </div>

      <div className="logi-location-material-card-groups">
        {qualityGroups.map((qualityGroup) => (
          <InventoryQualityGroupSection
            key={`${qualityGroup.quality ?? 'none'}:${qualityGroup.kind}`}
            qualityGroup={qualityGroup}
            showKindLabel={separateByKind}
            manageMode={manageMode}
            selectedIds={selectedIds}
            singleSelectedId={singleSelectedId}
            reservedByLotId={reservedByLotId}
            onToggleSelect={onToggleSelect}
            onEdit={onEdit}
            onQuickDelete={onQuickDelete}
            onQuickTransfer={onQuickTransfer}
          />
        ))}
      </div>
    </article>
  );
});

type LocationCardProps = {
  group: LocationGroup;
  isSelected: boolean;
  onToggle: (locationId: string) => void;
  detailId: string;
};

export const InventoryLocationCard = memo(function InventoryLocationCard({
  group,
  isSelected,
  onToggle,
  detailId,
}: LocationCardProps) {
  return (
    <article className={`logi-location-card${group.entries.length === 0 ? ' logi-location-card--empty' : ''}${isSelected ? ' logi-location-card--selected' : ''}`}>
      <div className="logi-location-card-head">
        <div>
          <div className="logi-location-card-kicker">{group.subtitle}</div>
          <h2>{group.name}</h2>
        </div>
        <div className="logi-location-card-badges">
          {isSelected && <span className="logi-location-active-badge">Active</span>}
          <span className="logi-location-type-badge">{group.type}</span>
        </div>
      </div>

      <div className="logi-location-stat-grid">
        <div><span>Unique</span><strong>{group.uniqueItems}</strong></div>
        <div>
          <span>Total</span>
          <strong>{[
            group.totalScu > 0 ? formatInventoryQuantity(group.totalScu, 'scu') : '',
            group.totalUnits > 0 ? formatInventoryQuantity(group.totalUnits, 'unit') : '',
          ].filter(Boolean).join(' / ') || '0'}</strong>
        </div>
        <div><span>Best</span><strong>{group.highestQuality ?? '—'}</strong></div>
        <div><span>900+</span><strong>{group.premiumCount}</strong></div>
      </div>


      <div className="logi-location-card-actions">
        <button
          type="button"
          className="logi-location-details-btn"
          onClick={() => onToggle(group.id)}
          aria-expanded={isSelected}
          aria-controls={detailId}
        >
          {isSelected ? 'Collapse' : 'View Details'}
        </button>
      </div>
    </article>
  );
});

function splitLargeMaterialGroups(groups: DrawerMaterialGroup[]): DrawerMaterialGroup[] {
  return groups.flatMap((group) => {
    if (group.entries.length <= WINDOW_STACK_CHUNK_SIZE) return group;
    const chunks: DrawerMaterialGroup[] = [];
    for (let index = 0; index < group.entries.length; index += WINDOW_STACK_CHUNK_SIZE) {
      chunks.push({
        ...group,
        id: `${group.id}:${index}`,
        entries: group.entries.slice(index, index + WINDOW_STACK_CHUNK_SIZE),
        stackRangeLabel: `${index + 1}-${Math.min(index + WINDOW_STACK_CHUNK_SIZE, group.stackCount)} of ${group.stackCount}`,
      });
    }
    return chunks;
  });
}

function chunkGroups(groups: DrawerMaterialGroup[]): DrawerMaterialGroup[][] {
  const chunks: DrawerMaterialGroup[][] = [];
  for (let index = 0; index < groups.length; index += WINDOW_GROUP_SIZE) {
    chunks.push(groups.slice(index, index + WINDOW_GROUP_SIZE));
  }
  return chunks;
}

function estimateWindowHeight(groups: DrawerMaterialGroup[]): number {
  return groups.reduce((height, group) => {
    const qualityGroups = groupLotsByQuality(group.entries, group.unitType, group.kindLabels.length > 1);
    const groupsHeight = qualityGroups.reduce((sum, qualityGroup) => sum + estimateQualityGroupHeight(qualityGroup), 0);
    return height + 178 + groupsHeight;
  }, 0);
}

type WindowedGroupBlockProps = InventoryLotReserveProps & {
  groups: DrawerMaterialGroup[];
  root: HTMLDivElement | null;
  initiallyVisible: boolean;
  manageMode: boolean;
  selectedIds: Set<string>;
  singleSelectedId: string | null;
  onToggleSelect: (entryId: string) => void;
  onEdit: (entry: InventoryEntry) => void;
  onQuickDelete: () => void;
  onQuickTransfer: () => void;
};

const WindowedGroupBlock = memo(function WindowedGroupBlock({
  groups,
  root,
  initiallyVisible,
  manageMode,
  selectedIds,
  singleSelectedId,
  reservedByLotId,
  onToggleSelect,
  onEdit,
  onQuickDelete,
  onQuickTransfer,
}: WindowedGroupBlockProps) {
  const blockRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(initiallyVisible || typeof IntersectionObserver === 'undefined');
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const estimatedHeight = useMemo(() => estimateWindowHeight(groups), [groups]);

  useEffect(() => {
    const block = blockRef.current;
    if (!block || !root || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { root, rootMargin: '560px 0px' },
    );
    observer.observe(block);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    const block = blockRef.current;
    if (!block || !isVisible || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const height = Math.ceil(entry.contentRect.height);
      if (height > 0) setMeasuredHeight(height);
    });
    observer.observe(block);
    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <div
      ref={blockRef}
      className="logi-location-window-block logi-location-window-block--cards"
      style={!isVisible ? { minHeight: measuredHeight ?? estimatedHeight } : undefined}
    >
      {isVisible && groups.map((group) => (
        <InventoryMaterialCard
          key={group.id}
          group={group}
          manageMode={manageMode}
          selectedIds={selectedIds}
          singleSelectedId={singleSelectedId}
          reservedByLotId={reservedByLotId}
          onToggleSelect={onToggleSelect}
          onEdit={onEdit}
          onQuickDelete={onQuickDelete}
          onQuickTransfer={onQuickTransfer}
        />
      ))}
    </div>
  );
});

type WindowedMaterialGroupsProps = InventoryLotReserveProps & {
  groups: DrawerMaterialGroup[];
  manageMode: boolean;
  selectedIds: Set<string>;
  singleSelectedId: string | null;
  onToggleSelect: (entryId: string) => void;
  onEdit: (entry: InventoryEntry) => void;
  onQuickDelete: () => void;
  onQuickTransfer: () => void;
};

const WindowedMaterialGroups = memo(function WindowedMaterialGroups({
  groups,
  manageMode,
  selectedIds,
  singleSelectedId,
  reservedByLotId,
  onToggleSelect,
  onEdit,
  onQuickDelete,
  onQuickTransfer,
}: WindowedMaterialGroupsProps) {
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const blocks = useMemo(() => chunkGroups(splitLargeMaterialGroups(groups)), [groups]);

  return (
    <div
      ref={setScrollRoot}
      className="logi-location-stack-table-wrap logi-location-stack-table-wrap--cards"
    >
      {blocks.map((block, index) => (
        <WindowedGroupBlock
          key={block[0]?.id ?? index}
          groups={block}
          root={scrollRoot}
          initiallyVisible={index === 0}
          manageMode={manageMode}
          selectedIds={selectedIds}
          singleSelectedId={singleSelectedId}
          reservedByLotId={reservedByLotId}
          onToggleSelect={onToggleSelect}
          onEdit={onEdit}
          onQuickDelete={onQuickDelete}
          onQuickTransfer={onQuickTransfer}
        />
      ))}
    </div>
  );
});

function InventoryBulkDeleteDialog({
  count,
  onConfirm,
  onCancel,
}: {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div className="logi-inv-modal-overlay" onClick={onCancel} aria-hidden />
      <div className="logi-inv-modal logi-inv-modal--danger" role="alertdialog" aria-modal="true" aria-labelledby="inv-delete-title" aria-describedby="inv-delete-desc">
        <div className="logi-inv-modal-head">
          <h2 id="inv-delete-title">Delete selected items?</h2>
        </div>
        <div className="logi-inv-modal-body">
          <p id="inv-delete-desc">
            {count === 1
              ? 'You are about to delete the selected item from your inventory.'
              : `You are about to delete ${count} selected items from your inventory.`}
          </p>
        </div>
        <div className="logi-inv-modal-foot">
          <button type="button" className="logi-inv-modal-btn logi-inv-modal-btn--ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="logi-inv-modal-btn logi-inv-modal-btn--danger" onClick={onConfirm}>Delete items</button>
        </div>
      </div>
    </>
  );
}

type SelectedLocationDetailProps = InventoryLotReserveProps & {
  selectedLocation: LocationGroup;
  drawerMaterialGroups: DrawerMaterialGroup[];
  manageMode: boolean;
  selectedEntryIds: Set<string>;
  onCollapse: (locationId: string) => void;
  onToggleManageMode: () => void;
  onToggleSelect: (entryId: string) => void;
  onClearSelection: () => void;
  onExitManageMode: () => void;
  onEdit: (entry: InventoryEntry) => void;
  onBulkDeleteRequest: () => void;
  onTransferRequest: () => void;
  hideHeader?: boolean;
  detailId?: string;
};

export const SelectedLocationDetail = memo(function SelectedLocationDetail({
  selectedLocation,
  drawerMaterialGroups,
  manageMode,
  selectedEntryIds,
  reservedByLotId,
  onCollapse,
  onToggleManageMode,
  onToggleSelect,
  onClearSelection,
  onExitManageMode,
  onEdit,
  onBulkDeleteRequest,
  onTransferRequest,
  hideHeader = false,
  detailId = 'inventory-location-detail',
}: SelectedLocationDetailProps) {
  const selectedCount = selectedEntryIds.size;
  const singleSelectedId = selectedCount === 1 ? Array.from(selectedEntryIds)[0] : null;

  return (
    <section
      id={detailId}
      className={`logi-location-detail${hideHeader ? ' logi-location-detail--inline-mobile' : ''}`}
      aria-label={`${selectedLocation.name} inventory details`}
    >
      {!hideHeader && (
        <div className="logi-location-detail-head">
          <div>
            <div className="logi-location-detail-title-row">
              <h2>{selectedLocation.name}</h2>
              <button
                type="button"
                className={`logi-inv-manage-btn${manageMode ? ' is-active' : ''}`}
                onClick={onToggleManageMode}
                title={manageMode ? 'Exit manage mode' : 'Manage inventory'}
                aria-label={manageMode ? 'Exit manage mode' : 'Manage inventory'}
                aria-pressed={manageMode}
              >
                <ManageSelectIcon />
              </button>
              <span className="logi-location-active-badge">Active</span>
            </div>
          </div>
          <button type="button" className="logi-location-collapse-btn" onClick={() => onCollapse(selectedLocation.id)}>Collapse</button>
        </div>
      )}

      {hideHeader && (
        <div className="logi-location-detail-head logi-location-detail-head--inline-manage">
          <button
            type="button"
            className={`logi-inv-manage-btn${manageMode ? ' is-active' : ''}`}
            onClick={onToggleManageMode}
            title={manageMode ? 'Exit manage mode' : 'Manage inventory'}
            aria-label={manageMode ? 'Exit manage mode' : 'Manage inventory'}
            aria-pressed={manageMode}
          >
            <ManageSelectIcon />
            <span>{manageMode ? 'Managing' : 'Select items'}</span>
          </button>
        </div>
      )}

      {manageMode && (
        <div className="logi-inv-manage-toolbar" role="toolbar" aria-label="Inventory selection actions">
          <span className="logi-inv-manage-count">{selectedCount} selected</span>
          <button type="button" disabled={selectedCount === 0} onClick={onTransferRequest}>Transfer</button>
          <button type="button" className="is-delete" disabled={selectedCount === 0} onClick={onBulkDeleteRequest}>Delete</button>
          <button type="button" disabled={selectedCount === 0} onClick={onClearSelection}>Clear selection</button>
          <button type="button" onClick={onExitManageMode}>Done</button>
        </div>
      )}

      {drawerMaterialGroups.length > 0 ? (
        <WindowedMaterialGroups
          groups={drawerMaterialGroups}
          manageMode={manageMode}
          selectedIds={selectedEntryIds}
          singleSelectedId={singleSelectedId}
          reservedByLotId={reservedByLotId}
          onToggleSelect={onToggleSelect}
          onEdit={onEdit}
          onQuickDelete={onBulkDeleteRequest}
          onQuickTransfer={onTransferRequest}
        />
      ) : (
        <div className="logi-location-stack-table-wrap logi-location-stack-table-wrap--cards">
          <div className="logi-location-detail-empty">
            {selectedLocation.id === '__unassigned__'
              ? 'No stacks without assigned location.'
              : 'No stacks recorded at this location.'}
          </div>
        </div>
      )}
    </section>
  );
});

export default function InventoryPage({ fixture }: { fixture?: InventoryPageFixture } = {}) {
  const isFixture = fixture !== undefined;
  const [searchParams] = useSearchParams();
  const { session, loading: authLoading, user } = useAuthSession();
  const accessToken = session?.access_token ?? null;
  const authenticatedUserId = user?.id ?? null;
  const storeEntries = useLogisticsStore((state) => state.inventoryEntries);
  const entries = fixture?.entries ?? storeEntries;
  const activeEntries = useMemo(() => getActiveInventoryEntries(entries), [entries]);
  const storeMaterials = useLogisticsStore((state) => state.materialTemplates);
  const materials = fixture?.materials ?? storeMaterials;
  const storeLocations = useLogisticsStore((state) => state.locations);
  const locations = fixture?.locations ?? storeLocations;
  const storeInventoryUi = useLogisticsStore((state) => state.inventoryUi);
  const inventoryUi = useMemo<InventoryUiState>(() => fixture
    ? {
        ...storeInventoryUi,
        viewMode: 'location',
        ...fixture.inventoryUi,
        selectedLocationId: fixture.selectedLocationId,
      }
    : storeInventoryUi, [fixture, storeInventoryUi]);
  const storeInventorySync = useLogisticsStore((state) => state.inventorySync);
  const inventorySync: InventorySyncState = fixture
    ? {
        ...storeInventorySync,
        status: 'idle',
        isFetching: false,
        isSyncing: false,
        loadedForUserId: null,
        lastSuccessfulSyncAt: null,
        activeRequestId: 0,
        syncError: undefined,
        hasUnsyncedChanges: false,
        pendingMutationCount: 0,
        hasHydratedPersist: true,
        hasFetchedServerInventory: true,
      }
    : storeInventorySync;
  const setInventoryUi = useLogisticsStore((state) => state.setInventoryUi);
  const setInventorySync = useLogisticsStore((state) => state.setInventorySync);
  const addInventoryEntries = useLogisticsStore((state) => state.addInventoryEntries);
  const applyInventoryImportBatch = useLogisticsStore((state) => state.applyInventoryImportBatch);
  const undoInventoryImportBatch = useLogisticsStore((state) => state.undoInventoryImportBatch);
  const updateInventoryEntry = useLogisticsStore((state) => state.updateInventoryEntry);
  const updateInventoryEntryAsync = useLogisticsStore((state) => state.updateInventoryEntryAsync);
  const transferInventoryStacksAsync = useLogisticsStore((state) => state.transferInventoryStacksAsync);
  const deleteInventoryEntry = useLogisticsStore((state) => state.deleteInventoryEntry);
  const storeBuildQueue = useLogisticsStore((state) => state.buildQueue);
  const buildQueue = fixture?.buildQueue ?? storeBuildQueue;
  const replaceOnlineState = useLogisticsStore((state) => state.replaceOnlineState);
  const applyInventorySyncFailure = useLogisticsStore((state) => state.applyInventorySyncFailure);
  const queryLocationId = isFixture ? '' : searchParams.get('location') ?? '';

  const [panel, setPanel] = useState<PanelState | null>(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [search, setSearch] = useState(() => inventoryUi.searchQuery);
  const [materialFilter, setMaterialFilter] = useState(() => inventoryUi.materialFilter);
  const [locationFilter, setLocationFilter] = useState(() => inventoryUi.locationFilter);
  const effectiveLocationFilter = queryLocationId || locationFilter;
  const [qualityMin, setQualityMin] = useState(() => inventoryUi.qualityMin);
  const [sortKey, setSortKey] = useState<SortKey>(() => inventoryUi.sortKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => inventoryUi.sortDir);
  const [viewMode, setViewMode] = useState<ViewMode>(() => inventoryUi.viewMode);
  const [listGroupBy, setListGroupBy] = useState<'location' | 'item'>(() => inventoryUi.listGroupBy);
  // Do not write the default local state over a persisted selection before hydration finishes.
  const [isInventoryUiReady, setIsInventoryUiReady] = useState(() => isFixture || inventorySync.hasHydratedPersist);
  const [expandedHierarchyKeys, setExpandedHierarchyKeys] = useState<Set<string>>(
    () => new Set([...inventoryUi.expandedCards, ...inventoryUi.expandedQualityRows]),
  );
  const [addContext, setAddContext] = useState<InventoryAddContext | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(() => inventoryUi.selectedLocationId);
  const [manageLocationId, setManageLocationId] = useState<string | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [undoLedger, setUndoLedger] = useState<InventoryUndoLedgerEntry | null>(null);
  const [successNotice, setSuccessNotice] = useState<InventorySuccessNotice | null>(null);
  const [inventoryGuardMessage, setInventoryGuardMessage] = useState('');
  const [, setSyncLabelTick] = useState(0);
  const freshnessBlockReason = isFixture
    ? 'Inventory fixture is read-only.'
    : getInventoryFreshnessBlockReason(inventorySync, authenticatedUserId);
  const syncLabel = isFixture ? 'Preview data' : formatInventorySyncLabel(inventorySync);
  const syncTone = isFixture ? 'synced' : getInventorySyncTone(inventorySync);

  const refreshInventoryFromServer = useCallback(async () => {
    if (authLoading) {
      logInventorySyncDev("sync skipped", { reason: "auth-loading" });
      return;
    }
    if (!inventorySync.hasHydratedPersist) {
      logInventorySyncDev("sync skipped", { reason: "persist-not-hydrated" });
      return;
    }
    if (!accessToken || !authenticatedUserId || isAuthRecoveryFailed()) {
      setInventorySync({
        isFetching: false,
        status: "idle",
        hasFetchedServerInventory: false,
        loadedForUserId: null,
        lastSuccessfulSyncAt: null,
        syncError: isAuthRecoveryFailed()
          ? SESSION_EXPIRED_SYNC_MESSAGE
          : 'Sign in to sync inventory.',
      });
      logInventorySyncDev("sync skipped", { reason: "missing-auth" });
      return;
    }

    const sync = useLogisticsStore.getState().inventorySync;
    if (shouldSkipInventoryFetch({
      caller: "inventory-page-manual-retry",
      isStale: isInventoryServerFetchStale(sync),
      allowWhileFresh: true,
    })) {
      return;
    }

    const requestId = createInventorySyncRequestId();
    setInventorySync(buildInventorySyncBeginPatch(requestId, authenticatedUserId));
    logInventorySyncDev("sync requested", {
      requestId,
      userId: authenticatedUserId,
    });

    try {
      markInventoryFetchStarted();
      const remote = await fetchOnlinePersistenceState(accessToken);
      const currentSync = useLogisticsStore.getState().inventorySync;
      if (currentSync.activeRequestId !== requestId) {
        logInventorySyncDev("sync ignored", { requestId, reason: "stale-request" });
        return;
      }
      logInventorySyncDev("sync success", {
        requestId,
        locationCount: remote.locations.length,
        inventoryEntryCount: remote.inventoryEntries.length,
        buildQueueCount: remote.buildQueue.length,
      });
      replaceOnlineState({
        locations: remote.locations,
        inventoryEntries: remote.inventoryEntries,
        buildQueues: remote.buildQueues,
        buildQueue: remote.buildQueue,
        activeBuildQueueId: remote.activeBuildQueueId,
      }, {
        userId: authenticatedUserId,
        requestId,
      });
    } catch (error) {
      applyInventorySyncFailure(requestId, authenticatedUserId, error);
      logInventorySyncDev("sync failure", {
        requestId,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      markInventoryFetchFinished();
    }
  }, [
    accessToken,
    authenticatedUserId,
    applyInventorySyncFailure,
    authLoading,
    inventorySync.hasHydratedPersist,
    replaceOnlineState,
    setInventorySync,
  ]);

  useEffect(() => {
    if (authLoading || !inventorySync.hasHydratedPersist) return;
    logInventorySyncDev("page ready", {
      reason: "initial-load-owned-by-coordinator",
      userId: authenticatedUserId,
    });
  }, [authLoading, authenticatedUserId, inventorySync.hasHydratedPersist]);

  useEffect(() => {
    if (isFixture || !inventorySync.hasHydratedPersist || isInventoryUiReady) return;
    setSearch(inventoryUi.searchQuery);
    setMaterialFilter(inventoryUi.materialFilter);
    setLocationFilter(inventoryUi.locationFilter);
    setQualityMin(inventoryUi.qualityMin);
    setSortKey(inventoryUi.sortKey);
    setSortDir(inventoryUi.sortDir);
    setViewMode(inventoryUi.viewMode);
    setListGroupBy(inventoryUi.listGroupBy);
    setExpandedHierarchyKeys(new Set([...inventoryUi.expandedCards, ...inventoryUi.expandedQualityRows]));
    setSelectedLocationId(inventoryUi.selectedLocationId);
    setIsInventoryUiReady(true);
  }, [inventorySync.hasHydratedPersist, inventoryUi, isFixture, isInventoryUiReady]);

  useEffect(() => {
    if (isFixture || !inventorySync.hasHydratedPersist || !isInventoryUiReady) return;
    setInventoryUi({
      selectedLocationId,
      searchQuery: search,
      materialFilter,
      locationFilter,
      qualityMin,
      sortKey,
      sortDir,
      viewMode,
      listGroupBy,
      expandedCards: Array.from(expandedHierarchyKeys),
      expandedQualityRows: [],
    });
  }, [
    locationFilter,
    materialFilter,
    qualityMin,
    search,
    selectedLocationId,
    setInventoryUi,
    sortDir,
    sortKey,
    viewMode,
    listGroupBy,
    expandedHierarchyKeys,
    inventorySync.hasHydratedPersist,
    isFixture,
    isInventoryUiReady,
  ]);

  useEffect(() => {
    const timer = window.setInterval(() => setSyncLabelTick((tick) => tick + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!panel) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setPanel(null);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [panel]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }
  void handleSort;

  const materialById = useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials]);
  const locationById = useMemo(() => new Map(locations.map((location) => [location.id, location])), [locations]);

  const filtered = useMemo(() => {
    const data = activeEntries.filter((e) => {
      if (materialFilter && toRecord(e).materialId !== materialFilter) return false;
      if (effectiveLocationFilter && getEntryLocationId(e) !== effectiveLocationFilter) return false;
      if (qualityMin > 0 && (e.quality ?? 0) < qualityMin) return false;
      if (search) {
        const mat = e.materialId ? materialById.get(e.materialId) : undefined;
        const loc = e.locationId ? locationById.get(e.locationId) : undefined;
        const q = search.toLowerCase();
        const hit =
          resolveInventoryItemName(e, mat).toLowerCase().includes(q) ||
          (loc?.name.toLowerCase().includes(q) ?? false) ||
          (e.container?.toLowerCase().includes(q) ?? false) ||
          (e.notes?.toLowerCase().includes(q) ?? false);
        if (!hit) return false;
      }
      return true;
    });

    data.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'quality':
          cmp = (a.quality ?? -1) - (b.quality ?? -1);
          break;
        case 'quantity':
          cmp = a.quantity - b.quantity;
          break;
        case 'material': {
          const ma = resolveInventoryItemName(a, a.materialId ? materialById.get(a.materialId) : undefined);
          const mb = resolveInventoryItemName(b, b.materialId ? materialById.get(b.materialId) : undefined);
          cmp = ma.localeCompare(mb);
          break;
        }
        case 'location': {
          const la = a.locationId ? locationById.get(a.locationId)?.name ?? '' : '';
          const lb = b.locationId ? locationById.get(b.locationId)?.name ?? '' : '';
          cmp = la.localeCompare(lb);
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return data;
  }, [activeEntries, effectiveLocationFilter, materialById, locationById, materialFilter, qualityMin, search, sortDir, sortKey]);

  const unassignedCount = useMemo(
    () => activeEntries.filter((entry) => getEntryLocationId(entry) === '__unassigned__').length,
    [activeEntries],
  );

  const locationGroups = useMemo<LocationGroup[]>(() => {
    const map = new Map<string, LocationGroup>();

    for (const location of locations) {
      map.set(location.id, {
        id: location.id,
        name: getLocationName(location),
        type: getLocationType(location),
        subtitle: getLocationSubtitle(location),
        isManual: isManuallyAddedLocation(location),
        entries: [],
        uniqueItems: 0,
        totalScu: 0,
        totalUnits: 0,
        highestQuality: null,
        premiumCount: 0,
      });
    }

    map.set('__unassigned__', {
      id: '__unassigned__',
      name: 'Unassigned Stock',
      type: 'Unassigned',
      subtitle: 'Stacks without a storage location',
      isManual: false,
      entries: [],
      uniqueItems: 0,
      totalScu: 0,
      totalUnits: 0,
      highestQuality: null,
      premiumCount: 0,
    });

    for (const entry of filtered) {
      const locId = getEntryLocationId(entry);
      const group = map.get(locId) ?? map.get('__unassigned__');
      if (!group) continue;
      group.entries.push(entry);
    }

    for (const group of map.values()) {
      const uniqueMaterialIds = new Set<string>();
      for (const entry of group.entries) {
        uniqueMaterialIds.add(getEntryMaterialId(entry));
        const material = entry.materialId ? materialById.get(entry.materialId) : undefined;
        if (resolveInventoryUnitType(entry, material) === 'scu') group.totalScu += entry.quantity;
        else group.totalUnits += entry.quantity;
        if (entry.quality != null) {
          group.highestQuality = group.highestQuality == null ? entry.quality : Math.max(group.highestQuality, entry.quality);
          if (entry.quality >= 900) group.premiumCount += 1;
        }
      }
      group.uniqueItems = uniqueMaterialIds.size;
    }

    return [...map.values()]
      .filter((group) => group.entries.length > 0 || group.isManual || group.id === '__unassigned__')
      .sort((a, b) => (b.entries.length > 0 ? 1 : 0) - (a.entries.length > 0 ? 1 : 0) || b.entries.length - a.entries.length || a.name.localeCompare(b.name));
  }, [filtered, locations, materialById]);

  const selectedLocation = useMemo(
    () => locationGroups.find((group) => group.id === selectedLocationId) ?? null,
    [locationGroups, selectedLocationId],
  );

  const selectedLocationRows = useMemo<DrawerEntryRow[]>(() => {
    if (!selectedLocation) return [];
    return selectedLocation.entries.map((entry) => {
      const materialId = asString(toRecord(entry).materialId);
      const material = materialId ? materialById.get(materialId) : undefined;
      const kind = getEntryKind(entry, material);

      return {
        id: entry.id,
        materialId: getEntryMaterialId(entry),
        materialName: resolveInventoryItemName(entry, material),
        entry,
        kind,
        kindLabel: kind === 'ore' ? 'Raw' : titleCase(kind),
        quantityLabel: formatEntryQuantity(entry, material),
        containerLabel: entry.container || '-',
      };
    });
  }, [selectedLocation, materialById]);

  const drawerRows = useMemo(() => {
    return [...selectedLocationRows].sort(
      (a, b) => ((b.entry.quality ?? -1) - (a.entry.quality ?? -1)) || a.materialName.localeCompare(b.materialName),
    );
  }, [selectedLocationRows]);

  const drawerMaterialGroups = useMemo(() => {
    const groups = new Map<string, DrawerMaterialGroup>();
    for (const row of drawerRows) {
      const existing = groups.get(row.materialId);
      if (existing) {
        existing.entries.push(row);
        existing.total += row.entry.quantity;
        existing.stackCount += 1;
        if (!existing.kindLabels.includes(row.kindLabel)) existing.kindLabels.push(row.kindLabel);
      } else {
        const materialId = asString(toRecord(row.entry).materialId);
        const unitType = resolveInventoryUnitType(row.entry, materialId ? materialById.get(materialId) : undefined);
        groups.set(row.materialId, {
          id: row.materialId,
          name: row.materialName,
          entries: [row],
          total: row.entry.quantity,
          unitType,
          totalLabel: formatInventoryQuantity(row.entry.quantity, unitType),
          kindLabels: [row.kindLabel],
          stackCount: 1,
        });
      }
    }
    return [...groups.values()].map((group) => ({
      ...group,
      totalLabel: formatInventoryQuantity(group.total, group.unitType),
    }));
  }, [drawerRows, materialById]);
  void drawerMaterialGroups;

  const reservedByLotId = useMemo(() => getReservedInventoryMap(buildQueue), [buildQueue]);

  const hierarchyAxis = viewMode === 'item'
    ? 'item'
    : viewMode === 'list'
      ? listGroupBy
      : 'location';
  const hierarchyFolders = useMemo(
    () => buildInventoryHierarchy(filtered, materials, locations, hierarchyAxis),
    [filtered, hierarchyAxis, locations, materials],
  );

  const toggleHierarchyKey = useCallback((key: string) => {
    setExpandedHierarchyKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!queryLocationId || viewMode !== 'location') return;
    setExpandedHierarchyKeys((current) => new Set(current).add(`location:${queryLocationId}`));
  }, [queryLocationId, viewMode]);

  const toggleLocationDrawer = useCallback((locationId: string) => {
    setSelectedLocationId((current) => current === locationId ? null : locationId);
    setManageLocationId(null);
    setSelectedEntryIds(new Set());
    setBulkDeleteOpen(false);
    setTransferOpen(false);
  }, []);

  const exitManageMode = useCallback(() => {
    setManageLocationId(null);
    setSelectedEntryIds(new Set());
    setBulkDeleteOpen(false);
    setTransferOpen(false);
  }, []);

  const toggleManageMode = useCallback((locationId: string) => {
    setManageLocationId((current) => {
      if (current === locationId) {
        setSelectedEntryIds(new Set());
        setBulkDeleteOpen(false);
        setTransferOpen(false);
        return null;
      }
      setSelectedEntryIds(new Set());
      setBulkDeleteOpen(false);
      setTransferOpen(false);
      return locationId;
    });
  }, []);
  void toggleManageMode;

  const toggleEntrySelection = useCallback((entryId: string) => {
    setSelectedEntryIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedEntryIds(new Set());
    setBulkDeleteOpen(false);
    setTransferOpen(false);
  }, []);

  const pushUndoLedger = useCallback((entry: InventoryUndoLedgerEntry) => {
    setUndoLedger(entry);
  }, []);

  const performUndo = useCallback(async () => {
    if (isFixture) return;
    if (!undoLedger) return;
    const action = undoLedger.action;
    try {
      if (action.kind === 'delete') {
        addInventoryEntries(action.entries);
      } else if (action.kind === 'transfer') {
        for (const move of action.moves) {
          await updateInventoryEntryAsync({
            ...move.snapshot,
            locationId: move.fromLocationId,
            updatedAt: new Date().toISOString(),
          });
        }
      } else if (action.kind === 'add') {
        for (const id of action.entryIds) {
          deleteInventoryEntry(id);
        }
      } else if (action.kind === 'import') {
        undoInventoryImportBatch(action.batchId);
      }
      setUndoLedger(null);
      setSuccessNotice(null);
      setSelectedEntryIds(new Set());
      setBulkDeleteOpen(false);
      setTransferOpen(false);
    } catch (error) {
      setInventoryGuardMessage(error instanceof Error ? error.message : String(error));
    }
  }, [addInventoryEntries, deleteInventoryEntry, isFixture, undoInventoryImportBatch, undoLedger, updateInventoryEntryAsync]);

  const handleEditDrawerEntry = useCallback((entry: InventoryEntry) => {
    setPanel({ mode: 'edit', entry });
  }, []);

  const handleBulkDeleteRequest = useCallback(() => {
    if (selectedEntryIds.size === 0) return;
    setTransferOpen(false);
    setBulkDeleteOpen(true);
  }, [selectedEntryIds.size]);

  const handleBulkDeleteCancel = useCallback(() => {
    setBulkDeleteOpen(false);
  }, []);

  const handleBulkDeleteConfirm = useCallback(() => {
    if (isFixture) return;
    if (freshnessBlockReason) {
      setInventoryGuardMessage(freshnessBlockReason);
      return;
    }
    const ids = Array.from(selectedEntryIds);
    const snapshots = ids
      .map((id) => entries.find((entry) => entry.id === id))
      .filter((entry): entry is InventoryEntry => Boolean(entry));
    if (!snapshots.length) {
      setBulkDeleteOpen(false);
      setSelectedEntryIds(new Set());
      return;
    }
    for (const id of ids) {
      deleteInventoryEntry(id);
    }
    pushUndoLedger({
      id: createNewInventoryId(),
      label: `Deleted ${snapshots.length} stack${snapshots.length === 1 ? '' : 's'}`,
      action: { kind: 'delete', entries: snapshots },
    });
    setInventoryGuardMessage('');
    setBulkDeleteOpen(false);
    setSelectedEntryIds(new Set());
    setPanel((current) => (
      current?.mode === 'edit' && ids.includes(current.entry.id) ? null : current
    ));
  }, [deleteInventoryEntry, entries, freshnessBlockReason, isFixture, pushUndoLedger, selectedEntryIds]);

  const handleTransferRequest = useCallback(() => {
    if (selectedEntryIds.size === 0) return;
    setBulkDeleteOpen(false);
    setTransferOpen(true);
  }, [selectedEntryIds.size]);

  const handleTransferCancel = useCallback(() => {
    setTransferOpen(false);
  }, []);

  const handleTransferConfirm = useCallback(async (targetLocationId: string) => {
    if (isFixture) {
      throw new Error('Inventory fixture is read-only.');
    }
    if (!manageLocationId) {
      throw new Error('No source location selected.');
    }
    if (targetLocationId === manageLocationId) {
      throw new Error('Source and target location must be different.');
    }
    if (selectedEntryIds.size === 0) {
      throw new Error('No stacks selected for transfer.');
    }
    if (freshnessBlockReason) {
      throw new Error(freshnessBlockReason);
    }

    const sourceName = locations.find((location) => location.id === manageLocationId)?.name ?? 'source location';
    const targetName = locations.find((location) => location.id === targetLocationId)?.name ?? 'target location';
    const { moves } = await transferInventoryStacksAsync({
      entryIds: Array.from(selectedEntryIds),
      sourceLocationId: manageLocationId,
      targetLocationId,
    });

    pushUndoLedger({
      id: createNewInventoryId(),
      label: `Transfer to ${targetName}`,
      action: { kind: 'transfer', moves },
    });
    setSuccessNotice({
      message: `Transferred ${moves.length} lot${moves.length === 1 ? '' : 's'} from ${sourceName} to ${targetName}.`,
    });
    setInventoryGuardMessage('');
    setTransferOpen(false);
    setSelectedEntryIds(new Set());
  }, [
    freshnessBlockReason,
    locations,
    manageLocationId,
    pushUndoLedger,
    selectedEntryIds,
    transferInventoryStacksAsync,
    isFixture,
  ]);

  function handleSave(updatedEntries: InventoryEntry[]) {
    if (isFixture) {
      setPanel(null);
      return;
    }
    const additions = updatedEntries.filter((updated) => !entries.some((entry) => entry.id === updated.id));
    const updates = updatedEntries.filter((updated) => entries.some((entry) => entry.id === updated.id));
    if (updates.length > 0 && freshnessBlockReason) {
      setInventoryGuardMessage(freshnessBlockReason);
      return;
    }
    updates.forEach(updateInventoryEntry);
    if (additions.length > 0) {
      addInventoryEntries(additions);
      pushUndoLedger({
        id: createNewInventoryId(),
        label: `Added ${additions.length} stack${additions.length === 1 ? '' : 's'}`,
        action: { kind: 'add', entryIds: additions.map((entry) => entry.id) },
      });
    }
    setInventoryGuardMessage('');

    if (panel?.mode === 'edit') setPanel(null);
    // In new mode, keep the drawer open so users can add multiple stacks quickly.
  }

  const handleAddSave = useCallback((updatedEntries: InventoryEntry[]) => {
    handleSave(updatedEntries);
    setAddContext(null);
    if (updatedEntries[0]) {
      const row = updatedEntries[0];
      const locationKey = row.locationId ?? '__unassigned__';
      setExpandedHierarchyKeys((current) => new Set(current).add(`location:${locationKey}`));
    }
  // handleSave intentionally owns the existing mutation, undo, and freshness behavior.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, freshnessBlockReason, isFixture, panel]);

  const startManageAtLocation = useCallback((locationId: string) => {
    setManageLocationId(locationId);
    setSelectedEntryIds(new Set());
    setBulkDeleteOpen(false);
    setTransferOpen(false);
  }, []);
  void toggleLocationDrawer;
  const requestSingleDelete = useCallback((entry: InventoryEntry) => {
    setManageLocationId(getEntryLocationId(entry));
    setSelectedEntryIds(new Set([entry.id]));
    setTransferOpen(false);
    setBulkDeleteOpen(true);
  }, []);

  const requestSingleTransfer = useCallback((entry: InventoryEntry) => {
    setManageLocationId(getEntryLocationId(entry));
    setSelectedEntryIds(new Set([entry.id]));
    setBulkDeleteOpen(false);
    setTransferOpen(true);
  }, []);

  const editingEntry = panel?.mode === 'edit' ? panel.entry : null;
  const addMaterial = addContext?.materialId
    ? materials.find((material) => material.id === addContext.materialId)
    : undefined;

  return (
    <div className="logi-page logi-inv-page" data-inventory-fixture={isFixture ? 'layout' : undefined}>
      <div className="logi-inv-content">
      <div className="logi-page-header logi-inv-header page-compact-header">
        <div>
          <div className="logi-breadcrumb">
            <Link to="/logistics" className="logi-breadcrumb-link">Logistics</Link>
            <span className="logi-breadcrumb-sep">/</span>
            <span className="logi-breadcrumb-active">Inventory</span>
          </div>
          <h1 className="logi-page-title">Inventory</h1>
          <p className="logi-page-subtitle">Track physical boxes, quality, availability, and storage location.</p>
        </div>
        <div className="logi-inv-header-actions">
          {successNotice ? (
            <div className="logi-inv-success-banner" role="status">
              <span>{successNotice.message}</span>
              {undoLedger ? (
                <button type="button" className="logi-inv-undo-btn logi-inv-undo-btn--inline" onClick={() => void performUndo()}>
                  Undo
                </button>
              ) : null}
            </div>
          ) : undoLedger ? (
            <button type="button" className="logi-inv-undo-btn" onClick={() => void performUndo()}>
              Undo: {undoLedger.label}
            </button>
          ) : null}
          <button
            type="button"
            className={`logi-inv-sync-status logi-inv-sync-status--${syncTone}`}
            onClick={() => {
              if (isFixture) return;
              if (inventorySync.syncError || !inventorySync.hasFetchedServerInventory) {
                void refreshInventoryFromServer();
              }
            }}
            disabled={isFixture || inventorySync.isFetching}
            aria-label="Inventory sync status"
          >
            {syncLabel}
          </button>
          <button
            type="button"
            className="logi-btn-secondary"
            onClick={() => setCsvImportOpen(true)}
            disabled={isFixture}
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="M17 8 12 3 7 8" />
              <path d="M12 3v12" />
            </svg>
            Import CSV
          </button>
          <button
            type="button"
            className="logi-btn-primary"
            onClick={() => setPanel({ mode: 'new' })}
            disabled={isFixture}
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Inventory
          </button>
        </div>
      </div>

      {inventoryGuardMessage && (
        <div className="logi-inv-sync-alert" role="alert">{inventoryGuardMessage}</div>
      )}

      <div className="logi-filter-bar logi-inv-filter-bar">
        <label className="logi-inv-filter-field logi-inv-filter-field--search">
          <span className="logi-inv-filter-label">Search inventory</span>
          <span className="logi-search-wrap">
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="logi-search-icon">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              className="logi-search-input"
              placeholder="Material, location, or box name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search inventory"
            />
          </span>
        </label>

        <label className="logi-inv-filter-field">
          <span className="logi-inv-filter-label">Material</span>
          <select
            className="logi-select"
            value={materialFilter}
            onChange={(e) => setMaterialFilter(e.target.value)}
            aria-label="Filter by item"
          >
            <option value="">All Items</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>

        <label className="logi-inv-filter-field">
          <span className="logi-inv-filter-label">Location</span>
          <select
            className="logi-select"
            value={effectiveLocationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            aria-label="Filter by location"
          >
            <option value="">All Locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
            {unassignedCount > 0 && <option value="__unassigned__">Unassigned Stock</option>}
          </select>
        </label>

        <label className="logi-inv-filter-field logi-inv-filter-field--quality">
          <span className="logi-inv-filter-label">Minimum quality</span>
          <span className="logi-search-wrap logi-inv-quality-filter">
            <input
              type="number"
              className="logi-search-input"
              placeholder="Any"
              min={0}
              max={1000}
              step={50}
              value={qualityMin || ''}
              onChange={(e) => setQualityMin(parseInt(e.target.value) || 0)}
              aria-label="Minimum quality"
            />
          </span>
        </label>

        <div className="logi-inv-filter-field logi-inv-filter-field--view">
          <span className="logi-inv-filter-label">View</span>
          <div className="logi-inv-view-toggle" role="group" aria-label="Inventory view mode">
            <button type="button" className={viewMode === 'location' ? 'is-active' : ''} onClick={() => setViewMode('location')}>Location</button>
            <button type="button" className={viewMode === 'item' ? 'is-active' : ''} onClick={() => setViewMode('item')}>Item</button>
            <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')}>List</button>
          </div>
        </div>

        {viewMode === 'list' && (
          <div className="logi-inv-filter-field logi-inv-filter-field--group">
            <span className="logi-inv-filter-label">Group list by</span>
            <div className="logi-inv-list-group-toggle" role="group" aria-label="Group list by">
              <button type="button" className={listGroupBy === 'location' ? 'is-active' : ''} onClick={() => setListGroupBy('location')}>Location</button>
              <button type="button" className={listGroupBy === 'item' ? 'is-active' : ''} onClick={() => setListGroupBy('item')}>Item</button>
            </div>
          </div>
        )}

        <span className="logi-filter-count">
          <strong>{filtered.length}</strong>
          <span>shown / {activeEntries.length}</span>
        </span>
      </div>

      {manageLocationId !== null && (
        <div className="logi-inv-manage-toolbar logi-inv-manage-toolbar--list" role="toolbar" aria-label="Inventory selection actions">
          <span className="logi-inv-manage-count">{selectedEntryIds.size} selected</span>
          <button type="button" disabled={selectedEntryIds.size === 0} onClick={handleTransferRequest}>Transfer</button>
          <button type="button" className="is-delete" disabled={selectedEntryIds.size === 0} onClick={handleBulkDeleteRequest}>Delete</button>
          <button type="button" disabled={selectedEntryIds.size === 0} onClick={clearSelection}>Clear selection</button>
          <button type="button" onClick={exitManageMode}>Done</button>
        </div>
      )}

      <InventoryHierarchy
        folders={hierarchyFolders}
        presentation={viewMode === 'list' ? 'list' : 'tree'}
        expandedKeys={expandedHierarchyKeys}
        reservedByLotId={reservedByLotId}
        manageLocationId={manageLocationId}
        selectedEntryIds={selectedEntryIds}
        onToggleExpanded={toggleHierarchyKey}
        onStartManage={startManageAtLocation}
        onToggleSelect={toggleEntrySelection}
        onAdd={setAddContext}
        onEdit={handleEditDrawerEntry}
        onDelete={requestSingleDelete}
        onTransfer={requestSingleTransfer}
      />
      </div>

      {bulkDeleteOpen && (
        <InventoryBulkDeleteDialog
          count={selectedEntryIds.size}
          onConfirm={handleBulkDeleteConfirm}
          onCancel={handleBulkDeleteCancel}
        />
      )}

      {transferOpen && manageLocationId && (
        <InventoryTransferDialog
          key={manageLocationId}
          selectedEntryIds={selectedEntryIds}
          entries={entries}
          materials={materials}
          sourceLocationId={manageLocationId}
          locations={locations}
          onConfirm={handleTransferConfirm}
          onCancel={handleTransferCancel}
        />
      )}

      {panel && (
        <div className="logi-drawer-overlay" onClick={() => setPanel(null)} aria-hidden />
      )}
      <div className={`logi-drawer logi-entry-modal${panel ? ' logi-drawer--open' : ''}`} role="dialog" aria-modal aria-label={panel?.mode === 'edit' ? 'Edit Inventory Item' : 'Add Inventory Item'}>
        {panel && (
          <InventoryEntryPanel
            key={panel.mode === 'edit' ? panel.entry.id : 'new'}
            entry={editingEntry}
            materials={materials}
            locations={locations}
            onSave={handleSave}
            onCancel={() => setPanel(null)}
          />
        )}
      </div>
      {addContext && (
        <InventoryAddModal
          target={addMaterial ? {
            materialId: addMaterial.id,
            displayName: addContext.displayName ?? addMaterial.name,
            material: addMaterial,
          } : undefined}
          materials={materials}
          locations={locations}
          initialLocationId={addContext.locationId}
          initialQuality={addContext.quality}
          lockMaterial={Boolean(addMaterial)}
          subtitle="Add physical boxes to inventory"
          onSave={handleAddSave}
          onCancel={() => setAddContext(null)}
        />
      )}
      {csvImportOpen && (
        <CsvImportModal
          entries={entries}
          buildQueue={buildQueue}
          materials={materials}
          locations={locations}
          materialById={materialById}
          onClose={() => setCsvImportOpen(false)}
          onApplyBatch={applyInventoryImportBatch}
          onUndoBatch={undoInventoryImportBatch}
          onImportTracked={(batchId, importedCount) => {
            pushUndoLedger({
              id: batchId,
              label: `Imported ${importedCount} lot${importedCount === 1 ? '' : 's'}`,
              action: { kind: 'import', batchId },
            });
          }}
          initialMode={inventoryUi.lastImportMode}
          onModeChange={(mode) => setInventoryUi({ lastImportMode: mode })}
          freshnessBlockReason={freshnessBlockReason}
        />
      )}
    </div>
  );
}
