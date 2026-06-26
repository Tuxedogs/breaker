import { useState, type MouseEvent, type ReactNode } from "react";
import PowerPipIcon from "../components/fitting/terminal/PowerPipIcons";
import type { PipAssignment, PipCategory } from "../lib/fitting/fittingTerminalTypes";
import "./fitting-mockup.css";

/* Gladius fitting overview mock — layout + honest placeholders only */

const SHIPS = ["Aegis Gladius", "Aegis Gladius Valiant", "Anvil Paladin"] as const;

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
  mount: string;
  online: boolean;
  craftable?: boolean;
  selected?: boolean;
};

const NOSE_WEAPON: InstalledRow[] = [
  { id: "nw1", slot: "Nose Gun", qty: "1×", size: 2, name: "Attrition-3 Repeater", damage: "Energy", velocity: "1,400 m/s", alpha: "87", mount: "Fixed", online: true, craftable: true },
];

const WING_GIMBALS: InstalledRow[] = [
  { id: "wg1", slot: "Wing Gimbal L", qty: "1×", size: 3, name: "CF-337 Panther Repeater", damage: "Energy", velocity: "980 m/s", alpha: "210", mount: "Gimbal", online: true, craftable: true, selected: true },
  { id: "wg2", slot: "Wing Gimbal R", qty: "1×", size: 3, name: "CF-337 Panther Repeater", damage: "Energy", velocity: "980 m/s", alpha: "210", mount: "Gimbal", online: true, craftable: true },
];

const WING_BOMB_RACKS: InstalledRow[] = [
  { id: "br1", slot: "Castillo Bomb Rack L", qty: "1×", size: 2, name: "Bippy Bomb", damage: "Physical", velocity: "—", alpha: "—", mount: "Bomb Rack", online: true },
  { id: "br2", slot: "Castillo Bomb Rack R", qty: "1×", size: 2, name: "Bippy Bomb", damage: "Physical", velocity: "—", alpha: "—", mount: "Bomb Rack", online: true },
];

type DefTypeTone = "shield" | "power" | "radar" | "life" | "cooler";

const DEFENSE_SYSTEMS: {
  id: string;
  kind: string;
  title: string;
  type: string;
  typeTone?: DefTypeTone;
  detail?: string;
  status: string;
}[] = [
  { id: "sh", kind: "shield", title: "2× S1 AllStop", type: "Shield Generator", typeTone: "shield", detail: "Regen: Not calculated yet", status: "Active" },
  { id: "pp", kind: "power", title: "S1 ShatterBomb", type: "Power Plant", typeTone: "power", detail: "8.0 MW", status: "Active" },
  { id: "rd", kind: "radar", title: "S2 Sentinel", type: "Radar", typeTone: "radar", status: "Ready" },
  { id: "ls", kind: "life", title: "Life Support", type: "Life Support", typeTone: "life", status: "Ready" },
  { id: "cl1", kind: "cooler", title: "S1 Snowfall", type: "Cooler", typeTone: "cooler", detail: "Cooler 1 · Engine nacelle", status: "Active" },
  { id: "cl2", kind: "cooler", title: "S1 Snowfall", type: "Cooler", typeTone: "cooler", detail: "Cooler 2 · Engine nacelle", status: "Active" },
  { id: "qd", kind: "qd", title: "S1 Thacker", type: "Quantum Drive", status: "Ready" },
  { id: "th1", kind: "thruster", title: "Main Thruster", type: "Main Thrusters", detail: "0.4 MN SCM", status: "Ready" },
  { id: "th2", kind: "thruster", title: "Maneuvering Thrusters", type: "Maneuver Thrusters", status: "Ready" },
];

