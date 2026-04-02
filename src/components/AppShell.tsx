import { Outlet, useLocation } from "react-router-dom";
import AppNav from "./AppNav";

export default function AppShell() {
  const location = useLocation();
  const isMapsRoute = location.pathname.startsWith("/maps");
  const isAlphaThresholdRoute = location.pathname.startsWith("/tools/alpha-threshold");

  const mainClassName = isAlphaThresholdRoute
    ? "flex min-h-screen w-full flex-col pt-12"
    : isMapsRoute
      ? "flex h-screen w-full flex-col overflow-hidden px-0 pb-0"
      : [
          "relative z-20 mx-auto min-h-screen w-full px-4 pb-8 text-slate-100 sm:px-6 lg:px-8",
          "max-w-7xl pt-12",
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
