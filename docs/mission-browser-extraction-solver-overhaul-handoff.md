# Mission Browser, Extraction, and Solver Overhaul - Agent Handoff

Updated: 2026-08-15
Status: Mission Offer rollout implemented, published, and verified. The active runtime is source contract 4 / shaped mission schema 3 / offer schema 1 at generation `2cc966f1ae3dbd6e7db858a2`. Source 3 / shaped 2 remains supported only as a pointer-based rollback.

## Current implementation authority

This section supersedes the July stage-status and proposed-model text later in this file. The older material remains as design history. When it conflicts with this section, the compatibility manifest, audit receipt, active pointer, and product code are authoritative.

Read these first:

- `D:/Moonbreaker/docs/mission-offer-api-compatibility-manifest.md`
- `D:/Moonbreaker/docs/mission-build-generation-audit-live-4.9.0-fdfd54f65b1f84a621899b21.json`
- `D:/Moonbreaker/server-data/missions/current.json`
- `D:/scintel/docs/contracts/mission-offer-source-audit-v1.json`

The implemented identity model is:

```text
Mission Series (structural family/generator)
  -> Mission Offer (player-facing localized title; searchable/bookmarkable card)
      -> Exact Variant (contract UUID; exact payout/rewards/prerequisites/release)
          -> Availability Branch (owner-scoped subcontract/locality tuple)
```

Current published facts:

- LIVE build `4.9.0-live.12232306`.
- 259 mission series, 1,012 Mission Offers, and 2,501 exact variants.
- Every exact variant belongs to exactly one offer through `variantOfferKeys`.
- Offer search uses only offer-local search text and facets. Family or concept membership cannot promote sibling offers.
- `Primo Target`, `Plug a traitor`, and `Show Them Who's Boss` are first-class offers rather than hidden family variants.
- Stable runtime substitutions are not invented; Ghost remains `Ghost [TargetName]` without live-instance evidence.
- Display verification is `Verified | Unverified | Unknown`. Raw `Illegal` evidence is provenance, not a lawful/criminal UI classification. All current records remain `Unknown` until effective precedence is source-proven.
- Provider identity is separate from reputation faction. Explicit Contractor text may resolve the provider without fabricating a reputation-faction join.
- Offer summaries may show common values, ranges, or `varies`; exact payout, blueprint pool, reputation prerequisite/reward, eligibility, and path truth remain exact-variant-owned.
- The aUEC solver output, blueprint pool tuples and reverse links, reputation prerequisite polarity/scope/bounds, release flags, and branch ownership are protected merge-veto invariants.
- Canonical offer URLs/bookmarks coexist with legacy concept aliases. One-to-many legacy aliases show a chooser/series; they never silently select an offer.
- Crafting mission-source bookmarks remain exact identities: `mission:<contractId>:<poolGuid>`.

Current API additions:

- `GET /api/missions/offer/:offerKey`
- `GET /api/missions/offer/:offerKey/variants`
- exact-variant eligibility and prerequisite-path routes remain unchanged; there is intentionally no offer-level solver route.

Publication is complete in Moonbreaker commit `9ed198836` and Scintel source-contract commit `cc00f2f`. The accepted source artifact `mission_contracts.json` is Git LFS-managed in Moonbreaker without changing its audited SHA-256 (`761b960fb61a80fda0808f348d24ffb260861c02338d7b852da5c18624a8c40d`). Do not regenerate or rewrite it merely to avoid LFS.

Last accepted validation receipt: 51/51 mission tests, 3/3 Mission Offer Playwright tests, source and shaped verifiers, six blueprint-source routes, API boundary check, lint, and production build all passed. Re-run the applicable gates after any new source, projection, route, solver, blueprint, or UI change.

## Start here

This handoff covers a complete overhaul of:

- Mission extraction in `D:/scintel`
- Mission shaping and delivery in `D:/Moonbreaker`
- Mission discovery and detail presentation at `/industry/missions`
- A new mission eligibility/path solver

Read these files before changing behavior:

