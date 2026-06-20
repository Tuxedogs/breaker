// Blueprint Tracker shared localStorage keys and data helpers.

import type { ComponentRecipe } from "./craftingTypes";
import {
  loadBlueprintReleaseStateMap,
  loadBlueprintRewardMissionsCatalog,
  loadBlueprintSourceMissionMap,
} from "@/lib/craftingBlueprintSourcesApi";

export const RECIPE_BOOKMARK_STORAGE_KEY = "scintel:recipe:bookmarks:v1";
export const MISSION_BOOKMARK_STORAGE_KEY = "scintel:recipe:mission-bookmarks:v1";
export const COMPLETED_MISSIONS_STORAGE_KEY = "scintel:blueprint-tracker:completed-missions:v1";
export const ACQUIRED_BLUEPRINTS_STORAGE_KEY = "scintel:blueprint-tracker:acquired-blueprints:v1";
export const PINNED_MISSIONS_STORAGE_KEY = "scintel:blueprint-tracker:pinned-missions:v1";
export const MISSION_REWARD_SOURCES_URL = "/api/missions/blueprint_reward_sources.json";
export const MISSION_BLUEPRINT_REWARDS_URL = "/api/missions/mission_blueprint_rewards.json";

export function readStoredStringSet(key: string): Set<string> {
  if (typeof window === "undefined" || !window.localStorage) return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    const values = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(values) ? values.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

export function writeStoredStringSet(key: string, values: Set<string>) {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(key, JSON.stringify(Array.from(values)));
}

export type MissionSourceDetail = {
  id: string;
  title: string;
  subtitle?: string;
  poolName?: string;
  factionName?: string;
  chance?: number;
  isDisabled?: boolean;
  source: "mission" | "pool";
  blueprintGuid?: string;
};

export type BlueprintTrackerEntry = {
  itemKey: string;
  itemName: string;
  factionKey: string;
  factionName: string;
  category?: string;
  itemKind?: string;
  componentType?: string;
  size?: string;
  grade?: string;
  itemClass?: string;
  sourceTypes: Set<"recipe" | "mission">;
  recipeIds: string[];
  missionIds: string[];
  missions: MissionSourceDetail[];
  recipes: ComponentRecipe[];
  updatedAt: string;
};

export type BlueprintRewardItem = {
  rewardKey: string;
  blueprintGuid?: string;
  displayName: string;
  componentType?: string;
  size?: string;
  grade?: string;
  itemClass?: string;
  blueprintName?: string;
  poolGuid?: string;
  poolName?: string;
  poolChance?: number;
  rewardChance?: number;
  chance?: number;
  weight?: number;
};

export type MissionBlueprintReward = {
  missionId: string;
  title: string;
  description?: string;
  factionName: string;
  missionType?: string;
  category?: string;
  location?: string;
  system?: string;
  planet?: string;
  station?: string;
  missionGiver?: string;
  xp?: number | string;
  payment?: number | string;
  minStanding?: string;
  maxStanding?: string;
  prerequisites: string[];
  rewardPools: string[];
  rewards: BlueprintRewardItem[];
  reputationRewards: string[];
  creditRewards: string[];
  isDisabled?: boolean;
  isWorkInProgress?: boolean;
  debugName?: string;
  generatorName?: string;
  generatorPath?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim().replace(/\\n/g, "\n");
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function normalizeKey(value: string | undefined, fallback = "unknown"): string {
  return (value ?? fallback).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || fallback;
}

function normalizeMissionTitle(title: string): string {
  return title.replace(/~mission\(([^)]+)\)/g, "$1");
}

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function isMissionDisabledRecord(mission: Record<string, unknown>): boolean {
  const debugName = asNonEmptyString(mission.debugName) ?? asNonEmptyString(mission.contractDebugName);
  const title = asNonEmptyString(mission.title) ?? asNonEmptyString(mission.contractTitle);
  return isTruthyFlag(mission.notForRelease) || /\bdisabled\b/i.test([debugName, title].filter(Boolean).join(" "));
}

function formatRecordName(value: unknown): string | undefined {
  const raw = asNonEmptyString(value);
  if (!raw) return undefined;
  const local = raw.split(".").at(-1) ?? raw;
  return local
    .replace(/^(BP_REWARDS_|BP_REWARD_|BP_MISSIONREWARD_|ContractGenerator\.)/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function describeStanding(value: unknown): string | undefined {
  const standing = asRecord(value);
  if (!standing) return undefined;
  const name = asNonEmptyString(standing.displayName) ?? asNonEmptyString(standing.name);
  const minRep = asFiniteNumber(standing.minReputation);
  return [name, minRep !== undefined ? `${minRep} rep` : null].filter(Boolean).join(" / ") || undefined;
}

function describePrerequisite(value: unknown): string | null {
  const prereq = asRecord(value);
  if (!prereq) return null;
  const type = formatRecordName(prereq.type) ?? "Prerequisite";
  const resolved = Array.isArray(prereq.resolved)
    ? prereq.resolved
        .map((item) => {
          const record = asRecord(item);
          return record ? asNonEmptyString(record.displayName) ?? asNonEmptyString(record.name) : undefined;
        })
        .filter(Boolean)
        .join(", ")
    : "";
  const attrs = asRecord(prereq.attributes);
  const attrText = attrs
    ? Object.entries(attrs)
        .map(([key, val]) => `${key}: ${asNonEmptyString(val) ?? "Unknown"}`)
        .join(", ")
    : "";
  return [type, resolved || attrText].filter(Boolean).join(" - ");
}

function describeReputationReward(value: unknown): string | null {
  const reward = asRecord(value);
  if (!reward) return null;
  const amount = asFiniteNumber(reward.reputationAmount);
  const nested = asRecord(reward.reward);
  const nestedAmount = nested ? asFiniteNumber(nested.reputationAmount) : undefined;
  const finalAmount = amount ?? nestedAmount;
  if (finalAmount === undefined) return formatRecordName(reward.type) ?? null;
  return `${finalAmount > 0 ? "+" : ""}${finalAmount} reputation`;
}

function describeCreditReward(value: unknown): string | null {
  const reward = asRecord(value);
  if (!reward) return null;
  const attrs = asRecord(reward.attributes);
  const amount = attrs
    ? asFiniteNumber(attrs.amount) ?? asFiniteNumber(attrs.reward) ?? asFiniteNumber(attrs.value)
    : undefined;
  if (amount !== undefined) return `${amount.toLocaleString()} UEC`;
  return formatRecordName(reward.type) ?? null;
}

function firstParamText(params: unknown, names: string[]): string | undefined {
  const record = asRecord(params);
  if (!record) return undefined;
  for (const name of names) {
    const param = asRecord(record[name]);
    const text = param ? asNonEmptyString(param.text) ?? asNonEmptyString(param.raw) : undefined;
    if (text) return text;
  }
  return undefined;
}

function extractLocation(mission: Record<string, unknown>): string | undefined {
  return firstParamText(mission.stringParams, [
    "Location",
    "LocationName",
    "Destination",
    "DestinationName",
    "PickupLocation",
    "DropOffLocation",
  ]);
}

function normalizeReward(raw: unknown, pool: Record<string, unknown>, missionReward: Record<string, unknown>): BlueprintRewardItem | null {
  const reward = asRecord(raw);
  if (!reward) return null;
  const blueprintGuid = asNonEmptyString(reward.blueprintGuid);
  const displayName =
    asNonEmptyString(reward.displayName) ??
    formatRecordName(reward.blueprintName) ??
    blueprintGuid ??
    "Unknown Blueprint Source";
  const poolGuid = asNonEmptyString(pool.poolGuid) ?? asNonEmptyString(missionReward.blueprintPoolGuid);
  const poolChance = asFiniteNumber(reward.poolChance);
  const rewardChance = asFiniteNumber(missionReward.chance);
  const chance =
    poolChance !== undefined && rewardChance !== undefined
      ? poolChance * rewardChance
      : poolChance ?? rewardChance;

  return {
    rewardKey: blueprintGuid ?? `${poolGuid ?? "pool"}::${normalizeKey(displayName)}`,
    blueprintGuid,
    displayName,
    componentType: asNonEmptyString(reward.componentType),
    size: asNonEmptyString(reward.size),
    grade: asNonEmptyString(reward.grade),
    itemClass: asNonEmptyString(reward.class),
    blueprintName: asNonEmptyString(reward.blueprintName),
    poolGuid,
    poolName: asNonEmptyString(pool.displayName) ?? formatRecordName(pool.poolName),
    poolChance,
    rewardChance,
    chance,
    weight: asFiniteNumber(reward.weight),
  };
}

function normalizeMission(raw: unknown): MissionBlueprintReward | null {
  const mission = asRecord(raw);
  if (!mission) return null;
  const missionId = asNonEmptyString(mission.contractId);
  if (!missionId) return null;

  const title = normalizeMissionTitle(
    asNonEmptyString(mission.title) ?? asNonEmptyString(mission.debugName) ?? "Unknown Mission"
  );
  const rewardMap = new Map<string, BlueprintRewardItem>();
  const rewardPools = new Set<string>();

  for (const item of Array.isArray(mission.blueprintRewards) ? mission.blueprintRewards : []) {
    const missionReward = asRecord(item);
    const pool = missionReward ? asRecord(missionReward.pool) : null;
    if (!missionReward || !pool) continue;
    const poolName = asNonEmptyString(pool.displayName) ?? formatRecordName(pool.poolName);
    if (poolName) rewardPools.add(poolName);
    for (const rawReward of Array.isArray(pool.rewards) ? pool.rewards : []) {
      const reward = normalizeReward(rawReward, pool, missionReward);
      if (!reward) continue;
      const key = reward.blueprintGuid ?? normalizeKey(reward.displayName);
      if (!rewardMap.has(key)) rewardMap.set(key, reward);
    }
  }

  if (rewardMap.size === 0) return null;

  return {
    missionId,
    title,
    description: asNonEmptyString(mission.description),
    factionName: asNonEmptyString(mission.factionName) ?? "Unknown Faction",
    missionType: asNonEmptyString(mission.missionType) ?? formatRecordName(mission.handlerType),
    category: asNonEmptyString(mission.contractType),
    location: extractLocation(mission),
    system: firstParamText(mission.stringParams, ["System", "SystemName"]),
    planet: firstParamText(mission.stringParams, ["Planet", "PlanetName"]),
    station: firstParamText(mission.stringParams, ["Station", "StationName"]),
    missionGiver: firstParamText(mission.stringParams, ["Contractor", "MissionGiver", "Giver"]),
    xp: asFiniteNumber(mission.xpReward) ?? asNonEmptyString(mission.xpReward),
    payment: asFiniteNumber(mission.uecReward) ?? asNonEmptyString(mission.payment),
    minStanding: describeStanding(mission.minStanding),
    maxStanding: describeStanding(mission.maxStanding),
    prerequisites: (Array.isArray(mission.prerequisites) ? mission.prerequisites : [])
      .map(describePrerequisite)
      .filter((v): v is string => Boolean(v)),
    rewardPools: Array.from(rewardPools),
    rewards: Array.from(rewardMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    reputationRewards: (Array.isArray(mission.reputationRewards) ? mission.reputationRewards : [])
      .map(describeReputationReward)
      .filter((v): v is string => Boolean(v)),
    creditRewards: (Array.isArray(mission.creditRewardTypes) ? mission.creditRewardTypes : [])
      .map(describeCreditReward)
      .filter((v): v is string => Boolean(v)),
    isDisabled: isMissionDisabledRecord(mission),
    isWorkInProgress: isTruthyFlag(mission.workInProgress),
    debugName: asNonEmptyString(mission.debugName),
    generatorName: asNonEmptyString(mission.generatorName),
    generatorPath: asNonEmptyString(mission.generatorPath),
  };
}

let missionRewardsCache: Promise<MissionBlueprintReward[]> | null = null;

export async function loadMissionBlueprintRewards(): Promise<MissionBlueprintReward[]> {
  if (!missionRewardsCache) {
    missionRewardsCache = loadBlueprintRewardMissionsCatalog()
      .then(({ missions, normalized }) => {
        if (normalized) {
          return missions as MissionBlueprintReward[];
        }
        return Array.isArray(missions)
          ? missions.map(normalizeMission).filter((value): value is MissionBlueprintReward => Boolean(value))
          : [];
      })
      .catch(() => []);
  }
  return missionRewardsCache;
}

function getFactionName(recipe: ComponentRecipe): string {
  return recipe.manufacturer?.trim() || "Unknown Faction";
}

function getOrCreateEntry(map: Map<string, BlueprintTrackerEntry>, recipe: ComponentRecipe): BlueprintTrackerEntry {
  const factionName = getFactionName(recipe);
  const factionKey = normalizeKey(factionName);
  const itemKey = recipe.blueprint_id;
  const mapKey = `${factionKey}::${itemKey}`;
  let entry = map.get(mapKey);
  if (!entry) {
    entry = {
      itemKey,
      itemName: recipe.component_name,
      factionKey,
      factionName,
      category: recipe.category ?? undefined,
      itemKind: recipe.item_kind ?? undefined,
      componentType: recipe.component_type ?? undefined,
      size: recipe.size ?? undefined,
      grade: recipe.grade ?? undefined,
      itemClass: recipe.class ?? undefined,
      sourceTypes: new Set(),
      recipeIds: [],
      missionIds: [],
      missions: [],
      recipes: [],
      updatedAt: new Date().toISOString(),
    };
    map.set(mapKey, entry);
  }
  return entry;
}

function normalizeReverseMission(value: unknown, releaseStateMap: Map<string, boolean>): MissionSourceDetail | null {
  const mission = asRecord(value);
  if (!mission) return null;
  const contractId = asNonEmptyString(mission.contractId);
  const poolGuid = asNonEmptyString(mission.poolGuid);
  const id = [contractId, poolGuid].filter(Boolean).join(":");
  if (!id) return null;
  const poolChance = asFiniteNumber(mission.poolChance);
  const rewardChance = asFiniteNumber(mission.rewardChance);
  return {
    id: `mission:${id}`,
    title: normalizeMissionTitle(
      asNonEmptyString(mission.contractTitle) ?? asNonEmptyString(mission.contractDebugName) ?? "Unknown Blueprint Source"
    ),
    subtitle: asNonEmptyString(mission.generatorName),
    poolName: asNonEmptyString(mission.poolName),
    factionName: asNonEmptyString(mission.factionName),
    chance:
      poolChance !== undefined && rewardChance !== undefined
        ? poolChance * rewardChance
        : poolChance ?? rewardChance,
    isDisabled: contractId ? releaseStateMap.get(contractId) ?? isMissionDisabledRecord(mission) : isMissionDisabledRecord(mission),
    source: "mission",
  };
}

export function buildTrackerEntries(
  recipes: ComponentRecipe[],
  bookmarkedRecipeIds: Set<string>,
  bookmarkedMissionIds: Set<string>,
  missionMap: Map<string, MissionSourceDetail[]>,
): BlueprintTrackerEntry[] {
  const entryMap = new Map<string, BlueprintTrackerEntry>();
  const recipeByBlueprintId = new Map(recipes.map((recipe) => [recipe.blueprint_id, recipe]));
  const missionIdToBlueprintIds = new Map<string, string[]>();

  for (const recipe of recipes) {
    if (!bookmarkedRecipeIds.has(recipe.blueprint_id)) continue;
    const entry = getOrCreateEntry(entryMap, recipe);
    entry.recipeIds.push(recipe.blueprint_id);
    entry.recipes.push(recipe);
    entry.sourceTypes.add("recipe");
  }

  for (const [blueprintId, missions] of missionMap.entries()) {
    for (const mission of missions) {
      const list = missionIdToBlueprintIds.get(mission.id) ?? [];
      list.push(blueprintId);
      missionIdToBlueprintIds.set(mission.id, list);
    }
  }

  for (const missionId of bookmarkedMissionIds) {
    const blueprintIds = missionId.startsWith("pool:")
      ? [missionId.split(":")[1]].filter(Boolean)
      : missionIdToBlueprintIds.get(missionId) ?? [];
    for (const blueprintId of blueprintIds) {
      const recipe = recipeByBlueprintId.get(blueprintId);
      if (!recipe) continue;
      const entry = getOrCreateEntry(entryMap, recipe);
      if (!entry.missionIds.includes(missionId)) {
        entry.missionIds.push(missionId);
        entry.sourceTypes.add("mission");
      }
      const detail = (missionMap.get(blueprintId) ?? []).find((m) => m.id === missionId);
      if (detail && !entry.missions.some((m) => m.id === detail.id)) {
        entry.missions.push({ ...detail, blueprintGuid: blueprintId });
      }
    }
  }

  return Array.from(entryMap.values()).sort((a, b) => {
    const fc = a.factionName.localeCompare(b.factionName);
    return fc !== 0 ? fc : a.itemName.localeCompare(b.itemName);
  });
}

let missionMapCache: Promise<Map<string, MissionSourceDetail[]>> | null = null;

export async function loadMissionDetailMap(): Promise<Map<string, MissionSourceDetail[]>> {
  if (!missionMapCache) {
    missionMapCache = Promise.all([
      loadBlueprintSourceMissionMap(),
      loadBlueprintReleaseStateMap(),
    ])
      .then(([sourceMap, releaseStateMap]) => {
        const map = new Map<string, MissionSourceDetail[]>();
        for (const [blueprintGuid, missions] of sourceMap.entries()) {
          map.set(
            blueprintGuid,
            missions
              .map((mission) => normalizeReverseMission(mission, releaseStateMap))
              .filter((value): value is MissionSourceDetail => Boolean(value)),
          );
        }
        return map;
      })
      .catch(() => new Map());
  }
  return missionMapCache;
}
