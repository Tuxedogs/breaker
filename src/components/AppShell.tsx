import { Outlet, useLocation } from "react-router-dom";
import AppBackground from "./AppBackground";
import AppNav from "./AppNav";

export default function AppShell() {
  const location = useLocation();
  const isMapsRoute = location.pathname.startsWith("/maps");
  const isAlphaThresholdRoute = location.pathname.startsWith("/tools/alpha-threshold");
  const shellClassName = isAlphaThresholdRoute
    ? "relative flex h-screen w-full flex-col items-start justify-start overflow-hidden text-slate-100"
    : "relative min-h-screen text-slate-100";
  const mainClassName = isAlphaThresholdRoute
    ? "relative z-20 flex h-full w-full items-start justify-start overflow-hidden pt-[3.1rem]"
    : [
        "relative z-20 mx-auto w-full px-4 pb-8 pt-12 sm:px-6 lg:px-8",
        isMapsRoute ? "max-w-[96vw]" : "max-w-7xl",
      ].join(" ");

  return (
    <div className={shellClassName}>
      <AppBackground />
      <AppNav />

      <main className={mainClassName}>
        <Outlet />
      </main>
    </div>
  );
}
