import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import appPackage from "../../../package.json";
import LoginWithDiscordButton from "../auth/LoginWithDiscordButton";
import { shellPageContext } from "./shellNavigation";

type BreakerTopBarProps = {
  /** Breadcrumb detail published by the active operational page. */
  detail?: string | null;
  /**
   * Homepage gateway mode: V31 shows a plain page label instead of a breadcrumb,
   * with the gateway's own status text and trailing round control.
   */
  home?: { status: string; statusTitle: string; action: ReactNode };
};

/** V31 global top bar shared by the homepage and the operational shell. */
export default function BreakerTopBar({ detail = null, home }: BreakerTopBarProps) {
  const { pathname } = useLocation();
  const { label: page, module } = shellPageContext(pathname);

  return (
    <header className="breaker-topbar" data-module={module}>
      <NavLink to="/dashboard" viewTransition className="breaker-topbar__brand" aria-label="Go to Breaker homepage">
        <span className="breaker-topbar__symbol" aria-hidden>{"◈"}</span>
        <span className="breaker-topbar__wordmark" aria-hidden>B R E A K E R</span>
      </NavLink>
      <span className="breaker-topbar__divider" aria-hidden />
      {home ? (
        <span className="breaker-topbar__label">{page}</span>
      ) : (
        <nav className="breaker-topbar__crumb" aria-label="Breadcrumb">
          <span className="breaker-topbar__crumb-page">{page}</span>
          {detail ? (
            <>
              <span className="breaker-topbar__crumb-sep" aria-hidden>/</span>
              <span className="breaker-topbar__crumb-detail" aria-current="page">{detail}</span>
            </>
          ) : null}
        </nav>
      )}
      <span className="breaker-topbar__spacer" />
      <div
        className="breaker-topbar__status"
        title={home?.statusTitle ?? `Package version ${appPackage.version}. LIVE data channel active. PTU unavailable until global channel selection is connected.`}
      >
        {home?.status ?? `LIVE / BUILD v${appPackage.version}`}
      </div>
      {home ? home.action : <LoginWithDiscordButton className="breaker-topbar__account" collapsed />}
    </header>
  );
}
