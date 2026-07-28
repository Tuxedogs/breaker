import type { ComponentCardMetric } from "../../components/industry/crafting/utils/componentCardSchema";
import type {
  DamageTypeMap,
  FittingComponentDetail,
  FittingComponentMitigation,
  FittingPowerPipPoint,
  FittingComponentStats,
} from "./fittingApi";
import { getFpsArmorCardExtras } from "../crafting/fpsComponentCardDetail";
import { quantumMetersToKilometers } from "./quantumDriveUnits";

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

function formatPowerCurve(
  points: FittingPowerPipPoint[] | null | undefined,
  suffix = "",
): string | null {
  if (!points) return null;
  const values = points.flatMap((point) => {
    const pips = readFinite(point.pips ?? undefined);
    const value = readFinite(point.value ?? undefined);
    if (pips === undefined || value === undefined) return [];
    return [`${formatNumber(pips)} ${pips === 1 ? "pip" : "pips"}: ${formatNumber(value)}${suffix}`];
  });
  return values.length > 0 ? values.join("; ") : null;
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
      return readFinite(stats.quantumFuelRequirement ?? stats.fuelRate);
    }
    default:
      return undefined;
  }
}

function buildWeaponStatRows(detail: FittingComponentDetail): ComponentCardMetric[] {
  const { stats, mitigation, weapon } = detail;
  const rows: ComponentCardMetric[] = [];

  pushMetric(rows, "Alpha Damage", formatCompactNumber(stats.alphaDamage));
  pushMetric(rows, "Theoretical DPS", formatCompactNumber(stats.theoreticalDps));
  pushMetric(rows, "60s Sustained DPS", formatCompactNumber(stats.sustainedDps60));
  pushMetric(rows, "Damage Over 60s", formatCompactNumber(stats.damageOver60Seconds));
  pushNonZeroMetric(rows, "Physical Damage", stats.damagePhysical);
  pushNonZeroMetric(rows, "Energy Damage", stats.damageEnergy);
  pushNonZeroMetric(rows, "Distortion Damage", stats.damageDistortion);
  pushNonZeroMetric(rows, "Thermal Damage", stats.damageThermal);
  pushNonZeroMetric(rows, "Biochemical Damage", stats.damageBiochemical);
  pushNonZeroMetric(rows, "Stun Damage", stats.damageStun);
  pushMetric(rows, "Fire Rate", formatCompactNumber(stats.fireRateRpm, " rpm"));
  pushMetric(rows, "Burst Size", formatCompactNumber(stats.burstShotCount));
  const hasEnergyAmmo = stats.maxAmmoLoad != null || stats.maxRegenPerSec != null;
  const ballisticReserve = !hasEnergyAmmo
    ? (stats.maxAmmoCount != null && stats.maxAmmoCount > 0
      ? stats.maxAmmoCount
      : stats.ammoCapacity != null && stats.ammoCapacity > 0
        ? stats.ammoCapacity
        : null)
    : null;
  pushMetric(rows, "Ballistic Reserve", formatCompactNumber(ballisticReserve));
  pushMetric(rows, "Energy Maximum Load", formatCompactNumber(stats.maxAmmoLoad));
  pushMetric(rows, "Energy Cost Per Shot", formatCompactNumber(stats.ammoCostPerShot));
  pushMetric(rows, "Energy Recharge Rate", formatCompactNumber(stats.maxRegenPerSec, "/s"));
  pushMetric(rows, "Recharge Cooldown", formatCompactNumber(stats.regenerationCooldown, "s"));
  pushMetric(rows, "Projectile Speed", formatCompactNumber(stats.projectileSpeed, " m/s"));
  pushMetric(rows, "Projectile Lifetime", formatCompactNumber(stats.projectileLifetime, "s"));
  pushMetric(rows, "Projectile Max Travel", formatCompactNumber(stats.projectileMaxTravel ?? stats.calculatedRange, "m"));
  pushMetric(rows, "Damage Falloff Start", formatCompactNumber(stats.falloffStart, "m"));
  pushMetric(rows, "Damage Drop Per Meter", formatCompactNumber(stats.damageDropPerMeter));
  pushMetric(rows, "Minimum Damage After Falloff", formatCompactNumber(stats.damageDropMinDamage));
  pushMetric(rows, "Penetration", formatCompactNumber(readWeaponPenetration(stats, mitigation)));
  pushMetric(rows, "Penetration Distance", formatCompactNumber(readWeaponPenetrationDistance(mitigation), "m"));
  pushMetric(rows, "Penetration Near Radius", formatCompactNumber(stats.penetrationNearRadius, "m"));
  pushMetric(rows, "Penetration Far Radius", formatCompactNumber(stats.penetrationFarRadius, "m"));
  pushMetric(rows, "Impulse Falloff Start", formatCompactNumber(stats.bulletImpulseFalloffMinDistance, "m"));
  pushMetric(rows, "Impulse Drop Falloff", formatCompactNumber(stats.bulletImpulseDropFalloff));
  pushMetric(rows, "Impulse Maximum Falloff", formatCompactNumber(stats.bulletImpulseMaxFalloff));
  pushMetric(rows, "Heat Per Shot", formatCompactNumber(stats.heatPerShot));
  pushMetric(rows, "Minimum Temperature", formatCompactNumber(stats.minimumTemperature));
  pushMetric(rows, "Overheat Temperature", formatCompactNumber(stats.overheatTemperature));
  pushMetric(rows, "Cooling Rate", formatCompactNumber(stats.coolingPerSecond ?? stats.cooldownRate, "/s"));
  pushMetric(rows, "Cooling Delay", formatCompactNumber(stats.timeTillCoolingStarts, "s"));
  pushMetric(rows, "Overheat Recovery", formatCompactNumber(stats.overheatFixTime, "s"));
  pushMetric(rows, "Post-Overheat Temperature", formatCompactNumber(stats.postOverheatTemperature));
  if (stats.spreadMin != null && stats.spreadMax != null) {
    pushMetric(rows, "Spread Min–Max", `${formatNumber(stats.spreadMin)} – ${formatNumber(stats.spreadMax)}`);
  }
  pushMetric(rows, "Spread First Attack", formatCompactNumber(stats.spreadFirstAttack));
  pushMetric(rows, "Spread Per Attack", formatCompactNumber(stats.spreadPerAttack));
  pushMetric(rows, "Spread Decay", formatCompactNumber(stats.spreadDecay));
  pushMetric(rows, "Power Maximum", formatCompactNumber(stats.powerInputMaximum ?? stats.powerConsumptionNominal ?? readWeaponPower(stats)));
  pushMetric(rows, "Power Minimum (derived)", formatCompactNumber(stats.powerInputMinimum ?? stats.powerConsumptionMinimum));
  pushMetric(rows, "EM Maximum", formatCompactNumber(stats.emSignatureNominal ?? stats.electromagneticEmission ?? stats.radarEmission));
  pushMetric(rows, "EM Decay Rate", formatCompactNumber(stats.emSignatureDecayRate));
  pushMetric(rows, "Self-Repair Uses", formatCompactNumber(stats.selfRepairMaxCount));
  pushMetric(rows, "Self-Repair Cycle", formatCompactNumber(stats.selfRepairTime, "s"));
  pushMetric(rows, "Self-Repair Health Ratio", stats.selfRepairHealthRatio != null ? `${formatNumber(stats.selfRepairHealthRatio * 100)}%` : null);
  pushMetric(rows, "Baseline HP Restored (derived)", formatCompactNumber(stats.selfRepairBaselineHp));
  pushMetric(rows, "Repair Restore Ratio", stats.repairRestoreRatio != null ? `${formatNumber(stats.repairRestoreRatio * 100)}%` : null);
  pushMetric(rows, "Distortion Resistance", formatCompactNumber(stats.distortionResistance));
  pushMetric(rows, "Component HP", formatCompactNumber(stats.health));
  pushMetric(rows, "Mass", formatCompactNumber(stats.mass));

  for (const action of weapon?.actions ?? []) {
    const prefix = titleCase(action.kind);
    if (action.pelletCount != null && action.pelletCount !== 1) {
      pushMetric(rows, `${prefix} Pellet Count`, formatCompactNumber(action.pelletCount));
    }
    if (action.damageMultiplier != null && action.damageMultiplier !== 1) {
      pushMetric(rows, `${prefix} Damage Multiplier`, formatCompactNumber(action.damageMultiplier));
    }
    pushMetric(rows, `${prefix} Heat Per Second`, formatCompactNumber(action.heatPerSecond, "/s"));
    pushMetric(rows, `${prefix} Action DPS`, formatCompactNumber(action.damagePerSecondTotal));
    pushMetric(rows, `${prefix} Charge Time`, formatCompactNumber(action.chargeTime, "s"));
    pushMetric(rows, `${prefix} Charge-Up`, formatCompactNumber(action.chargeUpTime, "s"));
    pushMetric(rows, `${prefix} Charge-Down`, formatCompactNumber(action.chargeDownTime, "s"));
    pushMetric(rows, `${prefix} Cooldown`, formatCompactNumber(action.cooldownTime, "s"));
    pushMetric(rows, `${prefix} Spin-Up`, formatCompactNumber(action.spinUpTime, "s"));
    pushMetric(rows, `${prefix} Spin-Down`, formatCompactNumber(action.spinDownTime, "s"));
    if (action.fireDuringSpinUp != null) {
      pushMetric(rows, `${prefix} Fires During Spin-Up`, action.fireDuringSpinUp ? "Yes" : "No");
    }
    pushMetric(rows, `${prefix} Full-Damage Range`, formatCompactNumber(action.fullDamageRange, "m"));
    pushMetric(rows, `${prefix} Zero-Damage Range`, formatCompactNumber(action.zeroDamageRange, "m"));
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
  pushMetric(rows, "Downed Regen Delay", formatCompactNumber(shieldMitigation?.downedRegenDelay, "s"));
  pushMetric(rows, "Regen by Power", formatPowerCurve(shieldMitigation?.regenByPowerPip, "/s"));
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
  pushMetric(rows, "Power Maximum", formatCompactNumber(stats.powerInputMaximum ?? stats.powerDraw));
  pushMetric(rows, "Power Minimum (derived)", formatCompactNumber(stats.powerInputMinimum));
  pushMetric(rows, "Power Draw", formatCompactNumber(stats.powerDraw));
  pushMetric(rows, "Cooling Draw", formatCompactNumber(stats.coolingDraw ?? stats.coolingRequired));
  pushMetric(rows, "Heat Generation", formatCompactNumber(stats.heatGenerated));
  if (stats.emSignatureNominal != null) {
    pushMetric(rows, "EM Maximum", formatCompactNumber(stats.emSignatureNominal));
  } else {
    pushMetric(rows, "EM Signature", formatCompactNumber(stats.electromagneticEmission));
  }
  pushMetric(rows, "EM Decay Rate", formatCompactNumber(stats.emSignatureDecayRate));
  pushMetric(rows, "IR Signature", formatCompactNumber(stats.infraredEmission));
  pushMetric(rows, "Self-Repair Uses", formatCompactNumber(stats.selfRepairMaxCount));
  pushMetric(rows, "Self-Repair Cycle", formatCompactNumber(stats.selfRepairTime, "s"));
  pushMetric(rows, "Self-Repair Health Ratio", stats.selfRepairHealthRatio != null ? `${formatNumber(stats.selfRepairHealthRatio * 100)}%` : null);
  pushMetric(rows, "Baseline HP Restored (derived)", formatCompactNumber(stats.selfRepairBaselineHp));
  pushMetric(rows, "Repair Restore Ratio", stats.repairRestoreRatio != null ? `${formatNumber(stats.repairRestoreRatio * 100)}%` : null);
  pushMetric(rows, "Distortion Maximum", formatCompactNumber(stats.distortionMaximum));
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
  if (detail.type === "cooler") {
    pushMetric(rows, "Thermal Equalization Rate", formatCompactNumber(stats.thermalEqualizationRate));
    pushMetric(rows, "Cooling by Power", formatPowerCurve(detail.cooler?.coolingGeneratedByPowerPip));
  }
  pushMetric(rows, "Power Maximum", formatCompactNumber(stats.powerInputMaximum ?? stats.powerDraw));
  pushMetric(rows, "Power Minimum (derived)", formatCompactNumber(stats.powerInputMinimum));
  pushMetric(rows, "Power Draw", formatCompactNumber(stats.powerDraw));
  pushMetric(rows, "Cooling Draw", formatCompactNumber(stats.coolingDraw));
  pushMetric(rows, "Heat Generation", formatCompactNumber(stats.heatGenerated));
  if (stats.emSignatureNominal != null) {
    pushMetric(rows, "EM Maximum", formatCompactNumber(stats.emSignatureNominal));
  } else {
    pushMetric(rows, "EM Signature", formatCompactNumber(stats.electromagneticEmission));
  }
  pushMetric(rows, "EM Decay Rate", formatCompactNumber(stats.emSignatureDecayRate));
  pushMetric(rows, "IR Signature", formatCompactNumber(stats.infraredEmission));
  pushMetric(rows, "Self-Repair Uses", formatCompactNumber(stats.selfRepairMaxCount));
  pushMetric(rows, "Self-Repair Cycle", formatCompactNumber(stats.selfRepairTime, "s"));
  pushMetric(rows, "Self-Repair Health Ratio", stats.selfRepairHealthRatio != null ? `${formatNumber(stats.selfRepairHealthRatio * 100)}%` : null);
  pushMetric(rows, "Baseline HP Restored (derived)", formatCompactNumber(stats.selfRepairBaselineHp));
  pushMetric(rows, "Repair Restore Ratio", stats.repairRestoreRatio != null ? `${formatNumber(stats.repairRestoreRatio * 100)}%` : null);
  pushMetric(rows, "Distortion Maximum", formatCompactNumber(stats.distortionMaximum));
  pushMetric(rows, "Component HP", formatCompactNumber(stats.health));
  pushMetric(rows, "Mass", formatCompactNumber(stats.mass));
  if (detail.size !== null) pushMetric(rows, "Size", `S${detail.size}`);
  pushMetric(rows, "Grade", detail.grade);
  pushMetric(rows, "Class", detail.class ? titleCase(detail.class) : null);

  return rows;
}

function buildQuantumStatRows(detail: FittingComponentDetail): ComponentCardMetric[] {
  const { stats } = detail;
  const rows = buildResourceStatRows(detail, {
    label: "Quantum Speed",
    value: stats.quantumSpeed == null ? stats.quantumSpeed : quantumMetersToKilometers(stats.quantumSpeed),
  });
  pushMetric(rows, "Spool Time", formatCompactNumber(stats.spoolTime, "s"));
  pushMetric(rows, "Cooldown", formatCompactNumber(stats.quantumCooldown, "s"));
  pushMetric(rows, "Fuel Requirement", formatCompactNumber(stats.quantumFuelRequirement ?? stats.fuelRate));
  pushMetric(rows, "Calibration Delay", formatCompactNumber(stats.calibrationDelayInSeconds, "s"));
  pushMetric(rows, "Calibration Rate", formatCompactNumber(stats.calibrationRate, "/s"));
  pushMetric(rows, "Calibration Minimum", formatCompactNumber(stats.minCalibrationRequirement));
  pushMetric(rows, "Calibration Maximum", formatCompactNumber(stats.maxCalibrationRequirement));
  pushMetric(rows, "Calibration Time (derived)", formatCompactNumber(stats.calibrationTime, "s"));
  pushMetric(
    rows,
    "Stage One Acceleration",
    formatCompactNumber(
      stats.quantumStageOneAccelRate == null
        ? stats.quantumStageOneAccelRate
        : quantumMetersToKilometers(stats.quantumStageOneAccelRate),
    ),
  );
  pushMetric(
    rows,
    "Stage Two Acceleration",
    formatCompactNumber(
      stats.quantumStageTwoAccelRate == null
        ? stats.quantumStageTwoAccelRate
        : quantumMetersToKilometers(stats.quantumStageTwoAccelRate),
    ),
  );
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
  pushMetric(rows, "Self-Repair Uses", formatCompactNumber(stats.selfRepairMaxCount));
  pushMetric(rows, "Self-Repair Cycle", formatCompactNumber(stats.selfRepairTime, "s"));
  pushMetric(rows, "Self-Repair Health Ratio", stats.selfRepairHealthRatio != null ? `${formatNumber(stats.selfRepairHealthRatio * 100)}%` : null);
  pushMetric(rows, "Baseline HP Restored (derived)", formatCompactNumber(stats.selfRepairBaselineHp));
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

function buildFpsAmmoStatRows(detail: FittingComponentDetail): ComponentCardMetric[] {
  const rows = buildWeaponStatRows(detail);
  pushMetric(rows, "Loaded Rounds", formatCompactNumber(detail.stats.initialAmmoCount));
  if (detail.class) pushMetric(rows, "Ammo Class", titleCase(detail.class));
  if (detail.subtype) pushMetric(rows, "Compatible Weapon Class", titleCase(detail.subtype));
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
  pushMetric(rows, "Distortion Maximum", formatCompactNumber(stats.distortionMaximum));
  pushMetric(rows, "Distortion Resistance", formatCompactNumber(stats.distortionResistance));
  pushMetric(rows, "Self-Repair Uses", formatCompactNumber(stats.selfRepairMaxCount));
  pushMetric(rows, "Self-Repair Cycle", formatCompactNumber(stats.selfRepairTime, "s"));
  pushMetric(rows, "Self-Repair Health Ratio", stats.selfRepairHealthRatio != null ? `${formatNumber(stats.selfRepairHealthRatio * 100)}%` : null);
  pushMetric(rows, "Baseline HP Restored (derived)", formatCompactNumber(stats.selfRepairBaselineHp));
  pushMetric(rows, "Minimum Lock Angle", formatCompactNumber(stats.lockAngleAtMin));
  pushMetric(rows, "Maximum Lock Angle", formatCompactNumber(stats.lockAngleAtMax));
  pushMetric(rows, "Maximum Armed Missiles", formatCompactNumber(stats.maxArmedMissiles));
  pushMetric(rows, "Launch Cooldown", formatCompactNumber(stats.launchCooldownTime, "s"));
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
    case "fps_ammo":
      return buildFpsAmmoStatRows(detail);
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
  if (normalized === "quantumfuelreq" || normalized === "quantumfuelrequirement") {
    keys.push("fuelrequirement");
  }
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
