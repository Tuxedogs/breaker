# Breaker mockup: API endpoint to UI element trace

**Audit date:** 2026-11-03  
**Status:** Documentation only. **No endpoint wiring, HTML changes, React changes, migrations, deployments, or API calls performed.**  
**Review workspace:** `D:\Moonbreaker-mockup-current` (branch `codex/breaker-mockup-migrate-20261102`). Main repo `D:\Moonbreaker` is a **read-only reference** for this audit because it has pre-existing uncommitted work.

## 1. What is the mockup we are mapping?

| Source | Role / observed state | Decision |
| --- | --- | --- |
| `C:\Users\shane\Downloads\Breaker_V29_Artwork_API_Contract_Pass.html` | Newest standalone **API-contract** pass; Mining and Crafting snapshot/public adapters, other pages fixture/probe only | **Primary element/contract map** |
| `C:\Users\shane\Downloads\files\Breaker_V27_Responsive_Integrated.html` | Later responsive/interactive integration with EHP fitting and Mining artwork, but **zero `/api/` references and zero `fetch(` calls** | **Responsive element cross-check, not an API integration** |
| `C:\Users\shane\Downloads\Breaker_V28_API_Contract_Pass.html` | Predecessor to V29's API bridge | Historical reference only |
| `D:\Moonbreaker-mockup-current\src` | Production-oriented React components, stores, and adapters | Functional implementation/source-of-truth reference |
| `D:\Moonbreaker\docs\breaker-mockup-migration.md` | Current uncommitted migration checkpoint; V29 standalone artifact, body-layout migration still outstanding | Read only; do not overwrite |

**Version warning:** V27 Responsive and V29 API are distinct standalone documents, not a known merged successor chain. Do not implement against the older appearance merely because one filename contains "Responsive." Confirm the approved composition before integrating; carry the V27 tablet/mobile behaviors into the final version without regressing V29 Crafting and Mining.

**Existing V29 behavior, verified in HTML source:**

- `apiSnapshot()` runs at startup and switches Mining/Crafting from illustrative fixtures to embedded published snapshot data. `apiLive()` only works if the HTML is served from the Breaker origin; `file:` cannot contact the API.
- `apiLive()` fetches `GET /api/mining/location-materials`, `GET /api/crafting/recipes/index`, then `POST /api/crafting/recipes/batch`. **Recipe enumeration is restricted to the intersection of indexed GUIDs with the embedded snapshot, capped at 100.** It does not browse the whole live recipe catalog.
- `apiMapMining()` maps row identity and basic location/material data. `apiProfile()` renders fielded rows for quality, encounter rank, composition, and trace material subrows. Signatures use the mockup's reference preset (`signatureCell`), **not a confirmed per-location API signal**.
- `apiMapRecipes()` maps recipe IDs/names, kind/grade/size, material quantity, material form/unit/minimum quality, rewards array, and craft time. The Crafting page still computes **UI-only averages**; it does not derive verified output quality or modifier results.
- Build Queue, Inventory and Fitting **stay demo data on their pages even when the public Mining/Crafting mode is "LIVE API."** The API readiness panel may probe other routes, but probing does not bind those results into those pages.
- `apiContracts` in V29 lines 2314-2325 is a *limited route checklist*, not an exhaustive product-to-element contract. This document expands it.

## 2. Status legend and architectural rules

- **A / adapted:** Standalone V29 already transforms response data into a visible element (may still be snapshot-limited).
- **T / target:** Element exists but is fixture-only, computed using demo values, or not using the intended endpoint.
- **P / probe:** Endpoint is read/checked for shape or provenance only; page content is unchanged.
- **M / missing:** No appropriate dedicated element/behavior in the reviewed V29 mockup. **Document, do not invent or add it now.**
- **S / shared:** API/service data belongs to existing production store/selector; must not be fetched directly from a mockup view.
- **N / no page:** The app has an endpoint but this five-module mockup has no corresponding product surface.

Authority: `docs/api-data-flow-runbook.md`, `AGENTS.md`, `docs/generated-data-manifest.md`; current page code remains the behavior authority. Use accepted server-data via routed APIs, not `public/api` or raw JSON files. Keep zero, unavailable, missing and loading distinct. Never prefix/suffix quality with "Q". Keep authenticated user state private; do not use static fixtures as replacement for real mutation or reservation rules.

