# V31b Crafting Filter and Blueprint Index Migration, Pass 6
Date: 2026-11-10
Worktree: D:\Moonbreaker-unified-review-20261110
Branch: review/unified-v31-20261110
Preview: http://127.0.0.1:5173 (local fixture-mode)

## Scope and visual authority
The authoritative reference is Breaker_V31b_Responsive_Motion.html. This pass migrates the Recipe Filters sidebar and Blueprint Index, not Mining or Home. Previously approved omission of decorative numbered workspace headers remains in place.

## Structural changes, not stacked CSS
- CraftingFilterBar in sidebarMode renders a dedicated craft-v31-material-filter-panel instead of the legacy crb2-toolbar--sidebar.
- Removed 27 V31 stylesheet rules targeted to the obsolete sidebar markup, instead of leaving the old sidebar layout in competition with new overrides.
- New V31-specific styles are owned by the existing craft-v31-layout.css. No !important rules added. The existing CSS ownership test rejects repeated V31 selectors and reintroduction of obsolete sidebar rules.
- Legacy CraftingFilterBar remains available for non-sidebar presentations without changing its existing mobile filter sheet API.

## Reference-driven Recipe Filters
- Blueprint search at panel top
- All / Component / Equipment category scope using existing URL filter mappings
- Material filters heading, clear selection, material name search
- Scrollable material checklist with active indicators and actual catalog counts
- Selected-material chips with one-click removal and explanatory footer
- All selected / Any selected logic with URL key mm. Default is All, matching V31b's initial selection. Mode Any is an explicit choice.
- Existing size/grade/class/ship/FPS subfilters and bookmark-only stay functional inside the Additional filters disclosure rather than consuming primary space
- Reset all retains the preview selection but clears the filter query keys

## Server and client filtering behavior
- server/routes/componentCards.routes.ts now implements both All and Any over validated material facet IDs / names, not just the prior unconditional OR.
- recipeBrowserFilters.ts mirrors the same semantics in local filtering.
- The browser endpoint remains the authoritative filtered/paginated source and the existing detail, source gating and queue states stay connected.
- Browser evidence: 26 baseline actual blueprints, Beryl+Stileron All = 1, Beryl+Stileron Any = 3. Reset returns to 26.

## Blueprint Index
- Intro text reflects active material filter mode
- Recipe subtitles include actual material count
- Matching material chips receive semantic highlighting, with N-of-selected count when filters exist
- Data-provenance footnote is explicit. Actual 26 production fixture records are not replaced with six fictional mockup cards.
- Existing recipe selection, page navigation, queued state and preview-only source gating remain intact.

## Tests
- tsc --noEmit passed.
- 11 recipeBrowserFilters unit tests passed.
- scripts/qa/v31-pass6-crafting-filter-index.cjs passed on 1440px desktop and 390px mobile.
- scripts/qa/v31-css-ownership.cjs passed, including the new dead-sidebar selector guard.
- unified-shell-regression, nonmining-v31-smoke, v31-parity-interactions, v31-selected-sourcing-regression, v31-pass4-navigation-quality-actions and v31-pass5-firstfold-and-sourcing passed after updating an obsolete category-button label assertion.
- fixture Vite build passed. Existing chunk-size warning does not block build.
- Browser console errors: zero. Horizontal overflow: zero at 1440 and 390px.

## Reference vs prior vs current screenshots (phone-viewable)
Desktop: https://files.catbox.moe/kw7m74.jpg
Mobile: https://files.catbox.moe/ug53z0.jpg

## Remaining
- Crafting Quality Laboratory and acquisition panels still require visual parity against the reference, with real data retained.
- Build Queue, Inventory and Fitting need further component-level mockup migrations. This pass did not change those page bodies.
- Fixture validation is not production backend verification.
- Future implementation should edit canonical structures and CSS owners, not append legacy overrides.
