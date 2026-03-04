import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

type GroupKey = "setup" | "ingame" | "crew" | "doc";

type ChecklistItem = {
  id: string;
  label: string;
  group: GroupKey;
};

const STORAGE_KEY = "ares_checklist_v1";

const sections = [
  { id: "welcome", label: "Welcome" },
  { id: "org", label: "Sons of Ares" },
  { id: "basics", label: "SC Basics" },
  { id: "staging", label: "Staging" },
  { id: "opsflow", label: "Ops Flow" },
  { id: "comms", label: "Comms" },
  { id: "checklist", label: "Checklist" },
] as const;

const checklistItems: ChecklistItem[] = [
  { id: "c1", label: "Join the Discord and introduce yourself", group: "setup" },
  { id: "c2", label: "Accept org invite in RSI profile", group: "setup" },
  { id: "c3", label: "Read the Framework Routing page", group: "setup" },
  { id: "c4", label: "Set your keybinds from the Keybind Presets doc", group: "setup" },
  { id: "c5", label: "Stage at Grim Hex, Seraphim, or CRU-L1", group: "ingame" },
  { id: "c6", label: "Set spawn point at your staging base", group: "ingame" },
  { id: "c7", label: "Complete a solo QT jump using StarMap", group: "ingame" },
  { id: "c8", label: "File an insurance claim after a ship loss", group: "ingame" },
  { id: "c9", label: "Party up with an org member in-game (F11)", group: "crew" },
  { id: "c10", label: "Crew a multi-crew ship (gunner or co-pilot seat)", group: "crew" },
  { id: "c11", label: "Attend your first organized op", group: "crew" },
  { id: "c12", label: "Know your role: Flying, Manning, or Facing", group: "doc" },
  { id: "c13", label: "Practice standard callout format on comms", group: "doc" },
  { id: "c14", label: "Complete a group QT jump with the FC", group: "doc" },
];

const groups: Array<{ key: GroupKey; title: string; accentClass: string }> = [
  { key: "setup", title: "Setup & Access", accentClass: "bg-cyan-300/85" },
  { key: "ingame", title: "First Steps In-Game", accentClass: "bg-amber-300/85" },
  { key: "crew", title: "Crew Readiness", accentClass: "bg-violet-300/85" },
  { key: "doc", title: "Doctrine Basics", accentClass: "bg-emerald-300/85" },
];

const basicsCards = [
  {
    title: "Respawn & Medical",
    body: "When you die, you respawn at your last set spawn point. Make sure this is your staging base, not a random outpost. Use mobiGlas (F1) medical tabs to track incapacitation vs full death.",
    tip: "Set spawn before ops",
  },
  {
    title: "mobiGlas (F1)",
    body: "Your wrist computer for contracts, map routing, inventory, and notifications. Use StarMap for QT routing and check notices for op updates.",
    tip: "F1 -> StarMap -> QT",
  },
  {
    title: "Quantum Travel",
    body: "Hold B to spool, then jump on the FC countdown. Never jump early during group ops or you split the formation.",
    tip: "Wait for group call",
  },
  {
    title: "Gear & Insurance",
    body: "You will lose gear on death. Keep critical kits in station or ship storage and plan for claim cycles after hull loss.",
    tip: "Store gear in ship",
  },
  {
    title: "Crime Stat & Bounties",
    body: "CS3+ puts you in active threat status in Stanton. Clear when required and respect op rules on engagement authorization.",
    tip: "Clear CS at Grim Hex",
  },
  {
    title: "Party & Group Play",
    body: "Use F11 before launch, join your assigned crew slot, and confirm access before departure. Group tools drive cohesion and survivability.",
    tip: "F11 -> Party first",
  },
];

const opsSteps = [
  {
    title: "Op Posted in Discord",
    body: "FC posts op type, staging point, ship comp, and start window. React if attending and verify your assigned role.",
    tags: ["Discord", "Op Channel"],
  },
  {
    title: "Stage Up & Party",
    body: "Get to the designated staging point, set respawn, and join party/voice. Confirm seat assignment before launch.",
    tags: ["Grim Hex", "Seraphim", "CRU-L1"],
  },
  {
    title: "Transit & Group QT",
    body: "Spool but hold for countdown. If you miss jump, call it immediately so FC can route recovery.",
    tags: ["Hold for call", "Don't lone wolf"],
  },
  {
    title: "On Station / Engagement",
    body: "Follow FC targeting calls, maintain assigned arcs, and report critical status changes immediately.",
    tags: ["Follow FC", "Call everything"],
  },
  {
    title: "Exfil & Debrief",
    body: "RTB, complete quick debrief, claim losses, and reset for next cycle.",
    tags: ["RTB", "Claim ships"],
  },
];

