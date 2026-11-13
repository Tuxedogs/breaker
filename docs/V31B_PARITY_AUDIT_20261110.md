# Breaker V31b reference vs unified review implementation: parity audit
Date: 2026-11-10
Reference: Breaker_V31b_Responsive_Motion.html
Target: D:\Moonbreaker-unified-review-20261110
Branch: review/unified-v31-20261110
Target commit at audit start: 5c5181a5b
Implementation edits in this audit: NONE.

## Verdict

FAIL: visual and interactive parity are not established. The first three UI passes converged on route shell, superficial tokens, and outer grids, but did not implement the reference component hierarchy and view switching. No production code was modified in this audit.

The reference is an illustrative demo, while the target uses a real item catalog and fixture-limited inventory/Fitting APIs. Keep real wiring and truthfulness; do not hardcode demo numbers to make screenshots match. Design parity is determined by equivalent component structure with matched representative data states.

## Source measurements at 1440 x 900

| Module | Reference top-level workspace | Implementation top-level workspace | Assessment |
| Crafting | x=66 y=48 w=1374, columns 260/325/787, height 1541 | same x/y/w/columns, height 852 with pane scrolling | Widths match, composition and scrolling do not |
| Inventory | x=66 y=48, columns 260/797/315 | x=66 y=48, approximately 260/795/315 | Widths close, controls/content composition diverge |
| Build Queue | x=66 y=48, columns 280/629/463 | x=66 y=48, columns 280/619/473 | Widths close, planning and sourcing workflow diverge |
| Fitting | x=66 y=167, grid 205/874/293, reference document scroll height 2186 | x=66 y=161, grid 210/847/315, implementation document scroll height 900 (internal page/panel overflow) | Different section depth, right inspector and scrolling |

At 1200px:
- Crafting reference: filters 240px, index 270px across the upper 757px, laboratory below from y=806 for 2134px. Implementation: filter 240px + index 893px across only 380px, laboratory y=429 h=690. MAJOR mismatch in vertical composition.
- Inventory reference: left 245px, middle 888px, both about 760px high; lower inspector starts y=809 and is 549px high. Implementation: 260px + 872px, upper 599px, inspector starts y=648 and is only 251px high.
- Build Queue reference: 245px queue + 498px detail upper 629px; sourcing beneath at y=678 h=604. Implementation: 320px queue + 813px detail upper 699px; sourcing beneath at y=748 h=152.
- Fitting reference: full scrollable composition; implementation uses a compact fixed frame with internal overflow.

## P0 shared mobile navigation (all four pages)

At 390px V31b renders a 48px global header followed by a 54px three-view strip (y=48 to 102). It shows one active workspace view at a time.
- Crafting: Filters / Blueprints / Quality Lab.
- Build Queue: Queue / Detail / Sourcing.
- Inventory: Locations / Lots / Inspector.
- Fitting: Ship / Loadout / Details.

The implementation has no such context navigator and instead stacks all panels vertically. Current Crafting detail begins at y=966, Inventory inspector at y=1050, and Fitting diagram begins at y=979. This is not an acceptable mobile interpretation of V31b, regardless of no-horizontal-overflow test results.

Required: a shared accessible three-view mobile workspace navigator with stateful page-specific view switching, active state, view focus, and preserved underlying selections. Desktop remains simultaneous panels. Verify at 390 and 430px, plus intermediate tablet widths.

## P0 Crafting: source and implementation

Reference V31b: filter column with search -> category -> material filters, All/Any match -> selectable material rows; Blueprint Index with compact 78px rows; right laboratory has a horizontal art/identity/action hero (approx 757x157), blueprint acquisition with reward and store sections (757x199), a five-metric real-time outcome strip, and an explicit two-column workbench of material-quality scenarios beside base/at-quality/change comparison tables. Includes Reset, All 900+, All 950+, and comparison controls in reference demo.

Implementation: adds Bookmark/Size/Grade/Class filter hierarchy before or after material search; 26 real results and tall material filter list, with detail lab constrained to a scrollable fixed-height pane. Actual hero shows a small thumbnail and metadata, Add to Queue in a separate strip; acquisition presents a different source card; summary strip displays Quality band / Material inputs / Craft time / Blueprint path rather than reference's projected outcome metrics; detailed performance is displayed in category cards instead of the reference's comparison table.

