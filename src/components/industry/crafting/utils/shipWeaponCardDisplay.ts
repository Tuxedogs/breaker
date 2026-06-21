const SHIP_WEAPON_TYPE_SUFFIXES = ["Scattergun", "Gatling", "Repeater", "Cannon"] as const;

export type ShipWeaponTypeSuffix = (typeof SHIP_WEAPON_TYPE_SUFFIXES)[number];

export type ShipWeaponBadgeVariant =
  | "context"
  | "size"
  | "damage-physical"
  | "damage-energy"
  | "damage-distortion"
  | "damage-thermal"
  | "damage-biochemical"
  | "damage-stun"
  | "weapon-type";

export type ShipWeaponBrowseBadge = {
  label: string;
  variant: ShipWeaponBadgeVariant;
};

function titleCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function extractShipWeaponTypeBadge(name: string): ShipWeaponTypeSuffix | null {
  const trimmed = name.trim();
  for (const suffix of SHIP_WEAPON_TYPE_SUFFIXES) {
    if (new RegExp(`\\s${suffix}$`, "i").test(trimmed)) return suffix;
  }
  return null;
}

export function formatShipWeaponDamageTypeBadge(damageType: unknown): string | null {
  if (typeof damageType !== "string" || !damageType.trim()) return null;
  return titleCase(damageType.trim());
}

export function resolveShipWeaponDamageBadgeVariant(damageType: unknown): ShipWeaponBadgeVariant {
  const raw = typeof damageType === "string" ? damageType.trim().toLowerCase() : "";
  if (raw.includes("distortion")) return "damage-distortion";
  if (raw.includes("thermal")) return "damage-thermal";
  if (raw.includes("biochemical")) return "damage-biochemical";
  if (raw.includes("stun")) return "damage-stun";
  if (raw.includes("energy")) return "damage-energy";
  return "damage-physical";
}

export function getShipWeaponBadgeClassName(variant: ShipWeaponBadgeVariant): string {
  return `component-card-badge component-card-badge--${variant}`;
}

export function formatBrowseShipWeaponDisplayName(
  name: string,
  weaponTypeBadge: ShipWeaponTypeSuffix | null,
  damageTypeBadge: string | null,
): string {
  if (!weaponTypeBadge) return name;

  let display = name.trim().replace(new RegExp(`\\s+${weaponTypeBadge}$`, "i"), "").trim();
  if (!display) return name;

  const normalizedDamage = damageTypeBadge?.toLowerCase() ?? "";
  if (normalizedDamage === "physical" && /\bBallistic$/i.test(display)) {
    display = display.replace(/\s+Ballistic$/i, "").trim();
  }
  if (normalizedDamage === "energy" && /\bLaser$/i.test(display)) {
    display = display.replace(/\s+Laser$/i, "").trim();
  }

  return display || name;
}

export function buildShipWeaponBrowsePresentation(
  record: {
    name: string;
    kind: string;
    size: number | null;
  },
  damageType: unknown,
): { displayName: string; badges: ShipWeaponBrowseBadge[] } {
  const weaponTypeBadge = extractShipWeaponTypeBadge(record.name);
  const damageTypeBadge = formatShipWeaponDamageTypeBadge(damageType);
  const badges: ShipWeaponBrowseBadge[] = [];

  if (record.size !== null && record.size !== undefined) {
    badges.push({ label: `S${record.size}`, variant: "size" });
  }
  if (damageTypeBadge) {
    badges.push({
      label: damageTypeBadge,
      variant: resolveShipWeaponDamageBadgeVariant(damageType),
    });
  }
  if (weaponTypeBadge) {
    badges.push({ label: weaponTypeBadge, variant: "weapon-type" });
  }

  return {
    displayName: formatBrowseShipWeaponDisplayName(record.name, weaponTypeBadge, damageTypeBadge),
    badges,
  };
}