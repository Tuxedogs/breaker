import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useSearchParams } from "react-router-dom";
import type { ComponentCardIndex, ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { getComponentCardIndex } from "@/lib/componentCardIndexApi";
import { CraftingContext } from "./CraftingContext";
import CraftingFilterBar from "./components/CraftingFilterBar";
import {
  getComponentCardVariantGroupKey,
  pickComponentCardGroupRepresentative,
} from "./utils/componentCardVariants";
import { filterRecipeBrowserRecords } from "./utils/recipeBrowserFilters";
import "./recipe-browser.css";

export default function CraftingLayout() {
  const [componentCards, setComponentCards] = useState<ComponentCardIndexRecord[]>([]);
  const [componentCardFacets, setComponentCardFacets] = useState<ComponentCardIndex["facets"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isBrowserRoute = location.pathname.replace(/\/+$/, "") === "/industry/crafting";

  useEffect(() => {
    let cancelled = false;
    getComponentCardIndex()
      .then((index) => {
        if (!cancelled) {
          setComponentCards(index.records);
          setComponentCardFacets(index.facets);
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

    const filtered = filterRecipeBrowserRecords(componentCards, searchParams);

    // Collapse variants for count (same logic as ComponentResultsBrowser)
    const groups = new Map<string, ComponentCardIndexRecord[]>();
    const ungrouped: ComponentCardIndexRecord[] = [];
    for (const record of filtered) {
      const key = getComponentCardVariantGroupKey(record);
      if (key) {
        const existing = groups.get(key);
        if (existing) { existing.push(record); } else { groups.set(key, [record]); }
      } else {
        ungrouped.push(record);
      }
    }
    const grouped: ComponentCardIndexRecord[] = [...ungrouped];
    for (const [, members] of groups) {
      grouped.push(pickComponentCardGroupRepresentative(members));
    }
    return grouped.length;
  }, [componentCards, loading, searchParams]);

  const contextValue = useMemo(
    () => ({ componentCards, componentCardFacets, loading, error }),
    [componentCards, componentCardFacets, loading, error],
  );

  return (
    <CraftingContext.Provider value={contextValue}>
      <div className="craft-page craft-planner-shell component-results-browser">
        <div className={`recipe-browser-page-body${isBrowserRoute ? " is-browser" : ""}`}>
          {isBrowserRoute ? (
            <header className="recipe-browser-command-header">
              <span className="recipe-browser-command-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M5 4h14v16H5z" />
                  <path d="m8 9 4-3 4 3-4 3-4-3Z" />
                  <path d="M8 15h8" />
                </svg>
              </span>
              <div className="recipe-browser-command-copy">
                <h1>Crafting Intelligence</h1>
                <p>Search components, compare recipes, materials, and crafting requirements.</p>
              </div>
            </header>
          ) : null}
          <div className="recipe-browser-content-shell">
            {isBrowserRoute ? (
              <CraftingFilterBar records={componentCards} resultCount={resultCount} />
            ) : null}
            <div className="component-browser-body">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </CraftingContext.Provider>
  );
}
