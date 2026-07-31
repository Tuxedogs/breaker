import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

import { buildMissionGraphValidationV2 } from "./missions/graph/mission-graph.mts";
import { normalizeRequiredItemsV2, type CanonicalRequiredItemsV2 } from "./missions/normalize/required-items.mts";
import { projectBrowserCreditV2 } from "./missions/normalize/rewards.mts";
import {
  buildMissionShardPathsV2,
  missionPayloadFileName,
  projectCompactMissionVariantV2,
  type CompactMissionVariant,
} from "./missions/project/browser-projection.mts";
import { publishImmutableMissionGeneration } from "./missions/publication/write-artifacts.mts";
import { buildMissionGraphArtifactsV2 } from "./missions/report/graph-report.mts";
import {
  MISSION_SHAPED_SCHEMA_VERSION,
  normalizeCanonicalMissionVariantV2,
  type CanonicalMissionVariantV2,
} from "./missions/schema/canonical-v2.mts";
import {
  parseMissionSourceCatalogV3,
  type MissionSourceCatalogV3,
  type MissionSourceRecordV3,
} from "./missions/schema/source-v3.mts";

type RawStanding = {
  displayName?: string;
  minReputation?: number;
};

type RawPrerequisite = {
  type?: string;
  attributes?: Record<string, unknown>;
  resolved?: Record<string, unknown>;
  references?: string[];
};

type RefIndexEntry = {
  guid?: string;
  recordName?: string;
  type?: string;
  path?: string;
};

type RawReward = {
  type?: string;
  chance?: number;
  blueprintPoolGuid?: string;
  factionReputation?: string;
  reputationScope?: string;
  rewardGuid?: string;
  reputationAmount?: number;
  xp?: number;
  reward?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  fixedReward?: {
    reward?: number | string | null;
    max?: number | string | null;
    plusBonuses?: number | string | null;
    currencyType?: string | null;
  };
  resolved?: {
    guid?: string;
    recordName?: string;
    displayName?: string;
    path?: string;
  };
  items?: Array<{
    entityClass?: string | null;
    weight?: number | string | null;
    resolved?: {
      guid?: string;
      recordName?: string;
      displayName?: string;
      path?: string;
    };
  }>;
  references?: string[];
  sourceRefs?: string[];
};

type RawMission = MissionSourceRecordV3 & {
  contractId: string;
  familyId?: string;
  template?: string;
  contractType?: string;
  debugName?: string;
  title?: string;
  titleRaw?: string;
  stringParams?: Record<string, { raw?: string; text?: string | null }>;
  description?: string;
  descriptionRaw?: string;
  generatorGuid?: string;
  generatorName?: string;
  generatorPath?: string;
  handlerDebugName?: string;
  handlerType?: string;
  notForRelease?: boolean | string;
  workInProgress?: boolean | string;
  missionType?: string;
  factionReputationGuid?: string | null;
  reputationScopeGuid?: string | null;
  factionName?: string;
  minStanding?: RawStanding;
  maxStanding?: RawStanding;
  prerequisites?: RawPrerequisite[];
  blueprintRewards?: RawReward[];
  reputationRewards?: RawReward[];
  creditRewardTypes?: RawReward[];
  itemRewards?: RawReward[];
  weightedItemRewards?: RawReward[];
  completionTags?: RawReward[];
  classifications?: {
    tutorial?: boolean;
    event?: boolean;
  };
};

type RawCatalog = {
  schemaVersion: 3;
  generatedAt: string;
  sourceLatestModifiedAt: string;
  records: RawMission[];
} & MissionSourceCatalogV3;

type BlueprintPoolLookup = {
  poolGuid?: string;
  displayName?: string;
  poolName?: string;
  rewards?: Array<{
    blueprintGuid?: string;
    displayName?: string;
    componentType?: string;
    blueprintName?: string;
    size?: string;
    grade?: string;
    weight?: number;
    poolChance?: number;
  }>;
};

type CraftingBlueprintLookup = {
  id: string;
  name?: string;
  type?: string;
  typeLabel?: string;
  size?: number | string | null;
  grade?: number | string | null;
};

type Lookups = {
  blueprintPools?: BlueprintPoolLookup[];
  standings?: Array<{
    guid?: string;
    recordName?: string;
    displayName?: string;
    minReputation?: number;
    path?: string;
  }>;
};

type ShapedPrerequisite = {
  type: "reputation" | "standing" | "rank" | "location" | "locality" | "crimeStat" | "unlock" | "unresolved";
  label: string;
  confidence: "resolved" | "unresolved" | "explicit" | "inferred";
  rawType?: string;
  raw?: Record<string, unknown>;
};

