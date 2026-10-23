# PR #48 bounded review correction

This follow-up starts from candidate `497f84914401b0d8bfc60282b7f6d7daa48943c8` on an isolated `codex/pr48-review-fixes` branch. PR #48 and its original source PRs remain draft/open and unmerged. The active target remains `7bd248d7bf6b3d35d3e3794d2f6987191b939806`.

## Corrected behavior

- `InventoryAddModal` imports its own stylesheet. Its active selectors and responsive rules moved out of `build-queue.css`; obsolete modal-only selectors were removed from that former owner. The component supplies the theme aliases it previously inherited from Build Queue, so direct Inventory navigation gets the same backdrop, dialog, form, picker and action styling.
- Narrow Build Queue headers wrap the state, target value and full blueprint-source text. Inventory Off planning places the required amount beside the material identity, uses the available slider width, and staggers every extracted tick label below the keyboard focus outline. Source thresholds and editing/keyboard behavior are retained.
- No gameplay calculation, data selector, source dataset, persistence implementation, Mining score, or existing UI test was changed.

## Verification

Windows, Node v24.13.0, existing repository dependencies via an ignored junction; no dependency/lockfile changes. Local UI servers use `SCINTEL_LOCAL_API=1`. The new focused suite uses an explicitly synthetic localhost account and fetch adapter before the fixture service worker. It exercises the real Inventory route and auth coordinator, not an isolated modal mount. External requests are aborted by that focused suite.

| Check | Result |
| --- | --- |
| Final `npm run lint`, `npm run build` | PASS |
| `npm run mining:test` | 69 passed |
| `npm run crafting:test` | 67 passed |
| `npm run fitting:test` | 134 passed |
| `npm run api:check`, `npm run content:check` | PASS |
| Existing Inventory UI / Inventory Add UI / Mining UI | 3 / 1 / 2 passed |
| `npm exec -- playwright test --config=playwright.beta-review.config.ts` | 8 passed |
| Direct Inventory synthetic Add/Edit/location/reload workflow | 10 checks passed; no live persistence claim |
| Independent visual review | Bounded patch PASS; 1920, 2560, 768 and 390px artifacts retained |

Focused checks cover fresh direct Inventory loads and reloads, fixed modal/backdrop bounds, working location selection/close, complete narrow blueprint text, target containment, every pair of tick labels, required-amount separation, keyboard focus clearance and slider editing/Inventory On-Off behavior. Actual screenshots were inspected independently; automated boxes alone did not establish visual acceptance.

Initial new-test attempts exposed harness interception/locator issues and a real 768px wrapping gap. Those attempts are retained separately from the final passing run. The final visual pass also corrected the amount/focus-outline collision found by independent QA.

## Existing-suite reconciliation and release decision

The exact baseline and unchanged candidate were both rerun with the same existing assertions, original timeouts and local fixture APIs. All 24 previous failure boundaries reproduce on both revisions: Build Queue 6 passed / 8 failed / 2 skipped; Crafting 10 passed / 16 failed. Source/spec hashes were compared. A failure reproducing on baseline remains a failure, not a waiver.

Full corrected-tree reruns retain those same counts and first failure boundaries. Late mobile CSS adjustments were verified by the final eight focused checks; the comparison records both full-run initial hashes and final hashes rather than claiming every long-running suite started from the final bytes.

See [the per-test comparison](pr48-review-baseline-comparison.md) for the complete redline. It distinguishes proven superseded markup/contract boundaries from unresolved pre-existing runtime/test-contract mismatches. Assertions after the first failed assertion remain unverified. No new regression was identified in the baseline/candidate comparison. No blanket approval to restore historical Auto Reserve, Planning ledger, exact typography or outcome placement was found, so those controls and tests were not rewritten speculatively.

**Beta remains NO-GO.** The full Build Queue and Crafting acceptance suites are still red; their contract decisions and any subsequently demonstrated functional defects remain open. A live authenticated disposable-account backend round trip is **BLOCKED**, because no authorized disposable account was supplied. Synthetic results do not prove actual Supabase persistence or row-level authorization. No production account data was used.

Mining was not redesigned: the retained desktop long-route screenshot visibly shows complete R39-R43 labels despite the earlier measured one-pixel overrun. Existing Mining UI tests pass; no new clipping defect was established.

Evidence root: `C:\Users\shane\Documents\Codex\2026-10-22\read\outputs\pr48-review`. `regressions-accepted` and its log contain final focused screenshots/checks; `qa` contains all baseline/candidate/corrected full-suite results, traces, hashes, preservation receipts and independent review. The original candidate and baseline worktrees remain clean, and unrelated canonical documentation WIP is preserved. No merge, release promotion, Scintel publication or automation activation is part of this correction.
