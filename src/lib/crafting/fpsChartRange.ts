export type FpsChartRangeSource = "hard-range" | "class-window";

export type FpsChartRange = {
  value: number;
  label: "Hard Range" | "Chart Window";
  source: FpsChartRangeSource;
  weaponClass: string;
};

const PRESENTATION_WINDOWS_METERS: Readonly<Record<string, number>> = {
  shotgun: 50,
  smg: 100,
  pistol: 100,
  rifle: 250,
  lmg: 250,
  sniper: 500,
};

const CLASS_ALIASES: Readonly<Record<string, string>> = {
  ar: "rifle",
  assault: "rifle",
  assaultrifle: "rifle",
  autorifle: "rifle",
  handgun: "pistol",
  heavymachinegun: "lmg",
  lightmachinegun: "lmg",
  machinepistol: "pistol",
  marksman: "sniper",
  marksmanrifle: "sniper",
  precisionrifle: "sniper",
  scattergun: "shotgun",
  sniperrifle: "sniper",
  submachinegun: "smg",
};

function toPositiveNumber(value: unknown): number | undefined {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function normalizeFpsWeaponClass(value: unknown): string {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return CLASS_ALIASES[normalized] ?? normalized;
}

export function getFpsWeaponClass(stats: Record<string, unknown>): string {
  return normalizeFpsWeaponClass(
    stats.weaponClass ??
      stats.compatibleWeaponClass ??
      stats.itemClass ??
      stats.weaponType,
  );
}

/**
 * Selects a readable chart domain. Projectile lifetime travel is intentionally
 * excluded: it describes how far a projectile can exist, not useful weapon range.
 */
export function resolveFpsChartRange(stats: Record<string, unknown>): FpsChartRange | null {
  const hardRange = toPositiveNumber(stats.hardRange);
  const weaponClass = getFpsWeaponClass(stats);

  if (hardRange !== undefined) {
    return {
      value: hardRange,
      label: "Hard Range",
      source: "hard-range",
      weaponClass,
    };
  }

  const classWindow = PRESENTATION_WINDOWS_METERS[weaponClass];
  if (classWindow === undefined) return null;

  return {
    value: classWindow,
    label: "Chart Window",
    source: "class-window",
    weaponClass,
  };
}

export function getProjectileTravelDistance(stats: Record<string, unknown>): number | undefined {
  return (
    toPositiveNumber(stats.projectileLifetimeTravel) ??
    toPositiveNumber(stats.calculatedRange)
  );
}

