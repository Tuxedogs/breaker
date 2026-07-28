# Build Queue Stats / Fitting Performance — Project Ledger

Updated: 2026-07-28

**Current baseline:** `main` at `a6044757a`
**Scope:** High-level delivery and remaining-risk ledger. Historical gate records are retained below for provenance.

## Current status

| Workstream | Status | High-level outcome |
|---|---|---|
| Original Build Queue UI gates | Complete and integrated | The historical dossier/table experiments evolved into peer Selected Craft, Component Statistics, and Material Allocation workspace cards. |
| Base / Target / Allocation projection | Complete | Comparison remains view-model driven with benefit-direction semantics and explicit empty states. |
| Fitting cache stages 1–4C | Complete and integrated | Reads are build-aware, consumers share the store, and equipped-detail coordination removed the main duplicate/full-catalog waterfalls. |
| Persisted cache and readiness | Complete and integrated | Patch-static persistence and identity/build readiness gates are on `main`. |
| Component-stat coverage | Complete for the audited additive fields | Shared delivery now covers expanded weapon and core-component traits; authoritative ammo falloff remains the known data gap. |
| Inventory hierarchy | Complete for the current visual target | Location/item/list views use physical-box language, quality disclosure, responsive layouts, and deterministic evidence. |

## Recent work audit — July 24–27

- Build Queue was simplified into a compact craft command area, a consolidated end-product statistics surface, and a separate modified-stat comparison region.
- Material requirements became denser summaries with the target-quality control kept visible and reserve detail behind disclosure.
- Shared component delivery gained additional weapon, power plant, quantum drive, cooler, and shield fields without moving calculations into React.
- Quantum-drive units were normalized through shared helpers, legacy persisted component records were invalidated after the response contract expanded, and Alpha Damage became the first weapon scan value.
- Inventory was rebuilt around Location → Material → Quality → Individual Boxes, with item-first and grouped-list alternatives plus 1920×1080, 2560×1440, and 768×900 evidence.
- The 2026-07-28 working tree contains local component-card data and screenshot evidence changes. They are in flight and are not counted as shipped in this ledger.

## Current roadmap

1. Complete and review the in-flight component-card/chart evidence as a focused change; keep exploratory output out of the production change and do not mix it into global theme work.
2. Complete the authoritative ship-weapon ammunition join before exposing damage or impulse falloff. No frontend inference.
3. Keep Build Queue statistics, Crafting, and Fitting aligned through the shared schema/projection/unit path.
4. Preserve Inventory’s responsive populated and empty-state coverage as inventory actions evolve.
5. Treat any global palette, card, border, or highlight change as a separate approval track.

## Historical gate record

The remaining sections document the original branch and gate sequence. Their branch plans and hold notices are no longer current instructions.

## Repository snapshot (Gate 1 start)

| Field | Value |
|-------|-------|
| Workspace | `D:/Moonbreaker` |
| Current branch | `bq-stats-local-fixture` |
| Tip SHA | `5c270745458048cb3db460fc38568348164ac6b7` |
| Working tree | Clean (no uncommitted user work to stash) |
| `main` / `origin/main` | `3b3c88381` — already contains fixture + FPS + view-model + prior UI pass |
| Tip vs main | +1 commit: artifact screenshots only (`5c2707454`) |

## Completed implementation commits (reported)

| SHA | Agent / author | Scope | Result |
|-----|----------------|-------|--------|
| `e72ce9c5d` | prior | DEV fixture + `ui:build-queue` | Review PASS |
| `9a2ffcc16` | prior | FPS card fallback → shared projection | Review PASS |
| `231ab9464` | prior | `craftStatViewModel` + pure panel | Review PASS |

## Extra commits already on `main` (not in original 3)

| SHA | Scope | Integration note |
|-----|-------|------------------|
| `026198909` | Recipe browser filters / zero-effect modifiers | **Out of BQ-stats scope** — already on `main`; do not expand Gate 2 to touch |
| `3b3c88381` | Compact dossier CSS/layout attempt | **Insufficient** vs Gate 2 visual criteria; Gate 2 must rework |
| `5c2707454` | Before/after screenshots under `artifacts/bq-craft-header/` | Evidence only |

## Gate 1 review checklist

