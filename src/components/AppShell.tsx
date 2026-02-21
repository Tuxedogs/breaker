import { useLayoutEffect, useRef, useState } from "react";
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
  { to: "/systems/gunnery-with-luna", label: "Gunnery with Luna" },
  { to: "/systems/communications", label: "Communications" },
];

function SearchIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4">
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

export default function AppShell() {
  const { pathname } = useLocation();
  const [openMenu, setOpenMenu] = useState<"ships" | "systems" | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState(true);
  const closeTimerRef = useRef<number | null>(null);

  function clearCloseTimer() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function open(menu: "ships" | "systems") {
    clearCloseTimer();
    setOpenMenu(menu);
  }

  function closeSoon() {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpenMenu(null);
      closeTimerRef.current = null;
    }, 120);
  }

  function closeNow() {
    clearCloseTimer();
    setOpenMenu(null);
  }

  useLayoutEffect(() => {
    setIsRouteLoading(true);
    const timer = window.setTimeout(() => setIsRouteLoading(false), 580);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return (
    <div className="relative min-h-screen overflow-x-hidden text-slate-100">
      <AppBackground />

      <header className="fixed inset-x-0 top-0 z-30 px-4 pb-3 pt-5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-3 text-white">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/45 bg-white/10">
              <span className="h-2 w-2 rounded-full bg-white" />
            </span>
            <span className="title-font text-sm tracking-[0.2em] sm:text-base">ARES</span>
          </NavLink>

          <div className="flex items-center gap-4">
            <NavLink
              to="/"
              className={({ isActive }) =>
                [
                  "inline-flex items-center justify-center text-slate-200 transition hover:text-white",
                  isActive ? "text-white" : "",
                ].join(" ")
              }
              aria-label="Home"
            >
              <HomeIcon />
            </NavLink>

            <div className="relative" onMouseEnter={() => open("ships")} onMouseLeave={closeSoon}>
              <NavLink
                to="/ships/perseus"
                className={({ isActive }) =>
                  [
                    "text-xs uppercase tracking-[0.17em] transition sm:text-sm",
                    isActive ? "text-amber-300" : "text-slate-200 hover:text-amber-300",
                  ].join(" ")
                }
              >
                Ships
              </NavLink>

              <div
                className={[
                  "pointer-events-none absolute left-1/2 top-full z-40 w-52 -translate-x-1/2 pt-2 opacity-0 transition duration-150 ease-out",
                  openMenu === "ships" ? "pointer-events-auto opacity-100" : "",
                ].join(" ")}
              >
                <div
                  className={[
                    "translate-y-2 rounded-md border border-amber-300/25 bg-black/70 p-2 shadow-[0_12px_24px_rgba(0,0,0,0.35)] backdrop-blur-md transition duration-150 ease-out",
                    openMenu === "ships" ? "translate-y-0" : "",
                  ].join(" ")}
                >
                  {shipItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={closeNow}
                      className={({ isActive }) =>
                        [
                          "block rounded px-2 py-1.5 text-xs uppercase tracking-[0.14em] transition sm:text-sm",
                          isActive ? "text-amber-300" : "text-slate-200 hover:bg-amber-300/10 hover:text-amber-300",
                        ].join(" ")
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative" onMouseEnter={() => open("systems")} onMouseLeave={closeSoon}>
              <NavLink
                to="/systems/sub-targeting"
                className={({ isActive }) =>
                  [
                    "text-xs uppercase tracking-[0.17em] transition sm:text-sm",
                    isActive ? "text-cyan-300" : "text-slate-200 hover:text-cyan-300",
                  ].join(" ")
                }
              >
                Systems
              </NavLink>

              <div
                className={[
                  "pointer-events-none absolute left-1/2 top-full z-40 w-56 -translate-x-1/2 pt-2 opacity-0 transition duration-150 ease-out",
                  openMenu === "systems" ? "pointer-events-auto opacity-100" : "",
                ].join(" ")}
              >
                <div
                  className={[
                    "translate-y-2 rounded-md border border-cyan-300/25 bg-black/70 p-2 shadow-[0_12px_24px_rgba(0,0,0,0.35)] backdrop-blur-md transition duration-150 ease-out",
                    openMenu === "systems" ? "translate-y-0" : "",
                  ].join(" ")}
                >
                  {systemItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={closeNow}
                      className={({ isActive }) =>
                        [
                          "block rounded px-2 py-1.5 text-xs uppercase tracking-[0.14em] transition sm:text-sm",
                          isActive ? "text-cyan-300" : "text-slate-200 hover:bg-cyan-300/10 hover:text-cyan-300",
                        ].join(" ")
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.17em] text-slate-200 transition hover:text-white sm:text-sm"
              aria-label="Search"
            >
              <SearchIcon />
              <span>Search</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-20 mx-auto w-full max-w-7xl px-4 pb-8 pt-20 sm:px-6 lg:px-8">
        <Outlet />
        <div
          className={[
            "pointer-events-none absolute inset-0 transition-opacity duration-350 ease-out",
            isRouteLoading ? "opacity-100" : "opacity-0",
          ].join(" ")}
          aria-hidden
        >
          <div className="absolute inset-0 rounded-2xl bg-black/45 backdrop-blur-sm" />
          <div className="absolute left-1/2 top-[32%] h-10 w-10 -translate-x-1/2">
            <span className="absolute inset-0 rounded-full border border-white/30" />
            <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-cyan-300 border-r-cyan-300" />
          </div>
        </div>
      </main>
    </div>
  );
}
