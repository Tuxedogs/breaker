import { useState, type MouseEvent, type ReactNode } from "react";
import "./fitting-mockup.css";

/* Paladin fitting overview mock — layout + honest placeholders only */

const SHIPS = ["Anvil Paladin", "Aegis Vanguard Warden", "RSI Constellation Andromeda"] as const;

const MAIN_TABS = [
  "Overview", "Hardpoints", "Resources", "Defense", "Network", "Damage Lab", "Weapons", "Stats", "Compare",
] as const;

const VIEW_CAMERAS = ["Top", "Side", "Rear", "3D"] as const;

type DamageFamily = "Energy" | "Physical" | "Distortion";

type InstalledRow = {
  id: string;
  slot?: string;
  qty: string;
  size: number;
  name: string;
  damage: DamageFamily;
  velocity: string;
  alpha: string;
  online: boolean;
  craftable?: boolean;
  selected?: boolean;
};

const PILOT_WEAPONS: InstalledRow[] = [
  { id: "pw1", qty: "2×", size: 4, name: "CF-447 Rhino Repeater", damage: "Energy", velocity: "1,050 m/s", alpha: "327", online: true, craftable: true },
  { id: "pw2", qty: "2×", size: 5, name: "CF-557 Galdereen Repeater", damage: "Energy", velocity: "980 m/s", alpha: "655", online: true, craftable: true },
];

const REMOTE_TURRETS: InstalledRow[] = [
  { id: "rt01", slot: "Remote Turret 01", qty: "2×", size: 4, name: "CF-447 Rhino Repeater", damage: "Energy", velocity: "1,050 m/s", alpha: "327", online: true, craftable: true, selected: true },
  { id: "rt02", slot: "Remote Turret 02", qty: "2×", size: 4, name: "CF-447 Rhino Repeater", damage: "Energy", velocity: "1,050 m/s", alpha: "327", online: true, craftable: true },
  { id: "rt03", slot: "Remote Turret 03", qty: "2×", size: 4, name: "CF-447 Rhino Repeater", damage: "Energy", velocity: "1,050 m/s", alpha: "327", online: true },
  { id: "rt04", slot: "Remote Turret 04", qty: "2×", size: 4, name: "CF-447 Rhino Repeater", damage: "Energy", velocity: "1,050 m/s", alpha: "327", online: true },
  { id: "rt05", slot: "Remote Turret 05", qty: "2×", size: 4, name: "CF-447 Rhino Repeater", damage: "Energy", velocity: "1,050 m/s", alpha: "327", online: false },
  { id: "rt06", slot: "Remote Turret 06", qty: "2×", size: 4, name: "CF-447 Rhino Repeater", damage: "Energy", velocity: "1,050 m/s", alpha: "327", online: true },
];

const DEFENSE_SYSTEMS = [
  { id: "sh", kind: "shield", title: "S3 Stronghold", type: "Shield Generator", detail: "Regen 450 HP/s", status: "Active" },
  { id: "pp", kind: "power", title: "3× S2 Maelstrom", type: "Power Plant", detail: "20.0 MW", status: "Active" },
  { id: "cl", kind: "cooler", title: "3× FR-76", type: "Cooler", detail: "Cooling: Not calculated yet", status: "Active" },
  { id: "qd", kind: "qd", title: "S1 Edge Case", type: "Quantum Drive", status: "Ready" },
  { id: "rd", kind: "radar", title: "S2 Guardian", type: "Radar", status: "Ready" },
  { id: "th1", kind: "thruster", title: "S2 Main Thrusters", type: "Main Thrusters", detail: "1.1 MN SCM", status: "Ready" },
  { id: "th2", kind: "thruster", title: "S2 Maneuver Thrusters", type: "Maneuver Thrusters", status: "Ready" },
];

const COMPATIBLE_ITEMS = [
  { id: "c1", name: "CF-447 Rhino Repeater", damage: "Energy" as const, size: 4, mount: "Remote only", velocity: "1,050 m/s", alpha: "327" },
  { id: "c2", name: "CF-337 Panther Repeater", damage: "Energy" as const, size: 3, mount: "Remote only", velocity: "980 m/s", alpha: "210" },
  { id: "c3", name: "BRVS Ballistic Gatling", damage: "Physical" as const, size: 4, mount: "Remote only", velocity: "850 m/s", alpha: "412" },
];

