# Component Card Data Audit

Date audited: 2026-05-24

> Historical source inventory. The current browser is backed by the generated/shaped component-card index and the current detail flow also uses shared fitting/component-card delivery. See `docs/crafting-browser-detail-handoff.md` for the active implementation map.

Scope: craftable component/item data currently available in repo data sources used by the Crafting Recipe / Recipe Browser flow. No UI implementation was done.

## 1. Data source inventory

| Source | Contains | Appears current? | Used today |
|---|---|---:|---|
| `public/api/crafting/blueprints.json` | 471 vehicle/component crafting blueprints: identity, `componentType`, size, grade/class, `craftTimeSeconds`, `baseStats`, materials, quality modifiers, reward pools. | Yes; timestamp 2026-05-24, newer than `dist`. | Loaded by `src/lib/craftingData.ts` via `/api/crafting/blueprints.json`, normalized into `ComponentRecipe`. |
| `public/api/crafting/fps/fps_blueprints.json` | 1,082 FPS blueprints: armor, weapons, ammo. Includes identity, family/variant fields, `weaponClass` or armor slot/weight, materials, quality modifiers. | Yes; timestamp 2026-05-24. | Loaded by `src/lib/craftingData.ts` via `/api/crafting/fps/fps_blueprints.json`, normalized into `ComponentRecipe`. |
| `public/api/crafting/fps/weapons.json` | 164 FPS weapon blueprint records, same shape as weapon subset of `fps_blueprints.json`. | Yes; timestamp 2026-05-24. | Not loaded by current crafting detail page directly. Potential future source if browser wants FPS-only payloads. |
| `public/api/crafting/fps/armor.json` | 882 FPS armor blueprint records, same shape as armor subset of `fps_blueprints.json`. | Yes; timestamp 2026-05-24. | Not loaded directly today. |
| `public/api/crafting/fps/ammo.json` | 36 FPS ammo blueprint records. | Yes; timestamp 2026-05-24. | Not loaded directly today. |
| `public/api/crafting/fps/weapon_families.json` | 161 FPS weapon families: `familyKey`, `displayName`, `variantCount`, `variants`, `weaponClass`. | Yes; timestamp 2026-05-24. | Not used by current crafting page; current page derives variants in UI. |
| `public/api/crafting/fps/armor_families.json` | 596 FPS armor families: family identity, slot, weight, variants. | Yes; timestamp 2026-05-24. | Not used by current crafting page. |
| `public/api/crafting/fps/fps_variant_families.json` | 757 combined FPS variant family records. | Yes; timestamp 2026-05-24. | Not used by current crafting page. |
| `public/api/crafting/crafted_properties.json` | 29 gameplay property id/name/path mappings. | Yes; timestamp 2026-05-24. | Exposed by `getCraftedProperties()`, useful for quality modifier labels. |
| `public/api/crafting/quality_quantization.json` | 38 material quality band records by material `guid` / `materialKey`. | Yes; timestamp 2026-05-24. | Loaded by current crafting quality logic. |
| `public/api/crafting/material_quality_quantization*.json` | Older/auxiliary material quality band/debug/report data. | Older; timestamp 2026-05-15. | Not the main loader in `src/lib/craftingData.ts`; may support existing quality utilities. |
| `public/api/crafting/material_identity_index.json` | Material identity map and GUID lookup. | Yes; timestamp 2026-05-24. | Source of material names in generated blueprint materials; also related to material resolver flow. |
| `public/api/crafting/blueprint_rewards.json` | 116 reward pools with `poolGuid`, `poolName`, `sourceFolder`, `displayName`, and rewards. | Yes; timestamp 2026-05-24. | Historical helper. Current builder queue prefers `recipe.rewardPools` snapshots. |
| `public/api/missions/blueprint_reward_sources.json` | 654 blueprint reward source records keyed by `blueprintGuid`, with missions. | Older; timestamp 2026-05-15. | Used by `BlueprintSourcesPanel` inside `ComponentRecipeTable.tsx` for mission/source details. Join key: `blueprintGuid` / normalized `recipe.blueprint_id`. |
| `public/api/missions/mission_blueprint_rewards.json` | 685 mission records with blueprint rewards and mission metadata. | Older; timestamp 2026-05-15. | Used by blueprint tracker/source helpers, not card source of truth. |
| `public/api/missions/mission_reward_lookups.json` | Mission lookup maps: blueprint pools, factions, standings, mission types. | Older; timestamp 2026-05-15. | Used by blueprint tracker/source helpers. |
| `dist/api/crafting/**` | Built copy of API JSON. | Older; timestamps mostly 2026-05-15. | Build artifact; not the source for new implementation. |
| `scripts/reports/crafting/**` | Extraction/audit reports from 2026-05-06. | Older. | Audit-only; not loaded by current app. |
| `src/lib/craftingData.ts` | Current normalization layer. | Current code path. | Produces `ComponentRecipe[]` from vehicle + FPS blueprint JSON. |
| `src/components/industry/crafting/components/ComponentRecipeTable.tsx` | Current recipe browser/detail UI: filters, grouping, variants, source panel, quality detail. | Current code path. | Uses normalized `ComponentRecipe`, saved blueprint state, queued state. |
| `src/stores/logisticsStore.ts` | Build queue state and queue snapshots. | Current code path. | Queued state is runtime/user state, keyed by `recipeId = craft-${blueprint_id}`. |
| `src/lib/userSavedBlueprints.ts` | Saved/bookmarked blueprint API client. | Current code path. | Saved state keyed by `blueprintId`. |

