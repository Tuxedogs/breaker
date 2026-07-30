# Mission Extraction and Solver Feasibility

Audit date: 2026-07-29
Payout and required-item evidence update: 2026-07-30
Accepted channel: `LIVE`
Accepted build: `4.9.0-live.12232306`
Golden set: `docs/mission-golden-set-2026-07-29.json`

## Decision

An evidence-backed mission eligibility and unlock-path solver is feasible. The original schema was not safe to use as its graph input; the Stage 1 source contract now corrects the provable extraction boundaries.

Stage 1 corrects prerequisite scope, completion-tag outcomes, parameter scope, reputation-scope attributes, objective-template extraction, calculated payout evidence, and contract-owned mission-item/order evidence. After those changes, the solver can evaluate explicit gates, traverse proven completion-tag relationships, and use exact source-calculated base/solo payouts as an outcome. It still cannot optimize credits per hour, exact travel, or expected random rewards because authored reward-model time is not expected player completion time and runtime-selected procedural locations, travel costs, party splitting, and reward probabilities remain unavailable.

No browser redesign should begin against the current schema.

## Audit basis

The audit used the accepted Foundry records, localization, and reference index at:

- `D:/scintel/out/LIVE/4.9.0-live.12232306/foundry/records`
- `D:/scintel/out/LIVE/4.9.0-live.12232306/Data/Localization/english/global.ini`
- `D:/scintel/out/LIVE/4.9.0-live.12232306/datasets/ref_index.json`

It compared those records with:

- `D:/Moonbreaker/server-data/missions/source/mission_contracts.json`
- `D:/Moonbreaker/server-data/missions/mission_browser_index.json`
- Exact variant shards referenced by the browser index
- The current Scintel extractor and Moonbreaker shaper

The corrected counts below are a read-only audit projection. Generated mission JSON was not hand-edited.

## 1. Provable prerequisites and completion relationships

### What the source proves

The generator records explicitly provide these prerequisite types:

| Type | Parent-eligibility rows | Contracts containing the type | Solver meaning |
| --- | ---: | ---: | --- |
| Location | 664 | 650 | Offer or availability gate at a referenced location |
| Locality | 1,970 | 1,872 | Offer or availability gate from a locality pool or scope |
| Location property | 157 | 157 | Procedural location-property gate; exact location may remain unresolved |
| CrimeStat | 1,012 | 1,012 | Explicit minimum and maximum bounds |
| Reputation | 327 | 325 | Faction, scope, inclusion/exclusion, and standing bounds |
| Completed contract tags | 1,106 | 975 | Required and excluded completion-tag gates |

The source does not expose a direct contract-ID prerequisite in the audited records. Proven mission-to-mission dependencies are joins through completion tags.

`SubContract` records contain a second prerequisite scope. These are branch-selection conditions, not automatically parent-offer eligibility:

| Subcontract condition type | Rows | Parent variants containing the type |
| --- | ---: | ---: |
| Location | 73 | 8 |
| Locality | 1,811 | 595 |
| Reputation | 98 | 95 |
| Completed contract tags | 338 | 255 |

The new contract must keep `handler`, `contract`, and `subcontract` ownership. Flattening subcontract conditions into the parent variant would create false eligibility blockers.

Required and excluded tag polarity is structurally explicit:

- `requiredCompletedContractTags`
- `excludedCompletedContractTags`

Completion outcomes are also explicit as `ContractResult_CompletionTag tag="..."`.

A corrected tag projection found:

| Measure | Count |
| --- | ---: |
| Contracts producing at least one completion tag | 456 |
| Unique produced tags | 122 |
| Unique parent-eligibility required tags | 80 |
| Parent-eligibility required tags with at least one producer in this snapshot | 74 |
| Required tags without a producer in this snapshot | 6 |
| Unique parent-eligibility excluded tags | 35 |
| Parent-eligibility excluded tags with a producer in this snapshot | 35 |

This is enough to build a typed directed graph with alternate producers, dangling edges, exclusions, provenance, cycle detection, and exact-variant nodes.

