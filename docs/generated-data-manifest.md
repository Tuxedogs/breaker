# Generated Data Manifest

Phase 2.5 adds documentation and metadata only. It does not move files, regenerate data, change schemas, change fetch paths, or change API routes.

The machine-readable manifest lives at `server/config/generatedDataManifest.ts`.

## Architecture Note

`public/api` currently contains generated static reference files. These are not true shaped API responses; many are raw or semi-raw generated source datasets that the frontend fetches directly.

Future shaped API endpoints should consume generated data server-side and return smaller, route-specific responses. Debug/report artifacts should eventually leave `public/api`. Large files such as `mission_contracts.json`, `mission_blueprint_rewards.json`, `fps_blueprints.json`, and `component_card_index.json` should become server-only once shaped APIs replace direct frontend fetches.

Future fitting extraction, combat threshold mechanics, SPViewer replacement, and Erkul replacement are not fully covered by this manifest yet. Add explicit future manifest entries before treating any generated fitting/combat dataset as source-authoritative.

## Classifications

- `runtime API source data`: public generated data currently fetched by runtime code.
- `canonical generated reference data`: compact generated reference data that can remain stable and public as a fallback.
- `public static fallback data`: static public data used as a runtime fallback until shaped APIs own the flow.
- `server-internal source data`: generated data read by server/recommender code and not deployed through Moonbreaker `public/api`.
- `debug/report artifact`: generated reports, unresolved lists, validation details, or debug-only payloads.
- `obsolete/unused candidate`: public generated data with no exact runtime fetch found during audit.
- `unknown/manual review`: referenced or expected data whose generator/status needs confirmation.

## Audit Metadata Fields

Each entry in `server/config/generatedDataManifest.ts` also includes:

- `authority`: `foundry`, `localization`, `ref_index`, `scintel-inferred`, `manual-override`, `external-import`, `mixed`, or `unknown`.
- `confidence`: `high`, `medium`, `low`, or `needs-validation`.
- `externalDependency`: whether the generated file depends on a non-Foundry/non-Scintel source.
- `externalSources`: source-of-truth external inputs, when present.
- `comparisonSources`: external tools used only for comparison or validation, not authority.
- `validationStatus`: `not-needed`, `needs-source-audit`, `needs-mechanics-audit`, `needs-ingame-validation`, or `validated`.
- `notes`: short caveats for source authority, mechanics, public cleanup, or future ownership.

## Authority Rollup

