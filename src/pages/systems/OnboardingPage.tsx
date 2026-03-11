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
  { id: "c1", label: "Joined the Discord and received roles", group: "setup" },
  { id: "c2", label: "Set your keybinds from the Keybind Presets ref.", group: "setup" },
  { id: "c3", label: "Adjust game settings from the Settings ref.", group: "setup" },
  { id: "c4", label: "Informed of Mins Optimization doc.", group: "setup" },
  { id: "c5", label: "Stage at Grim Hex, Seraphim, or CRU-L1", group: "ingame" },
  { id: "c6", label: "Familiarity with StarMap QT interactions", group: "ingame" },
  { id: "c7", label: "Join a roaming/standing fleet", group: "crew" },
  { id: "c8", label: "Identify Orgmates that can help you, it's rewarding to collaborate", group: "ingame" },
  { id: "c10", label: "How to Attended a HWLR led introductory session", group: "crew" },
  { id: "c11", label: "Resource gathering/Crafting/Materials Sourcing activity", group: "crew" },
  
  { id: "c12", label: "Crewed or Piloted a multi-crew combat ship", group: "doc" },
  { id: "c13", label: "Understanding how to use Framework Routing page if needed", group: "doc" },
  { id: "c14", label: "Practice standard callout format on comms", group: "doc" },
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
    body: "When you die, you respawn at your last set spawn point. If that is not available, you are sent to your starting home location. We strongly advise against setting your spawn on any vehicles.",
  },
  {
    title: "StarMap (F2)",
    body: "Patch to patch reliability is inconsistent. Common issues setting/canceling routes. Reach out to orgmates for current patch issues and workarounds.",
  },
  {
    title: "Quantum Travel",
    body: "Spool and Align, hold. Never jump early during group ops. It severely impacts performance and can be a major contributor to losses.",
  },
  {
    title: "Gear & Insurance",
    body: "(4.6) You will not lose equipped gear on death. Exceptions are Railgun Magazines. Have minimum kit equipped.",
  },
  {
    title: "Crime Stat & Bounties",
    body: "(4.6) Bounty hunters get markers on CS3+ players in Stanton and Pyro. Do not muster with fleet.",
  },
  {
    title: "Party & Group Play",
    body: "Request invite during free comms, in game and not interacting with anything or waiting at Menu.",
  },
];

