import { Outlet, useLocation } from "react-router-dom";
import AppNav from "./AppNav";

export default function AppShell() {
  const location = useLocation();
  const isAlphaThresholdRoute = location.pathname.startsWith("/dashboard/doctrine/armor-threshold");
  const isGunneryRoute = location.pathname.startsWith("/tools/gunnery");

  const mainClassName = isGunneryRoute
    ? "flex h-screen w-full flex-col overflow-hidden pt-12"
    : isAlphaThresholdRoute
      ? "flex min-h-screen w-full flex-col pt-12"
      : [
            "relative z-20 mx-auto min-h-screen w-full pb-8 text-slate-100 px-12",
          "max-w-7xl pt-12 app-main",
        ].join(" ");

  return (
    <>
      <AppNav />
      <main className={mainClassName}>
        <Outlet />
      </main>
    </>
  );
}