const COMPATIBLE_ITEMS = [
  { id: "c1", name: "CF-337 Panther Repeater", damage: "Energy" as const, size: 3, mount: "Gimbal", velocity: "980 m/s", alpha: "210" },
  { id: "c2", name: "CF-227 Panther Repeater", damage: "Energy" as const, size: 2, mount: "Fixed", velocity: "1,100 m/s", alpha: "98" },
  { id: "c3", name: "BRVS Ballistic Gatling", damage: "Physical" as const, size: 3, mount: "Gimbal", velocity: "850 m/s", alpha: "312" },
];

const MOCK_PIP_TOTAL = 18;
const MOCK_PIP_SEGMENT_COUNT = 8;

type MockPipColumnDef = {
  key: PipCategory;
  label: string;
  min: number;
};

const MOCK_PIP_COLUMNS: MockPipColumnDef[] = [
  { key: "weapons", label: "WPN", min: 0 },
  { key: "engines", label: "ENG", min: 0 },
  { key: "quantum", label: "QT", min: 3 },
  { key: "radar", label: "RAD", min: 0 },
  { key: "lifeSupport", label: "LS", min: 0 },
  { key: "cooler1", label: "C1", min: 0 },
  { key: "cooler2", label: "C2", min: 0 },
];

const INITIAL_MOCK_PIP_ASSIGNMENT: PipAssignment = {
  weapons: 4,
  engines: 2,
  quantum: 3,
  radar: 2,
  lifeSupport: 2,
  cooler1: 2,
  cooler2: 2,
};

type PipStackPart =
  | { kind: "segment"; slot: number }
  | { kind: "merged"; minSlots: number };

function sumMockPipAssignment(assignment: PipAssignment): number {
  return Object.values(assignment).reduce((sum, value) => sum + value, 0);
}

function buildPipStackParts(min: number, segmentCount: number): PipStackPart[] {
  if (min <= 1) {
    return Array.from({ length: segmentCount }, (_, index) => ({
      kind: "segment" as const,
      slot: segmentCount - 1 - index,
    }));
  }

  const parts: PipStackPart[] = [];
  for (let slot = segmentCount - 1; slot >= min; slot -= 1) {
    parts.push({ kind: "segment", slot });
  }
  parts.push({ kind: "merged", minSlots: min });
  return parts;
}

function coolerEfficiencyPercent(level: number): number {
  if (level <= 0) return 0;
  return Math.round(35 + (level / MOCK_PIP_SEGMENT_COUNT) * 65);
}

function mockSystemReadout(key: PipCategory, level: number, min: number): string {
  if (key === "cooler1" || key === "cooler2") {
    return `Cooling ${coolerEfficiencyPercent(level)}%`;
  }
  if (key === "quantum") {
    return level >= min ? `Spool ready · ${level} pips` : `Offline · need ${min} min`;
  }
  if (key === "weapons") {
    return level > 0 ? `Weapon regen ${Math.round(40 + level * 8)}%` : "Weapons depowered";
  }
  if (key === "engines") {
    return level > 0 ? `Thrust cap ${Math.round(55 + level * 5)}%` : "Thrusters limited";
  }
  return level > 0 ? `${level} pips allocated` : "Powered off";
}

