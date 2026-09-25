import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useSearchParams } from "react-router-dom";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { getCraftingItemsByBlueprintGuids } from "@/lib/craftingData";
import { useCraftingContext } from "../CraftingContext";
import CraftingFilterBar from "../components/CraftingFilterBar";
import ComponentRecipeTable, { type FinalProductQuality } from "../components/ComponentRecipeTable";
import ComponentResultsBrowser from "../components/ComponentResultsBrowser";
import type { ComponentRecipe } from "../utils/craftingTypes";
import type { QualityBand } from "../utils/qualityBands";
import {
  getComponentCardVariantGroupKey,
  pickComponentCardGroupRepresentative,
} from "../utils/componentCardVariants";
import { filterRecipeBrowserRecords } from "../utils/recipeBrowserFilters";
import InspectionBayEmptyState from "./InspectionBayEmptyState";
import "./CraftingDesignPreview.css";

const AD5B_BLUEPRINT_ID = "ba842720-ad32-4d53-8f56-992bacb1fc45";

type ConnectorStyle = CSSProperties & { "--cdp-connector-y"?: string };

function countGroupedRecords(records: ComponentCardIndexRecord[]): number {
  const groups = new Map<string, ComponentCardIndexRecord[]>();
  const ungrouped: ComponentCardIndexRecord[] = [];

  for (const record of records) {
    const key = getComponentCardVariantGroupKey(record);
    if (!key) {
      ungrouped.push(record);
      continue;
    }
    const members = groups.get(key);
    if (members) members.push(record);
    else groups.set(key, [record]);
  }

  let count = ungrouped.length;
  for (const members of groups.values()) {
    if (pickComponentCardGroupRepresentative(members)) count += 1;
  }
  return count;
}

function BrowserBlueprintArtwork() {
  return (
    <div className="cdp-browser-artwork" aria-hidden="true">
      <img
        src="/images/crafting/hero-artwork/component-thumbnails/behr-ballistic-gatling-s4.webp"
        alt=""
      />
      <svg viewBox="0 0 1000 190" preserveAspectRatio="none">
        <g fill="none" stroke="currentColor">
          <path d="M4 158h214l34-30h212l22 16h224l31-31h255" />
          <path d="M70 58h260l32 18h330l24-14h210" />
          <path d="M116 22v146M382 12v164M716 8v170M918 34v126" strokeDasharray="2 8" />
          <circle cx="772" cy="92" r="62" />
          <circle cx="772" cy="92" r="42" />
          <path d="M772 20v144M700 92h144" strokeDasharray="4 7" />
        </g>
      </svg>
    </div>
  );
}

