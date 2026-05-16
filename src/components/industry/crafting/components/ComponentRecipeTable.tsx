import {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
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
import {
  DEFAULT_BAND_INDEX,
  FALLBACK_QUALITY_BANDS,
  clampBandIndex,
  findNearestBandForQuality,
  getBandEffectiveQuality as getEffectiveQualityFromBands,
  rarityClassFromBandIndex,
  rarityFromBandIndex,
  type QualityBand,
} from "../utils/qualityBands";


const NO_VALUE = "__none__";
const QUALITY_QUANTIZATION_URL = "/api/crafting/material_quality_quantization.json";
const MISSION_REWARD_SOURCES_URL = "/api/missions/blueprint_reward_sources.json";
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
  generatorName?: unknown;
  factionName?: unknown;
  poolGuid?: unknown;
  poolName?: unknown;
  poolChance?: unknown;
  rewardChance?: unknown;
};

let missionRewardSourceMapPromise: Promise<Map<string, MissionRewardEntry[]>> | null = null;

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
  const byName = new Map<string, { id: string; label: string }>();

  for (const recipe of recipes) {
    for (const material of recipe.materials ?? []) {
      const label = String(material.material_name ?? "").trim();
      if (!label) continue;
      const id = material.cost_id || label;
      const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "");
      if (!key || byName.has(key)) continue;
      byName.set(key, { id, label });
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

function normalizeMissionRewardEntry(value: unknown): MissionRewardEntry | null {
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

  return {
    id: `mission:${id}`,
    title: normalizeMissionTitle(contractTitle ?? contractDebugName ?? "Unknown Blueprint Source"),
    subtitle: generatorName,
    poolName,
    factionName,
    chance: typeof poolChance === "number" && typeof rewardChance === "number" ? poolChance * rewardChance : poolChance ?? rewardChance,
    source: "mission",
  };
}

function normalizeMissionSourceRecord(value: unknown): { blueprintGuid: string; entries: MissionRewardEntry[] } | null {
  if (!isRecord(value)) return null;

  const record = value as ApiBlueprintMissionSource;
  const blueprintGuid = asNonEmptyString(record.blueprintGuid);
  if (!blueprintGuid || !Array.isArray(record.missions)) return null;

  const entries = record.missions.flatMap((mission) => {
    const entry = normalizeMissionRewardEntry(mission);
    return entry ? [entry] : [];
  });

  return { blueprintGuid, entries };
}

async function loadMissionRewardSourceMap(): Promise<Map<string, MissionRewardEntry[]>> {
  missionRewardSourceMapPromise ??= fetch(apiUrl(MISSION_REWARD_SOURCES_URL))
    .then((response) => {
      if (!response.ok) throw new Error(`Mission reward sources unavailable: ${response.status}`);
      return response.json() as Promise<unknown>;
    })
    .then((data) => {
      const map = new Map<string, MissionRewardEntry[]>();
      if (!Array.isArray(data)) return map;

      for (const value of data) {
        const record = normalizeMissionSourceRecord(value);
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

function getSubtitle(recipe: ComponentRecipe): string {
  if (recipe.item_kind === "fps") {
    const parts = [recipe.category, recipe.wiki_type].filter(Boolean);
    return parts.join(" · ");
  }

  return recipe.component_type ?? "";
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

        if (!res.ok) {
          throw new Error(
            `Failed to load ${QUALITY_QUANTIZATION_URL}: ${res.status}`,
          );
        }

        const json = (await res.json()) as MaterialQuantization[];

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

function MaterialQualityRow({
  mat,
  bandIndex,
  onBandChange,
  getBandsForMaterial,
  getBandEffectiveQuality,
}: {
  mat: ComponentRecipe["materials"][number];
  bandIndex: number;
  onBandChange: (bandIndex: number) => void;
  getBandsForMaterial: (materialName: string) => QualityBand[];
  getBandEffectiveQuality: (materialName: string, bandIndex: number) => number;
  getBandLabel: (materialName: string, bandIndex: number) => string;
}) {
  const materialName = getMaterialName(mat);
  const bands = getBandsForMaterial(materialName);
  const safeBandIndex = clampBandIndex(bandIndex, bands);
  const bandNumber = safeBandIndex + 1;
  const quality = getBandEffectiveQuality(materialName, safeBandIndex);
  const selectedQualityTierClass = rarityClassFromBandIndex(bandNumber);

  const atQuality = useMemo(() => {
    const mods = getModifiersAtQuality(mat.qualityModifiers ?? [], quality);
    // Weapon Recoil Kick must appear directly above Weapon Recoil Smoothness
    return [...mods].sort((a, b) => {
      const order = (p: string) =>
        p === 'WeaponRecoilKick' ? 0 : p === 'WeaponRecoilSmoothness' ? 1 : 2;
      return order(a.property) - order(b.property);
    });
  }, [mat.qualityModifiers, quality]);

  const railMarkers = useMemo(
    () =>
      bands.map((band, i) => {
        const mappedValue = Number(band.mappedValue ?? 0);
        const left = Math.max(0, Math.min(100, (mappedValue / 1000) * 100));
        const edge = left < 4 ? "start" : left > 96 ? "end" : "middle";

        return {
          index: i,
          mappedValue,
          left,
          edge,
        };
      }),
    [bands],
  );

  const findNearestBandForMappedValue = useCallback(
    (value: number) => {
      return findNearestBandForQuality(bands, value);
    },
    [bands],
  );

  const bandOnePct = Math.max(0, Math.min(100, railMarkers[0]?.left ?? 0));
  const selectedPct = Math.max(0, Math.min(100, (quality / 1000) * 100));
  const fillPct = Math.max(0, selectedPct - bandOnePct);

  if (bands.length === 0) {
    return (
      <div className="craft-material-card craft-matq-card craft-matq-card--unavailable">
        <div className="craft-material-card-head craft-matq-header">
          <div className="craft-material-identity craft-matq-identity">
            <span className="craft-material-slot craft-matq-slot">{mat.slot}</span>
            <span className="craft-material-name craft-matq-name">{mat.material_name}</span>
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
    <span className="craft-material-slot craft-matq-slot">{mat.slot}</span>
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
            min={0}
            max={1000}
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

              return (
              <button
                type="button"
                key={`${marker.index}-${marker.mappedValue}`}
                className={`craft-quality-marker craft-matq-band-marker ${markerTierClass}${marker.index === safeBandIndex ? " is-active" : ""}`}
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
        

            return (
              <div key={i} className="craft-modifier-row craft-matq-mod-chip">
                <div className="craft-modifier-main">
                  <span className="craft-modifier-label craft-matq-mod-prop">
                    {formatProperty(m.property)}
                  </span>

                  <span
                    className={`craft-modifier-value craft-matq-mod-val ${getImpactClass(impact)} ${selectedQualityTierClass}`}
                  >
                    {formatContributionValue(m.value, m.modifierMode)}
                  </span>
                </div>

                
              </div>
            );
          })}
        </div>
      )}
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
  getBandEffectiveQuality: (name: string, idx: number) => number,
  getBandIndex: (key: string) => number,
): TotalModifierRow[] {
  const map = new Map<string, TotalModifierRow>();

  for (const [inputIndex, mat] of recipe.materials.entries()) {
    const modifiers = mat.qualityModifiers ?? [];
    if (modifiers.length === 0) continue;

    const key = getMaterialQualityKey(recipe, mat, inputIndex);
    const quality = getBandEffectiveQuality(getMaterialName(mat), getBandIndex(key));
    const atQuality = getModifiersAtQuality(modifiers, quality);

    for (const m of atQuality) {
      // Group by property + modifierMode so same stat from different slots combine
      const rowKey = `${m.property}||${m.modifierMode ?? ""}`;
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
  let weightedBandTotal = 0;
  let weightTotal = 0;

  for (const [inputIndex, mat] of recipe.materials.entries()) {
    const band = getBandIndex(getMaterialQualityKey(recipe, mat, inputIndex)) + 1;
    const weight = Number.isFinite(mat.quantity) && mat.quantity > 0 ? mat.quantity : 1;
    weightedBandTotal += band * weight;
    weightTotal += weight;
  }

  const averageBand = weightTotal > 0 ? weightedBandTotal / weightTotal : DEFAULT_BAND_INDEX + 1;
  const band = Math.max(1, Math.min(8, Math.round(averageBand)));

  return {
    band,
    averageBand,
    rarity: rarityFromBandIndex(band),
    source: "selectedMaterialBands",
  };
}

function formatContributionValue(value: number, modifierMode?: string): string {
  if (modifierMode === "integerAdditive") {
    const v = Math.round(value);
    return `${v >= 0 ? "+" : ""}${v}`;
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function CraftedItemSummaryPanel({
  recipe,
  displayName,
  totalModifiers,
  overallModifiers,
  overallQualitySource,
  finalProductQuality,
  rewardPools,
  onAddToQueue,
  isQueued,
  isBookmarked,
  onToggleBookmark,
  isMissionBookmarked,
  onToggleMissionBookmark,
  getBandEffectiveQuality,
  getBandsForMaterial,
  materialQualities,
}: {
  recipe: ComponentRecipe;
  displayName: string;
  totalModifiers: TotalModifierRow[];
  overallModifiers: NonNullable<ComponentRecipe["overallQualityModifiers"]>;
  overallQualitySource: number | undefined;
  finalProductQuality: FinalProductQuality;
  rewardPools: RecipeRewardPoolSummary[];
  onAddToQueue: (
    r: ComponentRecipe,
    selectedQualities: Record<string, { quality: number; bandNumber: number; bands: QualityBand[] }>,
    finalProductQuality: FinalProductQuality,
  ) => void;
  isQueued: boolean;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  isMissionBookmarked: (missionId: string) => boolean;
  onToggleMissionBookmark: (missionId: string) => void;
  getBandEffectiveQuality: (materialName: string, bandIndex: number) => number;
  getBandsForMaterial: (materialName: string) => QualityBand[];
  materialQualities: Record<string, number>;
}) {
  const typeBadges = getTypeBadges(recipe);
  const sizeLabel = formatSize(recipe.size);
  const hasMaterialModifiers = totalModifiers.length > 0;
  const hasOverallModifiers = overallModifiers.length > 0;
  const hasAnyModifiers = hasMaterialModifiers || hasOverallModifiers;
  const componentRarityClass = rarityClassFromBandIndex(finalProductQuality.band);
  const displayFinalProductQuality =
    finalProductQuality.averageBand ?? finalProductQuality.band;
  const missionEntries = useMissionRewardEntries(recipe, rewardPools);

  return (
    <div className="craft-summary-panel craft-summary-column">
      {/* Title + metadata chips */}
      <div className="craft-summary-head">
        <div className="craft-summary-title-row">
          <div className="craft-summary-title">{displayName}</div>
          <div className={`craft-summary-quality-pill ${componentRarityClass}`}>
            {formatCompactNumber(displayFinalProductQuality)}
          </div>
        </div>
        <div className="craft-summary-chips">
          {typeBadges.map((b) => (
            <span
              key={b}
              className={`craft-badge craft-badge--type-chip${b === "FPS" ? " craft-badge--fps" : ""}`}
            >
              {b}
            </span>
          ))}
          {sizeLabel && (
            <span className="craft-badge craft-badge--size-chip">{sizeLabel}</span>
          )}
          {recipe.grade && (
            <span className={`craft-badge craft-badge--grade${recipe.grade === "A" ? " craft-badge--grade-a" : ""}`}>
              {recipe.grade}
            </span>
          )}
          {recipe.class && (
            <span className="craft-badge craft-badge--neutral">{recipe.class}</span>
          )}
        </div>
      </div>

      {/* Modifiers total */}
      {hasAnyModifiers && (
        <div className="craft-summary-section">
          {hasMaterialModifiers && (
            <div className="craft-summary-mod-list">
              {totalModifiers.map((row) => {
                const hasBreakdown = row.contributions.length > 0;
                const baseValue = getBaseStatValue(recipe, row.property);

                return (
                  <div key={row.property} className="craft-summary-mod-row">
                    <div className="craft-summary-mod-top">
                      <span className="craft-summary-mod-prop">
                        {formatProperty(row.property)}
                      </span>
                      <span className={`craft-summary-mod-val`}>
                        {formatModifiedStat(baseValue, row.totalValue, row.modifierMode)}
                      </span>
                    </div>
                    {hasBreakdown && (
                      <div className="craft-summary-mod-breakdown">
                        {row.contributions.map((c, i) => (
                          <span key={i} className="craft-summary-mod-contrib">
                            {formatContributionValue(c.value, row.modifierMode)} {c.materialName}
                          </span>
                        ))}
                      </div>
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
        </div>
      )}

      <div className="craft-summary-section craft-summary-mission-section">
        <div className="craft-summary-section-label">Mission Data</div>
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
                <div key={entry.id} className={`craft-mission-source craft-mission-source--${entry.source}`}>
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
                    <div className="craft-mission-source-name">{entry.title}</div>
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

      {/* Where to Find */}
      <div className="craft-summary-section craft-summary-section--grow">
        {rewardPools.length === 0 ? (
          <div className="craft-summary-empty">
            Blueprint source not found in parsed reward data
          </div>
        ) : (
          <div className="craft-blueprint-source-list">
            {rewardPools.map((pool, i) => (
              <div
                key={`${pool.displayName}-${i}`}
                className="craft-blueprint-source"
              >
                <div className="craft-blueprint-source-name">{pool.displayName}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="craft-summary-action-row">
        <button
          type="button"
          className={`craft-summary-action-btn craft-summary-queue-btn${isQueued ? " is-active" : ""}`}
          aria-pressed={isQueued}
          aria-label={isQueued ? `${displayName} is in build queue` : `Add ${displayName} to build queue`}
          onClick={() => {
            const selectedQualities = Object.fromEntries(
              recipe.materials.map((mat, inputIndex) => {
                const key = getMaterialQualityKey(recipe, mat, inputIndex);
                const materialName = getMaterialName(mat);
                const bandIndex = materialQualities[key] ?? DEFAULT_BAND_INDEX;
                return [key, {
                  quality: getBandEffectiveQuality(materialName, bandIndex),
                  bandNumber: bandIndex + 1,
                  bands: getBandsForMaterial(materialName),
                }];
              }),
            );
            onAddToQueue(recipe, selectedQualities, finalProductQuality);
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            {isQueued ? (
              <path d="M20 6 9 17l-5-5" />
            ) : (
              <>
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </>
            )}
          </svg>
          {isQueued ? "Queued" : "Queue"}
        </button>

        <button
          type="button"
          className={`craft-summary-action-btn craft-summary-bookmark-btn${isBookmarked ? " is-active" : ""}`}
          aria-pressed={isBookmarked}
          aria-label={isBookmarked ? `Remove ${displayName} save` : `Save ${displayName}`}
          onClick={onToggleBookmark}
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill={isBookmarked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
          </svg>
          {isBookmarked ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}

function RecipeDrawer({
  recipe,
  groupRecipes = [recipe],
  baseDisplayName,
  onAddToQueue,
  isRecipeQueued,
  isRecipeBookmarked,
  onToggleBookmark,
  isMissionBookmarked,
  onToggleMissionBookmark,
}: {
  recipe: ComponentRecipe;
  groupRecipes?: ComponentRecipe[];
  baseDisplayName: string;
  onAddToQueue: (
    r: ComponentRecipe,
    selectedQualities: Record<string, { quality: number; bandNumber: number; bands: QualityBand[] }>,
    finalProductQuality: FinalProductQuality,
  ) => void;
  isRecipeQueued: (recipe: ComponentRecipe) => boolean;
  isRecipeBookmarked: (recipe: ComponentRecipe) => boolean;
  onToggleBookmark: (recipeId: string) => void;
  isMissionBookmarked: (missionId: string) => boolean;
  onToggleMissionBookmark: (missionId: string) => void;
}) {
  const {
    loading: quantizationLoading,
    getBandsForMaterial,
    getBandEffectiveQuality,
    getBandLabel,
  } = useQualityQuantization();

  const [selectedRecipeId, setSelectedRecipeId] = useState(recipe.blueprint_id);
  const selectedRecipe = groupRecipes.find((item) => item.blueprint_id === selectedRecipeId) ?? recipe;

  useEffect(() => {
    setSelectedRecipeId(recipe.blueprint_id);
  }, [recipe.blueprint_id]);

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
      displayName: asNonEmptyString(pool.displayName) ?? "Unknown Blueprint Source",
      weight: asFiniteNumber(pool.weight),
    }))
    .filter((pool) => pool.displayName.trim().length > 0);

  const displayName = getRecipeDisplayName(selectedRecipe);

  const totalModifiers = useMemo(
    () => computeTotalModifiers(selectedRecipe, getBandEffectiveQuality, getBandIndex),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedRecipe, getBandEffectiveQuality, materialQualities],
  );

  const showVariantSelector = groupRecipes.length > 1;
  const selectedIsQueued = isRecipeQueued(selectedRecipe);
  const selectedIsBookmarked = isRecipeBookmarked(selectedRecipe);

  return (
    <div className="craft-detail-stage">
      <div className="craft-detail-main">
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

        <div className="craft-material-column">
          {quantizationLoading && (
            <div className="craft-empty-card">
              Loading local quality quantization bands...
            </div>
          )}

          <div className="craft-material-list">
            {selectedRecipe.materials.map((mat, inputIndex) => {
              const key = getMaterialQualityKey(selectedRecipe, mat, inputIndex);

              return (
                <MaterialQualityRow
                  key={`${mat.slot}:${key}`}
                  mat={mat}
                  bandIndex={getBandIndex(key)}
                  onBandChange={(bandIndex) =>
                    setMaterialQualities((prev) => ({
                      ...prev,
                      [key]: bandIndex,
                    }))
                  }
                  getBandsForMaterial={getBandsForMaterial}
                  getBandEffectiveQuality={getBandEffectiveQuality}
                  getBandLabel={getBandLabel}
                />
              );
            })}
          </div>
        </div>
      </div>

      <CraftedItemSummaryPanel
        recipe={selectedRecipe}
        displayName={displayName}
        totalModifiers={totalModifiers}
        overallModifiers={overallModifiers}
        overallQualitySource={overallQualitySource}
        finalProductQuality={finalProductQuality}
        rewardPools={rewardPools}
        onAddToQueue={onAddToQueue}
        isQueued={selectedIsQueued}
        isBookmarked={selectedIsBookmarked}
        onToggleBookmark={() => onToggleBookmark(selectedRecipe.blueprint_id)}
        isMissionBookmarked={isMissionBookmarked}
        onToggleMissionBookmark={onToggleMissionBookmark}
        getBandEffectiveQuality={getBandEffectiveQuality}
        getBandsForMaterial={getBandsForMaterial}
        materialQualities={materialQualities}
      />
    </div>
  );
};

interface Props {
  recipes: ComponentRecipe[];
  inventoryEntries?: unknown[];
  materialTemplates?: unknown[];
  onAddToQueue: (
    recipe: ComponentRecipe,
    selectedQualities: Record<string, { quality: number; bandNumber: number; bands: QualityBand[] }>,
    finalProductQuality: FinalProductQuality,
  ) => void;
  isRecipeQueued?: (recipe: ComponentRecipe) => boolean;
}

export default function ComponentRecipeTable({
  recipes,
  onAddToQueue,
  isRecipeQueued = () => false,
}: Props) {
  const initialSidebarState = useMemo(
    () => readStoredSidebarState(RECIPE_FILTER_STORAGE_KEY, EMPTY_RECIPE_SIDEBAR_STATE),
    [],
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
  const shellRef = useRef<HTMLDivElement>(null);
  const [bookmarkedRecipeIds, setBookmarkedRecipeIds] = useState<Set<string>>(
    () => readStoredStringSet(RECIPE_BOOKMARK_STORAGE_KEY),
  );
  const [bookmarkedMissionIds, setBookmarkedMissionIds] = useState<Set<string>>(
    () => readStoredStringSet(MISSION_BOOKMARK_STORAGE_KEY),
  );
  const resetSelection = useCallback(() => setSelectedGroupId(null), []);

  const toggleBookmark = useCallback((recipeId: string) => {
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
  }, []);

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

    if (!selectedGroupId || !groupedRecipes.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(groupedRecipes[0].id);
    }
  }, [groupedRecipes, selectedGroupId]);

  const selectedGroup = groupedRecipes.find((group) => group.id === selectedGroupId) ?? groupedRecipes[0] ?? null;
  const visibleRecipeGroups = groupedRecipes.slice(0, MAX_VISIBLE_RESULTS);
  const hiddenRecipeCount = Math.max(0, groupedRecipes.length - visibleRecipeGroups.length);



  return (
    <div className="craft-page craft-planner-shell" ref={shellRef}>

      {/* ── Filter rail ── */}
      <div className="craft-filter-rail">

        {/* FPS */}
        {fpsOptions.length > 0 && (
          <div className="craft-frl-left">
            <span className="craft-frl-label">FPS</span>
            <div className="craft-frl-chips">
              {fpsOptions.map((opt) => (
                <button key={opt.value} type="button"
                  className={`craft-frl-chip${fpsFilters.has(opt.value) ? " craft-frl-chip--active" : ""}`}
                  onClick={() => { setFpsFilters((prev) => { const n = new Set(prev); n.has(opt.value) ? n.delete(opt.value) : n.add(opt.value); return n; }); resetSelection(); }}
                >{opt.label}</button>
              ))}
            </div>
            <button type="button" className="craft-frl-clear" onClick={resetAll} disabled={!hasActiveFilters}>
              Clear All
            </button>
          </div>
        )}

        {/* Type — explicit 2-per-row so 7 chips = 3 rows, last row gets remainder */}
        {vehicleOptions.length > 0 && (
          <div className="craft-fg craft-fg--type">
            <span className="craft-frl-label">Type</span>
            {[0, 2, 4].map((rowStart) => {
              const rowChips = vehicleOptions.slice(rowStart, rowStart + 2);
              if (rowChips.length === 0) return null;
              return (
                <div key={rowStart} className="craft-frl-chips">
                  {rowChips.map((opt) => {
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
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Category */}
        <div className="craft-fg craft-fg--category">
          <span className="craft-frl-label">Category</span>
          {sizeOptions.length > 0 && (
            <div className="craft-frl-chips">
              {sizeOptions.map((opt) => (
                <button key={opt.value} type="button"
                  className={`craft-frl-chip${sizeFilters.has(opt.value) ? " craft-frl-chip--active" : ""}`}
                  onClick={() => { setSizeFilters((prev) => { const n = new Set(prev); n.has(opt.value) ? n.delete(opt.value) : n.add(opt.value); return n; }); resetSelection(); }}
                >{opt.label}</button>
              ))}
            </div>
          )}
          {gradeOptions.length > 0 && (
            <div className="craft-frl-chips">
              {gradeOptions.map((opt) => (
                <button key={opt.value} type="button"
                  className={`craft-frl-chip${gradeFilters.has(opt.value) ? " craft-frl-chip--active" : ""}`}
                  onClick={() => { setGradeFilters((prev) => { const n = new Set(prev); n.has(opt.value) ? n.delete(opt.value) : n.add(opt.value); return n; }); resetSelection(); }}
                >{opt.label}</button>
              ))}
            </div>
          )}
          {classOptions.length > 0 && (
            <div className="craft-frl-chips">
              {classOptions.map((opt) => (
                <button key={opt.value} type="button"
                  className={`craft-frl-chip${classFilters.has(opt.value) ? " craft-frl-chip--active" : ""}`}
                  onClick={() => { setClassFilters((prev) => { const n = new Set(prev); n.has(opt.value) ? n.delete(opt.value) : n.add(opt.value); return n; }); resetSelection(); }}
                >{opt.label}</button>
              ))}
            </div>
          )}
        </div>

        {/* Ship Mineables — explicit rows of 7 to guarantee max 3 rows */}
        {mineableGroups.shipAndHarvestable.length > 0 && (
          <div className="craft-fg craft-fg--ship">
            <span className="craft-frl-label">Ship Mineables</span>
            {[0, 7, 14].map((rowStart) => {
              const rowChips = mineableGroups.shipAndHarvestable.slice(rowStart, rowStart + 7);
              if (rowChips.length === 0) return null;
              return (
                <div key={rowStart} className="craft-frl-chips">
                  {rowChips.map((chip) => (
                    <button key={chip.id} type="button"
                      className={`craft-frl-chip${resourceFilters.has(chip.id) ? " craft-frl-chip--active" : ""}`}
                      onClick={() => { setResourceFilters((prev) => { const n = new Set(prev); n.has(chip.id) ? n.delete(chip.id) : n.add(chip.id); return n; }); resetSelection(); }}
                    >{chip.label}</button>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Vehicle + Hand — stacked in one column */}
        {(mineableGroups.vehicle.length > 0 || mineableGroups.hand.length > 0) && (
          <div className="craft-fg craft-fg--vh">
            {mineableGroups.vehicle.length > 0 && (
              <>
                <span className="craft-frl-label">Vehicle</span>
                <div className="craft-frl-chips">
                  {mineableGroups.vehicle.map((chip) => (
                    <button key={chip.id} type="button"
                      className={`craft-frl-chip${resourceFilters.has(chip.id) ? " craft-frl-chip--active" : ""}`}
                      onClick={() => { setResourceFilters((prev) => { const n = new Set(prev); n.has(chip.id) ? n.delete(chip.id) : n.add(chip.id); return n; }); resetSelection(); }}
                    >{chip.label}</button>
                  ))}
                </div>
              </>
            )}
            {mineableGroups.hand.length > 0 && (
              <>
                <span className="craft-frl-label">Hand</span>
                <div className="craft-frl-chips">
                  {mineableGroups.hand.map((chip) => (
                    <button key={chip.id} type="button"
                      className={`craft-frl-chip${resourceFilters.has(chip.id) ? " craft-frl-chip--active" : ""}`}
                      onClick={() => { setResourceFilters((prev) => { const n = new Set(prev); n.has(chip.id) ? n.delete(chip.id) : n.add(chip.id); return n; }); resetSelection(); }}
                    >{chip.label}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}


      </div>

      {/* ── Console layout ── */}
      <div className="craft-console-layout">
        <aside className="craft-finder-sidebar">
          <div className="craft-finder-header">
            <span className="craft-finder-kicker">Component Finder</span>
            <h1 className="craft-finder-title">Crafting Planner</h1>
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
            baseDisplayName={selectedGroup.displayName}
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
