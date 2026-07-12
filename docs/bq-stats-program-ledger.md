# Build Queue Stats / Fitting Performance — Project Ledger

**Program owner:** TPM / integration (this chat)  
**Baseline:** Corrected architecture audit (do not re-audit). No fitting API migration authorized until UI Gate 3 passes + explicit plan approval.

## Gate status

| Gate | Status | Notes |
|------|--------|-------|
| Gate 1 — branch review + merge | In progress | Core 3 commits review PASS; validation pending `ui:build-queue` browser install |
| Gate 2 — BQ UI hotfix | **PASS** | Three-region header + compact stat groups; see commit below |
| Gate 3 — independent UI verify | Not started | Fresh agent, clean checkout |
| Gate 4 — Base / Target / Allocation | **PASS** | Dense comparison table per stat group; see commit below |
| Architecture phases | HOLD | Awaiting post-UI plan approval |

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
- Merge status: pending after `ui:build-queue` green (or documented env exception + merge with residual risk).

## File ownership (upcoming)

| Phase | Agent | Owns | Must not touch |
|-------|-------|------|----------------|
| Gate 2 | UI 5.5 Medium | `BuildQueueCraftStatsPanel`, selected-craft header, `build-queue.css`, tightly related BQ layout | fitting API/hooks/cache, projections, modifiers, reservations, solver, unrelated pages |
| Gate 3 | Fresh verifier | Read-only verify + tests | Authoring UI |

## Architecture sequence (PROPOSAL ONLY — not authorized)

1. Pin static fitting reads to channel + buildId  
2. Unify resolved + in-flight caching  
3. Route all fitting consumers through shared store  
4. Eliminate Fitting terminal duplicate/remount waterfalls  
5. Bounded batch / chunk loading  
6. Persisted patch-static caching  
7. Route-level readiness boundaries  
8. Remove unnecessary full-catalog loading  

**Do not start until UI Gate 3 passes and user explicitly approves this plan.**

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
