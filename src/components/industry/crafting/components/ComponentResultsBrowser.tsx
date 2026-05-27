import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ComponentResultCard from "./ComponentResultCard";
import { buildResourceGroups } from "../../shared/msbResourceGroups";
import { fetchSavedBlueprints } from "@/lib/userSavedBlueprints";
import { useAuthSession } from "@/lib/auth/useAuthSession";
import type { ComponentCardIndexRecord } from "@/lib/componentCardIndex";
import { buildComponentCardSchemaFromIndex, formatCraftTime } from "../utils/componentCardSchema";

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

function SingleComponentResultWorkspace({
  record,
  queued,
  saved,
}: {
  record: ComponentCardIndexRecord;
  queued: boolean;
  saved: boolean;
}) {
  const schema = buildComponentCardSchemaFromIndex(record);
  const stats = [...schema.familyStats, ...schema.genericStats];
  const identity = [
    record.kind === "fps" ? "FPS" : "Vehicle",
    record.typeLabel,
    record.category !== record.kind ? record.category : null,
    record.family,
  ].filter((value): value is string => Boolean(value));
  const sizeGradeClass = [
    record.size !== null ? `S${record.size}` : null,
    record.grade,
    record.class,
  ].filter((value): value is string => Boolean(value));

  return (
    <section className="craft-detail-stage" aria-label="Single component result">
      <div className="craft-detail-main">
        <div
          className="component-result-card"
          aria-hidden="true"
          style={{
            minHeight: 150,
            background:
              "linear-gradient(135deg, rgba(255,153,0,0.12), rgba(56,245,208,0.045) 42%, rgba(0,0,0,0.22))",
          }}
        />

        <div className="craft-summary-panel">
          <div className="craft-summary-head">
            <div className="craft-summary-title-row">
              <div className="craft-summary-title">{schema.displayName}</div>
              <div className="craft-summary-quality-pill">{schema.typeLabel}</div>
            </div>
            <div className="craft-summary-chips">
              {identity.map((value) => (
                <span key={value} className="craft-badge craft-badge--type-chip">
                  {value}
                </span>
              ))}
              {sizeGradeClass.map((value) => (
                <span key={value} className="craft-badge craft-badge--neutral">
                  {value}
                </span>
              ))}
              {queued && <span className="craft-mini-chip craft-mini-chip--queue">Queued</span>}
              {saved && <span className="craft-mini-chip craft-mini-chip--saved">Saved</span>}
            </div>
          </div>

          <div className="craft-summary-section">
            <div className="component-card-metrics">
              {stats.map((metric) => (
                <span key={`${metric.label}:${metric.value}`} className="component-card-metric">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </span>
              ))}
            </div>
          </div>

          {record.entityClass && (
            <div className="craft-summary-section">
              <div className="craft-summary-total-modifier">
                <span>Entity</span>
                <span className="component-result-card__id">{record.entityClass}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="craft-summary-panel craft-summary-column">
        <div className="craft-summary-head">
          <div className="craft-summary-title-row">
            <div className="craft-summary-title">Crafting Overview</div>
            <div className="craft-summary-quality-pill">{formatCraftTime(record.craftTimeSeconds)}</div>
          </div>
          <div className="craft-summary-chips">
            <span className="craft-badge craft-badge--neutral">
              {record.materials.length} materials
            </span>
          </div>
        </div>

        <div className="craft-summary-section craft-summary-section--grow">
          <div className="craft-material-list">
            {record.materials.map((material, index) => (
              <div
                key={`${record.id}:${material.slot ?? index}:${material.costId ?? material.name}`}
                className="craft-material-card"
              >
                <div className="craft-material-card-head">
                  <span className="craft-result-name">{material.name}</span>
                  {material.slot && <span className="craft-badge craft-badge--sm craft-badge--slot">{material.slot}</span>}
                </div>
                <div className="craft-summary-total-modifier">
                  <span>Required</span>
                  <strong>{material.unit ? `${material.quantity} ${material.unit}` : material.quantity}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="craft-summary-action-row" style={{ gridTemplateColumns: "1fr" }}>
          <Link className="craft-summary-action-btn craft-summary-queue-btn" to={`/industry/crafting/${record.id}`}>
            Open Crafting Builder
          </Link>
        </div>
      </div>
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
  const [sizeFilters, setSizeFilters] = useState<Set<string>>(new Set());
  const [gradeFilters, setGradeFilters] = useState<Set<string>>(new Set());
  const [classFilters, setClassFilters] = useState<Set<string>>(new Set());
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

  const filteredRecords = useMemo(() => {
    return records
      .filter((record) => {
        if (savedOnly && !savedBlueprintIds.has(record.id)) return false;
        if (fpsFilters.size && (record.kind !== "fps" || !fpsFilters.has(record.type))) return false;
        if (vehicleFilters.size) {
          if (record.kind === "fps") return false;
          const type = record.type;
          const utilityMatch = vehicleFilters.has("__utility__") && UTILITY_TYPES.has(type);
          if (!vehicleFilters.has(type) && !utilityMatch) return false;
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

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / DEFAULT_RESULTS_PER_PAGE));
  const visiblePage = Math.min(page, totalPages);
  const pageStart = (visiblePage - 1) * DEFAULT_RESULTS_PER_PAGE;
  const pageRecords = useMemo(
    () => filteredRecords.slice(pageStart, pageStart + DEFAULT_RESULTS_PER_PAGE),
    [filteredRecords, pageStart],
  );
  const hasFilters = Boolean(search || vehicleFilters.size || fpsFilters.size || sizeFilters.size || gradeFilters.size || classFilters.size || materialFilters.size || savedOnly);

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
    for (const v of vehicleFilters) {
      const opt = vehicleOptions.find((o) => o.value === v);
      if (opt) tokens.push({ value: v, label: opt.label, kind: "vehicle" });
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
  }, [activeMaterialOptions, classFilters, classOptions, fpsFilters, fpsOptions, gradeFilters, gradeOptions, savedOnly, sizeFilters, sizeOptions, vehicleFilters, vehicleOptions]);

  useEffect(() => {
    setPage(1);
  }, [classFilters, fpsFilters, gradeFilters, materialFilters, savedOnly, search, sizeFilters, vehicleFilters]);

  function clearFilters() {
    setSearch("");
    setVehicleFilters(new Set());
    setFpsFilters(new Set());
    setSizeFilters(new Set());
    setGradeFilters(new Set());
    setClassFilters(new Set());
    setMaterialFilters(new Set());
    setSavedOnly(false);
    setPage(1);
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
            <strong>{filteredRecords.length.toLocaleString()}</strong> components found
          </span>
        </div>

        {/* ── Row 2: FPS | Vehicle Components ── */}
        <div className="crb-row crb-row--categories">
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
          <span className="crb-section-divider" aria-hidden="true" />
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
        </div>

        {/* ── Row 3: Materials ── */}
        <div className="crb-row crb-row--categories">
          {sizeOptions.length > 0 && (
            <>
              <span className="crb-section-label">Size</span>
              <span className="crb-section-divider" aria-hidden="true" />
              <div className="crb-chip-group" role="group" aria-label="Size filters">
                {sizeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`craft-frl-chip${sizeFilters.has(option.value) ? " craft-frl-chip--active" : ""}`}
                    onClick={() => setSizeFilters((prev) => toggleSetValue(prev, option.value))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
          {gradeOptions.length > 0 && (
            <>
              <span className="crb-section-divider" aria-hidden="true" />
              <span className="crb-section-label">Grade</span>
              <span className="crb-section-divider" aria-hidden="true" />
              <div className="crb-chip-group" role="group" aria-label="Grade filters">
                {gradeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`craft-frl-chip${gradeFilters.has(option.value) ? " craft-frl-chip--active" : ""}`}
                    onClick={() => setGradeFilters((prev) => toggleSetValue(prev, option.value))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
          {classOptions.length > 0 && (
            <>
              <span className="crb-section-divider" aria-hidden="true" />
              <span className="crb-section-label">Class</span>
              <span className="crb-section-divider" aria-hidden="true" />
              <div className="crb-chip-group" role="group" aria-label="Class filters">
                {classOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`craft-frl-chip${classFilters.has(option.value) ? " craft-frl-chip--active" : ""}`}
                    onClick={() => setClassFilters((prev) => toggleSetValue(prev, option.value))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

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

      {filteredRecords.length === 0 ? (
        <ComponentBrowserState title="No Results" body="No craftable components match the current browser filters." />
      ) : filteredRecords.length === 1 ? (
        <SingleComponentResultWorkspace
          record={filteredRecords[0]}
          queued={isRecipeQueued(filteredRecords[0])}
          saved={savedBlueprintIds.has(filteredRecords[0].id)}
        />
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
              Showing {pageStart + 1}-{Math.min(pageStart + pageRecords.length, filteredRecords.length)} of {filteredRecords.length} results
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
