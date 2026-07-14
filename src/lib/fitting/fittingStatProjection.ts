import type { ComponentCardMetric } from "../../components/industry/crafting/utils/componentCardSchema";
import type {
  DamageTypeMap,
  FittingComponentDetail,
  FittingComponentMitigation,
  FittingComponentStats,
} from "./fittingApi";
import { getFpsArmorCardExtras } from "../crafting/fpsComponentCardDetail";

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

function pushNonZeroMetric(
  metrics: ComponentCardMetric[],
  label: string,
  value: number | null | undefined,
  suffix = "",
): void {
  const number = readFinite(value ?? undefined);
  if (number === undefined || number === 0) return;
  pushMetric(metrics, label, formatCompactNumber(number, suffix));
}

function readWeaponPenetration(
  stats: FittingComponentStats,
  mitigation: FittingComponentMitigation | null,
): number | undefined {
  if (mitigation?.kind === "weapon_projectile") {
    const ammoPenetration = readFinite(mitigation.ammoPenetration ?? undefined);
    if (ammoPenetration !== undefined) return ammoPenetration;
    const thickness = readFinite(mitigation.maxPenetrationThickness ?? undefined);
    if (thickness !== undefined) return thickness;
  }
  return readFinite(stats.maxPenetrationThickness ?? undefined);
}

function readWeaponPenetrationDistance(
  mitigation: FittingComponentMitigation | null,
): number | undefined {
  if (mitigation?.kind !== "weapon_projectile") return undefined;
  return readFinite(mitigation.basePenetrationDistance ?? undefined);
}

