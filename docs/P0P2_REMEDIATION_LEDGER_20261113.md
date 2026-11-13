# Breaker P0–P2 remediation ledger (2026-11-13)

Origin: user-supplied execution contract (SC Toolkit competitive audit, 2026-11-13).

## Environment

| | Original | Remediation |
|---|---|---|
| Moonbreaker | `D:\Moonbreaker-mockup-current`, `claude/mining-materials-panel` @ `ae395e196`. WIP left untouched: `ComponentRecipeTable.tsx`, `crafting-detail-refactor.css`, and 2 untracked `public/assets/breaker-home/*` files | `D:\Moonbreaker-p0p2-20261113`, `claude/p0p2-remediation-20261113` |
| Scintel | `D:\scintel`, `agent/source-ptu5-placement-env-20261106` @ `a0df49f` (3 untracked paths) | `D:\scintel-p0p2-20261113`, `claude/p0p2-mission-catalog-20261113` |
| Dev server | :5173 = vite fixtures from `D:\Moonbreaker-unified-review-20261110` (not touched) | — |

Datasets published at start (Moonbreaker `server-data`):

| Dataset | Identity |
|---|---|
| Mission pointer | generation `c694366121fb3bcedf50739f`, tuple 3/4/1, source build `4.10.191.2241-12519617`, snapshot 2026-08-28, 2,513 contracts (781 blueprint) |
| Blueprint sources | shaped from mission generation `f5124d3cfe92c608ea5749e9` (**stale**) |
| Crafting recipes / component cards | no build ID recorded; `sourceGeneratedAt` 2026-09-11 (matches the Scintel `.12` era) |
| Fitting | LIVE `4.10.191.2241-12519617-scintel.12` |

Latest Scintel LIVE build: `4.10.200.58746-live.13165946`. It is not published to Moonbreaker.

Test baseline (remediation tree): `missions:test` 72/72, `crafting:test` 68/68, `fitting:test` 134/134.

## Phase 1 — mission extraction completeness (Scintel)

- **Root cause:** Scintel commit `e36a626` moved `if not blueprint_rewards: continue` ahead of
  `mission_contracts.append` in `build_mission_blueprint_rewards_api.py`. This collapsed the
  catalog to the blueprint subset. Enumeration and source availability were unchanged.
- **Fix:** Scintel `0303322` adds an explicit `--catalog-scope full|blueprint` (default `full`)
  and a reproducible subset digest.
- **13165946 counts:** full scope 2,559 contracts (1,770 non-blueprint); blueprint scope 789,
  record-identical to the published build.
- **Effect:** 148 blueprint missions need prerequisite tags that only non-blueprint missions produce.
- Details: Scintel `docs/missions/MISSION_CATALOG_SCOPE_20261113.md`.

## Phase 2 — published dataset consistency

- **Finding:** Moonbreaker `9625b9650` moved the mission pointer `f5124d3c → c6943661` without
  re-shaping blueprint sources. Both generations come from the same snapshot and have identical
  `variantOfferKeys`, so all 781 contract links and 348 offer links still resolved. The
  inconsistency was metadata only. `crafting:blueprint-sources:verify` failed on it, while
  `api:check` passed.
- **Gap:** the Scintel publisher moves the pointer (`missions:shape`) before re-shaping blueprint
  sources, and it never verified the result.
- **Changes:**
  - `scripts/missions/publication/dataset-consistency.mts` (+ 9 tests). It checks:
    - pointer ↔ generation identity and tuple
    - mission source snapshot ↔ generation snapshot
    - reference-index build ↔ mission source build (cross-build join)
    - blueprint sources ↔ active generation (index and every record file)
    - reverse links: contract IDs ↔ variants, offer keys ↔ offers
    - blueprint GUIDs ↔ recipes (warning)
    - fitting pointer ↔ build directory

    Datasets without a build ID are reported as `unrecorded`.
  - `api:check` now fails on any consistency error.
  - `npm run data:generations:report [-- --out file]` writes the full report.
  - Scintel `917168a`: the publisher runs `crafting:blueprint-sources:verify` and `api:check`
    after shaping. On failure it restores the previous pointer, blueprint sources, and mission
    source. New generations stay immutable and unreferenced, so rollback is a pointer restore.
  - The blueprint-source projection was re-shaped from the **already active** generation. All
    1,519 files are semantically identical apart from `generationId`, `generatedAt`, and
    `sourceRoot`. No new source data was activated.
