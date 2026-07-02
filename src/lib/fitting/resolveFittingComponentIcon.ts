import { autoIconModeForCategory, type FittingIconMode } from "./fittingIconMode";
import {
  getManifestEntry,
  inferManifestEntryKey,
  normalizeComponentCategory,
  normalizeComponentSize,
} from "./fittingIconIdentity";

export type FittingIconResolvedMode = "accent" | "mono" | "placeholder";

export type FittingIconConfidence = "exact" | "fallback_mode" | "fallback_size" | "fallback_category" | "placeholder";

export type ResolveFittingComponentIconInput = {
  componentType?: string | null;
  componentName?: string | null;
  familyKey?: string | null;
  size?: unknown;
  preferredMode?: FittingIconMode;
};

export type ResolveFittingComponentIconResult = {
  src: string;
  resolvedMode: FittingIconResolvedMode;
  confidence: FittingIconConfidence;
  reason?: string;
  manifestKey?: string | null;
  componentSize?: number | null;
};

const CATEGORY_PLACEHOLDER: Record<string, string> = {
  ship_weapon: "/images/component-icons/size_weapon_generic.webp",
  fps_weapon: "/images/component-icons/assault_rifle.webp",
  weapon: "/images/component-icons/assault_rifle.webp",
  shield: "/images/component-icons/shield_generator.webp",
  shield_generator: "/images/component-icons/shield_generator.webp",
  cooler: "/images/component-icons/cooler.webp",
  quantum_drive: "/images/component-icons/quantum_drive.webp",
  quantum: "/images/component-icons/quantum_drive.webp",
  quantumdrive: "/images/component-icons/quantum_drive.webp",
  power: "/images/component-icons/powerplant.webp",
  powerplant: "/images/component-icons/powerplant.webp",
  armor: "/images/component-icons/medium_torso.webp",
  radar: "/images/component-icons/turret.webp",
  scanner: "/images/component-icons/turret.webp",
};

const GENERIC_PLACEHOLDER = "/images/component-icons/size_weapon_generic.webp";

type IconVariant = "accent" | "mono";

function pickMode(
  preferredMode: FittingIconMode,
  category: string,
): IconVariant {
  if (preferredMode === "accent" || preferredMode === "mono") return preferredMode;
  return autoIconModeForCategory(category);
}

function pickFromSizeEntry(
  sizeEntry: Partial<Record<IconVariant, string>> | undefined,
  mode: IconVariant,
): { src: string | null; resolvedMode: IconVariant | null } {
  if (!sizeEntry) return { src: null, resolvedMode: null };
  const direct = sizeEntry[mode];
  if (direct) return { src: direct, resolvedMode: mode };
  const alternate: IconVariant = mode === "accent" ? "mono" : "accent";
  const fallback = sizeEntry[alternate];
  if (fallback) return { src: fallback, resolvedMode: alternate };
  return { src: null, resolvedMode: null };
}

function pickNearestSize(
  sizes: Record<string, Partial<Record<IconVariant, string>>>,
  targetSize: number,
  mode: IconVariant,
): { src: string | null; resolvedMode: IconVariant | null; usedSize: number | null } {
  const available = Object.keys(sizes)
    .map((key) => Number.parseInt(key, 10))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (available.length === 0) return { src: null, resolvedMode: null, usedSize: null };

  let best = available[0];
  let bestDistance = Math.abs(best - targetSize);
  for (const candidate of available) {
    const distance = Math.abs(candidate - targetSize);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  const picked = pickFromSizeEntry(sizes[String(best)], mode);
  return { ...picked, usedSize: best };
}

function categoryPlaceholder(category: string): string {
  return CATEGORY_PLACEHOLDER[category] ?? GENERIC_PLACEHOLDER;
}

/**
 * Resolves a fitting/component icon path from manifest keys, size, and icon mode.
 *
 * Matching order:
 * 1. explicit familyKey
 * 2. weapon family inferred from componentName (e.g. deadbolt)
 * 3. componentType category (shield, cooler, quantum_drive, ship_weapon)
 *
 * Mode resolution:
 * - auto: weapons + shields => accent; coolers/power/quantum/other => mono
 * - accent/mono: forced when available, then safe fallbacks
 */
export function resolveFittingComponentIcon(
  input: ResolveFittingComponentIconInput,
): ResolveFittingComponentIconResult {
  const category = normalizeComponentCategory(input.componentType);
  const manifestKey = inferManifestEntryKey({
    componentType: input.componentType,
    componentName: input.componentName,
    familyKey: input.familyKey,
  });
  const entry = getManifestEntry(manifestKey);
  const componentSize = normalizeComponentSize(input.size, input.componentName);
  const preferredMode = input.preferredMode ?? "auto";
  const requestedMode = pickMode(preferredMode, category || entry?.type || "");

  if (!entry || !manifestKey) {
    return {
      src: categoryPlaceholder(category),
      resolvedMode: "placeholder",
      confidence: "placeholder",
      reason: "No manifest entry matched component identity; using category placeholder.",
      manifestKey: null,
      componentSize,
    };
  }

  const autoMode = autoIconModeForCategory(entry.type === "ship_weapon" ? "ship_weapon" : entry.type);
  const tryModes: IconVariant[] = requestedMode === autoMode
    ? [requestedMode]
    : [requestedMode, autoMode];

  if (componentSize != null) {
    const exactEntry = entry.sizes[String(componentSize)];
    for (const mode of tryModes) {
      const picked = pickFromSizeEntry(exactEntry, mode);
      if (picked.src) {
        const usedFallbackMode = picked.resolvedMode !== mode;
        return {
          src: picked.src,
          resolvedMode: picked.resolvedMode ?? mode,
          confidence: usedFallbackMode ? "fallback_mode" : "exact",
          reason: usedFallbackMode ? `Requested ${mode} unavailable for size ${componentSize}; used ${picked.resolvedMode}.` : undefined,
          manifestKey,
          componentSize,
        };
      }
    }

    for (const mode of tryModes) {
      const nearest = pickNearestSize(entry.sizes, componentSize, mode);
      if (nearest.src) {
        return {
          src: nearest.src,
          resolvedMode: nearest.resolvedMode ?? mode,
          confidence: "fallback_size",
          reason: `No icon for size ${componentSize}; used nearest size ${nearest.usedSize}.`,
          manifestKey,
          componentSize,
        };
      }
    }
  } else {
    const firstSizeKey = Object.keys(entry.sizes).sort((a, b) => Number(a) - Number(b))[0];
    const firstEntry = firstSizeKey ? entry.sizes[firstSizeKey] : undefined;
    for (const mode of tryModes) {
      const picked = pickFromSizeEntry(firstEntry, mode);
      if (picked.src) {
        return {
          src: picked.src,
          resolvedMode: picked.resolvedMode ?? mode,
          confidence: "fallback_size",
          reason: "Component size unknown; used first available manifest size.",
          manifestKey,
          componentSize: null,
        };
      }
    }
  }

  for (const sizeEntry of Object.values(entry.sizes)) {
    for (const mode of ["accent", "mono"] as const) {
      if (sizeEntry[mode]) {
        return {
          src: sizeEntry[mode]!,
          resolvedMode: mode,
          confidence: "fallback_mode",
          reason: `Requested mode unavailable; used any available ${mode} icon.`,
          manifestKey,
          componentSize,
        };
      }
    }
  }

  return {
    src: categoryPlaceholder(category || entry.type),
    resolvedMode: "placeholder",
    confidence: "placeholder",
    reason: "Manifest entry matched but no icon variants were available.",
    manifestKey,
    componentSize,
  };
}