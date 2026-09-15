import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useLogisticsStore } from "../../stores/logisticsStore";
import LoginWithDiscordButton from "../auth/LoginWithDiscordButton";

const items = [
  { to: "/dashboard", label: "Home", icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10", exact: true, badge: null },
  { to: "/industry/crafting", label: "Crafting", icon: "M14 4l6 6-9 9H5v-6l9-9zM13 5l6 6", exact: false, badge: null },
  {
    to: "/industry/mining",
    label: "Mining",
    icon: ["M3 21l7-7", "M7.5 3.5c3.8-.45 5.2 0.2 9 2.6", "M17.2 5.2c2.8 2.8 3.2 4.6 3.8 9.3", "M18 5.5 9 14.5"],
    exact: false,
    badge: null,
  },
  { to: "/fitting", label: "Fitting", icon: "M12 3v18M3 12h18M6 6l12 12M18 6 6 18", exact: false, badge: null },
  { to: "/logistics/build-queue", label: "Build Queue", icon: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01", exact: false, badge: "queue" },
  { to: "/logistics/inventory", label: "Inventory", icon: "M21 16V8l-9-5-9 5v8l9 5 9-5zM3.5 8.5 12 13l8.5-4.5M12 13v8", exact: false, badge: null },
  { to: "/industry/blueprint-tracker", label: "Bookmarks", icon: "M6 3h12v18l-6-4-6 4V3", exact: false, badge: null },
] as const;

const HIGH_CONTRAST_STORAGE_KEY = "scintel-high-contrast";

function MobileNavIcon({ d }: { d: string | readonly string[] }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="dash-mobile-menu-icon">
      {paths.map((path) => <path key={path} d={path} />)}
    </svg>
  );
}

export default function MobileIndustryNav() {
  const [open, setOpen] = useState(false);
  const [highContrast, setHighContrast] = useState(() => document.documentElement.classList.contains("sc-high-contrast"));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const openQueueItems = useLogisticsStore((store) =>
    store.buildQueue.filter((item) => item.status !== "complete").length
  );

  useEffect(() => {
    if (!open) return;

    const trigger = triggerRef.current;
    document.body.classList.add("mobile-navigation-open");
    dialogRef.current?.querySelector<HTMLElement>("button:not([disabled]), a[href]")?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]"));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("mobile-navigation-open");
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [open]);

  function toggleHighContrast() {
    const next = !highContrast;
    setHighContrast(next);
    document.documentElement.classList.toggle("sc-high-contrast", next);
    try {
      localStorage.setItem(HIGH_CONTRAST_STORAGE_KEY, String(next));
    } catch {
      // Keep the in-session setting when storage is unavailable.
    }
  }

  return (
    <>
      <header className="dash-mobile-shell-header">
        <button
          ref={triggerRef}
          type="button"
          className="dash-mobile-menu-trigger"
          aria-label={open ? "Close primary navigation" : "Open primary navigation"}
          aria-expanded={open}
          aria-controls="dash-mobile-menu"
          onClick={() => setOpen((current) => !current)}
        >
          <span aria-hidden />
          <span aria-hidden />
          <span aria-hidden />
        </button>
        <span className="dash-mobile-shell-brand">SCINTEL</span>
        <span className="dash-mobile-shell-header-end" aria-hidden />
      </header>

      {open && (
        <div className="dash-mobile-menu-layer">
          <button type="button" className="dash-mobile-menu-backdrop" aria-label="Close primary navigation" onClick={() => setOpen(false)} />
          <aside ref={dialogRef} id="dash-mobile-menu" className="dash-mobile-menu" role="dialog" aria-modal="true" aria-label="Primary navigation">
            <div className="dash-mobile-menu-header">
              <span>Navigation</span>
              <button type="button" className="dash-mobile-menu-close" aria-label="Close primary navigation" onClick={() => setOpen(false)}>×</button>
            </div>
            <nav className="dash-mobile-menu-list" aria-label="Primary mobile navigation">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => ["dash-mobile-menu-item", isActive ? "dash-mobile-menu-item--active" : ""].filter(Boolean).join(" ")}
                >
                  <span className="dash-mobile-menu-icon-wrap">
                    <MobileNavIcon d={item.icon} />
                    {item.badge === "queue" && openQueueItems > 0 && <span className="dash-mobile-menu-badge">{openQueueItems}</span>}
                  </span>
                  <span>{item.label}</span>
                  <span className="dash-mobile-menu-chevron" aria-hidden>›</span>
                </NavLink>
              ))}
            </nav>
            <div className="dash-mobile-menu-secondary" aria-label="Community and settings">
              <LoginWithDiscordButton className="dash-mobile-menu-community" />
              <button
                type="button"
                className="dash-mobile-menu-item dash-mobile-menu-setting"
                aria-pressed={highContrast}
                onClick={toggleHighContrast}
              >
                <span className="dash-mobile-menu-icon-wrap"><MobileNavIcon d="M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 01-.1 1.2l2 1.6-2 3.5-2.5-1a8 8 0 01-2.1 1.2L14 21h-4l-.4-2.5a8 8 0 01-2.1-1.2l-2.4 1-2-3.5 2-1.6A7 7 0 015 12a7 7 0 01.1-1.2l-2-1.6 2-3.5 2.4 1a8 8 0 012.1-1.2L10 3h4l.4 2.5a8 8 0 012.1 1.2l2.5-1 2 3.5-2 1.6A7 7 0 0119 12z" /></span>
                <span>Settings</span>
                <span className="dash-mobile-menu-setting-state">{highContrast ? "High contrast" : "Standard"}</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