- **Gate:** report `ok: true`, 0 errors. 1 warning: 3 mission-rewarded blueprints have no
  published recipe (`c9c67e69…`, `d31e71e2…`, `00eabb01…`).
- **Not done (approval required):** publishing the Phase 1 full catalog or the 13165946 build.

## Phase 3 — Missions interface restored

- **Cause:** `ced525867` (2026-10-29, legacy retirement) deleted `MissionBrowserPage` and pointed
  `/industry/missions[/:missionSlug]` at `RedirectToCrafting`. The mission APIs, solvers, and
  `src/lib/mission*` were kept.
- **Restored from `ced525867^`:** `MissionBrowserPage.tsx`, its six stylesheets,
  `tests/ui/mission-offer-browser.spec.ts`, and `playwright.missions.config.ts`. The routes use
  `ShellRoute`/`AppPageShell` again. There is no page header; the filter toolbar is the first element.
- **Style conformance:** the CSS was migrated to `--mb-*` tokens. That meant removing the legacy
  local `--mb-*` redefinitions, plus 118 color literals, 13 raw radii, and 2 raw fonts.
  Decorative per-category hues collapse to `--mb-accent`; good/bad/warn keep their meaning. Mission
  files contribute 0 ratchet violations. `style:check` still fails only on the Mining files
  already in base `ae395e196`, which this work leaves untouched.
- **Behavior changes:**
  - The full catalog is the default. The retired page showed only blueprint and Wikelo offers.
    Its filter remains as `scope=blueprint` ("Blueprint rewards only").
  - Unknown or stale `?offer=` links, and offers hidden by the blueprint filter, now show an
    explicit status instead of rendering nothing.
- **Fixtures:** the fixture server answers `/api/missions/*` and the blueprint-source/reward GETs
  through the real file-backed handlers (`handleMissionsRoute`,
  `handleCraftingBlueprintSourcesRoute`). There is no DB, auth, or user state. MSW passes the offer,
  family, and solver routes through. Superseded: the unfiltered-only `/api/missions/browser`
  special case.
- **Known fixture limitation:** MSW still stubs `/api/crafting/blueprint-rewards/missions` as empty
  for the Crafting/Blueprint Tracker fixtures. Locally, "Blueprint rewards only" therefore narrows
  to Wikelo offers; against the real API it uses the published reward catalog.
- **Dropped:** the restored legacy `tests/ui/mission-browser.spec.ts`. It asserted schema-2
  concept URLs and literal pre-token colors (`rgb(10, 17, 25)`, `7px`) that no longer apply.
- **Updated assertion:** in `mission-offer-browser.spec.ts`, the not-for-release opt-in test now
  takes its offer from published data. `BattagliaStory1` is now localized and released.
- **Gate:** `playwright.missions.config.ts` 11/11 pass. Coverage: direct navigation and refresh, no
  redirect, search, provider and blueprint filters, offer detail, variant selection and deep link,
  stale link, and API 200/404. `lint` 0 errors, `build` OK, `test:playwright-configs` 12/12.

## Phase 4 — Crafting catalog List/Cards and sorting

- **Root cause (sorting):** `RecipeResultsTable` held sort state and sorted only the records it
  received. That was one family's slice of the *current page*, and pagination ran upstream on
  the unsorted list (client and `/api/crafting/component-cards/browser`). Column sorting
  therefore reordered a single page only.
- **Fix:** a shared ordering contract, `src/components/industry/crafting/utils/recipeBrowserSort.ts`.
  - URL params `sort=<column key>&dir=asc|desc`, using the existing family column definitions
    (`value`/`sortValue`).
  - Numeric-aware comparison. Missing values (and families without the column) sort last in both
    directions. Ties break on name, then id.
  - The browser API sorts the full filtered set before slicing, computing keys on the same
    summary records the client renders. The client-side path and the fixture (MSW) browser page
    use the same function.
  - A sort change resets to page 1. Sort state lives in the URL, so it survives reload and deep links.
- **List / Cards:** an explicit desktop toggle (`aria-pressed`, keyboard operable), persisted per
  viewer in `localStorage` (`scintel:crafting:results-view:v1`).
  - Cards reuse the existing compact card markup and art in an auto-fill grid. The selected card
    gets `aria-current`, and a Sort-by select plus direction control appear in Cards view.
  - Below 760px the existing mobile card layout is unchanged and the toggle is hidden.
  - The detail drawer, recipe math, sliders, and quality quantization are untouched.
