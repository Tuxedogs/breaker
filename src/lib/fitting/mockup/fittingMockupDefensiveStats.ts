import type { DamageTypeMap, FittingComponentMitigation } from "../fittingApi";
import { formatNumber } from "../fittingPortGrouping";

function valueRange(values: number[]): string | null {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return null;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  return min === max ? formatNumber(min) : `${formatNumber(min)}-${formatNumber(max)}`;
}

function damageRange(
  maps: Array<DamageTypeMap | null>,
  damageType: "physical" | "energy" | "distortion" | "thermal",
  fields: Array<"max" | "min" | "value" | "multiplier">,
): string | null {
  const values: number[] = [];
  for (const map of maps) {
    const entry = map?.[damageType];
    if (!entry) continue;
    for (const field of fields) {
      const value = entry[field];
      if (typeof value === "number" && Number.isFinite(value)) {
        values.push(value);
        break;
      }
    }
  }
  return valueRange(values);
}

function missingValue(value: string | null): string {
  return value ?? "Source unavailable";
}

export type MockupResistanceColumn = "Energy" | "Kinetic" | "EMP" | "Thermal";

export type MockupResistanceRow = {
  label: string;
  values: string[];
};

export function buildMockupResistanceTable(input: {
  shieldMitigations: Array<Extract<FittingComponentMitigation, { kind: "shield" }>>;
  armorMitigations: Array<Extract<FittingComponentMitigation, { kind: "armor" }>>;
}): MockupResistanceRow[] {
  const { shieldMitigations, armorMitigations } = input;
  const shieldResistanceMaps = shieldMitigations.map((entry) => entry.resistanceByDamageType);
  const armorResistanceMaps = armorMitigations.map((entry) => entry.resistanceByDamageType);

  const columns: MockupResistanceColumn[] = ["Energy", "Kinetic", "EMP", "Thermal"];
  const damageKeys = ["energy", "physical", "distortion", "thermal"] as const;

  const shieldRow: MockupResistanceRow = {
    label: "Shields",
    values: damageKeys.map((key) => missingValue(
      damageRange(shieldResistanceMaps, key, ["max", "value"]),
    )),
  };

  const armorRow: MockupResistanceRow = {
    label: "Armor",
    values: damageKeys.map((key) => missingValue(
      damageRange(armorResistanceMaps, key, ["multiplier", "value"]),
    )),
  };

  const ehpValues = columns.map(() => "Not calculated yet");

  return [
    shieldRow,
    armorRow,
    { label: "EHP", values: ehpValues },
  ];
}
