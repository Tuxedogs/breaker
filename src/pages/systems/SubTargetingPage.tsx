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

export default function SubTargetingPage() {
  return (
    <section className="route-fade pb-8 pt-2">
      <div className="mx-auto max-w-[1180px] space-y-6">
        <article className="rounded-2xl border border-cyan-300/35 bg-[rgba(0,0,0,0.3)] p-5 backdrop-blur-[8px] sm:p-6">
          <p className="title-font text-xs uppercase tracking-[0.18em] text-slate-300">Systems Manual</p>
          <h1 className="title-font mt-2 text-4xl tracking-[0.08em] text-cyan-200 sm:text-5xl">
            Sub-Targeting Guide
          </h1>
          <p className="mt-3 text-2xl text-cyan-100/85">Targeting specific components for tactical advantage</p>
          <p className="mt-5 text-xl leading-normal text-slate-200">
            Sub-targeting is one of the most powerful tools available to not just gunners, but everyone. By
            targeting specific components of enemy ships, aim assist will pull your shots closer to your subtarget,
            instead of hitting center hull.
          </p>

          <div className="mt-6 overflow-hidden rounded-xl border border-cyan-300/25 bg-black/35">
            <div className="grid grid-cols-[1.2fr_0.7fr_1.8fr] border-b border-cyan-300/20 bg-cyan-950/25 px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-cyan-200">
              <span>Target Cycling</span>
              <span>Keybind</span>
              <span>Description</span>
            </div>
            <div className="divide-y divide-white/10">
              {keybindRows.map((row) => (
                <div
                  key={row.action}
                  className="grid grid-cols-[1.2fr_0.7fr_1.8fr] gap-3 px-4 py-3 text-lg leading-normal text-slate-200"
                >
                  <span>{row.action}</span>
                  <span className="text-slate-400">{row.keybind || "Unbound"}</span>
                  <span>{row.description}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mx-auto mt-6 w-full max-w-4xl rounded-xl border border-amber-300/35 bg-amber-900/20 p-4 text-lg leading-normal text-amber-200 backdrop-blur-[8px]">
            Normally you will want these both bound. 4.6 has a client crash with backwards{" "}
            <span className="font-bold">DO NOT BIND Cycle Back</span>.
          </div>

          <section className="mt-6">
            <h2 className="title-font text-3xl tracking-[0.04em] text-cyan-200">In Practice</h2>
            <div className="mt-5 rounded-xl border border-cyan-300/20 bg-black/30 p-5">
              <h3 className="title-font text-xl tracking-[0.08em] text-amber-300">Subtargeting Instructions</h3>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-lg leading-normal text-slate-200">
                <li>Acquire a fresh target lock.</li>
                <li>Aim in the general vicinity of the component you want to subtarget; accuracy matters.</li>
                <li>
                  Press <strong>Cycle Subtarget Forward</strong> once.
                </li>
                <li>Confirm the component highlights in the Target Status and casted MFDs.</li>
                <li>If the subtarget does not register, unlock the target and repeat.</li>
              </ol>

              <h3 className="title-font mt-7 text-xl tracking-[0.08em] text-cyan-300">Close-Range (Precision Mode)</h3>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-lg leading-normal text-slate-200">
                <li>Switch to Precision Mode at close range.</li>
                <li>Allow the desired component to highlight on the target.</li>
                <li>
                  Press <strong>Cycle Subtarget Forward</strong> while remaining locked.
                </li>
              </ol>

              <h3 className="title-font mt-7 text-xl tracking-[0.08em] text-cyan-300">Weapon Behavior</h3>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-lg leading-normal text-slate-200">
                <li>Auto-Gimbal will track the selected subtarget effectively at close range.</li>
                <li>
                  Missiles and torpedoes follow the selected subtarget and will strike as close as possible to the
                  intended component.
                </li>
              </ul>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {practiceImages.map((image) => (
                <article key={image.title} className="space-y-2">
                  <img
                    src={image.src}
                    alt={image.title}
                    className="aspect-[4/3] w-full rounded-lg border border-cyan-300/25 object-cover"
                    loading="lazy"
                  />
                  <p className="text-base leading-normal text-slate-300">{image.caption}</p>
                </article>
              ))}
            </div>
          </section>
        </article>

        <article className="rounded-2xl border border-cyan-300/35 bg-[rgba(0,0,0,0.3)] p-5 backdrop-blur-[8px] sm:p-6">
          <div className="grid gap-6 md:grid-cols-2 md:divide-x md:divide-cyan-300/20">
            <section>
              <h3 className="title-font text-2xl tracking-[0.06em] text-cyan-300">Components You Can Target</h3>
              <ul className="mt-4 space-y-2 text-xl leading-normal text-slate-200">
                {targetableComponents.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            <section className="md:pl-6">
              <h3 className="title-font text-2xl tracking-[0.06em] text-cyan-300">Cannot Lock, Can Destroy</h3>
              <ul className="mt-4 space-y-2 text-xl leading-normal text-slate-200">
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
