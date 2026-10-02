import type {
  FittingCalculateResult,
  FittingSimulationResult,
} from "../fitting/fittingApi";
import {
  buildDefensiveGroups,
  buildOffensiveGroups,
  categoryLabel,
  portShortLabel,
  summarizeGroupRows,
  type PortBreakdownRow,
} from "../fitting/fittingPortGrouping";
import { resolveComponentImageUrl } from "../componentImageResolver";
import type { PipCategory } from "../fitting/fittingTerminalTypes";

export type FittingV2DeltaTone = "beneficial" | "detrimental" | "neutral";

export type FittingV2Metric = {
  key: string;
  label: string;
  value: number;
  unit: string;
  delta: number | null;
  deltaTone: FittingV2DeltaTone;
};

export type FittingV2ComponentState =
  | "editable"
  | "locked"
  | "bespoke"
  | "compatibility-unknown"
  | "compatibility-unavailable"
  | "fixed";

export type FittingV2ComponentGroup = {
  key: string;
  label: string;
  entries: FittingV2ComponentEntry[];
  installedCount: number;
  totalCount: number;
};

export type FittingV2ComponentEntry = {
  key: string;
  /** Canonical physical ports represented by this compact presentation entry. */
  portIds: string[];
  location: string;
  name: string;
  manufacturer: string | null;
  size: number | null;
  type: string | null;
  quantity: number;
  state: FittingV2ComponentState;
  imageUrl: string | null;
};

export type FittingV2ComponentPresentation = {
  systemGroups: FittingV2ComponentGroup[];
  hardpoints: FittingV2ComponentEntry[];
  meaningfulPortCount: number;
  hiddenInternalPortCount: number;
};

export type FittingV2Effect = {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  unavailableReason: string | null;
};

type StockComparison = {
  available?: boolean;
  deltas?: Record<string, Record<string, number | null>>;
};

function finite(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Object.is(value, -0) ? 0 : value;
}

function categoryDerived(
  result: FittingCalculateResult | null,
  category: string,
  key: string,
): number | null {
  const value = result?.categories?.[category as keyof FittingCalculateResult["categories"]]?.derived?.[key];
  return finite(value);
}

function categoryDelta(
  result: FittingCalculateResult | null,
  category: string,
  key: string,
): number | null {
  const comparison = result?.stockComparison as StockComparison | undefined;
  if (!comparison?.available) return null;
  return finite(comparison.deltas?.[category]?.[key]);
}

function metric(input: {
  key: string;
  label: string;
  value: number | null | undefined;
  unit: string;
  delta?: number | null;
  lowerIsBetter?: boolean;
}): FittingV2Metric | null {
  const value = finite(input.value);
  if (value == null) return null;
  const delta = finite(input.delta);
  let deltaTone: FittingV2DeltaTone = "neutral";
  if (delta != null && delta !== 0 && input.lowerIsBetter !== undefined) {
    const beneficial = input.lowerIsBetter ? delta < 0 : delta > 0;
    deltaTone = beneficial ? "beneficial" : "detrimental";
  }
  return { key: input.key, label: input.label, value, unit: input.unit, delta, deltaTone };
}

export function buildFittingV2PerformanceMetrics(input: {
  ship: {
    pitchRate?: number | null;
    yawRate?: number | null;
    rollRate?: number | null;
    scmSpeed?: number | null;
    maxSpeed?: number | null;
    boostSpeedForward?: number | null;
    cargoCapacityScu?: number | null;
  } | null | undefined;
  hullHp: number | null | undefined;
  calculateResult: FittingCalculateResult | null;
}): FittingV2Metric[] {
  const { ship, hullHp, calculateResult } = input;
  const candidates = [
    metric({ key: "pitch", label: "Pitch", value: ship?.pitchRate, unit: "°/s" }),
    metric({ key: "yaw", label: "Yaw", value: ship?.yawRate, unit: "°/s" }),
    metric({ key: "roll", label: "Roll", value: ship?.rollRate, unit: "°/s" }),
    metric({ key: "scm", label: "SCM", value: ship?.scmSpeed, unit: "m/s" }),
    metric({ key: "max-speed", label: "Max Speed", value: ship?.maxSpeed, unit: "m/s" }),
    metric({ key: "boost-speed", label: "Boost Speed", value: ship?.boostSpeedForward, unit: "m/s" }),
    metric({ key: "cargo", label: "Cargo", value: ship?.cargoCapacityScu, unit: "SCU" }),
    metric({ key: "hull-hp", label: "Hull HP", value: hullHp, unit: "HP" }),
    metric({
      key: "shield-hp",
      label: "Shield HP",
      value: categoryDerived(calculateResult, "shields", "totalShieldHP"),
      unit: "HP",
      delta: categoryDelta(calculateResult, "shields", "totalShieldHP"),
      lowerIsBetter: false,
    }),
    metric({
      key: "shield-regen",
      label: "Shield Regeneration",
      value: categoryDerived(calculateResult, "shields", "totalRegenRate"),
      unit: "HP/s",
      delta: categoryDelta(calculateResult, "shields", "totalRegenRate"),
      lowerIsBetter: false,
    }),
    metric({
      key: "power-generation",
      label: "Power Generation",
      value: categoryDerived(calculateResult, "power", "totalPowerGenerated"),
      unit: "segments",
      delta: categoryDelta(calculateResult, "power", "totalPowerGenerated"),
      lowerIsBetter: false,
    }),
    metric({
      key: "power-demand",
      label: "Power Demand",
      value: categoryDerived(calculateResult, "power", "totalPowerRequired"),
      unit: "segments",
      delta: categoryDelta(calculateResult, "power", "totalPowerRequired"),
      lowerIsBetter: true,
    }),
    metric({
      key: "cooling",
      label: "Cooling Capacity",
      value: categoryDerived(calculateResult, "cooling", "totalCoolingGenerated"),
      unit: "c/u",
      delta: categoryDelta(calculateResult, "cooling", "totalCoolingGenerated"),
      lowerIsBetter: false,
    }),
    metric({
      key: "weapon-alpha",
      label: "Weapon Alpha",
      value: categoryDerived(calculateResult, "weapons", "weaponAlphaTotal"),
      unit: "damage",
      delta: categoryDelta(calculateResult, "weapons", "weaponAlphaTotal"),
      lowerIsBetter: false,
    }),
  ];
  return candidates.filter((entry): entry is FittingV2Metric => entry !== null);
}

