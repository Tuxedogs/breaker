import { Link } from "react-router-dom";
import DonutChart from "../components/dashboard/DonutChart";
import {
  mockStats,
  mockInventory,
  mockMaterialShortages,
  mockBuildQueue,
  mockLocations,
  mockUpdates,
  mockSystemStatus,
  quickAccessItems,
  popularToolItems,
  type QuickAccessItem,
} from "../data/mock/dashboard";

// ── Shared arrow icon for footer links ─────────────────────────────
function ArrowRight({ size = 12 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} className="dash-card-footer-arrow">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

// ── Stat card icon shapes ──────────────────────────────────────────
function StatIcon({ type }: { type: "materials" | "owned" | "needed" | "shortage" | "queue" }) {
  const configs = {
    materials: { bg: "rgba(167,139,250,0.12)", color: "#a78bfa", d: "M12 2L2 7v10l10 5 10-5V7L12 2zm0 5l5 2.5v5L12 17l-5-2.5v-5L12 7z" },
    owned: { bg: "rgba(56,189,248,0.12)", color: "#38bdf8", d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" },
    needed: { bg: "rgba(167,139,250,0.12)", color: "#a78bfa", d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m-.01 4h.01" },
    shortage: { bg: "rgba(248,113,113,0.12)", color: "#f87171", d: "M12 2L2 19h20L12 2zm0 6v5m0 4h.01" },
    queue: { bg: "rgba(251,146,60,0.12)", color: "#fb923c", d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  } as const;
  const c = configs[type];
  return (
    <div className="dash-stat-icon-wrap" style={{ background: c.bg }}>
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke={c.color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <path d={c.d} />
      </svg>
    </div>
  );
}

// ── Material hexagon placeholder icon ─────────────────────────────
function MatIcon() {
  return (
    <span className="dash-mat-icon" aria-hidden>
      <svg viewBox="0 0 12 12" width="10" height="10" fill="none">
        <polygon points="6,1 11,3.5 11,8.5 6,11 1,8.5 1,3.5" stroke="rgba(167,139,250,0.6)" strokeWidth="1" />
      </svg>
    </span>
  );
}

// ── Build queue thumbnail ──────────────────────────────────────────
function BqThumb({ color }: { color: string }) {
  return (
    <div className="dash-bq-thumb">
      <svg viewBox="0 0 20 20" width="14" height="14" fill="none">
        <rect x="3" y="7" width="14" height="10" rx="1.5" stroke={color} strokeWidth="1.4" />
        <path d="M7 7V5a3 3 0 016 0v2" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// ── Quick access icon factory ──────────────────────────────────────
const quickIcons: Record<string, string> = {
  inventory: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  materials: "M12 2L2 7v10l10 5 10-5V7L12 2z",
  mining: "M15 12l-9 9a2 2 0 01-3-3l9-9M18 9l2-2-4-4-2 2",
  ship: "M12 2L2 7v10l10 5 10-5V7L12 2zM12 22V12M2 7l10 5 10-5",
  build: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-6 9l2 2 4-4",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  weapons: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4v4l3 3",
  armor: "M12 2l7 3v5c0 5-3 9-7 10C8 19 5 15 5 10V5l7-3z",
  compare: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18",
  refinery: "M9 3h6m-6 0v6l-4 9h14l-4-9V3m-3 0v6",
  price: "M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
};

function QuickIcon({ icon }: { icon: string }) {
  return (
    <div className="dash-quick-icon">
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="17" height="17">
        <path d={quickIcons[icon] ?? quickIcons.inventory} />
      </svg>
    </div>
  );
}

// ── Status row icons ───────────────────────────────────────────────
function StatusRowIcon({ d }: { d: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="dash-status-row-icon">
      <path d={d} />
    </svg>
  );
}

// ── Location icon ──────────────────────────────────────────────────
function LocationIcon({ type }: { type: string }) {
  const d = type === "station"
    ? "M12 2L2 7v10l10 5 10-5V7L12 2z"
    : "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z";
  return (
    <div className="dash-location-icon">
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
        <path d={d} />
      </svg>
    </div>
  );
}

export default function DashboardPage() {
  const ownedPct = Math.round((mockInventory.owned / mockInventory.needed) * 100);

  return (
    <div className="dash-content-grid">
      {/* ── Main column ── */}
      <div className="dash-main-col">

        {/* Hero */}
        <section className="dash-hero" aria-label="Welcome">
          <div className="dash-hero-content">
            <p className="dash-hero-kicker">Welcome to Scintel</p>
            <h1 className="dash-hero-title">
              Intelligence for those<br />who Build the Verse.
            </h1>
            <p className="dash-hero-subtitle">
              Tools, data, and planning systems for<br />
              combat and industry.
            </p>
            <Link to="/tools/alpha-threshold" className="dash-hero-cta">
              Explore Tools
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="dash-hero-cta-arrow">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Slide dots */}
          <div className="dash-hero-controls" aria-hidden>
            <div className="dash-hero-dot active" />
            <div className="dash-hero-dot" />
            <div className="dash-hero-dot" />
          </div>

          {/* Slide nav */}
          <div className="dash-hero-nav" aria-hidden>
            <button type="button" className="dash-hero-nav-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button type="button" className="dash-hero-nav-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </section>

        {/* Stats row */}
        <section className="dash-stats-row" aria-label="Summary statistics">
          {/* Total Materials */}
          <div className="dash-stat-card">
            <div className="dash-stat-main">
              <div className="dash-stat-label">Total Materials</div>
              <div className="dash-stat-value">{mockStats.totalMaterials.count}</div>
              <div className="dash-stat-sublabel">{mockStats.totalMaterials.label}</div>
            </div>
            <StatIcon type="materials" />
          </div>

          {/* Total Owned */}
          <div className="dash-stat-card">
            <div className="dash-stat-main">
              <div className="dash-stat-label">Total Owned</div>
              <div className="dash-stat-value">
                {mockStats.totalOwned.value}
                <span className="dash-stat-unit">{mockStats.totalOwned.unit}</span>
              </div>
              <div className="dash-stat-sublabel">{mockStats.totalOwned.label}</div>
            </div>
            <StatIcon type="owned" />
          </div>

          {/* Total Needed */}
          <div className="dash-stat-card">
            <div className="dash-stat-main">
              <div className="dash-stat-label">Total Needed</div>
              <div className="dash-stat-value">
                {mockStats.totalNeeded.value}
                <span className="dash-stat-unit">{mockStats.totalNeeded.unit}</span>
              </div>
              <div className="dash-stat-sublabel">{mockStats.totalNeeded.label}</div>
            </div>
            <StatIcon type="needed" />
          </div>

          {/* Shortage */}
          <div className="dash-stat-card">
            <div className="dash-stat-main">
              <div className="dash-stat-label">Shortage</div>
              <div className="dash-stat-value dash-stat-value--shortage">
                {mockStats.shortage.value}
                <span className="dash-stat-unit" style={{ color: "rgba(248,113,113,0.6)" }}>
                  {mockStats.shortage.unit}
                </span>
              </div>
              <div className="dash-stat-sublabel">{mockStats.shortage.label}</div>
            </div>
            <StatIcon type="shortage" />
          </div>

          {/* Build Queue */}
          <div className="dash-stat-card">
            <div className="dash-stat-main">
              <div className="dash-stat-label">Build Queue</div>
              <div className="dash-stat-value">{mockStats.buildQueue.count}</div>
              <div className="dash-stat-sublabel">{mockStats.buildQueue.label}</div>
            </div>
            <StatIcon type="queue" />
          </div>
        </section>

        {/* Cards row: Inventory | Shortages | Build Queue */}
        <div className="dash-cards-row">

          {/* Inventory Overview */}
          <article className="dash-card" aria-label="Inventory overview">
            <div className="dash-card-header">
              <span className="dash-card-title">Inventory Overview</span>
            </div>
            <div className="dash-card-body dash-inventory-body">
              <div className="dash-donut-wrap">
                <DonutChart
                  owned={mockInventory.owned}
                  needed={mockInventory.needed}
                  shortage={mockInventory.shortage}
                  size={148}
                  strokeWidth={14}
                />
                <div className="dash-donut-center">
                  <div className="dash-donut-center-value">{mockInventory.owned}</div>
                  <div className="dash-donut-center-unit">SCU</div>
                  <div className="dash-donut-center-pct">{ownedPct}% of Needed</div>
                </div>
              </div>
              <div className="dash-donut-legend">
                <div className="dash-donut-legend-row">
                  <span className="dash-donut-legend-dot" style={{ background: "#a78bfa" }} />
                  Owned
                  <span className="dash-donut-legend-value">{mockInventory.owned} SCU</span>
                </div>
                <div className="dash-donut-legend-row">
                  <span className="dash-donut-legend-dot" style={{ background: "#4ade80" }} />
                  Needed
                  <span className="dash-donut-legend-value">{mockInventory.needed} SCU</span>
                </div>
                <div className="dash-donut-legend-row">
                  <span className="dash-donut-legend-dot" style={{ background: "#f87171" }} />
                  Shortage
                  <span className="dash-donut-legend-value">{mockInventory.shortage} SCU</span>
                </div>
              </div>
            </div>
            <div className="dash-card-footer">
              <Link to="/dashboard" className="dash-card-footer-link">
                Go to Inventory <ArrowRight />
              </Link>
            </div>
          </article>

          {/* Material Shortages */}
          <article className="dash-card" aria-label="Material shortages">
            <div className="dash-card-header">
              <span className="dash-card-title">Material Shortages</span>
            </div>
            <div className="dash-card-body">
              <table className="dash-shortages-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Owned</th>
                    <th>Needed</th>
                    <th>Shortage</th>
                  </tr>
                </thead>
                <tbody>
                  {mockMaterialShortages.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="dash-mat-cell">
                          <MatIcon />
                          {row.name}
                        </div>
                      </td>
                      <td>{row.owned}</td>
                      <td>{row.needed}</td>
                      <td>
                        <span className="dash-shortage-badge">{row.shortage}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="dash-card-footer">
              <Link to="/dashboard" className="dash-card-footer-link">
                View All Shortages <ArrowRight />
              </Link>
            </div>
          </article>

          {/* Build Queue */}
          <article className="dash-card" aria-label="Build queue">
            <div className="dash-card-header">
              <span className="dash-card-title">Build Queue</span>
              <div className="dash-card-meta">
                <span>{mockStats.buildQueue.count} Items Queued</span>
                <span className="dash-card-meta-sep">·</span>
                <span>Est. 2h 47m</span>
              </div>
            </div>
            <div className="dash-card-body">
              <ul className="dash-bq-list" role="list">
                {mockBuildQueue.map((item) => {
                  const queued = item.progress < 0;
                  return (
                    <li key={item.id} className="dash-bq-item">
                      <BqThumb color={item.accentColor} />
                      <div className="dash-bq-info">
                        <div className="dash-bq-name">{item.name}</div>
                        <div className="dash-bq-bar-wrap" aria-hidden>
                          <div
                            className="dash-bq-bar-fill"
                            style={{ width: queued ? "0%" : `${item.progress}%` }}
                          />
                        </div>
                      </div>
                      <div className="dash-bq-right">
                        <div className="dash-bq-qty">{item.qty}x</div>
                        {queued ? (
                          <div className="dash-bq-queued">Queued</div>
                        ) : (
                          <div className="dash-bq-pct">{item.progress}%</div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="dash-card-footer">
              <Link to="/dashboard" className="dash-card-footer-link">
                View Build Queue <ArrowRight />
              </Link>
            </div>
          </article>
        </div>

        {/* Quick Access + Popular Tools */}
        <div className="dash-bottom-row">
          <QuickSection title="Quick Access" items={quickAccessItems} />
          <QuickSection title="Popular Tools" items={popularToolItems} />
        </div>
      </div>

      {/* ── Right column ── */}
      <aside className="dash-right-col" aria-label="System panels">

        {/* System Status */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <span className="dash-panel-title">System Status</span>
          </div>
          <div className="dash-panel-body">
            <div className="dash-status-all-good">
              <div className="dash-status-green-dot" aria-hidden />
              <span className="dash-status-ok-text">{mockSystemStatus.overall}</span>
            </div>
            <div className="dash-status-rows">
              <StatusRow icon="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 5v5l3 3" label="Data Updated" value={mockSystemStatus.dataUpdated} muted />
              <StatusRow icon="M12 2l9 4.5v7c0 5-3.6 9.7-9 11-5.4-1.3-9-6-9-11V6.5L12 2z" label="API Status" value={mockSystemStatus.apiStatus} />
              <StatusRow icon="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" label="Build Engine" value={mockSystemStatus.buildEngine} />
              <StatusRow icon="M21 5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5z M3 10h18" label="Database" value={mockSystemStatus.database} />
            </div>
          </div>
          <div className="dash-panel-footer">
            <a href="#" className="dash-panel-link">View Status Page <ArrowRight size={10} /></a>
          </div>
        </div>

        {/* Favorite Locations */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <span className="dash-panel-title">Favorite Locations</span>
          </div>
          <div className="dash-panel-body">
            <ul className="dash-locations-list" role="list">
              {mockLocations.map((loc) => (
                <li key={loc.id} className="dash-location-row">
                  <LocationIcon type={loc.type} />
                  <span className="dash-location-name">{loc.name}</span>
                  <span className="dash-location-scu">{loc.scu.toFixed(2)} SCU</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="dash-panel-footer">
            <a href="#" className="dash-panel-link">View All Locations <ArrowRight size={10} /></a>
          </div>
        </div>

        {/* Latest Updates */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <span className="dash-panel-title">Latest Updates</span>
          </div>
          <div className="dash-panel-body">
            <ul className="dash-updates-list" role="list">
              {mockUpdates.map((update) => (
                <li key={update.id} className="dash-update-item">
                  <div className="dash-update-thumb" aria-hidden>
                    <svg viewBox="0 0 20 14" width="24" height="17" fill="none">
                      <rect width="20" height="14" rx="2" fill={update.accentColor} fillOpacity="0.15" />
                      <path d="M6 4h8M6 7h5M6 10h7" stroke={update.accentColor} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.7" />
                    </svg>
                  </div>
                  <div className="dash-update-info">
                    <div className="dash-update-title">{update.title}</div>
                    <div className="dash-update-desc">{update.description}</div>
                    <div className="dash-update-date">{update.date}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="dash-panel-footer">
            <a href="#" className="dash-panel-link">View All Updates <ArrowRight size={10} /></a>
          </div>
        </div>
      </aside>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function StatusRow({
  icon,
  label,
  value,
  muted = false,
}: {
  icon: string;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="dash-status-row">
      <span className="dash-status-row-label">
        <StatusRowIcon d={icon} />
        {label}
      </span>
      <span className={["dash-status-row-value", muted ? "dash-status-row-value--muted" : ""].filter(Boolean).join(" ")}>
        {value}
      </span>
    </div>
  );
}

function QuickSection({ title, items }: { title: string; items: readonly QuickAccessItem[] }) {
  return (
    <div className="dash-section-card">
      <div className="dash-section-header">
        <span className="dash-section-title">{title}</span>
      </div>
      <div className="dash-section-body">
        <div className="dash-quick-grid">
          {items.map((item) => (
            <Link key={item.label} to={item.to} className="dash-quick-item">
              <QuickIcon icon={item.icon} />
              <span className="dash-quick-label">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
