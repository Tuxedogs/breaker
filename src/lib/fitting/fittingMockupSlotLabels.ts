import type { PortBreakdownRow, SummarizedRow } from "./fittingPortGrouping";

type SlotRole =
  | "weapon_hardpoint"
  | "gimbal_mount"
  | "missile_rack"
  | "bomb_rack"
  | "payload_rack"
  | "shield"
  | "power"
  | "cooler"
  | "radar"
  | "quantum_drive"
  | "unknown_weapon"
  | "unknown_component";

type PositionHints = {
  side?: "left" | "right";
  depth?: "inner" | "outer";
  index?: number;
};

const INTERNAL_PORT_NAME_RE =
  /^(hardpoint_class_\d+|hardpoint_class\d+|missile_\d+_attach|hardpoint_jump_drive|undefined)$/i;

const INTERNAL_SNAKE_CASE_RE = /^(hardpoint|hardpoint_)[a-z0-9_]+$/i;

function normalizePath(value: string): string {
  return value.trim().toLowerCase().replace(/\\/g, "/");
}

function portPathParts(portId: string): string[] {
  return normalizePath(portId).split("/").filter(Boolean);
}

function isInternalSegment(segment: string): boolean {
  const value = segment.trim().toLowerCase();
  if (!value) return true;
  if (INTERNAL_PORT_NAME_RE.test(value)) return true;
  if (/^missile_\d+_attach$/.test(value)) return true;
  return false;
}

function isDisplayablePortName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  if (INTERNAL_PORT_NAME_RE.test(lower)) return false;
  if (INTERNAL_SNAKE_CASE_RE.test(trimmed)) return false;
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(lower)) return false;
  if (/^(weapongun|powerplant|missilelauncher|shield|cooler|radar|turret|missile)$/i.test(trimmed)) {
    return false;
  }
  return true;
}

function identityPath(portId: string): string {
  const parts = portPathParts(portId).filter((segment) => !isInternalSegment(segment));
  return parts.join("/") || normalizePath(portId);
}

function extractPositionHints(path: string): PositionHints {
  const hints: PositionHints = {};
  if (/\bleft\b/.test(path)) hints.side = "left";
  if (/\bright\b/.test(path)) hints.side = "right";
  if (/\binner\b/.test(path)) hints.depth = "inner";
  if (/\bouter\b/.test(path)) hints.depth = "outer";

  const numbered = path.match(/(?:^|\/|_)(\d+)(?:$|\/|_)/);
  if (numbered) hints.index = Number(numbered[1]);

  return hints;
}

function sideNumber(hints: PositionHints): number | null {
  if (hints.index != null) return hints.index;
  if (hints.side === "left") return 1;
  if (hints.side === "right") return 2;
  return null;
}

function labelFromAuthoredPath(path: string): string | null {
  if (/gun_nose|weapon_class2_nose|weapon_nose|nose_gun/.test(path)) return "Nose Gun";
  if (/gun_left_wing|weapon_gun_class1_left_wing|weapon_left_wing|hardpoint_weapon_left/.test(path) && !/missile/.test(path)) {
    return "Wing Gimbal L";
  }
  if (/gun_right_wing|weapon_gun_class1_right_wing|weapon_right_wing|hardpoint_weapon_right/.test(path) && !/missile/.test(path)) {
    return "Wing Gimbal R";
  }
  if (/gun_left(?!_wing)|turret_left|hardpoint_gun_left(?!_wing)/.test(path) && !/missile/.test(path)) {
    return "Gimbal Mount L";
  }
  if (/gun_right(?!_wing)|turret_right|hardpoint_gun_right(?!_wing)/.test(path) && !/missile/.test(path)) {
    return "Gimbal Mount R";
  }
  if (/missilerack_left.*inner|missile_rack_left.*inner/.test(path)) return "Left Rack (Inner)";
  if (/missilerack_left.*outer|missile_rack_left.*outer/.test(path)) return "Left Rack (Outer)";
  if (/missilerack_right.*inner|missile_rack_right.*inner/.test(path)) return "Right Rack (Inner)";
  if (/missilerack_right.*outer|missile_rack_right.*outer/.test(path)) return "Right Rack (Outer)";
  if (/missilerack_left|missile_rack_left|left.*rack/.test(path)) return "Left Rack";
  if (/missilerack_right|missile_rack_right|right.*rack/.test(path)) return "Right Rack";
  if (/bomb.*rack|rack.*bomb/.test(path)) return "Bomb Rack";
  if (/payload.*rack|rack.*payload/.test(path)) return "Payload Rack";
  if (/hardpoint_radar|\/radar$/.test(path)) return "Radar";
  if (/hardpoint_power_plant|power_plant/.test(path)) return "Power Plant";
  if (/hardpoint_quantum_drive/.test(path) && !/jump_drive/.test(path)) return "Quantum Drive";
  if (/shield_generator_left|shield_left/.test(path)) return "Shield Generator 1";
  if (/shield_generator_right|shield_right/.test(path)) return "Shield Generator 2";
  if (/shield_generator_1|shield_1/.test(path)) return "Shield Generator 1";
  if (/shield_generator_2|shield_2/.test(path)) return "Shield Generator 2";
  if (/cooler_left|hardpoint_cooler_left/.test(path)) return "Cooler 1";
  if (/cooler_right|hardpoint_cooler_right/.test(path)) return "Cooler 2";
  if (/cooler_1|cooler1/.test(path)) return "Cooler 1";
  if (/cooler_2|cooler2/.test(path)) return "Cooler 2";
  if (/shield_generator/.test(path)) return "Shield Generator";
  if (/cooler/.test(path)) return "Cooler";
  return null;
}

