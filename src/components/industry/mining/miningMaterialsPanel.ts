import { MINEABLE_SIGNATURES } from "../../../data/mineableSignatures";

// Display-only helpers for the location materials panel. No data is derived
// here beyond selection, ordering, and best-value flags over delivered values.

export type MiningSignatureDisplay = { base: number; x2?: number; x3?: number };

// Same key normalization the Signature Dock uses to match material names.
function normalizeSignatureKey(value: string) {
  const compact = value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (compact === "aluminum") return "aluminium";
  if (compact === "quantainium") return "quantanium";
  if (compact === "savrillium") return "savrilium";
  if (compact === "pressurizedice") return "ice";
  return compact;
}

const signatureByKey = new Map(MINEABLE_SIGNATURES.map((signature) => [normalizeSignatureKey(signature.name), signature.values]));

/** Reads the existing MINEABLE_SIGNATURES `values` array: [base, ×2, ×3, …]. */
export function mineableSignatureFor(materialName: string): MiningSignatureDisplay | undefined {
  const values = signatureByKey.get(normalizeSignatureKey(materialName));
  if (!values || typeof values[0] !== "number") return undefined;
  return { base: values[0], x2: values[1], x3: values[2] };
}

export function formatSignature(value: number) {
  return value.toLocaleString("en-US");
}

/** Key of the single highest finite value, or undefined when the top value is tied or nothing is known. */
export function uniqueBestKey<T>(items: readonly T[], keyOf: (item: T) => string, valueOf: (item: T) => number | null | undefined) {
  let best: number | undefined;
  let winners: string[] = [];
  for (const item of items) {
    const value = valueOf(item);
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (best === undefined || value > best) { best = value; winners = [keyOf(item)]; }
    else if (value === best) winners.push(keyOf(item));
  }
  return winners.length === 1 ? winners[0] : undefined;
}

/** Alphabetical by material name (case-insensitive); ties keep their order. */
export function sortByMaterialName<T>(items: readonly T[], nameOf: (item: T) => string) {
  return [...items].sort((a, b) => nameOf(a).localeCompare(nameOf(b), "en", { sensitivity: "base" }));
}

/** Location rows not represented in the selected set, by canonical material key. */
export function partitionAlsoAtRows<T>(locationRows: readonly T[], selectedMaterialKeys: ReadonlySet<string>, keyOf: (row: T) => string) {
  return locationRows.filter((row) => !selectedMaterialKeys.has(keyOf(row)));
}

export const MINING_METHOD_GROUP_ORDER = ["Ship", "Vehicle", "Hand"] as const;

export function groupByMethod<T>(items: readonly T[], methodOf: (item: T) => string) {
  return [...new Set([...MINING_METHOD_GROUP_ORDER, ...items.map(methodOf)])]
    .map((method) => ({ method, items: items.filter((item) => methodOf(item) === method) }))
    .filter((group) => group.items.length > 0);
}
