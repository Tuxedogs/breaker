import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { getModuleIndexHref } from "../lib/moduleIndexNavigation";

const navItems = [
  {
    to: "/dashboard",
    label: "Home",
    desktopActiveClassName: "site-toolbar-link--home-active",
    mobileActiveClassName: "site-toolbar-mobile-link--home-active",
    isActive: (pathname: string) => pathname === "/dashboard",
  },
  {
    to: "/doctrine",
    label: "Doctrine",
    desktopActiveClassName: "site-toolbar-link--doctrine-active",
    mobileActiveClassName: "site-toolbar-mobile-link--doctrine-active",
    isActive: (pathname: string) => pathname.startsWith("/module/"),
    preserveModuleSearch: true,
  },
  {
    to: "/tools/gunnery",
    label: "Gunnery",
    desktopActiveClassName: "site-toolbar-link--gunnery-active",
    mobileActiveClassName: "site-toolbar-mobile-link--gunnery-active",
    isActive: (pathname: string) => pathname.startsWith("/tools/gunnery"),
  },
  {
    to: "/tools/alpha-threshold",
    label: "Weapons Analysis",
    desktopActiveClassName: "site-toolbar-link--alpha-active",
    mobileActiveClassName: "site-toolbar-mobile-link--alpha-active",
    isActive: (pathname: string) => pathname.startsWith("/tools/alpha-threshold"),
  },
  {
    to: "/maps",
    label: "Maps",
    desktopActiveClassName: "site-toolbar-link--maps-active",
    mobileActiveClassName: "site-toolbar-mobile-link--maps-active",
    isActive: (pathname: string) => pathname.startsWith("/maps"),
  },
];

function HomeIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M12 4.5 4.5 10.7a1 1 0 1 0 1.3 1.54l.7-.58V19a1 1 0 0 0 1 1h3.8a1 1 0 0 0 1-1v-3.4h1.4V19a1 1 0 0 0 1 1h3.8a1 1 0 0 0 1-1v-7.34l.7.58a1 1 0 1 0 1.3-1.54L12 4.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="M4 6.5a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Zm0 5.5a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Zm0 5.5a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SignalIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

export default function AppNav() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const homeItem = navItems[0];
  const primaryNavItems = navItems.slice(1);
  const getNavHref = (item: (typeof navItems)[number]) =>
    "preserveModuleSearch" in item && item.preserveModuleSearch
      ? getModuleIndexHref(location.pathname === "/doctrine" ? location.search : "")
      : item.to;

  function closeAllMenus() {
    setMobileMenuOpen(false);
  }

  return (
    <header className="app-nav-band pointer-events-auto fixed inset-x-0 top-0 z-30 opacity-100 transition-opacity">
      <nav className="app-nav-shell" aria-label="Primary">
        <div className="hidden site-toolbar lg:flex">
          <div className="site-toolbar-group site-toolbar-group--home">
            <NavLink
              to={getNavHref(homeItem)}
              onClick={closeAllMenus}
              className={[
                "site-toolbar-home",
                homeItem.isActive(location.pathname) ? "site-toolbar-home-active" : "",
              ].join(" ")}
              aria-label="Home"
            >
              <HomeIcon />
            </NavLink>
          </div>

          {primaryNavItems.map((item) => (
            <div key={item.to} className="site-toolbar-group">
              <span className="site-toolbar-divider" aria-hidden="true" />
              <NavLink
                to={getNavHref(item)}
                onClick={closeAllMenus}
                className={[
                  "site-toolbar-link",
                  item.isActive(location.pathname) ? item.desktopActiveClassName : "",
                ].join(" ")}
              >
                {item.label}
              </NavLink>
            </div>
          ))}

          <div className="site-toolbar-right">
            <span className="site-toolbar-status-pip" aria-label="System live">LIVE</span>
            <span className="site-toolbar-divider" aria-hidden="true" />
            <button type="button" className="site-toolbar-util-btn" aria-label="Connectivity status">
              <SignalIcon />
            </button>
            <button type="button" className="site-toolbar-util-btn" aria-label="Settings">
              <GearIcon />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between lg:hidden">
          <div className="site-toolbar-mobile-title">Navigation</div>

          <div className="flex items-center gap-2">
            <NavLink
              to={getNavHref(homeItem)}
              onClick={closeAllMenus}
              className={[
                "site-toolbar-mobile-button",
                homeItem.isActive(location.pathname) ? "site-toolbar-mobile-button--active" : "",
              ].join(" ")}
              aria-label="Home"
            >
              <HomeIcon />
            </NavLink>

            <button
              type="button"
              className="site-toolbar-mobile-menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-main-menu"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
            >
              <MenuIcon />
              Menu
            </button>
          </div>
        </div>

        <div
          id="mobile-main-menu"
          className={[
            "overflow-hidden transition-[max-height,opacity] duration-200 lg:hidden",
            mobileMenuOpen ? "max-h-[70vh] pt-2 opacity-100" : "max-h-0 opacity-0",
          ].join(" ")}
        >
          <div className="site-toolbar-mobile-panel">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={getNavHref(item)}
                onClick={closeAllMenus}
                className={[
                  "site-toolbar-mobile-link",
                  item.isActive(location.pathname) ? item.mobileActiveClassName : "",
                ].join(" ")}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
}
