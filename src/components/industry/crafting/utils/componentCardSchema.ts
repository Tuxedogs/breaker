import type { ComponentRecipe } from "./craftingTypes";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { getComponentDisplayName } from "./componentDisplayNames";
import { formatProperty } from "./qualityModifiers";

export type ComponentCardMetric = {
  label: string;
  value: string;
};

export type ComponentCardMaterialPreview = {
  slot: string;
  cost_id: string;
  material_name: string;
  quantity: number | string;
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
  materialsPreview: ComponentCardMaterialPreview[];
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

function getStatsObject(record: ComponentCardIndexRecord, key: string): Record<string, unknown> | null {
  const stats = record.stats as unknown;
  if (!isRecord(stats)) return null;
  const value = stats[key];
  return isRecord(value) ? value : null;
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

function formatCompactNumber(value: unknown, suffix = ""): string | null {
  const number = asNumber(value);
  if (number === null || number === 0) return null;
  return `${formatNumber(number)}${suffix}`;
}

function formatToken(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return titleCase(value);
}

function formatRange(value: unknown, suffix = ""): string | null {
  if (!isRecord(value)) return null;
  const min = asNumber(value.min);
  const max = asNumber(value.max);
  if (min === null || max === null) return null;
  return min === max ? `${formatNumber(min)}${suffix}` : `${formatNumber(min)}-${formatNumber(max)}${suffix}`;
}

function formatPair(minValue: unknown, maxValue: unknown, suffix = ""): string | null {
  const min = asNumber(minValue);
  const max = asNumber(maxValue);
  if (min === null && max === null) return null;
  if (min !== null && max !== null && min !== max) return `${formatNumber(min)}-${formatNumber(max)}${suffix}`;
  return `${formatNumber(max ?? min ?? 0)}${suffix}`;
}

function formatDamageDrop(stats: Record<string, unknown>): string | null {
  const minDistance = asNumber(stats.damageDropMinDistance);
  const perMeter = asNumber(stats.damageDropPerMeter);
  const minDamage = asNumber(stats.damageDropMinDamage);
  const parts: string[] = [];
  if (minDistance !== null) parts.push(`after ${formatNumber(minDistance)}m`);
  if (perMeter !== null) parts.push(`${formatNumber(perMeter)}/m`);
  if (minDamage !== null) parts.push(`floor ${formatNumber(minDamage)}`);
  return parts.length ? parts.join(" / ") : null;
}

function formatAttachmentSummary(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const labels = value
    .map((item) => {
      if (!isRecord(item)) return null;
      if (Array.isArray(item.subTypes) && typeof item.subTypes[0] === "string") return titleCase(item.subTypes[0]);
      return asDisplay(item.type);
    })
    .filter((label): label is string => Boolean(label));
  if (labels.length === 0) return null;
  return [...new Set(labels)].slice(0, 4).join(", ");
}

function formatConsumables(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const count = value.length;
  return count === 1 ? "1 port" : `${count} ports`;
}

function pushMetric(metrics: ComponentCardMetric[], label: string, value: string | null): void {
  if (value) metrics.push({ label, value });
}

function formatUsableOrTravelRange(stats: Record<string, unknown>): { label: string; value: string | null } {
  const hardRange = formatCompactNumber(stats.hardRange, "m");
  if (hardRange) return { label: "Hard Range", value: hardRange };
  return { label: "Projectile Travel", value: formatCompactNumber(stats.projectileLifetimeTravel ?? stats.calculatedRange, "m") };
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
  if (health !== null) stats.push({ label: "Component HP", value: formatNumber(health) });
  if (mass !== null) stats.push({ label: "Mass", value: formatNumber(mass) });

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

function getIndexGenericStats(record: ComponentCardIndexRecord): ComponentCardMetric[] {
  const generic = getStatsObject(record, "generic");
  if (!generic) return [];

  const stats: ComponentCardMetric[] = [];
  pushMetric(stats, "Component HP", formatCompactNumber(generic.health));
  pushMetric(stats, "Mass", formatCompactNumber(generic.mass));
  return stats;
}

function getIndexMeta(record: ComponentCardIndexRecord): ComponentCardMetric[] {
  const meta: ComponentCardMetric[] = [];
  const craftTime = formatCraftTime(record.craftTimeSeconds);

  if (record.size !== null) meta.push({ label: "Size", value: `S${record.size}` });
  if (record.grade) meta.push({ label: "Grade", value: record.grade });
  if (record.class) meta.push({ label: "Class", value: titleCase(record.class) });
  if (craftTime) meta.push({ label: "Craft", value: craftTime });

  return meta;
}

function getFallbackIndexStats(record: ComponentCardIndexRecord): ComponentCardMetric[] {
  const stats: ComponentCardMetric[] = [];
  pushMetric(stats, "Type", record.typeLabel);
  if (record.size !== null) pushMetric(stats, "Size", `S${record.size}`);
  pushMetric(stats, "Grade", record.grade);
  pushMetric(stats, "Class", record.class ? titleCase(record.class) : null);
  pushMetric(stats, "Craft", formatCraftTime(record.craftTimeSeconds));
  if (record.materials.length > 0) pushMetric(stats, "Materials", String(record.materials.length));
  return stats;
}

function getIndexFamilyStats(record: ComponentCardIndexRecord): ComponentCardMetric[] {
  const type = record.type;
  const stats: ComponentCardMetric[] = [];

  if (type === "shield") {
    const shield = getStatsObject(record, "shield");
    if (!shield) return stats;
    pushMetric(stats, "Shield HP", formatCompactNumber(shield.maxShieldHealth));
    pushMetric(stats, "Regen", formatCompactNumber(shield.regenRate, "/s"));
    pushMetric(stats, "Regen Delay", formatCompactNumber(shield.damageRegenDelay, "s"));
    pushMetric(stats, "Down Delay", formatCompactNumber(shield.downedRegenDelay, "s"));
    pushMetric(stats, "Absorption", formatRange(shield.physicalAbsorption));
    pushMetric(stats, "Resistance", formatRange(shield.physicalResistance));
    pushMetric(stats, "Power", formatPair(shield.powerUsageMin, shield.powerUsageMax));
    pushMetric(stats, "Coolant", formatPair(shield.coolantUsageMin, shield.coolantUsageMax));
    return stats;
  }

  if (type === "quantumdrive") {
    const drive = getStatsObject(record, "quantumDrive");
    if (!drive) return stats;
    pushMetric(stats, "Normal Speed", formatCompactNumber(drive.normalJumpSpeed, " m/s"));
    pushMetric(stats, "Spool", formatCompactNumber(drive.spoolTime, "s"));
    pushMetric(stats, "Cooldown", formatCompactNumber(drive.cooldown, "s"));
    pushMetric(stats, "Fuel Requirement", formatCompactNumber(drive.quantumFuelRequirement));
    pushMetric(stats, "Fuel Consumption", formatCompactNumber(drive.quantumFuelConsumptionRate, "/s"));
    pushMetric(stats, "Calibration", formatPair(drive.calibrationRequirementMin, drive.calibrationRequirementMax));
    pushMetric(stats, "Power", formatPair(drive.powerUsageMin, drive.powerUsageMax));
    pushMetric(stats, "Coolant", formatPair(drive.coolantUsageMin, drive.coolantUsageMax));
    return stats;
  }

  if (type === "cooler") {
    const cooler = getStatsObject(record, "cooler");
    if (!cooler) return stats;
    pushMetric(stats, "Coolant Generation", formatCompactNumber(cooler.coolantGeneration));
    pushMetric(stats, "Power Usage", formatPair(cooler.powerUsageMin, cooler.powerUsageMax));
    pushMetric(stats, "Self Repair Time", formatCompactNumber(cooler.selfRepairTime, "s"));
    pushMetric(stats, "Online EM", formatCompactNumber(cooler.onlineEmSignature));
    pushMetric(stats, "Online IR", formatCompactNumber(cooler.onlineIrSignature));
    return stats;
  }

  if (type === "powerplant") {
    const plant = getStatsObject(record, "powerPlant");
    if (!plant) return stats;
    pushMetric(stats, "Power Generation", formatCompactNumber(plant.powerGeneration));
    pushMetric(stats, "Heat Generation", formatCompactNumber(plant.heatGeneration));
    pushMetric(stats, "Coolant Usage", formatPair(plant.coolantUsageMin, plant.coolantUsageMax));
    pushMetric(stats, "Self Repair Time", formatCompactNumber(plant.selfRepairTime, "s"));
    pushMetric(stats, "Online EM", formatCompactNumber(plant.onlineEmSignature));
    pushMetric(stats, "Online IR", formatCompactNumber(plant.onlineIrSignature));
    return stats;
  }

  if (type === "weaponGun") {
    const weapon = getStatsObject(record, "shipWeapon");
    if (!weapon) return stats;
    pushMetric(stats, "Damage Type", formatToken(weapon.damageType));
    pushMetric(stats, "Alpha Damage", formatCompactNumber(weapon.alphaDamageTotal));
    pushMetric(stats, "Fire Rate", formatCompactNumber(weapon.fireRateRpm, " rpm"));
    pushMetric(stats, "Ammo Capacity", formatCompactNumber(weapon.ammoCapacity));
    pushMetric(stats, "Projectile Range / Max Travel", formatCompactNumber(weapon.calculatedRange, "m"));
    pushMetric(stats, "Projectile Speed", formatCompactNumber(weapon.projectileSpeed, " m/s"));
    pushMetric(stats, "Charge Time", formatCompactNumber(weapon.chargeTime, "s"));
    pushMetric(stats, "Cooling Rate", formatCompactNumber(weapon.coolingRate));
    return stats;
  }

  if (type === "weapons") {
    const weapon = getStatsObject(record, "fpsWeapon");
    if (!weapon) return stats;
    pushMetric(stats, "Weapon Class", formatToken(weapon.weaponClass));
    pushMetric(stats, "Fire Mode", formatToken(weapon.fireMode));
    pushMetric(stats, "Fire Rate", formatCompactNumber(weapon.fireRateRpm, " rpm"));
    pushMetric(stats, "Ammo Capacity", formatCompactNumber(weapon.ammoCapacity));
    pushMetric(stats, "Charge Time", formatCompactNumber(weapon.chargeTime, "s"));
    pushMetric(stats, "Alpha Damage", formatCompactNumber(weapon.alphaDamageTotal));
    pushMetric(stats, "DPS", formatCompactNumber(weapon.dps));
    const range = formatUsableOrTravelRange(weapon);
    pushMetric(stats, range.label, range.value);
    pushMetric(stats, "Falloff", asDisplay(weapon.falloffGraphStatus) ?? formatDamageDrop(weapon));
    pushMetric(stats, "Attachments", formatAttachmentSummary(weapon.attachments));
    return stats;
  }

  if (type === "armor") {
    const armor = getStatsObject(record, "fpsArmor");
    if (!armor) return stats;
    pushMetric(stats, "Armor Slot", formatToken(armor.armorSlot));
    pushMetric(stats, "Armor Weight", formatToken(armor.armorWeight));
    pushMetric(stats, "Physical Res", formatCompactNumber(armor.physicalResistance));
    pushMetric(stats, "Energy Res", formatCompactNumber(armor.energyResistance));
    pushMetric(stats, "Temp Range", formatPair(armor.temperatureMin, armor.temperatureMax, "C"));
    pushMetric(stats, "Storage", formatCompactNumber(armor.storageCapacity, " microSCU"));
    pushMetric(stats, "Mass", formatCompactNumber(armor.mass));
    return stats;
  }

  if (type === "ammo") {
    const ammo = getStatsObject(record, "fpsAmmo");
    if (!ammo) return stats;
    pushMetric(stats, "Ammo Class", formatToken(ammo.ammoClass));
    pushMetric(stats, "Compatible Weapon Class", formatToken(ammo.compatibleWeaponClass));
    pushMetric(stats, "Magazine Capacity", formatCompactNumber(ammo.magazineCapacity));
    pushMetric(stats, "Alpha Damage", formatCompactNumber(ammo.alphaDamageTotal));
    const range = formatUsableOrTravelRange(ammo);
    pushMetric(stats, range.label, range.value);
    pushMetric(stats, "Projectile Speed", formatCompactNumber(ammo.projectileSpeed, " m/s"));
    pushMetric(stats, "Damage Drop", formatDamageDrop(ammo));
    pushMetric(stats, "Penetration", formatCompactNumber(ammo.penetrationBaseDistance, "m"));
    return stats;
  }

  if (type === "radar") {
    const radar = getStatsObject(record, "radar");
    if (!radar) return stats;
    pushMetric(stats, "Ping Cooldown", formatCompactNumber(radar.pingCooldown, "s"));
    pushMetric(stats, "Aim Assist Min Range", formatCompactNumber(radar.aimAssistRangeMin, "m"));
    pushMetric(stats, "Aim Assist Max Range", formatCompactNumber(radar.aimAssistRangeMax, "m"));
    pushMetric(stats, "Power", formatPair(radar.powerUsageMin, radar.powerUsageMax));
    pushMetric(stats, "Coolant", formatPair(radar.coolantUsageMin, radar.coolantUsageMax));
    pushMetric(stats, "Online EM", formatCompactNumber(radar.onlineEmSignature));
    pushMetric(stats, "Online IR", formatCompactNumber(radar.onlineIrSignature));
    return stats;
  }

  if (type === "weaponMining" || type === "miningLaser") {
    const mining = getStatsObject(record, "miningLaser") ?? getStatsObject(record, "weaponMining");
    if (!mining) return stats;
    pushMetric(stats, "Mining Power", formatCompactNumber(mining.miningPower));
    pushMetric(stats, "Extraction Power", formatCompactNumber(mining.extractionPower));
    pushMetric(stats, "Instability Modifier", formatCompactNumber(mining.instabilityModifier));
    pushMetric(stats, "Resistance Modifier", formatCompactNumber(mining.resistanceModifier));
    pushMetric(stats, "Fracture Window", formatCompactNumber(mining.fractureWindowSize));
    pushMetric(stats, "Laser Range", formatCompactNumber(mining.laserRange, "m"));
    pushMetric(stats, "Beam Range", formatCompactNumber(mining.beamRange, "m"));
    pushMetric(stats, "Consumables", formatConsumables(mining.compatibleConsumables));
    pushMetric(stats, "Power", formatPair(mining.powerUsageMin, mining.powerUsageMax));
    pushMetric(stats, "Heat", formatCompactNumber(mining.heatGeneration));
    pushMetric(stats, "Wear", formatCompactNumber(mining.wearRate));
    return stats;
  }

  return getFallbackIndexStats(record);
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

export function buildComponentCardSchemaFromIndex(
  record: ComponentCardIndexRecord,
): ComponentCardSchema {
  return {
    id: record.id,
    displayName: record.name,
    typeLabel: record.typeLabel,
    kindLabel: record.kind === "fps" ? "FPS" : "Vehicle",
    categoryLabel: record.category === record.kind ? undefined : record.category,
    meta: getIndexMeta(record),
    genericStats: getIndexGenericStats(record),
    familyStats: getIndexFamilyStats(record),
    modifierLabels: record.card.badges,
    materialsPreview: record.card.materialsPreview.map((material, index) => ({
      slot: `${index}`,
      cost_id: `${record.id}:${index}:${material.name}`,
      material_name: material.name,
      quantity: material.unit ? `${material.quantity} ${material.unit}` : material.quantity,
    })),
  };
}
