import type { FittingComponentSummary } from "./fittingApi";
import type { FittingComponentRecord } from "./fittingPortGrouping";

const IDENTITY_FIELDS = [
  "id",
  "componentId",
  "itemId",
  "entityClass",
  "entityClassGuid",
  "componentKey",
  "itemKey",
  "recordKey",
  "thrusterKey",
  "className",
] as const;

export function canonicalFittingId(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replaceAll("_", "-");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : null;
}

function addNormalizedKey(keys: Set<string>, value: unknown): void {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (!trimmed) return;

  keys.add(trimmed.toLowerCase());
  keys.add(trimmed.toLowerCase().replaceAll("_", "-"));

  const canonical = canonicalFittingId(trimmed);
  if (canonical) keys.add(canonical);
}

export function getFittingItemCompatibilityKeys(item: unknown): Set<string> {
  const keys = new Set<string>();
  if (!item || typeof item !== "object") return keys;

  const record = item as Record<string, unknown>;
  for (const field of IDENTITY_FIELDS) {
    addNormalizedKey(keys, record[field]);
  }

  return keys;
}

export function itemKeysIntersect(left: Set<string>, right: Set<string>): boolean {
  for (const key of left) {
    if (right.has(key)) return true;
    const canonical = canonicalFittingId(key);
    if (canonical && right.has(canonical)) return true;
  }
  return false;
}

export function resolveLoadoutComponentId(
  item: FittingComponentSummary | FittingComponentRecord | { id: string },
): string {
  const keys = getFittingItemCompatibilityKeys(item);
  for (const key of keys) {
    const canonical = canonicalFittingId(key);
    if (canonical) return canonical;
  }
  if ("id" in item && typeof item.id === "string") return item.id;
  if ("componentKey" in item && typeof item.componentKey === "string") return item.componentKey;
  return "";
}

export function summarizeIdentityKeys(item: unknown): Record<string, string | null> {
  if (!item || typeof item !== "object") return {};
  const record = item as Record<string, unknown>;
  const summary: Record<string, string | null> = {};
  for (const field of IDENTITY_FIELDS) {
    summary[field] = typeof record[field] === "string" ? record[field] : null;
  }
  return summary;
}