Safest join key for crafting items: `blueprintGuid` in raw data, normalized as `ComponentRecipe.blueprint_id`. It joins vehicle blueprints, mission reward sources, saved blueprints, and queue recipe ids after applying `craft-${blueprint_id}`. `entityClass` is useful output identity but is not as consistently used for source joins. Display names and slugs are not safe join keys.

## 2. Current item shape

Current normalized shape is `ComponentRecipe` in `src/components/industry/crafting/utils/craftingTypes.ts`:

```ts
{
  blueprint_id: string;
  component_type: string;
  component_name: string;
  size: string;
  craft_time_seconds: number;
  output_entityClass: string;
  baseStats?: Record<string, unknown>;
  materials: ComponentMaterial[];
  item_kind?: "vehicle" | "fps";
  internal_name?: string | null;
  fallback_name?: string | null;
  category?: string | null;
  grade?: string | null;
  class?: string | null;
  manufacturer?: string | null;
  source_file?: string | null;
  wiki_type?: string | null;
  qualityModifiers?: QualityModifier[];
  overallQualityModifiers?: QualityModifier[];
  rewardPools?: unknown[];
}
```

Compact real examples from current repo data:

```json
{
  "blueprint_id": "5a827179-6c2a-4151-87ed-bcf1059ac4fb",
  "component_type": "shield",
  "component_name": "Castra",
  "size": "0",
  "craft_time_seconds": 420,
  "output_entityClass": "e11f94ed-6a41-4960-b895-4a604ec98e97",
  "baseStats": {
    "mass": 65,
    "health": 65,
    "resources": { "consumption": { "Power": 2 }, "generation": { "Shield": 228 } }
  },
  "materials": [
    { "slot": "SHELL", "material_name": "Tungsten", "cost_id": "60f116f4-c02a-45b2-9ded-333747795124", "quantity": 0.05 },
    { "slot": "FIELD ARRAY", "material_name": "Laranite", "cost_id": "7f4599b0-a2b2-4178-8c7e-13292054ab20", "quantity": 0.08 }
  ],
  "grade": "C",
  "class": "industrial",
  "item_kind": "vehicle"
}
```

```json
{
  "blueprint_id": "17b29a33-88fe-484f-bb9b-fbf780273ff5",
  "component_type": "quantumdrive",
  "component_name": "Atlas",
  "size": "1",
  "craft_time_seconds": 780,
  "output_entityClass": "934ac478-9c87-48d1-8fd3-e5359171983c",
  "baseStats": {
    "mass": 210,
    "health": 200,
    "emSignature": { "nominalSignature": 18000, "decayRate": 0.15 }
  },
  "qualityModifiers": [
    { "slot": "INJECTOR NOZZLES", "gameplay_property": "GPP_Quantum_Speed", "modifier_mode": "multiplier" },
    { "slot": "CONTAINMENT MATRIX", "gameplay_property": "GPP_Quantum_FuelRequirement", "modifier_mode": "multiplier" }
  ],
  "grade": "A",
  "class": "civilian",
  "item_kind": "vehicle"
}
```

