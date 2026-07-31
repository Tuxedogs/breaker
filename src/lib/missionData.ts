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
  creditStatus: "fixed" | "calculated" | "formula_unresolved" | "variable" | "provenAbsent" | "unresolved";
  creditsDetail?: {
    status: "fixed" | "calculated" | "formula_unresolved" | "variable" | "provenAbsent" | "unresolved";
    amount?: number;
    currency?: string;
    displayText?: string;
    confidence?: string;
    sourceResultType?: string;
    unresolvedReason?: string;
    attributes?: Record<string, unknown>;
    sourceRefs?: string[];
    payout?: {
      schemaVersion: number;
      modelVersion: string;
      calculationStatus: "resolved" | "unresolved";
      formulaStatus: string;
      currency: string;
      baseSoloAmount?: number;
      resultCount: number;
      aggregationStatus: string;
      resultLoopVerificationRequired: boolean;
      unresolvedReasons: string[];
      validationWarnings: string[];
    };
  };
  itemRewards?: Array<{
    status: "resolved" | "unresolved_entityClass" | "weighted_unresolved";
    entityClass?: string;
    amount?: number | string | null;
    displayName?: string;
    itemKey?: string;
    deliveryTarget?: "player_home_location" | "unknown";
    ownerOnly?: boolean;
    confidence?: string;
    unresolvedReason?: string;
    sourceRefs?: string[];
  }>;
  itemRewardStatus?: "resolved" | "unresolved_entityClass" | "weighted_unresolved" | "none";
  unresolvedRewardTokens: string[];
};

export type MissionRequiredItemEvidenceView = {
  evidenceId: string;
  missionVariableName?: string | null;
  requirementRole: "hauling_order" | "mission_item_selector" | string;
  roleStatus: string;
  requirementStatus: string;
  content: {
    type: "hauling_orders" | "mission_item_selector" | string;
    logic?: "all_of" | string;
    selectionBounds?: {
      minItemsToFind?: { raw: string; value?: number | null };
      maxItemsToFind?: { raw: string; value?: number | null };
    };
    entries?: Array<{
      ordinal: number;
      type: string;
      identity?: {
        status: string;
        guid?: string;
        recordName?: string;
        displayName?: string;
        path?: string;
        members?: Array<{
          guid?: string;
          recordName?: string;
          displayName?: string;
          path?: string;
        }>;
      };
      itemReference?: {
        status: string;
        reference?: { raw?: string; kind?: string; resolution?: string };
      };
      quantity?: {
        minAmount?: { raw: string; value?: number | null };
        maxAmount?: { raw: string; value?: number | null };
      };
    }>;
    conditions?: Array<{
      ordinal: number;
      type: string;
      items?: Array<{
        guid: string;
        resolution: string;
        recordName?: string;
        displayName?: string;
        entityClass?: {
          guid?: string;
          recordName?: string;
          displayName?: string;
          path?: string;
        };
      }>;
    }>;
  };
  provenance?: {
    sourceRef?: string;
    xmlPath?: string;
    sourceElement?: string;
  };
};

export type MissionRequiredItemsView = {
  status: "present" | "proven_absent" | "unresolved";
  evidence?: MissionRequiredItemEvidenceView[];
  haulingOrderCount: number;
  selectorCount: number;
};

export type MissionCanonicalView = {
  schemaVersion: 2;
  sourceSchemaVersion: 3;
  availability: {
    notForRelease: boolean;
    workInProgress: boolean;
  };
  financials: {
    buyIns: Array<{
      resultIndex: number;
      contractBuyInAmount: {
        raw: string;
        value?: number | null;
        applicationStatus: string;
        currency?: string | null;
        currencyStatus?: string;
      };
    }>;
  };
  provenance: {
    channel: string;
    buildId: string;
    sourceLatestModifiedAt: string;
    calculationInputsDigestSha256?: string;
  };
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
  missionChanceLabel?: string;
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
  rawLocalities?: Array<{
    guid: string;
    displayName: string;
    type?: string;
    path?: string;
    system?: string;
  }>;
  grouping?: {
    systems: string[];
    localityNames: string[];
    displayLabel: string;
    detailLabel: string;
    confidence: "exact" | "generated_from_pool" | "system_scope" | "partial" | "unknown" | "unresolved";
  };
};

