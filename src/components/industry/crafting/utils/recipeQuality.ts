import type { QualityBand } from "./qualityBands";
import {
  DEFAULT_BAND_INDEX,
  FALLBACK_QUALITY_BANDS,
  getBandEffectiveQuality,
  rarityFromBandIndex,
} from "./qualityBands";
import type { ComponentRecipe } from "./craftingTypes";
import { getMaterialQualityKey } from "./materialQuality";
import { getModifiersAtQuality } from "./qualityModifiers";

export interface TotalModifierRow {
  property: string;
  totalValue: number;
  modifierMode?: string;
  contributions: { materialName: string; value: number }[];
}

export type FinalProductQuality = {
  band: number;
  averageBand: number;
  rarity: string;
  source: "selectedMaterialBands";
};

export type SelectedQualitySnapshot = Record<
  string,
  { quality: number; bandNumber: number; bands: QualityBand[] }
>;

function getMaterialName(mat: ComponentRecipe["materials"][number]): string {
  return String(mat.material_name ?? "");
}

function hasMaterialQualityModifiers(mat: ComponentRecipe["materials"][number]): boolean {
  return (mat.qualityModifiers?.length ?? 0) > 0;
}

export function getTotalModifierKey(property: string, modifierMode?: string): string {
  return `${property}||${modifierMode ?? ""}`;
}

export function getQualityBandsForMaterial(
  mat: ComponentRecipe["materials"][number],
  getBandsForMaterial: (materialName: string) => QualityBand[],
): QualityBand[] {
  const bands = getBandsForMaterial(getMaterialName(mat));
  if (bands.length > 0) return bands;
  return hasMaterialQualityModifiers(mat) ? FALLBACK_QUALITY_BANDS : bands;
}

export function getMaterialEffectiveQuality(
  mat: ComponentRecipe["materials"][number],
  bandIndex: number,
  getBandsForMaterial: (materialName: string) => QualityBand[],
): number {
  return getBandEffectiveQuality(getQualityBandsForMaterial(mat, getBandsForMaterial), bandIndex);
}

export function computeTotalModifiers(
  recipe: ComponentRecipe,
  getBandsForMaterial: (materialName: string) => QualityBand[],
  getBandIndex: (key: string) => number,
): TotalModifierRow[] {
  const map = new Map<string, TotalModifierRow>();

  for (const [inputIndex, mat] of recipe.materials.entries()) {
    const modifiers = mat.qualityModifiers ?? [];
    if (modifiers.length === 0) continue;

    const key = getMaterialQualityKey(recipe, mat, inputIndex);
    const quality = getMaterialEffectiveQuality(mat, getBandIndex(key), getBandsForMaterial);
    const atQuality = getModifiersAtQuality(modifiers, quality);

    for (const m of atQuality) {
      const rowKey = getTotalModifierKey(m.property, m.modifierMode);
      const existing = map.get(rowKey);

      if (!existing) {
        map.set(rowKey, {
          property: m.property,
          totalValue: m.value,
          modifierMode: m.modifierMode,
          contributions: [{ materialName: getMaterialName(mat), value: m.value }],
        });
      } else {
        if (m.modifierMode === "integerAdditive") {
          existing.totalValue += m.value;
        } else {
          existing.totalValue = ((1 + existing.totalValue / 100) * (1 + m.value / 100) - 1) * 100;
        }
        existing.contributions.push({ materialName: getMaterialName(mat), value: m.value });
      }
    }
  }

  return Array.from(map.values());
}

export function deriveFinalProductQuality(
  recipe: ComponentRecipe,
  getBandIndex: (key: string) => number,
): FinalProductQuality {
  let bandTotal = 0;
  let materialCount = 0;

  for (const [inputIndex, mat] of recipe.materials.entries()) {
    const band = getBandIndex(getMaterialQualityKey(recipe, mat, inputIndex)) + 1;
    bandTotal += band;
    materialCount += 1;
  }

  const averageBand = materialCount > 0 ? bandTotal / materialCount : DEFAULT_BAND_INDEX + 1;
  const band = Math.max(1, Math.min(8, Math.round(averageBand)));

  return {
    band,
    averageBand,
    rarity: rarityFromBandIndex(band),
    source: "selectedMaterialBands",
  };
}

export function computeTotalModifiersFromQualities(
  recipe: ComponentRecipe,
  materialQualities: Record<string, number>,
): TotalModifierRow[] {
  const map = new Map<string, TotalModifierRow>();

  for (const [inputIndex, mat] of recipe.materials.entries()) {
    const modifiers = mat.qualityModifiers ?? [];
    if (modifiers.length === 0) continue;

    const key = getMaterialQualityKey(recipe, mat, inputIndex);
    const quality = materialQualities[key];
    if (quality === undefined) continue;

    const atQuality = getModifiersAtQuality(modifiers, quality);

    for (const m of atQuality) {
      const rowKey = getTotalModifierKey(m.property, m.modifierMode);
      const existing = map.get(rowKey);

      if (!existing) {
        map.set(rowKey, {
          property: m.property,
          totalValue: m.value,
          modifierMode: m.modifierMode,
          contributions: [{ materialName: getMaterialName(mat), value: m.value }],
        });
      } else {
        if (m.modifierMode === "integerAdditive") {
          existing.totalValue += m.value;
        } else {
          existing.totalValue = ((1 + existing.totalValue / 100) * (1 + m.value / 100) - 1) * 100;
        }
        existing.contributions.push({ materialName: getMaterialName(mat), value: m.value });
      }
    }
  }

  return Array.from(map.values());
}

export function buildSelectedQualitySnapshot(
  recipe: ComponentRecipe,
  materialQualities: Record<string, number>,
  getBandsForMaterial: (materialName: string) => QualityBand[],
): SelectedQualitySnapshot {
  return Object.fromEntries(
    recipe.materials.map((mat, inputIndex) => {
      const key = getMaterialQualityKey(recipe, mat, inputIndex);
      const bandIndex = materialQualities[key] ?? DEFAULT_BAND_INDEX;
      const bands = getQualityBandsForMaterial(mat, getBandsForMaterial);
      return [key, {
        quality: getBandEffectiveQuality(bands, bandIndex),
        bandNumber: bandIndex + 1,
        bands,
      }];
    }),
  );
}
