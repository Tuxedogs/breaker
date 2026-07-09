import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import PowerPipIcon from "../components/fitting/terminal/PowerPipIcons";
import { derivedNum, extractedNum, valueOrUnavailable } from "../components/fitting/terminal/fittingPerformanceHelpers";
import {
  getFittingComponent,
  type FittingComponentDetail,
  type FittingComponentMitigation,
  type FittingComponentSummary,
} from "../lib/fitting/fittingApi";
import {
  buildMockupOffensiveDisplayGroups,
  buildMockupSupportGroups,
  isPortStructurallyEditable,
  mockupComponentTitle,
  mockupSlotLabel,
  supportTypeLabel,
} from "../lib/fitting/fittingMockupGroups";
import {
  mockupDrawerSlotLabel,
  mockupDrawerTitle,
  resolveTurretGroupCompatibleItems,
  turretGroupCompatibilityMessage,
  usesGroupedPortCompatibility,
  type MockupWeaponSelection,
} from "../lib/fitting/fittingMockupTurretGroups";
import { mockupTurretGroupLabel } from "../lib/fitting/fittingMockupSlotLabels";
import {
  aggregateWeaponRowDisplay,
  formatQuantitySizeName,
  formatWeaponRailStats,
} from "../lib/fitting/fittingWeaponStats";
import { useTurretGroupCompatibleComponents } from "../lib/fitting/useTurretGroupCompatibleComponents";
import {
  buildFittingCompatDebugSnapshot,
  isFittingCompatDebugEnabled,
} from "../lib/fitting/fittingCompatDebug";
import { canonicalFittingId, resolveLoadoutComponentId } from "../lib/fitting/fittingItemIdentity";
import {
  compatibilityDrawerMessage,
  isItemCompatibleWithSlot,
  isSlotCompatibilityEditable,
  portCompatibleApiComponents,
  resolveCompatibleItemsForSlot,
  resolveCompatibilityRejections,
} from "../lib/fitting/fittingSlotCompatibility";
import {
  computeMockupHpSummary,
  powerSummaryFromCalculate,
  shieldSummaryLabel,
} from "../lib/fitting/fittingMockupSelectors";
import {
  categoryLabel,
  formatNumber,
  inferControlMode,
  inferDamageType,
  type PortBreakdownRow,
} from "../lib/fitting/fittingPortGrouping";
import type { PipAssignment, PipCategory } from "../lib/fitting/fittingTerminalTypes";
import {
  componentStatSummary,
  useCompatibleComponents,
} from "../lib/fitting/useCompatibleComponents";
import {
  formatAlphaWithDps,
  resolveDrawerWeaponDps,
  statText,
  useFittingMockupCombatStats,
} from "../lib/fitting/useFittingMockupCombatStats";
import { useFittingMockupLoadout } from "../lib/fitting/useFittingMockupLoadout";
import { getFittingSlotIcon } from "../lib/fitting/getFittingSlotIcon";
import "./fitting-mockup.css";

const MAIN_TABS = [
  "Overview", "Hardpoints", "Resources", "Defense", "Network", "Damage Lab", "Weapons", "Stats", "Compare",
] as const;

const VIEW_CAMERAS = ["Top", "Side", "Rear", "3D"] as const;

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

