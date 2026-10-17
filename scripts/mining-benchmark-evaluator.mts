import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

type Json = Record<string, any>;
export type Evaluation = { status: "descriptive_observation" | "insufficient_evidence" | "invalid_input"; validationErrors: string[]; evidenceGaps: string[]; pairs: Json[]; summary: Json; scenarioStatus: Json[] };

const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const isObject = (value: unknown): value is Json => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isHttpsReference = (value: unknown) => {
  if (typeof value !== "string") return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
};
const sameKeysAndValues = (actual: unknown, expected: Json) => isObject(actual)
  && Object.keys(actual).length === Object.keys(expected).length
  && Object.entries(expected).every(([name, value]) => actual[name] === value);

export async function readJson(path: string) { return JSON.parse(await readFile(path, "utf8")); }

export async function validatePublicationInputs(frozen: Json, sourceRoot?: string) {
  const errors: string[] = [];
  if (!sourceRoot) return errors;
  for (const [relativePath, expected] of Object.entries(frozen.acceptedSource.publicationInputSha256 ?? {})) {
    try {
      const actual = sha256(await readFile(resolve(sourceRoot, relativePath)));
      if (actual !== expected) errors.push(`publication hash mismatch: ${relativePath}`);
    } catch { errors.push(`publication input missing: ${relativePath}`); }
  }
  return errors;
}

function compileSchema(schema: Json) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, formats: {
    "date-time": { type: "string", validate: (value: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value)) },
    uri: { type: "string", validate: (value: string) => { try { new URL(value); return true; } catch { return false; } } },
  } });
  return ajv.compile(schema);
}

function validateObservation(record: unknown, frozen: Json, frozenHash: string, validateSchema: ReturnType<typeof compileSchema>) {
  const errors: string[] = [];
  if (!validateSchema(record)) errors.push(...(validateSchema.errors ?? []).map(error => `schema ${error.instancePath || "/"} ${error.message ?? "is invalid"}`));
  if (!isObject(record)) return errors;
  const scenario = frozen.scenarios.find((candidate: Json) => candidate.id === record.scenarioId);
  if (!scenario) errors.push(`unknown scenario: ${record.scenarioId}`);
  const identity = record.sourceIdentity;
  if (!isObject(identity)) errors.push("missing sourceIdentity"); else {
    if (identity.breakerCommit !== frozen.comparisonImplementation.commit) errors.push("breaker commit does not match frozen comparison");
    if (identity.acceptedBuildId !== frozen.acceptedSource.acceptedBuildId) errors.push("accepted build does not match frozen source");
    if (identity.selectorSha256 !== frozen.acceptedSource.selectorSha256) errors.push("selector hash does not match frozen source");
    if (identity.frozenInputsSha256 !== frozenHash) errors.push("frozen input hash does not match");
    if (!sameKeysAndValues(identity.publicationInputSha256, frozen.acceptedSource.publicationInputSha256)) errors.push("publication input hashes do not exactly match frozen source");
    if (!isObject(identity.publicationEvidence) || !isHttpsReference(identity.publicationEvidence.reference)) errors.push("publication evidence requires an HTTPS reference");
  }
  const constraints = record.constraintSnapshot;
  if (!isObject(constraints)) errors.push("missing constraintSnapshot"); else if (scenario) {
    if (!scenario.allowedMiningMethods.includes(constraints.method)) errors.push("method is not allowed by scenario");
    for (const [field, maximum] of [["travelMinutes", scenario.budget.maxTravelMinutes], ["searchMinutes", scenario.budget.maxSearchMinutes], ["inspectedEncounters", scenario.budget.maxInspectedEncounters]] as const) {
      if (typeof constraints[field] === "number" && constraints[field] > maximum) errors.push(`${field} exceeds scenario budget`);
    }
  }
  const comparison = record.comparison;
  if (!isObject(comparison)) errors.push("missing comparison"); else if (scenario && !scenario.rankingModes.includes(comparison.rankingMode)) errors.push("ranking mode is not declared by scenario");
  const observation = record.observation;
  if (!isObject(observation)) errors.push("missing observation"); else {
    if (record.evidenceKind !== "synthetic_harness" && !isHttpsReference(observation.evidenceLink)) errors.push("independent evidence requires an HTTPS evidenceLink");
    if (record.evidenceKind !== "synthetic_harness" && !isObject(observation.evidenceProvenance)) errors.push("independent evidence requires evidence provenance");
    if (record.evidenceKind === "synthetic_harness" && observation.objectiveCompletion !== "not_applicable") errors.push("synthetic observation must be not_applicable");
  }
  return errors;
}

