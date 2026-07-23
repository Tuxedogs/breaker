import type {
  FittingComponentSummary as ApiFittingComponentSummary,
  FittingHardpoint,
  FittingLoadoutEntry,
  FittingShipMitigation,
  FittingShipDetail as ApiFittingShipDetail,
  FittingShipSummary as ApiFittingShipSummary,
} from "./fittingApi";

export type FittingShipSummary = {
  shipKey: string;
  name: string;
  manufacturer: string | null;
  role: string | null;
  career: string | null;
  movementClass: string | null;
  crewSize: number | null;
  maxSpeed?: number | null;
  boostSpeedForward?: number | null;
  pitchRate?: number | null;
  yawRate?: number | null;
  rollRate?: number | null;
  scmSpeed?: number | null;
  boostCapacity?: number | null;
  boostRegen?: number | null;
  cargoCapacityScu?: number | null;
};

export type FittingShipDetail = {
  ship?: FittingShipSummary;
  hullHP?: number | null;
  mitigation?: FittingShipMitigation | null;
  confidence?: string;
  warnings?: string[];
};

export type PortBreakdownRow = {
  shipKey: string;
  portId: string;
  portName: string | null;
  portType: string | null;
  portSubtype: string | null;
  portCategory: string | null;
  ruleCategory: string | null;
  parentPortId: string | null;
  childPortIds: string[];
  equippedComponentKey: string | null;
  equippedComponentName: string | null;
  componentCategory: string | null;
  componentManufacturer: string | null;
  componentSize: number | null;
  portExactSize: number | null;
  portMinSize: number | null;
  portMaxSize: number | null;
  componentSubtype: string | null;
  compatibilityStatus: string | null;
  editable: boolean;
  bespoke: boolean;
  locked: boolean;
  warnings: string[];
  confidence: string | null;
};

export type FittingComponentRecord = {
  componentKey: string;
  displayName: string | null;
  category: string | null;
  type: string | null;
  subtype: string | null;
  manufacturer: string | null;
  size?: number | null;
  mass: number | null;
  health: number | null;
  confidence?: unknown;
};

export type NamedGroup = {
  key: string;
  label: string;
  rows: PortBreakdownRow[];
};

export const offensiveGroupDefs = [
  { key: "pilot-weapons", label: "Pilot Weapons" },
  { key: "rockets", label: "Rockets" },
  { key: "remote-turrets", label: "Remote Turrets" },
  { key: "manned-turrets", label: "Manned Turrets" },
  { key: "point-defense", label: "Point Defense" },
  { key: "installed-weapons", label: "Installed Weapons" },
  { key: "missiles", label: "Missiles" },
  { key: "torpedoes", label: "Torpedoes" },
  { key: "bombs", label: "Bombs" },
  { key: "emp-qed", label: "EMP / QED" },
  { key: "tractor-mining-salvage", label: "Tractor / Mining / Salvage" },
] as const;

export const defensiveGroupDefs = [
  { key: "shields", label: "Shields" },
  { key: "power", label: "Power Plants" },
  { key: "coolers", label: "Coolers" },
  { key: "quantum-drives", label: "Quantum Drives" },
  { key: "quantum-fuel-tanks", label: "Quantum Fuel Tanks" },
  { key: "radar", label: "Radar" },
  { key: "computers", label: "Computers" },
  { key: "utility", label: "Utility Systems" },
  { key: "armor", label: "Armor" },
  { key: "hull", label: "Hull" },
] as const;

export function adaptShipSummary(ship: ApiFittingShipSummary): FittingShipSummary {
  return {
    shipKey: ship.id,
    name: ship.displayName || ship.name,
    manufacturer: ship.manufacturer,
    role: ship.role,
    career: ship.career,
    movementClass: ship.vehicleType,
    crewSize: ship.crew.max ?? ship.crew.min,
    cargoCapacityScu: ship.cargoCapacityScu,
  };
}

