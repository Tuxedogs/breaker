# Non-Mining V31b migration progress | 2026-11-10

## Branches and safety
- Active non-Mining preview: `D:\Moonbreaker-pages-parallel-20261110`, branch `claude/nonmining-pages-20261110`; served at `http://localhost:5173`.
- Original Mining worktree: `D:\Moonbreaker-mockup-current`, branch `claude/mining-materials-panel`, checkpoint `ae395e196`. Not changed by this migration.
- Baseline Claude styling work is already checkpointed as `f9747350c`, above previous CSS-token commit `d232494b7`.
- No merge or push performed. New UI implementation is committed separately on this branch.

## Implementation
1. **Crafting**: actual React 3-panel layout: Recipe Filters / Blueprint Index / Quality Laboratory. Index cards use live paginated catalog, selectable into existing recipe inspection, with material chips and bookmark and filter behavior retained. New local CSS scope and responsive layout. In-game blueprint source verification uses the canonical source-backed GUID API: recipes remain inspectable, but verified absence of an acquisition path disables every Add to Queue action and surfaces Preview Only with an explanation; queue handler also enforces the rule.
2. **Inventory**: actual React 3-panel layout: Locations / Inventory / Lot Inspector. Location cards have schematic art treatment; no invented location images. The unselected lot inspector shows a warehouse overview computed from actual location stock, recorded materials and reserved-lot counts. Existing selection, stock handling, locations and editing are preserved.
3. **Build Queue**: actual React panel headings and V31b proportions for queue, detail, and inventory sourcing. Responsive mobile order is 01 then 02 then 03; existing queue state and sourcing ledger remain.
4. **Fitting**: updated active route `/fitting` through FittingMockupShell. Shared-height 48px app header, three named panels, responsive 3-column layout, and readable stat-grid. Slot selection, inspection, and swap drawers remain connected. Also added equivalent structure to the dormant FittingTerminalPage variant; no new fake simulation data.
5. **Homepage**: checked `/dashboard` in browser; existing migrated shell and navigation left unchanged.

## Validation
- `D:\NodeJS\node.exe node_modules\typescript\bin\tsc --noEmit --pretty false`
- `D:\NodeJS\node.exe scripts\qa\nonmining-v31-smoke.cjs` checks desktop Crafting, Inventory, Build Queue, Fitting, Homepage and all four primary mobile routes. Test intercepts the blueprint index with a controlled nonmatching GUID to verify preview-only gating.
- Desktop and mobile screenshots: `tmp\v31-smoke\*.png`.
- Local fixture dev server: `http://127.0.0.1:5173`.

## Explicit limitations
- V31b **structural and visual direction**, not a claim of pixel-perfect parity. V31b's Fitting schematic/equipment diagram and some crafted detail content are not fully reproduced.
- Local UI fixture mode intentionally returns 403 for database/authentication APIs. Fitting has no real ship loadout there, so real component swapping, stats accuracy and API integration are not proven by the browser smoke test.
- Blueprint source index is likewise unavailable in fixture mode. Unknown availability is not presented as confirmed unavailability; the blocked state was verified with an intercepted index response. Confirm server API behavior in an integrated environment before release.
- Source-facing Mining changes live only on the original branch and are deliberately not merged here.

## V31b parity pass — November 10, 2026 (continued)
The following changes were implemented by direct edits to this worktree, using the original `Breaker_V31b_Responsive_Motion.html` as visual reference. This pass intentionally does **not** merge into the preserved Mining worktree.

### Crafting
- Automatically opens the first actual available catalog recipe in the quality laboratory on initial browser entry, while preserving URL deep links and explicit close behavior.
- Desktop displays Acquisition, Quality Response, Material Quality Scenarios, and Projected Performance together. Mobile retains selectable detail tabs.
- Uses original crafting calculations and quality sliders; does not substitute fabricated recipe or inventory data.

### Build Queue
- Implemented All/Active/Planned/Completed status filters and compact cards with physical allocation bars.
- Added a live material-planning overview with target units, covered and missing requirements, valid linked lots, and required/allocated/stored/shortfall quantities, derived from existing canonical inventory and reservation helpers.
- Kept original BuildQueueGroup reservation, completion and removal controls in an accessible advanced-actions disclosure.
- Reordering controls remain attached to the original queue card and are enabled for non-completed views.

### Inventory
- Extracted the real warehouse photograph embedded in V31b for purely decorative location card art.
- Added a 15-slot square warehouse scaffold when a location truly has no physical inventory and a contextual Add Lot action where writes are enabled. Zero records remain zero; no artificial stock enters the store.

### Fitting
- Extracted the original Gladius front WebP from V31b and its eight sample hardpoint coordinates.
- Added an interactive offline-only fixture reference with Airframe, Components, Ship Diagram, mount selection, views, zoom, filters, and Stats/Performance/Source inspector.
- **Fixture-only fallback** when the configured API is unavailable. It is conspicuously labeled as illustrative with disabled swaps, and does not overwrite the live Fitting API implementation.
- The demo's figures are visual references, not factual ship stats.

### Validation
- `npm run build`: pass, only pre-existing Vite chunk-size warning.
- `node scripts/qa/nonmining-v31-smoke.cjs`: desktop and mobile Crafting, Inventory, Build Queue, Fitting and Home passed.
- `node scripts/qa/v31-parity-interactions.cjs`: Crafting initial inspection, Build Queue filters and real material rows, Inventory empty-stock truth, Fitting clickable regions/zoom/filter labels passed.
- Desktop screenshots captured in ignored `tmp/v31-smoke`; original mockup screenshots in ignored `tmp/v31-reference`.
- Remaining gaps: exact pixel/typography parity across all responsive widths, populated Inventory grid under a live data source, backend source validation, live Fitting component swaps and statistics. None of these should be claimed as complete.

## V31 parity refinement (November 10, morning)
- Compared V31b reference screenshots against actual routed Crafting, Inventory, Build Queue, and Fitting fixture previews at 1600x980.
- Crafting: default real JS-300 inspection when there is no deep link; real component artwork aligned left without overlapping title; material quality controls before full statistics table; four actual scenario summary cells.
- Build Queue: right Inventory Sourcing now follows selected craft, not the entire queue. Added selected-item label and Inventory link; maintained existing reservations and ledger model.
- Inventory: four physical-lot metrics plus per-material lot counts, quantities and reserved counts. Aggregate stock stays separate; mixed measurement units are never summed.
- Regression test verifies no hero overlap, materials before detailed statistics, selection-scoped sourcing, and four Inventory counters.
- Production build and existing interaction/browser smoke tests passed after the layout and data changes.
- Live fixture preview remains at http://127.0.0.1:5173, non-Mining worktree. Mining branch untouched.

### Outstanding visual and integration work
- Crafting's sidebar filters and statistics presentation still differ from reference. Do not fabricate categories, values, or slider quality.
- Inventory physical lot behavior requires populated real stock tests; fixture currently has no stock.
- Fitting is an offline visual prototype only; live data, equipment swaps and persistence remain unverified.
- Further pixel-level comparisons at mobile/tablet sizes and production integration checks remain open.

- Crafting sidebar category: added functional All / Ship components / FPS equipment scope selector, using the existing vehicle/FPS subtype URL filters rather than a new incompatible filter. Regression checks confirm actual filtered rows and restoration on All. This brings the left panel closer to V31 without changing catalog semantics.
