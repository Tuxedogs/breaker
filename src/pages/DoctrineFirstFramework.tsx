import GlassCard from "../components/GlassCard";
import IndexList, { type IndexListItem } from "../components/IndexList";

const shipItems: IndexListItem[] = [
  { label: "Perseus", to: "/ships/perseus" },
  { label: "Polaris", to: "/ships/polaris" },
  { label: "Idris", to: "/ships/idris" },
];

const systemItems: IndexListItem[] = [
  { label: "Sub-Targeting", to: "/systems/sub-targeting" },
  {
    label: "Turret Keybinds",
    to: "/systems/turret-keybinds",
    children: [{ label: "Additional Settings & Binds", to: "/systems/additional-settings-binds" }],
  },
  { label: "Gunnery with Luna", to: "/systems/gunnery-with-luna" },
  { label: "Communications", to: "/systems/communications" },
  { label: "Additional Resources", to: "/systems/additional-resources" },
];

export default function DoctrineFirstFramework() {
  return (
    <section className="route-fade min-h-[calc(100vh-7.5rem)] py-3">
      <div className="mb-7 text-center">
        <p className="title-font text-xs uppercase tracking-[0.28em] text-slate-300">Field Manual v1.0</p>
        <h1 className="title-font mt-4 text-3xl text-white sm:text-4xl">A DOCTRINE-FIRST FRAMEWORK</h1>
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <div className="h-[72vh] min-h-[540px]">
          <GlassCard
            accentColor="rgba(255, 181, 70, 0.98)"
            accentSoft="rgba(255, 181, 70, 0.26)"
            title="SHIPS"
            subtitle="Combat Platforms"
            ctaLabel="ENTER SHIPS ->"
            ctaTo="/ships/perseus"
          >
            <IndexList items={shipItems} />
          </GlassCard>
        </div>

        <div className="h-[72vh] min-h-[540px]">
          <GlassCard
            accentColor="rgba(78, 214, 255, 0.98)"
            accentSoft="rgba(78, 214, 255, 0.25)"
            title="SYSTEMS"
            subtitle="Procedures & Operations"
            ctaLabel="ENTER SYSTEMS ->"
            ctaTo="/systems/sub-targeting"
          >
            <IndexList items={systemItems} />
          </GlassCard>
        </div>
      </div>
    </section>
  );
}
