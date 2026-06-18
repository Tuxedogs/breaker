import { Outlet, useLocation } from "react-router-dom";
import LoginWithDiscordButton from "../auth/LoginWithDiscordButton";
import DashboardSidebar from "./DashboardSidebar";
import MobileIndustryNav from "./MobileIndustryNav";

function useHideMobileAuthBar() {
  const { pathname } = useLocation();
  return pathname.startsWith("/logistics/build-queue")
    || pathname.startsWith("/logistics/inventory");
}

export default function DashboardShell() {
  const hideMobileAuthBar = useHideMobileAuthBar();

  return (
    <div className="dash-page">
      <DashboardSidebar />
      <div className="dash-body">
        {!hideMobileAuthBar ? (
          <div className="dash-mobile-auth-bar" aria-label="Account sync">
            <LoginWithDiscordButton className="dash-mobile-auth-button" />
          </div>
        ) : null}
        <div className="dash-content">
          <div className="dash-content-frame">
            <Outlet />
          </div>
        </div>
        <MobileIndustryNav />
      </div>
    </div>
  );
}
