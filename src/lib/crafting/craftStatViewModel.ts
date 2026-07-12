import type { FittingComponentDetail } from "../fitting/fittingApi";
import { buildItemSummaryDetailStatRows } from "../fitting/fittingStatProjection";
import {
  buildModifiedDetailStatRows,
  formatMaterialModifierDisplay,
  getCraftingImpactClass,
  getCraftingModifierBaseValue,
  normalizeDetailStatLabel,
  type DetailStatRow,
} from "./craftingDetailStats";
import {
  buildDetailStatGroups,
  type DetailStatGroup,
} from "./detailStatGroups";
import type { ComponentRecipe } from "../../components/industry/crafting/utils/craftingTypes";
import {
  getTotalModifierKey,
  type TotalModifierRow,
} from "../../components/industry/crafting/utils/recipeQuality";
import { PROPERTY_DIRECTION } from "../gameplay/propertyMeta";
import { getModifierImpact } from "../gameplay/propertyUtils";

export type CraftStatIdentityBadge = {
  label: string;
  value: string;
};

export type CraftStatBenefitDirection = "higher-is-better" | "lower-is-better" | "neutral";

export type CraftStatProjectionState = "ready" | "not_set" | "no_allocation" | "unavailable";

export type CraftStatComparisonColumnView = {
  value: string;
  absoluteDelta?: string;
  percentDelta?: string;
  impactClass?: string;
  state: CraftStatProjectionState;
  emptyLabel?: string;
};

export type CraftStatComparisonRowView = {
  statId: string;
  groupId: string;
  label: string;
  benefitDirection: CraftStatBenefitDirection;
  baseValue: string;
  target: CraftStatComparisonColumnView;
  allocation: CraftStatComparisonColumnView;
};

/** Single stat cell: projected (material-adjusted) value is primary. */
export type CraftStatValueView = {
  label: string;
  projectedValue: string;
  baseValue?: string;
  delta?: string;
  impactClass?: string;
  valueImpactClass?: string;
};

export type CraftStatSubclusterView = {
  title: string;
  stats: CraftStatValueView[];
  comparisonRows?: CraftStatComparisonRowView[];
};

export type CraftStatGroupView =
  | { title: string; kind: "flat"; stats: CraftStatValueView[]; comparisonRows?: CraftStatComparisonRowView[] }
  | { title: string; kind: "nested"; subclusters: CraftStatSubclusterView[] }
  | { title: string; kind: "matrix"; columns: string[]; rows: { label: string; values: string[] }[] };

/**
 * Source-agnostic craft stats view model.
 * Consumers must not care whether `detail` came from fitting API, fixtures, or card fallback.
 */
export type CraftStatViewModel = {
  category: string;
  title: string;
  identity: CraftStatIdentityBadge[];
  groups: CraftStatGroupView[];
  status: "ready" | "loading" | "unavailable";
  unavailableReason?: string;
};

type ModifiablePropertyRef = {
  property: string;
  modifierMode?: string;
};

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildIdentityBadges(detail: FittingComponentDetail): CraftStatIdentityBadge[] {
  return [
    detail.size !== null ? { label: "Size", value: `S${detail.size}` } : null,
    detail.grade ? { label: "Grade", value: detail.grade } : null,
    detail.type === "fps_weapon" && detail.subtype
      ? { label: "Weapon Class", value: titleCase(detail.subtype) }
      : null,
    detail.type === "fps_armor" && detail.subtype
      ? { label: "Armor Slot", value: titleCase(detail.subtype) }
      : null,
    detail.type === "fps_armor" && detail.class
      ? { label: "Armor Weight", value: titleCase(detail.class) }
      : null,
    detail.type !== "fps_weapon" && detail.type !== "fps_armor" && detail.class
      ? { label: "Class", value: titleCase(detail.class) }
      : null,
    detail.manufacturer ? { label: "Maker", value: detail.manufacturer } : null,
  ].filter((badge): badge is CraftStatIdentityBadge => Boolean(badge));
}

function toStatValueView(stat: DetailStatRow): CraftStatValueView {
  return {
    label: stat.label,
    projectedValue: stat.value,
    baseValue: stat.modifier?.base,
    delta: stat.modifier?.value,
    impactClass: stat.modifier?.impactClass,
    valueImpactClass: stat.valueImpactClass,
  };
}

function getBenefitDirection(property: string): CraftStatBenefitDirection {
  const direction = PROPERTY_DIRECTION[property];
  if (direction === "higher") return "higher-is-better";
  if (direction === "lower") return "lower-is-better";
  return "neutral";
}

function collectRecipeModifiableProperties(recipe: ComponentRecipe): ModifiablePropertyRef[] {
  const seen = new Map<string, ModifiablePropertyRef>();

  for (const mat of recipe.materials) {
    for (const modifier of mat.qualityModifiers ?? []) {
      const property = modifier.gameplay_property;
      const key = getTotalModifierKey(property, modifier.modifier_mode);
      if (!seen.has(key)) {
        seen.set(key, {
          property,
          modifierMode: modifier.modifier_mode,
        });
      }
    }
  }

  return Array.from(seen.values());
}

