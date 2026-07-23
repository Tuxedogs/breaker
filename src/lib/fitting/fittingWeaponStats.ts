import type { FittingComponentStats } from "./fittingApi";
import { formatNumber } from "./fittingPortGrouping";

export type WeaponStatSlice = Pick<
  FittingComponentStats,
  "alphaDamage" | "fireRateRpm" | "dps" | "projectileSpeed"
>;

export type WeaponDpsResolution =
  | { dps: number; source: "extracted" }
  | { dps: number; source: "computed"; alphaDamage: number; fireRateRpm: number }
  | { dps: null; source: "unavailable"; missingFields: string[] };

function readFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Resolve per-weapon DPS from extracted value or alpha × RPM. */
export function resolveWeaponDps(stats: WeaponStatSlice | null | undefined): WeaponDpsResolution {
  if (!stats) {
    return { dps: null, source: "unavailable", missingFields: ["alphaDamage", "fireRateRpm"] };
  }

  const extracted = readFinite(stats.dps);
  if (extracted != null && extracted > 0) {
    return { dps: extracted, source: "extracted" };
  }

  const alpha = readFinite(stats.alphaDamage);
  const fireRateRpm = readFinite(stats.fireRateRpm);
  const missingFields: string[] = [];
  if (alpha == null || alpha <= 0) missingFields.push("alphaDamage");
  if (fireRateRpm == null || fireRateRpm <= 0) missingFields.push("fireRateRpm");

  if (missingFields.length > 0) {
    return { dps: null, source: "unavailable", missingFields };
  }

  return {
    dps: (alpha! * fireRateRpm!) / 60,
    source: "computed",
    alphaDamage: alpha!,
    fireRateRpm: fireRateRpm!,
  };
}

export function sumWeaponDps(
  statsList: Array<WeaponStatSlice | null | undefined>,
  quantities: number[] = [],
): number | null {
  let total = 0;
  let counted = 0;

  statsList.forEach((stats, index) => {
    const qty = quantities[index] ?? 1;
    const resolution = resolveWeaponDps(stats);
    if (resolution.dps == null) return;
    total += resolution.dps * qty;
    counted += qty;
  });

  return counted > 0 ? total : null;
}

export type AggregatedWeaponDisplay = {
  quantity: number;
  size: number | null;
  weaponName: string;
  mixedWeapons: boolean;
  dps: number | null;
  dpsUnavailableReason: string | null;
  projectileSpeed: number | null;
  mixedVelocity: boolean;
};

export function aggregateWeaponRowDisplay(input: {
  quantities: number[];
  sizes: Array<number | null>;
  names: string[];
  statsList: Array<WeaponStatSlice | null | undefined>;
}): AggregatedWeaponDisplay {
  const quantity = input.quantities.reduce((sum, value) => sum + value, 0);
  const uniqueNames = [...new Set(input.names.filter(Boolean))];
  const mixedWeapons = uniqueNames.length > 1;

  const weaponName = mixedWeapons
    ? "Mixed weapons"
    : (uniqueNames[0] ?? "Empty");

  const sizeValues = [...new Set(input.sizes.filter((value): value is number => value != null))];
  const size = sizeValues.length === 1 ? sizeValues[0]! : (sizeValues[0] ?? null);

  const dps = sumWeaponDps(input.statsList, input.quantities);
  const dpsUnavailableReason = dps == null
    ? describeMissingDpsFields(input.statsList)
    : null;

  const velocities = input.statsList
    .map((stats) => readFinite(stats?.projectileSpeed))
    .filter((value): value is number => value != null);
  const uniqueVelocities = [...new Set(velocities)];
  const mixedVelocity = uniqueVelocities.length > 1;
  const projectileSpeed = mixedVelocity ? null : (uniqueVelocities[0] ?? null);

  return {
    quantity,
    size,
    weaponName,
    mixedWeapons,
    dps,
    dpsUnavailableReason,
    projectileSpeed,
    mixedVelocity,
  };
}

function describeMissingDpsFields(statsList: Array<WeaponStatSlice | null | undefined>): string {
  const missing = new Set<string>();
  for (const stats of statsList) {
    const resolution = resolveWeaponDps(stats);
    if (resolution.dps != null) continue;
    if (resolution.source === "unavailable") {
      resolution.missingFields.forEach((field) => missing.add(field));
    }
  }
  if (missing.size === 0) return "DPS unavailable";
  return `Missing ${[...missing].join(", ")}`;
}

export function formatWeaponRailStats(display: AggregatedWeaponDisplay): string {
  const parts: string[] = [];
  if (display.dps != null) {
    parts.push(`${formatNumber(display.dps)} reference DPS`);
  }
  if (display.projectileSpeed != null) {
    parts.push(`${formatNumber(display.projectileSpeed)} m/s`);
  } else if (display.mixedVelocity) {
    parts.push("Mixed velocity");
  }
  return parts.join(" · ");
}

export function formatQuantitySizeName(display: AggregatedWeaponDisplay): string {
  const qty = `${display.quantity}x`;
  const size = display.size != null ? `S${display.size}` : null;
  if (size) return `${qty} ${size} ${display.weaponName}`;
  return `${qty} ${display.weaponName}`;
}
