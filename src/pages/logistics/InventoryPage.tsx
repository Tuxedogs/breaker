import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { createInventoryEntryDraft, useLogisticsStore } from '../../stores/logisticsStore';
import type { BuildQueueItem, InventoryEntry, InventoryLocation, InventoryUnitType, MaterialTemplate } from '../../types/logistics';
import InventoryTable, { type SortKey } from '../../components/logistics/InventoryTable';
import InventoryEntryPanel from '../../components/logistics/InventoryEntryPanel';
import MaterialIcon from '../../components/logistics/MaterialIcon';
import {
  formatEntryQuantity,
  formatInventoryQuantity,
  getActiveInventoryEntries,
  resolveInventoryItemName,
  resolveInventoryUnitType,
} from '../../lib/logistics/inventory';
import {
  buildInventoryLocationLookup,
  normalizeInventoryLocationLookup,
  resolveInventoryLocationByInput,
} from '../../lib/logistics/inventoryLocationOptions';
import { useMaterialIdentityIndex, type MaterialIdentity } from '../../lib/logistics/materialIdentityIndex';
import { createMaterialResolver } from '../../lib/logistics/materialResolver';
import '../../components/logistics/logistics.css';
import '../../components/logistics/inventory.css';

type PanelState = { mode: 'new' } | { mode: 'edit'; entry: InventoryEntry };
type ViewMode = 'cards' | 'list';
type UnknownRecord = Record<string, unknown>;
type ImportMode = 'append' | 'replace_matching_materials_location' | 'replace_locations' | 'replace_all';

const WINDOW_GROUP_SIZE = 4;
const WINDOW_STACK_CHUNK_SIZE = 25;

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

