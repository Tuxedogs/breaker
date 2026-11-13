import type { ComponentCardIndexRecord } from "../../../../lib/componentCardIndex.js";
import { getRecipeBrowserFamily, type RecipeBrowserColumn } from "./recipeBrowserPresentation.js";

/**
 * One ordering contract for the Crafting catalog. The browser API sorts the
 * full filtered result set with this before paginating, and the client uses
 * the same function when it paginates locally, so ordering never depends on
 * which page is loaded.
 *
 * URL contract: `sort=<column key>` and `dir=asc|desc`. "component" is the
 * component name. A record whose family has no such column, or whose value is
 * missing, sorts after every record that has one, in either direction.
 */

export type RecipeBrowserSortDirection = "ascending" | "descending";
export type RecipeBrowserSort = { key: string; direction: RecipeBrowserSortDirection };

export const RECIPE_BROWSER_SORT_PARAM = "sort";
export const RECIPE_BROWSER_SORT_DIRECTION_PARAM = "dir";
const SORT_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,40}$/;

export function parseRecipeBrowserSort(params: URLSearchParams): RecipeBrowserSort | null {
  const key = params.get(RECIPE_BROWSER_SORT_PARAM)?.trim() ?? "";
  if (!key || !SORT_KEY_PATTERN.test(key)) return null;
  const dir = params.get(RECIPE_BROWSER_SORT_DIRECTION_PARAM);
  return { key, direction: dir === "desc" ? "descending" : "ascending" };
}

export function defaultRecipeBrowserSortDirection(key: string): RecipeBrowserSortDirection {
  return key === "component" ? "ascending" : "descending";
}

function findColumn(record: ComponentCardIndexRecord, key: string): RecipeBrowserColumn | undefined {
  const family = getRecipeBrowserFamily(record);
  return family.columns.find((column) => column.key === key)
    ?? family.compactColumns.find((column) => column.key === key);
}

type SortKey = { missing: true } | { missing: false; number: number | null; text: string };

function numeric(value: number | string): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function sortKeyFor(record: ComponentCardIndexRecord, key: string): SortKey {
  if (key === "component") return { missing: false, number: null, text: record.name ?? "" };
  const column = findColumn(record, key);
  if (!column) return { missing: true };
  const raw = column.sortValue?.(record) ?? column.value(record);
  if (raw === null || raw === undefined || raw === "—" || raw === "") return { missing: true };
  return { missing: false, number: numeric(raw), text: String(raw) };
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function compareKeys(a: SortKey, b: SortKey): number {
  if (!("number" in a && "number" in b)) return 0; // handled by the caller
  if (a.number !== null && b.number !== null) return a.number - b.number;
  return collator.compare(a.text, b.text);
}

/** Returns a new array sorted by `sort`; stable, with name and id tie-breakers. */
export function sortRecipeBrowserRecords<T extends ComponentCardIndexRecord>(
  records: readonly T[],
  sort: RecipeBrowserSort | null,
): T[] {
  if (!sort) return [...records];
  const direction = sort.direction === "descending" ? -1 : 1;
  const keyed = records.map((record, index) => ({ record, index, key: sortKeyFor(record, sort.key) }));
  keyed.sort((a, b) => {
    if (a.key.missing !== b.key.missing) return a.key.missing ? 1 : -1;
    const compared = compareKeys(a.key, b.key) * direction;
    if (compared) return compared;
    const byName = collator.compare(a.record.name ?? "", b.record.name ?? "");
    if (byName) return byName;
    const byId = String(a.record.id).localeCompare(String(b.record.id));
    return byId || a.index - b.index;
  });
  return keyed.map((entry) => entry.record);
}

/** Column choices for a set of records: Component first, then each family column once. */
export function recipeBrowserSortOptions(records: readonly ComponentCardIndexRecord[]): Array<{ key: string; label: string }> {
  const options = new Map<string, string>([["component", "Component"]]);
  for (const record of records) {
    for (const column of getRecipeBrowserFamily(record).columns) {
      if (!options.has(column.key)) options.set(column.key, column.label);
    }
  }
  return [...options].map(([key, label]) => ({ key, label }));
}
