# PR48 existing-suite baseline comparison

Baseline: `7bd248d7bf6b3d35d3e3794d2f6987191b939806`. Unchanged candidate: `497f84914401b0d8bfc60282b7f6d7daa48943c8`. Corrected tree: `work/pr48-review`, based on unchanged candidate; initial-run hashes are in `corrected-freeze-hashes.json`; final hashes are in `corrected-final-hashes.json`. Late narrow CSS deltas were validated by the final focused eight-test rerun, as documented in `independent-review.md`.

Every existing test/assertion was preserved. The external config changes only test/output paths, reporters, localhost ports, and worker count. Baseline/candidate used one worker; corrected Crafting uses four file workers with fullyParallel=false. All runs use fixtures mode and SCINTEL_LOCAL_API=1. Existing suites have no universal external-request abort hook; this report does not claim all external requests were blocked.

| Run | Passed | Failed | Skipped | Minutes |
|---|---:|---:|---:|---:|
| baseline-build-queue | 6 | 8 | 2 | 4.6 |
| candidate-build-queue | 6 | 8 | 2 | 4.4 |
| corrected-build-queue | 6 | 8 | 2 | 4.5 |
| baseline-crafting | 10 | 16 | 0 | 10.7 |
| candidate-crafting | 10 | 16 | 0 | 10.5 |
| corrected-crafting | 10 | 16 | 0 | 6.0 |

