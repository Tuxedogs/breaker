import {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { Link, useLocation } from "react-router-dom";
import type { ComponentRecipe } from "../utils/craftingTypes";
import { buildResourceGroups } from "../../shared/msbResourceGroups";
import { getComponentDisplayName } from "../utils/componentDisplayNames";
import {
  getModifiersAtQuality,
  summariseUnmatchedModifiers,
  formatProperty,
} from "../utils/qualityModifiers";
import { getMaterialQualityKey } from "../utils/materialQuality";
import {
  getModifierImpact,
} from "@/lib/gameplay/propertyUtils";
import { apiUrl } from "@/lib/apiUrl";
import { parseJsonResponse } from "@/lib/safeJson";
import { useAuthSession } from "@/lib/auth/useAuthSession";
import {
  DEFAULT_BAND_INDEX,
  FALLBACK_QUALITY_BANDS,
  clampBandIndex,
  clampQuality,
  findNearestBandForQuality,
  getBandEffectiveQuality as getEffectiveQualityFromBands,
  rarityClassFromBandIndex,
  rarityFromBandIndex,
  type QualityBand,
} from "../utils/qualityBands";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { buildComponentCardSchema, buildComponentCardSchemaFromIndex, formatCraftTime, type ComponentCardMetric } from "../utils/componentCardSchema";
import { hasSupabaseConfig, signInWithDiscord } from "@/lib/supabaseClient";
import { deleteUserBlueprint, fetchSavedBlueprints, saveUserBlueprint } from "@/lib/userSavedBlueprints";
import { useCompareStore } from "@/stores/compareStore";


const NO_VALUE = "__none__";
const QUALITY_QUANTIZATION_URL = "/api/crafting/material_quality_quantization.json";
const MISSION_REWARD_SOURCES_URL = "/api/missions/blueprint_reward_sources.json";
const MISSION_BLUEPRINT_REWARDS_URL = "/api/missions/mission_blueprint_rewards.json";
const RECIPE_FILTER_STORAGE_KEY = "scintel:recipe:msb-sidebar:v1";
const RECIPE_BOOKMARK_STORAGE_KEY = "scintel:recipe:bookmarks:v1";
const MISSION_BOOKMARK_STORAGE_KEY = "scintel:recipe:mission-bookmarks:v1";
const MAX_VISIBLE_RESULTS = 20;

type RecipeSidebarState = {
  search: string;
  fps: string[];
  vehicles: string[];
  sizes: string[];
  grades: string[];
  classes: string[];
  resources: string[];
  miningCategories: string[];
};

type RecipeRewardPoolSummary = {
  poolName?: string;
  poolGuid?: string;
  sourceFolder?: string;
  displayName: string;
  weight?: number;
};

type MissionRewardEntry = {
  id: string;
  title: string;
  subtitle?: string;
  poolName?: string;
  factionName?: string;
  chance?: number;
  isDisabled?: boolean;
  source: "mission" | "pool";
};

type ApiBlueprintMissionSource = {
  blueprintGuid?: unknown;
  missions?: unknown;
};

type ApiBlueprintMission = {
  contractId?: unknown;
  contractTitle?: unknown;
  contractDebugName?: unknown;
  debugName?: unknown;
  title?: unknown;
  generatorName?: unknown;
  factionName?: unknown;
  poolGuid?: unknown;
  poolName?: unknown;
  poolChance?: unknown;
  rewardChance?: unknown;
  notForRelease?: unknown;
  workInProgress?: unknown;
};

let missionRewardSourceMapPromise: Promise<Map<string, MissionRewardEntry[]>> | null = null;
let missionReleaseStateMapPromise: Promise<Map<string, boolean>> | null = null;

const EMPTY_RECIPE_SIDEBAR_STATE: RecipeSidebarState = {
  search: "",
  fps: [],
  vehicles: [],
  sizes: [],
  grades: [],
  classes: [],
  resources: [],
  miningCategories: [],
};

// Label normalization for Type chips
const VEHICLE_TYPE_LABEL_MAP: Record<string, string> = {
  weaponGun: "Ship Guns",
  cooler: "Cooler",
  powerplant: "Powerplant",
  quantumdrive: "Quantum Drive",
  radar: "Radar",
  shield: "Shield",
  weaponMining: "Mining Laser",
};

// Types collapsed into the Utility chip
const UTILITY_TYPES = new Set(["dockingCollar", "salvageHead", "salvageModifier", "weaponMining"]);
function normalizeVehicleTypeLabel(value: string): string {
  return VEHICLE_TYPE_LABEL_MAP[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

function buildMineableResourceList(recipes: ComponentRecipe[]) {
  const byName = new Map<string, { id: string; label: string; miningType?: string }>();

  for (const recipe of recipes) {
    for (const material of recipe.materials ?? []) {
      const label = String(material.material_name ?? "").trim();
      if (!label) continue;
      const id = material.cost_id || label;
      const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "");
      if (!key || byName.has(key)) continue;
      // cost_type "item" = FPS/hand-gatherable gems; "resource" = refined ores (ship/vehicle)
      const miningType = material.cost_type === "item" ? "Hand" : undefined;
      byName.set(key, { id, label, miningType });
    }
  }

  return [...byName.values()];
}

function readStoredSidebarState<T>(key: string, fallback: T): T {
  if (typeof window === "undefined" || !window.localStorage) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredSidebarState<T>(key: string, state: T) {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(key, JSON.stringify(state));
}

function readStoredStringSet(key: string): Set<string> {
  if (typeof window === "undefined" || !window.localStorage) return new Set();

  try {
    const raw = window.localStorage.getItem(key);
    const values = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(values) ? values.filter((value): value is string => typeof value === "string") : []);
  } catch {
    return new Set();
  }
}

function writeStoredStringSet(key: string, values: Set<string>) {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(key, JSON.stringify(Array.from(values)));
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatMissionChance(value?: number): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${Math.round(value * 100)}%`;
}

function normalizeMissionTitle(value: string): string {
  return value.replace(/~mission\(([^)]+)\)/g, "$1");
}

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function isMissionDisabledRecord(mission: ApiBlueprintMission): boolean {
  const debugName = asNonEmptyString(mission.debugName) ?? asNonEmptyString(mission.contractDebugName);
  const title = asNonEmptyString(mission.title) ?? asNonEmptyString(mission.contractTitle);
  return isTruthyFlag(mission.notForRelease) || /\bdisabled\b/i.test([debugName, title].filter(Boolean).join(" "));
}

async function loadMissionReleaseStateMap(): Promise<Map<string, boolean>> {
  const url = apiUrl(MISSION_BLUEPRINT_REWARDS_URL);
  missionReleaseStateMapPromise ??= fetch(url)
    .then(async (response) => {
      const data = await parseJsonResponse<unknown>(response, {
        label: "mission blueprint rewards release state",
        url,
      });
      if (!response.ok) throw new Error(`Mission blueprint rewards unavailable: ${response.status}`);
      return data;
    })
    .then((data) => {
      const map = new Map<string, boolean>();
      if (!Array.isArray(data)) return map;
      for (const value of data) {
        if (!isRecord(value)) continue;
        const mission = value as ApiBlueprintMission;
        const contractId = asNonEmptyString(mission.contractId);
        if (contractId) map.set(contractId, isMissionDisabledRecord(mission));
      }
      return map;
    })
    .catch(() => new Map());
  return missionReleaseStateMapPromise;
}

function normalizeMissionRewardEntry(value: unknown, releaseStateMap: Map<string, boolean>): MissionRewardEntry | null {
  if (!isRecord(value)) return null;

  const mission = value as ApiBlueprintMission;
  const contractId = asNonEmptyString(mission.contractId);
  const poolGuid = asNonEmptyString(mission.poolGuid);
  const contractTitle = asNonEmptyString(mission.contractTitle);
  const contractDebugName = asNonEmptyString(mission.contractDebugName);
  const generatorName = asNonEmptyString(mission.generatorName);
  const poolName = asNonEmptyString(mission.poolName);
  const factionName = asNonEmptyString(mission.factionName);
  const poolChance = asFiniteNumber(mission.poolChance);
  const rewardChance = asFiniteNumber(mission.rewardChance);
  const id = [contractId, poolGuid].filter(Boolean).join(":");

  if (!id) return null;

  const isDisabled = contractId ? releaseStateMap.get(contractId) ?? isMissionDisabledRecord(mission) : isMissionDisabledRecord(mission);
  const sourceTitle = contractTitle ?? contractDebugName;
  if (!sourceTitle) return null;
  const title = normalizeMissionTitle(sourceTitle);

  return {
    id: `mission:${id}`,
    title,
    subtitle: generatorName,
    poolName,
    factionName,
    chance: typeof poolChance === "number" && typeof rewardChance === "number" ? poolChance * rewardChance : poolChance ?? rewardChance,
    isDisabled,
    source: "mission",
  };
}

function normalizeMissionSourceRecord(value: unknown, releaseStateMap: Map<string, boolean>): { blueprintGuid: string; entries: MissionRewardEntry[] } | null {
  if (!isRecord(value)) return null;

  const record = value as ApiBlueprintMissionSource;
  const blueprintGuid = asNonEmptyString(record.blueprintGuid);
  if (!blueprintGuid || !Array.isArray(record.missions)) return null;

  const entries = record.missions.flatMap((mission) => {
    const entry = normalizeMissionRewardEntry(mission, releaseStateMap);
    return entry ? [entry] : [];
  });

  return { blueprintGuid, entries };
}

async function loadMissionRewardSourceMap(): Promise<Map<string, MissionRewardEntry[]>> {
  const url = apiUrl(MISSION_REWARD_SOURCES_URL);
  missionRewardSourceMapPromise ??= fetch(url)
    .then(async (response) => {
      const data = await parseJsonResponse<unknown>(response, {
        label: "crafting blueprint reward sources",
        url,
      });
      if (!response.ok) throw new Error(`Mission reward sources unavailable: ${response.status}`);
      return data;
    })
    .then(async (data) => {
      const map = new Map<string, MissionRewardEntry[]>();
      if (!Array.isArray(data)) return map;
      const releaseStateMap = await loadMissionReleaseStateMap();

      for (const value of data) {
        const record = normalizeMissionSourceRecord(value, releaseStateMap);
        if (record) map.set(record.blueprintGuid, record.entries);
      }

      return map;
    });

  return missionRewardSourceMapPromise;
}

function buildPoolMissionEntries(
  recipe: ComponentRecipe,
  rewardPools: RecipeRewardPoolSummary[],
): MissionRewardEntry[] {
  return rewardPools.flatMap((pool, index) => {
    const stableKey = pool.poolGuid ?? pool.poolName ?? pool.sourceFolder ?? `${recipe.blueprint_id}:${index}`;
    if (!stableKey) return [];

    return [{
      id: `pool:${recipe.blueprint_id}:${stableKey}`,
      title: pool.displayName,
      subtitle: pool.poolName,
      poolName: pool.poolName,
      chance: pool.weight,
      source: "pool" as const,
    }];
  });
}

function useMissionRewardEntries(
  recipe: ComponentRecipe,
  rewardPools: RecipeRewardPoolSummary[],
): MissionRewardEntry[] {
  const fallbackEntries = useMemo(
    () => buildPoolMissionEntries(recipe, rewardPools),
    [recipe, rewardPools],
  );
  const [apiEntries, setApiEntries] = useState<MissionRewardEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setApiEntries(null);

    loadMissionRewardSourceMap()
      .then((map) => {
        if (!cancelled) setApiEntries(map.get(recipe.blueprint_id) ?? []);
      })
      .catch(() => {
        if (!cancelled) setApiEntries([]);
      });

    return () => {
      cancelled = true;
    };
  }, [recipe.blueprint_id]);

  return apiEntries && apiEntries.length > 0 ? apiEntries : fallbackEntries;
}

const QUERY_ALIAS_MAP: Record<string, string> = {
  mil: "military",
  mili: "military",
  milit: "military",
  civ: "civilian",
  civi: "civilian",
  ind: "industrial",
  indu: "industrial",
  qt: "quantum",
  qd: "quantum",
};

function normalizeQueryToken(token: string): string {
  const t = token.toLowerCase();
  if (QUERY_ALIAS_MAP[t]) return QUERY_ALIAS_MAP[t];

  const rev = t.match(/^(\d+)s$/);
  if (rev) return `s${rev[1]}`;

  return t;
}

function buildRecipeSearchText(r: ComponentRecipe): string {
  const displayName =
    r.item_kind === "vehicle"
      ? r.component_name
      : getComponentDisplayName(r.component_name);

  const sizeStr = r.size ? `s${r.size} ${r.size}` : "no size";
  const kindExtra = r.item_kind === "fps" ? "fps" : "";

  const raw = [
    displayName,
    r.component_name,
    r.fallback_name,
    r.internal_name,
    r.manufacturer,
    r.class,
    r.grade,
    r.category,
    r.component_type,
    r.wiki_type,
    r.blueprint_id,
    sizeStr,
    kindExtra,
  ]
    .map((v) => String(v ?? "").toLowerCase())
    .join(" ");

  const compact = raw.replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "");

  return `${raw} ${compact}`;
}

function matchesSearch(searchText: string, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const tokens = trimmed.toLowerCase().split(/\s+/);
  return tokens.every((raw) => searchText.includes(normalizeQueryToken(raw)));
}

function getTypeBadges(recipe: ComponentRecipe): string[] {
  if (recipe.item_kind === "fps") {
    const cat = recipe.category ?? "";

    if (cat.toLowerCase().startsWith("fps ")) {
      return [cat.slice(4).toUpperCase(), "FPS"];
    }

    return cat ? [cat.toUpperCase(), "FPS"] : ["FPS"];
  }

  const ct = recipe.component_type ?? "";
  return ct ? [ct.toUpperCase()] : [];
}

function titleCaseWeaponToken(value: string): string {
  if (!value) return "";
  if (value.toLowerCase() === "massdriver") return "Mass Driver";
  if (value.toLowerCase() === "scatter") return "Scatter Gun";

  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/gun$/i, " Gun")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getWeaponItemType(recipe: ComponentRecipe): string | null {
  if (recipe.item_kind !== "vehicle" || recipe.component_type !== "weaponGun") {
    return null;
  }

  const sourcePath = recipe.source_file ?? "";
  const pathMatch = sourcePath.match(/\/weapons\/([^/]+)\/([^/]+)\//i);
  if (pathMatch && pathMatch[1] !== "$templates") {
    return [pathMatch[1], pathMatch[2]]
      .map(titleCaseWeaponToken)
      .filter(Boolean)
      .join(" ");
  }

  const internalName = recipe.internal_name ?? recipe.raw_name ?? "";
  const nameMatch = internalName.match(/^BP(?:_CRAFT)?_[^_]+_(.+?)(?:_VNG)?_S\d+/i);
  if (!nameMatch) return null;

  return titleCaseWeaponToken(nameMatch[1].replace(/_/g, " "));
}

function getSubtitle(recipe: ComponentRecipe): string {
  if (recipe.item_kind === "fps") {
    const parts = [recipe.category, recipe.wiki_type].filter(Boolean);
    return parts.join(" · ");
  }

  return getWeaponItemType(recipe) ?? recipe.component_type ?? "";
}

function formatSize(size: string | null | undefined): string | null {
  if (!size) return null;
  return `S${size}`;
}

function getRecipeDisplayName(recipe: ComponentRecipe): string {
  return recipe.item_kind === "vehicle"
    ? recipe.component_name
    : getComponentDisplayName(recipe.component_name);
}

type RecipeVariantIdentity = {
  baseName: string;
  variantLabel: string;
  groupKey: string;
};

function normalizeDisplayText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const KNOWN_VARIANT_SUFFIXES = [
  "Alpine Sunset",
  "Firestarter",
  "Sunchaser",
  "Aftershock",
  "Snowdrift",
  "Terracotta",
  "Brimstone",
  "Hailstorm",
  "Tactical",
  "Modified",
  "Charcoal",
  "Desert",
  "Roger",
  "Rager",
  "Thule",
  "Fate",
];

function buildRecipeGroupKey(recipe: ComponentRecipe, baseName: string): string {
  return [
    recipe.item_kind ?? "vehicle",
    recipe.component_type ?? "",
    recipe.category ?? "",
    recipe.wiki_type ?? "",
    baseName.toLowerCase(),
  ].join("::");
}

function makeRecipeVariantIdentity(
  recipe: ComponentRecipe,
  baseName: string,
  variantLabel: string,
): RecipeVariantIdentity {
  const normalizedBaseName = normalizeDisplayText(baseName);
  const normalizedVariantLabel = normalizeDisplayText(variantLabel) || "Standard variant";

  return {
    baseName: normalizedBaseName,
    variantLabel: normalizedVariantLabel,
    groupKey: buildRecipeGroupKey(recipe, normalizedBaseName),
  };
}

function deriveRecipeVariantIdentity(recipe: ComponentRecipe): RecipeVariantIdentity {
  const displayName = getRecipeDisplayName(recipe);
  const quotedVariantMatch = displayName.match(/^(.+?)\s+"([^"]+)"\s+(.+)$/);

  if (quotedVariantMatch) {
    const [, prefix, quotedText, suffix] = quotedVariantMatch;
    return makeRecipeVariantIdentity(recipe, `${prefix} ${suffix}`, quotedText);
  }

  const parentheticalVariantMatch = displayName.match(/^(.+?)\s+\(([^)]+)\)$/);

  if (parentheticalVariantMatch) {
    const [, baseName, parentheticalText] = parentheticalVariantMatch;
    return makeRecipeVariantIdentity(recipe, baseName, parentheticalText);
  }

  const normalizedDisplayName = normalizeDisplayText(displayName);
  const suffix = KNOWN_VARIANT_SUFFIXES.find((label) => {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\s+${escapedLabel}$`, "i").test(normalizedDisplayName);
  });

  if (suffix) {
    return makeRecipeVariantIdentity(
      recipe,
      normalizedDisplayName.replace(new RegExp(`\\s+${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), ""),
      suffix,
    );
  }

  const fallback = normalizeDisplayText(recipe.fallback_name ?? "");
  const baseName = normalizedDisplayName;

  return makeRecipeVariantIdentity(
    recipe,
    baseName,
    fallback && fallback.toLowerCase() !== "default" && fallback.toLowerCase() !== baseName.toLowerCase()
      ? fallback
      : "Standard variant",
  );
}

function getVariantLabel(recipe: ComponentRecipe, baseName: string): string {
  const identity = deriveRecipeVariantIdentity(recipe);
  const raw = identity.variantLabel;

  if (!raw || raw.toLowerCase() === "default" || raw.toLowerCase() === baseName.toLowerCase()) {
    return "Standard variant";
  }

  return raw;
}

function getInlineMeta(recipe: ComponentRecipe): string[] {
  return [formatSize(recipe.size), recipe.grade, recipe.class].filter(
    (value): value is string => Boolean(value),
  );
}

function getSharedValue(
  recipes: ComponentRecipe[],
  getValue: (recipe: ComponentRecipe) => string | null,
): string | null {
  const values = new Set(recipes.map(getValue).filter(Boolean));
  return values.size === 1 ? [...values][0] : null;
}

function dedupeRecipeVariants(recipes: ComponentRecipe[], baseName: string): ComponentRecipe[] {
  const seen = new Set<string>();
  const seenExactRecipes = new Set<string>();
  const deduped: ComponentRecipe[] = [];

  for (const recipe of recipes) {
    const exactRecipeKey = [
      recipe.blueprint_id,
      recipe.output_entityClass,
      getRecipeDisplayName(recipe),
    ].join("::");

    if (seenExactRecipes.has(exactRecipeKey)) continue;
    seenExactRecipes.add(exactRecipeKey);

    const variantLabel = getVariantLabel(recipe, baseName).toLowerCase();
    const key =
      variantLabel === "standard variant"
        ? variantLabel
        : `${variantLabel}::${recipe.blueprint_id}`;

    if (seen.has(key)) continue;

    seen.add(key);
    deduped.push(recipe);
  }

  return deduped;
}

function getImpactClass(impact: "good" | "bad" | "neutral"): string {
  if (impact === "good") return "craft-ok";
  if (impact === "bad") return "craft-shortage";
  return "";
}

const STAT_HEADER_LINE_RE = /^(Manufacturer|Item Type|Class|Size|Grade|Magazine Size|Rate Of Fire|Effective Range|Ammo Type|Damage Type|Fire Mode)\s*:/i;

function trimItemDescription(raw: string): string {
  const lines = raw.replace(/\\n/g, "\n").split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    if (STAT_HEADER_LINE_RE.test(line.trim())) continue;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

function formatCompactNumber(value: number, options: { sign?: boolean } = {}): string {
  if (!Number.isFinite(value)) return "-";
  const rounded = Math.round(value * 100) / 100;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  const formatted = normalized.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
  return options.sign && normalized > 0 ? `+${formatted}` : formatted;
}

function formatModifierPercent(value: number): string {
  if (!Number.isFinite(value)) return "-";
  const rounded = Math.round(value * 10) / 10;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  const formatted = normalized.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(normalized) ? 0 : 1,
    maximumFractionDigits: Number.isInteger(normalized) ? 0 : 1,
  });
  return `${normalized > 0 ? "+" : ""}${formatted}%`;
}

function formatModifierStatName(property: string): string {
  const labels: Record<string, string> = {
    GPP_Health_MaxHealth: "HP",
    GPP_Shield_MaxHealth: "Shield HP",
    GPP_ItemResource_PowerGeneration: "Power",
    GPP_ItemResource_CoolantGeneration: "Coolant",
    GPP_Quantum_FuelRequirement: "Quantum Fuel",
    GPP_Quantum_Speed: "Quantum Speed",
    GPP_Radar_MaxAimAssistDistance: "Radar Max",
    GPP_Radar_MinAimAssistDistance: "Radar Min",
    GPP_Weapon_Damage: "Damage",
    GPP_Weapon_FireRate: "Fire Rate",
    GPP_Weapon_ReloadSpeed: "Reload",
    GPP_Weapon_Spread: "Spread",
    GPP_Weapon_Recoil_Kick: "Recoil Kick",
    GPP_Weapon_Recoil_Handling: "Recoil Handling",
    GPP_Weapon_Recoil_Smoothness: "Recoil Smoothness",
  };

  return labels[property] ?? formatProperty(property);
}

function readNumericPath(source: unknown, path: string[]): number | undefined {
  let current = source;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "number" && Number.isFinite(current) ? current : undefined;
}

function getBaseStatValue(
  recipe: ComponentRecipe,
  property: string,
): number | undefined {
  const baseStats = recipe.baseStats;
  if (!baseStats) return undefined;

  const statPaths: Record<string, string[]> = {
    GPP_Health_MaxHealth: ["health"],
    GPP_Shield_MaxHealth: ["resources", "generation", "Shield"],
    GPP_ItemResource_PowerGeneration: ["resources", "generation", "Power"],
    GPP_ItemResource_CoolantGeneration: ["resources", "generation", "Coolant"],
    GPP_Quantum_FuelRequirement: ["resources", "consumption", "QuantumFuel"],
  };

  const directPath = statPaths[property];
  if (directPath) return readNumericPath(baseStats, directPath);

  if (property === "GPP_Weapon_Damage") {
    return (
      readNumericPath(baseStats, ["weapon", "damage"]) ??
      readNumericPath(baseStats, ["damage"])
    );
  }

  if (property === "GPP_Weapon_FireRate") {
    return (
      readNumericPath(baseStats, ["weapon", "fireRate"]) ??
      readNumericPath(baseStats, ["fireRate"])
    );
  }

  if (property === "GPP_Weapon_ReloadSpeed") {
    return (
      readNumericPath(baseStats, ["weapon", "reloadSpeed"]) ??
      readNumericPath(baseStats, ["reloadSpeed"])
    );
  }

  return undefined;
}

function applyModifierToBase(baseValue: number, modifierValue: number, modifierMode?: string): number {
  if (modifierMode === "integerAdditive") return baseValue + modifierValue;
  return baseValue * (1 + modifierValue / 100);
}

function formatModifiedNumber(value: number, property: string): string {
  if (!Number.isFinite(value)) return "-";

  const rounded =
    property === "GPP_ItemResource_PowerGeneration"
      ? Math.round(value)
      : Math.round(value * 100) / 100;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  const formatted = normalized.toLocaleString("en-US", {
    maximumFractionDigits: Number.isInteger(normalized) ? 0 : 2,
  });

  if (property === "GPP_ItemResource_PowerGeneration") {
    return `${formatted} ${Math.abs(normalized) === 1 ? "pip" : "pips"}`;
  }

  return formatted;
}

function formatSignedModifiedNumber(value: number, property: string): string {
  const formatted = formatModifiedNumber(value, property);
  if (!Number.isFinite(value) || value <= 0 || formatted === "-") return formatted;
  return `+${formatted}`;
}

function formatMaterialModifierDisplay(
  property: string,
  baseValue: number | undefined,
  modifierValue: number,
  modifierMode?: string,
): {
  base?: string;
  basePercent?: string;    // raw modifier % from data, shown next to base
  modifier: string;        // actual delta applied to base
  modifierPercent?: string; // delta as % of base
  total?: string;
  totalPercent?: string;
} {
  const rawPercent = modifierMode === "integerAdditive" ? undefined : formatContributionValue(modifierValue, modifierMode);

  if (baseValue === undefined) {
    return {
      modifier: formatContributionValue(modifierValue, modifierMode),
      modifierPercent: rawPercent,
    };
  }

  const modifiedValue = applyModifierToBase(baseValue, modifierValue, modifierMode);
  const modifierDelta = modifiedValue - baseValue;
  const deltaPercent =
    baseValue !== 0 ? (modifierDelta / baseValue) * 100 : undefined;

  const totalPercentNum =
    typeof deltaPercent === "number" ? deltaPercent : undefined;

  return {
    base: formatModifiedNumber(baseValue, property),
    basePercent: rawPercent,
    modifier: formatSignedModifiedNumber(modifierDelta, property),
    modifierPercent: deltaPercent !== undefined ? formatModifierPercent(deltaPercent) : undefined,
    total: formatModifiedNumber(modifiedValue, property),
    totalPercent: totalPercentNum !== undefined ? formatModifierPercent(totalPercentNum) : undefined,
  };
}

function getTotalModifierKey(property: string, modifierMode?: string): string {
  return `${property}||${modifierMode ?? ""}`;
}

function MaterialStatIcon({ property }: { property: string }) {
  const label = formatModifierStatName(property);

  type IconKey = "shield" | "heart" | "pulse" | "zap" | "droplet" | "radar" | "recoil" | "reload" | "spread" | "damage";

  const icon: IconKey = (() => {
    if (property.includes("Shield") || property.includes("Resistance")) return "shield";
    if (property === "GPP_Health_MaxHealth") return "heart";
    if (property.includes("Frequency") || property.includes("FireRate")) return "pulse";
    if (property.includes("Power")) return "zap";
    if (property.includes("Coolant")) return "droplet";
    if (property.includes("Radar")) return "radar";
    if (property.includes("Recoil")) return "recoil";
    if (property.includes("Reload")) return "reload";
    if (property.includes("Spread")) return "spread";
    if (property.includes("Damage")) return "damage";
    return "heart";
  })();

  const paths: Record<IconKey, React.ReactNode> = {
    shield: <path d="M12 3.5 5.5 6.4v5.1c0 4.4 2.7 8 6.5 9 3.8-1 6.5-4.6 6.5-9V6.4L12 3.5Z" />,
    heart: <path d="M12 20.3s-6.9-4.1-8.2-8.4C2.9 8.8 4.5 6 7.3 6c1.7 0 3.1.9 4.7 2.6C13.6 6.9 15 6 16.7 6c2.8 0 4.4 2.8 3.5 5.9-1.3 4.3-8.2 8.4-8.2 8.4Z" />,
    pulse: <path d="M3.5 12h3.3l1.7-4.3 3 8.6 2-5.2h2.2l1.1-2.5 1.6 3.4h2.1" />,
    zap: <path d="M13 2 4.5 13.5H12L11 22l8.5-11.5H12L13 2Z" />,
    droplet: <path d="M12 3c0 0-6 6.3-6 10a6 6 0 0 0 12 0c0-3.7-6-10-6-10Z" />,
    radar: <><circle cx="12" cy="12" r="2" /><path d="M12 2a10 10 0 0 1 0 20M12 6a6 6 0 0 1 0 12" /></>,
    recoil: <path d="M4 12h10M10 8l4 4-4 4M18 7v10" />,
    reload: <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M20 7v4h-4M4 17v-4h4" />,
    spread: <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M6 6l3.5 3.5M18 6l-3.5 3.5M6 18l3.5-3.5M18 18l-3.5-3.5" />,
    damage: <path d="M12 2 9 9H2l5.5 4-2 7L12 16l6.5 4-2-7L22 9h-7L12 2Z" />,
  };

  return (
    <span className="craft-matq-stat-icon" aria-hidden="true" data-icon={icon}>
      <svg viewBox="0 0 24 24" focusable="false">
        {paths[icon]}
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <span className="craft-matq-chevron" aria-hidden="true" data-expanded={expanded ? "true" : "false"}>
      <svg viewBox="0 0 20 20" focusable="false">
        <path d="m5 8 5 5 5-5" />
      </svg>
    </span>
  );
}

function formatModifiedStat(
  baseValue: number | undefined,
  modifierValue: number,
  modifierMode?: string,
): string {
  if (baseValue === undefined) {
    return modifierMode === "integerAdditive"
      ? formatCompactNumber(modifierValue, { sign: true })
      : `${formatCompactNumber(modifierValue, { sign: true })}%`;
  }

  const modifiedValue = applyModifierToBase(baseValue, modifierValue, modifierMode);
  const delta = modifiedValue - baseValue;
  return formatModifierPercent((delta / baseValue) * 100);
}

type MaterialQuantization = {
  name?: string;
  recordName?: string;
  recordType?: string;
  displayName?: string;
  materialName?: string;
  materialId?: string;
  materialKey?: string;
  guid?: string;
  path?: string;
  /** New format: discrete in-game quality values for this material. */
  qualityOptions?: number[];
  /** Legacy format: bands with start/end/mappedValue. Still accepted as fallback. */
  bands?: QualityBand[];
};

function normalizeMaterialLookup(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function quantizationNameToMaterialKey(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const withoutPrefix = raw.replace(/^Quantization[_\s-]*/i, "");
  const normalized = normalizeMaterialLookup(withoutPrefix);

  return normalized || null;
}

function getQuantizationLookupKeys(item: MaterialQuantization): string[] {
  const keys = new Set<string>();

  const add = (value: string | null | undefined) => {
    const normalized = normalizeMaterialLookup(value);
    if (normalized) keys.add(normalized);
  };

  add(item.materialKey);
  add(item.materialName);
  add(item.materialId);
  add(item.displayName);
  add(item.name);
  add(item.recordName);

  const fromName = quantizationNameToMaterialKey(item.name);
  const fromRecordName = quantizationNameToMaterialKey(item.recordName);

  if (fromName) keys.add(fromName);
  if (fromRecordName) keys.add(fromRecordName);

  const pathMatch = String(item.path ?? "").match(/quantization[_-]([^/.]+)\.xml$/i);
  if (pathMatch?.[1]) {
    keys.add(normalizeMaterialLookup(pathMatch[1]));
  }

  return Array.from(keys);
}

function getMaterialName(mat: ComponentRecipe["materials"][number]): string {
  return String(mat.material_name ?? "");
}

function useQualityQuantization() {
  const [data, setData] = useState<MaterialQuantization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(apiUrl(QUALITY_QUANTIZATION_URL));
        const url = apiUrl(QUALITY_QUANTIZATION_URL);

        const json = await parseJsonResponse<MaterialQuantization[]>(res, {
          label: "crafting material quantization",
          url,
        });
        if (!res.ok) {
          throw new Error(
            `Failed to load ${QUALITY_QUANTIZATION_URL}: ${res.status}`,
          );
        }

        if (!cancelled) {
          setData(Array.isArray(json) ? json : []);
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setData([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const byMaterial = useMemo(() => {
    const map = new Map<string, MaterialQuantization>();

    for (const item of data) {
      for (const key of getQuantizationLookupKeys(item)) {
        map.set(key, item);
      }
    }

    if (import.meta.env.DEV) {
      console.debug("[quality] quantization loaded", {
        rows: data.length,
        keys: [...map.keys()].slice(0, 20),
        hasStileron: map.has("stileron"),
        hasFeynmaline: map.has("feynmaline"),
      });
    }

    return map;
  }, [data]);

  const getMaterialQuantization = useCallback(
    (materialName: string): MaterialQuantization | undefined => {
      return byMaterial.get(normalizeMaterialLookup(materialName));
    },
    [byMaterial],
  );

  const getBandsForMaterial = useCallback(
    (materialName: string): QualityBand[] => {
      if (loading) return [];
      const q = getMaterialQuantization(materialName);
      if (!q) {
        if (import.meta.env.DEV) console.warn("[quality] no quantization data for material", {
          requested: materialName,
          normalized: normalizeMaterialLookup(materialName),
          loadedRows: data.length,
          indexedKeys: [...byMaterial.keys()].slice(0, 20),
          stileronKeys: [...byMaterial.keys()].filter((k) => k.includes("stileron")),
          feynmalineKeys: [...byMaterial.keys()].filter((k) => k.includes("feynmaline")),
        });
        return [];
      }
      if (q.qualityOptions?.length) {
        return q.qualityOptions.map((v) => ({ start: v, end: v, mappedValue: v }));
      }
      if (q.bands?.length) {
        return q.bands;
      }
      if (import.meta.env.DEV) console.warn(`[quality] quantization entry for "${materialName}" has no qualityOptions or bands`);
      return [];
    },
    [loading, getMaterialQuantization, data, byMaterial],
  );

  const getBandEffectiveQuality = useCallback(
    (materialName: string, bandIndex: number): number => {
      const bands = getBandsForMaterial(materialName);
      return getEffectiveQualityFromBands(bands, bandIndex);
    },
    [getBandsForMaterial],
  );

  const getBandLabel = useCallback(
    (materialName: string, bandIndex: number): string => {
      const bands = getBandsForMaterial(materialName);
      const safeIndex = clampBandIndex(bandIndex, bands);
      const band = bands[safeIndex];
      return band ? `${Number(band.mappedValue)}` : "—";
    },
    [getBandsForMaterial],
  );

  return {
    loading,
    getMaterialQuantization,
    getBandsForMaterial,
    getBandEffectiveQuality,
    getBandLabel,
  };
}

export function UnmatchedModifierGroups({
  modifiers,
}: {
  modifiers: ReturnType<typeof summariseUnmatchedModifiers>;
}) {
  const bySlot = new Map<string, typeof modifiers>();

  for (const s of modifiers) {
    const arr = bySlot.get(s.slot) ?? [];
    arr.push(s);
    bySlot.set(s.slot, arr);
  }

  return (
    <>
      {Array.from(bySlot.entries()).map(([slot, props]) => (
        <div key={slot} className="craft-mod-group craft-mod-group--general">
          <div className="craft-mod-group-header">
            <span className="craft-drawer-mat-slot">{slot}</span>
            <span className="craft-mod-group-sep">/</span>
            <span className="craft-mod-group-mat craft-muted">general</span>
          </div>

          <div className="craft-drawer-modifier-list">
            {props.map(({ property, minPercent, maxPercent }, i) => (
              <div key={i} className="craft-drawer-modifier-row">
                <span className="craft-badge craft-badge--sm craft-badge--slot craft-drawer-modifier-slot">
                  {slot}
                </span>

                <span className="craft-drawer-modifier-prop">
                  {formatProperty(property)}
                </span>

                <span className="craft-drawer-modifier-val craft-mod-range">
                  {minPercent.toFixed(1)}% → {maxPercent >= 0 ? "+" : ""}
                  {maxPercent.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function OverallModifierGroup({
  recipe,
  modifiers,
  quality,
  rarityClass,
}: {
  recipe: ComponentRecipe;
  modifiers: NonNullable<ComponentRecipe["overallQualityModifiers"]>;
  quality?: number;
  rarityClass: string;
}) {
  if (modifiers.length === 0) return null;

  return (
    <div className="craft-mod-group craft-mod-group--general">
      <div className="craft-mod-group-header">
        <span className="craft-drawer-mat-slot">ASPECTS</span>
        <span className="craft-mod-group-sep">/</span>
        <span className="craft-mod-group-mat craft-muted">
          Component HP Modifier
        </span>
        {quality !== undefined && (
          <span className="craft-mod-group-q">{quality}</span>
        )}
      </div>

      {quality === undefined ? (
        <div className="craft-drawer-modifier-list">
          {summariseUnmatchedModifiers(modifiers).map(
            ({ property, minPercent, maxPercent }, i) => (
              <div key={i} className="craft-drawer-modifier-row">
                <span className="craft-badge craft-badge--sm craft-badge--slot craft-drawer-modifier-slot">
                  ASPECTS
                </span>

                <span className="craft-drawer-modifier-prop">
                  {formatProperty(property)}
                </span>

                <span className="craft-drawer-modifier-val craft-mod-range">
                  {minPercent.toFixed(1)}% → {maxPercent >= 0 ? "+" : ""}
                  {maxPercent.toFixed(1)}%
                </span>
              </div>
            ),
          )}
        </div>
      ) : (
        <div className="craft-drawer-modifier-list">
          {getModifiersAtQuality(modifiers, quality).map((m, i) => {
            const baseValue = getBaseStatValue(recipe, m.property);

            return (
              <div key={i} className="craft-drawer-modifier-row">
                <span className="craft-badge craft-badge--sm craft-badge--slot craft-drawer-modifier-slot">
                  {m.slot}
                </span>

                <span className="craft-drawer-modifier-prop">
                  {formatProperty(m.property)}
                </span>

                <span
                  className={`craft-drawer-modifier-val ${rarityClass}`}
                >
                  {formatModifiedStat(baseValue, m.value, m.modifierMode)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function hasMaterialQualityModifiers(mat: ComponentRecipe["materials"][number]): boolean {
  return (mat.qualityModifiers?.length ?? 0) > 0;
}

function getQualityBandsForMaterial(
  mat: ComponentRecipe["materials"][number],
  getBandsForMaterial: (materialName: string) => QualityBand[],
): QualityBand[] {
  const bands = getBandsForMaterial(getMaterialName(mat));
  if (bands.length > 0) return bands;
  return hasMaterialQualityModifiers(mat) ? FALLBACK_QUALITY_BANDS : bands;
}

function getMaterialEffectiveQuality(
  mat: ComponentRecipe["materials"][number],
  bandIndex: number,
  getBandsForMaterial: (materialName: string) => QualityBand[],
): number {
  return getEffectiveQualityFromBands(getQualityBandsForMaterial(mat, getBandsForMaterial), bandIndex);
}

function useMaterialQualityModel({
  mat,
  bandIndex,
  getBandsForMaterial,
}: {
  mat: ComponentRecipe["materials"][number];
  bandIndex: number;
  getBandsForMaterial: (materialName: string) => QualityBand[];
}) {
  const materialName = getMaterialName(mat);
  const bands = getQualityBandsForMaterial(mat, getBandsForMaterial);
  const safeBandIndex = clampBandIndex(bandIndex, bands);
  const bandNumber = safeBandIndex + 1;
  const quality = getEffectiveQualityFromBands(bands, safeBandIndex);
  const selectedQualityTierClass = rarityClassFromBandIndex(bandNumber);
  const atQuality = useMemo(() => {
    const mods = getModifiersAtQuality(mat.qualityModifiers ?? [], quality);
    return [...mods].sort((a, b) => {
      const order = (p: string) =>
        p === "WeaponRecoilKick" ? 0 : p === "WeaponRecoilSmoothness" ? 1 : 2;
      return order(a.property) - order(b.property);
    });
  }, [mat.qualityModifiers, quality]);
  const railMarkers = useMemo(
    () => {
      const mappedValues = bands.map((band) => clampQuality(Number(band.mappedValue ?? 0)));
      const minMappedValue = mappedValues[0] ?? 0;
      const maxMappedValue = mappedValues[mappedValues.length - 1] ?? 1000;
      const range = Math.max(1, maxMappedValue - minMappedValue);

      return bands.map((band, i) => {
        const mappedValue = clampQuality(Number(band.mappedValue ?? 0));
        const left = Math.max(0, Math.min(100, ((mappedValue - minMappedValue) / range) * 100));
        const edge = left < 4 ? "start" : left > 96 ? "end" : "middle";

        return {
          index: i,
          mappedValue,
          left,
          edge,
        };
      });
    },
    [bands],
  );
  const findNearestBandForMappedValue = useCallback(
    (value: number) => findNearestBandForQuality(bands, value),
    [bands],
  );
  const bandOnePct = Math.max(0, Math.min(100, railMarkers[0]?.left ?? 0));
  const minQuality = clampQuality(Number(bands[0]?.mappedValue ?? 0));
  const maxQuality = clampQuality(Number(bands[bands.length - 1]?.mappedValue ?? 1000));
  const qualityRange = Math.max(1, maxQuality - minQuality);
  const selectedPct = Math.max(0, Math.min(100, ((quality - minQuality) / qualityRange) * 100));
  const fillPct = Math.max(0, selectedPct - bandOnePct);

  return {
    materialName,
    bands,
    safeBandIndex,
    bandNumber,
    quality,
    selectedQualityTierClass,
    atQuality,
    railMarkers,
    findNearestBandForMappedValue,
    bandOnePct,
    fillPct,
    minQuality,
    maxQuality,
  };
}

export function MaterialQualityRow({
  recipe,
  mat,
  bandIndex,
  onBandChange,
  getBandsForMaterial,
  totalModifiers,
}: {
  recipe: ComponentRecipe;
  mat: ComponentRecipe["materials"][number];
  bandIndex: number;
  onBandChange: (bandIndex: number) => void;
  getBandsForMaterial: (materialName: string) => QualityBand[];
  totalModifiers: TotalModifierRow[];
}) {
  const {
    bands,
    safeBandIndex,
    quality,
    selectedQualityTierClass,
    atQuality,
    railMarkers,
    findNearestBandForMappedValue,
    bandOnePct,
    fillPct,
    minQuality,
    maxQuality,
  } = useMaterialQualityModel({
    mat,
    bandIndex,
    getBandsForMaterial,
  });
  const totalModifierByStat = useMemo(
    () =>
      new Map(
        totalModifiers.map((row) => [
          getTotalModifierKey(row.property, row.modifierMode),
          row,
        ]),
      ),
    [totalModifiers],
  );
  const [expandedModifierRows, setExpandedModifierRows] = useState<Set<string>>(() => new Set());
  const [hasTouchedModifierRows, setHasTouchedModifierRows] = useState(false);
  const defaultExpandedRowKey = useMemo(() => {
    const firstExpandable = atQuality.find((m) => getBaseStatValue(recipe, m.property) !== undefined);
    return firstExpandable ? `${firstExpandable.slot}||${firstExpandable.property}` : null;
  }, [atQuality, recipe]);
  const toggleModifierRow = useCallback((rowKey: string) => {
    setHasTouchedModifierRows(true);
    setExpandedModifierRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  }, []);
  if (bands.length === 0) {
    return (
      <div className="craft-material-card craft-matq-card craft-matq-card--unavailable">
        <div className="craft-material-card-head craft-matq-header">
          <div className="craft-material-identity craft-matq-identity">
            <span className="craft-material-slot craft-matq-slot">{mat.slot}</span>
            <span className="craft-material-name craft-matq-name">{getMaterialName(mat)}</span>
          </div>
          <span className="craft-quality-readout craft-matq-band-pill">Quality data unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <div className="craft-material-card craft-matq-card" data-band={safeBandIndex}>
      <div className="craft-material-card-head craft-matq-header">
  <div className="craft-material-identity craft-matq-identity">
    <span className="craft-material-slot craft-matq-slot">
      {[mat.slot, Number.isFinite(mat.quantity) ? `Required ${mat.quantity}` : null]
        .filter(Boolean)
        .join(" / ")}
    </span>
    <span className="craft-material-name craft-matq-name">{mat.material_name}</span>
  </div>

  <span className={`craft-quality-readout craft-matq-band-pill ${selectedQualityTierClass}`}>
    Band {safeBandIndex + 1} <span aria-hidden="true">·</span> {quality}
  </span>
</div>

      <div className="craft-quality-control craft-matq-slider-wrap">
        <div className="craft-quality-rail-wrap craft-matq-rail-wrap">
          <input
            type="range"
            min={minQuality}
            max={maxQuality}
            step={1}
            value={quality}
            onChange={(e) => {
              const rawValue = Number(e.target.value);
              onBandChange(findNearestBandForMappedValue(rawValue));
            }}
            className="craft-quality-input craft-matq-slider"
            aria-label={`Quality band for ${mat.material_name}`}
          />

<div
  className={`craft-quality-rail craft-matq-rail ${selectedQualityTierClass}`}
  style={
    {
      "--band-one-pct": `${bandOnePct}%`,
    } as React.CSSProperties
  }
>
  <div
    className={`craft-quality-rail-fill craft-matq-rail-fill ${selectedQualityTierClass}`}
    style={
      {
        "--band-one-pct": `${bandOnePct}%`,
        "--fill-pct": `${fillPct}%`,
      } as React.CSSProperties
    }
  />

            {railMarkers.map((marker) => {
              const markerTierClass = rarityClassFromBandIndex(marker.index + 1);
              const markerState =
                marker.index < safeBandIndex
                  ? " is-before-active"
                  : marker.index === safeBandIndex
                    ? " is-active"
                    : "";

              return (
              <button
                type="button"
                key={`${marker.index}-${marker.mappedValue}`}
                className={`craft-quality-marker craft-matq-band-marker ${markerTierClass}${markerState}`}
                style={{ left: `${marker.left}%` }}
                data-edge={marker.edge}
                onClick={() => onBandChange(marker.index)}
                aria-label={`Use mapped quality ${marker.mappedValue}`}
              >
                <span className="craft-quality-marker-line craft-matq-dot" />
                <span className={`craft-quality-marker-value craft-matq-marker-value ${markerTierClass}`}>{marker.mappedValue}</span>
              </button>
              );
            })}
          </div>
        </div>
      </div>

      {atQuality.length > 0 && (
        <div className="craft-modifier-list craft-matq-mods">
          {atQuality.map((m, i) => {
            const impact = getModifierImpact(m.property, m.value);
            const display = formatMaterialModifierDisplay(
              m.property,
              getBaseStatValue(recipe, m.property),
              m.value,
              m.modifierMode,
            );
            const totalRow = totalModifierByStat.get(getTotalModifierKey(m.property, m.modifierMode));
            const totalDisplay = totalRow
              ? formatMaterialModifierDisplay(
                  totalRow.property,
                  getBaseStatValue(recipe, totalRow.property),
                  totalRow.totalValue,
                  totalRow.modifierMode,
                )
              : display;
            const totalValue = totalDisplay.total ?? (
              totalRow ? formatContributionValue(totalRow.totalValue, totalRow.modifierMode) : undefined
            );
            const totalPercent = totalDisplay.total ? totalDisplay.totalPercent : undefined;
            const isModifierOnly = !display.base || !display.total;
            const rowKey = `${m.slot}||${m.property}`;
            const expanded = !isModifierOnly && (
              hasTouchedModifierRows
                ? expandedModifierRows.has(rowKey)
                : rowKey === defaultExpandedRowKey
            );
            return (
              <div
                key={i}
                className={`craft-modifier-row craft-matq-mod-chip${expanded ? " craft-matq-mod-chip--expanded" : ""}`}
              >
                <div className="craft-modifier-main">
                  <span className="craft-modifier-label craft-matq-mod-prop">
                    <MaterialStatIcon property={m.property} />
                    <span className="craft-matq-mod-name">{formatModifierStatName(m.property)}</span>
                  </span>

                  <span className="craft-matq-stat-part craft-stat-base">
                    <span className="craft-matq-stat-label">
                      <svg className="craft-col-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="12" height="4" rx="1.5" /><rect x="2" y="7" width="12" height="4" rx="1.5" opacity="0.55" /><rect x="2" y="12" width="12" height="2" rx="1" opacity="0.3" /></svg>
                      Base
                    </span>
                    <span className="craft-matq-stat-number">
                      {display.base ?? <span className="craft-matq-stat-empty">—</span>}
                      {display.base && display.basePercent && (
                        <span className="craft-matq-stat-percent craft-stat-base">({display.basePercent})</span>
                      )}
                    </span>
                  </span>

                  <span className="craft-matq-stat-part craft-stat-modifier">
                    <span className="craft-matq-stat-label">
                      <svg className="craft-col-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v12M2 8h12" strokeWidth="2.2" strokeLinecap="round" /></svg>
                      Modifier
                    </span>
                    <span className={`craft-matq-stat-number ${getImpactClass(impact)}`}>
                      {display.modifier}
                      {display.modifierPercent && (
                        <span className="craft-matq-stat-percent">({display.modifierPercent})</span>
                      )}
                    </span>
                  </span>

                  <span className="craft-matq-stat-part craft-stat-total">
                    <span className="craft-matq-stat-label">
                      <svg className="craft-col-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h10L7.5 8.5 13 13H3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      Total
                    </span>
                    <span className="craft-matq-stat-number craft-stat-total">
                      {totalValue ?? <span className="craft-matq-stat-empty">—</span>}
                      {totalPercent && (
                        <span className="craft-matq-stat-percent">({totalPercent})</span>
                      )}
                    </span>
                  </span>
                  {!isModifierOnly && (
                    <button
                      type="button"
                      className="craft-matq-row-toggle"
                      aria-label={`${expanded ? "Collapse" : "Expand"} ${formatModifierStatName(m.property)} modifier breakdown`}
                      aria-expanded={expanded}
                      onClick={() => toggleModifierRow(rowKey)}
                    >
                      <ChevronIcon expanded={expanded} />
                    </button>
                  )}
                </div>

         
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DetailMaterialQualityRow({
  recipe,
  mat,
  bandIndex,
  onBandChange,
  getBandsForMaterial,
}: {
  recipe: ComponentRecipe;
  mat: ComponentRecipe["materials"][number];
  bandIndex: number;
  onBandChange: (bandIndex: number) => void;
  getBandsForMaterial: (materialName: string) => QualityBand[];
}) {
  const {
    materialName,
    bands,
    safeBandIndex,
    quality,
    selectedQualityTierClass,
    atQuality,
    railMarkers,
    findNearestBandForMappedValue,
    bandOnePct,
    fillPct,
    minQuality,
    maxQuality,
  } = useMaterialQualityModel({
    mat,
    bandIndex,
    getBandsForMaterial,
  });
  const requiredAmount = Number.isFinite(mat.quantity) ? formatCompactNumber(mat.quantity) : null;

  if (bands.length === 0) {
    return (
      <div className="craft-detail-material-row craft-detail-material-row--unavailable">
        <div className="craft-detail-material-id">
          <span className="craft-detail-material-slot">{mat.slot}</span>
          <strong>{materialName}</strong>
        </div>
        <div className="craft-detail-material-required">{requiredAmount}</div>
        <div className="craft-detail-material-quality">Quality data unavailable</div>
      </div>
    );
  }

  return (
    <div className="craft-detail-material-row">
      <div className="craft-detail-material-id">
        <span className="craft-detail-material-slot">{mat.slot}</span>
        <strong>{materialName}</strong>
      </div>
      <div className="craft-detail-material-required">{requiredAmount}</div>
      <div className="craft-detail-material-quality">
        <span className={`craft-detail-band-pill ${selectedQualityTierClass}`}>
          {safeBandIndex + 1}
        </span>
        <span className="craft-detail-quality-value">{quality}</span>
      </div>
      <div className="craft-detail-material-slider">
        <input
          type="range"
          min={minQuality}
          max={maxQuality}
          step={1}
          value={quality}
          onChange={(e) => {
            const rawValue = Number(e.target.value);
            onBandChange(findNearestBandForMappedValue(rawValue));
          }}
          className="craft-quality-input craft-detail-quality-input"
          aria-label={`Quality band for ${materialName}`}
        />
        <div
          className={`craft-quality-rail craft-detail-quality-rail ${selectedQualityTierClass}`}
          style={
            {
              "--band-one-pct": `${bandOnePct}%`,
            } as React.CSSProperties
          }
        >
          <div
            className={`craft-quality-rail-fill craft-detail-quality-fill ${selectedQualityTierClass}`}
            style={
              {
                "--band-one-pct": `${bandOnePct}%`,
                "--fill-pct": `${fillPct}%`,
              } as React.CSSProperties
            }
          />
          {railMarkers.map((marker) => {
            const markerTierClass = rarityClassFromBandIndex(marker.index + 1);
            const markerState =
              marker.index < safeBandIndex
                ? " is-before-active"
                : marker.index === safeBandIndex
                  ? " is-active"
                  : "";

            return (
              <button
                type="button"
                key={`${marker.index}-${marker.mappedValue}`}
                className={`craft-quality-marker craft-detail-band-marker ${markerTierClass}${markerState}`}
                style={{ left: `${marker.left}%` }}
                data-edge={marker.edge}
                onClick={() => onBandChange(marker.index)}
                aria-label={`Use mapped quality ${marker.mappedValue}`}
              >
                <span className="craft-quality-marker-line craft-detail-band-dot" />
              </button>
            );
          })}
        </div>
      </div>
      <div className="craft-detail-material-effects">
        {atQuality.map((m, i) => {
          const impact = getModifierImpact(m.property, m.value);
          const display = formatMaterialModifierDisplay(
            m.property,
            getBaseStatValue(recipe, m.property),
            m.value,
            m.modifierMode,
          );

          return (
            <span key={`${m.slot}:${m.property}:${i}`} className="craft-detail-effect-chip">
              <span>{formatModifierStatName(m.property)}</span>
              <strong className={getImpactClass(impact)}>{display.modifier}</strong>
            </span>
          );
        })}
      </div>
    </div>
  );
}

interface TotalModifierRow {
  property: string;
  totalValue: number;
  modifierMode?: string;
  contributions: { materialName: string; value: number }[];
}

export type FinalProductQuality = {
  band: number;
  averageBand: number;
  rarity: string;
  source: "selectedMaterialBands";
};

function computeTotalModifiers(
  recipe: ComponentRecipe,
  getBandsForMaterial: (materialName: string) => QualityBand[],
  getBandIndex: (key: string) => number,
): TotalModifierRow[] {
  const map = new Map<string, TotalModifierRow>();

  for (const [inputIndex, mat] of recipe.materials.entries()) {
    const modifiers = mat.qualityModifiers ?? [];
    if (modifiers.length === 0) continue;

    const key = getMaterialQualityKey(recipe, mat, inputIndex);
    const quality = getMaterialEffectiveQuality(mat, getBandIndex(key), getBandsForMaterial);
    const atQuality = getModifiersAtQuality(modifiers, quality);

    for (const m of atQuality) {
      // Group by property + modifierMode so same stat from different slots combine
      const rowKey = getTotalModifierKey(m.property, m.modifierMode);
      const existing = map.get(rowKey);

      if (!existing) {
        map.set(rowKey, {
          property: m.property,
          totalValue: m.value,
          modifierMode: m.modifierMode,
          contributions: [{ materialName: getMaterialName(mat), value: m.value }],
        });
      } else {
        existing.totalValue += m.value;
        existing.contributions.push({ materialName: getMaterialName(mat), value: m.value });
      }
    }
  }

  return Array.from(map.values());
}

function deriveFinalProductQuality(
  recipe: ComponentRecipe,
  getBandIndex: (key: string) => number,
): FinalProductQuality {
  let bandTotal = 0;
  let materialCount = 0;

  for (const [inputIndex, mat] of recipe.materials.entries()) {
    const band = getBandIndex(getMaterialQualityKey(recipe, mat, inputIndex)) + 1;
    bandTotal += band;
    materialCount += 1;
  }

  const averageBand = materialCount > 0 ? bandTotal / materialCount : DEFAULT_BAND_INDEX + 1;
  const band = Math.max(1, Math.min(8, Math.round(averageBand)));

  return {
    band,
    averageBand,
    rarity: rarityFromBandIndex(band),
    source: "selectedMaterialBands",
  };
}

function buildSelectedQualitySnapshot(
  recipe: ComponentRecipe,
  materialQualities: Record<string, number>,
  getBandsForMaterial: (materialName: string) => QualityBand[],
): Record<string, { quality: number; bandNumber: number; bands: QualityBand[] }> {
  return Object.fromEntries(
    recipe.materials.map((mat, inputIndex) => {
      const key = getMaterialQualityKey(recipe, mat, inputIndex);
      const bandIndex = materialQualities[key] ?? DEFAULT_BAND_INDEX;
      const bands = getQualityBandsForMaterial(mat, getBandsForMaterial);
      return [key, {
        quality: getEffectiveQualityFromBands(bands, bandIndex),
        bandNumber: bandIndex + 1,
        bands,
      }];
    }),
  );
}

function formatContributionValue(value: number, modifierMode?: string): string {
  if (modifierMode === "integerAdditive") {
    const v = Math.round(value);
    return `${v >= 0 ? "+" : ""}${v}`;
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatIndexNumber(value: unknown, suffix = ""): string | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(number)) return null;
  return `${number.toLocaleString("en-US", { maximumFractionDigits: number >= 100 ? 0 : 2 })}${suffix}`;
}

function formatIndexToken(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatIndexDamageDrop(stats: Record<string, unknown>): string | null {
  const minDistance = formatIndexNumber(stats.damageDropMinDistance, "m");
  const perMeter = formatIndexNumber(stats.damageDropPerMeter, "/m");
  const minDamage = formatIndexNumber(stats.damageDropMinDamage);
  const parts = [
    minDistance ? `after ${minDistance}` : null,
    perMeter,
    minDamage ? `floor ${minDamage}` : null,
  ].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(" / ") : null;
}

function getIndexStatsObject(record: ComponentCardIndexRecord | undefined, key: string): Record<string, unknown> | null {
  const stats = record?.stats as unknown;
  if (!isRecord(stats)) return null;
  const value = stats[key];
  return isRecord(value) ? value : null;
}

function buildDetailStatRows(record: ComponentCardIndexRecord | undefined): ComponentCardMetric[] {
  if (!record) return [];

  if (record.type === "ammo") {
    const ammo = getIndexStatsObject(record, "fpsAmmo");
    if (!ammo) return [];
    const rows: ComponentCardMetric[] = [];
    const push = (label: string, value: string | null) => {
      if (value) rows.push({ label, value });
    };
    push("Ammo Class", formatIndexToken(ammo.ammoClass));
    push("Compatible Weapon Class", formatIndexToken(ammo.compatibleWeaponClass));
    push("Compatible Weapon Family", formatIndexToken(ammo.compatibleWeaponFamily));
    push("Magazine Capacity", formatIndexNumber(ammo.magazineCapacity, " Cap"));
    push("Alpha Damage", formatIndexNumber(ammo.alphaDamageTotal));
    const range = getRangeBoundary(ammo);
    push(range.label, range.value !== undefined ? formatIndexNumber(range.value, "m") : null);
    push("Projectile Speed", formatIndexNumber(ammo.projectileSpeed, " m/s"));
    push("Damage Drop", formatIndexDamageDrop(ammo));
    push("Penetration", formatIndexNumber(ammo.penetrationBaseDistance, "m"));
    return rows;
  }

  return buildComponentCardSchemaFromIndex(record).familyStats;
}

type DetailStatModifier = {
  value: string;
  impactClass: string;
};

type DetailStatRow = ComponentCardMetric & {
  modifier?: DetailStatModifier;
};

type ModifierStatBinding = {
  label: string;
  statKeys: string[];
};

const MODIFIER_STAT_BINDINGS: Record<string, ModifierStatBinding> = {
  GPP_Weapon_Damage: { label: "Alpha Damage", statKeys: ["alphaDamageTotal"] },
  GPP_Weapon_FireRate: { label: "Fire Rate", statKeys: ["fireRateRpm"] },
  GPP_Weapon_Spread: { label: "Spread", statKeys: ["adsSpread", "hipFireSpreadMin"] },
};

function normalizeDetailStatLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getModifierStatBinding(property: string): ModifierStatBinding {
  return MODIFIER_STAT_BINDINGS[property] ?? {
    label: formatModifierStatName(property),
    statKeys: [],
  };
}

function getIndexedModifierBaseValue(
  record: ComponentCardIndexRecord | undefined,
  property: string,
): number | undefined {
  const binding = getModifierStatBinding(property);
  if (binding.statKeys.length === 0) return undefined;

  const statGroups = [
    getIndexStatsObject(record, "fpsWeapon"),
    getIndexStatsObject(record, "fpsAmmo"),
    getIndexStatsObject(record, "shipWeapon"),
  ];

  for (const stats of statGroups) {
    if (!stats) continue;
    for (const key of binding.statKeys) {
      const value = readIndexNumber(stats, key);
      if (value !== undefined) return value;
    }
  }

  return undefined;
}

function buildDpsModifierDisplay(
  record: ComponentCardIndexRecord | undefined,
  totalModifiers: TotalModifierRow[],
): DetailStatModifier | undefined {
  const weapon =
    getIndexStatsObject(record, "fpsWeapon") ??
    getIndexStatsObject(record, "shipWeapon");
  if (!weapon) return undefined;

  const baseDps = readIndexNumber(weapon, "dps");
  if (baseDps === undefined || baseDps <= 0) return undefined;

  const baseDamage = readIndexNumber(weapon, "alphaDamageTotal");
  const baseFireRate = readIndexNumber(weapon, "fireRateRpm");
  let scale = 1;

  const damageModifier = getTotalModifierForProperty(totalModifiers, "GPP_Weapon_Damage");
  if (damageModifier && baseDamage !== undefined && baseDamage > 0) {
    const modifiedDamage = applyModifierToBase(
      baseDamage,
      damageModifier.totalValue,
      damageModifier.modifierMode,
    );
    scale *= modifiedDamage / baseDamage;
  }

  const fireRateModifier = getTotalModifierForProperty(totalModifiers, "GPP_Weapon_FireRate");
  if (fireRateModifier && baseFireRate !== undefined && baseFireRate > 0) {
    const modifiedFireRate = applyModifierToBase(
      baseFireRate,
      fireRateModifier.totalValue,
      fireRateModifier.modifierMode,
    );
    scale *= modifiedFireRate / baseFireRate;
  }

  if (scale === 1) return undefined;

  const delta = baseDps * scale - baseDps;
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.005) return undefined;

  return {
    value: formatCompactNumber(delta, { sign: true }),
    impactClass: getImpactClass(delta > 0 ? "good" : "bad"),
  };
}

function buildModifiedDetailStatRows(
  recipe: ComponentRecipe,
  record: ComponentCardIndexRecord | undefined,
  stats: ComponentCardMetric[],
  totalModifiers: TotalModifierRow[],
): DetailStatRow[] {
  const rows: DetailStatRow[] = stats.map((stat) => ({ ...stat }));
  const rowIndexByLabel = new Map(
    rows.map((row, index) => [normalizeDetailStatLabel(row.label), index]),
  );

  for (const modifier of totalModifiers) {
    const binding = getModifierStatBinding(modifier.property);
    const baseValue =
      getIndexedModifierBaseValue(record, modifier.property) ??
      getBaseStatValue(recipe, modifier.property);
    const display = formatMaterialModifierDisplay(
      modifier.property,
      baseValue,
      modifier.totalValue,
      modifier.modifierMode,
    );
    const impact = getModifierImpact(modifier.property, modifier.totalValue);
    const modifierDisplay: DetailStatModifier = {
      value: baseValue !== undefined ? display.modifier : display.modifierPercent ?? display.modifier,
      impactClass: getImpactClass(impact),
    };
    const existingIndex = rowIndexByLabel.get(normalizeDetailStatLabel(binding.label));

    if (existingIndex !== undefined && baseValue !== undefined) {
      rows[existingIndex] = {
        ...rows[existingIndex],
        modifier: modifierDisplay,
      };
      continue;
    }

    const value = baseValue !== undefined
      ? display.base ?? rows[existingIndex ?? -1]?.value ?? ""
      : display.modifierPercent ?? display.modifier;

    if (!value) continue;

    const nextRow: DetailStatRow = {
      label: binding.label,
      value,
      modifier: baseValue !== undefined ? modifierDisplay : undefined,
    };

    rows.push(nextRow);
    rowIndexByLabel.set(normalizeDetailStatLabel(nextRow.label), rows.length - 1);
  }

  const dpsIndex = rowIndexByLabel.get(normalizeDetailStatLabel("DPS"));
  const dpsModifier = dpsIndex !== undefined ? buildDpsModifierDisplay(record, totalModifiers) : undefined;
  if (dpsIndex !== undefined && dpsModifier) {
    rows[dpsIndex] = {
      ...rows[dpsIndex],
      modifier: dpsModifier,
    };
  }

  return rows;
}

type DetailGraphPoint = {
  x: number;
  base: number;
  modified?: number;
};

type DetailGraphMarker = {
  label: string;
  x: number;
};

type DetailGraphTick = {
  label: string;
  position: number;
};

type DetailGraphData = {
  title: string;
  subtitle: string;
  points: DetailGraphPoint[];
  markers: DetailGraphMarker[];
  xTicks: DetailGraphTick[];
  yTicks: DetailGraphTick[];
  range: number;
  minValue: number;
  maxValue: number;
  metrics: ComponentCardMetric[];
  bars: ComponentCardMetric[];
  hasModifiedCurve: boolean;
};

type P6LRReference = {
  record?: ComponentCardIndexRecord;
  totalModifiers: TotalModifierRow[];
};

function readIndexNumber(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key];
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : undefined;
}

function getRangeBoundary(stats: Record<string, unknown>): { value: number | undefined; label: string } {
  const hardRange = readIndexNumber(stats, "hardRange");
  if (hardRange !== undefined) return { value: hardRange, label: "Hard Range" };

  const projectileLifetimeTravel =
    readIndexNumber(stats, "projectileLifetimeTravel") ??
    readIndexNumber(stats, "calculatedRange");
  return { value: projectileLifetimeTravel, label: "Projectile Travel" };
}

function getTotalModifierForProperty(
  totalModifiers: TotalModifierRow[],
  property: string,
): TotalModifierRow | undefined {
  return totalModifiers.find((row) => row.property === property);
}

function getAmmoPerformanceStats(componentCardRecord: ComponentCardIndexRecord | undefined): Record<string, unknown> | null {
  return (
    getIndexStatsObject(componentCardRecord, "fpsAmmo") ??
    getIndexStatsObject(componentCardRecord, "fpsWeapon") ??
    null
  );
}

function findP6LRWeaponRecord(componentCards: ComponentCardIndexRecord[]): ComponentCardIndexRecord | undefined {
  return (
    componentCards.find((record) => record.type === "weapons" && /P6-LR\s+"Blacklist"/i.test(record.name)) ??
    componentCards.find((record) => record.type === "weapons" && /^P6-LR\b/i.test(record.name)) ??
    componentCards.find((record) => record.type === "weapons" && /P6-LR/i.test(record.name))
  );
}

function findP6LRRecipe(recipes: ComponentRecipe[]): ComponentRecipe | undefined {
  const isP6LRWeapon = (recipe: ComponentRecipe) =>
    recipe.item_kind === "fps" &&
    recipe.component_type === "weapons" &&
    /P6-LR/i.test(getRecipeDisplayName(recipe));

  return (
    recipes.find((recipe) => isP6LRWeapon(recipe) && /P6-LR\s+"Blacklist"/i.test(getRecipeDisplayName(recipe))) ??
    recipes.find((recipe) => isP6LRWeapon(recipe) && /^P6-LR\b/i.test(getRecipeDisplayName(recipe))) ??
    recipes.find(isP6LRWeapon)
  );
}

function getArmorResistanceForDamageType(armor: Record<string, unknown>, damageType: string | undefined): number | undefined {
  const normalized = String(damageType ?? "physical").toLowerCase();
  const resistanceKey =
    normalized === "energy" ? "energyResistance" :
    normalized === "distortion" ? "distortionResistance" :
    normalized === "thermal" ? "thermalResistance" :
    normalized === "biochemical" ? "biochemicalResistance" :
    normalized === "stun" ? "stunResistance" :
    "physicalResistance";

  return readIndexNumber(armor, resistanceKey) ?? readIndexNumber(armor, "physicalResistance");
}

function buildArmorDamageTakenGraph(
  componentCardRecord: ComponentCardIndexRecord | undefined,
  p6lrReference: P6LRReference | undefined,
): DetailGraphData | null {
  if (componentCardRecord?.type !== "armor") return null;

  const armor = getIndexStatsObject(componentCardRecord, "fpsArmor");
  const p6Stats = getAmmoPerformanceStats(p6lrReference?.record);
  if (!armor || !p6Stats) return null;

  const alphaDamage = readIndexNumber(p6Stats, "alphaDamageTotal");
  const rangeBoundary = getRangeBoundary(p6Stats);
  const range = rangeBoundary.value;
  if (!alphaDamage || !range || alphaDamage <= 0 || range <= 0) return null;

  const resistance = getArmorResistanceForDamageType(
    armor,
    typeof p6Stats.damageType === "string" ? p6Stats.damageType : undefined,
  );
  if (resistance === undefined || resistance < 0) return null;

  const dropStart = readIndexNumber(p6Stats, "damageDropMinDistance") ?? 0;
  const dropPerMeter = readIndexNumber(p6Stats, "damageDropPerMeter") ?? 0;
  const floorDamage = readIndexNumber(p6Stats, "damageDropMinDamage") ?? 0;
  const damageModifier = getTotalModifierForProperty(p6lrReference?.totalModifiers ?? [], "GPP_Weapon_Damage");
  const maxQualityAlpha =
    damageModifier
      ? applyModifierToBase(alphaDamage, damageModifier.totalValue, damageModifier.modifierMode)
      : alphaDamage;
  const damageScale = maxQualityAlpha / alphaDamage;
  const sampleDistances = [0, range * 0.25, range * 0.5, range * 0.75, range];
  const p6DamageAt = (distance: number) => {
    if (dropPerMeter <= 0 || distance <= dropStart) return alphaDamage;
    const dropped = alphaDamage - (distance - dropStart) * dropPerMeter;
    return Math.max(floorDamage, dropped);
  };
  const points = sampleDistances.map((distance) => ({
    x: distance,
    base: p6DamageAt(distance) * damageScale * resistance,
  }));
  const values = points.map((point) => point.base);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = Math.max(1, maxValue - minValue);
  const yTicks: DetailGraphTick[] = [maxValue, minValue + valueRange / 2, minValue].map((value) => ({
    label: formatCompactNumber(value),
    position: 88 - ((value - minValue) / valueRange) * 76,
  }));
  const p6Label = p6lrReference?.record?.name?.replace(/\s+Sniper Rifle$/i, "") ?? "P6-LR";
  const metrics: ComponentCardMetric[] = [
    { label: "P6-LR Alpha", value: formatCompactNumber(maxQualityAlpha) },
    { label: "Damage Taken", value: formatCompactNumber(maxQualityAlpha * resistance) },
  ];

  if (dropPerMeter > 0) {
    metrics.push({ label: "Falloff Start", value: `${formatCompactNumber(dropStart)}m` });
    metrics.push({ label: "Minimum Taken", value: formatCompactNumber(floorDamage * damageScale * resistance) });
  }

  const markers: DetailGraphMarker[] = [
    { label: "P6-LR Falloff", x: dropStart },
  ].filter((marker) => marker.x > 0 && marker.x < range);
  const xTicks: DetailGraphTick[] = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    label: `${formatCompactNumber(range * ratio)}m`,
    position: ratio * 100,
  }));

  return {
    title: "Armor Damage Taken",
    subtitle: `${p6Label} at max quality through ${formatCompactNumber(resistance * 100)}% ${String(p6Stats.damageType ?? "physical")} taken`,
    points,
    markers,
    xTicks,
    yTicks,
    range,
    minValue,
    maxValue,
    metrics,
    bars: [
      { label: "Resistance Multiplier", value: formatCompactNumber(resistance) },
      { label: rangeBoundary.label, value: `${formatCompactNumber(range)}m` },
    ],
    hasModifiedCurve: false,
  };
}

function buildAmmoPerformanceGraph(
  componentCardRecord: ComponentCardIndexRecord | undefined,
  totalModifiers: TotalModifierRow[],
): DetailGraphData | null {
  const ammo = getAmmoPerformanceStats(componentCardRecord);
  if (!ammo) return null;

  const alphaDamage = readIndexNumber(ammo, "alphaDamageTotal");
  const rangeBoundary = getRangeBoundary(ammo);
  const range = rangeBoundary.value;
  if (!alphaDamage || !range || alphaDamage <= 0 || range <= 0) return null;

  const dropStart = readIndexNumber(ammo, "damageDropMinDistance") ?? 0;
  const dropPerMeter = readIndexNumber(ammo, "damageDropPerMeter") ?? 0;
  const floorDamage = readIndexNumber(ammo, "damageDropMinDamage") ?? 0;
  const damageModifier = getTotalModifierForProperty(totalModifiers, "GPP_Weapon_Damage");
  const modifiedAlpha =
    damageModifier
      ? applyModifierToBase(alphaDamage, damageModifier.totalValue, damageModifier.modifierMode)
      : undefined;
  const damageScale = modifiedAlpha !== undefined ? modifiedAlpha / alphaDamage : 1;
  const sampleDistances = [0, range * 0.25, range * 0.5, range * 0.75, range];
  const damageAt = (distance: number) => {
    if (dropPerMeter <= 0 || distance <= dropStart) return alphaDamage;
    const dropped = alphaDamage - (distance - dropStart) * dropPerMeter;
    return Math.max(floorDamage, dropped);
  };
  const points = sampleDistances.map((distance) => {
    const base = damageAt(distance);
    return {
      x: distance,
      base,
      modified: modifiedAlpha !== undefined ? base * damageScale : undefined,
    };
  });
  const graphValues = points.flatMap((point) =>
    point.modified !== undefined ? [point.base, point.modified] : [point.base],
  );
  const minValue = Math.min(...graphValues);
  const maxValue = Math.max(alphaDamage, modifiedAlpha ?? alphaDamage, ...graphValues);
  const metrics: ComponentCardMetric[] = [
    { label: "Alpha", value: formatCompactNumber(alphaDamage) },
    { label: rangeBoundary.label, value: `${formatCompactNumber(range)}m` },
  ];

  if (dropPerMeter > 0) {
    metrics.push({ label: "Damage Loss", value: `${formatCompactNumber(dropPerMeter)}/m` });
    metrics.push({ label: "Falloff Start", value: `${formatCompactNumber(dropStart)}m` });
    if (modifiedAlpha === undefined) {
      metrics.push({ label: "Minimum Damage", value: formatCompactNumber(floorDamage) });
    }
  }

  if (modifiedAlpha !== undefined) {
    metrics.push({ label: "Crafted", value: formatCompactNumber(floorDamage * damageScale) });
  }

  const projectileSpeed = readIndexNumber(ammo, "projectileSpeed");
  const projectileLifetime = readIndexNumber(ammo, "projectileLifetime");
  const impulseStart = readIndexNumber(ammo, "bulletImpulseFalloffMinDistance");
  const impulseDrop = readIndexNumber(ammo, "bulletImpulseDropFalloff");
  const impulseMax = readIndexNumber(ammo, "bulletImpulseMaxFalloff");
  const penetrationDistance = readIndexNumber(ammo, "penetrationBaseDistance");
  const penetrationNearRadius = readIndexNumber(ammo, "penetrationNearRadius");
  const penetrationFarRadius = readIndexNumber(ammo, "penetrationFarRadius");
  const bars: ComponentCardMetric[] = [];

  if (projectileSpeed !== undefined) {
    bars.push({ label: "Projectile Speed", value: `${formatCompactNumber(projectileSpeed)} m/s` });
  }
  if (projectileLifetime !== undefined) {
    bars.push({ label: "Travel Time", value: `${formatCompactNumber(projectileLifetime)}s` });
  }
  if (impulseStart !== undefined) {
    bars.push({ label: "Impact Falloff Starts", value: `${formatCompactNumber(impulseStart)}m` });
  }
  if (impulseDrop !== undefined) {
    bars.push({ label: "Impact Force Loss", value: formatCompactNumber(impulseDrop) });
  }
  if (impulseMax !== undefined) {
    bars.push({ label: "Max Impact Loss", value: formatCompactNumber(impulseMax) });
  }
  if (penetrationDistance !== undefined) {
    bars.push({ label: "Penetration Reach", value: `${formatCompactNumber(penetrationDistance)}m` });
  }
  if (penetrationNearRadius !== undefined) {
    bars.push({ label: "Close Radius", value: `${formatCompactNumber(penetrationNearRadius)}m` });
  }
  if (penetrationFarRadius !== undefined) {
    bars.push({ label: "Far Radius", value: `${formatCompactNumber(penetrationFarRadius)}m` });
  }
  const markers: DetailGraphMarker[] = [
    { label: "Damage Falloff", x: dropStart },
    impulseStart !== undefined ? { label: "Impact Falloff", x: impulseStart } : null,
    penetrationDistance !== undefined ? { label: "Penetration Limit", x: penetrationDistance } : null,
  ].filter((marker): marker is DetailGraphMarker => marker !== null && marker.x > 0 && marker.x < range);
  const xTicks: DetailGraphTick[] = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    label: `${formatCompactNumber(range * ratio)}m`,
    position: ratio * 100,
  }));
  const valueRange = Math.max(1, maxValue - minValue);
  const yTicks: DetailGraphTick[] = [maxValue, minValue + valueRange / 2, minValue].map((value) => ({
    label: formatCompactNumber(value),
    position: 88 - ((value - minValue) / valueRange) * 76,
  }));

  return {
    title: "Ammo Performance",
    subtitle: modifiedAlpha !== undefined ? "Damage falloff with selected materials" : "Damage falloff, travel, impulse, penetration",
    points,
    markers,
    xTicks,
    yTicks,
    range,
    minValue,
    maxValue,
    metrics,
    bars,
    hasModifiedCurve: modifiedAlpha !== undefined,
  };
}

function buildSvgPolyline(
  points: DetailGraphPoint[],
  key: "base" | "modified",
  range: number,
  minValue: number,
  maxValue: number,
): string {
  const valueRange = Math.max(1, maxValue - minValue);
  return points
    .map((point) => {
      const value = key === "base" ? point.base : point.modified;
      if (value === undefined) return null;
      const x = range > 0 ? (point.x / range) * 100 : 0;
      const y = 88 - ((value - minValue) / valueRange) * 76;
      return `${Math.max(0, Math.min(100, x)).toFixed(2)},${Math.max(0, Math.min(100, y)).toFixed(2)}`;
    })
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function DetailGraphPanel({ data }: { data: DetailGraphData }) {
  const baseLine = buildSvgPolyline(data.points, "base", data.range, data.minValue, data.maxValue);
  const modifiedLine = data.hasModifiedCurve
    ? buildSvgPolyline(data.points, "modified", data.range, data.minValue, data.maxValue)
    : "";

  return (
    <div className="craft-summary-section craft-detail-secondary-panel craft-detail-graph-panel">
      <div className="craft-detail-graph-head">
        <div>
          <div className="craft-summary-section-label">{data.title}</div>
          <span>{data.subtitle}</span>
        </div>
      </div>
      <div className="craft-detail-graph-plot" aria-hidden="true">
        <div className="craft-detail-graph-legend">
          <span className="craft-detail-graph-legend-base">Base</span>
          {data.hasModifiedCurve && (
            <>
              <span aria-hidden="true">|</span>
              <span className="craft-detail-graph-legend-crafted">Crafted</span>
            </>
          )}
        </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
          <path className="craft-detail-graph-grid" d="M0 25H100M0 50H100M0 75H100M25 0V100M50 0V100M75 0V100" />
          {data.xTicks.map((tick) => (
            <line
              key={`x:${tick.label}`}
              className="craft-detail-graph-notch"
              x1={tick.position}
              y1="92"
              x2={tick.position}
              y2="100"
            />
          ))}
          {data.yTicks.map((tick) => (
            <line
              key={`y:${tick.label}`}
              className="craft-detail-graph-notch"
              x1="0"
              y1={tick.position}
              x2="4"
              y2={tick.position}
            />
          ))}
          {data.markers.map((marker) => {
            const x = data.range > 0 ? Math.max(0, Math.min(100, (marker.x / data.range) * 100)) : 0;
            return (
              <g key={`${marker.label}:${marker.x}`} className="craft-detail-graph-marker">
                <line x1={x} y1="0" x2={x} y2="100" />
              </g>
            );
          })}
          <polyline className="craft-detail-graph-line craft-detail-graph-line--base" points={baseLine} />
          {modifiedLine && (
            <polyline className="craft-detail-graph-line craft-detail-graph-line--modified" points={modifiedLine} />
          )}
        </svg>
        <div className="craft-detail-graph-x-axis">
          {data.xTicks.map((tick) => (
            <span key={tick.label} style={{ left: `${tick.position}%` }}>
              {tick.label}
            </span>
          ))}
        </div>
        <div className="craft-detail-graph-y-axis">
          {data.yTicks.map((tick) => (
            <span key={tick.label} style={{ top: `${tick.position}%` }}>
              {tick.label}
            </span>
          ))}
        </div>
      </div>
      <div className="craft-detail-graph-metrics">
        {data.metrics.map((metric) => (
          <span key={`${metric.label}:${metric.value}`}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </span>
        ))}
      </div>
      {data.bars.length > 0 && (
        <div className="craft-detail-graph-readouts">
          {data.bars.map((metric) => (
            <span key={`${metric.label}:${metric.value}`}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemSummaryPanel({
  recipe,
  displayName,
  finalProductQuality,
  componentCardRecord,
  totalModifiers,
  p6lrReference,
}: {
  recipe: ComponentRecipe;
  displayName: string;
  finalProductQuality: FinalProductQuality;
  componentCardRecord?: ComponentCardIndexRecord;
  totalModifiers: TotalModifierRow[];
  p6lrReference?: P6LRReference;
}) {
  const schema = componentCardRecord
    ? buildComponentCardSchemaFromIndex(componentCardRecord)
    : buildComponentCardSchema(recipe);
  const typeBadges = getTypeBadges(recipe);
  const identityRows: ComponentCardMetric[] = componentCardRecord
    ? [
        { label: "Type", value: componentCardRecord.typeLabel },
        { label: "Category", value: componentCardRecord.category },
        { label: "Family", value: componentCardRecord.family ?? "" },
        { label: "Variant", value: componentCardRecord.variantName ?? "" },
        { label: "Craft Time", value: formatCraftTime(componentCardRecord.craftTimeSeconds) },
      ].filter((row) => Boolean(row.value))
    : [];
  const meta = [
    componentCardRecord?.kind === "fps" ? "FPS" : schema.kindLabel,
    componentCardRecord?.typeLabel ?? schema.typeLabel,
    componentCardRecord?.family,
    componentCardRecord?.variantName,
  ].filter((value): value is string => Boolean(value));
  const stats = buildDetailStatRows(componentCardRecord);
  const modifiedStats = buildModifiedDetailStatRows(recipe, componentCardRecord, stats, totalModifiers);
  const secondaryStats = componentCardRecord
    ? buildComponentCardSchemaFromIndex(componentCardRecord).genericStats
    : [];
  const graphData =
    buildAmmoPerformanceGraph(componentCardRecord, totalModifiers) ??
    buildArmorDamageTakenGraph(componentCardRecord, p6lrReference);
  const componentRarityClass = rarityClassFromBandIndex(finalProductQuality.band);

  return (
    <section className="craft-detail-cockpit" aria-label="Selected item summary">
      <div className="craft-summary-panel craft-detail-cockpit-panel">
        <div className="craft-detail-cockpit-grid">
          <div className="craft-detail-visual-panel">
            <span className="craft-detail-visual-kind">{componentCardRecord?.typeLabel ?? schema.typeLabel}</span>
            <strong>{displayName}</strong>
            <span className={`craft-detail-band-pill ${componentRarityClass}`}>
              {formatCompactNumber(finalProductQuality.averageBand)}
            </span>
          </div>

          <div className="craft-detail-identity-panel">
            <div className="craft-summary-section-label">Item Overview</div>
            {componentCardRecord?.description ? (
              <p className="craft-item-description">
                {trimItemDescription(componentCardRecord.description)}
              </p>
            ) : (
              <div className="craft-summary-chips">
                {typeBadges.map((badge) => (
                  <span
                    key={badge}
                    className={`craft-badge craft-badge--type-chip${badge === "FPS" ? " craft-badge--fps" : ""}`}
                  >
                    {badge}
                  </span>
                ))}
                {meta.map((value) => (
                  <span key={value} className="craft-badge craft-badge--neutral">
                    {value}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {modifiedStats.length > 0 && (
          <div className="craft-summary-section craft-detail-stat-panel">
            <div className="craft-summary-section-label">{componentCardRecord?.typeLabel ?? schema.typeLabel} Stats</div>
            <div className="craft-detail-stat-list">
              {modifiedStats.map((stat) => (
                <span key={`${stat.label}:${stat.value}`} className="craft-detail-stat-row">
                  <span>{stat.label}</span>
                  <strong>
                    <span className="craft-detail-stat-value">{stat.value}</span>
                    {stat.modifier && (
                      <span className={`craft-detail-stat-modifier ${stat.modifier.impactClass}`}>
                        ({stat.modifier.value})
                      </span>
                    )}
                  </strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {graphData ? (
          <DetailGraphPanel data={graphData} />
        ) : (identityRows.length > 0 || secondaryStats.length > 0) && (
        <div className="craft-summary-section craft-detail-secondary-panel">
          <div className="craft-summary-section-label">Details</div>
          <div className="craft-detail-meta-list craft-detail-meta-list--dense">
            {[...identityRows, ...secondaryStats].map((stat) => (
              <span key={`${stat.label}:${stat.value}`}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </span>
            ))}
          </div>
        </div>
        )}
      </div>
    </section>
  );
}

function MissionSourcePanel({
  recipe,
  rewardPools,
  isMissionBookmarked,
  onToggleMissionBookmark,
}: {
  recipe: ComponentRecipe;
  rewardPools: RecipeRewardPoolSummary[];
  isMissionBookmarked: (missionId: string) => boolean;
  onToggleMissionBookmark: (missionId: string) => void;
}) {
  const missionEntries = useMissionRewardEntries(recipe, rewardPools);
  const hasSourceValue = (value: unknown) => Boolean(value) && !/^unknown|n\/a$/i.test(String(value));
  const blueprintRows: ComponentCardMetric[] = [
    { label: "Blueprint ID", value: recipe.blueprint_id },
    { label: "Entity ID", value: recipe.output_entityClass },
    { label: "Item Type", value: recipe.wiki_type ?? recipe.component_type },
    { label: "Size", value: formatSize(recipe.size) ?? "" },
    { label: "Grade", value: recipe.grade ?? "" },
  ].filter((row) => hasSourceValue(row.value));
  const sourceRows: ComponentCardMetric[] = [
    { label: "Source Path", value: recipe.source_file ?? "" },
    { label: "Name Source", value: recipe.name_source ?? "" },
    { label: "Raw Name", value: recipe.raw_name ?? "" },
  ].filter((row) => hasSourceValue(row.value));
  const hasAdvancedSourceData = blueprintRows.length > 0 || sourceRows.length > 0;

  return (
    <div className="craft-detail-lower-grid">
      <section className="craft-summary-panel craft-detail-lower-panel">
        <div className="craft-summary-section craft-summary-mission-section">
          <div className="craft-summary-section-label">Blueprint Sources</div>
          {missionEntries.length === 0 ? (
            <div className="craft-summary-empty craft-summary-empty--compact">
              No mission data for this blueprint
            </div>
          ) : (
            <div className="craft-mission-source-list">
              {missionEntries.map((entry) => {
                const bookmarked = isMissionBookmarked(entry.id);
                const chance = formatMissionChance(entry.chance);

                return (
                  <div key={entry.id} className={`craft-mission-source craft-mission-source--${entry.source}${entry.isDisabled ? " is-disabled" : ""}`}>
                    <button
                      type="button"
                      className={`craft-mission-bookmark-btn${bookmarked ? " is-active" : ""}`}
                      aria-pressed={bookmarked}
                      aria-label={bookmarked ? `Remove ${entry.title} mission save` : `Save ${entry.title} mission`}
                      onClick={() => onToggleMissionBookmark(entry.id)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="14"
                        height="14"
                        fill={bookmarked ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
                      </svg>
                    </button>
                    <div className="craft-mission-source-copy">
                      <div className="craft-mission-source-name">
                        {entry.isDisabled && <span className="craft-disabled-badge">[DISABLED]</span>}
                        <span>{entry.title}</span>
                      </div>
                      <div className="craft-mission-source-meta">
                        {[entry.factionName, entry.poolName ?? entry.subtitle, chance ? `${chance} chance` : null]
                          .filter(Boolean)
                          .join(" / ")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
      {hasAdvancedSourceData && (
        <details className="craft-detail-source-advanced">
          <summary>Advanced Source Data</summary>
          <div className="craft-detail-source-advanced-body">
            {blueprintRows.length > 0 && (
              <div className="craft-summary-section">
                <div className="craft-summary-section-label">Blueprint Details</div>
                <div className="craft-detail-meta-list craft-detail-meta-list--dense">
                  {blueprintRows.map((row) => (
                    <span key={`${row.label}:${row.value}`}>
                      <span>{row.label}</span>
                      <strong className="component-result-card__id">{row.value}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {sourceRows.length > 0 && (
              <div className="craft-summary-section">
                <div className="craft-summary-section-label">Additional / Source Metadata</div>
                <div className="craft-detail-meta-list craft-detail-meta-list--dense">
                  {sourceRows.map((row) => (
                    <span key={`${row.label}:${row.value}`}>
                      <span>{row.label}</span>
                      <strong className="component-result-card__id">{row.value}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function CraftingOverviewPanel({
  recipe,
  finalProductQuality,
}: {
  recipe: ComponentRecipe;
  finalProductQuality: FinalProductQuality;
}) {
  const componentRarityClass = rarityClassFromBandIndex(finalProductQuality.band);
  const displayFinalProductQuality =
    finalProductQuality.averageBand ?? finalProductQuality.band;

  return (
    <div className="craft-detail-overview-strip">
      {formatCraftTime(recipe.craft_time_seconds) && (
        <span>
          <span>Craft Time</span>
          <strong>{formatCraftTime(recipe.craft_time_seconds)}</strong>
        </span>
      )}
      <span>
        <span>Resulting Quality</span>
        <strong className={`craft-detail-band-pill ${componentRarityClass}`}>
          {formatCompactNumber(displayFinalProductQuality)}
        </strong>
      </span>
      <span>
        <span>Materials</span>
        <strong>{recipe.materials.length} required</strong>
      </span>
    </div>
  );
}

function MaterialRequirementsTable({ children }: { children: ReactNode }) {
  return (
    <div className="craft-detail-material-table">
      <div className="craft-detail-material-table-head" aria-hidden="true">
        <span>Material</span>
        <span>Required</span>
        <span>Quality</span>
        <span>Input</span>
        <span>Effect</span>
      </div>
      <div className="craft-detail-material-table-body">
        {children}
      </div>
    </div>
  );
}

function EstimatedEffectsPanel({
  recipe,
  totalModifiers,
  overallModifiers,
  overallQualitySource,
  finalProductQuality,
}: {
  recipe: ComponentRecipe;
  totalModifiers: TotalModifierRow[];
  overallModifiers: NonNullable<ComponentRecipe["overallQualityModifiers"]>;
  overallQualitySource: number | undefined;
  finalProductQuality: FinalProductQuality;
}) {
  const hasMaterialModifiers = totalModifiers.length > 0;
  const hasOverallModifiers = overallModifiers.length > 0;
  const componentRarityClass = rarityClassFromBandIndex(finalProductQuality.band);
  if (!hasMaterialModifiers && !hasOverallModifiers) return null;

  return (
    <section className="craft-detail-effects-panel">
      <div className="craft-summary-section-label">Estimated Effects</div>
      {hasMaterialModifiers && (
        <div className="craft-detail-effects-list">
          {totalModifiers.map((row) => {
            const baseValue = getBaseStatValue(recipe, row.property);
            const display = formatMaterialModifierDisplay(
              row.property,
              baseValue,
              row.totalValue,
              row.modifierMode,
            );
            const impactClass = getImpactClass(getModifierImpact(row.property, row.totalValue));

            return (
              <div key={getTotalModifierKey(row.property, row.modifierMode)} className="craft-detail-effect-row">
                <span className="craft-detail-effect-stat">{formatProperty(row.property)}</span>
                <strong className={impactClass}>{display.total ?? formatContributionValue(row.totalValue, row.modifierMode)}</strong>
                <span className={`craft-detail-effect-delta ${impactClass}`}>{display.modifier}</span>
                {row.contributions.length > 0 && (
                  <span className="craft-detail-effect-sources">
                    {row.contributions.map((c) => `${c.materialName} ${formatContributionValue(c.value, row.modifierMode)}`).join(" / ")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {hasOverallModifiers && (
        <div className="craft-summary-overall-mods">
          <OverallModifierGroup
            recipe={recipe}
            modifiers={overallModifiers}
            quality={overallQualitySource}
            rarityClass={componentRarityClass}
          />
        </div>
      )}
    </section>
  );
}

function RightCraftingPanel({
  recipe,
  totalModifiers,
  overallModifiers,
  overallQualitySource,
  finalProductQuality,
  children,
}: {
  recipe: ComponentRecipe;
  totalModifiers: TotalModifierRow[];
  overallModifiers: NonNullable<ComponentRecipe["overallQualityModifiers"]>;
  overallQualitySource: number | undefined;
  finalProductQuality: FinalProductQuality;
  children: ReactNode;
}) {
  return (
    <section className="craft-detail-right-panel" aria-label="Crafting and materials">
      <div className="craft-detail-panel-head">
        <div>
          <div className="craft-summary-section-label">Crafting Overview</div>
        </div>
      </div>
      <CraftingOverviewPanel recipe={recipe} finalProductQuality={finalProductQuality} />
      <section className="craft-detail-material-section">
        <div className="craft-summary-section-label">Material Requirements</div>
        <MaterialRequirementsTable>{children}</MaterialRequirementsTable>
      </section>
      <EstimatedEffectsPanel
        recipe={recipe}
        totalModifiers={totalModifiers}
        overallModifiers={overallModifiers}
        overallQualitySource={overallQualitySource}
        finalProductQuality={finalProductQuality}
      />
    </section>
  );
}

function RecipeDrawer({
  recipe,
  groupRecipes = [recipe],
  allRecipes = groupRecipes,
  baseDisplayName,
  initialRecipeId,
  componentCards = [],
  onAddToQueue,
  isRecipeQueued,
  isRecipeBookmarked,
  onToggleBookmark,
  isMissionBookmarked,
  onToggleMissionBookmark,
}: {
  recipe: ComponentRecipe;
  groupRecipes?: ComponentRecipe[];
  allRecipes?: ComponentRecipe[];
  baseDisplayName: string;
  initialRecipeId?: string;
  componentCards?: ComponentCardIndexRecord[];
  onAddToQueue: (
    r: ComponentRecipe,
    selectedQualities: Record<string, { quality: number; bandNumber: number; bands: QualityBand[] }>,
    finalProductQuality: FinalProductQuality,
  ) => void;
  isRecipeQueued: (recipe: ComponentRecipe) => boolean;
  isRecipeBookmarked: (recipe: ComponentRecipe) => boolean;
  onToggleBookmark: (recipe: ComponentRecipe) => void;
  isMissionBookmarked: (missionId: string) => boolean;
  onToggleMissionBookmark: (missionId: string) => void;
}) {
  const {
    loading: quantizationLoading,
    getBandsForMaterial,
  } = useQualityQuantization();
  const location = useLocation();
  const backTo = `/industry/crafting${location.search}`;
  const { slots, setSlot } = useCompareStore();

  const initialSelectedRecipeId = groupRecipes.some((item) => item.blueprint_id === initialRecipeId)
    ? initialRecipeId
    : recipe.blueprint_id;
  const [selectedRecipeId, setSelectedRecipeId] = useState(initialSelectedRecipeId);
  const selectedRecipe = groupRecipes.find((item) => item.blueprint_id === selectedRecipeId) ?? recipe;

  useEffect(() => {
    setSelectedRecipeId(initialSelectedRecipeId);
  }, [initialSelectedRecipeId]);

  const [materialQualities, setMaterialQualities] = useState<
    Record<string, number>
  >(() =>
    Object.fromEntries(
      recipe.materials.map((mat, inputIndex) => [
        getMaterialQualityKey(recipe, mat, inputIndex),
        DEFAULT_BAND_INDEX,
      ]),
    ),
  );

  useEffect(() => {
    setMaterialQualities(
      Object.fromEntries(
        selectedRecipe.materials.map((mat, inputIndex) => [
          getMaterialQualityKey(selectedRecipe, mat, inputIndex),
          DEFAULT_BAND_INDEX,
        ]),
      ),
    );
  }, [selectedRecipe]);

  function getBandIndex(key: string): number {
    return materialQualities[key] ?? DEFAULT_BAND_INDEX;
  }

  const overallModifiers = selectedRecipe.overallQualityModifiers ?? [];
  const finalProductQuality = deriveFinalProductQuality(selectedRecipe, getBandIndex);
  const overallQualitySource = getEffectiveQualityFromBands(FALLBACK_QUALITY_BANDS, finalProductQuality.band - 1);

  const rewardPools = (selectedRecipe.rewardPools ?? [])
    .filter(isRecord)
    .map((pool) => ({
      poolName: asNonEmptyString(pool.poolName),
      poolGuid: asNonEmptyString(pool.poolGuid),
      sourceFolder: asNonEmptyString(pool.sourceFolder),
      displayName: asNonEmptyString(pool.displayName) ?? "",
      weight: asFiniteNumber(pool.weight),
    }))
    .filter((pool) => pool.displayName.trim().length > 0 && !/^unknown|n\/a$/i.test(pool.displayName.trim()));

  const displayName = getRecipeDisplayName(selectedRecipe);
  const selectedComponentCard = componentCards.find((record) => record.id === selectedRecipe.blueprint_id);

  const totalModifiers = useMemo(
    () => computeTotalModifiers(selectedRecipe, getBandsForMaterial, getBandIndex),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedRecipe, getBandsForMaterial, materialQualities],
  );
  const p6lrReference = useMemo<P6LRReference | undefined>(() => {
    const p6lrRecord = findP6LRWeaponRecord(componentCards);
    if (!p6lrRecord) return undefined;

    const p6lrRecipe = findP6LRRecipe(allRecipes);
    if (!p6lrRecipe) return { record: p6lrRecord, totalModifiers: [] };

    const maxBandByKey = new Map(
      p6lrRecipe.materials.map((mat, inputIndex) => {
        const key = getMaterialQualityKey(p6lrRecipe, mat, inputIndex);
        const maxBandIndex = Math.max(0, getQualityBandsForMaterial(mat, getBandsForMaterial).length - 1);
        return [key, maxBandIndex] as const;
      }),
    );

    return {
      record: p6lrRecord,
      totalModifiers: computeTotalModifiers(
        p6lrRecipe,
        getBandsForMaterial,
        (key) => maxBandByKey.get(key) ?? DEFAULT_BAND_INDEX,
      ),
    };
  }, [allRecipes, componentCards, getBandsForMaterial]);

  const showVariantSelector = groupRecipes.length > 1;
  const selectedIsQueued = isRecipeQueued(selectedRecipe);
  const selectedIsBookmarked = isRecipeBookmarked(selectedRecipe);
  const categoryLine = [
    selectedComponentCard?.category ?? selectedRecipe.category,
    selectedComponentCard?.typeLabel ?? selectedRecipe.wiki_type,
    selectedComponentCard?.type ?? selectedRecipe.component_type,
  ]
    .filter((value): value is string => Boolean(value))
    .filter((value) => value.trim().toLowerCase() !== "fps")
    .filter((value, index, values) => values.findIndex((item) => item.trim().toLowerCase() === value.trim().toLowerCase()) === index)
    .join(" / ");

  return (
    <div className="craft-detail-stage craft-detail-shell">
      <header className="craft-detail-header">
        <Link className="craft-summary-queue-link craft-detail-back-link" to={backTo}>
          Back to Results
        </Link>
        <div className="craft-detail-title-block">
          <h1 className="craft-detail-title">{displayName}</h1>
          {categoryLine && <div className="craft-detail-meta">{categoryLine}</div>}
        </div>
        <div className="craft-summary-action-row craft-detail-actions">
          {selectedComponentCard && (() => {
            const isInCompare = slots[0]?.id === selectedComponentCard.id || slots[1]?.id === selectedComponentCard.id;
            return (
              <button
                type="button"
                className={`cmp-card-btn${isInCompare ? " cmp-card-btn--active" : ""}`}
                style={{ alignSelf: "center" }}
                onClick={() => {
                  const emptySlot = slots[0] === null ? 0 : slots[1] === null ? 1 : 1;
                  setSlot(emptySlot, selectedComponentCard);
                }}
              >
                {isInCompare ? "✓ In Compare" : "+ Compare"}
              </button>
            );
          })()}
          <button
            type="button"
            className={`craft-summary-action-btn craft-summary-bookmark-btn${selectedIsBookmarked ? " is-active" : ""}`}
            aria-pressed={selectedIsBookmarked}
            aria-label={selectedIsBookmarked ? `Remove ${displayName} save` : `Save ${displayName}`}
            onClick={() => onToggleBookmark(selectedRecipe)}
          >
            {selectedIsBookmarked ? "Saved" : "Save Blueprint"}
          </button>
          <button
            type="button"
            className={`craft-summary-action-btn craft-summary-queue-btn${selectedIsQueued ? " is-active" : ""}`}
            aria-pressed={selectedIsQueued}
            aria-label={selectedIsQueued ? `${displayName} is in build queue` : `Add ${displayName} to build queue`}
            onClick={() => onAddToQueue(
              selectedRecipe,
              buildSelectedQualitySnapshot(
                selectedRecipe,
                materialQualities,
                getBandsForMaterial,
              ),
              finalProductQuality,
            )}
          >
            {selectedIsQueued ? "Queued" : "Add to Queue"}
          </button>
        </div>
      </header>

      <div className="craft-detail-workspace">
        <ItemSummaryPanel
          recipe={selectedRecipe}
          displayName={displayName}
          finalProductQuality={finalProductQuality}
          componentCardRecord={selectedComponentCard}
          totalModifiers={totalModifiers}
          p6lrReference={p6lrReference}
        />

        <aside className="craft-detail-crafting" aria-label="Crafting materials">
        {showVariantSelector && (
          <div className="craft-variant-selector" aria-label="Select variant">
            <div className="craft-variant-selector-label">Select variant</div>
            <div className="craft-variant-list">
              {groupRecipes.map((variant) => {
                const isSelected = variant.blueprint_id === selectedRecipe.blueprint_id;
                const variantLabel = getVariantLabel(variant, baseDisplayName);
                const meta = getInlineMeta(variant);

                return (
                  <button
                    key={variant.blueprint_id}
                    type="button"
                    className={`craft-variant-row${isSelected ? " is-selected" : ""}`}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedRecipeId(variant.blueprint_id)}
                  >
                    <span className="craft-variant-name">{variantLabel}</span>
                    {meta.length > 0 && (
                      <span className="craft-variant-meta">
                        {meta.join(" / ")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <RightCraftingPanel
          recipe={selectedRecipe}
          totalModifiers={totalModifiers}
          overallModifiers={overallModifiers}
          overallQualitySource={overallQualitySource}
          finalProductQuality={finalProductQuality}
        >
          {quantizationLoading && (
            <div className="craft-empty-card">
              Loading local quality quantization bands...
            </div>
          )}
          {selectedRecipe.materials.map((mat, inputIndex) => {
            const key = getMaterialQualityKey(selectedRecipe, mat, inputIndex);

            return (
              <DetailMaterialQualityRow
                key={`${mat.slot}:${key}`}
                recipe={selectedRecipe}
                mat={mat}
                bandIndex={getBandIndex(key)}
                onBandChange={(bandIndex) =>
                  setMaterialQualities((prev) => ({
                    ...prev,
                    [key]: bandIndex,
                  }))
                }
                getBandsForMaterial={getBandsForMaterial}
              />
            );
          })}
        </RightCraftingPanel>
        </aside>
      </div>

      <MissionSourcePanel
        recipe={selectedRecipe}
        rewardPools={rewardPools}
        isMissionBookmarked={isMissionBookmarked}
        onToggleMissionBookmark={onToggleMissionBookmark}
      />
    </div>
  );
};

interface Props {
  recipes: ComponentRecipe[];
  inventoryEntries?: unknown[];
  materialTemplates?: unknown[];
  componentCards?: ComponentCardIndexRecord[];
  initialBlueprintId?: string;
  onAddToQueue: (
    recipe: ComponentRecipe,
    selectedQualities: Record<string, { quality: number; bandNumber: number; bands: QualityBand[] }>,
    finalProductQuality: FinalProductQuality,
  ) => void;
  isRecipeQueued?: (recipe: ComponentRecipe) => boolean;
}

export default function ComponentRecipeTable({
  recipes,
  componentCards = [],
  initialBlueprintId,
  onAddToQueue,
  isRecipeQueued = () => false,
}: Props) {
  const initialSidebarState = useMemo(
    () => initialBlueprintId
      ? EMPTY_RECIPE_SIDEBAR_STATE
      : readStoredSidebarState(RECIPE_FILTER_STORAGE_KEY, EMPTY_RECIPE_SIDEBAR_STATE),
    [initialBlueprintId],
  );
  const [search, setSearch] = useState(initialSidebarState.search);
  const [fpsFilters, setFpsFilters] = useState<Set<string>>(() => new Set(initialSidebarState.fps));
  const [vehicleFilters, setVehicleFilters] = useState<Set<string>>(() => new Set(initialSidebarState.vehicles));
  const [sizeFilters, setSizeFilters] = useState<Set<string>>(() => new Set(initialSidebarState.sizes));
  const [gradeFilters, setGradeFilters] = useState<Set<string>>(() => new Set(initialSidebarState.grades));
  const [classFilters, setClassFilters] = useState<Set<string>>(() => new Set(initialSidebarState.classes));
  const [resourceFilters, setResourceFilters] = useState<Set<string>>(() => new Set(initialSidebarState.resources));
  const mineableGroups = useMemo(
    () => buildResourceGroups(buildMineableResourceList(recipes)),
    [recipes],
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [cfDrawerOpen, setCfDrawerOpen] = useState(false);
  const [cfDrawerGroup, setCfDrawerGroup] = useState<"type" | "category" | "ship" | "vehicle" | "hand">("type");
  const [cfSearch, setCfSearch] = useState("");
  const shellRef = useRef<HTMLDivElement>(null);
  const [bookmarkedRecipeIds, setBookmarkedRecipeIds] = useState<Set<string>>(
    () => readStoredStringSet(RECIPE_BOOKMARK_STORAGE_KEY),
  );
  const [bookmarkedMissionIds, setBookmarkedMissionIds] = useState<Set<string>>(
    () => readStoredStringSet(MISSION_BOOKMARK_STORAGE_KEY),
  );
  const { session, loading: authLoading } = useAuthSession();
  const resetSelection = useCallback(() => setSelectedGroupId(null), []);

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!accessToken) return;

    let cancelled = false;
    fetchSavedBlueprints(accessToken)
      .then((savedBlueprints) => {
        if (!cancelled) {
          setBookmarkedRecipeIds(new Set(savedBlueprints.map((item) => item.blueprintId)));
        }
      })
      .catch(() => {
        if (!cancelled) setBookmarkedRecipeIds(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  const toggleBookmark = useCallback(async (recipe: ComponentRecipe) => {
    const recipeId = recipe.blueprint_id;
    const accessToken = session?.access_token;

    if (!accessToken) {
      if (hasSupabaseConfig() && !authLoading) {
        await signInWithDiscord();
        return;
      }

      setBookmarkedRecipeIds((prev) => {
        const next = new Set(prev);
        if (next.has(recipeId)) {
          next.delete(recipeId);
        } else {
          next.add(recipeId);
        }
        writeStoredStringSet(RECIPE_BOOKMARK_STORAGE_KEY, next);
        return next;
      });
      return;
    }

    const wasSaved = bookmarkedRecipeIds.has(recipeId);
    setBookmarkedRecipeIds((prev) => {
      const next = new Set(prev);
      wasSaved ? next.delete(recipeId) : next.add(recipeId);
      return next;
    });

    try {
      if (wasSaved) {
        await deleteUserBlueprint(accessToken, recipeId);
      } else {
        await saveUserBlueprint(accessToken, {
          blueprintId: recipeId,
          faction: recipe.manufacturer,
          itemName: getRecipeDisplayName(recipe),
          sourceType: "blueprint",
        });
      }
    } catch {
      setBookmarkedRecipeIds((prev) => {
        const next = new Set(prev);
        wasSaved ? next.add(recipeId) : next.delete(recipeId);
        return next;
      });
    }
  }, [authLoading, bookmarkedRecipeIds, session?.access_token]);

  const toggleMissionBookmark = useCallback((missionId: string) => {
    setBookmarkedMissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(missionId)) {
        next.delete(missionId);
      } else {
        next.add(missionId);
      }
      writeStoredStringSet(MISSION_BOOKMARK_STORAGE_KEY, next);
      return next;
    });
  }, []);

  function resetAll() {
    setSearch("");
    setFpsFilters(new Set());
    setVehicleFilters(new Set());
    setSizeFilters(new Set());
    setGradeFilters(new Set());
    setClassFilters(new Set());
    setResourceFilters(new Set());
    resetSelection();
  }

  const hasActiveFilters =
    search ||
    fpsFilters.size ||
    vehicleFilters.size ||
    sizeFilters.size ||
    gradeFilters.size ||
    classFilters.size ||
    resourceFilters.size;

  useEffect(() => {
    writeStoredSidebarState<RecipeSidebarState>(RECIPE_FILTER_STORAGE_KEY, {
      search,
      fps: [...fpsFilters],
      vehicles: [...vehicleFilters],
      sizes: [...sizeFilters],
      grades: [...gradeFilters],
      classes: [...classFilters],
      resources: [...resourceFilters],
      miningCategories: [],
    });
  }, [classFilters, fpsFilters, gradeFilters, resourceFilters, search, sizeFilters, vehicleFilters]);

  // FPS chips: ammo/armor/weapons — normalized labels
  const FPS_LABEL_MAP: Record<string, string> = { ammo: "Ammo", armor: "Armor", weapons: "Weapons" };
  const fpsOptions = useMemo(
    () =>
      Array.from(new Set(recipes.filter((r) => r.item_kind === "fps").map((r) => r.component_type).filter(Boolean)))
        .sort()
        .map((t) => ({ value: t!, label: FPS_LABEL_MAP[t!.toLowerCase()] ?? (t!.charAt(0).toUpperCase() + t!.slice(1)) })),
    [recipes],
  );

  // Type chips: non-fps, collapse utility types into one chip, normalize labels
  const vehicleOptions = useMemo(() => {
    const EXCLUDED = new Set(["salvage", "tractorbeam"]);
    const types = Array.from(
      new Set(
        recipes
          .filter((r) => r.item_kind !== "fps")
          .map((r) => r.component_type)
          .filter((t): t is string => !!t && !EXCLUDED.has(t) && !UTILITY_TYPES.has(t)),
      ),
    ).sort();

    const hasUtility = recipes.some(
      (r) => r.item_kind !== "fps" && r.component_type && UTILITY_TYPES.has(r.component_type),
    );

    const chips = types.map((t) => ({ value: t, label: normalizeVehicleTypeLabel(t) }));
    if (hasUtility) chips.push({ value: "__utility__", label: "Utility" });
    return chips;
  }, [recipes]);

  const sizeOptions = useMemo(() => {
    return Array.from(new Set(recipes.map((r) => r.size).filter(Boolean)))
      .sort((a, b) => Number(a) - Number(b))
      .map((s) => ({ value: s!, label: `S${s}` }));
  }, [recipes]);

  const gradeOptions = useMemo(
    () =>
      Array.from(new Set(recipes.map((r) => r.grade).filter(Boolean)))
        .sort()
        .map((grade) => ({ value: grade!, label: grade! })),
    [recipes],
  );

  const CLASS_LABEL_MAP: Record<string, string> = {
    civilian: "Civilian", competition: "Competition", military: "Military", stealth: "Stealth",
  };
  const classOptions = useMemo(
    () =>
      Array.from(new Set(recipes.map((r) => r.class).filter(Boolean)))
        .sort()
        .map((c) => ({ value: c!, label: CLASS_LABEL_MAP[c!.toLowerCase()] ?? (c!.charAt(0).toUpperCase() + c!.slice(1)) })),
    [recipes],
  );

  const recipeSearchTexts = useMemo(
    () =>
      new Map(recipes.map((r) => [r.blueprint_id, buildRecipeSearchText(r)])),
    [recipes],
  );

  const filtered = useMemo(() => {
    return recipes
      .filter((r) => {
        if (
          search &&
          !matchesSearch(recipeSearchTexts.get(r.blueprint_id) ?? "", search)
        ) {
          return false;
        }

        if (fpsFilters.size && (r.item_kind !== "fps" || !fpsFilters.has(r.component_type ?? ""))) return false;

        if (vehicleFilters.size) {
          if (r.item_kind === "fps") return false;
          const ct = r.component_type ?? "";
          const matchesUtility = vehicleFilters.has("__utility__") && UTILITY_TYPES.has(ct);
          const matchesDirect = vehicleFilters.has(ct);
          if (!matchesUtility && !matchesDirect) return false;
        }

        if (sizeFilters.size) {
          const sv = r.size ? r.size : NO_VALUE;
          if (!sizeFilters.has(sv)) return false;
        }

        if (gradeFilters.size) {
          const gv = r.grade ? r.grade : NO_VALUE;
          if (!gradeFilters.has(gv)) return false;
        }

        if (classFilters.size && !classFilters.has(r.class ?? "")) return false;

        if (resourceFilters.size) {
          const recipeName = r.component_name.trim().toLowerCase();
          const usesSelectedInput = (r.materials ?? []).some((material) =>
            resourceFilters.has(material.cost_id || material.material_name) ||
            resourceFilters.has(material.material_name)
          );
          const isSelectedResourceItself = (r.materials ?? []).some((material) =>
            resourceFilters.has(material.cost_id || material.material_name) &&
            material.material_name.trim().toLowerCase() === recipeName
          );
          if (!usesSelectedInput || isSelectedResourceItself) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const aName = getRecipeDisplayName(a);
        const bName = getRecipeDisplayName(b);

        const nd = aName.localeCompare(bName);

        return nd !== 0 ? nd : (a.size || "").localeCompare(b.size || "");
      });
  }, [
    recipes,
    search,
    fpsFilters,
    vehicleFilters,
    sizeFilters,
    gradeFilters,
    classFilters,
    resourceFilters,
    recipeSearchTexts,
  ]);

  const groupedRecipes = useMemo(() => {
    const map = new Map<string, { id: string; displayName: string; recipes: ComponentRecipe[] }>();

    for (const recipe of filtered) {
      const identity = deriveRecipeVariantIdentity(recipe);
      const id = identity.groupKey;
      const group = map.get(id);

      if (group) {
        group.recipes.push(recipe);
      } else {
        map.set(id, {
          id,
          displayName: identity.baseName,
          recipes: [recipe],
        });
      }
    }

    return Array.from(map.values()).map((group) => ({
      ...group,
      recipes: dedupeRecipeVariants(group.recipes, group.displayName),
    }));
  }, [filtered]);

  useEffect(() => {
    if (groupedRecipes.length === 0) {
      if (selectedGroupId !== null) setSelectedGroupId(null);
      return;
    }

    const initialGroup = initialBlueprintId
      ? groupedRecipes.find((group) => group.recipes.some((recipe) => recipe.blueprint_id === initialBlueprintId))
      : null;

    if (initialGroup && selectedGroupId !== initialGroup.id) {
      setSelectedGroupId(initialGroup.id);
      return;
    }

    if (!selectedGroupId || !groupedRecipes.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(groupedRecipes[0].id);
    }
  }, [groupedRecipes, initialBlueprintId, selectedGroupId]);

  const selectedGroup = groupedRecipes.find((group) => group.id === selectedGroupId) ?? groupedRecipes[0] ?? null;
  const visibleRecipeGroups = groupedRecipes.slice(0, MAX_VISIBLE_RESULTS);
  const hiddenRecipeCount = Math.max(0, groupedRecipes.length - visibleRecipeGroups.length);


  if (initialBlueprintId) {
    return (
      <div className="craft-page craft-planner-shell craft-detail-page" ref={shellRef}>
        {selectedGroup ? (
          <RecipeDrawer
            recipe={selectedGroup.recipes[0]}
            groupRecipes={selectedGroup.recipes}
            allRecipes={recipes}
            baseDisplayName={selectedGroup.displayName}
            initialRecipeId={initialBlueprintId}
            componentCards={componentCards}
            onAddToQueue={onAddToQueue}
            isRecipeQueued={isRecipeQueued}
            isRecipeBookmarked={(item) => bookmarkedRecipeIds.has(item.blueprint_id)}
            onToggleBookmark={toggleBookmark}
            isMissionBookmarked={(missionId) => bookmarkedMissionIds.has(missionId)}
            onToggleMissionBookmark={toggleMissionBookmark}
          />
        ) : (
          <section className="craft-detail-stage craft-detail-stage--empty">
            <div className="craft-empty-card">Recipe not found.</div>
          </section>
        )}
      </div>
    );
  }


  return (
    <div className="craft-page craft-planner-shell" ref={shellRef}>

      {/* ── Compact filter bar ── */}
      <div className={`cfb-bar${cfDrawerOpen ? " cfb-bar--open" : ""}`}>

        {/* FPS chips — always visible (small set) */}
        {fpsOptions.length > 0 && (
          <>
            <span className="craft-frl-label">FPS</span>
            <div className="cfb-chips">
              {fpsOptions.map((opt) => (
                <button key={opt.value} type="button"
                  className={`craft-frl-chip${fpsFilters.has(opt.value) ? " craft-frl-chip--active" : ""}`}
                  onClick={() => { setFpsFilters((prev) => { const n = new Set(prev); n.has(opt.value) ? n.delete(opt.value) : n.add(opt.value); return n; }); resetSelection(); }}
                >{opt.label}</button>
              ))}
            </div>
            <div className="cfb-divider" />
          </>
        )}

        {/* Summary group chips */}
        {([
          {
            key: "type" as const,
            label: "Type",
            count: vehicleFilters.size,
            total: vehicleOptions.length,
            visible: vehicleOptions.length > 0,
          },
          {
            key: "category" as const,
            label: "Category",
            count: sizeFilters.size + gradeFilters.size + classFilters.size,
            total: sizeOptions.length + gradeOptions.length + classOptions.length,
            visible: sizeOptions.length + gradeOptions.length + classOptions.length > 0,
          },
          {
            key: "ship" as const,
            label: "Ship",
            count: mineableGroups.shipAndHarvestable.filter((c) => resourceFilters.has(c.id)).length,
            total: mineableGroups.shipAndHarvestable.length,
            visible: mineableGroups.shipAndHarvestable.length > 0,
          },
          {
            key: "vehicle" as const,
            label: "Vehicle",
            count: mineableGroups.vehicle.filter((c) => resourceFilters.has(c.id)).length,
            total: mineableGroups.vehicle.length,
            visible: mineableGroups.vehicle.length > 0,
          },
          {
            key: "hand" as const,
            label: "Hand",
            count: mineableGroups.hand.filter((c) => resourceFilters.has(c.id)).length,
            total: mineableGroups.hand.length,
            visible: mineableGroups.hand.length > 0,
          },
        ] as const).map((group) => {
          if (!group.visible) return null;
          return (
            <button
              key={group.key}
              type="button"
              className={`craft-frl-chip cfb-group-chip${group.count > 0 ? " craft-frl-chip--active" : ""}${cfDrawerOpen && cfDrawerGroup === group.key ? " cfb-group-chip--open" : ""}`}
              onClick={() => {
                if (cfDrawerOpen && cfDrawerGroup === group.key) {
                  setCfDrawerOpen(false);
                } else {
                  setCfDrawerGroup(group.key);
                  setCfDrawerOpen(true);
                  setCfSearch("");
                }
              }}
            >
              {group.label}
              {group.count > 0
                ? <span className="mfr-chip-count">{group.count}</span>
                : <span className="cfb-group-total">{group.total}</span>
              }
              <span className="cfb-chevron">{cfDrawerOpen && cfDrawerGroup === group.key ? "▲" : "▼"}</span>
            </button>
          );
        })}

        {/* Search */}
        <div className="cfb-search-wrap">
          <input
            type="text"
            className="cfb-search"
            placeholder="Filter chips…"
            value={cfSearch}
            onChange={(e) => {
              setCfSearch(e.target.value);
              if (e.target.value.trim() && !cfDrawerOpen) {
                setCfDrawerOpen(true);
              }
            }}
          />
        </div>

        <div className="cfb-spacer" />

        <button type="button" className="craft-frl-clear" onClick={resetAll} disabled={!hasActiveFilters}>
          Clear
        </button>

      </div>

      {/* ── Tactical drawer ── */}
      {cfDrawerOpen && (
        <div className="cfb-drawer">

          {/* Left rail */}
          <div className="cfb-drawer-rail">
            <span className="craft-frl-label" style={{ paddingLeft: "0.5rem" }}>Filter Group</span>
            {([
              { key: "type" as const, label: "Type", visible: vehicleOptions.length > 0 },
              { key: "category" as const, label: "Category", visible: sizeOptions.length + gradeOptions.length + classOptions.length > 0 },
              { key: "ship" as const, label: "Ship Mineables", visible: mineableGroups.shipAndHarvestable.length > 0 },
              { key: "vehicle" as const, label: "Vehicle", visible: mineableGroups.vehicle.length > 0 },
              { key: "hand" as const, label: "Hand", visible: mineableGroups.hand.length > 0 },
            ] as const).map((group) => {
              if (!group.visible) return null;
              const count = group.key === "type" ? vehicleFilters.size
                : group.key === "category" ? sizeFilters.size + gradeFilters.size + classFilters.size
                : group.key === "ship" ? mineableGroups.shipAndHarvestable.filter((c) => resourceFilters.has(c.id)).length
                : group.key === "vehicle" ? mineableGroups.vehicle.filter((c) => resourceFilters.has(c.id)).length
                : mineableGroups.hand.filter((c) => resourceFilters.has(c.id)).length;
              return (
                <button key={group.key} type="button"
                  className={`cfb-rail-btn${cfDrawerGroup === group.key ? " cfb-rail-btn--active" : ""}`}
                  onClick={() => { setCfDrawerGroup(group.key); setCfSearch(""); }}
                >
                  {group.label}
                  {count > 0 && <span className="mfr-chip-count">{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Center chip grid */}
          <div className="cfb-drawer-chips">
            {cfDrawerGroup === "type" && vehicleOptions
              .filter((opt) => !cfSearch.trim() || opt.label.toLowerCase().includes(cfSearch.trim().toLowerCase()))
              .map((opt) => {
                const isActive = opt.value === "__utility__"
                  ? [...UTILITY_TYPES].some((t) => vehicleFilters.has(t)) || vehicleFilters.has("__utility__")
                  : vehicleFilters.has(opt.value);
                return (
                  <button key={opt.value} type="button"
                    className={`craft-frl-chip${isActive ? " craft-frl-chip--active" : ""}`}
                    onClick={() => {
                      setVehicleFilters((prev) => {
                        const n = new Set(prev);
                        if (opt.value === "__utility__") {
                          const utilityActive = [...UTILITY_TYPES].some((t) => n.has(t)) || n.has("__utility__");
                          if (utilityActive) { UTILITY_TYPES.forEach((t) => n.delete(t)); n.delete("__utility__"); }
                          else { n.add("__utility__"); }
                        } else { n.has(opt.value) ? n.delete(opt.value) : n.add(opt.value); }
                        return n;
                      });
                      resetSelection();
                    }}
                  >{opt.label}</button>
                );
              })
            }
            {cfDrawerGroup === "category" && (
              <>
                {sizeOptions.length > 0 && (
                  <>
                    <span className="cfb-sublabel">Size</span>
                    {sizeOptions
                      .filter((opt) => !cfSearch.trim() || opt.label.toLowerCase().includes(cfSearch.trim().toLowerCase()))
                      .map((opt) => (
                        <button key={opt.value} type="button"
                          className={`craft-frl-chip${sizeFilters.has(opt.value) ? " craft-frl-chip--active" : ""}`}
                          onClick={() => { setSizeFilters((prev) => { const n = new Set(prev); n.has(opt.value) ? n.delete(opt.value) : n.add(opt.value); return n; }); resetSelection(); }}
                        >{opt.label}</button>
                      ))}
                  </>
                )}
                {gradeOptions.length > 0 && (
                  <>
                    <span className="cfb-sublabel">Grade</span>
                    {gradeOptions
                      .filter((opt) => !cfSearch.trim() || opt.label.toLowerCase().includes(cfSearch.trim().toLowerCase()))
                      .map((opt) => (
                        <button key={opt.value} type="button"
                          className={`craft-frl-chip${gradeFilters.has(opt.value) ? " craft-frl-chip--active" : ""}`}
                          onClick={() => { setGradeFilters((prev) => { const n = new Set(prev); n.has(opt.value) ? n.delete(opt.value) : n.add(opt.value); return n; }); resetSelection(); }}
                        >{opt.label}</button>
                      ))}
                  </>
                )}
                {classOptions.length > 0 && (
                  <>
                    <span className="cfb-sublabel">Class</span>
                    {classOptions
                      .filter((opt) => !cfSearch.trim() || opt.label.toLowerCase().includes(cfSearch.trim().toLowerCase()))
                      .map((opt) => (
                        <button key={opt.value} type="button"
                          className={`craft-frl-chip${classFilters.has(opt.value) ? " craft-frl-chip--active" : ""}`}
                          onClick={() => { setClassFilters((prev) => { const n = new Set(prev); n.has(opt.value) ? n.delete(opt.value) : n.add(opt.value); return n; }); resetSelection(); }}
                        >{opt.label}</button>
                      ))}
                  </>
                )}
              </>
            )}
            {cfDrawerGroup === "ship" && mineableGroups.shipAndHarvestable
              .filter((chip) => !cfSearch.trim() || chip.label.toLowerCase().includes(cfSearch.trim().toLowerCase()))
              .map((chip) => (
                <button key={chip.id} type="button"
                  className={`craft-frl-chip${resourceFilters.has(chip.id) ? " craft-frl-chip--active" : ""}`}
                  onClick={() => { setResourceFilters((prev) => { const n = new Set(prev); n.has(chip.id) ? n.delete(chip.id) : n.add(chip.id); return n; }); resetSelection(); }}
                >{chip.label}</button>
              ))
            }
            {cfDrawerGroup === "vehicle" && mineableGroups.vehicle
              .filter((chip) => !cfSearch.trim() || chip.label.toLowerCase().includes(cfSearch.trim().toLowerCase()))
              .map((chip) => (
                <button key={chip.id} type="button"
                  className={`craft-frl-chip${resourceFilters.has(chip.id) ? " craft-frl-chip--active" : ""}`}
                  onClick={() => { setResourceFilters((prev) => { const n = new Set(prev); n.has(chip.id) ? n.delete(chip.id) : n.add(chip.id); return n; }); resetSelection(); }}
                >{chip.label}</button>
              ))
            }
            {cfDrawerGroup === "hand" && mineableGroups.hand
              .filter((chip) => !cfSearch.trim() || chip.label.toLowerCase().includes(cfSearch.trim().toLowerCase()))
              .map((chip) => (
                <button key={chip.id} type="button"
                  className={`craft-frl-chip${resourceFilters.has(chip.id) ? " craft-frl-chip--active" : ""}`}
                  onClick={() => { setResourceFilters((prev) => { const n = new Set(prev); n.has(chip.id) ? n.delete(chip.id) : n.add(chip.id); return n; }); resetSelection(); }}
                >{chip.label}</button>
              ))
            }
          </div>

          {/* Right summary */}
          <div className="cfb-drawer-summary">
            {(() => {
              const isResource = cfDrawerGroup === "ship" || cfDrawerGroup === "vehicle" || cfDrawerGroup === "hand";
              const groupChips = cfDrawerGroup === "ship" ? mineableGroups.shipAndHarvestable
                : cfDrawerGroup === "vehicle" ? mineableGroups.vehicle
                : cfDrawerGroup === "hand" ? mineableGroups.hand
                : null;
              const selectedCount = cfDrawerGroup === "type" ? vehicleFilters.size
                : cfDrawerGroup === "category" ? sizeFilters.size + gradeFilters.size + classFilters.size
                : (groupChips?.filter((c) => resourceFilters.has(c.id)).length ?? 0);
              const totalCount = cfDrawerGroup === "type" ? vehicleOptions.length
                : cfDrawerGroup === "category" ? sizeOptions.length + gradeOptions.length + classOptions.length
                : (groupChips?.length ?? 0);
              const groupLabel = cfDrawerGroup === "type" ? "Type"
                : cfDrawerGroup === "category" ? "Category"
                : cfDrawerGroup === "ship" ? "Ship Mineables"
                : cfDrawerGroup === "vehicle" ? "Vehicle"
                : "Hand";
              return (
                <>
                  <div className="cfb-summary-count">
                    <span className="cfb-summary-num">{selectedCount}</span>
                    <span className="cfb-summary-of">/ {totalCount}</span>
                  </div>
                  <div className="cfb-summary-label">{groupLabel} selected</div>
                  {isResource && groupChips && selectedCount > 0 && (
                    <button type="button" className="cfb-summary-action"
                      onClick={() => {
                        setResourceFilters((prev) => {
                          const n = new Set(prev);
                          groupChips.forEach((c) => n.delete(c.id));
                          return n;
                        });
                        resetSelection();
                      }}
                    >Clear group</button>
                  )}
                  {isResource && groupChips && selectedCount < groupChips.length && (
                    <button type="button" className="cfb-summary-action cfb-summary-action--all"
                      onClick={() => {
                        setResourceFilters((prev) => new Set([...prev, ...groupChips.map((c) => c.id)]));
                        resetSelection();
                      }}
                    >Select all</button>
                  )}
                  {groupedRecipes.length === 0 && !!hasActiveFilters && (
                    <div className="cfb-summary-warn">No recipes match</div>
                  )}
                </>
              );
            })()}
          </div>

        </div>
      )}

      {/* ── Console layout ── */}
      <div className="craft-console-layout">
        <aside className="craft-finder-sidebar">
          <div className="craft-finder-header">
            <span className="mlist-header-label">Component Finder</span>
          </div>

          <label className="craft-search">
            <span className="craft-search-icon" aria-hidden>/</span>
            <input
              type="search"
              className="craft-search-input"
              placeholder="Search recipes..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetSelection(); }}
            />
          </label>

          <div className="craft-result-head">
            <span>Results</span>
            <strong>{groupedRecipes.length}</strong>
          </div>

          <div className="craft-result-list">
            {visibleRecipeGroups.map((group) => {
              const recipe = group.recipes[0];
              const selected = selectedGroup?.id === group.id;
              const variantCount = group.recipes.length;
              const typeBadges = getTypeBadges(recipe);
              const sizeLabel = getSharedValue(group.recipes, (item) => formatSize(item.size));
              const grade = getSharedValue(group.recipes, (item) => item.grade ?? null);
              const cls = getSharedValue(group.recipes, (item) => item.class ?? null);
              const saved = group.recipes.some((item) => bookmarkedRecipeIds.has(item.blueprint_id));
              const queued = group.recipes.some((item) => isRecipeQueued(item));

              return (
                <button
                  key={group.id}
                  type="button"
                  className={`craft-result-card${selected ? " craft-result-card--selected" : ""}`}
                  onClick={() => setSelectedGroupId(group.id)}
                >
                  <span className="craft-result-name">{group.displayName}</span>
                  <span className="craft-result-sub">
                    {getSubtitle(recipe)}
                    {variantCount > 1 && ` / ${variantCount} variants`}
                  </span>
                  <span className="craft-result-chips">
                    {sizeLabel && <span className="craft-mini-chip">{sizeLabel}</span>}
                    {typeBadges.map((badge) => (
                      <span key={badge} className="craft-mini-chip">{badge}</span>
                    ))}
                    {grade && <span className="craft-mini-chip">{grade}</span>}
                    {cls && <span className="craft-mini-chip">{cls}</span>}
                    {queued && <span className="craft-mini-chip craft-mini-chip--queue">Queued</span>}
                    {saved && <span className="craft-mini-chip craft-mini-chip--saved">Saved</span>}
                  </span>
                  <span className="craft-result-arrow" aria-hidden>&rsaquo;</span>
                  {selected && <span className="craft-result-bridge" aria-hidden="true" />}
                </button>
              );
            })}

            {groupedRecipes.length === 0 && (
              <div className="craft-empty-card">No recipes match filters.</div>
            )}
          </div>

          {hiddenRecipeCount > 0 && (
            <div className="craft-result-footer">
              Showing {visibleRecipeGroups.length} of {groupedRecipes.length}. Refine search or filters.
            </div>
          )}
        </aside>

        {selectedGroup ? (
            <RecipeDrawer
              recipe={selectedGroup.recipes[0]}
              groupRecipes={selectedGroup.recipes}
              allRecipes={recipes}
              baseDisplayName={selectedGroup.displayName}
              initialRecipeId={initialBlueprintId}
              componentCards={componentCards}
            onAddToQueue={onAddToQueue}
            isRecipeQueued={isRecipeQueued}
            isRecipeBookmarked={(item) => bookmarkedRecipeIds.has(item.blueprint_id)}
            onToggleBookmark={toggleBookmark}
            isMissionBookmarked={(missionId) => bookmarkedMissionIds.has(missionId)}
            onToggleMissionBookmark={toggleMissionBookmark}
          />
        ) : (
          <section className="craft-detail-stage craft-detail-stage--empty">
            <div className="craft-empty-card">Select a recipe to inspect material quality.</div>
          </section>
        )}
      </div>
    </div>
  );
}
