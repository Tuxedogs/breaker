import { useLocation, NavLink } from "react-router-dom";

// ── SVG micro-icons ────────────────────────────────────────────────
function TabIcon({ d }: { d: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="dash-topbar-tab-icon"
    >
      <path d={d} />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="dash-search-icon">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dash-user-chevron">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// ── Pillar tabs ────────────────────────────────────────────────────
const tabs = [
  {
    label: "Combat",
    icon: "M12 2l9 4.5v7c0 5-3.6 9.7-9 11-5.4-1.3-9-6-9-11V6.5L12 2z",
    activePaths: ["/tools/alpha-threshold", "/tools/gunnery", "/modules"],
  },
  {
    label: "Ships",
    icon: "M12 2L2 7v10l10 5 10-5V7L12 2zM12 22V12M2 7l10 5 10-5",
    activePaths: ["/maps"],
  },
  {
    label: "Industry",
    icon: "M2 20h20M6 20V10l6-8 6 8v10M10 20v-5h4v5",
    activePaths: [],
  },
  {
    label: "Logistics",
    icon: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",
    activePaths: [],
  },
  {
    label: "Data",
    icon: "M3 3h18v18H3V3zM3 9h18M3 15h18M9 3v18",
    activePaths: ["/refs"],
  },
] as const;

export default function DashboardTopBar() {
  const location = useLocation();

  function tabIsActive(activePaths: readonly string[]) {
    return activePaths.some((p) => location.pathname.startsWith(p));
  }

  return (
    <header className="dash-topbar" role="banner">
      {/* Pillar tabs */}
      <nav className="dash-topbar-nav" aria-label="Pillars">
        {tabs.map((tab) => {
          const active = tabIsActive(tab.activePaths);
          return (
            <NavLink
              key={tab.label}
              to={tab.activePaths[0] ?? "/dashboard"}
              className={["dash-topbar-tab", active ? "active" : ""].filter(Boolean).join(" ")}
              aria-current={active ? "page" : undefined}
            >
              <TabIcon d={tab.icon} />
              {tab.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Right controls */}
      <div className="dash-topbar-right">
        {/* Search */}
        <div className="dash-search-wrap" role="search">
          <SearchIcon />
          <input
            type="search"
            className="dash-search-input"
            placeholder="Search Scintel..."
            aria-label="Search Scintel"
          />
          <span className="dash-search-kbd" aria-hidden>CTRL K</span>
        </div>

        {/* Favourites */}
        <button type="button" className="dash-util-btn" aria-label="Favourites">
          <StarIcon />
        </button>

        {/* Notifications */}
        <button type="button" className="dash-util-btn" aria-label="Notifications (3 unread)">
          <BellIcon />
          <span className="dash-util-badge" aria-hidden>3</span>
        </button>

        {/* User */}
        <button type="button" className="dash-user-btn" aria-label="User menu">
          <div className="dash-user-avatar" aria-hidden>AP</div>
          <div className="dash-user-info">
            <span className="dash-user-name">Aegis Pilot</span>
            <span className="dash-user-level">Level 42</span>
          </div>
          <ChevronDownIcon />
        </button>
      </div>
    </header>
  );
}
