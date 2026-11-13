import { categoryLabel, portShortLabel, type PortBreakdownRow } from "../fitting/fittingPortGrouping";

export type FittingV2Tab = "components" | "weapons" | "missiles" | "special";

export type FittingV2Target = {
  portId: string;
  parentPortId: string | null;
  tab: FittingV2Tab;
  installedComponentId: string | null;
  structural: { editable: boolean; locked: boolean; bespoke: boolean };
  constraint: {
    type: string | null;
    subtype: string | null;
    minSize: number | null;
    maxSize: number | null;
    exactSize: number | null;
  };
  compatibilityPortId: string;
  replacement: "single-port" | "rack-payload" | "informational";
  rackPortId?: string;
  payloadPortIds?: string[];
  payloadCount?: number;
};

export type FittingV2SlotNode = {
  kind: "slot";
  key: string;
  label: string;
  installedName: string | null;
  installedManufacturer: string | null;
  installedSize: number | null;
  state: "editable" | "locked" | "bespoke" | "fixed" | "compatibility-unknown";
  target: FittingV2Target;
  context: string[];
};

export type FittingV2ComponentSection = { key: string; label: string; slots: FittingV2SlotNode[] };
export type FittingV2WeaponAssembly = { key: string; label: string; context: string[]; slots: FittingV2SlotNode[] };
export type FittingV2MissileRack = {
  key: string;
  label: string;
  rackPortId: string;
  payloadPortIds: string[];
  payloadCount: number;
  payload: FittingV2SlotNode;
  mixedPayload: boolean;
};
export type FittingV2SpecialAssembly = { key: string; label: string; root: FittingV2SlotNode; children: FittingV2SlotNode[] };
export type FittingV2TabContent =
  | { tab: "components"; label: "Components"; sections: FittingV2ComponentSection[] }
  | { tab: "weapons"; label: "Weapons"; assemblies: FittingV2WeaponAssembly[] }
  | { tab: "missiles"; label: "Missiles"; racks: FittingV2MissileRack[] }
  | { tab: "special"; label: "Special"; assemblies: FittingV2SpecialAssembly[] };

export type FittingV2SlotTopology = { tabs: FittingV2TabContent[]; targets: Map<string, FittingV2Target> };

const SPECIAL_TYPES = new Set(["emp", "quantuminterdictiongenerator", "pdcturret"]);
const COMPONENT_SECTIONS: Array<{ key: string; label: string; types: string[] }> = [
  { key: "cooling", label: "Cooling", types: ["cooler"] },
  { key: "power", label: "Power", types: ["powerplant"] },
  { key: "shields", label: "Shields", types: ["shield"] },
  { key: "quantum", label: "Quantum", types: ["quantumdrive"] },
  { key: "radar", label: "Radar", types: ["radar"] },
  { key: "systems", label: "Systems", types: ["armor", "computer", "thruster", "fueltank", "quantumfueltank"] },
];

