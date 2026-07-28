# Component Card Index Audit

Date audited: 2026-05-25

> Historical architecture audit. The compact component-card index and category-specific browser statistics are now implemented. For the current Recipe Browser, Crafting Detail, search precedence, table schemas, and validation contract, use `docs/crafting-browser-detail-handoff.md` and `moonbreaker_design_canon.md`. Do not treat the historical “current browser” descriptions below as implementation authority.

Scope: data and indexing architecture for the Component Results Browser at `/industry/crafting` and detail route `/industry/crafting/:blueprintId`. This audit uses only current local/generated project data as source of truth. No UI, CSS, route, or filtering behavior was changed.

## Summary

Recommendation: **C. Build a shared compact browser index now and add category-specific stats incrementally as extraction improves.**

The current local data is strong enough for fast, accurate identity/crafting cards: blueprint GUIDs, names, component categories, size/grade/class where present, craft times, material requirements, material units/min quality, reward pool source snapshots for vehicle blueprints, FPS family/variant metadata, saved blueprint joins, and build queue joins.

It is not yet strong enough for performance-forward cards across all target categories. Many ideal fields exist only as quality modifier properties, which show that a material can affect a stat but do not provide the base stat needed to display final DPS, shield regen, quantum travel time, armor mitigation, and similar values. Generic `baseStats` such as mass, health, signatures, resistances, distortion, and some resource generation/consumption should stay labeled as generic or conservative resource stats unless a category-specific extractor proves their semantics.

## Source Inventory

| Source | Contains | Current? | Used today | Should feed browser index? | Safest join key |
|---|---|---:|---|---:|---|
| `public/api/crafting/blueprints.json` | 471 vehicle/component blueprints. Identity, `componentType`, `size`, `grade`, `class`, `manufacturerGuid`, `entityClass`, `craftTimeSeconds`, `baseStats`, `materials`, `qualityModifiers`, `rewardPools`. | Yes, 2026-05-24. | Loaded by `src/lib/craftingData.ts` and normalized into `ComponentRecipe`. | Yes, primary vehicle source. | `blueprintGuid` -> `blueprint_id`; `entityClass` only as output identity. |
| `public/api/crafting/fps/fps_blueprints.json` | 1,082 FPS blueprints: 164 weapons, 882 armor, 36 ammo. Identity, FPS category, family/variant metadata, materials, quality modifiers. | Yes, 2026-05-24. | Loaded by `src/lib/craftingData.ts` and normalized into `ComponentRecipe`. | Yes, primary FPS source. | `blueprintGuid` or `id`; both match in sampled FPS records. Prefer `blueprintGuid`. |
| `public/api/crafting/fps/weapons.json` | FPS weapon subset, 164 records. Includes `weaponClass`, family fields, materials, modifiers. | Yes, 2026-05-24. | Not loaded directly by browser today. | Optional detail/stat source; avoid duplicating `fps_blueprints` unless generator prefers split files. | `blueprintGuid`, `familyKey`. |
| `public/api/crafting/fps/armor.json` | FPS armor subset, 882 records. Includes `armorSlot`, `armorWeight`, `armorFamily`, family fields, materials, modifiers. | Yes, 2026-05-24. | Not loaded directly today. | Optional detail/stat source; redundant with `fps_blueprints`. | `blueprintGuid`, `familyKey`. |
| `public/api/crafting/fps/ammo.json` | FPS ammo subset, 36 records. Includes `ammoClass`, family fields, materials. | Yes, 2026-05-24. | Not loaded directly today. | Optional detail/stat source; redundant with `fps_blueprints`. | `blueprintGuid`, `familyKey`. |
| `public/api/crafting/fps/weapon_families.json` | 161 FPS weapon families with variants and `weaponClass`. | Yes, 2026-05-24. | Current browser derives family variant counts from normalized recipes instead. | Yes, if the generated index wants stable variant counts without client derivation. | `familyKey`; variant `blueprintGuid` where present. |
| `public/api/crafting/fps/armor_families.json` | 596 FPS armor families with variants, `armorSlot`, `armorWeight`, `armorFamily`. | Yes, 2026-05-24. | Not loaded by browser today. | Yes, optional variant/family enrichment. | `familyKey`; variant `blueprintGuid` where present. |
| `public/api/crafting/fps/fps_variant_families.json` | Combined FPS family records, 757 entries. | Yes, 2026-05-24. | Not loaded today. | Optional if generator wants one family file for FPS. | `familyKey`. |
| `public/api/crafting/crafted_properties.json` | 29 gameplay property ids/names/paths. | Yes, 2026-05-24. | Exposed by `getCraftedProperties()`, useful for modifier labels. | Yes, as generator lookup for modifier labels/debug metadata. | `gameplayPropertyId`; fallback `gameplayProperty`. |
| `public/api/crafting/quality_quantization.json` | 38 material quality band records keyed by material GUID/key. | Yes, 2026-05-24. | Loaded by quality flow. | Yes for material band requirement/debug fields; not for static final product quality. | material `guid` / `materialKey`; recipe material `costId`. |
| `public/api/crafting/material_identity_index.json` | Material identity map, GUID lookup, conflicts. | Yes, 2026-05-24. | Upstream source for generated material names; resolver uses material GUID/name concepts. | Yes for generator validation and material facets. | material GUID / `costId`; `materialKey` for fallback. |
| `public/api/crafting/blueprint_rewards.json` | 116 reward pools with `poolGuid`, `poolName`, `sourceFolder`, display name, rewards. | Yes, 2026-05-24. | Historical/helper source. Current build queue uses `recipe.rewardPools` snapshot. | Maybe; use only to validate or expand reward pool labels, not as primary blueprint join. | `poolGuid`; reward blueprint GUID when present in rewards. |
| `public/api/missions/blueprint_reward_sources.json` | 654 source records keyed by `blueprintGuid`, with mission lists. | Older, 2026-05-15. | Used by existing source/detail helpers in some crafting views. | No for initial compact card index, except optional source count/debug. Keep mission detail out of cards. | `blueprintGuid`. |
| `public/api/missions/mission_blueprint_rewards.json` | 685 mission records with blueprint rewards and mission metadata. | Older, 2026-05-15. | Mission/source helper data. | No for card index; too heavy and not a mission tracker. | Mission ids and blueprint GUIDs inside rewards. |
| `public/api/missions/mission_reward_lookups.json` | Lookup maps for blueprint pools, factions, standings, mission types. | Older, 2026-05-15. | Mission/source helper data. | No for card index; optional detail-source lookup only. | `poolGuid`, mission/faction GUIDs. |
| `src/lib/craftingData.ts` | Current normalization layer for vehicle and FPS JSON into `ComponentRecipe[]`. | Current code path. | Browser and detail page data source. | Yes as reference for normalized shape; generator should reuse its field decisions. | Normalized `blueprint_id`. |
| `src/components/industry/crafting/components/ComponentResultsBrowser.tsx` | Current browser filtering/search/paging over `ComponentRecipe[]`; saved state fetch; material/type filters. | Current code path. | Directly used by `/industry/crafting`. | Architecture reference only; do not change behavior in this task. | `recipe.blueprint_id`, material `cost_id` or name. |
| `src/components/industry/crafting/components/ComponentResultCard.tsx` | Card renderer using `buildComponentCardSchema()`. | Current code path. | Direct card display. | Architecture reference only. | `schema.id` from `blueprint_id`. |
| `src/components/industry/crafting/utils/componentCardSchema.ts` | Existing safe card schema: labels, meta, generic stats, FPS family stats, modifier labels, material preview. | Current code path. | Used by cards. | Yes as the first version of display-value policy. | `blueprint_id`; `familyKey` for variant counts. |
| `src/components/industry/crafting/utils/craftingTypes.ts` | Normalized TypeScript shapes for `ComponentRecipe`, `ComponentMaterial`, `QualityModifier`. | Current code path. | Shared crafting types. | Yes as compatibility target. | `blueprint_id`, material `cost_id`. |
| `src/lib/buildQueueRehydration.ts` | Remote queue rehydration. Builds recipe id as `craft-${recipe.blueprint_id}` and snapshots `rewardPools`. | Current code path. | Queue/runtime join. | No static index fields except join-key guidance. | `craft-${blueprint_id}` for queue recipe id. |
| `src/stores/logisticsStore.ts` | Mutable build queue/inventory store. Queue items can snapshot blueprint id, item name, quality fields, material requirements, blueprint sources. | Current code path. | Runtime queued state and planning snapshots. | No static source; runtime join only. | Queue `recipeId`, usually `craft-${blueprint_id}`; queue `blueprint_id` snapshot. |
| `src/lib/userSavedBlueprints.ts` | Saved blueprint API client. Saved records have `blueprintId`. | Current code path. | Runtime saved/bookmark state. | No static source; runtime join only. | `blueprintId` equals normalized `blueprint_id`. |
| `scripts/reports/crafting/blueprints_enrichment_audit.json` | Older extraction audit from 2026-05-06. Counts and examples for grade/class enrichment from component JSON/XML. | Older. | Audit-only. | No, but useful as extraction provenance. | `entityClass`, `blueprintName`. |
| `scripts/reports/crafting/fps/fps_audit.json` | Older FPS extraction audit: counts by category/class/slot/weight and fallback-name warnings. | Older. | Audit-only. | No, but useful for data quality warnings. | `id` / blueprint GUID. |
| `scripts/reports/crafting/fps/fps_variant_audit.json` | Older FPS variant grouping audit. | Older. | Audit-only. | No, but useful for variant confidence history. | `familyKey`. |
| `dist/api/**` | Built copy of API data. | Stale relative to `public/api` in this repo. | Build artifact. | No. | None. |