## 3. Mining: API fields to visible elements

**Mockup owners:** `render()` / `renderProfile()` (approximately V29 lines 1292-1298), `apiMapMining()` (2329-2338), `apiProfile()` (2399-2415).  
**Real owners:** `src/features/mining/staticMiningIndex.ts`, `recommenderAdapter.ts`, Mining components under `src/components/industry/mining/`.

| API + method | Intended target / exact mockup element | Source mapping and current state | Status |
| --- | --- | --- | --- |
| `GET /api/mining/location-materials` | `#locations` location rows, `#location-count`, `#materials` filter, `#profile-region-label`, `#profile-content`, two material tables | `systemKey + locationKey` grouped into list; `locationDisplayName`, `systemDisplayName`, `materialName`, `resolvedMineableClass`. V29 already adapts rows. | **A** |
| Same route | Profile `.data-table` Material / Method / Encounter rank / 800+ / 900+ / Composition / Sigs | `candidateMaterialEncounterRank` (+ `OutOf`); `qualityThresholdChancesWeighted['800','900']`; `compositionAveragePercentage`; `traceMaterialDetails[]` (`materialName`, `minPercentage`, `maxPercentage`). Current V29 `apiProfile` reads these fields. **Sigs are a separate static preset**. | **A**, partial for signatures |
| `GET /api/mining/encounter-rankings` | Rank indicators beside locations and "Encounter rank" column | Existing rank UI, but the locations' route ordering and competitor/rank visuals still depend on fixture rendering; do **not** substitute location-vs-material rank or coverage for server encounter rank. Avoid a second fetched ranking if `location-materials` already delivers the required rank. | **T/S** |
| `GET /api/mining/material-quality` | Quality probability columns and quality-aware location detail | `800+` and `900+` are already visible in published material profile from location rows. Full quality distribution/context has **no distinct UI panel**; evaluate whether existing detail requires more than threshold values. | **A** thresholds; **M** full distribution |
| `GET /api/mining/location-distribution` | Location-detail distribution breakdown | No explicit distribution histogram, confidence/source breakdown, or dedicated frequency detail panel. Current route strategy/chips should not be relabeled as distribution data. | **M** |
| `GET /api/mining/location-hierarchy` | System selector `#systems`, location navigation and breadcrumb | System and list elements exist. Hierarchy is *not* a wired tree; current flattened rows are grouped locally. Dedicated parent/child browse control absent. | **T** flattened; **M** hierarchy navigation |
| `GET /api/mining/lagrange-groups`; `GET /api/mining/lagrange-children` | Location selector/list grouped by Lagrange parent and physical child | List exists, but no explicit grouped parent/child tree or child identity badges in the V29 layout. Never invent child identity from a parent label. | **M** dedicated grouping/badges |
| `POST /api/mining/recommendations` | `#route-modes`, ranking/order in `#locations`, coverage indicators `.loc-coverage`, location selection/profiles | Existing visual controls; actual POST **not called** by V29. Required request state: `requiredMaterials`, `selectedQuality`, `allowedMiningMethods`, `rankingMode`. Preserve real scoring/coverage/fallback semantics from `recommenderAdapter` rather than deriving them in JavaScript. | **T** |
| Material identity reference (via `GET /api/crafting/reference/material-identity`) | Mining ↔ Crafting material navigation/filter keys | Visible mineral names and a Crafting-to-Mining link exist. Actual normalized identities must use shared canonicalizer, not `craftMiningKey()` as production authority. No need for a separate visible card. | **S** |

**Missing Mining UI contracts:** dedicated quality-distribution detail, Lagrange parent/physical-child distinction, published-versus-fixture signature provenance, explicit recommender loading/failure state, and a way to communicate method eligibility/quality-band applicability without repurposing the encounter-rank column. The V29 notes correctly caution that encounter rank is not spawn percentage and signature chips are presets.

## 4. Crafting: API fields to visible elements

