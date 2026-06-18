export type FittingIconMode = "auto" | "accent" | "mono";

const STORAGE_KEY = "moonbreaker.fitting.iconMode.v1";

export function getDefaultFittingIconMode(): FittingIconMode {
  return "auto";
}

export function readFittingIconMode(): FittingIconMode {
  if (typeof window === "undefined") return getDefaultFittingIconMode();
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "auto" || stored === "accent" || stored === "mono") return stored;
  return getDefaultFittingIconMode();
}

export function writeFittingIconMode(mode: FittingIconMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, mode);
}

export function autoIconModeForCategory(category: string | null | undefined): "accent" | "mono" {
  const normalized = (category ?? "").toLowerCase();
  if (
    normalized === "ship_weapon"
    || normalized === "weapon"
    || normalized === "fps_weapon"
    || normalized === "shield"
    || normalized === "shield_generator"
  ) {
    return "accent";
  }
  return "mono";
}