- **Type-check change (reviewable trade-off):** `tsconfig.node.json` gains `lib: DOM`,
  `types: vite/client`, and the `@/*` path, so the server can import the shared column/sort module.
  At runtime that chain only carries type imports from `fittingApi`. Without this, sharing the
  ordering contract would require moving Fitting types out of `fittingApi.ts`, which is out of
  Phase 4 scope.
- **Tests:**
  - `recipeBrowserSort.test.ts` (4): the URL contract; missing-last in both directions; the real
    browser API with 10-record pages, where the concatenated pages equal one global sort with no
    repeats; and an unchanged result set under sort. Added to `crafting:test` (72/72).
  - `tests/ui/crafting-results-view.spec.ts` (4/4): identical IDs and selection in both views;
    persistence across navigation and reload; sort URL contract, page reset, and identical order in
    both views after reload; keyboard operation.
- **Crafting Playwright suite:** 28/30. The 2 failures (`crafting-mobile` "Open primary navigation"
  button; `compact split` `.dash-sidebar` width = 40) fail identically on clean base `ae395e196`
  (detached baseline worktree), so they are shell regressions that predate this work.
  The previously known failure "sortable source-backed weapon columns and linked blueprint sources"
  now passes, because the Phase 3 fixture mission routes serve it.

## Phase 5 — Fitting resource-network validation

No simulation rules changed. `server/fitting/fittingNetworkValidation.test.ts` (7 tests, now in
`fitting:test`) drives the real `/api/v1/fitting/calculate` route against the pinned LIVE build
`4.10.191.2241-12519617-scintel.12`. Ships: Gladius, Avenger Titan, Cutlass Black, Constellation
Andromeda, Hammerhead, Freelancer MAX. Each uses its stock loadout restricted to the simulation
hardpoint tree, as the Fitting UI sends it.

| Proven by the tests | Evidence |
|---|---|
| Single-pool allocation within reactor capacity | Gladius capacity 16, weapon pool 4, margin = capacity − allocated |
| Minimum operating requirement | Gladius stock nose gun stays offline (0 DPS) below its extracted minimum power input at 1 pip |
| Configuration change re-allocates the pool | Removing the nose gun: 3 → 2 consumers; wing guns 183.3 → 193.5 DPS each; total 366.66 → 387.03 |
| Over-nominal allocation is refused, not extrapolated | Gladius weapons at 3 pips (nominal 2): DPS unavailable, reason "exceeds nominal demand" |
| Zero is distinct from missing | Avenger Titan 15/15 → margin 0, `derived` |
| Turret topology from port ancestry | Turret weapons: Cutlass Black 2, Constellation Andromeda 4, Hammerhead 24, Freelancer MAX 6. Turret DPS stays unavailable without the turret `powerRatioMultiplier`; pilot values are never reused |
| No invented values | Across all six ships, every metric is `derived` (finite, with sources or a formula) or `unavailable` (null, with a reason) |
| Determinism and validation | Identical requests are deep-equal; unknown ports are rejected (400) |

| Not supported (source or contract gap; documented, not modeled) |
|---|
| **Turret power ratio:** ship-wide allocated power, cooling demand, and turret weapon output are unavailable on turreted ships (`ship.resourceNetwork.modifiers.powerRatioMultiplier` is not extracted). |
| **Relays:** the engine can read `relays.json`, but the active LIVE build publishes none, so there is no relay topology. |
| **SCM/NAV modes:** no flight-mode fields exist in the fitting data or engine. |
| **Coolant network:** cooling demand uses the v1 assumption "equals effective allocated consumer power segments". `coolantUsage`/`coolingDraw`/`coolingRequired` are missing on 5,749 components, and units are native Foundry units (`unitUnknown`). |
| **Over-nominal performance curves:** not extracted. Allocations above nominal are refused. |
| **Shield aggregate regeneration:** unavailable when the active generator identity is unresolved (multi-generator ships). |
| **Engines and quantum:** `bounds-unavailable` (no thruster power bounds) and `non-pip-unit`. Life support is `component-family-missing` or `no-component-installed`. |
| **Crafted component stat overrides:** `calculate` accepts component IDs only. There is no quality or crafted-stat input in the request contract or engine. Adding one needs a contract change and source semantics. |

