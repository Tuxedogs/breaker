import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import DoctrineFilterBar from "../components/DoctrineFilterBar";
import { moduleFilterOptions, moduleLoadError } from "../data/modules";
import { refLoadError } from "../data/refs";
import { shipLoadError } from "../data/ships";
import { emptyModuleFilters, readModuleFilters, writeModuleFilters, type ModuleFilters } from "../lib/moduleFilters";

type EntryVector = {
  title: string;
  subtitle: string;
  actionLabel: string;
  preset: Partial<ModuleFilters>;
  icon: "pilot" | "crew" | "threat" | "recovery";
  disabled?: boolean;
};

const entryVectors: EntryVector[] = [
  {
    title: "I'm Flying",
    subtitle: "Pilot-focused modules",
    actionLabel: "Route as Pilot",
    preset: { role: "pilot", type: "flying" },
    icon: "pilot",
  },
  {
    title: "I'm Manning",
    subtitle: "Crew station and gunner modules",
    actionLabel: "Route as Crew",
    preset: { role: "gunner", type: "manning" },
    icon: "crew",
  },
  {
    title: "I'm Facing",
    subtitle: "Threat classification modules",
    actionLabel: "Classify Threat",
    preset: { enemy: "capital", type: "facing" },
    icon: "threat",
  },
  {
    title: "Something Went Wrong",
    subtitle: "Recovery and failure handling modules",
    actionLabel: "Enter Recovery",
    preset: { type: "recovery" },
    icon: "recovery",
    disabled: true,
  },
];

function EntryVectorIcon({ kind }: { kind: EntryVector["icon"] }) {
  const baseClass = "h-7 w-7 md:h-8 md:w-8 xl:h-10 xl:w-10";
  const strokeProps = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (kind === "pilot") {
    return (
      <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
        <path {...strokeProps} d="M3.5 12h17M12 3.5v17M5.5 6.5l13 11M18.5 6.5l-13 11" />
        <circle cx="12" cy="12" r="2.7" {...strokeProps} />
      </svg>
    );
  }

  if (kind === "crew") {
    return (
      <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
        <rect x="4.5" y="4.5" width="15" height="10.5" rx="1.8" {...strokeProps} />
        <path {...strokeProps} d="M12 8.2v5.6M9.2 11h5.6" />
        <path {...strokeProps} d="M8 19.2h8M9.2 15v4.2M14.8 15v4.2" />
      </svg>
    );
  }

  if (kind === "threat") {
    return (
      <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
        <path {...strokeProps} d="M4.5 12h15M12 4.5v15M6.2 6.2l11.6 11.6M17.8 6.2 6.2 17.8" />
        <circle cx="12" cy="12" r="7.5" {...strokeProps} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
      <path {...strokeProps} d="M12 4v8.2M12 16.6v.1M6 6l12 12M18 6 6 18" />
      <circle cx="12" cy="12" r="8" {...strokeProps} />
    </svg>
  );
}

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
    <section className="framework-static route-fade relative overflow-hidden py-3">
      <div className="framework-trend-bg pointer-events-none absolute inset-0" />
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

        <section className="framework-modern-card-head rounded-xl border border-white/12 bg-slate-950/35 p-4 sm:p-5">
          <h2 className="title-font text-lg text-cyan-100">Entry Vectors</h2>
          <p className="mt-2 text-sm text-slate-300">Choose one routing path and move immediately.</p>

          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {entryVectors.map((entry) => (
            <article
              key={entry.title}
              onMouseEnter={entry.disabled ? undefined : () => setActiveEntry(entry.title)}
              onMouseLeave={entry.disabled ? undefined : () => setActiveEntry(null)}
              onFocusCapture={entry.disabled ? undefined : () => setActiveEntry(entry.title)}
              onBlurCapture={entry.disabled ? undefined : () => setActiveEntry(null)}
              className={[
                "relative overflow-hidden framework-modern-card framework-modern-card-systems framework-modern-card-compact rounded-[1.35rem] p-4 sm:p-5 transition duration-200",
                activeEntry === entry.title && !entry.disabled
                  ? "border-cyan-200/45 shadow-[0_0_0_1px_rgba(125,211,252,0.35),0_0_34px_rgba(56,189,248,0.28)]"
                  : activeEntry
                    ? "opacity-55 saturate-75"
                    : "opacity-100",
                entry.disabled ? "opacity-90 saturate-75" : "",
              ].join(" ")}
            >
              {entry.disabled ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1/2 z-20 w-[165%] -translate-x-1/2 -translate-y-1/2 -rotate-[21deg] border-y border-amber-300/60 bg-amber-950/75 py-1 text-center text-xs font-semibold uppercase tracking-[0.32em] text-amber-100/95"
                >
                  SOONTM
                </span>
              ) : null}
              <div className="flex min-h-[260px] flex-1 flex-col items-center text-center">
                <div className="mt-2 inline-flex h-14 w-14 items-center justify-center rounded-xl border border-white/22 bg-slate-900/38 text-slate-100/85 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_20px_rgba(56,189,248,0.14)] md:mt-3 md:h-16 md:w-16 xl:mt-4 xl:h-20 xl:w-20">
                  <EntryVectorIcon kind={entry.icon} />
                </div>
                <h2 className="title-font mt-6 text-2xl text-cyan-100">{entry.title}</h2>
                <p className="mt-3 text-base text-slate-200">{entry.subtitle}</p>
                <div className="mt-auto w-full pt-8">
                  {entry.disabled ? (
                    <span
                      aria-disabled="true"
                      className="framework-modern-cta w-full cursor-not-allowed border-amber-300/30 bg-amber-950/35 text-amber-100/80"
                    >
                      {entry.actionLabel}
                    </span>
                  ) : (
                    <Link to={buildEntryTarget(entry.preset)} className="framework-modern-cta w-full">
                      {entry.actionLabel}
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
          </div>
        </section>

        <div className="opacity-85">
          <DoctrineFilterBar
            title="Refine Results"
            description="Optional: narrow routing outcomes by ship, role, threat, map, status, or type."
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
