import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchSavedBlueprints } from "@/lib/userSavedBlueprints";
import { useAuthSession } from "@/lib/auth/useAuthSession";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { getComponentCategoryIconUrl } from "@/lib/componentCategoryIcon";
import {
  getComponentCardVariantGroupKey,
  pickComponentCardGroupRepresentative,
} from "../utils/componentCardVariants";
import {
  filterRecipeBrowserRecords,
  compareRecipeBrowserRecords,
  compareRecipeBrowserSearchRecords,
  getRecipeBrowserSearchParam,
  pickPreferredRecipeBrowserSearchRecord,
} from "../utils/recipeBrowserFilters";
import {
  getRecipeBrowserColumnWidth,
  getRecipeBrowserFamily,
  type RecipeBrowserColumn,
  type RecipeBrowserFamily,
} from "../utils/recipeBrowserPresentation";
import type { CraftingBrowserLayoutMode } from "../utils/craftingBrowserLayout";

const SAVED_BLUEPRINT_STORAGE_KEY = "scintel:recipe:bookmarks:v1";
const MOBILE_TABLET_RESULTS_PER_PAGE = 18;
const DESKTOP_RESULTS_PER_PAGE = 40;
const DESKTOP_MIN_WIDTH = 981;

function resolveResultsPerPage(viewportWidth: number): number {
  return viewportWidth >= DESKTOP_MIN_WIDTH
    ? DESKTOP_RESULTS_PER_PAGE
    : MOBILE_TABLET_RESULTS_PER_PAGE;
}

