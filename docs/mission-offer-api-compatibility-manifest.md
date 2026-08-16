# MissionOffer API Compatibility Manifest

Status: implemented, published, and verified  
Baseline channel: `LIVE`  
Baseline build: `4.9.0-live.12232306`  
Baseline Moonbreaker mission generation: `fdfd54f65b1f84a621899b21`  
Baseline source contract: `3`  
Baseline shaped mission schema: `2`  
Target source contract: `4`  
Target shaped mission schema: `3`  
Target offer projection schema: `1`  
Published Moonbreaker mission generation: `09845999a73432800e773946`
Rollback Moonbreaker mission generation: `fdfd54f65b1f84a621899b21`

This manifest is the compatibility agreement for introducing player-facing mission offers without changing exact mission truth. It supplements `docs/api-data-flow-runbook.md` and `docs/generated-data-manifest.md`; those documents remain authoritative for publication, deployment, and route ownership. `public/api` remains retired.

## 0. Implementation receipt

The reader-first migration is complete for `LIVE` build `4.9.0-live.12232306`:

- Scintel source contract 4 is accepted and published with additive offer evidence.
- Moonbreaker shaped schema 3 / offer projection 1 is current at generation `09845999a73432800e773946`.
- The schema-2/source-3 generation remains present as the explicit rollback target.
- The published generation contains 259 Mission Series, 973 Mission Offers, and the same 2,501 Exact Variants. The lower offer count is an intentional identity correction: 77 formerly unresolved localized titles now resolve and group by their source-backed provider/title identity.
- The accepted reference index is mandatory and recorded in the generation receipt. The current generation resolves 1,735 reputation scopes and has zero unresolved locations; publication rejects missing reference evidence, zero resolved scopes, or severe location-resolution collapse.
- Reputation reward facets are structured offer-owned records with stable keys, faction and scope display labels, confidence, contributing path counts, and exact/range/partial amount summaries. UI filters never derive labels by splitting GUIDs.
- CIG localization keys with comma metadata such as `,P` resolve through the normalized source token. Runtime-selected titles remain bracketed placeholders, such as `[Black Box Recovery — Medium]`; unresolved NFR/WIP debug names are hidden from the default active catalog and remain available only through explicit inactive filters.
- The Headhunters golden report passes 10 offer identities, 25 exact variants, 10 exact-title search checks, the Ghost runtime-placeholder check, and all protected invariant gates.
- Full validation passes: 60/60 mission tests, 4/4 offer-first Playwright tests, all six blueprint-source routes, source and shaped verifiers, lint, API boundary checks, and production build.
- `npm run ui:missions` targets the current schema-3 offer-first suite. Use `npm run ui:missions:legacy` only when deliberately validating the schema-2/source-3 rollback fixture.

The immutable generation receipt and contradiction ledger are recorded in `docs/mission-build-generation-audit-live-4.9.0-fdfd54f65b1f84a621899b21.json`.

## 1. Purpose and boundaries

Moonbreaker's current browse concept is a structural grouping. It is not a safe player-facing mission identity because one concept can contain several localized titles, payouts, prerequisites, locations, and blueprint pools. `MissionOffer` adds a searchable player-facing identity above exact variants while retaining concepts as related structural mission series.

The required hierarchy is:

`MissionSeries/legacy concept -> MissionOffer -> ExactVariant -> SubcontractBranch`

This change may alter browse identity, search results, URLs, and presentation. It must not alter:

- exact variant IDs or family IDs;
- calculated or fixed aUEC values;
- payout solver inputs, model versions, warnings, or source references;
- blueprint pool GUIDs, pool membership, chances, or crafting links;
- reputation, standing, rank, completion-tag, CrimeStat, location, or exclusion prerequisites;
- solver graph edges, eligibility results, prerequisite paths, or cost model;
- release-state meaning;
- required-item evidence;
- source provenance or build identity.

No offer-level field is authoritative for an exact payout, reward, prerequisite, or eligibility result. Offer summaries are projections over member variants and must retain enough provenance to return to the owning `variantId`.

## 2. Baseline contract

The pinned generation contains:

- 2,501 exact variants;
- 259 families;
- 611 structural concepts;
- 676 blueprint source records;
- 8,313 blueprint-to-mission links;
- 763 reward-bearing mission records;
- 8,309 blueprint reward items.