Finding (API consistency, not user-facing): `GET /ships/:id/loadout` returns the armor port
(`hardpoint_armor`/`hardpoint_armour`), which is outside the simulation hardpoint tree. Sending the
stock loadout unfiltered to a simulation is therefore rejected (400) for all six ships. The Fitting
UI builds its request from hardpoint-tree rows and is unaffected.

## Phase 6 — Cross-module integration and provenance

| Path | Status |
|---|---|
| Crafting → Blueprint Source → Mission → prerequisites/faction | **Done.** See details below. |
| Crafting → Build Queue → outstanding materials → Mining/source | **Blocked, not implemented.** Crafting → Build Queue already exists (Add to Queue). Mining accepts no URL selection (no `useSearchParams` in Mining), so a link would land on an unselected page. Adding one changes the Mining page, which is the active workstream on the original branch (`claude/mining-materials-panel`, uncommitted WIP). Needs an owner decision on the Mining selection contract. |
| Crafting/Fitting → compatible component details | **Partially exists, no new link.** Crafting statistics already resolve through the shared fitting component store by the card's `entityClass`, the same identity Fitting uses. Fitting has no component-detail route (ship routes only), and adding one would mean a new page or changes to the paused Fitting V2 checkpoint. Not done. |

Details for the Crafting → Mission path:

- The Mission Briefing in the Crafting Sources tab links to
  `/industry/missions?variant=<contractId>&return=<current Crafting URL>`, keyed on the stable
  contract ID. Pool-only sources say there is no exact contract to open.
- The Mission Browser shows "← Back to Crafting" for a safe in-app `return` path. Off-site,
  protocol-relative, and backslash forms are rejected (`safeInternalReturnPath`).
- A contract ID absent from the published generation shows an explicit notice with the generation
  ID, and the return link stays available.
- Tests:
  - `src/lib/missionUrls.test.ts` (2, in `missions:test`).
  - `tests/ui/mission-integration.spec.ts` (3): the success path (the exact variant from the
    source, faction and standing visible, reload, return to the same Crafting URL); a missing
    contract; an off-site return target ignored.
  - With the Phase 3 specs, `playwright.missions.config.ts` passes 14/14.
- `ComponentRecipeTable.tsx` received one `useLocation` and one link block. This file has
  uncommitted WIP in `D:\Moonbreaker-mockup-current`, so expect a small merge overlap there. No
  edit was made to `crafting-detail-refactor.css` (also WIP); the link reuses the existing
  `craft-detail-source-toggle` class.

## Follow-up — Vercel bundling, catalog regeneration, staging deploy (2026-11-13)

- **Bundling fix (`ec1976091`):** the Vercel missions function listed pre-generation root files, so
  the deployed API could not read `current.json` or any generation. Bundling every generation would
  be gigabytes.
  - `vercel.json` now bundles `server-data/missions/{current.json,generations/<active>/**}` and
    excludes the shaping-only root files.
  - `npm run missions:vercel-bundle` syncs it, and the shaper runs it after moving the pointer.
  - `api:check` fails on drift.
  - Shards are written compactly (shaper v3.7).
- **Re-shaped generation (`0ded0eba6`):** `a844b5c9fb262c00b07e065b`, built from the *already
  audited* 4.10.191 source (sha `76f20061…`, receipt unchanged) with the audited ref index (`4e96643e…`).
  - Runtime bundle: 161 MB, down from 245 MB.
  - Mission content is identical. 8 blueprint display names now match the published crafting catalog.
  - Blueprint sources were re-stamped. `c6943661…` is kept for rollback.
- **2,559-contract (13165946) publication: blocked by the source audit gate.**
  - The publisher ran and was rejected by `missions:shape`, because the source hash differs from
    the externally audited source-v4 artifact. It rolled back cleanly.
  - All 2,513 accepted contracts persist; 46 are new. The three JS-checkable golden invariants
    still match.
  - 34 shared contracts changed semantically: payout 6 (Orison Relief, UEE Threat), reputation
    rewards 25 (Red Level, Verified Bounty), blueprint rewards 2, prerequisites 1.
  - Accepting these needs an owner audit and re-baselined receipt (`targetSourceV4`). Not fabricated.
- **Staging deploy: blocked at push.**
  - The snapshot commit `be21e86f0` (tree identical to this branch, parent = Breaker-staging
    `4dbcc9eed`) was rejected: "push declined due to email privacy restrictions".
  - Recreating it under the account's GitHub noreply identity was not permitted for the agent.
    Remote `staging` is unchanged.
