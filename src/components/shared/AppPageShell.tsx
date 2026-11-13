import { useEffect, useRef, useState, type ReactNode } from "react";
import WorkspaceMobileNavigator, { getWorkspaceMobileViews } from "./WorkspaceMobileNavigator";
import "./app-page-shell.css";
import "./workspace-surface.css";
import "./workspace-mobile-nav.css";

type AppPageShellProps = {
  title: string;
  children: ReactNode;
  fullBleed?: boolean;
};

const APP_NAME = "Scintel";

/**
 * Full-height page shell for every top-level route. There is no visible page
 * header: the working content fills the available height and owns its own
 * scrolling. The title is exposed to assistive technology and the browser tab.
 */
export default function AppPageShell({ title, children, fullBleed = false }: AppPageShellProps) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · ${APP_NAME}`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  const mobileViews = fullBleed ? getWorkspaceMobileViews(title) : null;
  // Keep the actual page and its data model mounted while the user switches views.
  const [activeMobileView, setActiveMobileView] = useState(() => mobileViews?.defaultView ?? "");
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setActiveMobileView(mobileViews?.defaultView ?? "");
  }, [mobileViews?.defaultView, title]);

  const showMobileViews = mobileViews && (typeof window === "undefined" || !window.location.pathname.startsWith("/fitting-v2"));

  return (
    <div
      ref={shellRef}
      className={[
        "app-page-shell",
        fullBleed ? "app-page-shell--workspace" : "",
        showMobileViews ? "app-page-shell--mobile-views" : "",
      ].filter(Boolean).join(" ")}
      data-workspace-module={showMobileViews ? mobileViews.module : undefined}
      data-workspace-view={showMobileViews ? activeMobileView : undefined}
    >
      <h1 className="app-page-shell__title">{title}</h1>
      {showMobileViews ? (
        <WorkspaceMobileNavigator
          config={mobileViews}
          value={activeMobileView}
          onChange={(view) => {
            setActiveMobileView(view);
            shellRef.current?.scrollTo({ top: 0 });
          }}
        />
      ) : null}
      {children}
    </div>
  );
}
