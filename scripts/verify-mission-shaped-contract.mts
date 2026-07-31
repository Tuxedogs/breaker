import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as JsonObject;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) throw new Error(`${label} must be a string.`);
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equal(actual: unknown, expected: unknown, label: string): void {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`,
  );
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function readJson(filePath: string): Promise<JsonObject> {
  return object(JSON.parse(await readFile(filePath, "utf8")), filePath);
}

async function jsonNames(directory: string): Promise<string[]> {
  return (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
}

const dataRoot = path.resolve(
  option("--data-root")
    ?? process.env.MISSION_DATA_ROOT
    ?? path.join("server-data", "missions"),
);
const goldenPath = path.resolve(
  option("--golden")
    ?? path.join("docs", "mission-golden-set-2026-07-29.json"),
);
const pointer = await readJson(path.join(dataRoot, "current.json"));
const generationId = string(pointer.generationId, "current.generationId");
const generationPath = string(pointer.generationPath, "current.generationPath");
const generationRoot = path.resolve(dataRoot, generationPath);
const relativeGenerationRoot = path.relative(dataRoot, generationRoot);
assert(
  relativeGenerationRoot
    && !relativeGenerationRoot.startsWith("..")
    && !path.isAbsolute(relativeGenerationRoot)
    && path.basename(generationRoot) === generationId,
  "Current mission generation escapes the mission data root.",
);

const [index, manifest, graphReport, solverReference, golden] = await Promise.all([
  readJson(path.join(generationRoot, "mission_browser_index.json")),
  readJson(path.join(generationRoot, "mission_shard_manifest.json")),
  readJson(path.join(generationRoot, "mission_graph_validation_report.json")),
  readJson(path.join(generationRoot, "mission_solver_reference.json")),
  readJson(goldenPath),
]);
const expected = object(golden.shapedContractV2, "golden.shapedContractV2");
equal(pointer.missionSchemaVersion, expected.schemaVersion, "pointer mission schema");
equal(pointer.sourceContractVersion, expected.sourceContractVersion, "pointer source schema");
equal(pointer.shaperVersion, expected.shaperVersion, "pointer shaper version");
for (const [label, envelope] of [["index", index], ["manifest", manifest], ["graph report", graphReport]] as const) {
  equal(envelope.schemaVersion, expected.schemaVersion, `${label} mission schema`);
  equal(envelope.sourceContractVersion, expected.sourceContractVersion, `${label} source schema`);
  equal(envelope.generationId, generationId, `${label} generation`);
}
equal(solverReference.schemaVersion, 1, "solver reference schema");
equal(solverReference.missionSchemaVersion, expected.schemaVersion, "solver reference mission schema");
equal(solverReference.sourceContractVersion, expected.sourceContractVersion, "solver reference source schema");
equal(solverReference.generationId, generationId, "solver reference generation");
const standingThresholds = object(
  solverReference.standingThresholdsById,
  "solverReference.standingThresholdsById",
);
assert(Object.keys(standingThresholds).length > 0, "Solver standing thresholds are empty.");
assert(
  Object.values(standingThresholds).every(
    (value) => typeof value === "number" && Number.isFinite(value),
  ),
  "Solver standing thresholds contain a non-finite value.",
);

const summary = object(index.summary, "index.summary");
const snapshot = object(golden.snapshot, "golden.snapshot");
equal(summary.variantCount, snapshot.variantCount, "variant count");
equal(summary.familyCount, object(golden.sourceContractV3, "golden.sourceContractV3").familyCount, "family count");
assert(index.variants === undefined, "Browser index must not contain exact variant bodies.");

const familyDetailFiles = object(index.familyDetailFiles, "index.familyDetailFiles");
const familyVariantFiles = object(index.familyVariantFiles, "index.familyVariantFiles");
const variantDetailFiles = object(index.variantDetailFiles, "index.variantDetailFiles");
const expectedFamilyFiles = Object.values(familyDetailFiles).map((value) => path.basename(string(value, "family detail file"))).sort();
const expectedFamilyVariantFiles = Object.values(familyVariantFiles).map((value) => path.basename(string(value, "family variants file"))).sort();
const expectedVariantFiles = Object.values(variantDetailFiles).map((value) => path.basename(string(value, "variant detail file"))).sort();
equal(await jsonNames(path.join(generationRoot, "families")), expectedFamilyFiles, "reachable family shards");
equal(await jsonNames(path.join(generationRoot, "family-variants")), expectedFamilyVariantFiles, "reachable family-variant shards");
equal(await jsonNames(path.join(generationRoot, "variants")), expectedVariantFiles, "reachable variant shards");
for (const fileName of expectedFamilyVariantFiles) {
  const payload = await readJson(path.join(generationRoot, "family-variants", fileName));
  equal(payload.generationId, generationId, `${fileName} generation`);
  for (const variantValue of array(payload.variants, `${fileName}.variants`)) {
    const variant = object(variantValue, `${fileName}.variant`);
    assert(variant.canonical === undefined, `${fileName} duplicates exact canonical evidence.`);
    assert(variant.requiredItems === undefined, `${fileName} duplicates required-item evidence.`);
    assert(variant.requiredItemSummary, `${fileName} is missing compact required-item status.`);
  }
}
const allVariants = await Promise.all(expectedVariantFiles.map(async (fileName) => {
  const payload = await readJson(path.join(generationRoot, "variants", fileName));
  equal(payload.schemaVersion, expected.schemaVersion, `${fileName} mission schema`);
  equal(payload.generationId, generationId, `${fileName} generation`);
  return object(payload.variant, `${fileName}.variant`);
}));
const runtimeLocationTitle = allVariants.find(
  (variant) => variant.variantKey === "54ecfe84-3b4c-4099-ab62-0d19286cca78",
);
assert(runtimeLocationTitle, "Runtime-location title fixture is missing.");
equal(
  runtimeLocationTitle.displayName,
  "Shut Off Power at [Location]",
  "runtime location placeholder title",
);

const graph = object(expected.graph, "golden.shapedContractV2.graph");
const graphSummary = object(graphReport.summary, "graphReport.summary");
equal(graphSummary.requiredTagCount, graph.parentRequiredTags, "required completion tags");
equal(graphSummary.danglingRequiredTagCount, graph.parentRequiredDanglingTags, "dangling required completion tags");
equal(graphSummary.excludedTagCount, graph.parentExcludedTags, "excluded completion tags");
equal(graphSummary.danglingExcludedTagCount, graph.parentExcludedDanglingTags, "dangling excluded completion tags");
equal(graphSummary.alternateProducerTagCount, graph.alternateProducerTags, "alternate producer tags");
equal(graphSummary.branchRequiredTagCount, graph.branchRequiredTags, "branch required tags");
equal(graphSummary.danglingBranchTagCount, graph.branchRequiredDanglingTags, "dangling branch tags");
equal(graphSummary.cycleComponentCount, graph.cycleComponents, "cycle components");

const sourceExpected = object(golden.sourceContractV3, "golden.sourceContractV3");
const creditExpected = object(sourceExpected.creditResults, "golden.sourceContractV3.creditResults");
const requiredItemExpected = object(
  sourceExpected.requiredItemEvidence,
  "golden.sourceContractV3.requiredItemEvidence",
);
const canonicalOf = (variant: JsonObject) => object(variant.canonical, "variant.canonical");
const payoutOf = (variant: JsonObject) => {
  const payout = object(canonicalOf(variant).financials, "canonical.financials").calculatedPayout;
  return payout && typeof payout === "object" && !Array.isArray(payout) ? payout as JsonObject : null;
};
const calculatedVariants = allVariants.filter((variant) => payoutOf(variant));
equal(calculatedVariants.length, creditExpected.variantsWithCalculatedRows, "calculated payout variants");
equal(
  calculatedVariants.filter((variant) => payoutOf(variant)?.calculationStatus === "resolved").length,
  creditExpected.resolvedVariants,
  "resolved calculated payout variants",
);
equal(
  calculatedVariants.filter((variant) => payoutOf(variant)?.calculationStatus === "unresolved").length,
  creditExpected.unresolvedVariants,
  "unresolved calculated payout variants",
);
equal(
  calculatedVariants.filter((variant) => payoutOf(variant)?.baseSoloAmount === 0).length,
  creditExpected.resolvedZeroVariants,
  "valid zero calculated payout variants",
);
equal(
  calculatedVariants.filter((variant) => payoutOf(variant)?.resultLoopVerificationRequired === true).length,
  creditExpected.multiResultVariants,
  "multi-result calculated payout variants",
);
for (const variant of calculatedVariants.filter((item) => payoutOf(item)?.calculationStatus === "resolved")) {
  const financials = object(canonicalOf(variant).financials, "canonical.financials");
  const contexts = array(financials.creditResults, "canonical.financials.creditResults")
    .map((value) => object(value, "canonical credit result"))
    .flatMap((reward) => reward.calculatedContext ? [object(reward.calculatedContext, "calculatedContext")] : []);
  assert(contexts.length > 0, "Resolved payout is missing its source calculation context.");
  for (const context of contexts) {
    assert(context.difficulty, "Calculated payout context is missing difficulty evidence.");
    assert(context.curve, "Calculated payout context is missing curve evidence.");
    assert(context.rounding, "Calculated payout context is missing rounding evidence.");
    assert(context.timeToComplete, "Calculated payout context is missing authored time evidence.");
    assert(context.provenance, "Calculated payout context is missing build provenance.");
  }
}
const activeNonzeroBuyIns = calculatedVariants.filter((variant) => {
  const canonical = canonicalOf(variant);
  const availability = object(canonical.availability, "canonical.availability");
  if (availability.notForRelease === true || availability.workInProgress === true) return false;
  const financials = object(canonical.financials, "canonical.financials");
  return array(financials.buyIns, "canonical.financials.buyIns").some((value) => {
    const buyIn = object(object(value, "buy-in").contractBuyInAmount, "buy-in.contractBuyInAmount");
    return typeof buyIn.value === "number" && buyIn.value > 0;
  });
}).length;
equal(activeNonzeroBuyIns, creditExpected.activeNonzeroBuyIns, "active nonzero buy-ins");
equal(
  allVariants.filter((variant) =>
    array(object(canonicalOf(variant).reputationOutcomes, "canonical.reputationOutcomes").calculated, "calculated reputation").length > 0
  ).length,
  creditExpected.calculatedReputationVariants,
  "calculated reputation variants",
);

const requiredItemVariants = allVariants.filter((variant) =>
  array(object(variant.requiredItems, "variant.requiredItems").evidence, "requiredItems.evidence").length > 0
);
equal(
  requiredItemVariants.length,
  requiredItemExpected.canonicalVariants ?? requiredItemExpected.variants,
  "required-item variants",
);
equal(
  requiredItemVariants.reduce(
    (sum, variant) => sum + array(object(variant.requiredItems, "variant.requiredItems").evidence, "requiredItems.evidence").length,
    0,
  ),
  requiredItemExpected.canonicalEvidenceRows ?? requiredItemExpected.propertyRows,
  "required-item evidence rows",
);
equal(
  requiredItemVariants.reduce(
    (sum, variant) => sum + Number(object(variant.requiredItems, "variant.requiredItems").haulingOrderCount ?? 0),
    0,
  ),
  requiredItemExpected.canonicalHaulingOrders ?? requiredItemExpected.haulingOrders,
  "hauling-order evidence rows",
);
equal(
  requiredItemVariants.reduce(
    (sum, variant) => sum + Number(object(variant.requiredItems, "variant.requiredItems").selectorCount ?? 0),
    0,
  ),
  requiredItemExpected.missionItemSelectors,
  "mission-item selector evidence rows",
);

const manifestVariants = object(manifest.variantFilesByMissionId, "manifest.variantFilesByMissionId");
async function variantById(variantId: string): Promise<JsonObject> {
  const entry = object(manifestVariants[variantId], `manifest variant ${variantId}`);
  const detailFile = string(entry.detailFile, `${variantId}.detailFile`);
  const payload = await readJson(path.join(generationRoot, detailFile));
  equal(payload.generationId, generationId, `${variantId} generation`);
  return object(payload.variant, `${variantId}.variant`);
}

for (const assertionValue of array(golden.blueprintRewardAssertions ?? [], "golden.blueprintRewardAssertions")) {
  const assertion = object(assertionValue, "blueprint reward assertion");
  const id = string(assertion.variantId, "blueprint reward assertion.variantId");
  const variant = await variantById(id);
  const rewards = object(variant.rewards, `${id}.rewards`);
  const groups = array(rewards.blueprintRewardGroups, `${id}.blueprintRewardGroups`).map(
    (value, index) => object(value, `${id}.blueprintRewardGroups[${index}]`),
  );
  const rewardNames = groups.flatMap((group, groupIndex) =>
    array(group.rewards, `${id}.blueprintRewardGroups[${groupIndex}].rewards`).map(
      (value) => object(value, `${id}.blueprintReward`).displayName,
    )
  );
  for (const expectedName of array(assertion.expectedRewardNames, `${id}.expectedRewardNames`)) {
    assert(rewardNames.includes(expectedName), `${id} blueprint reward ${String(expectedName)} is missing.`);
  }
  assert(
    groups.some((group) => group.missionChanceLabel === assertion.expectedMissionChanceLabel),
    `${id} mission-level blueprint chance is missing.`,
  );
}

for (const assertionValue of array(golden.calculatedCreditAssertions, "golden.calculatedCreditAssertions")) {
  const assertion = object(assertionValue, "calculated credit assertion");
  const variantId = string(assertion.variantId, "calculated credit assertion.variantId");
  const variant = await variantById(variantId);
  const rewards = object(variant.rewards, `${variantId}.rewards`);
  const detail = object(rewards.creditsDetail, `${variantId}.creditsDetail`);
  const canonical = object(variant.canonical, `${variantId}.canonical`);
  const canonicalRewards = object(canonical.rewards, `${variantId}.canonical.rewards`);
  const payout = object(canonicalRewards.calculatedPayout, `${variantId}.canonical.calculatedPayout`);
  equal(payout.baseSoloAmount, assertion.amount, `${variantId} canonical payout`);
  equal(payout.resultCount, assertion.resultCount, `${variantId} result count`);
  equal(payout.resultLoopVerificationRequired, assertion.resultLoopVerificationRequired, `${variantId} result-loop flag`);
  if (assertion.amount === null) {
    equal(rewards.creditStatus, "formula_unresolved", `${variantId} unresolved payout status`);
    equal(payout.unresolvedReasons, assertion.unresolvedReasons, `${variantId} unresolved reasons`);
  } else if (assertion.resultLoopVerificationRequired === true) {
    equal(rewards.creditStatus, "variable", `${variantId} multi-result payout status`);
  } else {
    equal(rewards.creditStatus, "calculated", `${variantId} calculated payout status`);
    equal(detail.amount, assertion.amount, `${variantId} browser payout amount`);
    equal(detail.currency, assertion.currency, `${variantId} browser payout currency`);
  }
}

for (const assertionValue of array(golden.requiredItemAssertions, "golden.requiredItemAssertions")) {
  const assertion = object(assertionValue, "required-item assertion");
  const variantId = string(assertion.variantId, "required-item assertion.variantId");
  const variant = await variantById(variantId);
  const requiredItems = object(variant.requiredItems, `${variantId}.requiredItems`);
  equal(
    array(requiredItems.evidence, `${variantId}.requiredItems.evidence`).length,
    assertion.requiredItemEvidenceCount,
    `${variantId} required-item evidence count`,
  );
}

const merVariant = await variantById("1464ed09-2099-4102-8672-25f764e278d2");
const merDetail = object(object(merVariant.rewards, "MER rewards").creditsDetail, "MER credits detail");
equal(merDetail.amount, 3000, "MER amount");
equal(merDetail.currency, "MER", "MER currency");

console.log(
  `Verified mission shaped schema 2 generation ${generationId}: `
  + `${String(summary.familyCount)} families, ${String(summary.variantCount)} variants, `
  + `${String(graphSummary.cycleComponentCount)} graph cycle components.`,
);
