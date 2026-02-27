import { Link } from "react-router-dom";

const setupItems = [
  {
    title: "Flight Settings",
    subtitle: "Adjust control and targeting options.",
    to: "/systems/additional-settings-binds",
  },
  {
    title: "Keybind Presets",
    subtitle: "Configure and verify keybind baselines.",
    to: "/systems/turret-keybinds",
  },
  {
    title: "Camera & Tracking",
    subtitle: "Tune view and tracking persistence.",
    to: "/systems/additional-settings-binds",
  },
  {
    title: "Performance",
    subtitle: "Client settings and performance profile.",
    to: "/systems/additional-settings-binds",
  },
];

export default function SetupRail() {
  return (
    <section className="framework-modern-card-head rounded-xl border border-white/10 bg-slate-950/25 p-4 sm:p-5">
      <h2 className="title-font text-lg text-cyan-100/90">Setup &amp; Configuration</h2>
      <p className="mt-2 text-sm text-slate-300/80">Pre-flight settings, bindings, and client configuration</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {setupItems.map((item) => (
          <Link
            key={item.title}
            to={item.to}
            className="framework-modern-row rounded-lg border border-white/12 bg-slate-950/25 p-3 transition hover:border-cyan-200/25 hover:bg-slate-900/40"
          >
            <h3 className="title-font text-base text-slate-100">{item.title}</h3>
            <p className="mt-2 text-xs text-slate-300/70">{item.subtitle}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
