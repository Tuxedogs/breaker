# Shield Stat Extraction Audit

Date audited: 2026-05-25

Scope: shield generator stat discovery only. This pass uses `D:\scintel\data\libs\foundry\records` as the primary local game-data source. No UI, CSS, selectors, routes, extraction scripts, or generated index payloads were changed.

Note: an earlier interrupted pass looked at broad/generic `D:\scintel` paths and old extraction helpers. Those broad results are invalid for this corrected task. The findings below were redone from the permanent foundry records path.

## Sources Checked

Primary source:

- `D:\scintel\data\libs\foundry\records`
- `D:\scintel\data\libs\foundry\records\entities\scitem\ships\shieldgenerator`
- `D:\scintel\data\libs\foundry\records\crafting\blueprints\crafting\vehiclegear\shield`

Project join/reference sources:

- `public/api/crafting/blueprints.json`
- `public/api/crafting/component_card_index.json`

Explicitly not used as source of truth:

- Star Citizen Wiki/API
- `D:\ASCExports`
- old broad extraction outputs

## Record Discovery

Found shield generator entity records at:

`D:\scintel\data\libs\foundry\records\entities\scitem\ships\shieldgenerator`

Counts:

- Shield XML files: 73
- XML files with `SCItemShieldGeneratorParams`: 73
- Crafting shield blueprints in `public/api/crafting/blueprints.json`: 62
- Shield card records in `component_card_index.json`: 62
- Craftable shield records joined by `entityClass` -> XML root `__ref`: 62 / 62

Example files found:

- `D:\scintel\data\libs\foundry\records\entities\scitem\ships\shieldgenerator\shld_behr_s02_5ma_scitem.xml`
- `D:\scintel\data\libs\foundry\records\entities\scitem\ships\shieldgenerator\shld_basl_s00_castra_scitem.xml`
- `D:\scintel\data\libs\foundry\records\entities\scitem\ships\shieldgenerator\shld_basl_s01_bulwark_scitem.xml`

Crafting blueprint example:

- `D:\scintel\data\libs\foundry\records\crafting\blueprints\crafting\vehiclegear\shield\bp_craft_shld_behr_s02_5ma_scitem.xml`

## Join Key Recommendation

Recommended join:

1. `component_card_index.records[].entityClass`
2. `public/api/crafting/blueprints[].entityClass`
3. XML root `EntityClassDefinition.*` attribute `__ref`

This is the safest join because:

- Card index shield record `entityClass` equals blueprint `entityClass`.
- Blueprint XML `CraftingProcess_Creation entityClass` equals the same GUID.
- Shield entity XML root `__ref` equals the same GUID.
- `public/api/crafting/blueprints.json` also carries `entityClassPath`, which matches the XML root `__path`.

Example, 5MA:

```json
{
  "cardOrBlueprintEntityClass": "8c2b0c60-881b-4163-9d72-b6b74806735a",
  "blueprintPath": "libs/foundry/records/crafting/blueprints/crafting/vehiclegear/shield/bp_craft_shld_behr_s02_5ma_scitem.xml",
  "blueprintCreationEntityClass": "8c2b0c60-881b-4163-9d72-b6b74806735a",
  "entityClassPath": "libs/foundry/records/entities/scitem/ships/shieldgenerator/shld_behr_s02_5ma_scitem.xml",
  "xmlRootRef": "8c2b0c60-881b-4163-9d72-b6b74806735a",
  "xmlClassName": "SHLD_BEHR_S02_5MA_SCItem"
}
```

Secondary useful keys:

- `entityClassPath` -> XML root `__path`: safe as a validation/provenance path.
- XML class name, for example `SHLD_BEHR_S02_5MA_SCItem`: safe for debug/provenance, but not the primary join.
- `blueprintGuid`: safe card/recipe id, but it identifies the crafting blueprint, not the output shield entity XML.

Unsafe as primary joins:

- Display name, because it can be localized/truncated/changed.
- Slug, because it is not present.
- Class name alone, because the existing card index does not currently store it as the primary identity field.

## Key Semantics Confirmed