## Current Data Path

`src/lib/craftingData.ts` loads `public/api/crafting/blueprints.json` and `public/api/crafting/fps/fps_blueprints.json`, normalizes both into `ComponentRecipe[]`, and exposes `getCraftingItems()` and `getCraftingItemByBlueprintGuid()`.

`ComponentResultsBrowser.tsx` currently searches and filters directly over `ComponentRecipe[]`. Search checks display/name/type/category/grade/class/FPS family fields/blueprint id/entity class. Material filters scan recipe materials by `cost_id` or `material_name`. Results are sorted by card type label, then display name, and paginated 12 per page.

`ComponentResultCard.tsx` delegates display decisions to `buildComponentCardSchema()`, which currently uses safe meta fields, generic base stats, FPS family fields, modifier labels for FPS and power plants, and the first three materials.

Saved state joins by `SavedBlueprint.blueprintId`. Queue state joins by recipe id `craft-${blueprint_id}` in the remote queue path and by the same blueprint-derived recipe identity in local queue registration/rehydration.

## Field Availability Matrix: Shared Fields

| Field | Available now? | Source path/property | Join key | Transform needed? | Safe for card display? | Safe for search? | Safe for sort? | Notes |
|---|---|---|---|---|---:|---:|---:|---|
| `blueprint_id` | Yes | vehicle/FPS `blueprintGuid`; FPS `id` also present | Primary item key | Normalize to `blueprint_id` | Yes | Yes | Yes | Safest static id. |
| `slug` | Missing | None found | None | New extraction/derivation required | No | No | No | Do not invent for route/index identity. |
| `uuid/guid` | Yes | `blueprintGuid`, `entityClass`, material `costId`, reward `poolGuid` | Depends on entity | Preserve exact GUID strings | Yes | Yes | Limited | Use specific names, not generic `uuid`, in index. |
| `output_entityClass` | Yes | raw `entityClass` | Output item identity | Normalize to `output_entityClass` | Yes, compact/debug | Yes | No | Not primary recipe key. |
| `className` | Partial/unclear | `blueprintName`, `blueprintPath`, `recordPath`, not explicit class name | None | Need extractor semantics | No | Yes as internal debug token | No | Do not label as class name unless extraction adds it. |
| component name/display name | Yes | raw `displayName`; normalized `component_name` | Display only | Existing normalization | Yes | Yes | Yes | Current browser source. |
| `item_kind` | Yes normalized | `vehicle` from vehicle JSON, `fps` from FPS JSON | N/A | Existing normalization | Yes | Yes | Yes | Useful top-level facet. |
| `component_type` | Yes | vehicle `componentType`; FPS `fpsCategory` | Category/facet | Existing normalization | Yes | Yes | Yes | Main current type filter. |
| `category` | Partial | FPS `category`/`fpsCategory`; vehicle raw `category` not meaningful, normalized to component type | Category/facet | Keep as broad label | Yes | Yes | Yes | For vehicle, duplicates `component_type`. |
| `size` | Vehicle yes, FPS no | vehicle `size` | `blueprint_id` | Parse numeric sort value | Vehicle yes | Yes | Yes | FPS normalized empty. |
| `grade` | Vehicle mostly yes, FPS no | vehicle `grade` | `blueprint_id` | Grade rank map for sort | Vehicle yes | Yes | Yes | Missing in 1 cooler and several class fields. |
| `class` / `componentClass` | Vehicle partial, FPS no | vehicle `class`; FPS has `weaponClass`, `armorSlot`, `armorWeight` instead | `blueprint_id` | Keep separate from FPS class/slot/weight | Yes where present | Yes | Yes | Ship weapons/tractor beams often have null class. |
| manufacturer | Partial id only | vehicle `manufacturerGuid`; no display manufacturer found | Manufacturer GUID only | Needs display lookup/extraction | No as name; yes debug GUID | Yes as GUID only | No | Avoid showing GUID as manufacturer unless explicitly debug. |
| craft time | Yes | `craftTimeSeconds`; normalized `craft_time_seconds` | `blueprint_id` | Parse number | Yes | Maybe | Yes | Stable numeric sort key. |
| materials | Yes | vehicle `materials`; FPS `materialRequirements`/`materials` | material `costId` | Normalize compact material rows | Yes | Yes | material count/quantity only | Raw has `unitType` and `minQuality`; current normalized type loses unit/minQuality. |
| material names | Yes | material `materialName` | material `costId` | Trim/lowercase tokens | Yes | Yes | Yes as string | Good facet label. |
| material quantities | Yes | material `quantity` string/number | material row | Parse number | Yes | Maybe | Yes | Preserve unit because SCU vs unit matters. |
| material units | Yes raw | material `unitType` or `unit` | material row | Preserve in index | Yes | Yes | Yes as facet if needed | Current `ComponentMaterial` does not preserve unit. |
| material quality/band requirements | Partial | material `minQuality`; `quality_quantization.json`; runtime quality selection | material `costId` | Preserve `minQuality`; do not compute final quality stat | Yes as requirement/debug | Yes | Limited | Static final product band is runtime-selected, not index field. |
| reward/source metadata | Vehicle yes, FPS no | vehicle `rewardPools`; mission source files older | `poolGuid`, `blueprintGuid` | Compact source labels/counts | Yes as source label/count | Yes | Yes by source count | Avoid mission tracker semantics. |
| variants/family | FPS yes; vehicle not explicit | FPS `familyKey`, `familyDisplayName`, `variantName`; family files | `familyKey`, `blueprintGuid` | Keep FPS family fields; derive counts at generation | Yes | Yes | Yes by variant count | Vehicle family grouping remains heuristic if needed. |
| saved join keys | Yes runtime | `SavedBlueprint.blueprintId`; local storage set of ids | `blueprint_id` | Runtime Set lookup | Yes state badge | Filter only | No | Not static index. |
| queued join keys | Yes runtime | queue `recipeId = craft-${blueprint_id}`, queue snapshot `blueprint_id` | `craft-${blueprint_id}` | Runtime Set lookup | Yes state badge | Filter only | No | Not static index. |