Subcontract conditions use 55 required tags, 54 of which have a producer. Because many overlap parent eligibility, the combined source vocabulary is 85 required tags, 79 with a producer. Subcontract edges belong in an objective or branch graph rather than the parent eligibility graph.

The Rayari golden pair proves a complete relationship:

1. `1035d0f0-82e7-4cee-8d10-789925b3d138` excludes completion tag `ab960018-6478-4e5d-9c74-175662c57129` and grants that same tag on completion.
2. `1136e707-15cb-49b9-9943-c3a2de91d3f2` requires that tag.

The six dangling required tags must remain unresolved graph edges. They must not be treated as satisfied, absent, or title-inferred links.

### Why the current output is unsafe

The current extractor calls descendant traversal on a handler before iterating its contracts. That traversal enters every child contract. It then attaches the resulting aggregate to every sibling and appends the selected contract's prerequisites again.

This inflates the current output from thousands of correctly scoped rows to tens of thousands of duplicated and sibling-contaminated rows. For example, a selected variant can appear to have every locality used by its handler family.

Contract-level descendant traversal also flattens `SubContract.additionalPrerequisites` into the parent contract. Even after sibling contamination is removed, that would still confuse a branch-selection condition with an offer-eligibility gate.

The same scope defect exists in handler string and boolean parameter extraction. Contract-local overrides mask common fields such as title, but omitted fields can still inherit a sibling value.

Completion outcomes are currently empty because the extractor searches for the plural `ContractResult_CompletionTags` and descendant `Reference` elements. The source uses singular `ContractResult_CompletionTag` with a `tag` attribute.

Reputation extraction also needs two corrections:

- Source records use `scope`; the known GUID map currently expects `reputationScope`.
- Reputation scope is a separate identity and must not be resolved through the faction lookup.

The current extraction report's zero unresolved-prerequisite-reference count is therefore not a graph-readiness result. Location and tag references are excluded from that diagnostic, completion outputs are missed, and prerequisite scope is contaminated.

## 2. Provable objective stages and destination roles

### Objective structure

The 2,501 variants reference 335 unique template GUIDs:

- 333 template GUIDs resolve through the accepted reference index.
- 2 template GUIDs are unresolved.
- The 333 resolved templates contain 462 `ObjectiveToken` records.
- 253 resolved templates contain a `missionFlow` section.

The following fields are directly extractable:

- Objective token GUID
- Debug name
- `startsActive`
- Mission phase identifier tag
- Objective handler type
- Referenced, input, and output property declarations
- Display, travel, return, failure, and marker localization tokens
- Raw mission-flow conditions, actions, states, and boolean composition
- Contract display metadata such as `illegal`

This proves token identity, initial active state, objective role, and raw flow topology. It can also prove parallel starts without guessing. The three tokens in `chaineliminateall_3locations.xml`, for example, all have `startsActive="1"`.

The current serialized flow uses internal handles such as `ObjectiveToken[00F5]` rather than token GUIDs. Until those handles are resolved through a documented decoder, the extractor must emit typed unresolved flow references alongside the raw handle. It must not assign a handle to a GUID by list position.

The Battaglia Story 3 golden template demonstrates why this matters: it contains six named objective tokens and raw branching/sequencing actions, but exact condition-to-token GUID edges require internal-handle resolution.

### Pickup and destination roles

Role identity is often source-backed even when the runtime location is procedural.

The hauling golden template explicitly binds:

- `PickupLocation_BP` to the hauling handler's pickup location
- `DropoffLocation_BP` to the hauling handler's drop-off location

The selected contract then supplies distinct positive and negative tag searches for both properties. The source therefore proves that pickup and destination are different roles and proves each generated selector. It does not prove which exact location the game will choose at runtime.

The current shaper does not extract these property overrides. Instead, it recognizes some title and description tokens and emits destination as `unknown` or `unresolved`. Across active shards:

- 925 variants have an unresolved destination token.
- 1,576 variants have no shaped destination evidence and are marked unknown.

The revised contract should distinguish:

