const keybindRows = [
  {
    action: "Cycle Sub-Target Forward",
    keybind: "",
    description:
      "Extremely important. Cycle through key components for more effective damage.",
  },
  {
    action: "Cycle Sub-Target Back",
    keybind: "",
    description: "Cycle backwards if you skip the intended component.",
  },
];

const practiceImages = [
  {
    title: "idrispower1",
    src: "/images/subtargeting/idrispower1.png",
    caption:
      "Components highlight directly on the target; cycle subtarget forward while remaining locked.",
  },
  {
    title: "idrispower2",
    src: "/images/subtargeting/idrispower2.png",
    caption:
      "Correct subtarget selected. The component highlights in the Target Status and casted MFD after cycling subtargets.",
  },
  {
    title: "idrisgimbal",
    src: "/images/subtargeting/idrisgrimbal.png",
    caption:
      "Auto-Gimbal tracks the selected subtarget. Missiles and torpedoes follow the same logic and strike as close as possible to the intended component.",
  },
];

const targetableComponents = [
  "Power Plants",
  "Engines",
  "Weapons",
  "Shields",
  "Quantum Drive",
  "PDC's",
];

const nonLockableComponents = [
  "Maneuvering Thrusters",
  "Most Radar",
  "Retro Thrusters",
  "Missile racks",
  "Self-Worth",
];

const placeholderVideo = {
  title: "Subtargeting Cinematic Walkthrough",
  caption: "Placeholder video area. Drop final clip here when ready.",
};

