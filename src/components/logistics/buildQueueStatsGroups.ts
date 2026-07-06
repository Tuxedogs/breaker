import type { FittingComponentDetail, FittingComponentMitigation, DamageTypeMap } from "@/lib/fitting/fittingApi";

export type BuildQueueStatGroup = {
  id: string;
  label: string;
  rows: { label: string; value: string }[];
};

function readFinite(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: value >= 100 ? 0 : 2 }).format(value);
}

function formatCompact(value: number | null | undefined, suffix = ""): string | null {
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

function formatComponentType(detail: FittingComponentDetail): string {
  const base = titleCase(detail.type);
  return detail.subtype ? `${base} · ${titleCase(detail.subtype)}` : base;
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
  return parts.length > 0 ? parts.join("; ") : null;
}

function pushRow(rows: { label: string; value: string }[], label: string, value: string | null) {
  if (value) rows.push({ label, value });
}

function groupIfRows(id: string, label: string, rows: { label: string; value: string }[]): BuildQueueStatGroup | null {
  return rows.length > 0 ? { id, label, rows } : null;
}

function buildIdentityGroup(detail: FittingComponentDetail): BuildQueueStatGroup | null {
  const rows: { label: string; value: string }[] = [];
  pushRow(rows, "Component Type", formatComponentType(detail));
  pushRow(rows, "Display Name", detail.displayName?.trim() || null);
  if (detail.size !== null) pushRow(rows, "Size", `S${detail.size}`);
  pushRow(rows, "Grade", detail.grade);
  pushRow(rows, "Class", detail.class ? titleCase(detail.class) : null);
  pushRow(rows, "Manufacturer", detail.manufacturer);
  return groupIfRows("identity", "Identity", rows);
}

function buildPerformanceRows(
  detail: FittingComponentDetail,
  mitigation: FittingComponentMitigation | null,
): { label: string; value: string }[] {
  const { stats } = detail;
  const rows: { label: string; value: string }[] = [];

  if (detail.type === "ship_weapon") {
    pushRow(rows, "Alpha Damage", formatCompact(stats.alphaDamage));
    pushRow(rows, "Fire Rate", formatCompact(stats.fireRateRpm, " rpm"));
    pushRow(rows, "DPS", formatCompact(stats.dps));
    pushRow(rows, "Projectile Speed", formatCompact(stats.projectileSpeed, " m/s"));
    pushRow(rows, "Projectile Range", formatCompact(stats.calculatedRange, "m"));
    pushRow(rows, "Ammo Capacity", formatCompact(stats.ammoCapacity));
    pushRow(rows, "Physical Damage", formatCompact(stats.damagePhysical));
    pushRow(rows, "Energy Damage", formatCompact(stats.damageEnergy));
    pushRow(rows, "Distortion Damage", formatCompact(stats.damageDistortion));
    pushRow(rows, "Thermal Damage", formatCompact(stats.damageThermal));
    if (mitigation?.kind === "weapon_projectile") {
      pushRow(rows, "Penetration Distance", formatCompact(mitigation.basePenetrationDistance, "m"));
      pushRow(rows, "Ammo Penetration", formatCompact(mitigation.ammoPenetration));
    }
    return rows;
  }

  if (detail.type === "shield" && mitigation?.kind === "shield") {
    pushRow(rows, "Shield HP", formatCompact(stats.shieldHp ?? mitigation.shieldHp ?? mitigation.maxShieldHealth));
    pushRow(rows, "Regen Rate", formatCompact(stats.regenRate ?? mitigation.maxShieldRegen, "/s"));
    pushRow(rows, "Regen Delay", formatCompact(mitigation.damagedRegenDelay, "s"));
    pushRow(rows, "Physical Resistance", formatDamageTypeMap(mitigation.resistanceByDamageType));
    pushRow(rows, "Energy Absorption", formatDamageTypeMap(mitigation.absorptionByDamageType));
    return rows;
  }

  if (detail.type === "power_plant") {
    pushRow(rows, "Power Generation", formatCompact(stats.powerGenerated));
    return rows;
  }

  if (detail.type === "cooler") {
    pushRow(rows, "Coolant Generation", formatCompact(stats.coolingGenerated));
    return rows;
  }

  if (detail.type === "quantum_drive") {
    pushRow(rows, "Quantum Speed", formatCompact(stats.quantumSpeed));
    pushRow(rows, "Spool Time", formatCompact(stats.spoolTime, "s"));
    pushRow(rows, "Cooldown", formatCompact(stats.quantumCooldown, "s"));
    pushRow(rows, "Fuel Rate", formatCompact(stats.fuelRate));
    return rows;
  }

  if (detail.type === "radar") {
    pushRow(rows, "Detection Range", formatCompact(stats.detectionRange));
    pushRow(rows, "Scan Range", formatCompact(stats.scanRange));
    pushRow(rows, "Scan Rate", formatCompact(stats.scanRate));
    pushRow(rows, "Scan Cooldown", formatCompact(stats.scanCooldownTime, "s"));
    pushRow(rows, "Signature Sensitivity", formatCompact(stats.signatureSensitivity));
    return rows;
  }

  pushRow(rows, "Alpha Damage", formatCompact(stats.alphaDamage));
  pushRow(rows, "Thrust Capacity", formatCompact(stats.thrustCapacity));
  return rows;
}

function buildPowerCoolingGroup(detail: FittingComponentDetail): BuildQueueStatGroup | null {
  const { stats } = detail;
  const rows: { label: string; value: string }[] = [];
  pushRow(rows, "Power Draw", formatCompact(stats.powerDraw));
  pushRow(rows, "Power Generation", formatCompact(stats.powerGenerated));
  pushRow(rows, "Cooling Draw", formatCompact(stats.coolingDraw));
  pushRow(rows, "Coolant Generation", formatCompact(stats.coolingGenerated));
  pushRow(rows, "Heat Generation", formatCompact(stats.heatGenerated));
  return groupIfRows("power-cooling", "Power & Cooling", rows);
}

function buildSignaturesGroup(detail: FittingComponentDetail): BuildQueueStatGroup | null {
  const { stats } = detail;
  const rows: { label: string; value: string }[] = [];
  pushRow(rows, "EM Signature", formatCompact(stats.electromagneticEmission));
  pushRow(rows, "IR Signature", formatCompact(stats.infraredEmission));
  return groupIfRows("signatures", "Signatures", rows);
}

function buildDurabilityGroup(detail: FittingComponentDetail): BuildQueueStatGroup | null {
  const { stats, mitigation } = detail;
  const rows: { label: string; value: string }[] = [];
  pushRow(rows, "Component HP", formatCompact(stats.health));
  if (mitigation?.kind === "armor") {
    pushRow(rows, "Armor HP", formatCompact(mitigation.health));
  }
  pushRow(rows, "Mass", formatCompact(stats.mass));
  pushRow(rows, "Volume", formatCompact(stats.volume));
  return groupIfRows("durability", "Durability", rows);
}

export function buildBuildQueueFittingStatGroups(
  detail: FittingComponentDetail | null | undefined,
): BuildQueueStatGroup[] {
  if (!detail) return [];

  const groups: BuildQueueStatGroup[] = [];
  const identity = buildIdentityGroup(detail);
  if (identity) groups.push(identity);

  const performance = groupIfRows(
    "performance",
    "Performance",
    buildPerformanceRows(detail, detail.mitigation),
  );
  if (performance) groups.push(performance);

  const powerCooling = buildPowerCoolingGroup(detail);
  if (powerCooling) groups.push(powerCooling);

  const signatures = buildSignaturesGroup(detail);
  if (signatures) groups.push(signatures);

  const durability = buildDurabilityGroup(detail);
  if (durability) groups.push(durability);

  return groups;
}
