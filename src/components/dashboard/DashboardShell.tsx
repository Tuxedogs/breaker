import { Outlet } from "react-router-dom";
import DashboardSidebar from "./DashboardSidebar";
import MobileIndustryNav from "./MobileIndustryNav";

export default function DashboardShell() {
  return (
    <div className="dash-page">
      <DashboardSidebar />
      <div className="dash-body">
        <MobileIndustryNav />
        <div className="dash-content">
          <div className="dash-content-frame">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
