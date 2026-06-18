import manifest from "./component-icons.manifest.json";

export type FittingIconManifestEntry = {
  type: string;
  folder: string;
  match?: {
    categories?: string[];
    weaponFamilies?: string[];
    displayNameIncludes?: string[];
  };
  sizes: Record<string, Partial<Record<"accent" | "mono", string>>>;
};

type ManifestShape = {
  entries: Record<string, FittingIconManifestEntry>;
};

const WEAPON_FAMILY_PATTERNS: Array<{ familyKey: string; pattern: RegExp }> = [
  { familyKey: "deadbolt", pattern: /\bdeadbolt\b/i },
];

const CATEGORY_FALLBACK_KEYS: Record<string, string> = {
  shield: "shield_generator",
  shield_generator: "shield_generator",
  cooler: "cooler",
  quantum_drive: "quantum_drive",
  quantum: "quantum_drive",
  power: "power_plant",
  powerplant: "power_plant",
};

export function normalizeComponentCategory(category: string | null | undefined): string {
  return (category ?? "").trim().toLowerCase();
}

export function inferWeaponFamilyKey(componentName: string | null | undefined): string | null {
  const name = (componentName ?? "").trim();
  if (!name) return null;
  for (const { familyKey, pattern } of WEAPON_FAMILY_PATTERNS) {
    if (pattern.test(name)) return familyKey;
  }
  return null;
}

export function inferManifestEntryKey(input: {
  componentType?: string | null;
  componentName?: string | null;
  familyKey?: string | null;
}): string | null {
  const entries = (manifest as ManifestShape).entries;

  if (input.familyKey && entries[input.familyKey]) return input.familyKey;

  const weaponFamily = inferWeaponFamilyKey(input.componentName);
  if (weaponFamily && entries[weaponFamily]) return weaponFamily;

  const category = normalizeComponentCategory(input.componentType);
  if (category === "ship_weapon") {
    const fromName = inferWeaponFamilyKey(input.componentName);
    if (fromName && entries[fromName]) return fromName;
  }

  const categoryKey = CATEGORY_FALLBACK_KEYS[category];
  if (categoryKey && entries[categoryKey]) return categoryKey;

  for (const [key, entry] of Object.entries(entries)) {
    const categories = entry.match?.categories ?? [];
    if (categories.some((value) => normalizeComponentCategory(value) === category)) return key;
    const includes = entry.match?.displayNameIncludes ?? [];
    const name = (input.componentName ?? "").toLowerCase();
    if (name && includes.some((token) => name.includes(token.toLowerCase()))) return key;
  }

  return null;
}

export function normalizeComponentSize(size: unknown, componentName?: string | null): number | null {
  if (typeof size === "number" && Number.isFinite(size) && size > 0) return Math.round(size);
  if (typeof size === "string") {
    const parsed = Number.parseInt(size, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const name = componentName ?? "";
  const roman = name.match(/\b(I{1,3}|IV|V|VI)\b/i);
  if (roman) {
    const map: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };
    const mapped = map[roman[1].toLowerCase()];
    if (mapped) return mapped;
  }
  const sized = name.match(/\bS(\d)\b/i) ?? name.match(/_S0?(\d)\b/i);
  if (sized) {
    const parsed = Number.parseInt(sized[1], 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export function getManifestEntry(entryKey: string | null): FittingIconManifestEntry | null {
  if (!entryKey) return null;
  return (manifest as ManifestShape).entries[entryKey] ?? null;
}