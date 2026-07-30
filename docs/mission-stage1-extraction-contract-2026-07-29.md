# Mission Stage 1 Extraction Contract

Completed: 2026-07-29
Payout and required-item extension accepted: 2026-07-30
Accepted channel: `LIVE`
Accepted build: `4.9.0-live.12232306`
Source contract: `mission_contracts.json` schema version 3

## Outcome

Stage 1 is complete at the extraction boundary.

Scintel now emits source-backed exact-variant eligibility, branch-condition, outcome, objective-template, legality, calculated base/solo payout, calculated reputation, mission progression/required-item, and completion-tag graph evidence. The accepted LIVE output passes the deterministic source validation.

The new source artifacts were not published into Moonbreaker's checked-in generated tree. Browser, route, bookmark, crafting blueprint-source, and UI behavior therefore remain unchanged. Moonbreaker does not contain or run the payout formula.

## Corrected ownership

- Handler extraction no longer enters sibling contract trees.
- Contract extraction no longer enters subcontract trees.
- Handler and contract string and boolean parameters retain inheritance and local overrides without sibling leakage.
- Parent eligibility contains handler-owned and exact-contract-owned prerequisites only.
- Subcontract prerequisites remain branch-owned and are keyed by subcontract ID.
- Identical inherited and local prerequisite semantics are deduplicated without discarding their source scopes or owners.
- Parent outcomes do not absorb subcontract results.

The accepted snapshot now contains 5,236 correctly scoped parent prerequisite rows:

| Source type | Rows |
| --- | ---: |
| Location | 664 |
| Locality | 1,970 |
| Location property | 157 |
| CrimeStat | 1,012 |
| Reputation | 327 |
| Completed contract tags | 1,106 |

## Source contract version 3

Each exact mission variant now includes:

- Compatibility prerequisite and reward arrays
- Deterministic typed `prerequisiteEdges`
- Branch-owned `subContractPrerequisiteEdges`
- Deterministic typed `outcomeEdges`
- A compact `objectiveTemplate` reference and resolution state
- `legalityEvidence` with handler, contract, and template provenance
- Versioned calculated base/solo aUEC with profile, rating, curve, rounding, branch, buy-in, and build provenance
- Calculated reputation only on `ContractResult_CalculatedReputation`
- Contract/handler-owned mission-item and hauling-order property evidence
- Separate `requiredItemEvidence`, never mixed with rewards or outcome edges
- Independent not-for-release and work-in-progress flags

Typed prerequisite edges preserve:

- Exact variant ID
- Stable edge ID
- Parent or subcontract owner
- Required or excluded polarity
- Source-backed identities and bounds
- Raw attributes
- Resolution state
- Source file, element, scope, and owner provenance

Typed outcome edges cover:

- Completion tags
- Blueprint rewards
- Reputation rewards
- Fixed credits
- Calculated credits
- Fixed items
- Weighted items

## Objective templates

Scintel now emits `mission_objective_templates.json` as a normalized, non-duplicated template catalog.

The accepted snapshot contains:

| Measure | Count |
| --- | ---: |
| Referenced templates | 335 |
| Resolved templates | 333 |
| Unresolved templates | 2 |
| Objective tokens | 462 |
| Templates with mission flow | 253 |

Token IDs, debug names, initial active state, phase tags, property declarations, handler evidence, display tokens, and raw typed mission-flow trees are retained.

All 5,920 internal objective and property handles remain explicitly marked `unresolved_internal_handle`. No handle is joined to a GUID by list position.

## Legality evidence

Legality remains evidence, not an effective verdict.

| Comparison state | Variants |
| --- | ---: |
| Template and owned override agree | 878 |
| Template only | 1,119 |
| Template and owned override conflict | 502 |
| Owned override only | 0 |
| Missing or unresolved | 2 |

The contract preserves exact handler, contract, and template XML paths. Override precedence remains unresolved until separate mechanics evidence proves it.

## Calculated payouts

The contract preserves all 2,325 calculated-credit result rows across 2,321 exact variants.

Each row includes:

- `formulaStatus: resolved_source_backed | unresolved`
- `baseSoloAmount` and compatibility `amount`
- Raw amount and game integer-rounded amount
- Difficulty profile GUID, name, weights, source hash, and source path
- Four raw CIG difficulty enums, numeric levels, weights, and contributions
- Raw and numeric `contractBuyInAmount`, explicitly separate from payout
- Authored reward-model `timeToComplete`
- Raw and normalized `uecCurve`
- Integer and nearest-250 rounding order
- Channel, build ID, calculation-input digest, and source provenance
- Raw mission-result booleans
- Result index/count and non-aggregation state

