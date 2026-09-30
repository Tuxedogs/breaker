import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createInventoryEntryDraft, type InventorySyncState, type InventoryUiState, useLogisticsStore } from '../../stores/logisticsStore';
import type { BuildQueueItem, InventoryEntry, InventoryItemKind, InventoryLocation, InventoryUnitType, MaterialTemplate } from '../../types/logistics';
import InventoryTransferDialog from '../../components/logistics/InventoryTransferDialog';
import InventoryEntryPanel from '../../components/logistics/InventoryEntryPanel';
import InventoryAddModal from '../../components/logistics/InventoryAddModal';
import InventoryIcon from '../../assets/sidebar-icons/07-inventory.svg?react';
import CommandHeader from '../../components/shared/CommandHeader';
import InventoryWorkspace, { type InventoryWorkspaceViewMode } from '../../components/logistics/InventoryWorkspace';
import { getInventoryRecordPresentation } from '../../components/logistics/inventoryRecordPresentation';
import {
  getActiveInventoryEntries,
  resolveInventoryItemName,
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
import { createMaterialIdentityResolver, type MaterialIdentityResolver } from '../../lib/materialIdentity';
import { createMaterialResolver } from '../../lib/logistics/materialResolver';
import {
  expectedInventoryCsvUnit,
  inventoryCsvUnitMismatchMessage,
  isRawIceInventoryInput,
  resolveInventoryCsvUnit,
} from '../../lib/logistics/inventoryCsvImport';
import { fetchOnlinePersistenceState } from '../../lib/userOnlinePersistence';
import { getReservedAmountForInventoryLot } from '../../lib/logistics/buildQueueReservations';
import QualityTierBadge from '../../components/shared/QualityTierBadge';
import MobileFilterSheet from '../../components/shared/MobileFilterSheet';
import '../../components/logistics/logistics.css';
import '../../components/logistics/inventory.css';

type PanelState = { mode: 'edit'; entry: InventoryEntry };
type SortKey = 'material' | 'quality' | 'quantity' | 'location';
type InventoryAddContext = {
  locationId?: string;
  materialId?: string;
  displayName?: string;
  quality?: number;
};
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

function getEntryLocationId(entry: InventoryEntry): string {
  const rec = toRecord(entry);
  return asString(rec.locationId) ?? '__unassigned__';
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
  const ownersByInventoryEntryId = new Map<string, Set<string>>();
  for (const item of buildQueue) {
    if (item.status === 'complete') continue;
    const owner = item.itemName ?? item.recipeId;
    for (const allocation of item.reservedAllocations ?? []) {
      if (allocation.quantityReserved <= 0) continue;
      const owners = ownersByInventoryEntryId.get(allocation.inventoryEntryId) ?? new Set<string>();
      owners.add(owner);
      ownersByInventoryEntryId.set(allocation.inventoryEntryId, owners);
    }
  }
  return new Map(Array.from(ownersByInventoryEntryId, ([inventoryEntryId, owners]) => [
    inventoryEntryId,
    {
      quantity: getReservedAmountForInventoryLot(buildQueue, inventoryEntryId),
      owners,
    },
  ]));
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

function getMatchedRefinedName(
  input: string,
  material: MaterialTemplate,
  materialIdentities: MaterialIdentity[],
  identityResolver: MaterialIdentityResolver,
): string | undefined {
  const inputKey = normalizeLookup(input);
  for (const identity of materialIdentities) {
    if (identityResolver.canonicalKey(identity.materialKey) !== material.id) continue;
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
  const identityResolver = createMaterialIdentityResolver(materialIdentities);
  const locationLookup = buildLocationLookup(locations);
  return rows.flatMap<CsvPreviewRow>((row) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const materialNameInput = row.materialInput.trim();
    const locationNameInput = row.locationInput.trim();
    const resolvedMaterial = materialNameInput ? resolveMaterial({ materialName: materialNameInput, displayName: materialNameInput }) : null;
    const material = resolvedMaterial?.material;
    const refinedName = material ? getMatchedRefinedName(materialNameInput, material, materialIdentities, identityResolver) : undefined;
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

export default function InventoryPage({ fixture }: { fixture?: InventoryPageFixture } = {}) {
  const isFixture = fixture !== undefined;
  const [searchParams] = useSearchParams();
  const { session, loading: authLoading, user } = useAuthSession();
  const accessToken = session?.access_token ?? null;
  const authenticatedUserId = user?.id ?? null;
  const storeEntries = useLogisticsStore((state) => state.inventoryEntries);
  const [fixtureEntries, setFixtureEntries] = useState(() => fixture?.entries ?? []);
  const entries = fixture ? fixtureEntries : storeEntries;
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
  const addInventoryEntriesAsync = useLogisticsStore((state) => state.addInventoryEntriesAsync);
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [materialFilter, setMaterialFilter] = useState(() => inventoryUi.materialFilter);
  const [qualityMin, setQualityMin] = useState(() => inventoryUi.qualityMin);
  const [sortKey, setSortKey] = useState<SortKey>(() => inventoryUi.sortKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => inventoryUi.sortDir);
  const [workspaceViewMode, setWorkspaceViewMode] = useState<InventoryWorkspaceViewMode>('grid');
  // Do not write the default local state over a persisted selection before hydration finishes.
  const [isInventoryUiReady, setIsInventoryUiReady] = useState(() => isFixture || inventorySync.hasHydratedPersist);
  const [addContext, setAddContext] = useState<InventoryAddContext | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(() => inventoryUi.selectedLocationId);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [manageLocationId, setManageLocationId] = useState<string | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [undoLedger, setUndoLedger] = useState<InventoryUndoLedgerEntry | null>(null);
  const [successNotice, setSuccessNotice] = useState<InventorySuccessNotice | null>(null);
  const [inventoryGuardMessage, setInventoryGuardMessage] = useState('');
  const [, setSyncLabelTick] = useState(0);
  const freshnessBlockReason = isFixture ? null : getInventoryFreshnessBlockReason(inventorySync, authenticatedUserId);
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
    setQualityMin(inventoryUi.qualityMin);
    setSortKey(inventoryUi.sortKey);
    setSortDir(inventoryUi.sortDir);
    setSelectedLocationId(inventoryUi.selectedLocationId);
    setIsInventoryUiReady(true);
  }, [inventorySync.hasHydratedPersist, inventoryUi, isFixture, isInventoryUiReady]);

  useEffect(() => {
    if (isFixture || !inventorySync.hasHydratedPersist || !isInventoryUiReady) return;
    setInventoryUi({
      selectedLocationId,
      searchQuery: search,
      materialFilter,
      locationFilter: '',
      qualityMin,
      sortKey,
      sortDir,
      viewMode: 'location',
      listGroupBy: 'location',
      expandedCards: [],
      expandedQualityRows: [],
    });
  }, [
    materialFilter,
    qualityMin,
    search,
    selectedLocationId,
    setInventoryUi,
    sortDir,
    sortKey,
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

  const materialById = useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials]);
  const locationById = useMemo(() => new Map(locations.map((location) => [location.id, location])), [locations]);
  const trimmedGlobalSearch = search.trim();
  const isNumericGlobalSearch = /^\d+$/.test(trimmedGlobalSearch);
  const numericGlobalQuality = isNumericGlobalSearch ? Math.min(1000, Number(trimmedGlobalSearch)) : 0;
  const textGlobalSearch = isNumericGlobalSearch ? '' : trimmedGlobalSearch.toLowerCase();
  const effectiveQualityMin = Math.max(qualityMin, numericGlobalQuality);

  const filtered = useMemo(() => {
    const data = activeEntries.filter((e) => {
      if (materialFilter && toRecord(e).materialId !== materialFilter) return false;
      if (effectiveQualityMin > 0 && (e.quality ?? 0) < effectiveQualityMin) return false;
      if (textGlobalSearch) {
        const mat = e.materialId ? materialById.get(e.materialId) : undefined;
        const loc = e.locationId ? locationById.get(e.locationId) : undefined;
        const hit =
          resolveInventoryItemName(e, mat).toLowerCase().includes(textGlobalSearch) ||
          (loc?.name.toLowerCase().includes(textGlobalSearch) ?? false) ||
          (loc?.system?.toLowerCase().includes(textGlobalSearch) ?? false) ||
          String(e.quality ?? '').includes(textGlobalSearch) ||
          `quality ${e.quality ?? ''}`.includes(textGlobalSearch) ||
          (e.container?.toLowerCase().includes(textGlobalSearch) ?? false) ||
          (e.notes?.toLowerCase().includes(textGlobalSearch) ?? false);
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
  }, [activeEntries, effectiveQualityMin, materialById, locationById, materialFilter, sortDir, sortKey, textGlobalSearch]);

  const matchingLocationIds = useMemo(() => {
    const matches = new Set<string>();
    for (const entry of filtered) {
      if (entry.locationId) matches.add(entry.locationId);
    }
    if (textGlobalSearch) {
      for (const location of locations) {
        const searchable = [location.name, location.system, location.category, location.type]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (searchable.includes(textGlobalSearch)) matches.add(location.id);
      }
    }
    return matches;
  }, [filtered, locations, textGlobalSearch]);

  const workspaceLocations = useMemo<InventoryLocation[]>(() => {
    const hasUnassigned = activeEntries.some((entry) => !entry.locationId);
    return hasUnassigned
      ? [...locations, { id: '__unassigned__', name: 'Unassigned Stock', category: 'unassigned' }]
      : locations;
  }, [activeEntries, locations]);

  useEffect(() => {
    const locationIds = new Set(workspaceLocations.map((location) => location.id));
    const requested = queryLocationId && locationIds.has(queryLocationId) ? queryLocationId : null;
    if (requested && requested !== selectedLocationId) {
      setSelectedLocationId(requested);
      setSelectedLotId(null);
      return;
    }
    if (selectedLocationId && locationIds.has(selectedLocationId)) return;
    const firstPopulated = workspaceLocations.find((location) =>
      activeEntries.some((entry) => getEntryLocationId(entry) === location.id));
    setSelectedLocationId(firstPopulated?.id ?? workspaceLocations[0]?.id ?? null);
    setSelectedLotId(null);
  }, [activeEntries, queryLocationId, selectedLocationId, workspaceLocations]);

  const selectLocation = useCallback((locationId: string) => {
    setSelectedLocationId(locationId);
    setSelectedLotId(null);
    setManageLocationId(null);
    setSelectedEntryIds(new Set());
    setBulkDeleteOpen(false);
    setTransferOpen(false);
  }, []);

  const pushUndoLedger = useCallback((entry: InventoryUndoLedgerEntry) => {
    setUndoLedger(entry);
  }, []);

  const performUndo = useCallback(async () => {
    if (!undoLedger) return;
    const action = undoLedger.action;
    try {
      if (isFixture) {
        if (action.kind === 'delete') {
          setFixtureEntries((current) => [...current, ...action.entries]);
        } else if (action.kind === 'transfer') {
          const originals = new Map(action.moves.map((move) => [move.snapshot.id, move.snapshot]));
          setFixtureEntries((current) => current.map((entry) => originals.get(entry.id) ?? entry));
        } else if (action.kind === 'add') {
          setFixtureEntries((current) => current.filter((entry) => !action.entryIds.includes(entry.id)));
        }
      } else if (action.kind === 'delete') {
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

  const handleBulkDeleteCancel = useCallback(() => {
    setBulkDeleteOpen(false);
  }, []);

  const handleBulkDeleteConfirm = useCallback(() => {
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
    if (isFixture) setFixtureEntries((current) => current.filter((entry) => !ids.includes(entry.id)));
    else for (const id of ids) deleteInventoryEntry(id);
    pushUndoLedger({
      id: createNewInventoryId(),
      label: `Deleted ${snapshots.length} box${snapshots.length === 1 ? '' : 'es'}`,
      action: { kind: 'delete', entries: snapshots },
    });
    setInventoryGuardMessage('');
    setBulkDeleteOpen(false);
    setSelectedEntryIds(new Set());
    setSelectedLotId(null);
    setPanel((current) => (
      current?.mode === 'edit' && ids.includes(current.entry.id) ? null : current
    ));
  }, [deleteInventoryEntry, entries, freshnessBlockReason, isFixture, pushUndoLedger, selectedEntryIds]);

  const handleTransferCancel = useCallback(() => {
    setTransferOpen(false);
  }, []);

  const moveInventoryLots = useCallback(async (
    entryIds: string[],
    sourceLocationId: string,
    targetLocationId: string,
  ) => {
    if (freshnessBlockReason) throw new Error(freshnessBlockReason);
    if (isFixture) {
      const snapshots = entries.filter((entry) => entryIds.includes(entry.id));
      if (snapshots.length !== entryIds.length) throw new Error('One or more selected boxes are no longer in inventory.');
      if (snapshots.some((entry) => getEntryLocationId(entry) !== sourceLocationId)) {
        throw new Error('One or more selected boxes are no longer at the source location.');
      }
      if (targetLocationId === 'port-tressler' && snapshots.some((entry) => entry.id === 'fixture-transfer-failure')) {
        throw new Error('Transfer failed. The source location is unchanged. Retry when inventory sync is available.');
      }
      const movedAt = new Date().toISOString();
      setFixtureEntries((current) => current.map((entry) =>
        entryIds.includes(entry.id) ? { ...entry, locationId: targetLocationId, updatedAt: movedAt } : entry));
      return { moves: snapshots.map((snapshot) => ({ snapshot, fromLocationId: sourceLocationId })) };
    }
    return transferInventoryStacksAsync({ entryIds, sourceLocationId, targetLocationId });
  }, [entries, freshnessBlockReason, isFixture, transferInventoryStacksAsync]);

  const handleTransferConfirm = useCallback(async (targetLocationId: string) => {
    if (!manageLocationId) {
      throw new Error('No source location selected.');
    }
    if (targetLocationId === manageLocationId) {
      throw new Error('Source and target location must be different.');
    }
    if (selectedEntryIds.size === 0) {
      throw new Error('No boxes selected for transfer.');
    }

    const sourceName = workspaceLocations.find((location) => location.id === manageLocationId)?.name ?? 'source location';
    const targetName = workspaceLocations.find((location) => location.id === targetLocationId)?.name ?? 'target location';
    const movedIds = Array.from(selectedEntryIds);
    const { moves } = await moveInventoryLots(movedIds, manageLocationId, targetLocationId);

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
    setSelectedLocationId(targetLocationId);
    setSelectedLotId(movedIds.length === 1 ? movedIds[0] : null);
  }, [
    manageLocationId,
    moveInventoryLots,
    pushUndoLedger,
    selectedEntryIds,
    workspaceLocations,
  ]);

  const handleWorkspaceMove = useCallback(async (entry: InventoryEntry, targetLocationId: string) => {
    const sourceLocationId = getEntryLocationId(entry);
    const targetName = workspaceLocations.find((location) => location.id === targetLocationId)?.name ?? 'target location';
    const recordPresentation = getInventoryRecordPresentation(entry);
    setSuccessNotice(null);
    const { moves } = await moveInventoryLots([entry.id], sourceLocationId, targetLocationId);
    pushUndoLedger({
      id: createNewInventoryId(),
      label: `Move ${resolveInventoryItemName(entry, entry.materialId ? materialById.get(entry.materialId) : undefined)} to ${targetName}`,
      action: { kind: 'transfer', moves },
    });
    setSuccessNotice({ message: `Moved one ${recordPresentation.moveNoun} to ${targetName}.` });
    setSelectedLocationId(targetLocationId);
    setSelectedLotId(entry.id);
    setInventoryGuardMessage('');
  }, [materialById, moveInventoryLots, pushUndoLedger, workspaceLocations]);

  function handleSave(updatedEntries: InventoryEntry[]) {
    if (isFixture) {
      setFixtureEntries((current) => {
        const updates = new Map(updatedEntries.map((entry) => [entry.id, entry]));
        const next = current.map((entry) => updates.get(entry.id) ?? entry);
        for (const entry of updatedEntries) if (!current.some((candidate) => candidate.id === entry.id)) next.push(entry);
        return next;
      });
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
        label: `Added ${additions.length} box${additions.length === 1 ? '' : 'es'}`,
        action: { kind: 'add', entryIds: additions.map((entry) => entry.id) },
      });
    }
    setInventoryGuardMessage('');

    if (panel?.mode === 'edit') setPanel(null);
  }

  const handleAddSave = useCallback(async (updatedEntries: InventoryEntry[]) => {
    if (isFixture) {
      setFixtureEntries((current) => [...current, ...updatedEntries]);
      setAddContext(null);
      return;
    }

    await addInventoryEntriesAsync(updatedEntries);
    pushUndoLedger({
      id: createNewInventoryId(),
      label: `Added ${updatedEntries.length} box${updatedEntries.length === 1 ? '' : 'es'}`,
      action: { kind: 'add', entryIds: updatedEntries.map((entry) => entry.id) },
    });
    setSuccessNotice({
      message: `Added ${updatedEntries.length} inventory box${updatedEntries.length === 1 ? '' : 'es'}.`,
    });
    setInventoryGuardMessage('');
    if (updatedEntries[0]) setSelectedLocationId(getEntryLocationId(updatedEntries[0]));
    setAddContext(null);
  }, [addInventoryEntriesAsync, isFixture, pushUndoLedger]);

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

  const editingEntry = panel?.entry ?? null;
  const addMaterial = addContext?.materialId
    ? materials.find((material) => material.id === addContext.materialId)
    : undefined;

  return (
    <div className="logi-page logi-inv-page" data-inventory-fixture={isFixture ? 'layout' : undefined}>
      <div className="logi-inv-content">
      <div className="logi-page-header logi-inv-header page-compact-header">
        <CommandHeader
          title="Inventory"
          description="Track physical boxes, quality, availability, and storage location."
          icon={<InventoryIcon />}
          actions={<div className="logi-inv-header-actions">
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
          </div>}
        />
      </div>

      {inventoryGuardMessage && (
        <div className="logi-inv-sync-alert" role="alert">{inventoryGuardMessage}</div>
      )}

      <MobileFilterSheet
        open={mobileFiltersOpen}
        title="Inventory filters"
        onClose={() => setMobileFiltersOpen(false)}
        footer={<><button type="button" className="logi-btn-secondary" onClick={() => { setMaterialFilter(''); setQualityMin(0); }}>Clear filters</button><button type="button" className="logi-btn-primary" onClick={() => setMobileFiltersOpen(false)}>Show {filtered.length} boxes</button></>}
      >
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

      </MobileFilterSheet>

      <InventoryWorkspace
        entries={filtered}
        locations={workspaceLocations}
        materials={materials}
        buildQueue={buildQueue}
        selectedLocationId={selectedLocationId}
        selectedLotId={selectedLotId}
        readOnly={Boolean(freshnessBlockReason)}
        hasActiveFilters={Boolean(search.trim() || materialFilter || qualityMin)}
        globalSearch={search}
        globalQualityMin={numericGlobalQuality}
        matchingLocationIds={matchingLocationIds}
        viewMode={workspaceViewMode}
        sortKey={sortKey}
        sortDir={sortDir}
        onGlobalSearchChange={setSearch}
        onViewModeChange={setWorkspaceViewMode}
        onSortKeyChange={setSortKey}
        onSortDirChange={() => setSortDir((current) => current === 'asc' ? 'desc' : 'asc')}
        onOpenFilters={() => setMobileFiltersOpen(true)}
        onSelectLocation={selectLocation}
        onSelectLot={setSelectedLotId}
        onEdit={handleEditDrawerEntry}
        onMoveRequest={requestSingleTransfer}
        onDelete={requestSingleDelete}
        onMoveLot={handleWorkspaceMove}
        onAddAtLocation={(locationId) => setAddContext({ locationId })}
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
          locations={workspaceLocations.filter((location) => location.id !== '__unassigned__')}
          onConfirm={handleTransferConfirm}
          onCancel={handleTransferCancel}
        />
      )}

      {panel && (
        <div className="logi-drawer-overlay" onClick={() => setPanel(null)} aria-hidden />
      )}
      <div className={`logi-drawer logi-entry-modal${panel ? ' logi-drawer--open' : ''}`} role="dialog" aria-modal aria-label="Edit Inventory Item">
        {panel && (
          <InventoryEntryPanel
            key={panel.entry.id}
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