function MockPowerPipHud() {
  const [assignment, setAssignment] = useState<PipAssignment>(INITIAL_MOCK_PIP_ASSIGNMENT);
  const [activeColumn, setActiveColumn] = useState<PipCategory | null>(null);

  const assignedTotal = sumMockPipAssignment(assignment);
  const unassigned = MOCK_PIP_TOTAL - assignedTotal;

  const setCategoryLevel = (category: PipCategory, nextLevel: number) => {
    setAssignment((current) => {
      const currentLevel = current[category];
      const clamped = Math.max(0, Math.min(MOCK_PIP_SEGMENT_COUNT, nextLevel));
      const delta = clamped - currentLevel;
      if (delta <= 0) {
        return { ...current, [category]: clamped };
      }
      const available = MOCK_PIP_TOTAL - sumMockPipAssignment(current);
      return { ...current, [category]: currentLevel + Math.min(delta, available) };
    });
    setActiveColumn(category);
  };

  const handleSegmentClick = (category: PipCategory, slotFromBottom: number, min: number) => {
    const level = assignment[category];
    const target = slotFromBottom + 1;
    if (target === level) {
      setCategoryLevel(category, slotFromBottom);
      return;
    }
    if (min > 0 && target < min) {
      setCategoryLevel(category, min);
      return;
    }
    setCategoryLevel(category, target);
  };

  const handleMergedClick = (category: PipCategory, min: number) => {
    const level = assignment[category];
    if (level >= min) {
      setCategoryLevel(category, 0);
      return;
    }
    setCategoryLevel(category, min);
  };

  const handleIconClick = (category: PipCategory, min: number) => {
    const level = assignment[category];
    if (level > 0) {
      setCategoryLevel(category, 0);
      return;
    }
    const available = MOCK_PIP_TOTAL - assignedTotal;
    const maxLevel = Math.min(MOCK_PIP_SEGMENT_COUNT, available);
    setCategoryLevel(category, Math.max(min, maxLevel));
  };

  const activeDef = activeColumn
    ? MOCK_PIP_COLUMNS.find((column) => column.key === activeColumn)
    : null;

  const cooler1Eff = coolerEfficiencyPercent(assignment.cooler1);
  const cooler2Eff = coolerEfficiencyPercent(assignment.cooler2);

  const renderCoolerBar = (label: string, efficiency: number) => (
    <div className="fit-mock-pip-cooler-row" aria-label={`${label} cooling efficiency`}>
      <span className="fit-mock-pip-cooler-label">{label}</span>
      <div className="fit-mock-pip-cool-bar">
        <span
          className={[
            "fit-mock-pip-cool-fill",
            efficiency >= 75 ? "is-strong" : efficiency >= 45 ? "is-mid" : "is-weak",
          ].filter(Boolean).join(" ")}
          style={{ width: `${efficiency}%` }}
        />
      </div>
      <span className="fit-mock-pip-cooler-pct">{efficiency}%</span>
    </div>
  );

  return (
    <div className="fit-mock-pips-hud">
      <div className="fit-mock-pips-columns" role="group" aria-label="Power pip columns">
        {MOCK_PIP_COLUMNS.map(({ key, label, min }) => {
          const level = assignment[key];
          const quantumOnline = key !== "quantum" || level >= min;
          const stackParts = buildPipStackParts(min, MOCK_PIP_SEGMENT_COUNT);

          return (
            <div
              key={key}
              className={[
                "fit-mock-pip-col",
                activeColumn === key ? "is-active" : "",
                level <= 0 ? "is-off" : "",
              ].filter(Boolean).join(" ")}
            >
              <div
                className="fit-mock-pip-stack"
                aria-label={`${label} ${level} of ${MOCK_PIP_SEGMENT_COUNT} pips assigned`}
              >
                {stackParts.map((part) => {
                  if (part.kind === "merged") {
                    const mergedOn = level >= min;
                    const partial = level > 0 && level < min;
                    return (
                      <button
                        key="merged"
                        type="button"
                        className={[
                          "fit-mock-pip-merged",
                          mergedOn ? "is-on" : "",
                          partial ? "is-partial" : "",
                          min > 0 && !mergedOn && !partial ? "is-min" : "",
                        ].filter(Boolean).join(" ")}
                        style={{ flex: part.minSlots }}
                        aria-label={`${label} minimum ${min} pips`}
                        onClick={() => handleMergedClick(key, min)}
                      >
                        {partial ? (
                          <span
                            className="fit-mock-pip-merged-fill"
                            style={{ height: `${(level / min) * 100}%` }}
                          />
                        ) : null}
                      </button>
                    );
                  }

                  const isOn = part.slot < level;
                  const isMinSlot = min > 0 && part.slot < min;

                  return (
                    <button
                      key={part.slot}
                      type="button"
                      className={[
                        "fit-mock-pip-seg",
                        isOn ? "is-on" : "",
                        isMinSlot && !isOn ? "is-min" : "",
                      ].filter(Boolean).join(" ")}
                      aria-label={`${label} pip ${part.slot + 1}`}
                      onClick={() => handleSegmentClick(key, part.slot, min)}
                    />
                  );
                })}
              </div>

              {key === "quantum" ? (
                <span
                  className={[
                    "fit-mock-pip-qd-status",
                    quantumOnline ? "is-online" : "is-offline",
                  ].filter(Boolean).join(" ")}
                >
                  {quantumOnline ? "Online" : "Offline"}
                </span>
              ) : null}

              <button
                type="button"
                className={[
                  "fit-mock-pip-icon",
                  level > 0 ? "is-powered" : "is-off",
                ].filter(Boolean).join(" ")}
                title={level > 0 ? `${label} full power` : `${label} powered off`}
                aria-label={level > 0 ? `Power off ${label}` : `Full power ${label}`}
                onClick={() => handleIconClick(key, min)}
              >
                <PowerPipIcon category={key} />
              </button>
              <span className="fit-mock-pip-label">{label}</span>
              {min > 0 ? <span className="fit-mock-pip-min">Min {min}</span> : null}
            </div>
          );
        })}
      </div>

      <div className="fit-mock-pips-footer">
        <div className="fit-mock-pips-output-block">
          <span className="fit-mock-pips-output-label">Output</span>
          <strong className="fit-mock-pips-output-value">
            <span className="fit-mock-pips-open">{unassigned}</span>
            <span className="fit-mock-pips-slash"> / </span>
            <span className="fit-mock-pips-total">{MOCK_PIP_TOTAL}</span>
          </strong>
          <span className="fit-mock-pips-output-note">
            {unassigned === 1 ? "1 pip unassigned" : `${unassigned} pips unassigned`}
          </span>
          {activeDef ? (
            <span className="fit-mock-pips-system-readout">
              {activeDef.label} · {mockSystemReadout(activeDef.key, assignment[activeDef.key], activeDef.min)}
            </span>
          ) : null}
        </div>

        <div className="fit-mock-pips-cooler-bars">
          {renderCoolerBar("C1", cooler1Eff)}
          {renderCoolerBar("C2", cooler2Eff)}
        </div>
      </div>
    </div>
  );
}

