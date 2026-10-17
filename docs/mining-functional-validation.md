# Mining Functional Validation

**Scope:** post-design functional validation on `codex/mining-intelligence-migration` at `e04bc32e8`, with the zero-method presentation repair applied after the baseline. This report separates accepted UI behavior from current source/publication evidence; it does not redesign Mining.

## Verified route and transformation trace

| UI field or behavior | Breaker runtime route and owner | Upstream/source classification | Validation result |
| --- | --- | --- | --- |
| Location identity, system, canonical material membership | `GET /api/mining/location-materials` → `staticMiningIndex.ts` → `MiningPage.tsx` / `LocationDetail.tsx` | Accepted Scintel index, then Breaker’s intentional Pyro canonicalization/exclusion transform | Accepted raw data has 402 rows; Breaker intentionally derives 386 by canonicalizing Pyro aliases and excluding four transient rows. The only current semantic identity delta is five Yela Ring rows still served as the older `Stanton2c Belt` identity. |
| Method distributions | `GET /api/mining/location-distribution` → `getStaticMethodBiasForLocation` → `buildMiningLocationSurveyPresentation` | Generated spawn-edge/class projection; manifest marks it Scintel-inferred and mechanics-audit pending | Valid numeric zero is now retained. No numeric-zero row occurs in the local 53-row distribution payload, so the regression test is the direct proof. |
| Primary occurrence, spawn roll (internal), encounter tiers, composition, 800+/900+ | `location-material`, `material-encounter-rankings`, and `material-quality` indexes → `miningFormatters.ts` / `LocationDetail.tsx` | Mixed/generated Scintel projections; quality and scoring mechanics are explicitly `needs-mechanics-audit` | Payloads route successfully; values must not be treated as independently verified live mechanics. |
| Direct-spawn source-group membership and competition | `location-material.sources[]` → `buildMiningSelectedSpawnCompetitionPools` → `buildMiningLocationCompetitionPools` | Location-specific generated source records | Focused tests prove missing targets create no pool, same-pool targets coalesce, separate pools remain separate, and partial probability mass is not normalized. |
| Ranked recommendations and coverage | `POST /api/mining/recommendations` plus static membership indexes → `recommenderAdapter.ts` / `MiningPage.tsx` | Recommender source scores and static indexes, both Scintel-inferred/needs mechanics audit | Endpoint returns 200 locally. Publication provenance was previously missing but the raw-versus-derived count discrepancy is now reconciled. |

## Representative scenario results

| Scenario | Result | Confidence |
| --- | --- | --- |
| Aaronhalo: Aluminum, Beryl, Quantanium | Current local rows place all three in `SpaceShip_Mineables`; accepted source audit reports the same relative values (10.3, 18, 2). | Source-supported for these rows. |
| Magda: eight requested materials | Magda is one `Stanton|Stanton1c` location with 11 matching accepted source rows from `HPP_Stanton1c`: three Hand, three Vehicle, and five Ship materials. The requested absent targets create no competition pool. | Source-verified; the earlier claim that accepted data omitted Magda was incorrect. |
| No selected materials | Existing UI/spec contract returns default exploration ordering and dash coverage rather than a synthetic zero. | Fixture/UI verified. |
| Queue demand | `MiningPage.tsx` derives selection through `projectQueueMiningDemand`; only active queue selection is merged into recommendation demand. Completed-item semantics require a live authenticated queue dataset to verify. | Code-path verified; live scenario unresolved. |

## Confirmed defects and gaps

- **P1 — identity publication gap:** accepted Scintel maps five asteroid-belt source rows to `Yela Ring`; the served derived registry retains `Stanton2c Belt`. The values, materials, pools, and probabilities match. Correcting the served registry requires an approved complete publication, not a hand edit.
- **P2 — provenance gap fixed locally:** the prior manifest recorded only derived-output hashes. The publisher now verifies the immutable accepted Mining receipt before writing and records build ID, dataset root, receipt hash/times, and validated input hashes in the output manifest.
- **P1 — fixed:** valid method share `0` was removed by the shared survey presentation filter, making a known method look absent in ranked locations. The filter now retains finite zero and has regression coverage.
- **P2 — unresolved:** no current live/authenticated Build Queue evidence was available, so completed-entry exclusion and Queue ranking/coverage semantics remain unverified against real data.
- **P2 — unresolved:** quality, encounter, and ranking mechanics are served correctly but their generated-data manifest remains `needs-mechanics-audit`.
- **P3 — fixed:** the design specification now records the 1181–1320px two-column implementation and the <=760px auto-height exception; the historical plan remains unchanged.
- **P3 — documented:** selector baseline is 38 seeded canonical resources, while the static index currently exposes 33 raw names. They are distinct inputs, not a duplicate-removal problem.

