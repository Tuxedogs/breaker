import { useEffect, useRef } from "react";
import type { FittingComponentSummary } from "../../../lib/fitting/fittingApi";

type CompactStat = { label: string; value: string };

type FittingSelectorDrawerProps = {
  title: string;
  compatibleLabel: string | null;
  editable: boolean;
  message: string | null;
  installError: string | null;
  items: FittingComponentSummary[];
  itemStats: (component: FittingComponentSummary) => CompactStat[];
  itemMeta: (component: FittingComponentSummary) => string;
  itemIconSrc: (component: FittingComponentSummary) => string;
  isInstalled: (component: FittingComponentSummary) => boolean;
  onClose: () => void;
  onInstall: (componentId: string) => void;
  onOpenDetails: (componentId: string) => void;
};

export default function FittingSelectorDrawer({
  title,
  compatibleLabel,
  editable,
  message,
  installError,
  items,
  itemStats,
  itemMeta,
  itemIconSrc,
  isInstalled,
  onClose,
  onInstall,
  onOpenDetails,
}: FittingSelectorDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    drawerRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <aside
      ref={drawerRef}
      className="fm-drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Select Component"
      tabIndex={-1}
    >
      <header className="fm-drawer-head">
        <div>
          <span className="fm-drawer-kicker">Select Component</span>
          <h3>{title}</h3>
          {editable && compatibleLabel ? (
            <p className="fm-drawer-sub">Compatible with {compatibleLabel}</p>
          ) : null}
        </div>
        <button type="button" onClick={onClose} aria-label="Close">×</button>
      </header>
      {message ? <p className="fm-drawer-note">{message}</p> : null}
      {installError ? <p className="fm-drawer-error">{installError}</p> : null}
      {editable ? (
        <div className="fm-drawer-list">
          {items.map((component) => {
            const installed = isInstalled(component);
            const stats = itemStats(component);
            return (
              <div
                key={component.id}
                className={["fm-drawer-row", installed ? "is-installed" : ""].filter(Boolean).join(" ")}
              >
                <span className="fm-drawer-row-icons">
                  <button
                    type="button"
                    className="fm-drawer-row-menu"
                    aria-label={`Open crafting details for ${component.displayName || component.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenDetails(component.id);
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 7h14M5 12h14M5 17h14" /></svg>
                  </button>
                  <span className="fm-drawer-row-icon" aria-hidden>
                    <img src={itemIconSrc(component)} alt="" draggable={false} />
                  </span>
                </span>
                <button
                  type="button"
                  className="fm-drawer-row-select"
                  onClick={() => onInstall(component.id)}
                  aria-label={`${installed ? "Reinstall" : "Install"} ${component.displayName || component.name}`}
                >
                  <span className="fm-drawer-row-main">
                    <strong>{component.displayName || component.name}</strong>
                    <span>{itemMeta(component)}</span>
                  </span>
                  <span className="fm-drawer-row-stats">
                    {stats.map((stat) => (
                      <span key={`${component.id}-${stat.label}`}>
                        <em>{stat.label}</em>
                        <strong>{stat.value}</strong>
                      </span>
                    ))}
                    {installed ? <span className="fm-drawer-installed">Installed</span> : null}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </aside>
  );
}
