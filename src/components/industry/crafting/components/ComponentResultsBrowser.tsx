import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import ComponentResultCard from "./ComponentResultCard";
import { fetchSavedBlueprints } from "@/lib/userSavedBlueprints";
import { useAuthSession } from "@/lib/auth/useAuthSession";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import {
  getComponentCardVariantGroupKey,
  pickComponentCardGroupRepresentative,
} from "../utils/componentCardVariants";

const SAVED_BLUEPRINT_STORAGE_KEY = "scintel:recipe:bookmarks:v1";
const UTILITY_TYPES = new Set(["dockingCollar", "salvageHead", "salvageModifier", "weaponMining"]);
const DEFAULT_RESULTS_PER_PAGE = 18;

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

function buildSearchTokens(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function getSearchParam(searchParams: URLSearchParams): string {
  return searchParams.get("search") ?? searchParams.get("q") ?? "";
}

function matchesSearch(record: ComponentCardIndexRecord, queryTokens: string[]): boolean {
  if (queryTokens.length === 0) return true;
  return queryTokens.every((token) => record.searchText.includes(token));
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
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Derive filter state from URL params ──────────────────────────────────────
  const DEFAULT_VEHICLE_TYPE = "weaponGun";
  const isDefaultState = searchParams.get("v") === null &&
    !getSearchParam(searchParams) && !searchParams.get("f") &&
    !searchParams.get("sz") && !searchParams.get("gr") &&
    !searchParams.get("cl") && !searchParams.get("mt") &&
    searchParams.get("bk") !== "1";

  const search = getSearchParam(searchParams);
  const vehicleFilters = useMemo<Set<string>>(() => {
    const raw = searchParams.get("v");
    if (raw === null) return new Set();
    if (raw === "") return new Set();
    return new Set(raw.split(",").filter(Boolean));
  }, [searchParams]);
  const fpsFilters = useMemo<Set<string>>(() => {
    const raw = searchParams.get("f");
    return raw ? new Set(raw.split(",").filter(Boolean)) : new Set();
  }, [searchParams]);
  const sizeFilters = useMemo<Set<string>>(() => {
    const raw = searchParams.get("sz");
    return raw ? new Set(raw.split(",").filter(Boolean)) : new Set();
  }, [searchParams]);
  const gradeFilters = useMemo<Set<string>>(() => {
    const raw = searchParams.get("gr");
    return raw ? new Set(raw.split(",").filter(Boolean)) : new Set();
  }, [searchParams]);
  const classFilters = useMemo<Set<string>>(() => {
    const raw = searchParams.get("cl");
    return raw ? new Set(raw.split(",").filter(Boolean)) : new Set();
  }, [searchParams]);
  const materialFilters = useMemo<Set<string>>(() => {
    const raw = searchParams.get("mt");
    return raw ? new Set(raw.split(",").filter(Boolean)) : new Set();
  }, [searchParams]);
  const savedOnly = searchParams.get("bk") === "1";
  const page = Math.max(1, Number(searchParams.get("pg") ?? "1") || 1);

  const setPage = (value: number | ((prev: number) => number)) => {
    const next = typeof value === "function" ? value(page) : value;
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next <= 1) { p.delete("pg"); } else { p.set("pg", String(next)); }
      return p;
    }, { replace: true });
  };

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

  const searchTokens = useMemo(() => buildSearchTokens(search), [search]);

  const filteredRecords = useMemo(() => {
    const hasTextSearch = searchTokens.length > 0;

    return records
      .filter((record) => {
        if (savedOnly && !savedBlueprintIds.has(record.id)) return false;
        if (record.kind === "fps") {
          if (fpsFilters.size > 0) {
            if (!fpsFilters.has(record.type)) return false;
          } else if (vehicleFilters.size > 0 || isDefaultState || !hasTextSearch) {
            return false;
          }
        } else {
          if (fpsFilters.size > 0) return false;
          if (vehicleFilters.size) {
            const type = record.type;
            const utilityMatch = vehicleFilters.has("__utility__") && UTILITY_TYPES.has(type);
            if (!vehicleFilters.has(type) && !utilityMatch) return false;
          } else if (isDefaultState) {
            if (record.type !== DEFAULT_VEHICLE_TYPE) return false;
          }
        }
        if (sizeFilters.size && !sizeFilters.has(record.size !== null ? String(record.size) : "")) return false;
        if (gradeFilters.size && !gradeFilters.has(record.grade ?? "")) return false;
        if (classFilters.size && !classFilters.has(record.class?.toLowerCase() ?? "")) return false;
        if (materialFilters.size) {
          const usesMaterial =
            record.facets.materials.some((id) => materialFilters.has(id)) ||
            record.facets.materialNames.some((name) => materialFilters.has(name));
          if (!usesMaterial) return false;
        }
        if (!matchesSearch(record, searchTokens)) return false;
        return true;
      })
      .sort((a, b) => {
        const type = a.sort.type.localeCompare(b.sort.type);
        return type || a.sort.name.localeCompare(b.sort.name);
      });
  }, [classFilters, fpsFilters, gradeFilters, materialFilters, records, savedBlueprintIds, savedOnly, searchTokens, sizeFilters, vehicleFilters, isDefaultState]);

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

    grouped.sort((a, b) => {
      const type = a.sort.type.localeCompare(b.sort.type);
      return type || a.sort.name.localeCompare(b.sort.name);
    });

    return { groupedRecords: grouped, variantCountMap: counts };
  }, [filteredRecords]);

  // Auto-navigate to detail when exactly one result — preserve current query params.
  useEffect(() => {
    if (loading || groupedRecords.length !== 1) return;
    const id = groupedRecords[0].id;
    if (id) navigate(`/industry/crafting/${id}${location.search}`, { replace: true });
  }, [loading, groupedRecords, navigate, location.search]);

  const totalPages = Math.max(1, Math.ceil(groupedRecords.length / DEFAULT_RESULTS_PER_PAGE));
  const visiblePage = Math.min(page, totalPages);
  const pageStart = (visiblePage - 1) * DEFAULT_RESULTS_PER_PAGE;
  const pageRecords = useMemo(
    () => groupedRecords.slice(pageStart, pageStart + DEFAULT_RESULTS_PER_PAGE),
    [groupedRecords, pageStart],
  );

  if (loading) {
    return <ComponentBrowserState title="Loading" body="Component blueprints are loading." />;
  }

  if (error) {
    return <ComponentBrowserState title="Error" body={error} />;
  }

  if (groupedRecords.length === 0) {
    return <ComponentBrowserState title="No Results" body="No craftable components match the current browser filters." />;
  }

  if (groupedRecords.length === 1) {
    return null;
  }

  return (
    <>
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
    </>
  );
}
