import {
  useState,
  useMemo,
  Fragment,
  useRef,
  useEffect,
  useCallback,
} from "react";
import type { ComponentRecipe } from "../utils/craftingTypes";
import { getComponentDisplayName } from "../utils/componentDisplayNames";
import {
  getModifiersAtQuality,
  summariseUnmatchedModifiers,
  formatProperty,
  formatModifierAtQuality,
} from "../utils/qualityModifiers";
import { getMaterialQualityKey } from "../utils/materialQuality";
import {
  getDirectionLabel,
  getModifierImpact,
} from "@/lib/gameplay/propertyUtils";
import {
  DEFAULT_BAND_INDEX,
  FALLBACK_QUALITY_BANDS,
  clampBandIndex,
  findNearestBandForQuality,
  getBandEffectiveQuality as getEffectiveQualityFromBands,
  rarityClassFromBandIndex,
  type QualityBand,
} from "../utils/qualityBands";
import { MsbChip, MsbSection, MsbSidebar, ResourcesSection } from "../../shared/MsbSidebar";
import { buildResourceGroups } from "../../shared/msbResourceGroups";
import type { InventoryEntry, MaterialTemplate } from "../../../../types/logistics";


const NO_VALUE = "__none__";
const QUALITY_QUANTIZATION_URL = "/api/crafting/quality_quantization.json";
const RECIPE_FILTER_STORAGE_KEY = "scintel:recipe:msb-sidebar:v1";
const RECIPE_BOOKMARK_STORAGE_KEY = "scintel:recipe:bookmarks:v1";

type RecipeSidebarState = {
  search: string;
  fps: string[];
  vehicles: string[];
  sizes: string[];
  grades: string[];
  classes: string[];
  resources: string[];
};

const EMPTY_RECIPE_SIDEBAR_STATE: RecipeSidebarState = {
  search: "",
  fps: [],
  vehicles: [],
  sizes: [],
  grades: [],
  classes: [],
  resources: [],
};

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

function getImpactWord(impact: "good" | "bad" | "neutral"): string {
  if (impact === "good") return "better";
  if (impact === "bad") return "worse";
  return "";
}