function readChecklistState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

export default function OnboardingPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>(() => readChecklistState());

  const doneCount = useMemo(() => checklistItems.filter((item) => checked[item.id]).length, [checked]);
  const progress = Math.round((doneCount / checklistItems.length) * 100);
  const isComplete = doneCount === checklistItems.length;

  function toggle(id: string) {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <section className="route-fade onboarding-shell py-4 sm:py-6">
      <div className="onboarding-layout">
        <aside className="onboarding-sidebar framework-modern-card-head rounded-xl p-3 sm:p-4">
          <p className="title-font text-[11px] uppercase tracking-[0.24em] text-cyan-100/75">Onboarding</p>
          <nav className="mt-3">
            <ul className="space-y-1">
              {sections.map((section, idx) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="onboarding-side-link">
                    <span className="onboarding-side-num">{String(idx + 1).padStart(2, "0")}</span>
                    <span>{section.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between text-[11px] tracking-[0.16em] text-slate-300/75">
              <span>CHECKLIST</span>
              <span className="text-cyan-100/80">
                {doneCount} / {checklistItems.length}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded bg-white/10">
              <div className="h-full bg-cyan-300/85 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-3 space-y-1">
              {checklistItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  className={`onboarding-mini-item ${checked[item.id] ? "done" : ""}`}
                >
                  <span className="onboarding-mini-check" aria-hidden="true">
                    {checked[item.id] ? "\u2713" : ""}
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          <section id="welcome" className="onboarding-section framework-modern-card-head rounded-xl p-5 sm:p-6">
            <p className="onboarding-eyebrow">01 - Welcome</p>
            <h1 className="title-font mt-2 text-3xl text-cyan-100 sm:text-4xl">New Member Briefing</h1>
            <p className="mt-3 text-slate-300/85">
              You&apos;ve just joined one of the most operationally coordinated multi-crew orgs in Stanton. This document
              is your first order of business.
            </p>
            <div className="onboarding-welcome mt-4">
              <div>
                <p className="title-font text-xs uppercase tracking-[0.16em] text-cyan-100/70">Sons of Ares - Active Roster</p>
                <p className="mt-2 text-sm text-slate-200/85">
                  Sons of Ares is a tactical multi-crew org rooted in disciplined coordination and doctrine-first
                  gameplay. We operate primarily out of Stanton with frequent roaming operations into Pyro, Nyx, and
                  surrounding systems as the verse expands.
                </p>
                <p className="mt-2 text-sm text-slate-200/85">
                  We&apos;re not a pickup group. We&apos;re a crew that trains together, stages together, and fights together.
                  Read this briefing, run the checklist, and get yourself staged. We&apos;ll handle the rest.
                </p>
              </div>
              <div className="onboarding-sigil" aria-hidden="true">
                <div className="onboarding-sigil-core" />
              </div>
            </div>
          </section>

          <section id="org" className="onboarding-section framework-modern-card-head rounded-xl p-5">
            <p className="onboarding-eyebrow">02 - Organization</p>
            <h2 className="title-font mt-2 text-2xl text-cyan-100">Sons of Ares Rank Flow</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="onboarding-table w-full">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Status</th>
                    <th>Role & Access</th>
                    <th>How You Get Here</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div className="onboarding-rank-cell">
                        <span>Recruit</span>
                        <span className="onboarding-rank-pips">
                          <i className="filled" />
                          <i />
                          <i />
                          <i />
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="onboarding-badge new">NEW</span>
                    </td>
                    <td>Full org access, ops participation, comms channels open</td>
                    <td>Complete onboarding and stage correctly</td>
                  </tr>
                  <tr>
                    <td>
                      <div className="onboarding-rank-cell">
                        <span>Operative</span>
                        <span className="onboarding-rank-pips">
                          <i className="filled" />
                          <i className="filled" />
                          <i />
                          <i />
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="onboarding-badge active">ACTIVE</span>
                    </td>
                    <td>Can lead wing positions and access advanced doctrine</td>
                    <td>Attend 3+ ops and show role competency</td>
                  </tr>
                  <tr>
                    <td>
                      <div className="onboarding-rank-cell">
                        <span>Vanguard</span>
                        <span className="onboarding-rank-pips">
                          <i className="filled" />
                          <i className="filled" />
                          <i className="filled" />
                          <i />
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="onboarding-badge veteran">VETERAN</span>
                    </td>
                    <td>Trusted crew lead and trainer for recruits</td>
                    <td>Consistent presence and multi-role reliability</td>
                  </tr>
                  <tr>
                    <td>
                      <div className="onboarding-rank-cell">
                        <span>Commander</span>
                        <span className="onboarding-rank-pips">
                          <i className="filled" />
                          <i className="filled" />
                          <i className="filled" />
                          <i className="filled" />
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="onboarding-badge command">COMMAND</span>
                    </td>
                    <td>Op planning, org direction, engagement authority</td>
                    <td>Appointed by leadership</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="onboarding-note mt-4">Rank is earned through reliability, not time served.</div>
          </section>

          <section id="basics" className="onboarding-section framework-modern-card-head rounded-xl p-5">
            <p className="onboarding-eyebrow">03 - Star Citizen Basics</p>
            <h2 className="title-font mt-2 text-2xl text-cyan-100">Before Your First Op</h2>
            <p className="mt-2 text-sm text-slate-300/85">
              Star Citizen is rough on new players who don&apos;t know the systems. These are the things that trip people up
              most.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {basicsCards.map((item) => (
                <article key={item.title} className="onboarding-tile">
                  <h3 className="title-font text-sm text-cyan-100">{item.title}</h3>
                  <p className="mt-2">{item.body}</p>
                  <span className="onboarding-tip mt-3">{item.tip}</span>
                </article>
              ))}
            </div>
          </section>

          <section id="staging" className="onboarding-section framework-modern-card-head rounded-xl p-5">
            <p className="onboarding-eyebrow">04 - Staging Locations</p>
            <h2 className="title-font mt-2 text-2xl text-cyan-100">Where to Base Out Of</h2>
            <p className="mt-2 text-sm text-slate-300/85">
              Sons of Ares operates across Stanton and rotates into Pyro regularly. These three points provide the most
              reliable response and logistics flow.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <article className="onboarding-stage-card recommended">
                <h3 className="title-font text-lg text-cyan-100">Grim Hex</h3>
                <p className="text-xs text-slate-400">Crusader / Yela Belt</p>
                <ul className="onboarding-list mt-2">
                  <li>No crime stat required to dock</li>
                  <li>CS clearance access and rapid deployment</li>
                  <li>Central Stanton response timing</li>
                </ul>
              </article>
              <article className="onboarding-stage-card recommended">
                <h3 className="title-font text-lg text-cyan-100">Seraphim Station</h3>
                <p className="text-xs text-slate-400">Crusader L2</p>
                <ul className="onboarding-list mt-2">
                  <li>Best pre-Pyro staging lane</li>
                  <li>Large-pad access for multi-crew ships</li>
                  <li>Strong logistics and med support</li>
                </ul>
              </article>
              <article className="onboarding-stage-card">
                <h3 className="title-font text-lg text-cyan-100">CRU-L1</h3>
                <p className="text-xs text-slate-400">Crusader L1</p>
                <ul className="onboarding-list mt-2">
                  <li>Safer fallback for newer members</li>
                  <li>Lower conflict pressure than active hubs</li>
                  <li>Good refuel/restock reset location</li>
                </ul>
              </article>
            </div>
            <div className="onboarding-note mt-4">Roaming operations into Pyro and Nyx stage from Seraphim by default.</div>
          </section>

          <section id="opsflow" className="onboarding-section framework-modern-card-head rounded-xl p-5">
            <p className="onboarding-eyebrow">05 - Daily Ops Flow</p>
            <h2 className="title-font mt-2 text-2xl text-cyan-100">How a Standard Op Runs</h2>
            <p className="mt-2 text-sm text-slate-300/85">
              Every op follows roughly the same flow. Knowing it means you never hold the group up.
            </p>
            <ol className="mt-4 space-y-2">
              {opsSteps.map((step, index) => (
                <li key={step.title} className="onboarding-step">
                  <span className="onboarding-step-num">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="title-font text-xs uppercase tracking-[0.12em] text-cyan-100/85">{step.title}</p>
                    <p className="mt-1 text-sm text-slate-200/85">{step.body}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {step.tags.map((tag) => (
                        <span key={tag} className="onboarding-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section id="comms" className="onboarding-section framework-modern-card-head rounded-xl p-5">
            <p className="onboarding-eyebrow">06 - Comms Discipline</p>
            <h2 className="title-font mt-2 text-2xl text-cyan-100">How We Talk on Ops</h2>
            <p className="mt-2 text-sm text-slate-300/85">
              Bad comms kill ops faster than bad flying. Keep it clear and short.
            </p>
            <div className="mt-4 grid gap-3">
              {[
                "Push to talk, not open mic, during active operations.",
                "Short calls with clear targets and location references.",
                "FC has comms priority; acknowledge instructions quickly.",
                "Call status immediately: going down, respawning, returning.",
                "No rage and no backseat command during active engagements.",
              ].map((item, idx) => (
                <article key={item} className="onboarding-comms-row">
                  <span className="onboarding-comms-num">{String(idx + 1).padStart(2, "0")}</span>
                  <span>{item}</span>
                </article>
              ))}
            </div>
            <div className="onboarding-callout mt-4">
              <p className="title-font text-xs uppercase tracking-[0.16em] text-cyan-100/80">Standard Callout Format</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="onboarding-callout-line"><strong>Who:</strong> Callsign or role (Gunner 2 / Zephyr).</div>
                <div className="onboarding-callout-line"><strong>What:</strong> Ship type and count.</div>
                <div className="onboarding-callout-line"><strong>Where:</strong> Clock position or relative bearing.</div>
                <div className="onboarding-callout-line"><strong>Intent:</strong> Engaging, tracking, or requesting action.</div>
              </div>
            </div>
          </section>

          <section id="checklist" className="onboarding-section framework-modern-card-head rounded-xl p-5">
            <p className="onboarding-eyebrow">07 - Checklist</p>
            <h2 className="title-font mt-2 text-2xl text-cyan-100">Milestone Tracker</h2>
            <p className="mt-2 text-sm text-slate-300/80">
              Work through these before your first real op. Tick them off as you go - progress saves in your browser.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {groups.map((group) => {
                const items = checklistItems.filter((item) => item.group === group.key);
                const groupDone = items.filter((item) => checked[item.id]).length;
                return (
                  <article key={group.key} className="onboarding-check-group">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${group.accentClass}`} />
                        <h3 className="title-font text-sm text-cyan-100">{group.title}</h3>
                      </div>
                      <span className="text-xs text-slate-300/75">
                        {groupDone}/{items.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggle(item.id)}
                          className={`onboarding-check-item ${checked[item.id] ? "done" : ""}`}
                        >
                          <span className="onboarding-check-box">{checked[item.id] ? "\u2713" : ""}</span>
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-5">
              {isComplete ? (
                <div className="rounded-xl border border-emerald-300/35 bg-emerald-400/10 p-4">
                  <p className="title-font text-sm text-emerald-100">Onboarding Complete - Welcome to the Crew.</p>
                  <p className="mt-1 text-sm text-emerald-50/85">
                    You&apos;re cleared for full ops participation. Check the Framework for role-specific modules.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      to="/framework"
                      className="rounded-md border border-emerald-200/45 bg-emerald-300/15 px-4 py-2 text-xs uppercase tracking-[0.15em] text-emerald-100"
                    >
                      Enter Framework
                    </Link>
                    <Link
                      to="/modules"
                      className="rounded-md border border-white/25 bg-white/8 px-4 py-2 text-xs uppercase tracking-[0.15em] text-slate-100"
                    >
                      View Roles
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-300/75">Complete all checklist items to unlock full ops access.</p>
              )}
            </div>
          </section>
        </main>
      </div>
    </section>
  );
}