const opsSteps = [
  {
    title: "Event Posted in Discord",
    body: "FC posts op type, staging point, intent, and start window. React if attending and verify your assigned role.",
    tags: ["Discord", "React to attend"],
  },
  {
    title: "Stage Up & Party",
    body: "Get to the designated staging point well before the event, set respawn, and join party/voice. FC's are not expected to delay their ops for late arrivals.",
    tags: ["System", "Station", "Claim Ships", "FPS Kit"],
  },
  {
    title: "Transit & Group QT",
    body: "Spool and Align, hold for countdown. If you jump early, notify the FC immediately. Attempt full disengage. Listen for follow-up instructions.",
    tags: ["Hold for call", "Don't Mav in"],
  },
  {
    title: "On Station / Engagement",
    body: " Fighters maintain tight ball at all times. Follow FC kill targets, peel allies, and communicate critical status changes immediately.",
    tags: ["Follow FC", "Call relevant information" , "Don't die in silence"],
  },
  {
    title: "Exfil & Debrief",
    body: "RTB, complete quick debrief, assessment, and reset if required.",
    tags: ["Standing Down", "Scatter", "Reship"],
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
        <aside className="onboarding-sidebar-panel">
          <p className="title-font text-[11px] uppercase tracking-[0.24em] text-cyan-100/75">Onboarding</p>
          <nav className="mt-2">
            <ul className="space-y-0.5">
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

          <div className="mt-3 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between text-[11px] tracking-[0.16em] text-slate-300/75">
              <span>CHECKLIST</span>
              <span className="text-cyan-100/80">
                {doneCount} / {checklistItems.length}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded bg-white/10">
              <div className="h-full bg-cyan-300/85 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2.5 space-y-0.5">
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
                  <span className="text-pretty leading-tight">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          <section id="welcome" className="onboarding-panel-lg">
            <p className="onboarding-eyebrow">01 - Welcome</p>
            <h1 className="detail-page-title-cyan">New Member Briefing</h1>
            <p className="mt-3 text-slate-300/85">
              You&apos;ve just joined one of the most operationally coordinated and capable orgs in the game. This document
              will aid in getting you started before your first roam or event.
            </p>
            <div className="onboarding-welcome mt-4 lg:grid-cols-[1fr_auto] lg:items-start">
              <div>
                <p className="title-font text-xs uppercase tracking-[0.16em] text-cyan-100/70">Sons of Ares - Active Roster</p>
                <p className="mt-2 text-sm text-slate-200/85">
                  The Sons of Ares operate in a grey area and have <span className="text-red-500 font-bold">very few in game restrictions.</span> 
              </p>
                <p className="mt-2 text-sm text-slate-200/85">The most common activity you will find us doing is maintaining a flexible roaming fleet, allowing for freedom between activities. Scouting around active areas is a primary source of content for the Org.</p>
              
                <p className="mt-2 text-sm text-slate-200/85">
                  [LEGN] ranking and above are individuals that train together, stage together, and fight together. Centurions 
                  Read this briefing, run the checklist, and get yourself staged. We&apos;ll handle the rest.
                </p>
              </div>
              <div className="onboarding-sigil" aria-hidden="true">
                <div className="onboarding-sigil-core" />
              </div>
            </div>
          </section>

          <section id="org" className="onboarding-panel">
            <p className="onboarding-eyebrow">02 - Organization</p>
            <h2 className="surface-title-lg mt-2">Sons of Ares Rank Flow</h2>
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
                        <span>Prospect</span>
                        <span className="onboarding-rank-pips new">
                     
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="onboarding-badge new">YOU</span>
                    </td>
                    <td>Public Channels & Events</td>
                    <td>Probably a video of Min's</td>
                  </tr>
                  <tr>
                    <td>
                      <div className="onboarding-rank-cell">
                        <span className="font-bold">[ARES]</span>
                        <span className="onboarding-rank-pips crew-blue">
                          <i className="filled" />
                          <i className="" />
                          <i />
                          <i />
                          <i/>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="onboarding-badge crew-blue">ACTIVE</span>
                    </td>
                    <td>Membership, Access to base Org Events & Trainings</td>
                    <td>Meet base competency requirements and activity levels</td>
                  </tr>
                  <tr>
                    <td>
                      <div className="onboarding-rank-cell">
                        <span className="font-bold">[LEGN]</span>
                        <span className="onboarding-rank-pips veteran">
                          <i className="filled" />
                          <i className="filled" />
                          <i className="" />
                          <i />
                          <i/>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="onboarding-badge veteran">Core</span>
                    </td>
                    <td>Foundation Locked Resources and Comms</td>
                    <td>Consistent dependable presence</td>
                  </tr>
                   <tr>
                    <td>
                      <div className="onboarding-rank-cell">
                        <span className="font-bold">[HWLR]</span>
                        <span className="onboarding-rank-pips expert">
                          <i className="filled" />
                          <i className="filled" />
                          <i className="filled" />
                          <i />
                          <i/>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="onboarding-badge expert">Expert</span>
                    </td>
                    <td>Highly skilled, extremely capable, specialized.</td>
                    <td>Howlers requirements in Org Structure page</td>
                  </tr>
                  <tr>
                    <td>
                      <div className="onboarding-rank-cell">
                        <span className="font-bold">[OPTIO/PRAE]</span>
                        <span className="onboarding-rank-pips orange">
                          <i className="filled" />
                          <i className="filled" />
                          <i className="filled" />
                          <i className="filled"/>
                          <i/>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="onboarding-badge orange">Fleet Leads</span>
                    </td>
                    <td>Op planning, Training & Doctrine Implementation</td>
                    <td>Appointed by leadership</td>
                  </tr>
                    
                  <tr>
                    <td>
                      <div className="onboarding-rank-cell">
                        <span className="font-bold">Commander</span>
                        <span className="onboarding-rank-pips leaders-red">
                          <i className="filled" />
                          <i className="filled" />
                          <i className="filled" />
                          <i className="filled" />                          
                          <i className="filled" />

                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="onboarding-badge leaders-red">COMMAND</span>
                    </td>
                    <td>Org direction, engagement authority</td>
                    <td>Appointed by leadership</td>
                  </tr>
                  {/* Future Ranks - maybe specialty badges instead? */}
                  <tr> 
                    <td>
                      <div className="onboarding-rank-cell mt-3">
                        <span></span>
                        <span>
                          <i/>
                          <i/>
                          <i/>
                          <i/>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span></span>
                    </td>
                    <td className="font-bold text-slate-300/95">Non Leadership Ranks</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td>
                      <div className="onboarding-rank-cell">
                        <span className="font-bold">[TBD] Centurion</span>
                        <span className="onboarding-rank-pips expert">
                          <i className="filled" />
                          <i className="filled" />
                          <i className="" />
                          <i />
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="onboarding-badge expert">Expert</span>
                    </td>
                    <td>Specialized Resource in chosen domains</td>
                    <td>Appointed by leadership & Peers</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="onboarding-note mt-4">Ref Structure/ColorGrading/Tag consistency</div>
          </section>

          <section id="basics" className="onboarding-panel">
            <p className="onboarding-eyebrow">03 - Star Citizen Basics</p>
            <h2 className="surface-title-lg mt-2">Getting where we're going</h2>
            <p className="mt-2 text-sm text-slate-300/85">
              Star Citizen is rough on new players who don&apos;t know the systems and workarounds. These are the things that trip people up
              most.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {basicsCards.map((item) => (
                <article key={item.title} className="onboarding-tile">
                  <h3 className="title-font text-sm text-cyan-100">{item.title}</h3>
                  <p className="mt-2">{item.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="staging" className="onboarding-panel">
            <p className="onboarding-eyebrow">04 - Staging Locations</p>
            <h2 className="surface-title-lg mt-2">Where to Base Out Of</h2>
            <p className="mt-2 text-sm text-slate-300/85">
              Sons of Ares operates across all systems, based on potential target densities. These three points provide the most
              reliable response for unscheduled daily operations.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <article className="onboarding-stage-card recommended">
                <h3 className="title-font text-lg text-cyan-100">Grim Hex</h3>
                <p className="text-xs text-slate-400">Crusader / Yela Belt</p>
                <ul className="onboarding-list mt-2">
                  <li>No comms array, criminal states accepted</li>
                  <li>Station Defenses and Hangar security logic should be understood entirely</li>
                  <li>Do not be surprised by the above.</li>
                </ul>
              </article>
              <article className="onboarding-stage-card recommended">
                <h3 className="title-font text-lg text-cyan-100">Seraphim Station</h3>
                <p className="text-xs text-slate-400">Crusader Orbit</p>
                <ul className="onboarding-list mt-2">
                  <li>Significantly faster response times for capitals</li>
                  <li>External pads for multi-crew ships and Rapid Rearming</li>
                  <li>Subject to extremely long hangar/collar queue times </li>
                </ul>
              </article>
              <article className="onboarding-stage-card">
                <h3 className="title-font text-lg text-cyan-100">CRU-L1</h3>
                <p className="text-xs text-slate-400">Crusader L1</p>
                <ul className="onboarding-list mt-2">
                  <li>Lighter Traffic Zero G staging</li>
                  <li>Refinery services drives industrial traffic</li>
                  <li>Short commute to major hubs and other key locations</li>
                </ul>
              </article>
            </div>
            <div className="onboarding-note mt-4">Roaming operations into Pyro and Nyx typically stage out of Crusader.</div>
          </section>

          <section id="opsflow" className="onboarding-panel">
            <p className="onboarding-eyebrow">05 - Daily Ops Flow</p>
            <h2 className="surface-title-lg mt-2">How a Standard Event Runs</h2>
            <p className="mt-2 text-sm text-slate-300/85">
              Most ops follow roughly the same flow. Knowing it means you never hold the group up.
            </p>
            <ol className="mt-4 space-y-2">
              {opsSteps.map((step) => (
                <li key={step.title} className="onboarding-step">
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

          <section id="comms" className="onboarding-panel">
            <p className="onboarding-eyebrow">06 - Comms Discipline</p>
            <h2 className="surface-title-lg mt-2">How We Talk on Ops</h2>
            <p className="mt-2 text-sm text-slate-300/85">
              When entering a VC, wait a moment to listen and be aware that orgmates may be engaged in active combat.
            </p>
            <div className="mt-4 grid gap-3">
              {[
                "Push to talk or dialed in suppression for open mic during active operations.",
                "Short calls with clear targets and location references.",
                "FC has comms priority; acknowledge instructions quickly.",
                "Call status immediately: range, merge, effective, tails, self status and on/off grid.",
                "Use best judgement, if the FC gives an instruction, follow it. While appreciated, real time updates on every missile fired is unnecessary.",
              ].map((item, idx) => (
                <article key={item} className="onboarding-comms-row">
                  <span className="onboarding-comms-num">{String(idx + 1).padStart(2, "0")}</span>
                  <span>{item}</span>
                </article>
              ))}
            </div>
            <div className="onboarding-callout mt-4">
              <p className="title-font text-xs uppercase tracking-[0.18em] text-cyan-100/80">Hathor Callout Format Example</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="onboarding-callout-line"><strong>Who: </strong> Use your name, Hi I'm Tux.</div>
                <div className="onboarding-callout-line"><strong>What:</strong> Enemy ships. An Arrow and Hornet</div>
                <div className="onboarding-callout-line"><strong>Where:</strong> Bearing/Landmark, Altitude, Range</div>
                <div className="onboarding-callout-line"><strong>Percieved Intent:</strong> Engaging, Burning out, relative delta.</div>
                
              </div>
              <div className="title-font text-sm text-slate-300/100 mt-4"><strong></strong> <span className="font-bold text-cyan-500">Tux</span> has two incoming, <span className="font-bold text-red-700">Mish</span> and <span className="font-bold text-red-700">Omen</span>. <span className="text-orange-500">Hornet, Arrow</span>, towards <span className="font-bold text-slate-500">Crusader</span>, <span className="font-bold text-blue-700">High</span> at <span className="font-bold text-slate-500">14km</span>. <span className="text-red-700">Positive Delta.</span></div>
            </div>
          </section>

          <section id="checklist" className="onboarding-panel">
            <p className="onboarding-eyebrow">07 - Checklist</p>
            <h2 className="surface-title-lg mt-2">Milestone Tracker</h2>
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
                    While optional, congrats and thanks for completing the onboarding checklist. You're all set to jump in and find content with the org. Welcome aboard.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      to="/framework"
                      className="rounded-md border border-emerald-200/45 bg-emerald-300/15 px-4 py-2 text-xs uppercase tracking-[0.15em] text-emerald-100"
                    >
                      Enter Framework
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-300/75">Checklist is for those who want to track progress and is not mandatory.</p>
              )}
            </div>
          </section>
        </main>
      </div>
    </section>
  );
}