The following existing routes are stable compatibility surfaces:

| Route | Ownership | Compatibility requirement |
|---|---|---|
| `GET /api/missions/browser` | browse index | Remains available; schema 2 and schema 3 readers coexist during migration. |
| `GET /api/missions/family/:familyId` | family detail | Response remains available for existing clients. |
| `GET /api/missions/family/:familyId/variants` | compact exact variants | Response remains available for existing clients. |
| `GET /api/missions/variant/:variantId` | exact variant | Exact canonical body remains authoritative. |
| `POST /api/missions/variant/:variantId/eligibility` | exact eligibility | Input and result semantics remain unchanged. |
| `POST /api/missions/variant/:variantId/prerequisite-path` | exact solver | Input, cost model, and result semantics remain unchanged. |
| `GET /api/crafting/blueprint-sources?blueprintGuid=...` | crafting source links | Contract and pool references remain valid. |
| `GET /api/crafting/blueprint-rewards/missions/:contractId` | mission reward detail | Exact contract lookup remains valid. |

The baseline passes:

- `npm run missions:test` -- 31/31 tests;
- `npm run missions:source:verify` -- source contract v3, 2,501 variants;
- `npm run missions:shaped:verify` -- shaped schema 2, 259 families and 2,501 variants;
- `npm run crafting:blueprint-sources:verify` -- all six blueprint-source route checks.

These are baseline gates, not sufficient acceptance evidence: none currently proves player-facing offer identity or exact-title search isolation.

## 3. Versioned additive schema

### 3.1 Publication pointer

The new generation advances the mission bundle deliberately. The target `current.json` contract is:

```json
{
  "schemaVersion": 1,
  "missionSchemaVersion": 3,
  "sourceContractVersion": 4,
  "offerSchemaVersion": 1,
  "shaperVersion": "<versioned shaper>",
  "generationId": "<immutable generation id>",
  "generationPath": "generations/<same generation id>"
}
```

`schemaVersion` for the pointer itself remains `1`; the fields identifying the owned contracts advance. Readers must be deployed first and accept both the pinned schema-2/source-3 bundle and the new schema-3/source-4 bundle. The old generation remains a valid rollback target.

### 3.2 Source evidence required from Scintel

Source contract 4 must add source-backed offer-display evidence without changing existing exact-variant fields:

- provider organization GUID, display name, and resolution confidence, separate from reputation faction;
- raw title localization key;
- localized title text;
- normalized title template and placeholder tokens;
- title mode: `static`, `runtime_templated`, or `unresolved`;
- objective-template identity and source reference;
- verification mechanics evidence;
- raw legality evidence, retained separately;
- structured subcontract/availability branches with owning scope;
- source hashes and calculation-input digest.

Provider, title, objective, and verification evidence may be unresolved. Moonbreaker must not fill unresolved evidence with keyword inference.

### 3.3 MissionOffer projection

The offer projection schema is additive:

```ts
type MissionOfferV1 = {
  offerSchemaVersion: 1;
  offerKey: string;
  displayName: string;
  title: {
    localizationKey: string | null;
    localizedText: string;
    normalizedTemplate: string;
    placeholderTokens: string[];
    mode: "static" | "runtime_templated" | "unresolved";
    confidence: "resolved" | "partial" | "unresolved";
  };
  provider: {
    organizationId: string | null;
    displayName: string;
    confidence: "resolved" | "partial" | "unresolved";
  };
  verificationStatus: "verified" | "unverified" | "unknown";
  verificationEvidence: Record<string, unknown> | null;
  reputationRewardFacets: Array<{
    stableKey: string;
    factionKey: string;
    factionDisplayName: string;
    scopeKey: string;
    scopeDisplayName: string;
    confidence: "resolved" | "partial" | "unresolved";
    variantCount: number;
    rewardPathCount: number;
    amountSummary: {
      status: "exact" | "range" | "partial" | "unresolved";
      resolvedPathCount: number;
      unresolvedPathCount: number;
      minAmount?: number;
      maxAmount?: number;
    };
  }>;
  reputationRewardKeys: string[]; // compatibility index derived from facet stableKey
  variantKeys: string[];
  familyKeys: string[];
  relatedConceptKeys: string[];
  objectiveTemplateKeys: string[];
  searchText: string;
  auditFlags: string[];
};
```