- `D:/Moonbreaker/AGENTS.md`
- `D:/Moonbreaker/moonbreaker_design_canon.md`
- `D:/Moonbreaker/docs/generated-data-manifest.md`
- `D:/Moonbreaker/docs/mission-stage2-shaping-contract-2026-07-30.md`
- `D:/Moonbreaker/docs/mission-stage3-solver-contract-2026-07-30.md`
- `D:/Moonbreaker/src/lib/missionData.ts`
- `D:/Moonbreaker/server/routes/missions.routes.ts`
- `D:/Moonbreaker/scripts/shape-mission-browser-data.mts`
- `D:/scintel/scripts/missions/build_mission_blueprint_rewards_api.py`
- `D:/scintel/scripts/publish/publish_mission_api_to_moonbreaker.ps1`

The current Recipe Browser and Crafting Detail work is a structural precedent, not a component template. Reuse its discipline around search, filters, selected identity, dense comparisons, data provenance, and responsive validation. Do not force crafting-specific taxonomy or components onto missions.

## Product objective

The finished mission experience should help a player answer:

1. What mission offers exist?
2. Which offers match my system, career, faction, legality, risk, and desired rewards?
3. Which mission concept or exact variant am I looking at?
4. Where can it appear, and what is known versus generated or unresolved?
5. What are its prerequisites?
6. Am I eligible now?
7. If not, what is the evidence-backed path to eligibility?
8. Which missions advance the reputation, unlock, blueprint, item, or credit outcome I want?

Browsing and solving are related but distinct workflows. The solver must be a peer operational surface, not a calculation hidden inside a mission identity card.

## Historical pre-offer runtime snapshot (superseded)

Current shaped data was generated on 2026-07-16 from source last modified on 2026-07-16. Refresh and diff the current channel before treating these counts as permanent.

| Measure | Current value |
| --- | ---: |
| Exact mission variants | 2,501 |
| Source families | 259 |
| Player-facing concepts | 533 |
| Full-view categories | 18 |
| Faction views | 28 |
| Reputation scope groups | 38 |
| Fixed credit payouts extracted | 8 |
| Credit formulas unresolved in published version 1 shaping | 2,321 |
| Variants with blueprint rewards | 763 |
| Resolved item rewards | 288 |
| Unresolved weighted item rewards | 38 |
| Exact pickup scopes | 695 |
| Generated pickup pools | 882 |
| System-scope pickups | 704 |
| Unknown pickup scopes | 220 |
| Unknown destination/drop-off | 925 |
| Partial reputation scopes | 404 |
| Unresolved reputation scopes | 389 |

These figures come from:

- `server-data/missions/mission_browser_index.json`
- `server-data/missions/mission_browser_extraction_report.json`
- `server-data/missions/source/mission_extraction_report.json`

This table describes the pre-offer runtime and is retained only for comparison. It is not the active pointer.

Do not present an unresolved payout as zero, a fixed payout, or an estimate. Do not convert unknown destinations into known pickup locations. Missing, unknown, generated, inferred, partial, and resolved are different states.

## Historical Stage 1 source contract

Scintel `mission_contracts.json` schema version 3 is implemented and passes an isolated accepted-LIVE dry run.

It preserves:

- Correct handler, contract, and subcontract ownership
- Typed prerequisite and outcome edges
- Correct completion-tag producers and graph diagnostics
- Normalized objective-template evidence with unresolved internal handles
- Exact legality evidence without inventing precedence
- Versioned source-calculated base/solo aUEC
- Fixed and calculated reputation as separate result types
- Certification buy-ins separate from payout
- Contract-owned hauling-order and mission-item selector evidence separate from rewards

Calculated payout acceptance:

| Measure | Count |
| --- | ---: |
| Calculated variants | 2,321 |
| Calculated result rows | 2,325 |
| Resolved variants | 2,320 |
| Typed unresolved variants | 1 |
| Released variants / rows | 1,623 / 1,627 |
| Released payout range | 8,000-4,708,750 aUEC |
| Released median | 93,500 aUEC |
| Multi-result variants flagged, never summed | 4 |
| Active nonzero buy-ins | 6 |

The formula is owned and executed by Scintel once per accepted channel/build extraction. Moonbreaker must only project the persisted `baseSoloAmount`; it must not reproduce rating parsing, weights, exponential curves, rounding, buy-in arithmetic, reputation arithmetic, or party splitting.

Required-item evidence acceptance:

| Measure | Count |
| --- | ---: |
| Variants with item-related properties | 718 |
| Property/evidence rows | 1,555 |
| Hauling-order properties | 580 |
| Mission-item selector properties | 975 |
| Explicit entity-class / set / resource / mission-item order nodes | 234 / 73 / 641 / 290 |
| Missing mission-item references retained | 1 |

Direct hauling-order contents are explicit order evidence. Mission-item selectors are not automatically turn-in requirements. Opaque property handles remain unresolved and are never joined by list position.

## Extraction and publication path

```text
D:/scintel/libs/foundry/records
  + D:/scintel/data/Data/Localization/english/global.ini
  -> D:/scintel/scripts/missions/build_mission_blueprint_rewards_api.py
  -> D:/scintel/out/<CHANNEL>/<BUILD_ID>/datasets/missions/*
  -> D:/scintel/scripts/publish/publish_mission_api_to_moonbreaker.ps1
  -> D:/Moonbreaker/server-data/missions/source/*
  -> D:/Moonbreaker/scripts/shape-mission-browser-data.mts
  -> D:/Moonbreaker/server-data/missions/*
  -> /api/missions/*
  -> D:/Moonbreaker/src/lib/missionData.ts
  -> D:/Moonbreaker/src/pages/industry/MissionBrowserPage.tsx
```

Run the upstream extractor:

```powershell
pwsh D:/scintel/scripts/missions/build_mission_blueprint_rewards_api.ps1
```

Publish and shape:

```powershell
pwsh D:/scintel/scripts/publish/publish_mission_api_to_moonbreaker.ps1
```

The publish script copies five source artifacts and then runs both mission shaping and crafting blueprint-source shaping. Preserve that cross-feature dependency.

Do not hand-edit generated mission JSON.

## Historical source-contract notes

These notes describe the predecessor source contract. The published source tree now contains source contract 4, which adds `offerEvidence` while preserving the exact-variant fields described below.

- Contract, family, generator, handler, mission-type, and template identity
- Localized and raw title/description values
- String and boolean parameters
- Faction, standing, and reputation-scope identifiers
- Prerequisites and raw references
- Blueprint, fixed/calculated reputation, fixed/calculated currency, fixed-item, weighted-item, and completion-tag results
- Versioned calculated payout and reputation evidence with build/profile/curve provenance
- Contract-owned property overrides and separate required-item evidence
- Release, work-in-progress, tutorial, and event classification

Related source files provide blueprint pool lookups, reverse blueprint sources, mission reward lookups, and extraction diagnostics.

The source extractor resolves only source-backed identities and retains typed unresolved states. Moonbreaker validates source 4, carries `offerEvidence` into canonical exact variants, and creates the offer-v1 projection without changing protected exact-variant subtrees.

## Current shaping responsibilities

`scripts/shape-mission-browser-data.mts` is approximately 169 KB and currently owns too many distinct concerns:

- Title cleanup and fallback selection
- Difficulty/risk parsing
- Activity classification
- Objective signatures
- Family-to-concept grouping
- Category projection
- Pickup and locality interpretation
- Destination/objective token interpretation
- Prerequisite presentation
- CrimeStat and lawful/unlawful classification
- Credit and item reward classification
- Reputation scope and reward-path presentation
- Search text and filter facets
- Browser projections
- Family, concept, and exact-variant sharding
- Extraction, grouping, and category reports

Do not move these heuristics into React. Separate extraction truth, normalization, semantic projection, solver graph construction, and presentation formatting into independently testable modules.

## Current runtime API

The runtime root defaults to `server-data/missions` and may be overridden with `MISSION_DATA_ROOT`.

Existing read-only endpoints:

- `GET /api/missions/browser`
- `GET /api/missions/offer/:offerKey`
- `GET /api/missions/offer/:offerKey/variants`
- `GET /api/missions/family/:familyKey`
- `GET /api/missions/family/:familyKey/variants`
- `GET /api/missions/variant/:variantKey`

For schema 3, the browser endpoint filters offer-local search text and offer-local provider, mission type, reward, reputation reward, release, confidence, and verification facets. Offer, family, and variant bodies are lazy-loaded from generation-contained shards. Schema 2 retains its legacy family/concept behavior for rollback.