export function adaptShipDetail(ship: ApiFittingShipDetail): FittingShipDetail {
  return {
    ship: {
      ...adaptShipSummary(ship),
      maxSpeed: ship.performance.maxSpeed,
      scmSpeed: ship.performance.scmSpeed,
      boostSpeedForward: ship.performance.boostSpeedForward,
      pitchRate: ship.performance.pitchRate,
      yawRate: ship.performance.yawRate,
      rollRate: ship.performance.rollRate,
      boostCapacity: ship.performance.boostCapacity,
      boostRegen: ship.performance.boostRegen,
    },
    hullHP: ship.hullHP,
    mitigation: ship.mitigation ?? null,
    confidence: ship.confidence,
    warnings: [],
  };
}

export function adaptComponent(component: ApiFittingComponentSummary): FittingComponentRecord {
  return {
    componentKey: component.id,
    displayName: component.displayName || component.name,
    category: component.type,
    type: component.subtype,
    subtype: component.subtype,
    manufacturer: component.manufacturer,
    size: component.size,
    mass: null,
    health: null,
    confidence: component.confidence,
  };
}

function portCategory(port: FittingHardpoint): string {
  const value = `${port.type} ${port.subtype ?? ""} ${port.name}`.toLowerCase();
  if (value.includes("missile") || value.includes("torpedo") || value.includes("bomb")) return "missile";
  if (value.includes("turret")) return "turret";
  if (value.includes("weapon") || value.includes("gun")) return "weapon";
  if (value.includes("power")) return "power";
  if (value.includes("thruster")) return "thruster";
  if (value.includes("shield")) return "shield";
  if (value.includes("cooler") || value.includes("cooling")) return "cooler";
  if (value.includes("quantum")) return "quantum";
  if (value.includes("radar") || value.includes("scanner")) return "radar";
  if (value.includes("armor")) return "armor";
  if (value.includes("fuel")) return "fuel";
  if (value.includes("computer") || value.includes("cpu")) return "computer";
  if (value.includes("hull")) return "hull";
  return port.type.toLowerCase();
}

function loadoutStatus(entry: FittingLoadoutEntry | undefined, port: FittingHardpoint): string {
  if (port.locked || entry?.status === "locked") return "locked";
  if (entry?.status === "resolved") return "compatible";
  return entry?.status ?? port.compatibilityStatus ?? "unknown";
}

export function adaptLoadout(
  shipKey: string,
  ports: FittingHardpoint[],
  entries: FittingLoadoutEntry[],
): { portBreakdown: PortBreakdownRow[]; loadoutMap: Record<string, string | null>; confidence: string } {
  const entriesByPort = new Map(entries.map((entry) => [entry.portId, entry]));
  const childIds = new Map<string, string[]>();
  for (const port of ports) {
    if (port.parentId) childIds.set(port.parentId, [...(childIds.get(port.parentId) ?? []), port.id]);
  }
  const loadoutMap: Record<string, string | null> = {};
  const portBreakdown = ports.map((port): PortBreakdownRow => {
    const entry = entriesByPort.get(port.id);
    const componentId = entry?.componentId ?? port.defaultComponentId ?? null;
    loadoutMap[port.id] = componentId;
    return {
      shipKey,
      portId: port.id,
      portName: port.name,
      portType: port.type ?? null,
      portSubtype: port.subtype ?? null,
      portCategory: portCategory(port),
      ruleCategory: portCategory(port),
      parentPortId: port.parentId,
      childPortIds: childIds.get(port.id) ?? [],
      equippedComponentKey: componentId,
      equippedComponentName: null,
      componentCategory: null,
      componentManufacturer: null,
      componentSize: port.size?.exact ?? port.size?.max ?? port.size?.min ?? null,
      portExactSize: port.size?.exact ?? null,
      portMinSize: port.size?.min ?? null,
      portMaxSize: port.size?.max ?? null,
      componentSubtype: port.subtype,
      compatibilityStatus: loadoutStatus(entry, port),
      editable: port.editable,
      bespoke: port.bespoke,
      locked: port.locked,
      warnings: entry?.status === "unresolved" ? ["Default component unresolved"] : [],
      confidence: entry?.confidence ?? port.confidence,
    };
  });
  return {
    portBreakdown,
    loadoutMap,
    confidence: entries.every((entry) => entry.confidence === "high") ? "high" : "medium",
  };
}

