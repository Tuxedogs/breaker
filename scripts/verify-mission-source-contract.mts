import { readFile } from "node:fs/promises";
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

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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

function recordMap(rows: unknown[], key: string, label: string): Map<string, JsonObject> {
  const result = new Map<string, JsonObject>();
  for (const [index, value] of rows.entries()) {
    const row = object(value, `${label}[${index}]`);
    const id = text(row[key]);
    assert(id, `${label}[${index}].${key} is required.`);
    assert(!result.has(id), `${label} contains duplicate ${key} ${id}.`);
    result.set(id, row);
  }
  return result;
}

function edgeRows(record: JsonObject, key: string): JsonObject[] {
  return array(record[key] ?? [], key).map((value, index) => object(value, `${key}[${index}]`));
}

function subcontractEdgeRows(record: JsonObject, subcontractId: string): JsonObject[] {
  const groups = object(record.subContractPrerequisiteEdges ?? {}, "subContractPrerequisiteEdges");
  return array(groups[subcontractId] ?? [], `subContractPrerequisiteEdges.${subcontractId}`)
    .map((value, index) => object(value, `subContractPrerequisiteEdges.${subcontractId}[${index}]`));
}

function prerequisiteTag(edge: JsonObject): string | undefined {
  return text(object(edge.identifiers ?? {}, "edge.identifiers").completionTag);
}

function outcomeTag(edge: JsonObject): string | undefined {
  return text(object(edge.payload ?? {}, "edge.payload").tag);
}

