# V31b Crafting primary filters and shared Mining chips | Pass 7
Date: 2026-11-11
Worktree: D:\Moonbreaker-unified-review-20261110
Branch: review/unified-v31-20261110
Preview: http://127.0.0.1:5173 (local fixture mode)

## User-requested correction
- Size, Grade, Class, Ship components, FPS equipment and Bookmarked moved out of the collapsed "Additional filters" and are fully visible as primary controls in Crafting's Recipe Filters pane.
- Materials moved into a native expandable disclosure, showing selected/available count on its summary and search, all/any controls, and actual material choices on expansion.
- All Crafting facet, category, bookmark, match and material filter buttons now use the same Mining source-index chip classes and the SAME extracted stylesheet; there is no separate reimplementation of Mining chip styling.
- Removed full-width material rows, count-in-row buttons, and old material-list, advanced-accordion and segment-specific layout selectors. The new design uses wrapping compact chips.
- Replaced the former index icon that resembled an M with the V31b blueprint mark (▧), rather than preserving the unrelated category icon art.
- Existing URL-driven filtering, exact material matches, result counts, blueprint details, quality controls, bookmark restrictions and queue functions remain wired.

## One canonical chip style for two pages
- New shared file: src/components/shared/resource-filter-chip.css.
- The approved source-index chip style was MOVED from src/components/industry/mining/mining-source-chips.css (not copied).
- Both MiningPage.tsx and CraftingFilterBar.tsx load the shared stylesheet and use mining-filter-chip--material source-index-chip.
- Mining's population/availability semantics, resource groups, order, and underlying functionality were not modified.
- Browser computed-style parity at 1440px confirmed matching font, padding, background, border and corner radius between Mining and Crafting.
- v31-css-ownership.cjs rejects drift back into standalone Mining chip CSS or old Crafting sidebar styling.

## Reference images
Desktop before, after main filters, after expanded Materials:
https://files.catbox.moe/f8nvti.jpg
Mobile before, after main filters, after expanded Materials:
https://files.catbox.moe/8l541n.jpg

## Validation
- TypeScript typecheck and CSS ownership assertions.
- Mining, Crafting, Inventory, Build Queue, Fitting shell geometry and smoke.
- Existing quantized quality controls, selections, blueprint gating, Build Queue and sourcing interactions.
- Updated Crafting browser test covers main visible facets, native disclosure, exact Mining chip computed styles, search, All/Any match mode, size facets and reset.
- Local Vite fixture build (not live-backend verification).

## Remaining
The primary Crafting sidebar is now aligned to the newly specified layout, rather than the prior mockup behavior of starting with all materials visible. The Quality Laboratory, acquisition details and other pages still require further V31b component migration. Do not claim full visual parity based on this localized pass.