`offerKey` is generated from versioned normalized evidence, not localized display text alone. Provider identity plus raw title localization identity is the primary boundary. Objective-template or verification conflicts are hard audit findings and may require separate offers. Runtime values such as a generated target name are not part of the stable key.

Every exact variant belongs to exactly one offer. An offer may relate to one or more legacy concepts or families. Concepts remain available only as structural series/compatibility metadata.

### 3.4 Additive index and shards

Schema 3 adds these browser-index maps:

- `offersByKey: Record<offerKey, MissionOfferV1>`;
- `offerDetailFiles: Record<offerKey, relativePath>`;
- `offerVariantFiles: Record<offerKey, relativePath>`;
- `variantOfferKeys: Record<variantId, offerKey>`;
- `legacyConceptOfferKeys: Record<conceptKey, offerKey[]>`;
- `offerSearchVersion: 1`.

Schema 3 adds immutable generation files:

- `offers/<hash>.json` -- offer detail envelope;
- `offer-variants/<hash>.json` -- compact member variants;
- `mission_offer_identity_report.json` -- full-catalog collision and unresolved audit;
- `mission_offer_golden_report.json` -- pinned example outcomes and tuple-integrity results.

Existing `families`, `family-variants`, and `variants` shards remain. Exact canonical and required-item bodies remain only in exact variant shards. Offer variant shards use the existing compact-variant discipline and must not duplicate canonical evidence.

The shard manifest advances to schema 3 and adds offer file maps while retaining all schema-2 family and variant maps. All maps and envelopes carry the same `generationId`.

## 4. Additive routes

Schema 3 adds:

| Route | Response |
|---|---|
| `GET /api/missions/offer/:offerKey` | One `MissionOfferV1` detail envelope. |
| `GET /api/missions/offer/:offerKey/variants` | Compact exact variants assigned to the offer. |

The new routes use the same generation root, path-containment checks, generation assertions, cache invalidation, 404 behavior, and `GET`/405 behavior as family and variant routes.

No offer-level eligibility or prerequisite-path route is allowed. Eligibility requires an exact `variantId`.

## 5. Search isolation

Schema-3 search is offer-grained:

1. Normalize the query once.
2. Match each offer's own `searchText`.
3. Apply provider, mission type, reward, reputation reward, release, confidence, and verification filters to that offer's member evidence.
4. Return only matching offer keys in browse views.
5. Never promote another offer because it shares a family or legacy concept with a match.

`searchText` may include the offer's localized title, raw localization key, safe aliases, provider, and member exact contract IDs. It may not include titles owned only by sibling offers.

Required golden behavior:

- `Primo Target` returns the Primo Target offer, not `Crash some ships` or `Deep space hit`;
- `Plug a traitor` returns the Plug a traitor offer;
- `Ground the Upstarts`, `Wasting Their Stockpile`, and `Stopping the Competition` do not return all family siblings;
- exact contract-ID search returns the one owning offer and preserves the exact variant selection;
- runtime text such as `Ghost [TargetName]` remains searchable by its authored template, not an invented concrete target.

Server filtering and client filtering must share equivalent offer-grained semantics. A contract-tested shared predicate is preferred over two independent implementations.

## 6. Legacy concept aliases, URLs, and bookmarks

Existing URLs include concept-key path slugs and the legacy `?concept=`/`?selected=` query parameters. Existing local bookmarks include raw concept keys and `concept:<conceptKey>`.

`legacyConceptOfferKeys` defines deterministic compatibility:

- one mapped offer: resolve and replace the URL with the canonical offer route;
- multiple mapped offers: open a legacy-series resolution surface listing all mapped offers; do not silently pick the most frequent title;
- no mapped offer: show an explicit unavailable/tombstone state; do not fall back to an unrelated family;
- old query parameters remain readable throughout the compatibility window.

New canonical UI routes use an offer slug containing `offerKey`. New browse bookmarks use `offer:<offerKey>`.

Legacy concept bookmarks remain readable. A one-to-one alias may be represented as the equivalent offer bookmark. A one-to-many bookmark remains a legacy series bookmark until the user explicitly chooses offers; it must not be silently fanned out.

Crafting mission-source bookmarks remain `mission:<contractId>:<poolGuid>`. They are exact reward identities and are not migrated to offer bookmarks.

## 7. Solver, eligibility, and reputation preservation