**Mockup owners:** `renderCraft()` (1569-1612), `craftSourceBlock()` (1533+), `craftScenario()` (1554), `craftStatTable()` / `craftModifierRows()`.  
**Real owners:** `src/lib/craftingRecipesApi.ts`, `craftingBlueprintSourcesApi.ts`, `craftingReferenceApi.ts`, `componentCardIndexApi.ts`, shared crafting engine/components.

| API + method | Intended target / exact mockup element | Source / gap | Status |
| --- | --- | --- | --- |
| `GET /api/crafting/recipes/index` | `#craft-search`, `#craft-material-search`, `#craft-material-results`, `.cr-browser-panel` / `.cr-recipe-row` | Recipe identity/kind index. V29 adapted, but **live enumeration only loads GUIDs matching the baked snapshot (max 100)**. No true live full-catalog enumeration yet. | **A**, catalog incomplete |
| `POST /api/crafting/recipes/batch`; `GET /api/crafting/recipes/:id` | Selected blueprint index row, `.cr-hero`, `.cr-workbench-materials`, `.cr-slider-row` | `blueprintGuid`, `displayName`, `componentType`, `size`, `grade`; each material `materialName`, `quantity`, `slot`, `unitType`, `minQuality`, `materialForm`. V29 adapts these to recipe UI. Single-ID fetch has an existing detail target but is not the V29 live loading path. | **A/T** |
| `GET /api/crafting/blueprint-sources?blueprintGuid=...`; `POST /api/crafting/blueprint-sources/batch` | `craftSourceBlock()` acquisition block and store-availability rows `.cr-store-row` | The source block **exists**, but uses `craftAcquisition` fixture data/fallback. Distinguish verified mission/store sources and unknown from fixture availability. | **T** |
| `GET /api/crafting/blueprint-sources/index` | Blueprint source filter/context | Source display block exists for selected recipe. **No dedicated source-filter facet in the Recipe Filters panel**. | **M** for filtering, **T** detail |
| `GET /api/crafting/blueprint-rewards/release-state`; `GET /api/crafting/blueprint-rewards/missions`; `GET /api/crafting/blueprint-rewards/missions/:contractId` | Blueprint acquisition and mission reward information | Generic source block exists. **No mission reward detail/drilldown panel** or explicit release-state badge. Do not infer available stores or mission eligibility. | **M** detailed reward UI |
| `GET /api/crafting/reference/quality-quantization`; `GET /api/crafting/reference/material-quality-quantization` | Eight-band `.cr-quality-range`, `.cr-tick-row`, exact quality input in `.cr-slider-row` | Controls exist, but bands/representative values come from local `craftBands`, not routed reference. Production must preserve quantization and material-specific thresholds. | **T** |
| `GET /api/crafting/reference/crafted-properties` | `.cr-stats-table`, `.cr-mod-table`, `.cr-stat-strip` | Visible statistics, modifier rows, and comparison affordances exist. V29 published recipes **do not supply actual output projections**; `craftScenario` is a UI-only average and sample `craftEffects` are not canonical. Use shared calculator/component-card projections. | **T**; source calculations missing |
| `GET /api/crafting/component-cards/index`; `GET .../facets`; `GET .../browse`; `GET .../:id` | Performance summary, detailed component/stat inspector, catalog selection shared with Fitting/Build | Some tables and selector panels exist, but V29 does **not** load authoritative component-card data. Full arrays/curves and subtype data have no confirmed rendering contract; do not flatten curve data into scalars. | **T** with **M** subtype/curve presentation |
| `GET /api/crafting/reference/material-identity` | Filtering, Crafting → Mining link `data-action="craft-open-mining:..."` | Existing element and navigation; shared normalization required before implementing. | **S** |
| Crafting-to-Build queue action | Queueing/craft decision controls | Mockup contains actions and selection state, but persistence is demo-only; must use existing authenticated Build Queue/store operations and preserve real recipe GUID/quantity/quality. | **T/S** |

**Missing Crafting UI contracts:** full authoritative recipe browsing beyond embedded snapshot intersection, blueprint source filtering, structured mission reward details, real material modifier/projection states for unavailable/unextracted values, typed chart/curve presentation where needed, and an explicit distinction between UI input average and calculated output quality. An existing table is **not** evidence that an API-backed formula has been implemented.

## 5. Build Queue: API fields to visible elements