| Criterion | Result |
|-----------|--------|
| Fixture route gated by `import.meta.env.DEV` | PASS (`App.tsx` + `BuildQueueFixturePage`) |
| `SCINTEL_LOCAL_API=1` local-only (no prod proxy) | PASS (`vite.config.ts`, Playwright config) |
| FPS from `stats.fpsWeapon` / `stats.fpsArmor` | PASS (`fpsComponentCardDetail.ts`) |
| No fabricated FPS values | PASS (card field normalization only) |
| No duplicated modifier formulas | PASS (reuses `buildModifiedDetailStatRows` / existing quality utils) |
| Ship fitting projections unchanged | PASS (tests assert QD/cooler/PP/shield/weapon) |
| `craftStatViewModel` category-aware, transport-independent | PASS |
| `BuildQueueCraftStatsPanel` does not fetch | PASS (props = view model only) |
| Base / projected / delta available | PASS |
| Example components not hardcoded as universal contract | PASS (dynamic `buildDetailStatGroups`) |
| Unrelated pages/calcs in core 3 commits | PASS |
| Unrelated pages in full tip | FAIL note: `026198909` recipe browser (already on main) |

## Validation (Gate 1)

| Command | Result |
|---------|--------|
| `npm run fitting:test` | PASS — 34 |
| `npm run build` | PASS |
| `npm run ui:build-queue` | BLOCKED — Playwright Chromium missing in sandbox; install pending approval |

## Integration branch plan

- Create: `integration/bq-stats-ui-hotfix` from `bq-stats-local-fixture` tip (`5c2707454`) so screenshots + mainline baseline are present.
- Historical merge status: pending at the time of this gate record; the work is now integrated.

## File ownership (upcoming)

| Phase | Agent | Owns | Must not touch |
|-------|-------|------|----------------|
| Gate 2 | UI 5.5 Medium | `BuildQueueCraftStatsPanel`, selected-craft header, `build-queue.css`, tightly related BQ layout | fitting API/hooks/cache, projections, modifiers, reservations, solver, unrelated pages |
| Gate 3 | Fresh verifier | Read-only verify + tests | Authoring UI |

## Architecture sequence — integration result

| Stage | Status | Mainline evidence |
|---|---|---|
| 1. Pin static reads to channel + build ID | Complete | `652bc1004` |
| 2. Shared resolved + in-flight cache | Complete | `fd1f4617a` |
| 3. Route fitting consumers through shared store | Complete | `180cf0ed1` |
| 4. Remove terminal duplicate/remount waterfalls | Complete | `4d2dbbbdc`, `f98fc8eec`, `14d5f05d5` |
| 5. Bounded batch/chunk loading | Not implemented as a separate stage | Full-catalog loading was removed; schedule batching only from measured need. |
| 6. Persist patch-static cache | Complete | `0d6caca76` |
| 7. Add readiness boundaries | Complete | `2f13b8c4c`, `8610cfaa8` |
| 8. Remove unnecessary full-catalog loading | Complete | `f98fc8eec` |

The earlier architecture hold is closed. Further cache or batching work requires a new measured problem and a separately scoped plan.

## Gate 2 — UI hotfix (integration/bq-stats-ui-hotfix)

| Field | Value |
|-------|-------|
| Agent | Gate2 UI hotfix (Composer 2.5, GPT 5.5 fallback) |
| Branch | `integration/bq-stats-ui-hotfix` |
| Commit | `f2b471869` |
| Files | `BuildQueueCraftStatsPanel.tsx`, `BuildQueueGroup.tsx`, `build-queue.css` (stat panel + selected-craft header only) |
| Screenshots | `artifacts/bq-craft-header/2026-07-12/` |

### Changes
- Flattened selected-craft header to three grid regions: identity/actions | grouped stats | compact artwork (120–168px).
- Removed `bq-item-dossier` wrapper that stranded artwork and created disconnected nested boxes.
- Aligned stat groups with Crafting Detail compact pattern: 2-col `bq-stat-group-grid`, card-style stat rows, `align-items: start`, matrix full-width.
- Stopped `bq-item-body` flex growth to eliminate viewport void above Material Allocation.
- Panel hides meaningless zero deltas at render time.

### Validation

| Command | Result |
|---------|--------|
| `npm run ui:build-queue` | PASS — 1 (FR-66, AD5B, FPS weapon, FPS armor @ 1920×1080 + 2560×1440) |
| `npm run fitting:test` | PASS — 34 |
| `npm run build` | PASS |

### Residual risks
- Very wide matrix groups (shield resistance) still span full stats width by design.
- Mobile stacks identity + visual on one row; stats below — verify on device if Gate 3 flags spacing.