type CsvLotTotal = {
  key: string;
  materialName: string;
  quality?: number;
  unitType: InventoryUnitType;
  locationName: string;
  quantity: number;
  lots: number;
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

function getQualityClass(quality: number | null | undefined): string {
  if (quality == null || !Number.isFinite(quality)) return '';
  if (quality >= 950) return 'logi-quality--legendary';
  if (quality >= 900) return 'logi-quality--premium';
  if (quality >= 800) return 'logi-quality--strong';
  if (quality >= 650) return 'logi-quality--mid';
  return 'logi-quality--low';
}

function normalizeLookup(value: string): string {
  return normalizeInventoryLocationLookup(value);
}

function createNewInventoryId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createNewLocationId(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  return `import-${slug || 'location'}-${Date.now().toString(36)}`;
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

function resolveCsvUnit(value: string): { unitType?: InventoryUnitType; label?: string; multiplier: number; warning?: string } {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return { multiplier: 1 };
  if (normalized === 'scu') return { unitType: 'scu', label: 'SCU', multiplier: 1 };
  if (normalized === 'cscu') return { unitType: 'scu', label: 'SCU', multiplier: 0.01, warning: 'cSCU converted to SCU.' };
  if (normalized === 'unit') return { unitType: 'unit', label: 'unit', multiplier: 1 };
  if (normalized === 'units') return { unitType: 'unit', label: 'unit', multiplier: 1, warning: 'Unit normalized from "units" to "unit".' };
  return { multiplier: 1 };
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

function summarizeCsvLots(rows: CsvPreviewRow[]): CsvLotTotal[] {
  const totals = new Map<string, CsvLotTotal>();
  for (const row of rows) {
    if (row.errors.length) continue;
    const key = [
      row.materialId ?? normalizeLookup(row.materialName),
      row.quality ?? '__none',
      row.unitType,
      row.locationId ?? normalizeLookup(row.locationName),
    ].join('|');
    const existing = totals.get(key);
    if (existing) {
      existing.quantity = roundCsvQuantity(existing.quantity + row.quantity);
      existing.lots += 1;
    } else {
      totals.set(key, {
        key,
        materialName: row.materialName,
        quality: row.quality,
        unitType: row.unitType,
        locationName: row.locationName,
        quantity: row.quantity,
        lots: 1,
      });
    }
  }
  return Array.from(totals.values()).sort((a, b) =>
    a.materialName.localeCompare(b.materialName) ||
    (b.quality ?? -1) - (a.quality ?? -1) ||
    a.locationName.localeCompare(b.locationName)
  );
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
      locationName: entry.locationId ? locations.find((location) => location.id === entry.locationId)?.name ?? 'Unknown location' : 'Unassigned stock',
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
    const unit = resolveCsvUnit(row.unitInput);
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

    if (!materialNameInput) errors.push('Missing material.');
    else if (!material) errors.push('Unknown material.');
    else if (normalizeLookup(material.name) !== normalizeLookup(materialNameInput)) {
      warnings.push(refinedName
        ? `Matched refined material name: ${refinedName}.`
        : `Material name normalized to ${material.name}.`);
    }

    if (!row.quantityInput.trim()) errors.push('Missing quantity.');
    else if (parsedQuantity === null || parsedQuantity <= 0) errors.push('Invalid quantity.');

    if (!row.unitInput.trim()) errors.push('Missing unit.');
    else if (!unit.unitType) errors.push('Unsupported unit.');
    else if (unit.warning) warnings.push(unit.warning);

    if (!row.qualityInput.trim()) errors.push('Missing quality.');
    else if (parsedQuality === null || parsedQuality < 0 || parsedQuality > 1000) errors.push('Invalid quality.');

    if (row.boxSizeInput.trim()) {
      if (unit.unitType === 'unit') warnings.push('Box size ignored for unit rows.');
      else if (parsedBoxSize === null || parsedBoxSize <= 0) errors.push('Invalid box size.');
    }

    if (!locationNameInput) errors.push('Missing location.');
    else if (!location) warnings.push('New location will be created.');
    else if (location.name !== locationNameInput) warnings.push(`Location name normalized to ${location.name}.`);

    const baseRow: CsvPreviewRow = {
      id: `csv-row-${row.rowNumber}`,
      rowNumbers: [row.rowNumber],
      status: errors.length ? 'error' : warnings.length ? 'warning' : 'valid',
      materialName: refinedName ?? material?.name ?? materialNameInput,
      materialId: material?.id,
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
    itemName: row.materialName,
    itemKind: row.unitType === 'scu' ? 'refined' : 'raw_mineable',
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
  }) => void;
  onUndoBatch: (batchId: string) => void;
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
}: CsvImportModalProps) {
  const materialIdentities = useMaterialIdentityIndex();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<CsvPreviewRow[]>([]);
  const [originalRowCount, setOriginalRowCount] = useState(0);
  const [parseError, setParseError] = useState('');
  const [mode, setMode] = useState<ImportMode>('append');
  const [confirmWarnings, setConfirmWarnings] = useState(false);
  const [confirmReplaceLocations, setConfirmReplaceLocations] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);

  const validRows = rows.filter((row) => !row.errors.length);
  const warningCount = rows.filter((row) => row.warnings.length && !row.errors.length).length;
  const errorCount = rows.filter((row) => row.errors.length).length;
  const affectedLocations = new Set(validRows.map((row) => row.locationName)).size;
  const affectedMaterials = new Set(validRows.map((row) => row.materialName)).size;
  const lotTotals = summarizeCsvLots(rows);
  const replacementPreview = buildReplacementPreview(mode, validRows, entries, locations, materialById, buildQueue);
  const replacementConflicts = replacementPreview.filter((row) => row.reservedQuantity > 0);
  const canImport = validRows.length > 0 &&
    errorCount === 0 &&
    (warningCount === 0 || confirmWarnings) &&
    replacementConflicts.length === 0 &&
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

  function handleImport() {
    if (!canImport) return;
    const importBatchId = `csv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
    onApplyBatch({
      batchId: importBatchId,
      additions,
      replaceEntryIds,
      locations: createdLocations,
    });
    setResult({
      batchId: importBatchId,
      imported: additions.length,
      replaced: replaceEntryIds.length,
      skipped: errorCount,
      locationsUpdated: touchedLocationIds.size,
      materialsUpdated: touchedMaterials.size,
    });
  }

  return (
    <>
      <div className="logi-drawer-overlay" onClick={onClose} aria-hidden />
      <div className="logi-csv-modal" role="dialog" aria-modal="true" aria-label="Import CSV">
        <div className="logi-csv-modal-head">
          <div>
            <span className="logi-csv-kicker">Inventory Import</span>
            <h2>Import CSV</h2>
          </div>
          <button type="button" className="logi-panel-close-btn" onClick={onClose} aria-label="Close import">
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="logi-csv-controls">
          <label className="logi-csv-file">
            <span>{fileName || 'Select CSV file'}</span>
            <input type="file" accept=".csv,text/csv" onChange={(event) => handleFile(event.target.files?.[0])} />
          </label>
          <button type="button" className="logi-btn-ghost" onClick={downloadTemplate}>Download CSV Template</button>
          <select className="logi-select" value={mode} onChange={(event) => setMode(event.target.value as ImportMode)} aria-label="CSV import mode">
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

        {lotTotals.length > 0 && (
          <div className="logi-csv-summary" aria-label="CSV totals by material quality unit and location">
            {lotTotals.slice(0, 12).map((total) => (
              <div key={total.key}>
                <span>{total.materialName} / {total.quality ?? '-'} / {total.unitType} / {total.locationName}</span>
                <strong>{formatCsvNumber(total.quantity)} ({total.lots})</strong>
              </div>
            ))}
          </div>
        )}

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
                    <td>{row.entry.quality ?? '-'}</td>
                    <td>{row.locationName}</td>
                    <td>{row.reservedQuantity > 0 ? `${formatCsvNumber(row.reservedQuantity)} by ${row.reservedBy.join(', ')}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {replacementConflicts.length > 0 && (
          <div className="logi-csv-error" role="alert">
            Import blocked: {replacementConflicts.length} matching active lot{replacementConflicts.length === 1 ? '' : 's'} are reserved by Build Queue.
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
                    <td>{row.quality ?? '-'}</td>
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

        {result && (
          <div className="logi-csv-result" role="status">
            Imported {result.imported} lot{result.imported === 1 ? '' : 's'} / replaced {result.replaced} / skipped {result.skipped}. {result.locationsUpdated} location{result.locationsUpdated === 1 ? '' : 's'} and {result.materialsUpdated} material{result.materialsUpdated === 1 ? '' : 's'} updated.
            {!result.undone && (
              <button
                type="button"
                className="logi-btn-ghost"
                onClick={() => {
                  onUndoBatch(result.batchId);
                  setResult({ ...result, undone: true });
                }}
              >
                Undo import
              </button>
            )}
            {result.undone && <span> Undo complete.</span>}
          </div>
        )}

        <div className="logi-csv-actions">
          <button type="button" className="logi-btn-primary" onClick={handleImport} disabled={!canImport} aria-disabled={!canImport}>Confirm Import</button>
          <button type="button" className="logi-btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </>
  );
}

function QualityPill({ quality }: { quality?: number | null }) {
  if (quality == null || !Number.isFinite(quality)) return <span className="logi-quality-pill logi-quality-pill--empty">—</span>;
  return <span className={`logi-quality-pill ${getQualityClass(quality)}`}>{quality}</span>;
}

function useIsMobileInventoryViewport() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px)');
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isMobile;
}