**Mockup owner:** `renderBuild()` (1659-1703), `buildRequirement()` / `buildSummary()` (1626-1633).  
**Real owners:** `src/pages/logistics/BuildQueuePage.tsx`, `src/features/buildQueue/buildQueueRequirementsApi.ts`, logistics store and `buildQueueReservations.ts`. **Do not copy mockup arithmetic into production.**

| API + method | Intended target / exact mockup element | Source / gap | Status |
| --- | --- | --- | --- |
| `GET /api/user/build-queue` (authenticated) | `.bq18-list`, `.bq18-item`, `.bq18-build-hero`, status and completion metrics | All elements exist; `queue` is demo data. Read only via established authenticated state loading. **Do not reintroduce legacy direct mutation behavior at this route.** | **T/S** |
| `POST /api/build-queue/requirements` | Material planning table `.bq18-table`: Needed / Allocated / Free / Shortfall, readiness counts, contextual warnings | Visual target exists; `buildRequirement()` makes fixture arithmetic from `queue` and `boxes`, not server requirements. Requirements must come from routed calculator and existing derived readiness/read models. | **T/S** |
| `GET /api/user/inventory` plus existing online persistence operations | Warehouse vs Pull lots `.bq18-view`, `.bq18-lot-list`, `.bq18-reserves`, `.bq18-location-source` | Targets exist and show demo physical lots/reservations. Preserve per-lot identity, available vs allocated vs reserved, quality, and physical-shortage semantics; no invented lot splitting. | **T/S** |
| Recipe `index`/`batch` and component-card detail | Selected build name, recipe material requirements, product stats/catalog chooser | Browser/"Add craft" affordances exist. Recipe identity must come from canonical GUID; component-stat detail should reuse fitting shared component cards, not invent a second comparer. | **T/S** |
| Authenticated queue/inventory mutations through current persistence owner | Complete next unit, Duplicate, Remove/Undo, Reserve, Release, move lot | Buttons exist but mutate `queue`/`boxes` in memory. Confirm current persistence owner, optimistic/error behavior and idempotence before implementation. | **T/S** |

**Missing Build Queue UI contracts:** dedicated per-requirement server **warnings/invalid policy reasons** (the existing shortfall notice is not a universal warnings panel), explicit loading/persistence-conflict state, source/build provenance for stat projections, and a typed distinction in UI between planning coverage versus actual physical reservation/readiness when both are available. Material quantity unit consistency requires verified service contracts.

## 6. Inventory: API fields to visible elements

**Mockup owner:** `renderInventory()` (1709-1712).  
**Real owners:** `src/pages/logistics/InventoryPage.tsx`, `src/lib/userOnlinePersistence.ts`, shared logistics store.

| API + method | Intended target / exact mockup element | Source / gap | Status |
| --- | --- | --- | --- |
| `GET /api/user/inventory` (authenticated) | `.inv-location-panel` / `.inv-drop-location`, `.inv-lots-panel` / `.inv-tiles` / `.inv-lot-tile`, `.inv-inspector-panel` | Locations, per-lot material, quality `.inv-quality-badge`, quantity SCU `.inv-tile-count`, selected item detail and material totals all **exist** but use `warehouseLocations` and `boxes` fixtures. | **T/S** |
| `PUT /api/user/inventory/sync` | Changes to inventory tiles, location transfers, and inspector after sync | Controls exist for transfers and selection, but **no dedicated persisted/sync/conflict/error indicator** in mockup. Production uses shared online coordinator and must not silently ignore failures. | **M** sync status; **T** controls |
| `POST /api/user/inventory/stacks`; `PATCH, DELETE /api/user/inventory/stacks/:id` | Per-lot create/edit/delete actions | Grid and inspector exist, but V29 has no dedicated **add-lot or edit-lot form**; its actions primarily select, reserve demo lots and drag between locations. Physical-box language must replace exposed backend "stack" vocabulary. | **M** add/edit controls |
| `DELETE /api/user/inventory/locations/:id` | Location manager | Location list exists; **no delete-location confirmation/control** in V29. | **M** |
| `DELETE /api/user/inventory/build-queues/:id` and existing online Build Queue item persistence | Cross-queue availability/reservation effects on inventory | Reserved/available chips exist, but no cross-queue ownership inspector or conflict detail for why a lot cannot move. | **T** flag; **M** ownership detail |
| Inventory ↔ Build Queue allocation/reservation store | `.inv-reserve-flag`, `.inv-tile-state`, `.inv-tile-mark`, material totals | Flags exist but currently demo boolean state; current domain reservation owner must supply real assignments and quantities. | **T/S** |