const PIP_BARS = [
  { label: "WPN", fill: 0.72 }, { label: "SYS", fill: 0.55 }, { label: "SHD", fill: 0.48 },
  { label: "QNT", fill: 0.22 }, { label: "RAD", fill: 0.18 }, { label: "THR", fill: 0.62 }, { label: "MOB", fill: 0.35 },
];

const ANCHORS = [
  { id: "mt", label: "Mambo Turret", x: 50, y: 16, side: "left" as const },
  { id: "rt", label: "Remote Turrets", x: 56, y: 27, side: "right" as const, slotIds: ["rt01", "rt02", "rt03", "rt04", "rt05", "rt06"] },
  { id: "pw", label: "Pilot Weapons", x: 43, y: 36, side: "left" as const, slotIds: ["pw1", "pw2"] },
  { id: "sh", label: "Shields", x: 57, y: 45, side: "right" as const },
  { id: "pp", label: "Power Plant", x: 43, y: 52, side: "left" as const },
  { id: "cl", label: "Coolers", x: 57, y: 58, side: "right" as const },
  { id: "qd", label: "Quantum Drive", x: 50, y: 66, side: "right" as const },
  { id: "th", label: "Thrusters", x: 43, y: 73, side: "left" as const },
  { id: "cg", label: "Cargo Grid", x: 50, y: 84, side: "left" as const },
];

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

function PaladinSchematic() {
  return (
    <svg className="fit-mock-ship-svg" viewBox="0 0 900 520" aria-hidden>
      <defs>
        <pattern id="pal-grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(79,209,217,0.06)" strokeWidth="0.6" />
        </pattern>
        <linearGradient id="pal-hull-fill" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="rgba(118,128,140,0.62)" />
          <stop offset="55%" stopColor="rgba(72,78,88,0.48)" />
          <stop offset="100%" stopColor="rgba(38,42,50,0.38)" />
        </linearGradient>
        <linearGradient id="pal-hull-rim" x1="0" x2="1" y1="0.5" y2="0.5">
          <stop offset="0%" stopColor="rgba(255,255,255,0.04)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.16)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
        </linearGradient>
        <radialGradient id="pal-glow" cx="50%" cy="72%" r="42%">
          <stop offset="0%" stopColor="rgba(255,140,40,0.14)" />
          <stop offset="100%" stopColor="rgba(255,140,40,0)" />
        </radialGradient>
      </defs>
      <rect width="900" height="520" fill="url(#pal-grid)" />
      <ellipse cx="450" cy="430" rx="300" ry="28" fill="url(#pal-glow)" />
      <path
        d="M450 38 L795 188 L748 348 L635 398 L450 428 L265 398 L152 348 L105 188 Z"
        fill="url(#pal-hull-fill)"
        stroke="url(#pal-hull-rim)"
        strokeWidth="1.4"
      />
      <path
        d="M450 88 L690 188 L655 305 L450 345 L245 305 L210 188 Z"
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth="1"
      />
      <path
        d="M450 118 L610 188 L585 268 L450 298 L315 268 L290 188 Z"
        fill="rgba(255,255,255,0.03)"
        stroke="rgba(79,209,217,0.12)"
        strokeWidth="0.8"
      />
      <path d="M450 38 L450 428" stroke="rgba(255,255,255,0.05)" strokeWidth="0.8" strokeDasharray="4 6" />
      <path d="M152 348 L748 348" stroke="rgba(255,255,255,0.04)" strokeWidth="0.6" />
      <path d="M210 188 L690 188" stroke="rgba(255,255,255,0.04)" strokeWidth="0.6" />
      <ellipse cx="450" cy="155" rx="22" ry="14" fill="rgba(79,209,217,0.08)" stroke="rgba(79,209,217,0.18)" strokeWidth="0.8" />
      <path d="M130 310 L105 188 L152 348 Z" fill="rgba(55,60,68,0.35)" stroke="rgba(255,255,255,0.05)" strokeWidth="0.6" />
      <path d="M770 310 L795 188 L748 348 Z" fill="rgba(55,60,68,0.35)" stroke="rgba(255,255,255,0.05)" strokeWidth="0.6" />
      <path d="M395 398 L450 428 L505 398 L450 410 Z" fill="rgba(40,45,52,0.5)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.6" />
    </svg>
  );
}