function truthy(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function collectInternalHandleReferences(value: unknown, output: JsonObject[] = []): JsonObject[] {
  if (Array.isArray(value)) {
    for (const item of value) collectInternalHandleReferences(item, output);
    return output;
  }
  if (!value || typeof value !== "object") return output;
  const row = value as JsonObject;
  if (
    typeof row.raw === "string"
    && /^(ObjectiveToken|ObjectiveProperty_[^\[]+|MissionProperty)\[[0-9a-fA-F]+\]$/.test(row.raw)
  ) {
    output.push(row);
  }
  for (const child of Object.values(row)) collectInternalHandleReferences(child, output);
  return output;
}

const sourceRoot = path.resolve(
  option("--source-root")
    ?? process.env.MISSION_SOURCE_ROOT
    ?? path.join("server-data", "missions", "source"),
);
const goldenPath = path.resolve(
  option("--golden")
    ?? path.join("docs", "mission-golden-set-2026-07-29.json"),
);

const [catalog, objectives, report, golden] = await Promise.all([
  readJson(path.join(sourceRoot, "mission_contracts.json")),
  readJson(path.join(sourceRoot, "mission_objective_templates.json")),
  readJson(path.join(sourceRoot, "mission_extraction_report.json")),
  readJson(goldenPath),
]);

const expected = object(golden.sourceContractV3, "golden.sourceContractV3");
equal(catalog.schemaVersion, expected.schemaVersion, "mission contract schema version");
equal(
  objectives.schemaVersion,
  expected.objectiveTemplateSchemaVersion,
  "objective template schema version",
);
equal(report.missionContractSchemaVersion, expected.schemaVersion, "report contract schema version");
equal(catalog.sourceLatestModifiedAt, object(golden.snapshot, "golden.snapshot").sourceLatestModifiedAt, "source snapshot");
equal(objectives.sourceLatestModifiedAt, catalog.sourceLatestModifiedAt, "objective/catalog snapshot");
equal(report.sourceLatestModifiedAt, catalog.sourceLatestModifiedAt, "report/catalog snapshot");
const source = object(catalog.source, "catalog.source");
equal(source.channel, object(golden.snapshot, "golden.snapshot").channel, "source channel");
equal(source.buildId, object(golden.snapshot, "golden.snapshot").build, "source build");
assert(text(source.calculationInputsDigestSha256), "Calculation-input digest is missing.");
assert(
  array(source.calculationInputFiles, "catalog.source.calculationInputFiles").length > 0,
  "Calculation-input provenance files are missing.",
);

const records = recordMap(array(catalog.records, "catalog.records"), "contractId", "catalog.records");
const templates = recordMap(array(objectives.records, "objectives.records"), "templateGuid", "objectives.records");
equal(records.size, object(golden.snapshot, "golden.snapshot").variantCount, "variant count");
equal(report.missionFamilyCount, expected.familyCount, "family count");

for (const goldenValue of array(golden.variants, "golden.variants")) {
  const fixture = object(goldenValue, "golden variant");
  const id = text(fixture.id)!;
  const record = records.get(id);
  assert(record, `Golden variant ${id} is missing.`);
  equal(record.generatorPath, fixture.sourceRecord, `${id} source record`);
  equal(record.template, fixture.template, `${id} template`);

  const allEdges = [
    ...edgeRows(record, "prerequisiteEdges"),
    ...edgeRows(record, "outcomeEdges"),
    ...Object.values(object(record.subContractPrerequisiteEdges ?? {}, "subcontract edge groups"))
      .flatMap((value) => array(value, "subcontract edge group"))
      .map((value) => object(value, "subcontract edge")),
  ];
  const edgeIds = allEdges.map((edge) => text(edge.edgeId));
  assert(edgeIds.every(Boolean), `${id} has an edge without a stable ID.`);
  assert(new Set(edgeIds).size === edgeIds.length, `${id} has duplicate edge IDs.`);
  assert(
    allEdges.every((edge) => text(object(edge.provenance, "edge.provenance").sourceRef)),
    `${id} has an edge without source provenance.`,
  );
}

for (const value of array(golden.completionTagAssertions, "completionTagAssertions")) {
  const fixture = object(value, "completion tag assertion");
  const tag = text(fixture.tag)!;
  const producer = records.get(text(fixture.producer)!);
  assert(
    producer && edgeRows(producer, "outcomeEdges").some((edge) => edge.type === "completion_tag" && outcomeTag(edge) === tag),
    `Completion tag ${tag} producer edge is missing.`,
  );
  for (const id of array(fixture.excludedBy, "excludedBy")) {
    const record = records.get(String(id));
    assert(
      record && edgeRows(record, "prerequisiteEdges")
        .some((edge) => edge.type === "completion_tag" && edge.polarity === "excluded" && prerequisiteTag(edge) === tag),
      `${id} is missing excluded completion tag ${tag}.`,
    );
  }
  for (const id of array(fixture.requiredByIncludes, "requiredByIncludes")) {
    const record = records.get(String(id));
    assert(
      record && edgeRows(record, "prerequisiteEdges")
        .some((edge) => edge.type === "completion_tag" && edge.polarity === "required" && prerequisiteTag(edge) === tag),
      `${id} is missing required completion tag ${tag}.`,
    );
  }
}

for (const value of array(golden.subcontractScopeAssertions, "subcontractScopeAssertions")) {
  const fixture = object(value, "subcontract assertion");
  const id = text(fixture.variantId)!;
  const record = records.get(id);
  assert(record, `Subcontract golden variant ${id} is missing.`);
  assert(
    edgeRows(record, "prerequisiteEdges").some(
      (edge) => edge.type === "locality"
        && object(edge.identifiers, "edge.identifiers").localityAvailable === fixture.parentLocality,
    ),
    `${id} parent locality is missing.`,
  );
  for (const branchValue of array(fixture.subcontracts, "subcontracts")) {
    const branch = object(branchValue, "subcontract");
    const subcontractId = text(branch.id)!;
    const branchLocality = branch.locality;
    assert(
      subcontractEdgeRows(record, subcontractId).some(
        (edge) => edge.type === "locality"
          && object(edge.identifiers, "edge.identifiers").localityAvailable === branchLocality,
      ),
      `${id} subcontract ${subcontractId} locality is missing.`,
    );
    assert(
      !edgeRows(record, "prerequisiteEdges").some(
        (edge) => object(edge.identifiers, "edge.identifiers").localityAvailable === branchLocality,
      ),
      `${id} subcontract ${subcontractId} locality leaked into parent eligibility.`,
    );
  }
}

for (const value of array(golden.objectiveTemplateAssertions, "objectiveTemplateAssertions")) {
  const fixture = object(value, "objective template assertion");
  const templateId = text(fixture.template)!;
  const template = templates.get(templateId);
  assert(template, `Objective template ${templateId} is missing.`);
  equal(template.status, "resolved", `${templateId} resolution`);
  equal(template.path, fixture.path, `${templateId} path`);
  const tokens = array(template.objectiveTokens, `${templateId}.objectiveTokens`)
    .map((token, index) => object(token, `${templateId}.objectiveTokens[${index}]`));
  equal(tokens.length, fixture.objectiveCount, `${templateId} objective count`);
  equal(tokens.filter((token) => truthy(token.startsActive)).length, fixture.startsActiveCount, `${templateId} starts-active count`);
  equal(tokens.map((token) => token.id), fixture.objectiveIds, `${templateId} objective IDs`);
  equal(tokens.map((token) => token.debugName), fixture.debugNames, `${templateId} objective names`);

  if (fixture.roleHandles) {
    const serialized = JSON.stringify(template);
    for (const [role, handle] of Object.entries(object(fixture.roleHandles, "roleHandles"))) {
      assert(serialized.includes(String(handle)), `${templateId} is missing ${role} handle ${String(handle)}.`);
    }
  }
}

const internalHandles = collectInternalHandleReferences(objectives.records);
assert(internalHandles.length > 0, "No typed internal objective handles were emitted.");
assert(
  internalHandles.every((reference) => reference.resolution === "unresolved_internal_handle"),
  "An internal objective/property handle was resolved without a decoder.",
);

for (const value of array(golden.legalityAssertions, "legalityAssertions")) {
  const fixture = object(value, "legality assertion");
  const id = text(fixture.variantId)!;
  const record = records.get(id);
  assert(record, `Legality golden variant ${id} is missing.`);
  const legality = object(record.legalityEvidence, `${id}.legalityEvidence`);
  equal(legality.handlerOverride ?? null, fixture.handlerOverride, `${id} handler legality`);
  equal(legality.contractOverride ?? null, fixture.contractOverride, `${id} contract legality`);
  equal(legality.templateIllegal ?? null, fixture.templateValue, `${id} template legality`);
  equal(legality.comparison, fixture.comparison, `${id} legality comparison`);
  equal(object(legality.effective, `${id}.legalityEvidence.effective`).status, fixture.effectiveStatus, `${id} legality precedence`);
  assert(legality.provenance, `${id} legality evidence has no provenance.`);
}

for (const value of array(golden.requiredItemAssertions, "requiredItemAssertions")) {
  const fixture = object(value, "required-item assertion");
  const id = text(fixture.variantId)!;
  const record = records.get(id);
  assert(record, `Required-item golden variant ${id} is missing.`);
  const properties = object(record.propertyOverrides, `${id}.propertyOverrides`);
  equal(properties.extractionScope, "mission_item_related", `${id} property extraction scope`);
  equal(
    array(properties.contract, `${id}.propertyOverrides.contract`).length,
    fixture.contractPropertyCount,
    `${id} contract property count`,
  );
  const evidence = array(record.requiredItemEvidence, `${id}.requiredItemEvidence`)
    .map((row, index) => object(row, `${id}.requiredItemEvidence[${index}]`));
  equal(evidence.length, fixture.requiredItemEvidenceCount, `${id} required-item evidence count`);
  equal(
    evidence.map((row) => row.roleStatus),
    fixture.roleStatuses,
    `${id} required-item role statuses`,
  );
  equal(
    JSON.stringify(evidence).includes("missing_source_reference"),
    fixture.hasMissingSourceReference,
    `${id} missing item reference`,
  );
  const evidenceJson = JSON.stringify(evidence);
  for (const expectedDisplayName of array(fixture.expectedDisplayNames ?? [], `${id}.expectedDisplayNames`)) {
    assert(
      evidenceJson.includes(String(expectedDisplayName)),
      `${id} required-item identity ${String(expectedDisplayName)} is missing.`,
    );
  }
  assert(
    edgeRows(record, "outcomeEdges").every(
      (edge) => edge.type !== "hauling_order" && edge.type !== "mission_item_selector",
    ),
    `${id} required-item evidence leaked into reward outcome edges.`,
  );
}

for (const value of array(golden.calculatedCreditAssertions, "calculatedCreditAssertions")) {
  const fixture = object(value, "calculated credit assertion");
  const id = text(fixture.variantId)!;
  const record = records.get(id);
  assert(record, `Calculated-credit golden variant ${id} is missing.`);
  const results = array(record.creditRewardTypes, `${id}.creditRewardTypes`)
    .map((result, index) => object(result, `${id}.creditRewardTypes[${index}]`))
    .filter((result) => result.type === "ContractResult_CalculatedReward");
  equal(results.length, fixture.resultCount, `${id} calculated result count`);
  const context = object(results[0]?.calculatedContext, `${id}.calculatedContext`);
  equal(context.formulaStatus, fixture.formulaStatus, `${id} formula status`);
  equal(context.baseSoloAmount ?? null, fixture.amount, `${id} calculated amount`);
  equal(context.currency, fixture.currency, `${id} calculated currency`);
  equal(context.modelVersion, fixture.modelVersion, `${id} payout model`);
  const difficulty = object(context.difficulty, `${id}.difficulty`);
  equal(object(difficulty.profile, `${id}.difficulty.profile`).name ?? null, fixture.profile, `${id} difficulty profile`);
  equal(difficulty.value ?? null, fixture.difficulty, `${id} calculated difficulty`);
  equal(object(context.contractBuyInAmount, "contractBuyInAmount").raw, fixture.contractBuyInAmountRaw, `${id} buy-in raw`);
  equal(object(context.timeToComplete, "timeToComplete").raw, fixture.timeToCompleteRaw, `${id} time raw`);
  equal(object(context.timeToComplete, "timeToComplete").unitStatus, fixture.timeToCompleteUnitStatus, `${id} time unit status`);
  equal(context.resultLoopVerificationRequired, fixture.resultLoopVerificationRequired, `${id} result-loop flag`);
  equal(context.unresolvedReasons, fixture.unresolvedReasons, `${id} payout unresolved reasons`);
  equal(context.validationWarnings, fixture.validationWarnings, `${id} payout warnings`);
  assert(object(context.curve, `${id}.curve`).sourceSha256, `${id} curve provenance hash is missing.`);
  assert(object(context.provenance, `${id}.provenance`).buildId, `${id} build provenance is missing.`);
  const variantPayout = object(record.calculatedPayout, `${id}.calculatedPayout`);
  equal(variantPayout.baseSoloAmount ?? null, fixture.amount, `${id} variant payout amount`);
  equal(variantPayout.aggregationStatus, "not_aggregated", `${id} aggregation status`);
}

for (const value of array(golden.releaseFlagAssertions, "releaseFlagAssertions")) {
  const fixture = object(value, "release flag assertion");
  const id = text(fixture.variantId)!;
  const record = records.get(id);
  assert(record, `Release golden variant ${id} is missing.`);
  equal(record.notForRelease, fixture.notForRelease, `${id} not-for-release`);
  equal(record.workInProgress, fixture.workInProgress, `${id} work-in-progress`);
}

const templateExpected = object(expected.objectiveTemplates, "sourceContractV3.objectiveTemplates");
equal(report.objectiveTemplateCount, templateExpected.referenced, "referenced objective templates");
equal(report.objectiveTemplateResolvedCount, templateExpected.resolved, "resolved objective templates");
equal(report.objectiveTokenCount, templateExpected.objectiveTokens, "objective token count");
equal(report.objectiveTemplateWithFlowCount, templateExpected.withMissionFlow, "templates with mission flow");

const legalityExpected = object(expected.legalityComparisons, "sourceContractV3.legalityComparisons");
const legalityCounts = object(report.legalityComparisonCounts, "report.legalityComparisonCounts");
equal(legalityCounts.agree, legalityExpected.agree, "legality agree count");
equal(legalityCounts.template_only, legalityExpected.templateOnly, "legality template-only count");
equal(legalityCounts.conflict, legalityExpected.conflict, "legality conflict count");
equal(legalityCounts.override_only ?? 0, legalityExpected.overrideOnly, "legality override-only count");
equal(legalityCounts.missing, legalityExpected.missing, "legality missing count");

const creditExpected = object(expected.creditResults, "sourceContractV3.creditResults");
equal(report.contractResultRewardFixedExtractedCount, creditExpected.fixedRows, "fixed credit rows");
equal(report.contractResultCalculatedRewardCount, creditExpected.calculatedRows, "calculated credit rows");
const calculatedVariantCount = Array.from(records.values())
  .filter((record) => array(record.creditRewardTypes ?? [], "creditRewardTypes")
    .some((result) => object(result, "credit result").type === "ContractResult_CalculatedReward"))
  .length;
equal(calculatedVariantCount, creditExpected.variantsWithCalculatedRows, "variants with calculated credit rows");
const payoutReport = object(report.calculatedPayout, "report.calculatedPayout");
equal(payoutReport.resolvedVariantCount, creditExpected.resolvedVariants, "resolved payout variants");
equal(payoutReport.unresolvedVariantCount, creditExpected.unresolvedVariants, "unresolved payout variants");
equal(payoutReport.releasedVariantCount, creditExpected.releasedVariants, "released payout variants");
equal(payoutReport.releasedResultRowCount, creditExpected.releasedRows, "released payout rows");
equal(
  payoutReport.releasedResolvedVariantCount,
  creditExpected.releasedResolvedVariants,
  "released resolved payout variants",
);
equal(
  payoutReport.releasedUnresolvedVariantCount,
  creditExpected.releasedUnresolvedVariants,
  "released unresolved payout variants",
);
equal(
  payoutReport.nonPositiveTimeVariantIds
    ? array(payoutReport.nonPositiveTimeVariantIds, "nonPositiveTimeVariantIds").length
    : 0,
  creditExpected.resolvedZeroVariants,
  "resolved zero-time payout variants",
);
equal(payoutReport.multiResultVariantCount, creditExpected.multiResultVariants, "multi-result payout variants");
equal(payoutReport.nonzeroActiveBuyInVariantCount, creditExpected.activeNonzeroBuyIns, "active nonzero buy-ins");
equal(
  payoutReport.calculatedReputationVariantCount,
  creditExpected.calculatedReputationVariants,
  "calculated-reputation variants",
);
equal(
  payoutReport.releasedCalculatedReputationVariantCount,
  creditExpected.releasedCalculatedReputationVariants,
  "released calculated-reputation variants",
);
equal(payoutReport.releasedPayout, creditExpected.releasedPayout, "released payout summary");

const requiredItemExpected = object(
  expected.requiredItemEvidence,
  "sourceContractV3.requiredItemEvidence",
);
const requiredItemReport = object(report.requiredItemEvidence, "report.requiredItemEvidence");
equal(requiredItemReport.variantCount, requiredItemExpected.variants, "required-item variants");
equal(requiredItemReport.propertyOverrideCount, requiredItemExpected.propertyRows, "required-item property rows");
equal(requiredItemReport.haulingOrdersPropertyCount, requiredItemExpected.haulingOrders, "hauling-order properties");
equal(requiredItemReport.explicitOrderVariantCount, requiredItemExpected.haulingOrderVariants, "hauling-order variants");
equal(
  requiredItemReport.missionItemSelectorPropertyCount,
  requiredItemExpected.missionItemSelectors,
  "mission-item selector properties",
);
equal(
  requiredItemReport.missionItemSelectorVariantCount,
  requiredItemExpected.missionItemSelectorVariants,
  "mission-item selector variants",
);
const orderNodeCounts = object(requiredItemReport.orderNodeCounts, "requiredItemEvidence.orderNodeCounts");
equal(orderNodeCounts.entity_class, requiredItemExpected.entityClassOrders, "entity-class order nodes");
equal(orderNodeCounts.entity_class_set, requiredItemExpected.entityClassSetOrders, "entity-class-set order nodes");
equal(orderNodeCounts.resource, requiredItemExpected.resourceOrders, "resource order nodes");
equal(orderNodeCounts.mission_item_reference, requiredItemExpected.missionItemReferences, "mission-item order nodes");
equal(orderNodeCounts.any_of, requiredItemExpected.anyOfNodes, "conditional order nodes");
equal(requiredItemReport.allOfOptionCount, requiredItemExpected.allOfOptions, "conditional all-of options");
equal(
  requiredItemReport.unresolvedMissionItemHandleCount,
  requiredItemExpected.unresolvedMissionItemHandles,
  "unresolved mission-item handles",
);
equal(
  requiredItemReport.missingMissionItemReferenceCount,
  requiredItemExpected.missingMissionItemReferences,
  "missing mission-item references",
);

const graphExpected = object(expected.completionTagGraph, "sourceContractV3.completionTagGraph");
const graph = object(report.completionTagGraph, "report.completionTagGraph");
equal(graph.producerContractCount, graphExpected.producerContracts, "completion producer contracts");
equal(graph.producedTagCount, graphExpected.producedTags, "produced completion tags");
equal(graph.requiredTagCount, graphExpected.parentRequiredTags, "parent required completion tags");
equal(graph.requiredDanglingTagCount, graphExpected.parentRequiredDanglingTags, "parent dangling required tags");
equal(graph.excludedTagCount, graphExpected.parentExcludedTags, "parent excluded completion tags");
equal(graph.excludedDanglingTagCount, graphExpected.parentExcludedDanglingTags, "parent dangling excluded tags");

const prerequisiteExpected = object(expected.parentPrerequisiteRows, "sourceContractV3.parentPrerequisiteRows");
const prerequisiteTypeMap: Record<string, string> = {
  location: "ContractPrerequisite_Location",
  locality: "ContractPrerequisite_Locality",
  locationProperty: "ContractPrerequisite_LocationProperty",
  crimeStat: "ContractPrerequisite_CrimeStat",
  reputation: "ContractPrerequisite_Reputation",
  completedContractTags: "ContractPrerequisite_CompletedContractTags",
};
for (const [key, rawType] of Object.entries(prerequisiteTypeMap)) {
  const count = Array.from(records.values())
    .flatMap((record) => array(record.prerequisites ?? [], "prerequisites"))
    .map((row) => object(row, "prerequisite"))
    .filter((row) => row.type === rawType)
    .length;
  equal(count, prerequisiteExpected[key], `${key} parent prerequisite rows`);
}

const completionTagEdges = Array.from(records.values()).flatMap((record) => [
  ...edgeRows(record, "prerequisiteEdges"),
  ...Object.values(object(record.subContractPrerequisiteEdges ?? {}, "subcontract edge groups"))
    .flatMap((value) => array(value, "subcontract edge group"))
    .map((value) => object(value, "subcontract edge")),
]).filter((edge) => edge.type === "completion_tag");
for (const edge of completionTagEdges) {
  const constraint = object(
    object(edge.payload, "completion-tag edge payload").completionTagConstraint,
    "completionTagConstraint",
  );
  equal(constraint.schemaVersion, 1, "completion-tag constraint schema");
  assert(text(constraint.groupId), "Completion-tag constraint groupId is missing.");
  equal(constraint.polarity, edge.polarity, "completion-tag constraint polarity");
  const memberTags = array(
    constraint.memberCompletionTags,
    "completionTagConstraint.memberCompletionTags",
  ).map(String);
  const memberTag = prerequisiteTag(edge);
  if (memberTag) {
    assert(
      memberTags.includes(memberTag),
      `Completion-tag group ${String(constraint.groupId)} does not contain edge member ${memberTag}.`,
    );
  }
  const threshold = object(constraint.threshold, "completionTagConstraint.threshold");
  assert(
    threshold.value === null || number(threshold.value) !== undefined,
    `Completion-tag group ${String(constraint.groupId)} has an invalid threshold.`,
  );
}

console.log(
  `Mission source contract v3 verified: ${records.size} variants, ${templates.size} templates, `
  + `${String(graph.producedTagCount)} produced completion tags, `
  + `${completionTagEdges.length} grouped prerequisite edges.`,
);
