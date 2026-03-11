import { Link, useSearchParams } from "react-router-dom";
import DoctrineFilterBar from "../components/DoctrineFilterBar";
import ModuleFilterChipLink from "../components/ModuleFilterChipLink";
import { moduleFilterOptions, moduleLoadError, moduleMatchesShipRole, modules, type DoctrineModule } from "../data/modules";
import { emptyModuleFilters, readModuleFilters, writeModuleFilters, type ModuleFilters } from "../lib/moduleFilters";

const validationStatusClassName = {
  draft: "module-card-validation-status-draft",
  review: "module-card-validation-status-review",
  validated: "module-card-validation-status-validated",
} as const;

const manningPinnedModuleIds = ["turret-keybind-baseline"] as const;

function matchesFilter(list: string[], selected: string) {
  return !selected || list.includes(selected);
}

function matchesRoleSelection(module: DoctrineModule, role: string) {
  if (!role) return true;
  if (role !== "crew") {
    return moduleMatchesShipRole(module, { role });
  }

  const crewRoles = ["gunner", "engineer"];
  return module.roles.some((moduleRole) => crewRoles.includes(moduleRole));
}

export default function ModuleIndexPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readModuleFilters(searchParams);

  function updateFilter(key: keyof ModuleFilters, value: string) {
    const nextFilters = { ...filters, [key]: value };
    setSearchParams(writeModuleFilters(nextFilters), { replace: true });
  }

  const filteredModules = modules.filter((module) => {
    if (!moduleMatchesShipRole(module, { ship: filters.ship })) return false;
    if (!matchesRoleSelection(module, filters.role)) return false;
    if (!matchesFilter(module.enemies, filters.enemy)) return false;
    if (filters.status && module.status !== filters.status) return false;
    if (filters.domain && !module.tags.includes(filters.domain)) return false;
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

  return (
    <section className="framework-static route-fade py-3">
      <div className="space-y-6">
        <header className="page-hero-shell">
          <p className="page-kicker">Doctrine Modules</p>
          <h1 className="page-title">Module Index</h1>
          <p className="mt-4 max-w-2xl text-sm text-slate-200/80 sm:text-base">
            Filter by context and open the module that matches your current fight state.
          </p>
        </header>

        {moduleLoadError ? (
          <article className="rounded-2xl border border-red-300/35 bg-red-950/40 p-4">
            <p className="title-font text-xs uppercase tracking-[0.16em] text-red-100">Module Content Error</p>
            <p className="mt-2 text-sm text-red-100/90">{moduleLoadError.message}</p>
          </article>
        ) : null}

        <DoctrineFilterBar
          filters={filters}
          options={moduleFilterOptions}
          onChange={updateFilter}
          onClear={() => setSearchParams(writeModuleFilters(emptyModuleFilters), { replace: true })}
        />

        <div className="deck-doctrine">
          {orderedModules.map((module) => (
            <article key={module.id} className="module-card-doctrine">
              <div className="module-card-content">
                <div className="module-card-hero">
                  <div className="min-w-0">
                    <h2 className="module-card-title">{module.title}</h2>
                    <p className="module-card-subtitle">{module.intent}</p>
                    {isManningIndex && manningPinnedModuleIds.includes(module.id as (typeof manningPinnedModuleIds)[number]) ? (
                      <p className="module-card-chip module-card-chip-pinned mt-2">
                        <span>Pinned Manning Baseline</span>
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`module-card-validation-status ${validationStatusClassName[module.status]}`}
                  >
                    {module.status}
                  </span>
                </div>

                <div className="module-card-chip-row">
                  {module.tags.map((tag) => (
                    <ModuleFilterChipLink
                      key={tag}
                      tag={tag}
                      className="module-card-chip"
                    />
                  ))}
                </div>
                <p className="module-card-validation-date">
                  Last Validated: {module.lastValidated}
                </p>
              </div>
              <Link to={`/module/${module.id}`} className="module-card-cta">
                View Module
              </Link>
            </article>
          ))}

          {orderedModules.length === 0 ? (
            <article className="module-card-doctrine">
              <div className="module-card-content">
                <div className="module-card-hero">
                  <div className="min-w-0">
                    <h2 className="module-card-title">No modules match current filters.</h2>
                    <p className="module-card-subtitle">Clear one or more filters and try again.</p>
                  </div>
                </div>
              </div>
            </article>
          ) : null}
        </div>
      </div>
    </section>
  );
}
