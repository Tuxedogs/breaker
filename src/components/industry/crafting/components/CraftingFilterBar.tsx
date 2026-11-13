import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { useCraftingContext } from "../CraftingContext";
import {
  parseRecipeBrowserCategoryFilterSet,
  getRecipeBrowserSearchParam,
  parseRecipeBrowserFilterSet,
  RECIPE_BROWSER_CLASS_FILTER_VALUES,
  RECIPE_BROWSER_GRADE_FILTER_VALUES,
  RECIPE_BROWSER_SIZE_FILTER_VALUES,
} from "../utils/recipeBrowserFilters";
import { buildRecipeBrowserMaterialOptions } from "../utils/recipeBrowserMaterialOptions";
import { useCraftingPhoneLayout } from "../utils/craftingBrowserLayout";
import MobileFilterSheet from "../../../shared/MobileFilterSheet";
import MiningBookmarkIcon from "../../mining/MiningBookmarkIcon";
import "../../../shared/resource-filter-chip.css";

type FilterOption = {
  value: string;
  label: string;
  count?: number;
  unavailable?: boolean;
};

const VEHICLE_CATEGORY_OPTIONS: FilterOption[] = [
  { value: "weaponGun", label: "Vehicle Weapons" },
  { value: "powerplant", label: "Power Plant" },
  { value: "shield", label: "Shield" },
  { value: "cooler", label: "Cooler" },
  { value: "radar", label: "Radar" },
  { value: "quantumdrive", label: "QT" },
  { value: "__mining__", label: "Mining" },
  { value: "__salvage__", label: "Salvage" },
  { value: "__other__", label: "Other" },
];

const FPS_CATEGORY_OPTIONS: FilterOption[] = [
  { value: "weapons", label: "FPS Weapons" },
  { value: "armor", label: "Armor" },
  { value: "__utility__", label: "Utility" },
  { value: "__other__", label: "Other" },
];

const SIZE_OPTIONS: FilterOption[] = ["1", "2", "3", "4", "5", "6"].map((value) => ({ value, label: value }));
const GRADE_OPTIONS: FilterOption[] = ["A", "B", "C", "D"].map((value) => ({ value, label: value }));
const CLASS_OPTIONS: FilterOption[] = [
  { value: "military", label: "Military" },
  { value: "stealth", label: "Stealth" },
  { value: "civilian", label: "Civilian" },
  { value: "industrial", label: "Industrial" },
  { value: "competition", label: "Competition" },
];

function toggleSetValue(values: Set<string>, value: string): Set<string> {
  const next = new Set(values);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function FilterChip({
  option,
  active,
  onClick,
}: {
  option: FilterOption;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`crb2-filter-chip${active ? " crb2-filter-chip--active" : ""}`}
      aria-pressed={active}
      disabled={option.unavailable}
      title={option.unavailable ? "No craftable items are currently available in this category" : undefined}
      onClick={onClick}
    >
      {option.label}
      {option.unavailable ? <span className="crb2-filter-zero">0</span> : null}
    </button>
  );
}

function FilterLabel({ children }: { children: ReactNode }) {
  return <span className="crb2-filter-label">{children}</span>;
}

