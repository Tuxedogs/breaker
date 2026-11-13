import type { ComponentRecipe } from "./craftingTypes";
import { filterEffectiveModifiersAtQuality, getModifiersAtQuality } from "./qualityModifiers";
import { getModifierImpact } from "@/lib/gameplay/propertyUtils";
import {
  formatMaterialModifierDisplay,
  formatModifierStatName,
  getCraftingImpactClass,
  getCraftingModifierBaseValue,
} from "@/lib/crafting/craftingDetailStats";
import type { FittingComponentDetail } from "@/lib/fitting/fittingApi";

export type MaterialEffectAtQuality = {
  key: string;
  label: string;
  value: string;
  impactClass: string;
};

/** Modifiers one recipe material applies at the selected quality, formatted for display.
 *  Uses the extracted modifier curves; no values are derived here. */
export function getMaterialEffectsAtQuality(
  mat: ComponentRecipe["materials"][number],
  quality: number,
  fittingDetail?: FittingComponentDetail | null,
): MaterialEffectAtQuality[] {
  return filterEffectiveModifiersAtQuality(getModifiersAtQuality(mat.qualityModifiers ?? [], quality)).map((modifier, index) => {
    const display = formatMaterialModifierDisplay(
      modifier.property,
      getCraftingModifierBaseValue(fittingDetail, modifier.property),
      modifier.value,
      modifier.modifierMode,
    );
    return {
      key: `${modifier.property}:${index}`,
      label: formatModifierStatName(modifier.property),
      value: display.modifier,
      impactClass: getCraftingImpactClass(getModifierImpact(modifier.property, modifier.value)),
    };
  });
}
