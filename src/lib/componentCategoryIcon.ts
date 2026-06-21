import type { ComponentCardIndexRecord } from "./componentCardIndex";
import { resolveFittingComponentIcon } from "./fitting/resolveFittingComponentIcon";

// Maps a component record to its fallback icon filename (no extension).
// Icons live at /images/component-icons/<key>.webp
// Source: D:\scintel-icon-workbench

// Vehicle component type → icon key (non-weapon types)
const VEHICLE_TYPE_ICON: Record<string, string> = {
  powerplant:      "powerplant",
  cooler:          "cooler",
  shield:          "shield_generator",
  quantumdrive:    "quantum_drive",
  tractorbeam:     "tractor_beam",
  weaponMining:    "tractor_beam",
};

// Ship weapon: derive subtype from component name, then map to icon key
function shipWeaponIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("mass driver"))  return "railgun";
  if (n.includes("gatling"))      return "ballistic_repeater";
  if (n.includes("repeater"))     return "repeater";
  if (n.includes("scattergun"))   return "ballistic_repeater";
  if (n.includes("distortion"))   return "distortion_weapon";
  if (n.includes("turret"))       return "turret";
  if (n.includes("railgun"))      return "railgun";
  if (n.includes("cannon"))       return "ballistic_cannon";
  return "size_weapon_generic";
}

// FPS armor: slot + weight → icon key
function armorIcon(slot: string | null, weight: string | null): string {
  const s = slot ?? "";
  const w = weight ?? "";

  if (s === "undersuit") return "undersuit";

  const slotMap: Record<string, string> = {
    helmet: "helmet",
    torso: "torso",
    arms: "arms",
    legs: "legs",
  };
  const weightMap: Record<string, string> = {
    light: "light",
    medium: "medium",
    heavy: "heavy",
    // flight suits use armorWeight null — fall through to medium
  };

  const slotKey = slotMap[s];
  const weightKey = weightMap[w] ?? "medium";
  if (slotKey) return `${weightKey}_${slotKey}`;

  return "undersuit";
}

// FPS weapon class → icon key
const WEAPON_CLASS_ICON: Record<string, string> = {
  sniper: "sniper_rifle",
  rifle: "assault_rifle",  // assault_rifle covers generic rifles
  smg: "smg",
  pistol: "pistol",
  lmg: "lmg",
  shotgun: "repeater",    // no shotgun in required set — repeater is closest
};

export function getComponentCategoryIcon(record: ComponentCardIndexRecord): string | null {
  if (record.kind === "vehicle") {
    if (record.type === "weaponGun") return shipWeaponIcon(record.name);
    return VEHICLE_TYPE_ICON[record.type] ?? null;
  }

  if (record.kind === "fps") {
    if (record.type === "armor") {
      return armorIcon(record.facets.armorSlot ?? null, record.facets.armorWeight ?? null);
    }
    if (record.type === "weapons") {
      return WEAPON_CLASS_ICON[record.facets.weaponClass ?? ""] ?? "smg";
    }
  }

  return null;
}

export function getComponentCategoryIconUrl(record: ComponentCardIndexRecord): string | null {
  if (record.kind === "vehicle" && record.type === "quantumdrive") {
    return resolveFittingComponentIcon({
      componentType: "quantum_drive",
      componentName: record.name,
      size: record.size,
    }).src;
  }

  const key = getComponentCategoryIcon(record);
  return key ? `/images/component-icons/${key}.webp` : null;
}