function isWeaponishRow(row: PortBreakdownRow): boolean {
  const category = (row.ruleCategory ?? row.portCategory ?? row.componentCategory ?? "").toLowerCase();
  const portType = (row.portType ?? "").toLowerCase();
  return category === "weapon"
    || category === "missile"
    || category === "turret"
    || row.componentCategory === "ship_weapon"
    || portType.includes("weapon")
    || portType.includes("missile")
    || portType.includes("turret");
}

function resolveSlotRole(row: PortBreakdownRow, path: string): SlotRole {
  const portType = (row.portType ?? "").toLowerCase();
  const portSubtype = (row.portSubtype ?? "").toLowerCase();
  const category = (row.ruleCategory ?? row.portCategory ?? "").toLowerCase();

  if (portType === "missile" || portSubtype === "missile") {
    return path.includes("rack") || path.includes("missilerack") ? "missile_rack" : "missile_rack";
  }
  if (portType === "missilelauncher" || portSubtype === "missilerack" || /missilerack|missile_rack/.test(path)) {
    return "missile_rack";
  }
  if (/bomb/.test(path) || portSubtype.includes("bomb")) return "bomb_rack";
  if (/payload/.test(path)) return "payload_rack";
  if (portType === "shield" || category === "shield") return "shield";
  if (portType === "powerplant" || category === "power") return "power";
  if (portType === "cooler" || category === "cooler") return "cooler";
  if (portType === "radar" || category === "radar") return "radar";
  if (portType === "quantumdrive" || category === "quantum") return "quantum_drive";

  if (portType === "weapongun" || category === "weapon" || row.componentCategory === "ship_weapon") {
    if (/gimbal|gun_left|gun_right|turret|wing/.test(path)) return "gimbal_mount";
    return "weapon_hardpoint";
  }

  return isWeaponishRow(row) ? "unknown_weapon" : "unknown_component";
}

function formatNumberedLabel(base: string, hints: PositionHints): string {
  const number = sideNumber(hints);
  return number != null ? `${base} ${number}` : base;
}

function formatPositionLabel(base: string, hints: PositionHints): string {
  const parts = [base];
  if (hints.depth === "inner") parts.push("(Inner)");
  if (hints.depth === "outer") parts.push("(Outer)");
  if (hints.side === "left" && !base.includes(" L") && !base.includes("Left")) parts.push("L");
  if (hints.side === "right" && !base.includes(" R") && !base.includes("Right")) parts.push("R");
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function labelFromRole(role: SlotRole, hints: PositionHints): string {
  switch (role) {
    case "weapon_hardpoint":
      return formatPositionLabel("Weapon Hardpoint", hints);
    case "gimbal_mount":
      return formatPositionLabel("Gimbal Mount", hints);
    case "missile_rack":
      return formatPositionLabel("Missile Rack", hints);
    case "bomb_rack":
      return formatPositionLabel("Bomb Rack", hints);
    case "payload_rack":
      return formatPositionLabel("Payload Rack", hints);
    case "shield":
      return formatNumberedLabel("Shield Generator", hints);
    case "power":
      return formatNumberedLabel("Power Plant", hints);
    case "cooler":
      return formatNumberedLabel("Cooler", hints);
    case "radar":
      return "Radar";
    case "quantum_drive":
      return "Quantum Drive";
    case "unknown_weapon":
      return "Unknown Weapon Slot";
    case "unknown_component":
      return "Unknown Component Slot";
  }
}

export function mockupTurretGroupLabel(summary: SummarizedRow): string {
  return summary.turretLabel ?? summary.name;
}

export function mockupSlotDisplayLabel(row: PortBreakdownRow): string {
  if (isDisplayablePortName(row.portName)) {
    return row.portName!.trim();
  }

  const path = identityPath(row.portId);
  const authored = labelFromAuthoredPath(path);
  if (authored) return authored;

  const hints = extractPositionHints(path);
  const role = resolveSlotRole(row, path);
  return labelFromRole(role, hints);
}
