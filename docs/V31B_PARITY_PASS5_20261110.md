# V31b Corrective Visual Pass 5 | 2026-11-10

## Active development context

- Worktree: `D:\Moonbreaker-unified-review-20261110`
- Branch: `review/unified-v31-20261110`
- No new worktree or branch was created.
- Mining and Home components remain unchanged.
- Reference: `Breaker_V31b_Responsive_Motion.html`. Previously approved omission of numbered 01/02/03 headers is preserved.

## Crafting: substantive first-fold changes

- The 13,277-byte AVIF workbench artwork embedded in the actual V31b HTML was extracted to `public/artwork/v31b-crafting-workbench.avif` and used as the hero background.
- Replaced the small 72px hero layout with a full reference-size 232px art column, followed by component identity and action controls.
- Removed the detached action footer and placed real Save and Add to Queue actions into the component hero.
- Introduced a queue quantity control (1–99), wired to the original `addBuildQueueItem` store action. Browser proof: entering 3 creates a JS300 queue entry with quantity 3 in Zustand.
- Rebuilt Blueprint Acquisition into reward and store columns. Reward missions continue to come from the existing live data model. Store locations are explicitly unverified where no trustworthy retail source is present.
- Replaced four generic scenario tiles with five data-backed metrics: quality, extracted modifiers when available, material inputs, crafting time, and blueprint path.
- Removed the stretched legacy nested grid that created an enormous blank area before materials. Quality cards now start immediately under the heading, with measurable functional slider width >300px.
- On mobile the metric strip renders in two columns, and the first quality slider appears in the initial viewport of the active Quality view.
- Existing blueprint-source queue gating, quantized quality controls, material statistics, and calculation models remain connected.

## Build Queue: actual physical inventory sourcing

- Implemented `getQueuePotentialSources` in `src/lib/logistics/queuePotentialSources.ts`.
- For the selected build, group **eligible, active, unreserved physical boxes** by real inventory location, material, available amount and quality. Ignore replaced lots, aggregate rows, ores, insufficient quality, mismatched units. Subtract reservations across the full queue.
- Added a Potential Sources presentation below Lot Reservations. Locations are displayed when supported; otherwise the empty state explicitly says no eligible physical lots were found. No fictional stores/spawn locations, no fake availability.
- Existing selected-build reservation scope, live warehouse navigation, Build Queue primary actions, and other allocation logic remain unchanged.

## Verification and screenshots

- TypeScript `tsc --noEmit` passed.
- Local fixture Vite build passed (existing chunk warning).
- `scripts/qa/nonmining-v31-smoke.cjs` passed Crafting, Inventory, Build Queue, Fitting, mobile views, and Home.
- `scripts/qa/v31-selected-sourcing-regression.cjs` passed Crafting geometry and scope filters, selection-scoped sourcing, and physical-lot statistics.
- `scripts/qa/v31-parity-interactions.cjs` passed.
- `scripts/qa/v31-pass4-navigation-quality-actions.cjs` passed, including quality preset Reset.
- New `scripts/qa/v31-pass5-firstfold-and-sourcing.cjs` passed actual first-fold artwork/slider dimensions, real 3-unit queue entry, truthful potential sources and mobile section navigation.
- New `queuePotentialSources.test.ts`: 3/3 passed (quality gating, reservation subtraction, duplicate requirement capacity).
- Unchanged `scripts/qa/unified-shell-regression.cjs`: 10/10 passed.
- Before/reference/after comparison for Crafting: https://files.catbox.moe/69l9io.jpg
- Other files in `tmp/pass5-*` are local QA captures and not committed.

## Deliberate remaining gaps

- V31b's illustration contains demo quality outcomes and material selections. Current Crafting shows the selected real JS300's actual material requirements and real modifier stats, which cannot be replaced with fake V31b values just for screenshot parity.
- Crafting filter/sidebar and Blueprint Index still need tighter alignment to the reference.
- Build Queue local fixture currently contains no eligible unreserved physical lots, so its new sourced-location list is correctly empty. A populated QA-only fixture is needed for visible populated-source parity.
- Inventory and Fitting require their own substantive component-level follow-up passes, including API-backed fitting and populated-lot inventory.
- This is a review checkpoint; do not mark entire pages as visually approved.

## Working rules

Future UI work stays on this same worktree and branch. Show reference/before/after screenshots, not only smoke-test output. Do not make unrelated Mining or Home changes.
