import { apiUrl } from "@/lib/apiUrl";
import { parseJsonResponse } from "@/lib/safeJson";

export type MissionPrerequisiteView = {
  type: "reputation" | "standing" | "rank" | "location" | "locality" | "crimeStat" | "unlock" | "unresolved";
  label: string;
  confidence: "resolved" | "unresolved" | "explicit" | "inferred";
  rawType?: string;
  raw?: Record<string, unknown>;
};

export type MissionRewardView = {
  summary: string[];
  blueprintRewards: string[];
  blueprintRewardGroups: BlueprintRewardGroupView[];
  reputationRewards: string[];
  credits: string;
  creditStatus: "extracted" | "unresolved" | "provenAbsent";
  unresolvedRewardTokens: string[];
};

export type MissionRewardedReputationPathView = {
  factionKey: string;
  factionDisplayName: string;
  scopeKey: string;
  scopeDisplayName: string;
  amount?: number;
  xp?: number;
  confidence: "resolved" | "partial" | "unresolved";
  sourceRefs: string[];
  unresolvedReason?: string;
};

export type BlueprintRewardGroupView = {
  poolGuid?: string;
  poolName: string;
  rewardCount: number;
  chanceLabel?: string;
  rewards: Array<{
    blueprintGuid?: string;
    displayName: string;
    componentType?: string;
    size?: string;
    grade?: string;
    chanceLabel?: string;
  }>;
};

export type MissionPickupLocationView = {
  status: "exact" | "generated_from_pool" | "system_scope" | "system_only" | "unknown" | "unresolved";
  displayName: string;
  system?: string;
  parentLocation?: string;
  locationType?: string;
  localityPool?: string;
  regions?: string[];
  specificPickup?: string | null;
  sourceRole: "availability" | "mission_giver" | "origin" | "locality_pool" | "system_scope" | "unknown";
  confidence: "high" | "medium" | "partial" | "low" | "unresolved";
  reason: string;
  sourceRefs: string[];
  possibleLocations: string[];
  unresolvedRefs: string[];
  technicalRefs: Array<{
    role: string;
    ref: string;
    resolvedName?: string;
    type?: string;
    path?: string;
    consideredPickup: boolean;
    reason: string;
  }>;
};

export type MissionReputationScopeView = {
  scopeKey: string;
  displayName: string;
  rawName?: string;
  factionKey: string;
  factionDisplayName: string;
  trackType: string;
  confidence: "resolved" | "partial" | "unresolved";
  sourceRefs: string[];
  unresolvedReason?: string;
};

export type MissionVariantView = {
  variantKey: string;
  familyKey: string;
  displayName: string;
  titleSource: MissionTitleSource;
  titleConfidence: MissionTitleConfidence;
  briefing?: string;
  rawName?: string;
  internalName?: string;
  missionType: string;
  provider: string;
  faction: string;
  contractType: string;
  reputationScope: MissionReputationScopeView;
  missionArchetype: string;
  standingRequirement: string;
  reputationRequirement?: string;
  prerequisiteSummary: string;
  prerequisites: MissionPrerequisiteView[];
  pickupLocation: MissionPickupLocationView;
  locations: string[];
  unresolvedLocationTokens: string[];
  rewards: MissionRewardView;
  rewardedReputationPaths: MissionRewardedReputationPathView[];
  flags: string[];
  releaseFlags: string[];
  lawfulClassification: "lawful" | "unlawful" | "unknown";
  lawfulConfidence: "explicit" | "inferred" | "unknown";
  crimeStatRequirement: "required" | "notRequired" | "bounded" | "unknown";
  confidence: {
    hasUnresolvedLocation: boolean;
    hasUnresolvedRewards: boolean;
    hasUnresolvedPrerequisites: boolean;
  };
  technical: {
    contractId: string;
    generatorGuid?: string;
    generatorName?: string;
    generatorPath?: string;
    handlerType?: string;
    titleRaw?: string;
    descriptionRaw?: string;
  };
};

export type MissionFamilyView = {
  familyKey: string;
  displayName: string;
  titleSource: MissionTitleSource;
  titleConfidence: MissionTitleConfidence;
  briefing?: string;
  rawName?: string;
  internalName?: string;
  provider: string;
  faction: string;
  missionType: string;
  reputationScope: MissionReputationScopeView;
  missionArchetype: string;
  variantCount: number;
  statusFlags: string[];
  releaseFlags: string[];
  rewardSummary: string[];
  blueprintRewards: string[];
  blueprintRewardGroups: BlueprintRewardGroupView[];
  reputationRewards: string[];
  rewardedReputationPaths: MissionRewardedReputationPathView[];
  creditRewardSummary: string;
  unresolvedRewardFields: string[];
  reputationRequirement?: string;
  prerequisiteRequirements: string[];
  pickupSummary: string;
  pickupStatuses: MissionPickupLocationView["status"][];
  pickupUnresolvedCount: number;
  crimeStatRequirement: "notRequired" | "required" | "bounded" | "unknown";
  lawfulClassification: "lawful" | "unlawful" | "unknown";
  lawfulConfidence: "explicit" | "inferred" | "unknown";
  locations: string[];
  unresolvedLocationTokens: string[];
  confidenceFlags: string[];
  unresolvedReferences: string[];
  variantKeys: string[];
  searchText: string;
};

export type MissionTitleSource =
  | "localized_family"
  | "localized_clean"
  | "shared_variant_localized"
  | "common_variant_title"
  | "token_template_cleaned"
  | "generated_from_fields"
  | "provider_archetype_fallback"
  | "internal_fallback";

export type MissionTitleConfidence = "high" | "medium" | "low";

export type MissionBrowserCatalog = {
  schemaVersion: 1;
  generatedAt: string;
  sourceLatestModifiedAt: string;
  sourceFiles: string[];
  summary: {
    familyCount: number;
    variantCount: number;
    unresolvedLocationCount: number;
    unresolvedRewardCount: number;
    explicitCrimeStatRequiredCount: number;
    pickupExactCount: number;
    pickupGeneratedFromPoolCount: number;
    pickupSystemScopeCount: number;
    pickupSystemOnlyCount: number;
    pickupUnknownCount: number;
    pickupUnresolvedCount: number;
    reputationScopeResolvedCount: number;
    reputationScopePartialCount: number;
    reputationScopeUnresolvedCount: number;
    factionGroupCount: number;
    reputationScopeGroupCount: number;
    archetypeGroupCount: number;
  };
  families: MissionFamilyView[];
  variants: MissionVariantView[];
  missionBrowseGroups: MissionBrowseGroupView[];
};

export type MissionBrowseGroupView = {
  factionKey: string;
  factionDisplayName: string;
  reputationScopes: Array<{
    scopeKey: string;
    displayName: string;
    confidence: MissionReputationScopeView["confidence"];
    trackType: string;
    missionArchetypes: Array<{
      archetypeKey: string;
      displayName: string;
      familyKeys: string[];
      missionCount: number;
      variantCount: number;
      standingSummary: string;
      unresolvedCount: number;
    }>;
  }>;
};

let missionDataPromise: Promise<MissionBrowserCatalog> | null = null;

export function loadMissionData(): Promise<MissionBrowserCatalog> {
  missionDataPromise ??= fetch(apiUrl("/api/missions/missions.json")).then(async (response) => {
    const data = await parseJsonResponse<MissionBrowserCatalog>(response, {
      label: "mission browser catalog",
      url: response.url,
    });
    if (!response.ok) throw new Error(`Mission browser catalog unavailable: ${response.status}`);
    return data;
  });
  return missionDataPromise;
}
