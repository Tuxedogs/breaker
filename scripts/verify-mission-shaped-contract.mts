import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { verifyMissionPublicationGate } from "./missions/publication/publication-gates.mts";

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
const sourceRoot = path.resolve(
  option("--source-root")
    ?? process.env.MISSION_SOURCE_ROOT
    ?? path.join("server-data", "missions", "source"),
);
const goldenPath = path.resolve(
  option("--golden")
    ?? path.join("docs", "mission-golden-set-2026-07-29.json"),
);
const auditPath = path.resolve(
  "docs",
  "mission-build-generation-audit-live-4.9.0-fdfd54f65b1f84a621899b21.json",
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

const [index, manifest, graphReport, solverReference, golden, audit, sourceCatalog] = await Promise.all([
  readJson(path.join(generationRoot, "mission_browser_index.json")),
  readJson(path.join(generationRoot, "mission_shard_manifest.json")),
  readJson(path.join(generationRoot, "mission_graph_validation_report.json")),
  readJson(path.join(generationRoot, "mission_solver_reference.json")),
  readJson(goldenPath),
  readJson(auditPath),
  readJson(path.join(sourceRoot, "mission_contracts.json")),
]);
const legacyExpected = object(golden.shapedContractV2, "golden.shapedContractV2");
const isOfferGeneration = pointer.missionSchemaVersion === 3;
const supportedOfferShaperVersions = [
  "moonbreaker_mission_shaper_v3_2_offer1",
  "moonbreaker_mission_shaper_v3_3_offer_reputation_facets",
  "moonbreaker_mission_shaper_v3_4_offer_reputation_runtime_titles",
  "moonbreaker_mission_shaper_v3_5_offer_reputation_runtime_titles",
  "moonbreaker_mission_shaper_v3_6_portable_source_provenance",
];
const expected = isOfferGeneration
  ? {
    ...legacyExpected,
    schemaVersion: 3,
    sourceContractVersion: 4,
    shaperVersion: pointer.shaperVersion,
  }
  : legacyExpected;
equal(pointer.missionSchemaVersion, expected.schemaVersion, "pointer mission schema");
equal(pointer.sourceContractVersion, expected.sourceContractVersion, "pointer source schema");
equal(pointer.shaperVersion, expected.shaperVersion, "pointer shaper version");
if (isOfferGeneration) {
  assert(
    supportedOfferShaperVersions.includes(String(pointer.shaperVersion)),
    `Unsupported offer shaper version ${String(pointer.shaperVersion)}.`,
  );
}
if (isOfferGeneration) equal(pointer.offerSchemaVersion, 1, "pointer offer schema");
for (const [label, envelope] of [["index", index], ["manifest", manifest], ["graph report", graphReport]] as const) {
  equal(envelope.schemaVersion, expected.schemaVersion, `${label} mission schema`);
  equal(envelope.sourceContractVersion, expected.sourceContractVersion, `${label} source schema`);
  equal(envelope.generationId, generationId, `${label} generation`);
  if (isOfferGeneration) equal(envelope.offerSchemaVersion, 1, `${label} offer schema`);
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
if (isOfferGeneration) {
  const source = object(sourceCatalog.source, "mission source catalog.source");
  const sourceBuildId = string(
    source.sourceBuildId ?? source.buildId,
    "mission source catalog.source.sourceBuildId",
  );
  const targetSourceV4 = object(audit.targetSourceV4, "audit.targetSourceV4");
  const auditedBuildId = string(targetSourceV4.buildId, "audit.targetSourceV4.buildId");
  const acceptedGenerationId = typeof targetSourceV4.acceptedGenerationId === "string"
    ? targetSourceV4.acceptedGenerationId
    : undefined;
  const sourceInputs = object(index.sourceInputs, "index.sourceInputs");
  const refIndex = object(sourceInputs.refIndex, "index.sourceInputs.refIndex");
  await verifyMissionPublicationGate({
    missionSchemaVersion: 3,
    sourceContractVersion: 4,
    offerSchemaVersion: 1,
  }, {
    schemaVersion: 1,
    sourceBuildId,
    acceptedGenerationId,
    refIndex: {
      status: refIndex.status === "explicit" ? "explicit" : "not_configured",
      path: typeof refIndex.path === "string" ? refIndex.path : undefined,
      operationalPath: process.env.MISSION_REF_INDEX
        ? path.resolve(process.env.MISSION_REF_INDEX)
        : undefined,
      sha256: typeof refIndex.sha256 === "string" ? refIndex.sha256 : undefined,
      buildId: typeof refIndex.buildId === "string" ? refIndex.buildId : undefined,
      recordCount: typeof refIndex.recordCount === "number" ? refIndex.recordCount : 0,
      auditedBuildId,
    },
    semantics: {
      variantCount: typeof summary.variantCount === "number" ? summary.variantCount : 0,
      reputationScopeResolvedCount: typeof summary.reputationScopeResolvedCount === "number"
        ? summary.reputationScopeResolvedCount
        : 0,
      unresolvedLocationCount: typeof summary.unresolvedLocationCount === "number"
        ? summary.unresolvedLocationCount
        : Number.POSITIVE_INFINITY,
    },
  });
}
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
if (isOfferGeneration) {
  const offersByKey = object(index.offersByKey, "index.offersByKey");
  const variantOfferKeys = object(index.variantOfferKeys, "index.variantOfferKeys");
  const legacyConceptOfferKeys = object(index.legacyConceptOfferKeys, "index.legacyConceptOfferKeys");
  const offerDetailFiles = object(index.offerDetailFiles, "index.offerDetailFiles");
  const offerVariantFiles = object(index.offerVariantFiles, "index.offerVariantFiles");
  equal(Object.keys(variantOfferKeys).length, summary.variantCount, "offer exact variant assignments");
  equal(Object.keys(offersByKey).length, summary.offerCount, "offer count");
  equal(Object.keys(offerDetailFiles).sort(), Object.keys(offersByKey).sort(), "offer detail map keys");
  equal(Object.keys(offerVariantFiles).sort(), Object.keys(offersByKey).sort(), "offer variant map keys");
  equal(
    await jsonNames(path.join(generationRoot, "offers")),
    Object.values(offerDetailFiles).map((value) => path.basename(string(value, "offer detail file"))).sort(),
    "reachable offer shards",
  );
  equal(
    await jsonNames(path.join(generationRoot, "offer-variants")),
    Object.values(offerVariantFiles).map((value) => path.basename(string(value, "offer variants file"))).sort(),
    "reachable offer-variant shards",
  );
  for (const [offerKey, offerValue] of Object.entries(offersByKey)) {
    const offer = object(offerValue, `offer ${offerKey}`);
    equal(offer.offerKey, offerKey, `${offerKey} key`);
    equal(offer.offerSchemaVersion, 1, `${offerKey} schema`);
    const variantKeys = array(offer.variantKeys, `${offerKey}.variantKeys`).map((value) => string(value, `${offerKey}.variantKey`));
    assert(variantKeys.length > 0, `${offerKey} has no exact variants.`);
    for (const variantKey of variantKeys) {
      equal(variantOfferKeys[variantKey], offerKey, `${variantKey} offer assignment`);
    }
    assert(typeof offer.searchText === "string", `${offerKey} is missing offer-local search text.`);
    assert(Array.isArray(offer.missionTypes), `${offerKey} is missing offer-local mission type facets.`);
    assert(Array.isArray(offer.rewardTypes), `${offerKey} is missing offer-local reward facets.`);
    assert(Array.isArray(offer.reputationRewardKeys), `${offerKey} is missing offer-local reputation reward facets.`);
    if (offer.reputationRewardFacets !== undefined) {
      const facets = array(offer.reputationRewardFacets, `${offerKey}.reputationRewardFacets`);
      const facetKeys = facets.map((facetValue, index) => {
        const facet = object(facetValue, `${offerKey}.reputationRewardFacets[${index}]`);
        const stableKey = string(facet.stableKey, `${offerKey}.reputationRewardFacets[${index}].stableKey`);
        string(facet.factionKey, `${offerKey}.${stableKey}.factionKey`);
        string(facet.factionDisplayName, `${offerKey}.${stableKey}.factionDisplayName`);
        string(facet.scopeKey, `${offerKey}.${stableKey}.scopeKey`);
        string(facet.scopeDisplayName, `${offerKey}.${stableKey}.scopeDisplayName`);
        assert(["resolved", "partial", "unresolved"].includes(String(facet.confidence)), `${offerKey}.${stableKey} has invalid confidence.`);
        assert(typeof facet.variantCount === "number" && facet.variantCount > 0, `${offerKey}.${stableKey} has invalid variantCount.`);
        assert(typeof facet.rewardPathCount === "number" && facet.rewardPathCount > 0, `${offerKey}.${stableKey} has invalid rewardPathCount.`);
        const amountSummary = object(facet.amountSummary, `${offerKey}.${stableKey}.amountSummary`);
        assert(["exact", "range", "partial", "unresolved"].includes(String(amountSummary.status)), `${offerKey}.${stableKey} has invalid amount status.`);
        return stableKey;
      });
      equal(facetKeys, offer.reputationRewardKeys, `${offerKey} reputation facet keys`);
    }
    assert(Array.isArray(offer.releaseFlags), `${offerKey} is missing offer-local release facets.`);
    assert(Array.isArray(offer.confidenceFlags), `${offerKey} is missing offer-local confidence facets.`);
  }
  for (const value of Object.values(legacyConceptOfferKeys)) {
    for (const offerKey of array(value, "legacy concept offer keys")) {
      assert(offersByKey[string(offerKey, "legacy offer key")], `Legacy concept references unknown offer ${String(offerKey)}.`);
    }
  }
  const [identityReport, goldenReport] = await Promise.all([
    readJson(path.join(generationRoot, "mission_offer_identity_report.json")),
    readJson(path.join(generationRoot, "mission_offer_golden_report.json")),
  ]);
  equal(identityReport.assignmentGate && object(identityReport.assignmentGate, "identity assignment gate").passed, true, "offer assignment gate");
  equal(goldenReport.status, "passed", "offer golden status");
  equal(goldenReport.goldenOfferCount, 10, "golden offer count");
  equal(goldenReport.goldenVariantCount, 25, "golden exact variant count");
  equal(goldenReport.runtimeGhostPlaceholderPreserved, true, "runtime Ghost placeholder gate");
  equal(goldenReport.exactTitleSearchUsesOfferPredicateOnly, true, "offer-only exact title search gate");
}
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
  `Verified mission shaped schema ${String(expected.schemaVersion)} generation ${generationId}: `
  + `${String(summary.familyCount)} families, ${String(summary.variantCount)} variants, `
  + `${String(graphSummary.cycleComponentCount)} graph cycle components.`,
);
