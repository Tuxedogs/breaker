import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ComponentResultCard from "./ComponentResultCard";
import CompareTray from "./CompareTray";
import { buildResourceGroups } from "../../shared/msbResourceGroups";
import { fetchSavedBlueprints } from "@/lib/userSavedBlueprints";
import { useAuthSession } from "@/lib/auth/useAuthSession";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";

// ── Inline SVG icons for component type filter chips ──────────────────────────
const TYPE_ICONS: Record<string, React.ReactNode> = {
  // FPS
  ammo:        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="2" width="6" height="9" rx="1.5"/><path d="M6 11v2a2 2 0 0 0 4 0v-2"/><line x1="8" y1="2" x2="8" y2="0.5"/></svg>,
  armor:       <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 2 3 4.5v4.3C3 12.2 5.2 14.7 8 15.5c2.8-.8 5-3.3 5-6.7V4.5L8 2Z"/></svg>,
  weapons:     <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 10h8l2-4h2"/><path d="M10 10l1 3M2 10l1-3h5"/></svg>,
  // Vehicle
  cooler:      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="8" y1="1" x2="8" y2="15"/><line x1="1" y1="8" x2="15" y2="8"/><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>,
  powerplant:  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 2 5 9h4l-2 5 6-7H9L9 2Z"/></svg>,
  quantumdrive:<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="2"/><circle cx="8" cy="8" r="5.5"/><path d="M8 2.5V1M8 15v-1.5M2.5 8H1M15 8h-1.5"/></svg>,
  radar:       <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="2"/><path d="M8 3a5 5 0 0 1 0 10M8 5.5a2.5 2.5 0 0 1 0 5"/></svg>,
  shield:      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 1.5 2.5 4v4.2C2.5 11.5 4.9 14.2 8 15c3.1-.8 5.5-3.5 5.5-6.8V4L8 1.5Z"/></svg>,
  weaponGun:   <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="2"/><line x1="8" y1="1" x2="8" y2="5"/><line x1="8" y1="11" x2="8" y2="15"/><line x1="1" y1="8" x2="5" y2="8"/><line x1="11" y1="8" x2="15" y2="8"/></svg>,
  __utility__: <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 3a2 2 0 0 0-3.4-1.4L8 3.2 6.5 1.7A2 2 0 0 0 3 3l1.5 1.5-2 2A2 2 0 0 0 4 10l1.5-1.5 1.5 1.5v2a1 1 0 0 0 2 0v-2l1.5-1.5L12 10a2 2 0 0 0 1.5-3.5l-2-2L13 3Z"/></svg>,
};

const SAVED_BLUEPRINT_STORAGE_KEY = "scintel:recipe:bookmarks:v1";
const UTILITY_TYPES = new Set(["dockingCollar", "salvageHead", "salvageModifier", "weaponMining"]);
const DEFAULT_RESULTS_PER_PAGE = 18;

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

// Strip a quoted nickname from a component name to get the base family name.
// "A03 \"Lodestone\" Sniper Rifle" → "A03 Sniper Rifle"
// Only applies to FPS items where this pattern is used.
function getVariantGroupKey(record: ComponentCardIndexRecord): string | null {
  if (record.kind !== "fps") return null;
  const stripped = record.name.replace(/\s*"[^"]+"\s*/g, " ").replace(/\s+/g, " ").trim();
  // Only group if the stripping actually changed the name (i.e. it had a nickname).
  if (stripped === record.name.trim()) return null;
  // Group key: base name + type + kind to prevent cross-category merging.
  return `${stripped}::${record.type}::${record.kind}`;
}

