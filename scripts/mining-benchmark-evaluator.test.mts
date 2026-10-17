import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { evaluateBenchmark, scorecard } from "./mining-benchmark-evaluator.mts";

const frozenPath = resolve("docs/mining-benchmark/frozen-inputs.json");
const frozen = JSON.parse(await readFile(frozenPath, "utf8"));
const frozenHash = createHash("sha256").update(await readFile(frozenPath)).digest("hex");
async function run(records: unknown[]) { const directory = await mkdtemp(resolve(tmpdir(), "breaker-benchmark-")); const observationsPath = resolve(directory, "observations.json"); await writeFile(observationsPath, JSON.stringify(records)); return evaluateBenchmark({ frozenPath, observationsPath }); }
function record(attemptKind: "breaker" | "baseline", overrides: Record<string, any> = {}) {
  return {
    observationId: `${attemptKind}-1`, pairId: "pair-1", scenarioId: "quantanium-ship-any-quality", attemptKind, evidenceKind: "runtime_capture", capturedAt: "2026-10-17T12:00:00.000Z",
    sourceIdentity: { breakerCommit: frozen.comparisonImplementation.commit, acceptedBuildId: frozen.acceptedSource.acceptedBuildId, selectorSha256: frozen.acceptedSource.selectorSha256, frozenInputsSha256: frozenHash, publicationInputSha256: frozen.acceptedSource.publicationInputSha256, publicationEvidence: { reference: "https://evidence.example/publication", recordedAt: "2026-10-17T12:00:00.000Z", recorder: "independent recorder" } },
    constraintSnapshot: { system: "Stanton", location: "Test Site", method: "ship", travelMinutes: 10, searchMinutes: 10, inspectedEncounters: 2 },
    comparison: { rankingMode: "quantity", recommendedLocation: "Test Site", declaredRequestEligible: true, observedRequestEligible: true, declaredFullCoverage: true, observedFullCoverage: true, declaredObjectiveCompletion: "completed" },
    observation: { targetPresent: true, qualityMeasurement: null, quantityMeasurement: 20, breakability: "proven", objectiveCompletion: "completed", evidenceLink: "https://evidence.example/1", evidenceProvenance: { recorder: "independent recorder", recordedAt: "2026-10-17T12:00:00.000Z", artifactSha256: "a".repeat(64) } },
    ...overrides,
  };
}

test("evaluates an independent paired comparison deterministically", async () => {
  const result = await run([record("breaker"), record("baseline", { observationId: "baseline-1", observation: { ...record("baseline").observation, quantityMeasurement: 10 } })]);
  assert.equal(result.status, "descriptive_observation"); assert.equal(result.summary.meanTargetYieldPerMinute.breaker, 1); assert.equal(result.summary.meanTargetYieldPerMinute.baseline, 0.5); assert.match(scorecard(result), /not an established player-decision-lift conclusion/);
});
test("returns insufficient_evidence when the baseline observation is absent", async () => {
  const result = await run([record("breaker")]); assert.equal(result.status, "insufficient_evidence"); assert.match(result.evidenceGaps[0], /exactly one Breaker/);
});
test("rejects invalid frozen provenance", async () => {
  const result = await run([record("breaker", { sourceIdentity: { ...record("breaker").sourceIdentity, selectorSha256: "0".repeat(64) } })]);
  assert.equal(result.status, "invalid_input"); assert.match(result.validationErrors[0], /selector hash/);
});
test("reports a false completion claim without claiming player lift", async () => {
  const breaker = record("breaker", { comparison: { ...record("breaker").comparison, declaredObjectiveCompletion: "completed" }, observation: { ...record("breaker").observation, objectiveCompletion: "not_completed" } });
  const baseline = record("baseline", { observationId: "baseline-1", comparison: { ...record("baseline").comparison, declaredObjectiveCompletion: "not_completed" }, observation: { ...record("baseline").observation, objectiveCompletion: "not_completed" } });
  const result = await run([breaker, baseline]); assert.equal(result.status, "descriptive_observation"); assert.equal(result.summary.falseCompletionClaims.breaker, 1); assert.match(scorecard(result), /False completion claims/);
});

test("rejects schema violations, including negative values, invalid timestamps, extra keys, and unsupported evidence", async () => {
  const invalid = record("breaker", { capturedAt: "not-a-timestamp", evidenceKind: "unsupported", constraintSnapshot: { ...record("breaker").constraintSnapshot, travelMinutes: -1 }, observation: { ...record("breaker").observation, quantityMeasurement: -1, extra: true } });
  const result = await run([invalid]); assert.equal(result.status, "invalid_input"); assert.match(result.validationErrors.join("\n"), /schema/);
});

test("abstains instead of dividing by zero travel and search time", async () => {
  const zeroTime = { ...record("breaker"), constraintSnapshot: { ...record("breaker").constraintSnapshot, travelMinutes: 0, searchMinutes: 0 } };
  const baseline = record("baseline", { observationId: "baseline-1", constraintSnapshot: { ...record("baseline").constraintSnapshot, travelMinutes: 0, searchMinutes: 0 } });
  const result = await run([zeroTime, baseline]); assert.equal(result.status, "insufficient_evidence"); assert.match(result.evidenceGaps.join("\n"), /zero total travel\/search time/);
});
