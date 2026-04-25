import { NavLink, useLocation } from "react-router-dom";

// ── Inline icon primitives ─────────────────────────────────────────
function Icon({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className="dash-sidebar-icon"
    >
      <path d={d} />
    </svg>
  );
}

// Icon path dictionary
const ICONS: Record<string, string> = {
  home: "M3 12L12 3l9 9M5 10v9a1 1 0 001 1h4v-4h4v4h4a1 1 0 001-1v-9",
  grid: "M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z",
  crosshair: "M12 2a10 10 0 100 20A10 10 0 0012 2zm0 4v2m0 10v2M2 12h2m16 0h2m-10-2a2 2 0 100 4 2 2 0 000-4z",
  shield: "M12 2l7 3v5c0 5-3 9-7 10C8 19 5 15 5 10V5l7-3z",
  target: "M22 12A10 10 0 1112 2m10 10h-4M12 2v4m0 6a2 2 0 100 4 2 2 0 000-4z",
  book: "M4 19.5A2.5 2.5 0 016.5 17H20M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15z",
  map: "M9 2L2 6v16l7-4 6 4 7-4V2l-7 4-6-4z M9 2v16M15 6v16",
  cpu: "M9 2h6a1 1 0 011 1v3h3a1 1 0 011 1v6a1 1 0 01-1 1h-3v3a1 1 0 01-1 1H9a1 1 0 01-1-1v-3H5a1 1 0 01-1-1V7a1 1 0 011-1h3V3a1 1 0 011-1zm3 6a3 3 0 100 6 3 3 0 000-6z",
  anchor: "M12 2a3 3 0 100 6 3 3 0 000-6zm0 6v14M5 9a7 7 0 0014 0",
  scale: "M12 3v18M5 6l7-3 7 3M3 18h6m6 0h6M9 12H3l-1 6h7M21 12h-6l1 6h7",
  hammer: "M15 12l-9 9a2 2 0 01-3-3l9-9M18 9l2-2-4-4-2 2M14 5l-5 5",
  pickaxe: "M14.5 4l5.5 5.5-11 11L3.5 15 14.5 4zM9 9l6 6",
  flask: "M9 3h6m-6 0v6l-4 9h14l-4-9V3m-3 0v6",
  box: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12",
  clipboard: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 5h4m-4 4h8",
  pin: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z",
  arrows: "M7 16l-4-4 4-4m10 8l4-4-4-4M3 12h18",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  tag: "M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01",
  zap: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  trending: "M23 6l-9.5 9.5-5-5L1 18",
  database: "M12 2C7.58 2 4 3.79 4 6v12c0 2.21 3.58 4 8 4s8-1.79 8-4V6c0-2.21-3.58-4-8-4zm8 12c0 1.66-3.58 3-8 3s-8-1.34-8-3m16-5c0 1.66-3.58 3-8 3S4 11.66 4 10",
  sun: "M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 6a6 6 0 100 12A6 6 0 0012 6z",
  chevrons: "M11 17l-5-5 5-5M18 17l-5-5 5-5",
};

