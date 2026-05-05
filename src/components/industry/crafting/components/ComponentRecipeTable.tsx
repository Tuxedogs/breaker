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

const PAGE_SIZES = [25, 50, 100] as const;
const NO_VALUE = "__none__";
const DEFAULT_BAND_INDEX = 1;
const QUALITY_QUANTIZATION_URL = "/api/crafting/quality_quantization.json";

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

type QualityBand = {
  start: string | number;
  end: string | number;
  mappedValue: string | number;
};

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

const FALLBACK_QUALITY_BANDS: QualityBand[] = [
  { start: "0", end: "399", mappedValue: "346" },
  { start: "400", end: "599", mappedValue: "500" },
  { start: "600", end: "699", mappedValue: "650" },
  { start: "700", end: "799", mappedValue: "750" },
  { start: "800", end: "899", mappedValue: "850" },
  { start: "900", end: "949", mappedValue: "925" },
  { start: "950", end: "998", mappedValue: "975" },
  { start: "999", end: "1000", mappedValue: "1000" },
];

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

function clampBandIndex(value: number, bands: QualityBand[]): number {
  const max = Math.max(0, bands.length - 1);
  if (!Number.isFinite(value)) return DEFAULT_BAND_INDEX;
  return Math.max(0, Math.min(max, Math.round(value)));
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
      const safeIndex = clampBandIndex(bandIndex, bands);
      return Number(bands[safeIndex]?.mappedValue ?? 500);
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
}: {
  modifiers: NonNullable<ComponentRecipe["overallQualityModifiers"]>;
  quality?: number;
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
                  className={`craft-drawer-modifier-val ${getImpactClass(impact)}`}
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
  const modifiers = mat.qualityModifiers ?? [];
  const materialName = getMaterialName(mat);
  const bands = getBandsForMaterial(materialName);
  const safeBandIndex = clampBandIndex(bandIndex, bands);
  const quality = getBandEffectiveQuality(materialName, safeBandIndex);

  const atQuality = useMemo(
    () => getModifiersAtQuality(modifiers, quality),
    [modifiers, quality],
  );

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
      if (bands.length === 0) return 0;

      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (let i = 0; i < bands.length; i += 1) {
        const mappedValue = Number(bands[i]?.mappedValue ?? 0);
        const distance = Math.abs(mappedValue - value);

        if (distance < nearestDistance) {
          nearestIndex = i;
          nearestDistance = distance;
        }
      }

      return nearestIndex;
    },
    [bands],
  );

  return (
    <div className="craft-matq-card" data-band={safeBandIndex}>
      <div className="craft-matq-header">
        <div className="craft-matq-identity">
          <span className="craft-matq-slot">{mat.slot}</span>
          <span className="craft-matq-name">{mat.material_name}</span>
          <span className="craft-matq-qty">
            Required <strong>x{mat.quantity.toFixed(2)}</strong>
          </span>
        </div>

        <div className="craft-matq-quality-header">
          <span className="craft-matq-quality-label">
            Band {safeBandIndex + 1}
          </span>
          <span className="craft-matq-quality-value">{quality}</span>
        </div>
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

          <div className="craft-matq-rail">
            <div
              className="craft-matq-rail-fill"
              style={{ width: `${Math.max(0, Math.min(100, (quality / 1000) * 100))}%` }}
            />

            {railMarkers.map((marker) => (
              <button
                type="button"
                key={`${marker.index}-${marker.mappedValue}`}
                className={`craft-matq-band-marker${marker.index === safeBandIndex ? " is-active" : ""}`}
                style={{ left: `${marker.left}%` }}
                data-edge={marker.edge}
                onClick={() => onBandChange(marker.index)}
                aria-label={`Use mapped quality ${marker.mappedValue}`}
              >
                <span className="craft-matq-dot" />
                <span className="craft-matq-marker-value">{marker.mappedValue}</span>
              </button>
            ))}
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
                    className={`craft-matq-mod-val ${getImpactClass(impact)}`}
                  >
                    {formatModifierAtQuality(m)}
                    {impactWord ? ` ${impactWord}` : ""}
                  </span>
                </div>

                {directionLabel && (
                  <div className="craft-matq-mod-hint">{directionLabel}</div>
                )}
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
  slot: string;
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

  for (const mat of recipe.materials) {
    const modifiers = mat.qualityModifiers ?? [];
    if (modifiers.length === 0) continue;

    const key = getMaterialQualityKey(recipe, mat);
    const quality = getBandEffectiveQuality(getMaterialName(mat), getBandIndex(key));
    const atQuality = getModifiersAtQuality(modifiers, quality);

    for (const m of atQuality) {
      const rowKey = `${m.slot}||${m.property}`;
      const existing = map.get(rowKey);

      if (!existing) {
        map.set(rowKey, {
          property: m.property,
          slot: m.slot,
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
  rewardPools,
  onAddToQueue,
}: {
  recipe: ComponentRecipe;
  displayName: string;
  totalModifiers: TotalModifierRow[];
  overallModifiers: NonNullable<ComponentRecipe["overallQualityModifiers"]>;
  overallQualitySource: number | undefined;
  rewardPools: { displayName: string }[];
  onAddToQueue: (r: ComponentRecipe) => void;
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
                  <div key={`${row.slot}||${row.property}`} className="craft-summary-mod-row">
                    <div className="craft-summary-mod-top">
                      <span className="craft-badge craft-badge--sm craft-badge--slot craft-summary-mod-slot">
                        {row.slot}
                      </span>
                      <span className="craft-summary-mod-prop">
                        {formatProperty(row.property)}
                      </span>
                      <span className={`craft-summary-mod-val ${impactClass}`}>
                        {formatTotalModifierValue(row)}
                        {impactWord ? ` ${impactWord}` : ""}
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
                modifiers={overallModifiers}
                quality={overallQualitySource}
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

      {/* Add to Build Queue */}
      <button
        type="button"
        className="craft-summary-queue-btn"
        onClick={() => onAddToQueue(recipe)}
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        Add to Build Queue
      </button>
    </div>
  );
}

function RecipeDrawer({
  recipe,
  onAddToQueue,
}: {
  recipe: ComponentRecipe;
  onAddToQueue: (r: ComponentRecipe) => void;
}) {
  const {
    loading: quantizationLoading,
    getBandsForMaterial,
    getBandEffectiveQuality,
    getBandLabel,
  } = useQualityQuantization();

  const [materialQualities, setMaterialQualities] = useState<
    Record<string, number>
  >(() =>
    Object.fromEntries(
      recipe.materials.map((mat) => [
        getMaterialQualityKey(recipe, mat),
        DEFAULT_BAND_INDEX,
      ]),
    ),
  );

  function getBandIndex(key: string): number {
    return materialQualities[key] ?? DEFAULT_BAND_INDEX;
  }

  const overallModifiers = recipe.overallQualityModifiers ?? [];
  const overallQualityMaterial = recipe.materials[2];

  const overallQualitySource = overallQualityMaterial
    ? getBandEffectiveQuality(
        getMaterialName(overallQualityMaterial),
        getBandIndex(getMaterialQualityKey(recipe, overallQualityMaterial)),
      )
    : undefined;

  const rewardPools = (recipe.rewardPools ?? []) as { displayName: string }[];

  const displayName =
    recipe.item_kind === "vehicle"
      ? recipe.component_name
      : getComponentDisplayName(recipe.component_name);

  const totalModifiers = useMemo(
    () => computeTotalModifiers(recipe, getBandEffectiveQuality, getBandIndex),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recipe, getBandEffectiveQuality, materialQualities],
  );

  return (
    <div className="craft-expanded-content">
      <div className="craft-expanded-main">
        <div className="craft-detail-section">
          {quantizationLoading && (
            <div className="craft-empty-card">
              Loading local quality quantization bands...
            </div>
          )}

          <div className="craft-material-list">
            {recipe.materials.map((mat) => {
              const key = getMaterialQualityKey(recipe, mat);

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

      <div className="craft-expanded-sidebar">
        <CraftedItemSummaryPanel
          recipe={recipe}
          displayName={displayName}
          totalModifiers={totalModifiers}
          overallModifiers={overallModifiers}
          overallQualitySource={overallQualitySource}
          rewardPools={rewardPools}
          onAddToQueue={onAddToQueue}
        />
      </div>
    </div>
  );
}

interface FilterPopoverProps {
  label: string;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  onReset: () => void;
}

function FilterPopover({
  label,
  options,
  selected,
  onChange,
  onReset,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const buttonLabel = useMemo(() => {
    if (selected.size === 0) return label;

    const vals = Array.from(selected);

    if (selected.size <= 2 && vals.every((v) => v.length <= 8)) {
      return vals.join(", ");
    }

    return `${selected.size} ${label}`;
  }, [selected, label]);

  function toggle(value: string) {
    const next = new Set(selected);

    if (next.has(value)) next.delete(value);
    else next.add(value);

    onChange(next);
  }

  return (
    <div className="craft-filter-popover-wrap" ref={ref}>
      <button
        type="button"
        className={`craft-filter-btn${selected.size > 0 ? " craft-filter-btn--active" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="craft-filter-btn-icon" aria-hidden>
          {selected.size > 0 ? (
            <svg viewBox="0 0 12 12" width="10" height="10" fill="currentColor">
              <circle cx="6" cy="6" r="4" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 12 12"
              width="10"
              height="10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M1 3h10M3 6h6M5 9h2" strokeLinecap="round" />
            </svg>
          )}
        </span>

        {buttonLabel}

        <svg
          viewBox="0 0 10 6"
          width="8"
          height="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="craft-filter-chevron"
        >
          <path d="M1 1l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="craft-filter-dropdown">
          {options.map(({ value, label: optLabel }) => (
            <label key={value} className="craft-filter-option">
              <input
                type="checkbox"
                checked={selected.has(value)}
                onChange={() => toggle(value)}
                className="craft-filter-checkbox"
              />
              <span>{optLabel}</span>
            </label>
          ))}

          {selected.size > 0 && (
            <button
              type="button"
              className="craft-filter-clear"
              onClick={() => {
                onReset();
                setOpen(false);
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  recipes: ComponentRecipe[];
  onAddToQueue: (recipe: ComponentRecipe) => void;
}

export default function ComponentRecipeTable({ recipes, onAddToQueue }: Props) {
  const [search, setSearch] = useState("");
  const [kindFilters, setKindFilters] = useState<Set<string>>(new Set());
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set());
  const [sizeFilters, setSizeFilters] = useState<Set<string>>(new Set());
  const [gradeFilters, setGradeFilters] = useState<Set<string>>(new Set());
  const [classFilters, setClassFilters] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(50);
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

  function resetAll() {
    setSearch("");
    setKindFilters(new Set());
    setTypeFilters(new Set());
    setSizeFilters(new Set());
    setGradeFilters(new Set());
    setClassFilters(new Set());
    resetPage();
  }

  const hasActiveFilters =
    search ||
    kindFilters.size ||
    typeFilters.size ||
    sizeFilters.size ||
    gradeFilters.size ||
    classFilters.size;

  const kindOptions = useMemo(
    () => [
      { value: "vehicle", label: "Vehicle" },
      { value: "fps", label: "FPS" },
    ],
    [],
  );

  const typeOptions = useMemo(
    () =>
      Array.from(new Set(recipes.map((r) => r.component_type).filter(Boolean)))
        .sort()
        .map((t) => ({ value: t!, label: t! })),
    [recipes],
  );

  const sizeOptions = useMemo(() => {
    const vals = Array.from(new Set(recipes.map((r) => r.size).filter(Boolean)))
      .sort((a, b) => Number(a) - Number(b))
      .map((s) => ({ value: s!, label: `S${s}` }));

    const hasUnsized = recipes.some((r) => !r.size);

    if (hasUnsized) vals.push({ value: NO_VALUE, label: "No Size" });

    return vals;
  }, [recipes]);

  const gradeOptions = useMemo(() => {
    const vals = Array.from(
      new Set(recipes.map((r) => r.grade).filter(Boolean)),
    )
      .sort()
      .map((g) => ({ value: g!, label: g! }));

    const hasNone = recipes.some((r) => !r.grade);

    if (hasNone) vals.push({ value: NO_VALUE, label: "No Grade" });

    return vals;
  }, [recipes]);

  const classOptions = useMemo(
    () =>
      Array.from(new Set(recipes.map((r) => r.class).filter(Boolean)))
        .sort()
        .map((c) => ({ value: c!, label: c! })),
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

        if (kindFilters.size && !kindFilters.has(r.item_kind ?? ""))
          return false;
        if (typeFilters.size && !typeFilters.has(r.component_type ?? ""))
          return false;

        if (sizeFilters.size) {
          const sv = r.size ? r.size : NO_VALUE;
          if (!sizeFilters.has(sv)) return false;
        }

        if (gradeFilters.size) {
          const gv = r.grade ? r.grade : NO_VALUE;
          if (!gradeFilters.has(gv)) return false;
        }

        if (classFilters.size && !classFilters.has(r.class ?? "")) return false;

        return true;
      })
      .sort((a, b) => {
        const aName =
          a.item_kind === "vehicle"
            ? a.component_name
            : getComponentDisplayName(a.component_name);

        const bName =
          b.item_kind === "vehicle"
            ? b.component_name
            : getComponentDisplayName(b.component_name);

        const nd = aName.localeCompare(bName);

        return nd !== 0 ? nd : (a.size || "").localeCompare(b.size || "");
      });
  }, [
    recipes,
    search,
    kindFilters,
    typeFilters,
    sizeFilters,
    gradeFilters,
    classFilters,
    recipeSearchTexts,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const startIdx = currentPage * pageSize;
  const endIdx = Math.min(startIdx + pageSize, filtered.length);
  const paginated = filtered.slice(startIdx, endIdx);
  const startItem = filtered.length === 0 ? 0 : startIdx + 1;

  return (
    <div className="craft-section">
      <div className="craft-recipe-header">
        <div className="craft-recipe-header-left">
          <h2 className="craft-recipe-title">Component Recipes</h2>
          <p className="craft-recipe-subtitle">
            Browse craftable gear, components, and blueprint sources.
          </p>
        </div>

        <span className="craft-count craft-recipe-count">
          {filtered.length} / {recipes.length} shown
        </span>
      </div>

      <div className="craft-filter-bar">
        <div className="craft-search-wrap">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="craft-search-icon"
            width="14"
            height="14"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>

          <input
            type="search"
            className="craft-search-input"
            placeholder="Search name, type, blueprint ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
          />
        </div>

        <FilterPopover
          label="All Gear"
          options={kindOptions}
          selected={kindFilters}
          onChange={(s) => {
            setKindFilters(s);
            resetPage();
          }}
          onReset={() => {
            setKindFilters(new Set());
            resetPage();
          }}
        />

        <FilterPopover
          label="All Types"
          options={typeOptions}
          selected={typeFilters}
          onChange={(s) => {
            setTypeFilters(s);
            resetPage();
          }}
          onReset={() => {
            setTypeFilters(new Set());
            resetPage();
          }}
        />

        <FilterPopover
          label="All Sizes"
          options={sizeOptions}
          selected={sizeFilters}
          onChange={(s) => {
            setSizeFilters(s);
            resetPage();
          }}
          onReset={() => {
            setSizeFilters(new Set());
            resetPage();
          }}
        />

        <FilterPopover
          label="All Grades"
          options={gradeOptions}
          selected={gradeFilters}
          onChange={(s) => {
            setGradeFilters(s);
            resetPage();
          }}
          onReset={() => {
            setGradeFilters(new Set());
            resetPage();
          }}
        />

        <FilterPopover
          label="All Classes"
          options={classOptions}
          selected={classFilters}
          onChange={(s) => {
            setClassFilters(s);
            resetPage();
          }}
          onReset={() => {
            setClassFilters(new Set());
            resetPage();
          }}
        />

        {hasActiveFilters && (
          <button
            type="button"
            className="craft-filter-reset"
            onClick={resetAll}
          >
            <svg
              viewBox="0 0 14 14"
              width="11"
              height="11"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M2 7a5 5 0 1 0 1-3" />
              <path d="M2 4V2h2" />
            </svg>
            Reset
          </button>
        )}
      </div>

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
            {paginated.map((recipe) => {
              const isOpen = expanded === recipe.blueprint_id;

              const displayName =
                recipe.item_kind === "vehicle"
                  ? recipe.component_name
                  : getComponentDisplayName(recipe.component_name);

              const subtitle = getSubtitle(recipe);
              const typeBadges = getTypeBadges(recipe);
              const sizeLabel = formatSize(recipe.size);
              const grade = recipe.grade ?? null;
              const cls = recipe.class ?? null;

              return (
                <Fragment key={recipe.blueprint_id}>
                  <tr
                    ref={isOpen ? expandedRowRef : undefined}
                    className={`craft-table-row${isOpen ? " craft-table-row--open" : ""}`}
                    onClick={() => setExpanded(isOpen ? null : recipe.blueprint_id)}
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

                          {subtitle && (
                            <span className="craft-name-sub">{subtitle}</span>
                          )}
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
                          onAddToQueue={onAddToQueue}
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
          {filtered.length > 0
            ? `Showing ${startItem}–${endIdx} of ${filtered.length}`
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

        <div className="craft-pagination-size">
          <span className="craft-muted craft-pagination-size-label">
            Per page:
          </span>

          <select
            className="craft-select craft-select--compact"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              resetPage();
            }}
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