export type MissionLocationRefView = {
  role: "pickup" | "destination" | "objective";
  rawType: string;
  attr: string;
  guidOrToken: string;
  resolvedName?: string;
  system?: string;
  confidence: "resolved" | "inferred" | "token_only" | "unresolved";
};

export type MissionLocationRolesView = {
  pickup: {
    status: MissionPickupLocationView["status"];
    displayName: string;
    displayLabel: string;
    detailDisplay: string;
    systems: string[];
    primarySystem?: string;
    confidence: MissionPickupLocationView["confidence"];
    sourceRole: MissionPickupLocationView["sourceRole"];
    sourceRefs: string[];
    unresolvedRefs: string[];
    unresolvedLocationTokens: string[];
    generatedFromPool: boolean;
    systemScope: boolean;
    rawLocalities: NonNullable<MissionPickupLocationView["rawLocalities"]>;
    grouping: NonNullable<MissionPickupLocationView["grouping"]>;
  };
  destination: {
    status: "unknown" | "unresolved";
    displayName: string;
    displayLabel: string;
    systems: string[];
    primarySystem?: string;
    confidence: "low" | "unresolved";
    sourceRefs: string[];
    unresolvedRefs: string[];
    sourceTextTokens: string[];
    unresolved: boolean;
  };
  objective: {
    status: "unknown" | "unresolved";
    displayName: string;
    displayLabel: string;
    systems: string[];
    primarySystem?: string;
    confidence: "low" | "unresolved";
    sourceRefs: string[];
    unresolvedRefs: string[];
    sourceTextTokens: string[];
    unresolved: boolean;
  };
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
  conceptKey?: string;
  tierKey?: string;
  tierLabel?: string;
  isIntro?: boolean;
  specificityBadges?: string[];
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
  locationRoles: MissionLocationRolesView;
  locationRefs: MissionLocationRefView[];
  locations: string[];
  unresolvedLocationTokens: string[];
  destinationTokens: string[];
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
  canonical?: MissionCanonicalView;
  requiredItems?: MissionRequiredItemsView;
  requiredItemSummary?: Pick<MissionRequiredItemsView, "status" | "haulingOrderCount" | "selectorCount">;
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
  creditRewardStatuses?: MissionRewardView["creditStatus"][];
  itemRewardStatus?: MissionRewardView["itemRewardStatus"];
  unresolvedRewardFields: string[];
  reputationRequirement?: string;
  prerequisiteRequirements: string[];
  pickupSummary: string;
  pickupStatuses: MissionPickupLocationView["status"][];
  pickupUnresolvedCount: number;
  locationRoles: MissionLocationRolesView;
  locationRefs: MissionLocationRefView[];
  crimeStatRequirement: "notRequired" | "required" | "bounded" | "unknown";
  lawfulClassification: "lawful" | "unlawful" | "unknown";
  lawfulConfidence: "explicit" | "inferred" | "unknown";
  locations: string[];
  unresolvedLocationTokens: string[];
  destinationTokens: string[];
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
  schemaVersion: 1 | 2;
  sourceContractVersion?: 3;
  generationId?: string;
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
  familiesByKey?: Record<string, MissionFamilyView>;
  conceptsByKey?: Record<string, MissionConceptView>;
  familyDetailFiles?: Record<string, string>;
  familyVariantFiles?: Record<string, string>;
  variantDetailFiles?: Record<string, string>;
  conceptFamilyVariantFiles?: Record<string, string[]>;
  unresolvedSummary?: {
    unresolvedLocationCount: number;
    unresolvedRewardCount: number;
    pickupUnknownCount: number;
    reputationScopePartialCount: number;
    reputationScopeUnresolvedCount: number;
  };
  report?: {
    extractionReport: string;
    unresolvedReport: string;
    conceptReport?: string;
    conceptCatalog?: string;
    categoryReport?: string;
  };
  filtersMeta?: MissionBrowserFiltersMeta;
  missionBrowseGroups: MissionBrowseGroupView[];
  browseViews?: MissionBrowseViews;
};