## Category Field Availability Matrices

### Cooler

| Field | Available now? | Source path/property | Join key | Transform needed? | Safe for card display? | Safe for search? | Safe for sort? | Notes |
|---|---|---|---|---|---:|---:|---:|---|
| cooling output / coolant generation | Partial | `baseStats.resources.generation.Coolant`; modifier `GPP_ItemResource_CoolantGeneration` | `blueprint_id` | Numeric parse; conservative label | Caution | Yes | Yes | Looks real for coolers, but label as "Coolant generation", not broader cooling model. |
| cooling capacity | Missing | None found | N/A | New extraction | No | No | No | Do not invent. |
| power draw | Yes | `baseStats.resources.consumption.Power` | `blueprint_id` | Numeric parse | Yes | Yes | Yes | Present in sampled cooler. |
| coolant behavior | Partial | `baseStats.resources.generation.Coolant`; modifier property | `blueprint_id` | Category-specific semantics needed | Caution | Yes | Yes | Single resource value only. |
| heat recovery | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| wear | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| mass/health/signatures | Yes generic | `baseStats.mass`, `health`, `emSignature`, `irSignature` | `blueprint_id` | Numeric parse | Yes as generic metadata | Yes | Yes | Not category-specific performance. |

### Power Plant

| Field | Available now? | Source path/property | Join key | Transform needed? | Safe for card display? | Safe for search? | Safe for sort? | Notes |
|---|---|---|---|---|---:|---:|---:|---|
| power output | Modifier-only | `qualityModifiers.gameplayProperty = GPP_ItemResource_PowerGeneration` | `blueprint_id` | Needs base output extraction | No as final stat | Yes modifier token | No | `baseStats.resources.generation.Power` was not found in sampled/current power plants. |
| voltage regulator | Ingredient/modifier slot only | material slot `VOLTAGE REGULATOR`; modifier slot | material row | Slot display only | Limited | Yes | No | Ingredient slot, not stat. |
| power pips / breakpoint potential | Modifier-only | integer additive ranges on `GPP_ItemResource_PowerGeneration` | `blueprint_id` + selected quality | Runtime quality calculation | Limited | Yes | No static sort | Useful in detail/build context after quality selection. |
| stability | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| heat | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| wear | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| mass/health/signatures | Yes generic | `baseStats.mass`, `health`, `emSignature`, `irSignature`, `distortion` | `blueprint_id` | Numeric parse | Yes as generic metadata | Yes | Yes | Not power output. |

### Quantum Drive

| Field | Available now? | Source path/property | Join key | Transform needed? | Safe for card display? | Safe for search? | Safe for sort? | Notes |
|---|---|---|---|---|---:|---:|---:|---|
| fuel efficiency | Modifier-only | `GPP_Quantum_FuelRequirement` | `blueprint_id` | Needs base fuel stat | No as final stat | Yes modifier token | No | Modifier exists; base missing. |
| 10GM travel time | Missing | None found | N/A | New extraction/calculation | No | No | No | Missing. |
| normal jump speed | Modifier-only | `GPP_Quantum_Speed` | `blueprint_id` | Needs base speed | No as final stat | Yes modifier token | No | Modifier exists; base missing. |
| spline jump speed | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| spool time | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| cooldown | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| calibration min/max | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| calibration angle min/max | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| quantum fuel consumption | Modifier-only | `GPP_Quantum_FuelRequirement` | `blueprint_id` | Needs base consumption | No as final stat | Yes modifier token | No | Same limitation as fuel efficiency. |
| power/coolant usage | Missing | No `resources` in sampled quantum drive `baseStats` | N/A | New extraction | No | No | No | Missing from current local data. |
| mass/health/signatures | Yes generic | `baseStats.mass`, `health`, `emSignature`, `irSignature`, `distortion` | `blueprint_id` | Numeric parse | Yes as generic metadata | Yes | Yes | Secondary only. |

### Shield Generator

