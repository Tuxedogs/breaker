import type {
  InventoryEntry,
  InventoryItemKind,
  InventoryLocation,
  InventoryUnitType,
  MaterialTemplate,
} from "../../types/logistics";
import {
  formatInventoryLocationLabel,
  resolveInventoryItemKind,
  resolveInventoryItemName,
  resolveInventoryUnitType,
  type InventoryStack,
} from "./inventory";

export type InventoryHierarchyAxis = "location" | "item";

export type InventoryHierarchyRow = {
  id: string;
  entry: InventoryEntry;
  locationKey: string;
  locationId?: string;
  locationName: string;
  location?: InventoryLocation;
  itemKey: string;
  itemName: string;
  itemKind: InventoryItemKind;
  material?: MaterialTemplate;
  unitType: InventoryUnitType;
  quality: number | null;
};

export type InventoryQualityFolder = {
  key: string;
  quality: number | null;
  rows: InventoryHierarchyRow[];
  totalQuantity: number;
  unitType: InventoryUnitType;
};

export type InventorySecondaryFolder = {
  key: string;
  axis: InventoryHierarchyAxis;
  label: string;
  locationId?: string;
  location?: InventoryLocation;
  material?: MaterialTemplate;
  itemKind?: InventoryItemKind;
  unitType: InventoryUnitType;
  rows: InventoryHierarchyRow[];
  qualityFolders: InventoryQualityFolder[];
  totalQuantity: number;
};

export type InventoryPrimaryFolder = {
  key: string;
  axis: InventoryHierarchyAxis;
  label: string;
  locationId?: string;
  location?: InventoryLocation;
  material?: MaterialTemplate;
  itemKind?: InventoryItemKind;
  rows: InventoryHierarchyRow[];
  secondaryFolders: InventorySecondaryFolder[];
  totalScu: number;
  totalUnits: number;
};

function compareQuality(left: number | null, right: number | null): number {
  return (right ?? -1) - (left ?? -1);
}

function getItemKey(
  entry: InventoryEntry,
  material: MaterialTemplate | undefined,
  itemKind: InventoryItemKind,
  unitType: InventoryUnitType,
): string {
  return [
    entry.materialId ?? "",
    entry.catalogItemId ?? "",
    resolveInventoryItemName(entry, material),
    itemKind,
    unitType,
  ].join("|");
}

export function buildInventoryHierarchyRows(
  entries: InventoryEntry[],
  materials: MaterialTemplate[],
  locations: InventoryLocation[],
): InventoryHierarchyRow[] {
  const materialById = new Map(materials.map((material) => [material.id, material]));
  const locationById = new Map(locations.map((location) => [location.id, location]));

  return entries.map((entry) => {
    const material = entry.materialId ? materialById.get(entry.materialId) : undefined;
    const location = entry.locationId ? locationById.get(entry.locationId) : undefined;
    const itemKind = resolveInventoryItemKind(entry, material);
    const unitType = resolveInventoryUnitType(entry, material);
    return {
      id: entry.id,
      entry,
      locationKey: entry.locationId ?? "__unassigned__",
      locationId: entry.locationId,
      locationName: formatInventoryLocationLabel({ ...entry, location }),
      location,
      itemKey: getItemKey(entry, material, itemKind, unitType),
      itemName: resolveInventoryItemName(entry, material),
      itemKind,
      material,
      unitType,
      quality: entry.quality ?? null,
    };
  });
}

function groupQualityFolders(rows: InventoryHierarchyRow[]): InventoryQualityFolder[] {
  const folders = new Map<string, InventoryQualityFolder>();
  for (const row of rows) {
    const key = `${row.quality ?? "unknown"}|${row.unitType}`;
    const current = folders.get(key);
    if (current) {
      current.rows.push(row);
      current.totalQuantity += row.entry.quantity;
    } else {
      folders.set(key, {
        key,
        quality: row.quality,
        rows: [row],
        totalQuantity: row.entry.quantity,
        unitType: row.unitType,
      });
    }
  }
  return [...folders.values()]
    .map((folder) => ({
      ...folder,
      rows: folder.rows.slice().sort((left, right) =>
        right.entry.quantity - left.entry.quantity || left.id.localeCompare(right.id)),
    }))
    .sort((left, right) => compareQuality(left.quality, right.quality));
}