export type MissionBrowserFilterOption = {
  key: string;
  label: string;
  count: number;
  colorKey?: string;
};

export type MissionBrowserFiltersMeta = {
  factions: MissionBrowserFilterOption[];
  reputationScopes: MissionBrowserFilterOption[];
  archetypes: MissionBrowserFilterOption[];
  displayCategories?: MissionBrowserFilterOption[];
  rewardTypes: MissionBrowserFilterOption[];
  pickupSystems: MissionBrowserFilterOption[];
  confidenceStates: MissionBrowserFilterOption[];
  legalStates: MissionBrowserFilterOption[];
  missionTypes?: MissionBrowserFilterOption[];
  releaseStates?: MissionBrowserFilterOption[];
};

export type MissionBrowserFilters = {
  search?: string;
  faction?: string;
  provider?: string;
  type?: string;
  reward?: string;
  repReward?: string;
  status?: string;
  confidence?: string;
};

export type MissionBrowseGroupView = {
  factionKey: string;
  factionDisplayName: string;
  reputationScopes: Array<{
    scopeKey: string;
    displayName: string;
    confidence: MissionReputationScopeView["confidence"];
    trackType: string;
    conceptKeys?: string[];
    familyKeys?: string[];
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

export type MissionConceptView = {
  conceptKey: string;
  displayName: string;
  activityKey: string;
  displayCategory: {
    version: 1 | 2;
    key: string;
    label: string;
    confidence: "resolved" | "inferred" | "unresolved";
    source: "archetype" | "activity" | "combined" | "fallback";
    evidence: string[];
  };
  displaySubcategories: string[];
  factionKey: string;
  factionDisplayName: string;
  reputationScope: MissionReputationScopeView;
  familyKeys: string[];
  variantKeys: string[];
  variantCount: number;
  archetypes: string[];
  specificityBadges: string[];
  rewardedReputationPaths: MissionRewardedReputationPathView[];
  pickupCoverage: Array<{
    status: MissionPickupLocationView["status"];
    displayName: string;
    system?: string;
    localityPool?: string;
    variantCount: number;
  }>;
  tierSummaries: Array<{
    tierKey: string;
    tierLabel: string;
    variantCount: number;
  }>;
  groupingConfidence: "strong" | "partial" | "unresolved";
  groupingEvidence: string[];
  familyVariantFiles: string[];
  mixedRewardPaths: boolean;
};

export type MissionBrowseViews = {
  full: {
    categories: Array<{ categoryKey: string; displayName: string; conceptKeys: string[] }>;
  };
  factions: Array<{
    factionKey: string;
    factionDisplayName: string;
    categories: Array<{ categoryKey: string; displayName: string; conceptKeys: string[] }>;
  }>;
  reputation: MissionBrowseGroupView[];
};

export type MissionFamilyDetailPayload = {
  schemaVersion: 1 | 2;
  sourceContractVersion?: 3;
  generationId?: string;
  generatedAt: string;
  sourceLatestModifiedAt: string;
  family: MissionFamilyView;
  groupSummary: {
    familyKey: string;
    provider: string;
    reputationScope: MissionReputationScopeView;
    missionArchetype: string;
    variantCount: number;
  };
  rewardSummary: {
    rewardSummary: string[];
    blueprintRewards: string[];
    blueprintRewardGroups: BlueprintRewardGroupView[];
    reputationRewards: string[];
    rewardedReputationPaths: MissionRewardedReputationPathView[];
    creditRewardSummary: string;
  };
  pickupSummary: {
    pickupSummary: string;
    pickupStatuses: MissionPickupLocationView["status"][];
    pickupUnresolvedCount: number;
    locations: string[];
    unresolvedLocationTokens: string[];
  };
  blueprintSummary: {
    blueprintRewards: string[];
    blueprintRewardGroups: BlueprintRewardGroupView[];
  };
  variantKeys: string[];
  variantSummaries: Array<{
    variantKey: string;
    displayName: string;
    missionType: string;
    pickupLocation: Pick<MissionPickupLocationView, "status" | "displayName" | "confidence">;
    standingRequirement: string;
    creditStatus: MissionRewardView["creditStatus"];
    credits: string;
    hasBlueprintRewards: boolean;
    hasUnresolvedRewards: boolean;
  }>;
  variantsFile: string;
};

export type MissionFamilyVariantsPayload = {
  schemaVersion: 1 | 2;
  sourceContractVersion?: 3;
  generationId?: string;
  generatedAt: string;
  sourceLatestModifiedAt: string;
  familyKey: string;
  variants: MissionVariantView[];
};

export type MissionVariantDetailPayload = {
  schemaVersion: 1 | 2;
  sourceContractVersion?: 3;
  generationId?: string;
  generatedAt: string;
  sourceLatestModifiedAt: string;
  familyKey: string;
  variant: MissionVariantView;
};

export type PlayerMissionStateView = {
  completedContracts: {
    knowledge: "complete" | "partial";
    countsByContract: Record<string, number>;
  };
  completionTags: {
    knowledge: "complete" | "partial";
    countsByTag: Record<string, number>;
  };
  reputation: Array<{
    factionId: string;
    scopeId: string;
    status: "known" | "unknown";
    standingId?: string | null;
    reputationValue?: number | null;
  }>;
  crimeStat: { status: "known"; value: number } | { status: "unknown" };
  location: { status: "unknown" };
};

export type MissionEligibilityResultView = {
  variantId: string;
  status: "eligible" | "blocked" | "unavailable" | "unresolved" | "excluded";
  explanations: Array<{
    code: string;
    status: "satisfied" | "blocked" | "unresolved" | "excluded" | "unavailable" | "informational";
    prerequisiteType: string;
    message: string;
  }>;
  blockers: MissionEligibilityResultView["explanations"];
  unavailable: MissionEligibilityResultView["explanations"];
  unresolved: MissionEligibilityResultView["explanations"];
  exclusions: MissionEligibilityResultView["explanations"];
};

export type MissionEligibilityPayload = {
  schemaVersion: 1;
  generationId: string;
  result: MissionEligibilityResultView;
};

export type MissionPathStepView = {
  ordinal: number;
  variantId: string;
  eligibility: MissionEligibilityResultView;
  grantedCompletionTags: Record<string, number>;
  prerequisiteEdgeIds: string[];
  outcomeEdgeIds: string[];
  assumptions: string[];
};

export type MissionPathResultView = {
  generationId: string;
  goal: { type: "variant_eligibility"; variantId: string };
  costModel: {
    type: "mission_count";
    unit: "mission_completion";
  };
  status: "satisfied" | "path_found" | "blocked" | "unavailable" | "excluded" | "unresolved";
  minimumMissionCount: number | null;
  primaryPlan: { missionCount: number; steps: MissionPathStepView[] } | null;
  alternatePlans: Array<{ missionCount: number; steps: MissionPathStepView[] }>;
  alternatePlansTruncated: boolean;
  exploredStateCount: number;
  failures: Array<{
    code: string;
    message: string;
    eligibility?: MissionEligibilityResultView;
  }>;
  relevantCycles: Array<{ variantIds: string[] }>;
};

export type MissionPathPayload = {
  schemaVersion: 1;
  generationId: string;
  result: MissionPathResultView;
};

const missionDataPromises = new Map<string, Promise<MissionBrowserCatalog>>();
const familyDetailPromises = new Map<string, Promise<MissionFamilyDetailPayload>>();
const familyVariantPromises = new Map<string, Promise<MissionVariantView[]>>();
const variantDetailPromises = new Map<string, Promise<MissionVariantView>>();
const jsonPromises = new Map<string, Promise<unknown>>();

function fetchJson<T>(path: string, label: string): Promise<T> {
  const url = apiUrl(path);
  const cached = jsonPromises.get(url);
  if (cached) return cached as Promise<T>;

  const request = fetch(url)
    .then(async (response) => {
      const data = await parseJsonResponse<T>(response, {
        label,
        url: response.url,
      });
      if (!response.ok) throw new Error(`${label} unavailable: ${response.status}`);
      return data;
    })
    .catch((error: unknown) => {
      jsonPromises.delete(url);
      throw error;
    });
  jsonPromises.set(url, request);
  return request;
}

function toBrowserCatalog(data: MissionBrowserCatalog): MissionBrowserCatalog {
  if (data.familiesByKey && !data.families?.length) {
    return {
      ...data,
      families: Object.values(data.familiesByKey),
      variants: [],
    };
  }
  return {
    ...data,
    familiesByKey: data.familiesByKey ?? Object.fromEntries((data.families ?? []).map((family) => [family.familyKey, family])),
    variants: data.variants ?? [],
  };
}

function filterKey(filters: MissionBrowserFilters = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

function browserPath(filters: MissionBrowserFilters = {}): string {
  const key = filterKey(filters);
  return key ? `/api/missions/browser?${key}` : "/api/missions/browser";
}

function staticIndexPath(filters: MissionBrowserFilters = {}): string {
  const key = filterKey(filters);
  return key ? `/api/missions/mission_browser_index.json?${key}` : "/api/missions/mission_browser_index.json";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function rewardMatches(family: MissionFamilyView, reward: string): boolean {
  if (!reward) return true;
  if (reward === "blueprints") return family.blueprintRewards.length > 0;
  if (reward === "reputation") return family.reputationRewards.length > 0;
  if (reward === "credits-fixed") return family.creditRewardStatuses?.includes("fixed") ?? family.creditRewardSummary !== "No credit reward extracted";
  if (reward === "credits-calculated") return family.creditRewardStatuses?.includes("calculated") ?? family.creditRewardSummary === "Calculated payout";
  if (reward === "credits-variable") return family.creditRewardStatuses?.includes("variable") ?? family.creditRewardSummary === "Variable payout";
  if (reward === "credits-formula-unresolved") return family.creditRewardStatuses?.includes("formula_unresolved") ?? family.creditRewardSummary === "Credits formula unresolved";
  if (reward === "credits-unresolved") return family.creditRewardSummary === "Credits unresolved";
  if (reward === "credits-none") return family.creditRewardSummary === "No credit reward extracted";
  if (reward === "items") return family.itemRewardStatus === "resolved";
  if (reward === "items-unresolved") return family.itemRewardStatus === "unresolved_entityClass" || family.itemRewardStatus === "weighted_unresolved";
  return true;
}

function confidenceMatches(family: MissionFamilyView, confidence: string): boolean {
  if (!confidence) return true;
  if (confidence === "unresolved") return family.confidenceFlags.length > 0 || family.unresolvedReferences.length > 0;
  if (confidence === "locations") return family.unresolvedLocationTokens.length > 0;
  if (confidence === "rewards") return family.unresolvedRewardFields.length > 0 || (family.creditRewardStatuses?.includes("unresolved") ?? family.creditRewardSummary === "Credits unresolved");
  if (confidence === "crime-bounded") return family.crimeStatRequirement === "bounded";
  if (confidence === "unlawful") return family.lawfulClassification === "unlawful";
  return true;
}

function applyBrowserFilters(catalog: MissionBrowserCatalog, filters: MissionBrowserFilters): MissionBrowserCatalog {
  const query = filters.search?.trim().toLowerCase() ?? "";
  const visibleFamilies = catalog.families.filter((family) => {
    const faction = filters.faction ?? filters.provider;
    if (query && !family.searchText.includes(query)) return false;
    if (faction && family.provider !== faction) return false;
    if (filters.type && family.missionType !== filters.type) return false;
    if (filters.repReward && !family.rewardedReputationPaths.some((path) => path.scopeDisplayName === filters.repReward)) return false;
    if (filters.status && !family.releaseFlags.includes(filters.status)) return false;
    if (!rewardMatches(family, filters.reward ?? "")) return false;
    if (!confidenceMatches(family, filters.confidence ?? "")) return false;
    return true;
  });
  const visibleFamilyKeys = new Set(visibleFamilies.map((family) => family.familyKey));
  const visibleConceptKeys = new Set(
    Object.values(catalog.conceptsByKey ?? {})
      .filter((concept) => concept.familyKeys.some((familyKey) => visibleFamilyKeys.has(familyKey)))
      .map((concept) => concept.conceptKey)
  );
  const missionBrowseGroups = catalog.missionBrowseGroups
    .map((group) => ({
      ...group,
      reputationScopes: group.reputationScopes
        .map((scope) => ({
          ...scope,
          conceptKeys: scope.conceptKeys?.filter((conceptKey) => visibleConceptKeys.has(conceptKey)),
          familyKeys: scope.familyKeys?.filter((familyKey) => visibleFamilyKeys.has(familyKey)),
          missionArchetypes: scope.missionArchetypes
            .map((archetype) => ({
              ...archetype,
              familyKeys: archetype.familyKeys.filter((familyKey) => visibleFamilyKeys.has(familyKey)),
            }))
            .filter((archetype) => archetype.familyKeys.length > 0),
        }))
        .filter((scope) => scope.missionArchetypes.length > 0),
    }))
    .filter((group) => group.reputationScopes.length > 0);
  const browseViews = catalog.browseViews ? {
    full: {
      categories: catalog.browseViews.full.categories
        .map((category) => ({ ...category, conceptKeys: category.conceptKeys.filter((conceptKey) => visibleConceptKeys.has(conceptKey)) }))
        .filter((category) => category.conceptKeys.length > 0),
    },
    factions: catalog.browseViews.factions
      .map((faction) => ({
        ...faction,
        categories: faction.categories
          .map((category) => ({ ...category, conceptKeys: category.conceptKeys.filter((conceptKey) => visibleConceptKeys.has(conceptKey)) }))
          .filter((category) => category.conceptKeys.length > 0),
      }))
      .filter((faction) => faction.categories.length > 0),
    reputation: missionBrowseGroups,
  } : undefined;
  const referencedFamilyKeys = new Set(
    missionBrowseGroups.flatMap((group) =>
      group.reputationScopes.flatMap((scope) => scope.missionArchetypes.flatMap((archetype) => archetype.familyKeys))
    )
  );
  const families = visibleFamilies.filter((family) => referencedFamilyKeys.has(family.familyKey));
  return {
    ...catalog,
    families,
    familiesByKey: Object.fromEntries(families.map((family) => [family.familyKey, family])),
    conceptsByKey: catalog.conceptsByKey
      ? Object.fromEntries(Array.from(visibleConceptKeys).map((conceptKey) => [conceptKey, catalog.conceptsByKey?.[conceptKey]]).filter((entry): entry is [string, MissionConceptView] => Boolean(entry[1])))
      : undefined,
    conceptFamilyVariantFiles: catalog.conceptFamilyVariantFiles
      ? Object.fromEntries(Array.from(visibleConceptKeys).map((conceptKey) => [conceptKey, catalog.conceptFamilyVariantFiles?.[conceptKey]]).filter((entry): entry is [string, string[]] => Boolean(entry[1])))
      : undefined,
    missionBrowseGroups,
    browseViews,
  };
}

export function loadMissionData(filters: MissionBrowserFilters = {}): Promise<MissionBrowserCatalog> {
  const key = filterKey(filters);
  if (!missionDataPromises.has(key)) {
    const dynamicPath = browserPath(filters);
    const staticPath = staticIndexPath(filters);
    const request = fetchJson<MissionBrowserCatalog>(dynamicPath, "mission browser index")
        .then(toBrowserCatalog)
        .catch((dynamicError: unknown) =>
          fetchJson<MissionBrowserCatalog>(staticPath, "mission browser index")
            .then(toBrowserCatalog)
            .then((catalog) => applyBrowserFilters(catalog, filters))
            .catch((staticError: unknown) => {
              throw new Error(`Mission browser shaped data unavailable. ${dynamicPath}: ${errorMessage(dynamicError)}; ${staticPath}: ${errorMessage(staticError)}`);
            })
        )
        .catch((error: unknown) => {
          missionDataPromises.delete(key);
          throw error;
        });
    missionDataPromises.set(key, request);
  }
  return missionDataPromises.get(key)!;
}

export async function loadMissionFamilyDetail(familyKey: string): Promise<MissionFamilyDetailPayload> {
  const catalog = await loadMissionData();
  const file = catalog.familyDetailFiles?.[familyKey];
  if (!file) throw new Error(`Mission family detail unavailable for ${familyKey}`);
  if (!familyDetailPromises.has(familyKey)) {
    familyDetailPromises.set(
      familyKey,
      fetchJson<MissionFamilyDetailPayload>(`/api/missions/family/${encodeURIComponent(familyKey)}`, "mission family detail")
        .catch(() => fetchJson<MissionFamilyDetailPayload>(`/api/missions/${file}`, "mission family detail")),
    );
  }
  return familyDetailPromises.get(familyKey)!;
}

export async function loadMissionFamilyVariants(familyKey: string): Promise<MissionVariantView[]> {
  const catalog = await loadMissionData();
  const file = catalog.familyVariantFiles?.[familyKey];
  if (!file) {
    const fallback = catalog.variants.filter((variant) => variant.familyKey === familyKey);
    if (fallback.length) return fallback;
    throw new Error(`Mission family variants unavailable for ${familyKey}`);
  }
  if (!familyVariantPromises.has(familyKey)) {
    familyVariantPromises.set(
      familyKey,
      fetchJson<MissionFamilyVariantsPayload>(`/api/missions/family/${encodeURIComponent(familyKey)}/variants`, "mission family variants")
        .catch(() => fetchJson<MissionFamilyVariantsPayload>(`/api/missions/${file}`, "mission family variants"))
        .then((payload) => payload.variants),
    );
  }
  return familyVariantPromises.get(familyKey)!;
}

export async function loadMissionConceptVariants(concept: MissionConceptView): Promise<MissionVariantView[]> {
  const variants = (await Promise.all(concept.familyKeys.map((familyKey) => loadMissionFamilyVariants(familyKey))))
    .flat()
    .filter((variant) => variant.conceptKey === concept.conceptKey);
  return Array.from(new Map(variants.map((variant) => [variant.variantKey, variant])).values());
}

export async function loadMissionVariantDetail(variantKey: string): Promise<MissionVariantView> {
  const catalog = await loadMissionData();
  const file = catalog.variantDetailFiles?.[variantKey];
  if (!file) {
    const fallback = catalog.variants.find((variant) => variant.variantKey === variantKey);
    if (fallback) return fallback;
    throw new Error(`Mission variant detail unavailable for ${variantKey}`);
  }
  if (!variantDetailPromises.has(variantKey)) {
    variantDetailPromises.set(
      variantKey,
      fetchJson<MissionVariantDetailPayload>(`/api/missions/variant/${encodeURIComponent(variantKey)}`, "mission variant detail")
        .catch(() => fetchJson<MissionVariantDetailPayload>(`/api/missions/${file}`, "mission variant detail"))
        .then((payload) => payload.variant),
    );
  }
  return variantDetailPromises.get(variantKey)!;
}

export async function evaluateMissionVariantEligibility(
  variantKey: string,
  playerState: PlayerMissionStateView,
): Promise<MissionEligibilityPayload> {
  const url = apiUrl(`/api/missions/variant/${encodeURIComponent(variantKey)}/eligibility`);
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerState }),
  });
  const data = await parseJsonResponse<MissionEligibilityPayload | { error?: string }>(response, {
    label: "mission eligibility",
    url: response.url,
  });
  if (!response.ok) {
    const message = "error" in data && data.error ? data.error : `mission eligibility unavailable: ${response.status}`;
    throw new Error(message);
  }
  return data as MissionEligibilityPayload;
}

export async function solveMissionVariantPrerequisitePath(
  variantKey: string,
  playerState: PlayerMissionStateView,
): Promise<MissionPathPayload> {
  const url = apiUrl(`/api/missions/variant/${encodeURIComponent(variantKey)}/prerequisite-path`);
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerState }),
  });
  const data = await parseJsonResponse<MissionPathPayload | { error?: string }>(response, {
    label: "mission prerequisite path",
    url: response.url,
  });
  if (!response.ok) {
    const message = "error" in data && data.error ? data.error : `mission prerequisite path unavailable: ${response.status}`;
    throw new Error(message);
  }
  return data as MissionPathPayload;
}