The selected JS-300 was matched in the new desktop visual comparison. These gaps persist on the same item. Do not replace actual recipe-quality calculations: adapt them into a declarative lab view model (base / projected / delta, material input bands, source verification) and render the mockup hierarchy. Maintain blueprint preview-only gating, material quantization, selected quality/queue-state and real catalog facets.

Files: src/components/industry/crafting/components/ComponentRecipeTable.tsx; CraftingBrowserWorkspace.tsx; src/components/industry/crafting/craft-v31-layout.css; components/crafting-detail-refactor.css.

Acceptance: for JS-300, hero/image/identity/action order, acquisition, outcome strip, quality controls and compared statistics occupy the same regions and align at 1440/1200; controls update actual projected values; unavailable blueprints remain unqueueable.

## P0 Build Queue: source and implementation

Reference middle panel: hero -> Completed/Requirements covered/Shortfall (SCU)/Linked lots metrics -> Production progress -> prominently visible Complete next unit, Duplicate and Remove/Undo actions -> Material Planning with Warehouse/Pull lots -> shortages and explicit warnings. Reference right panel: lot reservations -> Reserve suggested lots/Open Inventory -> conservation note -> Potential Sources grouped by location (Area18, Everus, etc. in DEMO data).

Implementation: hero and metrics differ, with Target units/Requirements covered/Material lines short/Linked lots; progress is material allocation, not production completion; completion/duplicate/removal and allocation controls are inside an advanced disclosure; sourcing right column prominently shows selected-build reservations but has no equivalent visible potential-sources location list in the reviewed fixture.

Data source caveat: reference selected JS-300 planned 4 units; implementation fixture selects Avalanche Cooler active 1 unit, so numeric differences are not themselves defects. The absence/location of whole UI groups is a defect.

Files: src/pages/logistics/BuildQueuePage.tsx; src/components/logistics/BuildQueueV31Overview.tsx; QueueLedger.tsx; build-v31-layout.css; build-queue.css.

Acceptance: first-fold action layout, planning + sourcing group order, reservations/potential-location sources appear in comparable locations, with preserved live allocation semantics, eligibility, inventory/warehouse links, and actual queue state.

## P0 Inventory: source and implementation

Reference: six illustrated demonstration locations; central Inventory panel with Grid + physical-lot count + Available-only control, local search and dense 150px physical-lot tiles showing material, quantity, quality, reservation and selected state; inline reserve/clear and drag-to-location affordances; inspector with Current Warehouse, four counters and Material Totals table.

Implementation: dozens of real location entries grouped by system, left global search and repeated generic fallback art; center Selected Location heading, Grid/List/Grouped/Sort/Filters/Import CSV; fixture has zero physical lots so it renders blank squares and an empty overlay; right inspector has warehouse counters but no comparable populated Material Totals table in the reviewed state.

Different underlying records (Area18 with nine DEMO lots vs ARC-L1 empty) explain missing stock imagery in the screenshot. They do not excuse lack of a populated-state parity test or toolbar/inspector content hierarchy mismatch. Build a dedicated realistic fixture *for visual QA only*, without injecting fake lots into production or changing the physical/aggregate distinction.

Files: src/components/logistics/InventoryWorkspace.tsx; src/components/logistics/inventory.css; inventory-v31-layout.css; src/pages/logistics/InventoryPage.tsx.

Acceptance: compare matched non-empty fixture states for reservations, selection, drag/transfer and totals; empty-state still honest with clean composition. Ensure Available-only and search controls reflect actual filter state.

## P1 Fitting: source and implementation

Reference: Fitting Terminal hero, 205px airframe/equipment rail, large render stage, 293px stat inspector, ship schematic, actual selected mount context, stat bars, installed-vs-comparison stats, blueprint/slot compatibility indicators, and lower ship-loadout/equipment sections. More than 2000px total document height in this viewport.

Implementation at /fitting in fixture mode is FittingV31OfflinePreview: 210px equipment rail, 315px inspector, demo Gladius render and highlights, a reduced sample stat view, Browse Crafting button, explicit warning that swaps cannot occur offline; missing visible equivalent category stat delta table / blueprint or compatible slot badges / fully explored lower page composition in this screenshot. Fixture API absence blocks validation of production FittingMockupShell.