function getModifierTotal(
  modifiers: TotalModifierRow[],
  property: string,
  modifierMode?: string,
): number {
  const row = modifiers.find((entry) => (
    entry.property === property && entry.modifierMode === modifierMode
  ));
  return row?.totalValue ?? 0;
}

function formatComparisonDelta(
  property: string,
  modifierValue: number,
  modifierMode?: string,
): { absoluteDelta?: string; percentDelta?: string; impactClass?: string } {
  const impact = getModifierImpact(property, modifierValue);
  const impactClass = getCraftingImpactClass(impact);
  const display = formatMaterialModifierDisplay(property, undefined, modifierValue, modifierMode);

  if (modifierMode === "integerAdditive") {
    return {
      absoluteDelta: display.modifier,
      impactClass,
    };
  }

  return {
    absoluteDelta: display.modifier !== display.modifierPercent ? display.modifier : undefined,
    percentDelta: display.modifierPercent ?? display.modifier,
    impactClass,
  };
}

function buildComparisonColumn(
  property: string,
  baseValue: number | undefined,
  modifierValue: number,
  modifierMode: string | undefined,
  state: CraftStatProjectionState,
  emptyLabel?: string,
): CraftStatComparisonColumnView {
  if (state !== "ready") {
    return {
      value: emptyLabel ?? "Unavailable",
      state,
      emptyLabel,
    };
  }

  const display = formatMaterialModifierDisplay(property, baseValue, modifierValue, modifierMode);
  const impact = getModifierImpact(property, modifierValue);
  const impactClass = getCraftingImpactClass(impact);
  const value = baseValue !== undefined
    ? display.total ?? display.base ?? "-"
    : formatComparisonDelta(property, modifierValue, modifierMode).percentDelta
      ?? formatComparisonDelta(property, modifierValue, modifierMode).absoluteDelta
      ?? "0%";

  const deltas = formatComparisonDelta(property, modifierValue, modifierMode);

  return {
    value,
    absoluteDelta: deltas.absoluteDelta,
    percentDelta: deltas.percentDelta,
    impactClass,
    state,
  };
}

function getModifierBindingLabel(property: string): string {
  const bindings: Record<string, string> = {
    GPP_Weapon_Damage: "Alpha Damage",
    GPP_Weapon_FireRate: "Fire Rate",
    GPP_Weapon_Spread: "Spread",
    GPP_Shield_MaxHealth: "Shield HP",
    GPP_Health_MaxHealth: "Health",
    GPP_ItemResource_PowerGeneration: "Power Generation",
    GPP_ItemResource_CoolantGeneration: "Coolant Generation",
    GPP_Quantum_FuelRequirement: "Quantum Fuel Req.",
    GPP_Quantum_Speed: "Quantum Speed",
    GPP_Radar_MaxAimAssistDistance: "Aim Assist Max Range",
    GPP_Radar_MinAimAssistDistance: "Aim Assist Min Range",
  };
  return bindings[property] ?? property.replace(/^GPP_/, "").replace(/_/g, " ");
}

function buildComparisonRows(input: {
  detail: FittingComponentDetail;
  recipe: ComponentRecipe;
  targetModifiers: TotalModifierRow[];
  allocationModifiers: TotalModifierRow[];
  targetConfigured: boolean;
  allocationConfigured: boolean;
}): CraftStatComparisonRowView[] {
  const {
    detail,
    recipe,
    targetModifiers,
    allocationModifiers,
    targetConfigured,
    allocationConfigured,
  } = input;

  return collectRecipeModifiableProperties(recipe).map((entry) => {
    const baseValue = getCraftingModifierBaseValue(detail, entry.property);
    const baseDisplay = baseValue !== undefined
      ? formatMaterialModifierDisplay(entry.property, baseValue, 0, entry.modifierMode).base ?? "-"
      : "-";
    const label = getModifierBindingLabel(entry.property);
    const targetValue = getModifierTotal(targetModifiers, entry.property, entry.modifierMode);
    const allocationValue = getModifierTotal(allocationModifiers, entry.property, entry.modifierMode);

    return {
      statId: getTotalModifierKey(entry.property, entry.modifierMode),
      groupId: normalizeDetailStatLabel(label),
      label,
      benefitDirection: getBenefitDirection(entry.property),
      baseValue: baseDisplay,
      target: buildComparisonColumn(
        entry.property,
        baseValue,
        targetValue,
        entry.modifierMode,
        targetConfigured ? "ready" : "not_set",
        "Not set",
      ),
      allocation: buildComparisonColumn(
        entry.property,
        baseValue,
        allocationValue,
        entry.modifierMode,
        allocationConfigured ? "ready" : "no_allocation",
        "No allocation",
      ),
    };
  });
}

