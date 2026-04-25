import { lazy, Suspense, useRef, useState } from "react";
import DeckFloorViewport from "../../../tools/maps/components/DeckFloorViewport";
import { perseusDeckFloors } from "../../../tools/maps/data/perseusDeckFloorRegistry";
import "./ShipMapsPage.css";

const ShipMapViewer = lazy(() => import("../../../tools/viewer/ViewerPage"));

type ViewMode = "2d" | "3d";

// ── Left-rail icons ────────────────────────────────────────────────────────
const RAIL_ICONS = {
  camera:
    "M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z",
  lighting:
    "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 006 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5m-6 0h6m-3 4v-4",
  background:
    "M3 3h18v18H3V3zm3 3v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2zm0 4h5v2H8v-2z",
  hud: "M2 3h20v14H2V3zm0 18l4-4h12l4 4M9 8h6m-3-2v6",
  stats: "M18 20V10m-6 10V4M6 20v-6",
  bookmarks:
    "M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z",
};

function RailIcon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="18"
      height="18"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

function ViewerLoading() {
  return (
    <div className="smap-viewer-loading">
      <p className="base-card-kicker">Loading 3D viewer…</p>
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
  const [activeRailItem, setActiveRailItem] = useState<string | null>(null);
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
        <div className="smap-header-text">
          <span className="smap-kicker">SHIPS</span>
          <h1 className="smap-title">Ship Maps</h1>
          <p className="smap-subtitle">
            {mode === "2d"
              ? "Static deck references for quick layout checks."
              : "Interactive 3D vessel viewer with deck overlays."}
          </p>
        </div>

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
            3D Viewer
          </button>
        </div>
      </div>

      {/* ── 2D deck maps ── */}
      {mode === "2d" && (
        <div className="smap-body">
          <DeckFloorViewport
            title="RSI Perseus Deck Maps"
            subtitle="Static deck references for quick layout checks without loading the 3D viewer."
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
                3D Viewer
              </span>
            </nav>

            <div className="smap-viewer-heading">
              <h2 className="smap-viewer-title">3D Viewer</h2>
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

          {/* 3-column body */}
          <div className="smap-viewer-body">
            {/* Left icon rail */}
            <nav
              className="smap-viewer-rail"
              aria-label="Viewer controls"
            >
              {(
                [
                  { id: "camera", label: "Camera", icon: RAIL_ICONS.camera },
                  { id: "lighting", label: "Lighting", icon: RAIL_ICONS.lighting },
                  { id: "background", label: "Background", icon: RAIL_ICONS.background },
                  { id: "hud", label: "HUD", icon: RAIL_ICONS.hud },
                  { id: "stats", label: "Stats", icon: RAIL_ICONS.stats },
                  { id: "bookmarks", label: "Bookmarks", icon: RAIL_ICONS.bookmarks },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`smap-rail-btn${activeRailItem === item.id ? " smap-rail-btn--active" : ""}`}
                  onClick={() =>
                    setActiveRailItem((prev) =>
                      prev === item.id ? null : item.id
                    )
                  }
                  title={item.label}
                  aria-label={item.label}
                  aria-pressed={activeRailItem === item.id}
                >
                  <RailIcon d={item.icon} />
                  <span className="smap-rail-label">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Centre: 3D canvas */}
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

              <div className="smap-info-section smap-info-section--presets">
                <p className="smap-info-label">View Presets</p>
                <select className="smap-info-preset-select" aria-label="View preset">
                  <option value="default">Default</option>
                  <option value="overview">Overview</option>
                  <option value="interior">Interior</option>
                  <option value="aft">Aft Deck</option>
                </select>
              </div>

              <button type="button" className="smap-info-save-btn">
                Save Current View
              </button>
            </aside>
          </div>

          {/* Bottom controls bar */}
          <div className="smap-viewer-footer" role="toolbar" aria-label="Camera controls">
            {(
              [
                {
                  label: "Rotate",
                  icon: "M12 2a10 10 0 100 20A10 10 0 0012 2zm0 0v4m0 12v4M2 12h4m12 0h4",
                },
                {
                  label: "Pan",
                  icon: "M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M12 12h.01",
                },
                {
                  label: "Zoom",
                  icon: "M11 5a6 6 0 100 12A6 6 0 0011 5zm9 9l-4.35-4.35M11 8v6m-3-3h6",
                },
              ] as const
            ).map((ctrl) => (
              <div key={ctrl.label} className="smap-footer-ctrl">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width="14"
                  height="14"
                  aria-hidden
                >
                  <path d={ctrl.icon} />
                </svg>
                <span>{ctrl.label}</span>
              </div>
            ))}

            <button type="button" className="smap-footer-reset">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="14"
                height="14"
                aria-hidden
              >
                <path d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15" />
              </svg>
              Reset Camera
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
