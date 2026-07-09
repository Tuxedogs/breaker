import type { FittingPortConstraint } from "./fittingApi";
import type { PortBreakdownRow } from "./fittingPortGrouping";

export type FittingPortSizeConstraint = {
  exactSize: number | null;
  minSize: number | null;
  maxSize: number | null;
  sources: string[];
};

export type FittingConstraintVerdict = {
  ok: boolean;
  reason: string | null;
  code: string | null;
};

const SIZE_FIELD_PRIORITY = [
  "size",
  "attachSize",
  "weaponSize",
  "componentSize",
  "itemSize",
  "mountSize",
] as const;

const BESPOKE_FIELD_PRIORITY = [
  "bespoke",
  "isBespoke",
  "stockBespoke",
] as const;

const LOCKED_FIELD_PRIORITY = [
  "locked",
  "isLocked",
] as const;

const EDITABLE_FIELD_PRIORITY = [
  "editable",
  "replacementEditable",
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

export function parseNumericSize(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 0 ? Math.trunc(value) : null;
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const direct = Number(trimmed);
  if (Number.isFinite(direct) && direct > 0) return Math.trunc(direct);

  const labeled = trimmed.match(/(?:^|\b)(?:s|size)\s*(\d+)\b/i);
  if (labeled) return Number(labeled[1]);

  const embedded = trimmed.match(/(?:^|[_\-\s])s(\d+)(?:$|[_\-\s])/i);
  if (embedded) return Number(embedded[1]);

  return null;
}

function readNumericField(record: Record<string, unknown>, field: string): number | null {
  return parseNumericSize(record[field]);
}

function readNestedFittingSize(record: Record<string, unknown>): number | null {
  const fitting = asRecord(record.fitting);
  if (fitting) {
    const nested = readNumericField(fitting, "size") ?? readNumericField(fitting, "attachSize");
    if (nested !== null) return nested;
  }

  const identity = asRecord(record.identity);
  if (identity) {
    const nested = readNumericField(identity, "attachSize") ?? readNumericField(identity, "size");
    if (nested !== null) return nested;
  }

  return null;
}

export function getFittingItemSize(item: unknown): number | null {
  const record = asRecord(item);
  if (!record) return null;

  for (const field of SIZE_FIELD_PRIORITY) {
    const size = readNumericField(record, field);
    if (size !== null) return size;
  }

  return readNestedFittingSize(record);
}

function parsePortSizeFromIdentity(portId: string, portName: string | null | undefined): number | null {
  const haystack = `${portId} ${portName ?? ""}`;
  const classMatch = haystack.match(/hardpoint_class[_-]?(\d+)/i);
  if (classMatch) return Number(classMatch[1]);

  const sizeMatch = haystack.match(/(?:^|[_\-\s/])s(\d+)(?:$|[_\-\s/])/i);
  if (sizeMatch) return Number(sizeMatch[1]);

  const genericSize = haystack.match(/(?:^|[_\-\s])size[_-]?(\d+)(?:$|[_\-\s])/i);
  if (genericSize) return Number(genericSize[1]);

  return null;
}

function readPortRowSize(slot: PortBreakdownRow, field: "portExactSize" | "portMinSize" | "portMaxSize"): number | null {
  const value = slot[field];
  return typeof value === "number" ? value : null;
}

function mergeConstraintValue(
  current: FittingPortSizeConstraint,
  field: "exactSize" | "minSize" | "maxSize",
  value: number | null,
  source: string,
): void {
  if (value === null || current[field] !== null) return;
  current[field] = value;
  current.sources.push(source);
}

export function getFittingPortSizeConstraint(
  slot: PortBreakdownRow,
  apiConstraint: FittingPortConstraint | null | undefined,
): FittingPortSizeConstraint {
  const constraint: FittingPortSizeConstraint = {
    exactSize: null,
    minSize: null,
    maxSize: null,
    sources: [],
  };

  const applyRecord = (record: Record<string, unknown> | null | undefined, source: string) => {
    if (!record) return;
    mergeConstraintValue(constraint, "exactSize", readNumericField(record, "exactSize"), `${source}.exactSize`);
    mergeConstraintValue(constraint, "minSize", readNumericField(record, "minSize"), `${source}.minSize`);
    mergeConstraintValue(constraint, "maxSize", readNumericField(record, "maxSize"), `${source}.maxSize`);

    if (constraint.exactSize === null) {
      for (const field of ["attachSize", "requiredSize", "portSize", "size"] as const) {
        const parsed = readNumericField(record, field);
        if (parsed !== null) {
          mergeConstraintValue(constraint, "exactSize", parsed, `${source}.${field}`);
          break;
        }
      }
    }
  };

  applyRecord(apiConstraint as Record<string, unknown> | null | undefined, "api.constraint");

  mergeConstraintValue(constraint, "exactSize", readPortRowSize(slot, "portExactSize"), "slot.portExactSize");
  mergeConstraintValue(constraint, "minSize", readPortRowSize(slot, "portMinSize"), "slot.portMinSize");
  mergeConstraintValue(constraint, "maxSize", readPortRowSize(slot, "portMaxSize"), "slot.portMaxSize");

  if (constraint.exactSize === null && constraint.minSize === null && constraint.maxSize === null) {
    mergeConstraintValue(constraint, "exactSize", slot.componentSize, "slot.componentSize");
  }

  const parsedIdentitySize = parsePortSizeFromIdentity(slot.portId, slot.portName);
  if (parsedIdentitySize !== null) {
    mergeConstraintValue(constraint, "exactSize", parsedIdentitySize, "slot.portIdentity");
  }

  return constraint;
}

export function portHasKnownSizeConstraint(constraint: FittingPortSizeConstraint): boolean {
  return constraint.exactSize !== null || constraint.minSize !== null || constraint.maxSize !== null;
}

export function isItemSizeCompatibleWithPort(
  slot: PortBreakdownRow,
  item: unknown,
  apiConstraint: FittingPortConstraint | null | undefined,
): FittingConstraintVerdict {
  const portConstraint = getFittingPortSizeConstraint(slot, apiConstraint);
  if (!portHasKnownSizeConstraint(portConstraint)) {
    return { ok: true, reason: null, code: null };
  }

  const itemSize = getFittingItemSize(item);
  if (itemSize === null) {
    return {
      ok: false,
      reason: "Component size is unknown for a port with size constraints.",
      code: "size_missing",
    };
  }

  if (portConstraint.exactSize !== null && itemSize !== portConstraint.exactSize) {
    return {
      ok: false,
      reason: `Component size S${itemSize} does not match required S${portConstraint.exactSize}.`,
      code: "size_exact_mismatch",
    };
  }

  if (portConstraint.minSize !== null && itemSize < portConstraint.minSize) {
    return {
      ok: false,
      reason: `Component size S${itemSize} is below port minimum S${portConstraint.minSize}.`,
      code: "size_below_min",
    };
  }

  if (portConstraint.maxSize !== null && itemSize > portConstraint.maxSize) {
    return {
      ok: false,
      reason: `Component size S${itemSize} exceeds port maximum S${portConstraint.maxSize}.`,
      code: "size_above_max",
    };
  }

  return { ok: true, reason: null, code: null };
}

function readBooleanField(record: Record<string, unknown>, field: string): boolean | null {
  const value = record[field];
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function textLooksBespoke(value: unknown): boolean {
  return typeof value === "string" && /bespoke/i.test(value);
}

export function isFittingItemBespoke(item: unknown): boolean {
  const record = asRecord(item);
  if (!record) return false;

  for (const field of BESPOKE_FIELD_PRIORITY) {
    if (readBooleanField(record, field) === true) return true;
  }

  if (textLooksBespoke(record.name)) return true;
  if (textLooksBespoke(record.displayName)) return true;
  if (textLooksBespoke(record.className)) return true;
  if (textLooksBespoke(record.entityClass)) return true;
  if (textLooksBespoke(record.sourceFile)) return true;

  return false;
}

export function isFittingItemLocked(item: unknown): boolean {
  const record = asRecord(item);
  if (!record) return false;

  for (const field of LOCKED_FIELD_PRIORITY) {
    if (readBooleanField(record, field) === true) return true;
  }

  const status = typeof record.compatibilityStatus === "string" ? record.compatibilityStatus.toLowerCase() : "";
  return status === "locked";
}

export function isFittingItemEditable(item: unknown): boolean {
  const record = asRecord(item);
  if (!record) return true;

  for (const field of EDITABLE_FIELD_PRIORITY) {
    const editable = readBooleanField(record, field);
    if (editable === false) return false;
  }

  return true;
}

export function isFittingItemInstallableForPort(
  slot: PortBreakdownRow,
  item: unknown,
  installedComponentKey: string | null = slot.equippedComponentKey,
): FittingConstraintVerdict {
  if (slot.bespoke || slot.locked || !slot.editable) {
    return {
      ok: false,
      reason: "This port is locked or bespoke and cannot be changed.",
      code: "port_not_editable",
    };
  }

  if (isFittingItemBespoke(item)) {
    return {
      ok: false,
      reason: "Bespoke items cannot be installed from the compatibility drawer.",
      code: "bespoke_item",
    };
  }

  if (isFittingItemLocked(item)) {
    return {
      ok: false,
      reason: "Locked items cannot be installed from the compatibility drawer.",
      code: "locked_item",
    };
  }

  if (!isFittingItemEditable(item)) {
    return {
      ok: false,
      reason: "This item is not editable and cannot be installed.",
      code: "item_not_editable",
    };
  }

  const record = asRecord(item);
  const status = typeof record?.compatibilityStatus === "string"
    ? record.compatibilityStatus.toLowerCase()
    : null;
  if (status === "unknown" || status === "none" || status === "unavailable") {
    return {
      ok: false,
      reason: "Compatibility data is unavailable for this item.",
      code: "item_compatibility_unavailable",
    };
  }

  void installedComponentKey;
  return { ok: true, reason: null, code: null };
}