function readWeaponPower(stats: FittingComponentStats): number | undefined {
  return readFinite(stats.powerDraw ?? stats.powerUsage ?? undefined);
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

  pushMetric(rows, "Alpha Damage", formatCompactNumber(stats.alphaDamage));
  pushNonZeroMetric(rows, "Physical Damage", stats.damagePhysical);
  pushNonZeroMetric(rows, "Energy Damage", stats.damageEnergy);
  pushNonZeroMetric(rows, "Distortion Damage", stats.damageDistortion);
  pushNonZeroMetric(rows, "Thermal Damage", stats.damageThermal);
  pushNonZeroMetric(rows, "Biochemical Damage", stats.damageBiochemical);
  pushNonZeroMetric(rows, "Stun Damage", stats.damageStun);
  pushMetric(rows, "Fire Rate", formatCompactNumber(stats.fireRateRpm, " rpm"));
  pushMetric(rows, "Ammo Capacity", formatCompactNumber(stats.ammoCapacity));
  pushMetric(rows, "Projectile Speed", formatCompactNumber(stats.projectileSpeed, " m/s"));
  pushMetric(rows, "Projectile Range / Max Travel", formatCompactNumber(stats.calculatedRange, "m"));
  pushMetric(rows, "Penetration", formatCompactNumber(readWeaponPenetration(stats, mitigation)));
  pushMetric(rows, "Penetration Distance", formatCompactNumber(readWeaponPenetrationDistance(mitigation), "m"));
  pushMetric(rows, "Heat Per Shot", formatCompactNumber(stats.heatPerShot));
  pushMetric(rows, "Cooling Rate", formatCompactNumber(stats.cooldownRate));
  pushMetric(rows, "Power", formatCompactNumber(readWeaponPower(stats)));
  pushMetric(rows, "Online EM", formatCompactNumber(stats.electromagneticEmission));
  pushMetric(rows, "EM Signature", formatCompactNumber(stats.crossSection ?? stats.radarEmission));
  pushMetric(rows, "Distortion Maximum", formatCompactNumber(stats.distortionResistance));
  pushMetric(rows, "Component HP", formatCompactNumber(stats.health));
  pushMetric(rows, "Mass", formatCompactNumber(stats.mass));

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

function formatPowerPair(min: number | null | undefined, max: number | null | undefined): string | null {
  const minValue = readFinite(min ?? undefined);
  const maxValue = readFinite(max ?? undefined);
  if (minValue === undefined && maxValue === undefined) return null;
  if (minValue !== undefined && maxValue !== undefined && minValue !== maxValue) {
    return `${formatNumber(minValue)} - ${formatNumber(maxValue)}`;
  }
  return formatCompactNumber(maxValue ?? minValue);
}

function buildUtilityStatTail(stats: FittingComponentStats): ComponentCardMetric[] {
  const rows: ComponentCardMetric[] = [];
  pushMetric(rows, "Power", formatPowerPair(stats.powerUsageMin, stats.powerUsageMax ?? stats.powerDraw ?? stats.powerUsage));
  pushMetric(rows, "Power Draw", formatCompactNumber(stats.powerDraw ?? stats.powerUsage));
  pushMetric(rows, "Cooling Draw", formatCompactNumber(stats.coolingDraw));
  pushMetric(rows, "Heat Generation", formatCompactNumber(stats.heatGenerated ?? stats.heatPerSecond));
  pushMetric(rows, "Online EM", formatCompactNumber(stats.onlineEmSignature ?? stats.electromagneticEmission));
  pushMetric(rows, "Online IR", formatCompactNumber(stats.onlineIrSignature ?? stats.infraredEmission));
  pushMetric(rows, "EM Signature", formatCompactNumber(stats.electromagneticEmission));
  pushMetric(rows, "IR Signature", formatCompactNumber(stats.infraredEmission));
  pushMetric(rows, "Distortion Maximum", formatCompactNumber(stats.distortionMaximum));
  pushMetric(rows, "Component HP", formatCompactNumber(stats.health));
  pushMetric(rows, "Mass", formatCompactNumber(stats.mass));
  return rows;
}

function buildMiningLaserStatRows(detail: FittingComponentDetail): ComponentCardMetric[] {
  const { stats } = detail;
  const rows: ComponentCardMetric[] = [];
  pushMetric(rows, "Mining Power", formatCompactNumber(stats.miningPower));
  pushMetric(rows, "Extraction Power", formatCompactNumber(stats.extractionPower));
  pushMetric(rows, "Instability Modifier", formatCompactNumber(stats.instabilityModifier));
  pushMetric(rows, "Resistance Modifier", formatCompactNumber(stats.resistanceModifier));
  pushMetric(rows, "Fracture Window", formatCompactNumber(stats.fractureWindowSize));
  pushMetric(rows, "Laser Range", formatCompactNumber(stats.laserRange, "m"));
  pushMetric(rows, "Beam Range", formatCompactNumber(stats.beamRange, "m"));
  pushMetric(rows, "Throttle Minimum", formatCompactNumber(stats.throttleMinimum));
  pushMetric(rows, "Wear Rate", formatCompactNumber(stats.wearPerSecond));
  rows.push(...buildUtilityStatTail(stats));
  return rows;
}

function buildSalvageHeadStatRows(detail: FittingComponentDetail): ComponentCardMetric[] {
  const { stats } = detail;
  const rows: ComponentCardMetric[] = [];
  pushMetric(rows, "Material Efficiency", formatCompactNumber(stats.materialEfficiency));
  pushMetric(rows, "Max Health Repair Rate", formatCompactNumber(stats.maxHealthRepairRate));
  pushMetric(rows, "Max Damage Map Repair Rate", formatCompactNumber(stats.maxDamageMapRepairRate));
  pushMetric(rows, "Tractor Max Force", formatCompactNumber(stats.tractorMaxForce));
  pushMetric(rows, "Tractor Max Distance", formatCompactNumber(stats.tractorMaxDistance, "m"));
  pushMetric(rows, "Tractor Full Strength Distance", formatCompactNumber(stats.tractorFullStrengthDistance, "m"));
  pushMetric(rows, "Beam Range", formatCompactNumber(stats.beamRange, "m"));
  rows.push(...buildUtilityStatTail(stats));
  return rows;
}

function buildSalvageModifierStatRows(detail: FittingComponentDetail): ComponentCardMetric[] {
  const { stats } = detail;
  const rows: ComponentCardMetric[] = [];
  pushMetric(rows, "Hull Scraping Speed Modifier", formatCompactNumber(stats.hullScrapingSpeedModifier ?? stats.hullScrapingSpeedMultiplier));
  pushMetric(rows, "Hull Scraping Radius Modifier", formatCompactNumber(stats.hullScrapingRadiusModifier ?? stats.hullScrapingRadiusMultiplier));
  pushMetric(rows, "Hull Scraping Efficiency Modifier", formatCompactNumber(stats.hullScrapingEfficiencyModifier ?? stats.hullScrapingEfficiencyMultiplier));
  pushMetric(rows, "Tractor Max Force", formatCompactNumber(stats.tractorMaxForce));
  pushMetric(rows, "Tractor Max Distance", formatCompactNumber(stats.tractorMaxDistance, "m"));
  pushMetric(rows, "Beam Range", formatCompactNumber(stats.beamRange, "m"));
  rows.push(...buildUtilityStatTail(stats));
  return rows;
}

function buildFuelNozzleStatRows(detail: FittingComponentDetail): ComponentCardMetric[] {
  const { stats } = detail;
  const rows: ComponentCardMetric[] = [];
  pushMetric(rows, "Fuel Transfer Rate", formatCompactNumber(stats.fuelTransferRate));
  pushMetric(rows, "Quantum Fuel Transfer Rate", formatCompactNumber(stats.quantumFuelTransferRate));
  pushMetric(rows, "Capture Radius", formatCompactNumber(stats.captureRadius, "m"));
  rows.push(...buildUtilityStatTail(stats));
  return rows;
}

function buildFpsWeaponStatRows(detail: FittingComponentDetail): ComponentCardMetric[] {
  const rows = buildWeaponStatRows(detail);
  pushMetric(rows, "DPS", formatCompactNumber(detail.stats.dps));
  pushMetric(rows, "Wear Per Shot", formatCompactNumber(detail.stats.wearPerSecond));
  if (detail.subtype) pushMetric(rows, "Weapon Class", titleCase(detail.subtype));
  if (detail.class) pushMetric(rows, "Fire Mode", titleCase(detail.class));
  return rows;
}

function buildFpsArmorStatRows(detail: FittingComponentDetail): ComponentCardMetric[] {
  const rows: ComponentCardMetric[] = [];
  const mitigation = detail.mitigation?.kind === "armor" ? detail.mitigation : null;
  const extras = getFpsArmorCardExtras(detail);
  const resistance = mitigation?.resistanceByDamageType;

  if (detail.subtype) pushMetric(rows, "Armor Slot", titleCase(detail.subtype));
  if (detail.class) pushMetric(rows, "Armor Weight", titleCase(detail.class));

  pushMetric(rows, "Physical Res", formatCompactNumber(resistance?.physical?.value ?? null));
  pushMetric(rows, "Energy Res", formatCompactNumber(resistance?.energy?.value ?? null));
  pushMetric(rows, "Distortion Res", formatCompactNumber(resistance?.distortion?.value ?? null));
  pushMetric(rows, "Thermal Res", formatCompactNumber(resistance?.thermal?.value ?? null));
  pushMetric(rows, "Biochemical Res", formatCompactNumber(resistance?.biochemical?.value ?? null));
  pushMetric(rows, "Stun Res", formatCompactNumber(resistance?.stun?.value ?? null));

  const tempMin = extras?.temperatureMin ?? null;
  const tempMax = extras?.temperatureMax ?? null;
  if (tempMin !== null && tempMax !== null) {
    pushMetric(rows, "Temp Range", `${formatNumber(tempMin)} - ${formatNumber(tempMax)} C`);
  } else if (tempMin !== null) {
    pushMetric(rows, "Temp Min", formatCompactNumber(tempMin, " C"));
  } else if (tempMax !== null) {
    pushMetric(rows, "Temp Max", formatCompactNumber(tempMax, " C"));
  }

  pushMetric(rows, "Radiation Dissipation", formatCompactNumber(extras?.radiationDissipation ?? null, " REM/s"));
  pushMetric(rows, "Storage", formatCompactNumber(extras?.storageCapacity ?? null, " microSCU"));
  pushMetric(rows, "Mass", formatCompactNumber(detail.stats.mass));
  pushMetric(rows, "Health", formatCompactNumber(detail.stats.health));

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
    case "fps_weapon":
      return buildFpsWeaponStatRows(detail);
    case "fps_armor":
      return buildFpsArmorStatRows(detail);
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
    case "mining_laser":
      return buildMiningLaserStatRows(detail);
    case "salvage_head":
      return buildSalvageHeadStatRows(detail);
    case "salvage_modifier":
      return buildSalvageModifierStatRows(detail);
    case "fuel_nozzle":
      return buildFuelNozzleStatRows(detail);
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

const BROWSE_DAMAGE_CHANNEL_LABELS = new Set([
  "physicaldamage",
  "energydamage",
  "distortiondamage",
  "thermaldamage",
  "biochemicaldamage",
  "stundamage",
]);

function normalizeBrowseStatLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function buildBrowseStatPreviewFromFitting(
  detail: FittingComponentDetail,
  maxRows = 5,
): ComponentCardMetric[] {
  const rows = buildDetailStatRowsFromFitting(detail)
    .filter((row) => !BROWSE_META_DUPLICATE_LABELS.has(normalizeBrowseStatLabel(row.label)));

  if (detail.type !== "ship_weapon") return rows.slice(0, maxRows);

  const alphaDamage = rows.find((row) => normalizeBrowseStatLabel(row.label) === "alphadamage");
  const browseRows = alphaDamage
    ? rows.filter((row) => {
      const label = normalizeBrowseStatLabel(row.label);
      return !BROWSE_DAMAGE_CHANNEL_LABELS.has(label) || row.value !== alphaDamage.value;
    })
    : rows;

  return browseRows.slice(0, maxRows);
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
  if (detail.type === "ship_weapon" || detail.type === "mining_laser" || detail.type === "salvage_head" || detail.type === "salvage_modifier" || detail.type === "fuel_nozzle") return [];
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
