import type { CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { moduleLoadError } from "../data/modules";
import { refLoadError } from "../data/refs";
import { readModuleFilters, writeModuleFilters, type ModuleFilters } from "../lib/moduleFilters";

function buildTarget(filters: ModuleFilters, preset: Partial<ModuleFilters>) {
  const merged: ModuleFilters = { ...filters, ...preset };
  return `/modules?${writeModuleFilters(merged).toString()}`;
}

const roleCards = [
  {
    title: "I'm Flying",
    desc: "Pilot-focused modules",
    btn: "PILOT",
    accent: "var(--accent-pilot)",
    preset: { role: "pilot" } as Partial<ModuleFilters>,
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M12 3c0 0-5 4-5 9h10c0-5-5-9-5-9z" />
        <path d="M7 12v2l5 7 5-7v-2" />
        <path d="M9 12l3 2 3-2" />
      </svg>
    ),
  },
  {
    title: "I'm Manning",
    desc: "Crew station and gunner modules",
    btn: "CREW",
    accent: "var(--accent-crew)",
    preset: { role: "crew" } as Partial<ModuleFilters>,
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="7" r="3" />
        <path d="M5 20v-1a7 7 0 0 1 14 0v1" />
      </svg>
    ),
  },
  {
    title: "I'm Facing",
    desc: "Threat classification modules",
    btn: "THREAT",
    accent: "var(--accent-violet)",
    preset: { enemy: "capital" } as Partial<ModuleFilters>,
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 4v4M12 16v4M4 12h4M16 12h4" />
      </svg>
    ),
  },
] as const;

const disabledCard = {
  title: "I'm Fixing",
  desc: "Engineering and repair modules",
  btn: "10MM",
  accent: "var(--accent-gold)",
  icon: (
    <svg viewBox="0 0 24 24">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l2.77-2.77a5.5 5.5 0 0 1-6.94 6.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a5.5 5.5 0 0 1 6.94-6.94l-2.76 2.77z" />
    </svg>
  ),
};

const toolBanners = [
  {
    title: "GUNNERY",
    label: "TARGET SYS",
    sub: "Targeting, sub-targeting, and firing mode guidance for crew stations.",
    to: "/tools/gunnery",
    mod: "fw-tool-banner--gunnery",
  },
  {
    title: "ARMOR THRESHOLDS",
    label: "DAMAGE INTEL",
    sub: "Compare weapon alpha against ship ballistic and energy thresholds.",
    to: "/tools/alpha-threshold",
    mod: "fw-tool-banner--alpha",
  },
  {
    title: "MAPS",
    label: "NAV DECK",
    sub: "Deck views, overlays, and ship reference layouts.",
    to: "/maps",
    mod: "fw-tool-banner--maps",
  },
] as const;

const secondaryCards = [
  { title: "Onboarding", desc: "New member pipeline & progression", to: "/wip/onboarding", accent: "var(--accent-cyan)" },
  { title: "Training", desc: "Exercises, drills, and certifications", to: "/wip/training", accent: "var(--accent-violet)" },
  { title: "Organization", desc: "Command structure and roles", to: "/wip/organization", accent: "var(--accent-gold)" },
] as const;

const setupChips = [
  { title: "Flight Settings", desc: "Adjust control and targeting options.", to: "/systems/additional-settings-binds" },
  { title: "Keybind Presets", desc: "Configure and verify keybind baselines.", to: "/module/turret-keybind-baseline" },
  { title: "Camera & Tracking", desc: "Tune view and tracking persistence.", to: "/wip/camera-tracking" },
  { title: "Performance", desc: "Client settings and performance profile.", to: "/wip/performance" },
] as const;

