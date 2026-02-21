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
    if (!trimmed) return <span className="text-slate-500"> </span>;

    const parts = trimmed.split("+").map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0) return <span className="text-slate-500"> </span>;

    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        {parts.map((part, idx) => (
          <span key={`${part}-${idx}`} className="inline-flex items-center gap-1">
            {idx > 0 ? <span className="text-slate-400">+</span> : null}
            <span className="rounded border border-cyan-200/35 bg-cyan-950/30 px-1.5 py-0.5 text-slate-100">
              {part}
            </span>
          </span>
        ))}
      </span>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-cyan-300/25 bg-black/35">
      <div className="grid grid-cols-[1.4fr_0.8fr_1.8fr] border-b border-cyan-300/20 bg-cyan-950/25 px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-cyan-200">
        <span>{columns[0]}</span>
        <span>{columns[1]}</span>
        <span>{columns[2]}</span>
      </div>
      <div className="divide-y divide-white/10">
        {rows.map((row, idx) => (
          <div
            key={`${row.action}-${idx}`}
            className={[
              "grid grid-cols-[1.4fr_0.8fr_1.8fr] gap-3 px-4 py-3 text-lg leading-normal text-slate-200 transition-colors duration-150",
              "hover:bg-cyan-300/20",
            ].join(" ")}
          >
            <span>{row.action}</span>
            <span className="text-slate-300">{renderKeybind(row.keybind)}</span>
            <span>{row.description || " "}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TurretKeybindsPage() {
  return (
    <section className="route-fade pb-8 pt-2">
      <div className="mx-auto max-w-[1180px] space-y-6">
        <article className="rounded-2xl border border-cyan-300/35 bg-[rgba(0,0,0,0.3)] p-5 backdrop-blur-[8px] sm:p-6">
          <p className="title-font text-xs uppercase tracking-[0.18em] text-slate-300">Systems Manual</p>
          <h1 className="title-font mt-2 text-4xl tracking-[0.08em] text-cyan-200 sm:text-5xl">Turret Keybindings</h1>
          <p className="mt-3 text-2xl text-cyan-100/85">Aim faster, kill quicker</p>
          <p className="mt-5 text-xl leading-normal text-slate-200">
            This section covers the essential keybindings for operating your turret. Some are strictly for turret operations, while others are general best practices. Sections here are accurate in the order of which they appear in the keybinding menu.
          </p>
          <div className="mt-6 rounded-xl border border-amber-300/35 bg-amber-900/20 p-4 text-lg leading-normal text-amber-200">
            <span className="font-semibold">Binding Preferences:</span> Hard swapping keybinds with modifiers (ALT+, RALT+, SHIFT+) is generally preferred over toggles. This isn't exclusively a turret best-practice.
          </div>
        </article>

        {sections.map((section) => (
          <article
            key={section.title}
            className="rounded-2xl border border-cyan-300/35 bg-[rgba(0,0,0,0.3)] p-5 backdrop-blur-[8px] sm:p-6"
          >
            <h2 className="title-font text-3xl tracking-[0.04em] text-cyan-200">{section.title}</h2>
            {section.title === "Multi Function Displays (MFDs)" ? (
              <>
                <p className="mt-3 text-xl leading-normal text-slate-200">Configure these to match your fighter bindings</p>
                <div className="mt-4 rounded-xl border border-cyan-300/30 bg-cyan-950/20 p-4 text-lg leading-normal text-cyan-100">
                  These bindings should mirror the binds you use in a fighter. Power/Diagnostics on one side, comms for targeting and calling on the other. The ability to cycle pages is extremely useful when you cannot cycle manually.
                </div>
              </>
            ) : null}
            {section.title === "Target Cycling" ? (
              <div className="mt-4 rounded-xl border border-red-300/35 bg-red-900/20 p-4 text-lg leading-normal text-red-200">
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
              <p className="mt-4 text-base leading-normal text-slate-400">
                Additional sub-targeting guidance is available in the <strong>Sub Targeting</strong> section.
              </p>
            ) : null}
          </article>
        ))}

        <article className="rounded-2xl border border-cyan-300/35 bg-cyan-950/20 p-5 backdrop-blur-[8px] sm:p-6">
          <h2 className="title-font text-2xl tracking-[0.04em] text-cyan-200">Further Reading</h2>
          <p className="mt-3 text-lg leading-normal text-cyan-100">
            The Addl. Keybindings section covers common keybinds in more detail, as well as game settings recommendations.
          </p>
          <Link
            to="/systems/additional-settings-binds"
            className="mt-4 inline-block text-lg font-semibold text-cyan-300 transition hover:text-cyan-200"
          >
            Addl. Keybindings
          </Link>
        </article>
      </div>
    </section>
  );
}
