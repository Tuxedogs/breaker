import { useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

const shipItems = [
  { to: "/ships/perseus", label: "Perseus" },
  { to: "/ships/polaris", label: "Polaris" },
  { to: "/ships/idris", label: "Idris" },
];

type MenuKey = "ships";

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

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={["h-4 w-4 transition", expanded ? "rotate-180" : ""].join(" ")}
    >
      <path
        d="M6.7 9.29a1 1 0 0 1 1.42 0L12 13.17l3.88-3.88a1 1 0 0 1 1.41 1.42l-4.58 4.58a1 1 0 0 1-1.42 0L6.7 10.7a1 1 0 0 1 0-1.41Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function AppNav() {
  const location = useLocation();
  const [desktopMenu, setDesktopMenu] = useState<MenuKey | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSectionOpen, setMobileSectionOpen] = useState<MenuKey | null>(null);
  const isMapsRoute = location.pathname.startsWith("/maps");
  const isAlphaThresholdRoute = location.pathname.startsWith("/tools/alpha-threshold");
  const isShipsRoute = location.pathname.startsWith("/ships");
  const isHomeRoute = location.pathname === "/";
  const isFrameworkNavActive =
    location.pathname === "/framework" ||
    location.pathname === "/index" ||
    location.pathname === "/modules" ||
    location.pathname.startsWith("/module/");
  function closeAllMenus() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setDesktopMenu(null);
    setMobileMenuOpen(false);
    setMobileSectionOpen(null);
  }

  function clearCloseTimer() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function toggleDesktopMenu(menu: MenuKey) {
    clearCloseTimer();
    setDesktopMenu((prev) => (prev === menu ? null : menu));
  }

  function toggleMobileSection(menu: MenuKey) {
    setMobileSectionOpen((prev) => (prev === menu ? null : menu));
  }

  function openDesktopMenu(menu: MenuKey) {
    clearCloseTimer();
    setDesktopMenu(menu);
  }

  function closeDesktopMenuSoon() {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setDesktopMenu(null);
      closeTimerRef.current = null;
    }, 140);
  }

  return (
    <header className="app-nav-band pointer-events-auto fixed inset-x-0 top-0 z-30 opacity-100 transition-opacity">
      <nav className="app-nav-shell" aria-label="Primary">
        <div className="hidden site-toolbar lg:flex">
          <div className="site-toolbar-group site-toolbar-group--home">
            <NavLink
              to="/"
              onClick={closeAllMenus}
              className={[ "site-toolbar-home", isHomeRoute ? "site-toolbar-home-active" : ""].join(" ")}
              aria-label="Home"
            >
              <HomeIcon />
            </NavLink>
          </div>

          <span className="site-toolbar-divider" aria-hidden="true" />

          <div className="site-toolbar-group">
            <span className="site-toolbar-brand">ARES</span>
          </div>

          <span className="site-toolbar-divider" aria-hidden="true" />

          <div className="site-toolbar-group">
            <NavLink
              to="/tools/alpha-threshold"
              onClick={closeAllMenus}
              className={[
                "site-toolbar-link",
                isAlphaThresholdRoute ? "site-toolbar-link--alpha-active" : "",
              ].join(" ")}
            >
              Weapons Analysis
            </NavLink>
          </div>

          <span className="site-toolbar-divider" aria-hidden="true" />

          <div className="site-toolbar-group">
            <NavLink
              to="/framework"
              onClick={closeAllMenus}
              className={[
                "site-toolbar-link",
                isFrameworkNavActive ? "site-toolbar-link--framework-active" : "",
              ].join(" ")}
            >
              Framework
            </NavLink>
          </div>

          <span className="site-toolbar-divider" aria-hidden="true" />

          <div className="site-toolbar-group">
            <NavLink
              to="/maps"
              onClick={closeAllMenus}
              className={[
                "site-toolbar-link",
                isMapsRoute ? "site-toolbar-link--maps-active" : "",
              ].join(" ")}
            >
              Maps
            </NavLink>
          </div>

          <span className="site-toolbar-divider" aria-hidden="true" />

          <div
            className="relative"
            onMouseEnter={() => openDesktopMenu("ships")}
            onMouseLeave={closeDesktopMenuSoon}
          >
            <div className="site-toolbar-group">
              <button
                type="button"
                className={[
                  "site-toolbar-link",
                  "site-toolbar-link--menu",
                  desktopMenu === "ships" || isShipsRoute ? "site-toolbar-link--ships-active" : "",
                ].join(" ")}
                aria-expanded={desktopMenu === "ships"}
                aria-controls="desktop-ships-menu"
                onClick={() => toggleDesktopMenu("ships")}
              >
                Ships
                <ChevronIcon expanded={desktopMenu === "ships"} />
              </button>
            </div>

            <div
              id="desktop-ships-menu"
              className={[
                "site-toolbar-menu-panel",
                desktopMenu === "ships" ? "site-toolbar-menu-panel--open" : "",
              ].join(" ")}
            >
              {shipItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={closeAllMenus}
                  className={({ isActive }) =>
                    [
                      "site-toolbar-menu-link",
                      isActive ? "site-toolbar-menu-link--active" : "",
                    ].join(" ")
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between lg:hidden">
          <div className="site-toolbar-mobile-brand-wrap">
            <NavLink to="/" onClick={closeAllMenus} className="site-toolbar-mobile-brand">
              <span className="site-toolbar-brand">ARES</span>
            </NavLink>
          </div>

          <div className="flex items-center gap-2">
            <NavLink
              to="/"
              onClick={closeAllMenus}
              className={[
                "site-toolbar-mobile-button",
                isHomeRoute ? "site-toolbar-mobile-button--active" : "",
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
            <NavLink
              to="/tools/alpha-threshold"
              onClick={closeAllMenus}
              className={[
                "site-toolbar-mobile-link",
                isAlphaThresholdRoute ? "site-toolbar-mobile-link--alpha-active" : "",
              ].join(" ")}
            >
              Weapons Analysis
            </NavLink>

            <NavLink
              to="/framework"
              onClick={closeAllMenus}
              className={[
                "site-toolbar-mobile-link",
                isFrameworkNavActive ? "site-toolbar-mobile-link--framework-active" : "",
              ].join(" ")}
            >
              Framework
            </NavLink>

            <NavLink
              to="/maps"
              onClick={closeAllMenus}
              className={[
                "site-toolbar-mobile-link",
                isMapsRoute ? "site-toolbar-mobile-link--maps-active" : "",
              ].join(" ")}
            >
              Maps
            </NavLink>

            <div className="site-toolbar-mobile-section">
              <button
                type="button"
                className="site-toolbar-mobile-link site-toolbar-mobile-link--menu"
                aria-expanded={mobileSectionOpen === "ships"}
                aria-controls="mobile-ships-menu"
                onClick={() => toggleMobileSection("ships")}
              >
                Ships
                <ChevronIcon expanded={mobileSectionOpen === "ships"} />
              </button>
              <div
                id="mobile-ships-menu"
                className={[
                  "overflow-hidden transition-[max-height] duration-200",
                  mobileSectionOpen === "ships" ? "max-h-64" : "max-h-0",
                ].join(" ")}
              >
                {shipItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={closeAllMenus}
                    className={({ isActive }) =>
                      [
                        "site-toolbar-mobile-submenu-link",
                        isActive ? "site-toolbar-mobile-submenu-link--active" : "",
                      ].join(" ")
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