- Exact resolved location
- Generated location selector or pool
- System scope
- Role known but location unresolved
- Role absent from the source
- Template or reference unresolved

Pickup must never be substituted for destination merely because pickup is the only resolved location.

### Legality

Legality is not safe in the current name-based projection.

The source contains both template `ContractDisplayInfo.illegal` and contract or handler `ContractBoolParam param="Illegal"` signals. Across the current variants:

- 878 have both signals and they agree.
- 1,119 have only the template signal.
- 502 have both signals and they conflict.
- 2 have neither because their template references do not resolve.

The conflicts are consistent with a generic template default plus a contract override, but the effective precedence must be verified against the contract-template semantics before it becomes solver truth. Until then, emit both signals and an explicit conflict state. The golden set includes aligned lawful, aligned unlawful, conflicting, and genuinely unknown cases.

## 3. Calculated payout evidence

| Source result | Rows | Variants | Extracted numeric meaning |
| --- | ---: | ---: | --- |
| Fixed `ContractResult_Reward` | 8 | 8 | `reward`, `max`, `plusBonuses`, and `currencyType` |
| `ContractResult_CalculatedReward` | 2,325 | 2,321 | Source-backed base/solo aUEC calculation |

Every audited calculated result is nested under a `contractResults` ancestor containing:

- `contractBuyInAmount`
- `timeToComplete`
- `difficulty/ContractDifficulty`

The executable-backed reward model and `gamemode/sc_default.xml` establish:

```text
D =
  mechanicalLevel * mechanicalWeight
+ mentalLevel * mentalWeight
+ riskLevel * riskWeight
+ knowledgeLevel * knowledgeWeight

rawUEC = exp(0.303 * (D + 37)) * timeToComplete / 60
baseUEC = game integer rounding followed by nearest-250 rounding
```

The four levels come from the trailing numeric level on the exact CIG `ContractDifficulty` enum strings. The weights come from the referenced `ContractDifficultyProfile`. Both the raw enum and numeric level are preserved.

The source-contract v3 dry run resolves 2,320 of 2,321 calculated variants. The only unresolved row is a not-for-release contract with no difficulty profile. Nine not-for-release variants resolve to a valid numeric zero because their authored time input is zero; zero remains distinct from missing or unresolved.

The release-ready set contains 1,623 variants and 1,627 calculated result rows. All resolve. Its base/solo payout range is 8,000-4,708,750 aUEC with a median of 93,500 aUEC.

Four released variants contain two calculated result rows. Their result masks and indices remain separate, `aggregationStatus` is `not_aggregated`, and `resultLoopVerificationRequired` is true. They must never be summed.

Buy-in remains separate from payout. Twelve calculated rows have a nonzero buy-in across the full source, including six active certification missions. Fixed non-UEC currencies such as prison MER remain fixed currency rewards rather than calculated aUEC.

The reputation curve is:

```text
rep = round(0.139 * exp(0.36 * (D + 26)) * timeToComplete / 60)
```

It is applied only when the exact contract contains `ContractResult_CalculatedReputation`: four variants across the full source and three released variants. Fixed legacy reputation remains fixed. Reputation and standing select which exact variant is available; they do not multiply payout.

`timeToComplete` is an authored reward-model input. It must not be presented as expected player completion time or used for credits-per-hour optimization without separate mechanics evidence.

### Mission progression and turn-in item evidence

Required mission items are not reward rows. The relevant contract-owned sources are `MissionPropertyValue_HaulingOrders` and `MissionPropertyValue_MissionItem`.

- Hauling orders contain explicit order contents and quantity fields. The accepted source contains 580 hauling-order properties across 492 variants, including entity classes, entity-class sets, resources, mission-item references, and 11 explicit OR branches.
- Mission-item values contain selectors and selection bounds, not safe turn-in quantities. The accepted source contains 975 selector properties across 384 variants.
- `minItemsToFind` and `maxItemsToFind` remain selector bounds. Only hauling-order `minAmount`, `maxAmount`, `minSCU`, and `maxSCU` are explicit order quantities.
- Internal `MissionProperty[...]` handles remain unresolved. They must not be joined to selectors by list position.
- One Wallace Klim variant has a mission-item order with no item handle. It remains an explicit missing source reference rather than receiving a synthesized item.
- Entity-class identities may reuse the existing entity resolver. Entity-class sets need their own set/member projection. Resources and item-definition identities remain typed unresolved where no source resolver exists.

