export type JsonObject = Record<string, unknown>;

export type MissionGenerationJoinMetadata = {
  generationId: string;
  missionSchemaVersion: 2 | 3;
  sourceContractVersion: 3 | 4;
  offerSchemaVersion: 1 | null;
  offerJoinStatus: "legacy_contract_id" | "joined_exact_variant";
};

export type MissionBlueprintOfferJoin = {
  metadata: MissionGenerationJoinMetadata;
  variantDetailFiles: Record<string, string>;
  variantOfferKeys: Record<string, string> | null;
};

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

function stringRecord(value: unknown, label: string): Record<string, string> {
  const record = object(value, label);
  for (const [key, item] of Object.entries(record)) {
    string(key, `${label} key`);
    string(item, `${label}.${key}`);
  }
  return record as Record<string, string>;
}

export function parseMissionBlueprintOfferJoin(
  indexValue: unknown,
  manifestValue: unknown,
  sourceLatestModifiedAt?: string,
): MissionBlueprintOfferJoin {
  const index = object(indexValue, "mission browser index");
  const manifest = object(manifestValue, "mission shard manifest");
  const generationId = string(index.generationId, "mission browser index.generationId");
  if (
    manifest.generationId !== generationId
    || manifest.schemaVersion !== index.schemaVersion
    || manifest.sourceContractVersion !== index.sourceContractVersion
  ) {
    throw new Error("Mission browser index and shard manifest generation metadata disagree.");
  }
  if (
    sourceLatestModifiedAt
    && index.sourceLatestModifiedAt !== sourceLatestModifiedAt
  ) {
    throw new Error("Mission generation and blueprint source snapshot timestamps disagree.");
  }
  const variantDetailFiles = stringRecord(
    index.variantDetailFiles,
    "mission browser index.variantDetailFiles",
  );

  if (index.schemaVersion === 2 && index.sourceContractVersion === 3) {
    return {
      metadata: {
        generationId,
        missionSchemaVersion: 2,
        sourceContractVersion: 3,
        offerSchemaVersion: null,
        offerJoinStatus: "legacy_contract_id",
      },
      variantDetailFiles,
      variantOfferKeys: null,
    };
  }
  if (
    index.schemaVersion !== 3
    || index.sourceContractVersion !== 4
    || index.offerSchemaVersion !== 1
    || manifest.offerSchemaVersion !== 1
  ) {
    throw new Error(
      "Blueprint offer join supports only mission schema 2/source 3 or schema 3/source 4/offer 1.",
    );
  }
  const variantOfferKeys = stringRecord(
    index.variantOfferKeys,
    "mission browser index.variantOfferKeys",
  );
  return {
    metadata: {
      generationId,
      missionSchemaVersion: 3,
      sourceContractVersion: 4,
      offerSchemaVersion: 1,
      offerJoinStatus: "joined_exact_variant",
    },
    variantDetailFiles,
    variantOfferKeys,
  };
}

function exactOfferKey(
  contractId: string,
  join: MissionBlueprintOfferJoin,
): string | undefined {
  const normalizedContractId = contractId.toLowerCase();
  if (!join.variantDetailFiles[normalizedContractId] && !join.variantDetailFiles[contractId]) {
    throw new Error(
      `Reward-bearing contract ${contractId} is missing exact mission variant ownership.`,
    );
  }
  if (!join.variantOfferKeys) return undefined;
  const offerKey = join.variantOfferKeys[normalizedContractId]
    ?? join.variantOfferKeys[contractId];
  if (!offerKey) {
    throw new Error(
      `Reward-bearing contract ${contractId} is missing exact MissionOffer ownership.`,
    );
  }
  return offerKey;
}

export function attachOfferKeysToBlueprintMissions(
  values: unknown[],
  join: MissionBlueprintOfferJoin,
): unknown[] {
  if (!join.variantOfferKeys) return values;
  return values.map((value, index) => {
    const mission = object(value, `blueprint mission source[${index}]`);
    const contractId = string(
      mission.contractId,
      `blueprint mission source[${index}].contractId`,
    );
    return {
      ...mission,
      offerKey: exactOfferKey(contractId, join),
    };
  });
}

export function attachOfferKeysToNormalizedMissions<T extends { missionId: string }>(
  values: T[],
  join: MissionBlueprintOfferJoin,
): Array<T & { offerKey?: string }> {
  if (!join.variantOfferKeys) return values;
  return values.map((mission) => ({
    ...mission,
    offerKey: exactOfferKey(mission.missionId, join),
  }));
}

export function assertRewardBearingContractOwnership(
  contractIds: Iterable<string>,
  join: MissionBlueprintOfferJoin,
): void {
  for (const contractId of contractIds) exactOfferKey(contractId, join);
}
