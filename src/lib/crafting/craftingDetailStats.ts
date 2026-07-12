import type { FittingComponentDetail } from "../fitting/fittingApi";
import {
  getFittingDpsBases,
  getFittingModifierBaseValue,
  modifierDetailStatLabelKeys,
} from "../fitting/fittingStatProjection";
import { getModifierImpact } from "../gameplay/propertyUtils";
import { formatProperty } from "../../components/industry/crafting/utils/qualityModifiers";
import type { TotalModifierRow } from "../../components/industry/crafting/utils/recipeQuality";
import type { ComponentCardMetric } from "../../components/industry/crafting/utils/componentCardSchema";

export type DetailStatModifier = {
  value: string;
  impactClass: string;
  base?: string;
};

export type DetailStatRow = ComponentCardMetric & {
  modifier?: DetailStatModifier;
  valueImpactClass?: string;
};

type ModifierStatBinding = {
  label: string;
  statKeys: string[];
  statGroups?: string[];
};

const MODIFIER_STAT_BINDINGS: Record<string, ModifierStatBinding> = {
  GPP_Weapon_Damage: { label: "Alpha Damage", statKeys: ["alphaDamageTotal"], statGroups: ["fpsWeapon", "shipWeapon"] },
  GPP_Weapon_FireRate: { label: "Fire Rate", statKeys: ["fireRateRpm"], statGroups: ["fpsWeapon", "shipWeapon"] },
  GPP_Weapon_Spread: { label: "Spread", statKeys: ["adsSpread", "hipFireSpreadMin"], statGroups: ["fpsWeapon"] },
  GPP_Weapon_HullScraping_Efficiency: { label: "Hull Scraping Efficiency", statKeys: [], statGroups: [] },
  GPP_Weapon_HullScraping_Radius: { label: "Hull Scraping Radius", statKeys: [], statGroups: [] },
  GPP_Weapon_HullScraping_Speed: { label: "Hull Scraping Speed", statKeys: [], statGroups: [] },
  GPP_Weapon_Tractor_Force: { label: "Tractor Force", statKeys: [], statGroups: [] },
  GPP_Weapon_Tractor_FullStrengthDist: { label: "Tractor Full Strength Dist", statKeys: [], statGroups: [] },
  GPP_Weapon_Tractor_MaxDist: { label: "Tractor Max Distance", statKeys: [], statGroups: [] },
  GPP_Weapon_Tractor_MaxVolume: { label: "Tractor Max Volume", statKeys: [], statGroups: [] },
  GPP_Shield_MaxHealth: { label: "Shield HP", statKeys: ["maxShieldHealth"], statGroups: ["shield"] },
  GPP_Health_MaxHealth: { label: "Health", statKeys: ["health"], statGroups: ["generic"] },
  GPP_ItemResource_PowerGeneration: { label: "Power Generation", statKeys: ["powerGeneration"], statGroups: ["powerPlant"] },
  GPP_ItemResource_CoolantGeneration: { label: "Coolant Generation", statKeys: ["coolantGeneration"], statGroups: ["cooler"] },
  GPP_Quantum_FuelRequirement: { label: "Quantum Fuel Req.", statKeys: ["quantumFuelRequirement"], statGroups: ["quantumDrive"] },
  GPP_Quantum_Speed: { label: "Quantum Speed", statKeys: ["normalJumpSpeed"], statGroups: ["quantumDrive"] },
  GPP_Radar_MaxAimAssistDistance: { label: "Aim Assist Max Range", statKeys: ["aimAssistRangeMax"], statGroups: ["radar"] },
  GPP_Radar_MinAimAssistDistance: { label: "Aim Assist Min Range", statKeys: ["aimAssistRangeMin"], statGroups: ["radar"] },
};

export function getCraftingImpactClass(impact: "good" | "bad" | "neutral"): string {
  if (impact === "good") return "craft-ok";
  if (impact === "bad") return "craft-shortage";
  return "";
}

export function formatCraftingCompactNumber(value: number, options: { sign?: boolean } = {}): string {
  if (!Number.isFinite(value)) return "-";
  const rounded = Math.round(value * 100) / 100;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  const formatted = normalized.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
  return options.sign && normalized > 0 ? `+${formatted}` : formatted;
}

export function formatCraftingModifierPercent(value: number): string {
  if (!Number.isFinite(value)) return "-";
  const rounded = Math.round(value * 10) / 10;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  const formatted = normalized.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(normalized) ? 0 : 1,
    maximumFractionDigits: Number.isInteger(normalized) ? 0 : 1,
  });
  return `${normalized > 0 ? "+" : ""}${formatted}%`;
}