The v3 contract therefore emits contract/handler-owned property evidence and a separate `requiredItemEvidence` projection. Only direct hauling-order contents are classified as explicit orders. Mission-item selectors remain selector evidence until their internal property binding is decoded.

## 4. Solver goals supportable without inference

### Supportable after the extraction contract is corrected

- Evaluate all explicit CrimeStat bounds.
- Evaluate explicit reputation, scope, standing, and exclusion gates against supplied player state.
- Evaluate exact location, locality, and system availability when player context contains the required identity.
- Evaluate required and excluded completion tags.
- Classify an exact variant as eligible, blocked, excluded, unavailable, or unresolved.
- Return every blocker with source provenance.
- Traverse completion-tag dependencies through known producers.
- Preserve alternate producer paths.
- Detect cycles and the six currently dangling required tags.
- Find a shortest path by mission count when every traversed edge is proven.
- Solve for an explicitly rewarded blueprint.
- Solve for a fixed resolved item reward.
- Filter or rank exact variants by source-calculated base/solo payout.
- Identify direct hauling-order item/resource requirements while preserving unresolved identities and conditional order structure.
- Identify variants contributing explicit reputation rewards to a resolved scope.
- Filter or exclude not-for-release and work-in-progress variants using independent flags.
- Explain why a result is unknown when a template, scope, tag producer, location selector, legality signal, or reward reference is unresolved.

### Not supportable from the accepted source without added evidence

- Credits-per-hour or profit optimization.
- Expected completion time based on `timeToComplete`.
- Runtime party-split payout.
- Treating every mission-item selector as a proven turn-in requirement.
- Joining opaque mission-item/property handles by position or naming similarity.
- Exact travel time, distance, fuel cost, or optimal route.
- The runtime-selected location from a procedural tag search.
- Expected value of weighted rewards until award records, weights, counts, and conditions are normalized.
- Reputation grind length when reward amounts or thresholds are unresolved.
- A lowest-cost path that silently combines mission count, risk, legality, time, travel, and reward probability.
- Eligibility without explicit player state.
- A dependency inferred from family membership, title similarity, rank numbering, or current concept grouping.

The first solver cost model should therefore be `mission_count`. Other cost models should remain unavailable until their inputs and units are source-backed.

## 5. Required data-contract changes before browser redesign

Advance the mission source and shaped contracts to a new schema version. Do not reinterpret the current version in place.

### Scintel source contract

1. Scope extraction correctly.
   - Extract handler-owned values without entering `contracts`.
   - Extract each contract's values independently.
   - Extract subcontract conditions as branch-owned data.
   - Preserve `sourceScope: handler | contract | subcontract` and the subcontract ID.
   - Deduplicate identical inherited and local values without losing provenance.

2. Emit typed prerequisite edges.
   - Stable edge ID
   - Exact variant ID
   - Type
   - Required versus excluded polarity
   - Faction, reputation scope, standing, tag, location, or locality identity
   - Minimum and maximum values
   - Resolution status
   - Source file and source scope

3. Emit typed outcome edges.
   - Completion tags from the singular result and `tag` attribute
   - Reputation scope and amount
   - Fixed credits
   - Calculated reward context
   - Blueprint pool and mission-result conditions
   - Direct and weighted item reward conditions

4. Extract template-backed objective definitions.
   - Template GUID and resolved path
   - Objective tokens and initial state
   - Handler and property roles
   - Raw flow conditions and actions
   - Resolved GUID edges or typed unresolved internal handles
   - Failure and disqualifying conditions

5. Preserve generated location selectors.
   - Pickup, objective, and destination roles
   - Positive and negative tags
   - Exact versus generated semantics
   - Runtime selection remains unresolved

