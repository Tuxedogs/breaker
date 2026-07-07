import type { ComponentCardMetric } from "../../components/industry/crafting/utils/componentCardSchema";
import type {
  DamageTypeMap,
  FittingComponentDetail,
  FittingComponentMitigation,
  FittingComponentStats,
} from "./fittingApi";

function readFinite(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatCompactNumber(value: number | null | undefined, suffix = ""): string | null {
  const number = readFinite(value ?? undefined);
  if (number === undefined) return null;
  return `${formatNumber(number)}${suffix}`;
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function pushMetric(metrics: ComponentCardMetric[], label: string, value: string | null): void {
  if (value) metrics.push({ label, value });
}

function formatDamageTypeMap(map: DamageTypeMap | null | undefined): string | null {
  if (!map) return null;
  const parts = Object.entries(map)
    .map(([type, entry]) => {
      if (!entry) return null;
      const value = readFinite(entry.value ?? undefined);
      const min = readFinite(entry.min ?? undefined);
      const max = readFinite(entry.max ?? undefined);
      if (value !== undefined) return `${titleCase(type)} ${formatNumber(value)}`;
      if (min !== undefined && max !== undefined) {
        return min === max
          ? `${titleCase(type)} ${formatNumber(min)}`
          : `${titleCase(type)} ${formatNumber(min)}-${formatNumber(max)}`;
      }
      return null;
    })
    .filter((part): part is string => Boolean(part));
  if (parts.length === 0) return null;
  return parts.join("; ");
}

export function getFittingModifierBaseValue(
  detail: FittingComponentDetail | null | undefined,
  property: string,
): number | undefined {
  if (!detail) return undefined;

  const { stats, mitigation } = detail;

  switch (property) {
    case "GPP_Weapon_Damage":
      return readFinite(stats.alphaDamage);
    case "GPP_Weapon_FireRate":
      return readFinite(stats.fireRateRpm);
    case "GPP_Shield_MaxHealth":
      return (
        readFinite(stats.shieldHp)
        ?? (mitigation?.kind === "shield"
          ? readFinite(mitigation.shieldHp) ?? readFinite(mitigation.maxShieldHealth)
          : undefined)
      );
    case "GPP_Health_MaxHealth":
      return (
        readFinite(stats.health)
        ?? (mitigation?.kind === "armor" ? readFinite(mitigation.health) : undefined)
      );
    case "GPP_ItemResource_PowerGeneration":
      return readFinite(stats.powerGenerated);
    case "GPP_ItemResource_CoolantGeneration":
      return readFinite(stats.coolingGenerated);
    case "GPP_Quantum_Speed":
      return readFinite(stats.quantumSpeed);
    case "GPP_Quantum_FuelRequirement": {
      const fuelRate = readFinite(stats.fuelRate);
      return fuelRate;
    }
    default:
      return undefined;
  }
}

function buildWeaponStatRows(detail: FittingComponentDetail): ComponentCardMetric[] {
  const { stats, mitigation } = detail;
  const rows: ComponentCardMetric[] = [];

  if (detail.size !== null) pushMetric(rows, "Size", `S${detail.size}`);
  pushMetric(rows, "Grade", detail.grade);
  pushMetric(rows, "Class", detail.class ? titleCase(detail.class) : null);
  pushMetric(rows, "Alpha Damage", formatCompactNumber(stats.alphaDamage));
  pushMetric(rows, "Fire Rate", formatCompactNumber(stats.fireRateRpm, " rpm"));
  pushMetric(rows, "DPS", formatCompactNumber(stats.dps));
  pushMetric(rows, "Projectile Speed", formatCompactNumber(stats.projectileSpeed, " m/s"));
  pushMetric(rows, "Projectile Range / Max Travel", formatCompactNumber(stats.calculatedRange, "m"));
  pushMetric(rows, "Ammo Capacity", formatCompactNumber(stats.ammoCapacity));
  pushMetric(rows, "Physical Damage", formatCompactNumber(stats.damagePhysical));
  pushMetric(rows, "Energy Damage", formatCompactNumber(stats.damageEnergy));
  pushMetric(rows, "Distortion Damage", formatCompactNumber(stats.damageDistortion));
  pushMetric(rows, "Thermal Damage", formatCompactNumber(stats.damageThermal));
  pushMetric(rows, "Biochemical Damage", formatCompactNumber(stats.damageBiochemical));
  pushMetric(rows, "Stun Damage", formatCompactNumber(stats.damageStun));
  pushMetric(rows, "Power Draw", formatCompactNumber(stats.powerDraw));
  pushMetric(rows, "Cooling Draw", formatCompactNumber(stats.coolingDraw));
  pushMetric(rows, "Heat Generation", formatCompactNumber(stats.heatGenerated));
  pushMetric(rows, "Online EM", formatCompactNumber(stats.electromagneticEmission));
  pushMetric(rows, "Online IR", formatCompactNumber(stats.infraredEmission));
  pushMetric(rows, "Component HP", formatCompactNumber(stats.health));
  pushMetric(rows, "Mass", formatCompactNumber(stats.mass));

  if (mitigation?.kind === "weapon_projectile") {
    pushMetric(rows, "Penetration Distance", formatCompactNumber(mitigation.basePenetrationDistance, "m"));
    pushMetric(rows, "Ammo Penetration", formatCompactNumber(mitigation.ammoPenetration));
  }

  return rows;
}

function buildShieldStatRows(detail: FittingComponentDetail): ComponentCardMetric[] {
  const { stats, mitigation } = detail;
  const rows: ComponentCardMetric[] = [];
  const shieldMitigation = mitigation?.kind === "shield" ? mitigation : null;

  pushMetric(rows, "Shield HP", formatCompactNumber(stats.shieldHp ?? shieldMitigation?.shieldHp ?? shieldMitigation?.maxShieldHealth));
  pushMetric(rows, "Regen Rate", formatCompactNumber(stats.regenRate ?? shieldMitigation?.maxShieldRegen, "/s"));
  pushMetric(rows, "Regen Delay", formatCompactNumber(shieldMitigation?.damagedRegenDelay, "s"));
  pushMetric(
    rows,
    "Physical Resistance",
    formatDamageTypeMap(shieldMitigation?.resistanceByDamageType ?? null),
  );
  pushMetric(
    rows,
    "Energy Absorption",
    formatDamageTypeMap(shieldMitigation?.absorptionByDamageType ?? null),
  );
  pushMetric(rows, "Power Draw", formatCompactNumber(stats.powerDraw));
  pushMetric(rows, "Heat Generation", formatCompactNumber(stats.heatGenerated));
  pushMetric(rows, "EM Signature", formatCompactNumber(stats.electromagneticEmission));
  pushMetric(rows, "IR Signature", formatCompactNumber(stats.infraredEmission));
  pushMetric(rows, "Component HP", formatCompactNumber(stats.health));
  pushMetric(rows, "Mass", formatCompactNumber(stats.mass));
  if (detail.size !== null) pushMetric(rows, "Size", `S${detail.size}`);
  pushMetric(rows, "Grade", detail.grade);
  pushMetric(rows, "Class", detail.class ? titleCase(detail.class) : null);

  return rows;
}

function buildResourceStatRows(
  detail: FittingComponentDetail,
  primary: { label: string; value: number | null | undefined },
): ComponentCardMetric[] {
  const { stats } = detail;
  const rows: ComponentCardMetric[] = [];

  pushMetric(rows, primary.label, formatCompactNumber(primary.value));
  pushMetric(rows, "Power Draw", formatCompactNumber(stats.powerDraw));
  pushMetric(rows, "Cooling Draw", formatCompactNumber(stats.coolingDraw));
  pushMetric(rows, "Heat Generation", formatCompactNumber(stats.heatGenerated));
  pushMetric(rows, "EM Signature", formatCompactNumber(stats.electromagneticEmission));
  pushMetric(rows, "IR Signature", formatCompactNumber(stats.infraredEmission));
  pushMetric(rows, "Component HP", formatCompactNumber(stats.health));
  pushMetric(rows, "Mass", formatCompactNumber(stats.mass));
  if (detail.size !== null) pushMetric(rows, "Size", `S${detail.size}`);
  pushMetric(rows, "Grade", detail.grade);
  pushMetric(rows, "Class", detail.class ? titleCase(detail.class) : null);

  return rows;
}

function buildQuantumStatRows(detail: FittingComponentDetail): ComponentCardMetric[] {
  const { stats } = detail;
  const rows = buildResourceStatRows(detail, { label: "Quantum Speed", value: stats.quantumSpeed });
  pushMetric(rows, "Spool Time", formatCompactNumber(stats.spoolTime, "s"));
  pushMetric(rows, "Cooldown", formatCompactNumber(stats.quantumCooldown, "s"));
  pushMetric(rows, "Fuel Rate", formatCompactNumber(stats.fuelRate));
  return rows;
}

function buildRadarStatRows(detail: FittingComponentDetail): ComponentCardMetric[] {
  const { stats } = detail;
  const rows = buildResourceStatRows(detail, { label: "Detection Range", value: stats.detectionRange });
  pushMetric(rows, "Scan Range", formatCompactNumber(stats.scanRange));
  pushMetric(rows, "Scan Rate", formatCompactNumber(stats.scanRate));
  pushMetric(rows, "Scan Cooldown", formatCompactNumber(stats.scanCooldownTime, "s"));
  pushMetric(rows, "Signature Sensitivity", formatCompactNumber(stats.signatureSensitivity));
  return rows;
}

function buildGenericStatRows(detail: FittingComponentDetail): ComponentCardMetric[] {
  const { stats } = detail;
  const rows: ComponentCardMetric[] = [];

  pushMetric(rows, "Component HP", formatCompactNumber(stats.health));
  pushMetric(rows, "Mass", formatCompactNumber(stats.mass));
  pushMetric(rows, "Volume", formatCompactNumber(stats.volume));
  pushMetric(rows, "Power Draw", formatCompactNumber(stats.powerDraw));
  pushMetric(rows, "Cooling Draw", formatCompactNumber(stats.coolingDraw));
  pushMetric(rows, "Heat Generation", formatCompactNumber(stats.heatGenerated));
  pushMetric(rows, "EM Signature", formatCompactNumber(stats.electromagneticEmission));
  pushMetric(rows, "IR Signature", formatCompactNumber(stats.infraredEmission));
  if (detail.size !== null) pushMetric(rows, "Size", `S${detail.size}`);
  pushMetric(rows, "Grade", detail.grade);
  pushMetric(rows, "Class", detail.class ? titleCase(detail.class) : null);

  return rows;
}

/** Path A: general fitting-backed base stats for Crafting Detail / item summary. */
export function buildItemSummaryDetailStatRows(detail: FittingComponentDetail): ComponentCardMetric[] {
  return buildDetailStatRowsFromFitting(detail);
}

export function buildDetailStatRowsFromFitting(detail: FittingComponentDetail): ComponentCardMetric[] {
  switch (detail.type) {
    case "ship_weapon":
      return buildWeaponStatRows(detail);
    case "shield":
      return buildShieldStatRows(detail);
    case "cooler":
      return buildResourceStatRows(detail, { label: "Coolant Generation", value: detail.stats.coolingGenerated });
    case "power_plant":
      return buildResourceStatRows(detail, { label: "Power Generation", value: detail.stats.powerGenerated });
    case "quantum_drive":
      return buildQuantumStatRows(detail);
    case "radar":
      return buildRadarStatRows(detail);
    default:
      return buildGenericStatRows(detail);
  }
}

const BROWSE_META_DUPLICATE_LABELS = new Set([
  "size",
  "grade",
  "class",
  "craft",
  "crafttime",
]);

function normalizeBrowseStatLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function buildBrowseStatPreviewFromFitting(
  detail: FittingComponentDetail,
  maxRows = 5,
): ComponentCardMetric[] {
  return buildDetailStatRowsFromFitting(detail)
    .filter((row) => !BROWSE_META_DUPLICATE_LABELS.has(normalizeBrowseStatLabel(row.label)))
    .slice(0, maxRows);
}

export function inferPrimaryShipWeaponDamageType(
  detail: FittingComponentDetail | null | undefined,
): string | null {
  if (!detail || detail.type !== "ship_weapon") return null;

  const candidates: Array<[string, number | null | undefined]> = [
    ["Physical", detail.stats.damagePhysical],
    ["Energy", detail.stats.damageEnergy],
    ["Distortion", detail.stats.damageDistortion],
    ["Thermal", detail.stats.damageThermal],
    ["Biochemical", detail.stats.damageBiochemical],
    ["Stun", detail.stats.damageStun],
  ];

  let best: { name: string; value: number } | null = null;
  for (const [name, value] of candidates) {
    const numeric = readFinite(value ?? undefined);
    if (numeric === undefined || numeric <= 0) continue;
    if (!best || numeric > best.value) best = { name, value: numeric };
  }

  return best?.name ?? null;
}

export function buildFittingIdentityMetricRows(detail: FittingComponentDetail): ComponentCardMetric[] {
  const rows: ComponentCardMetric[] = [];
  if (detail.size !== null) pushMetric(rows, "Size", `S${detail.size}`);
  pushMetric(rows, "Grade", detail.grade);
  pushMetric(rows, "Class", detail.class ? titleCase(detail.class) : null);
  return rows;
}

export function buildSecondaryStatsFromFitting(detail: FittingComponentDetail): ComponentCardMetric[] {
  if (detail.type === "ship_weapon") return [];
  const rows: ComponentCardMetric[] = [];
  pushMetric(rows, "Component HP", formatCompactNumber(detail.stats.health));
  pushMetric(rows, "Mass", formatCompactNumber(detail.stats.mass));
  pushMetric(rows, "Volume", formatCompactNumber(detail.stats.volume));
  return rows;
}

export function normalizeModifierDetailStatLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Modifier stat labels that should attach to a fitting-projected row with a different label. */
export function modifierDetailStatLabelKeys(label: string): string[] {
  const normalized = normalizeModifierDetailStatLabel(label);
  const keys = [normalized];
  if (normalized === "health") keys.push("componenthp");
  return keys;
}

export function isFittingWeaponPerformanceType(detail: FittingComponentDetail): boolean {
  return detail.type === "ship_weapon";
}

export function getFittingDpsBases(detail: FittingComponentDetail | null | undefined): {
  dps?: number;
  alphaDamage?: number;
  fireRateRpm?: number;
} {
  if (!detail) return {};
  return {
    dps: readFinite(detail.stats.dps),
    alphaDamage: readFinite(detail.stats.alphaDamage),
    fireRateRpm: readFinite(detail.stats.fireRateRpm),
  };
}

export type { FittingComponentStats, FittingComponentMitigation };