```json
{
  "blueprint_id": "b627e348-29b5-44c8-a836-258df60bcd08",
  "component_type": "weapons",
  "component_name": "FS-9 LMG",
  "size": "",
  "craft_time_seconds": 240,
  "output_entityClass": "6f1674b1-fb58-4661-9114-f418862751d2",
  "category": "weapons",
  "wiki_type": "weapons",
  "source_file": "weapons/lmg/bp_craft_behr_lmg_ballistic_01.xml",
  "qualityModifiers": [
    { "slot": "FRAME", "gameplay_property": "GPP_Weapon_Recoil_Smoothness", "modifier_mode": "multiplier" },
    { "slot": "BARREL", "gameplay_property": "GPP_Weapon_Damage", "modifier_mode": "multiplier" }
  ],
  "item_kind": "fps"
}
```

## 3. Categorization today

Vehicle categories come from raw `componentType`, normalized to `ComponentRecipe.component_type`.

| Planned category | Current match | Count |
|---|---|---:|
| shield | `componentType === "shield"` | 62 |
| quantum drive | `componentType === "quantumdrive"` | 57 |
| power plant | `componentType === "powerplant"` | 75 |
| cooler | `componentType === "cooler"` | 75 |
| ship weapon | `componentType === "weaponGun"` | 93 |
| FPS weapon | `fpsCategory === "weapons"` / normalized `component_type === "weapons"` | 164 |
| armor | `fpsCategory === "armor"` / normalized `component_type === "armor"` | 882 |
| other | vehicle `radar`, `weaponMining`, `dockingCollar`, `tractorbeam`, `salvageModifier`, `salvageHead`, plus FPS `ammo` | 145 total |

Current UI also derives labels from `ComponentRecipeTable.tsx`: FPS chips use `component_type`; vehicle chips use non-FPS `component_type`; weapon subtype for `weaponGun` is inferred from `source_file` or `internal_name`.

## 4. Field availability matrix

### Shared identity and crafting

| Field | Available now? | Source path/property | Transform needed? | Safe for card display? | Notes |
|---|---|---|---|---:|---|
| id | Partial | FPS raw `id`; vehicle has no raw `id` beyond `blueprintGuid` | Use `blueprintGuid` as id | Yes | Prefer normalized `blueprint_id`. |
| slug | No | Missing | New extraction/derivation | No | Can derive later from name/id, but does not exist today. |
| uuid/guid | Yes | `blueprintGuid`, `entityClass`, materials `costId` | Normalize to `blueprint_id`, `output_entityClass` | Yes | `blueprintGuid` is safest join key. |
| className | Partial | raw `blueprintName`, `entityClass`; no explicit `className` | Could label `blueprintName` as internal record name | Limited | Do not imply game class name unless extractor adds it. |
| name/displayName | Yes | raw `displayName`; normalized `component_name` | Existing transform | Yes | Current UI uses this. |
| manufacturer | No | raw vehicle interface allows it, but audited categories had 0 populated; FPS absent | New extraction | No | Not safe. |
| itemType | Partial | FPS family `itemType`; vehicle absent | Join family records for FPS | FPS only | Not in normalized `ComponentRecipe`. |
| componentType | Yes | raw `componentType`; normalized `component_type` | Existing transform | Yes | Main vehicle category key. |
| category | Partial | FPS raw `fpsCategory`; vehicle raw `category` missing for all 471 | Existing transform sets category from component type for vehicle | Yes as broad grouping | Vehicle `category` duplicates component type after normalization. |
| size | Vehicle yes, FPS no | raw/normalized `size` | Existing transform | Vehicle yes | FPS normalized to empty string. |
| grade | Vehicle yes, FPS no | raw/normalized `grade` | Existing transform | Vehicle yes | Vehicle categories have A-D for core components; ship weapons audited as A only. |
| class/componentClass | Vehicle partial, FPS class only for weapons via `weaponClass` | raw/normalized `class`; FPS raw `weaponClass`, armor `armorWeight`/`armorSlot` | Existing + optional FPS family/raw join | Yes where present | Vehicle ship weapons had no `class`. |
| rarity/band | Runtime only | final product quality computed from selected material bands | Needs selected quality state | Only after quality selection | No static recipe rarity. |
| craftable | Implicit yes | Presence in blueprint JSON | Derive boolean | Yes | All records in audited recipe sources are craftable. |
| queued state | Runtime/user yes | `logisticsStore.buildQueue`, `recipeId = craft-${blueprint_id}` | Join to store | Yes | Not static data. |
| saved state | Runtime/user yes | `fetchSavedBlueprints()`, `SavedBlueprint.blueprintId` | Join to auth/local state | Yes | Current page also mirrors local bookmark set. |
| variants/family | Partial | Current UI derives; FPS has `familyKey`, `familyDisplayName`, family JSON | Prefer FPS family data; vehicle UI derivation only | Yes with caveats | Vehicle variant family is heuristic, not generated metadata. |
| craftTime | Yes | `craftTimeSeconds`, normalized `craft_time_seconds` | Existing transform | Yes | Seconds. |
| blueprint ingredients | Yes | raw `materials` / `materialRequirements`; normalized `materials` | Existing transform | Yes | Slot, material, quantity, cost id. |
| required material names | Yes | material `materialName` | Existing transform | Yes | From material identity index. |
| required quantities | Yes | material `quantity`, `unitType` raw | Normalized loses unit type | Yes | Card can show quantity; unit requires raw join for FPS/vehicle if needed. |
| required material quality/band | Partial | material `minQuality`; selected quality state; `quality_quantization.json` | Runtime quality join | Limited | Current detail uses selected quality flow, not static card field. |
| unlock missions/source | Partial | `rewardPools`; `blueprint_reward_sources.json`; mission JSON | Join by `blueprintGuid` / `poolGuid` | Limited | Existing guidance: blueprint source labels, not mission tracker state. |