const SYSTEM_GROUPS = [
  { key: "power", label: "Power Plant", sourceKeys: ["power"] },
  { key: "coolers", label: "Coolers", sourceKeys: ["coolers"] },
  { key: "shields", label: "Shields", sourceKeys: ["shields"] },
  { key: "quantum", label: "Quantum Drive", sourceKeys: ["quantum-drives"] },
  { key: "radar", label: "Radar", sourceKeys: ["radar"] },
  { key: "weapons", label: "Weapons", sourceKeys: ["pilot-weapons", "installed-weapons", "remote-turrets", "manned-turrets", "point-defense"] },
  { key: "missiles", label: "Missiles", sourceKeys: ["missiles", "torpedoes", "rockets", "bombs"] },
  { key: "utility", label: "Utility", sourceKeys: ["utility", "computers", "emp-qed", "tractor-mining-salvage"] },
] as const;

const OFFENSIVE_KEYS = new Set([
  "pilot-weapons", "installed-weapons", "remote-turrets", "manned-turrets",
  "point-defense", "missiles", "torpedoes", "rockets", "bombs", "emp-qed",
  "tractor-mining-salvage",
]);

function presentableLocation(row: PortBreakdownRow, fallback: string): string {
  const candidate = portShortLabel(row);
  if (candidate && !/controller|hardpoint_controller/i.test(candidate)) {
    return categoryLabel(candidate.replace(/^hardpoint[_\s-]*/i, ""));
  }
  const identity = `${row.portName ?? ""} ${row.portId}`.toLowerCase();
  const parts = [
    identity.includes("nose") ? "Nose" : null,
    identity.includes("top") ? "Top" : identity.includes("bottom") ? "Bottom" : null,
    identity.includes("left") ? "Left" : identity.includes("right") ? "Right" : null,
    identity.includes("rear") || identity.includes("back") ? "Rear" : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : fallback;
}

function stateForRows(rows: PortBreakdownRow[]): FittingV2ComponentState {
  const states = rows.map(fittingV2ComponentState);
  return states.includes("locked") ? "locked"
    : states.includes("bespoke") ? "bespoke"
      : states.includes("compatibility-unavailable") ? "compatibility-unavailable"
        : states.includes("compatibility-unknown") ? "compatibility-unknown"
          : states.includes("editable") ? "editable"
            : "fixed";
}

function entryFromRows(
  rows: PortBreakdownRow[],
  key: string,
  fallbackLabel: string,
): FittingV2ComponentEntry | null {
  if (rows.length === 0) return null;
  const first = rows[0];
  const name = first.equippedComponentName?.trim();
  if (!name) return null;
  const size = first.componentSize ?? first.portExactSize;
  return {
    key,
    portIds: rows.map((row) => row.portId),
    location: presentableLocation(first, fallbackLabel),
    name,
    manufacturer: first.componentManufacturer,
    size,
    type: first.componentSubtype ?? categoryLabel(first.componentCategory ?? first.ruleCategory),
    quantity: rows.length,
    state: stateForRows(rows),
    imageUrl: resolveComponentImageUrl({
      componentId: first.equippedComponentKey ?? undefined,
      componentName: name,
      componentType: first.componentCategory ?? first.ruleCategory ?? undefined,
      size,
    }),
  };
}

function collapseEquivalentEntries(
  entries: FittingV2ComponentEntry[],
  location?: string,
): FittingV2ComponentEntry[] {
  const collapsed = new Map<string, FittingV2ComponentEntry>();
  for (const entry of entries) {
    const signature = [entry.name, entry.size ?? "", entry.type ?? "", entry.state].join("|");
    const current = collapsed.get(signature);
    if (current) {
      current.quantity += entry.quantity;
      current.portIds.push(...entry.portIds);
      continue;
    }
    collapsed.set(signature, { ...entry, location: location ?? entry.location });
  }
  return [...collapsed.values()];
}

export function buildFittingV2ComponentGroups(rows: PortBreakdownRow[]): FittingV2ComponentPresentation {
  const sourceGroups = [...buildDefensiveGroups(rows), ...buildOffensiveGroups(rows)];
  const byKey = new Map(sourceGroups.map((group) => [group.key, group]));
  const systemGroups = SYSTEM_GROUPS.map((definition) => {
    const sourceRows = definition.sourceKeys.flatMap((key) => byKey.get(key)?.rows ?? []);
    const summarized = definition.sourceKeys.flatMap((key) => {
      const groupRows = byKey.get(key)?.rows ?? [];
      return summarizeGroupRows(groupRows, key, new Map(rows.map((row) => [row.portId, row])));
    });
    const entries = collapseEquivalentEntries(summarized
      .map((summary) => entryFromRows(summary.rows, `${definition.key}:${summary.key}`, summary.turretLabel ?? definition.label))
      .filter((entry): entry is FittingV2ComponentEntry => entry !== null));
    return {
      key: definition.key,
      label: definition.label,
      entries,
      installedCount: sourceRows.filter((row) => Boolean(row.equippedComponentKey ?? row.equippedComponentName)).length,
      totalCount: sourceRows.length,
    };
  }).filter((group) => group.entries.length > 0);

  const hardpoints = sourceGroups
    .filter((group) => OFFENSIVE_KEYS.has(group.key))
    .flatMap((group) => collapseEquivalentEntries(
      summarizeGroupRows(group.rows, group.key, new Map(rows.map((row) => [row.portId, row])))
        .map((summary) => entryFromRows(summary.rows, `hardpoint:${summary.key}`, summary.turretLabel ?? group.label))
        .filter((entry): entry is FittingV2ComponentEntry => entry !== null),
      group.label,
    ));
  const meaningfulIds = new Set(sourceGroups.flatMap((group) => group.rows.map((row) => row.portId)));

  return {
    systemGroups,
    hardpoints,
    meaningfulPortCount: meaningfulIds.size,
    hiddenInternalPortCount: Math.max(0, rows.length - meaningfulIds.size),
  };
}

export function fittingV2ComponentState(row: PortBreakdownRow): FittingV2ComponentState {
  if (row.locked) return "locked";
  if (row.bespoke) return "bespoke";
  if (row.compatibilityStatus === "unknown") return "compatibility-unknown";
  if (row.compatibilityStatus === "unavailable") return "compatibility-unavailable";
  if (row.editable) return "editable";
  return "fixed";
}

function unavailableReason(simulation: FittingSimulationResult | null, paths: string[]): string | null {
  return simulation?.missingInputs.find((entry) => paths.includes(entry.path))?.reason ?? null;
}

export function buildFittingV2Effects(simulation: FittingSimulationResult | null): FittingV2Effect[] {
  return [
    {
      key: "weapon-dps",
      label: "Sustained Weapon DPS",
      value: simulation?.weaponsSummary.dps.value ?? null,
      unit: "DPS",
      unavailableReason: unavailableReason(simulation, ["weaponPowerPoolSegments", "turretPowerRatio", "powerAllocation"]),
    },
    {
      key: "weapon-damage",
      label: "Damage over 60 seconds",
      value: simulation?.weaponsSummary.totalDamage.value ?? null,
      unit: "damage",
      unavailableReason: unavailableReason(simulation, ["weaponPowerPoolSegments", "turretPowerRatio", "powerAllocation"]),
    },
    {
      key: "shield-regen",
      label: "Shield Regeneration",
      value: simulation?.shields?.effectiveRegenPerSecond.value ?? null,
      unit: "HP/s",
      unavailableReason: unavailableReason(simulation, ["shield.regenCurve", "powerAllocation"]),
    },
    {
      key: "cooling-utilization",
      label: "Cooling Utilization",
      value: simulation?.cooling.utilizationPercent.value ?? null,
      unit: "%",
      unavailableReason: unavailableReason(simulation, ["cooling.capacity", "cooling.demand", "powerAllocation"]),
    },
    {
      key: "reactor-reserve",
      label: "Reactor Reserve",
      value: simulation?.power.marginSegments.value ?? null,
      unit: "segments",
      unavailableReason: unavailableReason(simulation, ["power.capacity", "powerAllocation"]),
    },
  ];
}

export const FITTING_V2_PIP_LABELS: Record<PipCategory, string> = {
  weapons: "Weapons",
  shields: "Shields",
  engines: "Engines",
  quantum: "Quantum",
  radar: "Radar",
  lifeSupport: "Life Support",
  cooler1: "Cooler 1",
  cooler2: "Cooler 2",
};
