import { useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import AppBackground from "./AppBackground";

const shipItems = [
  { to: "/ships/perseus", label: "Perseus" },
  { to: "/ships/polaris", label: "Polaris" },
  { to: "/ships/idris", label: "Idris" },
];
const systemItems = [
  { to: "/systems/sub-targeting", label: "Sub-Targeting" },
  { to: "/systems/turret-keybinds", label: "Turret Keybinds" },
  { to: "/systems/additional-settings-binds", label: "Additional Settings & Binds" },
  { to: "/systems/gunnery-with-luna", label: "Gunnery with Luna" },
  { to: "/systems/communications", label: "Communications" },
];

type MenuKey = "ships" | "systems";

function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className}>
      <path
        d="M11 4a7 7 0 1 0 4.45 12.4l3.57 3.57a1 1 0 0 0 1.42-1.42l-3.57-3.57A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z"
        fill="currentColor"
      />
    </svg>
  );
}

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
      <path d="M6.7 9.29a1 1 0 0 1 1.42 0L12 13.17l3.88-3.88a1 1 0 0 1 1.41 1.42l-4.58 4.58a1 1 0 0 1-1.42 0L6.7 10.7a1 1 0 0 1 0-1.41Z" fill="currentColor" />
    </svg>
  );
}

export default function AppShell() {
  const location = useLocation();
  const [desktopMenu, setDesktopMenu] = useState<MenuKey | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSectionOpen, setMobileSectionOpen] = useState<MenuKey | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const isMapsRoute = location.pathname.startsWith("/maps");
  const isFrameworkNavActive =
    location.pathname === "/framework" ||
    location.pathname === "/index" ||
    location.pathname === "/modules" ||
    location.pathname.startsWith("/module/");

  function goToHero() {
    sessionStorage.removeItem("ares:entered-framework");
  }

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

  const navItemClass =
    "inline-flex h-11 items-center rounded-md px-2 text-xs uppercase tracking-[0.14em] text-slate-200 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/70 sm:text-sm";

  const menuButtonClass =
    "inline-flex h-11 items-center gap-1 rounded-md px-2 text-xs uppercase tracking-[0.14em] text-slate-200 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/70 sm:text-sm";

  return (
    <div className="relative min-h-screen overflow-x-hidden text-slate-100">
      <AppBackground />

      <header className="fixed inset-x-0 top-0 z-30 px-4 pb-3 pt-5 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-white/15 bg-black/45 px-3 py-2 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <NavLink
              to="/"
              onClick={() => {
                goToHero();
                closeAllMenus();
              }}
              className="inline-flex h-11 items-center gap-3 rounded-md px-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/70"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/45 bg-white/10">
                <span className="h-2 w-2 rounded-full bg-white" />
              </span>
              <span className="title-font text-sm tracking-[0.2em] sm:text-base">ARES</span>
            </NavLink>

            <div className="hidden items-center gap-1 lg:flex">
              <NavLink
                to="/"
                onClick={closeAllMenus}
                className={({ isActive }) =>
                  [navItemClass, isActive ? "text-white" : ""].join(" ")
                }
                aria-label="Home"
              >
                <HomeIcon />
              </NavLink>

              <div className="relative" onMouseEnter={() => openDesktopMenu("ships")} onMouseLeave={closeDesktopMenuSoon}>
                <button
                  type="button"
                  className={menuButtonClass}
                  aria-expanded={desktopMenu === "ships"}
                  aria-controls="desktop-ships-menu"
                  onClick={() => toggleDesktopMenu("ships")}
                >
                  Ships
                  <ChevronIcon expanded={desktopMenu === "ships"} />
                </button>

                <div
                  id="desktop-ships-menu"
                  className={[
                    "pointer-events-none absolute left-1/2 top-full z-40 mt-1 w-52 -translate-x-1/2 rounded-md border border-amber-300/25 bg-black/80 p-2 opacity-0 shadow-[0_12px_24px_rgba(0,0,0,0.35)] backdrop-blur-md transition",
                    desktopMenu === "ships" ? "pointer-events-auto opacity-100" : "",
                  ].join(" ")}
                >
                  {shipItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={closeAllMenus}
                      className={({ isActive }) =>
                        [
                          "flex h-11 items-center rounded px-2 text-xs uppercase tracking-[0.14em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 sm:text-sm",
                          isActive ? "text-amber-300" : "text-slate-200 hover:bg-amber-300/10 hover:text-amber-300",
                        ].join(" ")
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>

              <div className="relative" onMouseEnter={() => openDesktopMenu("systems")} onMouseLeave={closeDesktopMenuSoon}>
                <button
                  type="button"
                  className={menuButtonClass}
                  aria-expanded={desktopMenu === "systems"}
                  aria-controls="desktop-systems-menu"
                  onClick={() => toggleDesktopMenu("systems")}
                >
                  Systems
                  <ChevronIcon expanded={desktopMenu === "systems"} />
                </button>

                <div
                  id="desktop-systems-menu"
                  className={[
                    "pointer-events-none absolute left-1/2 top-full z-40 mt-1 w-64 -translate-x-1/2 rounded-md border border-cyan-300/25 bg-black/80 p-2 opacity-0 shadow-[0_12px_24px_rgba(0,0,0,0.35)] backdrop-blur-md transition",
                    desktopMenu === "systems" ? "pointer-events-auto opacity-100" : "",
                  ].join(" ")}
                >
                  {systemItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={closeAllMenus}
                      className={({ isActive }) =>
                        [
                          "flex min-h-11 items-center rounded px-2 py-2 text-xs uppercase tracking-[0.12em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 sm:text-sm",
                          isActive ? "text-cyan-300" : "text-slate-200 hover:bg-cyan-300/10 hover:text-cyan-300",
                        ].join(" ")
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>

              <NavLink
                to="/maps"
                onClick={closeAllMenus}
                className={({ isActive }) =>
                  [navItemClass, isActive ? "text-blue-300" : "hover:text-blue-300"].join(" ")
                }
              >
                Maps
              </NavLink>

              <NavLink
                to="/framework"
                onClick={closeAllMenus}
                className={({ isActive }) =>
                  [
                    navItemClass,
                    isActive || isFrameworkNavActive ? "text-emerald-300" : "hover:text-emerald-300",
                  ].join(" ")
                }
              >
                Framework
              </NavLink>

              <label className="inline-flex h-11 items-center gap-2 rounded-md border border-white/20 bg-black/25 px-2 text-xs uppercase tracking-[0.14em] text-slate-200 sm:text-sm">
                <SearchIcon />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search"
                  className="w-32 bg-transparent text-xs uppercase tracking-[0.14em] text-slate-100 outline-none placeholder:text-slate-300/75 sm:w-36 sm:text-sm"
                  aria-label="Search"
                />
              </label>
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              <NavLink
                to="/"
                onClick={closeAllMenus}
                className={({ isActive }) =>
                  [
                    "inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-200 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/70",
                    isActive ? "text-white" : "",
                  ].join(" ")
                }
                aria-label="Home"
              >
                <HomeIcon />
              </NavLink>

              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-md border border-white/20 bg-black/35 px-3 text-xs uppercase tracking-[0.14em] text-slate-100 transition hover:border-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/70"
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
            <div className="space-y-1 rounded-lg border border-white/15 bg-black/40 p-2">
              <NavLink
                to="/maps"
                onClick={closeAllMenus}
                className={({ isActive }) =>
                  [
                    "flex h-11 items-center rounded-md px-3 text-sm uppercase tracking-[0.1em] transition",
                    isActive ? "bg-blue-300/10 text-blue-300" : "text-slate-100 hover:bg-white/5",
                  ].join(" ")
                }
              >
                Maps
              </NavLink>

              <NavLink
                to="/framework"
                onClick={closeAllMenus}
                className={({ isActive }) =>
                  [
                    "flex h-11 items-center rounded-md px-3 text-sm uppercase tracking-[0.1em] transition",
                    isActive || isFrameworkNavActive ? "bg-emerald-300/10 text-emerald-300" : "text-slate-100 hover:bg-white/5",
                  ].join(" ")
                }
              >
                Framework
              </NavLink>

              <div className="rounded-md border border-white/10">
                <button
                  type="button"
                  className="flex h-11 w-full items-center justify-between px-3 text-left text-sm uppercase tracking-[0.1em] text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
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
                          "flex min-h-11 items-center border-t border-white/10 px-4 text-sm transition",
                          isActive ? "text-amber-300" : "text-slate-300 hover:bg-amber-300/10 hover:text-amber-200",
                        ].join(" ")
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-white/10">
                <button
                  type="button"
                  className="flex h-11 w-full items-center justify-between px-3 text-left text-sm uppercase tracking-[0.1em] text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                  aria-expanded={mobileSectionOpen === "systems"}
                  aria-controls="mobile-systems-menu"
                  onClick={() => toggleMobileSection("systems")}
                >
                  Systems
                  <ChevronIcon expanded={mobileSectionOpen === "systems"} />
                </button>
                <div
                  id="mobile-systems-menu"
                  className={[
                    "overflow-hidden transition-[max-height] duration-200",
                    mobileSectionOpen === "systems" ? "max-h-96" : "max-h-0",
                  ].join(" ")}
                >
                  {systemItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={closeAllMenus}
                      className={({ isActive }) =>
                        [
                          "flex min-h-11 items-center border-t border-white/10 px-4 text-sm transition",
                          isActive ? "text-cyan-300" : "text-slate-300 hover:bg-cyan-300/10 hover:text-cyan-200",
                        ].join(" ")
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>

              <label className="mt-1 flex h-11 items-center gap-2 rounded-md border border-white/20 bg-black/35 px-3 text-sm text-slate-200">
                <SearchIcon className="h-4 w-4" />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search"
                  className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-300/70"
                  aria-label="Search"
                />
              </label>
            </div>
          </div>
        </div>
      </header>

      <main
        className={[
          "relative z-20 mx-auto w-full px-4 pb-8 pt-24 sm:px-6 lg:px-8",
          isMapsRoute ? "max-w-[96vw]" : "max-w-7xl",
        ].join(" ")}
      >
        <Outlet />
      </main>
    </div>
  );
}
