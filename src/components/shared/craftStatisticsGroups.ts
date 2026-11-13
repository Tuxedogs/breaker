import { toCraftStatDisplayLabel } from "@/lib/crafting/craftingDetailStats";
import type {
  CraftStatComparisonColumnView,
  CraftStatComparisonRowView,
  CraftStatViewModel,
} from "@/lib/crafting/craftStatViewModel";

/* Presentation grouping for the shared end-product statistics. Used by the
   statistics cards (Build Queue, full-page Crafting) and the Crafting lab table. */

export type ConsolidatedStat =
  | { kind: "comparison"; row: CraftStatComparisonRowView }
  | { kind: "static"; label: string; value: string };

export type ConsolidatedStatGroup = { title: string; stats: ConsolidatedStat[] };

const WEAPON_DAMAGE_CHANNEL_KEYS = new Set([
  "ballisticdamage", "physicaldamage", "energydamage", "distortiondamage", "thermaldamage",
  "biochemicaldamage", "stundamage",
]);

export function normalizeStatKey(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized === "componenthp") return "health";
  if (normalized.startsWith("weaponrecoil")) return normalized.slice("weapon".length);
  return normalized;
}

export function normalizeGroupKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function formatStatLabel(value: string): string {
  return toCraftStatDisplayLabel(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s*\/\s*/g, " and ");
}

export function formatCompactStatLabel(value: string): { label: string; metadata?: string } {
  const formatted = formatStatLabel(value);
  const derivedMatch = formatted.match(/^(.*?)(\s*\(derived\))$/i);
  return derivedMatch ? { label: derivedMatch[1].trim(), metadata: derivedMatch[2].trim() } : { label: formatted };
}

function prioritizeAlphaDamage(stats: ConsolidatedStat[]): ConsolidatedStat[] {
  const index = stats.findIndex((stat) => normalizeStatKey(stat.kind === "comparison" ? stat.row.label : stat.label) === "alphadamage");
  return index <= 0 ? stats : [stats[index], ...stats.slice(0, index), ...stats.slice(index + 1)];
}

/** One ordered list of statistic groups: static readings plus quality-comparison rows. */
export function buildConsolidatedGroups(model: CraftStatViewModel): ConsolidatedStatGroup[] {
  const comparisons = new Map(model.comparisonGroups.map((group) => [normalizeGroupKey(group.title), group] as const));
  const allComparisonKeys = new Set(model.comparisonGroups.flatMap((group) => group.rows.map((row) => normalizeStatKey(row.label))));
  const used = new Set<string>();
  const groups: ConsolidatedStatGroup[] = [];

  for (const overview of model.overviewGroups) {
    const key = normalizeGroupKey(overview.title);
    const comparison = comparisons.get(key);
    const comparisonKeys = new Set(comparison?.rows.map((row) => normalizeStatKey(row.label)) ?? []);
    const hasAlpha = comparisonKeys.has("alphadamage") || overview.stats.some((stat) => normalizeStatKey(stat.label) === "alphadamage");
    const stats: ConsolidatedStat[] = overview.stats
      .filter((stat) => !allComparisonKeys.has(normalizeStatKey(stat.label)) && !(hasAlpha && WEAPON_DAMAGE_CHANNEL_KEYS.has(normalizeStatKey(stat.label))))
      .map((stat) => ({ kind: "static", label: stat.label, value: stat.value }));
    if (comparison) {
      used.add(key);
      stats.push(...comparison.rows.map((row) => ({ kind: "comparison" as const, row })));
    }
    if (stats.length > 0) groups.push({ title: overview.title, stats: prioritizeAlphaDamage(stats) });
  }

  for (const comparison of model.comparisonGroups) {
    if (used.has(normalizeGroupKey(comparison.title))) continue;
    groups.push({ title: comparison.title, stats: prioritizeAlphaDamage(comparison.rows.map((row) => ({ kind: "comparison", row }))) });
  }
  return groups;
}

function hasNonZeroDelta(value: string | undefined): boolean {
  const parsed = Number.parseFloat(value?.replace(/[^0-9+.-]/g, "") ?? "");
  return Number.isFinite(parsed) && Math.abs(parsed) > 0.0001;
}

export function comparisonIsModified(row: CraftStatComparisonRowView): boolean {
  const differs = (column: CraftStatComparisonColumnView) => column.state === "ready" && (
    hasNonZeroDelta(column.percentDelta) || hasNonZeroDelta(column.absoluteDelta)
    || (column.percentDelta === undefined && column.absoluteDelta === undefined && column.value !== row.baseValue)
  );
  return differs(row.target) || differs(row.allocation);
}