export default function CraftingDesignPreview() {
  const { componentCards, loading: cardsLoading, error: cardsError } = useCraftingContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const initializedBrowserStateRef = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(AD5B_BLUEPRINT_ID);
  const [recipes, setRecipes] = useState<ComponentRecipe[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [queuedIds, setQueuedIds] = useState<Set<string>>(() => new Set());
  const [connectorY, setConnectorY] = useState<number | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const browserRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (initializedBrowserStateRef.current) return;
    initializedBrowserStateRef.current = true;
    const hasExplicitBrowserState = ["search", "q", "v", "f", "sz", "gr", "cl", "mt", "bk"]
      .some((key) => searchParams.has(key));
    if (hasExplicitBrowserState) return;
    const next = new URLSearchParams(searchParams);
    next.set("v", "weaponGun");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const filteredRecords = useMemo(
    () => filterRecipeBrowserRecords(componentCards, searchParams),
    [componentCards, searchParams],
  );
  const resultCount = useMemo(() => countGroupedRecords(filteredRecords), [filteredRecords]);

  useEffect(() => {
    if (!selectedId) {
      queueMicrotask(() => {
        setRecipes([]);
        setDetailError(null);
        setDetailLoading(false);
      });
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setDetailLoading(true);
      setDetailError(null);
    });

    const selectedCard = componentCards.find((card) => card.id === selectedId);
    const familyIds = selectedCard?.familyKey
      ? componentCards
        .filter((card) => (
          card.kind === selectedCard.kind
          && card.type === selectedCard.type
          && card.familyKey === selectedCard.familyKey
        ))
        .map((card) => card.id)
      : [selectedId];
    const recipeIds = familyIds.includes(selectedId) ? familyIds : [selectedId, ...familyIds];

    getCraftingItemsByBlueprintGuids(recipeIds)
      .then((items) => {
        if (cancelled) return;
        setRecipes(items);
        setDetailError(
          items.some((recipe) => recipe.blueprint_id === selectedId)
            ? null
            : "Crafting recipe not found",
        );
        setDetailLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setRecipes([]);
        setDetailError(error instanceof Error ? error.message : "Failed to load crafting data");
        setDetailLoading(false);
      });

    return () => { cancelled = true; };
  }, [componentCards, selectedId]);

  const measureConnector = useCallback(() => {
    const workspace = workspaceRef.current;
    const browser = browserRef.current;
    if (!workspace || !browser || !selectedId || window.innerWidth < 1200) {
      setConnectorY(null);
      return;
    }

    const selector = `[data-crafting-record-id="${CSS.escape(selectedId)}"]`;
    const row = [...browser.querySelectorAll<HTMLElement>(selector)]
      .find((candidate) => {
        const style = window.getComputedStyle(candidate);
        const rect = candidate.getBoundingClientRect();
        return style.display !== "none" && rect.width > 0 && rect.height > 0;
      });

    if (!row) {
      setConnectorY(null);
      return;
    }

    const workspaceRect = workspace.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const nextY = rowRect.top - workspaceRect.top + rowRect.height / 2;
    const withinWorkspace = nextY > 0 && nextY < workspaceRect.height;
    setConnectorY(withinWorkspace ? Math.round(nextY) : null);
  }, [selectedId]);

  useLayoutEffect(() => {
    let frame = window.requestAnimationFrame(measureConnector);
    let nestedFrame = 0;
    const scheduleMeasurement = () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(nestedFrame);
      frame = window.requestAnimationFrame(() => {
        nestedFrame = window.requestAnimationFrame(measureConnector);
      });
    };
    const workspace = workspaceRef.current;
    const browser = browserRef.current;
    const observer = new ResizeObserver(scheduleMeasurement);
    if (workspace) observer.observe(workspace);
    if (browser) observer.observe(browser);
    const toolbar = browser?.querySelector<HTMLElement>(".crb2-toolbar");
    const resultList = browser?.querySelector<HTMLElement>(".crb2-list");
    if (toolbar) observer.observe(toolbar);
    if (resultList) observer.observe(resultList);
    const delayedMeasurements = [100, 300, 800].map((delay) => (
      window.setTimeout(scheduleMeasurement, delay)
    ));
    void document.fonts?.ready.then(scheduleMeasurement);
    browser?.addEventListener("scroll", scheduleMeasurement, true);
    window.addEventListener("resize", scheduleMeasurement);
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(nestedFrame);
      delayedMeasurements.forEach((timeout) => window.clearTimeout(timeout));
      observer.disconnect();
      browser?.removeEventListener("scroll", scheduleMeasurement, true);
      window.removeEventListener("resize", scheduleMeasurement);
    };
  }, [measureConnector, filteredRecords.length, recipes.length]);

  const handleSelect = useCallback((record: ComponentCardIndexRecord) => {
    setSelectedId(record.id);
  }, []);

  const handleAddToQueue = useCallback((
    recipe: ComponentRecipe,
    selectedQualities: Record<string, {
      quality: number;
      bandNumber: number;
      bands: QualityBand[];
    }>,
    finalProductQuality: FinalProductQuality,
  ) => {
    void selectedQualities;
    void finalProductQuality;
    setQueuedIds((current) => {
      const next = new Set(current);
      next.add(recipe.blueprint_id);
      return next;
    });
  }, []);

  const selectedReady = Boolean(
    selectedId && recipes.some((recipe) => recipe.blueprint_id === selectedId),
  );
  const connectorStyle: ConnectorStyle = connectorY === null
    ? {}
    : { "--cdp-connector-y": `${connectorY}px` };

  return (
    <div
      className={`craft-design-preview${selectedId ? " is-selected" : " is-empty"}`}
      data-testid="crafting-design-preview"
    >
      <header className="cdp-command-header">
        <span className="cdp-command-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M5 4h14v16H5z" />
            <path d="m8 9 4-3 4 3-4 3-4-3Z" />
            <path d="M8 15h8" />
          </svg>
        </span>
        <div>
          <h1>Crafting Intelligence</h1>
          <p>Design preview · unified component browser and fabrication inspection system</p>
        </div>
        <span className="cdp-prototype-mark">Prototype / 02</span>
      </header>

      <div className="cdp-workspace" ref={workspaceRef} style={connectorStyle}>
        <section className="cdp-browser" ref={browserRef} aria-label="Component browser prototype">
          <BrowserBlueprintArtwork />
          <div className="cdp-control-deck-label" aria-hidden="true">
            <span>Control deck</span>
            <span>Index / fabrication records</span>
          </div>
          <CraftingFilterBar
            records={componentCards}
            resultCount={resultCount}
            forceBrowserRoute
          />
          <div className="component-browser-body cdp-browser-body">
            <ComponentResultsBrowser
              records={componentCards}
              loading={cardsLoading}
              error={cardsError}
              isRecipeQueued={(record) => queuedIds.has(record.id)}
              previewId={selectedId}
              onPreviewRecord={handleSelect}
              autoSelectFirstRecord={false}
              layoutMode="wide-split"
            />
          </div>
        </section>

        <aside className={`cdp-spine${connectorY !== null ? " is-active" : ""}`} aria-hidden="true">
          <span className="cdp-spine-cap cdp-spine-cap--top" />
          <span className="cdp-spine-rail" />
          <span className="cdp-spine-trace"><i /></span>
          <span className="cdp-spine-cap cdp-spine-cap--bottom" />
        </aside>

        <aside className="cdp-detail" aria-label="Fabrication inspection detail">
          {!selectedId ? (
            <InspectionBayEmptyState />
          ) : detailError ? (
            <div className="cdp-detail-state cdp-detail-state--error">
              <span>Detail unavailable</span>
              <p>{detailError}</p>
              <button type="button" onClick={() => setSelectedId(null)}>Return to standby</button>
            </div>
          ) : detailLoading || !selectedReady ? (
            <div className="cdp-detail-state" aria-busy="true">
              <span>Loading inspection data</span>
              <div className="cdp-detail-loader" aria-hidden="true" />
            </div>
          ) : (
            <ComponentRecipeTable
              recipes={recipes}
              componentCards={componentCards}
              initialBlueprintId={selectedId}
              presentation="drawer"
              onClose={() => setSelectedId(null)}
              onAddToQueue={handleAddToQueue}
              isRecipeQueued={(recipe) => queuedIds.has(recipe.blueprint_id)}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
