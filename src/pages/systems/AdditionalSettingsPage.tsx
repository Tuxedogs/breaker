type SettingsRow = {
  action: string;
  keybind: string;
  description: string;
};

type SettingsTableSection = {
  title: string;
  subtitle?: string;
  columns: [string, string, string];
  rows: SettingsRow[];
};

const criticalKeybinds: SettingsRow[] = [
  { action: "Light Amplification Toggle", keybind: "RALT + L", description: "Default toggle for light amplification" },
  { action: "On", keybind: "Unbound", description: "Explicitly turn light amplification on" },
  { action: "Off", keybind: "Unbound", description: "Explicitly turn light amplification off" },
];

const defaultsFlight: SettingsRow[] = [
  { action: "Automatic Slowdown On", keybind: "No", description: "" },
  { action: "Gravity Compensation On", keybind: "No", description: "" },
  { action: "Wind Compensation On", keybind: "No", description: "" },
  { action: "G-Safe On", keybind: "No", description: "" },
  { action: "Boost Disables G-Safe", keybind: "Yes", description: "" },
  { action: "Space Brake Enables Boost", keybind: "No", description: "" },
  { action: "Proximity Assist On", keybind: "No", description: "" },
];

const defaultsHud: SettingsRow[] = [
  { action: "Advanced HUD on in SCM", keybind: "Yes", description: "NAV mode enabled" },
  { action: "Advanced HUD prefers labels", keybind: "Preference", description: "Personal choice" },
  { action: "Course Prediction on", keybind: "Preference", description: "Personal choice" },
];

const vjoySettings: SettingsRow[] = [
  { action: "Vjoy - Visibility", keybind: "Always Visible", description: "" },
  { action: "Pilot - Velocity Indicator", keybind: "Always On", description: "" },
  { action: "Range (degrees)", keybind: "Minimum possible", description: "Pilot Vjoy setting" },
  { action: "Use Raw Input", keybind: "Yes", description: "" },
  { action: "Mouse Deadzone (% of the range)", keybind: "Minimum possible", description: "Applies to pilot/driver/turret" },
];

const weaponDefaults: SettingsRow[] = [
  { action: "(Pilot) - Gimbals Locked", keybind: "Yes", description: "" },
  { action: "(Gunner) Gimbals Locked", keybind: "No", description: "" },
  { action: "Magnified UI On", keybind: "No", description: "" },
  { action: "Precision Lines On", keybind: "Yes", description: "" },
  { action: "Staggered Fire On", keybind: "No", description: "" },
  { action: "Fading Pips On", keybind: "No", description: "" },
];

const targetingSettings: SettingsRow[] = [
  { action: "Max Auto Zoom Level", keybind: "0", description: "Disable auto zoom" },
  { action: "Show Heading + Distance + Name + Reticle", keybind: "Yes", description: "All targeting info visible" },
  { action: "Pilot - Look ahead - Enabled", keybind: "No", description: "Look ahead sliders irrelevant, set to 0" },
  { action: "Turret - Look Ahead - Enabled", keybind: "No", description: "Same for driver" },
  { action: "Automatically Enable Target Padlock", keybind: "No", description: "Pilot/Driver/Turret" },
];

const gForceAndCamera: SettingsRow[] = [
  { action: "Head Movement", keybind: "0", description: "G-force induced" },
  { action: "Afterburner Zoom", keybind: "0", description: "" },
  { action: "Global Camera shake", keybind: "0", description: "" },
  { action: "Vehicle Weapon Recoil Scale", keybind: "0", description: "" },
];

const audioSettings: SettingsRow[] = [
  { action: "Ship Computer Verbosity", keybind: "Full", description: "" },
  { action: "Audio Driven Camera Shake Strength", keybind: "0", description: "" },
];

const flightReadyBindings: SettingsRow[] = [
  { action: "Gunnery UI Magnification Off", keybind: "", description: "Vehicles - Weapons" },
  { action: "Staggered Fire Off", keybind: "", description: "Vehicles - Weapons" },
  { action: "Set Lead Pips", keybind: "", description: "Vehicles - Weapons" },
  { action: "PIP Precision Lines On", keybind: "", description: "Vehicles - Weapons" },
  { action: "PIP Fading Off", keybind: "", description: "Vehicles - Weapons" },
  { action: "Gimbal State - Set Fixed", keybind: "", description: "Vehicles - Weapons (Important)" },
  { action: "Auto Targeting - Toggle Off", keybind: "", description: "Vehicles - Targeting (Short Press)" },
  { action: "Cruise Mode - Disable", keybind: "", description: "Flight - Movement - Throttle" },
  { action: "Speed Limiter - Disable", keybind: "", description: "Flight - Movement" },
  { action: "Proximity Assist - Disable", keybind: "", description: "Flight - Movement - IFCS" },
  { action: "G-Force Safety off", keybind: "", description: "Flight - Movement" },
  { action: "Advanced HUD - Enable", keybind: "", description: "Flight - Movement" },
  { action: "Automatic Precision Mode - Disable", keybind: "", description: "Flight - Movement" },
];