### `baseStats.resources.generation.Shield`

This is not max shield HP. It matches `SCItemShieldGeneratorParams MaxShieldRegen`.

Examples:

| Item | `baseStats.resources.generation.Shield` | XML `MaxShieldRegen` | XML `MaxShieldHealth` |
|---|---:|---:|---:|
| 5MA `'Chimalli` | 1900 | 1900 | 10000 |
| Castra | 228 | 228 | 720 |
| Bulwark | 410 | 410 | 2160 |

Recommendation: use this value as regen rate only if sourced directly from XML `SCItemShieldGeneratorParams MaxShieldRegen` or clearly labeled as shield resource generation/regen. Do not label it max shield HP.

### `baseStats.health`

This is component item health, not shield HP.

Examples:

| Item | `baseStats.health` | XML `SHealthComponentParams Health` | XML `SCItemShieldGeneratorParams MaxShieldHealth` |
|---|---:|---:|---:|
| 5MA `'Chimalli` | 410 | 410 | 10000 |
| Castra | 65 | 65 | 720 |
| Bulwark | 180 | 180 | 2160 |

Recommendation: keep `baseStats.health` under `stats.generic.health` only.

### Generic `damageResistances`

The existing `baseStats.damageResistances` values map to XML `SHealthComponentParams/DamageResistances`, which are component durability resistances. They are not shield-face/shield-bubble resistances.

Examples:

| Item | Generic physical durability multiplier | XML shield physical resistance |
|---|---:|---|
| 5MA `'Chimalli` | `0.9` | `{ "min": 0, "max": 0.25 }` |
| Castra | `0.9` | `{ "min": 0, "max": 0.25 }` |
| Bulwark | `0.9` | `{ "min": 0, "max": 0.25 }` |

Recommendation: do not copy generic durability resistances into `stats.shield`.

## Field Safety Matrix

| Target field | Source path/property | Example value | Join key | Confidence | Transform needed | Notes |
|---|---|---:|---|---|---|---|
| `maxShieldHealth` | `SCItemShieldGeneratorParams @MaxShieldHealth` | 5MA: `10000` | `entityClass` -> XML `__ref` | safe | Parse number | Direct shield stat. |
| `regenRate` | `SCItemShieldGeneratorParams @MaxShieldRegen` | 5MA: `1900` | `entityClass` -> XML `__ref` | safe | Parse number | Same value currently appears as `baseStats.resources.generation.Shield`; XML property proves meaning. |
| `regenTime` | derived from `MaxShieldHealth / MaxShieldRegen` | 5MA: `5.263...` sec | `entityClass` -> XML `__ref` | caution | Compute if both fields present | Not a direct XML field. Use only if the product wants derived full regen time. |
| `reservePoolRegenRate` | `MaxShieldRegen * ReservePoolRegenRateRatio` | 5MA: `1900` | `entityClass` -> XML `__ref` | caution | Compute from direct fields | XML has ratio, not final absolute rate. |
| `reservePoolRegenTime` | `(MaxShieldHealth * ReservePoolMaxHealthRatio) / reservePoolRegenRate` | 5MA: `5.263...` sec | `entityClass` -> XML `__ref` | caution | Compute from direct fields | XML has ratios, not final time. |
| `damageRegenDelay` | `SCItemShieldGeneratorParams @DamagedRegenDelay` | 5MA: `5.5` | `entityClass` -> XML `__ref` | safe | Parse number | Direct shield stat. Name in XML is `DamagedRegenDelay`; index field can use `damageRegenDelay`. |
| `downedRegenDelay` | `SCItemShieldGeneratorParams @DownedRegenDelay` | 5MA: `11` | `entityClass` -> XML `__ref` | safe | Parse number | Direct shield stat. |
| `physicalAbsorption` | `SCItemShieldGeneratorParams/ShieldAbsorption/SShieldAbsorption[0]` | 5MA: `{ min: 0, max: 0.45 }` | `entityClass` -> XML `__ref` | caution | Positional range parse | XML children are unlabeled; position appears to correspond to physical by damage-type ordering. |
| `physicalResistance` | `SCItemShieldGeneratorParams/ShieldResistance/SShieldResistance[0]` | 5MA: `{ min: 0, max: 0.25 }` | `entityClass` -> XML `__ref` | caution | Positional range parse | Do not confuse with item durability `PhysicalResistance`. |
| `distortionResistance` | `SCItemShieldGeneratorParams/ShieldResistance/SShieldResistance[2]` | 5MA: `{ min: 0.75, max: 0.95 }` | `entityClass` -> XML `__ref` | caution | Positional range parse | XML children are unlabeled; index 2 matches the apparent distortion slot. |
| `powerUsageMin` | `ItemResourceDeltaConversion @minimumConsumptionFraction` and `consumption resource="Power" SPowerSegmentResourceUnit @units` | 5MA: `3 * 0.6666667 = 2.0000001` | `entityClass` -> XML `__ref` | caution | Multiply amount by min fraction; round sanely | XML exposes max draw and min fraction, not a named min field. |
| `powerUsageMax` | `ItemResourceDeltaConversion/consumption resource="Power"/SPowerSegmentResourceUnit @units` | 5MA: `3` | `entityClass` -> XML `__ref` | safe | Parse number | Direct resource consumption amount. |
| `coolantUsageMin` | `ItemResourceDeltaConsumption @minimumConsumptionFraction` and `consumption resource="Coolant" SStandardResourceUnit @standardResourceUnits` | 5MA: `0` | `entityClass` -> XML `__ref` | caution | Multiply amount by min fraction | All sampled/craftable shields parsed as `0`; still use direct XML source. |
| `coolantUsageMax` | `ItemResourceDeltaConsumption/consumption resource="Coolant"/SStandardResourceUnit @standardResourceUnits` | 5MA: `0` | `entityClass` -> XML `__ref` | safe | Parse number | Direct resource consumption amount. |