// Given a group of variant records, pick the best representative to show in the browser.
// Prefer the "base" variant (no nickname in name), then alphabetical.
function pickGroupRepresentative(group: ComponentCardIndexRecord[]): ComponentCardIndexRecord {
  if (group.length === 1) return group[0];
  const base = group.find((r) => !/"\w/.test(r.name));
  return base ?? group.slice().sort((a, b) => a.name.localeCompare(b.name))[0];
}

function buildSearchTokens(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function matchesSearch(record: ComponentCardIndexRecord, queryTokens: string[]): boolean {
  if (queryTokens.length === 0) return true;
  return queryTokens.every((token) => record.searchText.includes(token));
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

function buildMaterialOptions(records: ComponentCardIndexRecord[]): FilterOption[] {
  const byName = new Map<string, FilterOption>();
  for (const record of records) {
    for (const material of record.materials ?? []) {
      const label = material.name?.trim();
      if (!label) continue;
      const value = material.costId ?? material.materialId ?? label;
      const key = value.toLowerCase();
      if (!byName.has(key)) byName.set(key, { value, label });
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
  records,
  loading,
  error,
  isRecipeQueued,
}: {
  records: ComponentCardIndexRecord[];
  loading: boolean;
  error: string | null;
  isRecipeQueued: (record: ComponentCardIndexRecord) => boolean;
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Derive all filter state from URL params ──────────────────────────────────
  // When "v" param is absent, we are in the "default state": vehicle weapons
  // are shown as the starting view. This is NOT a real filter — no chip is
  // added to Active Filters and hasFilters stays false. The chip appears
  // highlighted to orient the user, but clicking any other filter or typing
  // in search immediately moves them away from the default.
  const DEFAULT_VEHICLE_TYPE = "weaponGun";
  const isDefaultState = searchParams.get("v") === null &&
    !searchParams.get("q") && !searchParams.get("f") &&
    !searchParams.get("sz") && !searchParams.get("gr") &&
    !searchParams.get("cl") && !searchParams.get("mt") &&
    searchParams.get("bk") !== "1";

  const search = searchParams.get("q") ?? "";
  const vehicleFilters = useMemo<Set<string>>(() => {
    const raw = searchParams.get("v");
    if (raw === null) return new Set(); // default state: no filter applied, just visual scoping
    if (raw === "") return new Set();
    return new Set(raw.split(",").filter(Boolean));
  }, [searchParams]);
  const fpsFilters = useMemo<Set<string>>(() => {
    const raw = searchParams.get("f");
    return raw ? new Set(raw.split(",").filter(Boolean)) : new Set();
  }, [searchParams]);
  const sizeFilters = useMemo<Set<string>>(() => {
    const raw = searchParams.get("sz");
    return raw ? new Set(raw.split(",").filter(Boolean)) : new Set();
  }, [searchParams]);
  const gradeFilters = useMemo<Set<string>>(() => {
    const raw = searchParams.get("gr");
    return raw ? new Set(raw.split(",").filter(Boolean)) : new Set();
  }, [searchParams]);
  const classFilters = useMemo<Set<string>>(() => {
    const raw = searchParams.get("cl");
    return raw ? new Set(raw.split(",").filter(Boolean)) : new Set();
  }, [searchParams]);
  const materialFilters = useMemo<Set<string>>(() => {
    const raw = searchParams.get("mt");
    return raw ? new Set(raw.split(",").filter(Boolean)) : new Set();
  }, [searchParams]);
  const savedOnly = searchParams.get("bk") === "1";
  const page = Math.max(1, Number(searchParams.get("pg") ?? "1") || 1);

  // ── URL param setters ────────────────────────────────────────────────────────
  const setParam = useCallback((key: string, value: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === null) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      // Reset page on filter change (not when changing page itself)
      if (key !== "pg") next.delete("pg");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setSearch = useCallback((value: string) => setParam("q", value || null), [setParam]);
  const setPage = useCallback((value: number | ((prev: number) => number)) => {
    const next = typeof value === "function" ? value(page) : value;
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next <= 1) { p.delete("pg"); } else { p.set("pg", String(next)); }
      return p;
    }, { replace: true });
  }, [page, setSearchParams]);

  const setVehicleFilters = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    const next = updater(vehicleFilters);
    // Always write "v" explicitly once the user interacts, so the default
    // state doesn't silently re-apply. Empty string = no vehicle filter.
    setParam("v", next.size ? [...next].join(",") : "");
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
  const [savedBlueprintIds, setSavedBlueprintIds] = useState<Set<string>>(
    () => readStoredStringSet(SAVED_BLUEPRINT_STORAGE_KEY),
  );
  const { session } = useAuthSession();
  const materialPickerRef = useRef<HTMLDivElement>(null);

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

  // Close material picker on outside click
  useEffect(() => {
    if (!materialPickerOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (materialPickerRef.current && !materialPickerRef.current.contains(e.target as Node)) {
        setMaterialPickerOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [materialPickerOpen]);

  const vehicleOptions = useMemo<FilterOption[]>(() => {
    const values = new Set<string>();
    let hasUtility = false;
    for (const record of records) {
      if (record.kind === "fps") continue;
      const type = record.type;
      if (!type) continue;
      if (UTILITY_TYPES.has(type)) {
        hasUtility = true;
      } else {
        values.add(type);
      }
    }
    const ordered = VEHICLE_FILTER_ORDER.filter((option) => values.has(option.value));
    const orderedValues = new Set(ordered.map((option) => option.value));
    const additional = [...values]
      .filter((value) => !orderedValues.has(value))
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({
        value,
        label: records.find((record) => record.kind !== "fps" && record.type === value)?.typeLabel ?? value,
      }));
    const options = [...ordered, ...additional];
    if (hasUtility) options.push({ value: "__utility__", label: "Utility" });
    return options;
  }, [records]);

  const fpsOptions = useMemo<FilterOption[]>(() => {
    const values = new Map<string, string>(
      records
        .filter((record) => record.kind === "fps")
        .map((record) => [record.type, record.typeLabel] as const)
        .filter(([value]) => Boolean(value)),
    );
    const ordered = FPS_FILTER_ORDER.filter((option) => values.has(option.value));
    const orderedValues = new Set(ordered.map((option) => option.value));
    const additional = [...values.entries()]
      .filter(([value]) => !orderedValues.has(value))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, label]) => ({ value, label }));
    return [...ordered, ...additional];
  }, [records]);

  const sizeOptions = useMemo<FilterOption[]>(() => {
    const values = new Set(
      records
        .filter((record) => record.kind !== "fps" && record.size !== null)
        .map((record) => String(record.size)),
    );
    return SIZE_FILTER_ORDER.filter((value) => values.has(value)).map((value) => ({ value, label: value }));
  }, [records]);

  const gradeOptions = useMemo<FilterOption[]>(() => {
    const values = new Set(
      records
        .filter((record) => record.kind !== "fps" && record.grade)
        .map((record) => record.grade as string),
    );
    return GRADE_FILTER_ORDER.filter((value) => values.has(value)).map((value) => ({ value, label: value }));
  }, [records]);

  const classOptions = useMemo<FilterOption[]>(() => {
    const values = new Set(
      records
        .filter((record) => record.kind !== "fps" && record.class)
        .map((record) => (record.class as string).toLowerCase()),
    );
    return CLASS_FILTER_ORDER.filter((option) => values.has(option.value));
  }, [records]);

  const materialOptions = useMemo(() => buildMaterialOptions(records), [records]);
  const searchTokens = useMemo(() => buildSearchTokens(search), [search]);

  // Size/Grade/Class are only meaningful for vehicle components.
  // Show them when: no kind filter is set (mixed view) OR at least one vehicle filter is active.
  // Hide them when only FPS filters are active.
  const showVehicleFacets = fpsFilters.size === 0 || vehicleFilters.size > 0;

  const filteredRecords = useMemo(() => {
    return records
      .filter((record) => {
        if (savedOnly && !savedBlueprintIds.has(record.id)) return false;
        // FPS items are never shown unless an FPS filter is explicitly active.
        if (record.kind === "fps") {
          if (fpsFilters.size === 0 || !fpsFilters.has(record.type)) return false;
        } else {
          // Vehicle: apply vehicle type filter, or default-scope to weaponGun.
          if (fpsFilters.size > 0) return false; // FPS-only filter mode hides vehicle items
          if (vehicleFilters.size) {
            const type = record.type;
            const utilityMatch = vehicleFilters.has("__utility__") && UTILITY_TYPES.has(type);
            if (!vehicleFilters.has(type) && !utilityMatch) return false;
          } else if (isDefaultState) {
            if (record.type !== DEFAULT_VEHICLE_TYPE) return false;
          }
        }
        if (sizeFilters.size && !sizeFilters.has(record.size !== null ? String(record.size) : "")) return false;
        if (gradeFilters.size && !gradeFilters.has(record.grade ?? "")) return false;
        if (classFilters.size && !classFilters.has(record.class?.toLowerCase() ?? "")) return false;
        if (materialFilters.size) {
          const usesMaterial =
            record.facets.materials.some((materialId) => materialFilters.has(materialId)) ||
            record.facets.materialNames.some((materialName) => materialFilters.has(materialName));
          if (!usesMaterial) return false;
        }
        if (!matchesSearch(record, searchTokens)) return false;
        return true;
      })
      .sort((a, b) => {
        const type = a.sort.type.localeCompare(b.sort.type);
        return type || a.sort.name.localeCompare(b.sort.name);
      });
  }, [classFilters, fpsFilters, gradeFilters, materialFilters, records, savedBlueprintIds, savedOnly, searchTokens, sizeFilters, vehicleFilters]);

  // ── Variant grouping ─────────────────────────────────────────────────────────
  // Collapse FPS items that share a base name (differ only by quoted nickname)
  // into one representative card with a variant count badge.
  const { groupedRecords, variantCountMap } = useMemo(() => {
    const groups = new Map<string, ComponentCardIndexRecord[]>();
    const ungrouped: ComponentCardIndexRecord[] = [];

    for (const record of filteredRecords) {
      const key = getVariantGroupKey(record);
      if (key) {
        const existing = groups.get(key);
        if (existing) {
          existing.push(record);
        } else {
          groups.set(key, [record]);
        }
      } else {
        ungrouped.push(record);
      }
    }

    const grouped: ComponentCardIndexRecord[] = [...ungrouped];
    const counts = new Map<string, number>();

    for (const [, members] of groups) {
      const rep = pickGroupRepresentative(members);
      grouped.push(rep);
      if (members.length > 1) counts.set(rep.id, members.length);
    }

    // Re-sort after merging (groups and ungrouped were individually sorted).
    grouped.sort((a, b) => {
      const type = a.sort.type.localeCompare(b.sort.type);
      return type || a.sort.name.localeCompare(b.sort.name);
    });

    return { groupedRecords: grouped, variantCountMap: counts };
  }, [filteredRecords]);

  useEffect(() => {
    if (loading || groupedRecords.length !== 1) return;
    const id = groupedRecords[0].id;
    if (id) navigate(`/industry/crafting/${id}`, { replace: true });
  }, [loading, groupedRecords, navigate]);

  const totalPages = Math.max(1, Math.ceil(groupedRecords.length / DEFAULT_RESULTS_PER_PAGE));
  const visiblePage = Math.min(page, totalPages);
  const pageStart = (visiblePage - 1) * DEFAULT_RESULTS_PER_PAGE;
  const pageRecords = useMemo(
    () => groupedRecords.slice(pageStart, pageStart + DEFAULT_RESULTS_PER_PAGE),
    [groupedRecords, pageStart],
  );
  // In default state, vehicleFilters contains the default type but is NOT a user-applied filter.
  const hasFilters = !isDefaultState && Boolean(search || vehicleFilters.size || fpsFilters.size || sizeFilters.size || gradeFilters.size || classFilters.size || materialFilters.size || savedOnly);

  const activeMaterialOptions = useMemo(
    () => materialOptions.filter((opt) => materialFilters.has(opt.value)),
    [materialOptions, materialFilters],
  );

  const activeFilterTokens = useMemo<ActiveFilterToken[]>(() => {
    const tokens: ActiveFilterToken[] = [];
    for (const v of fpsFilters) {
      const opt = fpsOptions.find((o) => o.value === v);
      if (opt) tokens.push({ value: v, label: opt.label, kind: "fps" });
    }
    // Skip vehicle tokens when in default state — the default is not a user filter.
    if (!isDefaultState) {
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
    if (savedOnly) tokens.push({ value: "saved", label: "Blueprint Bookmarks", kind: "saved" });
    return tokens;
  }, [activeMaterialOptions, classFilters, classOptions, fpsFilters, fpsOptions, gradeFilters, gradeOptions, isDefaultState, savedOnly, sizeFilters, sizeOptions, vehicleFilters, vehicleOptions]);

  function clearFilters() {
    setSearchParams({}, { replace: true });
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

        {/* ── Row 1: Search + Bookmarks + Count ── */}
        <div className="crb-row crb-row--search">
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
          <button
            type="button"
            className={`crb-bookmarks-btn${savedOnly ? " crb-bookmarks-btn--active" : ""}`}
            onClick={() => setSavedOnly((v) => !v)}
          >
            <span className="crb-bookmarks-icon" aria-hidden="true">☆</span>
            Blueprint Bookmarks
          </button>
          <span className="component-browser-count">
            <strong>{groupedRecords.length.toLocaleString()}</strong> components found
          </span>
        </div>

        {/* ── Row 2: Category groups — Vehicle | FPS ── */}
        <div className="crb-row crb-row--categories">
          <div className="crb-category-group crb-category-group--vehicle">
            <span className="crb-section-label crb-section-label--vehicle">Vehicle</span>
            <div className="crb-chip-group" role="group" aria-label="Vehicle component filters">
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

        {/* ── Row 3: Contextual facets (vehicle only) + Materials always ── */}
        <div className="crb-row crb-row--facets">
            {showVehicleFacets && sizeOptions.length > 0 && (
              <>
                <span className="crb-section-label">Size</span>
                <span className="crb-section-divider" aria-hidden="true" />
                <div className="crb-chip-group" role="group" aria-label="Size filters">
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
              </>
            )}
            {showVehicleFacets && gradeOptions.length > 0 && (
              <>
                <span className="crb-section-label">Grade</span>
                <span className="crb-section-divider" aria-hidden="true" />
                <div className="crb-chip-group" role="group" aria-label="Grade filters">
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
              </>
            )}
            {showVehicleFacets && classOptions.length > 0 && (
              <>
                <span className="crb-section-label">Class</span>
                <span className="crb-section-divider" aria-hidden="true" />
                <div className="crb-chip-group" role="group" aria-label="Class filters">
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
              </>
            )}

            <span className="crb-section-label crb-section-label--muted">Materials</span>
            <span className="crb-section-divider" aria-hidden="true" />
            <div className="crb-material-picker" ref={materialPickerRef}>
              <button
                type="button"
                className={`crb-material-trigger${materialPickerOpen ? " crb-material-trigger--open" : ""}`}
                onClick={() => setMaterialPickerOpen((v) => !v)}
                aria-expanded={materialPickerOpen}
              >
                {materialFilters.size > 0 ? `${materialFilters.size} selected` : "Choose Materials"}
                <span className="crb-material-chevron" aria-hidden="true">▾</span>
              </button>
              {materialPickerOpen && (
                <div className="crb-material-dropdown" role="listbox" aria-label="Select materials">
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
            </div>
        </div>

        {/* ── Row 4: Active Filters (only when filters are set) ── */}
        {hasFilters && (
          <div className="crb-row crb-row--active-filters">
            <span className="crb-section-label">Active Filters</span>
            <span className="crb-section-divider" aria-hidden="true" />
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
            <button type="button" className="crb-clear-all" onClick={clearFilters}>
              Clear All
              <span className="crb-clear-all-icon" aria-hidden="true">🗑</span>
            </button>
          </div>
        )}
      </div>

      {groupedRecords.length === 0 ? (
        <ComponentBrowserState title="No Results" body="No craftable components match the current browser filters." />
      ) : groupedRecords.length === 1 ? null : (
        <>
          <section className="component-results-grid" aria-label="Component results">
            {pageRecords.map((record) => (
              <ComponentResultCard
                key={record.id}
                record={record}
                queued={isRecipeQueued(record)}
                saved={savedBlueprintIds.has(record.id)}
                variantCount={variantCountMap.get(record.id)}
              />
            ))}
          </section>

          <footer className="component-browser-pager" aria-label="Component results pages">
            <span className="component-browser-page-readout">
              Showing {pageStart + 1}-{Math.min(pageStart + pageRecords.length, groupedRecords.length)} of {groupedRecords.length} results
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
      <CompareTray />
    </div>
  );
}
