import { useEffect, useState } from "react";

export const CRAFTING_COMPACT_SPLIT_MIN_WIDTH = 981;
export const CRAFTING_WIDE_SPLIT_MIN_WIDTH = 1600;

export type CraftingBrowserLayoutMode = "single" | "compact-split" | "wide-split";

export function getCraftingBrowserLayoutMode(width: number): CraftingBrowserLayoutMode {
  if (width >= CRAFTING_WIDE_SPLIT_MIN_WIDTH) return "wide-split";
  if (width >= CRAFTING_COMPACT_SPLIT_MIN_WIDTH) return "compact-split";
  return "single";
}

/** Phone composition (list → detail, filters in a sheet). Matches the CSS breakpoint. */
export const CRAFTING_PHONE_QUERY = "(max-width: 719px)";

export function isCraftingPhoneViewport(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia(CRAFTING_PHONE_QUERY).matches;
}

export function useCraftingPhoneLayout(): boolean {
  const [isPhone, setIsPhone] = useState(isCraftingPhoneViewport);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(CRAFTING_PHONE_QUERY);
    const update = () => setIsPhone(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isPhone;
}

export function useCraftingBrowserLayoutMode(): CraftingBrowserLayoutMode {
  const [layoutMode, setLayoutMode] = useState<CraftingBrowserLayoutMode>(() => (
    typeof window === "undefined" ? "single" : getCraftingBrowserLayoutMode(window.innerWidth)
  ));

  useEffect(() => {
    const updateLayoutMode = () => setLayoutMode(getCraftingBrowserLayoutMode(window.innerWidth));
    updateLayoutMode();
    window.addEventListener("resize", updateLayoutMode);
    return () => window.removeEventListener("resize", updateLayoutMode);
  }, []);

  return layoutMode;
}
