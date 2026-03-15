import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import OnboardingActionRail from "../components/OnboardingActionRail";
import RoutingCard, { type RoutingCardCtaVariant, type RoutingCardIcon } from "../components/RoutingCard";
import SetupRail from "../components/SetupRail";
import { moduleLoadError } from "../data/modules";
import { refLoadError } from "../data/refs";
import { shipLoadError } from "../data/ships";
import { readModuleFilters, writeModuleFilters, type ModuleFilters } from "../lib/moduleFilters";

type EntryVector = {
  title: string;
  subtitle: string;
  actionLabel: string;
  preset: Partial<ModuleFilters>;
  icon: RoutingCardIcon;
  ctaVariant: RoutingCardCtaVariant;
  disabled?: boolean;
};

const entryVectors: EntryVector[] = [
  {
    title: "I'm Flying",
    subtitle: "Pilot-focused modules",
    actionLabel: "Pilot",
    preset: { role: "pilot" },
    icon: "pilot",
    ctaVariant: "pilot",
  },
  {
    title: "I'm Manning",
    subtitle: "Crew station and gunner modules",
    actionLabel: "Crew",
    preset: { role: "crew" },
    icon: "crew",
    ctaVariant: "crew",
  },
  {
    title: "I'm Facing",
    subtitle: "Threat classification modules",
    actionLabel: "Threat",
    preset: { enemy: "capital" },
    icon: "threat",
    ctaVariant: "threat",
  },
  {
    title: "I'm Fixing",
    subtitle: "Engineering and repair modules",
    actionLabel: "10mm",
    preset: { role: "engineer" },
    icon: "recovery",
    ctaVariant: "soon",
    disabled: true,
  },
];

export default function DoctrineIndexPage() {
  const [activeEntry, setActiveEntry] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const filters = readModuleFilters(searchParams);

  function buildEntryTarget(preset: Partial<ModuleFilters>) {
    const merged: ModuleFilters = { ...filters, ...preset };
    return `/modules?${writeModuleFilters(merged).toString()}`;
  }

  const loaderError = moduleLoadError ?? refLoadError ?? shipLoadError;

  return (
    <section className="base-static route-fade relative overflow-visible py-3">
      <div className="relative z-10 space-y-6">
        {loaderError ? (
          <article className="rounded-2xl border border-red-300/35 bg-red-950/40 p-4">
            <p className="title-font text-xs uppercase tracking-[0.16em] text-red-100">Content Loader Error</p>
            <p className="mt-2 text-sm text-red-100/90">{loaderError.message}</p>
          </article>
        ) : null}
        <header className="page-hero-shell">
          <p className="page-kicker">Doctrine Index</p>
          <h1 className="page-title">Framework Routing</h1>
          <p className="mt-4 max-w-2xl text-sm text-slate-200/80 sm:text-base">
            Filter by context and open the module that matches your intent.
          </p>
        </header>

        <section>
          <div className="px-1 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {entryVectors.map((entry) => (
            <RoutingCard
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

        <Link to="/tools/alpha-threshold" className="setup-alpha-card section-hub-card">
          <span className="section-hub-copy">
            <span className="title-font section-hub-title">ALPHA VS THRESHOLD</span>
            <span className="section-hub-subtitle">
              Compare weapon alpha against ship ballistic and energy thresholds.
            </span>
          </span>
          <span className="section-hub-indicator" aria-hidden="true" />
        </Link>

        <div className="mt-8">
          <OnboardingActionRail />
        </div>

        <div className="mt-8">
          <SetupRail />
        </div>
      </div>
    </section>
  );
}
