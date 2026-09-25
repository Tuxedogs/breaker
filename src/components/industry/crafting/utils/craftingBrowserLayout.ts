import { useEffect, useState } from "react";

export const CRAFTING_COMPACT_SPLIT_MIN_WIDTH = 981;
export const CRAFTING_WIDE_SPLIT_MIN_WIDTH = 1600;

export type CraftingBrowserLayoutMode = "single" | "compact-split" | "wide-split";

export function getCraftingBrowserLayoutMode(width: number): CraftingBrowserLayoutMode {
  if (width >= CRAFTING_WIDE_SPLIT_MIN_WIDTH) return "wide-split";
  if (width >= CRAFTING_COMPACT_SPLIT_MIN_WIDTH) return "compact-split";
  return "single";
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