export default function SubTargetingPage() {
  function renderKeybind(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return <span className="turret-keybind-empty">Unbound</span>;
    }

    const parts = trimmed.split("+").map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0) {
      return <span className="turret-keybind-empty">Unbound</span>;
    }

    return (
      <span className="turret-keybind-chip-wrap inline-flex flex-wrap items-center gap-1">
        {parts.map((part, idx) => (
          <span key={`${part}-${idx}`} className="inline-flex items-center gap-1">
            {idx > 0 ? <span className="text-slate-400">+</span> : null}
            <span className="turret-keybind-chip rounded border border-cyan-200/35 bg-cyan-950/30 px-1.5 py-0.5 text-slate-100">
              {part}
            </span>
          </span>
        ))}
      </span>
    );
  }

  return (
    <section className="subtarget-modern turret-modern additional-modern route-fade pb-8 pt-2">
      <div className="mx-auto max-w-[1180px] space-y-4">
        <article className="framework-modern-card framework-modern-card-systems additional-hero additional-panel rounded-2xl border border-cyan-300/35 p-4 backdrop-blur-[8px] sm:p-5">
          <div className="framework-modern-card-head additional-panel-head rounded-[1.2rem] border border-white/18 p-4 sm:p-5">
            <p className="framework-modern-kicker">Systems Manual</p>
            <h1 className="title-font mt-2 text-4xl tracking-[0.08em] text-cyan-200 sm:text-5xl">Sub-Targeting Guide</h1>
            <p className="mt-2 text-lg uppercase tracking-[0.1em] text-cyan-100/85 sm:text-xl">
              Targeting specific components for tactical advantage
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="additional-chip">Target Cycling</span>
              <span className="additional-chip">Component Focus</span>
              <span className="additional-chip">Gimbal Behavior</span>
            </div>
            <p className="mt-4 text-base leading-relaxed text-slate-200 sm:text-lg">
              Sub-targeting is one of the most powerful tools available to not just gunners, but everyone. By
              targeting specific components of enemy ships, aim assist will pull your shots closer to your subtarget,
              instead of hitting center hull.
            </p>
          </div>

          <div className="turret-table additional-table mt-4 overflow-hidden rounded-xl border border-cyan-300/25">
            <div className="turret-table-head">
              <span>Target Cycling</span>
              <span>Keybind</span>
              <span>Description</span>
            </div>
            <div className="divide-y divide-white/10">
              {keybindRows.map((row) => (
                <div key={row.action} className="turret-table-row additional-table-row">
                  <span className="turret-cell-action" data-label="Target Cycling">{row.action}</span>
                  <span className="turret-cell-keybind text-slate-300" data-label="Keybind">{renderKeybind(row.keybind)}</span>
                  <span className="turret-cell-description" data-label="Description">{row.description}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="subtarget-warning mt-6 w-full rounded-xl border border-amber-300/35 p-4 text-base leading-relaxed text-amber-200 sm:text-lg">
            Normally you will want these both bound. 4.6 has a client crash with backwards{" "}
            <span className="font-bold">DO NOT BIND Cycle Back</span>.
          </div>
        </article>

        <article className="framework-modern-card framework-modern-card-systems additional-panel rounded-2xl border border-cyan-300/35 p-4 backdrop-blur-[8px] sm:p-5">
          <div className="framework-modern-card-head additional-panel-head subtarget-video-shell rounded-xl border border-white/15 p-4 sm:p-5">
            <div className="subtarget-cinematic">
              <div className="subtarget-cinematic-top">
                <span>{placeholderVideo.title}</span>
                <span>Placeholder</span>
              </div>
              <div className="subtarget-cinematic-frame">
                <div className="subtarget-cinematic-glow" />
                <div className="subtarget-cinematic-play" aria-hidden />
                <p className="subtarget-cinematic-caption">{placeholderVideo.caption}</p>
              </div>
            </div>
          </div>
        </article>

        <article className="framework-modern-card framework-modern-card-systems additional-panel rounded-2xl border border-cyan-300/35 p-4 backdrop-blur-[8px] sm:p-5">
          <section className="subtarget-practice-layout space-y-4">
            <article className="framework-modern-card-head additional-panel-head subtarget-practice-card rounded-xl border border-white/15 p-4 sm:p-5">
              <h2 className="title-font text-2xl tracking-[0.05em] text-cyan-200 sm:text-3xl">In Practice</h2>

              <div className="subtarget-practice-block mt-5">
                <h3 className="title-font text-lg tracking-[0.08em] text-amber-300">Subtargeting Instructions</h3>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-base leading-relaxed text-slate-200">
                  <li>Acquire a fresh target lock.</li>
                  <li>Aim in the general vicinity of the component you want to subtarget; accuracy matters.</li>
                  <li>
                    Press <strong>Cycle Subtarget Forward</strong> once.
                  </li>
                  <li>Confirm the component highlights in the Target Status and casted MFDs.</li>
                  <li>If the subtarget does not register, unlock the target and repeat.</li>
                </ol>
              </div>

              <div className="subtarget-practice-block mt-6">
                <h3 className="title-font text-lg tracking-[0.08em] text-cyan-300">Close-Range (Precision Mode)</h3>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-base leading-relaxed text-slate-200">
                  <li>Switch to Precision Mode at close range.</li>
                  <li>Allow the desired component to highlight on the target.</li>
                  <li>
                    Press <strong>Cycle Subtarget Forward</strong> while remaining locked.
                  </li>
                </ol>
              </div>

              <div className="subtarget-practice-block mt-6">
                <h3 className="title-font text-lg tracking-[0.08em] text-cyan-300">Weapon Behavior</h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-slate-200">
                  <li>Auto-Gimbal will track the selected subtarget effectively at close range.</li>
                  <li>
                    Missiles and torpedoes follow the selected subtarget and will strike as close as possible to the
                    intended component.
                  </li>
                </ul>
              </div>
            </article>

            <aside className="framework-modern-card-head additional-panel-head subtarget-reference-card rounded-xl border border-white/15 p-4 sm:p-5">
              <h3 className="title-font text-lg tracking-[0.08em] text-cyan-300">Reference Frames</h3>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {practiceImages.map((image) => (
                  <article key={image.title} className="subtarget-image-card">
                    <img
                      src={image.src}
                      alt={image.title}
                      className="aspect-[16/10] w-full rounded-md border border-cyan-300/25 object-cover"
                      loading="lazy"
                    />
                    <p className="mt-1 text-xs leading-snug text-slate-300">{image.caption}</p>
                  </article>
                ))}
              </div>
            </aside>
          </section>
        </article>

        <article className="framework-modern-card framework-modern-card-systems additional-panel rounded-2xl border border-cyan-300/35 p-4 backdrop-blur-[8px] sm:p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <section className="framework-modern-card-head additional-panel-head rounded-xl border border-white/15 p-4 sm:p-5">
              <h3 className="title-font text-xl tracking-[0.06em] text-cyan-300 sm:text-2xl">Components You Can Target</h3>
              <ul className="mt-4 space-y-2 text-base leading-relaxed text-slate-200 sm:text-lg">
                {targetableComponents.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            <section className="framework-modern-card-head additional-panel-head rounded-xl border border-white/15 p-4 sm:p-5">
              <h3 className="title-font text-xl tracking-[0.06em] text-cyan-300 sm:text-2xl">Cannot Lock, Can Destroy</h3>
              <ul className="mt-4 space-y-2 text-base leading-relaxed text-slate-200 sm:text-lg">
                {nonLockableComponents.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </div>
        </article>
      </div>
    </section>
  );
}
