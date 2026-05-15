import { lazy, Suspense, useRef, useState } from "react";
import DeckFloorViewport from "../../../tools/maps/components/DeckFloorViewport";
import { perseusDeckFloors } from "../../../tools/maps/data/perseusDeckFloorRegistry";
import "./ShipMapsPage.css";

const ShipMapViewer = lazy(() => import("../../../tools/viewer/ViewerPage"));

type ViewMode = "2d" | "3d";

function ViewerLoading() {
  return (
    <div className="smap-viewer-loading">
      <p className="base-card-kicker">Loading Ship Systems…</p>
    </div>
  );
}

// Static ship info for the RSI Perseus (the only ship currently in the viewer).
// Wire to dynamic data when multi-ship support lands.
const PERSEUS_INFO = {
  name: "RSI Perseus",
  class: "Medium Gunship",
  manufacturer: "Roberts Space Industries",
  stats: [
    { label: "Role", value: "Anti-Capital" },
    { label: "Size", value: "Large" },
    { label: "Crew", value: "4–6" },
    { label: "Cargo", value: "24 SCU" },
    { label: "Shields", value: "Industrial" },
  ],
};

export default function ShipMapsPage() {
  const [mode, setMode] = useState<ViewMode>("2d");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);

  function handleFullscreenToggle() {
    if (!isFullscreen) {
      viewerRef.current?.requestFullscreen?.().catch(() => {
        // Fallback: CSS-based expand
        setIsFullscreen(true);
      });
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => setIsFullscreen(false));
      } else {
        setIsFullscreen(false);
      }
    }
    setIsFullscreen((f) => !f);
  }

  return (
    <div className="smap-page">
      {/* ── Page header with mode tabs ── */}
      <div className="smap-header">
        

        <div className="smap-tabs" role="tablist" aria-label="Map view mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "2d"}
            className={`smap-tab${mode === "2d" ? " smap-tab--active" : ""}`}
            onClick={() => setMode("2d")}
          >
            Deck Maps
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "3d"}
            className={`smap-tab${mode === "3d" ? " smap-tab--active" : ""}`}
            onClick={() => setMode("3d")}
          >
            Ship Systems
          </button>
        </div>
      </div>

      {/* ── 2D deck maps ── */}
      {mode === "2d" && (
        <div className="smap-body">
          <DeckFloorViewport
            title="RSI Perseus Deck Maps"
            subtitle="Static deck references for quick layout checks without loading Ship Systems."
            deckDefinitions={perseusDeckFloors}
          />
        </div>
      )}

      {/* ── 3D viewer layout matching reference ── */}
      {mode === "3d" && (
        <div
          ref={viewerRef}
          className={`smap-viewer-layout${isFullscreen ? " smap-viewer-layout--fullscreen" : ""}`}
        >
          {/* Inner topbar: breadcrumb + actions */}
          <div className="smap-viewer-topbar">
            <nav className="smap-viewer-breadcrumb" aria-label="Breadcrumb">
              <span className="smap-breadcrumb-seg">Maps &amp; Data</span>
              <span className="smap-breadcrumb-sep" aria-hidden>/</span>
              <span className="smap-breadcrumb-seg smap-breadcrumb-seg--current">
                Ship Systems
              </span>
            </nav>

            <div className="smap-viewer-heading">
              <h2 className="smap-viewer-title">Ship Systems</h2>
            </div>

            <div className="smap-viewer-actions">
              <button
                type="button"
                className="smap-viewer-action-btn"
                onClick={handleFullscreenToggle}
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width="14"
                  height="14"
                  aria-hidden
                >
                  {isFullscreen ? (
                    <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
                  ) : (
                    <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
                  )}
                </svg>
                {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </button>

              <button
                type="button"
                className="smap-viewer-action-btn smap-viewer-action-btn--secondary"
                onClick={() => setMode("2d")}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width="14"
                  height="14"
                  aria-hidden
                >
                  <path d="M19 12H5m7-7l-7 7 7 7" />
                </svg>
                Back to Deck Maps
              </button>
            </div>
          </div>

          {/* 2-column body: canvas + ship info */}
          <div className="smap-viewer-body">
            {/* Centre: Ship Systems canvas */}
            <div className="smap-viewer-canvas">
              <Suspense fallback={<ViewerLoading />}>
                <ShipMapViewer />
              </Suspense>
            </div>

            {/* Right: ship info panel */}
            <aside className="smap-viewer-info" aria-label="Ship information">
              <div className="smap-info-section">
                <p className="smap-info-label">Ship Info</p>
                <h3 className="smap-info-ship-name">{PERSEUS_INFO.name}</h3>
                <p className="smap-info-ship-class">{PERSEUS_INFO.class}</p>
              </div>

              <div className="smap-info-stats">
                {PERSEUS_INFO.stats.map((stat) => (
                  <div key={stat.label} className="smap-info-stat-row">
                    <span className="smap-info-stat-label">{stat.label}</span>
                    <span className="smap-info-stat-value">{stat.value}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>

        </div>
      )}
    </div>
  );
}
