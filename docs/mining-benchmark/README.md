# Mining Decision-Quality Benchmark

## Status and boundary

This is the read-only evaluation workstream for [Issue #41](https://github.com/Tuxedogs/breaker/issues/41). It is intentionally separate from production Mining scoring, UI, API, publication, and Scintel data. The frozen comparison implementation is Moonbreaker commit `c7199f896bf4334ec70273710af81d420e30e767` on 2026-10-17; it is PR #40's unmerged review-only head, not an integration claim.

`frozen-inputs.json` predeclares five scenarios, request constraints, budgets, stop conditions, and simple baseline rules before any held-out observation is opened. `independent-observation.schema.json` defines one append-only observation record. Empty fields, failed searches, and unavailable measurements are evidence states; they must not be converted to zero, a probability, or a success.

## Frozen source identities

The selector was read on 2026-10-17, not changed:

- Scintel channel: `LIVE`
- accepted build: `4.10.191.2241-12519617-blueprint-filter.3`
- source build: `4.10.191.2241-12519617`
- selector: `D:\scintel\out\LIVE\current.json`
- selector SHA-256: `f8b83d649d888996faf9ddbb4e3ed7dbc6d54d7c631e37a0edb74df254aeee6a`
- Moonbreaker publication manifest SHA-256: `5f5fde52f06dc42ce4753d15e55eda0ebb52c0663b658f238591f4b671a49c44`

The manifest pins the copied recommender and index inputs. Benchmark runs must verify these identities before scoring; a selector or hash mismatch creates a new benchmark generation instead of silently updating this one.

## Baseline and comparison protocol

For each scenario, run Breaker and its declared baseline using the same allowed mining method, requested materials, quality threshold, travel/search budget, and stop condition. The baseline is deliberately simple: it uses only the published encounter-oriented static index after request eligibility gates, with its declared deterministic tie-break. It is a comparator, not independent validation.

Breaker source-backed fields may construct a recommendation but may not establish its outcome. Independent observations must come from source-resolved runtime captures, gameplay logs, controlled encounters, or separately adjudicated mechanics. A Scintel projection, an implementation fixture, or a screenshot used by the scorer is not an independent observation.

Measure eligibility correctness, request-eligible coverage, false full-coverage claims, top-1 regret against the declared baseline, target yield per fixed time/opportunity, completion rate, and correct unknown/abstention. Do not compute numerical lift when a comparator, quality measurement, independent outcome, or adequate sample is absent. In that case the only valid result is `insufficient_evidence`.

Ship-method eligibility is not breakability proof. In particular, the Prospector scenario must preserve unsupported breakability as `unknown`.

## Observation handling

Store held-out records outside `server-data`, `src`, and Scintel implementation inputs. Validate each record against `independent-observation.schema.json`; synthetic records are permitted only with `evidenceKind: "synthetic_harness"` and can validate the harness, never decision lift. Every observation records its evidence link or absence, including no-target searches and adverse conditions, to control survivor bias.

## Repeatable evaluator

Run `node --import tsx scripts/mining-benchmark-evaluator.mts --observations <records.json> --scorecard <scorecard.md>`. The evaluator checks frozen-input integrity, exact Breaker/source identities, scenario budgets, allowed methods and modes, independent evidence links, pairing, and the comparison fields needed to measure eligibility correctness, false coverage, target yield, and objective completion. Pass `--source-root <published-mining-root>` only when validating the four frozen publication-input hashes; the input must be the frozen published snapshot, not a live replacement.

Records are paired by `pairId`, with exactly one `breaker` and one `baseline` observation for the same scenario and ranking mode. The `comparison` block explicitly preserves what was recommended versus what independent evidence observed; neither is inferred from a static index. A missing pair, unknown outcome, absent measurement/link, synthetic-only pair, or failed validation produces `insufficient_evidence`. Synthetic fixtures can demonstrate evaluator mechanics but are permanently excluded from player decision-lift aggregates.

No empirical observations are frozen in this repository yet. Therefore this benchmark currently makes no player decision-lift claim.

Before the first capture, follow [the one-pair Quantanium ship-mining protocol](quantanium-one-pair-capture-protocol.md). The evaluator now applies the JSON Schema strictly, requires frozen publication hashes plus provenance evidence for independent records, fails closed on invalid or extra fields, and abstains when travel/search time is unknown or totals zero. The scorecard lists every frozen scenario/mode, including missing captures; a complete single pair is descriptive only, never an established player-decision-lift result.
