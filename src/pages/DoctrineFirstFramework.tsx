import { Link } from "react-router-dom";

function PlaceholderIcon({ glyph }: { glyph: string }) {
  return (
    <span className="text-xs font-bold uppercase tracking-[0.08em] text-white/90">
      {glyph}
    </span>
  );
}

type FrameworkItem = {
  label: string;
  description?: string;
  to: string;
  glyph: string;
};

const shipItems: FrameworkItem[] = [
  {
    label: "Perseus",
    description: "Heavy Gunship - Size 8 Mains",
    to: "/ships/perseus",
    glyph: "PS",
  },
  {
    label: "Polaris",
    description: "Torpedo Deployment - Nuclear Submarine",
    to: "/ships/polaris",
    glyph: "PL",
  },
  {
    label: "Idris",
    description: "Super Carrier - Size 10 Wallet",
    to: "/ships/idris",
    glyph: "ID",
  },
];

const systemItems: FrameworkItem[] = [
  { label: "Sub-Targeting", to: "/systems/sub-targeting", glyph: "TG" },
  {
    label: "Turret Keybinds",
    to: "/systems/turret-keybinds",
    glyph: "KB",
  },
  { label: "Additional Settings & Binds", to: "/systems/additional-settings-binds", glyph: "AD" },
  { label: "Gunnery with Luna", to: "/systems/gunnery-with-luna", glyph: "GN" },
  { label: "Communications", to: "/systems/communications", glyph: "CM" },
  { label: "Additional Resources", to: "/systems/additional-resources", glyph: "RS" },
];

function FrameworkCard({
  title,
  subtitle,
  ctaLabel,
  ctaTo,
  items,
  accentClass,
}: {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaTo: string;
  items: FrameworkItem[];
  accentClass: "ships" | "systems";
}) {
  return (
    <article className={`framework-modern-card framework-modern-card-${accentClass}`}>
      <div className="framework-modern-card-head">
        <p className="framework-modern-kicker">{subtitle}</p>
        <h2 className="title-font framework-modern-title">{title}</h2>
      </div>

      <div className="framework-modern-list">
        {items.map((item) => (
          <Link key={item.to} to={item.to} className="framework-modern-row">
            <span className="framework-modern-icon">
              <PlaceholderIcon glyph={item.glyph} />
            </span>
            <span className="min-w-0">
              <span className="framework-modern-row-title">{item.label}</span>
              {item.description ? <span className="framework-modern-row-subtitle">{item.description}</span> : null}
            </span>
            <span className="framework-modern-arrow">+</span>
          </Link>
        ))}
      </div>

      <Link to={ctaTo} className="framework-modern-cta">
        {ctaLabel}
      </Link>
    </article>
  );
}

export default function DoctrineFirstFramework() {
  return (
    <section className="framework-static route-fade relative overflow-hidden py-3">
      <div className="framework-trend-bg pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -left-16 top-6 h-56 w-56 rounded-full bg-cyan-300/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-36 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />

      <div className="relative z-10 mb-12 rounded-3xl border border-white/15 bg-slate-950/35 px-6 py-8 backdrop-blur-xl sm:px-10 sm:py-10">
        <p className="title-font text-[11px] uppercase tracking-[0.34em] text-cyan-100/75">Field Manual v2.0</p>
        <h1 className="title-font mt-3 text-4xl font-medium leading-[0.95] text-white sm:text-5xl lg:text-6xl">
          DOCTRINE-FIRST
          <span className="framework-trend-text block">TACTICAL INDEX</span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-slate-200/80 sm:text-base">
          Pick a ship platform or systems workflow and drop directly into playbook-grade guidance.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-emerald-100/30 bg-emerald-100/10 px-3 py-1 text-[0.64rem] uppercase tracking-[0.18em] text-emerald-50/90 backdrop-blur-md">
            Organizational Structure
          </span>
          <span className="rounded-full border border-cyan-100/30 bg-cyan-100/10 px-3 py-1 text-[0.64rem] uppercase tracking-[0.18em] text-cyan-50/90 backdrop-blur-md">
            Crew Roles
          </span>
          <span className="rounded-full border border-amber-100/30 bg-amber-100/10 px-3 py-1 text-[0.64rem] uppercase tracking-[0.18em] text-amber-50/95 backdrop-blur-md">
            Gunnery Flow
          </span>
          <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[0.64rem] uppercase tracking-[0.18em] text-slate-200/90 backdrop-blur-md">
            Communication Discipline
          </span>
          <span className="rounded-full border border-blue-100/30 bg-blue-100/10 px-3 py-1 text-[0.64rem] uppercase tracking-[0.18em] text-blue-50/95 backdrop-blur-md">
            Maps
          </span>
        </div>
      </div>

      <div className="relative z-10 grid items-stretch gap-8 lg:grid-cols-2">
        <FrameworkCard
          title="SYSTEMS"
          subtitle="Procedures & Operations"
          ctaLabel="Enter Systems"
          ctaTo="/systems/sub-targeting"
          items={systemItems}
          accentClass="systems"
        />
        <FrameworkCard
          title="SHIPS"
          subtitle="Combat Platforms"
          ctaLabel="Enter Ships"
          ctaTo="/ships/perseus"
          items={shipItems}
          accentClass="ships"
        />
        <article className="framework-modern-card framework-modern-card-maps framework-modern-card-maps-compact lg:col-span-2">
          <div aria-hidden className="framework-modern-card-maps-bg" />
          <div className="framework-modern-card-head w-full text-center">
            <p className="framework-modern-kicker">Class is that way</p>
            <h2 className="title-font framework-modern-title">MAPS</h2>
          </div>
          <div className="flex-1" />
          <Link to="/maps" className="framework-modern-cta w-full">
            Enter Maps
          </Link>
        </article>
      </div>
    </section>
  );
}
