# Unified operational shell checkpoint | 2026-11-10

## Design authority
Mining's current rendered workspace is the shell reference. The shared 48px Breaker topbar, 66px desktop navigation rail, full-bleed operational canvas, 1px workspace gutters, Segoe UI, and compact region labels are common presentation responsibilities. Content and interaction models remain page-specific.

## Worktree and scope
- Worktree: `D:\Moonbreaker-unified-review-20261110`
- Branch: `review/unified-v31-20261110`
- Sources: original Mining and non-Mining branches remain unchanged.
- Applied to Mining, Crafting, Inventory, Build Queue, and Fitting (including the local offline Fitting preview). Home and non-operational/legacy pages are left alone.

## Changes
1. `AppPageShell` accepts an explicit full-bleed workspace variant via `ShellRoute`; removes shared route-level 8px padding without changing other routes.
2. Fitting routes now render inside `DashboardShell`. Duplicate Fitting topbar and navigation rail markup removed. The offline demo keeps visible `OFFLINE VISUAL FIXTURE` labeling and controls.
3. `workspace-surface.css` is the canonical owner for inline region heading presentation and common workspace surfaces. Removed superseded per-page heading CSS declarations.
4. Crafting's extra inner 8px padding removed at `recipe-browser-page-body`; its browser columns use Mining's 335px/380px sidebar scales with a flexible detail pane.
5. Inventory, Build Queue, and Fitting align their desktop sidebar/detail widths to shared workspace tokens while preserving each page's component order and content needs.
6. Build Queue mobile list track no longer grows past the viewport; its queue column is a single minmax(0,1fr) grid track.
7. Mining functionality, ranking algorithms, crafting calculations, queue reservations, and inventory state were not changed.

## Validation
- TypeScript `tsc --noEmit`: passed.
- Fixture Vite build: passed (existing chunk-size warning).
- `node scripts/qa/unified-shell-regression.cjs`: 10/10 desktop and mobile route checks passed at 1600 and 390 widths, including no horizontal page overflow.
- `node scripts/qa/nonmining-v31-smoke.cjs`: desktop and mobile routes passed.
- `node scripts/qa/v31-parity-interactions.cjs`: passed, including offline Fitting inspection, filters and labeling after shell move.
- `node scripts/qa/v31-selected-sourcing-regression.cjs`: passed prior to final CSS consolidation; no functional code modified by consolidation.

## Deliberate limitations
- Local fixtures do not verify real Fitting API swaps, backend blueprint-source availability, or persisted inventory transactions.
- Page-specific content grids, panel interactions, modals, and detailed visual parity still need individual review. Shared shell unification is not blanket acceptance of every V31 mockup component.
