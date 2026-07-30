export type JsonObject = Record<string, unknown>;

export type MissionSourceProvenanceV3 = {
  sourceRef: string;
  sourceElement?: string | null;
  referencePath?: string | null;
  xmlPath?: string | null;
};

export type MissionSourceEdgeV3 = {
  edgeId: string;
  variantId: string;
  ownerScope?: string;
  ownerId?: string;
  type: string;
  polarity?: "required" | "excluded";
  identifiers?: JsonObject;
  bounds?: JsonObject;
  payload?: JsonObject;
  resolution?: string;
  provenance: MissionSourceProvenanceV3;
};

export type MissionCalculatedPayoutResultV1 = {
  resultIndex: number;
  calculationStatus: "resolved" | "unresolved";
  currency: string;
  baseSoloAmount: number | null;
  missionResults: boolean[];
};

export type MissionCalculatedPayoutV1 = {
  schemaVersion: 1;
  modelVersion: string;
  calculationStatus: "resolved" | "unresolved";
  formulaStatus: string;
  currency: string;
  baseSoloAmount: number | null;
  resultCount: number;
  aggregationStatus: string;
  resultLoopVerificationRequired: boolean;
  resultAmounts: MissionCalculatedPayoutResultV1[];
  unresolvedReasons: string[];
  validationWarnings: string[];
  source: string;
};

export type MissionCalculatedRewardContextV1 = JsonObject & {
  schemaVersion: 1;
  modelVersion: string;
  calculationStatus: "resolved" | "unresolved";
  formulaStatus: string;
  currency: string;
  baseSoloAmount: number | null;
  amount: number | null;
  resultIndex: number;
  resultCount: number;
  aggregationStatus: string;
  resultLoopVerificationRequired: boolean;
  unresolvedReasons: string[];
  validationWarnings: string[];
  provenance: JsonObject;
};

export type MissionSourceRewardV3 = JsonObject & {
  type?: string;
  sourceRefs?: string[];
  attributes?: JsonObject;
  fixedReward?: {
    reward?: number | string | null;
    max?: number | string | null;
    plusBonuses?: number | string | null;
    currencyType?: string | null;
  };
  calculatedContext?: MissionCalculatedRewardContextV1;
};

export type MissionRequiredItemEvidenceV3 = JsonObject & {
  evidenceId: string;
  variantId: string;
  sourceScope: string;
  sourceOwnerId: string;
  missionVariableName?: string | null;
  requirementRole: string;
  roleStatus: string;
  requirementStatus: string;
  content: JsonObject;
  provenance: MissionSourceProvenanceV3;
};

export type MissionPropertyOverridesV3 = {
  extractionScope: string;
  handler: JsonObject[];
  contract: JsonObject[];
};

export type MissionSourceRecordV3 = JsonObject & {
  contractId: string;
  familyId?: string;
  template?: string;
  notForRelease?: boolean | string;
  workInProgress?: boolean | string;
  objectiveTemplate?: JsonObject;
  prerequisiteEdges: MissionSourceEdgeV3[];
  outcomeEdges: MissionSourceEdgeV3[];
  subContractPrerequisiteEdges?: Record<string, MissionSourceEdgeV3[]>;
  calculatedPayout?: MissionCalculatedPayoutV1 | null;
  creditRewardTypes?: MissionSourceRewardV3[];
  fixedReputationRewards?: MissionSourceRewardV3[];
  calculatedReputationRewards?: MissionSourceRewardV3[];
  propertyOverrides?: MissionPropertyOverridesV3;
  requiredItemEvidence?: MissionRequiredItemEvidenceV3[];
  legalityEvidence?: JsonObject;
};

export type MissionSourceCatalogV3 = {
  schemaVersion: 3;
  generatedAt: string;
  sourceLatestModifiedAt: string;
  source: {
    channel: string;
    buildId: string;
    recordsRoot?: string;
    sourceLatestModifiedAt: string;
    calculationInputsLatestModifiedAt?: string;
    calculationInputsDigestSha256: string;
    calculationInputFiles: JsonObject[];
  };
  records: MissionSourceRecordV3[];
};

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as JsonObject;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) throw new Error(`${label} must be a non-empty string.`);
  return value;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

