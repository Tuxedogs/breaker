import { useEffect, useMemo, useState } from "react";
import { Outlet, useSearchParams } from "react-router-dom";
import { getComponentCardIndex, type ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { CraftingContext } from "./CraftingContext";
import CraftingFilterBar from "./components/CraftingFilterBar";
import "./recipe-browser.css";

const UTILITY_TYPES = new Set(["dockingCollar", "salvageHead", "salvageModifier", "weaponMining"]);

function buildSearchTokens(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function getSearchParam(searchParams: URLSearchParams): string {
  return searchParams.get("search") ?? searchParams.get("q") ?? "";
}

function matchesSearch(record: ComponentCardIndexRecord, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  return tokens.every((t) => record.searchText.includes(t));
}

function getVariantGroupKey(record: ComponentCardIndexRecord): string | null {
  if (record.kind !== "fps") return null;
  const stripped = record.name.replace(/\s*"[^"]+"\s*/g, " ").replace(/\s+/g, " ").trim();
  if (stripped === record.name.trim()) return null;
  return `${stripped}::${record.type}::${record.kind}`;
}

function pickGroupRepresentative(group: ComponentCardIndexRecord[]): ComponentCardIndexRecord {
  if (group.length === 1) return group[0];
  const base = group.find((r) => !/"\w/.test(r.name));
  return base ?? group.slice().sort((a, b) => a.name.localeCompare(b.name))[0];
}

export default function CraftingLayout() {
  const [componentCards, setComponentCards] = useState<ComponentCardIndexRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    getComponentCardIndex()
      .then((index) => {
        if (!cancelled) {
          setComponentCards(index.records);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load crafting data");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Compute filtered result count so the filter bar can show it.
  const resultCount = useMemo(() => {
    if (loading || componentCards.length === 0) return 0;

    const isDefaultState = searchParams.get("v") === null &&
      !getSearchParam(searchParams) && !searchParams.get("f") &&
      !searchParams.get("sz") && !searchParams.get("gr") &&
      !searchParams.get("cl") && !searchParams.get("mt") &&
      searchParams.get("bk") !== "1";

    const search = getSearchParam(searchParams);
    const vehicleFilters = new Set((searchParams.get("v") ?? "").split(",").filter(Boolean));
    const fpsFilters = new Set((searchParams.get("f") ?? "").split(",").filter(Boolean));
    const sizeFilters = new Set((searchParams.get("sz") ?? "").split(",").filter(Boolean));
    const gradeFilters = new Set((searchParams.get("gr") ?? "").split(",").filter(Boolean));
    const classFilters = new Set((searchParams.get("cl") ?? "").split(",").filter(Boolean));
    const materialFilters = new Set((searchParams.get("mt") ?? "").split(",").filter(Boolean));
    const searchTokens = buildSearchTokens(search);
    const hasTextSearch = searchTokens.length > 0;

    const filtered = componentCards.filter((record) => {
      if (record.kind === "fps") {
        if (fpsFilters.size > 0) {
          if (!fpsFilters.has(record.type)) return false;
        } else if (vehicleFilters.size > 0 || isDefaultState || !hasTextSearch) {
          return false;
        }
      } else {
        if (fpsFilters.size > 0) return false;
        if (vehicleFilters.size) {
          const utilityMatch = vehicleFilters.has("__utility__") && UTILITY_TYPES.has(record.type);
          if (!vehicleFilters.has(record.type) && !utilityMatch) return false;
        } else if (isDefaultState) {
          if (record.type !== "weaponGun") return false;
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
    });

    // Collapse variants for count (same logic as ComponentResultsBrowser)
    const groups = new Map<string, ComponentCardIndexRecord[]>();
    const ungrouped: ComponentCardIndexRecord[] = [];
    for (const record of filtered) {
      const key = getVariantGroupKey(record);
      if (key) {
        const existing = groups.get(key);
        if (existing) { existing.push(record); } else { groups.set(key, [record]); }
      } else {
        ungrouped.push(record);
      }
    }
    const grouped: ComponentCardIndexRecord[] = [...ungrouped];
    for (const [, members] of groups) {
      grouped.push(pickGroupRepresentative(members));
    }
    return grouped.length;
  }, [componentCards, loading, searchParams]);

  const contextValue = useMemo(
    () => ({ componentCards, loading, error }),
    [componentCards, loading, error],
  );

  return (
    <CraftingContext.Provider value={contextValue}>
      <div className="craft-page craft-planner-shell component-results-browser">
        <CraftingFilterBar records={componentCards} resultCount={resultCount} />
        <Outlet />
      </div>
    </CraftingContext.Provider>
  );
}