const ANCHORS = [
  { id: "nw", label: "Nose Gun", x: 27, y: 76, side: "left" as const, slotIds: ["nw1"] },
  { id: "wg", label: "Wing Gimbals", x: 22, y: 54, side: "left" as const, slotIds: ["wg1", "wg2"] },
  { id: "sh", label: "Shields", x: 35, y: 57, side: "left" as const },
  { id: "pp", label: "Power Plant", x: 39, y: 51, side: "left" as const },
  { id: "rd", label: "Radar", x: 44, y: 45, side: "left" as const },
  { id: "ls", label: "Life Support", x: 49, y: 39, side: "left" as const },
  { id: "qd", label: "Quantum Drive", x: 53, y: 34, side: "right" as const },
  { id: "cl1", label: "Cooler 1", x: 57, y: 41, side: "right" as const },
  { id: "cl2", label: "Cooler 2", x: 65, y: 29, side: "right" as const },
  { id: "th", label: "Thrusters", x: 72, y: 21, side: "right" as const },
];

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

function RibbonSectionIcon({ kind }: { kind: "offense" | "shields" | "mobility" | "cargo" }) {
  return (
    <span className={`fit-mock-ribbon-sect-icon is-${kind}`} aria-hidden>
      <Icon>
        {kind === "offense" && (
          <>
            <circle cx="12" cy="12" r="2.5" />
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
          </>
        )}
        {kind === "shields" && <path d="M12 3.5l7.5 3v5.8c0 4.6-3.2 7.9-7.5 8.9-4.3-1-7.5-4.3-7.5-8.9V6.5z" />}
        {kind === "mobility" && <path d="M5 12h12M13 7l5 5-5 5" />}
        {kind === "cargo" && (
          <>
            <path d="M5 9h14v10H5z" />
            <path d="M9 9V7h6v2" />
          </>
        )}
      </Icon>
    </span>
  );
}