type PickupLocation = {
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

type LocationRoleStatus = "exact" | "generated_from_pool" | "system_scope" | "partial" | "unknown" | "unresolved";

type LocationRefRole = "pickup" | "destination" | "objective";

type LocationRef = {
  role: LocationRefRole;
  rawType: string;
  attr: string;
  guidOrToken: string;
  resolvedName?: string;
  system?: string;
  confidence: "resolved" | "inferred" | "token_only" | "unresolved";
};

type PickupLocationRole = {
  status: PickupLocation["status"];
  displayName: string;
  displayLabel: string;
  detailDisplay: string;
  systems: string[];
  primarySystem?: string;
  confidence: PickupLocation["confidence"];
  sourceRole: PickupLocation["sourceRole"];
  sourceRefs: string[];
  unresolvedRefs: string[];
  unresolvedLocationTokens: string[];
  generatedFromPool: boolean;
  systemScope: boolean;
  rawLocalities: NonNullable<PickupLocation["rawLocalities"]>;
  grouping: NonNullable<PickupLocation["grouping"]>;
};

type UnresolvedLocationRole = {
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

type MissionLocationRoles = {
  pickup: PickupLocationRole;
  destination: UnresolvedLocationRole;
  objective: UnresolvedLocationRole;
};

type ReputationScope = {
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

type CreditRewardDetail =
  | {
    status: "fixed";
    amount: number;
    currency: string;
    max?: number | string | null;
    plusBonuses?: number | string | null;
    confidence: "extracted_fixed";
    sourceResultType: "ContractResult_Reward";
    sourceRefs: string[];
  }
  | {
    status: "calculated" | "formula_unresolved" | "variable";
    displayText: string;
    amount?: number;
    currency?: string;
    confidence: "source_calculated" | "calculated_unresolved";
    sourceResultType: "ContractResult_CalculatedReward";
    unresolvedReason?: string;
    attributes?: Record<string, unknown>;
    sourceRefs: string[];
    payout?: MissionSourceRecordV3["calculatedPayout"];
  }
  | {
    status: "provenAbsent";
    displayText: "No credit reward extracted";
    confidence: "proven_absent";
    sourceRefs: string[];
  }
  | {
    status: "unresolved";
    displayText: "Credits unresolved";
    confidence: "unresolved";
    sourceResultType?: string;
    unresolvedReason: string;
    attributes?: Record<string, unknown>;
    sourceRefs: string[];
  };

type ItemRewardDetail = {
  status: "resolved" | "unresolved_entityClass" | "weighted_unresolved";
  entityClass?: string;
  amount?: number | string | null;
  displayName?: string;
  itemKey?: string;
  deliveryTarget?: "player_home_location" | "unknown";
  ownerOnly?: boolean;
  confidence: "resolved_entityClass" | "unresolved_entityClass" | "weighted_unresolved";
  unresolvedReason?: string;
  sourceRefs: string[];
  weightedOptions?: Array<{
    entityClass?: string | null;
    weight?: number | string | null;
    displayName?: string;
    itemKey?: string;
  }>;
};

type ShapedVariant = {
  variantKey: string;
  familyKey: string;
  conceptKey: string;
  objectiveSignature: {
    key: string;
    activityKey: string;
    titleStem?: string;
    descriptionStem?: string;
    handlerStem?: string;
    offerTitleIdentity?: string;
    archetype: string;
    contractType: string;
    introState: "intro" | "standard";
    chainState: string;
    legalState: string;
    confidence: "strong" | "partial" | "unresolved";
    evidence: string[];
  };
  tierKey: string;
  tierLabel: string;
  isIntro: boolean;
  specificityBadges: string[];
  owningScopeProvenance: {
    scopeKey: string;
    confidence: ReputationScope["confidence"];
    sourceRefs: string[];
    unresolvedReason?: string;
  };
  displayName: string;
  titleSource: "localized_family" | "localized_clean" | "shared_variant_localized" | "common_variant_title" | "token_template_cleaned" | "generated_from_fields" | "provider_archetype_fallback" | "internal_fallback";
  titleConfidence: "high" | "medium" | "low";
  briefing?: string;
  rawName?: string;
  internalName?: string;
  missionType: string;
  provider: string;
  faction: string;
  contractType: string;
  reputationScope: ReputationScope;
  missionArchetype: string;
  standingRequirement: string;
  reputationRequirement?: string;
  prerequisiteSummary: string;
  prerequisites: ShapedPrerequisite[];
  pickupLocation: PickupLocation;
  locationRoles: MissionLocationRoles;
  locationRefs: LocationRef[];
  locations: string[];
  unresolvedLocationTokens: string[];
  destinationTokens: string[];
  rewards: {
    summary: string[];
    blueprintRewards: string[];
    blueprintRewardGroups: BlueprintRewardGroup[];
    reputationRewards: string[];
    credits: string;
    creditStatus: "fixed" | "calculated" | "formula_unresolved" | "variable" | "provenAbsent" | "unresolved";
    creditsDetail: CreditRewardDetail;
    itemRewards: ItemRewardDetail[];
    itemRewardStatus: "resolved" | "unresolved_entityClass" | "weighted_unresolved" | "none";
    unresolvedRewardTokens: string[];
  };
  rewardedReputationPaths: RewardedReputationPath[];
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
  canonical: CanonicalMissionVariantV2;
  requiredItems: CanonicalRequiredItemsV2;
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

type ShapedFamily = {
  familyKey: string;
  displayName: string;
  titleSource: "localized_family" | "localized_clean" | "shared_variant_localized" | "common_variant_title" | "token_template_cleaned" | "generated_from_fields" | "provider_archetype_fallback" | "internal_fallback";
  titleConfidence: "high" | "medium" | "low";
  briefing?: string;
  rawName?: string;
  internalName?: string;
  provider: string;
  faction: string;
  missionType: string;
  reputationScope: ReputationScope;
  missionArchetype: string;
  variantCount: number;
  statusFlags: string[];
  releaseFlags: string[];
  rewardSummary: string[];
  blueprintRewards: string[];
  blueprintRewardGroups: BlueprintRewardGroup[];
  reputationRewards: string[];
  rewardedReputationPaths: RewardedReputationPath[];
  creditRewardSummary: string;
  creditRewardStatuses: ShapedVariant["rewards"]["creditStatus"][];
  itemRewardStatus: ShapedVariant["rewards"]["itemRewardStatus"];
  unresolvedRewardFields: string[];
  reputationRequirement?: string;
  prerequisiteRequirements: string[];
  pickupSummary: string;
  pickupStatuses: PickupLocation["status"][];
  pickupUnresolvedCount: number;
  locationRoles: MissionLocationRoles;
  locationRefs: LocationRef[];
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

type MissionBrowseGroup = {
  factionKey: string;
  factionDisplayName: string;
  reputationScopes: Array<{
    scopeKey: string;
    displayName: string;
    confidence: ReputationScope["confidence"];
    trackType: string;
    conceptKeys: string[];
    familyKeys: string[];
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

type MissionConcept = {
  conceptKey: string;
  displayName: string;
  activityKey: string;
  displayCategory: DisplayCategory;
  displaySubcategories: string[];
  factionKey: string;
  factionDisplayName: string;
  reputationScope: ReputationScope;
  familyKeys: string[];
  variantKeys: string[];
  variantCount: number;
  archetypes: string[];
  specificityBadges: string[];
  rewardedReputationPaths: RewardedReputationPath[];
  pickupCoverage: Array<{
    status: PickupLocation["status"];
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

type DisplayCategory = {
  version: 1 | 2;
  key: string;
  label: string;
  confidence: "resolved" | "inferred" | "unresolved";
  source: "archetype" | "activity" | "combined" | "fallback";
  evidence: string[];
};

type ConceptCategoryProjection = {
  categoryKey: string;
  displayName: string;
  conceptKeys: string[];
};

type MissionBrowseViews = {
  full: {
    categories: ConceptCategoryProjection[];
  };
  factions: Array<{
    factionKey: string;
    factionDisplayName: string;
    categories: ConceptCategoryProjection[];
  }>;
  reputation: MissionBrowseGroup[];
};

type RewardedReputationPath = {
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

type BlueprintRewardGroup = {
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

type ShapedCatalog = {
  schemaVersion: typeof MISSION_SHAPED_SCHEMA_VERSION;
  sourceContractVersion: 3;
  generationId: string;
  generatedAt: string;
  sourceLatestModifiedAt: string;
  sourceFiles: string[];
  sourceInputs: {
    refIndex: {
      status: "explicit" | "not_configured";
      path?: string;
      sha256?: string;
    };
  };
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
    conceptCount: number;
  };
  families: ShapedFamily[];
  variants: ShapedVariant[];
  missionBrowseGroups: MissionBrowseGroup[];
  browseViews: MissionBrowseViews;
  concepts: MissionConcept[];
};

type MissionBrowserIndex = {
  schemaVersion: typeof MISSION_SHAPED_SCHEMA_VERSION;
  sourceContractVersion: 3;
  generationId: string;
  generatedAt: string;
  sourceLatestModifiedAt: string;
  sourceFiles: string[];
  sourceInputs: ShapedCatalog["sourceInputs"];
  summary: ShapedCatalog["summary"];
  unresolvedSummary: {
    unresolvedLocationCount: number;
    unresolvedRewardCount: number;
    pickupUnknownCount: number;
    reputationScopePartialCount: number;
    reputationScopeUnresolvedCount: number;
  };
  report: {
    extractionReport: string;
    unresolvedReport: string;
    conceptReport: string;
    conceptCatalog: string;
    categoryReport: string;
    graphReport: string;
  };
  filtersMeta: MissionBrowserFiltersMeta;
  familiesByKey: Record<string, ShapedFamily>;
  conceptsByKey: Record<string, MissionConcept>;
  familyDetailFiles: Record<string, string>;
  familyVariantFiles: Record<string, string>;
  variantDetailFiles: Record<string, string>;
  conceptFamilyVariantFiles: Record<string, string[]>;
  missionBrowseGroups: MissionBrowseGroup[];
  browseViews: MissionBrowseViews;
};

type MissionBrowserFilterOption = {
  key: string;
  label: string;
  count: number;
  colorKey?: string;
};

type MissionBrowserFiltersMeta = {
  factions: MissionBrowserFilterOption[];
  reputationScopes: MissionBrowserFilterOption[];
  archetypes: MissionBrowserFilterOption[];
  displayCategories: MissionBrowserFilterOption[];
  rewardTypes: MissionBrowserFilterOption[];
  pickupSystems: MissionBrowserFilterOption[];
  confidenceStates: MissionBrowserFilterOption[];
  legalStates: MissionBrowserFilterOption[];
  missionTypes: MissionBrowserFilterOption[];
  releaseStates: MissionBrowserFilterOption[];
};

type MissionFamilyDetailPayload = {
  schemaVersion: typeof MISSION_SHAPED_SCHEMA_VERSION;
  sourceContractVersion: 3;
  generationId: string;
  generatedAt: string;
  sourceLatestModifiedAt: string;
  family: ShapedFamily;
  groupSummary: {
    familyKey: string;
    provider: string;
    reputationScope: ReputationScope;
    missionArchetype: string;
    variantCount: number;
  };
  rewardSummary: {
    rewardSummary: string[];
    blueprintRewards: string[];
    blueprintRewardGroups: BlueprintRewardGroup[];
    reputationRewards: string[];
    rewardedReputationPaths: RewardedReputationPath[];
    creditRewardSummary: string;
  };
  pickupSummary: {
    pickupSummary: string;
    pickupStatuses: PickupLocation["status"][];
    pickupUnresolvedCount: number;
    locations: string[];
    unresolvedLocationTokens: string[];
  };
  blueprintSummary: {
    blueprintRewards: string[];
    blueprintRewardGroups: BlueprintRewardGroup[];
  };
  variantKeys: string[];
  variantSummaries: Array<{
    variantKey: string;
    displayName: string;
    missionType: string;
    pickupLocation: Pick<PickupLocation, "status" | "displayName" | "confidence">;
    standingRequirement: string;
    creditStatus: ShapedVariant["rewards"]["creditStatus"];
    credits: string;
    hasBlueprintRewards: boolean;
    hasUnresolvedRewards: boolean;
  }>;
  variantsFile: string;
};

type MissionFamilyVariantsPayload = {
  schemaVersion: typeof MISSION_SHAPED_SCHEMA_VERSION;
  sourceContractVersion: 3;
  generationId: string;
  generatedAt: string;
  sourceLatestModifiedAt: string;
  familyKey: string;
  variants: Array<CompactMissionVariant<ShapedVariant>>;
};

type MissionVariantDetailPayload = {
  schemaVersion: typeof MISSION_SHAPED_SCHEMA_VERSION;
  sourceContractVersion: 3;
  generationId: string;
  generatedAt: string;
  sourceLatestModifiedAt: string;
  familyKey: string;
  variant: ShapedVariant;
};

type MissionShardManifest = {
  schemaVersion: typeof MISSION_SHAPED_SCHEMA_VERSION;
  sourceContractVersion: 3;
  generationId: string;
  generatedAt: string;
  sourceLatestModifiedAt: string;
  familyFilesByFamilyId: Record<string, {
    familyKey: string;
    detailFile: string;
    variantsFile: string;
  }>;
  variantFilesByMissionId: Record<string, {
    missionId: string;
    variantId: string;
    familyId: string;
    familyKey: string;
    detailFile: string;
    familyDetailFile: string;
    familyVariantsFile: string;
  }>;
  variantFilesByVariantId: Record<string, {
    missionId: string;
    variantId: string;
    familyId: string;
    familyKey: string;
    detailFile: string;
    familyDetailFile: string;
    familyVariantsFile: string;
  }>;
};

const serverMissionSourceRoot = path.resolve(
  process.env.MISSION_SOURCE_ROOT ?? path.join("server-data", "missions", "source"),
);
const missionRoot = path.resolve(process.env.MISSION_DATA_ROOT ?? path.join("server-data", "missions"));
const maxMissionOutputBytes = 50 * 1024 * 1024;
const legacyMissionOutputFiles = ["mission_locations.json", "mission_variants.json"] as const;
const legacyShapedRootFiles = [
  "mission_browser_extraction_report.json",
  "mission_browser_index.json",
  "mission_browse_groups.json",
  "mission_category_projection_report.json",
  "mission_concepts.json",
  "mission_concept_shaping_report.json",
  "mission_families.json",
  "mission_prerequisites.json",
  "mission_reputation.json",
  "mission_rewards.json",
  "mission_shard_manifest.json",
  "mission_unresolved_refs.json",
  ...legacyMissionOutputFiles,
] as const;
const legacyShardDirectories = ["families", "family-variants", "variants"] as const;
const missionShaperVersion = "moonbreaker_mission_shaper_v2_6";
async function resolveMissionSourceRoot(): Promise<string> {
  try {
    await readFile(path.join(serverMissionSourceRoot, "mission_contracts.json"), "utf8");
    return serverMissionSourceRoot;
  } catch {
    throw new Error(
      `Mission source inputs are missing. Expected mission_contracts.json in ${serverMissionSourceRoot}.`,
    );
  }
}

const sourceMissionRoot = await resolveMissionSourceRoot();
const contractsPath = path.join(sourceMissionRoot, "mission_contracts.json");
const lookupsPath = path.join(sourceMissionRoot, "mission_reward_lookups.json");
const craftingBlueprintsPath = path.resolve(
  process.env.MISSION_CRAFTING_BLUEPRINTS
    ?? path.join("server-data", "crafting", "component-cards", "browse.json"),
);
const refIndexPath = process.env.MISSION_REF_INDEX
  ? path.resolve(process.env.MISSION_REF_INDEX)
  : undefined;

function truthy(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function clean(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = String(value).trim();
  if (!text || /^(undefined|null|nan)$/i.test(text)) return undefined;
  return text;
}

function guidValue(value: unknown): string | undefined {
  const text = clean(value);
  return text && /^[0-9a-f-]{36}$/i.test(text) ? text.toLowerCase() : undefined;
}

function readableName(value?: string): string {
  if (!value) return "Unknown mission";
  return value
    .replace(/^ContractGenerator\./, "")
    .replace(/^ContractPrerequisite_/, "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function displayNameFromRef(entry?: RefIndexEntry): string | undefined {
  const raw = clean(entry?.recordName)?.replace(/^(StarMapObject|MissionLocality|Location|SReputationScopeParams)\./, "");
  if (!raw) return undefined;
  return raw
    .replace(/^ReputationScope_/, "")
    .replace(/^FactionReputationScope$/i, "Standing")
    .replace(/^RR_/, "Rest Stop ")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/\bStantonStar\b/i, "Stanton")
    .replace(/\bPyroStar\b/i, "Pyro")
    .replace(/\s+/g, " ")
    .trim();
}

function keySlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function normalizedObjectiveStem(value?: string, removableTokens: string[] = []): string | undefined {
  const text = clean(value);
  if (!text) return undefined;
  const removable = new Set(removableTokens.flatMap((token) => token.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)));
  const ignored = new Set([
    "title", "desc", "description", "career", "contract", "mission", "rank", "intro",
    "veryeasy", "easy", "medium", "hard", "veryhard", "super",
    "vlrt", "lrt", "mrt", "hrt", "vhrt", "ert", "srt",
  ]);
  const tokens = text
    .replace(/^@/, "")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((token) => !ignored.has(token))
    .filter((token) => !/^(?:rank)?\d+$/.test(token))
    .filter((token) => !/^(?:ve|e|m|h|vh|s)$/.test(token))
    .filter((token) => !removable.has(token));
  return tokens.length ? tokens.join("-") : undefined;
}

function isIntroMission(mission: RawMission): boolean {
  const text = [mission.debugName, mission.handlerDebugName, mission.titleRaw, mission.descriptionRaw]
    .filter(Boolean)
    .join(" ");
  return /(?:^|[_\s-])intro(?:$|[_\s-])/i.test(text);
}

function deriveTier(mission: RawMission): { tierKey: string; tierLabel: string } {
  const text = [mission.debugName, mission.titleRaw, mission.descriptionRaw].filter(Boolean).join(" ");
  const named = [
    ["veryhard", "Very High Risk"],
    ["super", "Extreme Risk"],
    ["hard", "High Risk"],
    ["medium", "Medium Risk"],
    ["veryeasy", "Very Low Risk"],
    ["easy", "Low Risk"],
  ] as const;
  const normalized = text.replace(/[^a-z0-9]+/gi, "").toLowerCase();
  for (const [key, label] of named) {
    if (normalized.includes(key)) return { tierKey: key, tierLabel: label };
  }
  const rank = text.match(/(?:^|[_\s-])rank[_\s-]?([0-9]+)(?:$|[_\s-])/i)?.[1];
  if (rank) return { tierKey: `rank-${rank}`, tierLabel: `Rank ${rank}` };
  const risk = text.match(/(?:^|[_\s-])(VLRT|LRT|MRT|HRT|VHRT|ERT|SRT)(?:$|[_\s-])/i)?.[1]?.toUpperCase();
  if (risk) return { tierKey: keySlug(risk), tierLabel: risk };
  return { tierKey: "unclassified", tierLabel: "Unclassified tier" };
}

function deriveActivityKey(mission: RawMission): { activityKey: string; source: "structural" | "supporting" | "unresolved" } {
  const normalizeEvidenceText = (values: Array<string | undefined>) => values
    .filter(Boolean)
    .join(" ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const structuralText = normalizeEvidenceText([
    mission.missionType,
    mission.contractType,
    mission.debugName,
    mission.generatorName,
    mission.handlerDebugName,
    mission.handlerType,
  ]);
  const supportingText = normalizeEvidenceText([mission.titleRaw, mission.descriptionRaw]);
  const combinedText = `${structuralText} ${supportingText}`;
  const activities: string[] = [];
  const add = (activity: string, pattern: RegExp) => {
    if (pattern.test(combinedText)) activities.push(activity);
  };

  add("collector-offer", /\bcollector\b|thecollector|wikelo\s+(?:offer|reward|request)/);
  add("bounty-certification", /\bcertification\b|\bcertify\b|\bassessment\b|\bqualification\b/);
  add("defend-ship", /defend\s+ship|ship\s+defen[cs]e/);
  add("escort-ship", /\bescort\b/);
  add("defend-location", /\bdefend\b|defen[cs]e\s+(?:location|outpost|base|site)/);
  add("sabotage-server", /sabotage\s+server|server\s+sabotage/);
  add("sabotage-generator", /sabotage\s+generator|generator\s+sabotage/);
  add("sabotage-fuel", /sabotage\s+fuel|fuel\s+(?:tank|sabotage)/);
  add("destroy-items", /destroy\s+(?:items?|drugs?|goods?|contraband|equipment)|destruction\s+items?/);
  add("search-body", /search\s+body|find\s+(?:a\s+)?body/);
  add("missing-person-investigation", /missing\s+persons?|missingperson|investigat/);
  add("steal-cargo", /\btheft\b|\bsteal\b|\bstole\b|stolen[_\s-]?(?:goods|cargo)/);
  add("recover-cargo", /recover\s+cargo|cargo\s+recover/);
  add("retrieve-cargo", /retrieve\s+cargo|cargo\s+retriev/);
  add("courier-delivery", /\bcourier\b|\bdelivery\b|deliver\s+(?:cargo|package|goods|shipment)|tradepost\s+to\s+tradepost/);
  add("resupply", /\bresupply\b|out\s+of\s+stock|\boos\b|\bfiresale\b|location\s+rush|yard\s+rush/);
  add("salvage-fps", /fps\s+(?:salvage|scrap)|(?:salvage|scrap)\s+fps/);
  add("salvage-ship", /ship\s+(?:salvage|scrap)|(?:salvage|scrap)\s+ship|\bsalvage\b/);
  add("repair", /\brepair\b/);
  add("refuel", /\brefuel\b|\brefueling\b/);
  add("patrol", /\bpatrol\b/);
  add("ambush", /\bambush\b/);
  add("resource-gathering", /resource\s+gather|gathering/);
  add("mining-fps", /fps\s+mining|fps\s+mine/);
  add("eliminate-animals", /kill\s+animals?|eliminate\s+animals?/);
  add("eliminate-all", /eliminate\s+all|kill\s+all|multi\s+kill|ship\s+wave\s+attack/);
  add("eliminate-specific", /eliminate\s+specific|kill\s+ship|\bassassinat/);

  let uniqueActivities = unique(activities);
  if (uniqueActivities.includes("steal-cargo")) {
    uniqueActivities = uniqueActivities.filter((activity) => !["courier-delivery", "recover-cargo", "retrieve-cargo"].includes(activity));
  } else if (uniqueActivities.includes("retrieve-cargo")) {
    uniqueActivities = uniqueActivities.filter((activity) => !["courier-delivery", "recover-cargo"].includes(activity));
  } else if (uniqueActivities.includes("recover-cargo")) {
    uniqueActivities = uniqueActivities.filter((activity) => activity !== "courier-delivery");
  }
  if (uniqueActivities.includes("resupply")) {
    uniqueActivities = uniqueActivities.filter((activity) => activity !== "salvage-ship");
  }
  if (uniqueActivities.includes("defend-ship")) {
    uniqueActivities = uniqueActivities.filter((activity) => activity !== "defend-location");
  }
  if (!uniqueActivities.length) {
    if (/\bhauling\b|\bhaul\b|linehaul|system\s+to\s+system|\ba\s+to\s+b\b/.test(combinedText)) uniqueActivities.push("deliver");
    else if (/\bbounty\b/.test(combinedText)) uniqueActivities.push("bounty-repeatable");
  }
  if (!uniqueActivities.length) return { activityKey: "unknown", source: "unresolved" };
  const structuralMatches = /collector|certification|certify|assessment|qualification|defend|escort|sabotage|destroy|search|missing|theft|steal|stole|recover|retrieve|courier|delivery|oos|firesale|location rush|yard rush|salvage|repair|refuel|patrol|ambush|gather|mining|kill|eliminate|assassinat|bounty|hauling|haul|linehaul|system to system/.test(structuralText);
  return {
    activityKey: uniqueActivities.sort().join("+"),
    source: structuralMatches ? "structural" : "supporting",
  };
}

function deriveChainState(mission: RawMission): string {
  const unlockRefs = unique((mission.prerequisites ?? [])
    .filter((item) => prerequisiteType(item.type) === "unlock")
    .flatMap((item) => item.references ?? [])
    .map((ref) => clean(ref))
  );
  if (!unlockRefs.length) return "open";
  return `unlock:${createHash("sha256").update(unlockRefs.sort().join("|")).digest("hex").slice(0, 12)}`;
}

function deriveObjectiveSignature(
  mission: RawMission,
  reputationScope: ReputationScope,
  archetype: string,
  pickupLocation: PickupLocation,
  lawfulClassification: string,
  crimeRequirement: string,
  resolvedTitle: ReturnType<typeof variantTitle>,
): ShapedVariant["objectiveSignature"] {
  const removableTokens = unique([
    pickupLocation.system,
    pickupLocation.parentLocation,
    pickupLocation.localityPool,
    ...(pickupLocation.regions ?? []),
  ]);
  const titleStem = normalizedObjectiveStem(mission.titleRaw, removableTokens);
  const descriptionStem = normalizedObjectiveStem(mission.descriptionRaw, removableTokens);
  const handlerStem = normalizedObjectiveStem(mission.handlerDebugName, removableTokens);
  const activity = deriveActivityKey(mission);
  const introState = isIntroMission(mission) ? "intro" : "standard";
  const chainState = deriveChainState(mission);
  const legalState = `${lawfulClassification}:${crimeRequirement}`;
  const namedOfferBoundaryActivities = new Set([
    "destroy-items",
  ]);
  const activityParts = activity.activityKey.split("+");
  const normalizedOfferTitle = ["localized_clean", "token_template_cleaned"].includes(resolvedTitle.titleSource)
    ? normalizedObjectiveStem(cleanTemplateTitle(resolvedTitle.displayName) ?? resolvedTitle.displayName, removableTokens)
    : undefined;
  const offerTitleIdentity = activityParts.length > 0
    && activityParts.every((part) => namedOfferBoundaryActivities.has(part))
    && normalizedOfferTitle
    ? normalizedOfferTitle
    : undefined;
  const collectorOfferIdentity = activity.activityKey.includes("collector-offer")
    ? titleStem ?? descriptionStem ?? normalizedObjectiveStem(mission.debugName, removableTokens) ?? mission.contractId
    : undefined;
  const evidence = unique([
    `activity:${activity.activityKey}`,
    `activity-source:${activity.source}`,
    titleStem ? `title:${titleStem}` : undefined,
    descriptionStem ? `description:${descriptionStem}` : undefined,
    handlerStem ? `handler:${handlerStem}` : undefined,
    clean(mission.contractType) ? `contract:${keySlug(mission.contractType!)}` : undefined,
    `archetype:${keySlug(archetype)}`,
    `intro:${introState}`,
    `chain:${chainState}`,
    `legal:${legalState}`,
    offerTitleIdentity ? `offer-title:${offerTitleIdentity}` : undefined,
    collectorOfferIdentity ? `collector-offer:${collectorOfferIdentity}` : undefined,
  ]);
  const confidence = activity.source === "unresolved" ? "unresolved" : activity.source === "supporting" ? "partial" : "strong";
  const objectiveArchetype = activity.activityKey === "unknown" ? keySlug(archetype) : "activity-defined";
  const key = [
    reputationScope.factionKey,
    reputationScope.scopeKey,
    activity.activityKey,
    objectiveArchetype,
    introState,
    chainState,
    legalState,
    offerTitleIdentity ? `offer-title:${offerTitleIdentity}` : undefined,
    collectorOfferIdentity ? `collector-offer:${collectorOfferIdentity}` : undefined,
    activity.source === "supporting" ? `supporting-family:${mission.familyId ?? mission.contractId}` : undefined,
    activity.source === "unresolved" ? `variant:${mission.contractId}` : undefined,
  ].join("|");
  return {
    key,
    activityKey: activity.activityKey,
    titleStem,
    descriptionStem,
    handlerStem,
    offerTitleIdentity,
    archetype,
    contractType: mission.contractType ?? mission.missionType ?? "Unknown contract",
    introState,
    chainState,
    legalState,
    confidence,
    evidence,
  };
}

function factionKey(mission: RawMission): string {
  return clean(mission.factionReputationGuid) ?? keySlug(mission.factionName ?? "Unknown faction");
}

function classifyMissionArchetype(mission: RawMission): string {
  const text = [
    mission.missionType,
    mission.contractType,
    mission.debugName,
    mission.generatorName,
    mission.handlerDebugName,
    mission.title,
  ].filter(Boolean).join(" ").toLowerCase();
  if (/\boos\b|firesale|locationrush|yardrush|out[_\s-]?of[_\s-]?stock|\bresupply\b/.test(text)) {
    return clean(mission.missionType) ?? clean(mission.contractType) ?? "Other / unresolved";
  }
  if (/cargo|hauling|haul|delivery|courier|ato?b|linehaul/.test(text)) return /courier|delivery/.test(text) ? "Courier" : "Cargo";
  if (/defendship|defend ship|escort/.test(text)) return "Defend Ship";
  if (/ambush/.test(text)) return "Ambush";
  if (/assassination|assassinate/.test(text)) return "Assassination";
  if (/bounty/.test(text)) return "Bounty";
  if (/salvage|scrap/.test(text)) return "Salvage";
  if (/refuel/.test(text)) return "Refuel";
  if (/recover|retrieval|retrieve/.test(text)) return "Recovery";
  if (/mercenary|security|patrol|eliminate|combat|shipwaveattack|attack/.test(text)) return "Mercenary";
  if (/investigation|missingperson|missing person|search/.test(text)) return "Investigation";
  return clean(mission.missionType) ?? clean(mission.contractType) ?? "Other / unresolved";
}

function deriveTrackType(mission: RawMission, archetype: string): string {
  const text = [mission.debugName, mission.generatorName, mission.handlerDebugName, mission.missionType, mission.title].filter(Boolean).join(" ").toLowerCase();
  if (/\boos\b|firesale|locationrush|yardrush|out[_\s-]?of[_\s-]?stock|\bresupply\b/.test(text)) return "Standing";
  if (/haul|cargo|courier|delivery|linehaul|ato?b/.test(text) || ["Cargo", "Courier", "Recovery"].includes(archetype)) return "Hauling";
  if (/shipcombat|ship combat|bounty|assassination|ambush|defendship|defend ship|patrol|eliminate|combat|attack/.test(text) || ["Assassination", "Ambush", "Bounty", "Defend Ship", "Mercenary"].includes(archetype)) return "Ship Combat";
  if (/security/.test(text)) return "Security";
  if (/salvage|scrap/.test(text)) return "Salvage";
  if (/refuel/.test(text)) return "Refueling";
  return "Standing";
}

function resolveReputationScope(mission: RawMission, refMap: Map<string, RefIndexEntry>, archetype: string): ReputationScope {
  const scopeGuid = guidValue(mission.reputationScopeGuid);
  const scopeRef = scopeGuid ? refMap.get(scopeGuid) : undefined;
  const rawName = scopeRef?.recordName;
  const factionDisplayName = mission.factionName ?? "Unknown faction";
  const baseDisplay = displayNameFromRef(scopeRef);
  const derivedTrack = deriveTrackType(mission, archetype);
  const genericScope = !scopeGuid || /FactionReputationScope$/i.test(rawName ?? "") || baseDisplay === "Standing";
  const isHeadhunters = /headhunter/i.test(factionDisplayName);

  if (scopeGuid && scopeRef && !genericScope) {
    const displayName = baseDisplay ?? derivedTrack;
    return {
      scopeKey: scopeGuid,
      displayName,
      rawName,
      factionKey: factionKey(mission),
      factionDisplayName,
      trackType: displayName,
      confidence: baseDisplay ? "resolved" : "partial",
      sourceRefs: [scopeGuid],
      unresolvedReason: baseDisplay ? undefined : "Scope record resolved, but display text required cleaned record-name fallback.",
    };
  }

  if (isHeadhunters && derivedTrack !== "Standing") {
    return {
      scopeKey: `${factionKey(mission)}:${keySlug(derivedTrack)}`,
      displayName: derivedTrack,
      rawName,
      factionKey: factionKey(mission),
      factionDisplayName,
      trackType: derivedTrack,
      confidence: "partial",
      sourceRefs: unique([scopeGuid, mission.familyId, mission.debugName]),
      unresolvedReason: "Current extracted reputation scope GUID is generic; track derived from Scintel mission fields/internal family naming.",
    };
  }

  if (scopeGuid && scopeRef) {
    return {
      scopeKey: scopeGuid,
      displayName: baseDisplay ?? "Standing",
      rawName,
      factionKey: factionKey(mission),
      factionDisplayName,
      trackType: "Standing",
      confidence: baseDisplay ? "resolved" : "partial",
      sourceRefs: [scopeGuid],
      unresolvedReason: baseDisplay ? undefined : "Generic scope record used cleaned fallback display.",
    };
  }

  return {
    scopeKey: `${factionKey(mission)}:unknown-scope`,
    displayName: derivedTrack,
    factionKey: factionKey(mission),
    factionDisplayName,
    trackType: derivedTrack,
    confidence: "unresolved",
    sourceRefs: unique([mission.familyId, mission.debugName]),
    unresolvedReason: "No reputationScopeGuid extracted for this mission.",
  };
}

function systemFromRef(entry?: RefIndexEntry, fallbackText?: string): string | undefined {
  const text = `${entry?.recordName ?? ""} ${entry?.path ?? ""} ${fallbackText ?? ""}`.toLowerCase();
  const systems = ["stanton", "pyro", "nyx"];
  const found = systems.filter((system) => text.includes(system));
  if (found.length === 1) return found[0][0]!.toUpperCase() + found[0]!.slice(1);
  if (found.length > 1) return found.map((system) => system[0]!.toUpperCase() + system.slice(1)).join(", ");
  return undefined;
}

function structuredLocationRefs(mission: RawMission): Array<{
  role: LocationRefRole;
  rawType: string;
  attr: string;
  guidOrToken: string;
}> {
  return (mission.prerequisites ?? []).flatMap((item) => {
    if (item.type === "ContractPrerequisite_Location") {
      const guidOrToken = guidValue(rawValue(item.attributes, ["locationAvailable", "availableAt", "acceptedAt", "offerLocation"]));
      return guidOrToken ? [{ role: "pickup" as const, rawType: item.type, attr: "locationAvailable", guidOrToken }] : [];
    }
    if (item.type === "ContractPrerequisite_Locality") {
      const guidOrToken = guidValue(rawValue(item.attributes, ["localityAvailable", "availableAt", "acceptedAt"]));
      return guidOrToken ? [{ role: "pickup" as const, rawType: item.type, attr: "localityAvailable", guidOrToken }] : [];
    }
    if (item.type === "ContractPrerequisite_LocationProperty") {
      const keys = ["propertyVariableName", "propertyExtendedTextToken", "locationLevelType"] as const;
      return keys.flatMap((key) => {
        const guidOrToken = clean(rawValue(item.attributes, [key]));
        return guidOrToken ? [{ role: "objective" as const, rawType: item.type, attr: key, guidOrToken }] : [];
      });
    }
    return [];
  });
}

function extractMissionPlaceholderTokens(mission: RawMission): string[] {
  const text = [
    mission.title,
    mission.titleRaw,
    mission.description,
    mission.descriptionRaw,
  ].filter(Boolean).join("\n");
  const tokens = new Set<string>();
  for (const match of text.matchAll(/~mission\(([^)]+)\)/gi)) {
    const token = clean(match[1]);
    if (token) tokens.add(token);
  }
  for (const match of text.matchAll(/\[([a-z0-9_]+)\]/gi)) {
    const token = clean(match[1]);
    if (token && /(destination|drop\s*off|dropoff|location)/i.test(token)) tokens.add(token);
  }
  return Array.from(tokens);
}

function classifyTextLocationTokens(tokens: string[]): { destinationTokens: string[]; objectiveTokens: string[] } {
  const destinationTokens = unique(tokens.filter((token) => /destination|drop\s*off|dropoff|end/i.test(token)));
  const objectiveTokens = unique(tokens.filter((token) => /location\d*|pickuplocation|dropofflocation/i.test(token)));
  return { destinationTokens, objectiveTokens };
}

function resolvedPickupLocalities(pickup: PickupLocation): NonNullable<PickupLocation["rawLocalities"]> {
  const refs = pickup.technicalRefs.filter((item) => item.consideredPickup && item.resolvedName);
  return Array.from(new Map(refs.map((item) => [item.ref.toLowerCase(), {
    guid: item.ref,
    displayName: item.resolvedName!,
    type: item.type,
    path: item.path,
    system: systemFromRef(undefined, `${item.resolvedName ?? ""} ${item.path ?? ""}`),
  }])).values());
}

function normalizeSystemLabels(values: Array<string | undefined>): string[] {
  const normalized: string[] = [];
  for (const value of values) {
    const text = clean(value);
    if (!text) continue;
    const found = Array.from(new Set(Array.from(text.matchAll(/\b(Stanton|Pyro|Nyx)\b/gi)).map((match) => {
      const system = clean(match[1]);
      return system ? `${system[0]!.toUpperCase()}${system.slice(1).toLowerCase()}` : undefined;
    }).filter((system): system is string => Boolean(system))));
    if (found.length) {
      normalized.push(...found);
      continue;
    }
    normalized.push(text);
  }
  return unique(normalized);
}

function pyroRegionLetter(value?: string): string | undefined {
  const match = clean(value)?.match(/^Region\s+([A-Z])$/i);
  if (!match) return undefined;
  return match[1]!.toUpperCase();
}

function normalizePyroRegionPool(
  systems: string[],
  localityNames: string[],
): { regionLabels: string[]; regionPoolLabel: string } | undefined {
  if (systems.length !== 1 || systems[0] !== "Pyro") return undefined;
  const filtered = localityNames
    .map(clean)
    .filter((value): value is string => Boolean(value))
    .filter((value) => !/^Pyro(?:\s+system|\s+StarLocality)?$/i.test(value));
  if (!filtered.length) return undefined;
  const letters = filtered.map(pyroRegionLetter).filter((value): value is string => Boolean(value));
  if (letters.length !== filtered.length) return undefined;
  const sortedLetters = Array.from(new Set(letters)).sort((a, b) => a.localeCompare(b));
  const regionLabels = sortedLetters.map((letter) => `Region ${letter}`);
  const continuous = sortedLetters.every((letter, index) => index === 0 || letter.charCodeAt(0) === sortedLetters[index - 1]!.charCodeAt(0) + 1);
  return {
    regionLabels,
    regionPoolLabel: continuous && sortedLetters.length > 1
      ? `Region ${sortedLetters[0]}-${sortedLetters[sortedLetters.length - 1]}`
      : regionLabels.join(", "),
  };
}

function pickupDisplayLabel(pickup: PickupLocation, systems: string[], localityNames: string[]): string {
  if (pickup.status === "unknown") return "Unknown pickup";
  if (pickup.status === "unresolved") return "Pickup unresolved";
  if (systems.length === 1) return systems[0]!;
  if (systems.length > 1) return systems.join(", ");
  if (pickup.status === "system_scope" && pickup.system) return pickup.system;
  if (localityNames.length === 1) return localityNames[0]!;
  return pickup.displayName || "Unknown pickup";
}

function pickupDetailLabel(pickup: PickupLocation, systems: string[], localityNames: string[]): string {
  const pyroRegionPool = normalizePyroRegionPool(systems, localityNames);
  if (pyroRegionPool) return `Generated region pool: ${pyroRegionPool.regionPoolLabel}`;
  if (pickup.status === "generated_from_pool") {
    const label = pickup.system ?? pickup.displayName;
    return label ? `Generated pickup pool (${label})` : "Generated pickup pool";
  }
  if (pickup.status === "system_scope") {
    if (pickup.regions?.length) return `${pickup.system ?? pickup.displayName} ${pickup.regions.join(", ").replace(/Region /g, "Region ")}`;
    return pickup.displayName;
  }
  if (pickup.status === "unknown") return "Unknown pickup";
  if (pickup.status === "unresolved") return "Pickup unresolved";
  if (localityNames.length > 0) {
    return localityNames.length > 3 ? `${localityNames.slice(0, 3).join(", ")} +${localityNames.length - 3}` : localityNames.join(", ");
  }
  return pickup.displayName;
}

function pickupGroupingDetailLabel(
  pickup: PickupLocation,
  systems: string[],
  detailDisplay: string,
  localityNames: string[],
): string {
  if (normalizePyroRegionPool(systems, localityNames)) return `${systems[0]} system`;
  return detailDisplay;
}

function pickupGroupingConfidence(pickup: PickupLocation): NonNullable<PickupLocation["grouping"]>["confidence"] {
  if (pickup.status === "exact") return "exact";
  if (pickup.status === "generated_from_pool") return "generated_from_pool";
  if (pickup.status === "system_scope") return "system_scope";
  if (pickup.status === "unresolved") return "unresolved";
  if (pickup.status === "unknown") return "unknown";
  return "partial";
}

function buildPickupLocationRole(pickup: PickupLocation, unresolvedLocationTokens: string[]): PickupLocationRole {
  const rawLocalities = resolvedPickupLocalities(pickup);
  const systems = normalizeSystemLabels([
    pickup.system,
    ...rawLocalities.map((item) => item.system),
  ]);
  const rawLocalityNames = unique([
    ...rawLocalities.map((item) => item.displayName),
    ...pickup.possibleLocations,
    ...(pickup.regions ?? []),
  ]);
  const pyroRegionPool = normalizePyroRegionPool(systems, rawLocalityNames);
  const localityNames = pyroRegionPool?.regionLabels ?? rawLocalityNames;
  const displayLabel = pickupDisplayLabel(pickup, systems, localityNames);
  const detailDisplay = pickupDetailLabel(pickup, systems, localityNames);
  return {
    status: pickup.status,
    displayName: pickup.displayName,
    displayLabel,
    detailDisplay,
    systems,
    primarySystem: systems[0],
    confidence: pickup.confidence,
    sourceRole: pickup.sourceRole,
    sourceRefs: pickup.sourceRefs,
    unresolvedRefs: pickup.unresolvedRefs,
    unresolvedLocationTokens,
    generatedFromPool: pickup.status === "generated_from_pool",
    systemScope: pickup.status === "system_scope",
    rawLocalities,
    grouping: {
      systems,
      localityNames,
      displayLabel,
      detailLabel: pickupGroupingDetailLabel(pickup, systems, detailDisplay, localityNames),
      confidence: pickupGroupingConfidence(pickup),
    },
  };
}

function buildUnresolvedLocationRole(
  status: "unknown" | "unresolved",
  displayName: string,
  sourceRefs: string[],
  unresolvedRefs: string[],
  sourceTextTokens: string[],
  confidence: "low" | "unresolved",
  systems: string[] = [],
): UnresolvedLocationRole {
  return {
    status,
    displayName,
    displayLabel: displayName,
    systems,
    primarySystem: systems[0],
    confidence,
    sourceRefs,
    unresolvedRefs,
    sourceTextTokens,
    unresolved: status === "unresolved",
  };
}

function buildLocationRefs(
  mission: RawMission,
  refMap: Map<string, RefIndexEntry>,
  destinationTokens: string[],
  objectiveTokens: string[],
): LocationRef[] {
  const refs = structuredLocationRefs(mission).map((item) => {
    const entry = refMap.get(item.guidOrToken.toLowerCase());
    return {
      role: item.role,
      rawType: item.rawType,
      attr: item.attr,
      guidOrToken: item.guidOrToken,
      resolvedName: displayNameFromRef(entry),
      system: systemFromRef(entry, item.guidOrToken),
      confidence: entry ? (item.role === "objective" ? "inferred" : "resolved") : "unresolved",
    } satisfies LocationRef;
  });
  const tokenRefs = [
    ...destinationTokens.map((token) => ({
      role: "destination" as const,
      rawType: "mission_text_token",
      attr: "sourceTextToken",
      guidOrToken: token,
      confidence: "token_only" as const,
    })),
    ...objectiveTokens.map((token) => ({
      role: "objective" as const,
      rawType: "mission_text_token",
      attr: "sourceTextToken",
      guidOrToken: token,
      confidence: "token_only" as const,
    })),
  ];
  return [...refs, ...tokenRefs];
}

function pickupDisplay(pickup: PickupLocation): string {
  if (pickup.status === "generated_from_pool") return `Generated from ${pickup.displayName} locality pool`;
  return pickup.displayName;
}

function normalizeMissionTitle(value?: string): string | undefined {
  const text = clean(value)
    ?.replace(/<[^>]+>/g, "")
    .replace(/~mission\(([^|)]+)(?:\|[^)]+)?\)/g, "[$1]")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || text.startsWith("@")) return undefined;
  if (/^\[[^\]]+\]$/.test(text)) return undefined;
  return text;
}

function isInternalTitle(value?: string): boolean {
  const text = clean(value);
  if (!text) return true;
  if (/ContractGenerator\.|^[a-z0-9]+_[a-z0-9_]+$/i.test(text)) return true;
  if ((text.match(/_/g)?.length ?? 0) >= 2) return true;
  if (/\bRank\d+\b|NOTFORRELEASE|DISABLED/i.test(text) && text.includes("_")) return true;
  return false;
}

function localizedTitle(mission: RawMission): string | undefined {
  const explicit = normalizeMissionTitle(mission.stringParams?.Title?.text ?? undefined);
  if (explicit && !isInternalTitle(explicit)) return explicit;
  const title = normalizeMissionTitle(mission.title);
  if (title && !isInternalTitle(title)) return title;
  return undefined;
}

function hasUnresolvedTitleToken(value?: string): boolean {
  return /\[[^\]]+\]/.test(value ?? "");
}

function cleanTemplateTitle(value?: string): string | undefined {
  const text = clean(value)
    ?.replace(/\[[^\]]+\]/g, " ")
    .replace(/\bRank\s*-\s*/i, "")
    .replace(/\s+-\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || text.length < 5 || isInternalTitle(text)) return undefined;
  return text;
}

function generatedMissionTitle(mission: RawMission, archetype: string, pickup?: PickupLocation): string {
  const pieces = [
    archetype && !/^Other/i.test(archetype) ? archetype : clean(mission.missionType) ?? clean(mission.contractType),
    pickup?.system ?? (pickup?.displayName && !/unknown|unresolved/i.test(pickup.displayName) ? pickup.displayName : undefined),
  ].filter(Boolean);
  if (pieces.length) return `${pieces.join(", ")} Mission`;
  return `${mission.factionName ?? "Mission"} ${clean(mission.missionType) ?? "Variant"}`;
}

function variantTitle(mission: RawMission, archetype: string, pickup?: PickupLocation): { displayName: string; titleSource: ShapedVariant["titleSource"]; titleConfidence: ShapedVariant["titleConfidence"] } {
  const title = localizedTitle(mission);
  if (title && !hasUnresolvedTitleToken(title)) return { displayName: title, titleSource: "localized_clean", titleConfidence: "high" };
  if (title && hasUnresolvedTitleToken(title)) {
    return { displayName: title, titleSource: "token_template_cleaned", titleConfidence: "medium" };
  }
  const cleaned = cleanTemplateTitle(title);
  if (cleaned) return { displayName: cleaned, titleSource: "token_template_cleaned", titleConfidence: "medium" };
  return {
    displayName: readableName(mission.debugName ?? mission.handlerDebugName ?? mission.generatorName),
    titleSource: "internal_fallback",
    titleConfidence: "low",
  };
}

function unique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function firstKnown(values: Array<string | undefined>, fallback: string): string {
  return values.find(Boolean) ?? fallback;
}

function rawValue(record: Record<string, unknown> | undefined, keys: string[]): unknown {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function numberValue(record: Record<string, unknown> | undefined, keys: string[]): number | undefined {
  const value = rawValue(record, keys);
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatStandingRange(min?: RawStanding, max?: RawStanding): string {
  const minLabel = [min?.displayName, typeof min?.minReputation === "number" ? `${min.minReputation.toLocaleString()} rep` : undefined].filter(Boolean).join(" / ");
  const maxLabel = [max?.displayName, typeof max?.minReputation === "number" ? `${max.minReputation.toLocaleString()} rep` : undefined].filter(Boolean).join(" / ");
  if (minLabel && maxLabel) return `${minLabel} to ${maxLabel}`;
  if (minLabel) return `Requires ${minLabel}`;
  if (maxLabel) return `Up to ${maxLabel}`;
  return "No extracted standing requirement";
}

function cleanBriefing(value?: string): string | undefined {
  const text = clean(value)
    ?.replace(/<[^>]+>/g, "")
    .replace(/~mission\(([^|)]+)(?:\|[^)]+)?\)/g, "[$1]")
    .replace(/\\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text && !text.startsWith("@") ? text : undefined;
}

function chanceLabel(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const percent = value <= 1 ? value * 100 : value;
  return `${Number.isInteger(percent) ? percent : Number(percent.toFixed(2))}% chance`;
}

function formatSignedAmount(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "unresolved";
  return `${value >= 0 ? "+" : ""}${value.toLocaleString()}`;
}

function shortScopeLabel(value: string): string {
  return value
    .replace(/\bReputation\b/gi, "")
    .replace(/\bPath\b/gi, "")
    .replace(/\s+/g, " ")
    .trim() || value;
}

function shapeRewardedReputationPaths(mission: RawMission, refMap: Map<string, RefIndexEntry>, missionScope: ReputationScope): RewardedReputationPath[] {
  return (mission.reputationRewards ?? []).map((reward) => {
    const scopeGuid = guidValue(reward.reputationScope);
    const factionGuid = guidValue(reward.factionReputation) ?? guidValue(mission.factionReputationGuid);
    const rewardGuid = guidValue(reward.rewardGuid) ?? guidValue(reward.reward?.guid);
    const scopeRef = scopeGuid ? refMap.get(scopeGuid) : undefined;
    const usesDerivedMissionScope = Boolean(scopeGuid && missionScope.sourceRefs.includes(scopeGuid) && missionScope.scopeKey !== scopeGuid);
    const scopeDisplayName = scopeGuid === missionScope.scopeKey || usesDerivedMissionScope
      ? missionScope.displayName
      : displayNameFromRef(scopeRef);
    const amount = reward.reputationAmount ?? numberValue(reward.reward, ["reputationAmount"]);
    const xp = reward.xp ?? numberValue(reward.reward, ["xp", "experience"]);
    const sourceRefs = unique([factionGuid, scopeGuid, rewardGuid, ...(reward.references ?? [])]);
    const confidence: RewardedReputationPath["confidence"] = usesDerivedMissionScope
      ? "partial"
      : scopeDisplayName && amount !== undefined
      ? "resolved"
      : scopeDisplayName || amount !== undefined
        ? "partial"
        : "unresolved";

    return {
      factionKey: factionGuid ?? missionScope.factionKey,
      factionDisplayName: mission.factionName ?? missionScope.factionDisplayName,
      scopeKey: usesDerivedMissionScope ? missionScope.scopeKey : scopeGuid ?? missionScope.scopeKey,
      scopeDisplayName: scopeDisplayName ?? "Rep reward unresolved",
      amount,
      xp,
      confidence,
      sourceRefs,
      unresolvedReason: usesDerivedMissionScope
        ? "Reward scope used the same generic reputation ref as the mission; path label follows existing Scintel-derived career track."
        : confidence === "resolved" ? undefined : "Reputation reward amount or scope path could not be fully resolved from current refs.",
    };
  });
}

function missionFlags(mission: RawMission): string[] {
  return unique([
    truthy(mission.classifications?.tutorial) ? "Tutorial" : undefined,
    truthy(mission.classifications?.event) ? "Event" : undefined,
  ]);
}

function releaseFlags(mission: RawMission): string[] {
  return unique([
    truthy(mission.notForRelease) ? "Not for release" : "Release flag not set",
    truthy(mission.workInProgress) ? "Work in progress" : undefined,
  ]);
}

function prerequisiteType(rawType?: string): ShapedPrerequisite["type"] {
  const normalized = rawType?.toLowerCase() ?? "";
  if (normalized.includes("crimestat")) return "crimeStat";
  if (normalized.includes("reputation")) return "reputation";
  if (normalized.includes("standing")) return "standing";
  if (normalized.includes("rank")) return "rank";
  if (normalized.includes("locality")) return "locality";
  if (normalized.includes("location")) return "location";
  if (normalized.includes("completedcontracttags") || normalized.includes("unlock")) return "unlock";
  return "unresolved";
}

function resolvePlace(prerequisite: RawPrerequisite): string | undefined {
  return clean(rawValue(prerequisite.resolved, [
    "displayName",
    "name",
    "locationDisplay",
    "localityDisplay",
    "locationName",
    "localityName",
    "address",
  ]));
}

function crimeStatRequirement(prerequisites: RawPrerequisite[]): ShapedVariant["crimeStatRequirement"] {
  const crimeStats = prerequisites.filter((item) => prerequisiteType(item.type) === "crimeStat");
  if (!crimeStats.length) return "unknown";
  const requiresCrimeStat = crimeStats.some((item) => {
    const min = numberValue(item.attributes, ["minCrimeStat", "minimumCrimeStat"]);
    return min !== undefined && min > 0;
  });
  return requiresCrimeStat ? "required" : "bounded";
}

function classifyLawful(mission: RawMission): Pick<ShapedVariant, "lawfulClassification" | "lawfulConfidence"> {
  const haystack = [
    mission.debugName,
    mission.generatorName,
    mission.handlerDebugName,
    mission.title,
    mission.factionName,
  ].filter(Boolean).join(" ").toLowerCase();
  if (/\bunlawful\b|\billegal\b|\bcontraband\b|\bcriminal\b/.test(haystack)) {
    return { lawfulClassification: "unlawful", lawfulConfidence: "inferred" };
  }
  if (/\blawful\b|\bsecurity\b|\benforcement\b|\buee\b/.test(haystack)) {
    return { lawfulClassification: "lawful", lawfulConfidence: "inferred" };
  }
  return { lawfulClassification: "unknown", lawfulConfidence: "unknown" };
}

function shapePrerequisite(prerequisite: RawPrerequisite, mission: RawMission, refMap: Map<string, RefIndexEntry>): ShapedPrerequisite {
  const type = prerequisiteType(prerequisite.type);
  if (type === "location" || type === "locality") {
    if (prerequisite.type === "ContractPrerequisite_LocationProperty") {
      return {
        type,
        label: "Procedural location placeholder",
        confidence: "inferred",
        rawType: prerequisite.type,
        raw: {
          propertyVariableName: clean(rawValue(prerequisite.attributes, ["propertyVariableName"])),
          propertyExtendedTextToken: clean(rawValue(prerequisite.attributes, ["propertyExtendedTextToken"])),
          locationLevelType: clean(rawValue(prerequisite.attributes, ["locationLevelType"])),
        },
      };
    }
    const token = clean(rawValue(prerequisite.attributes, ["locationAvailable", "localityAvailable", "location", "locality"]));
    const ref = token ? refMap.get(token.toLowerCase()) : undefined;
    const place = resolvePlace(prerequisite) ?? displayNameFromRef(ref);
    return {
      type,
      label: place ?? "Location unresolved",
      confidence: place ? "resolved" : "unresolved",
      rawType: prerequisite.type,
      raw: place ? undefined : { token },
    };
  }
  if (type === "reputation") {
    const faction = clean(rawValue(prerequisite.resolved, ["factionReputationDisplay", "factionDisplay", "factionName"])) ?? mission.factionName;
    const minName = clean(rawValue(prerequisite.resolved, ["minStandingDisplay", "minimumStandingDisplay", "minStanding"]));
    const maxName = clean(rawValue(prerequisite.resolved, ["maxStandingDisplay", "maximumStandingDisplay", "maxStanding"]));
    const minRep = numberValue(prerequisite.resolved, ["minReputation", "minimumReputation"]) ?? numberValue(prerequisite.attributes, ["minReputation", "minimumReputation"]);
    const maxRep = numberValue(prerequisite.resolved, ["maxReputation", "maximumReputation"]) ?? numberValue(prerequisite.attributes, ["maxReputation", "maximumReputation"]);
    const range = [minName, minRep !== undefined ? `${minRep.toLocaleString()} rep` : undefined, maxName, maxRep !== undefined ? `to ${maxRep.toLocaleString()} rep` : undefined]
      .filter(Boolean)
      .join(" ");
    return {
      type,
      label: [faction, range || "Reputation requirement"].filter(Boolean).join(": "),
      confidence: "resolved",
      rawType: prerequisite.type,
    };
  }
  if (type === "crimeStat") {
    const min = numberValue(prerequisite.attributes, ["minCrimeStat"]);
    const max = numberValue(prerequisite.attributes, ["maxCrimeStat"]);
    return {
      type,
      label: min !== undefined && min > 0
        ? `CrimeStat ${min}${max !== undefined ? `-${max}` : "+"} required`
        : `CrimeStat limited${max !== undefined ? ` to ${max} or below` : ""}`,
      confidence: "explicit",
      rawType: prerequisite.type,
      raw: { minCrimeStat: min, maxCrimeStat: max },
    };
  }
  if (type === "unlock") {
    return {
      type,
      label: "Prerequisite mission or completion tag",
      confidence: "unresolved",
      rawType: prerequisite.type,
        raw: { references: (prerequisite.references ?? []).slice(0, 6) },
    };
  }
  return {
    type: "unresolved",
    label: `${readableName(prerequisite.type)} unresolved`,
    confidence: "unresolved",
    rawType: prerequisite.type,
    raw: { references: (prerequisite.references ?? []).slice(0, 6) },
  };
}

function classifyLocationRefs(mission: RawMission, refMap: Map<string, RefIndexEntry>): PickupLocation["technicalRefs"] {
  return (mission.prerequisites ?? [])
    .filter((item) => prerequisiteType(item.type) === "location" || prerequisiteType(item.type) === "locality")
    .flatMap((item) => {
      const role = item.type === "ContractPrerequisite_Location"
        ? "availability / accepted-at"
        : item.type === "ContractPrerequisite_Locality"
          ? "locality pool"
          : item.type === "ContractPrerequisite_LocationProperty"
            ? "procedural region / placeholder"
            : "unknown location ref";
      const ref = guidValue(rawValue(item.attributes, ["locationAvailable", "localityAvailable", "location", "locality"]))
        ?? clean(rawValue(item.attributes, ["propertyVariableName", "propertyExtendedTextToken", "locationLevelType"]));
      if (!ref) return [];
      const entry = refMap.get(ref.toLowerCase());
      const consideredPickup = item.type === "ContractPrerequisite_Location" || item.type === "ContractPrerequisite_Locality";
      return [{
        role,
        ref,
        resolvedName: displayNameFromRef(entry),
        type: entry?.type ?? item.type,
        path: entry?.path,
        consideredPickup,
        reason: consideredPickup
          ? "Contract prerequisite gates mission availability."
          : "Location property shapes generated objective/placeholders and is not proven to control pickup.",
      }];
    });
}

function resolvePickupLocation(mission: RawMission, refMap: Map<string, RefIndexEntry>): PickupLocation {
  const technicalRefs = classifyLocationRefs(mission, refMap);
  const prerequisites = mission.prerequisites ?? [];
  const explicitLocationRefs = unique(prerequisites
    .filter((item) => item.type === "ContractPrerequisite_Location")
    .map((item) => guidValue(rawValue(item.attributes, ["locationAvailable", "availableAt", "acceptedAt", "offerLocation"]))));

  const exactLocations = explicitLocationRefs
    .map((ref) => ({ ref, entry: refMap.get(ref.toLowerCase()) }))
    .filter((item) => item.entry && item.entry.type !== "MissionLocality");

  if (exactLocations.length > 0) {
    const names = unique(exactLocations.map((item) => displayNameFromRef(item.entry)));
    const regions = unique(names.filter((name) => /^Region [A-D]$/i.test(name)));
    const hasPyroStar = exactLocations.some((item) => /PyroStar|pyrostar/i.test(`${item.entry?.recordName ?? ""} ${item.entry?.path ?? ""}`));
    if (hasPyroStar || (regions.length > 0 && exactLocations.some((item) => systemFromRef(item.entry) === "Pyro"))) {
      return {
        status: "system_scope",
        displayName: "Pyro system",
        system: "Pyro",
        locationType: "Procedural availability scope",
        localityPool: hasPyroStar ? "Pyro StarLocality" : "Pyro locality",
        regions,
        specificPickup: null,
        sourceRole: "system_scope",
        confidence: "partial",
        reason: "Procedural region scope. Specific pickup generated at mission offer.",
        sourceRefs: exactLocations.map((item) => item.ref),
        possibleLocations: names.filter((name) => name !== "Pyro Star"),
        unresolvedRefs: explicitLocationRefs.filter((ref) => !refMap.has(ref.toLowerCase())),
        technicalRefs,
      };
    }
    return {
      status: "exact",
      displayName: names.length ? names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : "") : "Pickup location resolved",
      system: systemFromRef(exactLocations[0]?.entry),
      parentLocation: undefined,
      locationType: exactLocations[0]?.entry?.type,
      sourceRole: "availability",
      confidence: "high",
      reason: "Resolved from ContractPrerequisite_Location.locationAvailable, which gates contract availability.",
      sourceRefs: exactLocations.map((item) => item.ref),
      possibleLocations: names,
      unresolvedRefs: explicitLocationRefs.filter((ref) => !refMap.has(ref.toLowerCase())),
      technicalRefs,
    };
  }

  const localityRefs = unique(prerequisites
    .filter((item) => item.type === "ContractPrerequisite_Locality")
    .map((item) => guidValue(rawValue(item.attributes, ["localityAvailable", "availableAt", "acceptedAt"]))));
  const resolvedLocalities = localityRefs
    .map((ref) => ({ ref, entry: refMap.get(ref.toLowerCase()) }))
    .filter((item) => item.entry?.type === "MissionLocality");

  if (resolvedLocalities.length > 0) {
    const names = unique(resolvedLocalities.map((item) => displayNameFromRef(item.entry))).filter(Boolean);
    const systems = unique(resolvedLocalities.map((item) => systemFromRef(item.entry)));
    const regions = unique(names.filter((name) => /^Region [A-D]$/i.test(name)));
    if (systems.length === 1 && systems[0] === "Pyro" && regions.length > 0) {
      return {
        status: "system_scope",
        displayName: "Pyro system",
        system: "Pyro",
        locationType: "MissionLocality procedural region scope",
        localityPool: "Pyro StarLocality",
        regions,
        specificPickup: null,
        sourceRole: "system_scope",
        confidence: "partial",
        reason: "Procedural region scope. Specific pickup generated at mission offer.",
        sourceRefs: resolvedLocalities.map((item) => item.ref),
        possibleLocations: names,
        unresolvedRefs: localityRefs.filter((ref) => !refMap.has(ref.toLowerCase())),
        technicalRefs,
      };
    }
    return {
      status: "generated_from_pool",
      displayName: names.length === 1 ? names[0]! : names.length ? `${names.slice(0, 3).join(", ")}${names.length > 3 ? ` +${names.length - 3}` : ""}` : "Mission locality",
      system: systems.length === 1 ? systems[0] : systems.length ? systems.join(", ") : undefined,
      locationType: "MissionLocality",
      sourceRole: "locality_pool",
      confidence: "medium",
      reason: "Resolved from ContractPrerequisite_Locality.localityAvailable; exact child pickup locations are generated by the locality pool.",
      sourceRefs: resolvedLocalities.map((item) => item.ref),
      possibleLocations: [],
      unresolvedRefs: localityRefs.filter((ref) => !refMap.has(ref.toLowerCase())),
      technicalRefs,
    };
  }

  const unresolvedRefs = unique([...explicitLocationRefs, ...localityRefs].filter((ref) => !refMap.has(ref.toLowerCase())));
  if (unresolvedRefs.length > 0) {
    return {
      status: "unresolved",
      displayName: "Unresolved",
      sourceRole: "unknown",
      confidence: "unresolved",
      reason: "Availability/location refs were present but did not resolve in the reference index.",
      sourceRefs: [...explicitLocationRefs, ...localityRefs],
      possibleLocations: [],
      unresolvedRefs,
      technicalRefs,
    };
  }

  return {
    status: "unknown",
    displayName: "Unknown",
    sourceRole: "unknown",
    confidence: "low",
    reason: "No accepted-at, offer, mission giver, explicit location, or pickup locality ref found.",
    sourceRefs: [],
    possibleLocations: [],
    unresolvedRefs: [],
    technicalRefs,
  };
}

function dedupePrerequisites(prerequisites: ShapedPrerequisite[]): ShapedPrerequisite[] {
  const grouped = new Map<string, ShapedPrerequisite>();
  for (const prerequisite of prerequisites) {
    const key = JSON.stringify([prerequisite.type, prerequisite.label, prerequisite.confidence, prerequisite.rawType, prerequisite.raw]);
    if (!grouped.has(key)) grouped.set(key, prerequisite);
  }
  return Array.from(grouped.values());
}

function reputationRewardLabel(path: RewardedReputationPath): string {
  if (path.confidence === "unresolved") return "Rep reward unresolved";
  return `${shortScopeLabel(path.scopeDisplayName)} ${formatSignedAmount(path.amount)}`;
}

function shapeCreditReward(mission: RawMission): { credits: string; creditStatus: ShapedVariant["rewards"]["creditStatus"]; creditsDetail: CreditRewardDetail; unresolvedTokens: string[] } {
  const projected = projectBrowserCreditV2(mission);
  if (projected.status === "provenAbsent") {
    return {
      credits: projected.displayText,
      creditStatus: "provenAbsent",
      creditsDetail: {
        status: "provenAbsent",
        displayText: projected.displayText,
        confidence: "proven_absent",
        sourceRefs: projected.sourceRefs,
      },
      unresolvedTokens: [],
    };
  }

  if (projected.status === "fixed") {
    return {
      credits: projected.displayText,
      creditStatus: "fixed",
      creditsDetail: {
        status: "fixed",
        amount: projected.amount,
        currency: projected.currency,
        max: projected.max,
        plusBonuses: projected.plusBonuses,
        confidence: "extracted_fixed",
        sourceResultType: "ContractResult_Reward",
        sourceRefs: projected.sourceRefs,
      },
      unresolvedTokens: [],
    };
  }

  if (projected.status === "calculated") {
    return {
      credits: projected.displayText,
      creditStatus: "calculated",
      creditsDetail: {
        status: "calculated",
        displayText: projected.displayText,
        amount: projected.amount,
        currency: projected.currency,
        confidence: "source_calculated",
        sourceResultType: "ContractResult_CalculatedReward",
        sourceRefs: projected.sourceRefs,
        payout: projected.payout,
      },
      unresolvedTokens: [],
    };
  }

  if (projected.status === "variable" || projected.status === "formula_unresolved") {
    return {
      credits: projected.displayText,
      creditStatus: projected.status,
      creditsDetail: {
        status: projected.status,
        displayText: projected.displayText,
        confidence: "calculated_unresolved",
        sourceResultType: "ContractResult_CalculatedReward",
        unresolvedReason: projected.unresolvedReason,
        sourceRefs: projected.sourceRefs,
        payout: projected.payout,
      },
      unresolvedTokens: [
        projected.status === "variable"
          ? "ContractResult_CalculatedReward:result_loop_verification_required"
          : "ContractResult_CalculatedReward:formula",
      ],
    };
  }

  return {
    credits: projected.displayText,
    creditStatus: "unresolved",
    creditsDetail: {
      status: "unresolved",
      displayText: projected.displayText,
      confidence: "unresolved",
      sourceResultType: projected.sourceResultType,
      unresolvedReason: projected.unresolvedReason,
      sourceRefs: projected.sourceRefs,
    },
    unresolvedTokens: [projected.sourceResultType ?? "unknown_credit_reward"],
  };
}

function shapeItemRewards(mission: RawMission): { itemRewards: ItemRewardDetail[]; itemRewardStatus: ShapedVariant["rewards"]["itemRewardStatus"]; unresolvedTokens: string[] } {
  const directItems = (mission.itemRewards ?? []).map((reward): ItemRewardDetail => {
    const entityClass = clean(reward.attributes?.entityClass);
    const resolvedName = clean(reward.resolved?.displayName);
    const itemKey = clean(reward.resolved?.guid) ?? entityClass;
    const base = {
      entityClass,
      amount: reward.attributes?.amount as number | string | null | undefined,
      displayName: resolvedName,
      itemKey,
      deliveryTarget: truthy(reward.attributes?.sendToPlayerHomeLocation) ? "player_home_location" as const : "unknown" as const,
      ownerOnly: truthy(reward.attributes?.awardOnlyToMissionOwner),
      sourceRefs: reward.sourceRefs ?? [],
    };
    if (resolvedName) {
      return {
        ...base,
        status: "resolved",
        confidence: "resolved_entityClass",
      };
    }
    return {
      ...base,
      status: "unresolved_entityClass",
      confidence: "unresolved_entityClass",
      unresolvedReason: "entityClass not resolved",
    };
  });

  const weightedItems = (mission.weightedItemRewards ?? []).map((reward): ItemRewardDetail => ({
    status: "weighted_unresolved",
    confidence: "weighted_unresolved",
    unresolvedReason: "Weighted item reward extraction is audited but not resolved.",
    sourceRefs: reward.sourceRefs ?? [],
    weightedOptions: (reward.items ?? []).map((item) => ({
      entityClass: item.entityClass,
      weight: item.weight,
      displayName: clean(item.resolved?.displayName),
      itemKey: clean(item.resolved?.guid) ?? clean(item.entityClass),
    })),
  }));

  const itemRewards = [...directItems, ...weightedItems];
  if (!itemRewards.length) return { itemRewards, itemRewardStatus: "none", unresolvedTokens: [] };
  if (itemRewards.some((reward) => reward.status === "weighted_unresolved")) return { itemRewards, itemRewardStatus: "weighted_unresolved", unresolvedTokens: ["ContractResult_ItemsWeighting"] };
  if (itemRewards.some((reward) => reward.status === "unresolved_entityClass")) return { itemRewards, itemRewardStatus: "unresolved_entityClass", unresolvedTokens: ["ContractResult_Item:entityClass"] };
  return { itemRewards, itemRewardStatus: "resolved", unresolvedTokens: [] };
}

function shapeRewards(
  mission: RawMission,
  pools: Map<string, BlueprintPoolLookup>,
  craftingBlueprints: Map<string, CraftingBlueprintLookup>,
  rewardedReputationPaths: RewardedReputationPath[],
): ShapedVariant["rewards"] {
  const blueprintRewardGroups: BlueprintRewardGroup[] = unique((mission.blueprintRewards ?? []).map((reward) => clean(reward.blueprintPoolGuid)))
    .map((poolGuid) => {
      const pool = pools.get(String(poolGuid ?? "").toLowerCase());
      const rewards = (pool?.rewards ?? []).map((item) => {
        const craftingItem = craftingBlueprints.get(String(item.blueprintGuid ?? "").toLowerCase());
        return {
          blueprintGuid: item.blueprintGuid,
          displayName: item.displayName ?? item.blueprintName ?? craftingItem?.name ?? item.blueprintGuid ?? "Unknown blueprint",
          componentType: item.componentType ?? craftingItem?.typeLabel ?? craftingItem?.type,
          size: item.size ?? clean(craftingItem?.size),
          grade: item.grade ?? clean(craftingItem?.grade),
          chanceLabel: chanceLabel(item.poolChance),
        };
      });
      const chanceLabels = unique(rewards.map((item) => item.chanceLabel));
      const missionReward = (mission.blueprintRewards ?? []).find(
        (reward) => clean(reward.blueprintPoolGuid)?.toLowerCase() === String(poolGuid ?? "").toLowerCase(),
      );
      return {
        poolGuid,
        poolName: pool?.displayName ?? pool?.poolName ?? "Unknown blueprint pool",
        rewardCount: rewards.length,
        missionChanceLabel: chanceLabel(missionReward?.chance),
        chanceLabel: chanceLabels.length === 1 ? `${chanceLabels[0]} - 1 of ${rewards.length}` : undefined,
        rewards,
      };
    });

  const blueprintRewards = unique((mission.blueprintRewards ?? []).flatMap((reward) => {
    const pool = pools.get(String(reward.blueprintPoolGuid ?? "").toLowerCase());
    const poolName = pool?.displayName ?? pool?.poolName;
    const blueprintNames = pool?.rewards?.map((item) => item.displayName ?? item.blueprintGuid).filter(Boolean).slice(0, 4) ?? [];
    const suffix = (pool?.rewards?.length ?? 0) > 4 ? ` +${(pool?.rewards?.length ?? 0) - 4}` : "";
    return poolName ? [`${poolName}${blueprintNames.length ? `: ${blueprintNames.join(", ")}${suffix}` : ""}`] : ["Unknown blueprint pool"];
  }));

  const reputationRewards = unique(rewardedReputationPaths.map(reputationRewardLabel));
  const creditReward = shapeCreditReward(mission);
  const itemReward = shapeItemRewards(mission);

  const unresolvedRewardTokens = unique([
    ...(mission.blueprintRewards ?? []).filter((reward) => !pools.has(String(reward.blueprintPoolGuid ?? "").toLowerCase())).map((reward) => clean(reward.blueprintPoolGuid) ?? "unknown blueprint pool"),
    ...creditReward.unresolvedTokens,
    ...itemReward.unresolvedTokens,
  ]);

  const summary = unique([
    ...blueprintRewards.map((reward) => `Blueprint: ${reward}`),
    ...reputationRewards,
    creditReward.credits,
    ...itemReward.itemRewards.map((reward) => reward.status === "resolved" ? `Item reward: ${reward.displayName ?? reward.entityClass ?? "Unknown item"}` : "Item reward unresolved"),
    (mission.completionTags ?? []).length > 0 ? "Completion tag" : undefined,
  ]);

  return {
    summary,
    blueprintRewards,
    blueprintRewardGroups,
    reputationRewards,
    credits: creditReward.credits,
    creditStatus: creditReward.creditStatus,
    creditsDetail: creditReward.creditsDetail,
    itemRewards: itemReward.itemRewards,
    itemRewardStatus: itemReward.itemRewardStatus,
    unresolvedRewardTokens,
  };
}

function shapeVariant(
  catalog: RawCatalog,
  mission: RawMission,
  pools: Map<string, BlueprintPoolLookup>,
  craftingBlueprints: Map<string, CraftingBlueprintLookup>,
  refMap: Map<string, RefIndexEntry>,
): ShapedVariant {
  const prerequisites = dedupePrerequisites([
    ...(mission.minStanding || mission.maxStanding
      ? [{
        type: "standing" as const,
        label: formatStandingRange(mission.minStanding, mission.maxStanding),
        confidence: "resolved" as const,
        rawType: "standingRange",
      }]
      : []),
    ...(mission.prerequisites ?? []).map((item) => shapePrerequisite(item, mission, refMap)),
  ]);
  const locations = unique(prerequisites.filter((item) => (item.type === "location" || item.type === "locality") && item.confidence === "resolved").map((item) => item.label));
  const unresolvedLocationTokens = unique(prerequisites
    .filter((item) => (item.type === "location" || item.type === "locality") && item.confidence === "unresolved")
    .flatMap((item) => [clean(item.raw?.token)]));
  const lawful = classifyLawful(mission);
  const prerequisiteSummary = unique(prerequisites.map((item) => item.label)).slice(0, 3).join("; ") || "No extracted prerequisites";
  const placeholderTokens = extractMissionPlaceholderTokens(mission);
  const { destinationTokens, objectiveTokens } = classifyTextLocationTokens(placeholderTokens);
  const pickupLocationBase = resolvePickupLocation(mission, refMap);
  const pickupRole = buildPickupLocationRole(pickupLocationBase, unresolvedLocationTokens);
  const pickupLocation: PickupLocation = {
    ...pickupLocationBase,
    rawLocalities: pickupRole.rawLocalities,
    grouping: pickupRole.grouping,
  };
  const locationRefs = buildLocationRefs(mission, refMap, destinationTokens, objectiveTokens);
  const destinationRefValues = locationRefs.filter((item) => item.role === "destination");
  const objectiveRefValues = locationRefs.filter((item) => item.role === "objective");
  const locationRoles: MissionLocationRoles = {
    pickup: pickupRole,
    destination: destinationTokens.length
      ? buildUnresolvedLocationRole(
        "unresolved",
        "Destination unresolved",
        destinationRefValues.map((item) => item.guidOrToken),
        [],
        destinationTokens,
        "unresolved",
      )
      : buildUnresolvedLocationRole("unknown", "Unknown destination", [], [], [], "low"),
    objective: (objectiveTokens.length || locationRefs.some((item) => item.role === "objective" && item.confidence === "resolved"))
      ? buildUnresolvedLocationRole(
        objectiveTokens.length ? "unresolved" : "unknown",
        objectiveTokens.length ? "Objective location unresolved" : "Objective location",
        objectiveRefValues.map((item) => item.guidOrToken),
        [],
        objectiveTokens,
        objectiveTokens.length ? "unresolved" : "low",
        unique(objectiveRefValues.map((item) => item.system)),
      )
      : buildUnresolvedLocationRole("unknown", "Unknown objective location", [], [], [], "low"),
  };
  const missionArchetype = classifyMissionArchetype(mission);
  const resolvedTitle = variantTitle(mission, missionArchetype, pickupLocation);
  const reputationScope = resolveReputationScope(mission, refMap, missionArchetype);
  const rewardedReputationPaths = shapeRewardedReputationPaths(mission, refMap, reputationScope);
  const rewards = shapeRewards(mission, pools, craftingBlueprints, rewardedReputationPaths);
  const crimeRequirement = crimeStatRequirement(mission.prerequisites ?? []);
  const objectiveSignature = deriveObjectiveSignature(
    mission,
    reputationScope,
    missionArchetype,
    pickupLocation,
    lawful.lawfulClassification,
    crimeRequirement,
    resolvedTitle,
  );
  const conceptKey = createHash("sha256").update(objectiveSignature.key).digest("hex").slice(0, 20);
  const tier = deriveTier(mission);
  const isIntro = objectiveSignature.introState === "intro";
  const specificityBadges = unique([
    missionArchetype,
    isIntro ? "Intro" : undefined,
    lawful.lawfulClassification === "unlawful" ? "Possible unlawful" : undefined,
    crimeRequirement === "required" ? "CrimeStat required" : crimeRequirement === "bounded" ? "CrimeStat limited" : undefined,
    pickupLocation.status === "generated_from_pool" ? "Generated pickup pool" : undefined,
  ]);

  return {
    variantKey: mission.contractId,
    familyKey: mission.familyId ?? mission.contractId,
    conceptKey,
    objectiveSignature,
    tierKey: tier.tierKey,
    tierLabel: tier.tierLabel,
    isIntro,
    specificityBadges,
    owningScopeProvenance: {
      scopeKey: reputationScope.scopeKey,
      confidence: reputationScope.confidence,
      sourceRefs: reputationScope.sourceRefs,
      unresolvedReason: reputationScope.unresolvedReason,
    },
    displayName: resolvedTitle.displayName,
    titleSource: resolvedTitle.titleSource,
    titleConfidence: resolvedTitle.titleConfidence,
    briefing: cleanBriefing(mission.description),
    rawName: mission.titleRaw,
    internalName: mission.debugName,
    missionType: mission.missionType ?? mission.contractType ?? "Unknown type",
    provider: mission.factionName ?? "Unknown provider",
    faction: mission.factionName ?? "Unknown faction",
    contractType: mission.contractType ?? "Unknown contract",
    reputationScope,
    missionArchetype,
    standingRequirement: formatStandingRange(mission.minStanding, mission.maxStanding),
    reputationRequirement: prerequisites.find((item) => item.type === "reputation")?.label,
    prerequisiteSummary,
    prerequisites,
    pickupLocation,
    locationRoles,
    locationRefs,
    locations,
    unresolvedLocationTokens,
    destinationTokens,
    rewards,
    rewardedReputationPaths,
    flags: missionFlags(mission),
    releaseFlags: releaseFlags(mission),
    crimeStatRequirement: crimeRequirement,
    ...lawful,
    confidence: {
      hasUnresolvedLocation: pickupLocation.status === "unresolved" || unresolvedLocationTokens.length > 0,
      hasUnresolvedRewards: rewards.creditStatus === "formula_unresolved" || rewards.creditStatus === "unresolved" || rewards.unresolvedRewardTokens.length > 0,
      hasUnresolvedPrerequisites: prerequisites.some((item) => item.confidence === "unresolved"),
    },
    canonical: normalizeCanonicalMissionVariantV2(catalog, mission),
    requiredItems: normalizeRequiredItemsV2(mission),
    technical: {
      contractId: mission.contractId,
      generatorGuid: mission.generatorGuid,
      generatorName: mission.generatorName,
      generatorPath: mission.generatorPath,
      handlerType: mission.handlerType,
      titleRaw: mission.titleRaw,
      descriptionRaw: mission.descriptionRaw,
    },
  };
}

function aggregateCrimeStat(variants: ShapedVariant[]): ShapedFamily["crimeStatRequirement"] {
  if (variants.some((variant) => variant.crimeStatRequirement === "required")) return "required";
  if (variants.some((variant) => variant.crimeStatRequirement === "bounded")) return "bounded";
  if (variants.some((variant) => variant.crimeStatRequirement === "notRequired")) return "notRequired";
  return "unknown";
}

function summarizeFamilyCredits(variants: ShapedVariant[]): string {
  if (!variants.length) return "No credit reward extracted";
  const statuses = unique(variants.map((variant) => variant.rewards.creditStatus));
  if (statuses.length === 1) {
    const status = statuses[0];
    if (status === "fixed") {
      const values = unique(variants.map((variant) => variant.rewards.credits));
      return values.length === 1 ? values[0]! : "Credits vary by variant";
    }
    if (status === "calculated") return "Calculated payout";
    if (status === "formula_unresolved") return "Credits formula unresolved";
    if (status === "variable") return "Variable payout";
    if (status === "provenAbsent") return "No credit reward extracted";
    return "Credits unresolved";
  }
  if (statuses.includes("unresolved")) return "Credits unresolved";
  if (statuses.includes("formula_unresolved")) return "Credits formula unresolved";
  if (statuses.includes("variable")) return "Variable payout";
  if (statuses.includes("calculated")) return "Calculated payout";
  if (statuses.includes("fixed")) return "Credits vary by variant";
  return "No credit reward extracted";
}

function aggregateLawful(variants: ShapedVariant[]): Pick<ShapedFamily, "lawfulClassification" | "lawfulConfidence"> {
  if (variants.some((variant) => variant.lawfulClassification === "unlawful")) return { lawfulClassification: "unlawful", lawfulConfidence: "inferred" };
  if (variants.some((variant) => variant.lawfulClassification === "lawful")) return { lawfulClassification: "lawful", lawfulConfidence: "inferred" };
  return { lawfulClassification: "unknown", lawfulConfidence: "unknown" };
}

function familyPickupSummary(variants: ShapedVariant[]): Pick<ShapedFamily, "pickupSummary" | "pickupStatuses" | "pickupUnresolvedCount"> {
  const pickups = variants.map((variant) => variant.pickupLocation);
  const pickupRoles = variants.map((variant) => variant.locationRoles.pickup);
  const statuses = unique(pickups.map((pickup) => pickup.status)) as PickupLocation["status"][];
  const unresolved = pickups.filter((pickup) => pickup.status === "unknown" || pickup.status === "unresolved").length;
  const generated = pickups.filter((pickup) => pickup.status === "generated_from_pool");
  if (generated.length === pickups.length && generated.length > 0) {
    const systems = unique(pickupRoles.map((role) => role.grouping.displayLabel).filter(Boolean));
    if (systems.length === 1) {
      return {
        pickupSummary: `Pickup: ${systems[0]}`,
        pickupStatuses: statuses,
        pickupUnresolvedCount: unresolved,
      };
    }
    const names = unique(generated.map((pickup) => pickup.displayName));
    return {
      pickupSummary: `Pickup: Generated from ${names.length === 1 ? names[0] : `${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2}` : ""}`} pool`,
      pickupStatuses: statuses,
      pickupUnresolvedCount: unresolved,
    };
  }
  const scopes = unique(pickups.flatMap((pickup) => pickup.system ? [pickup.system] : pickup.status === "exact" ? [pickup.displayName] : []));
  if (scopes.length) {
    return {
      pickupSummary: scopes.length > 3 ? `Pickup: ${scopes.slice(0, 3).join(", ")} +${scopes.length - 3} more` : `Pickup: ${scopes.join(", ")}`,
      pickupStatuses: statuses,
      pickupUnresolvedCount: unresolved,
    };
  }
  return {
    pickupSummary: unresolved ? `Pickup: unresolved for ${unresolved} variant${unresolved === 1 ? "" : "s"}` : "Pickup: unknown",
    pickupStatuses: statuses,
    pickupUnresolvedCount: unresolved,
  };
}

function aggregateLocationRole(
  roles: UnresolvedLocationRole[],
  fallbackDisplayName: string,
): UnresolvedLocationRole {
  const unresolved = roles.some((role) => role.status === "unresolved");
  const sourceRefs = unique(roles.flatMap((role) => role.sourceRefs));
  const unresolvedRefs = unique(roles.flatMap((role) => role.unresolvedRefs));
  const sourceTextTokens = unique(roles.flatMap((role) => role.sourceTextTokens));
  const systems = unique(roles.flatMap((role) => role.systems));
  return {
    status: unresolved ? "unresolved" : "unknown",
    displayName: unresolved ? fallbackDisplayName : `Unknown ${fallbackDisplayName.toLowerCase()}`,
    displayLabel: unresolved ? fallbackDisplayName : `Unknown ${fallbackDisplayName.toLowerCase()}`,
    systems,
    primarySystem: systems[0],
    confidence: unresolved ? "unresolved" : "low",
    sourceRefs,
    unresolvedRefs,
    sourceTextTokens,
    unresolved,
  };
}

function aggregateFamilyPickupRole(variants: ShapedVariant[], pickupSummary: string): PickupLocationRole {
  const pickupRoles = variants.map((variant) => variant.locationRoles.pickup);
  const systems = normalizeSystemLabels(pickupRoles.flatMap((role) => role.grouping.systems));
  const localityNames = unique(pickupRoles.flatMap((role) => role.grouping.localityNames));
  const primarySystem = systems.length === 1 ? systems[0] : systems[0];
  const displayLabel = systems.length === 1 ? systems[0]! : systems.length > 1 ? systems.slice(0, 3).join(", ") : pickupRoles[0]?.displayLabel ?? "Unknown pickup";
  const detailDisplay = pickupSummary.replace(/^Pickup:\s*/i, "").trim() || displayLabel;
  const statuses = unique(pickupRoles.map((role) => role.status));
  const status = statuses.length === 1
    ? statuses[0]!
    : statuses.includes("unresolved")
      ? "unresolved"
      : statuses.includes("unknown")
        ? "unknown"
        : statuses.includes("system_scope")
          ? "system_scope"
          : statuses.includes("generated_from_pool")
            ? "generated_from_pool"
            : "exact";
  return {
    status,
    displayName: pickupRoles[0]?.displayName ?? displayLabel,
    displayLabel,
    detailDisplay,
    systems,
    primarySystem,
    confidence: pickupRoles.some((role) => role.confidence === "unresolved")
      ? "unresolved"
      : pickupRoles.some((role) => role.confidence === "partial")
        ? "partial"
        : pickupRoles.some((role) => role.confidence === "medium")
          ? "medium"
          : pickupRoles.some((role) => role.confidence === "high")
            ? "high"
            : "low",
    sourceRole: pickupRoles[0]?.sourceRole ?? "unknown",
    sourceRefs: unique(pickupRoles.flatMap((role) => role.sourceRefs)),
    unresolvedRefs: unique(pickupRoles.flatMap((role) => role.unresolvedRefs)),
    unresolvedLocationTokens: unique(variants.flatMap((variant) => variant.unresolvedLocationTokens)),
    generatedFromPool: pickupRoles.every((role) => role.generatedFromPool),
    systemScope: pickupRoles.every((role) => role.systemScope),
    rawLocalities: Array.from(new Map(pickupRoles.flatMap((role) => role.rawLocalities).map((item) => [item.guid.toLowerCase(), item])).values()),
    grouping: {
      systems,
      localityNames,
      displayLabel,
      detailLabel: detailDisplay,
      confidence: statuses.length === 1
        ? status
        : statuses.includes("unresolved")
          ? "unresolved"
          : statuses.includes("unknown")
            ? "unknown"
            : "partial",
    },
  };
}

function commonTitlePrefix(titles: string[]): string | undefined {
  if (titles.length < 2) return undefined;
  const normalized = titles
    .map((title) => title.replace(/\s+-\s+.*$/, "").replace(/\s*\([^)]*\)\s*$/, "").trim())
    .filter((title) => title.length >= 8);
  if (normalized.length < 2) return undefined;
  let prefix = normalized[0] ?? "";
  for (const title of normalized.slice(1)) {
    let index = 0;
    while (index < prefix.length && index < title.length && prefix[index]?.toLowerCase() === title[index]?.toLowerCase()) index += 1;
    prefix = prefix.slice(0, index).trim();
    if (prefix.length < 8) return undefined;
  }
  return prefix.replace(/[|:,\-\s]+$/, "").trim();
}

function providerArchetypeName(provider: string, missionType: string): string | undefined {
  if (!provider || /^Unknown/i.test(provider) || !missionType || /^Unknown/i.test(missionType)) return undefined;
  return `${provider} ${missionType}`;
}

function resolveFamilyTitle(
  variants: ShapedVariant[],
  rawRepresentative: RawMission | undefined,
  provider: string,
  missionType: string,
): Pick<ShapedFamily, "displayName" | "titleSource" | "titleConfidence"> {
  const localizedFamilyTitle = rawRepresentative ? localizedTitle(rawRepresentative) : undefined;
  const cleanVariantTitles = variants
    .filter((variant) => variant.titleSource !== "internal_fallback" && !isInternalTitle(variant.displayName) && !hasUnresolvedTitleToken(variant.displayName))
    .map((variant) => variant.displayName);

  if (localizedFamilyTitle && !hasUnresolvedTitleToken(localizedFamilyTitle) && cleanVariantTitles.every((title) => title === localizedFamilyTitle)) {
    return { displayName: localizedFamilyTitle, titleSource: "localized_family", titleConfidence: "high" };
  }

  if (
    localizedFamilyTitle
    && hasUnresolvedTitleToken(localizedFamilyTitle)
    && variants.every((variant) => variant.displayName === localizedFamilyTitle)
  ) {
    return { displayName: localizedFamilyTitle, titleSource: "token_template_cleaned", titleConfidence: "medium" };
  }

  const cleanedFamilyTitle = cleanTemplateTitle(localizedFamilyTitle);
  if (cleanedFamilyTitle && cleanVariantTitles.every((title) => title === cleanedFamilyTitle)) {
    return { displayName: cleanedFamilyTitle, titleSource: "token_template_cleaned", titleConfidence: "medium" };
  }

  const counts = new Map<string, number>();
  for (const title of cleanVariantTitles) counts.set(title, (counts.get(title) ?? 0) + 1);
  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const dominant = ranked[0];
  if (dominant && dominant[1] >= 2) {
    return {
      displayName: dominant[0],
      titleSource: "shared_variant_localized",
      titleConfidence: dominant[1] === variants.length ? "high" : "medium",
    };
  }

  const prefix = commonTitlePrefix(cleanVariantTitles);
  if (prefix) return { displayName: prefix, titleSource: "common_variant_title", titleConfidence: "medium" };

  const providerFallback = providerArchetypeName(provider, missionType);
  if (providerFallback) return { displayName: providerFallback, titleSource: "provider_archetype_fallback", titleConfidence: "low" };

  return {
    displayName: readableName(rawRepresentative?.handlerDebugName ?? rawRepresentative?.generatorName ?? rawRepresentative?.familyId),
    titleSource: "internal_fallback",
    titleConfidence: "low",
  };
}

function shapeFamily(familyKey: string, variants: ShapedVariant[], rawVariants: RawMission[]): ShapedFamily {
  const representative = variants[0];
  const rawRepresentative = rawVariants[0];
  const provider = firstKnown(unique(variants.map((variant) => variant.provider)), "Unknown provider");
  const missionType = firstKnown(unique(variants.map((variant) => variant.missionType)), "Unknown type");
  const reputationScope = variants[0]?.reputationScope ?? {
    scopeKey: `${keySlug(provider)}:unknown-scope`,
    displayName: "Unknown scope",
    factionKey: keySlug(provider),
    factionDisplayName: provider,
    trackType: "Unknown",
    confidence: "unresolved" as const,
    sourceRefs: [],
    unresolvedReason: "No variants available.",
  };
  const archetypes = unique(variants.map((variant) => variant.missionArchetype));
  const missionArchetype = archetypes.length === 1 ? archetypes[0]! : archetypes.length ? `${archetypes[0]} +${archetypes.length - 1}` : "Other / unresolved";
  const release = unique(variants.flatMap((variant) => variant.releaseFlags));
  const rewards = unique(variants.flatMap((variant) => variant.rewards.summary)).slice(0, 8);
  const unresolvedRewardFields = unique(variants.flatMap((variant) => variant.rewards.unresolvedRewardTokens));
  const confidenceFlags = unique([
    variants.some((variant) => variant.confidence.hasUnresolvedLocation) ? "Location unresolved" : undefined,
    variants.some((variant) => variant.confidence.hasUnresolvedRewards) ? "Reward data unresolved" : undefined,
    variants.some((variant) => variant.confidence.hasUnresolvedPrerequisites) ? "Prerequisite unresolved" : undefined,
    variants.some((variant) => variant.lawfulClassification === "unlawful" && variant.lawfulConfidence !== "explicit") ? "Unlawful context, requirement unconfirmed" : undefined,
  ]);
  const resolvedTitle = resolveFamilyTitle(variants, rawRepresentative, provider, missionType);
  const lawful = aggregateLawful(variants);
  const pickup = familyPickupSummary(variants);
  const locationRoles: MissionLocationRoles = {
    pickup: aggregateFamilyPickupRole(variants, pickup.pickupSummary),
    destination: aggregateLocationRole(variants.map((variant) => variant.locationRoles.destination), "Destination unresolved"),
    objective: aggregateLocationRole(variants.map((variant) => variant.locationRoles.objective), "Objective location unresolved"),
  };
  const locationRefs = Array.from(
    new Map(variants.flatMap((variant) => variant.locationRefs)
      .map((item) => [JSON.stringify([item.role, item.rawType, item.attr, item.guidOrToken, item.resolvedName, item.system, item.confidence]), item])).values()
  );
  const rewardedReputationPaths = Array.from(
    new Map(
      variants.flatMap((variant) => variant.rewardedReputationPaths)
        .map((path) => [JSON.stringify([path.factionKey, path.scopeKey, path.amount, path.confidence, path.sourceRefs]), path])
    ).values()
  );
  const creditRewardStatuses = unique(variants.map((variant) => variant.rewards.creditStatus));
  const creditRewardSummary = summarizeFamilyCredits(variants);
  const itemRewardStatuses = unique(variants.map((variant) => variant.rewards.itemRewardStatus).filter((status) => status !== "none"));
  const itemRewardStatus = itemRewardStatuses.includes("weighted_unresolved")
    ? "weighted_unresolved"
    : itemRewardStatuses.includes("unresolved_entityClass")
      ? "unresolved_entityClass"
      : itemRewardStatuses.includes("resolved")
        ? "resolved"
        : "none";

  return {
    familyKey,
    displayName: resolvedTitle.displayName,
    titleSource: resolvedTitle.titleSource,
    titleConfidence: resolvedTitle.titleConfidence,
    rawName: rawRepresentative?.handlerDebugName ?? rawRepresentative?.generatorName,
    internalName: rawRepresentative?.debugName,
    provider,
    faction: firstKnown(unique(variants.map((variant) => variant.faction)), "Unknown faction"),
    missionType,
    reputationScope,
    missionArchetype,
    variantCount: variants.length,
    statusFlags: unique(variants.flatMap((variant) => variant.flags)),
    releaseFlags: release,
    rewardSummary: rewards,
    blueprintRewards: unique(variants.flatMap((variant) => variant.rewards.blueprintRewards)).slice(0, 10),
    blueprintRewardGroups: Array.from(
      new Map(
        variants.flatMap((variant) => variant.rewards.blueprintRewardGroups)
          .map((group) => [group.poolGuid ?? group.poolName, group])
      ).values()
    ).slice(0, 12),
    reputationRewards: unique(variants.flatMap((variant) => variant.rewards.reputationRewards)).slice(0, 8),
    rewardedReputationPaths,
    creditRewardSummary,
    creditRewardStatuses,
    itemRewardStatus,
    unresolvedRewardFields,
    reputationRequirement: unique(variants.map((variant) => variant.reputationRequirement)).join("; ") || undefined,
    prerequisiteRequirements: unique(variants.flatMap((variant) => variant.prerequisites.map((item) => item.label))).slice(0, 10),
    ...pickup,
    locationRoles,
    locationRefs,
    crimeStatRequirement: aggregateCrimeStat(variants),
    ...lawful,
    locations: unique(variants.flatMap((variant) => variant.locations)).slice(0, 8),
    unresolvedLocationTokens: unique(variants.flatMap((variant) => variant.unresolvedLocationTokens)).slice(0, 20),
    destinationTokens: unique(variants.flatMap((variant) => variant.destinationTokens)).slice(0, 20),
    confidenceFlags,
    unresolvedReferences: unique(variants.flatMap((variant) => [
      ...variant.unresolvedLocationTokens,
      ...variant.rewards.unresolvedRewardTokens,
    ])).slice(0, 30),
    variantKeys: variants.map((variant) => variant.variantKey),
    searchText: unique([
      resolvedTitle.displayName,
      representative?.displayName,
      representative?.internalName,
      representative?.provider,
      representative?.missionType,
      reputationScope.displayName,
      missionArchetype,
      pickup.pickupSummary,
      representative?.briefing,
      ...variants.map((variant) => variant.displayName),
      ...variants.map((variant) => variant.technical.contractId),
      ...rewards,
    ]).join(" ").toLowerCase(),
  };
}

function deriveDisplayCategory(
  activityKey: string,
  archetypes: string[],
  reputationScope: ReputationScope,
  familyKeys: string[],
  displayName: string,
  groupingEvidence: string[],
): { displayCategory: DisplayCategory; displaySubcategories: string[] } {
  const activityParts = activityKey.split("+").filter(Boolean);
  const archetypeKeys = archetypes.map(keySlug);
  const evidence = [
    ...activityParts.map((activity) => `activity:${activity}`),
    ...archetypes.map((archetype) => `archetype:${keySlug(archetype)}`),
  ];
  const hasActivity = (...values: string[]) => values.some((value) => activityParts.includes(value));
  const hasActivityContaining = (...values: string[]) => values.some((value) => activityParts.some((activity) => activity.includes(value)));
  const hasArchetype = (...values: string[]) => values.some((value) => archetypeKeys.includes(keySlug(value)));
  const familyText = familyKeys.join(" ").toLowerCase();
  const contextText = [displayName, familyText, ...groupingEvidence].join(" ").toLowerCase();
  const secondaryActivityCategories = activityParts.length > 1
    ? unique([
      activityParts.some((activity) => /missing-person-investigation|search-body/.test(activity)) ? "Investigation" : undefined,
      activityParts.some((activity) => /salvage/.test(activity)) ? "Salvage" : undefined,
      activityParts.some((activity) => /recover-cargo|retrieve-cargo|steal-cargo/.test(activity)) ? "Cargo Recovery" : undefined,
      activityParts.some((activity) => /courier-delivery|deliver/.test(activity)) ? "Delivery" : undefined,
      activityParts.some((activity) => /defend|escort|patrol/.test(activity)) ? "Security" : undefined,
      activityParts.some((activity) => /eliminate|destroy-items|sabotage|ambush/.test(activity)) ? "Mercenary" : undefined,
    ].filter((value): value is string => Boolean(value)))
    : [];
  const result = (
    label: string,
    source: DisplayCategory["source"],
    confidence: DisplayCategory["confidence"],
    reason: string,
    displaySubcategories: string[] = [],
  ) => ({
    displayCategory: {
      version: 2 as const,
      key: keySlug(label),
      label,
      confidence,
      source,
      evidence: unique([...evidence, reason]),
    },
    displaySubcategories: unique([
      ...displaySubcategories,
      ...secondaryActivityCategories.filter((subcategory) => subcategory !== label),
    ]),
  });

  if (hasActivity("collector-offer")) return result("Collection", "activity", "resolved", "rule:collector-offer");
  if (hasActivityContaining("missing-person-investigation", "search-body") || hasArchetype("Investigation")) {
    return result("Investigation", hasArchetype("Investigation") ? "combined" : "activity", "resolved", "rule:investigation");
  }
  if (hasActivityContaining("salvage") || hasArchetype("Salvage")) {
    return result("Salvage", hasArchetype("Salvage") ? "combined" : "activity", "resolved", "rule:salvage");
  }
  if (hasActivity("mining-fps") || hasArchetype("Hand Mining")) {
    return result("Hand Mining", hasArchetype("Hand Mining") ? "combined" : "activity", "resolved", "rule:hand-mining");
  }
  if (hasActivity("resource-gathering") || archetypes.some((archetype) => /\bmining\b/i.test(archetype))) {
    return result("Mining", "combined", "inferred", "rule:resource-gathering-or-mining-archetype");
  }
  if (hasActivity("repair")) return result("Repair", "activity", "resolved", "rule:repair");
  if (hasActivity("refuel") || hasArchetype("Refuel")) return result("Refueling", "combined", "resolved", "rule:refuel");
  if (hasActivity("resupply")) return result("Delivery", "activity", "resolved", "rule:resupply-delivery");
  if (/\bracing\b/i.test(reputationScope.trackType) || archetypes.some((archetype) => /\bracing\b/i.test(archetype))) {
    return result("Racing", "combined", "resolved", "rule:racing-track-or-archetype");
  }
  if (hasActivityContaining("bounty") || hasArchetype("Bounty")) {
    return result("Bounty", hasArchetype("Bounty") ? "combined" : "activity", "resolved", "rule:bounty");
  }
  if (hasArchetype("Courier") || hasActivity("courier-delivery")) {
    return result("Courier", hasArchetype("Courier") ? "combined" : "activity", "resolved", "rule:courier");
  }
  if (hasActivityContaining("recover-cargo", "retrieve-cargo", "steal-cargo")) {
    return result("Cargo Recovery", hasArchetype("Cargo") ? "combined" : "activity", "resolved", "rule:cargo-recovery");
  }
  if (hasActivity("deliver") || hasArchetype("Cargo")) {
    const subcategories = [
      /interstellar|intersteller|system[_\s-]?to[_\s-]?system/.test(familyText) ? "Hauling - Interstellar" : undefined,
      /planetary|local|region|linehaul/.test(familyText) ? "Hauling - Stellar" : undefined,
    ].filter((value): value is string => Boolean(value));
    return result("Hauling", hasArchetype("Cargo") ? "combined" : "activity", "resolved", "rule:cargo-logistics", subcategories);
  }
  if (hasArchetype("Recovery")) {
    if (/recover-data|collect-data|retrieve-vanduul-data|station-assault|missing-person/.test(contextText)) {
      return result("Investigation", "combined", "inferred", "rule:recovery-investigation-evidence", ["Retrieval"]);
    }
    if (/black.?box|recover-item|recover-package|spacecollect-cargo|retrieve-item/.test(contextText)) {
      return result("Retrieval", "combined", "inferred", "rule:recovery-retrieval-evidence");
    }
    return result("Recovery", "archetype", "inferred", "rule:recovery-archetype-conservative");
  }
  if (hasActivityContaining("defend", "escort", "patrol")) {
    return result("Security", "activity", "resolved", "rule:security-operation");
  }
  if (
    hasArchetype("Mercenary", "Ambush", "Defend Ship", "Assassination")
    || hasActivityContaining("eliminate", "ambush", "patrol", "defend", "escort", "destroy-items", "sabotage")
  ) {
    return result("Mercenary", hasArchetype("Mercenary", "Ambush", "Defend Ship", "Assassination") ? "combined" : "activity", "resolved", "rule:combat-or-security-operation");
  }
  if (activityKey === "unknown") {
    if (/wildstar-racing-open-track|open track/.test(contextText)) return result("Racing", "fallback", "inferred", "rule:racing-handler-or-title");
    if (/asdfacility-delving|jorrit dossier/.test(contextText)) return result("Investigation", "fallback", "inferred", "rule:dossier-investigation-evidence");
    if (/mining rights/.test(contextText)) return result("Mining", "fallback", "inferred", "rule:mining-rights-title");
    if (/hijacked-ship|hijacked ship|boarding action/.test(contextText)) return result("Security", "fallback", "inferred", "rule:hijacked-ship-security-evidence");
    if (/criminal-kills|demolition|bombing|strike-group|strike group|hunt-the-polaris|hunt the polaris/.test(contextText)) {
      return result("Mercenary", "fallback", "inferred", "rule:combat-handler-or-title");
    }
  }
  return result("Other / Unresolved", "fallback", "unresolved", activityKey === "unknown" ? "rule:unknown-activity" : "rule:no-category-rule-matched");
}

function shapeConcepts(variants: ShapedVariant[]): MissionConcept[] {
  const byConcept = new Map<string, ShapedVariant[]>();
  for (const variant of variants) {
    byConcept.set(variant.conceptKey, [...(byConcept.get(variant.conceptKey) ?? []), variant]);
  }
  return Array.from(byConcept.entries()).map(([conceptKey, conceptVariants]) => {
    const representative = conceptVariants[0]!;
    const titleCounts = new Map<string, number>();
    for (const variant of conceptVariants) titleCounts.set(variant.displayName, (titleCounts.get(variant.displayName) ?? 0) + 1);
    const displayName = Array.from(titleCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? representative.displayName;
    const familyKeys = unique(conceptVariants.map((variant) => variant.familyKey));
    const signatureConfidences = unique(conceptVariants.map((variant) => variant.objectiveSignature.confidence));
    const groupingConfidence = signatureConfidences.includes("unresolved")
      ? "unresolved"
      : signatureConfidences.includes("partial")
        ? "partial"
        : "strong";
    const pickupMap = new Map<string, MissionConcept["pickupCoverage"][number]>();
    for (const variant of conceptVariants) {
      const pickup = variant.locationRoles.pickup;
      const pickupKey = JSON.stringify([pickup.status, pickup.displayLabel, pickup.primarySystem, pickup.grouping.displayLabel]);
      const existing = pickupMap.get(pickupKey);
      if (existing) existing.variantCount += 1;
      else pickupMap.set(pickupKey, {
        status: pickup.status,
        displayName: pickup.displayLabel,
        system: pickup.primarySystem,
        localityPool: pickup.grouping.detailLabel,
        variantCount: 1,
      });
    }
    const tierMap = new Map<string, MissionConcept["tierSummaries"][number]>();
    for (const variant of conceptVariants) {
      const existing = tierMap.get(variant.tierKey);
      if (existing) existing.variantCount += 1;
      else tierMap.set(variant.tierKey, { tierKey: variant.tierKey, tierLabel: variant.tierLabel, variantCount: 1 });
    }
    const rewardedReputationPaths = Array.from(new Map(
      conceptVariants.flatMap((variant) => variant.rewardedReputationPaths)
        .map((rewardPath) => [JSON.stringify([rewardPath.factionKey, rewardPath.scopeKey, rewardPath.amount, rewardPath.xp, rewardPath.confidence]), rewardPath])
    ).values());
    const rewardedScopeKeys = unique(rewardedReputationPaths.filter((rewardPath) => rewardPath.confidence !== "unresolved").map((rewardPath) => rewardPath.scopeKey));
    const archetypes = unique(conceptVariants.map((variant) => variant.missionArchetype));
    const groupingEvidence = unique(conceptVariants.flatMap((variant) => variant.objectiveSignature.evidence));
    const category = deriveDisplayCategory(
      representative.objectiveSignature.activityKey,
      archetypes,
      representative.reputationScope,
      familyKeys,
      displayName,
      groupingEvidence,
    );
    return {
      conceptKey,
      displayName,
      activityKey: representative.objectiveSignature.activityKey,
      ...category,
      factionKey: representative.reputationScope.factionKey,
      factionDisplayName: representative.reputationScope.factionDisplayName,
      reputationScope: representative.reputationScope,
      familyKeys,
      variantKeys: conceptVariants.map((variant) => variant.variantKey),
      variantCount: conceptVariants.length,
      archetypes,
      specificityBadges: unique(conceptVariants.flatMap((variant) => variant.specificityBadges)),
      rewardedReputationPaths,
      pickupCoverage: Array.from(pickupMap.values()),
      tierSummaries: Array.from(tierMap.values()),
      groupingConfidence,
      groupingEvidence,
      familyVariantFiles: [],
      mixedRewardPaths: rewardedScopeKeys.length > 1,
    };
  }).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function buildBrowseGroups(families: ShapedFamily[], concepts: MissionConcept[]): MissionBrowseGroup[] {
  const factionMap = new Map<string, ShapedFamily[]>();
  for (const family of families) {
    factionMap.set(family.reputationScope.factionKey, [...(factionMap.get(family.reputationScope.factionKey) ?? []), family]);
  }

  return Array.from(factionMap.entries()).map(([factionKeyValue, factionFamilies]) => {
    const scopeMap = new Map<string, ShapedFamily[]>();
    for (const family of factionFamilies) {
      scopeMap.set(family.reputationScope.scopeKey, [...(scopeMap.get(family.reputationScope.scopeKey) ?? []), family]);
    }

    return {
      factionKey: factionKeyValue,
      factionDisplayName: firstKnown(unique(factionFamilies.map((family) => family.reputationScope.factionDisplayName)), factionFamilies[0]?.provider ?? "Unknown faction"),
      reputationScopes: Array.from(scopeMap.entries()).map(([scopeKey, scopeFamilies]) => {
        const archetypeMap = new Map<string, ShapedFamily[]>();
        for (const family of scopeFamilies) {
          archetypeMap.set(family.missionArchetype, [...(archetypeMap.get(family.missionArchetype) ?? []), family]);
        }
        const representative = scopeFamilies[0]!;
        const scopeConcepts = concepts.filter((concept) =>
          concept.factionKey === factionKeyValue && concept.reputationScope.scopeKey === scopeKey
        );
        return {
          scopeKey,
          displayName: representative.reputationScope.displayName,
          confidence: representative.reputationScope.confidence,
          trackType: representative.reputationScope.trackType,
          conceptKeys: scopeConcepts.map((concept) => concept.conceptKey),
          familyKeys: scopeFamilies.map((family) => family.familyKey),
          missionArchetypes: Array.from(archetypeMap.entries()).map(([archetypeKey, archetypeFamilies]) => ({
            archetypeKey: keySlug(archetypeKey),
            displayName: archetypeKey,
            familyKeys: archetypeFamilies.map((family) => family.familyKey),
            missionCount: archetypeFamilies.length,
            variantCount: archetypeFamilies.reduce((sum, family) => sum + family.variantCount, 0),
            standingSummary: compactSummary(unique(archetypeFamilies.map((family) => family.reputationRequirement)), "No standing requirement extracted", 2),
            unresolvedCount: archetypeFamilies.filter((family) => family.confidenceFlags.length || family.pickupUnresolvedCount).length,
          })).sort((a, b) => a.displayName.localeCompare(b.displayName)),
        };
      }).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    };
  }).sort((a, b) => a.factionDisplayName.localeCompare(b.factionDisplayName));
}

function buildCategoryProjections(concepts: MissionConcept[]): ConceptCategoryProjection[] {
  return Array.from(
    concepts.reduce((groups, concept) => {
      const key = concept.displayCategory.key;
      const existing = groups.get(key) ?? { categoryKey: key, displayName: concept.displayCategory.label, conceptKeys: [] };
      existing.conceptKeys.push(concept.conceptKey);
      groups.set(key, existing);
      return groups;
    }, new Map<string, ConceptCategoryProjection>()).values()
  ).map((category) => ({
    ...category,
    conceptKeys: category.conceptKeys.sort((a, b) => {
      const left = concepts.find((concept) => concept.conceptKey === a)?.displayName ?? a;
      const right = concepts.find((concept) => concept.conceptKey === b)?.displayName ?? b;
      return left.localeCompare(right);
    }),
  })).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function buildBrowseViews(concepts: MissionConcept[], reputation: MissionBrowseGroup[]): MissionBrowseViews {
  const factionGroups = Array.from(
    concepts.reduce((groups, concept) => {
      groups.set(concept.factionKey, [...(groups.get(concept.factionKey) ?? []), concept]);
      return groups;
    }, new Map<string, MissionConcept[]>()).entries()
  ).map(([factionKeyValue, factionConcepts]) => ({
    factionKey: factionKeyValue,
    factionDisplayName: factionConcepts[0]?.factionDisplayName ?? "Unknown faction",
    categories: buildCategoryProjections(factionConcepts),
  })).sort((a, b) => a.factionDisplayName.localeCompare(b.factionDisplayName));

  return {
    full: { categories: buildCategoryProjections(concepts) },
    factions: factionGroups,
    reputation,
  };
}

function compactSummary(values: string[], fallback: string, max: number): string {
  if (!values.length) return fallback;
  const visible = values.slice(0, max).join("; ");
  return values.length > max ? `${visible}; +${values.length - max} more` : visible;
}

function optionList(
  rows: Array<{ key?: string; label?: string; colorKey?: string }>,
): MissionBrowserFilterOption[] {
  const map = new Map<string, MissionBrowserFilterOption>();
  for (const row of rows) {
    const key = clean(row.key);
    if (!key) continue;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    map.set(key, {
      key,
      label: clean(row.label) ?? key,
      count: 1,
      colorKey: row.colorKey,
    });
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function buildFiltersMeta(families: ShapedFamily[], variants: ShapedVariant[], concepts: MissionConcept[]): MissionBrowserFiltersMeta {
  return {
    factions: optionList(families.map((family) => ({
      key: family.provider,
      label: family.provider,
    }))),
    reputationScopes: optionList(families.flatMap((family) => family.rewardedReputationPaths.map((path) => ({
      key: path.scopeDisplayName,
      label: path.scopeDisplayName,
      colorKey: keySlug(path.scopeDisplayName),
    })))),
    archetypes: optionList(families.map((family) => ({
      key: family.missionArchetype,
      label: family.missionArchetype,
    }))),
    displayCategories: optionList(concepts.map((concept) => ({
      key: concept.displayCategory.key,
      label: concept.displayCategory.label,
    }))),
    rewardTypes: [
      { key: "blueprints", label: "Blueprint rewards", count: families.filter((family) => family.blueprintRewards.length > 0).length, colorKey: "blueprints" },
      { key: "reputation", label: "Reputation rewards", count: families.filter((family) => family.reputationRewards.length > 0).length, colorKey: "reputation" },
      { key: "credits-fixed", label: "Credits fixed", count: families.filter((family) => family.creditRewardStatuses.includes("fixed")).length, colorKey: "positive" },
      { key: "credits-calculated", label: "Calculated payout", count: families.filter((family) => family.creditRewardStatuses.includes("calculated")).length, colorKey: "warning" },
      { key: "credits-variable", label: "Variable payout", count: families.filter((family) => family.creditRewardStatuses.includes("variable")).length, colorKey: "warning" },
      { key: "credits-formula-unresolved", label: "Credits formula unresolved", count: families.filter((family) => family.creditRewardStatuses.includes("formula_unresolved")).length, colorKey: "warning" },
      { key: "credits-unresolved", label: "Credits unresolved", count: families.filter((family) => family.creditRewardStatuses.includes("unresolved")).length, colorKey: "warning" },
      { key: "credits-none", label: "No credit reward extracted", count: families.filter((family) => family.creditRewardSummary === "No credit reward extracted").length, colorKey: "muted" },
      { key: "items", label: "Item reward", count: families.filter((family) => family.itemRewardStatus === "resolved").length, colorKey: "reputation" },
      { key: "items-unresolved", label: "Item reward unresolved", count: families.filter((family) => family.itemRewardStatus === "unresolved_entityClass" || family.itemRewardStatus === "weighted_unresolved").length, colorKey: "warning" },
    ].filter((option) => option.count > 0),
    pickupSystems: optionList(variants.map((variant) => ({
      key: variant.locationRoles.pickup.grouping.displayLabel,
      label: variant.locationRoles.pickup.grouping.displayLabel,
      colorKey: variant.locationRoles.pickup.grouping.confidence,
    }))),
    confidenceStates: [
      { key: "unresolved", label: "Any unresolved", count: families.filter((family) => family.confidenceFlags.length > 0 || family.unresolvedReferences.length > 0).length, colorKey: "warning" },
      { key: "locations", label: "Locations unresolved", count: families.filter((family) => family.unresolvedLocationTokens.length > 0).length, colorKey: "warning" },
      { key: "rewards", label: "Rewards unresolved", count: families.filter((family) => family.unresolvedRewardFields.length > 0 || family.creditRewardStatuses.includes("unresolved")).length, colorKey: "warning" },
      { key: "crime-bounded", label: "CrimeStat limited", count: families.filter((family) => family.crimeStatRequirement === "bounded").length, colorKey: "amber" },
      { key: "unlawful", label: "Possible unlawful", count: families.filter((family) => family.lawfulClassification === "unlawful").length, colorKey: "red" },
    ].filter((option) => option.count > 0),
    legalStates: optionList(families.map((family) => ({
      key: family.lawfulClassification,
      label: family.lawfulClassification === "lawful" ? "Likely lawful" : family.lawfulClassification === "unlawful" ? "Possible unlawful" : "Legal unknown",
      colorKey: family.lawfulClassification,
    }))),
    missionTypes: optionList(families.map((family) => ({
      key: family.missionType,
      label: family.missionType,
    }))),
    releaseStates: optionList(families.flatMap((family) => family.releaseFlags.map((flag) => ({
      key: flag,
      label: flag,
      colorKey: keySlug(flag),
    })))),
  };
}

async function writeJson(fileName: string, value: unknown): Promise<void> {
  await writeFile(path.join(stagingRoot, fileName), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeJsonAt(root: string, fileName: string, value: unknown): Promise<void> {
  await writeFile(path.join(root, fileName), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function removeLegacyMissionOutputs(): Promise<void> {
  await Promise.all(
    legacyMissionOutputFiles.map((fileName) => rm(path.join(stagingRoot, fileName), { force: true }))
  );
}

async function collectMissionOutputJsonFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "source") continue;
      files.push(...await collectMissionOutputJsonFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }

  return files;
}

async function assertMissionOutputSizes(): Promise<void> {
  const files = await collectMissionOutputJsonFiles(stagingRoot);
  const oversized: Array<{ filePath: string; size: number }> = [];

  for (const filePath of files) {
    const fileStat = await stat(filePath);
    if (fileStat.size > maxMissionOutputBytes) {
      oversized.push({ filePath, size: fileStat.size });
    }
  }

  if (oversized.length === 0) return;

  const details = oversized
    .map(({ filePath, size }) => `- ${path.relative(process.cwd(), filePath)} (${(size / (1024 * 1024)).toFixed(2)} MB)`)
    .join("\n");
  throw new Error(`Mission shaped output exceeds ${maxMissionOutputBytes / (1024 * 1024)} MB:\n${details}`);
}

const [catalogInput, lookups, craftingBlueprintInput, refIndexInput] = await Promise.all([
  readFile(contractsPath, "utf8")
    .then((content) => ({
      catalog: parseMissionSourceCatalogV3(JSON.parse(content)) as RawCatalog,
      sha256: createHash("sha256").update(content).digest("hex"),
    })),
  readFile(lookupsPath, "utf8").then((content) => JSON.parse(content) as Lookups),
  readFile(craftingBlueprintsPath, "utf8").then((content) => ({
    catalog: JSON.parse(content) as { records?: CraftingBlueprintLookup[] },
    sha256: createHash("sha256").update(content).digest("hex"),
  })),
  refIndexPath
    ? readFile(refIndexPath, "utf8").then((content) => ({
      records: JSON.parse(content) as RefIndexEntry[],
      status: "explicit" as const,
      path: refIndexPath,
      sha256: createHash("sha256").update(content).digest("hex"),
    }))
    : Promise.resolve({
      records: [] as RefIndexEntry[],
      status: "not_configured" as const,
    }),
]);
const catalog = catalogInput.catalog;

const poolMap = new Map((lookups.blueprintPools ?? []).map((pool) => [String(pool.poolGuid ?? "").toLowerCase(), pool]));
const craftingBlueprintMap = new Map(
  (craftingBlueprintInput.catalog.records ?? []).map((record) => [record.id.toLowerCase(), record]),
);
const refMap = new Map(refIndexInput.records.map((entry) => [String(entry.guid ?? "").toLowerCase(), entry]));
const generationId = createHash("sha256").update(JSON.stringify({
  shaperVersion: missionShaperVersion,
  shapedSchemaVersion: MISSION_SHAPED_SCHEMA_VERSION,
  sourceSchemaVersion: catalog.schemaVersion,
  channel: catalog.source.channel,
  buildId: catalog.source.buildId,
  sourceLatestModifiedAt: catalog.sourceLatestModifiedAt,
  sourceCatalogSha256: catalogInput.sha256,
  calculationInputsDigestSha256: catalog.source.calculationInputsDigestSha256,
  refIndexStatus: refIndexInput.status,
  refIndexSha256: "sha256" in refIndexInput ? refIndexInput.sha256 : null,
  craftingBlueprintCatalogSha256: craftingBlueprintInput.sha256,
})).digest("hex").slice(0, 24);
const generatedAt = catalog.generatedAt;
const solverReference = {
  schemaVersion: 1,
  missionSchemaVersion: MISSION_SHAPED_SCHEMA_VERSION,
  sourceContractVersion: catalog.schemaVersion,
  generationId,
  generatedAt,
  standingThresholdsById: Object.fromEntries(
    (lookups.standings ?? [])
      .filter((standing) =>
        typeof standing.guid === "string"
        && Boolean(standing.guid)
        && typeof standing.minReputation === "number"
        && Number.isFinite(standing.minReputation)
      )
      .map((standing) => [String(standing.guid).toLowerCase(), standing.minReputation as number])
  ),
  standings: (lookups.standings ?? []).flatMap((standing) =>
    typeof standing.guid === "string"
    && Boolean(standing.guid)
    && typeof standing.minReputation === "number"
    && Number.isFinite(standing.minReputation)
      ? [{
        standingId: standing.guid.toLowerCase(),
        minimumReputation: standing.minReputation,
        recordName: standing.recordName ?? null,
        displayName: standing.displayName ?? null,
        sourcePath: standing.path ?? null,
      }]
      : []
  ),
};
const stagingRoot = path.join(missionRoot, `.staging-${process.pid}-${generationId}`);
const familyRoot = path.join(stagingRoot, "families");
const familyVariantsRoot = path.join(stagingRoot, "family-variants");
const variantRoot = path.join(stagingRoot, "variants");
const variants = catalog.records.map((mission) => shapeVariant(catalog, mission, poolMap, craftingBlueprintMap, refMap));
const graphValidation = buildMissionGraphValidationV2(catalog.records);
const rawByFamily = new Map<string, RawMission[]>();
const variantsByFamily = new Map<string, ShapedVariant[]>();

for (const mission of catalog.records) {
  const familyKey = mission.familyId ?? mission.contractId;
  rawByFamily.set(familyKey, [...(rawByFamily.get(familyKey) ?? []), mission]);
}

for (const variant of variants) {
  variantsByFamily.set(variant.familyKey, [...(variantsByFamily.get(variant.familyKey) ?? []), variant]);
}

const families = Array.from(variantsByFamily.entries())
  .map(([familyKey, familyVariants]) => shapeFamily(familyKey, familyVariants, rawByFamily.get(familyKey) ?? []))
  .sort((a, b) => a.displayName.localeCompare(b.displayName));
const {
  familyVariantFiles,
  familyDetailFiles,
  variantDetailFiles,
} = buildMissionShardPathsV2(
  families.map((family) => family.familyKey),
  variants.map((variant) => variant.variantKey),
);
const concepts = shapeConcepts(variants).map((concept) => ({
  ...concept,
  familyVariantFiles: concept.familyKeys.map((familyKey) => familyVariantFiles[familyKey]!).filter(Boolean),
}));
const missionBrowseGroups = buildBrowseGroups(families, concepts);
const browseViews = buildBrowseViews(concepts, missionBrowseGroups);

const shaped: ShapedCatalog = {
  schemaVersion: MISSION_SHAPED_SCHEMA_VERSION,
  sourceContractVersion: catalog.schemaVersion,
  generationId,
  generatedAt,
  sourceLatestModifiedAt: catalog.sourceLatestModifiedAt,
  sourceFiles: [
    "server-data/missions/source/mission_contracts.json",
    "server-data/missions/source/mission_reward_lookups.json",
    "server-data/crafting/component-cards/browse.json",
    ...(refIndexPath ? [refIndexPath] : []),
  ],
  sourceInputs: {
    refIndex: {
      status: refIndexInput.status,
      path: "path" in refIndexInput ? refIndexInput.path : undefined,
      sha256: "sha256" in refIndexInput ? refIndexInput.sha256 : undefined,
    },
  },
  summary: {
    familyCount: families.length,
    variantCount: variants.length,
    unresolvedLocationCount: variants.filter((variant) => variant.confidence.hasUnresolvedLocation).length,
    unresolvedRewardCount: variants.filter((variant) => variant.confidence.hasUnresolvedRewards).length,
    explicitCrimeStatRequiredCount: variants.filter((variant) => variant.crimeStatRequirement === "required").length,
    pickupExactCount: variants.filter((variant) => variant.pickupLocation.status === "exact").length,
    pickupGeneratedFromPoolCount: variants.filter((variant) => variant.pickupLocation.status === "generated_from_pool").length,
    pickupSystemScopeCount: variants.filter((variant) => variant.pickupLocation.status === "system_scope").length,
    pickupSystemOnlyCount: variants.filter((variant) => variant.pickupLocation.status === "system_only").length,
    pickupUnknownCount: variants.filter((variant) => variant.pickupLocation.status === "unknown").length,
    pickupUnresolvedCount: variants.filter((variant) => variant.pickupLocation.status === "unresolved").length,
    reputationScopeResolvedCount: variants.filter((variant) => variant.reputationScope.confidence === "resolved").length,
    reputationScopePartialCount: variants.filter((variant) => variant.reputationScope.confidence === "partial").length,
    reputationScopeUnresolvedCount: variants.filter((variant) => variant.reputationScope.confidence === "unresolved").length,
    factionGroupCount: missionBrowseGroups.length,
    reputationScopeGroupCount: missionBrowseGroups.reduce((sum, group) => sum + group.reputationScopes.length, 0),
    archetypeGroupCount: missionBrowseGroups.reduce((sum, group) => sum + group.reputationScopes.reduce((scopeSum, scope) => scopeSum + scope.missionArchetypes.length, 0), 0),
    conceptCount: concepts.length,
  },
  families,
  variants,
  missionBrowseGroups,
  browseViews,
  concepts,
};

const familiesByKey = Object.fromEntries(families.map((family) => [family.familyKey, family]));
const conceptsByKey = Object.fromEntries(concepts.map((concept) => [concept.conceptKey, concept]));
const conceptFamilyVariantFiles = Object.fromEntries(concepts.map((concept) => [concept.conceptKey, concept.familyVariantFiles]));
const shardManifest: MissionShardManifest = {
  schemaVersion: MISSION_SHAPED_SCHEMA_VERSION,
  sourceContractVersion: catalog.schemaVersion,
  generationId,
  generatedAt: shaped.generatedAt,
  sourceLatestModifiedAt: shaped.sourceLatestModifiedAt,
  familyFilesByFamilyId: Object.fromEntries(
    families.map((family) => [family.familyKey, {
      familyKey: family.familyKey,
      detailFile: familyDetailFiles[family.familyKey]!,
      variantsFile: familyVariantFiles[family.familyKey]!,
    }])
  ),
  variantFilesByMissionId: Object.fromEntries(
    catalog.records.map((mission) => {
      const familyId = mission.familyId ?? mission.contractId;
      return [mission.contractId, {
        missionId: mission.contractId,
        variantId: mission.contractId,
        familyId,
        familyKey: familyId,
        detailFile: variantDetailFiles[mission.contractId]!,
        familyDetailFile: familyDetailFiles[familyId]!,
        familyVariantsFile: familyVariantFiles[familyId]!,
      }];
    })
  ),
  variantFilesByVariantId: Object.fromEntries(
    variants.map((variant) => [variant.variantKey, {
      missionId: variant.technical.contractId,
      variantId: variant.variantKey,
      familyId: variant.familyKey,
      familyKey: variant.familyKey,
      detailFile: variantDetailFiles[variant.variantKey]!,
      familyDetailFile: familyDetailFiles[variant.familyKey]!,
      familyVariantsFile: familyVariantFiles[variant.familyKey]!,
    }])
  ),
};
const browserIndex: MissionBrowserIndex = {
  schemaVersion: MISSION_SHAPED_SCHEMA_VERSION,
  sourceContractVersion: catalog.schemaVersion,
  generationId,
  generatedAt: shaped.generatedAt,
  sourceLatestModifiedAt: shaped.sourceLatestModifiedAt,
  sourceFiles: shaped.sourceFiles,
  sourceInputs: shaped.sourceInputs,
  summary: shaped.summary,
  unresolvedSummary: {
    unresolvedLocationCount: shaped.summary.unresolvedLocationCount,
    unresolvedRewardCount: shaped.summary.unresolvedRewardCount,
    pickupUnknownCount: shaped.summary.pickupUnknownCount,
    reputationScopePartialCount: shaped.summary.reputationScopePartialCount,
    reputationScopeUnresolvedCount: shaped.summary.reputationScopeUnresolvedCount,
  },
  report: {
    extractionReport: "mission_browser_extraction_report.json",
    unresolvedReport: "mission_unresolved_refs.json",
    conceptReport: "mission_concept_shaping_report.json",
    conceptCatalog: "mission_concepts.json",
    categoryReport: "mission_category_projection_report.json",
    graphReport: "mission_graph_validation_report.json",
  },
  filtersMeta: buildFiltersMeta(families, variants, concepts),
  familiesByKey,
  conceptsByKey,
  familyDetailFiles,
  familyVariantFiles,
  variantDetailFiles,
  conceptFamilyVariantFiles,
  missionBrowseGroups,
  browseViews,
};
const graphArtifacts = buildMissionGraphArtifactsV2({
  schemaVersion: MISSION_SHAPED_SCHEMA_VERSION,
  sourceContractVersion: catalog.schemaVersion,
  generationId,
  generatedAt: shaped.generatedAt,
  sourceLatestModifiedAt: shaped.sourceLatestModifiedAt,
}, graphValidation);

const rewards = variants.map((variant) => ({
  variantKey: variant.variantKey,
  familyKey: variant.familyKey,
  rewards: variant.rewards,
  rewardedReputationPaths: variant.rewardedReputationPaths,
}));

const prerequisites = variants.map((variant) => ({
  variantKey: variant.variantKey,
  familyKey: variant.familyKey,
  standingRequirement: variant.standingRequirement,
  reputationRequirement: variant.reputationRequirement,
  prerequisites: variant.prerequisites,
  crimeStatRequirement: variant.crimeStatRequirement,
}));

const reputation = variants
  .filter((variant) => variant.reputationRequirement || variant.rewards.reputationRewards.length)
  .map((variant) => ({
    variantKey: variant.variantKey,
    familyKey: variant.familyKey,
    reputationScope: variant.reputationScope,
    requirement: variant.reputationRequirement,
    rewards: variant.rewards.reputationRewards,
  }));

const unresolvedRefs = variants
  .filter((variant) => variant.confidence.hasUnresolvedLocation || variant.confidence.hasUnresolvedPrerequisites || variant.confidence.hasUnresolvedRewards)
  .map((variant) => ({
    variantKey: variant.variantKey,
    familyKey: variant.familyKey,
    pickupStatus: variant.pickupLocation.status,
    pickupReason: variant.pickupLocation.reason,
    pickupUnresolvedRefs: variant.pickupLocation.unresolvedRefs,
    nonPickupUnresolvedLocations: variant.unresolvedLocationTokens.filter((token) => !variant.pickupLocation.sourceRefs.includes(token)),
    unresolvedRewards: variant.rewards.unresolvedRewardTokens,
    unresolvedPrerequisites: variant.prerequisites
      .filter((item) => item.confidence === "unresolved")
      .map((item) => ({ type: item.type, label: item.label, rawType: item.rawType, raw: item.raw })),
  }));

const report = {
  generatedAt: shaped.generatedAt,
  sourceLatestModifiedAt: shaped.sourceLatestModifiedAt,
  inputMissionCount: catalog.records.length,
  familyCount: families.length,
  variantCount: variants.length,
  explicitCrimeStatRequiredCount: shaped.summary.explicitCrimeStatRequiredCount,
  crimeStatBoundedCount: variants.filter((variant) => variant.crimeStatRequirement === "bounded").length,
  creditFixedCount: variants.filter((variant) => variant.rewards.creditStatus === "fixed").length,
  creditCalculatedClassifiedCount: variants.filter((variant) => variant.rewards.creditStatus === "calculated").length,
  creditCalculatedToFixedUpgradeCount: 0,
  creditStillCalculatedCount: variants.filter((variant) => variant.rewards.creditStatus === "calculated").length,
  creditFormulaUnresolvedCount: variants.filter((variant) => variant.rewards.creditStatus === "formula_unresolved").length,
  creditVariableCount: variants.filter((variant) => variant.rewards.creditStatus === "variable").length,
  creditUnresolvedCount: variants.filter((variant) => variant.rewards.creditStatus === "unresolved").length,
  creditNoResultCount: variants.filter((variant) => variant.rewards.creditStatus === "provenAbsent").length,
  contractResultRewardFixedExtractedCount: variants.filter((variant) => variant.rewards.creditsDetail.status === "fixed" && variant.rewards.creditsDetail.sourceResultType === "ContractResult_Reward").length,
  contractResultCalculatedRewardClassifiedCount: variants.filter((variant) => variant.rewards.creditsDetail.status === "calculated" && variant.rewards.creditsDetail.sourceResultType === "ContractResult_CalculatedReward").length,
  itemRewardsResolvedCount: variants.filter((variant) => variant.rewards.itemRewardStatus === "resolved").length,
  itemEntityClassUnresolvedCount: variants.filter((variant) => variant.rewards.itemRewardStatus === "unresolved_entityClass").length,
  weightedItemRewardsUnresolvedCount: variants.filter((variant) => variant.rewards.itemRewardStatus === "weighted_unresolved").length,
  trueNoCreditCount: variants.filter((variant) => variant.rewards.creditStatus === "provenAbsent" && variant.rewards.itemRewardStatus === "none").length,
  remainingGenericUnresolvedRewardCount: variants.filter((variant) => variant.rewards.creditStatus === "unresolved" || variant.rewards.unresolvedRewardTokens.some((token) => token !== "ContractResult_Item:entityClass" && token !== "ContractResult_ItemsWeighting")).length,
  blueprintRewardVariantCount: variants.filter((variant) => variant.rewards.blueprintRewards.length > 0).length,
  reputationRewardVariantCount: variants.filter((variant) => variant.rewards.reputationRewards.length > 0).length,
  unresolvedLocationVariantCount: shaped.summary.unresolvedLocationCount,
  pickupExactResolvedCount: shaped.summary.pickupExactCount,
  pickupGeneratedFromPoolCount: shaped.summary.pickupGeneratedFromPoolCount,
  pickupSystemScopeResolvedCount: shaped.summary.pickupSystemScopeCount,
  pickupSystemOnlyCount: shaped.summary.pickupSystemOnlyCount,
  pickupUnknownCount: shaped.summary.pickupUnknownCount,
  pickupUnresolvedMissingRefsCount: shaped.summary.pickupUnresolvedCount,
  nonPickupObjectiveLocationsUnresolvedCount: variants.filter((variant) =>
    variant.unresolvedLocationTokens.some((token) => !variant.pickupLocation.sourceRefs.includes(token))
  ).length,
  destinationDropoffUnresolvedCount: variants.filter((variant) => variant.locationRoles.destination.status === "unresolved").length,
  proceduralRegionUnresolvedCount: variants.filter((variant) =>
    variant.pickupLocation.technicalRefs.some((ref) => ref.role.includes("procedural") && !ref.consideredPickup)
  ).length,
  reputationScopesResolvedCount: shaped.summary.reputationScopeResolvedCount,
  reputationScopesPartialCount: shaped.summary.reputationScopePartialCount,
  reputationScopesUnresolvedCount: shaped.summary.reputationScopeUnresolvedCount,
  rawRepScopeTokensUnresolvedCount: variants.filter((variant) => /@REPSCOPE/i.test(`${variant.reputationScope.rawName ?? ""} ${variant.reputationScope.displayName}`)).length,
  factionsGroupedCount: shaped.summary.factionGroupCount,
  reputationScopesGroupedCount: shaped.summary.reputationScopeGroupCount,
  archetypesGroupedCount: shaped.summary.archetypeGroupCount,
  missionGroupsWithInternalFallbackTitleCount: families.filter((family) => family.titleSource === "internal_fallback").length,
  unresolvedReferenceCount: unresolvedRefs.length,
  familyTitleSourceCounts: families.reduce<Record<string, number>>((counts, family) => {
    counts[family.titleSource] = (counts[family.titleSource] ?? 0) + 1;
    return counts;
  }, {}),
  variantTitleSourceCounts: variants.reduce<Record<string, number>>((counts, variant) => {
    counts[variant.titleSource] = (counts[variant.titleSource] ?? 0) + 1;
    return counts;
  }, {}),
  rewardedReputationPathResolvedCount: variants.filter((variant) => variant.rewardedReputationPaths.some((path) => path.confidence === "resolved")).length,
  rewardedReputationPathPartialCount: variants.filter((variant) => variant.rewardedReputationPaths.some((path) => path.confidence === "partial")).length,
  rewardedReputationPathUnresolvedCount: variants.filter((variant) => variant.rewardedReputationPaths.some((path) => path.confidence === "unresolved")).length,
  rewardedReputationMixedFamilyCount: families.filter((family) => new Set(family.rewardedReputationPaths.filter((path) => path.confidence !== "unresolved").map((path) => path.scopeKey)).size > 1).length,
  internalFallbackFamilyCount: families.filter((family) => family.titleSource === "internal_fallback").length,
  notes: [
    "CrimeStat required is emitted only when minCrimeStat is greater than zero.",
    "Current source data contains CrimeStat bounds but no explicit positive minCrimeStat requirement.",
    "ContractResult_Reward child contractReward is extracted as fixed credits when present.",
    "ContractResult_CalculatedReward remains calculated only when formula attributes are extracted; empty calculated results are classified as formula unresolved.",
    "Calculated-to-fixed upgrades require a concrete fixed child payout in the current mission input; none are inferred from sibling missions.",
    "Pickup / availability uses explicit location prerequisites first and MissionLocality availability pools second.",
    "Pyro StarLocality and Region A-D style refs are shaped as procedural Pyro system availability scopes.",
    "Mission browse groups are Faction -> Reputation Scope / Career Track -> Mission Archetype -> Mission Group -> Variants.",
    "Headhunters sub-tracks are marked partial when the extracted scope GUID is generic and the track is derived from Scintel mission fields.",
    "MissionLocality records are displayed as generated-from-pool scopes; child availableLocations are not invented when absent from current generated inputs.",
    "Location names are not invented; raw GUID tokens are retained for technical details.",
  ],
};

const locationNormalizationSamples = [
  { label: "Hunt Some Heads", variantKey: "da845673-0334-4949-bb12-5ae363a54356" },
  { label: "Ambush XenoThreat Strike Wing", variantKey: "817147a6-735b-45fb-95be-5962a7f11c95" },
  { label: "Adaigo Pyro Region A Lawful Salvage Hard", variantKey: "22813e94-3e98-4237-8591-337ce65122a9" },
  { label: "Additional Resources For Research", variantKey: "1136e707-15cb-49b9-9943-c3a2de91d3f2" },
  { label: "Red Wind Seeking New Haulers", variantKey: "38f6b043-df4f-4904-a069-f4cbe42cc80c" },
  { label: "Jorrit Dossier: Updated Power Usage Data", variantKey: "jorrit-dossier-updated-power-usage-data" },
].map((sample) => {
  const variant = variants.find((item) => item.variantKey === sample.variantKey || item.displayName === sample.label);
  return {
    label: sample.label,
    variantKey: sample.variantKey,
    found: Boolean(variant),
    oldPickupLocation: variant?.pickupLocation,
    newPickupRole: variant?.locationRoles.pickup,
    destinationTokens: variant?.destinationTokens ?? [],
    destinationRole: variant?.locationRoles.destination,
    locationRefsCount: variant?.locationRefs.length ?? 0,
    groupingDisplayLabel: variant?.locationRoles.pickup.grouping.displayLabel,
  };
});

Object.assign(report, { locationNormalizationSamples });

const conceptAssignments = new Map<string, string[]>();
for (const concept of concepts) {
  for (const variantKey of concept.variantKeys) {
    conceptAssignments.set(variantKey, [...(conceptAssignments.get(variantKey) ?? []), concept.conceptKey]);
  }
}
const unassignedVariantKeys = variants.filter((variant) => !conceptAssignments.has(variant.variantKey)).map((variant) => variant.variantKey);
const multiplyAssignedVariantKeys = Array.from(conceptAssignments.entries()).filter(([, conceptKeys]) => conceptKeys.length !== 1).map(([variantKey]) => variantKey);
const familiesToConcepts = new Map<string, Set<string>>();
for (const concept of concepts) {
  for (const familyKey of concept.familyKeys) {
    const conceptKeys = familiesToConcepts.get(familyKey) ?? new Set<string>();
    conceptKeys.add(concept.conceptKey);
    familiesToConcepts.set(familyKey, conceptKeys);
  }
}
const conceptsCrossingOwningScopes = concepts.filter((concept) =>
  unique(concept.variantKeys.map((variantKey) => variants.find((variant) => variant.variantKey === variantKey)?.reputationScope.scopeKey)).length > 1
);
const mixedRewardConcepts = concepts.filter((concept) => concept.mixedRewardPaths);
const mixedRewardShelfViolations = mixedRewardConcepts.filter((concept) =>
  concept.variantKeys.some((variantKey) => variants.find((variant) => variant.variantKey === variantKey)?.reputationScope.scopeKey !== concept.reputationScope.scopeKey)
);
const multiFamilyNonStrongConcepts = concepts.filter((concept) => concept.familyKeys.length > 1 && concept.groupingConfidence !== "strong");
const validationFactionNames = new Set([
  "Headhunters",
  "Covalex",
  "Adagio Holdings",
  "Citizens For Prosperity",
  "Dead Saints",
  "Bounty Hunters Guild",
  "Eckhart Security",
]);
const oneOffFaction = missionBrowseGroups
  .map((group) => ({
    name: group.factionDisplayName,
    conceptCount: group.reputationScopes.reduce((sum, scope) => sum + scope.conceptKeys.length, 0),
  }))
  .filter((item) => !validationFactionNames.has(item.name))
  .sort((a, b) => a.conceptCount - b.conceptCount || a.name.localeCompare(b.name))[0]?.name;
if (oneOffFaction) validationFactionNames.add(oneOffFaction);

const validationExamples = Array.from(validationFactionNames).map((factionName) => {
  const factionConcepts = concepts.filter((concept) => concept.factionDisplayName === factionName);
  const factionFamilies = families.filter((family) => family.reputationScope.factionDisplayName === factionName);
  const collapsed = factionConcepts
    .filter((concept) => concept.familyKeys.length > 1)
    .slice(0, 5)
    .map((concept) => ({
      conceptKey: concept.conceptKey,
      displayName: concept.displayName,
      owningScope: concept.reputationScope.displayName,
      familyKeys: concept.familyKeys,
      variantCount: concept.variantCount,
      confidence: concept.groupingConfidence,
    }));
  const intentionallySeparate = factionFamilies
    .filter((family) => (familiesToConcepts.get(family.familyKey)?.size ?? 0) > 1)
    .slice(0, 5)
    .map((family) => ({
      familyKey: family.familyKey,
      displayName: family.displayName,
      owningScope: family.reputationScope.displayName,
      conceptKeys: Array.from(familiesToConcepts.get(family.familyKey) ?? []),
      reason: "Family contains multiple evidence-gated objective signatures.",
    }));
  return {
    factionName,
    oldFamilyCardCount: factionFamilies.length,
    newConceptCardCount: factionConcepts.length,
    collapsed,
    intentionallySeparate,
  };
});

const conceptReport = {
  generatedAt: shaped.generatedAt,
  sourceLatestModifiedAt: shaped.sourceLatestModifiedAt,
  stage: "Stage 1.2 meaningful offer-title boundary tuning",
  gatePassed:
    unassignedVariantKeys.length === 0
    && multiplyAssignedVariantKeys.length === 0
    && conceptsCrossingOwningScopes.length === 0
    && mixedRewardShelfViolations.length === 0
    && multiFamilyNonStrongConcepts.length === 0,
  stage2Recommendation: "hold_for_concept-granularity_review",
  totals: {
    oldStage1GlobalConceptCount: 755,
    factionsProcessed: missionBrowseGroups.length,
    reputationScopesProcessed: missionBrowseGroups.reduce((sum, group) => sum + group.reputationScopes.length, 0),
    oldGlobalFamilyCardCount: families.length,
    newGlobalConceptCardCount: concepts.length,
    conceptsWithOneFamily: concepts.filter((concept) => concept.familyKeys.length === 1).length,
    conceptsWithMultipleFamilies: concepts.filter((concept) => concept.familyKeys.length > 1).length,
    familiesSplitIntoMultipleConcepts: Array.from(familiesToConcepts.values()).filter((conceptKeys) => conceptKeys.size > 1).length,
    variantsAssignedExactlyOnce: variants.filter((variant) => conceptAssignments.get(variant.variantKey)?.length === 1).length,
    unassignedVariants: unassignedVariantKeys.length,
    multiplyAssignedVariants: multiplyAssignedVariantKeys.length,
    groupingConfidence: {
      strong: concepts.filter((concept) => concept.groupingConfidence === "strong").length,
      partial: concepts.filter((concept) => concept.groupingConfidence === "partial").length,
      unresolved: concepts.filter((concept) => concept.groupingConfidence === "unresolved").length,
    },
    mixedRewardConcepts: mixedRewardConcepts.length,
    mixedRewardShelfViolations: mixedRewardShelfViolations.length,
    conceptsCrossingOwningScopes: conceptsCrossingOwningScopes.length,
    multiFamilyNonStrongConcepts: multiFamilyNonStrongConcepts.length,
    headhuntersOldStage1ConceptCount: 141,
    headhuntersTunedConceptCount: concepts.filter((concept) => concept.factionDisplayName === "Headhunters").length,
  },
  slicedApi: {
    browserIndexVariantBodies: 0,
    browserIndexSerializedBytes: Buffer.byteLength(JSON.stringify(browserIndex), "utf8"),
    conceptFamilyVariantReferenceCount: Object.values(conceptFamilyVariantFiles).reduce((sum, files) => sum + files.length, 0),
    familyVariantRouteReferences: Object.keys(familyVariantFiles).length,
    familyDetailRouteReferences: Object.keys(familyDetailFiles).length,
    exactVariantRouteReferences: Object.keys(variantDetailFiles).length,
    familyRoutesPreserved: Object.keys(familyDetailFiles).length === families.length && Object.keys(familyVariantFiles).length === families.length,
    exactVariantRoutesPreserved: Object.keys(variantDetailFiles).length === variants.length,
  },
  failures: {
    unassignedVariantKeys,
    multiplyAssignedVariantKeys,
    conceptKeysCrossingOwningScopes: conceptsCrossingOwningScopes.map((concept) => concept.conceptKey),
    mixedRewardShelfViolationConceptKeys: mixedRewardShelfViolations.map((concept) => concept.conceptKey),
    multiFamilyNonStrongConceptKeys: multiFamilyNonStrongConcepts.map((concept) => concept.conceptKey),
  },
  validationExamples,
  reviewFlags: [
    concepts.length > families.length
      ? `Conservative objective splitting increases candidate cards from ${families.length} families to ${concepts.length} concepts; review readability before Stage 2.`
      : undefined,
    concepts.filter((concept) => concept.groupingConfidence !== "strong").length > 0
      ? `${concepts.filter((concept) => concept.groupingConfidence !== "strong").length} partial or unresolved concepts remain intentionally unmerged.`
      : undefined,
  ].filter(Boolean),
  notes: [
    "Concept grouping is global and contains no faction-specific grouping rules.",
    "Raw title and description stems are supporting evidence only. Clean localized offer titles become concept boundaries only for broad generated activities where activity identity alone is insufficient.",
    "Partial activity derivations remain within their source family; unresolved activity derivations remain variant-specific.",
    "Rewarded reputation paths are metadata only and never determine owning shelf placement.",
    "Partial and unresolved signatures remain separate because their fallback signature includes variant identity when no structural objective evidence exists.",
    "Existing family and exact variant payloads remain the lazy-loading and technical-detail provenance layer.",
  ],
};

const categoryCountRows = (rows: MissionConcept[]) => Array.from(
  rows.reduce((counts, concept) => {
    const existing = counts.get(concept.displayCategory.key) ?? {
      categoryKey: concept.displayCategory.key,
      displayName: concept.displayCategory.label,
      conceptCount: 0,
      variantCount: 0,
    };
    existing.conceptCount += 1;
    existing.variantCount += concept.variantCount;
    counts.set(concept.displayCategory.key, existing);
    return counts;
  }, new Map<string, { categoryKey: string; displayName: string; conceptCount: number; variantCount: number }>()).values()
).sort((a, b) => b.conceptCount - a.conceptCount || a.displayName.localeCompare(b.displayName));

const countConceptValues = (values: string[]) => Array.from(
  values.reduce((counts, value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  }, new Map<string, number>()).entries()
).map(([value, conceptCount]) => ({ value, conceptCount }))
  .sort((a, b) => b.conceptCount - a.conceptCount || a.value.localeCompare(b.value));

const conceptEvidenceValue = (concept: MissionConcept, prefix: string) =>
  concept.groupingEvidence.find((item) => item.startsWith(prefix));

const recoveryPattern = (concept: MissionConcept) => {
  const text = [concept.displayName, ...concept.familyKeys, ...concept.groupingEvidence].join(" ").toLowerCase();
  if (/black.?box/.test(text)) return "black-box-retrieval";
  if (/recover-data|collect-data|retrieve-vanduul-data|station-assault|missing-person/.test(text)) return "investigation-or-data-retrieval";
  if (/recover-item|recover-package|spacecollect-cargo|retrieve-item/.test(text)) return "item-or-package-retrieval";
  if (/resource-gathering/.test(text)) return "resource-gathering";
  return "ambiguous-recovery";
};

const wasStageARecoveryCollection = (concept: MissionConcept) => {
  if (!concept.archetypes.includes("Recovery")) return false;
  return !concept.activityKey.split("+").some((activity) =>
    /missing-person-investigation|search-body|salvage|mining-fps|resource-gathering|repair|refuel|bounty|courier-delivery|deliver|recover-cargo|retrieve-cargo|steal-cargo/.test(activity)
  );
};

const wasStageAUnresolved = (concept: MissionConcept) => {
  const activities = concept.activityKey.split("+");
  const archetypes = concept.archetypes.map(keySlug);
  const hasActivity = (pattern: RegExp) => activities.some((activity) => pattern.test(activity));
  const hasArchetype = (pattern: RegExp) => archetypes.some((archetype) => pattern.test(archetype));
  return !(
    hasActivity(/collector-offer|missing-person-investigation|search-body|salvage|mining-fps|resource-gathering|repair|refuel|bounty|courier-delivery|deliver|recover-cargo|retrieve-cargo|steal-cargo|eliminate|ambush|patrol|defend|escort|destroy-items|sabotage/)
    || hasArchetype(/investigation|salvage|hand-mining|mining|refuel|racing|bounty|courier|cargo|recovery|mercenary|ambush|defend-ship|assassination/)
    || /\bracing\b/i.test(concept.reputationScope.trackType)
  );
};

const previousStageACategoryCounts = [
  { categoryKey: "collection", displayName: "Collection", conceptCount: 161, variantCount: 164 },
  { categoryKey: "mercenary", displayName: "Mercenary", conceptCount: 134, variantCount: 743 },
  { categoryKey: "other-unresolved", displayName: "Other / Unresolved", conceptCount: 76, variantCount: 120 },
  { categoryKey: "hauling", displayName: "Hauling", conceptCount: 42, variantCount: 438 },
  { categoryKey: "investigation", displayName: "Investigation", conceptCount: 29, variantCount: 256 },
  { categoryKey: "bounty", displayName: "Bounty", conceptCount: 20, variantCount: 65 },
  { categoryKey: "courier", displayName: "Courier", conceptCount: 19, variantCount: 347 },
  { categoryKey: "salvage", displayName: "Salvage", conceptCount: 13, variantCount: 103 },
  { categoryKey: "mining", displayName: "Mining", conceptCount: 12, variantCount: 32 },
  { categoryKey: "racing", displayName: "Racing", conceptCount: 6, variantCount: 6 },
  { categoryKey: "hand-mining", displayName: "Hand Mining", conceptCount: 3, variantCount: 156 },
  { categoryKey: "refueling", displayName: "Refueling", conceptCount: 2, variantCount: 29 },
  { categoryKey: "repair", displayName: "Repair", conceptCount: 1, variantCount: 1 },
];

const unresolvedCategoryConcepts = concepts.filter((concept) => concept.displayCategory.confidence === "unresolved");
const previousUnresolvedConcepts = concepts.filter(wasStageAUnresolved);
const collectionConcepts = concepts.filter((concept) => concept.displayCategory.key === "collection");
const recoveryConcepts = concepts.filter((concept) => concept.archetypes.includes("Recovery"));
const previousRecoveryCollectionConcepts = recoveryConcepts.filter(wasStageARecoveryCollection);
const haulingConcepts = concepts.filter((concept) => concept.displayCategory.key === "hauling");
const compoundActivityConcepts = concepts.filter((concept) => concept.activityKey.includes("+"));
const categoryReport = {
  generatedAt: shaped.generatedAt,
  sourceLatestModifiedAt: shaped.sourceLatestModifiedAt,
  stage: "Stage A.1 category taxonomy tuning",
  categoryVersion: 2,
  totals: {
    conceptsCategorized: concepts.length,
    conceptsInOtherUnresolved: unresolvedCategoryConcepts.length,
    conceptsWithUnknownActivity: concepts.filter((concept) => concept.activityKey === "unknown").length,
    unknownActivityConceptsCategorized: concepts.filter((concept) => concept.activityKey === "unknown" && concept.displayCategory.confidence !== "unresolved").length,
    unknownActivityConceptsUnresolved: concepts.filter((concept) => concept.activityKey === "unknown" && concept.displayCategory.confidence === "unresolved").length,
    sourceCounts: {
      archetype: concepts.filter((concept) => concept.displayCategory.source === "archetype").length,
      activity: concepts.filter((concept) => concept.displayCategory.source === "activity").length,
      combined: concepts.filter((concept) => concept.displayCategory.source === "combined").length,
      fallback: concepts.filter((concept) => concept.displayCategory.source === "fallback").length,
    },
    confidenceCounts: {
      resolved: concepts.filter((concept) => concept.displayCategory.confidence === "resolved").length,
      inferred: concepts.filter((concept) => concept.displayCategory.confidence === "inferred").length,
      unresolved: unresolvedCategoryConcepts.length,
    },
  },
  previousStageACategoryCounts,
  globalCategoryCounts: categoryCountRows(concepts),
  collectionAudit: {
    previousConceptCount: previousStageACategoryCounts.find((row) => row.categoryKey === "collection")?.conceptCount,
    currentConceptCount: collectionConcepts.length,
    byArchetype: countConceptValues(collectionConcepts.flatMap((concept) => concept.archetypes)),
    byActivityKey: countConceptValues(collectionConcepts.map((concept) => concept.activityKey)),
    byFaction: countConceptValues(collectionConcepts.map((concept) => concept.factionDisplayName)),
    byMissionType: countConceptValues(collectionConcepts.map((concept) => conceptEvidenceValue(concept, "contract:") ?? "contract:unknown")),
    titlePatterns: countConceptValues(collectionConcepts.map((concept) => /\bcollector\b/i.test(concept.displayName) ? "collector-offer-title" : "other-title")),
    objectiveHandlerEvidence: countConceptValues(collectionConcepts.map((concept) => conceptEvidenceValue(concept, "handler:") ?? "handler:unknown")).slice(0, 20),
    rewardPickupClues: {
      mixedRewardConcepts: collectionConcepts.filter((concept) => concept.mixedRewardPaths).length,
      pickupSystems: countConceptValues(collectionConcepts.flatMap((concept) => concept.pickupCoverage.map((pickup) => pickup.system ?? pickup.displayName))).slice(0, 20),
    },
  },
  recoveryAudit: {
    totalRecoveryArchetypeConcepts: recoveryConcepts.length,
    previouslyInferredIntoCollection: previousRecoveryCollectionConcepts.length,
    placementSummary: categoryCountRows(recoveryConcepts),
    patternSummary: countConceptValues(recoveryConcepts.map(recoveryPattern)),
    concepts: recoveryConcepts.map((concept) => ({
      conceptKey: concept.conceptKey,
      displayName: concept.displayName,
      factionDisplayName: concept.factionDisplayName,
      activityKey: concept.activityKey,
      pattern: recoveryPattern(concept),
      previousStageAPlacement: wasStageARecoveryCollection(concept) ? "Collection" : "Other resolved category",
      recommendedCategory: concept.displayCategory.label,
      recommendationConfidence: concept.displayCategory.confidence,
      objectiveHandlerEvidence: concept.groupingEvidence.filter((item) => /^(activity|handler|title|description|contract):/.test(item)),
    })),
  },
  haulingAudit: {
    recommendation: "Keep Stellar and Interstellar as subcategories/badges and optional filters, not top-level categories.",
    totalHaulingConcepts: haulingConcepts.length,
    subcategoryCounts: countConceptValues(haulingConcepts.flatMap((concept) => concept.displaySubcategories.length ? concept.displaySubcategories : ["No route subcategory"])),
    concepts: haulingConcepts.map((concept) => ({
      conceptKey: concept.conceptKey,
      displayName: concept.displayName,
      factionDisplayName: concept.factionDisplayName,
      activityKey: concept.activityKey,
      displaySubcategories: concept.displaySubcategories,
      familyKeys: concept.familyKeys,
    })),
  },
  compoundActivityAudit: {
    totalConcepts: compoundActivityConcepts.length,
    activityKeyCounts: countConceptValues(compoundActivityConcepts.map((concept) => concept.activityKey)),
    concepts: compoundActivityConcepts.map((concept) => ({
      conceptKey: concept.conceptKey,
      displayName: concept.displayName,
      factionDisplayName: concept.factionDisplayName,
      activityKey: concept.activityKey,
      primaryCategory: concept.displayCategory.label,
      secondaryCategories: concept.displaySubcategories,
    })),
  },
  validationFactions: Array.from(validationFactionNames).map((factionName) => ({
    factionName,
    categoryCounts: categoryCountRows(concepts.filter((concept) => concept.factionDisplayName === factionName)),
  })),
  unresolvedCategories: unresolvedCategoryConcepts.map((concept) => ({
    conceptKey: concept.conceptKey,
    displayName: concept.displayName,
    factionDisplayName: concept.factionDisplayName,
    activityKey: concept.activityKey,
    archetypes: concept.archetypes,
    missionContractType: conceptEvidenceValue(concept, "contract:") ?? "contract:unknown",
    objectiveHandlerEvidence: concept.groupingEvidence.filter((item) => /^(activity|handler|title|description):/.test(item)),
    reason: concept.displayCategory.evidence.find((item) => item.startsWith("rule:")) ?? "rule:unknown",
    recommendedCategory: "Other / Unresolved",
    recommendationConfidence: "unresolved",
  })),
  previousStageAUnresolvedAudit: {
    previousCount: previousUnresolvedConcepts.length,
    currentUnresolvedCount: unresolvedCategoryConcepts.length,
    concepts: previousUnresolvedConcepts.map((concept) => ({
      conceptKey: concept.conceptKey,
      displayName: concept.displayName,
      factionDisplayName: concept.factionDisplayName,
      archetypes: concept.archetypes,
      activityKey: concept.activityKey,
      missionContractType: conceptEvidenceValue(concept, "contract:") ?? "contract:unknown",
      objectiveHandlerEvidence: concept.groupingEvidence.filter((item) => /^(activity|handler|title|description):/.test(item)),
      previousReason: concept.activityKey === "unknown" ? "rule:unknown-activity" : "rule:no-category-rule-matched",
      recommendedCategory: concept.displayCategory.label,
      recommendationConfidence: concept.displayCategory.confidence,
      currentRule: concept.displayCategory.evidence.find((item) => item.startsWith("rule:")) ?? "rule:unknown",
    })),
  },
  topUnresolvedReasons: Array.from(
    unresolvedCategoryConcepts.reduce((counts, concept) => {
      const reason = concept.displayCategory.evidence.find((item) => item.startsWith("rule:")) ?? "rule:unknown";
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()).entries()
  ).map(([reason, conceptCount]) => ({ reason, conceptCount })).sort((a, b) => b.conceptCount - a.conceptCount),
  examplesPerCategory: browseViews.full.categories.map((category) => ({
    categoryKey: category.categoryKey,
    displayName: category.displayName,
    examples: category.conceptKeys.slice(0, 8).map((conceptKey) => {
      const concept = conceptsByKey[conceptKey]!;
      return { conceptKey, displayName: concept.displayName, factionDisplayName: concept.factionDisplayName };
    }),
  })),
  questionablePlacements: concepts
    .filter((concept) => concept.displayCategory.confidence !== "resolved" || concept.displayCategory.label === "Collection" && concept.displayCategory.source === "archetype")
    .slice(0, 100)
    .map((concept) => ({
      conceptKey: concept.conceptKey,
      displayName: concept.displayName,
      factionDisplayName: concept.factionDisplayName,
      category: concept.displayCategory.label,
      categorySource: concept.displayCategory.source,
      categoryConfidence: concept.displayCategory.confidence,
      activityKey: concept.activityKey,
      archetypes: concept.archetypes,
      reason: concept.displayCategory.evidence.find((item) => item.startsWith("rule:")) ?? "rule:unknown",
    })),
  proposedFixesBeforeUiAdoption: [
    "Review remaining Other / Unresolved concepts only when structural handler or objective evidence becomes available.",
    "Validate Retrieval versus Cargo Recovery labels with in-game contract-manager terminology.",
    "Keep compound secondary activities as badges/subcategories rather than additional top-level cards.",
    "Keep Hauling - Stellar and Hauling - Interstellar as subcategories/badges and optional filters.",
  ],
  projections: {
    fullCategoryCount: browseViews.full.categories.length,
    factionProjectionCount: browseViews.factions.length,
    reputationProjectionCount: browseViews.reputation.length,
      fullAndFactionContainConceptKeysOnly: true,
      reputationPreservesExistingBrowseGroups: true,
  },
  slicedApi: {
    browserIndexVariantBodies: 0,
    browserIndexSerializedBytes: Buffer.byteLength(JSON.stringify(browserIndex), "utf8"),
    familyRoutesPreserved: Object.keys(familyDetailFiles).length === families.length && Object.keys(familyVariantFiles).length === families.length,
    exactVariantRoutesPreserved: Object.keys(variantDetailFiles).length === variants.length,
    conceptFamilyVariantReferencesPreserved: Object.keys(conceptFamilyVariantFiles).length === concepts.length,
  },
};

await Promise.all([
  mkdir(missionRoot, { recursive: true }),
  mkdir(stagingRoot, { recursive: true }),
  mkdir(familyRoot, { recursive: true }),
  mkdir(familyVariantsRoot, { recursive: true }),
  mkdir(variantRoot, { recursive: true }),
]);
await removeLegacyMissionOutputs();
await Promise.all([
  writeJson("mission_browser_index.json", browserIndex),
  writeJson("mission_shard_manifest.json", shardManifest),
  writeJson("mission_families.json", { schemaVersion: MISSION_SHAPED_SCHEMA_VERSION, sourceContractVersion: catalog.schemaVersion, generationId, generatedAt: shaped.generatedAt, sourceLatestModifiedAt: shaped.sourceLatestModifiedAt, records: families }),
  writeJson("mission_browse_groups.json", { schemaVersion: MISSION_SHAPED_SCHEMA_VERSION, sourceContractVersion: catalog.schemaVersion, generationId, generatedAt: shaped.generatedAt, sourceLatestModifiedAt: shaped.sourceLatestModifiedAt, records: missionBrowseGroups }),
  writeJson("mission_rewards.json", { schemaVersion: MISSION_SHAPED_SCHEMA_VERSION, sourceContractVersion: catalog.schemaVersion, generationId, generatedAt: shaped.generatedAt, records: rewards }),
  writeJson("mission_prerequisites.json", { schemaVersion: MISSION_SHAPED_SCHEMA_VERSION, sourceContractVersion: catalog.schemaVersion, generationId, generatedAt: shaped.generatedAt, records: prerequisites }),
  writeJson("mission_reputation.json", { schemaVersion: MISSION_SHAPED_SCHEMA_VERSION, sourceContractVersion: catalog.schemaVersion, generationId, generatedAt: shaped.generatedAt, records: reputation }),
  writeJson("mission_unresolved_refs.json", { schemaVersion: MISSION_SHAPED_SCHEMA_VERSION, sourceContractVersion: catalog.schemaVersion, generationId, generatedAt: shaped.generatedAt, records: unresolvedRefs }),
  writeJson("mission_browser_extraction_report.json", { schemaVersion: MISSION_SHAPED_SCHEMA_VERSION, sourceContractVersion: catalog.schemaVersion, generationId, ...report }),
  writeJson("mission_concepts.json", { schemaVersion: MISSION_SHAPED_SCHEMA_VERSION, sourceContractVersion: catalog.schemaVersion, generationId, generatedAt: shaped.generatedAt, sourceLatestModifiedAt: shaped.sourceLatestModifiedAt, records: concepts }),
  writeJson("mission_concept_shaping_report.json", { schemaVersion: MISSION_SHAPED_SCHEMA_VERSION, sourceContractVersion: catalog.schemaVersion, generationId, ...conceptReport }),
  writeJson("mission_category_projection_report.json", { schemaVersion: MISSION_SHAPED_SCHEMA_VERSION, sourceContractVersion: catalog.schemaVersion, generationId, ...categoryReport }),
  writeJson("mission_graph.json", graphArtifacts.graph),
  writeJson("mission_graph_validation_report.json", graphArtifacts.report),
  writeJson("mission_solver_reference.json", solverReference),
  ...families.map((family) => {
    const familyVariants = variantsByFamily.get(family.familyKey) ?? [];
    const detail: MissionFamilyDetailPayload = {
      schemaVersion: MISSION_SHAPED_SCHEMA_VERSION,
      sourceContractVersion: catalog.schemaVersion,
      generationId,
      generatedAt: shaped.generatedAt,
      sourceLatestModifiedAt: shaped.sourceLatestModifiedAt,
      family,
      groupSummary: {
        familyKey: family.familyKey,
        provider: family.provider,
        reputationScope: family.reputationScope,
        missionArchetype: family.missionArchetype,
        variantCount: family.variantCount,
      },
      rewardSummary: {
        rewardSummary: family.rewardSummary,
        blueprintRewards: family.blueprintRewards,
        blueprintRewardGroups: family.blueprintRewardGroups,
        reputationRewards: family.reputationRewards,
        rewardedReputationPaths: family.rewardedReputationPaths,
        creditRewardSummary: family.creditRewardSummary,
      },
      pickupSummary: {
        pickupSummary: family.pickupSummary,
        pickupStatuses: family.pickupStatuses,
        pickupUnresolvedCount: family.pickupUnresolvedCount,
        locations: family.locations,
        unresolvedLocationTokens: family.unresolvedLocationTokens,
      },
      blueprintSummary: {
        blueprintRewards: family.blueprintRewards,
        blueprintRewardGroups: family.blueprintRewardGroups,
      },
      variantKeys: family.variantKeys,
      variantSummaries: familyVariants.map((variant) => ({
        variantKey: variant.variantKey,
        displayName: variant.displayName,
        missionType: variant.missionType,
        pickupLocation: {
          status: variant.pickupLocation.status,
          displayName: variant.pickupLocation.displayName,
          confidence: variant.pickupLocation.confidence,
        },
        standingRequirement: variant.standingRequirement,
        creditStatus: variant.rewards.creditStatus,
        credits: variant.rewards.credits,
        hasBlueprintRewards: variant.rewards.blueprintRewardGroups.length > 0,
        hasUnresolvedRewards: variant.confidence.hasUnresolvedRewards,
      })),
      variantsFile: familyVariantFiles[family.familyKey]!,
    };
    return writeJsonAt(familyRoot, missionPayloadFileName(family.familyKey), detail);
  }),
  ...families.map((family) => {
    const payload: MissionFamilyVariantsPayload = {
      schemaVersion: MISSION_SHAPED_SCHEMA_VERSION,
      sourceContractVersion: catalog.schemaVersion,
      generationId,
      generatedAt: shaped.generatedAt,
      sourceLatestModifiedAt: shaped.sourceLatestModifiedAt,
      familyKey: family.familyKey,
      variants: (variantsByFamily.get(family.familyKey) ?? []).map(projectCompactMissionVariantV2),
    };
    return writeJsonAt(familyVariantsRoot, missionPayloadFileName(family.familyKey), payload);
  }),
  ...variants.map((variant) => {
    const payload: MissionVariantDetailPayload = {
      schemaVersion: MISSION_SHAPED_SCHEMA_VERSION,
      sourceContractVersion: catalog.schemaVersion,
      generationId,
      generatedAt: shaped.generatedAt,
      sourceLatestModifiedAt: shaped.sourceLatestModifiedAt,
      familyKey: variant.familyKey,
      variant,
    };
    return writeJsonAt(variantRoot, missionPayloadFileName(variant.variantKey), payload);
  }),
]);
await assertMissionOutputSizes();
await publishImmutableMissionGeneration({
  missionRoot,
  stagingRoot,
  generationId,
  shaperVersion: missionShaperVersion,
  legacyRootFiles: legacyShapedRootFiles,
  legacyShardDirectories,
});

console.log(
  `Shaped ${families.length} mission families and ${variants.length} variants into generation ${generationId} at ${missionRoot}.`,
);