function shipOverviewImage(shipName: string | undefined): string {
  if (shipName?.toLowerCase().includes("gladius")) return "/assets/fitting/gladius-overview.png";
  return "/assets/fitting/gladius-overview.png";
}

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
  if (key === "cooler1" || key === "cooler2") return `Cooling ${coolerEfficiencyPercent(level)}%`;
  if (key === "quantum") return level >= min ? `Spool ready · ${level} pips` : `Offline · need ${min} min`;
  if (key === "weapons") return level > 0 ? `Weapon regen ${Math.round(40 + level * 8)}%` : "Weapons depowered";
  if (key === "engines") return level > 0 ? `Thrust cap ${Math.round(55 + level * 5)}%` : "Thrusters limited";
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
      if (delta <= 0) return { ...current, [category]: clamped };
      const available = MOCK_PIP_TOTAL - sumMockPipAssignment(current);
      return { ...current, [category]: currentLevel + Math.min(delta, available) };
    });
    setActiveColumn(category);
  };

  const handleSegmentClick = (category: PipCategory, slotFromBottom: number, min: number) => {
    const level = assignment[category];
    const target = slotFromBottom + 1;
    if (target === level) { setCategoryLevel(category, slotFromBottom); return; }
    if (min > 0 && target < min) { setCategoryLevel(category, min); return; }
    setCategoryLevel(category, target);
  };

  const activeDef = activeColumn ? MOCK_PIP_COLUMNS.find((column) => column.key === activeColumn) : null;

  return (
    <div className="fit-mock-pips-hud">
      <div className="fit-mock-pips-columns" role="group" aria-label="Power pip columns">
        {MOCK_PIP_COLUMNS.map(({ key, label, min }) => {
          const level = assignment[key];
          const quantumOnline = key !== "quantum" || level >= min;
          const stackParts = buildPipStackParts(min, MOCK_PIP_SEGMENT_COUNT);
          return (
            <div key={key} className={["fit-mock-pip-col", activeColumn === key ? "is-active" : "", level <= 0 ? "is-off" : ""].filter(Boolean).join(" ")}>
              <div className="fit-mock-pip-stack" aria-label={`${label} ${level} of ${MOCK_PIP_SEGMENT_COUNT} pips assigned`}>
                {stackParts.map((part) => {
                  if (part.kind === "merged") {
                    const mergedOn = level >= min;
                    const partial = level > 0 && level < min;
                    return (
                      <button key="merged" type="button" className={["fit-mock-pip-merged", mergedOn ? "is-on" : "", partial ? "is-partial" : "", min > 0 && !mergedOn && !partial ? "is-min" : ""].filter(Boolean).join(" ")} style={{ flex: part.minSlots }} onClick={() => setCategoryLevel(key, level >= min ? 0 : min)} />
                    );
                  }
                  const isOn = part.slot < level;
                  return (
                    <button key={part.slot} type="button" className={["fit-mock-pip-seg", isOn ? "is-on" : "", min > 0 && part.slot < min && !isOn ? "is-min" : ""].filter(Boolean).join(" ")} onClick={() => handleSegmentClick(key, part.slot, min)} />
                  );
                })}
              </div>
              {key === "quantum" ? <span className={["fit-mock-pip-qd-status", quantumOnline ? "is-online" : "is-offline"].filter(Boolean).join(" ")}>{quantumOnline ? "Online" : "Offline"}</span> : null}
              <button type="button" className={["fit-mock-pip-icon", level > 0 ? "is-powered" : "is-off"].filter(Boolean).join(" ")} onClick={() => setCategoryLevel(key, level > 0 ? 0 : Math.max(min, Math.min(MOCK_PIP_SEGMENT_COUNT, MOCK_PIP_TOTAL - assignedTotal + level)))}>
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
          <strong className="fit-mock-pips-output-value"><span className="fit-mock-pips-open">{unassigned}</span><span className="fit-mock-pips-slash"> / </span><span className="fit-mock-pips-total">{MOCK_PIP_TOTAL}</span></strong>
          {activeDef ? <span className="fit-mock-pips-system-readout">{activeDef.label} · {mockSystemReadout(activeDef.key, assignment[activeDef.key], activeDef.min)}</span> : null}
        </div>
      </div>
    </div>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>;
}

type CompactStat = {
  label: string;
  value: string;
};

function slotIconForRow(row: PortBreakdownRow, slotKind?: string): string {
  return getFittingSlotIcon({
    slotKind,
    componentType: row.componentCategory ?? row.ruleCategory ?? row.portCategory,
    hardpointType: row.portSubtype,
    turretControlType: inferControlMode(row),
    itemType: row.componentSubtype,
    portType: row.portType,
  });
}

function slotIconForSelection(selection: MockupWeaponSelection): string {
  const row = selection.childRows[0];
  return getFittingSlotIcon({
    slotKind: selection.isTurretGroup
      ? selection.groupKey === "manned-turrets" ? "manned turret group" : "remote turret group"
      : "weapon hardpoint",
    componentType: row?.componentCategory ?? row?.ruleCategory ?? row?.portCategory,
    hardpointType: row?.portSubtype,
    turretControlType: selection.groupKey === "remote-turrets" ? "remote turret" : row ? inferControlMode(row) : null,
    itemType: row?.componentSubtype,
    portType: row?.portType,
  });
}

function iconForOffensiveGroup(groupKey: string): string {
  return getFittingSlotIcon({
    slotKind: groupKey === "manned-turrets"
      ? "manned turret group"
      : groupKey === "remote-turrets"
        ? "remote turret group"
        : groupKey === "missiles" || groupKey === "torpedoes"
          ? "missile rack"
          : "weapon hardpoint",
  });
}

function iconForSupportGroup(rows: PortBreakdownRow[]): string {
  const row = rows[0];
  return row ? slotIconForRow(row) : getFittingSlotIcon({ slotKind: "component slot" });
}

function drawerTitleForSlot(row: PortBreakdownRow | null, selection: MockupWeaponSelection | null): string {
  if (selection) return mockupDrawerTitle(selection);
  if (!row) return "Select Component";
  return `Select ${mockupSlotLabel(row)}`;
}

function drawerSlotLabel(row: PortBreakdownRow | null, selection: MockupWeaponSelection | null): string {
  if (selection) return mockupDrawerSlotLabel(selection);
  if (!row) return "Selected slot";
  return mockupSlotLabel(row);
}

function addStat(parts: CompactStat[], label: string, value: number | null | undefined, suffix = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) return;
  parts.push({ label, value: `${formatNumber(value)}${suffix}` });
}

function itemPrimaryStats(component: FittingComponentSummary, detail: FittingComponentDetail | undefined): CompactStat[] {
  const stats = detail?.stats;
  const typeText = `${component.type} ${component.subtype ?? ""}`.toLowerCase();
  const parts: CompactStat[] = [];

  if (typeText.includes("weapon")) {
    addStat(parts, "DPS", resolveDrawerWeaponDps(stats));
    addStat(parts, "Alpha", stats?.alphaDamage);
    addStat(parts, "Speed", stats?.projectileSpeed, " m/s");
    return parts.slice(0, 4);
  }

  if (typeText.includes("power")) {
    addStat(parts, "Output", stats?.powerGenerated, " MW");
    addStat(parts, "Draw", stats?.powerDraw, " MW");
  } else if (typeText.includes("cooler")) {
    addStat(parts, "Cooling", stats?.coolingGenerated);
    addStat(parts, "Draw", stats?.powerDraw, " MW");
  } else if (typeText.includes("shield")) {
    addStat(parts, "HP", stats?.shieldHp);
    addStat(parts, "Regen", stats?.regenRate, "/s");
  } else if (typeText.includes("quantum")) {
    addStat(parts, "Speed", stats?.quantumSpeed);
    addStat(parts, "Fuel", stats?.fuelRate);
  } else if (typeText.includes("radar") || typeText.includes("scanner")) {
    addStat(parts, "Detect", stats?.detectionRange);
    addStat(parts, "Scan", stats?.scanRange);
  } else {
    addStat(parts, "Power", stats?.powerDraw ?? stats?.powerUsage);
    addStat(parts, "HP", stats?.health);
  }

  return parts.slice(0, 3);
}

function detailPrimaryStats(detail: FittingComponentDetail | null): CompactStat[] {
  if (!detail) return [];
  return itemPrimaryStats({
    id: detail.id,
    name: detail.name,
    displayName: detail.displayName,
    manufacturer: detail.manufacturer,
    type: detail.type,
    subtype: detail.subtype,
    size: detail.size,
    grade: detail.grade,
    class: detail.class,
    confidence: detail.confidence,
  }, detail);
}

function selectedWeaponStats(
  selection: MockupWeaponSelection | null,
  statsByComponentId: Record<string, Record<string, number | null>>,
): CompactStat[] {
  if (!selection) return [];
  const display = aggregateWeaponRowDisplay({
    quantities: selection.summary.rows.map(() => 1),
    sizes: selection.summary.rows.map((row) => row.componentSize),
    names: selection.summary.rows.map((row) => row.equippedComponentName ?? "Empty"),
    statsList: selection.summary.rows.map((row) => (
      row.equippedComponentKey ? statsByComponentId[row.equippedComponentKey] : null
    )),
  });
  const parts: CompactStat[] = [];
  addStat(parts, "DPS", display.dps);
  const alpha = selection.summary.rows.reduce((total, row) => {
    const value = row.equippedComponentKey ? statsByComponentId[row.equippedComponentKey]?.alphaDamage : null;
    return typeof value === "number" && Number.isFinite(value) ? total + value : total;
  }, 0);
  if (alpha > 0) addStat(parts, "Alpha", alpha);
  addStat(parts, "Speed", display.projectileSpeed, " m/s");
  return parts;
}

function FittingSlotIconImage({ src }: { src: string }) {
  return <img src={src} alt="" draggable={false} />;
}

function RibbonSectionIcon({ kind }: { kind: "offense" | "shields" | "hp" | "cargo" }) {
  return (
    <span className={`fit-mock-ribbon-sect-icon is-${kind}`} aria-hidden>
      <Icon>
        {kind === "offense" && <><circle cx="12" cy="12" r="2.5" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></>}
        {kind === "shields" && <path d="M12 3.5l7.5 3v5.8c0 4.6-3.2 7.9-7.5 8.9-4.3-1-7.5-4.3-7.5-8.9V6.5z" />}
        {kind === "hp" && <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10z" />}
        {kind === "cargo" && <><path d="M5 9h14v10H5z" /><path d="M9 9V7h6v2" /></>}
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
        {kind === "crew" && <path d="M8 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM16 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />}
        {kind === "regen" && <path d="M12 6v6l3.5 2" />}
      </Icon>
    </span>
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
        [0, 90, 180, 270].map((rot) => (
          <circle key={rot} cx="36" cy="36" r={r} fill="none" stroke="#00d8ff" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${c * 0.22} ${c * 0.03}`} transform={`rotate(${rot - 90} 36 36)`} />
        ))
      )}
    </svg>
  );
}

function WeaponSlotRow({
  selection,
  selected,
  statsByComponentId,
  statsLoading,
  onSelect,
}: {
  selection: MockupWeaponSelection;
  selected: boolean;
  statsByComponentId: Record<string, Record<string, number | null>>;
  statsLoading: boolean;
  onSelect: () => void;
}) {
  const { summary } = selection;
  const isTurretRow = selection.isTurretGroup;
  const display = aggregateWeaponRowDisplay({
    quantities: summary.rows.map(() => 1),
    sizes: summary.rows.map((row) => row.componentSize),
    names: summary.rows.map((row) => row.equippedComponentName ?? "Empty"),
    statsList: summary.rows.map((row) => (
      row.equippedComponentKey ? statsByComponentId[row.equippedComponentKey] : null
    )),
  });
  const slotLabel = isTurretRow ? mockupTurretGroupLabel(summary) : mockupSlotLabel(summary.rows[0]);
  const weaponLine = formatQuantitySizeName(display);
  const statLine = statsLoading ? "..." : formatWeaponRailStats(display);
  const iconSrc = slotIconForSelection(selection);

  return (
    <div className={["fit-mock-row", isTurretRow ? "is-turret-group" : "", selected ? "is-selected" : ""].filter(Boolean).join(" ")}>
      <span className="fit-mock-row-slot" aria-hidden>
        <span className="fit-mock-row-power is-on" />
        <span className="fit-mock-row-slot-icon">
          <FittingSlotIconImage src={iconSrc} />
        </span>
      </span>
      <button type="button" className="fit-mock-row-hit" onClick={onSelect}>
        <span className="fit-mock-row-main">
          <span className="fit-mock-row-slot-label">{slotLabel}</span>
          <span className="fit-mock-row-title">
            <strong className="fit-mock-row-name">{weaponLine}</strong>
          </span>
          {statLine ? <span className="fit-mock-row-stats">{statLine}</span> : null}
        </span>
      </button>
    </div>
  );
}

function SupportRow({
  row,
  selected,
  onSelect,
}: {
  row: PortBreakdownRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const iconSrc = slotIconForRow(row);
  return (
    <button type="button" className={["fit-mock-def-card", selected ? "is-selected" : ""].filter(Boolean).join(" ")} onClick={onSelect}>
      <span className="fit-mock-def-icon" aria-hidden><FittingSlotIconImage src={iconSrc} /></span>
      <span className="fit-mock-def-main">
        <span className="fit-mock-def-title-row">
          <strong>{mockupComponentTitle(row)}</strong>
          <span className="fit-mock-def-status is-active">Installed</span>
        </span>
        <span className="fit-mock-def-type">{supportTypeLabel(row)}</span>
        <span className="fit-mock-def-detail">{mockupSlotLabel(row)}</span>
      </span>
    </button>
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

function ComponentStatsDrawer({ detail, loading }: { detail: FittingComponentDetail | null; loading: boolean }) {
  const stats = detail?.stats;
  if (loading) return <div className="fit-mock-weapon-stats-drawer"><DetailRow label="Loading" value="..." /></div>;
  if (!detail) return <div className="fit-mock-weapon-stats-drawer"><DetailRow label="Stats" value="Source unavailable" tone="muted" /></div>;

  const damageType = stats ? inferDamageType(stats) : null;
  return (
    <div className="fit-mock-weapon-stats-drawer">
      <DetailSection title="Damage">
        <DetailRow label="Alpha Strike" value={statText(stats?.alphaDamage)} tone="accent" />
        <DetailRow label="Sustained DPS" value={statText(resolveDrawerWeaponDps(stats))} tone={resolveDrawerWeaponDps(stats) == null ? "muted" : "default"} nested />
        <DetailRow label="Damage Type" value={damageType ?? "Not calculated yet"} nested />
      </DetailSection>
      <DetailSection title="Projectile">
        <DetailRow label="Velocity" value={statText(stats?.projectileSpeed, " m/s")} tone="accent" />
        <DetailRow label="Range" value={statText(stats?.calculatedRange, " m")} tone={stats?.calculatedRange == null ? "muted" : "default"} nested />
      </DetailSection>
      <DetailSection title="Power / Signature">
        <DetailRow label="Power Draw" value={statText(stats?.powerDraw, " MW")} tone={stats?.powerDraw == null ? "muted" : "default"} />
        <DetailRow label="EM Signature" value={statText(stats?.electromagneticEmission)} tone="muted" nested />
      </DetailSection>
      <DetailSection title="Compatibility">
        <DetailRow label="Type" value={categoryLabel(detail.type)} />
        <DetailRow label="Size" value={detail.size != null ? String(detail.size) : "—"} nested />
        <DetailRow label="Manufacturer" value={detail.manufacturer ?? "—"} nested />
        <DetailRow label="Grade / Class" value={[detail.grade, detail.class].filter(Boolean).join(" / ") || "—"} nested />
      </DetailSection>
    </div>
  );
}

export default function FittingMockupPage() {
  const [searchParams] = useSearchParams();
  const queryShip = searchParams.get("ship");
  const [mainTab] = useState<(typeof MAIN_TABS)[number]>("Overview");
  const [camera] = useState<(typeof VIEW_CAMERAS)[number]>("Top");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [weaponStatsOpen, setWeaponStatsOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<FittingComponentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [armorMitigations, setArmorMitigations] = useState<Array<Extract<FittingComponentMitigation, { kind: "armor" }>>>([]);
  const [compatStats, setCompatStats] = useState<Record<string, FittingComponentDetail>>({});
  const [installError, setInstallError] = useState<string | null>(null);
  const [compatDebug, setCompatDebug] = useState<ReturnType<typeof buildFittingCompatDebugSnapshot> | null>(null);
  const compatDebugEnabled = isFittingCompatDebugEnabled(searchParams);

  const loadout = useFittingMockupLoadout(queryShip);
  const combatStats = useFittingMockupCombatStats(loadout.portRows);

  const offensiveDisplayGroups = useMemo(
    () => buildMockupOffensiveDisplayGroups(loadout.portRows),
    [loadout.portRows],
  );
  const offensiveSelections = useMemo(
    () => offensiveDisplayGroups.flatMap((group) => group.selections),
    [offensiveDisplayGroups],
  );
  const supportGroups = useMemo(() => buildMockupSupportGroups(loadout.portRows), [loadout.portRows]);
  const selectedWeaponSelection = useMemo(
    () => offensiveSelections.find((selection) => selection.selectionPortId === loadout.selectedPortId) ?? null,
    [offensiveSelections, loadout.selectedPortId],
  );
  const selectedRow = useMemo(
    () => selectedWeaponSelection?.childRows[0]
      ?? loadout.portRows.find((row) => row.portId === loadout.selectedPortId)
      ?? null,
    [loadout.portRows, loadout.selectedPortId, selectedWeaponSelection],
  );
  const usesGroupedCompatibility = usesGroupedPortCompatibility(selectedWeaponSelection);

  const compatible = useCompatibleComponents(
    loadout.selectedShipKey,
    selectedRow,
    selectorOpen
      && Boolean(selectedRow && isPortStructurallyEditable(selectedRow))
      && !usesGroupedCompatibility,
  );

  const groupedCompatible = useTurretGroupCompatibleComponents(
    loadout.selectedShipKey,
    selectedWeaponSelection?.childRows ?? [],
    selectorOpen && usesGroupedCompatibility,
  );

  const compatibilityIndex = compatible.compatibilityIndex;
  const portApiComponents = useMemo(() => (
    selectedRow && compatible.result?.portId === selectedRow.portId
      ? portCompatibleApiComponents(compatible.result, selectedRow.portId)
      : []
  ), [compatible.result, selectedRow]);

  const drawerRejections = useMemo(() => {
    if (!selectedRow || !compatibilityIndex || compatible.loading || compatible.requestPortId !== selectedRow.portId) {
      return [];
    }
    if (!compatDebugEnabled) return [];
    return resolveCompatibilityRejections({
      slot: selectedRow,
      candidateItems: portApiComponents,
      compatibilityIndex,
    });
  }, [compatDebugEnabled, compatibilityIndex, compatible.loading, compatible.requestPortId, portApiComponents, selectedRow]);

  const drawerItems = useMemo(() => {
    if (usesGroupedCompatibility && selectedWeaponSelection) {
      if (groupedCompatible.loading || groupedCompatible.requestKey !== selectedWeaponSelection.childPortIds.sort().join("|")) {
        return [];
      }
      return resolveTurretGroupCompatibleItems(groupedCompatible.bundles);
    }

    if (!selectedRow || !compatibilityIndex || compatible.loading || compatible.requestPortId !== selectedRow.portId) {
      return [];
    }
    return resolveCompatibleItemsForSlot({
      slot: selectedRow,
      candidateItems: portApiComponents,
      compatibilityIndex,
    });
  }, [
    compatibilityIndex,
    compatible.loading,
    compatible.requestPortId,
    groupedCompatible.bundles,
    groupedCompatible.loading,
    groupedCompatible.requestKey,
    portApiComponents,
    selectedRow,
    selectedWeaponSelection,
    usesGroupedCompatibility,
  ]);

  const drawerEditable = Boolean(
    usesGroupedCompatibility && selectedWeaponSelection
      ? selectedWeaponSelection.childRows.every((row) => isPortStructurallyEditable(row))
        && groupedCompatible.bundles.every((bundle) => bundle.index?.status === "known")
      : selectedRow
        && compatibilityIndex
        && isSlotCompatibilityEditable(selectedRow, compatibilityIndex),
  );

  const drawerMessage = usesGroupedCompatibility && selectedWeaponSelection
    ? turretGroupCompatibilityMessage(
      selectedWeaponSelection,
      groupedCompatible.bundles,
      groupedCompatible.loading,
      drawerItems.length,
    )
    : selectedRow && compatibilityIndex
      ? compatibilityDrawerMessage(selectedRow, compatibilityIndex, compatible.loading, drawerItems.length)
      : null;

  useEffect(() => {
    const componentId = selectedRow?.equippedComponentKey;
    if (!componentId) {
      setSelectedDetail(null);
      return;
    }
    const controller = new AbortController();
    setDetailLoading(true);
    getFittingComponent(componentId, controller.signal)
      .then((detail) => { if (!controller.signal.aborted) setSelectedDetail(detail); })
      .catch(() => { if (!controller.signal.aborted) setSelectedDetail(null); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selectedRow?.equippedComponentKey]);

  useEffect(() => {
    const armorIds = loadout.portRows
      .filter((row) => {
        const text = `${row.ruleCategory ?? ""} ${row.portCategory ?? ""}`.toLowerCase();
        return row.equippedComponentKey && text.includes("armor");
      })
      .map((row) => row.equippedComponentKey!)
      .filter((id, index, values) => values.indexOf(id) === index);

    if (armorIds.length === 0) {
      setArmorMitigations([]);
      return;
    }

    const controller = new AbortController();
    void (async () => {
      const next: Array<Extract<FittingComponentMitigation, { kind: "armor" }>> = [];
      for (const componentId of armorIds) {
        try {
          const detail = await getFittingComponent(componentId, controller.signal);
          if (controller.signal.aborted) return;
          if (detail.mitigation?.kind === "armor") next.push(detail.mitigation);
        } catch {
          if (controller.signal.aborted) return;
        }
      }
      if (!controller.signal.aborted) setArmorMitigations(next);
    })();
    return () => controller.abort();
  }, [loadout.portRows]);

  useEffect(() => {
    const ids = drawerItems.map((component) => component.id);
    if (ids.length === 0) return;
    const controller = new AbortController();
    void (async () => {
      const next: Record<string, FittingComponentDetail> = {};
      for (const componentId of ids.slice(0, 40)) {
        try {
          const detail = await getFittingComponent(componentId, controller.signal);
          if (controller.signal.aborted) return;
          next[componentId] = detail;
        } catch {
          if (controller.signal.aborted) return;
        }
      }
      if (!controller.signal.aborted) setCompatStats((current) => ({ ...current, ...next }));
    })();
    return () => controller.abort();
  }, [drawerItems]);

  useEffect(() => {
    if (!compatDebugEnabled || !selectedRow || !compatibilityIndex) {
      setCompatDebug(null);
      return;
    }
    setCompatDebug(buildFittingCompatDebugSnapshot({
      slot: selectedRow,
      apiComponents: portApiComponents,
      compatibilityIndex,
      apiStatus: compatible.result?.status ?? null,
      matchedItems: drawerItems,
      rejected: drawerRejections,
    }));
  }, [compatDebugEnabled, compatibilityIndex, compatible.result?.status, drawerItems, drawerRejections, portApiComponents, selectedRow]);

  const ship = loadout.shipDetail?.ship;
  const shieldHp = derivedNum(loadout.calculateResult, "shields", "totalShieldHP");
  const shieldRegen = derivedNum(loadout.calculateResult, "shields", "totalRegenRate");
  const hullHP = loadout.shipDetail?.hullHP ?? loadout.shipDetail?.mitigation?.hullHp ?? null;
  const hpSummary = computeMockupHpSummary({ hullHP, shieldHp, armorMitigations });
  const shieldLabel = shieldSummaryLabel(loadout.resourceGroups.shields);
  const powerLabel = powerSummaryFromCalculate(loadout.calculateResult);
  const scmSpeed = ship?.scmSpeed ?? extractedNum(loadout.calculateResult, "performance", "scmSpeed");
  const maxSpeed = ship?.maxSpeed ?? extractedNum(loadout.calculateResult, "performance", "maxSpeed");
  const boostSpeed = ship?.boostSpeedForward ?? extractedNum(loadout.calculateResult, "performance", "boostSpeedForward");
  const pitch = ship?.pitchRate ?? extractedNum(loadout.calculateResult, "performance", "pitchRate");
  const yaw = ship?.yawRate ?? extractedNum(loadout.calculateResult, "performance", "yawRate");
  const roll = ship?.rollRate ?? extractedNum(loadout.calculateResult, "performance", "rollRate");
  const boostCapacity = extractedNum(loadout.calculateResult, "performance", "boostCapacity");
  const boostRegen = extractedNum(loadout.calculateResult, "performance", "boostRegen");
  const cargoScu = ship?.cargoCapacityScu ?? null;
  const coolingProduced = derivedNum(loadout.calculateResult, "cooling", "totalCoolingGenerated");
  const coolingRequired = derivedNum(loadout.calculateResult, "cooling", "totalCoolingRequired");
  const powerProduced = derivedNum(loadout.calculateResult, "power", "totalPowerGenerated");
  const powerRequired = derivedNum(loadout.calculateResult, "power", "totalPowerRequired");
  const drawerTitle = drawerTitleForSlot(selectedRow, selectedWeaponSelection);
  const drawerCompatibleLabel = drawerSlotLabel(selectedRow, selectedWeaponSelection);
  const drawerItemKind = selectedWeaponSelection ? "weapon" : "component";
  const drawerIconSrc = selectedWeaponSelection
    ? slotIconForSelection(selectedWeaponSelection)
    : selectedRow ? slotIconForRow(selectedRow) : getFittingSlotIcon({});
  const installedDetailStats = selectedWeaponSelection
    ? selectedWeaponStats(selectedWeaponSelection, combatStats.statsByComponentId)
    : detailPrimaryStats(selectedDetail);

  function selectWeaponSelection(selection: MockupWeaponSelection) {
    loadout.selectPort(selection.selectionPortId);
    setInstallError(null);
    setSelectorOpen(true);
  }

  function selectPort(portId: string) {
    loadout.selectPort(portId);
    setInstallError(null);
    setSelectorOpen(true);
  }

  useEffect(() => {
    setInstallError(null);
  }, [loadout.selectedPortId, selectorOpen]);

  async function openComponentDetails(componentId: string) {
    setWeaponStatsOpen(true);
    setDetailLoading(true);
    try {
      const detail = await getFittingComponent(componentId);
      setSelectedDetail(detail);
    } catch {
      setSelectedDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function installComponent(componentId: string) {
    if (!loadout.selectedPortId || !selectedRow) return;

    const item = drawerItems.find((component) => canonicalFittingId(component.id) === canonicalFittingId(componentId));
    if (!item) {
      setInstallError("Selected item is not compatible with this slot.");
      return;
    }

    if (usesGroupedCompatibility && selectedWeaponSelection) {
      const indexes = Object.fromEntries(
        groupedCompatible.bundles
          .filter((bundle) => bundle.index)
          .map((bundle) => [bundle.childPortId, bundle.index!]),
      );
      const result = await loadout.installTurretGroup(selectedWeaponSelection.childPortIds, item, indexes);
      if (!result.ok) {
        setInstallError(result.reason);
        return;
      }
      setInstallError(null);
      setSelectorOpen(false);
      return;
    }

    if (!compatibilityIndex) return;

    const verdict = isItemCompatibleWithSlot({
      slot: selectedRow,
      item,
      compatibilityIndex,
    });
    if (!verdict.compatible) {
      setInstallError(verdict.reason ?? "Item is not compatible with this slot.");
      return;
    }

    if (compatDebugEnabled) {
      setCompatDebug(buildFittingCompatDebugSnapshot({
        slot: selectedRow,
        apiComponents: portApiComponents,
        compatibilityIndex,
        apiStatus: compatible.result?.status ?? null,
        matchedItems: drawerItems,
        rejected: drawerRejections,
        installItem: item,
        validatePayload: {
          shipId: loadout.selectedShipKey,
          portId: selectedRow.portId,
          componentId: resolveLoadoutComponentId(item),
        },
      }));
    }

    const result = await loadout.installComponent(selectedRow.portId, item, compatibilityIndex);
    if (!result.ok) {
      setInstallError(result.reason);
      return;
    }

    setInstallError(null);
    setSelectorOpen(false);
  }

  const shipMeta = [ship?.role ?? ship?.career, ship?.movementClass].filter(Boolean).join(" · ");

  return (
    <div className="fit-mock" role="application" aria-label="Ship fitting overview">
      <header className="fit-mock-head">
        <div className="fit-mock-ship-id">
          <h1>{ship?.name ?? "Loading ship…"}</h1>
          <span className="fit-mock-ship-meta">{shipMeta || (loadout.loading ? "Loading…" : "Source unavailable")}</span>
          {ship?.manufacturer ? <span className="fit-mock-ship-meta">{ship.manufacturer}</span> : null}
        </div>
        <nav className="fit-mock-tabs" aria-label="Fitting sections">
          {MAIN_TABS.map((tab) => (
            <button key={tab} type="button" className={["fit-mock-tab", mainTab === tab ? "is-active" : ""].filter(Boolean).join(" ")}>{tab}</button>
          ))}
        </nav>
        <div className="fit-mock-head-right">
          <select
            className="fit-mock-select"
            value={loadout.selectedShipKey ?? ""}
            onChange={(e) => loadout.selectShip(e.target.value)}
            aria-label="Select ship"
            disabled={loadout.shipsLoading}
          >
            {loadout.ships.map((entry) => <option key={entry.shipKey} value={entry.shipKey}>{entry.name}</option>)}
          </select>
          <button type="button" className="fit-mock-save" disabled={!loadout.isModified}>Save Loadout</button>
          {loadout.isModified ? <span className="fit-mock-flag is-mod">Modified</span> : null}
          {loadout.isModified ? <span className="fit-mock-flag is-unsaved">Unsaved Changes</span> : null}
        </div>
      </header>

      {loadout.error ? (
        <div className="fit-mock-error">Fitting data unavailable. Check that the fitting API is running.</div>
      ) : null}

      {compatDebugEnabled && compatDebug ? (
        <pre className="fit-mock-compat-debug">{JSON.stringify(compatDebug, null, 2)}</pre>
      ) : null}

      <div className="fit-mock-main">
        <aside className="fit-mock-rail fit-mock-rail--left">
          <div className="fit-mock-rail-head"><h2>Offensive Systems</h2></div>
          <label className="fit-mock-search">
            <Icon><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Icon>
            <input type="search" placeholder="Search weapons, systems…" aria-label="Search offensive systems" />
          </label>
          <div className="fit-mock-rail-scroll">
            {offensiveDisplayGroups.map((group) => (
              <section key={group.key} className="fit-mock-group">
                <div className="fit-mock-group-head">
                  <span className="fit-mock-group-head-icon" aria-hidden>
                    <FittingSlotIconImage src={iconForOffensiveGroup(group.key)} />
                  </span>
                  <h3>{group.label}</h3>
                  <span>{group.summaries.reduce((total, summary) => total + summary.quantity, 0)} / {group.summaries.reduce((total, summary) => total + summary.quantity, 0)}</span>
                </div>
                {group.selections.map((selection) => (
                  <WeaponSlotRow
                    key={selection.selectionPortId}
                    selection={selection}
                    selected={loadout.selectedPortId === selection.selectionPortId}
                    statsByComponentId={combatStats.statsByComponentId}
                    statsLoading={combatStats.loading}
                    onSelect={() => selectWeaponSelection(selection)}
                  />
                ))}
              </section>
            ))}
            {offensiveDisplayGroups.length === 0 && !loadout.loading ? <p className="fit-mock-empty">No offensive systems loaded.</p> : null}
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
                  <img className="fit-mock-ship-photo" src={shipOverviewImage(ship?.name)} alt="" draggable={false} />
                </div>

                {selectorOpen && selectedRow ? (
                  <aside className="fit-mock-drawer fit-mock-drawer--select" aria-label="Select Component">
                    <header className="fit-mock-drawer-head">
                      <div>
                        <span className="fit-mock-drawer-kicker">Select Component</span>
                        <h3>{drawerTitle}</h3>
                        {drawerEditable ? (
                          <p className="fit-mock-drawer-subcopy">Compatible with {drawerCompatibleLabel}</p>
                        ) : null}
                      </div>
                      <button type="button" onClick={() => setSelectorOpen(false)} aria-label="Close">×</button>
                    </header>
                    {drawerMessage ? <p className="fit-mock-drawer-note">{drawerMessage}</p> : null}
                    {installError ? <p className="fit-mock-drawer-error">{installError}</p> : null}
                    {drawerEditable ? (
                      <div className="fit-mock-drawer-list">
                        {drawerItems.map((component) => {
                          const detail = compatStats[component.id];
                          const installed = usesGroupedCompatibility && selectedWeaponSelection
                            ? selectedWeaponSelection.childRows.every((row) => (
                              canonicalFittingId(row.equippedComponentKey) === canonicalFittingId(component.id)
                            ))
                            : canonicalFittingId(selectedRow.equippedComponentKey) === canonicalFittingId(component.id);
                          const stats = itemPrimaryStats(component, detail);
                          return (
                            <div
                              key={component.id}
                              role="button"
                              tabIndex={0}
                              className={["fit-mock-compat-row", installed ? "is-installed" : ""].filter(Boolean).join(" ")}
                              onClick={() => { void installComponent(component.id); }}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ") return;
                                event.preventDefault();
                                void installComponent(component.id);
                              }}
                            >
                              <span className="fit-mock-compat-action-wrap">
                                <button
                                  type="button"
                                  className="fit-mock-compat-action"
                                  aria-label={`Open crafting details for ${component.displayName || component.name}`}
                                  title={`Open crafting details for ${component.displayName || component.name}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void openComponentDetails(component.id);
                                  }}
                                >
                                  <Icon><path d="M5 7h14M5 12h14M5 17h14" /></Icon>
                                </button>
                                <span className="fit-mock-compat-icon" aria-hidden>
                                  <FittingSlotIconImage src={getFittingSlotIcon({
                                    slotKind: drawerItemKind === "weapon" ? "weapon hardpoint" : "component slot",
                                    componentType: component.type,
                                    itemType: component.subtype,
                                  })} />
                                </span>
                              </span>
                              <span className="fit-mock-compat-main">
                                <strong>{component.displayName || component.name}</strong>
                                <span className="fit-mock-compat-meta">{componentStatSummary(component)}</span>
                              </span>
                              <span className="fit-mock-compat-stats">
                                {stats.map((stat) => (
                                  <span key={`${component.id}-${stat.label}`}>
                                    <em>{stat.label}</em>
                                    <strong>{stat.value}</strong>
                                  </span>
                                ))}
                                {installed ? <span className="fit-mock-compat-installed">Installed</span> : null}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </aside>
                ) : null}
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
                      <strong className="fit-mock-ribbon-hero-value">{formatAlphaWithDps(combatStats.pilotAlpha, combatStats.pilotDps, combatStats.loading)}</strong>
                    </div>
                  </div>
                  <div className="fit-mock-ribbon-rows">
                    <div className="fit-mock-ribbon-row">
                      <span className="fit-mock-ribbon-row-label"><RibbonRowIcon kind="gimbal" /> Turret Alpha</span>
                      <strong>{combatStats.turretAlpha != null ? formatAlphaWithDps(combatStats.turretAlpha, combatStats.turretDps, combatStats.loading) : "Not applicable"}</strong>
                    </div>
                    <div className={["fit-mock-ribbon-row", combatStats.crewAlpha == null ? "is-muted" : ""].filter(Boolean).join(" ")}>
                      <span className="fit-mock-ribbon-row-label"><RibbonRowIcon kind="crew" /> Crew Alpha</span>
                      {combatStats.crewAlpha != null ? <strong>{formatAlphaWithDps(combatStats.crewAlpha, combatStats.crewDps, combatStats.loading)}</strong> : <em>Not applicable</em>}
                    </div>
                  </div>
                </section>

                <section className="summary-section summary-section--shields">
                  <h3><RibbonSectionIcon kind="shields" /> Shields</h3>
                  <div className="fit-mock-ribbon-split">
                    <ShieldRing variant="bubble" />
                    <div className="fit-mock-ribbon-shield-copy">
                      <span className="fit-mock-ribbon-kicker">{shieldLabel ?? "Shield Generator"}</span>
                      <strong className="fit-mock-ribbon-hero">{valueOrUnavailable(shieldHp)} <small>HP</small></strong>
                      <span className="fit-mock-ribbon-sub"><RibbonRowIcon kind="regen" /> Regen: {valueOrUnavailable(shieldRegen, "/s")}</span>
                    </div>
                  </div>
                </section>

                <section className="summary-section summary-section--hp">
                  <h3><RibbonSectionIcon kind="hp" /> HP</h3>
                  <div className="fit-mock-ribbon-rows">
                    <div className="fit-mock-ribbon-row"><span>Vital HP</span><strong>{valueOrUnavailable(hpSummary.vitalHp, " HP")}</strong></div>
                    <div className="fit-mock-ribbon-row"><span>Total HP</span><strong>{valueOrUnavailable(hpSummary.totalHp, " HP")}</strong></div>
                    <div className="fit-mock-ribbon-row"><span>Armor HP</span><strong>{valueOrUnavailable(hpSummary.armorHp, " HP")}</strong></div>
                  </div>
                </section>

                <section className="summary-section summary-section--cargo">
                  <h3><RibbonSectionIcon kind="cargo" /> Cargo</h3>
                  <div className="fit-mock-ribbon-rows">
                    <div className="fit-mock-ribbon-row"><span>Cargo Grid</span><strong>{cargoScu != null ? `${formatNumber(cargoScu)} SCU` : "Not available"}</strong></div>
                  </div>
                </section>
              </div>

              <div className="fit-mock-readout-grid">
                <ReadoutCard title="Survivability">
                  <ReadoutBlock title="Vital">
                    <ReadoutRow label="Vital HP" value={valueOrUnavailable(hpSummary.vitalHp, " HP")} tone="accent" />
                    <ReadoutRow label="Total HP" value={valueOrUnavailable(hpSummary.totalHp, " HP")} tone="accent" />
                    <ReadoutRow label="Armor HP" value={valueOrUnavailable(hpSummary.armorHp, " HP")} />
                  </ReadoutBlock>
                  <ReadoutBlock title="Shields">
                    <ReadoutRow label="Shield HP" value={valueOrUnavailable(shieldHp, " HP")} tone="accent" />
                    <ReadoutRow label="Regen" value={valueOrUnavailable(shieldRegen, "/s")} />
                  </ReadoutBlock>
                </ReadoutCard>

                <ReadoutCard title="Storage & Endurance">
                  <ReadoutBlock title="Cargo">
                    <ReadoutRow label="Cargo Grid" value={cargoScu != null ? `${formatNumber(cargoScu)} SCU` : "Not available"} tone="accent" />
                    <ReadoutRow label="Grid Dimensions" value="Source unavailable" tone="muted" />
                  </ReadoutBlock>
                  <ReadoutBlock title="Resources">
                    <ReadoutRow label="Power Produced" value={valueOrUnavailable(powerProduced, " MW")} />
                    <ReadoutRow label="Power Required" value={valueOrUnavailable(powerRequired, " MW")} />
                    <ReadoutRow label="Cooling Produced" value={valueOrUnavailable(coolingProduced)} />
                    <ReadoutRow label="Cooling Required" value={valueOrUnavailable(coolingRequired)} />
                  </ReadoutBlock>
                </ReadoutCard>

                <ReadoutCard title="Flight Performance">
                  <ReadoutBlock title="Speeds">
                    <ReadoutRow label="SCM / AB" value={scmSpeed != null && boostSpeed != null ? `${formatNumber(scmSpeed)} / ${formatNumber(boostSpeed)} m/s` : valueOrUnavailable(scmSpeed, " m/s")} tone="accent" />
                    <ReadoutRow label="Nav" value={valueOrUnavailable(maxSpeed, " m/s")} tone="accent" />
                  </ReadoutBlock>
                  <ReadoutBlock title="Rotation">
                    <ReadoutRow label="P / Y / R" value={[pitch, yaw, roll].every((v) => v != null) ? `${formatNumber(pitch!)} / ${formatNumber(yaw!)} / ${formatNumber(roll!)} °/s` : "Not calculated yet"} />
                  </ReadoutBlock>
                  <ReadoutBlock title="Boost">
                    <ReadoutRow label="Boost Capacity / Regen" value={boostCapacity != null || boostRegen != null ? `${boostCapacity != null ? formatNumber(boostCapacity) : "—"} / ${boostRegen != null ? formatNumber(boostRegen) : "—"}` : "Not calculated yet"} tone="muted" />
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
            {supportGroups.map((group) => (
              <section key={group.key} className="fit-mock-group">
                <div className="fit-mock-group-head">
                  <span className="fit-mock-group-head-icon" aria-hidden>
                    <FittingSlotIconImage src={iconForSupportGroup(group.rows)} />
                  </span>
                  <h3>{group.label}</h3>
                  <span>{group.rows.length}</span>
                </div>
                {group.rows.map((row) => (
                  <SupportRow key={row.portId} row={row} selected={loadout.selectedPortId === row.portId} onSelect={() => selectPort(row.portId)} />
                ))}
              </section>
            ))}
            {supportGroups.length === 0 && !loadout.loading ? <p className="fit-mock-empty">No defensive systems loaded.</p> : null}
          </div>

          <section className={`fit-mock-selected-panel${weaponStatsOpen ? " is-stats-open" : ""}`}>
            <header className="fit-mock-selected-head">
              <span className="fit-mock-selected-kicker">Selected Slot</span>
              <h3>{selectedWeaponSelection ? mockupDrawerSlotLabel(selectedWeaponSelection) : selectedRow ? mockupSlotLabel(selectedRow) : "No slot selected"}</h3>
            </header>

            {selectedRow ? (
              <article className="fit-mock-installed-card">
                <span className="fit-mock-installed-thumb" aria-hidden>
                  <FittingSlotIconImage src={drawerIconSrc} />
                </span>
                <div className="fit-mock-installed-body">
                  <div className="fit-mock-installed-title-row">
                    <strong>{mockupComponentTitle(selectedRow)}</strong>
                    <span className="fit-mock-selected-badge">Installed</span>
                  </div>
                  <ul className="fit-mock-installed-facts">
                    <li><span>Slot: {drawerCompatibleLabel}</span></li>
                    <li><span>{supportTypeLabel(selectedRow)}</span></li>
                    {selectedRow.componentSize != null ? <li><span>Size {selectedRow.componentSize}</span></li> : null}
                    {powerLabel && groupContainsPort(loadout.resourceGroups.powerPlants, selectedRow.portId) ? <li><span>{powerLabel}</span></li> : null}
                    {drawerMessage ? <li><span>{drawerMessage}</span></li> : null}
                    {installedDetailStats.map((stat) => (
                      <li key={`selected-${stat.label}`}><span>{stat.label}: {stat.value}</span></li>
                    ))}
                  </ul>
                </div>
              </article>
            ) : null}

            <button type="button" className={["fit-mock-weapon-stats-btn", weaponStatsOpen ? "is-open" : ""].filter(Boolean).join(" ")} onClick={() => setWeaponStatsOpen((v) => !v)} aria-expanded={weaponStatsOpen} disabled={!selectedRow}>
              Component Stats
              <Icon><path d={weaponStatsOpen ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} /></Icon>
            </button>
            {weaponStatsOpen ? <ComponentStatsDrawer detail={selectedDetail} loading={detailLoading} /> : null}
          </section>
        </aside>
      </div>
    </div>
  );
}

function groupContainsPort(rows: PortBreakdownRow[], portId: string): boolean {
  return rows.some((row) => row.portId === portId);
}