export function enrichPortRows(
  portBreakdown: PortBreakdownRow[],
  componentLookup: Map<string, FittingComponentRecord>,
): PortBreakdownRow[] {
  return portBreakdown.map((row) => {
    const component = row.equippedComponentKey ? componentLookup.get(row.equippedComponentKey) : undefined;
    if (!component) return row;
    return {
      ...row,
      equippedComponentName: component.displayName,
      componentCategory: component.category,
      componentManufacturer: component.manufacturer,
      componentSize: component.size ?? row.componentSize,
      componentSubtype: component.subtype ?? component.type,
    };
  });
}

export function portShortLabel(row: PortBreakdownRow): string {
  if (row.portName && row.portName.trim().length > 0) return row.portName.trim();
  const tail = row.portId.split("/").pop() ?? row.portId;
  return tail.replace(/_/g, " ");
}

export function inferDamageType(stats: Record<string, number | null | undefined>): string | null {
  const candidates = [
    { label: "Energy", value: stats.damageEnergy },
    { label: "Physical", value: stats.damagePhysical },
    { label: "Thermal", value: stats.damageThermal },
    { label: "Distortion", value: stats.damageDistortion },
    { label: "Biochemical", value: stats.damageBiochemical },
    { label: "Stun", value: stats.damageStun },
  ].filter((entry) => typeof entry.value === "number" && Number.isFinite(entry.value) && entry.value > 0);

  if (candidates.length === 0) return null;
  const primary = candidates.reduce((best, entry) => (entry.value! > best.value! ? entry : best));
  if (candidates.length === 1) return primary.label;
  return `${primary.label} (+mixed)`;
}

export function aggregateDamageAlpha(
  statsList: Array<Record<string, number | null | undefined>>,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const stats of statsList) {
    const alpha = stats.alphaDamage;
    if (typeof alpha !== "number" || !Number.isFinite(alpha) || alpha <= 0) continue;
    const type = inferDamageType(stats) ?? "Unknown";
    totals[type] = (totals[type] ?? 0) + alpha;
  }
  return totals;
}

export function formatNumber(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not calculated yet";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "");
}

export function formatSigned(value: unknown, unit = ""): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not calculated yet";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}${unit}`;
}

