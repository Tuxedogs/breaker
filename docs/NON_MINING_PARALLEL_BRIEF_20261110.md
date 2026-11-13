# Claude parallel migration brief | 2026-11-10

## Mission
Implement Breaker's remaining V31/V31b presentation in a separate workstream while Shane and another agent handle Mining and the recommender. This is implementation, not a planning-only assignment. Start with Crafting immediately and continue to the other listed pages as work permits.

## Your isolated workspace
- Work ONLY in `D:\Moonbreaker-pages-parallel-20261110`, branch `claude/nonmining-pages-20261110`, based on committed `3c2879e61`.
- The user's active, DIRTY Mining worktree is `D:\Moonbreaker-mockup-current`. DO NOT edit, commit, reset, stash, checkout, build in, or otherwise modify that worktree.
- Do not touch `D:\Moonbreaker-source-20261106` or any other worktree. Avoid changing routes/components used by Mining.
- NEVER merge or push. Commit coherent milestones only on your branch.

## Presentation authority
- Inspect `Breaker_V31b_Responsive_Motion.html` in your worktree and existing implemented Mining page as READ-ONLY visual references for shell, typography, component primitives and design tokens. Find older V31 reference only if already present/accessible; V31b is a valid base.
- Segoe UI throughout. Preserve approved sidebar/topbar, gradient line, section numbering/accent treatment, scale, spacing, density, typography and responsive behavior. Avoid CSS override stacks and gratuitous redesign.
- Use shared React components/tokens when safe. Keep changes localized to non-Mining pages; if shared-shell edits are essential, document them and verify that Mining behavior/layout cannot regress.
- Compare against V31b at desktop and mobile widths; capture reproducible screenshots and note any genuine mockup ambiguities.

## Implementation order and acceptance criteria
1. **Crafting**: identify actual routed page and current component tree; migrate presentation to V31b while preserving live item selection, material rows, quality/tick logic, source links, blueprint info and build queue interactions. Show recipes/items for exploration even when not yet obtainable in-game, BUT disable adding unimplemented/unreleased blueprints to Build Queue and clearly explain their in-game unavailability. Do not invent recipe availability.
2. **Inventory**: migrate current routed Inventory UI presentation; preserve stock, locations, transfers, creation/edit operations, persistent state and backend wiring. No mock data replacement.
3. **Build Queue**: migrate queue presentation, retaining aggregation, quantities, quality targets, persisted queue state and Crafting/Inventory links.
4. **Fitting**: implement visual parity for the active page, preserving slot selection/equipment swaps/stat computation. Follow established one-screen/one-hull/one-swap design.
5. **Homepage**: audit only for shared typography/shell parity if time permits; it is already substantially migrated.

## Separation and quality rules
- HARD EXCLUSION: no edits under `src/components/industry/mining/`, `src/features/mining/`, recommender functions, Mining indexes/data, Source ranking logic, or any mining API endpoints. No interference with ongoing Mining work.
- Preserve real functionality, state, API calls, routing, selection and click behavior; no static JSX/mockup replacement as a shortcut.
- Work incrementally. Inspect existing tests and add relevant regression coverage. Run targeted tests/typecheck/build as feasible. If dev server is needed, use a different port and don't touch/kill the user's dev builds.
- Prefer useful improvements shipped and committed over a large incomplete rewrite. If time/budget are limited, complete Crafting first and leave exact next steps in the progress file.
- Maintain `docs/NON_MINING_PARALLEL_PROGRESS_20261110.md`: completed, in progress, files changed, tests/screenshots, parity gaps, blocked items and integration notes. Update after each milestone.
- Do not modify dependency lockfiles or install packages without necessity. node_modules is shared via junction only for dependencies; do not change its contents.

## Required outcome
Actually begin editing and validating the Crafting page now, then work in the above order. Make granular commits in your own branch and report concrete outputs. Do not ask the user for approvals during this independent workstream unless a truly blocking, destructive decision is required.
