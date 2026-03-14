import { Outlet, useLocation } from "react-router-dom";
import AppBackground from "./AppBackground";
import AppNav from "./AppNav";

export default function AppShell() {
  const location = useLocation();
  const isMapsRoute = location.pathname.startsWith("/maps");
  const isAlphaThresholdRoute = location.pathname.startsWith("/tools/alpha-threshold");

  return (
    <div className="relative min-h-screen text-slate-100">
      <AppBackground />
      <AppNav />

      <main
        className={[
          "relative z-20 mx-auto w-full px-4 pb-8 pt-24 sm:px-6 lg:px-8",
          isMapsRoute || isAlphaThresholdRoute ? "max-w-[96vw]" : "max-w-7xl",
        ].join(" ")}
      >
        <Outlet />
      </main>
    </div>
  );
}
