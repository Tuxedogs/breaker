import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ComponentResultCard from "./ComponentResultCard";
import { fetchSavedBlueprints } from "@/lib/userSavedBlueprints";
import { useAuthSession } from "@/lib/auth/useAuthSession";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { resolveEntityClassForCraftingItem } from "@/lib/crafting/resolveEntityClass";
import { prefetchFittingComponents } from "@/lib/fitting/useFittingComponentStats";
import {
  getComponentCardVariantGroupKey,
  pickComponentCardGroupRepresentative,
} from "../utils/componentCardVariants";
import { filterRecipeBrowserRecords, compareRecipeBrowserRecords } from "../utils/recipeBrowserFilters";

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
    return new Set(Array.isArray(values) ? values.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

function ComponentBrowserState({ title, body }: { title: string; body: string }) {
  return (
    <section className="component-browser-state">
      <span className="craft-frl-label">{title}</span>
      <p>{body}</p>
    </section>
  );
}

export default function ComponentResultsBrowser({
  records,
  loading,
  error,
  isRecipeQueued,
}: {
  records: ComponentCardIndexRecord[];
  loading: boolean;
  error: string | null;
  isRecipeQueued: (record: ComponentCardIndexRecord) => boolean;
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const savedOnly = searchParams.get("bk") === "1";
  const page = Math.max(1, Number(searchParams.get("pg") ?? "1") || 1);
  const resultsPerPage = useResultsPerPage();

  const setPage = useCallback((value: number | ((prev: number) => number)) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      const currentPage = Math.max(1, Number(p.get("pg") ?? "1") || 1);
      const next = typeof value === "function" ? value(currentPage) : value;
      if (next <= 1) { p.delete("pg"); } else { p.set("pg", String(next)); }
      return p;
    }, { replace: true });
  }, [setSearchParams]);

  const [savedBlueprintIds, setSavedBlueprintIds] = useState<Set<string>>(
    () => readStoredStringSet(SAVED_BLUEPRINT_STORAGE_KEY),
  );
  const { session } = useAuthSession();

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!accessToken) return;
    let cancelled = false;
    fetchSavedBlueprints(accessToken)
      .then((saved) => {
        if (!cancelled) setSavedBlueprintIds(new Set(saved.map((item) => item.blueprintId)));
      })
      .catch(() => { if (!cancelled) setSavedBlueprintIds(new Set()); });
    return () => { cancelled = true; };
  }, [session?.access_token]);

  const filteredRecords = useMemo(() => filterRecipeBrowserRecords(records, searchParams, {
    savedOnly,
    savedBlueprintIds,
  }), [records, savedBlueprintIds, savedOnly, searchParams]);

  // ── Variant grouping ─────────────────────────────────────────────────────────
  const { groupedRecords, variantCountMap } = useMemo(() => {
    const groups = new Map<string, ComponentCardIndexRecord[]>();
    const ungrouped: ComponentCardIndexRecord[] = [];

    for (const record of filteredRecords) {
      const key = getComponentCardVariantGroupKey(record);
      if (key) {
        const existing = groups.get(key);
        if (existing) { existing.push(record); } else { groups.set(key, [record]); }
      } else {
        ungrouped.push(record);
      }
    }

    const grouped: ComponentCardIndexRecord[] = [...ungrouped];
    const counts = new Map<string, number>();

    for (const [, members] of groups) {
      const rep = pickComponentCardGroupRepresentative(members);
      grouped.push(rep);
      if (members.length > 1) counts.set(rep.id, members.length);
    }

    grouped.sort(compareRecipeBrowserRecords);

    return { groupedRecords: grouped, variantCountMap: counts };
  }, [filteredRecords]);

  const totalPages = Math.max(1, Math.ceil(groupedRecords.length / resultsPerPage));
  const visiblePage = Math.min(page, totalPages);
  const pageStart = (visiblePage - 1) * resultsPerPage;

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages, setPage]);

  const pageRecords = useMemo(
    () => groupedRecords.slice(pageStart, pageStart + resultsPerPage),
    [groupedRecords, pageStart, resultsPerPage],
  );

  useEffect(() => {
    const entityClasses = pageRecords
      .filter((record) => record.kind === "vehicle")
      .map((record) => resolveEntityClassForCraftingItem({ cardBridge: record }).entityClass)
      .filter((value): value is string => Boolean(value));
    prefetchFittingComponents(entityClasses);
  }, [pageRecords]);

  if (loading) {
    return (
      <div className="component-browser-results">
        <div className="component-results-scroll">
          <ComponentBrowserState title="Loading" body="Component blueprints are loading." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="component-browser-results">
        <div className="component-results-scroll">
          <ComponentBrowserState title="Error" body={error} />
        </div>
      </div>
    );
  }

  if (groupedRecords.length === 0) {
    return (
      <div className="component-browser-results">
        <div className="component-results-scroll">
          <ComponentBrowserState title="No Results" body="No craftable components match the current browser filters." />
        </div>
      </div>
    );
  }

  return (
    <div className="component-browser-results">
      <div className="component-results-scroll">
        <section className="component-results-grid" aria-label="Component results">
          {pageRecords.map((record) => (
            <ComponentResultCard
              key={record.id}
              record={record}
              queued={isRecipeQueued(record)}
              saved={savedBlueprintIds.has(record.id)}
              variantCount={variantCountMap.get(record.id)}
            />
          ))}
        </section>
      </div>

      <footer className="component-browser-pager" aria-label="Component results pages">
        <span className="component-browser-page-readout">
          Showing {pageStart + 1}-{Math.min(pageStart + pageRecords.length, groupedRecords.length)} of {groupedRecords.length} results
        </span>
        <div className="component-browser-page-actions">
          <button
            type="button"
            className="craft-frl-clear"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={visiblePage <= 1}
          >
            Previous
          </button>
          <span className="component-browser-page-count">Page {visiblePage} / {totalPages}</span>
          <button
            type="button"
            className="craft-frl-clear"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={visiblePage >= totalPages}
          >
            Next
          </button>
        </div>
      </footer>
    </div>
  );
}
