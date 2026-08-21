import {
  isHiddenCraftStatLabel,
  toCraftStatDisplayLabel,
  type DetailStatRow,
} from "./craftingDetailStats";
import type { DetailStatGroup } from "./detailStatGroups";

export type DetailStatScanSection =
  | {
    key: string;
    kind: "stats";
    title: string;
    stats: DetailStatRow[];
  }
  | {
    key: string;
    kind: "matrix";
    title: string;
    columns: string[];
    rows: Array<{ label: string; values: string[] }>;
  };

function visibleDisplayStats(stats: DetailStatRow[]): DetailStatRow[] {
  return stats
    .filter((stat) => !isHiddenCraftStatLabel(stat.label))
    .map((stat) => ({ ...stat, label: toCraftStatDisplayLabel(stat.label) }));
}

function sectionWeight(section: DetailStatScanSection): number {
  return (section.kind === "stats" ? section.stats.length : section.rows.length) + 1;
}

/**
 * Preserve the semantic groups used by Build Queue instead of flattening
 * subtype-specific subclusters into an undifferentiated statistics list.
 */
export function buildDetailStatScanSections(
  groups: DetailStatGroup[],
  fallbackStats: DetailStatRow[] = [],
): DetailStatScanSection[] {
  if (groups.length === 0 && fallbackStats.length > 0) {
    return [{
      key: "stats:core",
      kind: "stats",
      title: "Core Statistics",
      stats: visibleDisplayStats(fallbackStats),
    }];
  }

  const sections: DetailStatScanSection[] = [];

  for (const group of groups) {
    if (group.kind === "matrix") {
      sections.push({
        key: `matrix:${group.title}`,
        kind: "matrix",
        title: group.title,
        columns: group.columns,
        rows: group.rows,
      });
      continue;
    }

    if (group.kind === "nested") {
      for (const subcluster of group.subclusters) {
        sections.push({
          key: `${group.title}:${subcluster.title}`,
          kind: "stats",
          title: subcluster.title,
          stats: visibleDisplayStats(subcluster.stats),
        });
      }
      continue;
    }

    sections.push({
      key: `stats:${group.title}`,
      kind: "stats",
      title: group.title,
      stats: visibleDisplayStats(group.stats),
    });
  }

  return sections;
}

/**
 * Build balanced, contiguous scan columns. Keeping each column as a source-order
 * slice means the responsive single-column layout preserves the full semantic
 * sequence instead of interleaving groups that were balanced for desktop.
 */
export function splitDetailStatScanColumns(
  sections: DetailStatScanSection[],
  columnCount = 2,
): DetailStatScanSection[][] {
  const safeColumnCount = Math.min(
    sections.length,
    Math.max(1, Math.trunc(columnCount)),
  );
  if (safeColumnCount <= 1) return sections.length > 0 ? [sections] : [];

  const columns: DetailStatScanSection[][] = [];
  let start = 0;

  for (let columnIndex = 0; columnIndex < safeColumnCount - 1; columnIndex += 1) {
    const columnsRemaining = safeColumnCount - columnIndex;
    const lastSplit = sections.length - (columnsRemaining - 1);
    const remainingWeight = sections
      .slice(start)
      .reduce((total, section) => total + sectionWeight(section), 0);
    const targetWeight = remainingWeight / columnsRemaining;
    let split = start + 1;
    let runningWeight = 0;
    let bestDifference = Number.POSITIVE_INFINITY;

    for (let candidate = start; candidate < lastSplit; candidate += 1) {
      runningWeight += sectionWeight(sections[candidate]);
      const difference = Math.abs(targetWeight - runningWeight);
      if (difference > bestDifference) break;
      bestDifference = difference;
      split = candidate + 1;
    }

    columns.push(sections.slice(start, split));
    start = split;
  }

  columns.push(sections.slice(start));
  return columns.filter((column) => column.length > 0);
}

export function formatDetailStatSectionTitle(value: string): string {
  return value
    .replace(/\s*\/\s*/g, " and ")
    .replace(/\s*&\s*/g, " and ");
}
