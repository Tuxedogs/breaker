# Combat and Damage Data Provenance Audit

Date: 2026-06-23

Scope: read-only audit of Moonbreaker combat/fitting consumers, Scintel generated outputs, and local Foundry XML under `D:\scintel\libs\foundry\records`. Erkul and SPViewer are treated only as comparison/legacy sources, never as authoritative sources.

## Executive conclusion

Current Scintel extraction does **not** yet provide the complete, consumed, provenance-safe input set for a stateful shield -> armor -> hull -> component damage model.

It does provide strong Foundry-derived building blocks: per-channel projectile damage, projectile geometry, shield HP/regen/delays, shield resistance/absorption arrays, component HP/resistances, and component distortion capacity/decay fields. Foundry also contains authoritative vehicle-armor records and ship penetration multipliers that Scintel is not exporting.

The current Moonbreaker armor-threshold model is a separate legacy path. It consumes generated Erkul ship/weapon/shield snapshots, manual/observed breakpoint data, and frontend heuristics. It does not consume Scintel fitting JSON or the Foundry-derived component card index. Its outputs must not be described as Foundry-authoritative.

Even after the missing fields are exported, data alone does not prove all runtime ordering and formulas (shield resistance versus absorption, power-state interpolation, projectile penetration traversal, damage propagation, armor health-curve behavior, hull/part aggregation, distortion disable state, or passthrough ordering). A deterministic stateful model will need explicit mechanic validation against game behavior or authoritative code/schema documentation.

## Current source chains

### Scintel fitting

`Foundry XML -> Scintel fitting generators -> D:\scintel\api\fitting\*.json -> Moonbreaker server/fitting/fitting.service.ts -> /api/fitting/* -> FittingPage.tsx`

- Moonbreaker reads `D:\scintel\api` by default through `server/config/apiPaths.ts`.
- `scripts/fitting_phase4_calculations.py` calculates only prototype totals for equipped shield HP, shield regen, resource balances, quantum data, direct-weapon alpha, and direct-weapon DPS.
- Phase 4 requires `ship_weapons.json` to exist but does not read it. It reads `components.json`, including the older nested `categoryStats.damage` and `categoryStats.fireModes` payload.
- The browser does not calculate combat damage. It displays the shaped phase-4 summary returned by the server.

### Scintel component-card/crafting data

`Foundry XML + crafting blueprints -> D:\scintel\scripts\generate-component-card-index.ts -> Moonbreaker public/api/crafting/component_card_index.json -> shape-component-card-data.mts/server-data or monolith fallback -> component card consumers`

This path displays direct and derived weapon, shield, FPS weapon/ammo, and FPS armor statistics. `ComponentRecipeTable.tsx` also creates frontend-only comparison curves for material-modified FPS damage/falloff and armor resistance. Those charts are crafting previews, not a vehicle stateful damage simulation.

### Moonbreaker Alpha Threshold

`Erkul live/PTU dumps (+ empty SPViewer/manual seeds) -> import-sources.mts and import-ship-shield-profiles.mts -> generated TypeScript seeds/profiles -> data/ships/ships.ts and data/weapons/weapons.ts -> useAlphaThresholdState.ts -> calculations.ts -> Alpha Threshold panels`

This chain is Erkul-derived. The merged source preference includes manual, SPViewer, Erkul live, and Erkul PTU records; current SPViewer and manual seed arrays are empty, but Erkul is populated. Observed and estimated breakpoints in `observedBreakpoints.ts` further override/anchor results.

## Moonbreaker runtime consumers and calculations

### Fitting summaries

- `server/config/apiPaths.ts` - selects the Scintel API root.
- `server/routes/fitting.routes.ts` - exposes fitting routes.
- `server/fitting/fitting.service.ts` - reads Scintel registries and returns phase-4 example calculations; it does not calculate layered damage.
- `src/pages/FittingPage.tsx` - displays direct weapon alpha/DPS, shield HP/regen, and explicitly labels durability/resistance/missile/special-damage fields as unavailable.
- `src/pages/DashboardPage.tsx` - fitting launcher/status only; no combat arithmetic.
- `src/App.tsx` - fitting and Alpha Threshold route registration.

### Component-card combat display/preview

