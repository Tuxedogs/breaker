import {
  parseMissionSourceCatalogV3,
  type JsonObject,
  type MissionSourceCatalogV3,
  type MissionSourceEdgeV3,
  type MissionSourceRecordV3,
} from "./source-v3.mts";

export type MissionOfferEvidenceProvenanceV1 =
  | "source_backed"
  | "derived"
  | "unresolved";

export type MissionOfferReferenceEvidenceV1 = {
  guid: string | null;
  recordName?: string | null;
  recordType?: string | null;
  displayName?: string | null;
  path?: string | null;
  resolution: string;
  expectedRecordTypes?: string[];
  provenance: MissionOfferEvidenceProvenanceV1;
};

export type MissionOfferProviderEvidenceV1 = {
  sourceParam: "Contractor";
  displayRaw: string | null;
  displayText: string | null;
  organizationGuid: string | null;
  displayResolution: string;
  organizationResolution: string;
  provenance: MissionOfferEvidenceProvenanceV1;
};

export type MissionOfferRuntimeTokenEvidenceV1 = {
  raw: string;
  expression: string;
  segments: string[];
};

export type MissionOfferTitleEvidenceV1 = {
  raw: string | null;
  localizationKey: string | null;
  template: string | null;
  displayText: string | null;
  runtimeTokens: MissionOfferRuntimeTokenEvidenceV1[];
  rendering: "static" | "runtime_templated" | "unresolved";
  resolution: string;
  provenance: MissionOfferEvidenceProvenanceV1;
};

export type MissionOfferVerificationEvidenceV1 = {
  vocabulary: "verified_unverified";
  status: "verified" | "unverified" | "unknown";
  effectiveIllegal: boolean | null;
  effectiveResolution: string;
  rawEvidence: {
    handlerIllegal: boolean | null;
    contractIllegal: boolean | null;
    templateIllegal: boolean | null;
    comparison: string | null;
  };
  provenance: MissionOfferEvidenceProvenanceV1;
};

export type MissionOfferAvailabilityRequirementEvidenceV1 = {
  edgeId: string;
  type: "location" | "locality";
  polarity?: "required" | "excluded";
  sourceAttribute: "locationAvailable" | "localityAvailable";
  reference: MissionOfferReferenceEvidenceV1;
  resolution?: string;
  sourceScopes: string[];
  sourceOwners: JsonObject[];
  provenance: JsonObject;
};

export type MissionOfferAvailabilityBranchEvidenceV1 = {
  ownerScope: "parent_eligibility" | "subcontract";
  ownerId: string;
  requirements: MissionOfferAvailabilityRequirementEvidenceV1[];
};

export type MissionOfferReputationPrerequisiteEvidenceV1 = {
  edgeId: string;
  ownerScope: "parent_eligibility" | "subcontract";
  ownerId: string;
  polarity?: "required" | "excluded";
  faction: MissionOfferReferenceEvidenceV1;
  scope: MissionOfferReferenceEvidenceV1;
  minStanding: MissionOfferReferenceEvidenceV1;
  maxStanding: MissionOfferReferenceEvidenceV1;
  identifiers: JsonObject;
  bounds: JsonObject;
  resolution?: string;
  sourceScopes: string[];
  sourceOwners: JsonObject[];
  provenance: JsonObject;
};

export type MissionOfferSourceEvidenceV1 = {
  schemaVersion: 1;
  variantId: string;
  provider: MissionOfferProviderEvidenceV1;
  reputationFaction: MissionOfferReferenceEvidenceV1;
  title: MissionOfferTitleEvidenceV1;
  verification: MissionOfferVerificationEvidenceV1;
  availabilityBranches: MissionOfferAvailabilityBranchEvidenceV1[];
  reputationPrerequisites: MissionOfferReputationPrerequisiteEvidenceV1[];
};

export type MissionSourceRecordV4 = MissionSourceRecordV3 & {
  offerEvidence: MissionOfferSourceEvidenceV1;
};

export type MissionSourceCatalogV4 = Omit<MissionSourceCatalogV3, "schemaVersion" | "records"> & {
  schemaVersion: 4;
  records: MissionSourceRecordV4[];
};

export type MissionSourceCatalog = MissionSourceCatalogV3 | MissionSourceCatalogV4;
export type MissionSourceRecord = MissionSourceRecordV3 | MissionSourceRecordV4;
export type MissionSourceSchemaVersion = MissionSourceCatalog["schemaVersion"];

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as JsonObject;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  return string(value, label);
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  label: string,
): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new Error(`${label} is unsupported.`);
  }
  return value as T;
}

function nullableBoolean(value: unknown, label: string): boolean | null {
  if (value === null) return null;
  if (typeof value !== "boolean") throw new Error(`${label} must be boolean or null.`);
  return value;
}

function validateProvenance(
  value: unknown,
  label: string,
): MissionOfferEvidenceProvenanceV1 {
  return enumValue(value, ["source_backed", "derived", "unresolved"], label);
}

