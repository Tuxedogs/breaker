import type { SystemIconKind } from "../../components/fitting/terminal/SystemIcon";
import type { PortBreakdownRow } from "../fitting/fittingPortGrouping";
import { coolerPortIds, mapRowToPipCategory } from "../fitting/fittingPipPower";
import type { PipCategory } from "../fitting/fittingTerminalTypes";
import type { FittingSimulationPowerAllocation } from "../fitting/fittingApi";
import type { FittingComponentAllocation } from "../fitting/fittingApi";

export type FittingV2PowerColumn = {
  key: string;
  label: string;
  category: PipCategory | null;
  icon: SystemIconKind;
  portId: string | null;
  unavailableReason: string | null;
  allocationStatus?: FittingComponentAllocation["allocationStatus"];
  minimumSegments?: number | null;
  maximumSegments?: number | null;
};

const ORDER: Record<SystemIconKind, number> = {
  weapons: 0,
  engines: 10,
  shields: 20,
  quantum: 30,
  qed: 40,
  emp: 40,
  radar: 50,
  lifeSupport: 60,
  cooler: 70,
};

function searchable(row: PortBreakdownRow): string {
  return [row.portId, row.portName, row.portType, row.portSubtype, row.portCategory, row.ruleCategory, row.equippedComponentName, row.componentCategory, row.componentSubtype]
    .filter(Boolean).join(" ").toLowerCase();
}

function specialKind(row: PortBreakdownRow): "qed" | "emp" | null {
  const text = searchable(row);
  if (/\bqed\b|quantum enforcement|quantum interdiction|quantum dampen/.test(text)) return "qed";
  if (/\bemp\b|electromagnetic pulse/.test(text)) return "emp";
  return null;
}

function iconForCategory(category: PipCategory): SystemIconKind {
  if (category === "cooler1" || category === "cooler2") return "cooler";
  return category;
}

function labelForCategory(category: PipCategory): string {
  return ({ weapons: "Weapons", engines: "Engines", shields: "Shields", quantum: "Quantum", radar: "Radar", lifeSupport: "Life Support", cooler1: "Cooler 1", cooler2: "Cooler 2" })[category];
}

export function buildFittingV2PowerColumns(portRows: readonly PortBreakdownRow[], allocated?: FittingSimulationPowerAllocation, componentAllocations: readonly FittingComponentAllocation[] = []): FittingV2PowerColumn[] {
  const installed = portRows.filter((row) => row.equippedComponentKey);
  const allocationByPort = new Map(componentAllocations.filter((item) => item.portId).map((item) => [item.portId!, item]));
  const coolerIds = coolerPortIds([...installed]);
  const categoryRows = new Map<PipCategory, PortBreakdownRow[]>();
  const columns: FittingV2PowerColumn[] = [];

  for (const row of installed) {
    const contract = allocationByPort.get(row.portId);
    if (contract) {
      const supported = contract.allocationStatus === "supported" && contract.segmentAllocationSupported;
      columns.push({
        key: `physical:${row.portId}`,
        label: contract.displayName ?? row.equippedComponentName ?? row.portName ?? row.portId,
        category: supported ? mapRowToPipCategory(row, coolerIds) : null,
        icon: iconForCategory(mapRowToPipCategory(row, coolerIds) ?? "radar"),
        portId: row.portId,
        unavailableReason: supported ? null : contract.allocationReason ?? "Component power allocation is unavailable.",
        allocationStatus: contract.allocationStatus,
        minimumSegments: contract.minimumSegments,
        maximumSegments: contract.maximumSegments,
      });
      continue;
    }
    const special = specialKind(row);
    if (special) {
      columns.push({ key: `${special}:${row.portId}`, label: special.toUpperCase(), category: null, icon: special, portId: row.portId, unavailableReason: "This installed device has no independently addressable allocation channel in the current fitting power model." });
      continue;
    }
    const category = mapRowToPipCategory(row, coolerIds);
    if (!category) continue;
    const rows = categoryRows.get(category) ?? [];
    rows.push(row);
    categoryRows.set(category, rows);
  }

  for (const [category, rows] of categoryRows) {
    const physicalUnresolved = category === "shields" && rows.length > 1;
    if (physicalUnresolved) {
      rows.forEach((row, index) => columns.push({
        key: `${category}:${row.portId}`,
        label: `Shield ${index + 1}`,
        category,
        icon: "shields",
        portId: row.portId,
        unavailableReason: "Per-generator power distribution is unresolved by the current fitting power model.",
      }));
    } else {
      const row = rows[0]!;
      columns.push({ key: category, label: labelForCategory(category), category, icon: iconForCategory(category), portId: row.portId, unavailableReason: null });
    }
  }

  return columns
    .filter((column) => column.portId != null && componentAllocations.length > 0 ? true : column.category === null || allocated === undefined || column.category in allocated)
    .sort((left, right) => ORDER[left.icon] - ORDER[right.icon] || left.key.localeCompare(right.key));
}
