import GlassCard from "../components/GlassCard";
import IndexList, { type IndexListItem } from "../components/IndexList";

function PlaceholderIcon({ glyph }: { glyph: string }) {
  return (
    <span className="text-sm font-bold uppercase tracking-[0.08em] text-white/90">
      {glyph}
    </span>
  );
}

const shipItems: IndexListItem[] = [
  {
    label: "Perseus",
    description: "Light Attack - Hit & Run",
    to: "/ships/perseus",
    icon: <PlaceholderIcon glyph="PS" />,
  },
  {
    label: "Polaris",
    description: "Heavy Gunship - Broadside",
    to: "/ships/polaris",
    icon: <PlaceholderIcon glyph="PL" />,
  },
  {
    label: "Idris",
    description: "Carrier - Capital Engagement",
    to: "/ships/idris",
    icon: <PlaceholderIcon glyph="ID" />,
  },
];

const systemItems: IndexListItem[] = [
  { label: "Sub-Targeting", to: "/systems/sub-targeting", icon: <PlaceholderIcon glyph="TG" /> },
  {
    label: "Turret Keybinds",
    to: "/systems/turret-keybinds",
    icon: <PlaceholderIcon glyph="KB" />,
    children: [
      {
        label: "Additional Settings & Binds",
        to: "/systems/additional-settings-binds",
        icon: <PlaceholderIcon glyph="AD" />,
      },
    ],
  },
  { label: "Gunnery with Luna", to: "/systems/gunnery-with-luna", icon: <PlaceholderIcon glyph="GN" /> },
  { label: "Communications", to: "/systems/communications", icon: <PlaceholderIcon glyph="CM" /> },
  { label: "Additional Resources", to: "/systems/additional-resources", icon: <PlaceholderIcon glyph="RS" /> },
];

export default function DoctrineFirstFramework() {
  return (
    <section className="route-fade min-h-[calc(100vh-7.5rem)] py-3">
      <div className="mb-16 text-center">
        <p className="title-font text-[11px] uppercase tracking-[0.34em] text-slate-300/80">Field Manual v1.0</p>
        <h1
          className="title-font mt-2 text-3xl font-medium tracking-[0.14em] text-white sm:text-4xl"
          style={{ textShadow: "0 0 14px rgba(160,190,255,0.22)" }}
        >
          A DOCTRINE-FIRST FRAMEWORK
        </h1>
        <p
          className="title-font mt-2 text-xl font-medium uppercase tracking-[0.2em] text-slate-200 sm:text-2xl"
          style={{ textShadow: "0 0 12px rgba(160,190,255,0.18)" }}
        >
          FOR MULTI-CREW COMBAT
        </p>
        <div className="mx-auto mt-5 h-px w-24 rounded-full bg-amber-200/80 shadow-[0_0_8px_rgba(255,181,70,0.75)]" />
      </div>

      <div className="grid items-stretch gap-8 lg:gap-12 lg:grid-cols-2">
        <div className="h-[66vh] min-h-[500px]">
          <GlassCard
            accentColor="rgba(255, 181, 70, 0.98)"
            accentSoft="rgba(255, 181, 70, 0.26)"
            title="SHIPS"
            subtitle="Combat Platforms"
            ctaLabel="ENTER SHIPS ->"
            ctaTo="/ships/perseus"
            centerBloom
            centeredHeader
            showHeaderMarker
            shipsStyle
          >
            <IndexList items={shipItems} shipsStyle />
          </GlassCard>
        </div>

        <div className="h-[66vh] min-h-[500px]">
          <GlassCard
            accentColor="rgba(78, 214, 255, 0.98)"
            accentSoft="rgba(78, 214, 255, 0.25)"
            title="SYSTEMS"
            subtitle="Procedures & Operations"
            ctaLabel="ENTER SYSTEMS ->"
            ctaTo="/systems/sub-targeting"
            centerBloom
            centeredHeader
            showHeaderMarker
            shipsStyle
          >
            <IndexList items={systemItems} shipsStyle />
          </GlassCard>
        </div>
      </div>
    </section>
  );
}
