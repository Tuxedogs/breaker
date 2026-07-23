import type { FittingCalculateResult, FittingComponentMitigation } from "./fittingApi";
import {
  buildDefensiveGroups,
  buildOffensiveGroups,
  type PortBreakdownRow,
} from "./fittingPortGrouping";
import { buildMockupSupportGroups } from "./fittingMockupGroups";

export type FittingResourceGroups = {
  weapons: PortBreakdownRow[];
  shields: PortBreakdownRow[];
  powerPlants: PortBreakdownRow[];
  radar: PortBreakdownRow[];
  coolers: PortBreakdownRow[];
  quantumDrives: PortBreakdownRow[];
  thrusters: PortBreakdownRow[];
  specialEquipment: PortBreakdownRow[];
  countermeasures: PortBreakdownRow[];
};

function derivedNum(result: FittingCalculateResult | null, category: string, key: string): number | null {
  const categoryData = result?.categories?.[category as keyof NonNullable<FittingCalculateResult["categories"]>];
  const value = categoryData?.derived?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function selectFittingResourceGroups(portRows: PortBreakdownRow[]): FittingResourceGroups {
  const offensive = buildOffensiveGroups(portRows);
  const defensive = buildDefensiveGroups(portRows);
  const support = buildMockupSupportGroups(portRows);

  const weaponKeys = new Set([
    "pilot-weapons",
    "remote-turrets",
    "manned-turrets",
    "point-defense",
    "installed-weapons",
    "missiles",
    "torpedoes",
    "bombs",
    "emp-qed",
    "tractor-mining-salvage",
  ]);

  return {
    weapons: offensive.filter((group) => weaponKeys.has(group.key)).flatMap((group) => group.rows),
    shields: defensive.find((group) => group.key === "shields")?.rows ?? [],
    powerPlants: defensive.find((group) => group.key === "power")?.rows ?? [],
    radar: defensive.find((group) => group.key === "radar")?.rows ?? [],
    coolers: defensive.find((group) => group.key === "coolers")?.rows ?? [],
    quantumDrives: defensive.find((group) => group.key === "quantum-drives")?.rows ?? [],
    thrusters: support.find((group) => group.key === "thrusters")?.rows ?? [],
    specialEquipment: support.find((group) => group.key === "special")?.rows ?? [],
    countermeasures: support.find((group) => group.key === "countermeasures")?.rows ?? [],
  };
}

export function sumArmorHp(mitigations: Array<Extract<FittingComponentMitigation, { kind: "armor" }>>): number | null {
  if (mitigations.length === 0 || mitigations.some((entry) => entry.health == null || !Number.isFinite(entry.health))) {
    return null;
  }
  const values = mitigations
    .map((entry) => entry.health)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

export function computeMockupHpSummary(input: {
  hullHP: number | null;
  shieldHp: number | null;
  armorMitigations: Array<Extract<FittingComponentMitigation, { kind: "armor" }>>;
}): {
  vitalHp: number | null;
  armorHp: number | null;
  totalHp: number | null;
} {
  const vitalHp = input.hullHP;
  const armorHp = sumArmorHp(input.armorMitigations);
  const armorComplete = input.armorMitigations.length === 0 || armorHp !== null;
  const totalHp = vitalHp !== null && input.shieldHp !== null && armorComplete
    ? vitalHp + input.shieldHp + (armorHp ?? 0)
    : null;
  return { vitalHp, armorHp, totalHp };
}

export function shieldSummaryLabel(rows: PortBreakdownRow[]): string | null {
  const equipped = rows.filter((row) => row.equippedComponentName);
  if (equipped.length === 0) return null;
  const first = equipped[0];
  const size = first.componentSize != null ? `${equipped.length}× S${first.componentSize}` : `${equipped.length}×`;
  return `${size} · ${first.equippedComponentName}`;
}

export function powerSummaryFromCalculate(result: FittingCalculateResult | null): string | null {
  const produced = derivedNum(result, "power", "totalPowerGenerated");
  if (produced == null) return null;
  return `${produced} segments`;
}
