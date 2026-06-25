import type {
  FittingComponentSummary as ApiFittingComponentSummary,
  FittingHardpoint,
  FittingLoadoutEntry,
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
};

export type FittingShipDetail = {
  ship?: FittingShipSummary;
  confidence?: string;
  warnings?: string[];
};

export type PortBreakdownRow = {
  shipKey: string;
  portId: string;
  portName: string | null;
  portCategory: string | null;
  ruleCategory: string | null;
  parentPortId: string | null;
  childPortIds: string[];
  equippedComponentKey: string | null;
  equippedComponentName: string | null;
  componentCategory: string | null;
  componentManufacturer: string | null;
  componentSize: number | null;
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
  { key: "remote-turrets", label: "Remote Turrets" },
  { key: "manned-turrets", label: "Manned Turrets" },
  { key: "installed-weapons", label: "Installed Weapons" },
  { key: "missiles", label: "Missiles" },
  { key: "torpedoes", label: "Torpedoes" },
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
    },
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
      portCategory: portCategory(port),
      ruleCategory: portCategory(port),
      parentPortId: port.parentId,
      childPortIds: childIds.get(port.id) ?? [],
      equippedComponentKey: componentId,
      equippedComponentName: null,
      componentCategory: null,
      componentManufacturer: null,
      componentSize: port.size?.exact ?? port.size?.max ?? null,
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

export function isMissileItemRow(row: PortBreakdownRow): boolean {
  if (isControllerRow(row)) return false;
  const category = row.ruleCategory ?? row.portCategory;
  return category === "missile" && Boolean(row.parentPortId) && Boolean(row.equippedComponentName ?? row.equippedComponentKey);
}

export function isWeaponParentRow(row: PortBreakdownRow): boolean {
  const category = row.ruleCategory ?? row.portCategory;
  const text = rowText(row);
  return category === "turret" || category === "mount/gimbal" || text.includes("gimbal") || text.includes("turret") || text.includes("weapon rack");
}

function getOffensiveParent(row: PortBreakdownRow, lookup: Map<string, PortBreakdownRow>): PortBreakdownRow {
  let current: PortBreakdownRow = row;
  let parent = row.parentPortId ? lookup.get(row.parentPortId) : undefined;
  while (parent) {
    if (!isWeaponParentRow(parent) || isControllerRow(parent)) break;
    current = parent;
    parent = parent.parentPortId ? lookup.get(parent.parentPortId) : undefined;
  }
  return current === row && row.parentPortId ? lookup.get(row.parentPortId) ?? row : current;
}

function isTorpedoRow(row: PortBreakdownRow): boolean {
  const text = rowText(row);
  return text.includes("torpedo") || (text.includes("bomb") && !text.includes("rack"));
}

function isMissileOnlyRow(row: PortBreakdownRow): boolean {
  const text = rowText(row);
  const category = row.ruleCategory ?? row.portCategory ?? "";
  if (text.includes("missile rack")) return false;
  if (isTorpedoRow(row)) return false;
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

function isExplicitTurretHardpoint(row: PortBreakdownRow): boolean {
  const category = row.ruleCategory ?? row.portCategory ?? "";
  const text = rowText(row);
  if (text.includes("remote")) return false;
  if (category === "turret") return true;
  return text.includes("turret") && !text.includes("gimbal") && !text.includes("mount") && !text.includes("weapon rack");
}

export function offensiveGroupKey(row: PortBreakdownRow, lookup: Map<string, PortBreakdownRow>): string | null {
  if (isControllerRow(row)) return null;
  if (!row.equippedComponentKey && !row.equippedComponentName) return null;

  const text = rowText(row);

  if (text.includes("qed") || text.includes("qid") || text.includes("emp")) return "emp-qed";
  if (text.includes("tractor") || text.includes("mining") || text.includes("salvage")) return "tractor-mining-salvage";
  if (isTorpedoRow(row)) return "torpedoes";
  if (isMissileOnlyRow(row) || isMissileItemRow(row)) return "missiles";

  if (isEquippedWeaponRow(row)) {
    const chain = getPortChain(row, lookup);
    const combined = chainText(chain);

    if (combined.includes("remote")) return "remote-turrets";
    if (combined.includes("manned")) return "manned-turrets";

    const turretParent = chain.find((entry) => entry.portId !== row.portId && isExplicitTurretHardpoint(entry));
    if (turretParent) return "manned-turrets";

    if (
      combined.includes("hardpoint_gun")
      || combined.includes("/gun_")
      || combined.includes("_gun_")
      || combined.includes("nose")
      || combined.includes("wing")
      || combined.includes("chin")
    ) {
      return "pilot-weapons";
    }

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

export function summarizeGroupRows(rows: PortBreakdownRow[], groupKey?: string): SummarizedRow[] {
  const grouped = new Map<string, PortBreakdownRow[]>();
  for (const row of rows) {
    const label = row.equippedComponentName ?? row.portName ?? row.portId;
    const key = `${label}|${row.componentSize ?? ""}|${row.componentSubtype ?? ""}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return [...grouped.entries()].map(([key, groupRows]) => {
    const first = groupRows[0];
    return {
      key,
      portIds: groupRows.map((row) => row.portId),
      quantity: groupRows.length,
      size: first.componentSize,
      name: first.equippedComponentName ?? first.portName ?? first.portId,
      type: first.componentSubtype ?? categoryLabel(first.componentCategory ?? first.ruleCategory),
      manufacturer: first.componentManufacturer,
      controlMode: inferControlMode(first),
      confidenceNote: groupKey === "installed-weapons" ? "Classification uncertain" : null,
      rows: groupRows,
    };
  });
}

export function getWeaponRows(rows: PortBreakdownRow[]): PortBreakdownRow[] {
  const lookup = new Map(rows.map((row) => [row.portId, row]));
  return rows.filter((row) => offensiveGroupKey(row, lookup) !== null && isEquippedWeaponRow(row) || isMissileItemRow(row) || isMissileOnlyRow(row));
}

export function confidenceLabel(...values: Array<string | null | undefined>): string {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? "unknown";
}
