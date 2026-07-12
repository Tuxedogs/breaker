import type { FittingComponentDetail } from "../fitting/fittingApi";
import { buildItemSummaryDetailStatRows } from "../fitting/fittingStatProjection";
import {
  buildModifiedDetailStatRows,
  type DetailStatRow,
} from "./craftingDetailStats";
import {
  buildDetailStatGroups,
  type DetailStatGroup,
} from "./detailStatGroups";
import type { TotalModifierRow } from "../../components/industry/crafting/utils/recipeQuality";

export type CraftStatIdentityBadge = {
  label: string;
  value: string;
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

export type CraftStatGroupView =
  | { title: string; kind: "flat"; stats: CraftStatValueView[] }
  | { title: string; kind: "nested"; subclusters: { title: string; stats: CraftStatValueView[] }[] }
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

function toGroupView(group: DetailStatGroup): CraftStatGroupView {
  if (group.kind === "nested") {
    return {
      title: group.title,
      kind: "nested",
      subclusters: group.subclusters.map((subcluster) => ({
        title: subcluster.title,
        stats: subcluster.stats.map(toStatValueView),
      })),
    };
  }
  if (group.kind === "matrix") {
    return {
      title: group.title,
      kind: "matrix",
      columns: group.columns,
      rows: group.rows,
    };
  }
  return {
    title: group.title,
    kind: "flat",
    stats: group.stats.map(toStatValueView),
  };
}

function statsSectionTitle(detail: FittingComponentDetail): string {
  if (detail.type === "ship_weapon" || detail.type === "fps_weapon") return "Weapon Performance";
  if (detail.type === "fps_armor") return "FPS Armor Stats";
  return `${titleCase(detail.type)} Stats`;
}

export function buildCraftStatViewModel(input: {
  detail: FittingComponentDetail | null | undefined;
  totalModifiers?: TotalModifierRow[];
  loading?: boolean;
  missing?: boolean;
  error?: string | null;
}): CraftStatViewModel {
  const { detail, totalModifiers = [], loading = false, missing = false, error = null } = input;

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

  const baseRows = buildItemSummaryDetailStatRows(detail);
  const displayRows = buildModifiedDetailStatRows(detail, baseRows, totalModifiers);
  const groups = buildDetailStatGroups(detail, displayRows).map(toGroupView);

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