export default function DoctrineIndexPage() {
  const [searchParams] = useSearchParams();
  const filters = readModuleFilters(searchParams);
  const loaderError = moduleLoadError ?? refLoadError;

  return (
    <section className="base-static route-fade relative overflow-visible py-3">
      <div className="relative z-10 space-y-4">
        {loaderError ? (
          <article className="rounded-2xl border border-red-300/35 bg-red-950/40 p-4">
            <p className="title-font text-xs uppercase tracking-[0.16em] text-red-100">Content Loader Error</p>
            <p className="mt-2 text-sm text-red-100/90">{loaderError.message}</p>
          </article>
        ) : null}

        {/* Role cards */}
        <div className="fw-role-grid">
          {roleCards.map((card) => (
            <Link
              key={card.title}
              to={buildTarget(filters, card.preset)}
              className="fw-role-card"
              style={{ "--role-accent": card.accent } as CSSProperties}
            >
              <div className="fw-role-icon">{card.icon}</div>
              <h2 className="fw-role-title">{card.title}</h2>
              <p className="fw-role-desc">{card.desc}</p>
              <span className="fw-role-btn">{card.btn}</span>
            </Link>
          ))}

          {/* Disabled — I'm Fixing */}
          <div
            className="fw-role-card fw-role-card--disabled"
            style={{ "--role-accent": disabledCard.accent } as CSSProperties}
            aria-disabled="true"
          >
            <div className="fw-role-icon">{disabledCard.icon}</div>
            <h2 className="fw-role-title">{disabledCard.title}</h2>
            <p className="fw-role-soon">Status: Soon™</p>
            <p className="fw-role-desc">{disabledCard.desc}</p>
            <span className="fw-role-btn">{disabledCard.btn}</span>
          </div>
        </div>

        {/* Tool banners */}
        <div className="space-y-4">
          {toolBanners.map((b) => (
            <Link key={b.to} to={b.to} className={`fw-tool-banner ${b.mod}`} aria-label={`${b.title}: ${b.sub}`}>
              <span className="fw-tool-panel-lines" aria-hidden="true" />
              <span className="fw-tool-mark" aria-hidden="true">
                {b.mod === "fw-tool-banner--maps" ? (
                  <svg className="fw-tool-blueprint-icon" viewBox="0 0 32 32" focusable="false">
                    <path className="fw-tool-blueprint-frame" d="M6.5 5.5h19v21h-19z" />
                    <path d="M10 9h6v5h-6zM18.5 9h4v7h-4zM10 17h5v5.5h-5zM17.5 19h5v3.5h-5z" />
                    <path d="M16 11.5h2.5M15 19.5h2.5M12.5 14v3M20.5 16v3" />
                    <path className="fw-tool-blueprint-ticks" d="M8 8h2M8 24h2M22 8h2M22 24h2M6.5 12h2M6.5 20h2M23.5 14h2" />
                    <circle className="fw-tool-blueprint-node" cx="20.5" cy="20.8" r="1.65" />
                  </svg>
                ) : (
                  <span className="fw-tool-mark-core" />
                )}
              </span>
              <div className="fw-tool-copy">
                <span className="fw-tool-kicker">{b.label}</span>
                <span className="fw-tool-title">{b.title}</span>
                <span className="fw-tool-sub">{b.sub}</span>
              </div>
              <span className="fw-tool-arrow" aria-hidden="true">›</span>
            </Link>
          ))}
        </div>

        {/* Secondary module cards */}
        <div className="fw-secondary-grid">
          {secondaryCards.map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="fw-sec-card"
              style={{ "--sec-accent": c.accent } as CSSProperties}
            >
              <span className="fw-sec-title">{c.title}</span>
              <span className="fw-sec-desc">{c.desc}</span>
            </Link>
          ))}
        </div>

        {/* Setup & Configuration */}
        <div className="fw-setup-block">
          <h2 className="fw-setup-title">Setup &amp; Configuration</h2>
          <p className="fw-setup-desc">Pre-flight settings, bindings, and client configuration</p>
          <div className="fw-chip-grid">
            {setupChips.map((chip) => (
              <Link key={chip.to} to={chip.to} className="fw-chip">
                <span className="fw-chip-title">{chip.title}</span>
                <span className="fw-chip-desc">{chip.desc}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
