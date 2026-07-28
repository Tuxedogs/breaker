# Fitting shared cache — Stages 1–3 handoff

Updated: 2026-07-28

**Status:** Integrated into `main`. The branch, worktree, and original SHAs below are historical handoff metadata, not current workspace instructions.

Mainline equivalents:

| Stage | Mainline commit |
|---|---|
| Stage 1 | `652bc1004` |
| Stage 2 | `fd1f4617a` |
| Stage 3 | `180cf0ed1` |

Stages 4, 4B, and 4C, patch-static persistence, readiness gating, and removal of the unnecessary full-catalog load also landed on `main`. Bounded batch/chunk loading was not implemented as a separate stage and should only be scheduled from measured need.

## Stage 1 — Pin static fitting reads to channel + buildId

### Current state
- `src/lib/fitting/fittingApi.ts`: `withFittingBuild()` only appends `channel=LIVE` — **no buildId**.
- Response meta already includes `{ channel, buildId }`.
- `useFittingComponentStats` cache keys are **entityClass only** — no channel/buildId/sourceType.

### Required
1. Resolve active fitting channel + buildId once per session (from fitting API meta / existing index endpoint if present). Do not invent; use existing meta.
2. All **static** fitting GET reads must include both `channel` and `buildId` query params.
3. Preserve LIVE/PTU isolation — channel must be part of every cache key and request.
4. Do not change API payload shapes or calculation formulas.
5. FPS stays off vehicle fitting detail path.

### Likely files
- `src/lib/fitting/fittingApi.ts` (+ tests)
- Possibly a small `fittingBuildContext.ts` for resolved channel/buildId
- Update any direct `withFittingBuild` call sites

### Done when
- Static reads pin channel+buildId
- Unit tests cover query construction + LIVE/PTU isolation
- `npm run fitting:test` · `npm run ui:build-queue` · `npm run build` PASS
- One commit: Stage 1 only

### Stage 1 complete
- **SHA:** `b26fa3abc4557f7723e4e1b307050865ee15b2c4`
- **Bootstrap:** First static GET may omit `buildId`; server resolves via `server-data/fitting/current.json` (`datasetResolver.resolveDataset`). Client captures `{ channel, buildId }` from response `meta` and pins subsequent reads.
- **Files:** `src/lib/fitting/fittingBuildContext.ts`, `src/lib/fitting/fittingApi.ts`, `src/lib/fitting/fittingBuildContext.test.ts`, `package.json` (fitting:test)

## Stage 2 — Shared resolved + in-flight component cache

Replace module-local Maps in `useFittingComponentStats` with a shared store:

Cache key MUST include:
- channel
- buildId
- sourceType (`vehicle_fitting_detail` | `fps_component_card`)
- normalized component identity

Rules:
- concurrent requests share one promise
- completed records survive remounts
- missing ≠ failed (distinct states)
- failed requests do NOT permanently poison cache
- build changes invalidate correct namespace
- FPS card path uses sourceType `fps_component_card` and does not call vehicle fitting detail

### Stage 2 complete
- **SHA:** `ae2b7dd9e6641d61054f94a4ce069645dde7b25e`
- **Store:** `src/lib/fitting/fittingComponentStore.ts` — namespaced resolved + in-flight maps keyed by `{channel}::{buildId}::{sourceType}::{identity}`; 404 → `missing` (cached), 5xx/network → retryable (not cached); `captureFittingApiMeta` purges prior build namespace.
- **Hook:** `useFittingComponentStats` + `prefetchFittingComponents` + `getCachedFittingComponent` re-export from store; effect deps include `channel`/`buildId`.
- **FPS entry API:** `cacheFpsComponentFromCard`, `loadFpsComponentFromCard`, `getCachedFpsComponentFromCard` (not yet wired to all consumers — Stage 3).
- **Tests:** `fittingComponentStore.test.ts` — dedupe, remount survival, missing vs failed, no poison, build invalidation, LIVE/PTU isolation, sourceType distinction.
- **Residual Stage 3:** migrate direct `getFittingComponent` callers (terminal, mockup, pip/alpha/combat hooks); wire BQ FPS path through `cacheFpsComponentFromCard` / `loadFpsComponentFromCard`; consumer audit.

## Stage 3 — Route all fitting-detail consumers through shared store

Migrate:
- Crafting Browser / Detail (`ComponentResultCard`, `ComponentRecipeTable`, `ComponentResultsBrowser`)
- Build Queue (`BuildQueueStatsBreakdown`)
- Fitting terminal + mockup/helpers
- pip, alpha, mitigation, weapons, loadout, enrichment hooks that call `getFittingComponent`

No consumer bypasses without documented reason.

### Stage 3 complete
- **SHA:** `0b8161389517365128a4f2c24237282b25d44e0a`
- **New hook:** `useFpsFittingComponentFromCard` — caches FPS detail via `cacheFpsComponentFromCard` / `getCachedFpsComponentFromCard` (sourceType `fps_component_card`).
- **Vehicle path:** all former `getFittingComponent` consumers now call `loadVehicleFittingComponent` from `fittingComponentStore`.

#### Consumer migration table

| Consumer | Path | Status |
|----------|------|--------|
| `useFittingComponentStats` | vehicle via `loadVehicleFittingComponent` | migrated (Stage 2) |
| `useFpsFittingComponentFromCard` | FPS via `cacheFpsComponentFromCard` | migrated (new) |
| `ComponentResultCard` | vehicle hook + FPS hook | migrated |
| `ComponentRecipeTable` | vehicle hook + FPS hook | migrated |
| `ComponentResultsBrowser` | `prefetchFittingComponents` + `cacheFpsComponentFromCard` | migrated |
| `BuildQueueStatsBreakdown` | vehicle hook + FPS hook | migrated |
| `BuildQueueStatsProvider` | same model as breakdown | migrated |
| `usePipSystemPowerDraw` | `loadVehicleFittingComponent` | migrated |
| `useFittingMockupCombatStats` | `loadVehicleFittingComponent` | migrated |
| `useCombatAlphaBreakdown` | `loadVehicleFittingComponent` | migrated |
| `WeaponStatsTab` | `loadVehicleFittingComponent` | migrated |
| `FittingPerformanceGrid` | `loadVehicleFittingComponent` (mitigation) | migrated |
| `CraftQualityDrawer` | `loadVehicleFittingComponent` | migrated |
| `FittingMockupPage` | `loadVehicleFittingComponent` (detail, mitigation, compat drawer) | migrated |

#### Documented bypasses

| Location | Reason |
|----------|--------|
| `fittingComponentStore.ts` → `vehicleComponentLoader` | Internal store transport only; sole allowed direct `getFittingComponent` caller for vehicle fitting detail API |
| `fittingApi.ts` `getFittingComponent` | Low-level API primitive; not imported by UI/hooks after Stage 3 |

FPS never routes through vehicle fitting detail. LIVE/PTU isolation preserved via namespaced cache keys.

## Preserve
API shapes, calcs, BQ Base/Target/Allocation, modifier coloring, FPS card fallback, LIVE/PTU isolation.