type MaterialQuantization = {
  name?: string;
  recordName?: string;
  recordType?: string;
  displayName?: string;
  materialKey?: string;
  guid?: string;
  path?: string;
  bands: QualityBand[];
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

type RequirementInventorySummary = {
  ownedQuantity: number;
  shortfall: number;
  qualities: number[];
  unitLabel: string;
};

function getRequirementUnitLabel(
  mat: ComponentRecipe["materials"][number],
  material?: MaterialTemplate,
  entries: InventoryEntry[] = [],
): string {
  if (entries.some((entry) => entry.unitType === "scu")) return "SCU";
  if (entries.some((entry) => entry.unitType === "unit")) return "units";
  if (material?.materialType === "ore" || material?.materialType === "refined") return "SCU";
  return mat.cost_type?.toLowerCase().includes("scu") ? "SCU" : "units";
}

function getRequirementInventorySummary(
  mat: ComponentRecipe["materials"][number],
  inventoryEntries: InventoryEntry[] = [],
  materialTemplates: MaterialTemplate[] = [],
): RequirementInventorySummary | undefined {
  if (!inventoryEntries.length) return undefined;

  const materialName = getMaterialName(mat);
  const nameKey = normalizeMaterialLookup(materialName);
  const costIdKey = normalizeMaterialLookup(mat.cost_id);
  const material = materialTemplates.find((item) => {
    return (
      normalizeMaterialLookup(item.id) === costIdKey ||
      normalizeMaterialLookup(item.name) === nameKey
    );
  });
  const materialIdKey = normalizeMaterialLookup(material?.id);
  const materialTemplateNameKey = normalizeMaterialLookup(material?.name);

  const matchingEntries = inventoryEntries.filter((entry) => {
    const entryMaterialId = normalizeMaterialLookup(entry.materialId);
    const entryCatalogId = normalizeMaterialLookup(entry.catalogItemId);
    const entryMaterialName = normalizeMaterialLookup(entry.materialName);
    const entryItemName = normalizeMaterialLookup(entry.itemName);

    return (
      (!!costIdKey && (entryMaterialId === costIdKey || entryCatalogId === costIdKey)) ||
      (!!materialIdKey && (entryMaterialId === materialIdKey || entryCatalogId === materialIdKey)) ||
      (!!nameKey && (entryMaterialName === nameKey || entryItemName === nameKey)) ||
      (!!materialTemplateNameKey &&
        (entryMaterialName === materialTemplateNameKey || entryItemName === materialTemplateNameKey))
    );
  });

  if (!matchingEntries.length) {
    return {
      ownedQuantity: 0,
      shortfall: Math.max(0, mat.quantity),
      qualities: [],
      unitLabel: getRequirementUnitLabel(mat, material),
    };
  }

  const ownedQuantity = matchingEntries.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
  const qualities = [...new Set(
    matchingEntries
      .map((entry) => entry.quality)
      .filter((quality): quality is number => typeof quality === "number"),
  )].sort((a, b) => b - a);

  return {
    ownedQuantity,
    shortfall: Math.max(0, mat.quantity - ownedQuantity),
    qualities,
    unitLabel: getRequirementUnitLabel(mat, material, matchingEntries),
  };
}

function useQualityQuantization() {
  const [data, setData] = useState<MaterialQuantization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(QUALITY_QUANTIZATION_URL);

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
      return (
        getMaterialQuantization(materialName)?.bands ?? FALLBACK_QUALITY_BANDS
      );
    },
    [getMaterialQuantization],
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

      return band ? `${band.start}–${band.end}` : "Base 500";
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
  modifiers,
  quality,
  rarityClass,
}: {
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
            const impact = getModifierImpact(m.property, m.value);
            const impactWord = getImpactWord(impact);

            return (
              <div key={i} className="craft-drawer-modifier-row">
                <span className="craft-badge craft-badge--sm craft-badge--slot craft-drawer-modifier-slot">
                  {m.slot}
                </span>

                <span className="craft-drawer-modifier-prop">
                  {formatProperty(m.property)}
                </span>

                <span
                  className={`craft-drawer-modifier-val ${getImpactClass(impact)} ${rarityClass}`}
                >
                  {formatModifierAtQuality(m)}
                  {impactWord ? ` ${impactWord}` : ""}
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
  inventorySummary,
  onBandChange,
  getBandsForMaterial,
  getBandEffectiveQuality,
}: {
  mat: ComponentRecipe["materials"][number];
  bandIndex: number;
  inventorySummary?: RequirementInventorySummary;
  onBandChange: (bandIndex: number) => void;
  getBandsForMaterial: (materialName: string) => QualityBand[];
  getBandEffectiveQuality: (materialName: string, bandIndex: number) => number;
  getBandLabel: (materialName: string, bandIndex: number) => string;
}) {
  const modifiers = mat.qualityModifiers ?? [];
  const materialName = getMaterialName(mat);
  const bands = getBandsForMaterial(materialName);
  const safeBandIndex = clampBandIndex(bandIndex, bands);
  const bandNumber = safeBandIndex + 1;
  const quality = getBandEffectiveQuality(materialName, safeBandIndex);
  const selectedQualityTierClass = rarityClassFromBandIndex(bandNumber);

  const atQuality = useMemo(() => {
    const mods = getModifiersAtQuality(modifiers, quality);
    // Weapon Recoil Kick must appear directly above Weapon Recoil Smoothness
    return [...mods].sort((a, b) => {
      const order = (p: string) =>
        p === 'WeaponRecoilKick' ? 0 : p === 'WeaponRecoilSmoothness' ? 1 : 2;
      return order(a.property) - order(b.property);
    });
  }, [modifiers, quality]);

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

  return (
    <div className="craft-matq-card" data-band={safeBandIndex}>
      <div className="craft-matq-header">
        <div className="craft-matq-identity">
          <span className="craft-matq-slot">{mat.slot}</span>
          <span className="craft-matq-name">{mat.material_name}</span>
        </div>

        <div className="craft-matq-quality-header">
          <span className="craft-matq-quality-label">
            Band {safeBandIndex + 1}
          </span>
          <span className={`craft-matq-quality-value ${selectedQualityTierClass}`}>{quality}</span>
        </div>

        {inventorySummary && inventorySummary.qualities.length > 1 && (
          <div className="craft-quality-badges" aria-label={`Owned qualities for ${mat.material_name}`}>
            {inventorySummary.qualities.slice(0, 5).map((ownedQuality) => (
              <span key={ownedQuality} className="craft-quality-badge">
                Q{ownedQuality}
              </span>
            ))}
            {inventorySummary.qualities.length > 5 && (
              <span className="craft-quality-badge craft-quality-badge--more">
                +{inventorySummary.qualities.length - 5}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="craft-matq-slider-wrap">
        <div className="craft-matq-rail-wrap">
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
            className="craft-matq-slider"
            aria-label={`Quality band for ${mat.material_name}`}
          />

<div
  className={`craft-matq-rail ${selectedQualityTierClass}`}
  style={
    {
      "--band-one-pct": `${bandOnePct}%`,
    } as React.CSSProperties
  }
>
  <div
    className={`craft-matq-rail-fill ${selectedQualityTierClass}`}
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
                className={`craft-matq-band-marker ${markerTierClass}${marker.index === safeBandIndex ? " is-active" : ""}`}
                style={{ left: `${marker.left}%` }}
                data-edge={marker.edge}
                onClick={() => onBandChange(marker.index)}
                aria-label={`Use mapped quality ${marker.mappedValue}`}
              >
                {marker.index === safeBandIndex ? (
                  <span className="craft-matq-dot" />
                ) : (
                  marker.mappedValue > quality && <span className="craft-matq-threshold-dot" />
                )}
                <span className={`craft-matq-marker-value ${markerTierClass}`}>{marker.mappedValue}</span>
              </button>
              );
            })}
          </div>
        </div>
      </div>

      {atQuality.length > 0 && (
        <div className="craft-matq-mods">
          {atQuality.map((m, i) => {
            const impact = getModifierImpact(m.property, m.value);
            const impactWord = getImpactWord(impact);
            const directionLabel = getDirectionLabel(m.property);

            return (
              <div key={i} className="craft-matq-mod-card">
                <div className="craft-matq-mod-top">
                  <span className="craft-matq-mod-prop">
                    {formatProperty(m.property)}
                  </span>

                  <span
                    className={`craft-matq-mod-val ${getImpactClass(impact)} ${selectedQualityTierClass}`}
                  >
                    {formatModifierAtQuality(m)}
                    {impactWord ? ` ${impactWord}` : ""}
                  </span>

                  {directionLabel && (
                    <span className="craft-matq-mod-hint">{directionLabel}</span>
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

interface TotalModifierRow {
  property: string;
  totalValue: number;
  modifierMode?: string;
  contributions: { materialName: string; value: number }[];
}

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

function formatTotalModifierValue(row: TotalModifierRow): string {
  if (row.modifierMode === "integerAdditive") {
    const v = Math.round(row.totalValue);
    const suffix =
      row.property === "GPP_ItemResource_PowerGeneration"
        ? ` ${Math.abs(v) === 1 ? "power pip" : "power pips"}`
        : "";
    return `${v >= 0 ? "+" : ""}${v}${suffix}`;
  }
  return `${row.totalValue >= 0 ? "+" : ""}${row.totalValue.toFixed(1)}%`;
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
  componentRarityClass,
  rewardPools,
  onAddToQueue,
  isQueued,
  isBookmarked,
  onToggleBookmark,
  getBandEffectiveQuality,
  getBandsForMaterial,
  materialQualities,
}: {
  recipe: ComponentRecipe;
  displayName: string;
  totalModifiers: TotalModifierRow[];
  overallModifiers: NonNullable<ComponentRecipe["overallQualityModifiers"]>;
  overallQualitySource: number | undefined;
  componentRarityClass: string;
  rewardPools: { displayName: string }[];
  onAddToQueue: (r: ComponentRecipe, selectedQualities: Record<string, { quality: number; bandNumber: number; bands: QualityBand[] }>) => void;
  isQueued: boolean;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  getBandEffectiveQuality: (materialName: string, bandIndex: number) => number;
  getBandsForMaterial: (materialName: string) => QualityBand[];
  materialQualities: Record<string, number>;
}) {
  const typeBadges = getTypeBadges(recipe);
  const sizeLabel = formatSize(recipe.size);
  const hasMaterialModifiers = totalModifiers.length > 0;
  const hasOverallModifiers = overallModifiers.length > 0;
  const hasAnyModifiers = hasMaterialModifiers || hasOverallModifiers;

  return (
    <div className="craft-summary-panel">
      {/* Title + metadata chips */}
      <div className="craft-summary-head">
        <div className="craft-summary-title">{displayName}</div>
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
          <div className="craft-summary-section-label">Modifiers Total</div>

          {hasMaterialModifiers && (
            <div className="craft-summary-mod-list">
              {totalModifiers.map((row) => {
                const impact = getModifierImpact(row.property, row.totalValue);
                const impactWord = getImpactWord(impact);
                const impactClass = getImpactClass(impact);
                const hasBreakdown = row.contributions.length > 1;

                return (
                  <div key={row.property} className="craft-summary-mod-row">
                    <div className="craft-summary-mod-top">
                      <span className="craft-summary-mod-prop">
                        {formatProperty(row.property)}
                      </span>
                      <span className={`craft-summary-mod-val ${impactClass} ${componentRarityClass}`}>
                        {formatTotalModifierValue(row)}
                        {impactWord ? ` ${impactWord}` : ""}
                      </span>
                    </div>
                    {hasBreakdown && (
                      <div className="craft-summary-mod-breakdown">
                        {"("}
                        {row.contributions.map((c, i) => (
                          <span key={i} className="craft-summary-mod-contrib">
                            {i > 0 && " + "}
                            {formatContributionValue(c.value, row.modifierMode)} from {c.materialName}
                          </span>
                        ))}
                        {")"}
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
                modifiers={overallModifiers}
                quality={overallQualitySource}
                rarityClass={componentRarityClass}
              />
            </div>
          )}
        </div>
      )}

      {/* Where to Find */}
      <div className="craft-summary-section craft-summary-section--grow">
        {rewardPools.length === 0 ? (
          <div className="craft-summary-empty">
            Blueprint source not found in parsed reward data
          </div>
        ) : (
          <div className="craft-drawer-sources">
            {rewardPools.map((pool, i) => (
              <div
                key={`${pool.displayName}-${i}`}
                className="craft-drawer-source-item"
              >
                <div className="craft-drawer-source-tag">Blueprint Source</div>
                <div className="craft-drawer-source-name">{pool.displayName}</div>
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
            onAddToQueue(recipe, selectedQualities);
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
          {isQueued ? "In Build Queue" : "Add to Build Queue"}
        </button>

        <button
          type="button"
          className={`craft-summary-action-btn craft-summary-bookmark-btn${isBookmarked ? " is-active" : ""}`}
          aria-pressed={isBookmarked}
          aria-label={isBookmarked ? `Remove ${displayName} bookmark` : `Bookmark ${displayName}`}
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
          {isBookmarked ? "Bookmarked" : "Bookmark"}
        </button>
      </div>
    </div>
  );
}

function RecipeDrawer({
  recipe,
  groupRecipes = [recipe],
  baseDisplayName,
  inventoryEntries,
  materialTemplates,
  onAddToQueue,
  isRecipeQueued,
  isRecipeBookmarked,
  onToggleBookmark,
}: {
  recipe: ComponentRecipe;
  groupRecipes?: ComponentRecipe[];
  baseDisplayName: string;
  inventoryEntries?: InventoryEntry[];
  materialTemplates?: MaterialTemplate[];
  onAddToQueue: (r: ComponentRecipe, selectedQualities: Record<string, { quality: number; bandNumber: number; bands: QualityBand[] }>) => void;
  isRecipeQueued: (recipe: ComponentRecipe) => boolean;
  isRecipeBookmarked: (recipe: ComponentRecipe) => boolean;
  onToggleBookmark: (recipeId: string) => void;
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
  const overallQualityMaterial = selectedRecipe.materials[2];

  const overallQualitySource = overallQualityMaterial
    ? getBandEffectiveQuality(
        getMaterialName(overallQualityMaterial),
        getBandIndex(getMaterialQualityKey(selectedRecipe, overallQualityMaterial, 2)),
      )
    : undefined;
  const componentBandIndex = overallQualityMaterial
    ? getBandIndex(getMaterialQualityKey(selectedRecipe, overallQualityMaterial, 2))
    : Math.max(DEFAULT_BAND_INDEX, ...Object.values(materialQualities));
  const componentRarityClass = rarityClassFromBandIndex(componentBandIndex + 1);

  const rewardPools = (selectedRecipe.rewardPools ?? []) as { displayName: string }[];

  const displayName = getRecipeDisplayName(selectedRecipe);

  const totalModifiers = useMemo(
    () => computeTotalModifiers(selectedRecipe, getBandEffectiveQuality, getBandIndex),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedRecipe, getBandEffectiveQuality, materialQualities],
  );

  const inventorySummaryByKey = useMemo(() => {
    const map = new Map<string, RequirementInventorySummary | undefined>();
    selectedRecipe.materials.forEach((mat, inputIndex) => {
      map.set(
        getMaterialQualityKey(selectedRecipe, mat, inputIndex),
        getRequirementInventorySummary(mat, inventoryEntries, materialTemplates),
      );
    });
    return map;
  }, [inventoryEntries, materialTemplates, selectedRecipe]);

  const showVariantSelector = groupRecipes.length > 1;
  const selectedIsQueued = isRecipeQueued(selectedRecipe);
  const selectedIsBookmarked = isRecipeBookmarked(selectedRecipe);

  return (
    <div className="craft-expanded-content">
      <div className="craft-expanded-main">
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

        <div className="craft-detail-section">
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
                  inventorySummary={inventorySummaryByKey.get(key)}
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

      <div className="craft-expanded-sidebar">
        <CraftedItemSummaryPanel
          recipe={selectedRecipe}
          displayName={displayName}
          totalModifiers={totalModifiers}
          overallModifiers={overallModifiers}
          overallQualitySource={overallQualitySource}
          componentRarityClass={componentRarityClass}
          rewardPools={rewardPools}
          onAddToQueue={onAddToQueue}
          isQueued={selectedIsQueued}
          isBookmarked={selectedIsBookmarked}
          onToggleBookmark={() => onToggleBookmark(selectedRecipe.blueprint_id)}
          getBandEffectiveQuality={getBandEffectiveQuality}
          getBandsForMaterial={getBandsForMaterial}
          materialQualities={materialQualities}
        />
      </div>
    </div>
  );
};

interface Props {
  recipes: ComponentRecipe[];
  inventoryEntries?: InventoryEntry[];
  materialTemplates?: MaterialTemplate[];
  onAddToQueue: (recipe: ComponentRecipe, selectedQualities: Record<string, { quality: number; bandNumber: number; bands: QualityBand[] }>) => void;
  isRecipeQueued?: (recipe: ComponentRecipe) => boolean;
}

export default function ComponentRecipeTable({
  recipes,
  inventoryEntries = [],
  materialTemplates = [],
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bookmarkedRecipeIds, setBookmarkedRecipeIds] = useState<Set<string>>(
    () => readStoredStringSet(RECIPE_BOOKMARK_STORAGE_KEY),
  );
  const [pageSize] = useState<number>(14);
  const [page, setPage] = useState(0);
  const expandedRowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const el = expandedRowRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [expanded]);

  const resetPage = useCallback(() => setPage(0), []);

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

  function resetAll() {
    setSearch("");
    setFpsFilters(new Set());
    setVehicleFilters(new Set());
    setSizeFilters(new Set());
    setGradeFilters(new Set());
    setClassFilters(new Set());
    setResourceFilters(new Set());
    resetPage();
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
    });
  }, [classFilters, fpsFilters, gradeFilters, resourceFilters, search, sizeFilters, vehicleFilters]);

  const fpsOptions = useMemo(
    () =>
      Array.from(new Set(recipes.filter((r) => r.item_kind === "fps").map((r) => r.component_type).filter(Boolean)))
        .sort()
        .map((t) => ({ value: t!, label: t! })),
    [recipes],
  );

  const vehicleOptions = useMemo(
    () =>
      Array.from(new Set(recipes.filter((r) => r.item_kind !== "fps").map((r) => r.component_type).filter(Boolean)))
        .filter((t) => t !== "salvage" && t !== "tractorbeam")
        .sort()
        .map((t) => ({ value: t!, label: t! })),
    [recipes],
  );

  const sizeOptions = useMemo(() => {
    const vals = Array.from(new Set(recipes.map((r) => r.size).filter(Boolean)))
      .sort((a, b) => Number(a) - Number(b))
      .map((s) => ({ value: s!, label: `S${s}` }));

    return vals;
  }, [recipes]);

  const classOptions = useMemo(
    () =>
      Array.from(new Set(recipes.map((r) => r.class).filter(Boolean)))
        .sort()
        .map((c) => ({ value: c!, label: c! })),
    [recipes],
  );

  const resourceGroups = useMemo(() => {
    const resources = recipes.flatMap((recipe) =>
      (recipe.materials ?? []).map((material) => ({
        id: material.cost_id || material.material_name,
        label: material.material_name,
        miningType: material.cost_type,
      })),
    ).filter((r) => r.label !== "Insulative Liner Material");
    return buildResourceGroups(resources);
  }, [recipes]);

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
        if (vehicleFilters.size && (r.item_kind === "fps" || !vehicleFilters.has(r.component_type ?? ""))) return false;

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

  const totalPages = Math.max(1, Math.ceil(groupedRecipes.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const startIdx = currentPage * pageSize;
  const endIdx = Math.min(startIdx + pageSize, groupedRecipes.length);
  const paginated = groupedRecipes.slice(startIdx, endIdx);
  const startItem = groupedRecipes.length === 0 ? 0 : startIdx + 1;

  return (
    <div className="craft-recipe-browser-layout">
      <MsbSidebar title="Recipe Filters" onClear={resetAll}>
        <MsbSection label="Search" onClear={hasActiveFilters ? resetAll : undefined} raw>
          <input
            type="search"
            className="msb-search-input"
            placeholder="Search recipes..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
          />
        </MsbSection>

        <MsbSection label="FPS">
          {fpsOptions.map((filter) => (
            <MsbChip
              key={filter.value}
              label={filter.label}
              active={fpsFilters.has(filter.value)}
              onClick={() => {
                setFpsFilters((prev) => {
                  const next = new Set(prev);
                  if (next.has(filter.value)) next.delete(filter.value);
                  else next.add(filter.value);
                  return next;
                });
                resetPage();
              }}
            />
          ))}
        </MsbSection>

        <MsbSection label="Vehicles">
          {vehicleOptions.map((filter) => (
            <MsbChip
              key={filter.value}
              label={filter.label}
              active={vehicleFilters.has(filter.value)}
              onClick={() => {
                setVehicleFilters((prev) => {
                  const next = new Set(prev);
                  if (next.has(filter.value)) next.delete(filter.value);
                  else next.add(filter.value);
                  return next;
                });
                resetPage();
              }}
            />
          ))}
        </MsbSection>

        <MsbSection label="Size">
          {sizeOptions.map((filter) => (
            <MsbChip key={filter.value} label={filter.label} active={sizeFilters.has(filter.value)} onClick={() => {
              setSizeFilters((prev) => {
                const next = new Set(prev);
                if (next.has(filter.value)) next.delete(filter.value);
                else next.add(filter.value);
                return next;
              });
              resetPage();
            }} />
          ))}
        </MsbSection>

        <MsbSection label="Class">
          {classOptions.map((filter) => (
            <MsbChip key={filter.value} label={filter.label} active={classFilters.has(filter.value)} onClick={() => {
              setClassFilters((prev) => {
                const next = new Set(prev);
                if (next.has(filter.value)) next.delete(filter.value);
                else next.add(filter.value);
                return next;
              });
              resetPage();
            }} />
          ))}
        </MsbSection>

        <ResourcesSection
          groups={resourceGroups}
          selectedIds={resourceFilters}
          onToggle={(id) => {
            setResourceFilters((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
            resetPage();
          }}
        />
      </MsbSidebar>

      <div className="craft-section craft-recipe-results">


      {hasActiveFilters && <div className="craft-recipe-filter-note"></div>}

      <div className="craft-table-wrap">
        <table className="craft-table">
          <thead>
            <tr>
              <th className="craft-th-name">Name</th>
              <th>Type</th>
              <th>Size</th>
              <th>Grade</th>
              <th>Class</th>
              <th className="craft-th-action"></th>
            </tr>
          </thead>

          <tbody>
            {paginated.map((group) => {
              const recipe = group.recipes[0];
              const isOpen = expanded === group.id;
              const variantCount = group.recipes.length;
              const hasVariants = variantCount > 1;
              const displayName = group.displayName;

              const subtitle = getSubtitle(recipe);
              const typeBadges = getTypeBadges(recipe);
              const sizeLabel = getSharedValue(group.recipes, (item) => formatSize(item.size));
              const grade = getSharedValue(group.recipes, (item) => item.grade ?? null);
              const cls = getSharedValue(group.recipes, (item) => item.class ?? null);

              return (
                <Fragment key={group.id}>
                  <tr
                    ref={isOpen ? expandedRowRef : undefined}
                    className={`craft-table-row${isOpen ? " craft-table-row--open" : ""}`}
                    onClick={() => setExpanded(isOpen ? null : group.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td className="craft-cell-name">
                      <div className="craft-name-wrap">
                        <div className="craft-thumb" aria-hidden>
                          <svg
                            viewBox="0 0 28 28"
                            width="20"
                            height="20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            opacity="0.3"
                          >
                            <rect x="4" y="4" width="20" height="20" rx="2" />
                            <path d="M9 14h10M14 9v10" strokeLinecap="round" />
                          </svg>
                        </div>

                        <div className="craft-name-info">
                          <span
                            className="craft-name-primary"
                            title={recipe.component_name}
                          >
                            {displayName}
                          </span>

                          <span className="craft-name-sub">
                            {subtitle}
                            {hasVariants && (
                              <span className="craft-variant-count">
                                {variantCount} variants
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="craft-cell-type">
                      <div className="craft-badge-row">
                        {typeBadges.map((b) => (
                          <span
                            key={b}
                            className={`craft-badge craft-badge--type-chip${
                              b === "FPS" ? " craft-badge--fps" : ""
                            }`}
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="craft-cell-size">
                      {sizeLabel ? (
                        <span className="craft-badge craft-badge--size-chip">
                          {sizeLabel}
                        </span>
                      ) : (
                        <span className="craft-dash">—</span>
                      )}
                    </td>

                    <td className="craft-cell-grade">
                      {grade ? (
                        <span
                          className={`craft-badge craft-badge--grade${
                            grade === "A" ? " craft-badge--grade-a" : ""
                          }`}
                        >
                          {grade}
                        </span>
                      ) : (
                        <span className="craft-dash">—</span>
                      )}
                    </td>

                    <td className="craft-cell-class">
                      {cls ? (
                        <span className="craft-cell-subdued">{cls}</span>
                      ) : (
                        <span className="craft-dash">—</span>
                      )}
                    </td>

                    <td className="craft-cell-action">
                      <span
                        className={`craft-btn-chevron${isOpen ? " craft-btn-chevron--open" : ""}`}
                        aria-hidden
                      >
                        <svg
                          viewBox="0 0 10 6"
                          width="10"
                          height="6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M1 1l4 4 4-4" />
                        </svg>
                      </span>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr className="craft-detail-row">
                      <td colSpan={6}>
                        <RecipeDrawer
                          recipe={recipe}
                          groupRecipes={group.recipes}
                          baseDisplayName={displayName}
                          inventoryEntries={inventoryEntries}
                          materialTemplates={materialTemplates}
                          onAddToQueue={onAddToQueue}
                          isRecipeQueued={isRecipeQueued}
                          isRecipeBookmarked={(item) => bookmarkedRecipeIds.has(item.blueprint_id)}
                          onToggleBookmark={toggleBookmark}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}

            {paginated.length === 0 && (
              <tr>
                <td colSpan={6} className="craft-empty">
                  No recipes match filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="craft-pagination">
        <div className="craft-pagination-info">
          {groupedRecipes.length > 0
            ? `Showing ${startItem}–${endIdx} of ${groupedRecipes.length}`
            : "No results"}
        </div>

        <div className="craft-pagination-controls">
          <button
            type="button"
            className="craft-page-btn"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Prev
          </button>

          <span className="craft-page-indicator">
            {currentPage + 1} / {totalPages}
          </span>

          <button
            type="button"
            className="craft-page-btn"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </button>
        </div>

        
      </div>
    </div>
    </div>
  );
}
