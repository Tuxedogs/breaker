import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { buildResourceGroups } from "../../shared/msbResourceGroups";
import type { ComponentCardIndex, ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { useCraftingContext } from "../CraftingContext";
import {
  getRecipeBrowserSearchParam,
  hasExplicitVehicleFilter,
  isRecipeBrowserDefaultState,
  parseRecipeBrowserFilterSet,
} from "../utils/recipeBrowserFilters";

const PistolIcon = ({ className = "" }: { className?: string }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3.5 8.5h11.8l1.1 1.8H21v3.1h-6.2l-1.7 1.7H9.6" />
    <path d="M8.8 13.4l-1.2 6.1H4.9l-.8-6.1" />
    <path d="M10.4 13.4v2.2" />
    <path d="M16.2 10.3h2.2" />
  </svg>
);

const BulletsIcon = ({ className = "" }: { className?: string }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 4.5c1.1.9 1.7 2 1.7 3.3v10.7H4.3V7.8c0-1.3.6-2.4 1.7-3.3Z" />
    <path d="M12 4.5c1.1.9 1.7 2 1.7 3.3v10.7h-3.4V7.8c0-1.3.6-2.4 1.7-3.3Z" />
    <path d="M18 4.5c1.1.9 1.7 2 1.7 3.3v10.7h-3.4V7.8c0-1.3.6-2.4 1.7-3.3Z" />
    <path d="M4.4 15.6h3.2" />
    <path d="M10.4 15.6h3.2" />
    <path d="M16.4 15.6h3.2" />
  </svg>
);

// ── Inline SVG icons for component type filter chips ──────────────────────────
const TYPE_ICONS: Record<string, React.ReactNode> = {
  // FPS
  ammo:        <BulletsIcon />,
  armor:       <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 2 3 4.5v4.3C3 12.2 5.2 14.7 8 15.5c2.8-.8 5-3.3 5-6.7V4.5L8 2Z"/></svg>,
  weapons:     <PistolIcon />,
  // Vehicle
  cooler:      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="8" y1="1" x2="8" y2="15"/><line x1="1" y1="8" x2="15" y2="8"/><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>,
  powerplant:  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 2 5 9h4l-2 5 6-7H9L9 2Z"/></svg>,
  quantumdrive:<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="2"/><circle cx="8" cy="8" r="5.5"/><path d="M8 2.5V1M8 15v-1.5M2.5 8H1M15 8h-1.5"/></svg>,
  radar:       <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="2"/><path d="M8 3a5 5 0 0 1 0 10M8 5.5a2.5 2.5 0 0 1 0 5"/></svg>,
  shield:      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 1.5 2.5 4v4.2C2.5 11.5 4.9 14.2 8 15c3.1-.8 5.5-3.5 5.5-6.8V4L8 1.5Z"/></svg>,
  weaponGun:   <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="2"/><line x1="8" y1="1" x2="8" y2="5"/><line x1="8" y1="11" x2="8" y2="15"/><line x1="1" y1="8" x2="5" y2="8"/><line x1="11" y1="8" x2="15" y2="8"/></svg>,
  __utility__: <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 3a2 2 0 0 0-3.4-1.4L8 3.2 6.5 1.7A2 2 0 0 0 3 3l1.5 1.5-2 2A2 2 0 0 0 4 10l1.5-1.5 1.5 1.5v2a1 1 0 0 0 2 0v-2l1.5-1.5L12 10a2 2 0 0 0 1.5-3.5l-2-2L13 3Z"/></svg>,
};

const UTILITY_TYPES = new Set(["dockingCollar", "salvageHead", "salvageModifier", "weaponMining"]);

const VEHICLE_FILTER_ORDER = [
  { value: "weaponGun", label: "Weapons" },
  { value: "shield", label: "Shields" },
  { value: "powerplant", label: "Power Plants" },
  { value: "quantumdrive", label: "Quantum Drives" },
  { value: "radar", label: "Radars" },
  { value: "cooler", label: "Coolers" },
  { value: "tractorbeam", label: "Tractor Beams" },
];

const FPS_FILTER_ORDER = [
  { value: "ammo", label: "Ammo" },
  { value: "armor", label: "Armor" },
  { value: "weapons", label: "Weapons" },
];

const SIZE_FILTER_ORDER = ["1", "2", "3", "4", "5", "6"];
const GRADE_FILTER_ORDER = ["A", "B", "C", "D"];
const CLASS_FILTER_ORDER = [
  { value: "military", label: "Military" },
  { value: "stealth", label: "Stealth" },
  { value: "civilian", label: "Civilian" },
  { value: "industrial", label: "Industrial" },
];

type FilterOption = {
  value: string;
  label: string;
};

type ActiveFilterToken = FilterOption & {
  kind: "fps" | "vehicle" | "size" | "grade" | "class" | "material" | "saved";
};

function buildMaterialOptions(
  materialFacets: ComponentCardIndex["facets"]["materials"] | undefined,
  records: ComponentCardIndexRecord[],
): FilterOption[] {
  const byName = new Map<string, FilterOption>();

  if (materialFacets?.length) {
    for (const material of materialFacets) {
      const label = material.label?.trim();
      const value = material.value?.trim();
      if (!label || !value) continue;
      byName.set(value.toLowerCase(), { value, label });
    }
  } else {
    for (const record of records) {
      for (const material of record.materials ?? []) {
        const label = material.name?.trim();
        if (!label) continue;
        const value = material.costId ?? material.materialId ?? label;
        const key = value.toLowerCase();
        if (!byName.has(key)) byName.set(key, { value, label });
      }
    }
  }

  const groups = buildResourceGroups([...byName.values()].map((o) => ({ id: o.value, label: o.label })));
  return [
    ...groups.shipAndHarvestable,
    ...groups.vehicle,
    ...groups.hand,
  ].slice(0, 36).map((chip) => ({ value: chip.id, label: chip.label }));
}

function toggleSetValue(prev: Set<string>, value: string): Set<string> {
  const next = new Set(prev);
  if (next.has(value)) { next.delete(value); } else { next.add(value); }
  return next;
}

function useMobileToolbarLayout() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isMobile;
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
  const normalizedPath = location.pathname.replace(/\/+$/, "");
  const isDetailRoute = normalizedPath !== "/industry/crafting";

  const isDefaultState = isRecipeBrowserDefaultState(searchParams);

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

  const applySearchParams = useCallback((
    updater: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams),
  ) => {
    const resolveNext = (prev: URLSearchParams) => (
      typeof updater === "function" ? updater(prev) : updater
    );

    if (isDetailRoute) {
      const next = resolveNext(searchParams);
      const query = next.toString();
      navigate(`/industry/crafting${query ? `?${query}` : ""}`, { replace: true });
      return;
    }

    setSearchParams((prev) => resolveNext(prev), { replace: true });
  }, [isDetailRoute, navigate, searchParams, setSearchParams]);

  const setParam = useCallback((key: string, value: string | null | undefined) => {
    applySearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (key === "search") next.delete("q");
      if (value == null || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      if (key !== "pg") next.delete("pg");
      return next;
    });
  }, [applySearchParams]);

  const setSearch = useCallback((value: string) => setParam("search", value || null), [setParam]);
  const setVehicleFilters = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    const next = updater(vehicleFilters);
    setParam("v", next.size ? [...next].join(",") : null);
  }, [vehicleFilters, setParam]);
  const setFpsFilters = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    const next = updater(fpsFilters);
    setParam("f", next.size ? [...next].join(",") : null);
  }, [fpsFilters, setParam]);
  const setSizeFilters = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    const next = updater(sizeFilters);
    setParam("sz", next.size ? [...next].join(",") : null);
  }, [sizeFilters, setParam]);
  const setGradeFilters = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    const next = updater(gradeFilters);
    setParam("gr", next.size ? [...next].join(",") : null);
  }, [gradeFilters, setParam]);
  const setClassFilters = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    const next = updater(classFilters);
    setParam("cl", next.size ? [...next].join(",") : null);
  }, [classFilters, setParam]);
  const setMaterialFilters = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    const next = updater(materialFilters);
    setParam("mt", next.size ? [...next].join(",") : null);
  }, [materialFilters, setParam]);
  const setSavedOnly = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof value === "function" ? value(savedOnly) : value;
    setParam("bk", next ? "1" : null);
  }, [savedOnly, setParam]);

  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [materialDropdownPosition, setMaterialDropdownPosition] = useState({ left: 0, top: 0 });
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [desktopFiltersExpanded, setDesktopFiltersExpanded] = useState(false);
  const [toolbarScrolled, setToolbarScrolled] = useState(false);
  const [drawerMaterialSearch, setDrawerMaterialSearch] = useState("");
  const isMobileLayout = useMobileToolbarLayout();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const materialPickerRef = useRef<HTMLDivElement>(null);
  const materialDropdownRef = useRef<HTMLDivElement>(null);
  const isMobileDrawerOpen = isMobileLayout && mobileFilterOpen;
  const isDesktopFiltersOpen = !isMobileLayout && desktopFiltersExpanded;
  const isMaterialPickerVisible = !isMobileLayout && materialPickerOpen;

  const updateMaterialDropdownPosition = useCallback(() => {
    const toolbar = toolbarRef.current;
    const picker = materialPickerRef.current;
    if (!toolbar || !picker) return;
    const toolbarRect = toolbar.getBoundingClientRect();
    const pickerRect = picker.getBoundingClientRect();
    setMaterialDropdownPosition({
      left: pickerRect.left - toolbarRect.left,
      top: pickerRect.bottom - toolbarRect.top + 4,
    });
  }, []);

  useEffect(() => {
    if (!isMaterialPickerVisible) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        materialPickerRef.current &&
        !materialPickerRef.current.contains(target) &&
        !materialDropdownRef.current?.contains(target)
      ) {
        setMaterialPickerOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isMaterialPickerVisible]);

  useEffect(() => {
    if (!isMaterialPickerVisible) return;
    updateMaterialDropdownPosition();
    window.addEventListener("resize", updateMaterialDropdownPosition);
    window.addEventListener("scroll", updateMaterialDropdownPosition, true);
    return () => {
      window.removeEventListener("resize", updateMaterialDropdownPosition);
      window.removeEventListener("scroll", updateMaterialDropdownPosition, true);
    };
  }, [isMaterialPickerVisible, updateMaterialDropdownPosition]);

  useEffect(() => {
    const scrollRoot = toolbarRef.current?.closest(".component-results-browser");
    if (!scrollRoot) return;
    const onScroll = () => setToolbarScrolled(scrollRoot.scrollTop > 12);
    onScroll();
    scrollRoot.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollRoot.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isMobileDrawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileDrawerOpen]);

  useEffect(() => {
    if (!isMobileDrawerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileFilterOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobileDrawerOpen]);

  const vehicleOptions = useMemo<FilterOption[]>(() => {
    const values = new Set<string>();
    let hasUtility = false;
    for (const record of records) {
      if (record.kind === "fps") continue;
      const type = record.type;
      if (!type) continue;
      if (UTILITY_TYPES.has(type)) { hasUtility = true; } else { values.add(type); }
    }
    const ordered = VEHICLE_FILTER_ORDER.filter((o) => values.has(o.value));
    const orderedValues = new Set(ordered.map((o) => o.value));
    const additional = [...values]
      .filter((v) => !orderedValues.has(v))
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({
        value: v,
        label: records.find((r) => r.kind !== "fps" && r.type === v)?.typeLabel ?? v,
      }));
    const options = [...ordered, ...additional];
    if (hasUtility) options.push({ value: "__utility__", label: "Utility" });
    return options;
  }, [records]);

  const fpsOptions = useMemo<FilterOption[]>(() => {
    const values = new Map<string, string>(
      records
        .filter((r) => r.kind === "fps")
        .map((r) => [r.type, r.typeLabel] as const)
        .filter(([v]) => Boolean(v)),
    );
    const ordered = FPS_FILTER_ORDER.filter((o) => values.has(o.value));
    const orderedValues = new Set(ordered.map((o) => o.value));
    const additional = [...values.entries()]
      .filter(([v]) => !orderedValues.has(v))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, label]) => ({ value, label }));
    return [...ordered, ...additional];
  }, [records]);

  const sizeOptions = useMemo<FilterOption[]>(() => {
    const values = new Set(
      records.filter((r) => r.kind !== "fps" && r.size !== null).map((r) => String(r.size)),
    );
    return SIZE_FILTER_ORDER.filter((v) => values.has(v)).map((v) => ({ value: v, label: v }));
  }, [records]);

  const gradeOptions = useMemo<FilterOption[]>(() => {
    const values = new Set(
      records.filter((r) => r.kind !== "fps" && r.grade).map((r) => r.grade as string),
    );
    return GRADE_FILTER_ORDER.filter((v) => values.has(v)).map((v) => ({ value: v, label: v }));
  }, [records]);

  const classOptions = useMemo<FilterOption[]>(() => {
    const values = new Set(
      records.filter((r) => r.kind !== "fps" && r.class).map((r) => (r.class as string).toLowerCase()),
    );
    return CLASS_FILTER_ORDER.filter((o) => values.has(o.value));
  }, [records]);

  const materialOptions = useMemo(
    () => buildMaterialOptions(componentCardFacets?.materials, records),
    [componentCardFacets?.materials, records],
  );

  const drawerMaterialOptions = useMemo(() => {
    const query = drawerMaterialSearch.trim().toLowerCase();
    if (!query) return materialOptions;
    return materialOptions.filter((option) => option.label.toLowerCase().includes(query));
  }, [drawerMaterialSearch, materialOptions]);

  const showVehicleFacets = fpsFilters.size === 0 || vehicleFilters.size > 0;

  const advancedFilterCount =
    vehicleFilters.size +
    fpsFilters.size +
    sizeFilters.size +
    gradeFilters.size +
    classFilters.size +
    materialFilters.size;

  const hasFilters = !isDefaultState && Boolean(
    search || vehicleFilters.size || fpsFilters.size || sizeFilters.size ||
    gradeFilters.size || classFilters.size || materialFilters.size || savedOnly,
  );

  const activeMaterialOptions = useMemo(
    () => materialOptions.filter((opt) => materialFilters.has(opt.value)),
    [materialOptions, materialFilters],
  );
  const hasVehicleFilter = useMemo(() => hasExplicitVehicleFilter(searchParams), [searchParams]);

  const activeFilterTokens = useMemo<ActiveFilterToken[]>(() => {
    const tokens: ActiveFilterToken[] = [];
    for (const v of fpsFilters) {
      const opt = fpsOptions.find((o) => o.value === v);
      if (opt) tokens.push({ value: v, label: opt.label, kind: "fps" });
    }
    if (hasVehicleFilter) {
      for (const v of vehicleFilters) {
        const opt = vehicleOptions.find((o) => o.value === v);
        if (opt) tokens.push({ value: v, label: opt.label, kind: "vehicle" });
      }
    }
    for (const v of sizeFilters) {
      const opt = sizeOptions.find((o) => o.value === v);
      if (opt) tokens.push({ value: v, label: `Size ${opt.label}`, kind: "size" });
    }
    for (const v of gradeFilters) {
      const opt = gradeOptions.find((o) => o.value === v);
      if (opt) tokens.push({ value: v, label: `Grade ${opt.label}`, kind: "grade" });
    }
    for (const v of classFilters) {
      const opt = classOptions.find((o) => o.value === v);
      if (opt) tokens.push({ value: v, label: opt.label, kind: "class" });
    }
    for (const opt of activeMaterialOptions) {
      tokens.push({ ...opt, kind: "material" });
    }
    if (savedOnly) tokens.push({ value: "saved", label: "Bookmarked", kind: "saved" });
    return tokens;
  }, [activeMaterialOptions, classFilters, classOptions, fpsFilters, fpsOptions, gradeFilters, gradeOptions, hasVehicleFilter, savedOnly, sizeFilters, sizeOptions, vehicleFilters, vehicleOptions]);

  function clearFilters() {
    applySearchParams(new URLSearchParams());
  }

  function removeActiveFilter(token: ActiveFilterToken) {
    if (token.kind === "fps") setFpsFilters((prev) => toggleSetValue(prev, token.value));
    if (token.kind === "vehicle") setVehicleFilters((prev) => toggleSetValue(prev, token.value));
    if (token.kind === "size") setSizeFilters((prev) => toggleSetValue(prev, token.value));
    if (token.kind === "grade") setGradeFilters((prev) => toggleSetValue(prev, token.value));
    if (token.kind === "class") setClassFilters((prev) => toggleSetValue(prev, token.value));
    if (token.kind === "material") setMaterialFilters((prev) => toggleSetValue(prev, token.value));
    if (token.kind === "saved") setSavedOnly(false);
  }

  const mobileFilterDrawer = isMobileDrawerOpen ? createPortal(
    <div
      className="crb-mobile-drawer-backdrop"
      role="presentation"
      onClick={() => setMobileFilterOpen(false)}
    >
      <section
        className="crb-mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crb-mobile-drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="crb-mobile-drawer-head">
          <h2 id="crb-mobile-drawer-title">Filters</h2>
          <button
            type="button"
            className="crb-mobile-drawer-close"
            aria-label="Close filters"
            onClick={() => setMobileFilterOpen(false)}
          >
            ×
          </button>
        </header>

        <div className="crb-mobile-drawer-body">
          {vehicleOptions.length > 0 && (
            <section className="crb-drawer-section">
              <h3 className="crb-drawer-section-label">Type</h3>
              <div className="crb-drawer-chip-grid" role="group" aria-label="Component type filters">
                {vehicleOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`craft-frl-chip${vehicleFilters.has(option.value) ? " craft-frl-chip--active" : ""}`}
                    onClick={() => setVehicleFilters((prev) => toggleSetValue(prev, option.value))}
                  >
                    {TYPE_ICONS[option.value]}
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {fpsOptions.length > 0 && (
            <section className="crb-drawer-section">
              <h3 className="crb-drawer-section-label">FPS</h3>
              <div className="crb-drawer-chip-grid" role="group" aria-label="FPS filters">
                {fpsOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`craft-frl-chip${fpsFilters.has(option.value) ? " craft-frl-chip--active" : ""}`}
                    onClick={() => setFpsFilters((prev) => toggleSetValue(prev, option.value))}
                  >
                    {TYPE_ICONS[option.value]}
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {showVehicleFacets && sizeOptions.length > 0 && (
            <section className="crb-drawer-section">
              <h3 className="crb-drawer-section-label">Size</h3>
              <div className="crb-drawer-chip-grid" role="group" aria-label="Size filters">
                {sizeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`craft-frl-chip craft-frl-chip--sm${sizeFilters.has(option.value) ? " craft-frl-chip--active" : ""}`}
                    onClick={() => setSizeFilters((prev) => toggleSetValue(prev, option.value))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {showVehicleFacets && gradeOptions.length > 0 && (
            <section className="crb-drawer-section">
              <h3 className="crb-drawer-section-label">Grade</h3>
              <div className="crb-drawer-chip-grid" role="group" aria-label="Grade filters">
                {gradeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`craft-frl-chip craft-frl-chip--sm${gradeFilters.has(option.value) ? " craft-frl-chip--active" : ""}`}
                    onClick={() => setGradeFilters((prev) => toggleSetValue(prev, option.value))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {showVehicleFacets && classOptions.length > 0 && (
            <section className="crb-drawer-section">
              <h3 className="crb-drawer-section-label">Category</h3>
              <div className="crb-drawer-chip-grid" role="group" aria-label="Category filters">
                {classOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`craft-frl-chip craft-frl-chip--sm${classFilters.has(option.value) ? " craft-frl-chip--active" : ""}`}
                    onClick={() => setClassFilters((prev) => toggleSetValue(prev, option.value))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {materialOptions.length > 0 && (
            <section className="crb-drawer-section">
              <h3 className="crb-drawer-section-label">Materials</h3>
              <label className="crb-drawer-material-search">
                <span className="craft-search-icon" aria-hidden="true">/</span>
                <input
                  type="search"
                  aria-label="Search materials"
                  value={drawerMaterialSearch}
                  onChange={(event) => setDrawerMaterialSearch(event.target.value)}
                  placeholder="Search materials..."
                />
              </label>
              <div className="crb-drawer-chip-grid crb-drawer-chip-grid--materials" role="group" aria-label="Material filters">
                {drawerMaterialOptions.map((option) => (
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
            </section>
          )}
        </div>

        <footer className="crb-mobile-drawer-foot">
          <button
            type="button"
            className="crb-drawer-apply-btn"
            onClick={() => setMobileFilterOpen(false)}
          >
            Apply Filters
          </button>
          <button
            type="button"
            className="crb-drawer-clear-btn"
            onClick={() => {
              clearFilters();
              setDrawerMaterialSearch("");
            }}
            disabled={!hasFilters}
          >
            Clear Filters
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  ) : null;

  const filtersExpanded = isMobileLayout ? isMobileDrawerOpen : isDesktopFiltersOpen;
  const activeSummaryCount = advancedFilterCount + (savedOnly ? 1 : 0);

  return (
    <div
      className={[
        "scintel-filter-shell",
        "component-browser-toolbar",
        "recipe-browser-toolbarShell",
        filtersExpanded ? "scintel-filter-shell--expanded" : "",
        toolbarScrolled ? "crb-toolbar--scrolled" : "",
        isMobileDrawerOpen ? "crb-toolbar--drawer-open" : "",
      ].filter(Boolean).join(" ")}
      ref={toolbarRef}
    >

      {/* ── Search + filter toggle + bookmarks/count ── */}
      <div className="scintel-filter-header crb-row--search crb-row--mobile-header">
        <div className="scintel-filter-search">
          <label className="component-browser-search">
            <span className="craft-search-icon" aria-hidden="true">/</span>
            <input
              type="search"
              aria-label="Search components"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search components, type, material, GUID..."
            />
            <span className="crb-search-slash" aria-hidden="true">/</span>
          </label>
        </div>
        <div className="scintel-filter-actions">
          {!isMobileLayout && materialOptions.length > 0 ? (
            <div className="crb-material-picker crb-material-picker--toolbar" ref={materialPickerRef}>
              <button
                type="button"
                className={`crb-material-trigger crb-material-trigger--toolbar${isMaterialPickerVisible ? " crb-material-trigger--open" : ""}${materialFilters.size > 0 ? " crb-material-trigger--active" : ""}`}
                onClick={() => {
                  updateMaterialDropdownPosition();
                  setMaterialPickerOpen((open) => !open);
                }}
                aria-expanded={isMaterialPickerVisible}
              >
                {materialFilters.size > 0 ? `${materialFilters.size} selected` : "Materials"}
                <span className="crb-material-chevron" aria-hidden="true">▾</span>
              </button>
            </div>
          ) : null}
          {hasFilters && !filtersExpanded && !isMobileLayout ? (
            <span className="scintel-filter-summary">{activeSummaryCount} active</span>
          ) : null}
          <button
            type="button"
            className={[
              "scintel-filter-toggle",
              "crb-filters-btn",
              advancedFilterCount > 0 ? "crb-filters-btn--active" : "",
            ].filter(Boolean).join(" ")}
            aria-expanded={filtersExpanded}
            onClick={() => {
              if (isMobileLayout) setMobileFilterOpen((open) => !open);
              else setDesktopFiltersExpanded((open) => !open);
            }}
          >
            {filtersExpanded ? "Hide" : "Filters"}
            {activeSummaryCount > 0 ? (
              <span className="scintel-filter-toggle-count">{activeSummaryCount}</span>
            ) : null}
          </button>
          {hasFilters && !filtersExpanded && !isMobileLayout ? (
            <button type="button" className="scintel-filter-clear" onClick={clearFilters}>
              Clear
            </button>
          ) : null}
          <div className="crb-mobile-inline-actions" aria-label="Recipe browser controls">
            <button
              type="button"
              className={`crb-bookmarks-btn crb-bookmarks-btn--chip${savedOnly ? " crb-bookmarks-btn--active" : ""}`}
              aria-pressed={savedOnly}
              onClick={() => setSavedOnly((value) => !value)}
            >
              <span className="crb-bookmarks-icon" aria-hidden="true">☆</span>
              Bookmarked
            </button>
          </div>
        </div>
        <button
          type="button"
          className={`crb-bookmarks-btn crb-bookmarks-btn--desktop${savedOnly ? " crb-bookmarks-btn--active" : ""}`}
          onClick={() => setSavedOnly((v) => !v)}
        >
          <span className="crb-bookmarks-icon" aria-hidden="true">☆</span>
          Blueprint Bookmarks
        </button>
        <span className="component-browser-count">
          <strong>{resultCount.toLocaleString()}</strong> components found
        </span>
      </div>

      <div className="crb-row crb-row--mobile-controls" aria-label="Recipe browser filters">
        <button
          type="button"
          className={[
            "scintel-filter-toggle",
            "crb-filters-btn",
            advancedFilterCount > 0 ? "crb-filters-btn--active" : "",
          ].filter(Boolean).join(" ")}
          aria-expanded={isMobileDrawerOpen}
          onClick={() => setMobileFilterOpen((open) => !open)}
        >
          {isMobileDrawerOpen ? "Hide" : "Filters"}
          {activeSummaryCount > 0 ? (
            <span className="scintel-filter-toggle-count">{activeSummaryCount}</span>
          ) : null}
        </button>
        <button
          type="button"
          className={`crb-bookmarks-btn crb-bookmarks-btn--chip${savedOnly ? " crb-bookmarks-btn--active" : ""}`}
          aria-pressed={savedOnly}
          onClick={() => setSavedOnly((value) => !value)}
        >
          <span className="crb-bookmarks-icon" aria-hidden="true">☆</span>
          Bookmarked
        </button>
        {hasFilters && !isMobileDrawerOpen ? (
          <button type="button" className="scintel-filter-clear" onClick={clearFilters}>
            Clear
          </button>
        ) : null}
      </div>

      {isDesktopFiltersOpen ? (
      <div className="scintel-filter-body recipe-browser-filterDrawer">
      {/* ── Desktop: Category groups — Vehicle | FPS ── */}
      <div className="crb-row crb-row--categories crb-row--desktop-filters">
        <div className="crb-category-group crb-category-group--vehicle">
          <span className="crb-section-label crb-section-label--vehicle">Vehicle</span>
          <div className="crb-chip-group crb-chip-group--vehicle" role="group" aria-label="Vehicle component filters">
            {vehicleOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`craft-frl-chip${vehicleFilters.has(option.value) ? " craft-frl-chip--active" : ""}`}
                onClick={() => setVehicleFilters((prev) => toggleSetValue(prev, option.value))}
              >
                {TYPE_ICONS[option.value]}
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <span className="crb-group-divider" aria-hidden="true" />

        <div className="crb-category-group crb-category-group--fps">
          <span className="crb-section-label crb-section-label--fps">FPS</span>
          <div className="crb-chip-group" role="group" aria-label="FPS filters">
            {fpsOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`craft-frl-chip${fpsFilters.has(option.value) ? " craft-frl-chip--active" : ""}`}
                onClick={() => setFpsFilters((prev) => toggleSetValue(prev, option.value))}
              >
                {TYPE_ICONS[option.value]}
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Desktop: Contextual facets (vehicle only) ── */}
      <div className="crb-row crb-row--facets crb-row--desktop-filters">
        {showVehicleFacets && sizeOptions.length > 0 && (
          <div className="crb-facet-group crb-facet-group--size">
            <span className="crb-section-label">Size</span>
            <span className="crb-section-divider" aria-hidden="true" />
            <div className="crb-chip-group crb-chip-group--size" role="group" aria-label="Size filters">
              {sizeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`craft-frl-chip craft-frl-chip--sm${sizeFilters.has(option.value) ? " craft-frl-chip--active" : ""}`}
                  onClick={() => setSizeFilters((prev) => toggleSetValue(prev, option.value))}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="crb-section-divider" aria-hidden="true" />
          </div>
        )}
        {showVehicleFacets && gradeOptions.length > 0 && (
          <div className="crb-facet-group crb-facet-group--grade">
            <span className="crb-section-label">Grade</span>
            <span className="crb-section-divider" aria-hidden="true" />
            <div className="crb-chip-group crb-chip-group--grade" role="group" aria-label="Grade filters">
              {gradeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`craft-frl-chip craft-frl-chip--sm${gradeFilters.has(option.value) ? " craft-frl-chip--active" : ""}`}
                  onClick={() => setGradeFilters((prev) => toggleSetValue(prev, option.value))}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="crb-section-divider" aria-hidden="true" />
          </div>
        )}
        {showVehicleFacets && classOptions.length > 0 && (
          <div className="crb-facet-group crb-facet-group--class">
            <span className="crb-section-label">Class</span>
            <span className="crb-section-divider" aria-hidden="true" />
            <div className="crb-chip-group crb-chip-group--class" role="group" aria-label="Class filters">
              {classOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`craft-frl-chip craft-frl-chip--sm${classFilters.has(option.value) ? " craft-frl-chip--active" : ""}`}
                  onClick={() => setClassFilters((prev) => toggleSetValue(prev, option.value))}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {(sizeOptions.length > 0 || gradeOptions.length > 0) && <span className="crb-section-divider" aria-hidden="true" />}
          </div>
        )}
      </div>

      {hasFilters && (
        <div className="crb-row crb-row--active-filters">
          <span className="crb-section-label crb-active-label--desktop">Active Filters</span>
          <span className="crb-section-divider crb-active-label--desktop" aria-hidden="true" />
          {activeFilterTokens.map((tok) => (
            <button
              key={`${tok.kind}:${tok.value}`}
              type="button"
              className={`crb-token${tok.kind === "material" ? " crb-token--material" : " crb-token--type"}`}
              onClick={() => removeActiveFilter(tok)}
            >
              {(tok.kind === "fps" || tok.kind === "vehicle") && TYPE_ICONS[tok.value]}
              {tok.label}
              <span className="crb-token-x" aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" className="crb-clear-all crb-clear-all--desktop scintel-filter-clear" onClick={clearFilters}>
            Clear All
            <span className="crb-clear-all-icon" aria-hidden="true">🗑</span>
          </button>
        </div>
      )}
      </div>
      ) : null}

      {/* ── Material picker dropdown (desktop toolbar) ── */}
      {isMaterialPickerVisible && (
        <div
          className="crb-material-dropdown crb-material-dropdown--toolbar"
          ref={materialDropdownRef}
          role="listbox"
          aria-label="Select materials"
          style={{
            left: materialDropdownPosition.left,
            top: materialDropdownPosition.top,
          }}
        >
          {materialOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={materialFilters.has(option.value)}
              className={`crb-material-option${materialFilters.has(option.value) ? " crb-material-option--active" : ""}`}
              onClick={() => setMaterialFilters((prev) => toggleSetValue(prev, option.value))}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {isMobileLayout && hasFilters && (
        <div className="crb-row crb-row--active-filters">
          {activeFilterTokens.map((tok) => (
            <button
              key={`${tok.kind}:${tok.value}`}
              type="button"
              className={`crb-token${tok.kind === "material" ? " crb-token--material" : " crb-token--type"}`}
              onClick={() => removeActiveFilter(tok)}
            >
              {(tok.kind === "fps" || tok.kind === "vehicle") && TYPE_ICONS[tok.value]}
              {tok.label}
              <span className="crb-token-x" aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}

      {mobileFilterDrawer}
    </div>
  );
}