### Shield

| Field | Available now? | Source path/property | Transform needed? | Safe for card display? | Notes |
|---|---|---|---|---:|---|
| maxHealth | Partial | `baseStats.resources.generation.Shield`; modifiers `GPP_Shield_MaxHealth` | Needs semantic confirmation | Caution | No explicit `maxHealth` field. `baseStats.health` is item health, not shield HP. |
| regenRate | No | Missing | New extraction | No | Not present. |
| regenTime | No | Missing | New extraction | No | Not present. |
| reservePoolRegenRate | No | Missing | New extraction | No | Not present. |
| reservePoolRegenTime | No | Missing | New extraction | No | Not present. |
| downedRegenDelay | No | Missing | New extraction | No | Not present. |
| damageRegenDelay | No | Missing | New extraction | No | Not present. |
| physicalAbsorption | Partial | `baseStats.damageResistances.physical.multiplier` | Convert multiplier to readable resistance/absorption | Caution | Existing field is generic item damage resistance. |
| physicalResistance | Yes | `baseStats.damageResistances.physical.*` | Label/format | Yes, if labeled as resistance multiplier | Not shield-face resistance. |
| distortionResistance | Yes | `baseStats.damageResistances.distortion.*` | Label/format | Yes | Generic component resistance. |
| power usage | Yes | `baseStats.resources.consumption.Power` | Label/format | Yes | Present on shields. |
| coolant usage | No | Missing | New extraction | No | Not present on shield baseStats. |

### Quantum drive

| Field | Available now? | Source path/property | Transform needed? | Safe for card display? | Notes |
|---|---|---|---|---:|---|
| fuelEfficiency | Partial | modifier `GPP_Quantum_FuelRequirement` | Needs base stat extraction | No | Modifier exists; base fuel consumption/efficiency missing. |
| travelTime10GM | No | Missing | New extraction/calculation | No | No drive speed base stat available. |
| normalJump.driveSpeed | Partial | modifier `GPP_Quantum_Speed` | Needs base speed extraction | No | Modifier exists only. |
| normalJump.spoolUpTime | No | Missing | New extraction | No | Not present. |
| normalJump.cooldownTime | No | Missing | New extraction | No | Not present. |
| calibration requirement min/max | No | Missing | New extraction | No | Not present. |
| calibration angle min/max | No | Missing | New extraction | No | Not present. |
| splineJump stats | No | Missing | New extraction | No | Not present. |
| power usage | No | Missing | New extraction | No | `quantumdrive` baseStats lacks `resources`. |
| coolant usage | No | Missing | New extraction | No | Not present. |
| quantum fuel consumption | Partial | modifier `GPP_Quantum_FuelRequirement` | Needs base stat extraction | No | Only quality delta is present. |

### FPS weapon

