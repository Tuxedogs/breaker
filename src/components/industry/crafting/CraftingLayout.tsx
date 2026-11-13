import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useSearchParams } from "react-router-dom";
import type { ComponentCardIndex, ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { getComponentCardBrowserPage, getComponentCardIndex, type ComponentCardBrowserPage } from "@/lib/componentCardIndexApi";
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
  const isDesignPreviewRoute = location.pathname.replace(/\/+$/, "") === "/industry/crafting/design-preview";
  const hasSelectedDetail = isBrowserRoute && Boolean(searchParams.get("preview"));
  const browserRequestParams = new URLSearchParams(searchParams);
  browserRequestParams.delete("preview");
  const browserRequestKey = browserRequestParams.toString();

  useEffect(() => {
    if (isDesignPreviewRoute) {
      let cancelled = false;
      getComponentCardIndex().then((index) => {
        if (cancelled) return;
        setComponentCards(index.records);
        setComponentCardFacets(index.facets);
        setLoading(false);
      }).catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load crafting browser");
        setLoading(false);
      });
      return () => { cancelled = true; };
    }
    if (!isBrowserRoute) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
    });
    const query = new URLSearchParams(browserRequestKey);
    if (query.get("bk") === "1") {
      try {
        const values = JSON.parse(window.localStorage.getItem("scintel:recipe:bookmarks:v1") ?? "[]");
        if (Array.isArray(values)) query.set("saved", values.filter((value): value is string => typeof value === "string").join(","));
      } catch {
        query.set("saved", "");
      }
    }
    getComponentCardBrowserPage(query, "all", controller.signal)
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
  }, [browserRequestKey, isBrowserRoute, isDesignPreviewRoute]);

  const contextValue = useMemo(
    () => ({ componentCards, componentCardFacets, loading, error, browserPage }),
    [componentCards, componentCardFacets, loading, error, browserPage],
  );

  return (
    <CraftingContext.Provider value={contextValue}>
      <div className="craft-page craft-planner-shell component-results-browser">
        <div className={`recipe-browser-page-body${isBrowserRoute ? " is-browser" : ""}${hasSelectedDetail ? " is-detail-preview" : ""}`}>
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
