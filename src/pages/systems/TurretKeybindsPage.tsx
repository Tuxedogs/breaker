import { Link } from "react-router-dom";

type KeybindRow = {
  action: string;
  keybind: string;
  description: string;
};

type KeybindSection = {
  title: string;
  subtitle?: string;
  columns: [string, string, string];
  rows: KeybindRow[];
};

const seatsAndOperatorModes: KeybindRow[] = [
  { action: "Enter Remote Turret 1", keybind: "", description: "" },
  { action: "Enter Remote Turret 2", keybind: "", description: "" },
  { action: "Enter Remote Turret 3", keybind: "", description: "" },
];

const cockpit: KeybindRow[] = [
  {
    action: "Flight / Systems Ready",
    keybind: "",
    description: "Should already be set. You can chain additional preferences to this key if needed",
  },
];

const mfds: KeybindRow[] = [
  { action: "Cycle Page - Forwards (Short Press)", keybind: "E", description: "" },
  { action: "Cycle Page - Backwards (Short Press)", keybind: "Left Shift + E", description: "" },
  { action: "Select - MFD 1 (Short Press)", keybind: "Left Alt + Q", description: "" },
  { action: "Select - MFD 2 (Short Press)", keybind: "Left Alt + E", description: "" },
  { action: "Set Page - Communications (Short Press)", keybind: "Left Alt + E", description: "" },
  { action: "Set Page - Resource Network (Short Press)", keybind: "Left Alt + Q", description: "" },
];

const targeting: KeybindRow[] = [
  {
    action: "Auto Targeting: Toggle Off (Short Press)",
    keybind: "",
    description: "Bind this to the same key as your Flight Ready Key",
  },
  {
    action: "Pin Index 1, 2, 3 - Lock/Unlock",
    keybind: "",
    description: "Currently broken but keep these binds for when it's fixed",
  },
  {
    action: "Pin Index 1, 2, 3 - Pin/Unpin",
    keybind: "",
    description: "The actual assigning of the pins to friendlies/enemies",
  },
];

const targetCycling: KeybindRow[] = [
  {
    action: "Cycle Sub-Target Forward",
    keybind: "",
    description: "Extremely important. Cycle through key components for more effective damage",
  },
  {
    action: "Cycle Sub-Target Back",
    keybind: "",
    description: "Cycle backwards if you skip the intended component",
  },
];

const turretMovement: KeybindRow[] = [
  {
    action: "Toggle Turret Mouse Movement",
    keybind: "Q (Default)",
    description: "Unless you're experienced in relative mode, unbind this entirely",
  },
  { action: "Exit Remote Turret", keybind: "Y", description: "Tapping inner-thought key pulls you out of turret view" },
  { action: "Turret Gyro Stabilization (Toggle)", keybind: "E", description: "Toggle is fine since it's an observable state change" },
  { action: "Next Remote Turret", keybind: "D", description: "Rotate through multiple remote turrets per seat without exiting" },
  { action: "Previous Remote Turret", keybind: "", description: "Same as above, reverse direction" },
];

const turretAdvanced: KeybindRow[] = [
  { action: "Recenter Turret (HOLD)", keybind: "C (Default)", description: "Extremely important. You'll use this very frequently" },
  {
    action: "Cycle fire mode (staggered/combined)",
    keybind: "",
    description: "Situational. Remain combined unless requested by PIC or Master Gunner",
  },
  { action: "Change Turret Position", keybind: "S (Default)", description: "Currently only used in Scorpius and A1 ships" },
  { action: "Turret - Speed Limiter", keybind: "", description: "Not recommended. Get used to maximum turret speed instead" },
];

const weapons: KeybindRow[] = [
  {
    action: "Set Lead / Set Lag Pips",
    keybind: "",
    description: "Lag allows more precision for targeting externals that cannot be sub-targeted",
  },
  { action: "Cycle Gimbal Assist Modes", keybind: "RALT-G (Default)", description: "Switch from Auto gimbal to Manual when needed" },
];

const sections: KeybindSection[] = [
  {
    title: "Vehicles - Seats and Operator Modes",
    columns: ["Action", "Keybind", "Description"],
    rows: seatsAndOperatorModes,
  },
  {
    title: "Vehicles - Cockpit",
    columns: ["Action", "Keybind", "Description"],
    rows: cockpit,
  },
  {
    title: "Multi Function Displays (MFDs)",
    subtitle: "Example bindings (mirrored from 0men/Tux)",
    columns: ["Action", "Keybind", "Notes"],
    rows: mfds,
  },
  {
    title: "Vehicles - Targeting",
    columns: ["Action", "Keybind", "Description"],
    rows: targeting,
  },
  {
    title: "Target Cycling",
    columns: ["Action", "Keybind", "Description"],
    rows: targetCycling,
  },
  {
    title: "Turret Movement",
    columns: ["Action", "Keybind", "Description"],
    rows: turretMovement,
  },
  {
    title: "Turret Advanced",
    columns: ["Action", "Keybind", "Description"],
    rows: turretAdvanced,
  },
  {
    title: "Vehicles - Weapons",
    columns: ["Action", "Keybind", "Description"],
    rows: weapons,
  },
];

