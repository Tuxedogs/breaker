import type {
  JsonObject,
  MissionCalculatedPayoutV1,
  MissionPropertyOverridesV3,
  MissionRequiredItemEvidenceV3,
  MissionSourceEdgeV3,
  MissionSourceRewardV3,
} from "./source-v3.mts";
import type {
  MissionOfferSourceEvidenceV1,
  MissionSourceCatalog,
  MissionSourceRecord,
  MissionSourceRecordV4,
  MissionSourceSchemaVersion,
} from "./source-v4.mts";

export const MISSION_SHAPED_SCHEMA_VERSION = 3 as const;
export const MISSION_SOURCE_SCHEMA_VERSION = 4 as const;
export const MISSION_SUPPORTED_SOURCE_SCHEMA_VERSIONS = [3, 4] as const;

export type CanonicalMissionRewardsV2 = {
  calculatedPayout: MissionCalculatedPayoutV1 | null;
  fixedCurrency: MissionSourceEdgeV3[];
  blueprint: MissionSourceEdgeV3[];
  item: MissionSourceEdgeV3[];
  weightedItem: MissionSourceEdgeV3[];
  fixedReputation: MissionSourceEdgeV3[];
  calculatedReputation: MissionSourceEdgeV3[];
  completionTags: MissionSourceEdgeV3[];
};

export type CanonicalMissionVariantV2 = {
  schemaVersion: typeof MISSION_SHAPED_SCHEMA_VERSION;
  sourceSchemaVersion: MissionSourceSchemaVersion;
  identity: {
    variantId: string;
    familyId: string;
    templateGuid: string | null;
  };
  availability: {
    notForRelease: boolean;
    workInProgress: boolean;
  };
  prerequisites: MissionSourceEdgeV3[];
  subcontractPrerequisites: Record<string, MissionSourceEdgeV3[]>;
  outcomes: MissionSourceEdgeV3[];
  objectiveTemplate: JsonObject | null;
  legalityEvidence: JsonObject | null;
  offerEvidence: MissionOfferSourceEvidenceV1 | null;
  rewards: CanonicalMissionRewardsV2;
  financials: {
    creditResults: MissionSourceRewardV3[];
    calculatedPayout: MissionCalculatedPayoutV1 | null;
    buyIns: Array<{
      resultIndex: number | null;
      contractBuyInAmount: JsonObject;
      provenance: JsonObject;
    }>;
  };
  reputationOutcomes: {
    fixed: MissionSourceRewardV3[];
    calculated: MissionSourceRewardV3[];
  };
  requiredItems: MissionRequiredItemEvidenceV3[];
  propertyOverrides: MissionPropertyOverridesV3 | null;
  provenance: {
    channel: string;
    buildId: string;
    sourceLatestModifiedAt: string;
    calculationInputsDigestSha256: string;
  };
};

function truthy(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function outcomesOfType(record: MissionSourceRecord, type: string): MissionSourceEdgeV3[] {
  return record.outcomeEdges.filter((edge) => edge.type === type);
}

export function normalizeCanonicalMissionVariantV2(
  catalog: MissionSourceCatalog,
  record: MissionSourceRecord,
): CanonicalMissionVariantV2 {
  const creditResults = record.creditRewardTypes ?? [];
  const calculatedContexts = creditResults.flatMap((reward) =>
    reward.calculatedContext ? [reward.calculatedContext] : []
  );
  return {
    schemaVersion: MISSION_SHAPED_SCHEMA_VERSION,
    sourceSchemaVersion: catalog.schemaVersion,
    identity: {
      variantId: record.contractId,
      familyId: record.familyId ?? record.contractId,
      templateGuid: typeof record.template === "string" && record.template ? record.template : null,
    },
    availability: {
      notForRelease: truthy(record.notForRelease),
      workInProgress: truthy(record.workInProgress),
    },
    prerequisites: record.prerequisiteEdges,
    subcontractPrerequisites: record.subContractPrerequisiteEdges ?? {},
    outcomes: record.outcomeEdges,
    objectiveTemplate: record.objectiveTemplate ?? null,
    legalityEvidence: record.legalityEvidence ?? null,
    offerEvidence: catalog.schemaVersion === 4
      ? (record as MissionSourceRecordV4).offerEvidence
      : null,
    rewards: {
      calculatedPayout: record.calculatedPayout ?? null,
      fixedCurrency: outcomesOfType(record, "fixed_currency_reward"),
      blueprint: outcomesOfType(record, "blueprint_reward"),
      item: outcomesOfType(record, "item_reward"),
      weightedItem: outcomesOfType(record, "weighted_item_reward"),
      fixedReputation: outcomesOfType(record, "fixed_reputation"),
      calculatedReputation: outcomesOfType(record, "calculated_reputation"),
      completionTags: outcomesOfType(record, "completion_tag"),
    },
    financials: {
      creditResults,
      calculatedPayout: record.calculatedPayout ?? null,
      buyIns: calculatedContexts.flatMap((context) => {
        const contractBuyInAmount = context.contractBuyInAmount;
        if (!contractBuyInAmount || typeof contractBuyInAmount !== "object" || Array.isArray(contractBuyInAmount)) {
          return [];
        }
        return [{
          resultIndex: typeof context.resultIndex === "number" ? context.resultIndex : null,
          contractBuyInAmount: contractBuyInAmount as JsonObject,
          provenance: context.provenance,
        }];
      }),
    },
    reputationOutcomes: {
      fixed: record.fixedReputationRewards ?? [],
      calculated: record.calculatedReputationRewards ?? [],
    },
    requiredItems: record.requiredItemEvidence ?? [],
    propertyOverrides: record.propertyOverrides ?? null,
    provenance: {
      channel: catalog.source.channel,
      buildId: catalog.source.buildId,
      sourceLatestModifiedAt: catalog.sourceLatestModifiedAt,
      calculationInputsDigestSha256: catalog.source.calculationInputsDigestSha256,
    },
  };
}
