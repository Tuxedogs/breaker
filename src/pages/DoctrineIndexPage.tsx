import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import DoctrineFilterBar from "../components/DoctrineFilterBar";
import EntryVectorCard from "../components/EntryVectorCard";
import SetupRail from "../components/SetupRail";
import { moduleFilterOptions, moduleLoadError } from "../data/modules";
import { refLoadError } from "../data/refs";
import { shipLoadError } from "../data/ships";
import { emptyModuleFilters, readModuleFilters, writeModuleFilters, type ModuleFilters } from "../lib/moduleFilters";

type EntryVector = {
  title: string;
  subtitle: string;
  actionLabel: string;
  preset: Partial<ModuleFilters>;
  icon: Parameters<typeof EntryVectorCard>[0]["icon"];
  ctaVariant: Parameters<typeof EntryVectorCard>[0]["ctaVariant"];
  disabled?: boolean;
};

const entryVectors: EntryVector[] = [
  {
    title: "I'm Flying",
    subtitle: "Pilot-focused modules",
    actionLabel: "Route as Pilot",
    preset: { role: "pilot", type: "flying" },
    icon: "pilot",
    ctaVariant: "pilot",
  },
  {
    title: "I'm Manning",
    subtitle: "Crew station and gunner modules",
    actionLabel: "Route as Crew",
    preset: { role: "gunner", type: "manning" },
    icon: "crew",
    ctaVariant: "crew",
  },
  {
    title: "I'm Facing",
    subtitle: "Threat classification modules",
    actionLabel: "Classify Threat",
    preset: { enemy: "capital", type: "facing" },
    icon: "threat",
    ctaVariant: "threat",
  },
  {
    title: "Something Went Wrong",
    subtitle: "Recovery and failure handling modules",
    actionLabel: "Enter Recovery",
    preset: { type: "recovery" },
    icon: "recovery",
    ctaVariant: "soon",
    disabled: true,
  },
];

export default function DoctrineIndexPage() {
  const [activeEntry, setActiveEntry] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readModuleFilters(searchParams);

  function updateFilter(key: keyof ModuleFilters, value: string) {
    const nextFilters = { ...filters, [key]: value };
    setSearchParams(writeModuleFilters(nextFilters), { replace: true });
  }

  function buildEntryTarget(preset: Partial<ModuleFilters>) {
    const merged: ModuleFilters = { ...filters, ...preset };
    return `/modules?${writeModuleFilters(merged).toString()}`;
  }

  const loaderError = moduleLoadError ?? refLoadError ?? shipLoadError;

  return (
    <section className="framework-static route-fade relative overflow-visible py-3">
      <div className="relative z-10 space-y-6">
        {loaderError ? (
          <article className="rounded-2xl border border-red-300/35 bg-red-950/40 p-4">
            <p className="title-font text-xs uppercase tracking-[0.16em] text-red-100">Content Loader Error</p>
            <p className="mt-2 text-sm text-red-100/90">{loaderError.message}</p>
          </article>
        ) : null}
        <header className="rounded-3xl border border-white/15 bg-slate-950/35 px-6 py-8 backdrop-blur-xl sm:px-10 sm:py-10">
          <p className="title-font text-[11px] uppercase tracking-[0.34em] text-cyan-100/75">Doctrine Index</p>
          <h1 className="title-font mt-3 text-4xl font-medium leading-[0.95] text-white sm:text-5xl">Framework Routing</h1>
          <p className="mt-4 max-w-2xl text-sm text-slate-200/80 sm:text-base">
            Start with your situation. Refine only if necessary.
          </p>
        </header>

        <section>
          <div className="px-1 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {entryVectors.map((entry) => (
            <EntryVectorCard
              key={entry.title}
              title={entry.title}
              subtitle={entry.subtitle}
              actionLabel={entry.actionLabel}
              to={buildEntryTarget(entry.preset)}
              icon={entry.icon}
              ctaVariant={entry.ctaVariant}
              disabled={entry.disabled}
              isActive={activeEntry === entry.title && !entry.disabled}
              onMouseEnter={entry.disabled ? undefined : () => setActiveEntry(entry.title)}
              onMouseLeave={entry.disabled ? undefined : () => setActiveEntry(null)}
              onFocusCapture={entry.disabled ? undefined : () => setActiveEntry(entry.title)}
              onBlurCapture={entry.disabled ? undefined : () => setActiveEntry(null)}
            />
          ))}
          </div>
        </section>

        <div className="mt-[30px]">
          <SetupRail />
        </div>

        <div className="mt-[40px] opacity-85">
          <DoctrineFilterBar
            title="Refine Results"
            description="Optional: narrow routing outcomes by ship, role, threat, status, or type."
            filters={filters}
            options={moduleFilterOptions}
            onChange={updateFilter}
            onClear={() => setSearchParams(writeModuleFilters(emptyModuleFilters), { replace: true })}
          />
        </div>
      </div>
    </section>
  );
}
