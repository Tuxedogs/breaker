import { useEffect, useMemo, useRef, useState } from "react";
import ComponentResultCard from "./ComponentResultCard";
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
  const [search, setSearch] = useState("");
  const [vehicleFilters, setVehicleFilters] = useState<Set<string>>(new Set());
  const [fpsFilters, setFpsFilters] = useState<Set<string>>(new Set());
  const [materialFilters, setMaterialFilters] = useState<Set<string>>(new Set());
  const [savedOnly, setSavedOnly] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [page, setPage] = useState(1);
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
    const values = new Map<string, string>();
    let hasUtility = false;
    for (const record of records) {
      if (record.kind === "fps") continue;
      const type = record.type;
      if (!type) continue;
      if (UTILITY_TYPES.has(type)) {
        hasUtility = true;
      } else {
        values.set(type, record.typeLabel);
      }
    }
    const options = [...values.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([value, label]) => ({ value, label }));
    if (hasUtility) options.push({ value: "__utility__", label: "Utility" });
    return options;
  }, [records]);

  const fpsOptions = useMemo<FilterOption[]>(() => {
    const values = new Map(
      records
        .filter((record) => record.kind === "fps")
        .map((record) => [record.type, record.typeLabel] as const)
        .filter(([value]) => Boolean(value)),
    );
    return [...values.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([value, label]) => ({ value, label }));
  }, [records]);

  const materialOptions = useMemo(() => buildMaterialOptions(records), [records]);
  const searchTokens = useMemo(() => buildSearchTokens(search), [search]);

  const filteredRecords = useMemo(() => {
    return records
      .filter((record) => {
        if (savedOnly && !savedBlueprintIds.has(record.id)) return false;
        if (fpsFilters.size && (record.facets.kind !== "fps" || !fpsFilters.has(record.facets.type))) return false;
        if (vehicleFilters.size) {
          if (record.facets.kind === "fps") return false;
          const type = record.facets.type;
          const utilityMatch = vehicleFilters.has("__utility__") && UTILITY_TYPES.has(type);
          if (!vehicleFilters.has(type) && !utilityMatch) return false;
        }
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
  }, [fpsFilters, materialFilters, records, savedBlueprintIds, savedOnly, searchTokens, vehicleFilters]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / RESULTS_PER_PAGE));
  const visiblePage = Math.min(page, totalPages);
  const pageStart = (visiblePage - 1) * RESULTS_PER_PAGE;
  const pageRecords = useMemo(
    () => filteredRecords.slice(pageStart, pageStart + RESULTS_PER_PAGE),
    [filteredRecords, pageStart],
  );
  const hasFilters = Boolean(search || vehicleFilters.size || fpsFilters.size || materialFilters.size || savedOnly);

  const activeMaterialOptions = useMemo(
    () => materialOptions.filter((opt) => materialFilters.has(opt.value)),
    [materialOptions, materialFilters],
  );

  // All active filter tokens for the active-filters row
  const activeTypeTokens = useMemo(() => {
    const tokens: { value: string; label: string; kind: "fps" | "vehicle" }[] = [];
    for (const v of fpsFilters) {
      const opt = fpsOptions.find((o) => o.value === v);
      if (opt) tokens.push({ value: v, label: opt.label, kind: "fps" });
    }
    for (const v of vehicleFilters) {
      const opt = vehicleOptions.find((o) => o.value === v);
      if (opt) tokens.push({ value: v, label: opt.label, kind: "vehicle" });
    }
    return tokens;
  }, [fpsFilters, fpsOptions, vehicleFilters, vehicleOptions]);

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
            <strong>{filteredRecords.length.toLocaleString()}</strong> components found
          </span>
        </div>

        {/* ── Row 2: FPS | Vehicle Components ── */}
        <div className="crb-row crb-row--categories">
          <span className="crb-section-label">FPS</span>
          <span className="crb-section-divider" aria-hidden="true" />
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
          <span className="crb-section-divider" aria-hidden="true" />
          <span className="crb-section-label crb-section-label--vehicle">Vehicle Components</span>
          <span className="crb-section-divider" aria-hidden="true" />
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

        {/* ── Row 3: Materials ── */}
        <div className="crb-row crb-row--materials">
          <span className="crb-section-label">Materials</span>
          <span className="crb-section-divider" aria-hidden="true" />

          {/* Choose Materials dropdown */}
          <div className="crb-material-picker" ref={materialPickerRef}>
            <button
              type="button"
              className={`crb-material-trigger${materialPickerOpen ? " crb-material-trigger--open" : ""}`}
              onClick={() => setMaterialPickerOpen((v) => !v)}
              aria-expanded={materialPickerOpen}
            >
              Choose Materials
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

          {/* Active material tokens */}
          {activeMaterialOptions.length > 0 && (
            <>
              <span className="crb-active-label">Active:</span>
              {activeMaterialOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="crb-token crb-token--material"
                  onClick={() => setMaterialFilters((prev) => toggleSetValue(prev, opt.value))}
                >
                  {opt.label}
                  <span className="crb-token-x" aria-hidden="true">×</span>
                </button>
              ))}
            </>
          )}

          {hasFilters && (
            <button type="button" className="crb-clear-all" onClick={clearFilters}>
              Clear All
              <span className="crb-clear-all-icon" aria-hidden="true">🗑</span>
            </button>
          )}
        </div>

        {/* ── Row 4: Active Filters (only when filters are set) ── */}
        {(activeTypeTokens.length > 0 || activeMaterialOptions.length > 0) && (
          <div className="crb-row crb-row--active-filters">
            <span className="crb-section-label">Active Filters</span>
            <span className="crb-section-divider" aria-hidden="true" />
            {activeTypeTokens.map((tok) => (
              <button
                key={tok.value}
                type="button"
                className="crb-token crb-token--type"
                onClick={() =>
                  tok.kind === "fps"
                    ? setFpsFilters((prev) => toggleSetValue(prev, tok.value))
                    : setVehicleFilters((prev) => toggleSetValue(prev, tok.value))
                }
              >
                {TYPE_ICONS[tok.value]}
                {tok.label}
                <span className="crb-token-x" aria-hidden="true">×</span>
              </button>
            ))}
            {activeMaterialOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="crb-token crb-token--material"
                onClick={() => setMaterialFilters((prev) => toggleSetValue(prev, opt.value))}
              >
                {opt.label}
                <span className="crb-token-x" aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {filteredRecords.length === 0 ? (
        <ComponentBrowserState title="No Results" body="No craftable components match the current browser filters." />
      ) : (
        <>
          <section className="component-results-grid" aria-label="Component results">
            {pageRecords.map((record) => (
              <ComponentResultCard
                key={record.id}
                record={record}
                queued={isRecipeQueued(record)}
                saved={savedBlueprintIds.has(record.id)}
              />
            ))}
          </section>

          <footer className="component-browser-pager" aria-label="Component results pages">
            <span className="component-browser-page-readout">
              Showing {pageStart + 1}-{Math.min(pageStart + pageRecords.length, filteredRecords.length)} of {filteredRecords.length}
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
