# Crafting Modifier System — Findings & Power Pip Handoff

> **Historical handoff — not operational guidance.** Static `public/api` paths and page-local calculation descriptions below record the implementation at the time of this investigation. `public/api` is retired. Use `docs/api-data-flow-runbook.md` for the current routed data boundary, `docs/crafting-browser-detail-handoff.md` for the active Crafting implementation, and the current shared crafting/fitting projection code for calculation ownership.

## What Was Fixed

### Bug: Wrong base value for Shield HP (and other vehicle component stats)
`getIndexedModifierBaseValue` only checked `fpsWeapon`, `fpsAmmo`, `shipWeapon` stat groups from `component_card_index.json`. For shield, radar, QD, cooler, powerPlant etc. it returned `undefined`, so the code fell back to `getBaseStatValue` which read from raw `baseStats` in `blueprints.json`.

- `baseStats.resources.generation.Shield` = **21,120** (this is the regen rate, not max HP)
- The actual Shield MaxHealth is in `component_card_index.json → stats.shield.maxShieldHealth` = **105,600**

**Fix applied:** Extended `MODIFIER_STAT_BINDINGS` with `statGroups` per property, and updated `getIndexedModifierBaseValue` to check those groups. All gameplay properties are now mapped.

### Bug: Multiplier-mode modifiers were summed additively instead of compounded
Two materials each giving +10% were summed to +20%, giving `base * 1.20 = 126,720`.
Correct result is compound: `base * 1.1 * 1.1 = base * 1.21 = 127,776`.

**Fix applied:** In `computeTotalModifiers`, multiplier-mode contributions now compound:
```ts
existing.totalValue = ((1 + existing.totalValue / 100) * (1 + m.value / 100) - 1) * 100;
```

---

## Architecture: How Crafting Stats & Modifiers Work

### Data sources

| File | Purpose |
|---|---|
| `public/api/crafting/blueprints.json` | Blueprint definitions with materials, qualityModifiers per slot/property, baseStats |
| `public/api/crafting/component_card_index.json` | Pre-computed display stats: `stats.shield.maxShieldHealth`, `stats.quantumDrive.*`, etc. Also holds `card.secondary` (the string values shown in the UI) |
| `public/api/crafting/quality_quantization.json` | Maps quality bands → quality values |

### Normalization (`src/lib/craftingData.ts`)

Raw JSON (camelCase) → `ComponentRecipe` (snake_case) via `normalizeBlueprint`. Per-blueprint `qualityModifiers` are spread into each `ComponentMaterial.qualityModifiers` by slot match.

### Modifier calculation flow (`ComponentRecipeTable.tsx`)

1. **`computeTotalModifiers`** — for each material slot, reads quality from band selector, calls `getModifiersAtQuality` to interpolate, then aggregates by `(property, modifierMode)`. Multiplier mode now compounds. Integer-additive mode sums.

2. **`buildModifiedDetailStatRows`** — for each modifier property:
   - Calls `getIndexedModifierBaseValue(record, property)` → reads from `component_card_index.json` stats groups
   - Falls back to `getBaseStatValue(recipe, property)` → reads from raw `baseStats` paths
   - Calls `applyModifierToBase(base, totalValue, modifierMode)`:
     - multiplier: `base * (1 + totalValue / 100)`
     - integerAdditive: `base + totalValue`

3. **`formatMaterialModifierDisplay`** — produces `{base, modifier (delta), total}` strings for the UI

### Gameplay Property → Stat Group Mapping (now in MODIFIER_STAT_BINDINGS)

| Property | statGroup | statKey |
|---|---|---|
| GPP_Shield_MaxHealth | shield | maxShieldHealth |
| GPP_Health_MaxHealth | generic | health |
| GPP_ItemResource_PowerGeneration | powerPlant | powerGeneration |
| GPP_ItemResource_CoolantGeneration | cooler | coolantGeneration |
| GPP_Quantum_FuelRequirement | quantumDrive | quantumFuelRequirement |
| GPP_Quantum_Speed | quantumDrive | normalJumpSpeed |
| GPP_Radar_MaxAimAssistDistance | radar | aimAssistRangeMax |
| GPP_Radar_MinAimAssistDistance | radar | aimAssistRangeMin |

---

## Power Pip System — Goals & Research Notes

### What power pips are
Power plants in Star Citizen generate power pips. Components draw from these pips (1 pip = 1 unit of distributed power). When a power plant's pip output changes (crafted, overclocked), component performance scales.

- `stats.powerPlant.powerPips` — base pip count
- `stats.powerPlant.powerPipBonus` — likely craft/overclock bonus pips
- `stats.powerPlant.powerGeneration` — total generation

### How spviewer.eu presents it
(See spviewer.eu for live reference) — when you assign pips to a component, performance stats (e.g., quantum drive speed, shield regen) change in real time. This means there is a known pip-to-stat scaling formula per component type.

### Preparation needed before implementing

1. **Understand the pip scaling formulas** — components have min/max curves. A 3-pip component at 3 pips is different from 1 pip. These are encoded in component records (likely `powerUsageMin`/`powerUsageMax` and corresponding stat min/max pairs in the index).

2. **Add pip UI to crafting detail** — the crafting page shows stats at "default" power. Need a pip assignment control that re-computes the displayed stats.

3. **Separate "raw craft modifier" from "pip-scaled value"** — the modifier system (fixed above) applies craft bonuses to base stats. Pip scaling is a second layer on top of that. The layering should be:
   ```
   baseStatFromIndex
     → apply craft multipliers (what's now fixed)
     → apply pip scaling
     = displayed value at selected pip count
   ```

4. **Key stat pairs for pip scaling** (from component_card_index stats):
   - `powerUsageMin` / `powerUsageMax` — pip draw range
   - Shield: `regenRate` scales with pips
   - PowerPlant: `powerGeneration` = total output; `selfPowerUse` = own draw
   - Cooler: `coolingRate` scales with pips
   - QD: speed may scale with pips

5. **Component_card_index.json `card.secondary` fields** hold the displayed string for the current (default) pip state. These strings are pre-rendered and don't reflect craft modifiers — the crafting page already recomputes from raw numbers, which is correct.

### Recommended implementation path

1. Add a pip-count state to `ComponentRecipeTable` (or recipe hook) per component type
2. Write a `applyPipScale(baseStat, pipCount, minPips, maxPips, statAtMin, statAtMax)` pure function
3. Apply it after craft modifiers in `buildModifiedDetailStatRows`
4. Display pip assignment control in the crafting UI (similar to quality sliders)
5. For power plants: show downstream pip budget available to other components (future)

---

## Files to Know

| File | Role |
|---|---|
| `src/components/industry/crafting/components/ComponentRecipeTable.tsx` | Main crafting detail view; all calculation logic lives here |
| `src/lib/craftingData.ts` | Data normalization: JSON → TypeScript types |
| `src/components/industry/crafting/utils/qualityModifiers.ts` | Modifier interpolation, per-material grouping |
| `src/components/industry/crafting/utils/craftingTypes.ts` | Core TypeScript interfaces |
| `src/components/industry/crafting/utils/qualityBands.ts` | Band → quality mapping |
| `public/api/crafting/blueprints.json` | Source data for all blueprints |
| `public/api/crafting/component_card_index.json` | Pre-computed display stats |
