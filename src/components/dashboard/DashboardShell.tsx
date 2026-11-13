import { useState } from "react";
import { Outlet } from "react-router-dom";
import BreakerTopBar from "./BreakerTopBar";
import DashboardSidebar from "./DashboardSidebar";
import { ShellBreadcrumbContext } from "./shellNavigation";
import "./breaker-shell.css";

/** V31 application shell: global top bar, module rail (bottom dock on phones), working viewport. */
export default function DashboardShell() {
  const [breadcrumbDetail, setBreadcrumbDetail] = useState<string | null>(null);

  return (
    <ShellBreadcrumbContext.Provider value={setBreadcrumbDetail}>
      <div className="dash-page breaker-shell">
        <BreakerTopBar detail={breadcrumbDetail} />
        <div className="breaker-shell__layout">
          <DashboardSidebar />
          <div className="dash-body">
            <div className="dash-content">
              <div className="dash-content-frame">
                <Outlet />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ShellBreadcrumbContext.Provider>
  );
}
