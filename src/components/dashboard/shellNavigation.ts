import { createContext, useContext, useEffect } from "react";

/**
 * V31 module navigation. One list feeds the desktop/tablet module rail and the
 * phone bottom dock, so both always expose the same destinations.
 */
export type ShellModule = {
  key: string;
  label: string;
  to: string;
  glyph: string;
  exact?: boolean;
  /** Extra route prefixes that keep this module highlighted. */
  match?: readonly string[];
};

export const PRIMARY_MODULES: readonly ShellModule[] = [
  { key: "home", label: "Home", to: "/dashboard", glyph: "⌂", exact: true },
  { key: "mine", label: "Mine", to: "/industry/mining", glyph: "◇" },
  { key: "craft", label: "Craft", to: "/industry/crafting", glyph: "✳" },
  { key: "build", label: "Build", to: "/logistics/build-queue", glyph: "▧" },
  { key: "inventory", label: "Inventory", to: "/logistics/inventory", glyph: "▣" },
  { key: "fitting", label: "Fitting", to: "/fitting", glyph: "⌁" },
];

/** Existing secondary destinations kept reachable from the desktop/tablet rail. */
export const SECONDARY_MODULES: readonly ShellModule[] = [
  { key: "refinery", label: "Refinery Planner", to: "/industry/refinery", glyph: "⚗" },
  { key: "wikelo", label: "Wikelo", to: "/industry/wikelo", glyph: "◎" },
  { key: "carrier", label: "Carrier Logistics", to: "/logistics/carrier-logistics", glyph: "⚓" },
];

/** One set of route metadata drives the shared top bar on every operational page. */
export type ShellPageModule = "mine" | "craft" | "build" | "inventory" | "fitting" | "default";
type ShellPageContext = { label: string; module: ShellPageModule };

const ROUTE_PAGES: readonly [string, ShellPageContext][] = [
  ["/industry/mining", { label: "Mining", module: "mine" }],
  ["/industry/crafting", { label: "Craft", module: "craft" }],
  ["/industry/refinery", { label: "Refinery Planner", module: "default" }],
  ["/industry/wikelo", { label: "Wikelo", module: "default" }],
  ["/logistics/build-queue", { label: "Build", module: "build" }],
  ["/logistics/inventory", { label: "Inventory", module: "inventory" }],
  ["/logistics/carrier-logistics", { label: "Carrier Logistics", module: "default" }],
  ["/logistics", { label: "Logistics", module: "default" }],
  ["/fitting-legacy", { label: "Fitting", module: "fitting" }],
  ["/fitting-v2", { label: "Fitting", module: "fitting" }],
  ["/fitting", { label: "Fitting", module: "fitting" }],
  ["/dashboard", { label: "Workspace selection", module: "default" }],
];

export function isModuleActive(module: ShellModule, pathname: string) {
  if (module.exact) return pathname === module.to;
  return [module.to, ...(module.match ?? [])].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function shellPageContext(pathname: string): ShellPageContext {
  return ROUTE_PAGES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1]
    ?? { label: "Workspace", module: "default" };
}

export function shellPageLabel(pathname: string) {
  return shellPageContext(pathname).label;
}

/** Breadcrumb detail published by the active page (for example, the selected Mining location). */
export type ShellBreadcrumbSetter = (detail: string | null) => void;
export const ShellBreadcrumbContext = createContext<ShellBreadcrumbSetter>(() => {});

export function useShellBreadcrumbDetail(detail: string | null | undefined) {
  const setDetail = useContext(ShellBreadcrumbContext);
  useEffect(() => {
    setDetail(detail ?? null);
    return () => setDetail(null);
  }, [detail, setDetail]);
}