function SettingsTable({ columns, rows }: { columns: [string, string, string]; rows: SettingsRow[] }) {
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
            <span className="rounded border border-cyan-200/35 bg-cyan-950/30 px-1.5 py-0.5 text-slate-100">{part}</span>
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
            className="grid grid-cols-[1.4fr_0.8fr_1.8fr] gap-3 px-4 py-3 text-lg leading-normal text-slate-200 transition-colors duration-150 hover:bg-cyan-300/20"
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

function SettingsSection({ title, subtitle, columns, rows }: SettingsTableSection) {
  return (
    <article className="rounded-2xl border border-cyan-300/35 bg-[rgba(0,0,0,0.3)] p-5 backdrop-blur-[8px] sm:p-6">
      <h2 className="title-font text-3xl tracking-[0.04em] text-cyan-200">{title}</h2>
      {subtitle ? <p className="mt-3 text-base uppercase tracking-[0.14em] text-cyan-200/80">{subtitle}</p> : null}
      <div className="mt-5">
        <SettingsTable columns={columns} rows={rows} />
      </div>
    </article>
  );
}

export default function AdditionalSettingsPage() {
  return (
    <section className="route-fade pb-8 pt-2">
      <div className="mx-auto max-w-[1180px] space-y-6">
        <article className="rounded-2xl border border-cyan-300/35 bg-[rgba(0,0,0,0.3)] p-5 backdrop-blur-[8px] sm:p-6">
          <p className="title-font text-xs uppercase tracking-[0.18em] text-slate-300">Systems Manual</p>
          <h1 className="title-font mt-2 text-4xl tracking-[0.08em] text-cyan-200 sm:text-5xl">Additional Keybinds and Game Settings</h1>
          <p className="mt-3 text-2xl text-cyan-100/85">Optimized configuration for turret operations and multi-crew combat</p>
          <div className="mt-6 rounded-xl border border-cyan-300/30 bg-cyan-950/20 p-4 text-lg leading-normal text-cyan-100">
            <span className="font-semibold">Engine Configuration:</span> Use the <strong>user.cfg</strong> file provided by Min for optimized engine configuration.
          </div>
        </article>

        <SettingsSection
          title="Critical Keybinds"
          columns={["Action", "Keybind", "Description"]}
          rows={criticalKeybinds}
        />

        <article className="rounded-2xl border border-cyan-300/35 bg-[rgba(0,0,0,0.3)] p-5 backdrop-blur-[8px] sm:p-6">
          <h2 className="title-font text-3xl tracking-[0.04em] text-cyan-200">General Settings</h2>
          <div className="mt-4">
            <h3 className="title-font text-xl tracking-[0.08em] text-cyan-300">Turn Off:</h3>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-lg leading-normal text-slate-200">
              <li>Camera movement</li>
              <li>Vibration</li>
              <li>Camera Spring Movement</li>
            </ul>
          </div>

          <div className="mt-6 space-y-6">
            <SettingsTable columns={["Setting", "Value", "Notes"]} rows={defaultsFlight} />
            <div className="rounded-xl border border-amber-300/35 bg-amber-900/20 p-4 text-lg leading-normal text-amber-200">
              <span className="font-semibold">Power Settings:</span> Draw missing power from other... - <strong>No</strong>
            </div>
            <SettingsTable columns={["Setting", "Value", "Notes"]} rows={defaultsHud} />
          </div>
        </article>

        <article className="rounded-2xl border border-cyan-300/35 bg-[rgba(0,0,0,0.3)] p-5 backdrop-blur-[8px] sm:p-6">
          <h2 className="title-font text-3xl tracking-[0.04em] text-cyan-200">Mouse and ESP Settings</h2>
          <div className="mt-4 rounded-xl border border-cyan-300/30 bg-cyan-950/20 p-4 text-lg leading-normal text-cyan-100">
            <span className="font-semibold">ESP Changes:</span> ESP is different now. Curve and Zone size are now combined. Mouse aim generally prefers <strong>high strength, low curvature 0.05-0.2</strong>.
          </div>
          <div className="mt-6">
            <SettingsTable columns={["Setting", "Value", "Notes"]} rows={vjoySettings} />
          </div>
        </article>

        <SettingsSection title="Weapon Settings" columns={["Setting", "Value", "Notes"]} rows={weaponDefaults} />

        <SettingsSection title="Targeting Settings" columns={["Setting", "Value", "Notes"]} rows={targetingSettings} />

        <article className="rounded-2xl border border-cyan-300/35 bg-[rgba(0,0,0,0.3)] p-5 backdrop-blur-[8px] sm:p-6">
          <h2 className="title-font text-3xl tracking-[0.04em] text-cyan-200">Camera and Visual Settings</h2>
          <div className="mt-6 space-y-6">
            <SettingsTable columns={["Setting", "Value", "Notes"]} rows={gForceAndCamera} />
            <div>
              <h3 className="title-font text-xl tracking-[0.08em] text-cyan-300">Audio Settings</h3>
              <p className="mt-2 text-base uppercase tracking-[0.14em] text-cyan-200/80">
                Found in Audio tab at top of screen
              </p>
              <div className="mt-4">
                <SettingsTable columns={["Setting", "Value", "Notes"]} rows={audioSettings} />
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-cyan-300/35 bg-[rgba(0,0,0,0.3)] p-5 backdrop-blur-[8px] sm:p-6">
          <h2 className="title-font text-3xl tracking-[0.04em] text-cyan-200">Flight Ready Settings</h2>
          <div className="mt-4 rounded-xl border border-red-300/35 bg-red-900/20 p-4 text-lg leading-normal text-red-200">
            <span className="font-semibold">Flight Ready Bindings:</span> You can optionally, although I <strong>highly recommend</strong> binding all of these to "Flight Ready" or your own reset key in case of abnormal behavior.
          </div>
          <div className="mt-6">
            <SettingsTable columns={["Action", "Keybind", "Category"]} rows={flightReadyBindings} />
          </div>
        </article>
      </div>
    </section>
  );
}
