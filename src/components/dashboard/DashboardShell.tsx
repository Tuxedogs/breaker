import { Outlet } from "react-router-dom";
import LoginWithDiscordButton from "../auth/LoginWithDiscordButton";
import DashboardSidebar from "./DashboardSidebar";
import MobileIndustryNav from "./MobileIndustryNav";

export default function DashboardShell() {
  return (
    <div className="dash-page">
      <DashboardSidebar />
      <div className="dash-body">
        <div className="dash-mobile-auth-bar" aria-label="Account sync">
          <LoginWithDiscordButton className="dash-mobile-auth-button" collapsed />
        </div>
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