- `src/lib/componentCardIndex.ts` and `src/lib/componentCardIndexApi.ts` - load the shaped/monolithic Scintel component-card records.
- `scripts/shape-component-card-data.mts` - preserves selected combat stat groups into shaped API records.
- `src/components/industry/crafting/utils/componentCardSchema.ts` - displays shield HP/regen/delays/absorption/resistance, weapon damage channels/alpha/penetration, FPS armor resistance, FPS ammo damage/falloff/penetration.
- `src/components/industry/crafting/utils/shipWeaponCardDisplay.ts` - derives weapon display badges/names from damage type.
- `src/components/industry/crafting/components/ComponentResultCard.tsx` - renders card summaries.
- `src/components/industry/crafting/components/ComponentRecipeTable.tsx` - renders detailed combat statistics and computes frontend-only material quality damage, resistance, falloff, and penetration preview values.

### Alpha Threshold calculation/display

Core calculation and source files:

- `src/tools/alpha-threshold/lib/calculations.ts`
- `src/tools/alpha-threshold/lib/recommendations.ts`
- `src/tools/alpha-threshold/hooks/useAlphaThresholdState.ts`
- `src/tools/alpha-threshold/types/index.ts`
- `src/tools/alpha-threshold/data/weapons/weapons.ts`
- `src/tools/alpha-threshold/data/ships/ships.ts`
- `src/tools/alpha-threshold/data/ships/defenseProfileLookup.ts`
- `src/tools/alpha-threshold/data/ships/observedBreakpoints.ts`
- `src/tools/alpha-threshold/lib/weapons/adapters/erkul.ts`
- `src/tools/alpha-threshold/lib/ships/adapters/erkul.ts`
- `scripts/alpha-threshold/import-sources.mts`
- `scripts/alpha-threshold/import-ship-shield-profiles.mts`
- generated `data/weapons/erkul*Seeds.ts`, `data/ships/erkul*Seeds.ts`, and `data/shields/erkul*Shield*.ts`/`erkul*ShipDefenseProfiles.ts`

Direct combat presentation files:

- `AlphaThresholdToolPage.tsx`
- `ArmorInteractionSummaryPanel.tsx`
- `ThresholdComparisonMatrix.tsx`
- `ThresholdSummaryBoard.tsx`
- `ThresholdHeatmapBoard.tsx`, `HeatmapShipColumn.tsx`, `HeatmapLane.tsx`, `HeatmapWeaponTrace.tsx`, `HeatmapTooltip.tsx`, `PenetrationMarker.tsx`, `HeatmapLegend.tsx`
- `TargetAnalysisSurface.tsx`, `RecommendationsBoard.tsx`
- `WeaponCard.tsx`, `WeaponSelector.tsx`, `WeaponSelectorOverlay.tsx`, `WeaponSelectorPanel.tsx`, `WeaponOverrideEditor.tsx`, `WeaponComparisonSlots.tsx`
- mobile result/slot components under `components/mobile`

## Combat field inventory and confidence

Confidence means confidence in provenance and field meaning, not confidence that the complete game mechanic has been reconstructed.

