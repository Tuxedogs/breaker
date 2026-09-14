import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useLogisticsStore } from "../../stores/logisticsStore";

const items = [
  { to: "/dashboard", label: "Home", icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10", exact: true, badge: null },
  { to: "/industry/crafting", label: "Recipes", icon: "M14 4l6 6-9 9H5v-6l9-9zM13 5l6 6", exact: false, badge: null },
  { to: "/logistics/build-queue", label: "Queue", icon: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01", exact: false, badge: "queue" },
  {
    to: "/industry/mining",
    label: "Mining",
    icon: ["M3 21l7-7", "M7.5 3.5c3.8-.45 5.2 0.2 9 2.6", "M17.2 5.2c2.8 2.8 3.2 4.6 3.8 9.3", "M18 5.5 9 14.5"],
    exact: false,
    badge: null,
  },
  { to: "/logistics/inventory", label: "Inventory", icon: "M21 16V8l-9-5-9 5v8l9 5 9-5zM3.5 8.5 12 13l8.5-4.5M12 13v8", exact: false, badge: null },
] as const;

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const openQueueItems = useLogisticsStore((store) =>
    store.buildQueue.filter((item) => item.status !== "complete").length
  );

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
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
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [open]);

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
        <span className="dash-mobile-shell-brand">BREAKER</span>
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
          </aside>
        </div>
      )}
    </>
  );
}
