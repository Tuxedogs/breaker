import { useState, useMemo, Fragment } from "react";
import type { ComponentRecipe, BlueprintReward } from "../utils/craftingTypes";
import { getComponentDisplayName } from "../utils/componentDisplayNames";
import {
  getModifiersAtQuality,
  summariseUnmatchedModifiers,
  formatProperty,
} from "../utils/qualityModifiers";
import {
  getMaterialQualityKey,
  getDefaultMaterialQualities,
  updateMaterialQuality,
  type RecipeMaterialQualityState,
} from "../utils/materialQuality";
import { getBlueprintSourcesForRecipe } from "../utils/blueprintSources";
import rewardsRaw from "../data/blueprint-rewards.json";

const ALL_BLUEPRINT_REWARDS = rewardsRaw as BlueprintReward[];

const PAGE_SIZES = [25, 50, 100] as const;

interface Props {
  recipes: ComponentRecipe[];
  onAddToQueue: (recipe: ComponentRecipe) => void;
}

// -- Unmatched modifier display (no material slot match) -------------------

export function UnmatchedModifierGroups({ modifiers }: { modifiers: ReturnType<typeof summariseUnmatchedModifiers> }) {
  // Group summaries by slot.
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
                <span className="craft-drawer-modifier-prop">{formatProperty(property)}</span>
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
        <span className="craft-mod-group-mat craft-muted">Component HP Modifier</span>
        {quality !== undefined && <span className="craft-mod-group-q">{quality}</span>}
      </div>
      {quality === undefined ? (
        <div className="craft-drawer-modifier-list">
          {summariseUnmatchedModifiers(modifiers).map(({ property, minPercent, maxPercent }, i) => (
            <div key={i} className="craft-drawer-modifier-row">
              <span className="craft-badge craft-badge--sm craft-badge--slot craft-drawer-modifier-slot">
                ASPECTS
              </span>
              <span className="craft-drawer-modifier-prop">{formatProperty(property)}</span>
              <span className="craft-drawer-modifier-val craft-mod-range">
                {minPercent.toFixed(1)}% â†’ {maxPercent >= 0 ? "+" : ""}
                {maxPercent.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="craft-drawer-modifier-list">
          {getModifiersAtQuality(modifiers, quality).map((m, i) => (
            <div key={i} className="craft-drawer-modifier-row">
              <span className="craft-badge craft-badge--sm craft-badge--slot craft-drawer-modifier-slot">
                {m.slot}
              </span>
              <span className="craft-drawer-modifier-prop">{formatProperty(m.property)}</span>
              <span
                className={`craft-drawer-modifier-val ${
                  m.value >= 0 ? "craft-ok" : "craft-shortage"
                }`}
              >
                {m.value >= 0 ? "+" : ""}
                {m.value.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -- Expanded detail drawer ------------------------------------------------

function RecipeDrawer({ recipe }: { recipe: ComponentRecipe }) {
  const [materialQualities, setMaterialQualities] = useState<RecipeMaterialQualityState>(
    () => getDefaultMaterialQualities(recipe, recipe.materials)
  );
  const [debugOpen, setDebugOpen] = useState(false);

  const matchedGroups = useMemo(
    () =>
      recipe.materials
        .filter((material) => (material.qualityModifiers?.length ?? 0) > 0)
        .map((material) => ({
          materialSlot: material.slot,
          modifiers: material.qualityModifiers ?? [],
        })),
    [recipe]
  );

  const overallModifiers = recipe.overallQualityModifiers ?? [];
  const overallQualityMaterial = recipe.materials[2];
  const overallQualitySource =
    overallQualityMaterial !== undefined
      ? materialQualities[getMaterialQualityKey(recipe, overallQualityMaterial)]
      : undefined;

  // TODO: confirm actual ASPECTS/result quality formula.
  const hasAnyModifiers = matchedGroups.length > 0 || overallModifiers.length > 0;

  const sources = useMemo(
    () => getBlueprintSourcesForRecipe(recipe, ALL_BLUEPRINT_REWARDS),
    [recipe]
  );

  return (
    <div className="craft-drawer">
      {/* Left -- Required Materials & Quality Inputs */}
      <div className="craft-drawer-col">
        <div className="craft-drawer-col-title">Required Materials & Quality</div>
        <div className="craft-drawer-mat-blocks">
          {recipe.materials.map((mat) => {
            const key = getMaterialQualityKey(recipe, mat);
            const quality = materialQualities[key] ?? 500;
            return (
              <div key={`${mat.slot}:${key}`} className="craft-drawer-mat-block">
                <div className="craft-drawer-mat-block-header">
                  <span className="craft-badge craft-badge--sm craft-badge--slot">
                    {mat.slot}
                  </span>
                  <span className="craft-drawer-mat-name">{mat.material_name}</span>
                </div>
                <div className="craft-drawer-mat-block-meta">
                  <span className="craft-muted">Required</span>
                  <span className="craft-material-qty">x{mat.quantity.toFixed(2)}</span>
                </div>
                <div className="craft-drawer-mat-q-wrap">
                  <div className="craft-drawer-mat-q-header">
                    <span className="craft-muted craft-cell-mono craft-drawer-quality-label">
                      0
                    </span>
                    <span className="craft-drawer-quality-value">{quality}</span>
                    <span className="craft-muted craft-cell-mono craft-drawer-quality-label">
                      1000
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1000}
                    step={1}
                    value={quality}
                    onChange={(e) =>
                      setMaterialQualities((prev) =>
                        updateMaterialQuality(prev, key, Number(e.target.value))
                      )
                    }
                    className="craft-quality-slider"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Middle -- Stat Modifiers grouped by material */}
      <div className="craft-drawer-col">
        <div className="craft-drawer-col-title">Stat Modifiers</div>
        {!hasAnyModifiers ? (
          <div className="craft-drawer-empty">
            No quality modifier data matched for this component
          </div>
        ) : (
          <div className="craft-mod-groups">
           
            {matchedGroups.map(({ materialSlot, modifiers }) => {
              const mat = recipe.materials.find((m) => m.slot === materialSlot)!;
              const key = getMaterialQualityKey(recipe, mat);
              const quality = materialQualities[key] ?? 500;
              const atQuality = getModifiersAtQuality(modifiers, quality);
              return (
                <div key={materialSlot} className="craft-mod-group">
                  <div className="craft-mod-group-header">
                    <span className="craft-drawer-mat-slot">{materialSlot}</span>
                    <span className="craft-mod-group-sep">/</span>
                    <span className="craft-mod-group-mat">{mat.material_name}</span>
                    <span className="craft-mod-group-q">{quality}</span>
                  </div>
                  {atQuality.length === 0 ? (
                    <div className="craft-drawer-empty craft-drawer-empty--sm">
                      No modifiers at quality {quality}
                    </div>
                  ) : (
                    <div className="craft-drawer-modifier-list">
                      {atQuality.map((m, i) => (
                        <div key={i} className="craft-drawer-modifier-row">
                          <span className="craft-badge craft-badge--sm craft-badge--slot craft-drawer-modifier-slot">
                            {m.slot}
                          </span>
                          <span className="craft-drawer-modifier-prop">
                            {formatProperty(m.property)}
                          </span>
                          <span
                            className={`craft-drawer-modifier-val ${
                              m.value >= 0 ? "craft-ok" : "craft-shortage"
                            }`}
                          >
                            {m.value >= 0 ? "+" : ""}
                            {m.value.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
             <OverallModifierGroup modifiers={overallModifiers} quality={overallQualitySource} />
          </div>
        )}
      </div>

      {/* Right -- Blueprint source + debug */}
      {/* Right -- Blueprint source */}
<div className="craft-drawer-col">
  <div className="craft-drawer-col-title">Blueprint Source</div>

  {!recipe.rewardPools || recipe.rewardPools.length === 0 ? (
    <div className="craft-drawer-empty">
      Blueprint source not found in parsed reward data
    </div>
  ) : (
    <div className="craft-drawer-sources">
      {(recipe.rewardPools as { displayName: string }[]).map((pool, i) => (
        <div key={`${pool.displayName}-${i}`} className="craft-drawer-source-item">
          <div className="craft-drawer-source-name">{pool.displayName}</div>
        </div>
      ))}
    </div>
  )}
</div>
    </div>
  );
}

// -- Component type accent color -------------------------------------------

function getComponentTypeColor(componentType: string | undefined | null): string | undefined {
  if (!componentType) return undefined;
  const ct = componentType.toLowerCase();
  if (ct.includes("weapon") || ct.includes("gun")) return "var(--component-gun)";
  if (ct.includes("power")) return "var(--component-power)";
  if (ct.includes("shield")) return "var(--component-shield)";
  if (ct.includes("cooler")) return "var(--component-cooler)";
  if (ct.includes("radar")) return "var(--component-radar)";
  if (ct.includes("quantum") || ct === "qt") return "var(--component-qt)";
  return undefined;
}

// -- Main table ------------------------------------------------------------

export default function ComponentRecipeTable({ recipes, onAddToQueue }: Props) {
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return recipes
      .filter((r) => {
        const displayName = (r.item_kind === "vehicle" ? r.component_name : getComponentDisplayName(r.component_name)).toLowerCase();
        const searchFields = [
          displayName,
          r.fallback_name,
          r.internal_name,
          r.component_name,
          r.manufacturer,
          r.class,
          r.grade,
          r.category,
          r.component_type,
          r.blueprint_id,
        ].map((value) => String(value ?? "").toLowerCase());
        if (kindFilter && r.item_kind !== kindFilter) return false;
        if (typeFilter && r.component_type !== typeFilter) return false;
        if (sizeFilter && r.size !== sizeFilter) return false;
        if (q && !searchFields.some((field) => field.includes(q))) return false;
        return true;
      })
      .sort((a, b) => {
        const aName = a.item_kind === "vehicle" ? a.component_name : getComponentDisplayName(a.component_name);
        const bName = b.item_kind === "vehicle" ? b.component_name : getComponentDisplayName(b.component_name);
        const nd = aName.localeCompare(bName);
        return nd !== 0 ? nd : (a.size || "").localeCompare(b.size || "");
      });
  }, [recipes, search, kindFilter, typeFilter, sizeFilter]);

  const componentTypes = useMemo(
    () => Array.from(new Set(recipes.map((recipe) => recipe.component_type).filter(Boolean))).sort(),
    [recipes]
  );
  const sizes = useMemo(
    () => Array.from(new Set(recipes.map((recipe) => recipe.size).filter(Boolean))).sort((a, b) => Number(a) - Number(b)),
    [recipes]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const startIdx = currentPage * pageSize;
  const endIdx = Math.min(startIdx + pageSize, filtered.length);
  const paginated = filtered.slice(startIdx, endIdx);
  const startItem = filtered.length === 0 ? 0 : startIdx + 1;

  function resetPage() {
    setPage(0);
  }

  return (
    <div className="craft-section">
      <div className="craft-section-header">
        <span className="craft-section-title">Component Recipes</span>
        <span className="craft-count">
          {filtered.length} / {recipes.length}
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

        <select
          className="craft-select"
          value={kindFilter}
          onChange={(e) => {
            setKindFilter(e.target.value);
            resetPage();
          }}
        >
          <option value="">All Gear</option>
          <option value="vehicle">Vehicle</option>
          <option value="fps">FPS</option>
        </select>

        <select
          className="craft-select"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            resetPage();
          }}
        >
          <option value="">All Types</option>
          {componentTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          className="craft-select"
          value={sizeFilter}
          onChange={(e) => {
            setSizeFilter(e.target.value);
            resetPage();
          }}
        >
          <option value="">All Sizes</option>
          {sizes.map((s) => (
            <option key={s} value={s}>
              Size {s}
            </option>
          ))}
        </select>
      </div>

      <div className="craft-table-wrap">
        <table className="craft-table">
          <thead>
            <tr>
              <th>Component</th>
              <th>Type</th>
              <th>Size</th>
              <th>Grade</th>
              <th>Class</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((recipe) => {
              const isOpen = expanded === recipe.blueprint_id;
              const displayName = recipe.item_kind === "vehicle" ? recipe.component_name : getComponentDisplayName(recipe.component_name);
              const typeDisplay = recipe.item_kind === "vehicle"
                ? (recipe.component_type || null)
                : (recipe.category || null);
              const typeColor = getComponentTypeColor(recipe.component_type);
              return (
                <Fragment key={recipe.blueprint_id}>
                  <tr
                    className={`craft-table-row${isOpen ? " craft-table-row--open" : ""}`}
                    style={{ cursor: "pointer" }}
                    onClick={() => setExpanded(isOpen ? null : recipe.blueprint_id)}
                  >
                    <td className="craft-cell-name" title={recipe.component_name}>
                      {displayName}
                    </td>
                    
                    <td>
                      {typeDisplay ? (
                        <span
                          className="craft-badge craft-badge--neutral craft-badge--ctype"
                    
                        >
                          {typeDisplay}
                        </span>
                      ) : null}
                    </td>
                    
                    <td>
                      {recipe.grade ? (
                        <span className="craft-badge craft-badge--sm craft-badge--neutral">{recipe.grade}</span>
                      ) : null}
                    </td>
                    <td className="craft-cell-subdued">{recipe.class ?? ""}</td>
                    <td>
                      <button
                        type="button"
                        className="craft-btn-add"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToQueue(recipe);
                        }}
                        title="Add to Build Queue"
                      >
                        +
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="craft-detail-row">
                      <td colSpan={6}>
                        <RecipeDrawer recipe={recipe} />
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

      {/* Pagination bar */}
      <div className="craft-pagination">
        <div className="craft-pagination-info">
          {filtered.length > 0
            ? `Showing ${startItem}-${endIdx} of ${filtered.length}`
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
          <span className="craft-muted craft-pagination-size-label">Per page:</span>
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