**Missing Inventory UI contracts:** authenticated loading/error/sync indicator; create/edit/delete forms and location deletion confirmation; explicit reservation owner and conflict explanation. Do not invent production lot totals from a visual tile count. Preserve independent per-box quality and quantity.

## 7. Fitting and SCFrame: API fields to visible elements

**Mockup owners:** `renderFitting()` (~2053+), `fit19Inspector()`, `ehpDiagramMarkup()` (~1982-1997), `ehpImportMarkup()`, `ehpParseData()`.  
**Real owners:** `src/pages/FittingV2Page.tsx`, `src/lib/fitting/fittingApi.ts`, shared fitting component store, compatible-component and loadout hooks. **SCFrame is a separate geometry/region source, not a fitting game-stat endpoint.**

| API + method | Intended target / exact mockup element | Source / gap | Status |
| --- | --- | --- | --- |
| `GET /api/v1/fitting/meta` | Build/channel provenance near `.fit19-shipselect`, ship context or diagram provenance | V29 probes `meta.channel` + `meta.buildId` in API panel but ship UI remains "DEMO". No persistent in-page dataset/build label or mismatch state. | **P**; **M** in-page provenance |
| `GET /api/v1/fitting/ships` | `#fit19-ship` ship picker, ship role/airframe box | Picker exists, driven by `fit19Ships` fixture. Use real pagination/index and canonical ship IDs. | **T** |
| `GET /api/v1/fitting/ships/:shipId` and `.../hardpoints` | `.fit19-system-list`, `.fit19-slot-groups`, slot count, size, category | All target sections exist. Fixture hardpoint and category coverage is illustrative; use fetched topology and mount hierarchy. | **T** |
| `GET /api/v1/fitting/ships/:shipId/loadout` | Installed equipment cards `.fit19-slot-list` and `.fit22-readout-body` | Cards exist; `fit19.installed` uses fixture IDs. Preserve installed item identity, even when extracted detail is unavailable. | **T** |
| `GET /api/v1/fitting/ships/:shipId/calculations`; `POST /api/v1/fitting/calculate` | `.ehp-stats` / `.ehp-stat-row`, detail stats, power allocation/projections | Summary/detail surfaces exist but use example values and client fixture estimations. **Do not invent power/EM/IR/thermal/calculation values.** Arrays/curves need a typed representation or documented missing element. | **T**, **M** curve-specific UI |
| `GET /api/v1/fitting/ships/:shipId/ports/:portId/compatible-components` | Mount-selected equipment chooser, status/reason in `fit21Details()`, instant swap affordance | Selector and compatibility callouts exist but use local fixture rules. Reuse the real compatible-components service and canonical port IDs. | **T/S** |
| `GET /api/v1/fitting/components`; `GET /api/v1/fitting/components/:componentId` | Equipment list/filters, detail inspector, typed comparison rows | Table/inspector exist; use shared fitting component store, not direct page-level detail calls. Keep stat direction and provenance. | **T/S** |
| `POST /api/v1/fitting/validate` | Selected replacement/status, slot validation, actionable fit control | API-contract panel lists route as pending. Local `fit21Compatibility()` is illustrative. Full server-provided invalid reasons/recommendations need a clearly attached error explanation on selected slot. | **T** reason surface |
| `GET /api/v1/fitting/ammo/:ammoId` | Weapon/missile detail | Generic equipment inspector exists, but no dedicated ammo ballistic/quantity/supply detail view verified in V29. | **M** specialized ammo detail |
| **SCFrame local asset** `overlay_data.js` and per-view WebPs | `#ehp-stage` / `#ehp-image`, `.ehp-hit` SVG, view tabs, filter chips, hardpoint inspector | Import surface **exists**; `ehpParseData()` parses `window.EHP_DATA` JSON without executing arbitrary JS; view images are separate files. **Not an API response**, and not authoritative for gameplay stats or replaceability without fitting join. | **T** local import |
| SCFrame pose/cutaway variant metadata | Ship diagram view chooser / selector | Standard front/top/bottom/port/starboard are present. **No dedicated intact-vs-cut, stowed-vs-deployed, or forward/rear oblique pose switch** in V29. Recent Corsair render variants should not be silently mapped into legacy "studio" view. | **M** pose/cut selectors |
| Authenticated fitted-build saving | Save/revert/loadout ownership | Selection/swap interactions exist; persistence ownership and visible save/dirty/error status are not established in V29. | **M/T** |