function normalized(value: string | null | undefined): string {
  return (value ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function visibleLabel(row: PortBreakdownRow): string {
  return categoryLabel(portShortLabel(row).replace(/^hardpoint[_\s-]*/i, ""));
}

function state(row: PortBreakdownRow): FittingV2SlotNode["state"] {
  if (row.locked) return "locked";
  if (row.bespoke) return "bespoke";
  if (row.compatibilityStatus === "unknown" || row.compatibilityStatus === "unavailable") return "compatibility-unknown";
  return row.editable ? "editable" : "fixed";
}

function targetFor(row: PortBreakdownRow, tab: FittingV2Tab, replacement: FittingV2Target["replacement"] = "single-port"): FittingV2Target {
  const structural = { editable: row.editable, locked: row.locked, bespoke: row.bespoke };
  return {
    portId: row.portId,
    parentPortId: row.parentPortId,
    tab,
    installedComponentId: row.equippedComponentKey,
    structural,
    constraint: {
      type: row.portType,
      subtype: row.portSubtype,
      minSize: row.portMinSize,
      maxSize: row.portMaxSize,
      exactSize: row.portExactSize,
    },
    compatibilityPortId: row.portId,
    replacement: !row.editable || row.locked || row.bespoke ? "informational" : replacement,
  };
}

function slotFor(row: PortBreakdownRow, tab: FittingV2Tab, context: string[] = [], replacement?: FittingV2Target["replacement"]): FittingV2SlotNode {
  return {
    kind: "slot",
    key: `${tab}:${row.portId}`,
    label: visibleLabel(row),
    installedName: row.equippedComponentName,
    installedManufacturer: row.componentManufacturer,
    installedSize: row.componentSize ?? row.portExactSize,
    state: state(row),
    target: targetFor(row, tab, replacement),
    context,
  };
}

function isSpecial(row: PortBreakdownRow): boolean {
  return SPECIAL_TYPES.has(normalized(row.portType)) || SPECIAL_TYPES.has(normalized(row.portSubtype));
}

function isMissileRack(row: PortBreakdownRow): boolean {
  return normalized(row.portType) === "missilelauncher" || normalized(row.portSubtype) === "missilerack" || normalized(row.portSubtype) === "bombrack";
}

function isPayload(row: PortBreakdownRow): boolean {
  const type = normalized(row.portType);
  return type === "missile" || type === "bomb";
}

function isWeaponLeaf(row: PortBreakdownRow): boolean {
  return normalized(row.portType) === "weapongun" || (row.componentCategory === "ship_weapon" && row.childPortIds.length === 0);
}

function chainFor(row: PortBreakdownRow, byId: Map<string, PortBreakdownRow>): PortBreakdownRow[] {
  const chain: PortBreakdownRow[] = [];
  let current: PortBreakdownRow | undefined = row;
  while (current) {
    chain.unshift(current);
    current = current.parentPortId ? byId.get(current.parentPortId) : undefined;
  }
  return chain;
}

function specialAncestor(row: PortBreakdownRow, byId: Map<string, PortBreakdownRow>): PortBreakdownRow | null {
  return chainFor(row, byId).find(isSpecial) ?? null;
}

function componentSection(row: PortBreakdownRow): { key: string; label: string } | null {
  const type = normalized(row.portType);
  return COMPONENT_SECTIONS.find((section) => section.types.includes(type)) ?? null;
}

export function buildFittingV2SlotTopology(rows: PortBreakdownRow[]): FittingV2SlotTopology {
  const byId = new Map(rows.map((row) => [row.portId, row]));
  const targets = new Map<string, FittingV2Target>();
  const register = (node: FittingV2SlotNode) => { targets.set(node.target.portId, node.target); return node; };

  const componentsBySection = new Map<string, FittingV2ComponentSection>();
  for (const row of rows) {
    if (isSpecial(row) || isWeaponLeaf(row) || isMissileRack(row) || isPayload(row) || specialAncestor(row, byId)) continue;
    const section = componentSection(row);
    if (!section) continue;
    const group = componentsBySection.get(section.key) ?? { ...section, slots: [] };
    group.slots.push(register(slotFor(row, "components")));
    componentsBySection.set(section.key, group);
  }

  const weaponGroups = new Map<string, FittingV2WeaponAssembly>();
  for (const row of rows) {
    if (!isWeaponLeaf(row) || specialAncestor(row, byId)) continue;
    const chain = chainFor(row, byId);
    const root = chain.find((entry) => normalized(entry.portType).includes("turret")) ?? row;
    const structural = chain.filter((entry) => entry.portId !== row.portId && entry.portId !== root.portId).map(visibleLabel);
    const key = root.portId;
    const assembly = weaponGroups.get(key) ?? { key, label: visibleLabel(root), context: structural, slots: [] };
    assembly.slots.push(register(slotFor(row, "weapons", structural)));
    weaponGroups.set(key, assembly);
  }

  const racks: FittingV2MissileRack[] = [];
  for (const rack of rows.filter(isMissileRack)) {
    const payloadRows = rack.childPortIds.map((id) => byId.get(id)).filter((row): row is PortBreakdownRow => Boolean(row && isPayload(row)));
    if (payloadRows.length === 0) continue;
    const installedIds = new Set(payloadRows.map((row) => row.equippedComponentKey).filter((id): id is string => Boolean(id)));
    const first = payloadRows[0];
    const payload = register({
      ...slotFor(first, "missiles", [visibleLabel(rack)], "rack-payload"),
      key: `missiles:${rack.portId}:payload`,
      label: "Payload",
      installedName: installedIds.size === 1 ? first.equippedComponentName : null,
      target: { ...targetFor(first, "missiles", "rack-payload"), portId: `${rack.portId}:payload`, parentPortId: rack.portId, compatibilityPortId: first.portId, installedComponentId: installedIds.size === 1 ? first.equippedComponentKey : null, rackPortId: rack.portId, payloadPortIds: payloadRows.map((row) => row.portId), payloadCount: payloadRows.length },
    });
    targets.delete(first.portId);
    targets.set(payload.target.portId, payload.target);
    racks.push({ key: rack.portId, label: visibleLabel(rack), rackPortId: rack.portId, payloadPortIds: payloadRows.map((row) => row.portId), payloadCount: payloadRows.length, payload, mixedPayload: installedIds.size > 1 });
  }

  const special: FittingV2SpecialAssembly[] = [];
  for (const root of rows.filter(isSpecial)) {
    const rootNode = register(slotFor(root, "special", [], "informational"));
    const children = root.childPortIds.map((id) => byId.get(id)).filter((row): row is PortBreakdownRow => Boolean(row)).map((row) => register(slotFor(row, "special", [visibleLabel(root)], "informational")));
    special.push({ key: root.portId, label: visibleLabel(root), root: rootNode, children });
  }

  const tabs: FittingV2TabContent[] = [];
  const sections = COMPONENT_SECTIONS.map((section) => componentsBySection.get(section.key)).filter((section): section is FittingV2ComponentSection => Boolean(section?.slots.length));
  if (sections.length) tabs.push({ tab: "components", label: "Components", sections });
  const assemblies = [...weaponGroups.values()].filter((assembly) => assembly.slots.length);
  if (assemblies.length) tabs.push({ tab: "weapons", label: "Weapons", assemblies });
  if (racks.length) tabs.push({ tab: "missiles", label: "Missiles", racks });
  if (special.length) tabs.push({ tab: "special", label: "Special", assemblies: special });
  return { tabs, targets };
}
