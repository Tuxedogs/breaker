const STANDBY_ART_URL = "/images/crafting/hero-artwork/component-thumbnails/behr-ballistic-gatling-s4.webp";

export default function InspectionBayEmptyState() {
  return (
    <section className="cdp-inspection-bay" aria-labelledby="cdp-empty-title">
      <header className="cdp-inspection-status">
        <span aria-hidden="true" />
        <p>Fabrication inspection bay / standby</p>
        <small>Assembly reference 04-A</small>
      </header>

      <div className="cdp-inspection-visual" aria-hidden="true">
        <svg className="cdp-inspection-geometry" viewBox="0 0 900 560" preserveAspectRatio="xMidYMid meet">
          <defs>
            <pattern id="cdp-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="0.65" />
            </pattern>
            <linearGradient id="cdp-axis" x1="0" x2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0" />
              <stop offset="0.18" stopColor="currentColor" stopOpacity="0.34" />
              <stop offset="0.82" stopColor="currentColor" stopOpacity="0.34" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="900" height="560" fill="url(#cdp-grid)" opacity="0.24" />
          <g fill="none" stroke="currentColor">
            <circle cx="470" cy="250" r="184" opacity="0.32" />
            <circle cx="470" cy="250" r="142" opacity="0.2" />
            <circle cx="470" cy="250" r="94" opacity="0.14" />
            <path d="M470 40v420M120 250h700" opacity="0.2" />
            <path d="M338 118a186 186 0 0 1 264 0M338 382a186 186 0 0 0 264 0" opacity="0.22" strokeDasharray="8 12" />
            <path d="M265 110h-88v62M668 116h74v58M214 356h-62v-56M688 350h82v-58" opacity="0.36" />
            <path d="M92 250h728" stroke="url(#cdp-axis)" opacity="0.7" />
          </g>
          <g fill="currentColor" opacity="0.38">
            <rect x="112" y="244" width="8" height="12" />
            <rect x="816" y="244" width="8" height="12" />
            <rect x="464" y="44" width="12" height="8" />
            <rect x="464" y="456" width="12" height="8" />
          </g>
        </svg>

        <div className="cdp-inspection-axis" />
        <div className="cdp-inspection-scan cdp-inspection-scan--one" />
        <div className="cdp-inspection-scan cdp-inspection-scan--two" />
        <div className="cdp-inspection-scan cdp-inspection-scan--three" />
        <img className="cdp-inspection-component" src={STANDBY_ART_URL} alt="" />

        <div className="cdp-inspection-callout cdp-inspection-callout--frame"><span>Frame</span></div>
        <div className="cdp-inspection-callout cdp-inspection-callout--drive"><span>Drive</span></div>
        <div className="cdp-inspection-callout cdp-inspection-callout--thermal"><span>Thermal</span></div>
        <div className="cdp-inspection-callout cdp-inspection-callout--output"><span>Output</span></div>

        <div className="cdp-inspection-plinth">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="cdp-inspection-copy">
        <p className="cdp-inspection-kicker">Inspection system idle</p>
        <h2 id="cdp-empty-title">Select a component</h2>
        <p>Inspect materials, attributes, statistics, and blueprint requirements.</p>
      </div>

      <footer className="cdp-inspection-footer">
        <span aria-hidden="true">◇</span>
        <p>Select a blueprint to enable queue action</p>
        <span aria-hidden="true">›</span>
      </footer>
    </section>
  );
}