function scenarioCoverage(frozen: Json, groups: Map<string, Json[]>) {
  return frozen.scenarios.flatMap((scenario: Json) => scenario.rankingModes.map((rankingMode: string) => {
    const matching = [...groups.entries()].filter(([groupKey]) => {
      const [, scenarioId, mode] = groupKey.split("|");
      return scenarioId === scenario.id && mode === rankingMode;
    });
    const observed = matching.some(([, records]) => new Set(records.map(record => record.attemptKind)).size === 2);
    return { scenarioId: scenario.id, rankingMode, status: observed ? "observed_pair" : matching.length ? "incomplete" : "missing" };
  }));
}

export async function evaluateBenchmark({ frozenPath, observationsPath, sourceRoot }: { frozenPath: string; observationsPath: string; sourceRoot?: string }): Promise<Evaluation> {
  const frozenBytes = await readFile(frozenPath);
  const frozen = JSON.parse(frozenBytes.toString()) as Json;
  const frozenHash = sha256(frozenBytes);
  const validateSchema = compileSchema(await readJson(resolve(dirname(frozenPath), "independent-observation.schema.json")));
  const observations = await readJson(observationsPath);
  const validationErrors = await validatePublicationInputs(frozen, sourceRoot);
  if (!Array.isArray(observations)) validationErrors.push("observations document must be an array");
  for (const record of Array.isArray(observations) ? observations : []) validationErrors.push(...validateObservation(record, frozen, frozenHash, validateSchema).map(error => `${record?.observationId ?? "unknown"}: ${error}`));
  if (validationErrors.length) return { status: "invalid_input", validationErrors, evidenceGaps: [], pairs: [], summary: {}, scenarioStatus: [] };
  const groups = new Map<string, Json[]>();
  for (const record of observations) {
    const groupKey = `${record.pairId}|${record.scenarioId}|${record.comparison.rankingMode}`;
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), record]);
  }
  const evidenceGaps: string[] = [];
  const pairs: Json[] = [];
  for (const [groupKey, records] of groups) {
    const breaker = records.filter(record => record.attemptKind === "breaker"); const baseline = records.filter(record => record.attemptKind === "baseline");
    if (breaker.length !== 1 || baseline.length !== 1) { evidenceGaps.push(`${groupKey}: requires exactly one Breaker and one baseline observation`); continue; }
    const pair = { groupKey, breaker: breaker[0], baseline: baseline[0] };
    if (records.some(record => record.evidenceKind === "synthetic_harness")) { evidenceGaps.push(`${groupKey}: synthetic harness records cannot establish decision lift`); pairs.push(pair); continue; }
    for (const side of [breaker[0], baseline[0]]) {
      if (side.comparison.observedRequestEligible === "unknown" || side.comparison.observedFullCoverage === "unknown" || side.observation.quantityMeasurement === null || side.observation.objectiveCompletion === "unknown") evidenceGaps.push(`${groupKey}: outcome is incomplete for ${side.attemptKind}`);
      const { travelMinutes, searchMinutes } = side.constraintSnapshot;
      if (travelMinutes === null || searchMinutes === null) evidenceGaps.push(`${groupKey}: travel/search time is unknown for ${side.attemptKind}`);
      else if (travelMinutes + searchMinutes === 0) evidenceGaps.push(`${groupKey}: zero total travel/search time is not scoreable for ${side.attemptKind}`);
    }
    pairs.push(pair);
  }
  if (!pairs.length) evidenceGaps.push("no paired observations");
  const status = scenarioCoverage(frozen, groups);
  if (evidenceGaps.length) return { status: "insufficient_evidence", validationErrors: [], evidenceGaps, pairs, summary: {}, scenarioStatus: status };
  const completed = (side: Json) => side.observation.objectiveCompletion === "completed";
  const yields = (side: Json) => side.observation.quantityMeasurement / (side.constraintSnapshot.travelMinutes + side.constraintSnapshot.searchMinutes);
  const metrics = pairs.reduce((total, pair) => {
    for (const side of [pair.breaker, pair.baseline]) {
      const prefix = side.attemptKind;
      total[`${prefix}EligibilityCorrect`] += Number(side.comparison.declaredRequestEligible === side.comparison.observedRequestEligible);
      total[`${prefix}FalseCoverage`] += Number(side.comparison.declaredFullCoverage === true && side.comparison.observedFullCoverage === false);
      total[`${prefix}FalseCompletion`] += Number(side.comparison.declaredObjectiveCompletion === "completed" && side.observation.objectiveCompletion === "not_completed");
      total[`${prefix}Yield`] += yields(side); total[`${prefix}Completed`] += Number(completed(side));
    }
    return total;
  }, { breakerEligibilityCorrect: 0, baselineEligibilityCorrect: 0, breakerFalseCoverage: 0, baselineFalseCoverage: 0, breakerFalseCompletion: 0, baselineFalseCompletion: 0, breakerYield: 0, baselineYield: 0, breakerCompleted: 0, baselineCompleted: 0 } as Record<string, number>);
  const count = pairs.length;
  return { status: "descriptive_observation", validationErrors: [], evidenceGaps: [], pairs, summary: { pairedAttempts: count, eligibilityCorrect: { breaker: metrics.breakerEligibilityCorrect / count, baseline: metrics.baselineEligibilityCorrect / count }, falseCoverageClaims: { breaker: metrics.breakerFalseCoverage, baseline: metrics.baselineFalseCoverage }, falseCompletionClaims: { breaker: metrics.breakerFalseCompletion, baseline: metrics.baselineFalseCompletion }, meanTargetYieldPerMinute: { breaker: metrics.breakerYield / count, baseline: metrics.baselineYield / count }, objectiveCompletionRate: { breaker: metrics.breakerCompleted / count, baseline: metrics.baselineCompleted / count } }, scenarioStatus: status };
}

