import { NavLink, Outlet } from "react-router-dom";
import AppBackground from "./AppBackground";

const navItems = [
  { to: "/ships/perseus", label: "Ships" },
  { to: "/systems/sub-targeting", label: "Systems" },
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

export default function AppShell() {
  return (
    <div className="relative min-h-screen overflow-x-hidden text-slate-100">
      <AppBackground />

      <header className="relative z-20 px-4 pb-3 pt-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between rounded-2xl border border-white/20 bg-black/30 px-4 py-3 backdrop-blur-xl">
          <NavLink to="/" className="flex items-center gap-3 text-white">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/45 bg-white/10">
              <span className="h-2 w-2 rounded-full bg-white" />
            </span>
            <span className="title-font text-sm tracking-[0.2em] sm:text-base">ARES</span>
          </NavLink>

          <div className="flex items-center gap-2 sm:gap-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "rounded-lg border px-3 py-1.5 text-xs uppercase tracking-[0.17em] transition sm:text-sm",
                    isActive
                      ? "border-white/45 bg-white/16 text-white"
                      : "border-white/20 bg-black/25 text-slate-200 hover:border-white/40 hover:text-white",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-black/25 px-3 py-1.5 text-xs uppercase tracking-[0.17em] text-slate-200 transition hover:border-white/40 hover:text-white sm:text-sm"
              aria-label="Search"
            >
              <SearchIcon />
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-20 mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
