# V31b CSS ownership reconciliation
Date: 2026-11-10
Worktree: D:\Moonbreaker-unified-review-20261110
Branch: review/unified-v31-20261110

## Confirmed root cause
V31b migration components had been styled by successive overrides above legacy application rules. The legacy Build Queue CSS had 112 repeated selector contexts and 249 duplicated property names, Crafting recipe-browser CSS had 36 / 91, Inventory CSS had 65 / 146, and Fitting V31 CSS had 10 / 11. The shared mobile navigator had 48 important declarations to force old panels into a mobile presentation.

This was a stylesheet ownership problem, not a React data or API problem. CSS-only re-styling could not reliably achieve mockup parity while these structures shared legacy layout selectors.

## Implemented remediation
- Removed 397 superseded property declarations across the first wave (Crafting legacy/detail/V31, Build Queue legacy, Fitting V31).
- Removed an additional 164 shadowed declarations from legacy Inventory CSS.
- Consolidated 7 repeated Crafting V31, 10 repeated Fitting V31 and 6 repeated Crafting detail-selector rules.
- Migrated Crafting drawer hero and workspace body DOM classes to V31-only `craft-v31-workbench-hero` and `craft-v31-workbench-content`. Their base / mobile / desktop layout is now defined in `craft-v31-layout.css` and is no longer affected by the legacy `craft-detail-drawer-header` and `craft-detail-drawer-body` selectors.
- Replaced Build Queue's active `bq-layout` root with `bq-v31-workspace`, updated shared shell and mobile selectors, and deleted 11 obsolete layout rules from `build-queue.css`. The new V31 stylesheet is the root layout owner; legacy CSS still owns its nested functional controls.
- Moved eight Inventory workspace-root rules out of `inventory.css` and into `inventory-v31-layout.css`, with two same-context selector consolidations. Legacy Inventory CSS retains functional lot, drag-and-drop and control styling but no longer declares the main workspace frame.
- Eliminated all five important declarations in Crafting V31 and all 48 in shared mobile navigation. Narrow-workspace visibility now uses explicit shell-scoped selectors. 390/430/1440px navigation checks passed.
- Changed the old Fitting shell fallback font from Rajdhani to the approved `--mb-font-ui` / Segoe UI path.
- Added `scripts/qa/v31-css-ownership.cjs` to prevent new duplicate V31 selectors within a breakpoint, legacy property-shadow overrides, important-driven V31/mobile layout, and reintroduction of deprecated Crafting/Build root classes. The test also checks that Inventory's root layout is owned by V31.

## Stylesheet responsibilities
- Shared outer geometry and tokens: `workspace-surface.css`
- Mobile workspace state/view: `workspace-mobile-nav.css`
- Crafting V31 first-screen hero, laboratory frame and composition: `craft-v31-layout.css`
- Build Queue V31 three-column layout: `build-v31-layout.css`
- Inventory V31 three-column layout: `inventory-v31-layout.css`
- Fitting V31 structural geometry: `fitting-v31-layout.css`
- Legacy stylesheets are for retained deep controls only. New layout work should replace old components/DOM and update the appropriate V31 stylesheet, never append an override pass.

## Verification
- Initial safe removal of shadowed rules preserved computed layout at all 50 sampled component/viewport pairs, covering 1440px and 390px.
- Browser tests cover Crafting quality presets and real queue quantity, Build Queue action and source presentation, Inventory select and lot inspector, Fitting offline presentation, responsive workspace visibility at 390/430/1440, and Mining/Home shell smoke.
- Vite fixture build and TypeScript typecheck are mandatory. Do not claim live backend or production parity from fixture tests.

## Not yet completed
This is the architectural reconciliation, not a completed visual migration. Deep widgets in Crafting, Build Queue, Inventory and Fitting still use legacy CSS that must be replaced component-by-component against the actual V31b HTML and its media behavior. The full Crafting filter/index structure, populated Inventory, Build Queue physical-sourcing reference parity, and live Fitting inspector need separate component replacements. The QA fixture has no confirmed real physical lots.
Keep this branch and worktree active. Do not add another late override layer or call a page visually approved until matched screenshots prove parity.