function ShieldRing({ variant }: { variant: "bubble" | "quadrant" }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <svg className="fit-mock-shield-ring" viewBox="0 0 72 72" aria-hidden>
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(120,190,220,0.15)" strokeWidth="3" />
      {variant === "bubble" ? (
        <circle cx="36" cy="36" r={r} fill="none" stroke="#00d8ff" strokeWidth="3" />
      ) : (
        <>
          {[0, 90, 180, 270].map((rot) => (
            <circle
              key={rot}
              cx="36"
              cy="36"
              r={r}
              fill="none"
              stroke="#00d8ff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${c * 0.22} ${c * 0.03}`}
              transform={`rotate(${rot - 90} 36 36)`}
            />
          ))}
        </>
      )}
    </svg>
  );
}

function CraftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.7 6.3a1 1 0 0 0 0-1.4l-1.6-1.6a1 1 0 0 0-1.4 0l-1 1-2.8 2.8-1-1a1 1 0 0 0-1.4 0L4.3 8.7a1 1 0 0 0 0 1.4l1 1-2.8 2.8a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l1-1 2.8 2.8 1 1a1 1 0 0 0 1.4 0l1.6-1.6a1 1 0 0 0 0-1.4l-1-1 2.8-2.8 1 1a1 1 0 0 0 1.4 0z" />
      <path d="M3 21l2-2M19 3l-2 2" opacity="0.55" />
    </svg>
  );
}

function InstalledWeaponRow({
  row,
  onSelect,
  onTogglePower,
  onCraft,
}: {
  row: InstalledRow;
  onSelect: () => void;
  onTogglePower: (event: MouseEvent<HTMLButtonElement>) => void;
  onCraft: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className={["fit-mock-row", row.selected ? "is-selected" : "", !row.online ? "is-off" : ""].filter(Boolean).join(" ")}>
      <button
        type="button"
        className={["fit-mock-row-power", row.online ? "is-on" : ""].filter(Boolean).join(" ")}
        onClick={onTogglePower}
        aria-label={row.online ? "Power off" : "Power on"}
      />
      <button type="button" className="fit-mock-row-hit" onClick={onSelect}>
        <span className="fit-mock-row-main">
          {row.slot && <span className="fit-mock-row-slot">{row.slot}</span>}
          <span className="fit-mock-row-title">
            <span className="fit-mock-row-qty">{row.qty}</span>
            <strong className="fit-mock-row-name">{row.name}</strong>
          </span>
          <span className="fit-mock-row-stats">
            <span className={`fit-mock-dmg fit-mock-dmg--${row.damage.toLowerCase()}`}>{row.damage}</span>
            <span className="fit-mock-row-size">S{row.size}</span>
            <span className="fit-mock-row-vel">{row.velocity}</span>
            <span className="fit-mock-row-alpha">{row.alpha} α</span>
          </span>
        </span>
      </button>
      {row.craftable && (
        <button type="button" className="fit-mock-row-craft" onClick={onCraft} title="Craft Component" aria-label="Craft Component">
          <CraftIcon />
        </button>
      )}
    </div>
  );
}

