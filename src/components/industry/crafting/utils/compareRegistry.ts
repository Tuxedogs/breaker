import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";

export type StatDirection = "higher" | "lower" | "neutral";

export type CompareStatDef = {
  field: string;
  maxField?: string;
  label: string;
  direction: StatDirection;
  format: (value: unknown) => string | null;
  suffix?: string;
};

export type CompareSection = {
  title: string;
  stats: CompareStatDef[];
};

export type CategoryRegistry = {
  statsKey: string | string[];
  sections: CompareSection[];
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function fmtNumber(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: n >= 100 ? 0 : 2 }).format(n);
}

export function fmtCompact(suffix = "") {
  return (value: unknown): string | null => {
    const n = asNumber(value);
    if (n === null || n === 0) return null;
    return `${fmtNumber(n)}${suffix}`;
  };
}

export function fmtToken(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function fmtPair(suffix = "") {
  return (value: unknown): string | null => {
    const n = asNumber(value);
    if (n === null || n === 0) return null;
    return `${fmtNumber(n)}${suffix}`;
  };
}

function fmtRange(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const min = asNumber(value.min);
  const max = asNumber(value.max);
  if (min === null || max === null) return null;
  return min === max ? fmtNumber(min) : `${fmtNumber(min)}-${fmtNumber(max)}`;
}

// For min/max pairs stored as two separate fields on the stats object,
// we use a wrapper that reads both fields from the stats object directly.
function pairStat(
  minField: string,
  maxFieldName: string,
  label: string,
  direction: StatDirection,
  suffix = "",
): CompareStatDef {
  return {
    field: minField,
    maxField: maxFieldName,
    label,
    direction,
    format: fmtCompact(suffix),
    suffix,
  };
}

// ── Registry ─────────────────────────────────────────────────────────────────

export const CATEGORY_REGISTRY: Record<string, CategoryRegistry> = {
  shield: {
    statsKey: "shield",
    sections: [
      {
        title: "Shield Stats",
        stats: [
          { field: "maxShieldHealth", label: "Shield HP", direction: "higher", format: fmtCompact() },
          { field: "regenRate", label: "Regen Rate", direction: "higher", format: fmtCompact("/s") },
          { field: "damageRegenDelay", label: "Regen Delay", direction: "lower", format: fmtCompact("s") },
          { field: "downedRegenDelay", label: "Down Delay", direction: "lower", format: fmtCompact("s") },
          { field: "physicalAbsorption", label: "Absorption", direction: "neutral", format: fmtRange },
          { field: "physicalResistance", label: "Resistance", direction: "neutral", format: fmtRange },
        ],
      },
      {
        title: "Power & Cooling",
        stats: [
          pairStat("powerUsageMin", "powerUsageMax", "Power Usage", "lower"),
          pairStat("coolantUsageMin", "coolantUsageMax", "Coolant Usage", "lower"),
        ],
      },
    ],
  },

  quantumDrive: {
    statsKey: "quantumDrive",
    sections: [
      {
        title: "Quantum Drive Stats",
        stats: [
          { field: "normalJumpSpeed", label: "Jump Speed", direction: "higher", format: fmtCompact(" m/s") },
          { field: "spoolTime", label: "Spool Time", direction: "lower", format: fmtCompact("s") },
          { field: "cooldown", label: "Cooldown", direction: "lower", format: fmtCompact("s") },
          { field: "quantumFuelRequirement", label: "Fuel Required", direction: "lower", format: fmtCompact() },
          { field: "quantumFuelConsumptionRate", label: "Fuel Rate", direction: "lower", format: fmtCompact("/s") },
          { field: "calibrationRequirementMin", label: "Calibration Min", direction: "neutral", format: fmtCompact() },
          { field: "calibrationRequirementMax", label: "Calibration Max", direction: "neutral", format: fmtCompact() },
        ],
      },
      {
        title: "Power & Cooling",
        stats: [
          pairStat("powerUsageMin", "powerUsageMax", "Power Usage", "lower"),
          pairStat("coolantUsageMin", "coolantUsageMax", "Coolant Usage", "lower"),
        ],
      },
    ],
  },

  cooler: {
    statsKey: "cooler",
    sections: [
      {
        title: "Cooler Stats",
        stats: [
          { field: "coolantGeneration", label: "Coolant Generation", direction: "higher", format: fmtCompact() },
          { field: "selfRepairTime", label: "Self Repair Time", direction: "lower", format: fmtCompact("s") },
          { field: "onlineEmSignature", label: "Online EM", direction: "neutral", format: fmtCompact() },
          { field: "onlineIrSignature", label: "Online IR", direction: "neutral", format: fmtCompact() },
        ],
      },
      {
        title: "Power",
        stats: [
          pairStat("powerUsageMin", "powerUsageMax", "Power Usage", "lower"),
        ],
      },
    ],
  },

  powerplant: {
    statsKey: "powerPlant",
    sections: [
      {
        title: "Power Plant Stats",
        stats: [
          { field: "powerGeneration", label: "Power Generation", direction: "higher", format: fmtCompact() },
          { field: "heatGeneration", label: "Heat Generation", direction: "lower", format: fmtCompact() },
          { field: "selfRepairTime", label: "Self Repair Time", direction: "lower", format: fmtCompact("s") },
          { field: "onlineEmSignature", label: "Online EM", direction: "neutral", format: fmtCompact() },
          { field: "onlineIrSignature", label: "Online IR", direction: "neutral", format: fmtCompact() },
        ],
      },
      {
        title: "Cooling",
        stats: [
          pairStat("coolantUsageMin", "coolantUsageMax", "Coolant Usage", "lower"),
        ],
      },
    ],
  },

  weaponGun: {
    statsKey: "shipWeapon",
    sections: [
      {
        title: "Core Stats",
        stats: [
          { field: "damageType", label: "Damage Type", direction: "neutral", format: fmtToken },
          { field: "alphaDamageTotal", label: "Alpha Damage", direction: "higher", format: fmtCompact() },
          { field: "fireRateRpm", label: "Fire Rate", direction: "neutral", format: fmtCompact(" rpm") },
          { field: "ammoCapacity", label: "Ammo Capacity", direction: "higher", format: fmtCompact() },
          { field: "chargeTime", label: "Charge Time", direction: "lower", format: fmtCompact("s") },
          { field: "coolingRate", label: "Cooling Rate", direction: "higher", format: fmtCompact() },
        ],
      },
      {
        title: "Projectile",
        stats: [
          { field: "projectileSpeed", label: "Projectile Speed", direction: "higher", format: fmtCompact(" m/s") },
          { field: "calculatedRange", label: "Projectile Lifetime Travel", direction: "neutral", format: fmtCompact("m") },
        ],
      },
    ],
  },

  weapons: {
    statsKey: "fpsWeapon",
    sections: [
      {
        title: "Core Stats",
        stats: [
          { field: "weaponClass", label: "Weapon Class", direction: "neutral", format: fmtToken },
          { field: "fireMode", label: "Fire Mode", direction: "neutral", format: fmtToken },
          { field: "fireRateRpm", label: "Fire Rate", direction: "neutral", format: fmtCompact(" rpm") },
          { field: "ammoCapacity", label: "Ammo Capacity", direction: "higher", format: fmtCompact() },
          { field: "chargeTime", label: "Charge Time", direction: "lower", format: fmtCompact("s") },
        ],
      },
      {
        title: "Damage",
        stats: [
          { field: "alphaDamageTotal", label: "Alpha Damage", direction: "higher", format: fmtCompact() },
          { field: "dps", label: "DPS", direction: "higher", format: fmtCompact() },
        ],
      },
      {
        title: "Projectile",
        stats: [
          { field: "projectileSpeed", label: "Projectile Speed", direction: "higher", format: fmtCompact(" m/s") },
          { field: "calculatedRange", label: "Projectile Lifetime Travel", direction: "neutral", format: fmtCompact("m") },
          { field: "projectileLifetimeTravel", label: "Projectile Lifetime Travel", direction: "neutral", format: fmtCompact("m") },
          { field: "hardRange", label: "Hard Range", direction: "neutral", format: fmtCompact("m") },
        ],
      },
    ],
  },

  ammo: {
    statsKey: "fpsAmmo",
    sections: [
      {
        title: "Core Stats",
        stats: [
          { field: "ammoClass", label: "Ammo Class", direction: "neutral", format: fmtToken },
          { field: "compatibleWeaponClass", label: "Compatible Weapon Class", direction: "neutral", format: fmtToken },
          { field: "magazineCapacity", label: "Magazine Capacity", direction: "higher", format: fmtCompact() },
          { field: "alphaDamageTotal", label: "Alpha Damage", direction: "higher", format: fmtCompact() },
          { field: "projectileSpeed", label: "Projectile Speed", direction: "higher", format: fmtCompact(" m/s") },
          { field: "penetrationBaseDistance", label: "Penetration", direction: "higher", format: fmtCompact("m") },
        ],
      },
      {
        title: "Projectile",
        stats: [
          { field: "calculatedRange", label: "Projectile Lifetime Travel", direction: "neutral", format: fmtCompact("m") },
          { field: "projectileLifetimeTravel", label: "Projectile Lifetime Travel", direction: "neutral", format: fmtCompact("m") },
          { field: "hardRange", label: "Hard Range", direction: "neutral", format: fmtCompact("m") },
        ],
      },
    ],
  },

  armor: {
    statsKey: "fpsArmor",
    sections: [
      {
        title: "Armor Stats",
        stats: [
          { field: "armorSlot", label: "Armor Slot", direction: "neutral", format: fmtToken },
          { field: "armorWeight", label: "Armor Weight", direction: "neutral", format: fmtToken },
          { field: "physicalResistance", label: "Physical Resistance", direction: "neutral", format: fmtCompact() },
          { field: "energyResistance", label: "Energy Resistance", direction: "neutral", format: fmtCompact() },
          { field: "storageCapacity", label: "Storage", direction: "higher", format: fmtCompact(" microSCU") },
          { field: "mass", label: "Mass", direction: "neutral", format: fmtCompact() },
        ],
      },
      {
        title: "Temperature",
        stats: [
          { field: "temperatureMin", label: "Temp Min", direction: "neutral", format: fmtCompact("°C") },
          { field: "temperatureMax", label: "Temp Max", direction: "neutral", format: fmtCompact("°C") },
        ],
      },
    ],
  },

  radar: {
    statsKey: "radar",
    sections: [
      {
        title: "Radar Stats",
        stats: [
          { field: "pingCooldown", label: "Ping Cooldown", direction: "lower", format: fmtCompact("s") },
          { field: "aimAssistRangeMin", label: "Aim Assist Min", direction: "neutral", format: fmtCompact("m") },
          { field: "aimAssistRangeMax", label: "Aim Assist Max", direction: "neutral", format: fmtCompact("m") },
          { field: "onlineEmSignature", label: "Online EM", direction: "neutral", format: fmtCompact() },
          { field: "onlineIrSignature", label: "Online IR", direction: "neutral", format: fmtCompact() },
        ],
      },
      {
        title: "Power & Cooling",
        stats: [
          pairStat("powerUsageMin", "powerUsageMax", "Power Usage", "lower"),
          pairStat("coolantUsageMin", "coolantUsageMax", "Coolant Usage", "lower"),
        ],
      },
    ],
  },

  weaponMining: {
    statsKey: "miningLaser",
    sections: [
      {
        title: "Mining Stats",
        stats: [
          { field: "miningPower", label: "Mining Power", direction: "higher", format: fmtCompact() },
          { field: "extractionPower", label: "Extraction Power", direction: "higher", format: fmtCompact() },
          { field: "instabilityModifier", label: "Instability Modifier", direction: "neutral", format: fmtCompact() },
          { field: "resistanceModifier", label: "Resistance Modifier", direction: "neutral", format: fmtCompact() },
          { field: "fractureWindowSize", label: "Fracture Window", direction: "neutral", format: fmtCompact() },
          { field: "laserRange", label: "Laser Range", direction: "higher", format: fmtCompact("m") },
          { field: "beamRange", label: "Beam Range", direction: "higher", format: fmtCompact("m") },
          { field: "wearRate", label: "Wear Rate", direction: "lower", format: fmtCompact() },
        ],
      },
      {
        title: "Power & Heat",
        stats: [
          pairStat("powerUsageMin", "powerUsageMax", "Power Usage", "lower"),
          { field: "heatGeneration", label: "Heat Generation", direction: "lower", format: fmtCompact() },
        ],
      },
    ],
  },
};

// Normalize record.type to registry key
export function getRegistryKey(record: ComponentCardIndexRecord): string | null {
  const t = record.type;
  if (t === "weaponGun") return "weaponGun";
  if (t === "weapons") return "weapons";
  if (t === "ammo") return "ammo";
  if (t === "armor") return "armor";
  if (t === "shield") return "shield";
  if (t === "cooler") return "cooler";
  if (t === "powerplant") return "powerplant";
  if (t === "quantumdrive") return "quantumDrive";
  if (t === "radar") return "radar";
  if (t === "weaponMining") return "weaponMining";
  // tractorbeam → generic/fallback, no dedicated stats block
  return null;
}

export function getStatsBlock(
  record: ComponentCardIndexRecord,
  registryKey: string,
): Record<string, unknown> | null {
  const entry = CATEGORY_REGISTRY[registryKey];
  if (!entry) return null;
  const stats = record.stats as unknown;
  if (typeof stats !== "object" || stats === null) return null;

  const keys = Array.isArray(entry.statsKey) ? entry.statsKey : [entry.statsKey];
  for (const key of keys) {
    const block = (stats as Record<string, unknown>)[key];
    if (typeof block === "object" && block !== null && !Array.isArray(block)) {
      return block as Record<string, unknown>;
    }
  }
  return null;
}

export function resolveStatValue(
  statDef: CompareStatDef,
  statsBlock: Record<string, unknown>,
): string | null {
  const rawMin = statsBlock[statDef.field];
  if (statDef.maxField) {
    const rawMax = statsBlock[statDef.maxField];
    const min = asNumber(rawMin);
    const max = asNumber(rawMax);
    if (min === null && max === null) return null;
    const suffix = statDef.suffix ?? "";
    if (min !== null && max !== null && min !== max) {
      return `${fmtNumber(min)}-${fmtNumber(max)}${suffix}`;
    }
    const val = max ?? min ?? 0;
    if (val === 0) return null;
    return `${fmtNumber(val)}${suffix}`;
  }
  return statDef.format(rawMin);
}

// ── At a Glance scoring ───────────────────────────────────────────────────────

export type GlanceResult = {
  aWins: number;
  bWins: number;
  tied: number;
  highlights: GlanceHighlight[];
};

export type GlanceHighlight = {
  label: string;
  direction: "a" | "b" | "tied";
  delta: number;
};

export function computeAtAGlance(
  a: ComponentCardIndexRecord,
  b: ComponentCardIndexRecord,
  registryKey: string,
): GlanceResult {
  const entry = CATEGORY_REGISTRY[registryKey];
  const blockA = getStatsBlock(a, registryKey);
  const blockB = getStatsBlock(b, registryKey);

  let aWins = 0;
  let bWins = 0;
  let tied = 0;
  const highlights: GlanceHighlight[] = [];

  if (!entry || !blockA || !blockB) return { aWins, bWins, tied, highlights };

  const allStats = entry.sections.flatMap((s) => s.stats);
  const seen = new Set<string>();

  for (const stat of allStats) {
    if (seen.has(stat.field)) continue;
    seen.add(stat.field);
    if (stat.direction === "neutral") continue;

    const rawA = blockA[stat.field];
    const rawB = blockB[stat.field];
    const nA = typeof rawA === "number" ? rawA : typeof rawA === "string" ? Number(rawA) : NaN;
    const nB = typeof rawB === "number" ? rawB : typeof rawB === "string" ? Number(rawB) : NaN;

    if (!Number.isFinite(nA) || !Number.isFinite(nB)) continue;
    if (nA === 0 && nB === 0) continue;

    const base = Math.max(Math.abs(nA), Math.abs(nB), 0.001);
    const delta = Math.abs(nA - nB) / base;

    if (nA === nB) {
      tied++;
    } else {
      const aIsBetter = stat.direction === "higher" ? nA > nB : nA < nB;
      if (aIsBetter) {
        aWins++;
      } else {
        bWins++;
      }
      highlights.push({ label: stat.label, direction: aIsBetter ? "a" : "b", delta });
    }
  }

  highlights.sort((x, y) => y.delta - x.delta);
  return { aWins, bWins, tied, highlights: highlights.slice(0, 3) };
}