| Path | Authority | Confidence | Validation | External dependency | Comparison sources |
|---|---|---|---|---|---|
| `public/api/crafting/blueprints.json` | mixed | medium | needs-source-audit | no |  |
| `public/api/crafting/blueprint_rewards.json` | foundry | high | not-needed | no |  |
| `public/api/crafting/component_card_index.json` | mixed | needs-validation | needs-source-audit | no | SPViewer, Erkul |
| `public/api/crafting/crafted_properties.json` | foundry | high | not-needed | no |  |
| `public/api/crafting/quality_quantization.json` | foundry | needs-validation | needs-mechanics-audit | no |  |
| `public/api/crafting/material_quality_quantization.json` | mixed | needs-validation | needs-mechanics-audit | no |  |
| `public/api/crafting/material_quality_quantization_debug.json` | mixed | needs-validation | needs-mechanics-audit | no |  |
| `public/api/crafting/material_quality_quantization_report.json` | mixed | needs-validation | needs-mechanics-audit | no |  |
| `public/api/crafting/material_identity_index.json` | mixed | medium | needs-source-audit | no |  |
| `public/api/crafting/unresolved_resource_ids.json` | scintel-inferred | medium | not-needed | no |  |
| `public/api/crafting/fps/fps_blueprints.json` | mixed | medium | needs-source-audit | no | SPViewer, Erkul |
| `public/api/crafting/fps/weapons.json` | mixed | medium | needs-source-audit | no | SPViewer, Erkul |
| `public/api/crafting/fps/armor.json` | mixed | medium | needs-source-audit | no | SPViewer, Erkul |
| `public/api/crafting/fps/ammo.json` | mixed | medium | needs-source-audit | no | SPViewer, Erkul |
| `public/api/crafting/fps/weapon_families.json` | scintel-inferred | needs-validation | needs-source-audit | no | SPViewer, Erkul |
| `public/api/crafting/fps/armor_families.json` | scintel-inferred | needs-validation | needs-source-audit | no | SPViewer, Erkul |
| `public/api/crafting/fps/fps_variant_families.json` | scintel-inferred | needs-validation | needs-source-audit | no | SPViewer, Erkul |
| `public/api/missions/mission_contracts.json` | mixed | medium | needs-source-audit | no |  |
| `public/api/missions/mission_blueprint_rewards.json` | mixed | medium | needs-source-audit | no |  |
| `public/api/missions/blueprint_reward_sources.json` | mixed | medium | needs-source-audit | no |  |
| `public/api/missions/mission_reward_lookups.json` | mixed | medium | needs-source-audit | no |  |
| `public/api/missions/mission_extraction_report.json` | mixed | medium | not-needed | no |  |
| `public/api/recommendations/location_material_index.json` | mixed | needs-validation | needs-mechanics-audit | no |  |
| `public/api/recommendations/material_encounter_rankings.json` | scintel-inferred | needs-validation | needs-mechanics-audit | no |  |
| `public/api/recommendations/material_quality_index.json` | mixed | needs-validation | needs-mechanics-audit | no |  |
| `public/api/recommendations/location_distribution_index.json` | scintel-inferred | needs-validation | needs-mechanics-audit | no |  |
| `public/api/recommendations/location_hierarchy_index.json` | mixed | medium | needs-source-audit | no |  |
| `public/api/lagrange-groups.generated.json` | localization | medium | needs-source-audit | no |  |
| `public/api/lagrange-children.generated.json` | ref_index | medium | needs-source-audit | no |  |
| `public/api/refinery/refinery_yields.json` | external-import | needs-validation | needs-source-audit | yes |  |
| `D:/scintel/api/recommendations/material_source_scores.json` | scintel-inferred | needs-validation | needs-mechanics-audit | no |  |
| `D:/scintel/api/mining/material_sources_quality_enriched.json` | mixed | needs-validation | needs-mechanics-audit | no |  |
| `D:/scintel/api/recommendations/location_metadata.json` | unknown | low | needs-source-audit | no |  |

## Public Generated Files

