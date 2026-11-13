# Known Test Failures

Updated: 2026-11-13 (branch `claude/p0p2-remediation-20261113`)

Every local Playwright config starts only `vite.local-fixtures.config.ts`
(`npm run test:playwright-configs` enforces this). That server serves a fixed set of read-only
`server-data` files and returns 403 for every other `/api` and `/auth` route. The failures below
are known. Do not skip or delete these specs, and do not widen the fixtures server to make them
pass without an explicit decision.

## Mission routes not served by fixtures — resolved 2026-11-13

Resolved on `claude/p0p2-remediation-20261113`. The fixtures server now answers `/api/missions/*`
and the read-only blueprint-source/reward routes through the same file-backed handlers the API
server uses (`handleMissionsRoute`, `handleCraftingBlueprintSourcesRoute`; no database, auth or
user state). MSW passes the offer, family and solver routes through.

- `playwright.missions.config.ts` (`mission-*.spec.ts`): 14/14 pass.
- `crafting-browser-detail.spec.ts` › sortable source-backed weapon columns and linked blueprint
  sources: passes.
- The legacy schema-2 `mission-browser.spec.ts` was retired with the page in `ced525867` and is
  not restored. It asserted concept URLs and pre-token literal colors that no longer apply.

Remaining fixture limitation: MSW still stubs `/api/crafting/blueprint-rewards/missions` as empty
for the Crafting/Blueprint Tracker fixtures. Locally, the Mission Browser's "Blueprint rewards only"
filter therefore narrows to Wikelo offers.

## Beta-review specs run signed-out

`playwright.beta-review.config.ts` no longer injects `VITE_SUPABASE_URL` or
`VITE_SUPABASE_ANON_KEY`, and the fixtures config exposes no `VITE_*` env. So the Supabase client
is unconfigured, the seeded `sb-127-auth-token` session is ignored, and the app renders
"Sign in with Discord".

| Spec | Result |
|---|---|
| `beta-review-regressions.spec.ts` › direct Inventory Add has its own modal geometry (1920, 2560, 768, 390) | 4 failed: no Add Inventory dialog; "Inventory needs a fresh server sync before this action." |
| `beta-review-regressions.spec.ts` › Build Queue target, blueprint and planning labels fit (4 widths) | 4 passed, signed-out |
| `build-queue-inventory-workflow.spec.ts` › Build Queue Add Inventory uses location and physical lots (1920, 390) | 2 failed: seeded queue not loaded (selected item is the default fixture item) |

## Other failures

None. The earlier `build-queue-stats.spec.ts`, `crafting-browser-migration.spec.ts` (compact
split width) and `crafting-mobile.spec.ts` (flat mobile detail) failures were resolved on
`style/unify` on 2026-10-28. The specs that waited for `.bq-command-header`, the LIVE/PTU channel
buttons or `.recipe-browser-command-header` now assert that those headers are absent (decision #3)
and read channel availability from the `Dataset availability` status region.

## Crafting specs that predate the V31 shell

Recorded 2026-11-05 on `codex/breaker-mockup-migrate-20261102`. Both fail identically in a clean
worktree at `4f49e43e2`, before any Mining V31 parity change, so they are pre-existing. Both wait
for app-shell elements the V31 shell no longer renders; the Crafting page itself is not implicated.
Likely cause, not confirmed by a spec fix.

| Config | Spec | Failure |
|---|---|---|
| `playwright.crafting.config.ts` | `tests/ui/crafting-browser-migration.spec.ts:232` › uses classification columns and the existing filter sheet in the compact split | `expect.poll` at line 244 times out waiting for `.dash-sidebar` to measure 40px. `.dash-sidebar` exists only in `src/styles/dashboard.css`; no component renders it. |
| `playwright.crafting.config.ts` and `playwright.crafting-mobile.config.ts` | `tests/ui/crafting-mobile.spec.ts:70` › matches the approved phone browse, filter, material, art, and detail flow | Line 81: `getByRole('button', { name: 'Open primary navigation' })` not found. That label belongs to `MobileIndustryNav.tsx`, which no component imports; the V31 shell uses the bottom module rail. |

Reproduce:

```bash
npx playwright test -c playwright.crafting.config.ts tests/ui/crafting-browser-migration.spec.ts:232 tests/ui/crafting-mobile.spec.ts:70
```
