import { useMemo, useState } from "react";
import type { BuildQueueItem } from "../../types/logistics";
import type { RecipeTemplate } from "../../types/logistics";
import { type FittingIconMode } from "../../lib/fitting/fittingIconMode";
import {
  resolveCraftedItemIconFromQueueItem,
  type ResolveCraftedItemIconResult,
} from "../../lib/fitting/resolveCraftedItemIcon";

type BuildQueueProductIconProps = {
  item: BuildQueueItem;
  recipe?: RecipeTemplate;
  preferredMode: FittingIconMode;
  layout: "desktop" | "mobile";
  alt?: string;
};

function isWeaponVisual(resolved: ResolveCraftedItemIconResult): boolean {
  const type = resolved.componentType ?? "";
  return type === "ship_weapon" || type === "fps_weapon" || resolved.iconType === "fps_weapon";
}

function isLowConfidenceVisual(resolved: ResolveCraftedItemIconResult): boolean {
  return resolved.confidence === "placeholder" || resolved.iconType === "category";
}

export function BuildQueueProductIcon({
  item,
  recipe,
  preferredMode,
  layout,
  alt,
}: BuildQueueProductIconProps) {
  const resolved = useMemo(
    () => resolveCraftedItemIconFromQueueItem(item, recipe, preferredMode),
    [item, preferredMode, recipe],
  );
  const [hidden, setHidden] = useState(false);

  if (!resolved.src || hidden) return null;

  const weapon = isWeaponVisual(resolved);
  const classNames = [
    "bq-product-icon",
    layout === "mobile" ? "bq-product-icon--mobile" : "bq-product-icon--desktop",
    weapon ? "bq-product-icon--weapon" : "bq-product-icon--component",
    resolved.resolvedMode === "accent" ? "bq-product-icon--accent" : "",
    resolved.resolvedMode === "mono" ? "bq-product-icon--mono" : "",
    resolved.resolvedMode === "placeholder" ? "bq-product-icon--placeholder" : "",
    isLowConfidenceVisual(resolved) ? "bq-product-icon--low-confidence" : "",
  ].filter(Boolean).join(" ");

  return (
    <img
      className={classNames}
      src={resolved.src}
      alt={alt ?? item.itemName ?? recipe?.name ?? "Crafted item icon"}
      loading="lazy"
      decoding="async"
      title={resolved.reason}
      onError={() => setHidden(true)}
    />
  );
}