export function categoryLabel(value: string | null | undefined): string {
  if (!value) return "Other";
  return value.replace(/[_/]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function rowText(row: PortBreakdownRow): string {
  return [
    row.portId,
    row.portName,
    row.portCategory,
    row.ruleCategory,
    row.componentCategory,
    row.componentSubtype,
    row.equippedComponentName,
  ].filter(Boolean).join(" ").toLowerCase();
}

export function isControllerRow(row: PortBreakdownRow): boolean {
  const text = rowText(row);
  const item = row.equippedComponentName?.trim().toLowerCase();
  return text.includes("controller") || item === "weapons" || item === "missiles";
}

export function isEquippedWeaponRow(row: PortBreakdownRow): boolean {
  if (isControllerRow(row)) return false;
  return row.componentCategory === "ship_weapon" && Boolean(row.equippedComponentName ?? row.equippedComponentKey);
}

function isRocketWeaponRow(row: PortBreakdownRow): boolean {
  return isEquippedWeaponRow(row)
    && row.componentSubtype?.trim().toLowerCase() === "rocket";
}

export function isMissileItemRow(row: PortBreakdownRow): boolean {
  if (isControllerRow(row)) return false;
  const category = row.ruleCategory ?? row.portCategory;
  return category === "missile" && Boolean(row.parentPortId) && Boolean(row.equippedComponentName ?? row.equippedComponentKey);
}

function isTorpedoRow(row: PortBreakdownRow): boolean {
  const text = rowText(row);
  return text.includes("torpedo");
}

function isBombRow(row: PortBreakdownRow): boolean {
  const text = rowText(row);
  return row.componentCategory === "bomb" || (text.includes("bomb") && !text.includes("rack"));
}

function isMissileOnlyRow(row: PortBreakdownRow): boolean {
  const text = rowText(row);
  const category = row.ruleCategory ?? row.portCategory ?? "";
  if (text.includes("missile rack")) return false;
  if (isTorpedoRow(row) || isBombRow(row)) return false;
  return category === "missile" || (text.includes("missile") && Boolean(row.equippedComponentKey));
}

function getPortChain(row: PortBreakdownRow, lookup: Map<string, PortBreakdownRow>): PortBreakdownRow[] {
  const chain: PortBreakdownRow[] = [row];
  let parentId = row.parentPortId;
  while (parentId) {
    const parent = lookup.get(parentId);
    if (!parent) break;
    chain.push(parent);
    parentId = parent.parentPortId;
  }
  return chain;
}

function chainText(chain: PortBreakdownRow[]): string {
  return chain.map((entry) => rowText(entry)).join(" ");
}

function hardpointIdentityText(row: PortBreakdownRow): string {
  return `${row.portId} ${row.portName ?? ""}`.toLowerCase();
}

function normalizedPortType(row: PortBreakdownRow): string {
  return (row.portType ?? "").trim().toLowerCase();
}

function normalizedPortSubtype(row: PortBreakdownRow): string {
  return (row.portSubtype ?? "").trim().toLowerCase();
}

function isPilotWeaponPort(row: PortBreakdownRow): boolean {
  return /hardpoint_gun_/.test(hardpointIdentityText(row));
}

function isTurretWeaponSlot(row: PortBreakdownRow): boolean {
  const tail = row.portId.split("/").pop() ?? "";
  return tail === "turret_left"
    || tail === "turret_right"
    || tail === "hardpoint_weapon_left"
    || tail === "hardpoint_weapon_right";
}

function isTurretRootPort(row: PortBreakdownRow): boolean {
  if (isPilotWeaponPort(row) || isTurretWeaponSlot(row)) return false;

  const portType = normalizedPortType(row);
  const portSubtype = normalizedPortSubtype(row);
  const identity = hardpointIdentityText(row);

  if (portType === "turretbase" || portSubtype === "mannedturret") return true;

  if (portType === "turret" && portSubtype === "gunturret") {
    if (identity.includes("pdc") || identity.includes("camera")) return false;
    return identity.includes("turret");
  }

  return false;
}

function findTurretRoot(row: PortBreakdownRow, lookup: Map<string, PortBreakdownRow>): PortBreakdownRow | null {
  const chain = getPortChain(row, lookup);
  let root: PortBreakdownRow | null = null;
  for (const entry of chain) {
    if (isTurretRootPort(entry)) root = entry;
  }
  if (root) return root;

  let parentId = row.parentPortId;
  const visited = new Set<string>([row.portId]);
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const synthetic: PortBreakdownRow = lookup.get(parentId) ?? {
      ...row,
      portId: parentId,
      portName: null,
      parentPortId: parentId.includes("/") ? parentId.split("/").slice(0, -1).join("/") : null,
    };
    if (isTurretRootPort(synthetic)) return synthetic;
    parentId = synthetic.parentPortId;
  }

  return null;
}

function turretGroupKeyForRoot(root: PortBreakdownRow): "remote-turrets" | "manned-turrets" | null {
  const portType = normalizedPortType(root);
  const portSubtype = normalizedPortSubtype(root);
  const identity = hardpointIdentityText(root);
  const text = rowText(root);

  if (portSubtype === "mannedturret" || portType === "turretbase") return "manned-turrets";
  if (portType === "turret" && portSubtype === "gunturret") return "remote-turrets";
  if (text.includes("ai_turret") || identity.includes("ai_turret")) return "remote-turrets";
  if (identity.includes("remote") && identity.includes("turret")) return "remote-turrets";
  if (identity.includes("manned") && identity.includes("turret")) return "manned-turrets";

  return null;
}

function isPilotWeaponChain(row: PortBreakdownRow, lookup: Map<string, PortBreakdownRow>): boolean {
  const chain = getPortChain(row, lookup);
  if (chain.some(isPilotWeaponPort)) return true;

  const combined = chainText(chain);
  return combined.includes("hardpoint_gun")
    || combined.includes("/gun_")
    || combined.includes("_gun_")
    || combined.includes("nose")
    || combined.includes("wing")
    || combined.includes("chin");
}

function isPointDefenseChain(row: PortBreakdownRow, lookup: Map<string, PortBreakdownRow>): boolean {
  return getPortChain(row, lookup).some((entry) => {
    const subtype = normalizedPortSubtype(entry);
    const identity = `${hardpointIdentityText(entry)} ${rowText(entry)}`;
    return subtype === "pdcturret" || identity.includes("pdc") || identity.includes("point defense");
  });
}

export function offensiveGroupKey(row: PortBreakdownRow, lookup: Map<string, PortBreakdownRow>): string | null {
  if (isControllerRow(row)) return null;
  if (!row.equippedComponentKey && !row.equippedComponentName) return null;

  const text = rowText(row);

  if (text.includes("qed") || text.includes("qid") || text.includes("emp")) return "emp-qed";
  if (text.includes("tractor") || text.includes("mining") || text.includes("salvage")) return "tractor-mining-salvage";
  if (isBombRow(row)) return "bombs";
  if (isTorpedoRow(row)) return "torpedoes";
  if (isRocketWeaponRow(row)) return "rockets";
  if (isMissileOnlyRow(row) || isMissileItemRow(row)) return "missiles";

  if (isEquippedWeaponRow(row)) {
    const chain = getPortChain(row, lookup);
    const combined = chainText(chain);

    if (isPointDefenseChain(row, lookup)) return "point-defense";

    const turretRoot = findTurretRoot(row, lookup);
    if (turretRoot) {
      const turretGroup = turretGroupKeyForRoot(turretRoot);
      if (turretGroup) return turretGroup;
    }

    if (isPilotWeaponChain(row, lookup)) return "pilot-weapons";

    if (combined.includes("gimbal") || combined.includes("mount") || combined.includes("weapon rack")) {
      return "installed-weapons";
    }

    return "pilot-weapons";
  }

  return null;
}

export function defensiveGroupKey(row: PortBreakdownRow, lookup: Map<string, PortBreakdownRow>): string | null {
  const text = rowText(row);
  const category = row.ruleCategory ?? row.portCategory ?? "";
  if (!row.equippedComponentKey && !row.equippedComponentName) return null;
  if (offensiveGroupKey(row, lookup)) return null;

  if (category === "shield" || text.includes("shield")) return "shields";
  if (category === "power" || text.includes("power plant")) return "power";
  if (category === "cooler" || text.includes("cooler")) return "coolers";
  if (category === "quantum" && (text.includes("fuel") || text.includes("tank"))) return "quantum-fuel-tanks";
  if (category === "quantum" || text.includes("quantum drive")) return "quantum-drives";
  if (category === "radar" || text.includes("scanner") || text.includes("radar")) return "radar";
  if (category === "computer" || text.includes("computer")) return "computers";
  if (category === "armor" || text.includes("armor")) return "armor";
  if (category === "hull" || text.includes("hull reinforcement") || text.includes("hull")) return "hull";
  if (text.includes("fuel tank") || text.includes("internal tank")) return "quantum-fuel-tanks";
  if (category === "thruster" || text.includes("thruster") || text.includes("utility")) return "utility";
  return null;
}

export function buildGroups(
  defs: ReadonlyArray<{ key: string; label: string }>,
  rows: PortBreakdownRow[],
  pickKey: (row: PortBreakdownRow) => string | null,
): NamedGroup[] {
  const groups = new Map(defs.map((def) => [def.key, { ...def, rows: [] as PortBreakdownRow[] }]));
  for (const row of rows) {
    const key = pickKey(row);
    const group = key ? groups.get(key) : null;
    if (group) group.rows.push(row);
  }
  return defs
    .map((def) => groups.get(def.key))
    .filter((group): group is NamedGroup => Boolean(group && (group.rows.length > 0 || true)));
}

export function buildOffensiveGroups(rows: PortBreakdownRow[]): NamedGroup[] {
  const lookup = new Map(rows.map((row) => [row.portId, row]));
  return buildGroups(offensiveGroupDefs, rows, (row) => offensiveGroupKey(row, lookup));
}

export function buildDefensiveGroups(rows: PortBreakdownRow[]): NamedGroup[] {
  const lookup = new Map(rows.map((row) => [row.portId, row]));
  return buildGroups(defensiveGroupDefs, rows, (row) => defensiveGroupKey(row, lookup));
}

const TURRET_WEAPON_GROUP_KEYS = new Set(["remote-turrets", "manned-turrets"]);
const INDIVIDUAL_ROW_GROUP_KEYS = new Set([
  ...defensiveGroupDefs.map((def) => def.key),
  "pilot-weapons",
  "rockets",
  "installed-weapons",
  "point-defense",
  "missiles",
  "torpedoes",
  "bombs",
  "emp-qed",
  "tractor-mining-salvage",
]);

export type SummarizedRow = {
  key: string;
  portIds: string[];
  quantity: number;
  size: number | null;
  name: string;
  type: string | null;
  manufacturer: string | null;
  controlMode: string | null;
  confidenceNote: string | null;
  turretLabel: string | null;
  rows: PortBreakdownRow[];
};

export function inferControlMode(row: PortBreakdownRow): string | null {
  if (row.locked) return "Locked";
  if (row.bespoke) return "Bespoke";
  if (!row.editable) return "Slaved";
  const text = rowText(row);
  if (text.includes("remote")) return "Remote";
  if (text.includes("manned")) return "Manned";
  return null;
}

function toSummarizedRow(row: PortBreakdownRow, groupKey?: string): SummarizedRow {
  return {
    key: row.portId,
    portIds: [row.portId],
    quantity: 1,
    size: row.componentSize,
    name: row.equippedComponentName ?? row.portName ?? row.portId,
    type: row.componentSubtype ?? categoryLabel(row.componentCategory ?? row.ruleCategory),
    manufacturer: row.componentManufacturer,
    controlMode: inferControlMode(row),
    confidenceNote: groupKey === "installed-weapons" ? "Classification uncertain" : null,
    turretLabel: null,
    rows: [row],
  };
}

function turretKindLabel(groupKey: string): string {
  if (groupKey === "remote-turrets") return "Remote Turret";
  if (groupKey === "manned-turrets") return "Manned Turret";
  return "Weapon Turret";
}

function turretRootSegment(portId: string): string {
  const topLevel = portId.split("/")[0] ?? portId;
  return topLevel.replace(/^hardpoint_turret_/, "").toLowerCase();
}

export function deriveTurretPositionPhrase(portId: string): string | null {
  const segment = turretRootSegment(portId);
  if (!segment) return null;

  const parts: string[] = [];
  if (/^back|^rear/.test(segment)) parts.push("Rear");
  else if (/^front/.test(segment)) parts.push("Front");
  else if (/nose/.test(segment)) parts.push("Nose");

  if (/topleft|top_left/.test(segment)) parts.push("Top Left");
  else if (/topright|top_right/.test(segment)) parts.push("Top Right");
  else if (/top/.test(segment)) parts.push("Top");
  else if (/bottom/.test(segment)) parts.push("Bottom");

  if (parts.length === 0) {
    if (/left/.test(segment) && !segment.includes("turret_left")) parts.push("Left");
    if (/right/.test(segment) && !segment.includes("turret_right")) parts.push("Right");
  }

  if (parts.length === 0) return null;
  if (parts[0] === "Rear" && parts.length === 2) return parts[1]!;
  return parts.join(" ");
}

export function deriveTurretDisplayLabel(
  rootPortId: string,
  groupKey: string,
  index: number,
): string {
  const kind = turretKindLabel(groupKey);
  const position = deriveTurretPositionPhrase(rootPortId);
  if (position) return `${position} ${kind}`;
  return `${kind} ${index}`;
}

export function resolveTurretPortId(row: PortBreakdownRow, lookup: Map<string, PortBreakdownRow>): string {
  const root = findTurretRoot(row, lookup);
  if (root) return root.portId;
  return row.parentPortId ?? row.portId;
}

/** Stable key for grouping weapon ports with equivalent compatibility rules. */
export function portCompatibilitySignature(row: PortBreakdownRow): string {
  return [
    row.portExactSize ?? "",
    row.portMinSize ?? "",
    row.portMaxSize ?? "",
    row.componentSize ?? "",
    row.portType ?? "",
    row.portSubtype ?? "",
    row.portCategory ?? "",
    row.ruleCategory ?? "",
    row.editable ? "1" : "0",
    row.locked ? "1" : "0",
    row.bespoke ? "1" : "0",
    row.equippedComponentKey ?? "",
    row.compatibilityStatus ?? "",
  ].join("|");
}

function summarizeEquivalentPortRows(
  key: string,
  groupRows: PortBreakdownRow[],
  options: {
    groupKey?: string;
    turretLabel?: string | null;
  } = {},
): SummarizedRow {
  const first = groupRows[0];
  const uniqueNames = [...new Set(groupRows.map((row) => row.equippedComponentName).filter(Boolean))];
  const weaponName = uniqueNames.length === 1
    ? (uniqueNames[0] ?? first.equippedComponentName ?? first.portName ?? first.portId)
    : "Mixed weapons";

  return {
    key,
    portIds: groupRows.map((row) => row.portId),
    quantity: groupRows.length,
    size: first.componentSize,
    name: weaponName,
    type: first.componentSubtype ?? categoryLabel(first.componentCategory ?? first.ruleCategory),
    manufacturer: first.componentManufacturer,
    controlMode: inferControlMode(first),
    confidenceNote: options.groupKey === "installed-weapons" ? "Classification uncertain" : null,
    turretLabel: options.turretLabel ?? null,
    rows: groupRows,
  };
}

function summarizeTurretHardpointRows(
  rows: PortBreakdownRow[],
  lookup: Map<string, PortBreakdownRow>,
  groupKey: string,
): SummarizedRow[] {
  const byTurret = new Map<string, PortBreakdownRow[]>();
  for (const row of rows) {
    const turretPortId = resolveTurretPortId(row, lookup);
    byTurret.set(turretPortId, [...(byTurret.get(turretPortId) ?? []), row]);
  }

  const sortedTurretIds = [...byTurret.keys()].sort((left, right) => left.localeCompare(right));
  const turretIndexById = new Map(sortedTurretIds.map((portId, index) => [portId, index + 1]));
  const summaries: SummarizedRow[] = [];

  for (const turretPortId of sortedTurretIds) {
    const weaponRows = byTurret.get(turretPortId) ?? [];
    const turretLabel = deriveTurretDisplayLabel(
      turretPortId,
      groupKey,
      turretIndexById.get(turretPortId) ?? 1,
    );
    const bySignature = new Map<string, PortBreakdownRow[]>();

    for (const row of weaponRows) {
      const signature = portCompatibilitySignature(row);
      bySignature.set(signature, [...(bySignature.get(signature) ?? []), row]);
    }

    const sortedSignatures = [...bySignature.keys()].sort((left, right) => left.localeCompare(right));
    for (const signature of sortedSignatures) {
      const groupRows = bySignature.get(signature) ?? [];
      summaries.push(summarizeEquivalentPortRows(
        `${turretPortId}::${signature}`,
        groupRows,
        { groupKey, turretLabel },
      ));
    }
  }

  return summaries;
}

export function summarizeGroupRows(
  rows: PortBreakdownRow[],
  groupKey?: string,
  portLookup?: Map<string, PortBreakdownRow>,
): SummarizedRow[] {
  if (rows.length === 0) return [];

  if (groupKey && INDIVIDUAL_ROW_GROUP_KEYS.has(groupKey)) {
    return rows.map((row) => toSummarizedRow(row, groupKey));
  }

  if (groupKey && TURRET_WEAPON_GROUP_KEYS.has(groupKey)) {
    const lookup = portLookup ?? new Map(rows.map((row) => [row.portId, row]));
    return summarizeTurretHardpointRows(rows, lookup, groupKey);
  }

  const grouped = new Map<string, PortBreakdownRow[]>();
  for (const row of rows) {
    const key = portCompatibilitySignature(row);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return [...grouped.entries()].map(([key, groupRows]) => (
    summarizeEquivalentPortRows(key, groupRows, { groupKey })
  ));
}

export function getWeaponRows(rows: PortBreakdownRow[]): PortBreakdownRow[] {
  const lookup = new Map(rows.map((row) => [row.portId, row]));
  return rows.filter((row) => offensiveGroupKey(row, lookup) !== null && isEquippedWeaponRow(row) || isMissileItemRow(row) || isMissileOnlyRow(row));
}

export function confidenceLabel(...values: Array<string | null | undefined>): string {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? "unknown";
}