## Validation executed

- Accepted selector: `D:\scintel\out\LIVE\current.json` selects `4.10.191.2241-12519617-blueprint-filter.3`, receipted at `2026-09-17T01:16:59.906238Z`; the receipt validates raw `location_material_index.json` SHA-256 `9598feb012049de79c520b48d76d03d93ce8fcc82937b216d36f6e639f18a992`.
- Isolated publication from that accepted dataset produced 386 derived material rows and 53 derived distribution rows, confirming the expected count reduction without changing `server-data/mining` or any deployment. The normal proxy and local API both serve the committed derived registry; they are not independent provenance evidence.
- `npm run mining:test`: 50 passing tests, including the accepted-receipt mismatch gate.
- Fixture screenshots remain visual-only evidence because fixture mode disables network access. No fixture result is used above as proof of current LIVE source data.

## Next safe action

Do not republish or deploy without approval. The next safe correction is a reviewed full publication from `out/LIVE/current.json.datasetRoot`, with `SCINTEL_ACCEPTED_BUILD_ID` set to the selector's active build, `SCINTEL_SOURCE_BUILD_ID` set to its raw source build, and an explicit matching `SCINTEL_REF_INDEX`; it will resolve the Yela Ring identity delta and write immutable provenance into the manifest. Review the complete generated-artifact diff before committing it. No recommendation formula or Scintel contract should be changed.

## Publication provenance audit (October 15, 2026)

### Identity and first divergence

The original P0 conclusion compared raw Scintel records with Breaker’s intentionally derived runtime registry. They are not the same record grain:

- Accepted Scintel: 402 raw source/material rows and 57 raw location-distribution records.
- Breaker publication: `transformPyroRows` and `transformPyroDistributionRows` canonicalize 13 Pyro aliases and deliberately exclude `Pyro Cool01`, `Pyro Cool02`, `Pyro Warm01`, and `Pyro Warm02`; this yields 386 rows and 53 derived locations.

The prior Breaker manifest was written by `18b9fe020` on September 2 and did not record its source build or receipt. Its exact historical source is therefore not provable from the manifest. The current accepted selector was receipted September 17. The served dataset is not evidence of an independent deployed source: local API, Vite proxy, and Vercel route the same `server-data/mining` registry shape.

### Accepted versus served reconciliation

After applying the publisher transform to the selected accepted dataset:

- Aaronhalo’s Aluminum, Beryl, and Quantanium records match in canonical identity, `SpaceShip_Mineables` membership, occurrence/source probabilities, and 800+/900+ quality values.
- Magda’s eleven records match exactly. They are eleven material/source records, not eleven locations: Aluminum, Aslarite, Iron, Quantanium, Titanium (Ship); Aphorite, Dolivine, Hadanite (Hand); Beradom, Feynmaline, Glacosite (Vehicle). All use `HPP_Stanton1c` / provider GUID `5cef402e-105d-4ed7-8989-16cc726619a7` and source location ID `6f22b292-38d6-4429-b504-99b39514a2f8`.
- The only discovered semantic delta is one physical asteroid-belt identity: accepted data maps five source rows to `Yela Ring`; served data retains `Stanton2c Belt`. This is a real publication lag, but it does not establish a material, source-group, or probability mismatch.

### Safeguard added

`scripts/publish-mining-data.mts` now refuses a source root unless its `mining_generation_receipt.json` names the supplied accepted build and validates the exact `material_sources_quality_enriched.json` and `location_material_index.json` hashes. Its schema-2 manifest records that receipt/build provenance. The focused regression test proves both acceptance and rejection of a tampered source artifact.

## Decision-quality fallback boundary (October 16, 2026)

Static fallback coverage now uses a recommendation entry's `requiredMaterials` as the request-eligible, quality-supported contract. Raw static membership remains available for exploration and source detail, but it cannot create coverage, a completion location, or a route-complete signal. A missing quality threshold and a disallowed mining method therefore remain missing coverage.

Static fallback ranking intentionally uses the published encounter index as its yield-domain input, whereas the server scorer uses source `overallScore` plus composition evidence. Matching order in a synthetic fixture only proves that each explicit ranking strategy selects the correct available evidence inside its own pipeline; it does not establish real-world server/fallback yield equivalence or invent a probability conversion between those upstream signals.