export function scorecard(result: Evaluation) {
  const rows = result.status === "descriptive_observation" ? [
    ["Eligibility correctness", "descriptive", JSON.stringify(result.summary.eligibilityCorrect)], ["False full-coverage claims", "descriptive", JSON.stringify(result.summary.falseCoverageClaims)], ["False completion claims", "descriptive", JSON.stringify(result.summary.falseCompletionClaims)], ["Target yield per minute", "descriptive", JSON.stringify(result.summary.meanTargetYieldPerMinute)], ["Objective completion", "descriptive", JSON.stringify(result.summary.objectiveCompletionRate)],
  ] : [["Eligibility correctness", "not supported", "independent paired outcomes required"], ["False full-coverage claims", "not supported", "independent paired outcomes required"], ["False completion claims", "not supported", "independent paired outcomes required"], ["Target yield per minute", "unknown", "independent quantity and time measurements required"], ["Objective completion", "unknown", "independent completed/not_completed observations required"]];
  const scenarioRows = result.scenarioStatus.map(row => `| ${row.scenarioId} | ${row.rankingMode} | ${row.status} |`).join("\n") || "| None | None | missing |";
  return `# Mining Decision-Quality Benchmark Scorecard\n\nStatus: **${result.status}**\n\n| Measure | State | Result / reason |\n| --- | --- | --- |\n${rows.map(row => `| ${row.join(" | ")} |`).join("\n")}\n\n## Frozen scenario coverage\n| Scenario | Mode | Capture status |\n| --- | --- | --- |\n${scenarioRows}\n\n## Validation errors\n${result.validationErrors.length ? result.validationErrors.map(error => `- ${error}`).join("\n") : "- None"}\n\n## Evidence gaps\n${result.evidenceGaps.length ? result.evidenceGaps.map(gap => `- ${gap}`).join("\n") : "- None"}\n\n${result.status === "descriptive_observation" ? "Descriptive paired observations only; this is not an established player-decision-lift conclusion. Repeat counts and evaluation criteria must be predeclared before any general conclusion." : "Inferred: none. Synthetic records validate only evaluator behavior and never player decision lift."}\n`;
}

async function main() {
  const args = process.argv.slice(2); const get = (name: string) => { const index = args.indexOf(name); return index === -1 ? undefined : args[index + 1]; };
  const observationsPath = get("--observations"); const outputPath = get("--scorecard");
  if (!observationsPath || !outputPath) throw new Error("Usage: --observations <records.json> --scorecard <scorecard.md> [--source-root <path>]");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const result = await evaluateBenchmark({ frozenPath: resolve(root, "docs/mining-benchmark/frozen-inputs.json"), observationsPath: resolve(observationsPath), sourceRoot: get("--source-root") });
  await writeFile(resolve(outputPath), scorecard(result)); console.log(JSON.stringify(result, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
