import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { getMissionDataRoot } from "../config/missionDataRoot.js";

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
  schemaVersion: 1;
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

const missionRoot = getMissionDataRoot();
let browserIndexCache: Promise<MissionBrowserIndex> | null = null;
let browserIndexModifiedAt = 0;

function parseRouteUrl(rawUrl: string): URL {
  return new URL(rawUrl, "http://localhost");
}

async function readJson<T>(relativePath: string): Promise<T> {
  const filePath = path.resolve(missionRoot, relativePath);
  const relativeToRoot = path.relative(missionRoot, filePath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("Invalid mission data path.");
  }
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function loadBrowserIndex(): Promise<MissionBrowserIndex> {
  const indexPath = path.join(missionRoot, "mission_browser_index.json");
  const modifiedAt = (await stat(indexPath)).mtimeMs;
  if (!browserIndexCache || modifiedAt !== browserIndexModifiedAt) {
    browserIndexModifiedAt = modifiedAt;
    browserIndexCache = readJson<MissionBrowserIndex>("mission_browser_index.json");
  }
  return browserIndexCache;
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

export async function handleMissionsRoute(method: string, rawUrl: string): Promise<RouteResult | null> {
  const url = parseRouteUrl(rawUrl);
  const pathName = url.pathname;
  if (!pathName.startsWith("/api/missions/")) return null;
  if (method !== "GET") return methodNotAllowed();

  if (pathName === "/api/missions/browser") {
    return { status: 200, body: filterBrowserIndex(await loadBrowserIndex(), url) };
  }

  const familyVariantsMatch = pathName.match(/^\/api\/missions\/(?:family|families)\/([^/]+)\/variants$/);
  if (familyVariantsMatch) {
    const familyKey = decodeURIComponent(familyVariantsMatch[1] ?? "");
    const index = await loadBrowserIndex();
    const file = index.familyVariantFiles?.[familyKey];
    if (!file) return { status: 404, body: { error: "Mission family variants not found." } };
    return { status: 200, body: await readJson(file) };
  }

  const familyMatch = pathName.match(/^\/api\/missions\/(?:family|families)\/([^/]+)$/);
  if (familyMatch) {
    const familyKey = decodeURIComponent(familyMatch[1] ?? "");
    const index = await loadBrowserIndex();
    const file = index.familyDetailFiles?.[familyKey];
    if (!file) return { status: 404, body: { error: "Mission family not found." } };
    return { status: 200, body: await readJson(file) };
  }

  const variantMatch = pathName.match(/^\/api\/missions\/variant\/([^/]+)$/)
    ?? pathName.match(/^\/api\/missions\/variants\/([^/]+)$/);
  if (variantMatch) {
    const variantKey = decodeURIComponent(variantMatch[1] ?? "");
    const index = await loadBrowserIndex();
    const file = index.variantDetailFiles?.[variantKey];
    if (!file) return { status: 404, body: { error: "Mission variant not found." } };
    return { status: 200, body: await readJson(file) };
  }

  return null;
}