function KeybindTable({ columns, rows }: { columns: [string, string, string]; rows: KeybindRow[] }) {
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
    <div className="turret-table additional-table overflow-hidden rounded-xl border border-cyan-300/25">
      <div className="turret-table-head">
        <span>{columns[0]}</span>
        <span>{columns[1]}</span>
        <span>{columns[2]}</span>
      </div>
      <div className="divide-y divide-white/10">
        {rows.map((row, idx) => (
          <div key={`${row.action}-${idx}`} className="turret-table-row additional-table-row">
            <span className="turret-cell-action" data-label={columns[0]}>
              {row.action}
            </span>
            <span className="turret-cell-keybind text-slate-300" data-label={columns[1]}>
              {renderKeybind(row.keybind)}
            </span>
            <span className="turret-cell-description" data-label={columns[2]}>
              {row.description || "No note"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TurretKeybindsPage() {
  return (
    <section className="turret-modern additional-modern route-fade pb-8 pt-2">
      <div className="mx-auto max-w-[1180px] space-y-4">
        <article className="framework-modern-card framework-modern-card-systems additional-hero additional-panel rounded-2xl border border-cyan-300/35 p-4 backdrop-blur-[8px] sm:p-5">
          <div className="framework-modern-card-head additional-panel-head rounded-[1.2rem] border border-white/18 p-4 sm:p-5">
            <p className="framework-modern-kicker">Systems Manual</p>
            <h1 className="title-font mt-2 text-4xl tracking-[0.08em] text-cyan-200 sm:text-5xl">Turret Keybindings</h1>
            <p className="mt-2 text-lg uppercase tracking-[0.1em] text-cyan-100/85 sm:text-xl">Aim faster, kill quicker</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="additional-chip">Seat Flow</span>
              <span className="additional-chip">Target Cycling</span>
              <span className="additional-chip">Turret Control</span>
            </div>
            <p className="mt-4 text-base leading-relaxed text-slate-200 sm:text-lg">
            This section covers the essential keybindings for operating your turret. Some are strictly for turret operations, while others are general best practices. Sections here are accurate in the order of which they appear in the keybinding menu.
            </p>
          </div>
          <div className="mt-4 rounded-xl border border-amber-300/35 bg-amber-900/20 p-4 text-base leading-relaxed text-amber-200 sm:text-lg">
            <span className="font-semibold">Binding Preferences:</span> Hard swapping keybinds with modifiers (ALT+, RALT+, SHIFT+) is generally preferred over toggles. This is not exclusively a turret best-practice.
          </div>
        </article>

        <div className="grid gap-5 xl:grid-cols-2">
          {sections.map((section) => {
            const isWide = section.rows.length > 4 || section.title === "Multi Function Displays (MFDs)";
            return (
              <article
                key={section.title}
                className={[
                  "framework-modern-card framework-modern-card-systems rounded-2xl border border-cyan-300/35 p-5 backdrop-blur-[8px] sm:p-6",
                  isWide ? "xl:col-span-2" : "",
                ].join(" ")}
              >
                <div className="framework-modern-card-head additional-panel-head rounded-xl border border-white/15 p-4 sm:p-5">
                  <h2 className="title-font text-2xl tracking-[0.05em] text-cyan-200 sm:text-3xl">{section.title}</h2>
                  {section.title === "Multi Function Displays (MFDs)" ? (
                    <>
                      <p className="mt-3 text-base leading-relaxed text-slate-200 sm:text-lg">Configure these to match your fighter bindings</p>
                      <div className="mt-4 rounded-xl border border-cyan-300/30 bg-cyan-950/20 p-4 text-base leading-relaxed text-cyan-100 sm:text-lg">
                        These bindings should mirror the binds you use in a fighter. Power/Diagnostics on one side, comms for targeting and calling on the other. The ability to cycle pages is extremely useful when you cannot cycle manually.
                      </div>
                    </>
                  ) : null}
                  {section.title === "Target Cycling" ? (
                    <div className="mt-4 rounded-xl border border-red-300/35 bg-red-900/20 p-4 text-base leading-relaxed text-red-200 sm:text-lg">
                      <span className="font-semibold">Critical for Component Targeting:</span> Sub-targeting is essential for effective damage application.
                    </div>
                  ) : null}
                  {section.subtitle ? (
                    <p className="mt-3 text-base uppercase tracking-[0.14em] text-cyan-200/80">{section.subtitle}</p>
                  ) : null}
                  <div className="mt-5">
                    <KeybindTable columns={section.columns} rows={section.rows} />
                  </div>
                  {section.title === "Target Cycling" ? (
                    <p className="mt-4 text-sm leading-relaxed text-slate-400">
                      Additional sub-targeting guidance is available in the <strong>Sub Targeting</strong> section.
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        <article className="framework-modern-card framework-modern-card-systems additional-panel rounded-2xl border border-cyan-300/35 p-4 backdrop-blur-[8px] sm:p-5">
          <div className="framework-modern-card-head additional-panel-head rounded-xl border border-white/15 p-4 sm:p-5">
            <h2 className="title-font text-2xl tracking-[0.04em] text-cyan-200">Further Reading</h2>
            <p className="mt-3 text-base leading-relaxed text-cyan-100 sm:text-lg">
              The Addl. Keybindings section covers common keybinds in more detail, as well as game settings recommendations.
            </p>
            <Link to="/systems/additional-settings-binds" className="framework-modern-cta mt-4 w-full sm:w-auto">
              Addl. Keybindings
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
