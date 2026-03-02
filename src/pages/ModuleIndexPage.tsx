import { Link, useSearchParams } from "react-router-dom";
import DoctrineFilterBar from "../components/DoctrineFilterBar";
import ModuleFilterChipLink from "../components/ModuleFilterChipLink";
import { moduleFilterOptions, moduleLoadError, moduleMatchesShipRole, modules } from "../data/modules";
import { emptyModuleFilters, readModuleFilters, writeModuleFilters, type ModuleFilters } from "../lib/moduleFilters";

const statusClassName = {
  draft: "border-amber-300/40 bg-amber-300/10 text-amber-100",
  review: "border-cyan-300/40 bg-cyan-300/10 text-cyan-100",
  validated: "border-emerald-300/40 bg-emerald-300/10 text-emerald-100",
} as const;

const manningPinnedModuleIds = ["turret-keybind-baseline"] as const;

function matchesFilter(list: string[], selected: string) {
  return !selected || list.includes(selected);
}

export default function ModuleIndexPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readModuleFilters(searchParams);

  function updateFilter(key: keyof ModuleFilters, value: string) {
    const nextFilters = { ...filters, [key]: value };
    setSearchParams(writeModuleFilters(nextFilters), { replace: true });
  }

  const filteredModules = modules.filter((module) => {
    if (!moduleMatchesShipRole(module, { ship: filters.ship, role: filters.role })) return false;
    if (!matchesFilter(module.enemies, filters.enemy)) return false;
    if (filters.status && module.status !== filters.status) return false;
    if (filters.type && module.moduleType !== filters.type) return false;
    if (filters.domain && !module.tags.includes(filters.domain)) return false;
    return true;
  });
  const isManningIndex = filters.type === "manning" && (!filters.role || filters.role === "gunner");
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
        <header className="rounded-3xl border border-white/15 bg-slate-950/35 px-6 py-8 backdrop-blur-xl sm:px-10 sm:py-10">
          <p className="title-font text-[11px] uppercase tracking-[0.34em] text-cyan-100/75">Doctrine Modules</p>
          <h1 className="title-font mt-3 text-4xl font-medium leading-[0.95] text-white sm:text-5xl">Module Index</h1>
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

        <div className="space-y-4">
          {orderedModules.map((module) => (
            <article key={module.id} className="framework-modern-card framework-modern-card-systems framework-modern-card-compact rounded-[1.5rem] p-4">
              <div className="framework-modern-card-head rounded-xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="title-font text-2xl text-cyan-100">{module.title}</h2>
                    {isManningIndex && manningPinnedModuleIds.includes(module.id as (typeof manningPinnedModuleIds)[number]) ? (
                      <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-1 text-xs uppercase tracking-[0.12em] text-amber-100">
                        <span>Pinned Manning Baseline</span>
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm text-slate-300">{module.intent}</p>
                  </div>
                  <span
                    className={[
                      "inline-flex h-8 items-center rounded-full border px-3 text-xs uppercase tracking-[0.16em]",
                      statusClassName[module.status],
                    ].join(" ")}
                  >
                    {module.status}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {module.tags.map((tag) => (
                    <ModuleFilterChipLink
                      key={tag}
                      tag={tag}
                      className="inline-flex h-8 items-center rounded-full border border-white/25 bg-white/5 px-3 text-xs uppercase tracking-[0.14em] text-slate-200"
                    />
                  ))}
                </div>
                <p className="mt-4 text-xs uppercase tracking-[0.16em] text-slate-400">
                  Last Validated: {module.lastValidated}
                </p>
              </div>
              <Link to={`/module/${module.id}`} className="framework-modern-cta mt-2">
                View Module
              </Link>
            </article>
          ))}

          {orderedModules.length === 0 ? (
            <article className="framework-modern-card framework-modern-card-systems framework-modern-card-compact rounded-[1.5rem] p-4">
              <div className="framework-modern-card-head rounded-xl p-4">
                <h2 className="title-font text-xl text-cyan-100">No modules match current filters.</h2>
                <p className="mt-2 text-sm text-slate-300">Clear one or more filters and try again.</p>
              </div>
            </article>
          ) : null}
        </div>
      </div>
    </section>
  );
}
