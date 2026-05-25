import type { ComponentMaterial, ComponentRecipe } from "./craftingTypes";
import { getComponentDisplayName } from "./componentDisplayNames";
import { formatProperty } from "./qualityModifiers";

export type ComponentCardMetric = {
  label: string;
  value: string;
};

export type ComponentCardSchema = {
  id: string;
  displayName: string;
  typeLabel: string;
  kindLabel: string;
  categoryLabel?: string;
  meta: ComponentCardMetric[];
  genericStats: ComponentCardMetric[];
  familyStats: ComponentCardMetric[];
  modifierLabels: string[];
  materialsPreview: ComponentMaterial[];
};

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  cooler: "Cooler",
  powerplant: "Power Plant",
  quantumdrive: "Quantum Drive",
  radar: "Radar",
  shield: "Shield Generator",
  weaponGun: "Ship Weapon",
  weaponMining: "Mining Laser",
  dockingCollar: "Docking Collar",
  salvageHead: "Salvage Head",
  salvageModifier: "Salvage Modifier",
  tractorbeam: "Tractor Beam",
};

const FPS_CATEGORY_LABELS: Record<string, string> = {
  ammo: "FPS Ammo",
  armor: "FPS Armor",
  weapons: "FPS Weapon",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function asDisplay(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return formatNumber(value);
  return null;
}

function titleCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

export function formatCraftTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

export function getCardDisplayName(recipe: ComponentRecipe): string {
  return recipe.item_kind === "fps" ? getComponentDisplayName(recipe.component_name) : recipe.component_name;
}

export function getCardTypeLabel(recipe: ComponentRecipe): string {
  const type = recipe.component_type ?? "";
  if (recipe.item_kind === "fps") {
    return FPS_CATEGORY_LABELS[type.toLowerCase()] ?? titleCase(type || "FPS Gear");
  }
  return VEHICLE_TYPE_LABELS[type] ?? titleCase(type || "Component");
}

function getGenericBaseStats(baseStats: ComponentRecipe["baseStats"]): ComponentCardMetric[] {
  if (!isRecord(baseStats)) return [];

  const stats: ComponentCardMetric[] = [];
  const mass = asNumber(baseStats.mass);
  const health = asNumber(baseStats.health);
  if (mass !== null) stats.push({ label: "Generic mass", value: formatNumber(mass) });
  if (health !== null) stats.push({ label: "Generic health", value: formatNumber(health) });

  const emSignature = isRecord(baseStats.emSignature)
    ? asNumber(baseStats.emSignature.nominalSignature)
    : null;
  const irSignature = isRecord(baseStats.irSignature)
    ? asNumber(baseStats.irSignature.nominalSignature)
    : null;
  if (emSignature !== null) stats.push({ label: "Generic EM", value: formatNumber(emSignature) });
  if (irSignature !== null) stats.push({ label: "Generic IR", value: formatNumber(irSignature) });

  const resources = isRecord(baseStats.resources) ? baseStats.resources : null;
  const consumption = resources && isRecord(resources.consumption) ? resources.consumption : null;
  const power = consumption ? asNumber(consumption.Power) : null;
  if (power !== null) stats.push({ label: "Power draw", value: formatNumber(power) });

  return stats.slice(0, 4);
}

function getFamilyStats(recipe: ComponentRecipe, familyVariantCounts: Map<string, number>): ComponentCardMetric[] {
  const stats: ComponentCardMetric[] = [];

  if (recipe.weaponClass) {
    stats.push({ label: "Weapon class", value: titleCase(recipe.weaponClass) });
  }
  if (recipe.armorSlot) {
    stats.push({ label: "Armor slot", value: titleCase(recipe.armorSlot) });
  }
  if (recipe.armorWeight) {
    stats.push({ label: "Armor weight", value: titleCase(recipe.armorWeight) });
  }
  if (recipe.familyDisplayName || recipe.armorFamily || recipe.baseName) {
    stats.push({
      label: recipe.component_type === "armor" ? "Armor family" : "Family",
      value: recipe.familyDisplayName ?? recipe.armorFamily ?? recipe.baseName ?? "",
    });
  }
  if (recipe.variantName) {
    stats.push({ label: "Variant", value: recipe.variantName });
  }
  if (recipe.familyKey) {
    const count = familyVariantCounts.get(recipe.familyKey);
    if (count && count > 1) stats.push({ label: "Variants", value: String(count) });
  }

  return stats.filter((stat) => stat.value).slice(0, 4);
}

function getModifierLabels(recipe: ComponentRecipe): string[] {
  const allowModifierLabels =
    recipe.item_kind === "fps" ||
    recipe.component_type === "powerplant";
  if (!allowModifierLabels) return [];

  const seen = new Set<string>();
  const labels: string[] = [];
  for (const modifier of recipe.qualityModifiers ?? []) {
    const raw = modifier.gameplay_property;
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    labels.push(formatProperty(raw));
  }
  return labels.slice(0, 3);
}

export function buildComponentCardSchema(
  recipe: ComponentRecipe,
  familyVariantCounts: Map<string, number> = new Map(),
): ComponentCardSchema {
  const meta: ComponentCardMetric[] = [];
  const craftTime = formatCraftTime(recipe.craft_time_seconds);

  if (recipe.size) meta.push({ label: "Size", value: `S${recipe.size}` });
  if (recipe.grade) meta.push({ label: "Grade", value: recipe.grade });
  if (recipe.class) meta.push({ label: "Class", value: titleCase(recipe.class) });
  if (craftTime) meta.push({ label: "Craft", value: craftTime });
  if (recipe.output_entityClass) meta.push({ label: "Entity", value: recipe.output_entityClass.slice(0, 8) });

  return {
    id: recipe.blueprint_id,
    displayName: getCardDisplayName(recipe),
    typeLabel: getCardTypeLabel(recipe),
    kindLabel: recipe.item_kind === "fps" ? "FPS" : "Vehicle",
    categoryLabel: asDisplay(recipe.category) ?? undefined,
    meta,
    genericStats: getGenericBaseStats(recipe.baseStats),
    familyStats: getFamilyStats(recipe, familyVariantCounts),
    modifierLabels: getModifierLabels(recipe),
    materialsPreview: (recipe.materials ?? []).slice(0, 3),
  };
}

export function buildFamilyVariantCounts(recipes: ComponentRecipe[]): Map<string, number> {
  const byFamily = new Map<string, Set<string>>();
  for (const recipe of recipes) {
    if (!recipe.familyKey) continue;
    const values = byFamily.get(recipe.familyKey) ?? new Set<string>();
    values.add(recipe.blueprint_id);
    byFamily.set(recipe.familyKey, values);
  }
  return new Map([...byFamily.entries()].map(([key, values]) => [key, values.size]));
}
