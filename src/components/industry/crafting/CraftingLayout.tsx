import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useSearchParams } from "react-router-dom";
import type { ComponentCardIndex, ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { getComponentCardIndex } from "@/lib/componentCardIndexApi";
import { CraftingContext } from "./CraftingContext";
import "./recipe-browser.css";

export default function CraftingLayout() {
  const [componentCards, setComponentCards] = useState<ComponentCardIndexRecord[]>([]);
  const [componentCardFacets, setComponentCardFacets] = useState<ComponentCardIndex["facets"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isBrowserRoute = location.pathname.replace(/\/+$/, "") === "/industry/crafting";
  const hasSelectedDetail = isBrowserRoute && Boolean(searchParams.get("preview"));

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

  const contextValue = useMemo(
    () => ({ componentCards, componentCardFacets, loading, error }),
    [componentCards, componentCardFacets, loading, error],
  );

  return (
    <CraftingContext.Provider value={contextValue}>
      <div className="craft-page craft-planner-shell component-results-browser">
        <div className={`recipe-browser-page-body${isBrowserRoute ? " is-browser" : ""}${hasSelectedDetail ? " is-detail-preview" : ""}`}>
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
            <div className="component-browser-body">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </CraftingContext.Provider>
  );
}