`src/lib/missionData.ts` branches on runtime schema capability and loads offer detail/variant routes for schema 3 while preserving the schema-2 concept path. Do not add a `public/api` fallback; Vite, Vercel, and standalone adapters route `/api/missions/*` to the same mission handler.

The sharded delivery model is sound and should be preserved unless measurements prove otherwise. The browser index is already several megabytes; do not put every exact variant body back into it.

## Historical browser behavior (superseded by offer-first schema 3)

Route: `/industry/missions`

At that historical stage, the page:

- Uses query parameters for search, filters, view, page, and selected concept
- Supports Full, Faction, and Reputation projections
- Displays 12 concepts per page
- Opens a concept dossier in a modal
- Lazy-loads variants across all families belonging to a concept
- Groups variants by inferred risk tier and pickup/availability scope
- Collapses player-facing-equivalent variants
- Stores mission bookmarks in local storage shared with Blueprint Tracker
- Displays reward, reputation, location, prerequisite, confidence, release, and technical provenance details

The main page is currently a single approximately 118 KB React file with browser state, filter logic, equivalence logic, formatting, cards, dossier UI, and technical detail UI. Its stylesheet is approximately 59 KB and also imports crafting browser CSS.

Known architecture concerns:

- Page-local filtering duplicates server and fallback filtering.
- Many player-facing summaries are computed in the page.
- Activity, equivalence, and grouping semantics cross extraction, shaping, and presentation boundaries.
- Shaping also reads `tmp/scintel-api-candidate/ref_index.json` when available. This is a hidden optional input whose ownership, freshness, and publication contract must be made explicit.
- Unused historical `FamilyDetail` and `VariantTabs` implementations remain in the page.
- Mission bookmark storage is owned by a crafting/Blueprint Tracker utility.
- No targeted mission unit, route, shaping, or browser UI test suite currently exists.
- The page imports crafting browser styles rather than owning a clearly bounded mission presentation system.

Preserve bookmark compatibility with Blueprint Tracker unless an explicit migration is implemented.

## Historical solver gap (resolved)

The deterministic exact-variant solver is implemented. Its artifact reader accepts only coherent schema tuples `2/3/(no offer)` and `3/4/1`, requires graph/report/manifest/solver-reference generation agreement, and rejects mixed or incomplete generations. Eligibility and prerequisite-path calls remain exact-variant operations.

At that historical stage, chain behavior was limited to:

- Recognizing prerequisite types
- Hashing unlock references into an objective-signature `chainState`
- Showing unlock prerequisites as `Prerequisite mission or completion tag`
- Keeping the raw references in technical data

This is useful grouping evidence, but it is not a dependency graph and cannot answer eligibility or path questions.

Do not call filtering, concept grouping, or the current unlock hash a solver.

## Extraction audit result

The Stage 0/1 audit verified the following boundaries:

1. Typed prerequisite identity
   - Required mission contract
   - Required completion tag
   - Required reputation/standing/rank
   - Minimum and maximum CrimeStat
   - Location or locality availability
   - Other gates and exclusions
2. Mission outcomes
   - Completion tags granted
   - Reputation and standing changes by exact scope
   - Fixed and calculated credit inputs
   - Blueprint and item reward conditions
3. Objective structure
   - Objective handlers and ordered/parallel stages
   - Target counts and target types
   - Pickup, objective, and destination roles
   - Failure or disqualifying conditions
4. Offer availability
   - Faction/provider
   - System, locality pool, and generated region
   - Repeatability, cooldown, intro/career status, release state
5. Stable joins
   - Contract ID
   - Family ID
   - Completion tag ID
   - Reputation scope ID
   - Reward pool and blueprint GUID

If the source does not prove a relationship, emit an unresolved typed edge with provenance. Do not infer a prerequisite graph from title similarity, family membership, sequential numbering, or page-local assumptions.

Typed unlock/completion-tag relationships and calculated payout inputs are now emitted upstream. Exact internal objective/property-handle joins, runtime procedural selections, expected completion time, party payout splitting, and several item/resource identities remain unresolved and must not be inferred downstream.

## Proposed canonical mission model

Do not treat this as an approved schema without an audit. It is the minimum conceptual separation the implementation should achieve:

```text
MissionConcept
  player-facing discovery identity
  -> MissionFamily[]
      source family/template grouping
      -> MissionVariant[]
          exact offer/contract identity

MissionVariant
  -> AvailabilityScope
  -> ObjectiveGraph
  -> PrerequisiteEdge[]
  -> OutcomeEdge[]
  -> Reward[]
  -> Provenance[]

PlayerMissionState
  completed contract IDs/tags
  reputation/standing/rank by scope
  CrimeStat
  current system/location when relevant
  explicit user preferences and desired outcomes

MissionSolveResult
  eligible now
  blocked with typed reasons
  unresolved eligibility
  evidence-backed prerequisite path
  outcome contribution
  confidence and provenance
```

Concepts are for browsing. Exact variants are the solver nodes when their prerequisites or outcomes differ.

## Solver requirements

The solver must be deterministic and live outside presentation components.

Minimum capabilities:

- Evaluate exact variant eligibility against explicit player state
- Distinguish eligible, blocked, unavailable, unresolved, and excluded
- Return every blocking prerequisite, not just the first
- Traverse proven mission/completion-tag dependencies
- Detect cycles and dangling references
- Produce a shortest or lowest-cost path only when edge semantics and costs are known
- Explain why each step is recommended
- Preserve alternate valid paths
- Support goals such as a blueprint, item, reputation scope/rank, completion tag, faction, or mission concept
- Never convert unresolved edges into satisfied edges
- Never assume the user has completed a prerequisite

Before optimizing a path, define the cost model. Mission count, expected time, travel, legality, risk, reputation grind, and reward probability are not interchangeable. Do not silently combine them into one score.

If travel time or expected completion time is not source-backed, present it as unavailable rather than estimating it in the UI.

## Browser redesign direction

Use the Recipe Browser refactor as a hierarchy precedent:

1. Search
2. Persistent data-backed filter rail
3. Selected mission/concept hero
4. Dense sortable list or table
5. Mission dossier/detail
6. Separate solver workspace

Candidate permanent filter families, subject to actual facet quality:

- System / availability scope
- Career or display category
- Faction/provider
- Reputation path
- Risk/tier
- Lawful/unlawful/unknown
- Release state
- Reward type
- Blueprint/item reward
- Eligibility state once the solver exists

The selected hero should summarize identity and high-value operational facts without duplicating the dossier. It should not contain the full solver, variant matrix, reward inventory, or technical provenance tree.

The comparison list should use source-backed sortable columns appropriate to the selected mission category. Useful shared candidates include mission, faction, system, risk, legality, eligibility, payout status, reputation outcome, blueprint/item outcome, and variant count. Do not force unknown values into sortable numeric zero.

Keep technical provenance available through progressive disclosure. The default experience should be player-facing, but unresolved and inferred data must remain inspectable.

Search precedence, filter persistence, non-filter-match behavior, and bookmark-only behavior require an explicit product decision before implementation. Do not assume Recipe Browser search semantics automatically apply to missions.

## Recommended implementation stages

### Stage 0 - Baseline and truth samples

- Refresh Scintel mission extraction from the current channel.
- Diff source and shaped counts.
- Select deterministic golden missions covering:
  - Fixed payout
  - Resolved calculated payout
  - Typed unresolved calculated payout
  - Valid calculated zero payout
  - Multiple calculated result branches
  - Blueprint reward
  - Fixed item reward
  - Weighted item reward
  - Exact pickup
  - Generated locality pool
  - Unknown destination
  - Reputation/rank prerequisite
  - CrimeStat bounds
  - Unlock/completion-tag prerequisite
  - Lawful, unlawful, and unknown legality
  - Multiple variants that should and should not collapse
- Capture the existing browser behavior before replacing it.

### Stage 1 - Scintel extraction contract

- Audit typed prerequisites, completion tags, outcomes, objective structure, and calculated reward inputs.
- Extend the extractor only where the records provide evidence.
- Add source-level validation and unresolved reports.
- Preserve stable IDs and blueprint joins.
- Calculate base/solo payout once per accepted Scintel channel/build and persist complete source evidence.
- Preserve contract-owned hauling orders and mission-item selectors without inventing internal-handle joins.

### Stage 2 - Moonbreaker shaping and schema