| Field | Available now? | Source path/property | Transform needed? | Safe for card display? | Notes |
|---|---|---|---|---:|---|
| weapon class | Yes | raw `weaponClass`; family `weaponClass` | Use raw/family join | Yes | Values include `lmg`, `pistol`, `rifle`, `shotgun`, `smg`, `sniper`. |
| range | No | Missing | New extraction | No | Not present. |
| fireMode | No | Missing | New extraction | No | Not present. |
| fireRate | Partial | modifier `GPP_Weapon_FireRate` | Needs base stat extraction | No | Modifier only. |
| ammo capacity | No | Missing | New extraction | No | Not present. |
| ammo speed | No | Missing | New extraction | No | Not present. |
| effective range | No | Missing | New extraction | No | Not present. |
| attachments | No | Missing | New extraction | No | Not present. |
| dps | No | Missing | New extraction/calculation | No | Not present. |
| alpha damage | Partial | modifier `GPP_Weapon_Damage` | Needs base damage extraction | No | Modifier only. |
| spread/accuracy | Partial | recoil modifiers | Needs base stat extraction | No | `GPP_Weapon_Recoil_*` only. |
| falloff | No | Missing | New extraction | No | Not present. |
| heat/wear | No | Missing | New extraction | No | Not present. |
| penetration | No | Missing | New extraction | No | Not present. |

### Ship weapon

| Field | Available now? | Source path/property | Transform needed? | Safe for card display? | Notes |
|---|---|---|---|---:|---|
| DPS | No | Missing | New extraction/calculation | No | Not present. |
| alpha damage | Partial | modifier `GPP_Weapon_Damage` | Needs base stat extraction | No | Modifier only. |
| fire rate | No | Missing | New extraction | No | Not present. |
| range | No | Missing | New extraction | No | Not present. |
| ammo/heat behavior | No | Missing | New extraction | No | Not present. |
| penetration | No | Missing | New extraction | No | Not present. |
| damage type/split | No | Missing | New extraction | No | Not present. |

### Cooler

| Field | Available now? | Source path/property | Transform needed? | Safe for card display? | Notes |
|---|---|---|---|---:|---|
| cooling rate | Partial | `baseStats.resources.generation.Coolant`; modifier `GPP_ItemResource_CoolantGeneration` | Needs label confirmation | Caution | Looks like coolant generation, not full cooler performance model. |
| cooling capacity | No | Missing | New extraction | No | Not present. |
| power draw | Yes | `baseStats.resources.consumption.Power` | Label/format | Yes | Present on coolers. |
| coolant behavior | Partial | `baseStats.resources.generation.Coolant` | Needs semantics | Caution | Single resource generation value only. |
| heat recovery | No | Missing | New extraction | No | Not present. |
| wear | No | Missing | New extraction | No | Not present. |

### Power plant

| Field | Available now? | Source path/property | Transform needed? | Safe for card display? | Notes |
|---|---|---|---|---:|---|
| power output | Partial | modifier `GPP_ItemResource_PowerGeneration` | Needs base power generation extraction | No | No `baseStats.resources.generation.Power` found for audited powerplants. |
| voltage regulator | Partial | material slot `VOLTAGE REGULATOR`; modifier slot | Material slot display only | Limited | Ingredient slot exists, not a performance stat. |
| power pips | Partial | integer additive modifier ranges for `GPP_ItemResource_PowerGeneration` | Runtime selected quality calculation | Limited | Could show possible quality modifier, not base output. |
| stability | No | Missing | New extraction | No | Not present. |
| heat | No | Missing | New extraction | No | Not present. |
| wear | No | Missing | New extraction | No | Not present. |

### Armor and other

| Field | Available now? | Source path/property | Transform needed? | Safe for card display? | Notes |
|---|---|---|---|---:|---|
| armor slot | Yes | raw `armorSlot` | Use raw/family join | Yes | Values include arms, backpack, helmet, legs, torso, undersuit, unknown. |
| armor weight | Yes | raw `armorWeight` | Use raw/family join | Yes | Values: light, medium, heavy. |
| armor family | Yes | raw `armorFamily`, `familyKey`, `familyDisplayName` | Use raw/family join | Yes | Not all fields survive current normalization. |
| armor damage mitigation | Partial | modifier `GPP_Armor_DamageMitigation` | Needs base mitigation extraction | No | Modifier only. |
| armor temperature/radiation | Partial | modifiers `GPP_Armor_TemperatureMin/Max`, `GPP_Armor_RadiationDissipation` | Needs base stat extraction | No | Modifier only. |
| other component identity | Yes | `componentType`, name, size, craft time, materials | Existing transform | Yes | Radar/utility/etc cards can be identity/crafting only. |
| other component stats | Partial | generic `baseStats.mass`, `health`, resistances, signatures, distortion | Label/format | Yes if generic | No category-specific card stats audited. |

