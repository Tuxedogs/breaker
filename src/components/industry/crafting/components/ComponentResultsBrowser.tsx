import { useEffect, useMemo, useState } from "react";
import type { ComponentRecipe } from "../utils/craftingTypes";
import ComponentResultCard from "./ComponentResultCard";
import {
  buildFamilyVariantCounts,
  getCardDisplayName,
  getCardTypeLabel,
} from "../utils/componentCardSchema";
import { buildResourceGroups } from "../../shared/msbResourceGroups";
import { fetchSavedBlueprints } from "@/lib/userSavedBlueprints";
import { useAuthSession } from "@/lib/auth/useAuthSession";

const SAVED_BLUEPRINT_STORAGE_KEY = "scintel:recipe:bookmarks:v1";
const UTILITY_TYPES = new Set(["dockingCollar", "salvageHead", "salvageModifier", "weaponMining"]);
const RESULTS_PER_PAGE = 12;

type FilterOption = {
  value: string;
  label: string;
};

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

function normalizeSearch(value: unknown): string {
  return String(value ?? "").toLowerCase();
}

function matchesSearch(recipe: ComponentRecipe, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const haystack = [
    getCardDisplayName(recipe),
    recipe.component_name,
    recipe.component_type,
    recipe.category,
    recipe.grade,
    recipe.class,
    recipe.weaponClass,
    recipe.familyDisplayName,
    recipe.variantName,
    recipe.armorSlot,
    recipe.armorWeight,
    recipe.blueprint_id,
    recipe.output_entityClass,
  ].map(normalizeSearch).join(" ");
  return trimmed.split(/\s+/).every((token) => haystack.includes(token));
}

function labelOption(value: string): string {
  return getCardTypeLabel({
    blueprint_id: "",
    component_type: value,
    component_name: "",
    size: "",
    craft_time_seconds: 0,
    output_entityClass: "",
    materials: [],
    item_kind: value === "weapons" || value === "armor" || value === "ammo" ? "fps" : "vehicle",
  });
}