type InventoryMaterialGroupProps = {
  group: DrawerMaterialGroup;
  onEdit: (entry: InventoryEntry) => void;
  onRequestDelete: (entryId: string) => void;
};

const InventoryMaterialCard = memo(function InventoryMaterialCard({ group, onEdit, onRequestDelete }: InventoryMaterialGroupProps) {
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

      <div className="logi-location-material-card-rows">
        {group.entries.map((row) => (
          <div key={row.id} className="logi-location-card-stack-row">
            <QualityPill quality={row.entry.quality} />
            <span className="logi-location-card-stack-qty">{row.quantityLabel}</span>
            {row.containerLabel !== '-' && <span className="logi-location-card-stack-container">{row.containerLabel}</span>}
            {group.kindLabels.length > 1 && <span className={`logi-location-kind logi-location-kind--${row.kind}`}>{row.kindLabel}</span>}
            <span className="logi-location-row-actions">
              <button type="button" onClick={() => onEdit(row.entry)}>Edit</button>
              <button type="button" className="is-delete" onClick={() => onRequestDelete(row.id)}>Delete</button>
            </span>
          </div>
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

const InventoryLocationCard = memo(function InventoryLocationCard({
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
  return groups.reduce(
    (height, group) => height + 178 + group.entries.length * 31,
    0,
  );
}

type WindowedGroupBlockProps = {
  groups: DrawerMaterialGroup[];
  root: HTMLDivElement | null;
  initiallyVisible: boolean;
  onEdit: (entry: InventoryEntry) => void;
  onRequestDelete: (entryId: string) => void;
};

const WindowedGroupBlock = memo(function WindowedGroupBlock({
  groups,
  root,
  initiallyVisible,
  onEdit,
  onRequestDelete,
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
        <InventoryMaterialCard key={group.id} group={group} onEdit={onEdit} onRequestDelete={onRequestDelete} />
      ))}
    </div>
  );
});

type WindowedMaterialGroupsProps = {
  groups: DrawerMaterialGroup[];
  onEdit: (entry: InventoryEntry) => void;
  onRequestDelete: (entryId: string) => void;
};

const WindowedMaterialGroups = memo(function WindowedMaterialGroups({
  groups,
  onEdit,
  onRequestDelete,
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
          onEdit={onEdit}
          onRequestDelete={onRequestDelete}
        />
      ))}
    </div>
  );
});

type SelectedLocationDetailProps = {
  selectedLocation: LocationGroup;
  drawerMaterialGroups: DrawerMaterialGroup[];
  pendingDeleteEntryId: string | null;
  materialById: Map<string, MaterialTemplate>;
  onCollapse: (locationId: string) => void;
  onEdit: (entry: InventoryEntry) => void;
  onRequestDelete: (entryId: string) => void;
  onDelete: (entryId: string) => void;
  onCancelDelete: () => void;
  hideHeader?: boolean;
  detailId?: string;
};

const SelectedLocationDetail = memo(function SelectedLocationDetail({
  selectedLocation,
  drawerMaterialGroups,
  pendingDeleteEntryId,
  materialById,
  onCollapse,
  onEdit,
  onRequestDelete,
  onDelete,
  onCancelDelete,
  hideHeader = false,
  detailId = 'inventory-location-detail',
}: SelectedLocationDetailProps) {
  const pendingEntry = pendingDeleteEntryId
    ? selectedLocation.entries.find((entry) => entry.id === pendingDeleteEntryId)
    : undefined;

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
              <span className="logi-location-active-badge">Active</span>
            </div>
          </div>
          <button type="button" className="logi-location-collapse-btn" onClick={() => onCollapse(selectedLocation.id)}>Collapse</button>
        </div>
      )}


      {drawerMaterialGroups.length > 0 ? (
        <WindowedMaterialGroups groups={drawerMaterialGroups} onEdit={onEdit} onRequestDelete={onRequestDelete} />
      ) : (
        <div className="logi-location-stack-table-wrap logi-location-stack-table-wrap--cards">
          <div className="logi-location-detail-empty">
            {selectedLocation.id === '__unassigned__'
              ? 'No stacks without assigned location.'
              : 'No stacks recorded at this location.'}
          </div>
        </div>
      )}

      {pendingEntry && (
        <div className="logi-location-delete-confirm" role="alertdialog" aria-modal="false" aria-label="Confirm inventory deletion">
          <div className="logi-location-delete-panel">
            <span className="logi-location-delete-kicker">Are you sure?</span>
            <strong>{resolveInventoryItemName(pendingEntry, pendingEntry.materialId ? materialById.get(pendingEntry.materialId) : undefined)}</strong>
            <p>This inventory item will be deleted from {selectedLocation.name}.</p>
            <div className="logi-location-delete-actions">
              <button type="button" className="logi-location-delete-yes" onClick={() => onDelete(pendingEntry.id)}>Yes</button>
              <button type="button" onClick={onCancelDelete}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
});

export default function InventoryPage() {
  const [searchParams] = useSearchParams();
  const entries = useLogisticsStore((state) => state.inventoryEntries);
  const activeEntries = useMemo(() => getActiveInventoryEntries(entries), [entries]);
  const materials = useLogisticsStore((state) => state.materialTemplates);
  const locations = useLogisticsStore((state) => state.locations);
  const addInventoryEntries = useLogisticsStore((state) => state.addInventoryEntries);
  const applyInventoryImportBatch = useLogisticsStore((state) => state.applyInventoryImportBatch);
  const undoInventoryImportBatch = useLogisticsStore((state) => state.undoInventoryImportBatch);
  const updateInventoryEntry = useLogisticsStore((state) => state.updateInventoryEntry);
  const deleteInventoryEntry = useLogisticsStore((state) => state.deleteInventoryEntry);
  const buildQueue = useLogisticsStore((state) => state.buildQueue);

  const [panel, setPanel] = useState<PanelState | null>(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [materialFilter, setMaterialFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState(() => searchParams.get('location') ?? '');
  const [qualityMin, setQualityMin] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>('quality');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [pendingDeleteEntryId, setPendingDeleteEntryId] = useState<string | null>(null);
  const isMobileViewport = useIsMobileInventoryViewport();

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

  const materialById = useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials]);
  const locationById = useMemo(() => new Map(locations.map((location) => [location.id, location])), [locations]);

  const filtered = useMemo(() => {
    const data = activeEntries.filter((e) => {
      if (materialFilter && toRecord(e).materialId !== materialFilter) return false;
      if (locationFilter && getEntryLocationId(e) !== locationFilter) return false;
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
  }, [activeEntries, materialById, locationById, search, materialFilter, locationFilter, qualityMin, sortKey, sortDir]);

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

  const toggleLocationDrawer = useCallback((locationId: string) => {
    setSelectedLocationId((current) => current === locationId ? null : locationId);
    setPendingDeleteEntryId(null);
  }, []);

  const handleEditDrawerEntry = useCallback((entry: InventoryEntry) => {
    setPanel({ mode: 'edit', entry });
  }, []);

  const handleRequestDrawerDelete = useCallback((entryId: string) => {
    setPendingDeleteEntryId(entryId);
  }, []);

  const handleCancelDrawerDelete = useCallback(() => {
    setPendingDeleteEntryId(null);
  }, []);

  function handleSave(updatedEntries: InventoryEntry[]) {
    const additions = updatedEntries.filter((updated) => !entries.some((entry) => entry.id === updated.id));
    updatedEntries
      .filter((updated) => entries.some((entry) => entry.id === updated.id))
      .forEach(updateInventoryEntry);
    if (additions.length > 0) addInventoryEntries(additions);

    if (panel?.mode === 'edit') setPanel(null);
    // In new mode, keep the drawer open so users can add multiple stacks quickly.
  }

  const handleDelete = useCallback((id: string) => {
    deleteInventoryEntry(id);
    setPendingDeleteEntryId(null);
    setPanel((current) => current?.mode === 'edit' && current.entry.id === id ? null : current);
  }, [deleteInventoryEntry]);

  const editingEntry = panel?.mode === 'edit' ? panel.entry : null;

  return (
    <div className="logi-page logi-inv-page">
      <div className="logi-inv-content">
      <div className="logi-page-header logi-inv-header page-compact-header">
        <div>
          <div className="logi-breadcrumb">
            <Link to="/logistics" className="logi-breadcrumb-link">Logistics</Link>
            <span className="logi-breadcrumb-sep">/</span>
            <span className="logi-breadcrumb-active">Inventory</span>
          </div>
          <h1 className="logi-page-title">Inventory</h1>
          <p className="logi-page-subtitle">Quality-aware stock visibility.</p>
        </div>
        <div className="logi-inv-header-actions">
          <button
            type="button"
            className="logi-btn-secondary"
            onClick={() => setCsvImportOpen(true)}
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
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Stack
          </button>
        </div>
      </div>

      <div className="logi-filter-bar logi-inv-filter-bar">
        <div className="logi-search-wrap">
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="logi-search-icon">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            className="logi-search-input"
            placeholder="Search material, location, container…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search inventory"
          />
        </div>

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

        <select
          className="logi-select"
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          aria-label="Filter by location"
        >
          <option value="">All Locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
          {unassignedCount > 0 && <option value="__unassigned__">Unassigned Stock</option>}
        </select>

        <div className="logi-search-wrap logi-inv-quality-filter">
          <span>Min</span>
          <input
            type="number"
            className="logi-search-input"
            placeholder="0"
            min={0}
            max={1000}
            step={50}
            value={qualityMin || ''}
            onChange={(e) => setQualityMin(parseInt(e.target.value) || 0)}
            aria-label="Minimum quality"
          />
        </div>

        <div className="logi-inv-view-toggle" role="group" aria-label="Inventory view mode">
          <button type="button" className={viewMode === 'cards' ? 'is-active' : ''} onClick={() => setViewMode('cards')}>Location Cards</button>
          <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')}>List View</button>
        </div>

        <span className="logi-filter-count">{filtered.length} of {activeEntries.length}</span>
      </div>

      {viewMode === 'cards' ? (
        <>
          <div className="logi-location-card-grid">
            {locationGroups.map((group) => {
              const isSelected = selectedLocationId === group.id;
              const detailId = `inventory-location-detail-${group.id}`;

              return (
                <div
                  key={group.id}
                  className={`logi-location-card-slot${isMobileViewport && isSelected ? ' logi-location-card-slot--expanded' : ''}`}
                >
                  <InventoryLocationCard
                    group={group}
                    isSelected={isSelected}
                    onToggle={toggleLocationDrawer}
                    detailId={detailId}
                  />
                  {isMobileViewport && isSelected && selectedLocation?.id === group.id ? (
                    <SelectedLocationDetail
                      selectedLocation={selectedLocation}
                      drawerMaterialGroups={drawerMaterialGroups}
                      pendingDeleteEntryId={pendingDeleteEntryId}
                      materialById={materialById}
                      onCollapse={toggleLocationDrawer}
                      onEdit={handleEditDrawerEntry}
                      onRequestDelete={handleRequestDrawerDelete}
                      onDelete={handleDelete}
                      onCancelDelete={handleCancelDrawerDelete}
                      hideHeader
                      detailId={detailId}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>

          {!isMobileViewport && selectedLocation && (
            <SelectedLocationDetail
              selectedLocation={selectedLocation}
              drawerMaterialGroups={drawerMaterialGroups}
              pendingDeleteEntryId={pendingDeleteEntryId}
              materialById={materialById}
              onCollapse={toggleLocationDrawer}
              onEdit={handleEditDrawerEntry}
              onRequestDelete={handleRequestDrawerDelete}
              onDelete={handleDelete}
              onCancelDelete={handleCancelDrawerDelete}
            />
          )}

        </>
      ) : (
        <div className="logi-inv-layout">
          <div className="logi-inv-table-col">
            <InventoryTable
              entries={filtered}
              materials={materials}
              locations={locations}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              onEdit={(entry) => setPanel({ mode: 'edit', entry })}
              onDelete={handleDelete}
            />
          </div>
        </div>
      )}
      </div>

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
        />
      )}
    </div>
  );
}