## Gate 4 — Base / Target / Allocation comparison (bq-stats-base-target-allocation)

| Field | Value |
|-------|-------|
| Agent | Gate 4 implementation |
| Branch | `bq-stats-base-target-allocation` |
| Base | `1d6790574` |
| Worktree | `D:/Moonbreaker-bq-stats-gate4` |

### Changes
- Extended `craftStatViewModel` with comparison rows: stable stat ID, benefit direction, base/target/allocation values, deltas, and explicit `not_set` / `no_allocation` / `ready` states.
- Added `buildTargetMaterialQualities` + allocation/target presence helpers in `buildQueueCraftStats.ts`; wired target and allocation modifiers through `BuildQueueStatsBreakdown`.
- Refactored `BuildQueueCraftStatsPanel` to dense `Stat | Base | Target | Allocation` table per group; removed Gate-2 zero-delta hiding for comparison rows.
- Scoped comparison CSS + neutralized quality-band coloring inside `.bq-stats-panel` only.

### Validation

| Command | Result |
|---------|--------|
| `npm run fitting:test` | PASS — 42 |
| `npm run ui:build-queue` | PASS — 1 (FR-66, AD5B, FPS weapon, FPS armor @ 1920×1080 + 2560×1440) |
| `npm run build` | PASS |

### Ambiguous benefit-direction GPP properties (no `PROPERTY_DIRECTION` entry)
- `GPP_Weapon_HullScraping_Efficiency`, `GPP_Weapon_HullScraping_Radius`, `GPP_Weapon_HullScraping_Speed`
- `GPP_Weapon_Tractor_Force`, `GPP_Weapon_Tractor_FullStrengthDist`, `GPP_Weapon_Tractor_MaxDist`, `GPP_Weapon_Tractor_MaxVolume`
- `GPP_Radar_MaxAimAssistDistance`, `GPP_Radar_MinAimAssistDistance`
- Any other recipe-only modifier property not listed in `propertyMeta.ts`

### Residual risks
- Comparison rows without a matching detail-stat label land in fallback "Material Modifiers" group.
- Global target/allocation empty states apply per-column; per-material partial target is not surfaced separately.
- `!important` used only inside `.bq-stats-panel` to neutralize inherited rarity classes.

## Gate 6 — Corrective layout: overview + Component Statistics card (bq-stats-layout-correction)

| Field | Value |
|-------|-------|
| Agent | Gate 6 corrective UI |
| Branch | `bq-stats-layout-correction` |
| Base | `origin/main` @ `e32b4f983` |
| Worktree | `D:/Moonbreaker-bq-stats-layout` |
| Approved mockup | `artifacts/bq-craft-header/mockup/approved-component-statistics.png` |

### Verdict
REJECT prior header-embedded comparison on visual grounds. Restructured selected-craft workspace into three stacked sections: compact overview header (stock only) → full-width Component Statistics card → Material Allocation.

### Changes
- Split `craftStatViewModel` into `overviewGroups` (base stock) and `comparisonGroups` (Base/Target/Allocation); fixed property→category assignment via `findDetailStatGroupTitle` + prefix fallbacks; removed "Material Modifiers" dump group.
- Added `BuildQueueStatsProvider` + `BuildQueueCraftOverview` / `BuildQueueCraftStatistics`; comparison table moved out of header into `.bq-component-statistics` with Unit + Direction columns and readable desktop type.
- Updated `BuildQueueGroup` DOM: header = identity | stock overview | artwork (140–180px); statistics card full-width above materials.
- Scoped comparison CSS to `.bq-component-statistics`; overview uses compact 4-column stock groups in header.

### Validation

| Command | Result |
|---------|--------|
| `npm run fitting:test` | PASS — 42 |
| `npm run ui:build-queue` | PASS — 1 (FR-66, AD5B, FPS weapon, FPS armor @ 1920×1080 + 2560×1440) |
| `npm run build` | PASS |

### Screenshots
`artifacts/bq-craft-header/gate6/` — FR-66, AD5B, FPS weapon, FPS armor @ 1920 + 2560 (8 files). QD/cooler/PP not in stats fixture; use FR-66 (shield) + AD5B (weapon) as ship-component coverage.

### Residual risks
- Stat unit column uses label-based lookup; unknown stats show `-`.
- FPS armor may have empty comparison groups when recipe has no quality modifiers.
- Overview still omits matrix groups (resistance tables) by design — those remain statistics-only when modifiable.
- Historical note: architecture phases were held at this gate. See the current architecture status above.
