import WorkspacePanel from "../../../shared/WorkspacePanel";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import "../craft-v31-layout.css";
import {
  CRAFTING_WIDE_SPLIT_MIN_WIDTH,
  useCraftingPhoneLayout,
  type CraftingBrowserLayoutMode,
} from "../utils/craftingBrowserLayout";

type ConnectorStyle = CSSProperties & { "--craft-browser-connector-y"?: string };

function BrowserBlueprintArtwork() {
  return (
    <div className="craft-browser-blueprint-artwork" aria-hidden="true">
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

export default function CraftingBrowserWorkspace({
  selectedId,
  toolbar,
  results,
  detail,
  detailReady = false,
  detailLoading = false,
  layoutMode,
}: {
  selectedId: string | null;
  toolbar: ReactNode;
  results: ReactNode;
  detail: ReactNode;
  detailReady?: boolean;
  detailLoading?: boolean;
  layoutMode: CraftingBrowserLayoutMode;
}) {
  const [connectorY, setConnectorY] = useState<number | null>(null);
  // Phones show one screen at a time: the blueprint list, or the selected
  // blueprint's detail. The hidden screen stays mounted (keeping its scroll
  // position) but is inert so focus and assistive technology skip it.
  const isPhone = useCraftingPhoneLayout();
  const phoneScreen = selectedId ? "detail" : "list";
  const workspaceRef = useRef<HTMLDivElement>(null);
  const browserRef = useRef<HTMLElement>(null);

  const measureConnector = useCallback(() => {
    const workspace = workspaceRef.current;
    const browser = browserRef.current;
    if (!workspace || !browser || !selectedId || window.innerWidth < CRAFTING_WIDE_SPLIT_MIN_WIDTH) {
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
    setConnectorY(nextY > 0 && nextY < workspaceRect.height ? Math.round(nextY) : null);
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
    const toolbarElement = browser?.querySelector<HTMLElement>(".crb2-toolbar");
    const resultList = browser?.querySelector<HTMLElement>(".crb2-list");
    if (toolbarElement) observer.observe(toolbarElement);
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
  }, [measureConnector, results]);

  const connectorStyle: ConnectorStyle = connectorY === null
    ? {}
    : { "--craft-browser-connector-y": `${connectorY}px` };

  return (
    <div
      ref={workspaceRef}
      className={`craft-browser-workspace craft-browser-production-workspace craft-browser-v31-workspace craft-browser-production-workspace--${layoutMode}${selectedId ? " is-selected" : " is-empty"}`}
      data-testid="crafting-production-workspace"
      data-phone-screen={isPhone ? phoneScreen : undefined}
      style={connectorStyle}
    >
      <WorkspacePanel as="aside" tone="filter" className="craft-v31-filter-pane" aria-label="Recipe filters" inert={isPhone && phoneScreen === "detail"}>
        {toolbar}
      </WorkspacePanel>

      <section ref={browserRef} className="craft-browser-production-pane" aria-label="Blueprint index" inert={isPhone && phoneScreen === "detail"}>
        <BrowserBlueprintArtwork />
        <div className="component-browser-body craft-browser-production-body">
          {results}
        </div>
      </section>

      <aside
        className={`craft-browser-spine${connectorY !== null ? " is-active" : ""}`}
        data-testid="crafting-center-spine"
        data-trace-active={connectorY !== null ? "true" : "false"}
        aria-hidden="true"
      >
        <span className="craft-browser-spine-cap craft-browser-spine-cap--top" />
        <span className="craft-browser-spine-rail" />
        <span className="craft-browser-spine-trace"><i /></span>
        <span className="craft-browser-spine-cap craft-browser-spine-cap--bottom" />
      </aside>

      <WorkspacePanel
        as="aside"
        tone="inspector"
        className={`craft-browser-detail-pane craft-detail-drawer-region${detailReady ? " craft-detail-drawer-region--ready" : ""}`}
        aria-label="Fabrication inspection detail"
        aria-busy={detailLoading}
        inert={isPhone && phoneScreen === "list"}
      >
        {detail}
      </WorkspacePanel>
    </div>
  );
}