## 5. Recommended card schema from existing fields only

Shared safe fields for all cards:

- `id`: `blueprint_id`
- `displayName`: `component_name`
- `category`: normalized planned category from `item_kind` + `component_type`
- `typeLabel`: `component_type`, with existing label helpers where possible
- `size`, `grade`, `class`: show only when non-empty
- `craftTimeSeconds`
- `materials`: compact list of `material_name`, `quantity`, optional raw `unitType` if using raw record
- `sourceCount` / source labels: from `rewardPools` for vehicle records, with mission detail only after joining `blueprint_reward_sources.json`
- `queued`: runtime join to `buildQueue` by `craft-${blueprint_id}`
- `saved`: runtime join to saved blueprint ids by `blueprint_id`
- `variantLabel` / `family`: FPS raw/family fields where available; vehicle can reuse current UI heuristic but should be labeled as display grouping, not source data

Category-specific fields safe now:

- Shield: size, grade, class, craft time, materials, generic component health/mass/resistances, power consumption, possible shield generation value only if labeled conservatively.
- Quantum drive: size, grade, class, craft time, materials, generic component health/mass/signatures/resistances. Hide travel/fuel/speed stats until extraction improves.
- Ship weapon: size, grade, craft time, materials, inferred weapon subtype from current `source_file` helper, generic health/mass/resistances. Hide DPS/range/damage/fire rate.
- FPS weapon: `weaponClass`, family/variant fields, craft time, materials, quality modifier names. Hide DPS/range/ammo/fire mode/damage unless base stats are extracted.
- Armor: `armorSlot`, `armorWeight`, family/variant fields, craft time, materials, quality modifier names. Hide base mitigation/temp/radiation values unless extracted.
- Cooler: size, grade, class, craft time, materials, power consumption, possible coolant generation if labeled as resource generation. Hide capacity/heat/wear.
- Power plant: size, grade, class, craft time, materials, quality modifier names for power generation. Hide output/stability/heat/wear until base resource generation exists.
- Other: identity, craft time, materials, generic base stats only.

Fields that should stay hidden until extraction is improved:

- Shield regen/delay/reserve pool stats.
- Quantum speed, travel time, calibration, spline jump, quantum fuel consumption.
- FPS and ship weapon DPS, alpha damage, fire rate, range, ammo behavior, penetration, falloff, attachments.
- Cooler cooling capacity, heat recovery, wear.
- Power plant base output, stability, heat, wear.
- Manufacturer across all audited categories.

Fields requiring new extraction work:

- Explicit item `slug` or browser route slug.
- Manufacturer.
- Explicit class name / item class name, if distinct from blueprint record names.
- Category-specific performance stat blocks for shields, quantum drives, ship weapons, FPS weapons, coolers, and power plants.
- Static base values corresponding to quality modifiers, so card stats can show real modified values instead of modifier names only.

## 6. Gaps/blockers

- Vehicle component `baseStats` is mostly generic durability/signature/resistance/resource information, not full component performance data.
- Quality modifiers identify which stats can change, but often not the base value needed for an accurate card stat.
- FPS weapon and armor records contain rich crafting/family metadata but not combat/protection base stats.
- Manufacturer is effectively missing in current audited craftable data.
- Slugs do not exist.
- Vehicle variant/family grouping is currently UI-derived; FPS family data exists, but vehicle family metadata does not.
- Blueprint sources are split: vehicle raw `rewardPools` are convenient for queue snapshots, while mission details require joining `public/api/missions/blueprint_reward_sources.json` by `blueprintGuid`.
- `dist/api` is stale relative to `public/api`; future implementation should use `public/api`/served API data, not built artifacts.

## 7. Next-step recommendation

Recommendation: **C. Build browser shell now but show limited stats**, if the goal is a near-term filtered results page.

The existing data is strong enough for filtered identity/crafting cards: name, type/category, size, grade/class where present, craft time, material requirements, saved/queued state, variants for FPS, and blueprint source summaries for many vehicle records. It is not strong enough for accurate performance cards for shields, quantum drives, weapons, coolers, or power plants.

If the intended first release requires performance-forward cards, choose **B. First expand extraction for shields/quantum/weapons** before UI work. The critical missing work is extracting base performance stats that correspond to the planned card fields, not just quality modifier deltas.