function validateReferenceEvidence(
  value: unknown,
  label: string,
): MissionOfferReferenceEvidenceV1 {
  const reference = object(value, label);
  if (reference.guid !== null) string(reference.guid, `${label}.guid`);
  string(reference.resolution, `${label}.resolution`);
  validateProvenance(reference.provenance, `${label}.provenance`);
  for (const key of ["recordName", "recordType", "displayName", "path"] as const) {
    if (reference[key] !== undefined) nullableString(reference[key], `${label}.${key}`);
  }
  if (reference.expectedRecordTypes !== undefined) {
    for (const [index, item] of array(
      reference.expectedRecordTypes,
      `${label}.expectedRecordTypes`,
    ).entries()) {
      string(item, `${label}.expectedRecordTypes[${index}]`);
    }
  }
  return reference as MissionOfferReferenceEvidenceV1;
}

function canonicalEdgeForOwner(
  record: MissionSourceRecordV3,
  ownerScope: "parent_eligibility" | "subcontract",
  ownerId: string,
  edgeId: string,
  label: string,
): MissionSourceEdgeV3 {
  const edges = ownerScope === "parent_eligibility"
    ? record.prerequisiteEdges
    : record.subContractPrerequisiteEdges?.[ownerId] ?? [];
  const edge = edges.find((candidate) => candidate.edgeId === edgeId);
  if (!edge) {
    throw new Error(`${label}.edgeId does not resolve within its canonical owner scope.`);
  }
  if ((edge.ownerScope ?? "parent_eligibility") !== ownerScope) {
    throw new Error(`${label}.ownerScope disagrees with its canonical prerequisite edge.`);
  }
  if ((edge.ownerId ?? record.contractId) !== ownerId) {
    throw new Error(`${label}.ownerId disagrees with its canonical prerequisite edge.`);
  }
  return edge;
}