6. Emit legality evidence, not a name-based verdict.
   - Template flag
   - Effective override candidate
   - Agreement, conflict, or missing state
   - Provenance and verified precedence once known

7. Expand validation reports.
   - Dangling required and excluded tags
   - Multiple producers
   - Cycles
   - Unresolved template and flow handles
   - Prerequisite scope contamination guard
   - Duplicate edge guard
   - Reward and location selector coverage

### Moonbreaker canonical and delivery contract

1. Separate exact source truth from browser projection.
   - `MissionVariant` remains the solver node.
   - `MissionFamily` remains source organization.
   - `MissionConcept` remains a browsing projection and must not determine dependency edges.

2. Build equivalence from canonical objective and gate signatures.
   - Include normalized objective topology, prerequisite semantics, outcome semantics, and effective legality.
   - Treat system, generated location, risk, and reward differences as explicit variant dimensions.
   - Do not use title similarity as decisive evidence.

   The golden set contains a current grouping failure: variants `12e92b29-e5a8-4ba7-95a4-122d6c992684` and `982d51e3-4ffc-4f4a-b32f-0ab8749515d8` share a family and current concept key but have different template GUIDs and objective topology. They must not collapse.

3. Introduce shared typed graph and solver modules outside React.
   - Canonical player state
   - Eligibility result with all blockers
   - Dependency and outcome graph
   - Deterministic traversal and explanations
   - No page-local calculation

4. Keep the sharded API.
   - Browser summaries stay compact.
   - Exact variants stay lazy-loaded.
   - Add graph-specific shards or endpoints rather than returning every variant body in the browser index.

5. Make publication transactional.
   - Write to a temporary output tree.
   - Validate it.
   - Replace the prior shaped tree atomically.
   - Remove unreachable family, concept, and variant shards.

   The current directory has 2,665 exact-variant files while the active index references 2,501. The 164 extra files are stale.

6. Centralize or contract-test filters.
   - Server filtering and client fallback filtering currently duplicate logic.
   - The documented static fallback path is unverified and absent from the present public output.

7. Preserve independent release flags and unresolved states.
   - Not for release and work in progress are separate booleans.
   - Zero, absent, generated, inferred, conflicting, and unresolved values must remain distinct.

## Recommended implementation gate

Stage 1 is complete only when:

- The golden fixture passes against a newly generated source contract.
- The corrected prerequisite counts are stable and sibling contamination tests pass.
- Completion-tag producers, required edges, excluded edges, dangling edges, and cycles have generated reports.
- Objective tokens and raw flow references are emitted for all resolvable templates.
- Generated pickup and destination selectors retain their roles.
- Calculated base/solo payout is emitted upstream with complete profile, rating, curve, rounding, branch, buy-in, reputation, build, and source provenance.
- Missing payout inputs remain typed unresolved and valid numeric zero remains distinct.
- Direct hauling-order requirements and mission-item selectors remain separate, source-owned evidence.
- Legality conflicts are explicit.
- A clean shape leaves no unreferenced shards.

At that point the mission schema can be locked and deterministic eligibility work can begin. Browser and dossier redesign should follow the accepted schema, not precede it.

## Stage 0 validation

- Accepted LIVE extraction refresh: passed
- Mission publication and shaping: passed
- Crafting blueprint-source shaping: passed
- Refreshed generated-tree semantic comparison: no changes except regenerated timestamps
- Golden fixture JSON parse: passed
- Golden fixture source ID, source path, and template joins: 18 of 18 passed
- Golden objective-template assertions: 4 of 4 passed
- Golden completion-tag polarity and outcome assertion: passed
- Golden parent-versus-subcontract scope assertion: passed
- Golden fixed-reward assertions: passed
- Golden collapse and do-not-collapse assertions: passed
- Markdown and JSON whitespace check: passed

No UI, API, schema, solver, gameplay calculation, generated mission data, or routing behavior changed in Stage 0. No screenshots were required because this stage did not change presentation.