| Path | Domain | Generator | Size | Runtime usage | Classification | Future visibility | Large? | Debug/provenance? | Safe public removal candidate? |
|---|---|---|---:|---|---|---|---|---|---|
| `public/api/crafting/blueprints.json` | crafting | `D:/scintel/scripts/link/build_blueprint_api.py` | 3.63 MB | fetched by `src/lib/craftingData.ts` | runtime API source data | server-only | yes | yes | no |
| `public/api/crafting/blueprint_rewards.json` | crafting | `D:/scintel/scripts/link/build_blueprint_api.py` | 0.12 MB | no exact runtime fetch found | obsolete/unused candidate | server-only | no | yes | yes |
| `public/api/crafting/component_card_index.json` | crafting | `D:/scintel/scripts/generate-component-card-index.ts` | 13.18 MB | fetched by `src/lib/componentCardIndex.ts` | runtime API source data | server-only | yes | yes | no |
| `public/api/crafting/crafted_properties.json` | crafting | `D:/scintel/scripts/link/build_blueprint_api.py` | 0.01 MB | fetched by `src/lib/craftingData.ts` | runtime API source data | public fallback | no | yes | no |
| `public/api/crafting/quality_quantization.json` | crafting | `build_blueprint_api.py` / `build_mining_material_sources.py` | 0.04 MB | fetched by crafting/logistics helpers | canonical generated reference data | public fallback | no | yes | no |
| `public/api/crafting/material_quality_quantization.json` | crafting | `D:/scintel/scripts/link/build_material_quality_quantization.py` | 0.01 MB | fetched by build queue and recipe material quality UI | runtime API source data | public fallback | no | no | no |
| `public/api/crafting/material_quality_quantization_debug.json` | crafting | `D:/scintel/scripts/link/build_material_quality_quantization.py` | 0.05 MB | no runtime fetch found | debug/report artifact | debug/reports | no | yes | yes |
| `public/api/crafting/material_quality_quantization_report.json` | crafting | `D:/scintel/scripts/link/build_material_quality_quantization.py` | 0.00 MB | no runtime fetch found | debug/report artifact | debug/reports | no | yes | yes |
| `public/api/crafting/material_identity_index.json` | crafting | `D:/scintel/scripts/link/build_material_identity_index.py` | 0.31 MB | fetched by `src/lib/logistics/materialIdentityIndex.ts` | canonical generated reference data | public fallback | no | yes | no |
| `public/api/crafting/unresolved_resource_ids.json` | crafting | `D:/scintel/scripts/link/build_blueprint_api.py` | 0.00 MB | no runtime fetch found | debug/report artifact | debug/reports | no | yes | yes |
| `public/api/crafting/fps/fps_blueprints.json` | FPS crafting | `build_fps_crafting_api.py` / `build_fps_variant_families.py` | 15.55 MB | fetched by `src/lib/craftingData.ts` | runtime API source data | server-only | yes | yes | no |
| `public/api/crafting/fps/weapons.json` | FPS crafting | `build_fps_crafting_api.py` / `build_fps_variant_families.py` | 3.23 MB | no exact runtime fetch found | obsolete/unused candidate | server-only | yes | yes | yes |
| `public/api/crafting/fps/armor.json` | FPS crafting | `build_fps_crafting_api.py` / `build_fps_variant_families.py` | 12.08 MB | no exact runtime fetch found | obsolete/unused candidate | server-only | yes | yes | yes |
| `public/api/crafting/fps/ammo.json` | FPS crafting | `D:/scintel/scripts/link/build_fps_crafting_api.py` | 0.22 MB | no exact runtime fetch found | obsolete/unused candidate | server-only | no | yes | yes |
| `public/api/crafting/fps/weapon_families.json` | FPS crafting | `D:/scintel/scripts/link/build_fps_variant_families.py` | 3.47 MB | no exact runtime fetch found | obsolete/unused candidate | server-only | yes | yes | yes |
| `public/api/crafting/fps/armor_families.json` | FPS crafting | `D:/scintel/scripts/link/build_fps_variant_families.py` | 12.59 MB | no exact runtime fetch found | obsolete/unused candidate | server-only | yes | yes | yes |
| `public/api/crafting/fps/fps_variant_families.json` | FPS crafting | `D:/scintel/scripts/link/build_fps_variant_families.py` | 16.06 MB | no exact runtime fetch found | obsolete/unused candidate | server-only | yes | yes | yes |
| `public/api/missions/mission_contracts.json` | missions | `D:/scintel/scripts/link/build_mission_blueprint_rewards_api.py` | 47.70 MB | fetched by `src/lib/missionData.ts` | runtime API source data | server-only | yes | yes | no |
| `public/api/missions/mission_blueprint_rewards.json` | missions | `D:/scintel/scripts/link/build_mission_blueprint_rewards_api.py` | 16.61 MB | fetched by recipe table and blueprint tracker store | runtime API source data | server-only | yes | yes | no |
| `public/api/missions/blueprint_reward_sources.json` | missions | `D:/scintel/scripts/link/build_mission_blueprint_rewards_api.py` | 4.43 MB | fetched by recipe table and blueprint tracker store | runtime API source data | server-only | yes | no | no |
| `public/api/missions/mission_reward_lookups.json` | missions | `D:/scintel/scripts/link/build_mission_blueprint_rewards_api.py` | 0.62 MB | fetched by `src/lib/missionData.ts` | runtime API source data | server-only | no | yes | no |
| `public/api/missions/mission_extraction_report.json` | missions | `D:/scintel/scripts/link/build_mission_blueprint_rewards_api.py` | 0.01 MB | validation only | debug/report artifact | debug/reports | no | yes | yes |
| `public/api/recommendations/location_material_index.json` | mining/recommendations | `build_mining_static_indexes.py` plus `scripts/update-pyro-location-indexes.mts` | 1.18 MB | fetched by `src/features/mining/staticMiningIndex.ts` | public static fallback data | public fallback | yes | yes | no |
| `public/api/recommendations/material_encounter_rankings.json` | mining/recommendations | `build_mining_static_indexes.py` plus `scripts/update-pyro-location-indexes.mts` | 0.33 MB | fetched by `src/features/mining/staticMiningIndex.ts` | public static fallback data | public fallback | no | no | no |
| `public/api/recommendations/material_quality_index.json` | mining/recommendations | `build_mining_static_indexes.py` plus `scripts/update-pyro-location-indexes.mts` | 0.20 MB | fetched by `src/features/mining/staticMiningIndex.ts` | public static fallback data | public fallback | no | no | no |
| `public/api/recommendations/location_distribution_index.json` | mining/recommendations | `build_mining_static_indexes.py` plus `scripts/update-pyro-location-indexes.mts` | 0.03 MB | fetched by `src/features/mining/staticMiningIndex.ts` | public static fallback data | public fallback | no | no | no |
| `public/api/recommendations/location_hierarchy_index.json` | mining/recommendations | `D:/scintel/scripts/link/build_mining_static_indexes.py` | 0.00 MB | fetched by `src/features/mining/staticMiningIndex.ts` | public static fallback data | public fallback | no | no | no |
| `public/api/lagrange-groups.generated.json` | lagrange/locations | `D:/scintel/scripts/generate-lagrange-api.mjs` | 0.01 MB | fetched by `src/features/locations/stantonLagrangeChildren.ts` | public static fallback data | public fallback | no | yes | no |
| `public/api/lagrange-children.generated.json` | lagrange/locations | `D:/scintel/scripts/generate-lagrange-api.mjs` | 0.37 MB | fetched by `src/features/locations/stantonLagrangeChildren.ts` | public static fallback data | public fallback | no | yes | no |
| `public/api/refinery/refinery_yields.json` | refinery | `scripts/import-refinery-yields.mts` | 0.01 MB | fetched by `src/lib/refineryData.ts` | canonical generated reference data | public fallback | no | yes | no |

