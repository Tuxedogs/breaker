import {
  buildGroups,
  categoryLabel,
  offensiveGroupKey,
  rowText,
  summarizeGroupRows,
  type NamedGroup,
  type PortBreakdownRow,
  type SummarizedRow,
} from "./fittingPortGrouping";
import { buildMockupWeaponSelection, type MockupWeaponSelection } from "./fittingMockupTurretGroups";
import { mockupSlotDisplayLabel } from "./fittingMockupSlotLabels";

export type MockupOffensiveDisplayGroup = {
  key: string;
  label: string;
  summaries: SummarizedRow[];
  selections: MockupWeaponSelection[];
};

export const mockupOffensiveGroupLabels: Record<string, string> = {
  "pilot-weapons": "Pilot Weapons",
  "remote-turrets": "Remote Turrets",
  "manned-turrets": "Manned Turrets",
  "point-defense": "Point Defense",
  "installed-weapons": "Gimbals & Mounts",
  missiles: "Missiles",
  torpedoes: "Torpedoes",
  bombs: "Bombs",
  "emp-qed": "EMP / QED",
  "tractor-mining-salvage": "Tractor / Mining / Salvage",
};

export const mockupOffensiveGroupOrder = [
  "pilot-weapons",
  "installed-weapons",
  "remote-turrets",
  "manned-turrets",
  "point-defense",
  "missiles",
  "torpedoes",
  "bombs",
  "emp-qed",
  "tractor-mining-salvage",
] as const;

export const mockupSupportGroupDefs = [
  { key: "shields", label: "Shield Generator" },
  { key: "power", label: "Power Plant" },
  { key: "radar", label: "Radar" },
  { key: "coolers", label: "Cooler" },
  { key: "quantum-drives", label: "Quantum Drive" },
  { key: "special", label: "Special Equipment / Modularity" },
  { key: "countermeasures", label: "Countermeasures" },
  { key: "thrusters", label: "Thrusters" },
] as const;

export type MockupSupportGroupKey = (typeof mockupSupportGroupDefs)[number]["key"];

export function mockupSupportGroupKey(
  row: PortBreakdownRow,
  lookup: Map<string, PortBreakdownRow>,
): MockupSupportGroupKey | null {
  if (offensiveGroupKey(row, lookup)) return null;
  if (!row.equippedComponentKey && !row.equippedComponentName) return null;

  const text = rowText(row);
  const category = row.ruleCategory ?? row.portCategory ?? "";

  if (category === "shield" || text.includes("shield")) return "shields";
  if (category === "power" || text.includes("power plant") || text.includes("powerplant")) return "power";
  if (category === "radar" || text.includes("radar") || text.includes("scanner")) return "radar";
  if (category === "cooler" || text.includes("cooler")) return "coolers";
  if (category === "quantum" && !text.includes("fuel")) return "quantum-drives";
  if (
    text.includes("countermeasure")
    || text.includes("flare")
    || text.includes("chaff")
    || text.includes("decoy")
    || text.includes("noise")
  ) return "countermeasures";
  if (category === "thruster" || text.includes("thruster")) return "thrusters";

  if (
    category === "computer"
    || text.includes("modular")
    || text.includes("utility")
    || text.includes("life")
    || text.includes("support")
    || category === "armor"
    || category === "hull"
    || text.includes("fuel tank")
    || text.includes("controller")
  ) return "special";

  return null;
}

export function buildMockupOffensiveDisplayGroups(rows: PortBreakdownRow[]): MockupOffensiveDisplayGroup[] {
  const lookup = new Map(rows.map((row) => [row.portId, row]));
  const grouped = new Map<string, PortBreakdownRow[]>();

  for (const row of rows) {
    const key = offensiveGroupKey(row, lookup);
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  return mockupOffensiveGroupOrder
    .map((key) => {
      const groupRows = grouped.get(key) ?? [];
      const summaries = summarizeGroupRows(groupRows, key, lookup);
      return {
        key,
        label: mockupOffensiveGroupLabels[key] ?? categoryLabel(key),
        summaries,
        selections: summaries.map((summary) => buildMockupWeaponSelection(summary, key)),
      };
    })
    .filter((group) => group.summaries.length > 0);
}

export function buildMockupOffensiveGroups(rows: PortBreakdownRow[]): NamedGroup[] {
  const lookup = new Map(rows.map((row) => [row.portId, row]));
  const grouped = new Map<string, PortBreakdownRow[]>();

  for (const row of rows) {
    const key = offensiveGroupKey(row, lookup);
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  return mockupOffensiveGroupOrder
    .map((key) => ({
      key,
      label: mockupOffensiveGroupLabels[key] ?? categoryLabel(key),
      rows: grouped.get(key) ?? [],
    }))
    .filter((group) => group.rows.length > 0);
}

export function buildMockupSupportGroups(rows: PortBreakdownRow[]): NamedGroup[] {
  const lookup = new Map(rows.map((row) => [row.portId, row]));
  return buildGroups(
    mockupSupportGroupDefs,
    rows,
    (row) => mockupSupportGroupKey(row, lookup),
  ).filter((group) => group.rows.length > 0);
}

export function mockupSlotLabel(row: PortBreakdownRow): string {
  return mockupSlotDisplayLabel(row);
}

export function mockupComponentTitle(row: PortBreakdownRow): string {
  const size = row.componentSize != null ? `S${row.componentSize} ` : "";
  return `${size}${row.equippedComponentName ?? "Empty"}`;
}

export function isPortStructurallyEditable(row: PortBreakdownRow): boolean {
  return row.editable && !row.locked && !row.bespoke;
}

/** @deprecated Use isPortStructurallyEditable + isSlotCompatibilityEditable */
export function canEditMockupPort(row: PortBreakdownRow): boolean {
  return isPortStructurallyEditable(row);
}

export function supportTypeLabel(row: PortBreakdownRow): string {
  const category = row.componentCategory ?? row.ruleCategory ?? row.portCategory;
  if (category) return categoryLabel(category);
  return categoryLabel(row.portType);
}