export default function CraftingFilterBar({
  records,
  resultCount,
  forceBrowserRoute = false,
  sidebarMode = false,
}: {
  records: ComponentCardIndexRecord[];
  resultCount: number;
  forceBrowserRoute?: boolean;
  sidebarMode?: boolean;
}) {
  const { componentCardFacets } = useCraftingContext();
  const isPhone = useCraftingPhoneLayout();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDetailRoute = !forceBrowserRoute
    && location.pathname.replace(/\/+$/, "") !== "/industry/crafting";
  const search = getRecipeBrowserSearchParam(searchParams);
  const materialOptions = useMemo(
    () => buildRecipeBrowserMaterialOptions(componentCardFacets?.materials, records),
    [componentCardFacets?.materials, records],
  );
  const materialFilterValues = useMemo(
    () => new Set(materialOptions.map((option) => option.value)),
    [materialOptions],
  );
  const vehicleFilters = useMemo(
    () => parseRecipeBrowserCategoryFilterSet(searchParams, "v"),
    [searchParams],
  );
  const fpsFilters = useMemo(
    () => parseRecipeBrowserCategoryFilterSet(searchParams, "f"),
    [searchParams],
  );
  const sizeFilters = useMemo(
    () => parseRecipeBrowserFilterSet(searchParams, "sz", RECIPE_BROWSER_SIZE_FILTER_VALUES),
    [searchParams],
  );
  const gradeFilters = useMemo(
    () => parseRecipeBrowserFilterSet(searchParams, "gr", RECIPE_BROWSER_GRADE_FILTER_VALUES),
    [searchParams],
  );
  const classFilters = useMemo(
    () => parseRecipeBrowserFilterSet(searchParams, "cl", RECIPE_BROWSER_CLASS_FILTER_VALUES),
    [searchParams],
  );
  const materialFilters = useMemo(
    () => parseRecipeBrowserFilterSet(searchParams, "mt", materialFilterValues),
    [materialFilterValues, searchParams],
  );
  const savedOnly = searchParams.get("bk") === "1";
  // The Materials disclosure opens when material filters are active (e.g. from
  // the URL, once the material list has loaded). After it has opened or the
  // user has toggled it, that state sticks, so clearing filters never snaps it shut.
  const [materialsOpenState, setMaterialsOpenState] = useState<boolean | null>(null);
  const materialsOpen = materialsOpenState ?? materialFilters.size > 0;

  const applySearchParams = useCallback((
    updater: (previous: URLSearchParams) => URLSearchParams,
  ) => {
    if (isDetailRoute) {
      const next = updater(new URLSearchParams(searchParams));
      const query = next.toString();
      navigate(`/industry/crafting${query ? `?${query}` : ""}`, { replace: true });
      return;
    }
    setSearchParams((previous) => updater(new URLSearchParams(previous)), { replace: true });
  }, [isDetailRoute, navigate, searchParams, setSearchParams]);

  const setParam = useCallback((key: string, value: string | null) => {
    applySearchParams((next) => {
      if (key === "search") next.delete("q");
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "pg") next.delete("pg");
      return next;
    });
  }, [applySearchParams]);

  const setValues = useCallback((key: string, values: Set<string>, value: string) => {
    const next = toggleSetValue(values, value);
    setParam(key, next.size ? [...next].join(",") : null);
  }, [setParam]);

  const [materialOpen, setMaterialOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [materialQuery, setMaterialQuery] = useState("");
  const [activeMaterialIndex, setActiveMaterialIndex] = useState(0);
  const materialRootRef = useRef<HTMLDivElement>(null);
  const materialTriggerRef = useRef<HTMLButtonElement>(null);
  const materialSearchRef = useRef<HTMLInputElement>(null);

  const filteredMaterialOptions = useMemo(() => {
    const query = materialQuery.trim().toLowerCase();
    if (!query) return materialOptions;
    return materialOptions.filter((option) => option.label.toLowerCase().includes(query));
  }, [materialOptions, materialQuery]);

  useEffect(() => {
    if (!materialOpen || sidebarMode) return;
    materialSearchRef.current?.focus();
  }, [materialOpen]);

  useEffect(() => {
    if (!materialOpen || sidebarMode) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!materialRootRef.current?.contains(event.target as Node)) setMaterialOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [materialOpen, sidebarMode]);

  const handleMaterialKeyboard = (event: ReactKeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setMaterialOpen(false);
      materialTriggerRef.current?.focus();
      return;
    }
    if (filteredMaterialOptions.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveMaterialIndex((current) => (
        (current + direction + filteredMaterialOptions.length) % filteredMaterialOptions.length
      ));
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveMaterialIndex(event.key === "Home" ? 0 : filteredMaterialOptions.length - 1);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option = filteredMaterialOptions[activeMaterialIndex];
      if (option) setValues("mt", materialFilters, option.value);
    }
  };
  const toggleMaterialMenu = () => {
    if (!materialOpen) setActiveMaterialIndex(0);
    setMaterialOpen((open) => !open);
  };

  const fpsUtilityAvailable = records.some(
    (record) => record.kind === "fps" && record.type === "utility",
  );
  const categoryScope = vehicleFilters.size && !fpsFilters.size
    ? "ship"
    : fpsFilters.size && !vehicleFilters.size ? "fps"
      : !vehicleFilters.size && !fpsFilters.size ? "all" : "mixed";
  const selectCategoryScope = (scope: "all" | "ship" | "fps") => {
    applySearchParams((previous) => {
      previous.delete("v");
      previous.delete("f");
      previous.delete("pg");
      if (scope === "ship") previous.set("v", VEHICLE_CATEGORY_OPTIONS.map(({ value }) => value).join(","));
      if (scope === "fps") previous.set("f", FPS_CATEGORY_OPTIONS.map(({ value }) => value).join(","));
      return previous;
    });
  };
  const filterCount = vehicleFilters.size
    + fpsFilters.size
    + sizeFilters.size
    + gradeFilters.size
    + classFilters.size
    + materialFilters.size
    + (savedOnly ? 1 : 0);
  const activeCount = filterCount + (search ? 1 : 0);

  const clearFilters = () => applySearchParams((next) => {
    ["search", "q", "v", "f", "sz", "gr", "cl", "mt", "mm", "bk", "pg"].forEach((key) => {
      next.delete(key);
    });
    return next;
  });

  if (sidebarMode) {
    const matchMode = searchParams.get("mm") === "any" ? "any" : "all";
    const mainGroups = [
      { label: "Size", options: SIZE_OPTIONS, selected: sizeFilters, key: "sz" },
      { label: "Grade", options: GRADE_OPTIONS, selected: gradeFilters, key: "gr" },
      { label: "Class", options: CLASS_OPTIONS, selected: classFilters, key: "cl" },
      { label: "Ship components", options: VEHICLE_CATEGORY_OPTIONS, selected: vehicleFilters, key: "v" },
      { label: "FPS equipment", options: FPS_CATEGORY_OPTIONS, selected: fpsFilters, key: "f" },
    ];
    const filterSections = (
      <>
        <div className="craft-v31-filter-category">
          <span className="craft-v31-filter-label">Category</span>
          <div className="craft-v31-filter-segments" role="group" aria-label="Crafting category">
            {([
              { value: "all", label: "All" },
              { value: "ship", label: "Component" },
              { value: "fps", label: "Equipment" },
            ] as const).map((option) => (
              <button key={option.value} type="button" aria-pressed={categoryScope === option.value}
                className={"mining-filter-chip mining-filter-chip--material source-index-chip" + (categoryScope === option.value ? " is-active" : "")}
                onClick={() => selectCategoryScope(option.value)}>{option.label}</button>
            ))}
          </div>
        </div>
        <section className="craft-v31-primary-filters" aria-label="Component specifications">
          <div className="craft-v31-primary-heading">
            <strong>Filters</strong>
            <button type="button" className={"mining-filter-chip mining-filter-chip--material source-index-chip craft-v31-bookmark-chip" + (savedOnly ? " is-active" : "")}
              aria-pressed={savedOnly} onClick={() => setParam("bk", savedOnly ? null : "1")}>
              <MiningBookmarkIcon /> {savedOnly ? "Bookmarked ✓" : "Bookmarked"}
            </button>
          </div>
          {mainGroups.map((group) => (
            <div className="craft-v31-facet-group" key={group.key}>
              <span className="craft-v31-filter-label">{group.label}</span>
              <div className="source-index-chip-flow craft-v31-facet-chips" role="group" aria-label={group.label}>
                {group.options.map((option) => {
                  const selected = group.selected.has(option.value);
                  const disabled = group.key === "f" && option.value === "__utility__" && !fpsUtilityAvailable;
                  return (
                    <button key={option.value} type="button"
                      className={"mining-filter-chip mining-filter-chip--material source-index-chip"+(selected ? " is-active" : "")}
                      aria-pressed={selected} disabled={disabled}
                      onClick={() => setValues(group.key, group.selected, option.value)}>
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
        <details className="craft-v31-material-disclosure" key="materials" open={materialsOpen} onToggle={(event) => setMaterialsOpenState(event.currentTarget.open)}>
          <summary>
            <span className="craft-v31-material-toggle-label">
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                <path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              Materials
            </span>
            <span className="craft-v31-material-toggle-count">{materialFilters.size ? materialFilters.size + " selected" : materialOptions.length + " available"}</span>
          </summary>
          <div className="craft-v31-material-disclosure-body">
            <div className="craft-v31-material-filter-heading">
              <strong>Material filters</strong>
              <button type="button" disabled={!materialFilters.size} onClick={() => setParam("mt", null)}>Clear all</button>
            </div>
            <label className="craft-v31-filter-search craft-v31-filter-search--materials">
              <span className="sr-only">Search material filters</span>
              <input type="search" aria-label="Search material filters" placeholder="Search materials..."
                value={materialQuery} onChange={(event) => setMaterialQuery(event.target.value)} />
            </label>
            <div className="craft-v31-match-mode" role="group" aria-label="Material match mode">
              <span>Match</span>
              {(["all", "any"] as const).map((mode) => (
                <button key={mode} type="button" className={"mining-filter-chip mining-filter-chip--material source-index-chip" + (matchMode === mode ? " is-active" : "")}
                  aria-pressed={matchMode === mode}
                  onClick={() => setParam("mm", mode === "all" ? null : mode)}>
                  {mode === "all" ? "All selected" : "Any selected"}
                </button>
              ))}
            </div>
            <div className="craft-v31-material-options source-index-chip-flow" role="group" aria-label="Materials">
              {filteredMaterialOptions.map((option) => {
                const active = materialFilters.has(option.value);
                return (
                  <button key={option.value} type="button"
                    aria-pressed={active} aria-label={option.label}
                    title={option.label + " · " + option.count.toLocaleString() + " matching recipes"}
                    data-resource-category="crafting" data-resource-name={option.label}
                    className={"mining-filter-chip mining-filter-chip--material source-index-chip"+(active ? " is-active" : "")}
                    onClick={() => setValues("mt", materialFilters, option.value)}>
                    {option.label}
                  </button>
                );
              })}
              {!filteredMaterialOptions.length ? <p className="craft-v31-filter-empty">No matching material</p> : null}
            </div>
            <p className="craft-v31-filter-note">Choose materials used by recipes. Search and category filters combine.</p>
          </div>
        </details>
      </>
    );

    if (isPhone) {
      const materialLabels = new Map(materialOptions.map((option) => [option.value, option.label]));
      const activeChips: { id: string; label: string; remove: () => void }[] = [];
      const pushGroup = (key: string, selected: Set<string>, options: FilterOption[], allLabel?: string, format = (label: string) => label) => {
        if (allLabel && options.length && options.every((option) => selected.has(option.value))) {
          activeChips.push({ id: key + ":all", label: allLabel, remove: () => setParam(key, null) });
          return;
        }
        for (const value of selected) {
          const label = options.find((option) => option.value === value)?.label ?? value;
          activeChips.push({ id: key + ":" + value, label: format(label), remove: () => setValues(key, selected, value) });
        }
      };
      pushGroup("v", vehicleFilters, VEHICLE_CATEGORY_OPTIONS, "All components");
      pushGroup("f", fpsFilters, FPS_CATEGORY_OPTIONS, "All equipment");
      pushGroup("sz", sizeFilters, SIZE_OPTIONS, undefined, (label) => "Size " + label);
      pushGroup("gr", gradeFilters, GRADE_OPTIONS, undefined, (label) => "Grade " + label);
      pushGroup("cl", classFilters, CLASS_OPTIONS);
      for (const value of materialFilters) {
        activeChips.push({ id: "mt:" + value, label: materialLabels.get(value) ?? value, remove: () => setValues("mt", materialFilters, value) });
      }
      if (savedOnly) activeChips.push({ id: "bk", label: "Bookmarked", remove: () => setParam("bk", null) });

      return (
        <div className="craft-v31-phone-filterbar">
          <div className="craft-v31-phone-search-row">
            <label className="craft-v31-filter-search">
              <span className="sr-only">Find a blueprint</span>
              <input type="search" aria-label="Find a blueprint" placeholder="Search blueprints or materials"
                value={search} onChange={(event) => setParam("search", event.target.value || null)} />
            </label>
            <button type="button"
              className={"craft-v31-phone-filter-trigger" + (filterCount ? " is-active" : "")}
              aria-haspopup="dialog" aria-expanded={mobileFiltersOpen}
              aria-label={filterCount ? "Filters, " + filterCount + " active" : "Filters"}
              onClick={() => setMobileFiltersOpen(true)}>
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path d="M2 4h12M4.5 8h7M7 12h2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <span>Filters</span>
              {filterCount ? <span className="craft-v31-phone-filter-count">{filterCount}</span> : null}
            </button>
          </div>
          {activeChips.length ? (
            <ul className="craft-v31-phone-active-filters" aria-label="Active filters">
              {activeChips.map((chip) => (
                <li key={chip.id}>
                  <button type="button" aria-label={"Remove filter " + chip.label} onClick={chip.remove}>
                    <span>{chip.label}</span><span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <MobileFilterSheet
            open={mobileFiltersOpen}
            title="Filters"
            onClose={() => setMobileFiltersOpen(false)}
            footer={(
              <>
                <button type="button" className="crb2-mobile-clear" disabled={!filterCount} onClick={clearFilters}>
                  Clear filters
                </button>
                <button type="button" className="crb2-mobile-apply" onClick={() => setMobileFiltersOpen(false)}>
                  {"Show " + resultCount.toLocaleString() + (resultCount === 1 ? " blueprint" : " blueprints")}
                </button>
              </>
            )}
          >
            <div className="craft-v31-material-filter-panel craft-v31-material-filter-panel--sheet" aria-label="Recipe filters">
              {filterSections}
            </div>
          </MobileFilterSheet>
        </div>
      );
    }

    return (
      <div className="craft-v31-material-filter-panel" aria-label="Recipe filters">
        <label className="craft-v31-filter-search">
          <span className="sr-only">Find a blueprint</span>
          <input type="search" aria-label="Find a blueprint" placeholder="Find a blueprint..."
            value={search} onChange={(event) => setParam("search", event.target.value || null)} />
        </label>
        {filterSections}
        <div className="craft-v31-filter-footer">
          <span>{resultCount.toLocaleString()} matching blueprints</span>
          {activeCount ? <button type="button" onClick={clearFilters}>Reset all filters</button> : null}
        </div>
      </div>
    );
  }

  return (
    <header className={`crb2-toolbar${sidebarMode ? " crb2-toolbar--sidebar" : ""}`}>
      <div className="crb2-search-row">
        <label className="crb2-search">
          <span aria-hidden="true">/</span>
          <input
            type="search"
            aria-label="Search components"
            value={search}
            onChange={(event) => setParam("search", event.target.value || null)}
            placeholder="Search components, type, material, or ID"
          />
          <kbd>/</kbd>
        </label>
        <button
          type="button"
          className={`crb2-bookmark${savedOnly ? " crb2-bookmark--active" : ""}`}
          aria-pressed={savedOnly}
          onClick={() => setParam("bk", savedOnly ? null : "1")}
        >
          <MiningBookmarkIcon className="crb2-bookmark-icon" />
          Bookmarked
        </button>
        <span className="crb2-result-count" aria-live="polite">
          <strong>{resultCount.toLocaleString()}</strong>
          <span>components</span>
        </span>
        {activeCount > 0 ? (
          <button type="button" className="crb2-clear" onClick={clearFilters}>
            Clear all
          </button>
        ) : null}
        <button
          type="button"
          className={`crb2-mobile-filter-trigger${filterCount ? " is-active" : ""}`}
          aria-expanded={mobileFiltersOpen}
          onClick={() => setMobileFiltersOpen(true)}
        >
          <span aria-hidden="true">▽</span>
          Filters
          {filterCount ? <strong>{filterCount}</strong> : null}
        </button>
      </div>

      {sidebarMode ? (
        <div className="crb2-v31-category" role="group" aria-label="Recipe category scope">
          <span className="crb2-v31-category-label">Category</span>
          <div className="crb2-v31-category-options">
            {([
              { value: "all", label: "All" },
              { value: "ship", label: "Ship components" },
              { value: "fps", label: "FPS equipment" },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={categoryScope === option.value}
                className={categoryScope === option.value ? "is-active" : undefined}
                onClick={() => selectCategoryScope(option.value)}
              >{option.label}</button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="crb2-filter-viewport" aria-label="Recipe browser filters">
        <div className="crb2-filter-rail">
          <div className="crb2-material" ref={materialRootRef}>
            <button
              ref={materialTriggerRef}
              type="button"
              className={`crb2-material-trigger${materialFilters.size ? " crb2-filter-chip--active" : ""}`}
              aria-haspopup="listbox"
              aria-expanded={materialOpen}
              onClick={toggleMaterialMenu}
            >
              Materials
              {materialFilters.size ? <span>{materialFilters.size}</span> : null}
              <span aria-hidden="true">▾</span>
            </button>
            {materialOpen ? (
              <div className="crb2-material-menu" onKeyDown={handleMaterialKeyboard}>
                <label className="crb2-material-search">
                  <span aria-hidden="true">/</span>
                  <input
                    ref={materialSearchRef}
                    type="search"
                    aria-label="Search materials"
                    value={materialQuery}
                    onChange={(event) => {
                      setMaterialQuery(event.target.value);
                      setActiveMaterialIndex(0);
                    }}
                    placeholder="Search all materials"
                  />
                </label>
                <div className="crb2-material-options" role="listbox" aria-multiselectable="true">
                  {filteredMaterialOptions.length ? filteredMaterialOptions.map((option, index) => (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={materialFilters.has(option.value)}
                      className={[
                        "crb2-material-option",
                        materialFilters.has(option.value) ? "crb2-material-option--active" : "",
                        activeMaterialIndex === index ? "crb2-material-option--focused" : "",
                      ].filter(Boolean).join(" ")}
                      onPointerMove={() => setActiveMaterialIndex(index)}
                      onClick={() => setValues("mt", materialFilters, option.value)}
                    >
                      <span>{option.label}</span>
                      <span>{option.count?.toLocaleString()}</span>
                    </button>
                  )) : (
                    <p className="crb2-material-empty">No materials match that search.</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <span className="crb2-filter-divider" aria-hidden="true" />
          <FilterLabel>Size</FilterLabel>
          {SIZE_OPTIONS.map((option) => (
            <FilterChip
              key={option.value}
              option={option}
              active={sizeFilters.has(option.value)}
              onClick={() => setValues("sz", sizeFilters, option.value)}
            />
          ))}
          <span className="crb2-filter-divider" aria-hidden="true" />
          <FilterLabel>Grade</FilterLabel>
          {GRADE_OPTIONS.map((option) => (
            <FilterChip
              key={option.value}
              option={option}
              active={gradeFilters.has(option.value)}
              onClick={() => setValues("gr", gradeFilters, option.value)}
            />
          ))}
          <span className="crb2-filter-divider" aria-hidden="true" />
          <FilterLabel>Class</FilterLabel>
          {CLASS_OPTIONS.map((option) => (
            <FilterChip
              key={option.value}
              option={option}
              active={classFilters.has(option.value)}
              onClick={() => setValues("cl", classFilters, option.value)}
            />
          ))}
          <span className="crb2-filter-divider" aria-hidden="true" />
          {VEHICLE_CATEGORY_OPTIONS.map((option) => (
            <FilterChip
              key={option.value}
              option={option}
              active={vehicleFilters.has(option.value)}
              onClick={() => setValues("v", vehicleFilters, option.value)}
            />
          ))}
          <span className="crb2-filter-divider" aria-hidden="true" />
          {FPS_CATEGORY_OPTIONS.map((option) => (
            <FilterChip
              key={option.value}
              option={{
                ...option,
                unavailable: option.value === "__utility__" && !fpsUtilityAvailable,
              }}
              active={fpsFilters.has(option.value)}
              onClick={() => setValues("f", fpsFilters, option.value)}
            />
          ))}
        </div>
      </div>

      <MobileFilterSheet
        open={mobileFiltersOpen}
        title="Recipe filters"
        onClose={() => setMobileFiltersOpen(false)}
        footer={(
          <>
            <button type="button" className="crb2-mobile-clear" disabled={!filterCount} onClick={clearFilters}>
              Clear filters
            </button>
            <button type="button" className="crb2-mobile-apply" onClick={() => setMobileFiltersOpen(false)}>
              Show {resultCount.toLocaleString()} results
            </button>
          </>
        )}
      >
        <div className="crb2-mobile-filter-groups">
          <section>
            <h3>Category</h3>
            <div className="crb2-mobile-filter-chips">
              {VEHICLE_CATEGORY_OPTIONS.map((option) => (
                <FilterChip
                  key={`vehicle:${option.value}`}
                  option={option}
                  active={vehicleFilters.has(option.value)}
                  onClick={() => setValues("v", vehicleFilters, option.value)}
                />
              ))}
              {FPS_CATEGORY_OPTIONS.map((option) => (
                <FilterChip
                  key={`fps:${option.value}`}
                  option={{ ...option, unavailable: option.value === "__utility__" && !fpsUtilityAvailable }}
                  active={fpsFilters.has(option.value)}
                  onClick={() => setValues("f", fpsFilters, option.value)}
                />
              ))}
            </div>
          </section>
          <section>
            <h3>Size</h3>
            <div className="crb2-mobile-filter-chips crb2-mobile-filter-chips--even">
              {SIZE_OPTIONS.map((option) => <FilterChip key={option.value} option={option} active={sizeFilters.has(option.value)} onClick={() => setValues("sz", sizeFilters, option.value)} />)}
            </div>
          </section>
          <section>
            <h3>Grade</h3>
            <div className="crb2-mobile-filter-chips crb2-mobile-filter-chips--even">
              {GRADE_OPTIONS.map((option) => <FilterChip key={option.value} option={option} active={gradeFilters.has(option.value)} onClick={() => setValues("gr", gradeFilters, option.value)} />)}
            </div>
          </section>
          <section>
            <h3>Class</h3>
            <div className="crb2-mobile-filter-chips">
              {CLASS_OPTIONS.map((option) => <FilterChip key={option.value} option={option} active={classFilters.has(option.value)} onClick={() => setValues("cl", classFilters, option.value)} />)}
            </div>
          </section>
          <section className="crb2-mobile-materials">
            <h3>Materials</h3>
            <label className="crb2-material-search">
              <span aria-hidden="true">/</span>
              <input type="search" aria-label="Search materials" value={materialQuery} onChange={(event) => setMaterialQuery(event.target.value)} placeholder="What can I make with this material?" />
            </label>
            <div className="crb2-mobile-material-options">
              {filteredMaterialOptions.map((option) => (
                <button key={option.value} type="button" aria-pressed={materialFilters.has(option.value)} className={`crb2-material-option${materialFilters.has(option.value) ? " crb2-material-option--active" : ""}`} onClick={() => setValues("mt", materialFilters, option.value)}>
                  <span>{option.label}</span><span>{option.count?.toLocaleString()}</span>
                </button>
              ))}
              {!filteredMaterialOptions.length ? <p className="crb2-material-empty">No materials match that search.</p> : null}
            </div>
          </section>
        </div>
      </MobileFilterSheet>
    </header>
  );
}
