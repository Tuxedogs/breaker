import { Outlet } from "react-router-dom";
import DashboardSidebar from "./DashboardSidebar";

export default function DashboardShell() {
  return (
    <div className="dash-page">
      <DashboardSidebar />
      <div className="dash-body">
        <div className="dash-content">
          <div className="dash-content-frame">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