| Field | Available now? | Source path/property | Join key | Transform needed? | Safe for card display? | Safe for search? | Safe for sort? | Notes |
|---|---|---|---|---|---:|---:|---:|---|
| max shield HP | Partial | `baseStats.resources.generation.Shield`; modifier `GPP_Shield_MaxHealth` | `blueprint_id` | Semantics confirmation | Caution | Yes | Yes | Do not call `baseStats.health` shield HP; it is component health. |
| regen rate | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| regen time | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| damage regen delay | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| downed regen delay | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| reserve pool regen | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| physical absorption | Generic resistance only | `baseStats.damageResistances.physical` | `blueprint_id` | Label as component resistance | Caution | Yes | Yes | Not proven shield absorption. |
| physical resistance | Yes generic | `baseStats.damageResistances.physical.multiplier` | `blueprint_id` | Numeric parse | Yes as generic resistance | Yes | Yes | Component damage resistance. |
| distortion resistance | Yes generic | `baseStats.damageResistances.distortion.multiplier` | `blueprint_id` | Numeric parse | Yes as generic resistance | Yes | Yes | Component damage resistance. |
| power usage | Yes | `baseStats.resources.consumption.Power` | `blueprint_id` | Numeric parse | Yes | Yes | Yes | Present in sampled shield. |
| coolant usage | Missing | None found | N/A | New extraction | No | No | No | Missing. |

### Ship Weapon

| Field | Available now? | Source path/property | Join key | Transform needed? | Safe for card display? | Safe for search? | Safe for sort? | Notes |
|---|---|---|---|---|---:|---:|---:|---|
| weapon type | Partial | `componentType = weaponGun`; `blueprintName`/`source_file` can imply cannon/repeater | `blueprint_id` | Needs approved parser if shown | Limited | Yes | Yes if extracted | Current safe type is "Ship Weapon". |
| damage type | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| DPS | Missing | None found | N/A | New extraction/calculation | No | No | No | Missing. |
| alpha damage | Modifier-only | `GPP_Weapon_Damage` | `blueprint_id` | Needs base damage | No as final stat | Yes modifier token | No | Modifier only. |
| fire rate | Missing for vehicle weapons | None found | N/A | New extraction | No | No | No | Unlike FPS weapons, sampled ship weapons only expose damage modifier. |
| range | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| ammo/capacitor behavior | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| heat | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| penetration | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| falloff | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| size/grade/class | Partial | `size`, `grade`, `class` | `blueprint_id` | Parse size/rank grade | Yes | Yes | Yes | `class` null for sampled weaponGun records. |

### Radar

| Field | Available now? | Source path/property | Join key | Transform needed? | Safe for card display? | Safe for search? | Safe for sort? | Notes |
|---|---|---|---|---|---:|---:|---:|---|
| detection range | Missing/unclear | None found as detection range | N/A | New extraction | No | No | No | Do not infer from aim assist modifier. |
| lock/track range | Modifier-only/unclear | `GPP_Radar_MinAimAssistDistance`, `GPP_Radar_MaxAimAssistDistance` | `blueprint_id` | Needs base value and semantics | No as final stat | Yes modifier token | No | Aim assist distance is not confirmed radar detection. |
| signature sensitivity | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| scanning behavior | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| power usage | Missing | No `resources` in sampled radar baseStats | N/A | New extraction | No | No | No | Missing in current base stats. |
| EM/IR behavior | Generic signatures only | `baseStats.emSignature`, `irSignature` | `blueprint_id` | Numeric parse | Yes as generic metadata | Yes | Yes | These are component signatures, not radar sensitivity. |
| mass/health/resistances | Yes generic | `baseStats` | `blueprint_id` | Numeric parse | Yes as generic metadata | Yes | Yes | Secondary only. |

### Tractor Beam

| Field | Available now? | Source path/property | Join key | Transform needed? | Safe for card display? | Safe for search? | Safe for sort? | Notes |
|---|---|---|---|---|---:|---:|---:|---|
| range | Modifier-only | `GPP_Weapon_Tractor_MaxDist`, `GPP_Weapon_Tractor_FullStrengthDist` | `blueprint_id` | Needs base distance | No as final stat | Yes modifier token | No | Modifier-only today. |
| force/strength | Modifier-only | `GPP_Weapon_Tractor_Force` | `blueprint_id` | Needs base force | No as final stat | Yes modifier token | No | Modifier-only today. |
| mass handling | Modifier-only/unclear | `GPP_Weapon_Tractor_MaxVolume` | `blueprint_id` | Needs base semantics | No as final stat | Yes modifier token | No | Max volume is not a final mass-handling value. |
| power usage | Missing | No resources in sampled tractor baseStats | N/A | New extraction | No | No | No | Missing. |
| cooldown/heat | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| mass/health/signatures | Yes generic | `baseStats.mass`, `health`, signatures | `blueprint_id` | Numeric parse | Yes as generic metadata | Yes | Yes | Secondary only. |

### FPS Weapon

| Field | Available now? | Source path/property | Join key | Transform needed? | Safe for card display? | Safe for search? | Safe for sort? | Notes |
|---|---|---|---|---|---:|---:|---:|---|
| weapon class | Yes | `weaponClass`; family files | `blueprint_id`, `familyKey` | Title-case for display | Yes | Yes | Yes | Values include lmg, pistol, rifle, shotgun, smg, sniper. |
| fire mode | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| fire rate | Modifier-only | `GPP_Weapon_FireRate` | `blueprint_id` | Needs base fire rate | No as final stat | Yes modifier token | No | Modifier-only. |
| DPS | Missing | None found | N/A | New extraction/calculation | No | No | No | Missing. |
| alpha damage | Modifier-only | `GPP_Weapon_Damage` | `blueprint_id` | Needs base damage | No as final stat | Yes modifier token | No | Modifier-only. |
| ammo capacity | Missing | None found | N/A | New extraction | No | No | No | Ammo card names may include capacity text, but no normalized field. |
| ammo speed | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| range/effective range | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| attachments | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| variants | Yes | `familyKey`, `familyDisplayName`, `variantName`; family files | `familyKey` | Count variants at generation | Yes | Yes | Yes | Good card/search field. |
| spread/accuracy | Modifier-only | recoil modifiers: `GPP_Weapon_Recoil_*` | `blueprint_id` | Needs base recoil/spread stats | No as final stat | Yes modifier token | No | Modifier-only. |
| falloff | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| heat/wear | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| penetration | Missing | None found | N/A | New extraction | No | No | No | Missing. |

### FPS Armor

