import type { CSSProperties } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import ModuleFilterChipLink from "../ModuleFilterChipLink";
import {
  moduleFilterOptions,
  moduleLoadError,
  moduleMatchesShipRole,
  modules,
  type DoctrineModule,
} from "../../data/modules";
import { useRememberModuleIndexSearch } from "../../lib/moduleIndexNavigation";
import {
  emptyModuleFilters,
  readModuleFilters,
  writeModuleFilters,
  type ModuleFilters,
} from "../../lib/moduleFilters";

const validationStatusClassName = {
  draft: "dash-doctrine-status--draft",
  review: "dash-doctrine-status--review",
  validated: "dash-doctrine-status--validated",
  deprecated: "dash-doctrine-status--deprecated",
} as const;

const roleFilters = [
  { label: "All", value: "" },
  { label: "Pilot", value: "pilot" },
  { label: "Crew", value: "crew" },
  { label: "Gunner", value: "gunner" },
  { label: "Engineer", value: "engineer" },
] as const;

const manningPinnedModuleIds = ["turret-keybind-baseline"] as const;

function labelize(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function matchesFilter(list: string[], selected: string) {
  return !selected || list.includes(selected);
}

function matchesRoleSelection(module: DoctrineModule, role: string) {
  if (!role) return true;
  if (role !== "crew") return moduleMatchesShipRole(module, { role });

  const crewRoles = ["gunner", "engineer"];
  return module.roles.some((moduleRole) => crewRoles.includes(moduleRole));
}

function matchesQuery(module: DoctrineModule, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const searchable = [
    module.id,
    module.title,
    module.summary,
    module.owner,
    module.moduleType,
    ...module.tags,
    ...module.roles,
    ...module.ships,
    ...module.enemies,
  ];

  return searchable.some((value) => value.toLowerCase().includes(normalized));
}

function SelectField({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="dash-doctrine-field">
      <span className="dash-doctrine-field-label">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="dash-doctrine-select"
      >
        <option value="">All</option>
        {values.map((item) => (
          <option key={item} value={item}>
            {labelize(item)}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function DoctrineWorkspace() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readModuleFilters(searchParams);
  useRememberModuleIndexSearch(location.search);

  function updateFilter(key: keyof ModuleFilters, value: string) {
    setSearchParams(writeModuleFilters({ ...filters, [key]: value }), { replace: true });
  }

  const filteredModules = modules.filter((module) => {
    if (!moduleMatchesShipRole(module, { ship: filters.ship })) return false;
    if (!matchesRoleSelection(module, filters.role)) return false;
    if (!matchesFilter(module.enemies, filters.enemy)) return false;
    if (filters.status && module.status !== filters.status) return false;
    if (filters.domain && !module.tags.includes(filters.domain)) return false;
    if (!matchesQuery(module, filters.query)) return false;
    return true;
  });

  const isManningIndex = !filters.ship && (filters.role === "gunner" || filters.role === "crew");
  const orderedModules = isManningIndex
    ? [...filteredModules].sort((a, b) => {
        const aPinnedIdx = manningPinnedModuleIds.indexOf(a.id as (typeof manningPinnedModuleIds)[number]);
        const bPinnedIdx = manningPinnedModuleIds.indexOf(b.id as (typeof manningPinnedModuleIds)[number]);
        if (aPinnedIdx === -1 && bPinnedIdx === -1) return 0;
        if (aPinnedIdx === -1) return 1;
        if (bPinnedIdx === -1) return -1;
        return aPinnedIdx - bPinnedIdx;
      })
    : filteredModules;

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <section className="dash-doctrine-workspace" aria-labelledby="doctrine-workspace-title">
      {moduleLoadError ? (
        <article className="dash-doctrine-error">
          <p className="dash-doctrine-eyebrow">Module Content Error</p>
          <p>{moduleLoadError.message}</p>
        </article>
      ) : null}

      <div className="dash-doctrine-toolbar">
        <div className="dash-doctrine-heading">
          <p className="dash-doctrine-eyebrow">Doctrine Library</p>
          <h2 id="doctrine-workspace-title">Module Workspace</h2>
          <p>{orderedModules.length} modules available from the current view.</p>
        </div>

        <button
          type="button"
          onClick={() => setSearchParams(writeModuleFilters(emptyModuleFilters), { replace: true })}
          className="dash-doctrine-clear"
          disabled={activeFilterCount === 0}
        >
          Clear Filters
        </button>
      </div>

      <div className="dash-doctrine-rolebar" aria-label="Role filters">
        {roleFilters.map((role) => (
          <button
            key={role.label}
            type="button"
            className={[
              "dash-doctrine-role",
              filters.role === role.value ? "dash-doctrine-role--active" : "",
            ].filter(Boolean).join(" ")}
            onClick={() => updateFilter("role", role.value)}
            aria-pressed={filters.role === role.value}
          >
            {role.label}
          </button>
        ))}
      </div>

      <div className="dash-doctrine-filters">
        <label className="dash-doctrine-field dash-doctrine-field--search">
          <span className="dash-doctrine-field-label">Search</span>
          <input
            type="search"
            value={filters.query}
            onChange={(event) => updateFilter("query", event.target.value)}
            className="dash-doctrine-input"
            placeholder="Find module, tag, owner..."
          />
        </label>
        <SelectField label="Ship" value={filters.ship} values={moduleFilterOptions.ships} onChange={(value) => updateFilter("ship", value)} />
        <SelectField label="Threat" value={filters.enemy} values={moduleFilterOptions.enemies} onChange={(value) => updateFilter("enemy", value)} />
        <SelectField label="Category" value={filters.domain} values={moduleFilterOptions.domains} onChange={(value) => updateFilter("domain", value)} />
        <SelectField label="Status" value={filters.status} values={moduleFilterOptions.statuses} onChange={(value) => updateFilter("status", value)} />
      </div>

      <div className="dash-doctrine-grid">
        <article
          className="dash-doctrine-card"
          style={{ "--card-accent": "rgb(167 139 250)" } as CSSProperties}
        >
          <div className="dash-doctrine-card-head">
            <div className="dash-doctrine-card-title-wrap">
              <h3 className="dash-doctrine-card-title">Gimbal Modes</h3>
            </div>
            <span className="dash-doctrine-status dash-doctrine-status--validated">validated</span>
          </div>
          <p className="dash-doctrine-summary">
            AM vs PM targeting doctrine — when to use each mode, behavioral profiles, and switch conditions for capital component engagements.
          </p>
          <div className="dash-doctrine-tags">
            <span className="dash-doctrine-tag">gunnery</span>
            <span className="dash-doctrine-tag">gimbal</span>
            <span className="dash-doctrine-tag">targeting</span>
          </div>
          <div className="dash-doctrine-card-footer">
            <span className="dash-doctrine-date">2025-01-15</span>
            <Link to="/doctrine/gimbal-modes" className="dash-doctrine-link">
              View Module
            </Link>
          </div>
        </article>

        {orderedModules.map((module) => {
          const isPinned = isManningIndex && manningPinnedModuleIds.includes(module.id as (typeof manningPinnedModuleIds)[number]);
          return (
            <article
              key={module.id}
              className="dash-doctrine-card"
              style={module.accent ? { "--card-accent": module.accent } as CSSProperties : undefined}
            >
              <div className="dash-doctrine-card-head">
                <div className="dash-doctrine-card-title-wrap">
                  <h3 className="dash-doctrine-card-title">{module.title}</h3>
                  {isPinned ? <span className="dash-doctrine-pin">Pinned Manning Baseline</span> : null}
                </div>
                <span className={`dash-doctrine-status ${validationStatusClassName[module.status]}`}>
                  {module.status}
                </span>
              </div>

              <p className="dash-doctrine-summary">{module.summary}</p>

              <div className="dash-doctrine-tags">
                {module.tags.slice(0, 4).map((tag) => (
                  <ModuleFilterChipLink key={tag} tag={tag} className="dash-doctrine-tag" />
                ))}
              </div>

              <div className="dash-doctrine-card-footer">
                <span className="dash-doctrine-date">
                  {module.lastValidated ?? module.validatedDate ?? "Unvalidated"}
                </span>
                <Link to={`/module/${module.id}`} className="dash-doctrine-link">
                  View Module
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      {orderedModules.length === 0 ? (
        <article className="dash-doctrine-empty">
          <h3>No modules match current filters.</h3>
          <p>Clear one or more filters, or broaden the search term.</p>
          <button
            type="button"
            onClick={() => setSearchParams(writeModuleFilters(emptyModuleFilters), { replace: true })}
            className="dash-doctrine-clear"
          >
            Clear Filters
          </button>
        </article>
      ) : null}
    </section>
  );
}
