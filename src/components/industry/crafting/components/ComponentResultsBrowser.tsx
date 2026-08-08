import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { fetchSavedBlueprints } from "@/lib/userSavedBlueprints";
import { useAuthSession } from "@/lib/auth/useAuthSession";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
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
  getRecipeBrowserFamily,
  type RecipeBrowserColumn,
  type RecipeBrowserFamily,
} from "../utils/recipeBrowserPresentation";

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
  onOpen,
}: {
  family: RecipeBrowserFamily;
  records: ComponentCardIndexRecord[];
  selectedId: string;
  onSelect: (record: ComponentCardIndexRecord) => void;
  onOpen: (record: ComponentCardIndexRecord) => void;
}) {
  type SortState = { key: string; direction: "ascending" | "descending" };
  const [sort, setSort] = useState<SortState | null>(null);

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
    const column = family.columns.find((item) => item.key === sort.key);
    const direction = sort.direction === "ascending" ? 1 : -1;
    return [...records].sort((a, b) => {
      const compared = sort.key === "component"
        ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
        : compareValues(a, b, column);
      return compared * direction;
    });
  }, [family.columns, records, sort]);

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
      onOpen(record);
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
        <table className="crb2-table">
          <thead>
            <tr>
              <th scope="col" aria-sort={sort?.key === "component" ? sort.direction : "none"}>
                {sortHeader("component", "Component")}
              </th>
              {family.columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={sort?.key === column.key ? sort.direction : "none"}
                >
                  {sortHeader(column.key, column.label)}
                </th>
              ))}
              <th scope="col"><span className="sr-only">Open recipe</span></th>
            </tr>
          </thead>
          <tbody>
            {sortedRecords.map((record) => {
              const selected = record.id === selectedId;
              return (
                <tr
                  key={record.id}
                  className={selected ? "crb2-table-row--selected" : undefined}
                  tabIndex={0}
                  aria-selected={selected}
                  onClick={() => onSelect(record)}
                  onDoubleClick={() => onOpen(record)}
                  onKeyDown={(event) => onRowKeyboard(event, record)}
                >
                  <th scope="row">
                    <span className="crb2-row-name">{record.name}</span>
                  </th>
                  {family.columns.map((column) => (
                    <td key={column.key}>{column.value(record)}</td>
                  ))}
                  <td>
                    <button
                      type="button"
                      className="crb2-row-open"
                      aria-label={`Open ${record.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(record);
                      }}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ComponentResultsBrowser({
  records,
  loading,
  error,
}: {
  records: ComponentCardIndexRecord[];
  loading: boolean;
  error: string | null;
  isRecipeQueued: (record: ComponentCardIndexRecord) => boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
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
  const { session } = useAuthSession();

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

  const selectedCandidate = pageRecords.find((record) => record.id === selectedId);
  const preferredRecord = pickPreferredRecipeBrowserSearchRecord(pageRecords, search);
  const shouldPreferWeapon = Boolean(
    search
    && selectedCandidate?.type === "ammo"
    && preferredRecord?.kind === "fps"
    && preferredRecord.type === "weapons",
  );
  const selectedRecord = !selectedCandidate || shouldPreferWeapon
    ? preferredRecord ?? pageRecords[0]
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

  const openRecord = useCallback((record: ComponentCardIndexRecord) => {
    navigate({
      pathname: `/industry/crafting/${record.id}`,
      search: location.search,
    }, {
      state: { from: location.pathname + location.search },
    });
  }, [location.pathname, location.search, navigate]);

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
            onSelect={(record) => setSelectedId(record.id)}
            onOpen={openRecord}
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
