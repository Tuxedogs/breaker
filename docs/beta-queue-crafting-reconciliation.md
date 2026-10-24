# Build Queue and Crafting beta acceptance reconciliation

Follow-up to PRs [48](https://github.com/Tuxedogs/breaker/pull/48) and [49](https://github.com/Tuxedogs/breaker/pull/49), stacked on approved commit `6f904d701bc9fffb82d6af91c74c6c75250b553a`. The review history and `pr48-review-baseline-comparison.md` establish the original 8 Build Queue and 16 Crafting failures. A reproduced baseline failure was not treated as a waiver.

## Implemented corrections

- Keep lightweight browser summaries out of the full component-card cache. Build Queue prepares unique requested full cards through the existing by-ID API. This restores delivered FPS burst, projectile, falloff, spread, and penetration fields, including valid zero values. Persistent fitting cache schema 9 discards earlier incomplete projections; no gameplay values or formulas changed.
- Render Add Inventory through the document overlay layer so Build Queue containment cannot place its header beneath the mobile application header. Contain keyboard focus, restore the invoking control, and prevent every dismissal path while saving or creating a location.
- Treat blank quality as missing while accepting explicit zero. For refinable materials, unchecked Unrefined emits refined inventory; checked emits ore. Keep physical box identities through failed-save retry.
- Restore the design preview's catalog loading after the production pagination migration. Production keeps its paginated browser. Publish recipe loading through the actual outer inspection region's `aria-busy` state.
- Map the current Firing & Ammunition group to the existing icon. Allow comparison values and deltas to wrap inside their existing slots. Separate material target controls from Inventory/Reserve action hitboxes using intrinsic target track sizing. Give Inventory Off planning sliders their actual available row width and keep every tick label inside the material card at desktop and 390px mobile sizes. Keep the existing 64×44 mobile queue pills while containing their three text rows; full names remain available to assistive technology and in the selected-craft workspace.
- Complete source-backed fixture delivery for C-788 and CQ7 Mission Briefing navigation. Production contract-ID lookup remains unchanged; the accepted mission endpoint supports those aliases. No generated data was edited.

## All 24 original failing boundaries

The original line numbers identify the PR49 baseline. Current tests retain equivalent behavior at its current presentation owner. Exact historical wrapper names, retired standalone-page geometry, auto-reserve UI, duplicated Craft Outcome statistics, and the retired Planning ledger section are not release contracts.

### Build Queue: eight original failures

| Original test | Current assertions and preserved coverage |
|---|---|
| stats:110 typography | Current implemented type scale and stability across 1099–1499px; readable labels/values, statistic columns, header-height transition and no horizontal overflow. No speculative font redesign. |
| stats:180 CQ7 | Both compact and comparison labels; actual by-ID request; complete delivered FPS fields and exact burst 4, speed 550 m/s, lifetime 2s and distance 0m; group ownership, outer geometry and internal comparison-slot containment at 1920/2560/3840. The cache defect uncovered after the obsolete selector was fixed. |
| stats:296 populated mockup | Approved allocation/statistics hierarchy, current Inventory On/Off and per-material Reserve/Add Inventory controls, flat-lot modal, source comparison values, physical shortage colors, responsive geometry and real target/action hitbox separation. Retired auto-reserve modal assertions are replaced by the current explicit allocation workflow. |
| stats:706 ledger | Expanded initial physical ledger; collapse and reopen on desktop and compact layouts; explicit physical-fulfillment semantics and quality-eligible reservations. No retired Planning section restored. |
| stats:753 opaque header | Scroll the current expanded ledger and verify opaque header, hit testing and collapse action. |
| stats:981 all families | Identity-only headers; shared consolidated statistics for nine source-backed items across queues and desktop sizes; material targets, Inventory toggle, grouping/icons, full fields/curves, comparison benefits, mounted workspace and no clipping. Statistics live in Component Statistics; Craft Outcome retains its quality summary. |
| stats:1544 decorative frames | Preserve selected-craft decoration, live current reservation controls, pointer hit testing and responsive/no-overflow checks. No auto-reserve control restored. |
| stats:1634 allocation/outcome | Current target/outcome geometry, Performance/Engineering grouping, explicit per-material box reservation, material progress and finite predicted quality. Physical volume fulfillment remains distinct from quality eligibility and readiness; low-quality stock does not become Ready merely because volume is filled. |

The two formerly skipped nested Add Inventory tests are now active tests of current flat quality lots and failed-save retry. They preserve six individual physical records, quality/quantity totals, stable IDs, lot removal/addition and the five-new-lot limit. The full Build Queue suite retains 16 tests with no skips.

### Crafting: sixteen original failures

| Original test | Current assertion / retained behavior |
|---|---|
| browser-detail:44 peer geometry | Results are within production pane; compact981–1599 and wide1600+ are peer layouts; phone/single mode covered separately. Assert shared edges/non-overlap, results below toolbar, intended width shares at1599/1600/1920/2560/3840. |
| browser-detail:103 drawer tabs | Numeric required amount under existing column, material slot/name, editable quality, source ticks, modifier chips, art, all four tabs retained. |
| browser-detail:182 filters/tables | Shared CommandHeader markup, actual filter-sheet visibility for the current layout, material search, dense tables, stable selection, current CQ7 weapon search result (the old C54 weapon is absent from the delivered craftable fixture; weapon-over-magazine semantics remain directly covered by existing recipeBrowserFilters.test.ts test an FPS weapon is the preferred search target over its magazine), source sortable DPS, sticky headers, empty states and no document overflow retained across five widths. |
| browser-detail:361 quality/FPS graph | Current drawer title/Materials tab; preserve1–1000 bounds, raw723, ticks/marker geometry, canonical Hephaestanite title and estimated Alpha Damage/Fire Rate with source contributions. Retired full-page chart placement replaced by current estimated effects surface; no chart feature restored. |
| browser-detail:467 direct editor | Current title and numeric required cells; keep range/editor synchronization,5000 clamping, mouse drag, touch drag, and endpoint alignment at700/600/500/430/375. |
| browser-detail:563 Aslarite | Current identity and summary facts; retain one editable material row, insulative-liner slot, range/direct editor, Escape, absence of part requirement,1920/2560/3840. |
| browser-detail:600 family statistics | Select Statistics explicitly at every width; retain every representative family/group, source cards, wrapping and ship seven-card coverage. Use current Accuracy and Spread label and drawer width rather than obsolete full-page column expectations. |
| browser-detail:744 readiness | Outer region readiness fixed; preserve reserved geometry, idle/ready state, Materials default, completed content, absence of obsolete loading copy, and1920/2560/3840. |
| browser-detail:839 weapon/source columns | Current approved sortable Alpha/DPS/Fire Rate/Projectile Speed/Capacity instead of retired Pen.Dist.column; exact M5A410/684/1184/25 and ballistic AD5B5004/1538 fixture values. The delivered CQ7 Blackbox Retrieval Very Dangerous source opens the current Mission Briefing modal from Sources. Verify title, reward/pool/payout/system/delivery fields, close behavior, and separation from the Materials effects panel; the retired href is not restored. |
| design-preview:45 selected row | Fix missing full index. Explicit AD5B search makes selected row part of visible result set before testing connector alignment, viewport relationship and closing behavior; selection does not imply changing result page. |
| design-preview:126 controls | Fix missing full index; preserve Clear all, CQ7 search/selection, Statistics, size filters, pagination and production routing separation. |
| mobile:63 end-to-end | Keep all navigation/focus/filter/material discovery assertions. Current ?preview selection, art, fixed footer hit targets, bookmark toggle, default Materials, tabs, stable header and actual drawer scroll owner replace retired standalone overview subtree. |
| mobile:261 canonical name | Current compact title span, canonical title/aria-label and artwork path verified. |
| mobile:277 tablet/desktop | Keep table/card breakpoint and overflow checks; same drawer material requirements/footer/current artwork at768/1920/3840 replace retired full-page hero/summary. |
| mobile:309 responsive detail | Current hero-art stage, phone<=760, single desktop761–980, compact split981–1599 and wide split1600+; retain material card width, modifier label/value fit, header alignment,44px back target, four tabs and no overflow. |
| mobile:413 phone header | Current hero-art stage replaces retired icon wrapper; preserve title/back inset alignment, typography hierarchy, image size/containment, centered editable quality and screenshots390/402/430/466. |

## Real Build Queue Add Inventory workflow

Two additional cases use `/logistics/build-queue` and `/logistics/inventory`, not the modal fixture, at 1920×1080 and 390×844. A synthetic localhost-only account and persistence adapter exercise the real auth coordinator, store and current per-material Inventory entry point. External requests are blocked.

The cases choose a location, verify the locked material and blank-versus-zero quality, add two distinct quality lots, check exact refined box payloads, recover from a failed save with unchanged IDs, hold a pending retry to verify Close/Escape dismissal guards, reserve a created box, and verify Inventory navigation/reload. Focus containment/restoration, visible mobile modal heading and actual screenshots are checked. These are client-flow evidence, not live backend persistence or permission evidence.

## Sole external acceptance blocker

No safe, explicitly authorized disposable backend account was available. Existing environment files identify infrastructure, not authorization to use a test user's records. No live authenticated persistence/RLS round trip was attempted and no production user data was used.

The remaining external gate is a disposable-account create/reserve/reload/cleanup round trip through the real authenticated backend. Local synthetic persistence cannot satisfy that gate. Beta promotion remains **NO-GO** until it passes. Do not merge, deploy or publish a beta automatically.

## Scope and provenance

The work uses an isolated worktree and branch. The original Mining worktree and its documentation WIP remain untouched. Mining scoring, Scintel/source registries, generated data, the frozen benchmark, allocation arithmetic and persistence API ownership remain unchanged. Full receipts and source hashes accompany the final validation report.

## Final validation receipts — 2026-10-23

| Check | Exact result |
|---|---|
| Full Build Queue Playwright suite | 16 passed, 0 failed, 0 skipped; exit 0; 2.2m |
| Full Crafting Playwright suite (four specs) | 26 passed, 0 failed, 0 skipped, 0 flaky; exit 0; 259696.416ms |
| Beta regressions including production-route Inventory workflow | 10 passed, 0 failed, 0 skipped, 0 flaky; exit 0; 51745.152ms |
| Inventory UI | 3 passed, 0 failed, 0 skipped, 0 flaky; exit 0; 41625.355ms |
| Inventory Add modal UI | 1 passed, 0 failed, 0 skipped, 0 flaky; exit 0; 30399.248ms |
| Mining UI | 2 passed, 0 failed, 0 skipped, 0 flaky; exit 0; 38616.976ms |
| Mining unit/domain tests | 69 passed, 0 failed, 0 skipped; exit 0 |
| Crafting unit/domain tests | 68 passed, 0 failed, 0 skipped; exit 0 |
| Fitting unit/domain tests | 134 passed, 0 failed, 0 skipped; exit 0 |
| Public API validation | Passed; exit 0 |
| Content validation | 18 modules and 5 references passed; exit 0 |

UI validation used the actual repository configurations and serial local servers. The final Build Queue and beta runs follow the last mobile-pill correction. Crafting, Inventory and Mining owners were unchanged by that final Build Queue-only correction and screenshot readiness wait; their completed full-suite receipts were retained. All 19 candidate code/test/config files match the final SHA256 manifest with zero drift. No failing test was skipped or marked expected failure to obtain acceptance.

Actual final queue and Add Inventory screenshots were inspected at 1920×1080 and 390×844. Crafting screenshots and planning-slider captures were also inspected at desktop and mobile sizes. Independent read-only review reports PASS, with no P1/P2 findings, including the last compact-pill correction. Screenshot evidence and raw receipts are packaged separately from source changes.

Recommendation: **GO for local client acceptance; NO-GO for beta promotion** solely until the authorized disposable-account backend persistence gate above passes. No product decision remains unresolved in these UI suites.

Final frozen-source lint (`npm run lint`) and production build (`npm run build`): both **PASS**, exit 0. Build includes TypeScript project compilation and Vite production bundling. `git diff --check` passes.
