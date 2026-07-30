# Mission Stage 3 Solver Contract

Completed: 2026-07-30

Accepted channel: `LIVE`

Accepted build: `4.9.0-live.12232306`

Source contract: `mission_contracts.json` schema version 3

Moonbreaker shaped contract: schema version 2

Solver reference schema: version 1

Current generation: `b42621a47bf58653e0ec17c3`

## Outcome

Moonbreaker now has a deterministic server-side mission eligibility and proven-dependency path service. Exact mission variants are solver nodes. The solver does not calculate gameplay values in React and does not infer dependencies from titles, families, templates, or mission concepts.

No Mission Browser JSX, CSS, routing, or existing browser endpoint changed in this stage.

## Upstream completion-tag correction

`ContractPrerequisite_CompletedContractTags` is an authored count-based group, not a list of independent Boolean edges. A single group can mean, for example, “at least one of these tags.”

Scintel source contract version 3 now preserves a versioned `completionTagConstraint` payload on each member edge:

- Stable group ID
- Required or excluded polarity
- Complete member-tag list
- Authored count field
- Raw and numeric threshold

Moonbreaker evaluates one logical check per group. It never flattens group members into an invented AND chain. Empty or malformed groups remain typed unresolved.

## Player state

`PlayerMissionState` distinguishes known, partial, and unknown state:

- Completed contract counts and history knowledge
- Completion-tag counts and history knowledge
- Reputation value by exact faction and scope
- Known or unknown CrimeStat, preserving numeric zero
- Known or unknown location, system, and locality membership

Omitted completion tags mean zero only when history knowledge is complete. Under partial history, an omitted tag remains unknown.

## Eligibility

Eligibility returns all checks and explanations, not only the first failure.

Aggregate statuses are:

- `eligible`
- `blocked`
- `unavailable`
- `unresolved`
- `excluded`

Rules:

- `notForRelease` is unavailable.
- `workInProgress` alone is informational because the source flags are independent.
- CrimeStat bounds are inclusive.
- Exact known spatial mismatch is unavailable; incomplete location knowledge is unresolved.
- Generated location-property prerequisites require an authoritative runtime binding.
- Completion-tag groups use authored counts and polarity.
- Reputation values are compared only through the source-backed standing thresholds published in `mission_solver_reference.json`.
- Missing thresholds, identifiers, player state, or unsupported edge types remain unresolved.
- Subcontract prerequisites never block parent offer eligibility.

## Path solver

The first cost model is explicitly:

`mission_count = one exact mission completion per step`

The solver performs a bounded, deterministic state search over proven completion-tag outcomes and parent-required completion-tag groups.

It supports:

- A completion-tag count goal
- An exact-variant eligibility goal
- Already-satisfied zero-step results
- Count-based AND groups and alternate member tags
- Alternate exact producer missions
- Shared prerequisite state
- Excluded-tag ordering constraints
- Dangling producer evidence
- Cycle reporting
- A configurable state limit
- A configurable number of equal-minimum alternate plans

The target mission is not counted for an exact-variant eligibility goal. A producer mission is counted for a completion-tag goal.

Every plan step preserves the exact variant, eligibility evidence, prerequisite and outcome edge IDs, granted tag counts, and the explicit assumption that the authored mission-result branch carrying the completion-tag outcome occurs. Mission repeatability is not assumed.

## Server boundary

The service lives under `server/missions`:

- `missionSolverTypes.ts`
- `missionEligibility.ts`
- `missionPathSolver.ts`
- `missionSolverData.ts`

The data service resolves `server-data/missions/current.json` once per request, validates graph, report, manifest, solver-reference, and variant generation identity, and loads only the exact variant closure needed for the requested goal.

Stage 3 intentionally does not add an HTTP endpoint or UI. A future endpoint should use a structured request body and call this service rather than duplicate solver logic.

## Remaining evidence limits

- Generated location-property gates remain unresolved without an authoritative runtime binding.
- Travel, time, risk, legality, reputation grind, expected random rewards, party splitting, and credits-per-hour are not path costs.
- Fixed non-tag blockers are evaluated against the supplied player state; the solver does not invent state-changing actions for them.
- Completion-tag goals not referenced by the published dependency graph currently have no indexed producer lookup and remain unresolved unless a future source artifact adds a complete outcome-tag producer index.
- Planned completion-tag outcomes preserve their authored result-branch assumption; the solver does not claim runtime branch certainty.

## Validation

- Scintel extractor unit tests: 11 passed
- Moonbreaker mission tests: 29 passed
- Source contract verification passed
- Shaped contract verification passed
- Blueprint source API verification passed
- Lint passed
- Production build passed

No screenshot validation was required because Stage 3 made no visual changes.