| Field/mechanic | Current source/export | Current consumer | Classification | Confidence |
| --- | --- | --- | --- | --- |
| Projectile damage by physical/energy/distortion/thermal/biochemical/stun | Ammo `DamageInfo`; exported by `ship_weapons.json`, `components.json`, and component-card index | Fitting alpha/DPS; component cards | Foundry direct | High |
| Projectile damage sum (`alphaDamageTotal`) | Sum of direct `DamageInfo` channels | Component cards; fitting has equivalent local sum | Frontend/generator derived | High per projectile; medium as weapon alpha |
| Ballistic/weapon alpha including pellets | `SProjectileLauncher@pelletCount` and `@damageMultiplier` exist but Scintel fitting generators do not apply/export launcher structure | Alpha Threshold uses Erkul alpha; fitting uses per-projectile sum | Missing/incomplete | Low |
| Fire rate | `SWeaponActionFire*Params@fireRate` | Fitting and cards | Foundry direct | High for selected action; medium for choosing active/highest mode |
| DPS | alpha * max fireRate / 60 | Fitting; component cards for FPS | Derived assumption | Medium; low for pellet/multi-launcher/charge/burst weapons |
| Projectile penetration thickness | `pierceabilityParams@maxPenetrationThickness` | Cards only | Foundry direct | High as a field; mechanic meaning medium |
| Penetration geometry | `penetrationParams@basePenetrationDistance/nearRadius/farRadius` | Cards only | Foundry direct | High as fields; mechanic meaning medium |
| Penetration damage falloff levels | `pierceabilityParams@damageFalloffLevel1/2/3`; retained only in nested fitting weapon payload | No current Moonbreaker combat model | Foundry direct but underexposed | Medium |
| Distance damage falloff | FPS ammo `damageDropParams`; exported for FPS weapon/ammo cards. No equivalent vehicle distance-drop structure proved | Crafting FPS preview only | Foundry direct/derived preview | High for FPS inputs; not available for ship weapons |
| Shield HP | `SCItemShieldGeneratorParams@MaxShieldHealth`; 73/73 fitting shields and 62 crafting shields | Fitting/cards | Foundry direct | High |
| Shield regen | `@MaxShieldRegen`; 73/73 | Fitting/cards | Foundry direct | High |
| Shield regen delays | `@DamagedRegenDelay`, `@DownedRegenDelay`; 73/73 | Fitting/cards | Foundry direct | High |
| Shield reserve/decay ratios | direct shield params, present in fitting `categoryStats` | Not used by current combat model | Foundry direct | High as fields; mechanic integration unknown |
| Shield resistance/absorption | Six unlabeled positional `SShieldResistance`/`SShieldAbsorption` ranges; exported as arrays in fitting and selected positional channels in cards | Cards; Alpha uses Erkul shield profiles | Foundry direct values, positional channel inference | Medium |
| Shield passthrough | Not a Foundry field. Alpha import hardcodes `(1-resistance)*(1-absorption)` and runtime selects the generated `.max` value | Alpha Threshold | Erkul-derived inputs + hardcoded formula | Low |
| Armor HP/durability | Vehicle armor `SHealthComponentParams@Health`; 207/207 local armor XML records | Alpha uses Erkul armor HP; Scintel fitting exports zero armor records | Missing from Scintel | High source confidence |
| Armor damage multipliers | `SCItemVehicleArmorParams/damageMultiplier/DamageInfo` | Alpha uses Erkul values | Missing from Scintel | High source confidence |
| Armor deflection threshold | `armorDeflection/deflectionValue` by damage channel | Alpha uses Erkul values | Missing from Scintel | High source confidence |
| Armor penetration reduction/absorption | `armorPenetrationResistance@basePenetrationReduction` and `penetrationAbsorptionForType` | None | Missing from Scintel | High source confidence; runtime semantics medium |
| Armor health curve | `armorDeflection/healthCurve` (`useLUT`; no populated LUT in sampled records) | Alpha assumes threshold scales linearly with armor ratio | Missing; current behavior is frontend inference | Low for linear assumption |
| Hull HP | Foundry ship root `SHealthComponentParams@Health` is `1` in sampled ships and is not useful hull HP; `vehicleHullDamageNormalizationValue` exists but is not proven to be hull HP | Alpha uses Erkul hull/health values | Not source-confirmed in current Foundry extraction | Low |
| Hull damage modifiers | Root ship health resistance is neutral in samples; armor and component resistances exist. No authoritative aggregate hull-damage formula exported | Alpha carries Erkul hull multipliers but does not model hull state | Missing/uncertain | Low |
| Component health | `SHealthComponentParams@Health`; 1,203/1,620 fitting components populated | Cards display generic integrity; no stateful model | Foundry direct | High |
| Component durability resistance | `SHealthComponentParams/DamageResistances`; 1,203/1,620 | Fitting UI says aggregate resistance unavailable | Foundry direct | High as component fields |
| Component penetration multiplier | Ship `VehicleComponentParams@componentPenetrationDamageMultiplier` | None; absent from 351 Scintel ship records | Missing from Scintel | High as a field; application order unknown |
| Fuse penetration multiplier | `@fusePenetrationDamageMultiplier` | None | Missing from Scintel | High as a field; application order unknown |
| Penetration-to-powerplant permission | `aiEngineeringOptions@penetrationCanDamagePowerPlants` | None | Missing from Scintel | Medium; AI variant semantics must be separated |
| Distortion projectile damage | Ammo `DamageInfo@DamageDistortion`; exported | Cards; fitting alpha sum includes it without state semantics | Foundry direct | High |
| Component distortion capacity/decay | `SDistortionParams` (`Maximum`, `DecayDelay`, `DecayRate`, `WarningRatio`, `RecoveryRatio`, power fields); 808/1,620 components | Cards expose only generic maximum; fitting model ignores it | Foundry direct | High as fields |
| Distortion disable behavior | Ship scoring records expose `distortionDisablePercentage=0.8`; this is scoring metadata, not sufficient proof of actual disable transition. Component power fields suggest behavior but not ordering | Alpha maps distortion to energy; no disable state | Cannot confirm from data alone | Low |

