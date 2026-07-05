import type { PortBreakdownRow } from "./fittingPortGrouping";
import { PIP_MAX_PER_CATEGORY, type PipAssignment, type PipCategory } from "./fittingTerminalTypes";

export const PIP_CATEGORIES: PipCategory[] = [
  "weapons",
  "engines",
  "quantum",
  "radar",
  "lifeSupport",
  "cooler1",
  "cooler2",
];

export type PipSystemPowerDraw = Record<PipCategory, number>;

export const EMPTY_PIP_DRAWS: PipSystemPowerDraw = {
  weapons: 0,
  engines: 0,
  quantum: 0,
  radar: 0,
  lifeSupport: 0,
  cooler1: 0,
  cooler2: 0,
};

function portText(row: PortBreakdownRow): string {
  return `${row.portId} ${row.portName ?? ""}`.toLowerCase();
}

export function coolerPortIds(portRows: PortBreakdownRow[]): string[] {
  return portRows
    .filter((row) => {
      const cat = row.ruleCategory ?? row.portCategory ?? "";
      const comp = row.componentCategory ?? "";
      return cat === "cooler" || comp === "cooler" || portText(row).includes("cooler");
    })
    .map((row) => row.portId)
    .sort((left, right) => left.localeCompare(right));
}

function isMissilePort(row: PortBreakdownRow): boolean {
  const cat = row.ruleCategory ?? row.portCategory ?? "";
  return cat === "missile" || portText(row).includes("missile") || portText(row).includes("torpedo");
}

function isWeaponRow(row: PortBreakdownRow): boolean {
  if (isMissilePort(row)) return false;
  const comp = row.componentCategory ?? "";
  if (comp === "ship_weapon") return true;
  const cat = row.ruleCategory ?? row.portCategory ?? "";
  return cat === "weapon" || cat === "turret" || cat === "gun";
}

function isEngineRow(row: PortBreakdownRow): boolean {
  const comp = row.componentCategory ?? "";
  if (comp === "thruster") return true;
  const cat = row.ruleCategory ?? row.portCategory ?? "";
  return cat === "thruster" || portText(row).includes("thruster");
}

function isQuantumRow(row: PortBreakdownRow): boolean {
  const comp = row.componentCategory ?? "";
  if (comp === "quantum_drive") return true;
  const cat = row.ruleCategory ?? row.portCategory ?? "";
  return cat === "quantum" || portText(row).includes("quantum");
}

function isRadarRow(row: PortBreakdownRow): boolean {
  const comp = row.componentCategory ?? "";
  if (comp === "radar") return true;
  const cat = row.ruleCategory ?? row.portCategory ?? "";
  return cat === "radar" || portText(row).includes("radar") || portText(row).includes("scanner");
}

function isLifeSupportRow(row: PortBreakdownRow): boolean {
  const text = portText(row);
  return text.includes("life_support")
    || text.includes("lifesupport")
    || text.includes("life-support")
    || (text.includes("life") && text.includes("support"))
    || text.includes("controller_flight")
    || text.includes("flight_controller");
}

function isCoolerRow(row: PortBreakdownRow): boolean {
  const comp = row.componentCategory ?? "";
  if (comp === "cooler") return true;
  const cat = row.ruleCategory ?? row.portCategory ?? "";
  return cat === "cooler" || portText(row).includes("cooler");
}

export function mapRowToPipCategory(
  row: PortBreakdownRow,
  coolerPorts: string[],
): PipCategory | null {
  if (isCoolerRow(row)) {
    const index = coolerPorts.indexOf(row.portId);
    if (index <= 0) return "cooler1";
    return "cooler2";
  }
  if (isWeaponRow(row)) return "weapons";
  if (isEngineRow(row)) return "engines";
  if (isQuantumRow(row)) return "quantum";
  if (isRadarRow(row)) return "radar";
  if (isLifeSupportRow(row)) return "lifeSupport";
  return null;
}

export function aggregatePipSystemDraws(
  portRows: PortBreakdownRow[],
  statsByComponentId: Record<string, { powerDraw?: number | null }>,
): PipSystemPowerDraw {
  const draws = { ...EMPTY_PIP_DRAWS };
  const coolerPorts = coolerPortIds(portRows);

  for (const row of portRows) {
    if (!row.equippedComponentKey) continue;
    const category = mapRowToPipCategory(row, coolerPorts);
    if (!category) continue;
    const draw = statsByComponentId[row.equippedComponentKey]?.powerDraw;
    if (typeof draw !== "number" || !Number.isFinite(draw)) continue;
    draws[category] += draw;
  }

  return draws;
}

export function pipAssignmentFromDraws(draws: PipSystemPowerDraw): PipAssignment {
  const assignment = {} as PipAssignment;
  for (const key of PIP_CATEGORIES) {
    assignment[key] = Math.min(PIP_MAX_PER_CATEGORY, Math.max(0, Math.round(draws[key])));
  }
  return assignment;
}

export function sumPipAssignment(assignment: PipAssignment): number {
  return PIP_CATEGORIES.reduce((total, key) => total + assignment[key], 0);
}
