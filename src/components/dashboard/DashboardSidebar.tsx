import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useSignatureDock } from "@/lib/useSignatureDock";
import { loadBuildQueuePage } from "@/pages/logistics/buildQueueRoute";
import { useLogisticsStore } from "../../stores/logisticsStore";
import { PRIMARY_MODULES, SECONDARY_MODULES, isModuleActive, type ShellModule } from "./shellNavigation";

const HIGH_CONTRAST_STORAGE_KEY = "scintel-high-contrast";

function preloadRoute(path: string) {
  if (path === "/logistics/build-queue") {
    void loadBuildQueuePage();
  }
}

/**
 * V31 module navigation. Desktop and tablet render it as the fixed-width left rail;
 * phones render the same element as the persistent bottom module dock.
 */
export default function DashboardSidebar() {
  const { pathname } = useLocation();
  const { enabled: signatureDockEnabled, toggleEnabled } = useSignatureDock();
  const openQueueItems = useLogisticsStore((store) =>
    store.buildQueue.filter((item) => item.status !== "complete").length
  );
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    try {
      return localStorage.getItem(HIGH_CONTRAST_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("sc-high-contrast", highContrast);
    try {
      localStorage.setItem(HIGH_CONTRAST_STORAGE_KEY, String(highContrast));
    } catch {
      // Keep the in-session setting when storage is unavailable.
    }
    return () => {
      document.documentElement.classList.remove("sc-high-contrast");
    };
  }, [highContrast]);

  function renderItem(module: ShellModule, secondary = false) {
    const active = isModuleActive(module, pathname);
    return (
      <NavLink
        key={module.key}
        to={module.to}
        viewTransition={module.to === "/dashboard"}
        title={module.label}
        aria-label={`Open ${module.label}`}
        aria-current={active ? "page" : undefined}
        onMouseEnter={() => preloadRoute(module.to)}
        onFocus={() => preloadRoute(module.to)}
        onPointerDown={() => preloadRoute(module.to)}
        className={[
          "breaker-rail__item",
          secondary ? "breaker-rail__item--secondary" : "",
          active ? "is-current" : "",
        ].filter(Boolean).join(" ")}
      >
        <span className="breaker-rail__glyph" aria-hidden>{module.glyph}</span>
        <span className="breaker-rail__label">{module.label}</span>
        {module.key === "build" && openQueueItems > 0 ? (
          <span className="breaker-rail__badge" aria-label={`${openQueueItems} open queue items`}>{openQueueItems}</span>
        ) : null}
      </NavLink>
    );
  }

  return (
    <nav className="breaker-rail" aria-label="Module navigation">
      {PRIMARY_MODULES.map((module) => renderItem(module))}
      <span className="breaker-rail__divider" aria-hidden />
      {SECONDARY_MODULES.map((module) => renderItem(module, true))}
      <div className="breaker-rail__footer">
        <button
          type="button"
          className={["breaker-rail__item", "breaker-rail__tool", signatureDockEnabled ? "is-on" : ""].filter(Boolean).join(" ")}
          aria-pressed={signatureDockEnabled}
          aria-label="Toggle Signature Dock"
          title={signatureDockEnabled ? "Hide Signature Dock" : "Show Signature Dock"}
          onClick={toggleEnabled}
        >
          <span className="breaker-rail__glyph" aria-hidden>{"⌖"}</span>
        </button>
        <button
          type="button"
          className={["breaker-rail__item", "breaker-rail__tool", highContrast ? "is-on" : ""].filter(Boolean).join(" ")}
          aria-pressed={highContrast}
          aria-label={highContrast ? "Disable high contrast mode" : "Enable high contrast mode"}
          title={highContrast ? "Disable high contrast mode" : "Enable high contrast mode"}
          onClick={() => setHighContrast((value) => !value)}
        >
          <span className="breaker-rail__glyph" aria-hidden>{"◐"}</span>
        </button>
      </div>
    </nav>
  );
}
