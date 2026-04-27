import type { QualityModifier, ComponentRecipe } from "./craftingTypes";

export function getQualityModifiersForComponent(
  recipe: Pick<ComponentRecipe, "blueprint_id" | "component_type" | "component_name">,
  qualityModifiers: QualityModifier[]
): QualityModifier[] {
  // blueprint_id exists in both datasets — prefer exact match.
  const byId = qualityModifiers.filter((m) => m.blueprint_id === recipe.blueprint_id);
  if (byId.length > 0) return byId;

  // Fall back to component_type + component_name.
  return qualityModifiers.filter(
    (m) =>
      m.component_type === recipe.component_type &&
      m.component_name === recipe.component_name
  );
}

function interpolateInRange(mod: QualityModifier, quality: number): number {
  const { start_quality, end_quality, modifier_start_percent, modifier_end_percent } = mod;
  if (end_quality === start_quality) return modifier_start_percent;
  const t = (quality - start_quality) / (end_quality - start_quality);
  return modifier_start_percent + t * (modifier_end_percent - modifier_start_percent);
}

export interface ModifierAtQuality {
  slot: string;
  property: string;
  value: number;
}

export function getModifiersAtQuality(
  modifiers: QualityModifier[],
  quality: number
): ModifierAtQuality[] {
  const q = Math.max(0, Math.min(1000, quality));
  const result = new Map<string, ModifierAtQuality>();

  for (const mod of modifiers) {
    if (q >= mod.start_quality && q <= mod.end_quality) {
      const key = `${mod.slot}||${mod.gameplay_property}`;
      result.set(key, {
        slot: mod.slot,
        property: mod.gameplay_property,
        value: interpolateInRange(mod, q),
      });
    }
  }

  // Edge case: if no range matched (shouldn't happen with clean data), fall back
  // to the last range for each property so we never silently return nothing.
  if (result.size === 0 && modifiers.length > 0) {
    const lastByProp = new Map<string, QualityModifier>();
    for (const mod of modifiers) {
      const key = `${mod.slot}||${mod.gameplay_property}`;
      const existing = lastByProp.get(key);
      if (!existing || mod.end_quality > existing.end_quality) lastByProp.set(key, mod);
    }
    for (const [key, mod] of lastByProp) {
      result.set(key, {
        slot: mod.slot,
        property: mod.gameplay_property,
        value: interpolateInRange(mod, Math.min(q, mod.end_quality)),
      });
    }
  }

  return Array.from(result.values());
}

export function formatProperty(raw: string): string {
  return raw.replace(/^GPP_/, "").replace(/_/g, " ");
}

export function modifierValueAt(modifiers: QualityModifier[], property: string, slot: string, quality: number): string {
  const q = Math.max(0, Math.min(1000, quality));
  for (const mod of modifiers) {
    if (mod.gameplay_property === property && mod.slot === slot && q >= mod.start_quality && q <= mod.end_quality) {
      const v = interpolateInRange(mod, q);
      return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
    }
  }
  return "—";
}

// ── Per-material grouping ──────────────────────────────────────────

export interface MaterialModifierGroup {
  materialSlot: string;
  modifiers: QualityModifier[];
}

export interface GroupedModifiers {
  matched: MaterialModifierGroup[];
  unmatched: QualityModifier[];
}

/**
 * Groups quality modifiers by the recipe material slot they match.
 * Matching is by QualityModifier.slot === ComponentMaterial.slot.
 * Modifiers with a slot not present in any material are returned as unmatched.
 */
export function getModifiersGroupedByMaterial(
  recipe: ComponentRecipe,
  qualityModifiers: QualityModifier[]
): GroupedModifiers {
  const recipeModifiers = getQualityModifiersForComponent(recipe, qualityModifiers);
  if (recipeModifiers.length === 0) return { matched: [], unmatched: [] };

  const materialSlotSet = new Set(recipe.materials.map((m) => m.slot));
  const matchedMap = new Map<string, QualityModifier[]>();
  const unmatched: QualityModifier[] = [];

  for (const mod of recipeModifiers) {
    if (materialSlotSet.has(mod.slot)) {
      const arr = matchedMap.get(mod.slot) ?? [];
      arr.push(mod);
      matchedMap.set(mod.slot, arr);
    } else {
      unmatched.push(mod);
    }
  }

  // Preserve recipe material order for matched groups.
  const matched: MaterialModifierGroup[] = [];
  for (const mat of recipe.materials) {
    const mods = matchedMap.get(mat.slot);
    if (mods && mods.length > 0) {
      matched.push({ materialSlot: mat.slot, modifiers: mods });
      matchedMap.delete(mat.slot);
    }
  }
  // Safety: any remaining matched slots not in recipe order.
  for (const [slot, mods] of matchedMap) {
    matched.push({ materialSlot: slot, modifiers: mods });
  }

  return { matched, unmatched };
}

export interface UnmatchedModifierSummary {
  slot: string;
  property: string;
  minPercent: number;
  maxPercent: number;
}

/**
 * Reduces unmatched modifier rows to one summary per (slot, property) pair,
 * showing the full quality range min→max. Used when a modifier can't be tied
 * to a specific material slider.
 */
export function summariseUnmatchedModifiers(
  modifiers: QualityModifier[]
): UnmatchedModifierSummary[] {
  const map = new Map<string, UnmatchedModifierSummary>();
  for (const mod of modifiers) {
    const key = `${mod.slot}||${mod.gameplay_property}`;
    const lo = Math.min(mod.modifier_start_percent, mod.modifier_end_percent);
    const hi = Math.max(mod.modifier_start_percent, mod.modifier_end_percent);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        slot: mod.slot,
        property: mod.gameplay_property,
        minPercent: lo,
        maxPercent: hi,
      });
    } else {
      map.set(key, {
        ...existing,
        minPercent: Math.min(existing.minPercent, lo),
        maxPercent: Math.max(existing.maxPercent, hi),
      });
    }
  }
  return Array.from(map.values());
}
