import type { BlueprintSourceSnapshot, BuildQueueItem, RecipeTemplate } from "../../types/logistics";
import { type FittingIconMode } from "./fittingIconMode";
import { normalizeComponentSize } from "./fittingIconIdentity";
import {
  resolveFittingComponentIcon,
  type FittingIconConfidence,
  type FittingIconResolvedMode,
} from "./resolveFittingComponentIcon";

export type CraftedItemIconType = "manifest" | "category" | "fps_weapon" | "none";

export type ResolveCraftedItemIconInput = {
  itemName?: string | null;
  recipeName?: string | null;
  category?: string | null;
  itemId?: string | null;
  blueprintSources?: BlueprintSourceSnapshot[];
  size?: unknown;
  preferredMode?: FittingIconMode;
};

export type ResolveCraftedItemIconResult = {
  src: string | null;
  resolvedMode: FittingIconResolvedMode | "none";
  iconType: CraftedItemIconType;
  confidence: FittingIconConfidence | "none";
  reason?: string;
  componentType?: string;
  componentSize?: number | null;
};

function inferFpsWeaponIconKey(name: string): string | null {
  const normalized = name.toLowerCase();
  if (normalized.includes("sniper") || normalized.includes("a03") || normalized.includes("dmr")) return "sniper_rifle";
  if (normalized.includes("lmg") || normalized.includes("demeco")) return "lmg";
  if (normalized.includes("shotgun")) return "shotgun";
  if (normalized.includes("smg")) return "smg";
  if (normalized.includes("pistol")) return "pistol";
  if (normalized.includes("railgun")) return "handheld_railgun";
  if (normalized.includes("rifle") || normalized.includes("assault")) return "assault_rifle";
  return "assault_rifle";
}

function inferSizeFromIdentifiers(...sources: Array<string | null | undefined>): number | null {
  for (const source of sources) {
    if (!source) continue;
    if (/\bts-?2\b/i.test(source)) return 3;
    const sized = source.match(/(?:^|[_\s-])S0?(\d)(?:[_\s-]|$)/i);
    if (sized) {
      const parsed = Number.parseInt(sized[1], 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return null;
}

export function inferCraftedItemComponentType(
  itemName: string,
  recipeCategory?: string | null,
): string {
  const name = itemName.trim().toLowerCase();
  const recipeCat = (recipeCategory ?? "").trim().toLowerCase();

  if (recipeCat === "weapon" || recipeCat === "fps_weapon") return "fps_weapon";
  if (recipeCat === "armor") return "armor";

  if (/\bdeadbolt\b/.test(name) || (/\bcannon\b/.test(name) && !/\bsniper\b/.test(name))) return "ship_weapon";
  if (/\bsniper\b/.test(name) || /\ba03\b/.test(name) || /\brifle\b/.test(name) && /\b(lmg|smg|pistol|shotgun)\b/.test(name) === false && recipeCat === "weapon") {
    return "fps_weapon";
  }
  if (/\b(lmg|smg|pistol|shotgun|assault rifle|sniper rifle)\b/.test(name)) return "fps_weapon";

  if (/\bquantum\b/.test(name) || /\b(ts-|vk-|qi-|xf-|sp-|colossus)\b/i.test(itemName)) return "quantum_drive";
  if (/\bquadracell\b/.test(name) || /\bpower[\s-]?plant\b/.test(name) || /\bpowr\b/i.test(itemName)) return "powerplant";
  if (/\bcooler\b/.test(name) || /\biceplunge\b/.test(name)) return "cooler";
  if (/\bshield\b/.test(name) || /\bshld\b/i.test(itemName)) return "shield";
  if (/\bradar\b/.test(name) || /\bscanner\b/.test(name) || /\bradr\b/i.test(itemName) || /^vb\d+/i.test(name.trim())) return "radar";

  if (recipeCat === "ship_part" || recipeCat === "component") {
    if (/\bdrive\b/.test(name)) return "quantum_drive";
    if (/\bpower\b/.test(name) || /\bcell\b/.test(name)) return "powerplant";
    if (/\bheat\b/.test(name)) return "cooler";
  }

  if (recipeCat === "weapon") return "fps_weapon";
  return recipeCat || "other";
}

export function resolveCraftedItemIcon(input: ResolveCraftedItemIconInput): ResolveCraftedItemIconResult {
  const componentName = (input.itemName ?? input.recipeName ?? "").trim();
  if (!componentName) {
    return {
      src: null,
      resolvedMode: "none",
      iconType: "none",
      confidence: "none",
      reason: "Queue item has no display name.",
      componentType: "other",
      componentSize: null,
    };
  }

  const componentType = inferCraftedItemComponentType(componentName, input.category);
  const blueprintHints = (input.blueprintSources ?? []).flatMap((source) => [source.displayName, source.poolName, source.sourceFolder]);
  const inferredPowerPlantSize = (() => {
    const name = componentName.toLowerCase();
    if (/\bmx\b/.test(name)) return 3;
    if (/\bmt\b/.test(name)) return 2;
    return null;
  })();
  const componentSize = normalizeComponentSize(
    input.size ?? inferredPowerPlantSize ?? inferSizeFromIdentifiers(componentName, input.itemId, ...blueprintHints),
    componentName,
  );
  const preferredMode = input.preferredMode ?? "auto";

  const resolved = resolveFittingComponentIcon({
    componentType,
    componentName,
    size: componentSize,
    preferredMode,
  });

  if (resolved.confidence === "placeholder" && componentType === "fps_weapon") {
    const fpsIconKey = inferFpsWeaponIconKey(componentName);
    return {
      src: `/images/component-icons/${fpsIconKey}.webp`,
      resolvedMode: preferredMode === "mono" ? "mono" : "accent",
      iconType: "fps_weapon",
      confidence: "exact",
      componentType,
      componentSize,
    };
  }

  if (resolved.confidence === "placeholder" && componentType === "other") {
    return {
      src: null,
      resolvedMode: "none",
      iconType: "none",
      confidence: "none",
      reason: resolved.reason,
      componentType,
      componentSize,
    };
  }

  return {
    src: resolved.src,
    resolvedMode: resolved.resolvedMode,
    iconType: resolved.manifestKey ? "manifest" : "category",
    confidence: resolved.confidence,
    reason: resolved.reason,
    componentType,
    componentSize: resolved.componentSize ?? componentSize,
  };
}

export function resolveCraftedItemIconFromQueueItem(
  item: BuildQueueItem,
  recipe: RecipeTemplate | undefined,
  preferredMode?: FittingIconMode,
): ResolveCraftedItemIconResult {
  return resolveCraftedItemIcon({
    itemName: item.itemName,
    recipeName: recipe?.name,
    category: recipe?.category,
    itemId: item.itemId,
    blueprintSources: item.blueprintSources,
    preferredMode,
  });
}