function toggleSetValue(prev: Set<string>, value: string): Set<string> {
  const next = new Set(prev);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

function buildMaterialOptions(recipes: ComponentRecipe[]): FilterOption[] {
  const byName = new Map<string, FilterOption>();
  for (const recipe of recipes) {
    for (const material of recipe.materials ?? []) {
      const label = material.material_name?.trim();
      if (!label) continue;
      const key = (material.cost_id || label).toLowerCase();
      if (!byName.has(key)) byName.set(key, { value: material.cost_id || label, label });
    }
  }
  const groups = buildResourceGroups([...byName.values()].map((option) => ({
    id: option.value,
    label: option.label,
  })));
  return [
    ...groups.shipAndHarvestable,
    ...groups.vehicle,
    ...groups.hand,
  ].slice(0, 36).map((chip) => ({ value: chip.id, label: chip.label }));
}

function ComponentBrowserState({ title, body }: { title: string; body: string }) {
  return (
    <section className="component-browser-state">
      <span className="craft-frl-label">{title}</span>
      <p>{body}</p>
    </section>
  );
}

export default function ComponentResultsBrowser({
  recipes,
  loading,
  error,
  isRecipeQueued,
}: {
  recipes: ComponentRecipe[];
  loading: boolean;
  error: string | null;
  isRecipeQueued: (recipe: ComponentRecipe) => boolean;
}) {
  const [search, setSearch] = useState("");
  const [vehicleFilters, setVehicleFilters] = useState<Set<string>>(new Set());
  const [fpsFilters, setFpsFilters] = useState<Set<string>>(new Set());
  const [materialFilters, setMaterialFilters] = useState<Set<string>>(new Set());
  const [savedOnly, setSavedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [savedBlueprintIds, setSavedBlueprintIds] = useState<Set<string>>(
    () => readStoredStringSet(SAVED_BLUEPRINT_STORAGE_KEY),
  );
  const { session } = useAuthSession();

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!accessToken) return;
    let cancelled = false;
    fetchSavedBlueprints(accessToken)
      .then((savedBlueprints) => {
        if (!cancelled) setSavedBlueprintIds(new Set(savedBlueprints.map((item) => item.blueprintId)));
      })
      .catch(() => {
        if (!cancelled) setSavedBlueprintIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  const vehicleOptions = useMemo<FilterOption[]>(() => {
    const values = new Set<string>();
    let hasUtility = false;
    for (const recipe of recipes) {
      if (recipe.item_kind === "fps") continue;
      const type = recipe.component_type;
      if (!type) continue;
      if (UTILITY_TYPES.has(type)) {
        hasUtility = true;
      } else {
        values.add(type);
      }
    }
    const options = [...values].sort().map((value) => ({ value, label: labelOption(value) }));
    if (hasUtility) options.push({ value: "__utility__", label: "Utility" });
    return options;
  }, [recipes]);

  const fpsOptions = useMemo<FilterOption[]>(() => {
    const values = new Set(
      recipes
        .filter((recipe) => recipe.item_kind === "fps")
        .map((recipe) => recipe.component_type)
        .filter((value): value is string => Boolean(value)),
    );
    return [...values].sort().map((value) => ({ value, label: labelOption(value) }));
  }, [recipes]);

  const materialOptions = useMemo(() => buildMaterialOptions(recipes), [recipes]);
  const familyVariantCounts = useMemo(() => buildFamilyVariantCounts(recipes), [recipes]);

  const filteredRecipes = useMemo(() => {
    return recipes
      .filter((recipe) => {
        if (!matchesSearch(recipe, search)) return false;
        if (savedOnly && !savedBlueprintIds.has(recipe.blueprint_id)) return false;
        if (fpsFilters.size && (recipe.item_kind !== "fps" || !fpsFilters.has(recipe.component_type))) return false;
        if (vehicleFilters.size) {
          if (recipe.item_kind === "fps") return false;
          const type = recipe.component_type;
          const utilityMatch = vehicleFilters.has("__utility__") && UTILITY_TYPES.has(type);
          if (!vehicleFilters.has(type) && !utilityMatch) return false;
        }
        if (materialFilters.size) {
          const usesMaterial = recipe.materials.some((material) =>
            materialFilters.has(material.cost_id) || materialFilters.has(material.material_name),
          );
          if (!usesMaterial) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const type = getCardTypeLabel(a).localeCompare(getCardTypeLabel(b));
        return type || getCardDisplayName(a).localeCompare(getCardDisplayName(b));
      });
  }, [fpsFilters, materialFilters, recipes, savedBlueprintIds, savedOnly, search, vehicleFilters]);

  const totalPages = Math.max(1, Math.ceil(filteredRecipes.length / RESULTS_PER_PAGE));
  const visiblePage = Math.min(page, totalPages);
  const pageStart = (visiblePage - 1) * RESULTS_PER_PAGE;
  const pageRecipes = filteredRecipes.slice(pageStart, pageStart + RESULTS_PER_PAGE);
  const hasFilters = Boolean(search || vehicleFilters.size || fpsFilters.size || materialFilters.size || savedOnly);

  useEffect(() => {
    setPage(1);
  }, [fpsFilters, materialFilters, savedOnly, search, vehicleFilters]);

  function clearFilters() {
    setSearch("");
    setVehicleFilters(new Set());
    setFpsFilters(new Set());
    setMaterialFilters(new Set());
    setSavedOnly(false);
    setPage(1);
  }

  if (loading) {
    return (
      <div className="craft-page craft-planner-shell component-results-browser">
        <ComponentBrowserState title="Loading" body="Component blueprints are loading." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="craft-page craft-planner-shell component-results-browser">
        <ComponentBrowserState title="Error" body={error} />
      </div>
    );
  }

  return (
    <div className="craft-page craft-planner-shell component-results-browser">
      <div className="component-browser-toolbar">
        <label className="component-browser-search">
          <span className="craft-search-icon" aria-hidden="true">/</span>
          <input
            type="search"
            aria-label="Search components"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search components, type, material, GUID..."
          />
        </label>

        <div className="component-browser-filter-row" role="group" aria-label="FPS filters">
          <span className="craft-frl-label">FPS</span>
          {fpsOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`craft-frl-chip${fpsFilters.has(option.value) ? " craft-frl-chip--active" : ""}`}
              onClick={() => setFpsFilters((prev) => toggleSetValue(prev, option.value))}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="component-browser-filter-row" role="group" aria-label="Vehicle filters">
          <span className="craft-frl-label">Vehicles</span>
          {vehicleOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`craft-frl-chip${vehicleFilters.has(option.value) ? " craft-frl-chip--active" : ""}`}
              onClick={() => setVehicleFilters((prev) => toggleSetValue(prev, option.value))}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="component-browser-filter-row component-browser-filter-row--materials" role="group" aria-label="Material filters">
          <span className="craft-frl-label">Materials</span>
          {materialOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`craft-frl-chip${materialFilters.has(option.value) ? " craft-frl-chip--active" : ""}`}
              onClick={() => setMaterialFilters((prev) => toggleSetValue(prev, option.value))}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="component-browser-summary">
          <button
            type="button"
            className={`craft-frl-chip${savedOnly ? " craft-frl-chip--active" : ""}`}
            onClick={() => setSavedOnly((value) => !value)}
          >
            Blueprint Bookmarks
          </button>
          <span className="component-browser-count">{filteredRecipes.length} / {recipes.length}</span>
          <button type="button" className="craft-frl-clear" onClick={clearFilters} disabled={!hasFilters}>
            Clear
          </button>
        </div>
      </div>

      {filteredRecipes.length === 0 ? (
        <ComponentBrowserState title="No Results" body="No craftable components match the current browser filters." />
      ) : (
        <>
          <section className="component-results-grid" aria-label="Component results">
            {pageRecipes.map((recipe) => (
              <ComponentResultCard
                key={recipe.blueprint_id}
                recipe={recipe}
                queued={isRecipeQueued(recipe)}
                saved={savedBlueprintIds.has(recipe.blueprint_id)}
                familyVariantCounts={familyVariantCounts}
              />
            ))}
          </section>

          <footer className="component-browser-pager" aria-label="Component results pages">
            <span className="component-browser-page-readout">
              Showing {pageStart + 1}-{Math.min(pageStart + pageRecipes.length, filteredRecipes.length)} of {filteredRecipes.length}
            </span>
            <div className="component-browser-page-actions">
              <button
                type="button"
                className="craft-frl-clear"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={visiblePage <= 1}
              >
                Previous
              </button>
              <span className="component-browser-page-count">Page {visiblePage} / {totalPages}</span>
              <button
                type="button"
                className="craft-frl-clear"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={visiblePage >= totalPages}
              >
                Next
              </button>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