| Existing spec | Baseline | Candidate | Corrected | Classification | Evidence and unresolved intent |
|---|---|---|---|---|---|
| build-queue-stats.spec.ts:110 | failed | failed | failed | preexisting runtime or test-contract mismatch; intent unresolved | Exact font expectation differs: label/value expected 12px/12.5px, rendered 14px/13px. No current accepted contract found authorizing either exact size; reconcile intent. |
| build-queue-stats.spec.ts:180 | failed | failed | failed | superseded contract / selector | Compact-only selector excludes rendered comparison rows (Alpha and Fire Rate are visibly present). Remaining source-field and clipping assertions never execute; no waiver of their semantics. |
| build-queue-stats.spec.ts:296 | failed | failed | failed | preexisting runtime or test-contract mismatch; intent unresolved | Auto reserve inventory for M5A Cannon control is absent. Existing handler is retained but intentionally unused. No current accepted contract found requiring restoration. |
| build-queue-stats.spec.ts:706 | failed | failed | failed | preexisting runtime or test-contract mismatch; intent unresolved | Ledger initializes expanded, so Open queue ledger is absent; later Planning section assertions never run. No current accepted contract found requiring collapsed default or restoring Planning. |
| build-queue-stats.spec.ts:753 | failed | failed | failed | preexisting runtime or test-contract mismatch; intent unresolved | Ledger initializes expanded, so Open queue ledger is absent; opaque-header verification is never reached. No current accepted contract found requiring collapsed default. |
| build-queue-stats.spec.ts:981 | failed | failed | failed | preexisting runtime or test-contract mismatch; intent unresolved | Compact statistic rows are absent from Craft Outcome, while the shared Component Statistics surface renders them/comparison rows. Exact outcome placement needs accepted-contract reconciliation. |
| build-queue-stats.spec.ts:1544 | failed | failed | failed | preexisting runtime or test-contract mismatch; intent unresolved | Auto reserve inventory for FR-66 control is absent; frame hit-testing after that assertion never runs. No current accepted contract found requiring restoration. |
| build-queue-stats.spec.ts:1634 | failed | failed | failed | preexisting runtime or test-contract mismatch; intent unresolved | Old Craft Outcome .craft-ok statistic subtree is absent; allocation workflow assertions after it never run. Current summary versus historical outcome semantics need reconciliation. |
| crafting-browser-detail.spec.ts:44 | failed | failed | failed | superseded contract / selector | Results moved under the production browser pane; direct-child selector no longer names the rendered results. Current migration geometry test passes. |
| crafting-browser-detail.spec.ts:103 | failed | failed | failed | superseded contract / selector | Required cells contain a numeric amount under the Required column. Current AGENTS requires Material / Required / Target / Input / Effect, rather than a repeated Required qty label in every cell. |
| crafting-browser-detail.spec.ts:182 | failed | failed | failed | superseded contract / selector | Crafting Intelligence heading is present in the accessibility snapshot, but its previous command-copy wrapper is absent. |
| crafting-browser-detail.spec.ts:361 | failed | failed | failed | superseded contract / selector | Selected detail uses the drawer title; old standalone .craft-detail-title selector is absent. Chart assertions are not reached. |
| crafting-browser-detail.spec.ts:467 | failed | failed | failed | superseded contract / selector | Selected detail uses the drawer title; old standalone .craft-detail-title selector is absent. Slider synchronization assertions are not reached. |
| crafting-browser-detail.spec.ts:563 | failed | failed | failed | superseded contract / selector | Selected detail uses the drawer title; old standalone .craft-detail-title selector is absent. Aslarite material assertions are not reached. |
| crafting-browser-detail.spec.ts:600 | failed | failed | failed | superseded contract / selector | Selected detail uses the drawer title; old standalone .craft-detail-title selector is absent. Family-by-family statistic assertions are not reached. |
| crafting-browser-detail.spec.ts:744 | failed | failed | failed | preexisting runtime or test-contract mismatch; intent unresolved | Drawer wrapper lacks the expected aria-busy=false attribute; delayed-load geometry and loading-copy assertions never run. No equivalent readiness accessibility assertion was established. |
| crafting-browser-detail.spec.ts:839 | failed | failed | failed | preexisting runtime or test-contract mismatch; intent unresolved | Expected sortable Pen. Dist. weapon column is absent. Source-backed sortable columns remain an AGENTS contract, but exact field/column delivery requires reconciliation before deciding restoration. |
| crafting-design-preview.spec.ts:45 | failed | failed | failed | preexisting runtime or test-contract mismatch; intent unresolved | Selected AD5B detail exists, but selected row is absent from current visible result page. The selected-row class still exists in the renderer; this is not proven to be a stale selector. |
| crafting-design-preview.spec.ts:126 | failed | failed | failed | preexisting runtime or test-contract mismatch; intent unresolved | CQ7 row is absent when the prototype control test expects it. No current accepted prototype/search fixture contract found; do not infer permission to change filtering. |
| crafting-mobile.spec.ts:63 | failed | failed | failed | superseded contract / selector | Old test expects standalone /industry/crafting/<id> after selection; current migration contract preserves browser state with ?preview=<id> and return navigation. |
| crafting-mobile.spec.ts:261 | failed | failed | failed | superseded contract / selector | Old standalone mobile title subtree is absent from the current drawer presentation. Canonical title assertions in current migration coverage pass. |
| crafting-mobile.spec.ts:277 | failed | failed | failed | superseded contract / selector | Old standalone .craft-detail-hero is absent from the selected drawer presentation. |
| crafting-mobile.spec.ts:309 | failed | failed | failed | superseded contract / selector | Old drawer icon-wrap image subtree is absent from the current detail presentation. This establishes obsolete markup, not complete visual equivalence. |
| crafting-mobile.spec.ts:413 | failed | failed | failed | superseded contract / selector | Old drawer icon-wrap image subtree is absent from the current detail presentation. This establishes obsolete markup, not complete visual equivalence. |

All 24 reported failures reproduce on exact baseline, unchanged candidate and corrected worktree; no new failure identity was observed. Thirteen first boundaries target superseded contract/markup; eleven retain unresolved runtime/test-contract intent. No failure was classified as an introduced regression or infrastructure failure. Overall beta acceptance remains NO-GO; the narrow corrective patch passes independent source/visual review.

The classification identifies the first failing boundary only. Assertions after a failure remain unverified, even where a selector is demonstrably superseded. A reproduced baseline failure is not a passing functional test, nor approval to restore historical features or weaken assertions. Unresolved intent stays open.

Evidence: each run has results.json, test-results/<test>/error-context.md, failure screenshot and trace.zip; top-level <run>.log and <run>.exit retain process outcomes. source-equivalence.json hashes unchanged existing specs and relevant BQ/Crafting owners. Failure artifacts in per-run test-results are authoritative; baseline/candidate manually requested Crafting screenshots share the auxiliary qa/artifacts directory and may overwrite each other, so those auxiliary screenshots are not used to attribute a run. Corrected manually requested screenshots are separated by run directory.

Current accepted contract owners consulted: AGENTS.md; moonbreaker_design_canon.md; docs/build-queue-ship-component-stat-availability-audit.md; docs/agents/HIERARCHY.md; current Crafting migration tests; current BQ/Crafting source. No source or existing test was modified by QA.
