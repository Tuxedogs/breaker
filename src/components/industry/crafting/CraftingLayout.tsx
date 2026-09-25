import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useSearchParams } from "react-router-dom";
import type { ComponentCardIndex, ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { getComponentCardBrowserPage, type ComponentCardBrowserPage } from "@/lib/componentCardIndexApi";
import { CraftingContext } from "./CraftingContext";
import "./recipe-browser.css";

export default function CraftingLayout() {
  const [componentCards, setComponentCards] = useState<ComponentCardIndexRecord[]>([]);
  const [componentCardFacets, setComponentCardFacets] = useState<ComponentCardIndex["facets"] | null>(null);
  const [browserPage, setBrowserPage] = useState<ComponentCardBrowserPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isBrowserRoute = location.pathname.replace(/\/+$/, "") === "/industry/crafting";
  const hasSelectedDetail = isBrowserRoute && Boolean(searchParams.get("preview"));

  useEffect(() => {
    if (!isBrowserRoute) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const query = new URLSearchParams(searchParams);
    if (query.get("bk") === "1") {
      try {
        const values = JSON.parse(window.localStorage.getItem("scintel:recipe:bookmarks:v1") ?? "[]");
        if (Array.isArray(values)) query.set("saved", values.filter((value): value is string => typeof value === "string").join(","));
      } catch {
        query.set("saved", "");
      }
    }
    getComponentCardBrowserPage(query, 40, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        setBrowserPage(page);
        // Supporting records are never rendered as browser rows. They retain
        // existing cross-detail presentation such as the P6-LR comparison.
        setComponentCards([...page.records, ...page.supportingRecords]);
        setComponentCardFacets(page.facets ?? null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load crafting browser");
        setLoading(false);
      });
    return () => controller.abort();
  }, [isBrowserRoute, searchParams]);

  const contextValue = useMemo(
    () => ({ componentCards, componentCardFacets, loading, error, browserPage }),
    [componentCards, componentCardFacets, loading, error, browserPage],
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