## Real Local Examples

### 5MA `'Chimalli`

Local project data disagrees slightly with the external validation label: local `public/api/crafting/blueprints.json` currently has `displayName: "5MA 'Chimalli"` rather than `5MA “Chimalli”`. The class/name/size/grade/class identity otherwise lines up with the local foundry record.

Source:

- Blueprint: `libs/foundry/records/crafting/blueprints/crafting/vehiclegear/shield/bp_craft_shld_behr_s02_5ma_scitem.xml`
- Entity: `libs/foundry/records/entities/scitem/ships/shieldgenerator/shld_behr_s02_5ma_scitem.xml`
- XML class: `SHLD_BEHR_S02_5MA_SCItem`
- XML `__ref`: `8c2b0c60-881b-4163-9d72-b6b74806735a`

```json
{
  "name": "5MA 'Chimalli",
  "blueprintGuid": "6a4393b4-b7fe-4913-85bc-dc803dc73acb",
  "entityClass": "8c2b0c60-881b-4163-9d72-b6b74806735a",
  "size": 2,
  "grade": "C",
  "class": "civilian",
  "itemHealth": 410,
  "maxShieldHealth": 10000,
  "regenRate": 1900,
  "damageRegenDelay": 5.5,
  "downedRegenDelay": 11,
  "physicalResistance": { "min": 0, "max": 0.25 },
  "distortionResistance": { "min": 0.75, "max": 0.95 },
  "physicalAbsorption": { "min": 0, "max": 0.45 },
  "powerUsageMin": 2.0000001,
  "powerUsageMax": 3,
  "coolantUsageMin": 0,
  "coolantUsageMax": 0
}
```

### Castra

Source:

- Entity: `libs/foundry/records/entities/scitem/ships/shieldgenerator/shld_basl_s00_castra_scitem.xml`
- XML class: `SHLD_BASL_S00_Castra_SCItem`
- XML `__ref`: `e11f94ed-6a41-4960-b895-4a604ec98e97`