export function formatCraftingContributionValue(value: number, modifierMode?: string): string {
  if (modifierMode === "integerAdditive") {
    const v = Math.round(value);
    return `${v >= 0 ? "+" : ""}${v}`;
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function formatModifierStatName(property: string): string {
  const labels: Record<string, string> = {
    GPP_Health_MaxHealth: "HP",
    GPP_Shield_MaxHealth: "Shield HP",
    GPP_ItemResource_PowerGeneration: "Power",
    GPP_ItemResource_CoolantGeneration: "Coolant",
    GPP_Quantum_FuelRequirement: "Quantum Fuel",
    GPP_Quantum_Speed: "Quantum Speed",
    GPP_Radar_MaxAimAssistDistance: "Radar Max",
    GPP_Radar_MinAimAssistDistance: "Radar Min",
    GPP_Weapon_Damage: "Damage",
    GPP_Weapon_FireRate: "Fire Rate",
    GPP_Weapon_ReloadSpeed: "Reload",
    GPP_Weapon_Spread: "Spread",
    GPP_Weapon_Recoil_Kick: "Recoil Kick",
    GPP_Weapon_Recoil_Handling: "Recoil Handling",
    GPP_Weapon_Recoil_Smoothness: "Recoil Smoothness",
  };

  return labels[property] ?? formatProperty(property);
}

export function getCraftingModifierBaseValue(
  fittingDetail: FittingComponentDetail | null | undefined,
  property: string,
): number | undefined {
  return getFittingModifierBaseValue(fittingDetail, property);
}

export function applyModifierToBase(baseValue: number, modifierValue: number, modifierMode?: string): number {
  if (modifierMode === "integerAdditive") return baseValue + modifierValue;
  return baseValue * (1 + modifierValue / 100);
}

export function formatModifiedNumber(value: number, property: string): string {
  if (!Number.isFinite(value)) return "-";

  const rounded =
    property === "GPP_ItemResource_PowerGeneration"
      ? Math.round(value)
      : Math.round(value * 100) / 100;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  const formatted = normalized.toLocaleString("en-US", {
    maximumFractionDigits: Number.isInteger(normalized) ? 0 : 2,
  });

  if (property === "GPP_ItemResource_PowerGeneration") {
    return `${formatted} ${Math.abs(normalized) === 1 ? "pip" : "pips"}`;
  }

  return formatted;
}

function formatSignedModifiedNumber(value: number, property: string): string {
  const formatted = formatModifiedNumber(value, property);
  if (!Number.isFinite(value) || value <= 0 || formatted === "-") return formatted;
  return `+${formatted}`;
}

export type MaterialModifierDisplay = {
  base?: string;
  basePercent?: string;
  modifier: string;
  modifierPercent?: string;
  total?: string;
  totalPercent?: string;
};

export function formatMaterialModifierDisplay(
  property: string,
  baseValue: number | undefined,
  modifierValue: number,
  modifierMode?: string,
): MaterialModifierDisplay {
  const rawPercent = modifierMode === "integerAdditive" ? undefined : formatCraftingContributionValue(modifierValue, modifierMode);

  if (baseValue === undefined) {
    return {
      modifier: formatCraftingContributionValue(modifierValue, modifierMode),
      modifierPercent: rawPercent,
    };
  }

  const modifiedValue = applyModifierToBase(baseValue, modifierValue, modifierMode);
  const modifierDelta = modifiedValue - baseValue;
  const deltaPercent =
    baseValue !== 0 ? (modifierDelta / baseValue) * 100 : undefined;

  const totalPercentNum =
    typeof deltaPercent === "number" ? deltaPercent : undefined;

  return {
    base: formatModifiedNumber(baseValue, property),
    basePercent: rawPercent,
    modifier: formatSignedModifiedNumber(modifierDelta, property),
    modifierPercent: deltaPercent !== undefined ? formatCraftingModifierPercent(deltaPercent) : undefined,
    total: formatModifiedNumber(modifiedValue, property),
    totalPercent: totalPercentNum !== undefined ? formatCraftingModifierPercent(totalPercentNum) : undefined,
  };
}

export function formatModifierDifference(display: MaterialModifierDisplay): string {
  if (display.modifierPercent && display.modifierPercent !== display.modifier) {
    return `${display.modifierPercent} / ${display.modifier}`;
  }

  return display.modifier;
}

export function normalizeDetailStatLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findDetailStatRowIndex(
  rowIndexByLabel: Map<string, number>,
  label: string,
): number | undefined {
  for (const key of modifierDetailStatLabelKeys(label)) {
    const index = rowIndexByLabel.get(key);
    if (index !== undefined) return index;
  }
  return undefined;
}

function getModifierStatBinding(property: string): ModifierStatBinding {
  return MODIFIER_STAT_BINDINGS[property] ?? {
    label: formatModifierStatName(property),
    statKeys: [],
  };
}

function getTotalModifierForProperty(
  totalModifiers: TotalModifierRow[],
  property: string,
): TotalModifierRow | undefined {
  return totalModifiers.find((row) => row.property === property);
}

function buildDpsModifierDisplay(
  fittingDetail: FittingComponentDetail | null | undefined,
  totalModifiers: TotalModifierRow[],
): DetailStatModifier | undefined {
  const { dps: baseDps, alphaDamage: baseDamage, fireRateRpm: baseFireRate } = getFittingDpsBases(fittingDetail);
  if (baseDps === undefined || baseDps <= 0) return undefined;

  let scale = 1;

  const damageModifier = getTotalModifierForProperty(totalModifiers, "GPP_Weapon_Damage");
  if (damageModifier && baseDamage !== undefined && baseDamage > 0) {
    const modifiedDamage = applyModifierToBase(
      baseDamage,
      damageModifier.totalValue,
      damageModifier.modifierMode,
    );
    scale *= modifiedDamage / baseDamage;
  }

  const fireRateModifier = getTotalModifierForProperty(totalModifiers, "GPP_Weapon_FireRate");
  if (fireRateModifier && baseFireRate !== undefined && baseFireRate > 0) {
    const modifiedFireRate = applyModifierToBase(
      baseFireRate,
      fireRateModifier.totalValue,
      fireRateModifier.modifierMode,
    );
    scale *= modifiedFireRate / baseFireRate;
  }

  if (scale === 1) return undefined;

  const delta = baseDps * scale - baseDps;
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.005) return undefined;

  return {
    value: formatCraftingCompactNumber(delta, { sign: true }),
    impactClass: getCraftingImpactClass(delta > 0 ? "good" : "bad"),
  };
}

export function buildModifiedDetailStatRows(
  fittingDetail: FittingComponentDetail | null | undefined,
  stats: ComponentCardMetric[],
  totalModifiers: TotalModifierRow[],
): DetailStatRow[] {
  const rows: DetailStatRow[] = stats.map((stat) => ({ ...stat }));
  const rowIndexByLabel = new Map(
    rows.map((row, index) => [normalizeDetailStatLabel(row.label), index]),
  );

  for (const modifier of totalModifiers) {
    if (!Number.isFinite(modifier.totalValue) || Math.abs(modifier.totalValue) < 0.000001) continue;

    const binding = getModifierStatBinding(modifier.property);
    const baseValue = getCraftingModifierBaseValue(fittingDetail, modifier.property);
    const display = formatMaterialModifierDisplay(
      modifier.property,
      baseValue,
      modifier.totalValue,
      modifier.modifierMode,
    );
    const impact = getModifierImpact(modifier.property, modifier.totalValue);
    const impactClass = getCraftingImpactClass(impact);
    const modifierDisplay: DetailStatModifier = {
      value: formatModifierDifference(display),
      impactClass,
      base: display.base,
    };
    const existingIndex = findDetailStatRowIndex(rowIndexByLabel, binding.label);

    if (existingIndex !== undefined && baseValue !== undefined) {
      rows[existingIndex] = {
        ...rows[existingIndex],
        value: display.total ?? rows[existingIndex].value,
        modifier: modifierDisplay,
      };
      continue;
    }

    const value = baseValue !== undefined
      ? display.total ?? display.base ?? rows[existingIndex ?? -1]?.value ?? ""
      : display.modifierPercent ?? display.modifier;

    if (!value) continue;

    const nextRow: DetailStatRow = {
      label: binding.label,
      value,
      modifier: baseValue !== undefined ? modifierDisplay : undefined,
      valueImpactClass: baseValue === undefined ? impactClass : undefined,
    };

    rows.push(nextRow);
    rowIndexByLabel.set(normalizeDetailStatLabel(nextRow.label), rows.length - 1);
  }

  const dpsIndex = rowIndexByLabel.get(normalizeDetailStatLabel("DPS"));
  const dpsModifier = dpsIndex !== undefined ? buildDpsModifierDisplay(fittingDetail, totalModifiers) : undefined;
  if (dpsIndex !== undefined && dpsModifier) {
    rows[dpsIndex] = {
      ...rows[dpsIndex],
      modifier: dpsModifier,
    };
  }

  return rows;
}
