# One-pair Quantanium ship-mining capture protocol

## Scope and result boundary

This protocol captures exactly one paired, real-world observation for the frozen `quantanium-ship-any-quality` scenario and `quantity` mode. It does not change the scenario, source identities, baseline, Mining product code, score, UI, or holdout file. Keep `heldout-observations.json` empty until both capture artifacts exist and can be independently referenced.

The resulting pair is descriptive only. It cannot establish player-decision lift, infer ship breakability, or support a general conclusion.

## Pre-capture record

1. Record the game version/build, UTC start time, ship and mining loadout, player/server region, and any material environmental conditions in the raw capture artifact.
2. Record the frozen input SHA-256, Breaker comparison commit, accepted build ID, selector SHA-256, all four publication-input hashes, and an HTTPS evidence reference proving the frozen publication snapshot. If the frozen published root is available, run the evaluator with `--source-root`; otherwise preserve the externally verifiable publication evidence in `sourceIdentity.publicationEvidence`.
3. Obtain the Breaker choice from the frozen comparison implementation at `c7199f896bf4334ec70273710af81d420e30e767`, using only: Quantanium, quantity mode, ship method, any quality. Capture the complete request and returned selected location before travelling. Record that returned location verbatim as `comparison.recommendedLocation` for the Breaker attempt.
4. Obtain the baseline choice by applying frozen `encounter_top1`: after the same ship and request-eligibility gates, choose the location with the highest published `materialEncounterScore` for Quantanium, breaking ties by canonical location key ascending. Capture the input snapshot, eligible candidates, scores, tie-break, and selected baseline location before travelling. Do not use a Breaker score or a gameplay result to choose it.
5. Set the attempt order before either trip. Use a recorded fair coin flip: heads = Breaker first, tails = baseline first. If randomization cannot be performed, record the fixed order and mark order effects as unresolved; do not compare it as randomized.

## Fixed-budget attempts

Run one attempt at each predeclared location, with the same ship/loadout and scenario limits: at most 20 travel minutes, 30 search minutes, and 12 inspected encounters. Begin travel timing at the same predeclared reference event for both attempts; begin search timing at arrival at the selected location. Stop an attempt when its budget is reached or when the fixed scenario objective is completed, whichever occurs first.

For each attempt, retain a continuous or timestamped evidence artifact sufficient to audit:

- selected location, method (`ship`), game version/build, and timestamps;
- travel minutes, search minutes, and every unsuccessful inspected encounter (including zero); 
- whether Quantanium was present, its observed quality when measurable, and measured Quantanium quantity;
- observed request eligibility, observed full coverage, and observed objective completion;
- breakability as `unknown` unless the capture itself supplies independent mechanics evidence; and
- artifact SHA-256, HTTPS artifact link, recorder, and evidence-recorded timestamp.

Use `null` for an unavailable time or measurement. Do not replace it with zero. A zero total travel-plus-search time is unscoreable and must remain an abstention. An unsuccessful search is still an observation and must be retained.

## Record and evaluate only after both captures

Create one `breaker` and one `baseline` record with the same new `pairId`, frozen scenario ID, and `quantity` ranking mode. Populate the schema-required `publicationInputSha256`, `publicationEvidence`, `evidenceLink`, and `evidenceProvenance` fields from the retained artifacts. Validate the pair with:

```powershell
node --import tsx scripts/mining-benchmark-evaluator.mts --observations <pair-records.json> --scorecard <pair-scorecard.md> --source-root <frozen-published-mining-root>
```

If the frozen source root is unavailable, do not omit provenance: preserve the exact frozen hashes plus externally verifiable publication evidence. A valid pair yields a `descriptive_observation` scorecard only. Any missing, unknown, invalid, over-budget, or zero-time field must produce `insufficient_evidence` or `invalid_input`; do not repair it from inference.
