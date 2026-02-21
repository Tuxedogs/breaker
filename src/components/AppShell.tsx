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

      <header className="fixed inset-x-0 top-0 z-30 px-4 pb-3 pt-5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-3 text-white">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/45 bg-white/10">
              <span className="h-2 w-2 rounded-full bg-white" />
            </span>
            <span className="title-font text-sm tracking-[0.2em] sm:text-base">ARES</span>
          </NavLink>

          <div className="flex items-center gap-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "text-xs uppercase tracking-[0.17em] transition sm:text-sm",
                    isActive ? "text-white" : "text-slate-200 hover:text-white",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}

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
      </main>
    </div>
  );
}
