import { useState, useMemo, Fragment } from "react";
import type { ComponentRecipe, QualityModifier, BlueprintReward } from "../utils/craftingTypes";
import { formatCraftTime } from "../utils/craftingCalculations";
import { getComponentDisplayName } from "../utils/componentDisplayNames";
import {
  getModifiersAtQuality,
  getModifiersGroupedByMaterial,
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
import qualityRaw from "../data/quality-modifiers.json";
import rewardsRaw from "../data/blueprint-rewards.json";

const ALL_QUALITY_MODIFIERS = qualityRaw as QualityModifier[];
const ALL_BLUEPRINT_REWARDS = rewardsRaw as BlueprintReward[];

const COMPONENT_TYPES = [
  "cooler",
  "mininglaser",
  "powerplant",
  "quantumdrive",
  "radar",
  "salvage",
  "shield",
  "tractorbeam",
  "weapons",
] as const;

const SIZES = ["0", "1", "2", "3", "4"];
const PAGE_SIZES = [25, 50, 100] as const;

interface Props {
  recipes: ComponentRecipe[];
  onAddToQueue: (recipe: ComponentRecipe) => void;
}

// -- Unmatched modifier display (no material slot match) -------------------

function UnmatchedModifierGroups({ modifiers }: { modifiers: ReturnType<typeof summariseUnmatchedModifiers> }) {
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

// -- Expanded detail drawer ------------------------------------------------

function RecipeDrawer({ recipe }: { recipe: ComponentRecipe }) {
  const [materialQualities, setMaterialQualities] = useState<RecipeMaterialQualityState>(
    () => getDefaultMaterialQualities(recipe, recipe.materials)
  );
  const [debugOpen, setDebugOpen] = useState(false);

  const { matched: matchedGroups, unmatched: unmatchedMods } = useMemo(
    () => getModifiersGroupedByMaterial(recipe, ALL_QUALITY_MODIFIERS),
    [recipe]
  );

  const unmatchedSummaries = useMemo(
    () => summariseUnmatchedModifiers(unmatchedMods),
    [unmatchedMods]
  );

  const hasAnyModifiers = matchedGroups.length > 0 || unmatchedMods.length > 0;

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
            {unmatchedSummaries.length > 0 && (
              <UnmatchedModifierGroups modifiers={unmatchedSummaries} />
            )}
          </div>
        )}
      </div>

      {/* Right -- Blueprint source + debug */}
      <div className="craft-drawer-col">
        <div className="craft-drawer-col-title">Blueprint Source</div>
        {sources.length === 0 ? (
          <div className="craft-drawer-empty">
            Blueprint source not found in parsed reward data
          </div>
        ) : (
          <div className="craft-drawer-sources">
            {sources.map((s, i) => (
              <div key={i} className="craft-drawer-source-item">
                <div className="craft-drawer-source-name">{s.blueprint_name}</div>
                <div className="craft-drawer-source-meta">
                  <span className="craft-badge craft-badge--sm craft-badge--type">
                    {s.reward_group}
                  </span>
                  {s.reward_source && (
                    <span className="craft-muted craft-drawer-source-detail">
                      {s.reward_source}
                    </span>
                  )}
                  {s.category && (
                    <span className="craft-badge craft-badge--sm">{s.category}</span>
                  )}
                </div>
                {s.weight !== undefined && (
                  <div className="craft-muted craft-drawer-source-detail">
                    Weight: {s.weight}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          className="craft-debug-toggle"
          onClick={() => setDebugOpen((v) => !v)}
        >
          <span className="craft-debug-toggle-arrow">{debugOpen ? "v" : ">"}</span>
          Raw Debug
        </button>
        {debugOpen && (
          <div className="craft-debug-fields">
            <div className="craft-debug-row">
              <span className="craft-debug-key">component_name</span>
              <span className="craft-debug-val">{recipe.component_name}</span>
            </div>
            <div className="craft-debug-row">
              <span className="craft-debug-key">blueprint_id</span>
              <span className="craft-debug-val craft-cell-mono">{recipe.blueprint_id}</span>
            </div>
            <div className="craft-debug-row">
              <span className="craft-debug-key">output_entityClass</span>
              <span className="craft-debug-val craft-cell-mono">{recipe.output_entityClass}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -- Main table ------------------------------------------------------------

export default function ComponentRecipeTable({ recipes, onAddToQueue }: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return recipes
      .filter((r) => {
        const displayName = getComponentDisplayName(r.component_name).toLowerCase();
        const rawName = r.component_name.toLowerCase();
        if (typeFilter && r.component_type !== typeFilter) return false;
        if (sizeFilter && r.size !== sizeFilter) return false;
        if (
          q &&
          !rawName.includes(q) &&
          !displayName.includes(q) &&
          !r.component_type.includes(q) &&
          !r.blueprint_id.includes(q)
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        const nd = getComponentDisplayName(a.component_name).localeCompare(
          getComponentDisplayName(b.component_name)
        );
        return nd !== 0 ? nd : (a.size || "").localeCompare(b.size || "");
      });
  }, [recipes, search, typeFilter, sizeFilter]);

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
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            resetPage();
          }}
        >
          <option value="">All Types</option>
          {COMPONENT_TYPES.map((t) => (
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
          {SIZES.map((s) => (
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
              <th>Craft Time</th>
              <th>Materials</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((recipe) => {
              const isOpen = expanded === recipe.blueprint_id;
              const displayName = getComponentDisplayName(recipe.component_name);
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
                      <span className="craft-badge craft-badge--type">
                        {recipe.component_type}
                      </span>
                    </td>
                    <td>
                      <span className="craft-badge craft-badge--size">
                        {recipe.size || "---"}
                      </span>
                    </td>
                    <td className="craft-cell-mono">
                      {formatCraftTime(recipe.craft_time_seconds)}
                    </td>
                    <td className="craft-cell-mono">{recipe.materials.length}</td>
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