**Missing Fitting UI contracts:** build/channel provenance in page; typed unsupported/absent component states and compat reasons; dependable curves; ammo detail; SCFrame image/view pose and cut variant selectors; verified region-to-port join; a visible failure state when render geometry and fitting dataset disagree. **Do not automatically treat every SCFrame physicalized prop as replaceable equipment.**

## 8. Home, Refinery and other endpoints with no matching mockup surface

| Endpoint / source | Current V29 destination | Decision |
| --- | --- | --- |
| Home launcher | Five slices for Mining, Crafting, Build, Inventory, Fitting; links only | No API data card/metric needed for launcher unless explicitly specified. Existing production homepage migration should preserve working destinations. |
| `GET /api/crafting/reference/refinery-yields` | **No dedicated Refinery page in the five-module mockup** | **N**. Production Refinery Planner exists separately. Do not force refinery data onto Mining or Crafting without new approved layout. |
| `GET /api/missions/browser`, `/offer/:offerKey`, `/family/:familyId`, `/variant/:variantId` | No Mission Browser screen in the selected mockup | **N**. Blueprint acquisition source block can link to known mission sources, but is not a mission browser. |
| `GET /api/crafting/blueprint-rewards/missions...` | Craft source section only | Detail drilldown missing; record design gap. |
| User Blueprint Tracker and saved-blueprint endpoints | No independent Tracker page in the selected mockup | **N**. Do not pretend saved stars in Mining equal account-backed saved blueprints. |
| Authentication/session/profile | No dedicated authenticated data-context element in V29 page body | **M**. At minimum later implementation needs consistent private-data gating and failure feedback. |
| Dataset/source provenance | API audit overlay, not persistent module chrome | **M** for per-module channel/build identity where relevant; avoid adding decorative version labels without approved requirement. |

## 9. Missing element ledger for future implementation

These entries must remain **documentation**, not placeholder UI additions.

| ID | Page | Missing element/behavior | Existing nearby target | Why it matters |
| --- | --- | --- | --- | --- |
| M-01 | Mining | Lagrange parent/child hierarchy with physical child badges | `#locations` | Prevent false location identity or misleading grouping. |
| M-02 | Mining | Detailed quality/distribution context | `#profile-content` | Published quality model exceeds two threshold columns. |
| M-03 | Mining | Explain source of signature chips (preset vs actual scan) | "Sigs" column | Prevent false signal provenance. |
| M-04 | Mining | Server recommender loading/error/eligibility and ranking reasons | `#route-modes` / `#locations` | Route sorting cannot be a fixture rank under a live badge. |
| M-05 | Crafting | Full published recipe browse/pagination beyond snapshot intersection | `.cr-browser-panel` | V29 live is limited to a preselected GUID set. |
| M-06 | Crafting | Blueprint source filter plus reward state/missions drilldown | `craftSourceBlock` / `.cr-filter-panel` | Acquisition requires source-specific evidence. |
| M-07 | Crafting | Canonical modifier and output calculation provenance | `.cr-stat-strip`, `.cr-stats-table`, `.cr-mod-table` | UI-only average must never masquerade as crafted quality. |
| M-08 | Crafting/Fitting | Typed subtype stat array/curve inspector | Existing stat tables | Some source values cannot be flattened into scalar rows. |
| M-09 | Build Queue | Domain warnings/invalid-material reasons | `.bq18-table` shortfall notice | Requirement warnings ≠ shortage. |
| M-10 | Build Queue | Explicit persistence/conflict/rollback state | Queue action toolbar | Buttons should not silently imply committed changes. |
| M-11 | Inventory | Add/edit physical lot forms and guarded delete | `.inv-inspector-panel` | Grid is inspect/transfer/reserve only. |
| M-12 | Inventory | Auth/sync/conflict status | `.inv-location-panel` and toolbar | Data cannot be treated as saved merely because a tile moved. |
| M-13 | Inventory | Reservation owner/conflict reason | `.inv-tile-state` | Reserved flag is insufficient for cross-queue allocations. |
| M-14 | Fitting | In-page channel/build provenance | Ship context | Avoid mixing fitting versions/cache identities. |
| M-15 | Fitting | Full server validation reason and unavailable-state display | Slot inspector | Missing data must not be displayed as zero or compatible. |
| M-16 | Fitting/SCFrame | Pose/cutaway view selector and validated equipment-region join | `#ehp-stage` view tabs | Current local overlay UI does not describe all new ship render variants. |
| M-17 | Fitting | Dedicated ammo stat/details where applicable | Generic equipment inspector | Ammo detail endpoint has no confirmed specialized target. |
| M-18 | Product | Refinery Planner page | None | Existing product area, missing from five-slice mockup. |
| M-19 | Product | Mission browser/Blueprint Tracker layouts | Craft source, homepage | Distinct surfaces, not hidden API fields. |