The images are both Gladius, so much of the remaining mismatch is presentation, not mismatched items. An API-backed test fixture is mandatory to test actual swaps and stats without inventing values. A screenshot of offline fallback must not be represented as verified live Fitting.

Files: src/components/fitting/mockup/FittingV31OfflinePreview.tsx; FittingMockupShell.tsx; fitting-v31-offline-preview.css; fitting-v31-layout.css; src/components/fitting/terminal/FittingTerminalPage.tsx.

## Refinery and legacy pages

V31b does not supply a directly equivalent Refinery Planner workspace reference in the audited four-view navigation. Refinery styling cannot honestly be called V31b-compliant solely because it uses the common panel components. /fitting-v2 should be treated as a separate legacy route, not substituted for /fitting parity. Document distinct acceptance or establish an explicit reference.

## Approved deviations

- User expressly requested eliminating decorative 01/02/03 workspace headers. They remain in the original HTML reference but **must remain removed** in the implementation. Do not count as a parity defect.
- Actual recipes, blueprints, lots and fitting data must come from the existing app; the HTML mockup's demonstration numbers and UI controls are not production truth.
- The local Fitting API is unavailable in fixture mode. Label that state, do not invent fitted equipment.

## Style system / cascade diagnosis

- Third pass shared WorkspacePanel / WorkspaceTabs / WorkspaceMetricStrip only wraps existing content. It does not implement V31b component composition, source adapters, visual density or mobile navigation.
- Inventory's inventory.css has ~3,862 lines, 20 !important declarations and repeated '.logi-inv-filter-bar' rules (11 occurrences), plus 71 distinct literal hex colors. inventory-v31-layout.css adds 19 different literal hex colors.
- Build Queue's build-queue.css has ~7,355 lines, 18 !important declarations, repeated selectors across many responsive blocks; build-v31-layout.css adds 51 distinct literal hex colors.
- Crafting's craft-v31-layout.css contains 32 distinct literal hex colors and repeated region selectors; crafting-detail-refactor.css has ~2,276 lines, five !important declarations and multiple overlapping structural rules.
- Fitting's offline preview stylesheet retains ~95 distinct literal hex colors.
- Eleven shared operational tokens were introduced in the prior pass, but large swaths of page-specific CSS are still hardcoded; neither CSS reuse nor nominal token count proves pixel fidelity.

These repeated rules are not all wrong by themselves (some are legitimate media overrides), but the layering makes ownership unclear and allowed the wrong widths/heights/controls to survive.

## Acceptance process: replace the ineffective tests

1. Design reference at 1440x900, 1200x900, 390x844, plus 1920x1080. Capture **matching item/lot/queue fixture states** and screenshot each page before changing production CSS.
2. Record per-view bounding boxes for actual elements: hero, toolbars, tabs, data tables, scenario sliders, material cards, stat readouts, sourcing blocks. Compare with V31b before accepting each vertical slice.
3. Rebuild missing domain-specific components as presentational components with real adapters, not CSS reshuffles: Crafting Quality Laboratory, Build Queue planning and potential sources, Inventory lot/totals, Fitting readout.
4. Implement shared 54px mobile three-view navigator and page-specific state mappings. Test switching and preservation of selection/scroll/focus.
5. Eliminate superseded layout declarations in each touched module as components migrate. Do not append new overrides without deleting the competing owner.
6. Test real interactions and QA visual parity separately. Required green checks: no JS errors, no overflow, actual data, blueprint queue gating, allocations, lot reservations, quantized quality calculations, and Fitting live API semantics where available.
7. Only mark a page visually approved after manual review of side-by-side screenshots. A passing smoke test does not imply mockup parity.

## User-openable image evidence (left V31b, right implementation)

All images hosted on free Catbox; screenshots only, no private credentials included.
- Crafting desktop, matched JS-300: https://files.catbox.moe/1os60u.jpg
- Crafting mobile: https://files.catbox.moe/1a7221.jpg
- Build Queue desktop: https://files.catbox.moe/uugg6u.jpg
- Build Queue mobile: https://files.catbox.moe/0csanb.jpg
- Inventory desktop: https://files.catbox.moe/pssuvd.jpg
- Inventory mobile: https://files.catbox.moe/nu57kb.jpg
- Fitting desktop: https://files.catbox.moe/0h0ndm.jpg
- Fitting mobile: https://files.catbox.moe/2803wi.jpg

No application files were modified while producing this audit.