| Field | Available now? | Source path/property | Join key | Transform needed? | Safe for card display? | Safe for search? | Safe for sort? | Notes |
|---|---|---|---|---|---:|---:|---:|---|
| armor slot | Yes | `armorSlot`; armor family files | `blueprint_id`, `familyKey` | Title-case for display | Yes | Yes | Yes | Values include arms, backpack, helmet, legs, torso, undersuit, unknown. |
| armor weight | Yes | `armorWeight`; armor family files | `blueprint_id`, `familyKey` | Title-case for display | Yes | Yes | Yes | Values include light, medium, heavy, unknown. |
| damage mitigation | Modifier-only | `GPP_Armor_DamageMitigation` | `blueprint_id` | Needs base mitigation | No as final stat | Yes modifier token | No | Modifier-only. |
| temperature protection | Modifier-only | `GPP_Armor_TemperatureMin`, `GPP_Armor_TemperatureMax` | `blueprint_id` | Needs base protection values | No as final stat | Yes modifier token | No | Modifier-only. |
| radiation protection | Modifier-only | `GPP_Armor_RadiationDissipation` | `blueprint_id` | Needs base value | No as final stat | Yes modifier token | No | Modifier-only, not on every armor sample. |
| storage/utility | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| family/variants | Yes | `armorFamily`, `familyKey`, `familyDisplayName`, `variantName`; family files | `familyKey` | Count variants at generation | Yes | Yes | Yes | Good card/search field. |

### FPS Ammo

| Field | Available now? | Source path/property | Join key | Transform needed? | Safe for card display? | Safe for search? | Safe for sort? | Notes |
|---|---|---|---|---|---:|---:|---:|---|
| ammo type | Partial | `ammoClass`; name/family often contains magazine/capacity | `blueprint_id` | Preserve `ammoClass`; do not parse name unless approved | Yes for `ammoClass` | Yes | Yes | Values sampled as `ballistic`; not enough for damage type. |
| compatible weapon class | Missing/partial | family/name can imply weapon family; no normalized weapon link | N/A | New extraction/join | No | Limited name search | No | Do not infer from display name as join key. |
| damage type | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| quantity/count | Partial display text only | `displayName` like `FS-9 Magazine (75 cap)`; no numeric field | `blueprint_id` | Need approved parser/extraction | No as normalized stat | Yes by name text | No | Do not invent `count` from name in index yet. |
| special effect | Missing | None found | N/A | New extraction | No | No | No | Missing. |
| compatible weapon/family links | Partial | `familyKey`, `familyDisplayName`, `variantName` for ammo family, not weapon link | `familyKey` | Preserve ammo family only | Yes as ammo family | Yes | Yes by family | Not a compatibility relation. |

## Data Shape Examples

These compact excerpts are direct local data samples with heavy nested resistance/modifier ranges removed.

