import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { getMissionDataRoot } from "../config/missionDataRoot.js";
import {
  evaluateCurrentMissionEligibilityEnvelope,
  solveCurrentMissionPath,
} from "../missions/missionSolverData.js";
import type { PlayerMissionState } from "../missions/missionSolverTypes.js";

type RouteResult = { status: number; body: unknown };

type MissionFamilyView = {
  familyKey: string;
  provider: string;
  missionType: string;
  releaseFlags: string[];
  blueprintRewards: string[];
  reputationRewards: string[];
  creditRewardSummary: string;
  creditRewardStatuses?: Array<"fixed" | "calculated" | "formula_unresolved" | "variable" | "provenAbsent" | "unresolved">;
  itemRewardStatus?: "resolved" | "unresolved_entityClass" | "weighted_unresolved" | "none";
  rewardedReputationPaths: Array<{ scopeDisplayName: string }>;
  confidenceFlags: string[];
  unresolvedReferences: string[];
  unresolvedLocationTokens: string[];
  unresolvedRewardFields: string[];
  crimeStatRequirement: "notRequired" | "required" | "bounded" | "unknown";
  lawfulClassification: "lawful" | "unlawful" | "unknown";
  variantCount: number;
  searchText: string;
};

type MissionBrowseGroupView = {
  factionKey: string;
  factionDisplayName: string;
  reputationScopes: Array<{
    scopeKey: string;
    displayName: string;
    confidence: string;
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

type MissionConceptView = {
  conceptKey: string;
  familyKeys: string[];
};

type MissionBrowseViews = {
  full: { categories: Array<{ categoryKey: string; displayName: string; conceptKeys: string[] }> };
  factions: Array<{
    factionKey: string;
    factionDisplayName: string;
    categories: Array<{ categoryKey: string; displayName: string; conceptKeys: string[] }>;
  }>;
  reputation: MissionBrowseGroupView[];
};

type MissionBrowserIndex = {
  schemaVersion: 1 | 2;
  sourceContractVersion?: 3;
  generationId?: string;
  generatedAt: string;
  sourceLatestModifiedAt: string;
  sourceFiles: string[];
  summary: Record<string, number>;
  unresolvedSummary?: Record<string, number>;
  report?: Record<string, string>;
  filtersMeta?: {
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
  familiesByKey: Record<string, MissionFamilyView>;
  familyDetailFiles?: Record<string, string>;
  familyVariantFiles?: Record<string, string>;
  variantDetailFiles?: Record<string, string>;
  conceptsByKey?: Record<string, MissionConceptView>;
  conceptFamilyVariantFiles?: Record<string, string[]>;
  missionBrowseGroups: MissionBrowseGroupView[];
  browseViews?: MissionBrowseViews;
};

type MissionBrowserFilterOption = {
  key: string;
  label: string;
  count: number;
  colorKey?: string;
};

type MissionShardManifest = {
  schemaVersion?: 1 | 2;
  sourceContractVersion?: 3;
  generationId?: string;
  familyFilesByFamilyId?: Record<string, {
    familyKey: string;
    detailFile: string;
    variantsFile: string;
  }>;
  variantFilesByMissionId?: Record<string, {
    missionId: string;
    variantId: string;
    familyId: string;
    familyKey: string;
    detailFile: string;
    familyDetailFile: string;
    familyVariantsFile: string;
  }>;
  variantFilesByVariantId?: Record<string, {
    missionId: string;
    variantId: string;
    familyId: string;
    familyKey: string;
    detailFile: string;
    familyDetailFile: string;
    familyVariantsFile: string;
  }>;
};

let browserIndexCache: Promise<MissionBrowserIndex> | null = null;
let browserIndexModifiedAt = 0;
let browserIndexRoot = "";
let shardManifestCache: Promise<MissionShardManifest> | null = null;
let shardManifestModifiedAt = 0;
let shardManifestRoot = "";

function parseRouteUrl(rawUrl: string): URL {
  return new URL(rawUrl, "http://localhost");
}

async function readJson<T>(missionRoot: string, relativePath: string): Promise<T> {
  const filePath = path.resolve(missionRoot, relativePath);
  const relativeToRoot = path.relative(missionRoot, filePath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("Invalid mission data path.");
  }
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function loadBrowserIndex(missionRoot: string): Promise<MissionBrowserIndex> {
  const indexPath = path.join(missionRoot, "mission_browser_index.json");
  const modifiedAt = (await stat(indexPath)).mtimeMs;
  if (
    !browserIndexCache
    || missionRoot !== browserIndexRoot
    || modifiedAt !== browserIndexModifiedAt
  ) {
    browserIndexRoot = missionRoot;
    browserIndexModifiedAt = modifiedAt;
    browserIndexCache = readJson<MissionBrowserIndex>(missionRoot, "mission_browser_index.json");
  }
  return browserIndexCache;
}

async function loadShardManifest(missionRoot: string): Promise<MissionShardManifest> {
  const manifestPath = path.join(missionRoot, "mission_shard_manifest.json");
  const modifiedAt = (await stat(manifestPath)).mtimeMs;
  if (
    !shardManifestCache
    || missionRoot !== shardManifestRoot
    || modifiedAt !== shardManifestModifiedAt
  ) {
    shardManifestRoot = missionRoot;
    shardManifestModifiedAt = modifiedAt;
    shardManifestCache = readJson<MissionShardManifest>(missionRoot, "mission_shard_manifest.json");
  }
  return shardManifestCache;
}

function assertSupportedMissionGeneration(
  index: MissionBrowserIndex,
  manifest: MissionShardManifest,
): void {
  if (index.schemaVersion !== 1 && index.schemaVersion !== 2) {
    throw new Error(`Unsupported mission shaped schema ${String(index.schemaVersion)}.`);
  }
  if (index.schemaVersion !== 2) return;
  if (index.sourceContractVersion !== 3 || manifest.sourceContractVersion !== 3) {
    throw new Error("Mission schema version 2 requires source contract version 3.");
  }
  if (
    !index.generationId
    || !manifest.generationId
    || index.generationId !== manifest.generationId
    || manifest.schemaVersion !== index.schemaVersion
  ) {
    throw new Error("Mission browser index and shard manifest belong to different generations.");
  }
}

async function loadMissionGeneration(): Promise<{
  missionRoot: string;
  index: MissionBrowserIndex;
  manifest: MissionShardManifest;
}> {
  const missionRoot = getMissionDataRoot();
  const [index, manifest] = await Promise.all([
    loadBrowserIndex(missionRoot),
    loadShardManifest(missionRoot),
  ]);
  assertSupportedMissionGeneration(index, manifest);
  return { missionRoot, index, manifest };
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

function filterBrowserIndex(index: MissionBrowserIndex, url: URL): MissionBrowserIndex {
  const query = (url.searchParams.get("search") ?? "").trim().toLowerCase();
  const provider = url.searchParams.get("faction") ?? url.searchParams.get("provider") ?? "";
  const missionType = url.searchParams.get("type") ?? "";
  const reward = url.searchParams.get("reward") ?? "";
  const repReward = url.searchParams.get("repReward") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const confidence = url.searchParams.get("confidence") ?? "";

  const visibleFamilies = Object.values(index.familiesByKey).filter((family) => {
    if (query && !family.searchText.includes(query)) return false;
    if (provider && family.provider !== provider) return false;
    if (missionType && family.missionType !== missionType) return false;
    if (repReward && !family.rewardedReputationPaths.some((path) => path.scopeDisplayName === repReward)) return false;
    if (status && !family.releaseFlags.includes(status)) return false;
    if (!rewardMatches(family, reward)) return false;
    if (!confidenceMatches(family, confidence)) return false;
    return true;
  });
  const visibleFamilyKeys = new Set(visibleFamilies.map((family) => family.familyKey));
  const visibleConceptKeys = new Set(
    Object.values(index.conceptsByKey ?? {})
      .filter((concept) => concept.familyKeys.some((familyKey) => visibleFamilyKeys.has(familyKey)))
      .map((concept) => concept.conceptKey)
  );
  const missionBrowseGroups = index.missionBrowseGroups
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
  const browseViews = index.browseViews ? {
    full: {
      categories: index.browseViews.full.categories
        .map((category) => ({ ...category, conceptKeys: category.conceptKeys.filter((conceptKey) => visibleConceptKeys.has(conceptKey)) }))
        .filter((category) => category.conceptKeys.length > 0),
    },
    factions: index.browseViews.factions
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

  return {
    ...index,
    familiesByKey: Object.fromEntries(Array.from(referencedFamilyKeys).map((familyKey) => [familyKey, index.familiesByKey[familyKey]]).filter((entry): entry is [string, MissionFamilyView] => Boolean(entry[1]))),
    conceptsByKey: index.conceptsByKey
      ? Object.fromEntries(Array.from(visibleConceptKeys).map((conceptKey) => [conceptKey, index.conceptsByKey?.[conceptKey]]).filter((entry): entry is [string, MissionConceptView] => Boolean(entry[1])))
      : undefined,
    conceptFamilyVariantFiles: index.conceptFamilyVariantFiles
      ? Object.fromEntries(Array.from(visibleConceptKeys).map((conceptKey) => [conceptKey, index.conceptFamilyVariantFiles?.[conceptKey]]).filter((entry): entry is [string, string[]] => Boolean(entry[1])))
      : undefined,
    missionBrowseGroups,
    browseViews,
  };
}

function methodNotAllowed(): RouteResult {
  return { status: 405, body: { error: "Method not allowed" } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCountRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(
    (count) => typeof count === "number" && Number.isInteger(count) && count >= 0,
  );
}

function parsePlayerMissionState(value: unknown): PlayerMissionState | null {
  if (!isRecord(value)) return null;
  const completedContracts = value.completedContracts;
  const completionTags = value.completionTags;
  const reputation = value.reputation;
  const crimeStat = value.crimeStat;
  const location = value.location;
  if (
    !isRecord(completedContracts)
    || (completedContracts.knowledge !== "complete" && completedContracts.knowledge !== "partial")
    || !isCountRecord(completedContracts.countsByContract)
    || !isRecord(completionTags)
    || (completionTags.knowledge !== "complete" && completionTags.knowledge !== "partial")
    || !isCountRecord(completionTags.countsByTag)
    || !Array.isArray(reputation)
    || !isRecord(crimeStat)
    || !isRecord(location)
  ) return null;

  const validReputation = reputation.every((entry) => {
    if (!isRecord(entry) || typeof entry.factionId !== "string" || typeof entry.scopeId !== "string") return false;
    if (entry.status !== "known" && entry.status !== "unknown") return false;
    return (entry.standingId === undefined || entry.standingId === null || typeof entry.standingId === "string")
      && (entry.reputationValue === undefined || entry.reputationValue === null || (
        typeof entry.reputationValue === "number" && Number.isFinite(entry.reputationValue)
      ));
  });
  if (!validReputation) return null;

  if (crimeStat.status === "known") {
    if (typeof crimeStat.value !== "number" || !Number.isFinite(crimeStat.value) || crimeStat.value < 0) return null;
  } else if (crimeStat.status !== "unknown") return null;

  if (location.status === "known") {
    if (
      (location.locationId !== undefined && location.locationId !== null && typeof location.locationId !== "string")
      || (location.systemId !== undefined && location.systemId !== null && typeof location.systemId !== "string")
      || !Array.isArray(location.localityIds)
      || !location.localityIds.every((item) => typeof item === "string")
      || (location.membershipKnowledge !== "complete" && location.membershipKnowledge !== "partial")
    ) return null;
  } else if (location.status !== "unknown") return null;

  return value as PlayerMissionState;
}

function parseLocationPropertyBindings(value: unknown): Record<string, boolean> | undefined | null {
  if (value === undefined) return undefined;
  if (!isRecord(value) || !Object.values(value).every((item) => typeof item === "boolean")) return null;
  return value as Record<string, boolean>;
}

export async function handleMissionsRoute(method: string, rawUrl: string, body?: unknown): Promise<RouteResult | null> {
  const url = parseRouteUrl(rawUrl);
  const pathName = url.pathname;
  if (!pathName.startsWith("/api/missions/")) return null;

  const prerequisitePathMatch = pathName.match(/^\/api\/missions\/(?:variant|variants)\/([^/]+)\/prerequisite-path$/);
  if (prerequisitePathMatch) {
    if (method !== "POST") return methodNotAllowed();
    const request = isRecord(body) ? body : null;
    const playerState = parsePlayerMissionState(request?.playerState);
    const locationPropertyBindings = parseLocationPropertyBindings(request?.locationPropertyBindings);
    if (!request || !playerState || locationPropertyBindings === null) {
      return { status: 400, body: { error: "Invalid mission prerequisite path request." } };
    }
    const variantId = decodeURIComponent(prerequisitePathMatch[1] ?? "");
    try {
      const result = await solveCurrentMissionPath(
        { type: "variant_eligibility", variantId },
        playerState,
        { locationPropertyBindings },
      );
      return {
        status: 200,
        body: {
          schemaVersion: 1,
          generationId: result.generationId,
          result,
        },
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("is not published")) {
        return { status: 404, body: { error: "Mission variant not found." } };
      }
      throw error;
    }
  }

  const eligibilityMatch = pathName.match(/^\/api\/missions\/(?:variant|variants)\/([^/]+)\/eligibility$/);
  if (eligibilityMatch) {
    if (method !== "POST") return methodNotAllowed();
    const request = isRecord(body) ? body : null;
    const playerState = parsePlayerMissionState(request?.playerState);
    const locationPropertyBindings = parseLocationPropertyBindings(request?.locationPropertyBindings);
    if (!request || !playerState || locationPropertyBindings === null) {
      return { status: 400, body: { error: "Invalid mission eligibility request." } };
    }
    const variantId = decodeURIComponent(eligibilityMatch[1] ?? "");
    try {
      const evaluation = await evaluateCurrentMissionEligibilityEnvelope(
        variantId,
        playerState,
        { locationPropertyBindings },
      );
      return {
        status: 200,
        body: {
          schemaVersion: 1,
          generationId: evaluation.generationId,
          result: evaluation.result,
        },
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("is not published")) {
        return { status: 404, body: { error: "Mission variant not found." } };
      }
      throw error;
    }
  }

  if (method !== "GET") return methodNotAllowed();

  if (pathName === "/api/missions/browser") {
    const { index } = await loadMissionGeneration();
    return { status: 200, body: filterBrowserIndex(index, url) };
  }

  const familyVariantsMatch = pathName.match(/^\/api\/missions\/(?:family|families)\/([^/]+)\/variants$/);
  if (familyVariantsMatch) {
    const familyKey = decodeURIComponent(familyVariantsMatch[1] ?? "");
    const { missionRoot, index, manifest } = await loadMissionGeneration();
    const file = index.familyVariantFiles?.[familyKey] ?? manifest.familyFilesByFamilyId?.[familyKey]?.variantsFile;
    if (!file) return { status: 404, body: { error: "Mission family variants not found." } };
    return { status: 200, body: await readJson(missionRoot, file) };
  }

  const familyMatch = pathName.match(/^\/api\/missions\/(?:family|families)\/([^/]+)$/);
  if (familyMatch) {
    const familyKey = decodeURIComponent(familyMatch[1] ?? "");
    const { missionRoot, index, manifest } = await loadMissionGeneration();
    const file = index.familyDetailFiles?.[familyKey] ?? manifest.familyFilesByFamilyId?.[familyKey]?.detailFile;
    if (!file) return { status: 404, body: { error: "Mission family not found." } };
    return { status: 200, body: await readJson(missionRoot, file) };
  }

  const variantMatch = pathName.match(/^\/api\/missions\/variant\/([^/]+)$/)
    ?? pathName.match(/^\/api\/missions\/variants\/([^/]+)$/);
  if (variantMatch) {
    const variantKey = decodeURIComponent(variantMatch[1] ?? "");
    const { missionRoot, index, manifest } = await loadMissionGeneration();
    const manifestEntry = manifest.variantFilesByVariantId?.[variantKey] ?? manifest.variantFilesByMissionId?.[variantKey];
    const file = index.variantDetailFiles?.[variantKey] ?? manifestEntry?.detailFile;
    if (!file) return { status: 404, body: { error: "Mission variant not found." } };
    return { status: 200, body: await readJson(missionRoot, file) };
  }

  return null;
}
