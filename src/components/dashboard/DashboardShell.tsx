import { Outlet } from "react-router-dom";
import LoginWithDiscordButton from "../auth/LoginWithDiscordButton";
import DashboardSidebar from "./DashboardSidebar";

export default function DashboardShell() {
  return (
    <div className="dash-page">
      <DashboardSidebar />
      <div className="dash-body">
        <div className="dash-mobile-auth-bar" aria-label="Account sync">
          <LoginWithDiscordButton className="dash-mobile-auth-button" />
        </div>
        <div className="dash-content">
          <div className="dash-content-frame">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