The exact-variant `calculatedPayout` object projects a common persisted base/solo amount only when result rows resolve consistently. It never sums result rows.

| Measure | Count |
| --- | ---: |
| Calculated variants | 2,321 |
| Calculated result rows | 2,325 |
| Resolved variants | 2,320 |
| Typed unresolved variants | 1 |
| Released variants | 1,623 |
| Released result rows | 1,627 |
| Released unresolved variants | 0 |
| Released payout range | 8,000-4,708,750 aUEC |
| Released median | 93,500 aUEC |
| Released multi-result variants flagged | 4 |
| Active nonzero certification buy-ins | 6 |
| Calculated-reputation variants, all/released | 4 / 3 |

Nine not-for-release variants have a resolved numeric zero payout because the authored time input is zero. Zero remains distinct from missing. One not-for-release variant lacks a difficulty profile and remains typed unresolved.

Reputation does not multiply payout. Fixed legacy reputation remains fixed, while the source-backed reputation curve is used only for an actual calculated-reputation result.

No expected player completion duration, credits per hour, party split, net payout, or travel estimate is inferred.

## Mission progression and required items

Required-item evidence is separate from `itemRewards`.

| Measure | Count |
| --- | ---: |
| Variants with item-related override evidence | 718 |
| Item-related property rows | 1,555 |
| Hauling-order properties | 580 across 492 variants |
| Mission-item selector properties | 975 across 384 variants |
| Entity-class order nodes | 234, all resolved |
| Entity-class-set order nodes | 73, all resolved |
| Resource order nodes | 641, explicitly unresolved identities |
| Mission-item order references | 290 |
| Explicit OR nodes | 11 |
| Missing mission-item references | 1 |

Hauling orders preserve all-of/any-of structure and raw plus parsed quantities, including zero. Mission-item selectors preserve exact-item, tag-search, and property-tag conditions, but are not promoted into turn-in requirements without a proven property binding. Opaque `MissionProperty[...]` handles remain unresolved.

The Wallace Klim variant `df80b67b-0fb9-4902-83a5-6913378c6c1b` retains its missing item reference explicitly.

## Completion-tag graph report

The generated extraction report now separates parent eligibility from subcontract branch conditions.

| Parent graph measure | Count |
| --- | ---: |
| Producer contracts | 456 |
| Produced tags | 122 |
| Required tags | 80 |
| Required dangling tags | 6 |
| Excluded tags | 35 |
| Excluded dangling tags | 0 |
| Tags with alternate producers | 87 |
| Cycle components | 4 |

Subcontract conditions contain 55 required tags with 1 dangling tag. The combined parent-and-branch required vocabulary contains 85 tags, but branch conditions are not promoted into the parent eligibility graph.

The Rayari golden path now verifies a source-backed producer, self-exclusion, and downstream consumer relationship.

## Files changed

Scintel:

- `D:/scintel/scripts/missions/build_mission_blueprint_rewards_api.py`
- `D:/scintel/scripts/missions/build_mission_blueprint_rewards_api.ps1`
- `D:/scintel/scripts/missions/build_mission_blueprint_rewards_api_test.py`
- `D:/scintel/scripts/pipeline/run_channel_pipeline.ps1`
- `D:/scintel/scripts/publish/publish_mission_api_to_moonbreaker.ps1`

Moonbreaker:

- `docs/mission-golden-set-2026-07-29.json`
- `docs/mission-stage1-extraction-contract-2026-07-29.md`
- `scripts/verify-mission-source-contract.mts`
- `package.json`

## Validation

- Eleven focused Scintel extraction tests: passed
- Python compilation: passed
- PowerShell parsing for the extraction wrapper and channel pipeline: passed
- Full accepted LIVE schema-version-3 extraction to an isolated output root: passed
- Exact comparison against the authoritative payout audit: 2,321 joins and zero payout, difficulty, profile, rating, time, reputation, or variant-summary mismatches
- Required-item coverage and TheCollector, Ling, and Wallace Klim golden checks: passed
- Python and PowerShell diff checks: passed

Moonbreaker source verification, shaping, lint, build, routes, and visual validation remain part of the deliberate Stage 2 integration because no runtime or UI contract was changed in this extension.

## Intentionally deferred

- Publishing the version 3 source artifacts into Moonbreaker's checked-in generated tree
- Version 3 Moonbreaker canonical shaping and DTOs
- Immutable generation publication and atomic current-version pointer
- Removal of the 164 stale variant shards and 6 stale shards in each family directory from the existing checked-in version 1 tree
- Eligibility evaluation and path optimization
- Route and graph endpoints
- Browser or dossier redesign

These belong to the next stage after the source contract is reviewed and accepted. The existing version 1 browser remains the active runtime contract until that integration is deliberately performed.