function splitStatsForComparison(
  stats: DetailStatRow[],
  comparisonByLabel: Map<string, CraftStatComparisonRowView>,
): { staticStats: CraftStatValueView[]; comparisonRows: CraftStatComparisonRowView[] } {
  const comparisonRows: CraftStatComparisonRowView[] = [];
  const staticStats: CraftStatValueView[] = [];

  for (const stat of stats) {
    const comparison = comparisonByLabel.get(normalizeDetailStatLabel(stat.label));
    if (comparison) {
      comparisonRows.push(comparison);
      continue;
    }
    staticStats.push(toStatValueView(stat));
  }

  return { staticStats, comparisonRows };
}

function attachComparisonRows(
  groups: DetailStatGroup[],
  comparisonByLabel: Map<string, CraftStatComparisonRowView>,
): CraftStatGroupView[] {
  const used = new Set<string>();

  const mapped = groups.map((group) => {
    if (group.kind === "matrix") {
      return {
        title: group.title,
        kind: "matrix" as const,
        columns: group.columns,
        rows: group.rows,
      };
    }

    if (group.kind === "nested") {
      return {
        title: group.title,
        kind: "nested" as const,
        subclusters: group.subclusters.map((subcluster) => {
          const split = splitStatsForComparison(subcluster.stats, comparisonByLabel);
          for (const row of split.comparisonRows) used.add(row.statId);
          return {
            title: subcluster.title,
            stats: split.staticStats,
            comparisonRows: split.comparisonRows.length > 0 ? split.comparisonRows : undefined,
          };
        }),
      };
    }

    const split = splitStatsForComparison(group.stats, comparisonByLabel);
    for (const row of split.comparisonRows) used.add(row.statId);

    return {
      title: group.title,
      kind: "flat" as const,
      stats: split.staticStats,
      comparisonRows: split.comparisonRows.length > 0 ? split.comparisonRows : undefined,
    };
  });

  const remaining = [...comparisonByLabel.values()].filter((row) => !used.has(row.statId));
  if (remaining.length === 0) return mapped;

  return [
    ...mapped,
    {
      title: "Material Modifiers",
      kind: "flat" as const,
      stats: [],
      comparisonRows: remaining,
    },
  ];
}

function statsSectionTitle(detail: FittingComponentDetail): string {
  if (detail.type === "ship_weapon" || detail.type === "fps_weapon") return "Weapon Performance";
  if (detail.type === "fps_armor") return "FPS Armor Stats";
  return `${titleCase(detail.type)} Stats`;
}

export function buildCraftStatViewModel(input: {
  detail: FittingComponentDetail | null | undefined;
  recipe?: ComponentRecipe | null;
  targetModifiers?: TotalModifierRow[];
  allocationModifiers?: TotalModifierRow[];
  /** @deprecated Use allocationModifiers */
  totalModifiers?: TotalModifierRow[];
  targetConfigured?: boolean;
  allocationConfigured?: boolean;
  loading?: boolean;
  missing?: boolean;
  error?: string | null;
}): CraftStatViewModel {
  const {
    detail,
    recipe = null,
    targetModifiers = [],
    allocationModifiers: allocationModifiersInput,
    totalModifiers = [],
    targetConfigured = false,
    allocationConfigured = false,
    loading = false,
    missing = false,
    error = null,
  } = input;
  const allocationModifiers = allocationModifiersInput ?? totalModifiers;

  if (loading && !detail) {
    return {
      category: "unknown",
      title: "Component Stats",
      identity: [],
      groups: [],
      status: "loading",
    };
  }

  if (!detail || missing || error) {
    return {
      category: detail?.type ?? "unknown",
      title: "Component Stats",
      identity: detail ? buildIdentityBadges(detail) : [],
      groups: [],
      status: "unavailable",
      unavailableReason: error ?? (missing ? "Stats unavailable" : "Stats unavailable"),
    };
  }

  const comparisonRows = recipe
    ? buildComparisonRows({
      detail,
      recipe,
      targetModifiers,
      allocationModifiers,
      targetConfigured,
      allocationConfigured,
    })
    : [];

  const comparisonByLabel = new Map(
    comparisonRows.map((row) => [row.groupId, row] as const),
  );
  const baseRows = buildItemSummaryDetailStatRows(detail);
  const displayRows = buildModifiedDetailStatRows(detail, baseRows, allocationModifiers);
  const detailGroups = buildDetailStatGroups(detail, displayRows);
  const groups = attachComparisonRows(detailGroups, comparisonByLabel);

  if (groups.length === 0) {
    return {
      category: detail.type,
      title: statsSectionTitle(detail),
      identity: buildIdentityBadges(detail),
      groups: [],
      status: "unavailable",
      unavailableReason: "Stats unavailable",
    };
  }

  return {
    category: detail.type,
    title: statsSectionTitle(detail),
    identity: buildIdentityBadges(detail),
    groups,
    status: "ready",
  };
}

export function listAmbiguousBenefitDirectionProperties(recipe: ComponentRecipe): string[] {
  return collectRecipeModifiableProperties(recipe)
    .map((entry) => entry.property)
    .filter((property) => !PROPERTY_DIRECTION[property]);
}