function RibbonRowIcon({ kind }: { kind: "pilot" | "gimbal" | "crew" | "regen" }) {
  return (
    <span className={`fit-mock-ribbon-row-icon is-${kind}`} aria-hidden>
      <Icon>
        {kind === "pilot" && <path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 20v-1.2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4V20" />}
        {kind === "gimbal" && <><path d="M12 5a7 7 0 1 0 0 14" /><path d="M12 9v6M9 12h6" /></>}
        {kind === "crew" && <><path d="M8 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM16 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" /><path d="M4 18v-.8a3.2 3.2 0 0 1 3.2-3.2h1.3M20 18v-.8a3.2 3.2 0 0 0-3.2-3.2h-1.3" /></>}
        {kind === "regen" && <path d="M12 6v6l3.5 2" />}
      </Icon>
    </span>
  );
}

function GladiusHero() {
  return (
    <img
      className="fit-mock-ship-photo"
      src="/assets/fitting/gladius-overview.png"
      alt=""
      draggable={false}
    />
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
            <span className="fit-mock-row-size">S{row.size}</span>
            <strong className="fit-mock-row-name">{row.name}</strong>
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

function getRowById(id: string): InstalledRow | undefined {
  return [...NOSE_WEAPON, ...WING_GIMBALS, ...WING_BOMB_RACKS].find((row) => row.id === id);
}

function WeaponStatsDrawer() {
  return (
    <div className="fit-mock-weapon-stats-drawer">
      <DetailSection title="Damage">
        <DetailRow label="Alpha Strike" value="210" tone="accent" />
        <DetailRow label="Sustained DPS" value="Requires fitting API" tone="muted" nested />
        <DetailRow label="Damage Type" value="Energy" nested />
        <DetailRow label="Health Damage" value="Requires fitting API" tone="muted" nested />
      </DetailSection>
      <DetailSection title="Projectile">
        <DetailRow label="Velocity" value="980 m/s" tone="accent" />
        <DetailRow label="Projectile Size" value="3" nested />
        <DetailRow label="Range" value="Requires fitting API" tone="muted" nested />
        <DetailRow label="Spread" value="Requires fitting API" tone="muted" nested />
      </DetailSection>
      <DetailSection title="Heat">
        <DetailRow label="Heat Generation" value="Not calculated yet" tone="muted" />
        <DetailRow label="Overheat Threshold" value="Not calculated yet" tone="muted" nested />
        <DetailRow label="Cooling Rate" value="Not calculated yet" tone="muted" nested />
      </DetailSection>
      <DetailSection title="Ammo / Capacitor">
        <DetailRow label="Magazine" value="Not applicable" tone="muted" />
        <DetailRow label="Capacitor Draw" value="Requires fitting API" tone="muted" nested />
      </DetailSection>
      <DetailSection title="Power / Signature">
        <DetailRow label="Power Draw" value="Requires fitting API" tone="muted" />
        <DetailRow label="EM Signature" value="Not calculated yet" tone="muted" nested />
        <DetailRow label="IR Signature" value="Not calculated yet" tone="muted" nested />
      </DetailSection>
      <DetailSection title="Compatibility">
        <DetailRow label="Mount Type" value="Gimbal" />
        <DetailRow label="Size" value="3" nested />
        <DetailRow label="Manufacturer" value="Aegis Dynamics" nested />
        <DetailRow label="Item Class" value="Repeater" nested />
      </DetailSection>
    </div>
  );
}

function ReadoutRow({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "accent" | "muted" }) {
  return (
    <div className={["fit-mock-readout-row", tone !== "default" ? `is-${tone}` : ""].filter(Boolean).join(" ")}>
      <span className="fit-mock-readout-label">{label}</span>
      <span className="fit-mock-readout-value">{value}</span>
    </div>
  );
}

function ReadoutBlock({ title, children, denseCols = false }: { title: string; children: ReactNode; denseCols?: boolean }) {
  return (
    <section className="fit-mock-readout-block">
      <h4 className="fit-mock-readout-block-title">{title}</h4>
      <div className={["fit-mock-readout-block-body", denseCols ? "is-dense-cols" : ""].filter(Boolean).join(" ")}>{children}</div>
    </section>
  );
}

function ReadoutCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="fit-mock-readout-card">
      <h3 className="fit-mock-readout-card-title">{title}</h3>
      <div className="fit-mock-readout-card-body">{children}</div>
    </article>
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
  const [ship, setShip] = useState<(typeof SHIPS)[number]>("Aegis Gladius");
  const [online, setOnline] = useState<Record<string, boolean>>(() => Object.fromEntries(
    [...NOSE_WEAPON, ...WING_GIMBALS, ...WING_BOMB_RACKS].map((r) => [r.id, r.online]),
  ));
  const [selectedId, setSelectedId] = useState("wg1");
  const [craftOpen, setCraftOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [weaponStatsOpen, setWeaponStatsOpen] = useState(false);

  const [craftItem, setCraftItem] = useState("CF-337 Panther Repeater");

  const selectedRow = getRowById(selectedId) ?? WING_GIMBALS[0];
  const selectedSlotLabel = selectedRow.slot ?? "Nose Gun";

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
          <span className="fit-mock-ship-meta">Light Fighter · Small</span>
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
              <div className="fit-mock-group-head"><h3>Nose Weapon</h3><span>1 / 1</span></div>
              {NOSE_WEAPON.map((row) => (
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
              <div className="fit-mock-group-head"><h3>Wing Gimbals</h3><span>2 / 2</span></div>
              {WING_GIMBALS.map((row) => (
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
              <div className="fit-mock-group-head"><h3>Bomb Racks</h3><span>2 / 2</span></div>
              {WING_BOMB_RACKS.map((row) => (
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
          <section className="fit-mock-pips" aria-label="Power Management">
            <MockPowerPipHud />
            <p className="fit-mock-pips-foot">Power Management</p>
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
            <div className="fit-mock-stage-wrap">
              <div className="fit-mock-stage">
                <div className="fit-mock-stage-vignette" aria-hidden />
                <div className="fit-mock-stage-ship">
                  <GladiusHero />
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

                {selectorOpen && (
                  <aside className="fit-mock-drawer fit-mock-drawer--select" aria-label="Select Component">
                    <header className="fit-mock-drawer-head">
                      <div>
                        <span className="fit-mock-drawer-kicker">Select Component</span>
                        <h3>{selectedSlotLabel}</h3>
                      </div>
                      <button type="button" onClick={() => setSelectorOpen(false)} aria-label="Close">×</button>
                    </header>
                    <label className="fit-mock-search fit-mock-search--drawer">
                      <Icon><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Icon>
                      <input type="search" placeholder="Search compatible components…" />
                    </label>
                    <div className="fit-mock-drawer-list">
                      {COMPATIBLE_ITEMS.map((item) => (
                        <button key={item.id} type="button" className="fit-mock-compat-row">
                          <span className="fit-mock-compat-icon"><Icon><path d="M4 14h12M8 10h8M10 6h6" /></Icon></span>
                          <span className="fit-mock-compat-main">
                            <strong>{item.name}</strong>
                            <span className="fit-mock-compat-meta">
                              <span className={`fit-mock-dmg fit-mock-dmg--${item.damage.toLowerCase()}`}>{item.damage}</span>
                              <span>S{item.size}</span>
                              <span>{item.mount}</span>
                            </span>
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
            </div>

            <div className="fit-mock-readout-deck">
              <div className="summary-ribbon fit-mock-summary">
              <section className="summary-section summary-section--offense">
                <h3><RibbonSectionIcon kind="offense" /> Offense</h3>
                <div className="fit-mock-ribbon-hero-metric">
                  <RibbonRowIcon kind="pilot" />
                  <div>
                    <span className="fit-mock-ribbon-hero-label">Pilot Alpha</span>
                    <strong className="fit-mock-ribbon-hero-value">297.0</strong>
                  </div>
                </div>
                <div className="fit-mock-ribbon-rows">
                  <div className="fit-mock-ribbon-row">
                    <span className="fit-mock-ribbon-row-label"><RibbonRowIcon kind="gimbal" /> Gimbal Alpha</span>
                    <strong>210.0</strong>
                  </div>
                  <div className="fit-mock-ribbon-row is-muted">
                    <span className="fit-mock-ribbon-row-label"><RibbonRowIcon kind="crew" /> Crew Alpha</span>
                    <em>Not applicable</em>
                  </div>
                </div>
              </section>
              <section className="summary-section summary-section--shields">
                <h3><RibbonSectionIcon kind="shields" /> Shields</h3>
                <div className="fit-mock-ribbon-split">
                  <ShieldRing variant="bubble" />
                  <div className="fit-mock-ribbon-shield-copy">
                    <span className="fit-mock-ribbon-kicker">2× S1 · AllStop</span>
                    <strong className="fit-mock-ribbon-hero">5,840 <small>HP</small></strong>
                    <span className="fit-mock-ribbon-sub">
                      <RibbonRowIcon kind="regen" />
                      Regen: Not calculated yet
                    </span>
                  </div>
                </div>
              </section>
              <section className="summary-section summary-section--mobility">
                <h3><RibbonSectionIcon kind="mobility" /> Mobility</h3>
                <div className="fit-mock-ribbon-rows">
                  <div className="fit-mock-ribbon-row"><span>Top Speed</span><strong>226 m/s</strong></div>
                  <div className="fit-mock-ribbon-row"><span>Boost Speed</span><strong>520 m/s</strong></div>
                  <div className="fit-mock-ribbon-row"><span>Nav Speed</span><strong>1,193 m/s</strong></div>
                </div>
              </section>
              <section className="summary-section summary-section--cargo">
                <h3><RibbonSectionIcon kind="cargo" /> Cargo</h3>
                <div className="fit-mock-ribbon-rows">
                  <div className="fit-mock-ribbon-row"><span>Cargo Grid</span><strong>0 SCU</strong></div>
                </div>
              </section>
              </div>

              <div className="fit-mock-readout-grid">
                <ReadoutCard title="Survivability">
                  <ReadoutBlock title="Vital">
                    <ReadoutRow label="HP" value="2,350" tone="accent" />
                    <ReadoutRow label="Total HP" value="6,110" tone="accent" />
                  </ReadoutBlock>
                  <ReadoutBlock title="Resistances">
                    <ReadoutRow label="Energy" value="0" />
                    <ReadoutRow label="Physical" value="0.25" />
                    <ReadoutRow label="Distortion" value="0.95" />
                    <ReadoutRow label="Physical Absorption" value="0.45" />
                  </ReadoutBlock>
                  <ReadoutBlock title="Armor">
                    <ReadoutRow label="Component HP" value="3,300" />
                    <ReadoutRow label="Physical Deflection" value="10" />
                  </ReadoutBlock>
                </ReadoutCard>

                <ReadoutCard title="Storage & Endurance">
                  <ReadoutBlock title="Cargo">
                    <ReadoutRow label="Cargo Grid" value="0 SCU" tone="accent" />
                    <ReadoutRow label="Grid Dimensions" value="Requires fitting API" tone="muted" />
                    <ReadoutRow label="Storage" value="Not available" tone="muted" />
                    <ReadoutRow label="K µSCU" value="Not available" tone="muted" />
                  </ReadoutBlock>
                  <ReadoutBlock title="Fuel">
                    <ReadoutRow label="Hydrogen" value="Requires fitting API" tone="muted" />
                    <ReadoutRow label="Flight Time" value="Not calculated yet" tone="muted" />
                    <ReadoutRow label="Quantum" value="Requires fitting API" tone="muted" />
                    <ReadoutRow label="Range" value="Not calculated yet" tone="muted" />
                  </ReadoutBlock>
                </ReadoutCard>

                <ReadoutCard title="Flight Performance">
                  <ReadoutBlock title="Speeds">
                    <ReadoutRow label="SCM / AB" value="226 / 520 m/s" tone="accent" />
                    <ReadoutRow label="Nav" value="1,193 m/s" tone="accent" />
                  </ReadoutBlock>
                  <ReadoutBlock title="Rotation">
                    <ReadoutRow label="P / Y / R" value="77 / 200 / 55 °/s" />
                    <ReadoutRow label="AB P / Y / R" value="Not calculated yet" tone="muted" />
                  </ReadoutBlock>
                  <ReadoutBlock title="Boost">
                    <ReadoutRow label="Boost Capacity / Regen" value="20 / 0.75" />
                  </ReadoutBlock>
                  <ReadoutBlock title="Accelerations" denseCols>
                    <ReadoutRow label="Main" value="Not calculated yet" tone="muted" />
                    <ReadoutRow label="Retro" value="Not calculated yet" tone="muted" />
                    <ReadoutRow label="Up Strafe" value="Not calculated yet" tone="muted" />
                    <ReadoutRow label="Down Strafe" value="Not calculated yet" tone="muted" />
                    <ReadoutRow label="Lateral Strafe" value="Not calculated yet" tone="muted" />
                  </ReadoutBlock>
                </ReadoutCard>
              </div>
            </div>

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
                  <span className={["fit-mock-def-type", row.typeTone ? `is-tone-${row.typeTone}` : ""].filter(Boolean).join(" ")}>{row.type}</span>
                  {row.detail && <span className="fit-mock-def-detail">{row.detail}</span>}
                </span>
              </button>
            ))}
          </div>

          <section className={`fit-mock-selected-panel${weaponStatsOpen ? " is-stats-open" : ""}`}>
            <header className="fit-mock-selected-head">
              <span className="fit-mock-selected-kicker">Selected Slot</span>
              <h3>{selectedSlotLabel}</h3>
            </header>

            <article className="fit-mock-installed-card">
              <div className="fit-mock-installed-thumb">
                <Icon><path d="M4 14h12M8 10h8M10 6h6" /></Icon>
              </div>
              <div className="fit-mock-installed-body">
                <div className="fit-mock-installed-title-row">
                  <strong>{selectedRow.qty} S{selectedRow.size} {selectedRow.name}</strong>
                  <span className="fit-mock-selected-badge">Installed</span>
                </div>
                <ul className="fit-mock-installed-facts">
                  <li><span className={`fit-mock-dmg fit-mock-dmg--${selectedRow.damage.toLowerCase()}`}>{selectedRow.damage}</span></li>
                  <li><span>Size {selectedRow.size}</span></li>
                  <li><span>{selectedRow.mount}</span></li>
                  <li><span>Velocity {selectedRow.velocity}</span></li>
                  <li><span>Alpha {selectedRow.alpha}</span></li>
                </ul>
              </div>
            </article>

            <button
              type="button"
              className={["fit-mock-weapon-stats-btn", weaponStatsOpen ? "is-open" : ""].filter(Boolean).join(" ")}
              onClick={() => setWeaponStatsOpen((v) => !v)}
              aria-expanded={weaponStatsOpen}
            >
              Weapon Stats
              <Icon><path d={weaponStatsOpen ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} /></Icon>
            </button>

            {weaponStatsOpen && <WeaponStatsDrawer />}
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