The schema-3 reader may advance envelope-version checks, but the exact canonical payload remains canonical mission variant v2 unless a separately approved solver contract requires otherwise.

For every baseline `variantId`, pre- and post-change snapshots must prove equality for:

- canonical identity;
- parent and subcontract prerequisite edges and owner scopes;
- standing and reputation thresholds;
- completion-tag requirements and exclusions;
- CrimeStat and location conditions;
- outcomes and reputation rewards;
- release and work-in-progress flags;
- graph dependency edges;
- eligibility status, explanations, blockers, exclusions, and unavailable findings for golden player states;
- prerequisite-path status, minimum mission count, primary plan, alternates, failures, and relevant cycles.

The offer dossier may summarize prerequisites only as `varies`, a set of exact requirements, or a member count. It must select an exact variant before calling eligibility or path APIs.

## 8. aUEC preservation

`projectBrowserCreditV2` and the source-calculated payout remain the only browser payout projection path. Offer construction may read but may not write these values.

For every baseline variant, snapshot and compare:

- credit status;
- fixed amount and currency;
- calculated `baseSoloAmount`, including valid zero;
- model version and formula status;
- result count and aggregation status;
- result-loop verification flag;
- unresolved reasons and validation warnings;
- source references and calculation-input digest;
- buy-in evidence.

An offer may display a common value, a range, or `varies`, derived from exact members. It must never sum variant payouts, combine calculated branches, or present a range endpoint without an owning `variantId`.

## 9. Blueprint pools and crafting-link compatibility

Blueprint rewards remain exact-variant tuples:

`variantId + contractId + poolGuid + missionChance + pool member + member chance`

Offer summaries may report the count of distinct pools. Exact pool names, contents, and chances are shown only with their owning variants.

The blueprint-source projection may add `offerKey` by joining its existing `contractId` through `variantOfferKeys`. It must retain `contractId`, `conceptKey` where currently delivered, and the contract-ID search fallback during migration.

Cross-domain validation must compare every baseline tuple and require:

- no lost or added contract/pool link without accepted source evidence;
- identical pool GUID, pool name, mission chance, member GUID, and member chance;
- identical disabled/work-in-progress state;
- every reward-bearing contract resolves to an exact variant and one offer;
- every crafting mission link opens the owning offer and selects or exposes the exact contract;
- `Ground The Upstarts` and `Stopping the Competition` do not acquire blueprint pools merely because the supplied display example mentioned them.

The blueprint-source index should record the mission generation ID used for its `offerKey` join. Publication fails if that generation differs from the selected mission generation.

## 10. Verified and unverified presentation

The primary presentation field is `verificationStatus`, not Moonbreaker's inferred `lawfulClassification`.

- Populate `verified` or `unverified` only from proven contract-manager mechanics evidence.
- Use `unknown` when the effective mechanics source is not resolved.
- Preserve raw legality evidence for technical inspection.
- Preserve CrimeStat prerequisites independently for eligibility.
- Do not infer verification from title, faction, debug name, generator name, or keywords.
- Do not encode `unverified == unlawful` as data truth.
- Do not confuse `notForRelease` or `workInProgress` with verification status.

Legacy lawful fields may remain temporarily for schema-2 response compatibility but are deprecated, excluded from offer identity, and removed from primary filters and labels in schema 3.

## 11. Publication and rollback phases

### Phase A -- freeze and evidence

- Capture baseline exact-variant, solver, blueprint, route, URL, bookmark, and search snapshots from the pinned build/generation.
- Approve source contract 4 and offer-key rules.
- Approve Headhunters golden tuples, including explicit findings where the supplied display example combines different variants.

### Phase B -- reader-first deployment

- Teach server, solver loader, clients, and verifiers to accept schema 2/source 3 and schema 3/source 4.
- Add offer types, routes, alias resolution, and disabled UI adoption behind a generation capability check.
- Keep `current.json` on `fdfd54f65b1f84a621899b21`.

### Phase C -- immutable generation publication

- Shape all existing and new artifacts into one staging directory.
- Validate index, shard manifest, graph, solver reference, offer maps, and blueprint join against one generation ID.
- Move the complete generation into `generations/<id>`.
- Atomically replace `current.json` only after every gate passes.

### Phase D -- offer UI adoption

- Enable offer-first browse/search and canonical offer URLs.
- Keep legacy family/variant routes and concept aliases.
- Monitor 404s, alias resolution, search fan-out, solver errors, and blueprint-link failures.