## Export coverage observed

- `ship_weapons.json`: 189 records; 186 ammo XML joins; 181 records with all six damage channel values and penetration thickness; 186 with projectile speed/lifetime and penetration geometry; 181 derived DPS values.
- Direct verification: 1,860 comparisons between exported weapon fields and joined ammo XML produced 0 mismatches.
- `shields.json`: 73 records; 73/73 have HP, regen, both delays, resistance arrays, absorption arrays, and reserve/decay ratios.
- Direct verification: 292 shield field comparisons against XML produced 0 mismatches.
- `components.json`: 1,620 records; 1,203 component health/resistance payloads; 808 distortion payloads; 0 vehicle armor records.
- Foundry vehicle armor directory: 207 XML files; 207/207 contain `SCItemVehicleArmorParams`.
- `ships.json`: 351 records; 0 export `vehicleHullDamageNormalizationValue`, `componentPenetrationDamageMultiplier`, or `fusePenetrationDamageMultiplier`.
- Component-card index: 93 ship weapons, 62 shields, 164 FPS weapons, 36 FPS ammo records, and 882 FPS armor records with combat stat groups. FPS armor is character armor and must not be conflated with vehicle armor.

## Exported but source/semantic uncertainty

- `alphaDamageTotal` and fitting `directWeaponAlpha` are per-projectile channel sums. Launcher `pelletCount` and `damageMultiplier` are omitted; at least several ship scattergun records use `pelletCount="8"`.
- DPS chooses the maximum fire-rate action and ignores pellet count, launcher multiplicity, burst scheduling, charge behavior, capacitor/ammo constraints, and uptime.
- Shield range arrays are positional and unlabeled in XML. Channel mapping is strongly suggested by order but not self-describing.
- `regenTime`, reserve-pool absolute regen/time, minimum power/coolant, calculated range, damage type, and DPS are derived, not direct Foundry fields.
- Vehicle `pierceabilityParams.damageFalloffLevel*` is penetration falloff metadata, not proven distance falloff.
- `vehicleHullDamageNormalizationValue` is a direct ship field but must not be relabeled hull HP without mechanic proof.

## Erkul-contaminated or hardcoded assumptions

- All populated Alpha Threshold ship, weapon, armor, hull, and shield defense profiles are generated from Erkul live/PTU snapshots.
- Alpha's merged source description explicitly combines manual, Erkul, and SPViewer sources. Current manual and SPViewer seed arrays are empty, but the architecture is still non-authoritative.
- `computePassThrough()` hardcodes `(1-resistance)*(1-absorption)`; Foundry does not export a `passThrough` field.
- Alpha uses `passThrough[damageChannel].max`, then computes `effectiveArmorAlpha = weapon.alpha * shieldPassThrough`.
- Distortion is explicitly mapped to the energy channel.
- Armor deflection is assumed to scale linearly with remaining armor: `effectiveThreshold = baseThreshold * armorRatio`.
- Armor damage onset is synthesized from threshold ratios, a fixed transition width (`0.04`), observed breakpoints, interpolation bands, and weapon-name confidence overrides.
- Perseus/Guardian breakpoint entries include both observed and explicitly estimated outcomes; these are not Foundry data.
- When defense profiles are absent, neutral multipliers/passthrough of `1` are used.
- Frontend crafting previews default missing falloff and armor-resistance values to zero/physical fallbacks for visualization; they are not authoritative combat simulation values.

## Missing Scintel fields and recommended generator changes

Do not hand-edit generated JSON. Change generators and regenerate.

1. Add a vehicle-armor registry to the fitting component extraction generator currently present at `D:\Moonbreaker\scripts\fitting_phase2_components.py` (or move/restore that generator under Scintel first so ownership matches its output). Add `entities/scitem/ships/armor` to `SOURCE_DIRS` and export:
   - armor entity identity/source path;
   - `SHealthComponentParams@Health`;
   - `SCItemVehicleArmorParams.damageMultiplier` channels;
   - `armorPenetrationResistance@basePenetrationReduction`;
   - `penetrationAbsorptionForType` channels;
   - `armorDeflection/deflectionValue` channels;
   - the full `healthCurve` node and LUT/reference data if any become populated;
   - component damage resistances separately from armor gameplay multipliers.