function validateEdge(value: unknown, recordId: string, label: string): MissionSourceEdgeV3 {
  const edge = object(value, label);
  string(edge.edgeId, `${label}.edgeId`);
  if (string(edge.variantId, `${label}.variantId`) !== recordId) {
    throw new Error(`${label}.variantId does not match owning contract ${recordId}.`);
  }
  string(edge.type, `${label}.type`);
  const provenance = object(edge.provenance, `${label}.provenance`);
  string(provenance.sourceRef, `${label}.provenance.sourceRef`);
  return edge as MissionSourceEdgeV3;
}

function validateCalculatedPayout(value: unknown, label: string): MissionCalculatedPayoutV1 {
  const payout = object(value, label);
  if (payout.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must be 1.`);
  string(payout.modelVersion, `${label}.modelVersion`);
  if (payout.calculationStatus !== "resolved" && payout.calculationStatus !== "unresolved") {
    throw new Error(`${label}.calculationStatus is unsupported.`);
  }
  if (payout.baseSoloAmount !== null && (typeof payout.baseSoloAmount !== "number" || !Number.isFinite(payout.baseSoloAmount))) {
    throw new Error(`${label}.baseSoloAmount must be finite or null.`);
  }
  array(payout.resultAmounts, `${label}.resultAmounts`);
  array(payout.unresolvedReasons, `${label}.unresolvedReasons`);
  array(payout.validationWarnings, `${label}.validationWarnings`);
  return payout as MissionCalculatedPayoutV1;
}

export function parseMissionSourceCatalogV3(value: unknown): MissionSourceCatalogV3 {
  const catalog = object(value, "mission source catalog");
  if (catalog.schemaVersion !== 3) {
    throw new Error(`Unsupported mission source schema ${String(catalog.schemaVersion)}; expected 3.`);
  }
  string(catalog.generatedAt, "mission source catalog.generatedAt");
  string(catalog.sourceLatestModifiedAt, "mission source catalog.sourceLatestModifiedAt");
  const source = object(catalog.source, "mission source catalog.source");
  string(source.channel, "mission source catalog.source.channel");
  string(source.buildId, "mission source catalog.source.buildId");
  string(source.sourceLatestModifiedAt, "mission source catalog.source.sourceLatestModifiedAt");
  string(source.calculationInputsDigestSha256, "mission source catalog.source.calculationInputsDigestSha256");
  array(source.calculationInputFiles, "mission source catalog.source.calculationInputFiles");

  const seenRecordIds = new Set<string>();
  const seenEdgeIds = new Set<string>();
  const records = array(catalog.records, "mission source catalog.records").map((value, recordIndex) => {
    const record = object(value, `mission source catalog.records[${recordIndex}]`);
    const contractId = string(record.contractId, `mission source catalog.records[${recordIndex}].contractId`);
    if (seenRecordIds.has(contractId)) throw new Error(`Duplicate mission contractId ${contractId}.`);
    seenRecordIds.add(contractId);

    for (const edgeName of ["prerequisiteEdges", "outcomeEdges"] as const) {
      const edges = array(record[edgeName], `${contractId}.${edgeName}`);
      for (const [edgeIndex, edgeValue] of edges.entries()) {
        const edge = validateEdge(edgeValue, contractId, `${contractId}.${edgeName}[${edgeIndex}]`);
        if (seenEdgeIds.has(edge.edgeId)) throw new Error(`Duplicate mission edgeId ${edge.edgeId}.`);
        seenEdgeIds.add(edge.edgeId);
      }
    }

    const requiredItemIds = new Set<string>();
    for (const [evidenceIndex, evidenceValue] of array(record.requiredItemEvidence ?? [], `${contractId}.requiredItemEvidence`).entries()) {
      const evidence = object(evidenceValue, `${contractId}.requiredItemEvidence[${evidenceIndex}]`);
      const evidenceId = string(evidence.evidenceId, `${contractId}.requiredItemEvidence[${evidenceIndex}].evidenceId`);
      if (evidence.variantId !== contractId) throw new Error(`${evidenceId} does not belong to ${contractId}.`);
      if (requiredItemIds.has(evidenceId)) throw new Error(`Duplicate required-item evidenceId ${evidenceId}.`);
      requiredItemIds.add(evidenceId);
    }

    if (record.calculatedPayout != null) {
      validateCalculatedPayout(record.calculatedPayout, `${contractId}.calculatedPayout`);
    }
    return record as MissionSourceRecordV3;
  });

  return {
    ...catalog,
    source: source as MissionSourceCatalogV3["source"],
    records,
  } as MissionSourceCatalogV3;
}
