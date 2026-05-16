// Blueprint Tracker — shared localStorage keys and data helpers.
// All bookmark state for recipes and missions lives in ComponentRecipeTable.
// This module provides read-only access to those stores for the tracker page.

import type { ComponentRecipe } from "./craftingTypes";

export const RECIPE_BOOKMARK_STORAGE_KEY = "scintel:recipe:bookmarks:v1";
export const MISSION_BOOKMARK_STORAGE_KEY = "scintel:recipe:mission-bookmarks:v1";
export const MISSION_REWARD_SOURCES_URL = "/api/missions/blueprint_reward_sources.json";

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

// ── Mission source types ──────────────────────────────────────────────────────

export type MissionSourceDetail = {
  id: string;
  title: string;
  subtitle?: string;
  poolName?: string;
  factionName?: string;
  chance?: number;
  source: "mission" | "pool";
  blueprintGuid?: string;
};

// ── Tracker entry ─────────────────────────────────────────────────────────────

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

// ── Normalization helpers ─────────────────────────────────────────────────────

function normalizeFactionKey(name: string | null | undefined): string {
  if (!name?.trim()) return "unknown";
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function normalizeItemKey(recipe: ComponentRecipe): string {
  return recipe.blueprint_id;
}

function getFactionName(recipe: ComponentRecipe): string {
  return recipe.manufacturer?.trim() || "Unknown Faction";
}

// ── Builder ───────────────────────────────────────────────────────────────────

export function buildTrackerEntries(
  recipes: ComponentRecipe[],
  bookmarkedRecipeIds: Set<string>,
  bookmarkedMissionIds: Set<string>,
  missionMap: Map<string, MissionSourceDetail[]>,
): BlueprintTrackerEntry[] {
  const entryMap = new Map<string, BlueprintTrackerEntry>();

  function getOrCreate(recipe: ComponentRecipe): BlueprintTrackerEntry {
    const itemKey = normalizeItemKey(recipe);
    const factionName = getFactionName(recipe);
    const factionKey = normalizeFactionKey(factionName);
    const mapKey = `${factionKey}::${itemKey}`;

    let entry = entryMap.get(mapKey);
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
      entryMap.set(mapKey, entry);
    }
    return entry;
  }

  // 1. Collect bookmarked recipes
  for (const recipe of recipes) {
    if (!bookmarkedRecipeIds.has(recipe.blueprint_id)) continue;
    const entry = getOrCreate(recipe);
    if (!entry.recipeIds.includes(recipe.blueprint_id)) {
      entry.recipeIds.push(recipe.blueprint_id);
      entry.recipes.push(recipe);
      entry.sourceTypes.add("recipe");
    }
  }

  // Build reverse map: missionId → blueprintId from pool-type IDs (pool:blueprintId:stableKey)
  const poolMissionToBlueprintId = new Map<string, string>();
  for (const missionId of bookmarkedMissionIds) {
    if (missionId.startsWith("pool:")) {
      const parts = missionId.split(":");
      // pool:<blueprintId>:<stableKey> — blueprintId is parts[1]
      if (parts.length >= 3) {
        poolMissionToBlueprintId.set(missionId, parts[1]);
      }
    }
  }

  // Build reverse map: missionId → blueprintId from mission-type IDs via missionMap
  const missionIdToBlueprintIds = new Map<string, string[]>();
  for (const [blueprintId, entries] of missionMap.entries()) {
    for (const entry of entries) {
      if (!missionIdToBlueprintIds.has(entry.id)) {
        missionIdToBlueprintIds.set(entry.id, []);
      }
      missionIdToBlueprintIds.get(entry.id)!.push(blueprintId);
    }
  }

  // Build recipe lookup by blueprint_id
  const recipeByBlueprintId = new Map<string, ComponentRecipe>();
  for (const recipe of recipes) {
    recipeByBlueprintId.set(recipe.blueprint_id, recipe);
  }

  // 2. Collect bookmarked missions
  for (const missionId of bookmarkedMissionIds) {
    let resolvedBlueprintIds: string[] = [];

    if (missionId.startsWith("pool:")) {
      const bpId = poolMissionToBlueprintId.get(missionId);
      if (bpId) resolvedBlueprintIds = [bpId];
    } else {
      resolvedBlueprintIds = missionIdToBlueprintIds.get(missionId) ?? [];
    }

    if (resolvedBlueprintIds.length === 0) {
      // Can't resolve to a recipe — create a placeholder under Unknown Faction
      const placeholderKey = `unknown::${missionId}`;
      if (!entryMap.has(placeholderKey)) {
        entryMap.set(placeholderKey, {
          itemKey: missionId,
          itemName: "Unknown Blueprint Source",
          factionKey: "unknown",
          factionName: "Unknown Faction",
          sourceTypes: new Set(["mission"]),
          recipeIds: [],
          missionIds: [missionId],
          missions: [],
          recipes: [],
          updatedAt: new Date().toISOString(),
        });
      }
      continue;
    }

    for (const blueprintId of resolvedBlueprintIds) {
      const recipe = recipeByBlueprintId.get(blueprintId);
      if (!recipe) continue;

      const entry = getOrCreate(recipe);
      if (!entry.missionIds.includes(missionId)) {
        entry.missionIds.push(missionId);
        entry.sourceTypes.add("mission");

        const missionDetail = (missionMap.get(blueprintId) ?? []).find((m) => m.id === missionId);
        if (missionDetail && !entry.missions.find((m) => m.id === missionId)) {
          entry.missions.push({ ...missionDetail, blueprintGuid: blueprintId });
        }
      }
    }
  }

  // 3. Sort: by faction name then item name
  return Array.from(entryMap.values()).sort((a, b) => {
    const fc = a.factionName.localeCompare(b.factionName);
    return fc !== 0 ? fc : a.itemName.localeCompare(b.itemName);
  });
}