// ── Section data ───────────────────────────────────────────────────
const sections = [
  {
    label: "HOME",
    items: [
      { label: "Home", to: "/dashboard", icon: "home", exact: true },
      { label: "Dashboard", to: "/dashboard", icon: "grid", exact: true },
    ],
  },
  {
    label: "COMBAT",
    items: [
      { label: "Weapons Matrix", to: "/tools/alpha-threshold", icon: "crosshair" },
      { label: "Armor Threshold", to: "/tools/alpha-threshold", icon: "shield" },
      { label: "Gunnery Modules", to: "/tools/gunnery", icon: "target" },
      { label: "Doctrine Library", to: "/doctrine", icon: "book", exact: true },
    ],
  },
  {
    label: "SHIPS",
    items: [
      { label: "Ship Maps", to: "/ships/maps", icon: "map" },
      { label: "Components", to: "/dashboard", icon: "cpu", wip: true },
      { label: "Hardpoints", to: "/dashboard", icon: "anchor", wip: true },
      { label: "Ship Compare", to: "/dashboard", icon: "scale", wip: true },
    ],
  },
  {
    label: "INDUSTRY",
    items: [
      { label: "Crafting", to: "/dashboard", icon: "hammer", wip: true },
      { label: "Mining", to: "/dashboard", icon: "pickaxe", wip: true },
      { label: "Refining", to: "/dashboard", icon: "flask", wip: true },
      { label: "Material Sources", to: "/dashboard", icon: "box", wip: true },
    ],
  },
  {
    label: "LOGISTICS",
    items: [
      { label: "Inventory",   to: "/logistics/inventory",   icon: "clipboard" },
      { label: "Locations",   to: "/logistics/locations",   icon: "pin" },
      { label: "Transfers",   to: "/dashboard",             icon: "arrows", wip: true },
      { label: "Build Queue", to: "/logistics/build-queue", icon: "list" },
    ],
  },
  {
    label: "DATA",
    items: [
      { label: "Patch Changes", to: "/dashboard", icon: "zap", wip: true },
      { label: "Meta Trends", to: "/dashboard", icon: "trending", wip: true },

    ],
  },
] as const;

// ── Component ──────────────────────────────────────────────────────
export default function DashboardSidebar() {
  const location = useLocation();

  function isActive(to: string, exact = false) {
    return exact
      ? location.pathname === to
      : location.pathname.startsWith(to) && to !== "/dashboard";
  }

  return (
    <aside className="dash-sidebar" aria-label="Main navigation">
      {/* Logo */}
      <div className="dash-sidebar-logo">
        <div className="dash-sidebar-logo-icon" aria-hidden>
          <svg viewBox="0 0 20 20" width="14" height="14" fill="none">
            <polygon points="10,2 18,7 18,13 10,18 2,13 2,7" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5" fill="none" />
            <circle cx="10" cy="10" r="2.5" fill="rgba(255,255,255,0.85)" />
          </svg>
        </div>
        <div className="dash-sidebar-logo-text">
          <span className="dash-sidebar-logo-name">SCINTEL</span>
          <span className="dash-sidebar-logo-tagline">KNOW. PLAN. BUILD.</span>
        </div>
      </div>

      {/* Nav sections */}
      <nav className="dash-sidebar-nav">
        {sections.map((section) => (
          <div key={section.label} className="dash-sidebar-section">
            <span className="dash-sidebar-section-label">{section.label}</span>
            {section.items.map((item) => {
              const active = item.label === "Home"
                ? location.pathname === "/dashboard"
                : isActive(item.to, "exact" in item ? item.exact : false);

              return (
                <NavLink
                  key={item.label + item.to}
                  to={item.to}
                  className={[
                    "dash-sidebar-item",
                    active ? "active" : "",
                    "wip" in item && item.wip ? "wip" : "",
                  ].filter(Boolean).join(" ")}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon d={ICONS[item.icon] ?? ICONS.grid} />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* PRO upsell */}
      <div className="dash-pro-card">
        <div className="dash-pro-title">Unlock Advanced Tools</div>
        <p className="dash-pro-desc">Saved builds, track inventory, and more.</p>
        <a href="#" className="dash-pro-btn">Login with Discord</a>
      </div>

      {/* Footer */}
      <div className="dash-sidebar-footer">
        <span className="dash-sidebar-version">SCINTEL Alpha 1.0</span>
        <button type="button" className="dash-sidebar-footer-btn" aria-label="Toggle theme">
          <Icon d={ICONS.sun} size={13} />
        </button>
        <button type="button" className="dash-sidebar-footer-btn" aria-label="Collapse sidebar">
          <Icon d={ICONS.chevrons} size={13} />
        </button>
      </div>
    </aside>
  );
}