```json
{
  "cooler": {
    "displayName": "Cryo-Star SL",
    "componentType": "cooler",
    "size": "0",
    "grade": "B",
    "class": "civilian",
    "manufacturerGuid": "6cf93625-789a-4e8f-a857-325d64a58c93",
    "blueprintGuid": "a1b5c9ef-be2e-4077-ba67-4a3028970c49",
    "entityClass": "7db13b34-c8b1-4e1a-9aba-3dcd7087e995",
    "craftTimeSeconds": 390,
    "baseStats": { "mass": 43, "health": 53, "resources": { "consumption": { "Power": 1 }, "generation": { "Coolant": 16 } }, "emSignature": 375, "irSignature": 2500, "distortionMaximum": 1400 },
    "materials": [
      { "slot": "SHELL", "materialName": "Torite", "costId": "75b37a54-45c9-4f27-ac09-9830f092dd86", "quantity": "0.05", "unitType": "scu", "minQuality": "1" },
      { "slot": "COOLANT", "materialName": "Pressurized Ice", "costId": "f9f3251a-8e48-408a-b957-f1e3d5d3e213", "quantity": "0.05", "unitType": "scu", "minQuality": "1" }
    ],
    "modifierProperties": ["GPP_Health_MaxHealth", "GPP_ItemResource_CoolantGeneration"],
    "rewardPools": [{ "poolGuid": "ed0b8aaa-eec6-4c72-b9e7-b0b48ab5e135", "displayName": "Nyx Headhunters Easy", "weight": 1 }]
  },
  "powerPlant": {
    "displayName": "Defiant",
    "componentType": "powerplant",
    "size": "0",
    "grade": "B",
    "class": "industrial",
    "manufacturerGuid": "d7cc897f-b760-4a73-93c0-27e23c52db0a",
    "blueprintGuid": "3aad9a44-5f8c-44d0-b3a4-80f55602fade",
    "entityClass": "ad59f651-83d0-42f3-839a-8f055243ba6b",
    "craftTimeSeconds": 570,
    "baseStats": { "mass": 93, "health": 98, "resources": {}, "emSignature": 5450, "irSignature": 0, "distortionMaximum": 2600 },
    "materials": [
      { "slot": "SHELL", "materialName": "Borase", "costId": "33bff393-42f1-4f70-85a1-71e695ed2a5a", "quantity": "0.1", "unitType": "scu", "minQuality": "1" },
      { "slot": "VOLTAGE REGULATOR", "materialName": "Laranite", "costId": "7f4599b0-a2b2-4178-8c7e-13292054ab20", "quantity": "0.04", "unitType": "scu", "minQuality": "1" }
    ],
    "modifierProperties": ["GPP_Health_MaxHealth", "GPP_ItemResource_PowerGeneration"]
  },
  "quantumDrive": {
    "displayName": "Atlas",
    "componentType": "quantumdrive",
    "size": "1",
    "grade": "A",
    "class": "civilian",
    "blueprintGuid": "17b29a33-88fe-484f-bb9b-fbf780273ff5",
    "entityClass": "934ac478-9c87-48d1-8fd3-e5359171983c",
    "craftTimeSeconds": 780,
    "baseStats": { "mass": 210, "health": 200, "resources": {}, "emSignature": 18000, "irSignature": 0, "distortionMaximum": 2950 },
    "materials": [
      { "slot": "CASE", "materialName": "Torite", "costId": "75b37a54-45c9-4f27-ac09-9830f092dd86", "quantity": "0.35", "unitType": "scu", "minQuality": "1" },
      { "slot": "INJECTOR NOZZLES", "materialName": "Tungsten", "costId": "60f116f4-c02a-45b2-9ded-333747795124", "quantity": "0.14", "unitType": "scu", "minQuality": "1" }
    ],
    "modifierProperties": ["GPP_Health_MaxHealth", "GPP_Quantum_Speed", "GPP_Quantum_FuelRequirement"]
  },
  "shield": {
    "displayName": "Castra",
    "componentType": "shield",
    "size": "0",
    "grade": "C",
    "class": "industrial",
    "blueprintGuid": "5a827179-6c2a-4151-87ed-bcf1059ac4fb",
    "entityClass": "e11f94ed-6a41-4960-b895-4a604ec98e97",
    "craftTimeSeconds": 420,
    "baseStats": { "mass": 65, "health": 65, "resources": { "consumption": { "Power": 2 }, "generation": { "Shield": 228 } }, "emSignature": 990, "irSignature": 0, "distortionMaximum": 1750 },
    "materials": [
      { "slot": "SHELL", "materialName": "Tungsten", "costId": "60f116f4-c02a-45b2-9ded-333747795124", "quantity": "0.05", "unitType": "scu", "minQuality": "1" },
      { "slot": "FIELD ARRAY", "materialName": "Laranite", "costId": "7f4599b0-a2b2-4178-8c7e-13292054ab20", "quantity": "0.08", "unitType": "scu", "minQuality": "1" }
    ],
    "modifierProperties": ["GPP_Health_MaxHealth", "GPP_Shield_MaxHealth"]
  },
  "shipWeapon": {
    "displayName": "9-Series Longsword Cannon",
    "componentType": "weaponGun",
    "size": "1",
    "grade": "A",
    "class": null,
    "blueprintGuid": "ad0494d5-ca83-4f6a-a4c0-f29b7b221a20",
    "entityClass": "85fd75f8-6c6c-4d3f-839f-988ae7660617",
    "craftTimeSeconds": 540,
    "baseStats": { "mass": 76.8, "health": 850, "resources": {}, "emSignature": 37.5, "irSignature": 0, "distortionMaximum": 500000 },
    "materials": [
      { "slot": "FRAME", "materialName": "Iron", "costId": "f386a33c-ac9a-400a-a7b8-fe1fc7c8d270", "quantity": "0.36", "unitType": "scu", "minQuality": "1" },
      { "slot": "CYCLER", "materialName": "Riccite", "costId": "86d00bd8-08f7-4231-b375-a609803fc46d", "quantity": "0.05", "unitType": "scu", "minQuality": "1" }
    ],
    "modifierProperties": ["GPP_Health_MaxHealth", "GPP_Weapon_Damage"]
  },
  "fpsWeapon": {
    "displayName": "FS-9 LMG",
    "fpsCategory": "weapons",
    "weaponClass": "lmg",
    "familyKey": "fps_weapon:lmg:fs-9-lmg",
    "familyDisplayName": "FS-9 LMG",
    "variantName": "Default",
    "blueprintGuid": "b627e348-29b5-44c8-a836-258df60bcd08",
    "entityClass": "6f1674b1-fb58-4661-9114-f418862751d2",
    "craftTimeSeconds": 240,
    "materials": [
      { "slot": "FRAME", "materialName": "Lindinium", "costId": "392b4dca-449a-4d4d-8fef-beab024d9ee7", "quantity": "0.06", "unitType": "scu", "minQuality": "0" },
      { "slot": "BARREL", "materialName": "Iron", "costId": "f386a33c-ac9a-400a-a7b8-fe1fc7c8d270", "quantity": "0.03", "unitType": "scu", "minQuality": "0" }
    ],
    "modifierProperties": ["GPP_Weapon_Recoil_Smoothness", "GPP_Weapon_Recoil_Handling", "GPP_Weapon_Recoil_Kick", "GPP_Weapon_Damage", "GPP_Weapon_FireRate"],
    "sourceRelativePath": "weapons/lmg/bp_craft_behr_lmg_ballistic_01.xml"
  },
  "fpsArmor": {
    "displayName": "ADP-mk4 Arms Woodland",
    "fpsCategory": "armor",
    "armorSlot": "arms",
    "armorWeight": "heavy",
    "familyKey": "fps_armor:heavy-arms:adp-mk4-arms",
    "familyDisplayName": "ADP-mk4 Arms",
    "variantName": "Woodland",
    "blueprintGuid": "005d95db-96ca-45b7-9647-7e7537b8fac8",
    "entityClass": "bef9cd69-24f0-434a-ba7a-2bf751228093",
    "craftTimeSeconds": 240,
    "materials": [
      { "slot": "ARMOURED CARAPACE", "materialName": "Ouratite", "costId": "989f9b73-f636-4f35-a81d-579dcbe3f0ab", "quantity": "0.06", "unitType": "scu", "minQuality": "0" },
      { "slot": "INSULATIVE LINER", "materialName": "Insulative Liner Material", "costId": "fde0cd65-8827-4b23-804d-cc8845dfa7ac", "quantity": "0.02", "unitType": "scu", "minQuality": "0" }
    ],
    "modifierProperties": ["GPP_Armor_DamageMitigation", "GPP_Armor_TemperatureMin", "GPP_Armor_TemperatureMax"],
    "sourceRelativePath": "armour/combat/heavy/bp_craft_cds_armor_heavy_arms_01_01_01.xml"
  },
  "fpsAmmo": {
    "displayName": "FS-9 Magazine (75 cap)",
    "fpsCategory": "ammo",
    "ammoClass": "ballistic",
    "familyKey": "fps_ammo:ammo:fs-9-magazine",
    "familyDisplayName": "FS-9 Magazine",
    "variantName": "75 Cap",
    "blueprintGuid": "017bb372-2fe2-4615-8bcb-e18020baaa4f",
    "entityClass": "b5f37920-ba9a-4a07-85e9-4d09f8e2f5ad",
    "craftTimeSeconds": 10,
    "materials": [
      { "slot": "MAGAZINE", "materialName": "Hephaestanite", "costId": "61189578-ed7a-4491-9774-37ae2f82b8b0", "quantity": "0.03", "unitType": "scu", "minQuality": "0" },
      { "slot": "CORE", "materialName": "Iron", "costId": "f386a33c-ac9a-400a-a7b8-fe1fc7c8d270", "quantity": "0.03", "unitType": "scu", "minQuality": "0" }
    ],
    "modifierProperties": [],
    "sourceRelativePath": "ammo/ballistic/bp_craft_behr_lmg_ballistic_01_mag.xml"
  }
}
```

## Search/Index Design Recommendation

Recommended approach: **hybrid shared base index + optional type-specific compact stats in the same generated card index, with detail data kept separate.**

This is effectively option C:

