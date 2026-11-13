# Breaker non-Mining UI third pass | 2026-11-10

## Scope and preservation
- Worktree: D:\Moonbreaker-unified-review-20261110
- Branch: review/unified-v31-20261110.
- Mining and Home are expressly out of scope. They were not modified.
- V31b reference: Breaker_V31b_Responsive_Motion.html; rendered locally in Playwright at 1440, 1600 and 1200px. Screenshots are in tmp/reference-*.jpg and tmp/pass3-current-*.jpg.
- The reference contains illustrative/demo records that must not override actual live fixtures or production data.
- No recommender, inventory allocation, blueprint availability or Fitting API logic was rewritten.

## Measured layout differences and changes
| Workspace | 1440px before pass | V31b 1440px reference | Third pass |
| --- | --- | --- | --- |
| Crafting | Filter 335px, index 380px, lab 659px | Filter 260px, index 325px, lab 787px | 260px / 325px / fluid lab. At 1100–1249px, lab receives a second full-width row. |
| Inventory | 335px left, 655px center, inspector on second row | 260px left, 797px center, 315px inspector on right | 260px / fluid / 315px at >=1250px; explicit placement prevents 1440px stacking. |
| Build Queue | 335px queue, 657px detail, 380px sourcing | 280px queue, ~629px detail, ~463px sourcing | 280px queue; sourcing 34.4% width; main uses remaining space. |
| Fitting | 335px left, 657px center, 380px right | Approx. 205px left and 295px right (other demo composition) | Offline 210px left / flexible stage / 315px inspector; model-backed Fitting uses 225px/320px. |

## Reusable components implemented
1. src/components/shared/WorkspacePanel.tsx: headerless semantic aside/section/main/div, tone filter/primary/inspector, preserves caller labels, classNames, children, and state. Now used by Crafting, Inventory, Build Queue, offline/live Fitting, and Refinery. Legacy Fitting Terminal uses matching CSS classes without a state migration.
2. src/components/shared/WorkspaceTabs.tsx: controlled accessible tablist with optional numeric counts; used in Build Queue status tabs and Fitting offline inspector tabs. Selection/filter logic is still owned by the existing pages.
3. src/components/shared/WorkspaceMetricStrip.tsx: semantic div/dl wrapper for real metrics; used in Crafting quality snapshot, Build Queue allocation counters, Inventory physical lot counters, and Refinery output summaries.
4. src/components/shared/workspace-surface.css: shared component presentation with min-size safety, font, panel tones, statistic surface and focus-visible handling. Feature-specific detailed layouts remain locally owned.

## Shared color tokens introduced
All defined in src/styles/tokens.css. Hardcoded repetitions in feature-local V31 style sheets have been replaced with aliases; status-specific red/green/warning identity remains deliberately separate.

| Token | Value | Meaning |
| --- | --- | --- |
| --mb-ops-surface-quiet | #091723 | Dark panel / filter backdrop |
| --mb-ops-surface-panel | #0a1b29 | Dense panel surface |
| --mb-ops-surface-raised | #0b1c29 | Raised action and metric cards |
| --mb-ops-surface-row | #102637 | List rows |
| --mb-ops-surface-hover | #183346 | Hover rows |
| --mb-ops-surface-selected | #1a3a49 | Selected rows |
| --mb-ops-surface-separator | #294758 | Local separation |
| --mb-ops-border-strong | #315267 | Emphasized hairlines and metric borders |
| --mb-ops-border-active | #52c6df | Active selection edge |
| --mb-ops-text-primary | #e8edf2 | Bright actionable text |
| --mb-ops-text-secondary | #9db7c9 | Muted supporting text |

## Concrete visual corrections
- Crafting laboratory regained ~128px at 1440px; the forced 3-column CraftStatisticsCards constraint was changed to one readable column within the performance panel. The same production quality model and blueprint gating remain.
- Inventory inspector now stays in the right column at the relevant desktop reference sizes rather than appearing below the warehouse. This change does not create fake lots.
- Build Queue right-hand sourcing is closer to the V31b proportion. Existing queue/group/reservation actions were preserved.
- Fitting offline sample now provides a wider render and model-backed shell uses narrower equipment sidebars. API fallback remains explicitly labeled illustrative.
- Refinery and Fitting Terminal have shared panel surfaces/components, but Refinery has no direct V31b reference in the supplied HTML.

## Remaining visual parity gaps, prioritized
1. Crafting: Actual Quality Laboratory still uses the preexisting materials editor and category-based statistics cards; V31b illustrates a full compact baseline/projected/delta table. Converting this safely requires source-aware model mapping, not CSS alone. The hero art, source cards and recipe list also differ from the demo.
2. Inventory: V31b shows populated physical lot tiles; local fixture has zero lots, so the full lot-state, selection, transfer and stock-summary experience needs a populated-state regression fixture. Do not inject fabricated lots into production state.
3. Build Queue: V31b exposes completion, duplication, and reserve-suggested controls at the top level; live UI retains important actions under an advanced disclosure and selection-scoped sourcing. A dedicated action/availability audit is needed before promoting or changing behavior.
4. Fitting: local fixtures use illustrative Gladius geometry and non-authoritative statistics. Live ship/equipment API swap wiring and render completeness remain unverified here; the demo screenshot cannot prove production parity.
5. Cross-page: shared search/clear controls, compact item cards, data-table headers and empty-state composition are candidates for a fourth pass, but each requires state/semantic review first. Avoid turning unlike domain models into one overgeneralized component.
6. Mobile: geometry and no-horizontal-overflow checks pass but visual parity of section navigation and interactions still needs side-by-side review against V31b at additional widths.

## Tests
- TypeScript tsc --noEmit passed.
- Vite fixtures build passed; existing Rollup large-chunk warning remains.
- scripts/qa/v31-third-pass-shared-ui.cjs passed 16 route/viewport combinations at 390, 1200, 1440, and 1600px, asserting real geometry, shared primitives and no numbered headers.
- scripts/qa/nonmining-v31-smoke.cjs passed desktop/mobile Crafting, Inventory, Build Queue, Fitting, and Home smoke (Home unmodified).
- scripts/qa/v31-parity-interactions.cjs passed Crafting selection, Build Queue planning, Inventory empty truth, and offline Fitting controls.
- scripts/qa/v31-selected-sourcing-regression.cjs passed Crafting category/hero, queue selection-scoped sourcing and physical-lot counter logic.
- scripts/qa/no-numbered-workspace-headers.cjs passes 14 desktop/mobile route checks and Build Queue collapse/reopen.

## Approval
This is a committed review checkpoint when the commit step completes, not an assertion of final mockup or production approval. The user's accepted Mining worktree and original parallel-pages worktree are preserved.
