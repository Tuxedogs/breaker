import { Outlet } from "react-router-dom";
import AppNav from "./AppNav";

export default function AppShell() {
  const mainClassName = [
    "relative z-20 mx-auto min-h-screen w-full pb-8 text-slate-100",
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
