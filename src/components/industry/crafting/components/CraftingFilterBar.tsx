import {
  Fragment,
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
  getRecipeBrowserSearchParam,
  isRecipeBrowserDefaultState,
  parseRecipeBrowserFilterSet,
} from "../utils/recipeBrowserFilters";
import { buildRecipeBrowserMaterialOptions } from "../utils/recipeBrowserMaterialOptions";

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
}: {
  records: ComponentCardIndexRecord[];
  resultCount: number;
}) {
  const { componentCardFacets } = useCraftingContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDetailRoute = location.pathname.replace(/\/+$/, "") !== "/industry/crafting";
  const search = getRecipeBrowserSearchParam(searchParams);
  const vehicleFilters = useMemo(
    () => parseRecipeBrowserFilterSet(searchParams, "v"),
    [searchParams],
  );
  const fpsFilters = useMemo(
    () => parseRecipeBrowserFilterSet(searchParams, "f"),
    [searchParams],
  );
  const sizeFilters = useMemo(
    () => parseRecipeBrowserFilterSet(searchParams, "sz"),
    [searchParams],
  );
  const gradeFilters = useMemo(
    () => parseRecipeBrowserFilterSet(searchParams, "gr"),
    [searchParams],
  );
  const classFilters = useMemo(
    () => parseRecipeBrowserFilterSet(searchParams, "cl"),
    [searchParams],
  );
  const materialFilters = useMemo(
    () => parseRecipeBrowserFilterSet(searchParams, "mt"),
    [searchParams],
  );
  const savedOnly = searchParams.get("bk") === "1";
  const defaultVehicleWeapon = isRecipeBrowserDefaultState(searchParams);

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

  const materialOptions = useMemo(
    () => buildRecipeBrowserMaterialOptions(componentCardFacets?.materials, records),
    [componentCardFacets?.materials, records],
  );
  const [materialOpen, setMaterialOpen] = useState(false);
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
    if (!materialOpen) return;
    materialSearchRef.current?.focus();
  }, [materialOpen]);

  useEffect(() => {
    if (!materialOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!materialRootRef.current?.contains(event.target as Node)) setMaterialOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [materialOpen]);

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
  const activeCount = vehicleFilters.size
    + fpsFilters.size
    + sizeFilters.size
    + gradeFilters.size
    + classFilters.size
    + materialFilters.size
    + (savedOnly ? 1 : 0)
    + (search ? 1 : 0);

  const clearFilters = () => applySearchParams(() => new URLSearchParams());

  return (
    <header className="crb2-toolbar">
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
          <span aria-hidden="true">☆</span>
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
      </div>

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
            <Fragment key={option.value}>
              <FilterChip
                option={option}
                active={classFilters.has(option.value)}
                onClick={() => setValues("cl", classFilters, option.value)}
              />
              {option.value === "competition" ? (
                <FilterChip
                  option={VEHICLE_CATEGORY_OPTIONS[0]}
                  active={defaultVehicleWeapon || vehicleFilters.has("weaponGun")}
                  onClick={() => setValues("v", vehicleFilters, "weaponGun")}
                />
              ) : null}
            </Fragment>
          ))}
          <span className="crb2-filter-divider" aria-hidden="true" />
          {VEHICLE_CATEGORY_OPTIONS.slice(1).map((option) => (
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
    </header>
  );
}