function DetailRow({ label, value, tone = "default", nested = false }: { label: string; value: string; tone?: "default" | "accent" | "muted"; nested?: boolean }) {
  return (
    <div className={["fit-mock-detail-row", nested ? "is-nested" : "", tone !== "default" ? `is-${tone}` : ""].filter(Boolean).join(" ")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="fit-mock-detail-section">
      <h4>{title}</h4>
      <div className="fit-mock-detail-body">{children}</div>
    </section>
  );
}

export default function FittingMockupPage() {
  const [mainTab] = useState<(typeof MAIN_TABS)[number]>("Overview");
  const [camera] = useState<(typeof VIEW_CAMERAS)[number]>("Top");
  const [ship, setShip] = useState<(typeof SHIPS)[number]>("Anvil Paladin");
  const [online, setOnline] = useState<Record<string, boolean>>(() => Object.fromEntries(
    [...PILOT_WEAPONS, ...REMOTE_TURRETS].map((r) => [r.id, r.online]),
  ));
  const [selectedId, setSelectedId] = useState("rt01");
  const [craftOpen, setCraftOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [weaponStatsOpen, setWeaponStatsOpen] = useState(false);
  const [armorOpen, setArmorOpen] = useState(false);

  const [craftItem, setCraftItem] = useState("CF-447 Rhino Repeater");

  function isAnchorSelected(anchor: (typeof ANCHORS)[number]): boolean {
    if (anchor.slotIds) return anchor.slotIds.includes(selectedId);
    return selectedId.startsWith(anchor.id);
  }

  function togglePower(id: string, event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setOnline((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function openCraft(name: string, event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setCraftItem(name);
    setCraftOpen(true);
  }

  function selectRow(id: string) {
    setSelectedId(id);
    setSelectorOpen(true);
  }

  function selectAnchor(anchor: (typeof ANCHORS)[number]) {
    if (anchor.slotIds?.length) {
      setSelectedId(anchor.slotIds.includes(selectedId) ? selectedId : anchor.slotIds[0]);
    }
  }

  return (
    <div className="fit-mock" role="application" aria-label="Ship fitting overview">
      <header className="fit-mock-head">
        <div className="fit-mock-ship-id">
          <h1>{ship}</h1>
          <span className="fit-mock-ship-meta">Gunship · Large</span>
        </div>
        <nav className="fit-mock-tabs" aria-label="Fitting sections">
          {MAIN_TABS.map((tab) => (
            <button key={tab} type="button" className={["fit-mock-tab", mainTab === tab ? "is-active" : ""].filter(Boolean).join(" ")}>{tab}</button>
          ))}
        </nav>
        <div className="fit-mock-head-right">
          <select className="fit-mock-select" value={ship} onChange={(e) => setShip(e.target.value as typeof ship)} aria-label="Select ship">
            {SHIPS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="button" className="fit-mock-save">Save Loadout</button>
          <span className="fit-mock-flag is-mod">Modified</span>
          <span className="fit-mock-flag is-unsaved">Unsaved Changes</span>
        </div>
      </header>

      <div className="fit-mock-main">
        <aside className="fit-mock-rail fit-mock-rail--left">
          <div className="fit-mock-rail-head"><h2>Offensive Systems</h2></div>
          <label className="fit-mock-search">
            <Icon><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Icon>
            <input type="search" placeholder="Search weapons, systems…" aria-label="Search offensive systems" />
          </label>
          <div className="fit-mock-rail-scroll">
            <section className="fit-mock-group">
              <div className="fit-mock-group-head"><h3>Pilot Weapons</h3><span>2 / 2</span></div>
              {PILOT_WEAPONS.map((row) => (
                <InstalledWeaponRow
                  key={row.id}
                  row={{ ...row, online: online[row.id] ?? row.online, selected: selectedId === row.id }}
                  onSelect={() => selectRow(row.id)}
                  onTogglePower={(e) => togglePower(row.id, e)}
                  onCraft={(e) => openCraft(row.name, e)}
                />
              ))}
            </section>
            <section className="fit-mock-group">
              <div className="fit-mock-group-head"><h3>Remote Turrets</h3><span>6 / 6</span></div>
              {REMOTE_TURRETS.map((row) => (
                <InstalledWeaponRow
                  key={row.id}
                  row={{ ...row, online: online[row.id] ?? row.online, selected: selectedId === row.id }}
                  onSelect={() => selectRow(row.id)}
                  onTogglePower={(e) => togglePower(row.id, e)}
                  onCraft={(e) => openCraft(row.name, e)}
                />
              ))}
            </section>
          </div>
          <section className="fit-mock-pips" aria-label="Power Pips">
            <h3>Power Pips</h3>
            <div className="fit-mock-pips-bars">
              {PIP_BARS.map((bar) => (
                <div key={bar.label} className="fit-mock-pip-col">
                  <div className="fit-mock-pip-stack"><span className="fit-mock-pip-fill" style={{ height: `${bar.fill * 100}%` }} /></div>
                  <span>{bar.label}</span>
                </div>
              ))}
            </div>
            <div className="fit-mock-pips-output"><span>Output</span><strong>10 / 60</strong></div>
          </section>
        </aside>

        <section className="fit-mock-center">
          <header className="fit-mock-center-head">
            <h2>Ship Overview</h2>
            <div className="fit-mock-view-btns" role="group" aria-label="Camera">
              {VIEW_CAMERAS.map((view) => (
                <button key={view} type="button" className={["fit-mock-view-btn", camera === view ? "is-active" : ""].filter(Boolean).join(" ")}>{view}</button>
              ))}
            </div>
          </header>

          <div className="fit-mock-center-body">
            <div className="fit-mock-stage">
              <div className="fit-mock-stage-vignette" aria-hidden />
              <div className="fit-mock-stage-ship">
                <PaladinSchematic />
              </div>
              {ANCHORS.map((anchor) => (
                <button
                  key={anchor.id}
                  type="button"
                  className={[
                    "fit-mock-anchor",
                    `fit-mock-anchor--${anchor.side}`,
                    isAnchorSelected(anchor) ? "is-selected" : "",
                  ].filter(Boolean).join(" ")}
                  style={{ left: `${anchor.x}%`, top: `${anchor.y}%` }}
                  onClick={() => selectAnchor(anchor)}
                >
                  <span className="fit-mock-anchor-leader" aria-hidden />
                  <span className="fit-mock-anchor-dot" />
                  <span className="fit-mock-anchor-label">{anchor.label}</span>
                </button>
              ))}
            </div>

            <div className="summary-ribbon fit-mock-summary">
              <section className="summary-section">
                <h3>Offense</h3>
                <div className="fit-mock-ribbon-rows">
                  <div className="fit-mock-ribbon-row"><span>Pilot Alpha</span><strong>500.7</strong></div>
                  <div className="fit-mock-ribbon-row"><span>Turret Alpha</span><em>Not calculated yet</em></div>
                  <div className="fit-mock-ribbon-row"><span>Crew Alpha</span><em>Not calculated yet</em></div>
                </div>
              </section>
              <section className="summary-section">
                <h3>Shields</h3>
                <div className="fit-mock-ribbon-split">
                  <ShieldRing variant="bubble" />
                  <div>
                    <span className="fit-mock-ribbon-kicker">Stronghold</span>
                    <strong className="fit-mock-ribbon-hero">72,000 HP</strong>
                    <span className="fit-mock-ribbon-sub">Regen 450 HP/s</span>
                  </div>
                </div>
              </section>
              <section className="summary-section">
                <h3>Mobility</h3>
                <div className="fit-mock-ribbon-rows">
                  <div className="fit-mock-ribbon-row"><span>Top Speed</span><strong>210 m/s</strong></div>
                  <div className="fit-mock-ribbon-row"><span>Boost Speed</span><strong>420 m/s</strong></div>
                  <div className="fit-mock-ribbon-row"><span>Nav Speed</span><strong>1425 m/s</strong></div>
                </div>
              </section>
              <section className="summary-section">
                <h3>Cargo</h3>
                <div className="fit-mock-ribbon-rows">
                  <div className="fit-mock-ribbon-row"><span>Cargo Grid</span><strong>640 SCU</strong></div>
                </div>
              </section>
            </div>

            <div className="fit-mock-detail-grid">
              <div className="fit-mock-detail-col">
                <DetailSection title="Vital">
                  <DetailRow label="HP" value="1950 HP" tone="accent" />
                  <DetailRow label="Total" value="8138 HP" tone="accent" nested />
                </DetailSection>
                <DetailSection title="Resistances">
                  <div className="fit-mock-res-grid">
                    <div><span>Energy</span><strong>0</strong></div>
                    <div><span>Physical</span><strong>0.25</strong></div>
                    <div><span>Distortion</span><strong>0.95</strong></div>
                  </div>
                  <DetailRow label="Physical Absorption" value="0.45" nested />
                </DetailSection>
                <button type="button" className="fit-mock-armor-toggle" onClick={() => setArmorOpen((v) => !v)}>
                  <span>Armor</span>
                  <Icon><path d={armorOpen ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} /></Icon>
                </button>
                {armorOpen && (
                  <div className="fit-mock-armor-body">
                    <DetailRow label="Component HP" value="1232" />
                    <DetailRow label="Physical Deflection" value="11" nested />
                  </div>
                )}
              </div>
              <div className="fit-mock-detail-col">
                <DetailSection title="Storage & Cargo">
                  <DetailRow label="Cargo Grid" value="640 SCU" />
                  <DetailRow label="Grid Dimensions" value="Requires fitting API" tone="muted" nested />
                  <DetailRow label="Storage" value="Not available" tone="muted" />
                  <DetailRow label="K µSCU" value="Not available" tone="muted" nested />
                </DetailSection>
                <DetailSection title="Fuel">
                  <DetailRow label="Hydrogen" value="Requires fitting API" tone="muted" />
                  <DetailRow label="Flight Time" value="—" tone="muted" nested />
                  <DetailRow label="Quantum" value="Requires fitting API" tone="muted" />
                  <DetailRow label="Range" value="—" tone="muted" nested />
                </DetailSection>
              </div>
              <div className="fit-mock-detail-col">
                <DetailSection title="Performance">
                  <DetailRow label="SCM / AB" value="262 / 610 m/s" />
                  <DetailRow label="P / Y / R" value="60 / 200 / 60 °/s" nested />
                  <DetailRow label="AB P / Y / R" value="Not calculated yet" tone="muted" />
                  <DetailRow label="Boost Capacity / Regen" value="20 / 0.75" nested />
                </DetailSection>
                <DetailSection title="Accelerations">
                  <DetailRow label="Main" value="Not calculated yet" tone="muted" />
                  <DetailRow label="Retro" value="Not calculated yet" tone="muted" />
                  <DetailRow label="Up Strafe" value="Not calculated yet" tone="muted" />
                  <DetailRow label="Down Strafe" value="Not calculated yet" tone="muted" />
                  <DetailRow label="Lateral Strafe" value="Not calculated yet" tone="muted" />
                </DetailSection>
              </div>
            </div>

            {selectorOpen && (
              <aside className="fit-mock-drawer fit-mock-drawer--select" aria-label="Select Component">
                <header className="fit-mock-drawer-head">
                  <h3>Select Component</h3>
                  <button type="button" onClick={() => setSelectorOpen(false)} aria-label="Close">×</button>
                </header>
                <label className="fit-mock-search">
                  <Icon><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Icon>
                  <input type="search" placeholder="Search compatible components…" />
                </label>
                <div className="fit-mock-drawer-list">
                  {COMPATIBLE_ITEMS.map((item) => (
                    <button key={item.id} type="button" className="fit-mock-compat-row">
                      <span className="fit-mock-compat-icon"><Icon><path d="M4 14h12M8 10h8M10 6h6" /></Icon></span>
                      <span className="fit-mock-compat-main">
                        <strong>{item.name}</strong>
                        <span>{item.damage} · S{item.size} · {item.mount}</span>
                      </span>
                      <span className="fit-mock-compat-stats">
                        <span>{item.velocity}</span>
                        <span>{item.alpha} α</span>
                      </span>
                    </button>
                  ))}
                </div>
              </aside>
            )}
          </div>
        </section>

        <aside className="fit-mock-rail fit-mock-rail--right">
          <div className="fit-mock-rail-head"><h2>Defensive &amp; Support Systems</h2></div>
          <label className="fit-mock-search">
            <Icon><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Icon>
            <input type="search" placeholder="Search systems…" aria-label="Search defensive systems" />
          </label>
          <div className="fit-mock-rail-scroll">
            {DEFENSE_SYSTEMS.map((row) => (
              <button key={row.id} type="button" className="fit-mock-def-card">
                <span className={`fit-mock-def-icon fit-mock-def-icon--${row.kind}`} aria-hidden>
                  <Icon><circle cx="12" cy="12" r="4" /></Icon>
                </span>
                <span className="fit-mock-def-main">
                  <span className="fit-mock-def-title-row">
                    <strong>{row.title}</strong>
                    <span className={`fit-mock-def-status is-${row.status.toLowerCase()}`}>{row.status}</span>
                  </span>
                  <span className="fit-mock-def-type">{row.type}</span>
                  <span className="fit-mock-def-detail">{row.detail ?? "Power: Not calculated yet"}</span>
                </span>
              </button>
            ))}
          </div>

          <section className="fit-mock-selected">
            <header className="fit-mock-selected-head">
              <span className="fit-mock-selected-kicker">Selected Slot</span>
              <h3>Remote Turret 01</h3>
            </header>
            <div className="fit-mock-selected-card">
              <div className="fit-mock-selected-thumb">
                <Icon><path d="M4 14h12M8 10h8M10 6h6" /></Icon>
              </div>
              <div className="fit-mock-selected-body">
                <div className="fit-mock-selected-title-row">
                  <strong>2× S4 CF-447 Rhino Repeater</strong>
                  <span className="fit-mock-selected-badge">Installed</span>
                </div>
                <span className="fit-mock-selected-meta">Energy · Size 4 · Remote Turret · 1,050 m/s · 327 α</span>
              </div>
            </div>
            <button type="button" className="fit-mock-weapon-stats-btn" onClick={() => setWeaponStatsOpen((v) => !v)}>
              Weapon Stats
              <Icon><path d={weaponStatsOpen ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} /></Icon>
            </button>
            {weaponStatsOpen && (
              <div className="fit-mock-weapon-stats">
                <DetailSection title="Slot Information">
                  <DetailRow label="Slot" value="Remote Turret 01 (P)" />
                  <DetailRow label="Mount Type" value="Remote Turret" nested />
                  <DetailRow label="Size" value="4" nested />
                  <DetailRow label="Control Source" value="Remote AI / Player" nested />
                </DetailSection>
                <DetailSection title="Item Information">
                  <DetailRow label="Manufacturer" value="Anvil Aerospace" />
                  <DetailRow label="Item Class" value="Repeater" nested />
                  <DetailRow label="Damage Type" value="Energy" nested />
                  <DetailRow label="Rate of Fire" value="Requires fitting API" tone="muted" nested />
                  <DetailRow label="Effective Range" value="Requires fitting API" tone="muted" nested />
                </DetailSection>
              </div>
            )}
          </section>
        </aside>
      </div>

      {craftOpen && (
        <div className="fit-mock-modal-backdrop" role="presentation" onMouseDown={() => setCraftOpen(false)}>
          <section className="fit-mock-modal" role="dialog" aria-modal="true" aria-label="Craft Component" onMouseDown={(e) => e.stopPropagation()}>
            <header className="fit-mock-modal-head">
              <div>
                <span className="fit-mock-modal-kicker">Craft Component</span>
                <h2>{craftItem}</h2>
              </div>
              <button type="button" onClick={() => setCraftOpen(false)} aria-label="Close">×</button>
            </header>
            <div className="fit-mock-modal-grid">
              <label><span>Current / Base Quality</span><select defaultValue="base"><option>Base</option><option>Band 4</option></select></label>
              <label><span>Target Quality</span><select defaultValue="t4"><option>Band 4</option><option>Band 5</option></select></label>
            </div>
            <DetailSection title="Material Inputs">
              <DetailRow label="Titanium" value="Requires recipe data" tone="muted" />
              <DetailRow label="Copper" value="Requires recipe data" tone="muted" nested />
            </DetailSection>
            <DetailSection title="Weapon Modifiers">
              <label className="fit-mock-slider">
                <span>Damage</span>
                <input type="range" min={0} max={100} defaultValue={50} disabled />
                <em>Requires recipe data</em>
              </label>
              <label className="fit-mock-slider">
                <span>Rate of Fire</span>
                <input type="range" min={0} max={100} defaultValue={50} disabled />
                <em>Requires recipe data</em>
              </label>
              <label className="fit-mock-slider">
                <span>Spread</span>
                <input type="range" min={0} max={100} defaultValue={50} disabled />
                <em>Requires recipe data</em>
              </label>
            </DetailSection>
            <footer className="fit-mock-modal-foot">
              <button type="button" className="fit-mock-btn is-ghost" onClick={() => setCraftOpen(false)}>Cancel</button>
              <button type="button" className="fit-mock-btn is-primary">Apply</button>
              <button type="button" className="fit-mock-btn is-primary">Save to Loadout</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
