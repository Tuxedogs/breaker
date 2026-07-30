import { createHash } from "node:crypto";

export type MissionShardPathsV2 = {
  familyDetailFiles: Record<string, string>;
  familyVariantFiles: Record<string, string>;
  variantDetailFiles: Record<string, string>;
};

export type CompactMissionVariant<T extends {
  canonical: unknown;
  requiredItems: {
    status: unknown;
    haulingOrderCount: number;
    selectorCount: number;
  };
}> = Omit<T, "canonical" | "requiredItems"> & {
  requiredItemSummary: {
    status: T["requiredItems"]["status"];
    haulingOrderCount: number;
    selectorCount: number;
  };
};

export function missionPayloadFileName(key: string): string {
  return `${createHash("sha256").update(key).digest("hex").slice(0, 16)}.json`;
}

export function buildMissionShardPathsV2(
  familyKeys: string[],
  variantKeys: string[],
): MissionShardPathsV2 {
  const familyDetailFiles = Object.fromEntries(
    familyKeys.map((familyKey) => [familyKey, `families/${missionPayloadFileName(familyKey)}`]),
  );
  const familyVariantFiles = Object.fromEntries(
    familyKeys.map((familyKey) => [familyKey, `family-variants/${missionPayloadFileName(familyKey)}`]),
  );
  const variantDetailFiles = Object.fromEntries(
    variantKeys.map((variantKey) => [variantKey, `variants/${missionPayloadFileName(variantKey)}`]),
  );
  const allFiles = [
    ...Object.values(familyDetailFiles),
    ...Object.values(familyVariantFiles),
    ...Object.values(variantDetailFiles),
  ];
  if (new Set(allFiles).size !== allFiles.length) {
    throw new Error("Mission shard filename collision detected.");
  }
  return { familyDetailFiles, familyVariantFiles, variantDetailFiles };
}

export function projectCompactMissionVariantV2<T extends {
  canonical: unknown;
  requiredItems: {
    status: unknown;
    haulingOrderCount: number;
    selectorCount: number;
  };
}>(variant: T): CompactMissionVariant<T> {
  const { canonical, requiredItems, ...browserFields } = variant;
  void canonical;
  return {
    ...browserFields,
    requiredItemSummary: {
      status: requiredItems.status,
      haulingOrderCount: requiredItems.haulingOrderCount,
      selectorCount: requiredItems.selectorCount,
    },
  };
}