function useResultsPerPage(): number {
  const [resultsPerPage, setResultsPerPage] = useState(() => {
    if (typeof window === "undefined") return MOBILE_TABLET_RESULTS_PER_PAGE;
    return resolveResultsPerPage(window.innerWidth);
  });

  useEffect(() => {
    const update = () => setResultsPerPage(resolveResultsPerPage(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return resultsPerPage;
}

function readStoredStringSet(key: string): Set<string> {
  if (typeof window === "undefined" || !window.localStorage) return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    const values = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(values) ? values.filter((value): value is string => typeof value === "string") : [],
    );
  } catch {
    return new Set();
  }
}

function ComponentBrowserState({ title, body }: { title: string; body: string }) {
  return (
    <section className="crb2-browser-state">
      <span>{title}</span>
      <p>{body}</p>
    </section>
  );
}



 


function RecipeResultsTable({
  family,
  records,
  selectedId,
  onSelect,
  layoutMode,
}: {
  family: RecipeBrowserFamily;
  records: ComponentCardIndexRecord[];
  selectedId: string;
  onSelect: (record: ComponentCardIndexRecord) => void;
  layoutMode: CraftingBrowserLayoutMode;
}) {
  type SortState = { key: string; direction: "ascending" | "descending" };
  const [sort, setSort] = useState<SortState | null>(null);
  const columns = layoutMode === "compact-split" ? family.compactColumns : family.columns;

  const compareValues = (
    a: ComponentCardIndexRecord,
    b: ComponentCardIndexRecord,
    column?: RecipeBrowserColumn,
  ) => {
    const rawA = column?.sortValue?.(a) ?? column?.value(a) ?? a.name;
    const rawB = column?.sortValue?.(b) ?? column?.value(b) ?? b.name;
    const missingA = rawA === null || rawA === undefined || rawA === "—";
    const missingB = rawB === null || rawB === undefined || rawB === "—";
    if (missingA !== missingB) return missingA ? 1 : -1;

    const numeric = (value: number | string | null | undefined) => {
      if (typeof value === "number") return Number.isFinite(value) ? value : null;
      const parsed = Number(String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0]);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const numberA = numeric(rawA);
    const numberB = numeric(rawB);
    if (numberA !== null && numberB !== null) return numberA - numberB;
    return String(rawA ?? "").localeCompare(String(rawB ?? ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  };

  const sortedRecords = useMemo(() => {
    if (!sort) return records;
    const column = columns.find((item) => item.key === sort.key);
    const direction = sort.direction === "ascending" ? 1 : -1;
    return [...records].sort((a, b) => {
      const compared = sort.key === "component"
        ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
        : compareValues(a, b, column);
      return compared * direction;
    });
  }, [columns, records, sort]);
  const toggleSort = (key: string) => {
    setSort((current) => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === "descending" ? "ascending" : "descending",
        };
      }
      return { key, direction: key === "component" ? "ascending" : "descending" };
    });
  };

  const sortHeader = (key: string, label: string) => {
    const active = sort?.key === key;
    return (
      <button
        type="button"
        className={active ? "crb2-sort-button crb2-sort-button--active" : "crb2-sort-button"}
        onClick={() => toggleSort(key)}
      >
        <span>{label}</span>
        <span aria-hidden="true">{active ? (sort.direction === "descending" ? "↓" : "↑") : "↕"}</span>
      </button>
    );
  };

  const onRowKeyboard = (
    event: KeyboardEvent<HTMLTableRowElement>,
    record: ComponentCardIndexRecord,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSelect(record);
    } else if (event.key === " ") {
      event.preventDefault();
      onSelect(record);
    }
  };

  return (
    <section className="crb2-table-section" aria-labelledby={`crb2-family-${family.key}`}>
      <header>
        <h3 id={`crb2-family-${family.key}`}>{family.label}</h3>
        <span>{records.length} on this page</span>
      </header>
      <div className="crb2-table-scroll">
        <table className={`crb2-table${layoutMode === "compact-split" ? " crb2-table--compact" : ""}`}>
          <colgroup>
            <col className="crb2-table-column--component" />
            {columns.map((column) => {
              const width = layoutMode === "compact-split" ? column.width : getRecipeBrowserColumnWidth(column);
              return <col key={column.key} style={width ? { width } : undefined} />;
            })}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" aria-sort={sort?.key === "component" ? sort.direction : "none"}>
                {sortHeader("component", "Component")}
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={sort?.key === column.key ? sort.direction : "none"}
                >
                  {sortHeader(column.key, column.label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRecords.map((record) => {
              const selected = record.id === selectedId;
              return (
                <tr
                  key={record.id}
                  className={selected ? "crb2-table-row--selected" : undefined}
                  data-crafting-record-id={record.id}
                  tabIndex={0}
                  aria-selected={selected}
                  onClick={() => onSelect(record)}
                  onDoubleClick={() => onSelect(record)}
                  onKeyDown={(event) => onRowKeyboard(event, record)}
                >
                  <th scope="row">
                    <span className="crb2-row-name" title={record.name}>{record.name}</span>
                  </th>
                  {columns.map((column) => (
                    <td key={column.key}>{column.value(record)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="crb2-mobile-results">
        <div className="crb2-mobile-results-head">
          <span>{records.length} components</span>
          <button type="button" onClick={() => toggleSort("component")}>
            Sort: Name <span aria-hidden="true">{sort?.key === "component" && sort.direction === "descending" ? "↑" : "↓"}</span>
          </button>
        </div>
        <div className="crb2-mobile-card-list">
          {sortedRecords.map((record) => {
            const iconUrl = getComponentCategoryIconUrl(record);
            const classification = [
              record.size !== null ? `S${record.size}` : null,
              record.grade ? `Grade ${record.grade}` : null,
              record.class,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <button
                key={record.id}
                type="button"
                className="crb2-mobile-card crafting-catalog-card"
                data-crafting-record-id={record.id}
                onClick={() => onSelect(record)}
              >
                <span className="crb2-mobile-card-art crafting-component-art">
                  {iconUrl ? <img src={iconUrl} alt="" aria-hidden="true" /> : <span aria-hidden="true" />}
                </span>
                <span className="crb2-mobile-card-copy crafting-identity-copy">
                  <strong className="crafting-item-name">{record.name}</strong>
                  <span className="crb2-mobile-card-type crafting-family-label">{record.typeLabel}</span>
                  {classification ? <small className="crafting-meta-line">{classification}</small> : null}
                </span>
                <span className="crb2-mobile-card-chevron" aria-hidden="true">›</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function ComponentResultsBrowser({
  records,
  loading,
  error,
  previewId,
  onPreviewRecord,
  autoSelectFirstRecord = true,
  layoutMode,
}: {
  records: ComponentCardIndexRecord[];
  loading: boolean;
  error: string | null;
  isRecipeQueued: (record: ComponentCardIndexRecord) => boolean;
  previewId?: string | null;
  onPreviewRecord?: (record: ComponentCardIndexRecord) => void;
  autoSelectFirstRecord?: boolean;
  layoutMode: CraftingBrowserLayoutMode;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const savedOnly = searchParams.get("bk") === "1";
  const search = getRecipeBrowserSearchParam(searchParams);
  const page = Math.max(1, Number(searchParams.get("pg") ?? "1") || 1);
  const resultsPerPage = useResultsPerPage();

  const setPage = useCallback((value: number | ((previous: number) => number)) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      const currentPage = Math.max(1, Number(next.get("pg") ?? "1") || 1);
      const resolved = typeof value === "function" ? value(currentPage) : value;
      if (resolved <= 1) next.delete("pg");
      else next.set("pg", String(resolved));
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const [savedBlueprintIds, setSavedBlueprintIds] = useState<Set<string>>(
    () => readStoredStringSet(SAVED_BLUEPRINT_STORAGE_KEY),
  );
  const [selectedId, setSelectedId] = useState("");
  const lastPreviewIdRef = useRef<string | null>(previewId ?? null);
  const { session } = useAuthSession();

  useEffect(() => {
    const previousPreviewId = lastPreviewIdRef.current;
    lastPreviewIdRef.current = previewId ?? null;
    if (!previousPreviewId || previewId) return;

    const frame = window.requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(
        `[data-crafting-record-id="${CSS.escape(previousPreviewId)}"]`,
      );
      row?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [previewId]);

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!accessToken) return;
    let cancelled = false;
    fetchSavedBlueprints(accessToken)
      .then((saved) => {
        if (!cancelled) setSavedBlueprintIds(new Set(saved.map((item) => item.blueprintId)));
      })
      .catch(() => {
        if (!cancelled) setSavedBlueprintIds(new Set());
      });
    return () => { cancelled = true; };
  }, [session?.access_token]);

  const filteredRecords = useMemo(
    () => filterRecipeBrowserRecords(records, searchParams, {
      savedOnly,
      savedBlueprintIds,
    }),
    [records, savedBlueprintIds, savedOnly, searchParams],
  );

  const { groupedRecords,  } = useMemo(() => {
    const groups = new Map<string, ComponentCardIndexRecord[]>();
    const ungrouped: ComponentCardIndexRecord[] = [];
    for (const record of filteredRecords) {
      const key = getComponentCardVariantGroupKey(record);
      if (!key) {
        ungrouped.push(record);
        continue;
      }
      const members = groups.get(key);
      if (members) members.push(record);
      else groups.set(key, [record]);
    }

    const grouped = [...ungrouped];
    const counts = new Map<string, number>();
    for (const members of groups.values()) {
      const representative = pickComponentCardGroupRepresentative(members);
      grouped.push(representative);
      if (members.length > 1) counts.set(representative.id, members.length);
    }
    grouped.sort(search
      ? (a, b) => compareRecipeBrowserSearchRecords(a, b, search)
      : compareRecipeBrowserRecords);
    return { groupedRecords: grouped };
  }, [filteredRecords, search]);

  
  const totalPages = Math.max(1, Math.ceil(groupedRecords.length / resultsPerPage));
  const visiblePage = Math.min(page, totalPages);
  const pageStart = (visiblePage - 1) * resultsPerPage;
  const pageRecords = useMemo(
    () => groupedRecords.slice(pageStart, pageStart + resultsPerPage),
    [groupedRecords, pageStart, resultsPerPage],
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, setPage, totalPages]);

  const selectedCandidate = pageRecords.find((record) => record.id === (previewId ?? selectedId));
  const preferredRecord = pickPreferredRecipeBrowserSearchRecord(pageRecords, search);
  const shouldPreferWeapon = Boolean(
    search
    && selectedCandidate?.type === "ammo"
    && preferredRecord?.kind === "fps"
    && preferredRecord.type === "weapons",
  );
  const selectedRecord = autoSelectFirstRecord
    ? (!selectedCandidate || shouldPreferWeapon
      ? preferredRecord ?? pageRecords[0]
      : selectedCandidate)
    : selectedCandidate;

  const tableGroups = useMemo(() => {
    const groups = new Map<string, { family: RecipeBrowserFamily; records: ComponentCardIndexRecord[] }>();
    for (const record of pageRecords) {
      const family = getRecipeBrowserFamily(record);
      const group = groups.get(family.key);
      if (group) group.records.push(record);
      else groups.set(family.key, { family, records: [record] });
    }
    return [...groups.values()];
  }, [pageRecords]);

  const selectRecord = useCallback((record: ComponentCardIndexRecord) => {
    setSelectedId(record.id);
    onPreviewRecord?.(record);
  }, [onPreviewRecord]);

  if (loading) {
    return (
      <main className="crb2-results">
        <ComponentBrowserState title="Loading" body="Component blueprints are loading." />
      </main>
    );
  }

  if (error) {
    return (
      <main className="crb2-results">
        <ComponentBrowserState title="Error" body={error} />
      </main>
    );
  }

  if (!groupedRecords.length) {
    return (
      <main className="crb2-results">
        <ComponentBrowserState
          title="No Results"
          body="No craftable components match the current search and filters."
        />
      </main>
    );
  }

  return (
    <main className="crb2-results">
      

      <div className="crb2-list" aria-label="Component results">
        {tableGroups.map(({ family, records: familyRecords }) => (
          <RecipeResultsTable
            key={family.key}
            family={family}
            records={familyRecords}
            selectedId={selectedRecord?.id ?? ""}
            onSelect={selectRecord}
            layoutMode={layoutMode}
          />
        ))}
      </div>

      <footer className="crb2-pager" aria-label="Component results pages">
        <span>
          Showing {pageStart + 1}–{Math.min(pageStart + pageRecords.length, groupedRecords.length)}
          {" "}of {groupedRecords.length}
        </span>
        <div>
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={visiblePage <= 1}
          >
            Previous
          </button>
          <span>Page {visiblePage} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={visiblePage >= totalPages}
          >
            Next
          </button>
        </div>
      </footer>
    </main>
  );
}