### Phase E -- compatibility retirement

- Retire schema-2-only UI logic only after a separately approved observation window.
- Do not delete legacy concept aliases or family/variant routes as part of the initial MissionOffer rollout.

Rollback is pointer-based: restore the prior valid `current.json` selection. Never edit an immutable generation in place.

## 12. Merge-veto invariants

Any one of these findings blocks merge or publication:

1. An active exact variant has zero or multiple offer assignments.
2. An offer contains conflicting provider/title identity without an approved audit decision.
3. A baseline exact payout, blueprint tuple, prerequisite, outcome, required item, release flag, or provenance field changes unexpectedly.
4. Any golden solver or eligibility result changes by `variantId`.
5. Exact-title search exposes a sibling offer solely through family/concept membership.
6. Exact contract-ID search cannot resolve the owning offer and exact variant.
7. A legacy concept URL silently selects one offer when the alias maps to multiple offers.
8. A legacy bookmark or crafting mission-source bookmark becomes unreadable.
9. Runtime placeholder values are invented or used in stable identity.
10. `verified` or `unverified` is inferred from keywords or conflated with release state.
11. Mission, solver, offer, blueprint, or pointer artifacts disagree on build or generation identity.
12. The browser index duplicates exact canonical or required-item evidence.
13. Any new route weakens path containment, method handling, or missing-record behavior.
14. Baseline mission and blueprint test suites do not pass.

## 13. Acceptance gates

The rollout is accepted only when all of the following pass against the same accepted source snapshot:

- source contract 4 schema and golden verifier;
- source hash/build identity verifier;
- shaped schema 3 and immutable-generation verifier;
- offer assignment/collision audit;
- exact-title and contract-ID search-isolation route tests;
- family, variant, offer, eligibility, and path route tests;
- baseline-versus-candidate exact payout snapshot comparison;
- baseline-versus-candidate solver/eligibility snapshot comparison;
- baseline-versus-candidate blueprint tuple comparison;
- legacy URL and bookmark migration UI tests;
- crafting mission-link UI tests;
- Headhunters example golden audit;
- `npm run missions:test`;
- `npm run missions:source:verify`;
- `npm run missions:shaped:verify`;
- `npm run crafting:blueprint-sources:verify`;
- `npm run lint` and `npm run build` for implementation changes.

## 14. Agent ownership and handoff

| Owner | Writes | Must not change | Handoff evidence |
|---|---|---|---|
| Scintel extraction guardian | source contract 4, provider/title/objective/verification evidence, source audit | Moonbreaker projections or UI | Accepted source path, hashes, build ID, schema report, unresolved report |
| Mission identity agent | versioned offer-key rules, offer projection, identity reports | exact reward/prerequisite/canonical bodies | Variant-to-offer map, collision decisions, golden report |
| Moonbreaker API guardian | schema readers, shards, routes, aliases, generation gates | solver semantics or UI presentation policy | API snapshots, route tests, generation-coherence report |
| aUEC/solver guardian | comparison fixtures and invariant tests | payout formulas, graph semantics, eligibility behavior unless separately authorized | Before/after payout and solver diffs with zero unexplained changes |
| Blueprint guardian | offer joins and cross-domain comparison gates | pool membership/chances or crafting bookmark identity | Full tuple diff, link tests, generation match |
| Moonbreaker UI agent | offer-first browse/search, exact-variant disclosure, URLs/bookmarks, verification labels | source inference, payout/solver calculations | Search examples, legacy migration tests, responsive UI evidence |
| Integration auditor | full gate execution and report | production code during final audit | One signed-off manifest of build, generation, commands, and results |

The shared handoff bundle must include:

- channel, build ID, mission generation ID, and all source hashes;
- contract and projection schema versions;
- offer-key normalization version;
- complete `variantId -> offerKey` map;
- complete `legacy conceptKey -> offerKey[]` map;
- golden exact-variant tuples;
- unresolved provider, title, runtime-placeholder, objective, and verification decisions;
- API/search/URL/bookmark baselines;
- payout, solver, and blueprint before/after comparisons;
- executed gate commands and results.

The API guardian approves source and offer contracts before shaping begins and approves invariants before UI adoption. Each agent works from the same handoff bundle; chat summaries are not the source of truth.