2. Update the ship extraction generator that owns `ships.json`/`ship_hardpoints.json` (the current outputs name a phase-1 extractor, but that source script is not present in `D:\scintel\scripts`; a similarly named copy exists at `D:\Moonbreaker\scripts\fitting_phase1_extract.py`) to export direct `VehicleComponentParams` fields with provenance:
   - `vehicleHullDamageNormalizationValue`;
   - `componentPenetrationDamageMultiplier`;
   - `fusePenetrationDamageMultiplier`;
   - `criticalPartExplosionChance`;
   - relevant engineering flags, while separating base-player records from AI variants.
3. Update `D:\scintel\scripts\fitting_phase2_ship_weapons.py` and the component-card generator to export launcher/action structure:
   - `SProjectileLauncher@pelletCount`, `damageMultiplier`, `ammoCost`, projectile type;
   - launcher count and association with each fire action;
   - burst/charge/toggle data needed to distinguish per-projectile damage, per-trigger alpha, sustained DPS, and burst DPS.
4. Promote `pierceabilityParams.damageFalloffLevel1/2/3` to explicit documented fields rather than leaving them only in an opaque nested object. Do not label them distance falloff without proof.
5. Make phase 4 actually consume `ship_weapons.json` (or remove it from required inputs) and add schema/version/generated-at compatibility checks so stale `components.json` cannot silently be the combat source.
6. Preserve shield resistance/absorption arrays with their raw index and exact XML path. Add channel names only with an explicit confidence/provenance marker until the ordering is independently confirmed.
7. Export the complete `SDistortionParams` payload for every equipped component and preserve resource/power state links. Do not implement disable behavior from `distortionDisablePercentage` alone.
8. Add per-field provenance to fitting registries, matching the stronger source-file/source-field metadata already used in the component-card index.

## Mechanics that cannot be confirmed from these data alone

- Exact shield resistance/absorption/passthrough formula and whether values interpolate with power allocation or shield state.
- Whether shield and armor mitigation are additive, multiplicative, sequential, or channel-specific in another order.
- How projectile penetration distance/radii, thickness, falloff levels, armor penetration reduction, and ship component/fuse multipliers combine.
- Whether damage that penetrates armor also reduces armor HP, hull/part HP, and component HP in the same event, and how it is apportioned.
- Authoritative ship hull HP and the aggregation of hull parts/vital parts from the currently extracted Foundry record set.
- Armor deflection health-curve behavior. Current Alpha linear scaling is not proven by the empty `healthCurve useLUT="0"` nodes.
- Distortion accumulation target selection, threshold transition, disable duration, recovery, and power behavior.
- Runtime effects of power/capacitor allocation, shield faces, reserve pools, repair, wear, temperature, and resource networks.

## Verification performed

- Searched Moonbreaker TypeScript/TSX/MTS/Python/server files for damage, alpha, DPS, shields, armor, penetration, passthrough, hull, health, component damage, and distortion consumers.
- Traced fitting API routes from `FittingPage.tsx` through `fitting.service.ts` to `D:\scintel\api\fitting`.
- Read the Alpha Threshold source adapters, merged data assembly, generated profile importer, state hook, calculation functions, observed breakpoints, and direct display consumers.
- Inspected Scintel fitting generators, extraction reports, component-card generator audits, and current generated payload shapes/counts.
- Searched local Foundry XML for all requested mechanics and inspected representative Gladius, Perseus, Bulwark, ship weapon, vehicle ammo, armor, ship, and component records.
- Programmatically compared 1,860 exported weapon values and 292 shield values against their joined Foundry XML sources; no mismatches were found.
- Confirmed 207/207 vehicle-armor records contain `SCItemVehicleArmorParams`, while current fitting components contain zero armor records.
- Confirmed current Scintel ship records omit all three inspected direct hull/penetration multiplier fields.
- Confirmed the Moonbreaker worktree already contained unrelated user changes before this audit; none were modified.

## Intentionally not touched

- No UI, CSS, routes, or runtime behavior changed.
- No generated JSON was edited or regenerated.
- No persistence, auth, Supabase, Neon, Drizzle, inventory, build queue, saved blueprints, reserves, mining, or crafting state was modified.
- No external calculator was used as an authoritative source.
- No existing user-modified file was changed.

