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
    to: "/wip/camera-tracking",
  },
  {
    title: "Performance",
    subtitle: "Client settings and performance profile.",
    to: "/wip/performance",
  },
];

export default function SetupRail() {
  return (
    <section>
      <Link to="/maps" className="setup-maps-card section-hub-card">
        <span className="section-hub-copy">
          <span className="title-font section-hub-title">MAPS</span>
          <span className="section-hub-subtitle">Deck maps, POIs, and ship layout references.</span>
        </span>
        <span className="section-hub-indicator" aria-hidden="true" />
      </Link>

      <div className="mt-6 card-head-sm">
        <h2 className="title-font text-lg text-cyan-100/90">Setup &amp; Configuration</h2>
        <p className="mt-2 text-sm text-slate-300/80">Pre-flight settings, bindings, and client configuration</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {setupItems.map((item) => (
          <Link
            key={item.title}
            to={item.to}
            className="setup-config-item framework-modern-row rounded-lg p-3 transition"
          >
            <h3 className="title-font text-base text-slate-100">{item.title}</h3>
            <p className="mt-2 text-xs text-slate-300/70">{item.subtitle}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