- Introduce a versioned mission schema.
- Split the monolithic shaper into testable normalization, projection, graph, and report modules.
- Keep browser summaries compact and exact variant data sharded.
- Generate graph validation reports for dangling edges, cycles, and ambiguity.

### Stage 3 - Solver

- Implemented `PlayerMissionState`, goal inputs, eligibility results, and explanation contracts.
- Implemented deterministic eligibility before path optimization.
- Added count-aware state traversal only for proven completion-tag edges.
- Added focused unit and accepted-generation tests for statuses, groups, alternates, dangling edges, cycles, and the Rayari golden chain.
- Exposed solver results through `server/missions/missionSolverData.ts`; no JSX calculation or HTTP endpoint was added.

### Stage 4 - Browser and dossier redesign

- Establish the final filter taxonomy from measured facets.
- Implement selected hero, dense sortable comparison view, and dossier hierarchy.
- Keep browser, dossier, and solver as peer surfaces.
- Preserve bookmarks and Blueprint Tracker joins.
- Preserve URL-addressable state where useful.

### Stage 5 - Integration and validation

- Add route contract tests.
- Add shaper/golden-data tests.
- Add solver tests.
- Add browser interaction tests.
- Validate empty, loading, error, unresolved, and heavily populated states.
- Update the design canon and this handoff with the accepted behavior.

## Suggested agent workstreams

If the implementing agent delegates work, use bounded workstreams:

1. Scintel extraction and provenance audit
2. Mission schema, graph, and solver
3. Browser/dossier information architecture and responsive implementation
4. Route, fixture, automated, and visual validation

The primary agent must own the final data contract and integration decisions. Do not let separate agents invent incompatible definitions of family, concept, variant, eligibility, or completion.

## Required tests and validation

There is no dedicated mission suite yet. Add one rather than relying only on the global build.

At minimum:

```powershell
npm run lint
npm run build
npm run missions:shape
```

Add scripts for:

- Mission source/shaped contract verification
- Mission route tests
- Mission grouping and facet tests
- Mission eligibility and dependency-graph tests
- Mission browser UI tests

Visual review should cover:

- `768x900`
- `1920x1080`
- `2560x1440`
- `3840x2160`

Review long localized titles, many badges, large variant counts, unresolved values, table overflow, sticky regions, modal/dossier overflow, keyboard focus, empty filters, zero results, and solver explanations.

## Non-negotiable truth and safety rules

- Do not invent payouts, travel time, mission duration, objective order, locations, or unlock chains.
- Do not use title similarity alone to merge mission concepts or create dependency edges.
- Do not flatten exact variants when prerequisites, objectives, availability, or outcomes differ.
- Do not expose raw GUIDs in the primary player-facing view.
- Do not hide unresolved state merely to make the UI cleaner.
- Do not hand-edit generated JSON.
- Do not break Blueprint Tracker mission bookmarks or blueprint reward joins.
- Do not move solver calculations into React.
- Do not load all exact variant payloads in the browser index.
- Do not treat not-for-release or work-in-progress missions as normally available.
- Preserve valid numeric zero separately from missing or unresolved.

## Initial acceptance criteria

The overhaul is not complete until:

- Current extraction provenance and known gaps are documented.
- Typed prerequisite/outcome edges are source-backed and validated.
- Eligibility distinguishes blocked from unresolved.
- A solver can explain its result without hidden assumptions.
- Browser filters and sortable values are generated from canonical data.
- Concept, family, and exact variant meanings are consistent across extraction, API, solver, and UI.
- Blueprint reward/source joins still resolve.
- Bookmark compatibility is preserved or explicitly migrated.
- Targeted mission tests exist and pass.
- Lint and production build pass.
- Compact, 1080p, 2K, and 4K populated/empty visual passes are reviewed.
- The accepted mission behavior is added to `moonbreaker_design_canon.md`.

## First action for the implementing agent

Do not begin with JSX or CSS.

First refresh the Scintel mission snapshot, select the golden mission set, and produce a short extraction/solver feasibility report answering:

1. Which prerequisite and completion relationships are provable?
2. Which objective stages and destination roles are provable?
3. Which calculated credit fields are present?
4. Which solver goals are supportable without inference?
5. Which data-contract changes are required before redesigning the browser?

Only then lock the schema and begin the visual redesign.
