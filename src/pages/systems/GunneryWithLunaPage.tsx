type StatRow = {
  weapon: string;
  alpha: string;
  dps: string;
  rpm: string;
};

const velocityRows = [
  { weapon: "CF Series", velocity: "1800 m/s", effective: "900 m" },
  { weapon: "GT Series Ballistic Gatlings", velocity: "1600 m/s", effective: "800 m" },
  { weapon: "NDBs", velocity: "1400 m/s", effective: "700 m" },
  { weapon: "Breakneck S4 Gatling", velocity: "1450 m/s", effective: "725 m" },
];

const statRows: StatRow[] = [
  { weapon: "CF-337 Panther", alpha: "43.7", dps: "545.62", rpm: "750" },
  { weapon: "NDB-30", alpha: "85.5", dps: "712.5", rpm: "500" },
  { weapon: "Attrition", alpha: "134.8", dps: "786.2", rpm: "350" },
];

const spreadRows = [
  { weapon: "CF Series", spread: "0.6deg" },
  { weapon: "NDBs", spread: "0.55deg" },
  { weapon: "Attritions", spread: "0.5deg" },
];

export default function GunneryWithLunaPage() {
  return (
    <section className="route-fade pb-8 pt-2">
      <div className="mx-auto max-w-[1180px] space-y-6">
        <article className="rounded-2xl border border-cyan-300/35 bg-[rgba(0,0,0,0.3)] p-5 backdrop-blur-[8px] sm:p-6">
          <p className="title-font text-xs uppercase tracking-[0.18em] text-slate-300">Systems Manual</p>
          <h1 className="title-font mt-2 text-4xl tracking-[0.08em] text-cyan-200 sm:text-5xl">Gunnery with Luna</h1>
          <p className="mt-3 text-2xl text-cyan-100/85">
            Understanding delta, weapon velocities, and effective engagement ranges
          </p>

          <div className="mt-6 rounded-xl border border-red-300/35 bg-red-900/20 p-4 text-lg leading-normal text-red-200">
            <span className="font-semibold">Essential Knowledge:</span> Knowing the distance you can engage a target
            is essential for maintaining a healthy capacitor/ammo count and applying effective damage. This means
            knowing when to shoot, and more importantly when not to shoot.
          </div>
        </article>

        <article className="rounded-2xl border border-cyan-300/35 bg-[rgba(0,0,0,0.3)] p-5 backdrop-blur-[8px] sm:p-6">
          <h2 className="title-font text-3xl tracking-[0.04em] text-cyan-200">Delta</h2>
          <p className="mt-4 text-xl leading-normal text-slate-200">
            Delta is the relative speed difference between you and your target. Positive delta means the target is
            moving toward you. Negative delta means the target is moving away.
          </p>
          <div className="mt-5 rounded-xl border border-cyan-300/20 bg-black/30 p-5">
            <ul className="space-y-2 text-lg leading-normal text-slate-200">
              <li>
                <span className="font-semibold text-emerald-300">+100 delta:</span> target moving 100 m/s toward you.
              </li>
              <li>
                <span className="font-semibold text-red-300">-100 delta:</span> target moving 100 m/s away from you.
              </li>
              <li>
                <span className="font-semibold text-amber-300">0 delta:</span> stationary relative to you.
              </li>
            </ul>
          </div>
          <p className="mt-5 text-lg leading-normal text-slate-200">
            Practical example: if a target is 1 km away with +100 delta and your weapon velocity is 900 m/s, the
            target closes 100 m in that second. Your shot and target movement meet much faster than if the target is
            fleeing.
          </p>
        </article>

        <article className="rounded-2xl border border-cyan-300/35 bg-[rgba(0,0,0,0.3)] p-5 backdrop-blur-[8px] sm:p-6">
          <h2 className="title-font text-3xl tracking-[0.04em] text-cyan-200">Ship Weapons</h2>
          <p className="mt-4 text-xl leading-normal text-slate-200">
            This is essential for both turret gunners and pilots.
          </p>

          <div className="mt-5 rounded-xl border border-amber-300/35 bg-amber-900/20 p-4 text-lg leading-normal text-amber-200">
            <span className="font-semibold">Golden Rule:</span> Use repeaters or gatlings on turrets. Do not use
            cannons.
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-cyan-300/25 bg-black/35">
            <div className="grid grid-cols-[1.4fr_1fr_1fr] border-b border-cyan-300/20 bg-cyan-950/25 px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-cyan-200">
              <span>Weapon Group</span>
              <span>Velocity</span>
              <span>Effective Range</span>
            </div>
            <div className="divide-y divide-white/10">
              {velocityRows.map((row) => (
                <div key={row.weapon} className="grid grid-cols-[1.4fr_1fr_1fr] gap-3 px-4 py-3 text-lg leading-normal text-slate-200">
                  <span>{row.weapon}</span>
                  <span className="text-cyan-100">{row.velocity}</span>
                  <span className="text-amber-300">{row.effective}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-cyan-300/30 bg-cyan-950/20 p-4 text-lg leading-normal text-cyan-100">
            <span className="font-semibold">Effective Range Formula:</span> gun speed / 2 = rough effective range.
          </div>

          <h3 className="title-font mt-7 text-2xl tracking-[0.04em] text-cyan-200">Weapon Statistics Comparison</h3>
          <p className="mt-2 text-base uppercase tracking-[0.14em] text-cyan-200/80">All laser size 3 for comparison</p>

          <div className="mt-5 overflow-hidden rounded-xl border border-cyan-300/25 bg-black/35">
            <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] border-b border-cyan-300/20 bg-cyan-950/25 px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-cyan-200">
              <span>Weapon</span>
              <span>Alpha</span>
              <span>DPS</span>
              <span>RPM</span>
            </div>
            <div className="divide-y divide-white/10">
              {statRows.map((row) => (
                <div key={row.weapon} className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-3 px-4 py-3 text-lg leading-normal text-slate-200">
                  <span>{row.weapon}</span>
                  <span>{row.alpha}</span>
                  <span>{row.dps}</span>
                  <span>{row.rpm}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-5 text-lg leading-normal text-slate-200">
            CF repeaters fire faster and sustain longer capacitor uptime. Attritions hit harder but fire slower and
            drain faster. NDBs are the middle ground and are limited to smaller turret sizes.
          </p>
        </article>

        <article className="rounded-2xl border border-cyan-300/35 bg-[rgba(0,0,0,0.3)] p-5 backdrop-blur-[8px] sm:p-6">
          <h2 className="title-font text-3xl tracking-[0.04em] text-cyan-200">Weapon Spread</h2>
          <p className="mt-4 text-xl leading-normal text-slate-200">
            Spread is cone offset from your crosshair center. At short range it is minor; at long range, misses can be
            substantial.
          </p>

          <div className="mt-5 overflow-hidden rounded-xl border border-cyan-300/25 bg-black/35">
            <div className="grid grid-cols-[1.4fr_1fr] border-b border-cyan-300/20 bg-cyan-950/25 px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-cyan-200">
              <span>Weapon Group</span>
              <span>Spread</span>
            </div>
            <div className="divide-y divide-white/10">
              {spreadRows.map((row) => (
                <div key={row.weapon} className="grid grid-cols-[1.4fr_1fr] gap-3 px-4 py-3 text-lg leading-normal text-slate-200">
                  <span>{row.weapon}</span>
                  <span className="text-amber-300">{row.spread}</span>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-cyan-300/35 bg-[rgba(0,0,0,0.3)] p-5 backdrop-blur-[8px] sm:p-6">
          <h2 className="title-font text-3xl tracking-[0.04em] text-cyan-200">Ship Weapons - Penetration</h2>
          <p className="mt-4 text-xl italic leading-normal text-slate-400">Penetration guidance is TBD.</p>
        </article>
      </div>
    </section>
  );
}
