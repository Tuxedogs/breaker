import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { quantumMetersToKilometers } from "../../../../lib/fitting/quantumDriveUnits";
import { resolveWeaponDps } from "../../../../lib/fitting/fittingWeaponStats";

export type RecipeBrowserColumn = {
  key: string;
  label: string;
  value: (record: ComponentCardIndexRecord) => string;
  sortValue?: (record: ComponentCardIndexRecord) => number | string | null;
};

export type RecipeBrowserFamily = {
  key: string;
  label: string;
  columns: RecipeBrowserColumn[];
};

type UnknownRecord = Record<string, unknown>;

function objectValue(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function statGroup(record: ComponentCardIndexRecord, key: string): UnknownRecord | null {
  return objectValue((record.stats as unknown as UnknownRecord | undefined)?.[key]);
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function titleCase(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "—";
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatNumber(value: unknown, suffix = ""): string {
  const number = numberValue(value);
  if (number === null) return "—";
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.abs(number) >= 100 ? 0 : 2,
  }).format(number);
  return `${formatted}${suffix}`;
}

function formatPair(minValue: unknown, maxValue: unknown, suffix = ""): string {
  const min = numberValue(minValue);
  const max = numberValue(maxValue);
  if (min === null && max === null) return "—";
  if (min !== null && max !== null && min !== max) {
    return `${formatNumber(min)}–${formatNumber(max)}${suffix}`;
  }
  return `${formatNumber(max ?? min)}${suffix}`;
}

function get(record: ComponentCardIndexRecord, group: string, key: string): unknown {
  return statGroup(record, group)?.[key];
}

function shipWeaponDps(record: ComponentCardIndexRecord): number | null {
  return resolveWeaponDps({
    alphaDamage: numberValue(get(record, "shipWeapon", "alphaDamageTotal")),
    fireRateRpm: numberValue(get(record, "shipWeapon", "fireRateRpm")),
    dps: numberValue(get(record, "shipWeapon", "dps")),
  }).dps;
}

export function getRecipeBrowserDamageBadges(
  record: ComponentCardIndexRecord,
): Array<{ key: "physical" | "energy"; label: string; value: string }> {
  const group =
    record.type === "weaponGun" ? "shipWeapon"
      : record.type === "weapons" ? "fpsWeapon"
        : record.type === "ammo" ? "fpsAmmo"
          : null;
  if (!group) return [];

  const physical = numberValue(get(record, group, "damagePhysical"));
  const energy = numberValue(get(record, group, "damageEnergy"));
  return [
    { key: "physical", label: "Physical", value: physical === null ? "" : formatNumber(physical) },
    { key: "energy", label: "Energy", value: energy === null ? "" : formatNumber(energy) },
  ];
}

const sizeColumn: RecipeBrowserColumn = {
  key: "size",
  label: "Size",
  value: (record) => record.size === null ? "—" : String(record.size),
  sortValue: (record) => record.size,
};

const gradeClassColumn: RecipeBrowserColumn = {
  key: "gradeClass",
  label: "Grade / Class",
  value: (record) => {
    const parts = [record.grade, record.class ? titleCase(record.class) : null].filter(Boolean);
    return parts.length ? parts.join(" · ") : "—";
  },
};

const genericColumns: RecipeBrowserColumn[] = [
  {
    key: "craftTime",
    label: "Craft Time",
    value: (record) => formatDuration(record.craftTimeSeconds),
  },
  {
    key: "health",
    label: "Health",
    value: (record) => formatNumber(get(record, "generic", "health")),
  },
  {
    key: "mass",
    label: "Mass",
    value: (record) => formatNumber(get(record, "generic", "mass")),
  },
  {
    key: "materials",
    label: "Materials",
    value: (record) => String(record.facets?.materials?.length ?? record.materials?.length ?? 0),
  },
];

const families: Record<string, RecipeBrowserFamily> = {
  vehicleWeapon: {
    key: "vehicleWeapon",
    label: "Vehicle Weapons",
    columns: [
      sizeColumn,
      { key: "alpha", label: "Alpha", value: (record) => formatNumber(get(record, "shipWeapon", "alphaDamageTotal")) },
      { key: "dps", label: "DPS", value: (record) => formatNumber(shipWeaponDps(record)), sortValue: shipWeaponDps },
      { key: "penetration", label: "Penetration", value: (record) => formatNumber(get(record, "shipWeapon", "penetration")) },
      { key: "rate", label: "Fire Rate", value: (record) => formatNumber(get(record, "shipWeapon", "fireRateRpm"), " rpm") },
      { key: "speed", label: "Projectile Speed", value: (record) => formatNumber(get(record, "shipWeapon", "projectileSpeed"), " m/s") },
      { key: "capacity", label: "Capacity", value: (record) => formatNumber(get(record, "shipWeapon", "ammoCapacity")) },
    ],
  },
  shield: {
    key: "shield",
    label: "Shields",
    columns: [
      sizeColumn,
      { key: "hp", label: "Shield HP", value: (record) => formatNumber(get(record, "shield", "maxShieldHealth")) },
      { key: "regen", label: "Regen", value: (record) => formatNumber(get(record, "shield", "regenRate"), "/s") },
      { key: "delay", label: "Regen Delay", value: (record) => formatNumber(get(record, "shield", "damageRegenDelay"), "s") },
      gradeClassColumn,
    ],
  },
  powerPlant: {
    key: "powerPlant",
    label: "Power Plants",
    columns: [
      sizeColumn,
      { key: "output", label: "Output", value: (record) => formatNumber(get(record, "powerPlant", "powerGeneration")) },
      { key: "heat", label: "Heat", value: (record) => formatNumber(get(record, "powerPlant", "heatGeneration")) },
      { key: "em", label: "Online EM", value: (record) => formatNumber(get(record, "powerPlant", "onlineEmSignature")) },
      gradeClassColumn,
    ],
  },
  cooler: {
    key: "cooler",
    label: "Coolers",
    columns: [
      sizeColumn,
      { key: "cooling", label: "Cooling", value: (record) => formatNumber(get(record, "cooler", "coolantGeneration")) },
      {
        key: "power",
        label: "Power",
        value: (record) => formatPair(
          get(record, "cooler", "powerUsageMin"),
          get(record, "cooler", "powerUsageMax"),
        ),
      },
      { key: "em", label: "Online EM", value: (record) => formatNumber(get(record, "cooler", "onlineEmSignature")) },
      gradeClassColumn,
    ],
  },
  radar: {
    key: "radar",
    label: "Radars",
    columns: [
      sizeColumn,
      { key: "powerPipsMin", label: "Min Power Pips", value: (record) => formatNumber(get(record, "radar", "powerUsageMin")) },
      { key: "powerPipsMax", label: "Max Power Pips", value: (record) => formatNumber(get(record, "radar", "powerUsageMax")) },
      { key: "assistMin", label: "Min Assist Range", value: (record) => formatNumber(get(record, "radar", "aimAssistRangeMin"), "m") },
      { key: "assistMax", label: "Max Assist Range", value: (record) => formatNumber(get(record, "radar", "aimAssistRangeMax"), "m") },
      gradeClassColumn,
    ],
  },
  quantumDrive: {
    key: "quantumDrive",
    label: "Quantum Drives",
    columns: [
      sizeColumn,
      {
        key: "speed",
        label: "Speed",
        value: (record) => {
          const speed = numberValue(get(record, "quantumDrive", "normalJumpSpeed"));
          return speed === null ? "—" : formatNumber(quantumMetersToKilometers(speed), " km/s");
        },
      },
      { key: "spool", label: "Spool", value: (record) => formatNumber(get(record, "quantumDrive", "spoolTime"), "s") },
      { key: "cooldown", label: "Cooldown", value: (record) => formatNumber(get(record, "quantumDrive", "cooldown"), "s") },
      { key: "fuel", label: "Fuel", value: (record) => formatNumber(get(record, "quantumDrive", "quantumFuelRequirement")) },
    ],
  },
  fpsWeapon: {
    key: "fpsWeapon",
    label: "FPS Weapons",
    columns: [
      { key: "class", label: "Class", value: (record) => titleCase(get(record, "fpsWeapon", "weaponClass") ?? record.facets?.weaponClass) },
      { key: "alpha", label: "Alpha", value: (record) => formatNumber(get(record, "fpsWeapon", "alphaDamageTotal")) },
      { key: "dps", label: "DPS", value: (record) => formatNumber(get(record, "fpsWeapon", "dps")) },
      { key: "rate", label: "Fire Rate", value: (record) => formatNumber(get(record, "fpsWeapon", "fireRateRpm"), " rpm") },
      { key: "capacity", label: "Capacity", value: (record) => formatNumber(get(record, "fpsWeapon", "ammoCapacity")) },
      { key: "falloff", label: "Falloff Starts", value: (record) => formatNumber(get(record, "fpsWeapon", "damageDropMinDistance"), "m") },
    ],
  },
  fpsArmor: {
    key: "fpsArmor",
    label: "FPS Armor",
    columns: [
      { key: "slot", label: "Slot", value: (record) => titleCase(get(record, "fpsArmor", "armorSlot") ?? record.facets?.armorSlot) },
      { key: "weight", label: "Weight", value: (record) => titleCase(get(record, "fpsArmor", "armorWeight") ?? record.facets?.armorWeight) },
      { key: "physical", label: "Physical Res.", value: (record) => formatNumber(get(record, "fpsArmor", "physicalResistance")) },
      { key: "energy", label: "Energy Res.", value: (record) => formatNumber(get(record, "fpsArmor", "energyResistance")) },
      {
        key: "temperature",
        label: "Temperature",
        value: (record) => formatPair(
          get(record, "fpsArmor", "temperatureMin"),
          get(record, "fpsArmor", "temperatureMax"),
          "°C",
        ),
      },
      { key: "storage", label: "Storage", value: (record) => formatNumber(get(record, "fpsArmor", "storageCapacity"), " µSCU") },
    ],
  },
  fpsAmmo: {
    key: "fpsAmmo",
    label: "FPS Ammunition",
    columns: [
      { key: "class", label: "Class", value: (record) => titleCase(get(record, "fpsAmmo", "ammoClass") ?? record.facets?.ammoClass) },
      { key: "capacity", label: "Capacity", value: (record) => formatNumber(get(record, "fpsAmmo", "magazineCapacity")) },
      { key: "alpha", label: "Alpha", value: (record) => formatNumber(get(record, "fpsAmmo", "alphaDamageTotal")) },
      { key: "falloff", label: "Falloff Starts", value: (record) => formatNumber(get(record, "fpsAmmo", "damageDropMinDistance"), "m") },
      { key: "speed", label: "Projectile Speed", value: (record) => formatNumber(get(record, "fpsAmmo", "projectileSpeed"), " m/s") },
    ],
  },
  other: {
    key: "other",
    label: "Other Components",
    columns: genericColumns,
  },
};

export function getRecipeBrowserFamily(record: ComponentCardIndexRecord): RecipeBrowserFamily {
  if (record.kind === "fps") {
    if (record.type === "weapons") return families.fpsWeapon;
    if (record.type === "armor") return families.fpsArmor;
    if (record.type === "ammo") return families.fpsAmmo;
    return { ...families.other, key: "fpsOther", label: "Other FPS Equipment" };
  }
  if (record.type === "weaponGun") return families.vehicleWeapon;
  if (record.type === "shield") return families.shield;
  if (record.type === "powerplant") return families.powerPlant;
  if (record.type === "cooler") return families.cooler;
  if (record.type === "radar") return families.radar;
  if (record.type === "quantumdrive") return families.quantumDrive;
  return {
    ...families.other,
    key: `vehicle:${record.type || "other"}`,
    label: record.typeLabel || "Other Components",
  };
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return remaining ? `${minutes}m ${remaining}s` : `${minutes}m`;
}