## 10. Suggested later implementation order (no work authorized now)

1. **Lock mockup version composition.** Confirm V29 API/Crafting/Mining + accepted V27 Responsive/EHP elements; do not implement against a stale HTML copy.
2. **Public read-only data first.** Document a complete Mining recommender and recipe-index/batch binding pass, preserving accepted rankings and quality semantics; then blueprint-source and component-card projection.
3. **Authenticated user state via existing owners.** Build Queue and Inventory should consume real logistics selectors and online persistence, not new page-local fetches or demo reservation arithmetic.
4. **Fitting via existing shared store.** Ship/loadout/compatibility/calculation sources and SCFrame region-to-port reconciliation should be a join, with independent geometry and game-stat provenance.
5. **Add only approved missing elements.** Prioritize M-01, M-05, M-07, M-09, M-12, M-14, M-16. Other gaps can remain documented.
6. **Test later, not in this documentation pass.** For each mapping: valid response, empty, zero, unavailable, offline/error, loading, auth denial, build/channel mismatch, and mobile/tablet layout. No network calls should be required to render offline fixtures.

## 11. Source trace index

**Primary mockup** `Breaker_V29_Artwork_API_Contract_Pass.html`: location/filters ~1194-1298; Crafting ~1457-1616; Build Queue ~1618-1703; Inventory ~1709-1712; Fitting/EHP ~1714-2130; API bridge and contract checklist ~2311-2455.

**Current endpoint authority** `D:\Moonbreaker-mockup-current\docs\api-data-flow-runbook.md`, especially "Source-to-endpoint map" and "Endpoint catalog."

**Runtime browser clients:** 
- Mining: `src/features/mining/staticMiningIndex.ts`, `recommenderAdapter.ts`.
- Crafting: `src/lib/craftingRecipesApi.ts`, `craftingBlueprintSourcesApi.ts`, `craftingReferenceApi.ts`, `componentCardIndexApi.ts`.
- Build Queue: `src/features/buildQueue/buildQueueRequirementsApi.ts`, `src/pages/logistics/BuildQueuePage.tsx`, logistics store.
- Inventory/user: `src/lib/userOnlinePersistence.ts`, `src/pages/logistics/InventoryPage.tsx`, `OnlinePersistenceCoordinator.tsx`.
- Fitting: `src/lib/fitting/fittingApi.ts`, `src/pages/FittingV2Page.tsx`, shared fitting component store.
- React Mining/Crafting page entry files under `src/pages/industry/` are tiny reexports; actual page components live in `src/components/industry/mining/` and `src/components/industry/crafting/`.

**Limits of this audit:** code and HTML were read, not run against authenticated/production endpoints. Endpoint availability, schema version, server latency and end-to-end UI behavior are **not** certified by this document. Every "target" means an existing visual element in standalone V29, not a completed production binding. The main workspace had uncommitted work and was deliberately not changed.
