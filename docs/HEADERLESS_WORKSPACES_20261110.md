# Breaker headerless workspace pass | 2026-11-10

## Approved direction for review
All operational workspace sections should present their actual tools and content without decorative `01 / 02 / 03` panel title bars. Keep functional item labels, search controls, tabs, counts, inspection details and actions. Use Crafting's three-surface geometry and spacing as the visual reference; Segoe UI is authoritative.

## Changed routes
- Mining: already had no numbered workspace bars, left its functional location search and "Best matches" controls intact.
- Crafting: removed filter/index/quality-lab header rows, kept aria-label landmarks and all recipe/quality/queue wiring.
- Inventory: removed Locations/Inventory/Lot Inspector title rows; selected location and lot content remain in their existing functional headings.
- Build Queue: removed queue and build-detail title rows; moved the collapsible Inventory sourcing action into the existing selected-build context card, with collapse/reopen retained.
- Fitting: removed numbered headers from live V31 mockup and its offline fallback; surface palette aligned with Crafting.
- Fitting Terminal (/fitting-v2): removed redundant numbered headers, retaining equipment and hero controls.
- Refinery Planner: removed all three numbered title bars; preserved Clear all and refinery yield callout; aligned frame, Segoe UI, borders and panel surfaces with Crafting.

## Validation
- `tsc --noEmit` passed.
- Vite local fixture build passed, with pre-existing large-chunk warning.
- `scripts/qa/no-numbered-workspace-headers.cjs` checked 7 routes at desktop (1600px) and mobile (390px), with 14/14 no-header checks passed; ledger collapse/reopen and Refinery controls verified.
- `scripts/qa/unified-shell-regression.cjs` passed all 10 desktop/mobile geometry checks.
- `scripts/qa/nonmining-v31-smoke.cjs`, `scripts/qa/v31-parity-interactions.cjs` and `scripts/qa/v31-selected-sourcing-regression.cjs` passed before the last legacy-only styling adjustments.
- Full live backend Fitting swaps and persisted inventory actions were not exercised here.

## Preservation
Original Mining and parallel-pages branches are unchanged. This work remains on `review/unified-v31-20261110` and is not a claim of final page-design acceptance.
