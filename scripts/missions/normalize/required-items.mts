import type {
  MissionPropertyOverridesV3,
  MissionRequiredItemEvidenceV3,
  MissionSourceRecordV3,
} from "../schema/source-v3.mts";

export type CanonicalRequiredItemsV2 = {
  status: "present" | "proven_absent";
  evidence: MissionRequiredItemEvidenceV3[];
  propertyOverrides: MissionPropertyOverridesV3 | null;
  haulingOrderCount: number;
  selectorCount: number;
};

export function normalizeRequiredItemsV2(record: MissionSourceRecordV3): CanonicalRequiredItemsV2 {
  const evidence = record.requiredItemEvidence ?? [];
  return {
    status: evidence.length ? "present" : "proven_absent",
    evidence,
    propertyOverrides: record.propertyOverrides ?? null,
    haulingOrderCount: evidence.filter((item) => item.requirementRole === "hauling_order").length,
    selectorCount: evidence.filter((item) => item.requirementRole !== "hauling_order").length,
  };
}