function validateOfferEvidence(
  value: unknown,
  record: MissionSourceRecordV3,
  label: string,
): MissionOfferSourceEvidenceV1 {
  const evidence = object(value, label);
  if (evidence.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must be 1.`);
  if (string(evidence.variantId, `${label}.variantId`) !== record.contractId) {
    throw new Error(`${label}.variantId does not match owning contract ${record.contractId}.`);
  }

  const provider = object(evidence.provider, `${label}.provider`);
  if (provider.sourceParam !== "Contractor") {
    throw new Error(`${label}.provider.sourceParam must be Contractor.`);
  }
  nullableString(provider.displayRaw, `${label}.provider.displayRaw`);
  nullableString(provider.displayText, `${label}.provider.displayText`);
  nullableString(provider.organizationGuid, `${label}.provider.organizationGuid`);
  string(provider.displayResolution, `${label}.provider.displayResolution`);
  string(provider.organizationResolution, `${label}.provider.organizationResolution`);
  validateProvenance(provider.provenance, `${label}.provider.provenance`);

  validateReferenceEvidence(evidence.reputationFaction, `${label}.reputationFaction`);

  const title = object(evidence.title, `${label}.title`);
  for (const key of ["raw", "localizationKey", "template", "displayText"] as const) {
    nullableString(title[key], `${label}.title.${key}`);
  }
  for (const [index, tokenValue] of array(
    title.runtimeTokens,
    `${label}.title.runtimeTokens`,
  ).entries()) {
    const token = object(tokenValue, `${label}.title.runtimeTokens[${index}]`);
    string(token.raw, `${label}.title.runtimeTokens[${index}].raw`);
    string(token.expression, `${label}.title.runtimeTokens[${index}].expression`);
    for (const [segmentIndex, segment] of array(
      token.segments,
      `${label}.title.runtimeTokens[${index}].segments`,
    ).entries()) {
      string(segment, `${label}.title.runtimeTokens[${index}].segments[${segmentIndex}]`);
    }
  }
  enumValue(
    title.rendering,
    ["static", "runtime_templated", "unresolved"],
    `${label}.title.rendering`,
  );
  string(title.resolution, `${label}.title.resolution`);
  validateProvenance(title.provenance, `${label}.title.provenance`);

  const verification = object(evidence.verification, `${label}.verification`);
  if (verification.vocabulary !== "verified_unverified") {
    throw new Error(`${label}.verification.vocabulary must be verified_unverified.`);
  }
  enumValue(
    verification.status,
    ["verified", "unverified", "unknown"],
    `${label}.verification.status`,
  );
  nullableBoolean(
    verification.effectiveIllegal,
    `${label}.verification.effectiveIllegal`,
  );
  string(verification.effectiveResolution, `${label}.verification.effectiveResolution`);
  const rawEvidence = object(
    verification.rawEvidence,
    `${label}.verification.rawEvidence`,
  );
  for (const key of ["handlerIllegal", "contractIllegal", "templateIllegal"] as const) {
    nullableBoolean(rawEvidence[key], `${label}.verification.rawEvidence.${key}`);
  }
  nullableString(
    rawEvidence.comparison,
    `${label}.verification.rawEvidence.comparison`,
  );
  validateProvenance(verification.provenance, `${label}.verification.provenance`);

  const seenAvailabilityOwners = new Set<string>();
  for (const [branchIndex, branchValue] of array(
    evidence.availabilityBranches,
    `${label}.availabilityBranches`,
  ).entries()) {
    const branchLabel = `${label}.availabilityBranches[${branchIndex}]`;
    const branch = object(branchValue, branchLabel);
    const ownerScope = enumValue(
      branch.ownerScope,
      ["parent_eligibility", "subcontract"],
      `${branchLabel}.ownerScope`,
    );
    const ownerId = string(branch.ownerId, `${branchLabel}.ownerId`);
    const ownerKey = `${ownerScope}:${ownerId}`;
    if (seenAvailabilityOwners.has(ownerKey)) {
      throw new Error(`${label}.availabilityBranches contains duplicate owner ${ownerKey}.`);
    }
    seenAvailabilityOwners.add(ownerKey);
    for (const [requirementIndex, requirementValue] of array(
      branch.requirements,
      `${branchLabel}.requirements`,
    ).entries()) {
      const requirementLabel = `${branchLabel}.requirements[${requirementIndex}]`;
      const requirement = object(requirementValue, requirementLabel);
      const edgeId = string(requirement.edgeId, `${requirementLabel}.edgeId`);
      const requirementType = enumValue(
        requirement.type,
        ["location", "locality"],
        `${requirementLabel}.type`,
      );
      const canonicalEdge = canonicalEdgeForOwner(
        record,
        ownerScope,
        ownerId,
        edgeId,
        requirementLabel,
      );
      if (canonicalEdge.type !== requirementType) {
        throw new Error(`${requirementLabel}.type disagrees with its canonical edge.`);
      }
      const expectedAttribute = requirementType === "location"
        ? "locationAvailable"
        : "localityAvailable";
      if (requirement.sourceAttribute !== expectedAttribute) {
        throw new Error(`${requirementLabel}.sourceAttribute is inconsistent with its type.`);
      }
      validateReferenceEvidence(requirement.reference, `${requirementLabel}.reference`);
      array(requirement.sourceScopes, `${requirementLabel}.sourceScopes`);
      array(requirement.sourceOwners, `${requirementLabel}.sourceOwners`);
      object(requirement.provenance, `${requirementLabel}.provenance`);
    }
  }

  for (const [rowIndex, rowValue] of array(
    evidence.reputationPrerequisites,
    `${label}.reputationPrerequisites`,
  ).entries()) {
    const rowLabel = `${label}.reputationPrerequisites[${rowIndex}]`;
    const row = object(rowValue, rowLabel);
    const ownerScope = enumValue(
      row.ownerScope,
      ["parent_eligibility", "subcontract"],
      `${rowLabel}.ownerScope`,
    );
    const ownerId = string(row.ownerId, `${rowLabel}.ownerId`);
    const edge = canonicalEdgeForOwner(
      record,
      ownerScope,
      ownerId,
      string(row.edgeId, `${rowLabel}.edgeId`),
      rowLabel,
    );
    if (edge.type !== "reputation") {
      throw new Error(`${rowLabel}.edgeId does not identify a reputation prerequisite.`);
    }
    for (const key of ["faction", "scope", "minStanding", "maxStanding"] as const) {
      validateReferenceEvidence(row[key], `${rowLabel}.${key}`);
    }
    object(row.identifiers, `${rowLabel}.identifiers`);
    object(row.bounds, `${rowLabel}.bounds`);
    array(row.sourceScopes, `${rowLabel}.sourceScopes`);
    array(row.sourceOwners, `${rowLabel}.sourceOwners`);
    object(row.provenance, `${rowLabel}.provenance`);
  }

  return evidence as MissionOfferSourceEvidenceV1;
}

export function parseMissionSourceCatalogV4(value: unknown): MissionSourceCatalogV4 {
  const catalog = object(value, "mission source catalog");
  if (catalog.schemaVersion !== 4) {
    throw new Error(
      `Unsupported mission source schema ${String(catalog.schemaVersion)}; expected 4.`,
    );
  }
  const canonical = parseMissionSourceCatalogV3({ ...catalog, schemaVersion: 3 });
  const records = canonical.records.map((record, index) => {
    validateOfferEvidence(
      record.offerEvidence,
      record,
      `mission source catalog.records[${index}].offerEvidence`,
    );
    return record as MissionSourceRecordV4;
  });
  return {
    ...canonical,
    schemaVersion: 4,
    records,
  };
}

export function parseMissionSourceCatalog(value: unknown): MissionSourceCatalog {
  const catalog = object(value, "mission source catalog");
  if (catalog.schemaVersion === 3) return parseMissionSourceCatalogV3(value);
  if (catalog.schemaVersion === 4) return parseMissionSourceCatalogV4(value);
  throw new Error(
    `Unsupported mission source schema ${String(catalog.schemaVersion)}; expected 3 or 4.`,
  );
}