```json
{
  "name": "Castra",
  "blueprintGuid": "5a827179-6c2a-4151-87ed-bcf1059ac4fb",
  "entityClass": "e11f94ed-6a41-4960-b895-4a604ec98e97",
  "size": 0,
  "grade": "C",
  "class": "industrial",
  "itemHealth": 65,
  "maxShieldHealth": 720,
  "regenRate": 228,
  "damageRegenDelay": 4.55,
  "downedRegenDelay": 9.09,
  "physicalResistance": { "min": 0, "max": 0.25 },
  "distortionResistance": { "min": 0.75, "max": 0.95 },
  "physicalAbsorption": { "min": 0, "max": 0.45 },
  "powerUsageMin": 1,
  "powerUsageMax": 2,
  "coolantUsageMin": 0,
  "coolantUsageMax": 0
}
```

### Bulwark

Source:

- Entity: `libs/foundry/records/entities/scitem/ships/shieldgenerator/shld_basl_s01_bulwark_scitem.xml`
- XML class: `SHLD_BASL_S01_Bulwark_SCItem`
- XML `__ref`: `624e6c75-afd8-4606-a10e-45d12cb3c882`

```json
{
  "name": "Bulwark",
  "blueprintGuid": "f8443a8c-417d-4fb6-8470-67205b67781f",
  "entityClass": "624e6c75-afd8-4606-a10e-45d12cb3c882",
  "size": 1,
  "grade": "C",
  "class": "industrial",
  "itemHealth": 180,
  "maxShieldHealth": 2160,
  "regenRate": 410,
  "damageRegenDelay": 5,
  "downedRegenDelay": 10,
  "physicalResistance": { "min": 0, "max": 0.25 },
  "distortionResistance": { "min": 0.75, "max": 0.95 },
  "physicalAbsorption": { "min": 0, "max": 0.45 },
  "powerUsageMin": 2.0000001,
  "powerUsageMax": 3,
  "coolantUsageMin": 0,
  "coolantUsageMax": 0
}
```

## Fields Still Missing Or Ambiguous

- `regenTime`: no direct XML property was found. It can be derived as `MaxShieldHealth / MaxShieldRegen`, but should be marked derived/caution.
- `reservePoolRegenRate`: no direct absolute XML property was found. XML has `ReservePoolRegenRateRatio`; absolute rate can be derived from `MaxShieldRegen * ReservePoolRegenRateRatio`.
- `reservePoolRegenTime`: no direct XML property was found. It can be derived from max health, reserve pool max health ratio, and reserve pool regen rate.
- `physicalAbsorption`, `physicalResistance`, `distortionResistance`: values are present under shield-specific nodes, but the XML child nodes are unlabeled. The positional mapping should be documented in source metadata if implemented.
- `powerUsageMin` and `coolantUsageMin`: no direct min field was found. XML has `minimumConsumptionFraction`; min can be derived as max amount times fraction. This should be marked derived/caution and rounded to avoid float artifacts like `2.0000001`.

## Implementation Recommendation

It is safe to implement shield extraction next, with source metadata and confidence attached per field.

Recommended implementation shape for `record.stats.shield`:

```json
{
  "maxShieldHealth": 10000,
  "regenRate": 1900,
  "regenTime": 5.26,
  "reservePoolRegenRate": 1900,
  "reservePoolRegenTime": 5.26,
  "damageRegenDelay": 5.5,
  "downedRegenDelay": 11,
  "physicalAbsorption": { "min": 0, "max": 0.45 },
  "physicalResistance": { "min": 0, "max": 0.25 },
  "distortionResistance": { "min": 0.75, "max": 0.95 },
  "powerUsageMin": 2,
  "powerUsageMax": 3,
  "coolantUsageMin": 0,
  "coolantUsageMax": 0
}
```

Recommended safeguards for implementation:

- Join by `record.entityClass` / blueprint `entityClass` to XML root `__ref`.
- Validate all 62 craftable shield card records find a shield XML record.
- Keep `baseStats.health` in `stats.generic.health`; do not copy it into `stats.shield`.
- Treat `baseStats.resources.generation.Shield` as regen only because XML `MaxShieldRegen` proves it.
- Populate source metadata with XML path and exact XML property names.
- Mark direct XML fields as safe and derived/positional fields as caution in source warnings or debug metadata.
- Do not populate non-shield category stat objects.