- Generate one compact `component_card_index.json` for all cards.
- Include shared identity, display, search text/tokens, facets, stable sort keys, compact materials, source summaries, and only safe category-specific stat fields.
- Keep heavy raw records, full `baseStats`, full modifier ranges, mission details, and detail-page data out of the card index.
- Add category-specific stat objects incrementally as extraction produces real base values.

Why not one raw client-built index: current raw JSON is heavy. `fps_blueprints.json` is about 16 MB, armor subset about 12 MB, family files are also large, and vehicle blueprints are about 3.8 MB. Building all browser search structures from these files on every client load repeats work, over-fetches nested modifiers/material details, and makes future growth more expensive.

Why not separate per-category indexes only: category-specific indexes can be useful later for lazy loading deep stat panels, but the browser needs cross-category search, saved/queued joins, material facets, and a unified result count. A single compact browser index keeps initial filtering simple and fast for the current 1,553 records.

Recommended files:

- `public/api/crafting/component_card_index.json`: compact all-card browser index.
- Optional later: `public/api/crafting/component_stat_index.<category>.json` or nested detail payloads only after category-specific extraction exists.
- Existing raw files remain the source for detail pages until a detail-specific index is approved.

## Proposed Normalized Card Index Shape

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-05-25T00:00:00.000Z",
  "records": [
    {
      "id": "blueprintGuid",
      "name": "Display Name",
      "kind": "vehicle",
      "category": "vehicle",
      "type": "cooler",
      "typeLabel": "Cooler",
      "size": 0,
      "grade": "B",
      "class": "civilian",
      "manufacturerGuid": "6cf93625-789a-4e8f-a857-325d64a58c93",
      "manufacturer": null,
      "family": null,
      "familyKey": null,
      "variants": [],
      "variantName": null,
      "entityClass": "7db13b34-c8b1-4e1a-9aba-3dcd7087e995",
      "craftTimeSeconds": 390,
      "materials": [
        {
          "slot": "COOLANT",
          "name": "Pressurized Ice",
          "quantity": 0.05,
          "unit": "scu",
          "materialId": "f9f3251a-8e48-408a-b957-f1e3d5d3e213",
          "materialKey": "pressurizedice",
          "minQuality": 1
        }
      ],
      "searchText": "cryo-star sl cooler vehicle b civilian torite pressurized ice iron a1b5c9ef...",
      "searchTokens": ["cryo", "star", "sl", "cooler", "vehicle", "torite"],
      "facets": {
        "kind": "vehicle",
        "category": "vehicle",
        "type": "cooler",
        "size": "0",
        "grade": "B",
        "class": "civilian",
        "materials": ["75b37a54-45c9-4f27-ac09-9830f092dd86", "f9f3251a-8e48-408a-b957-f1e3d5d3e213"],
        "materialNames": ["torite", "pressurized ice"],
        "weaponClass": null,
        "armorSlot": null,
        "armorWeight": null,
        "ammoClass": null,
        "sourcePools": ["ed0b8aaa-eec6-4c72-b9e7-b0b48ab5e135"]
      },
      "sort": {
        "name": "cryo-star sl",
        "type": "cooler",
        "craftTimeSeconds": 390,
        "size": 0,
        "gradeRank": 2,
        "materialCount": 3,
        "sourceCount": 1,
        "coolantGeneration": 16,
        "powerDraw": 1
      },
      "card": {
        "primary": [
          { "label": "Size", "value": "S0" },
          { "label": "Grade", "value": "B" },
          { "label": "Class", "value": "Civilian" },
          { "label": "Craft", "value": "6m 30s" }
        ],
        "secondary": [
          { "label": "Coolant generation", "value": "16", "field": "baseStats.resources.generation.Coolant", "confidence": "caution" },
          { "label": "Power draw", "value": "1", "field": "baseStats.resources.consumption.Power", "confidence": "safe" }
        ],
        "materialsPreview": [
          { "name": "Torite", "quantity": 0.05, "unit": "scu" },
          { "name": "Pressurized Ice", "quantity": 0.05, "unit": "scu" }
        ],
        "badges": []
      },
      "stats": {
        "generic": {
          "mass": 43,
          "health": 53,
          "emSignature": 375,
          "irSignature": 2500,
          "distortionMaximum": 1400
        },
        "cooler": {
          "coolantGeneration": 16,
          "powerDraw": 1
        },
        "powerPlant": null,
        "quantumDrive": null,
        "shield": null,
        "shipWeapon": null,
        "radar": null,
        "tractorBeam": null,
        "fpsWeapon": null,
        "fpsArmor": null,
        "fpsAmmo": null
      },
      "source": {
        "files": ["public/api/crafting/blueprints.json"],
        "fields": [
          "blueprintGuid",
          "displayName",
          "componentType",
          "size",
          "grade",
          "class",
          "craftTimeSeconds",
          "materials",
          "baseStats.resources"
        ],
        "warnings": ["manufacturerGuid has no display-name lookup"]
      }
    }
  ],
  "facets": {
    "types": [],
    "materials": [],
    "grades": [],
    "classes": [],
    "weaponClasses": [],
    "armorSlots": [],
    "armorWeights": []
  }
}
```

Shape notes:

- Keep `id` equal to `blueprintGuid`. Do not use display name, slug, or entity class as primary id.
- Keep source/debug metadata in each record small. Full raw objects belong in detail data.
- Include `manufacturerGuid` for future joins, but keep display `manufacturer` null until a real display lookup exists.
- Preserve `unit` and `minQuality` from raw materials because current `ComponentMaterial` drops them.
- Use `stats.generic` for generic mass/health/signature/resistance values. Do not mix them into category-specific stats unless semantics are proven.
- Include category stat keys as nullable objects so future extraction can add fields without changing consumer shape.
- Keep `card` values as generated display candidates, not CSS or UI selectors.

## Search, Filter, And Sort Architecture

Recommended client pipeline:

1. Load the compact static index once.
2. Build runtime Sets for saved and queued ids:
   - `savedBlueprintIds = new Set(savedBlueprints.map(x => x.blueprintId))`
   - `queuedRecipeIds = new Set(buildQueue.map(x => x.recipeId))`
   - queued lookup key: `craft-${record.id}`
3. Apply high-selectivity exact filters first: kind/category/type, saved/queued, size/grade/class, weapon class, armor slot/weight, materials.
4. Apply text search after category/facet pruning.
5. Sort by precomputed stable sort keys.
6. Paginate visible results. Virtualization is optional; current result count does not require it if pagination remains.

Performance details:

- Precompute lowercase `searchText` at generation time.
- Precompute `searchTokens` only if token-level matching or fuzzy scoring needs it. For simple "all tokens included", `searchText.includes(token)` is enough.
- Normalize the user's query once per keystroke, not once per record.
- Debounce search input modestly if typing becomes visibly expensive. With ~1,553 records and compact strings, this is likely optional.
- Store record material ids and material names as arrays. For material filters, use Set intersection:
  - OR semantics: record matches if any selected material id/name is present.
  - AND semantics later: every selected material must be present.
- Prefer exact facet Sets over repeated string normalization.
- Keep grade sorting numeric with a fixed rank map, for example `S=0`, `A=1`, `B=2`, `C=3`, `D=4`, unknown last. Confirm rank direction before implementing UI sort.
- Category-first filtering is important if future stat indexes grow; only evaluate category stat sort keys for records with that stat object.
- Avoid giant derived arrays inside render. Use `useMemo` keyed by the compact index and filter state.
- Fuse.js is not installed and is not justified for the current need unless fuzzy typo tolerance becomes a product requirement. Simple lowercase token inclusion is enough for names/materials/types/GUIDs today.
- A web worker is not needed for ~1,500 compact records. Revisit if the index grows into tens of thousands of records, if fuzzy scoring is introduced, or if raw stat blocks are accidentally pulled into the browser payload.
- Keep detail-page data separate so card search does not fetch full mission lists, full material modifier ranges, or raw base stat blobs.

## Index Generation Strategy

Preferred strategy: generate a compact static index JSON from existing crafting data.

Best target:

- `public/api/crafting/component_card_index.json`

Best timing:

- Generate at extraction time or as a post-extraction script that reads the current generated JSON files.

Reasoning:

- Browser cards should not recompute normalization, facet sets, family variant counts, material previews, source summaries, and safe stat extraction on every load.
- Static generation allows validation warnings for missing/unsafe fields to be emitted once.
- The app can continue loading raw detail data separately for detail pages.
- Build-time generation is acceptable if extraction is not always run locally, but it makes the Vite build depend on heavier data processing.
- Client-side generation from existing blueprint JSON is the least desirable: it over-fetches large raw files and repeats expensive derivation work in the browser.

Suggested generation inputs:

- Required: `public/api/crafting/blueprints.json`
- Required: `public/api/crafting/fps/fps_blueprints.json`
- Optional: `public/api/crafting/fps/fps_variant_families.json` or weapon/armor family files for generated variant counts
- Optional validation: `public/api/crafting/material_identity_index.json`
- Optional labels/debug: `public/api/crafting/crafted_properties.json`
- Optional source validation: `public/api/crafting/blueprint_rewards.json`

Do not pull mission detail files into the card index initially. Vehicle `rewardPools` already carry compact source labels and GUIDs; mission files should remain detail/source-panel data.

## Join Key Strategy

Safe keys:

- `blueprint_id` / raw `blueprintGuid`: safest primary recipe/card/detail/saved key.
- `craft-${blueprint_id}`: safest queue recipe id for runtime queue joins.
- `SavedBlueprint.blueprintId`: saved/bookmark join to `blueprint_id`.
- `rewardPools[].poolGuid`: safest reward pool/source join key.
- `blueprint_reward_sources[].blueprintGuid`: mission source join key if detail/source data is needed.
- `output_entityClass` / raw `entityClass`: useful output identity and debug/search token; safe secondary join only when explicitly joining output item data.
- material `costId`: safest material facet/inventory/material identity join key.
- material `materialKey`: useful fallback/debug key, not primary if GUID exists.
- FPS `familyKey`: safest family/variant grouping key.
- FPS `blueprintGuid` inside family variants, if present: safest variant-to-card key.

Unsafe or limited keys:

- Display name / component name: safe for display and search, unsafe as primary join. Names can collide or change.
- Slug: missing locally; unsafe until explicitly generated and versioned.
- `blueprintName` / `blueprintPath` / `recordPath`: useful provenance/debug, but not user-facing primary joins.
- `entityClass` as primary recipe key: one output identity does not replace the blueprint recipe GUID.
- `manufacturerGuid` as display manufacturer: safe as GUID token/debug only; no local display-name mapping was confirmed.
- FPS ammo display name as compatibility key: unsafe. Example names imply weapon family/capacity, but no normalized compatible weapon link exists.

## Risks And Gaps

- Base performance stats are missing for most ideal card fields: DPS, alpha damage, fire rate, range, ammo behavior, shield regen, quantum travel time, calibration, armor mitigation, radar detection, tractor force/range, and power plant output.
- Many fields are modifier-only. A modifier property is safe to label as "can be modified by material quality", but not safe to display as a final stat without a base value.
- Generic `baseStats` can be displayed only when labeled as generic component metadata or conservative resource readouts. Do not present generic component health as shield HP or combat durability without extraction proof.
- Manufacturer display names are missing. Vehicle records have `manufacturerGuid`, but no confirmed local manufacturer name lookup in the inspected crafting sources.
- Slugs are missing.
- FPS ammo has no normalized compatible weapon/family link beyond ammo family display/name fields.
- FPS armor and weapon combat/protection stats are not present as base values.
- Radar and tractor beam category-specific fields exist only as modifier names or are missing.
- Mission source files are older than current crafting data. Prefer current `rewardPools` snapshots for card/source labels, and keep mission joins optional/detail-only.
- `dist/api` is stale relative to `public/api` and should not feed the new index.
- Current normalized `ComponentMaterial` drops raw `unitType` and `minQuality`; the generated card index should preserve these from raw data.
- The current browser search does not include material names despite its placeholder saying "material". A future index can support this, but this task does not change filtering behavior.

## Recommended Next Steps

Choose **C. Build shared index now and add category-specific stats incrementally.**

1. Add a generator for `public/api/crafting/component_card_index.json` using the current safe fields from vehicle and FPS blueprint JSON.
2. Preserve raw detail files for `/industry/crafting/:blueprintId`.
3. Include only conservative category-specific stats now:
   - Cooler: `coolantGeneration`, `powerDraw`, plus generic metadata.
   - Shield: `shieldResourceGeneration` and `powerDraw` only with cautious labels, plus generic metadata.
   - FPS weapon: `weaponClass`, family, variant count.
   - FPS armor: `armorSlot`, `armorWeight`, family, variant count.
   - FPS ammo: `ammoClass`, ammo family, variant.
   - Other vehicle categories: identity/crafting/materials/generic metadata, modifier labels only if clearly marked.
4. Add extraction work category by category for true performance stat blocks. Start with one high-value category, validate semantics, then attach the extracted fields into the nullable `stats.<category>` object.
5. After the index exists and is validated, update browser loading/search to consume it in a separate approved implementation task.