// ── Mission API loading ───────────────────────────────────────────────────────

let missionMapCache: Promise<Map<string, MissionSourceDetail[]>> | null = null;

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeMissionTitle(title: string): string {
  return title.replace(/~mission\(([^)]+)\)/g, "$1");
}

function normalizeMission(value: unknown): MissionSourceDetail | null {
  if (!isRecord(value)) return null;
  const contractId = asNonEmptyString(value.contractId);
  const poolGuid = asNonEmptyString(value.poolGuid);
  const id = [contractId, poolGuid].filter(Boolean).join(":");
  if (!id) return null;

  const poolChance = asFiniteNumber(value.poolChance);
  const rewardChance = asFiniteNumber(value.rewardChance);

  return {
    id: `mission:${id}`,
    title: normalizeMissionTitle(
      asNonEmptyString(value.contractTitle) ?? asNonEmptyString(value.contractDebugName) ?? "Unknown Blueprint Source"
    ),
    subtitle: asNonEmptyString(value.generatorName),
    poolName: asNonEmptyString(value.poolName),
    factionName: asNonEmptyString(value.factionName),
    chance:
      typeof poolChance === "number" && typeof rewardChance === "number"
        ? poolChance * rewardChance
        : poolChance ?? rewardChance,
    source: "mission",
  };
}

export async function loadMissionDetailMap(): Promise<Map<string, MissionSourceDetail[]>> {
  if (!missionMapCache) {
    missionMapCache = fetch(MISSION_REWARD_SOURCES_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`Mission sources unavailable: ${r.status}`);
        return r.json() as Promise<unknown>;
      })
      .then((data) => {
        const map = new Map<string, MissionSourceDetail[]>();
        if (!Array.isArray(data)) return map;
        for (const item of data) {
          if (!isRecord(item)) continue;
          const blueprintGuid = asNonEmptyString(item.blueprintGuid);
          if (!blueprintGuid || !Array.isArray(item.missions)) continue;
          const entries = (item.missions as unknown[]).flatMap((m) => {
            const e = normalizeMission(m);
            return e ? [e] : [];
          });
          map.set(blueprintGuid, entries);
        }
        return map;
      })
      .catch(() => new Map());
  }
  return missionMapCache;
}