function getAxisKey(row: InventoryHierarchyRow, axis: InventoryHierarchyAxis): string {
  return axis === "location" ? row.locationKey : row.itemKey;
}

function getAxisLabel(row: InventoryHierarchyRow, axis: InventoryHierarchyAxis): string {
  return axis === "location" ? row.locationName : row.itemName;
}

function groupSecondaryFolders(
  rows: InventoryHierarchyRow[],
  axis: InventoryHierarchyAxis,
): InventorySecondaryFolder[] {
  const folders = new Map<string, InventorySecondaryFolder>();
  for (const row of rows) {
    const key = getAxisKey(row, axis);
    const current = folders.get(key);
    if (current) {
      current.rows.push(row);
      current.totalQuantity += row.entry.quantity;
    } else {
      folders.set(key, {
        key,
        axis,
        label: getAxisLabel(row, axis),
        locationId: row.locationId,
        location: row.location,
        material: row.material,
        itemKind: row.itemKind,
        unitType: row.unitType,
        rows: [row],
        qualityFolders: [],
        totalQuantity: row.entry.quantity,
      });
    }
  }

  return [...folders.values()]
    .map((folder) => ({ ...folder, qualityFolders: groupQualityFolders(folder.rows) }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function buildInventoryHierarchy(
  entries: InventoryEntry[],
  materials: MaterialTemplate[],
  locations: InventoryLocation[],
  primaryAxis: InventoryHierarchyAxis,
): InventoryPrimaryFolder[] {
  const rows = buildInventoryHierarchyRows(entries, materials, locations);
  const secondaryAxis: InventoryHierarchyAxis = primaryAxis === "location" ? "item" : "location";
  const folders = new Map<string, InventoryPrimaryFolder>();

  for (const row of rows) {
    const key = getAxisKey(row, primaryAxis);
    const current = folders.get(key);
    if (current) {
      current.rows.push(row);
      if (row.unitType === "scu") current.totalScu += row.entry.quantity;
      else current.totalUnits += row.entry.quantity;
    } else {
      folders.set(key, {
        key,
        axis: primaryAxis,
        label: getAxisLabel(row, primaryAxis),
        locationId: row.locationId,
        location: row.location,
        material: row.material,
        itemKind: row.itemKind,
        rows: [row],
        secondaryFolders: [],
        totalScu: row.unitType === "scu" ? row.entry.quantity : 0,
        totalUnits: row.unitType === "unit" ? row.entry.quantity : 0,
      });
    }
  }

  return [...folders.values()]
    .map((folder) => ({
      ...folder,
      secondaryFolders: groupSecondaryFolders(folder.rows, secondaryAxis),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export type ReservableLocationFolder = {
  key: string;
  label: string;
  locationMeta?: string;
  stacks: InventoryStack[];
  qualities: Array<{
    key: string;
    quality: number | null;
    stacks: InventoryStack[];
  }>;
};

export function groupReservableStacksByLocation(stacks: InventoryStack[]): ReservableLocationFolder[] {
  const folders = new Map<string, ReservableLocationFolder>();
  const order: string[] = [];

  for (const stack of stacks) {
    const key = stack.locationId ?? "__unassigned__";
    let folder = folders.get(key);
    if (!folder) {
      folder = {
        key,
        label: formatInventoryLocationLabel(stack),
        locationMeta: stack.location?.system ? `${stack.location.system} System` : undefined,
        stacks: [],
        qualities: [],
      };
      folders.set(key, folder);
      order.push(key);
    }
    folder.stacks.push(stack);
  }

  return order.map((key) => {
    const folder = folders.get(key)!;
    const qualities = new Map<string, { key: string; quality: number | null; stacks: InventoryStack[] }>();
    const qualityOrder: string[] = [];
    for (const stack of folder.stacks) {
      const qualityKey = String(stack.quality ?? "unknown");
      const current = qualities.get(qualityKey);
      if (current) current.stacks.push(stack);
      else {
        qualities.set(qualityKey, { key: qualityKey, quality: stack.quality ?? null, stacks: [stack] });
        qualityOrder.push(qualityKey);
      }
    }
    return {
      ...folder,
      qualities: qualityOrder.map((qualityKey) => qualities.get(qualityKey)!),
    };
  });
}
