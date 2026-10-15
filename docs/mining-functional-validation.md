# Mining Functional Validation

**Scope:** post-design functional validation on `codex/mining-intelligence-migration` at `e04bc32e8`, with the zero-method presentation repair applied after the baseline. This report separates accepted UI behavior from current source/publication evidence; it does not redesign Mining.

## Verified route and transformation trace

| UI field or behavior | Breaker runtime route and owner | Upstream/source classification | Validation result |
| --- | --- | --- | --- |
| Location identity, system, canonical material membership | `GET /api/mining/location-materials` → `staticMiningIndex.ts` → `MiningPage.tsx` / `LocationDetail.tsx` | Generated Scintel mining index; location and material aliases are normalized at `materialIdentity.ts` | Local API returned 386 rows. The accepted-current Scintel dataset has a different 402-row/57-location publication, so local publication parity is not established. |
| Method distributions | `GET /api/mining/location-distribution` → `getStaticMethodBiasForLocation` → `buildMiningLocationSurveyPresentation` | Generated spawn-edge/class projection; manifest marks it Scintel-inferred and mechanics-audit pending | Valid numeric zero is now retained. No numeric-zero row occurs in the local 53-row distribution payload, so the regression test is the direct proof. |
| Primary occurrence, spawn roll (internal), encounter tiers, composition, 800+/900+ | `location-material`, `material-encounter-rankings`, and `material-quality` indexes → `miningFormatters.ts` / `LocationDetail.tsx` | Mixed/generated Scintel projections; quality and scoring mechanics are explicitly `needs-mechanics-audit` | Payloads route successfully; values must not be treated as independently verified live mechanics. |
| Direct-spawn source-group membership and competition | `location-material.sources[]` → `buildMiningSelectedSpawnCompetitionPools` → `buildMiningLocationCompetitionPools` | Location-specific generated source records | Focused tests prove missing targets create no pool, same-pool targets coalesce, separate pools remain separate, and partial probability mass is not normalized. |
| Ranked recommendations and coverage | `POST /api/mining/recommendations` plus static membership indexes → `recommenderAdapter.ts` / `MiningPage.tsx` | Recommender source scores and static indexes, both Scintel-inferred/needs mechanics audit | Endpoint returns 200 locally. Ranking validity against accepted current Scintel data is blocked by publication mismatch. |

## Representative scenario results

| Scenario | Result | Confidence |
| --- | --- | --- |
| Aaronhalo: Aluminum, Beryl, Quantanium | Current local rows place all three in `SpaceShip_Mineables`; accepted source audit reports the same relative values (10.3, 18, 2). | Source-supported for these rows. |
| Magda: eight requested materials | Local regression fixture/source-index test proves only delivered Hand, Vehicle, and Surface Ship pools render; Beryl, Carinite, Stileron, and Tin create no pool. Accepted current Scintel source has no Magda rows. | Local behavior verified; current-live data validity blocked. |
| No selected materials | Existing UI/spec contract returns default exploration ordering and dash coverage rather than a synthetic zero. | Fixture/UI verified; live parity blocked. |
| Queue demand | `MiningPage.tsx` derives selection through `projectQueueMiningDemand`; only active queue selection is merged into recommendation demand. Completed-item semantics require a live authenticated queue dataset to verify. | Code-path verified; live scenario unresolved. |

## Confirmed defects and gaps

- **P0 — publication parity:** accepted Scintel LIVE has 402 source rows, 33 canonical materials, and 57 locations; Breaker local `server-data/mining` has 386 rows and 53 locations. Magda exists only in the latter. Do not describe local API or fixture behavior as current LIVE until publication is reconciled.
- **P1 — fixed:** valid method share `0` was removed by the shared survey presentation filter, making a known method look absent in ranked locations. The filter now retains finite zero and has regression coverage.
- **P2 — unresolved:** no current live/authenticated Build Queue evidence was available, so completed-entry exclusion and Queue ranking/coverage semantics remain unverified against real data.
- **P2 — unresolved:** quality, encounter, and ranking mechanics are served correctly but their generated-data manifest remains `needs-mechanics-audit`.
- **P3 — fixed:** the design specification now records the 1181–1320px two-column implementation and the <=760px auto-height exception; the historical plan remains unchanged.
- **P3 — documented:** selector baseline is 38 seeded canonical resources, while the static index currently exposes 33 raw names. They are distinct inputs, not a duplicate-removal problem.

## Validation executed

- Local API mode at `http://127.0.0.1:5180`: all seven Mining GET routes returned 200; `POST /api/mining/recommendations` returned 200. Normal dev proxy requests to `http://127.0.0.1:5173` returned the same 386-row/53-location payload, including 11 Magda rows; the deployed API therefore shares the stale publication mismatch observed locally.
- `npm run mining:test`: 48 passing tests.
- Fixture screenshots remain visual-only evidence because fixture mode disables network access. No fixture result is used above as proof of current LIVE source data.

## Next safe action

Publish/reconcile Breaker `server-data/mining` from the accepted Scintel selector, then rerun the four scenarios against the updated local API and an authenticated Build Queue. No recommendation formula or Scintel contract should be changed before that evidence exists.
