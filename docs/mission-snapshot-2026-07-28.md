# Mission Snapshot Baseline

Refresh run: 2026-07-28
Accepted channel: `LIVE`
Accepted build: `4.9.0-live.12232306`
Source latest modified: `2026-07-16T04:02:10.234294+00:00`

This is the historical published version 1 baseline. The isolated Stage 1 source-contract version 3 accepted on 2026-07-30 resolves source-calculated payouts and adds required-item evidence, but it has not been published into Moonbreaker's runtime data.

## Outcome

The accepted LIVE mission extraction, Moonbreaker mission shaping, and crafting blueprint-source shaping all completed successfully.

The refreshed artifacts are semantically identical to the checked-in July 16 snapshot. The generators changed only `generatedAt` values, so timestamp-only changes were not retained in the Moonbreaker worktree.

Comparison coverage:

- 3,213 mission source, index, report, family, concept, and variant files
- 1,496 crafting blueprint-source files
- No added files
- No removed files
- No semantic mismatches after excluding `generatedAt`

## Accepted input paths

The handoff's root-level Scintel defaults are no longer valid in this checkout. The accepted channel pointers resolve to:

- Foundry records: `D:/scintel/out/LIVE/4.9.0-live.12232306/foundry/records`
- Localization: `D:/scintel/out/LIVE/4.9.0-live.12232306/Data/Localization/english/global.ini`
- Mission dataset: `D:/scintel/out/LIVE/4.9.0-live.12232306/datasets/missions`

The following documented defaults are absent:

- `D:/scintel/libs/foundry/records`
- `D:/scintel/data/Data/Localization/english/global.ini`
- `D:/scintel/api/missions`

Future mission refreshes should resolve the accepted channel/build pointer instead of relying on the root-level defaults.

## Current counts

| Measure | Count |
| --- | ---: |
| Exact mission variants | 2,501 |
| Source families | 259 |
| Player-facing concepts | 533 |
| Full-view categories | 18 |
| Faction views | 28 |
| Reputation scope groups | 38 |
| Not-for-release variants | 742 |
| Work-in-progress variants | 90 |
| Tutorial variants | 15 |
| Fixed credit payouts | 8 |
| Calculated credit result records | 2,325 |
| Credit formulas unresolved after shaping | 2,321 |
| Variants with blueprint rewards | 763 |
| Fixed item reward records | 294 |
| Source-resolved item reward rows | 289 |
| Variants with a shaped resolved item reward | 288 |
| Unresolved weighted item rewards | 38 |
| Exact pickup scopes | 695 |
| Generated pickup pools | 882 |
| System-scope pickups | 704 |
| Unknown pickup scopes | 220 |
| Variants with an unresolved destination or drop-off token | 925 |
| Partial reputation scopes | 404 |
| Unresolved reputation scopes | 389 |
| Unresolved prerequisite references reported by extraction | 0 |
| Missing localization tokens | 361 |

## Snapshot observations

- The accepted LIVE build has not advanced since the handoff snapshot. Refreshing again cannot expose newer mission truth until the accepted LIVE pointer changes.
- A zero unresolved-prerequisite-reference count means the extractor resolved the references it currently recognizes. It does not prove that the output contains typed prerequisite or completion edges suitable for a solver.
- The 289 source-resolved item reward rows belong to 288 variants. The shaped count is variant-based, so the apparent one-record difference is not data loss.
- The 361 missing localization tokens include mission titles and descriptions, standing/rank labels, mission type labels, commodities, and reward items. Golden samples should distinguish missing source localization from shaping fallback behavior.
- Blueprint publication remains stable: 676 blueprint sources and 763 normalized mission reward records.

## Integrity findings discovered during the Stage 0 audit

- Handler-level prerequisite extraction currently walks into every child contract. Each exact variant therefore inherits sibling prerequisites and duplicates its own prerequisites.
- Handler-level string and boolean parameter extraction uses the same descendant walk. Contract overrides often mask the problem for common fields, but a parameter omitted by one contract can be inherited from an unrelated sibling.
- Completion outcomes use `ContractResult_CompletionTag` with a `tag` attribute. The extractor currently searches for `ContractResult_CompletionTags` and descendant `Reference` elements, so all emitted completion-tag result rows are empty.
- A corrected read-only projection found 80 unique parent-eligibility required tags, 74 with at least one producer in the snapshot, and 6 dangling required tags. Subcontract branch conditions add overlapping tags, bringing the combined source vocabulary to 85 required tags, 79 with a producer. It also found 35 parent-eligibility excluded tags, all with a producer.
- The mission shaper writes current shards without clearing prior shard directories. The browser index references 2,501 exact variant files, while the directory contains 2,665 files; 164 files are stale and unreachable from the current index.
- The browser index and route handler use the current 2,501-file mapping, so the stale shards do not alter normal indexed delivery. The shaper still needs transactional cleanup before future schema work.

## Validation performed

- Scintel accepted LIVE mission extractor: passed
- Mission source publication with SHA-256 verification: passed
- `npm run missions:shape`: passed
- `npm run crafting:shape-blueprint-sources`: passed
- Pre/post generated-tree semantic comparison: passed

No UI, API, solver, schema, calculation, or gameplay behavior changed during this snapshot refresh.

## Next implementation action

Use `docs/mission-golden-set-2026-07-29.json` and `docs/mission-extraction-solver-feasibility-2026-07-29.md` to implement the versioned Stage 1 Scintel extraction contract. Correct prerequisite and parameter scope, completion-tag outcomes, objective-template data, generated location roles, and publication cleanup before changing the browser.