## Server-Only Recommender Sources

These are referenced by `server/config/apiPaths.ts` and recommender loaders. They are not deployed through Moonbreaker `public/api`.

| Path | Domain | Generator | Size | Runtime usage | Classification | Future visibility | Large? | Debug/provenance? | Notes |
|---|---|---|---:|---|---|---|---|---|---|
| `D:/scintel/api/recommendations/material_source_scores.json` | mining/recommendations | `D:/scintel/scripts/link/build_material_source_scores.py` | 0.55 MB | read by recommender server loaders | server-internal source data | server-only | no | yes | keep server-side |
| `D:/scintel/api/mining/material_sources_quality_enriched.json` | mining/recommendations | `D:/scintel/scripts/link/enrich_material_source_quality.py` | 1.49 MB | read by recommender server loaders | server-internal source data | server-only | yes | yes | keep server-side |
| `D:/scintel/api/recommendations/location_metadata.json` | mining/recommendations | unknown/manual review | unknown | referenced by recommender loaders if present | unknown/manual review | manual review | no | no | referenced but not present in audited local API listing |

## Future Ownership

- Crafting and FPS crafting should be owned by shaped crafting recipe/component APIs.
- Mission files should be owned by mission browser and blueprint source APIs.
- Mining static files should remain public fallbacks until the recommender API owns shaped responses.
- Server-only recommender files should remain internal and feed `server/recommender`.
- Lagrange files should be owned by a location registry.
- Refinery yields can remain a compact public fallback or move behind a refinery planner API.
