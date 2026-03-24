import { Outlet, useLocation } from "react-router-dom";
import AppBackground from "./AppBackground";
import AppNav from "./AppNav";

export default function AppShell() {
  const location = useLocation();
  const isMapsRoute = location.pathname.startsWith("/maps");
  const isAlphaThresholdRoute = location.pathname.startsWith("/tools/alpha-threshold");
  const shellClassName = isAlphaThresholdRoute
    ? "relative flex h-screen w-full flex-col overflow-hidden text-slate-100"
    : "relative flex min-h-screen w-full flex-col text-slate-100";
  const mainClassName = isAlphaThresholdRoute
    ? "relative z-20 flex min-h-0 flex-1 w-full items-start justify-start overflow-hidden pt-0"
    : [
        "relative z-20 mx-auto w-full flex-1 px-4 pb-8 sm:px-6 lg:px-8",
        isMapsRoute ? "max-w-[96vw] pt-6 sm:pt-8" : "max-w-7xl pt-12",
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
