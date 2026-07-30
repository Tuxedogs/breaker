# Mission Stage 2 Shaping Contract

Completed: 2026-07-30

Accepted channel: `LIVE`

Accepted build: `4.9.0-live.12232306`

Source contract: `mission_contracts.json` schema version 3

Moonbreaker shaped contract: schema version 2

Current generation after the Stage 3 additive source correction: `b42621a47bf58653e0ec17c3`

## Outcome

Moonbreaker now consumes the accepted Scintel source contract version 3 and publishes a versioned canonical mission contract without calculating gameplay values in React or on the server.

The runtime browser, family, family-variant, and exact-variant endpoint paths remain compatible. Existing presentation fields remain available while exact variant shards now carry the source-backed solver truth required by Stage 3.

No Mission Browser JSX or CSS changed in this stage.

## Version and publication model

Mission shaping writes a complete immutable generation under:

`server-data/missions/generations/<generationId>`

`server-data/missions/current.json` selects the accepted generation. The runtime resolves this pointer and rejects a schema-version-2 browser index and shard manifest when their generation IDs or source contract versions differ.

The generation ID is deterministic over:

- Moonbreaker shaper version
- Shaped schema version
- Source schema version
- Channel and build
- Source latest-modified timestamp
- Scintel calculation-input digest
- Full Scintel source-catalog SHA-256
- Explicit reference-index status and SHA-256

Shaping occurs in a temporary sibling tree. Size and reachability checks run before publication. The accepted tree is moved into the immutable generation directory, the pointer is switched, and the prior root-level version-1 shards are removed.

This removes the previously documented unreachable files:

- 164 exact-variant shards
- 6 family-detail shards
- 6 family-variant shards

## Canonical exact variant

Every exact variant remains keyed by source `contractId`; `familyKey` remains `familyId ?? contractId`.

The exact variant shard preserves:

- Parent prerequisite edges
- Subcontract-owned prerequisite edges
- Outcome edges
- Objective-template identity and resolution
- Independent not-for-release and work-in-progress flags
- Legality evidence without upgrading unresolved precedence into source truth
- Fixed and calculated reputation as separate collections
- Fixed currency outcomes, including non-aUEC currency
- Full calculated-credit result contexts
- Top-level calculated base/solo payout summary
- Contract buy-ins as a separate collection
- Required-item and mission-item-selector evidence
- Contract-owned property overrides
- Channel, build, calculation-input digest, and source timestamps

Calculated payouts are projected from Scintel evidence:

- Resolved values retain numeric amount and currency.
- A valid zero remains a resolved numeric zero.
- The single unresolved calculation remains typed unresolved.
- Four multi-result variants remain unsummed and require result-loop verification.
- Party splitting remains runtime-dependent and is not applied.

## Compact browser projection

The browser index remains summary-only and contains no exact variant bodies.

Family-variant bundles retain the existing browser/dossier presentation fields but omit the full canonical and required-item evidence bodies. They include compact required-item status and order/selector counts. Full evidence is loaded only from the exact variant shard.

The accepted generation contains:

- 259 families
- 2,501 exact variants
- 611 browser concepts
- 259 family-detail shards
- 259 family-variant shards
- 2,501 exact-variant shards

## Graph validation

The shaped generation emits:

- `mission_graph.json`
- `mission_graph_validation_report.json`

The parent dependency graph uses only source completion-tag outcomes and parent required completion-tag prerequisites. Subcontract edges remain branch-owned. Excluded tags remain eligibility constraints and do not become unlock paths.

Accepted graph results:

- 80 parent-required tags
- 6 dangling parent-required tags
- 35 parent-excluded tags
- 0 dangling parent-excluded tags
- 87 tags with alternate producers
- 55 branch-required tags
- 1 dangling branch-required tag
- 4 dependency cycle components

Diagnostics retain variant IDs, edge IDs, tags, producer alternatives, and cycle arcs. The shaper does not infer missing edges or break cycles.

## Required-item evidence

The exact variant contract preserves:

- 718 variants with evidence
- 1,555 evidence rows
- 580 explicit hauling-order rows
- 975 mission-item-selector rows

Explicit hauling orders remain distinct from selectors that are not proven to be turn-in requirements. Missing source references and unresolved internal handles remain unresolved.

## Blueprint Tracker compatibility

Mission blueprint-source shaping ran from the same accepted source publication.

The rebuilt contract contains:

- 676 blueprint sources
- 763 normalized mission reward records
- 763 release-state records

The verifier now derives expected counts from the accepted source artifacts instead of stale hard-coded counts. Contract IDs, pool GUIDs, blueprint GUIDs, and release-state joins remain unchanged in format.

## Tests and validation

- Source contract version 3 verification: passed
- Shaped contract version 2 verification: passed
- Eleven focused mission schema, reward, graph, projection, publication, and route tests: passed
- Blueprint-source route and join verification: passed
- Mission shaping against the full accepted LIVE source: passed
- Immutable generation reachability and stale-shard checks: passed
- Lint: passed
- Production build: passed

No screenshot pass was required because Stage 2 changed data contracts and delivery only; the Mission Browser presentation was intentionally preserved.

## Intentionally deferred to Stage 3 and later

- `PlayerMissionState`
- Eligibility evaluation
- Dependency-path traversal and explanations
- Graph-specific runtime endpoints
- Mission-count path optimization
- Browser/dossier redesign
- Concept bookmark migration or aliasing
- Removal or repair of the unverified static client fallback
- Generation-aware live SPA cache invalidation

The next implementation stage is the deterministic solver. It must consume exact canonical variants and must not derive eligibility or paths from browser concepts.
