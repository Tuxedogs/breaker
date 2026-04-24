import { Outlet } from "react-router-dom";
import DashboardSidebar from "./DashboardSidebar";
import DashboardTopBar from "./DashboardTopBar";

export default function DashboardShell() {
  return (
    <div className="dash-page">
      <DashboardSidebar />
      <div className="dash-body">
        <DashboardTopBar />
        <div className="dash-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
