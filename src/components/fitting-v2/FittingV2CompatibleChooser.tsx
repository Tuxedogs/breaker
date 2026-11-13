import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FittingComponentDetail, FittingComponentSummary } from "../../lib/fitting/fittingApi";
import type { FittingV2Target } from "../../lib/fitting-v2/fittingV2SlotTopology";

type Column = { label: string; value: (item: FittingComponentSummary, detail: FittingComponentDetail | null) => string | null };
type Props = {
  target: FittingV2Target;
  candidates: FittingComponentSummary[];
  detailsById: Record<string, FittingComponentDetail | null>;
  detailsLoading: boolean;
  error: string | null;
  installingId: string | null;
  anchor: HTMLElement | null;
  onClose: () => void;
  onOutsideClose: () => void;
  onInstall: (item: FittingComponentSummary) => void;
};

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const displayed = (value: number | null | undefined, unit = "") => typeof value === "number" && Number.isFinite(value) ? `${number.format(value)}${unit ? ` ${unit}` : ""}` : null;
const normal = (label: string, get: (detail: FittingComponentDetail) => number | null | undefined, unit = ""): Column => ({ label, value: (_item, detail) => detail ? displayed(get(detail), unit) : null });
const identity: Column[] = [
  { label: "Name", value: (item) => item.displayName || item.name },
  { label: "Class", value: (item) => item.class },
  { label: "Grade", value: (item) => item.grade },
];
const health = normal("HP", (detail) => detail.stats.health, "HP");

function columnsFor(target: FittingV2Target): Column[] {
  const type = `${target.constraint.type ?? ""} ${target.constraint.subtype ?? ""}`.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (target.tab === "weapons") return [
    { label: "Name", value: (item) => item.displayName || item.name }, normal("Alpha", (d) => d.stats.alphaDamage), normal("Burst", (d) => d.stats.dps, "DPS"), normal("Sustained DPS", (d) => d.stats.sustainedDps60, "DPS"), normal("RPM", (d) => d.stats.fireRateRpm), normal("Pen", (d) => d.stats.penetrationNearRadius, "m"), normal("Speed", (d) => d.stats.projectileSpeed, "m/s"), normal("Range", (d) => d.stats.calculatedRange ?? d.stats.projectileMaxTravel, "m"), normal("Spread", (d) => d.stats.spreadMax, "°"), normal("Power", (d) => d.stats.powerUsage ?? d.stats.powerDraw), health,
  ];
  if (target.tab === "missiles") return [
    { label: "Name", value: (item) => item.displayName || item.name }, { label: "Type", value: (item) => item.type.replace(/_/g, " ") },
    normal("Alpha", (d) => d.stats.alphaDamage), normal("Speed", (d) => d.stats.linearSpeed ?? d.stats.projectileSpeed, "m/s"), normal("Range", (d) => d.stats.lockRangeMax ?? d.stats.calculatedRange, "m"),
    { label: "Tracking", value: (_item, d) => d?.ordnance?.kind === "missile" ? d.ordnance.trackingSignalType : null }, health,
  ];
  if (type.includes("powerplant")) return [...identity, normal("Power Max", (d) => d.stats.powerGenerated), normal("EM Max", (d) => d.stats.electromagneticEmission ?? d.stats.emSignatureNominal), health];
  if (type.includes("cooler")) return [...identity, normal("Cooling Capacity", (d) => d.stats.coolingGenerated), normal("Min Power", (d) => d.stats.powerInputMinimum ?? d.stats.powerConsumptionMinimum), normal("Max Power", (d) => d.stats.powerInputMaximum ?? d.stats.powerDraw), health];
  if (type.includes("radar")) return [...identity, normal("Min Power", (d) => d.stats.powerInputMinimum), normal("Max Power", (d) => d.stats.powerInputMaximum ?? d.stats.powerDraw), normal("EM Max", (d) => d.stats.electromagneticEmission ?? d.stats.emSignatureNominal), health];
  if (type.includes("shield")) return [...identity, normal("HP Pool", (d) => d.mitigation?.kind === "shield" ? d.mitigation.shieldHp ?? d.mitigation.maxShieldHealth : d.stats.shieldHp, "HP"), normal("Max Regen", (d) => d.mitigation?.kind === "shield" ? d.mitigation.maxShieldRegen : d.stats.regenRate, "HP/s"), normal("Damaged Delay", (d) => d.mitigation?.kind === "shield" ? d.mitigation.damagedRegenDelay : null, "s"), normal("Downed Delay", (d) => d.mitigation?.kind === "shield" ? d.mitigation.downedRegenDelay : null, "s"), normal("Min Power", (d) => d.stats.powerInputMinimum), normal("Max Power", (d) => d.stats.powerInputMaximum ?? d.stats.powerDraw), health];
  if (type.includes("quantumdrive")) return [...identity, normal("Max Speed", (d) => d.stats.quantumSpeed, "m/s"), normal("Spool", (d) => d.stats.spoolTime, "s"), normal("Cooldown", (d) => d.stats.quantumCooldown, "s"), normal("Consumption", (d) => d.stats.quantumFuelRequirement ?? d.stats.fuelRate), health];
  return [...identity, normal("Power", (d) => d.stats.powerDraw ?? d.stats.powerUsage), health];
}

function priorityColumnIndexes(target: FittingV2Target): Set<number> {
  if (target.tab === "weapons") return new Set([0, 1, 2]);
  if (target.tab === "missiles") return new Set([0, 2, 3]);
  return new Set([0, 3, 4]);
}

export default function FittingV2CompatibleChooser(props: Props) {
  const { anchor, onClose, onOutsideClose } = props;
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<{ left: number; top: number; placement: "below" | "above" } | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const columns = useMemo(() => columnsFor(props.target), [props.target]);
  const priorityColumns = useMemo(() => priorityColumnIndexes(props.target), [props.target]);
  const candidates = useMemo(() => props.candidates.filter((item) => !/^\s*<={1,2}\s*placeholder/i.test(item.displayName || item.name)).filter((item) => (item.displayName || item.name).toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name)), [props.candidates, query]);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const place = () => {
      const anchorRect = anchor.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const gap = 6;
      const margin = 8;
      const left = Math.max(margin, Math.min(anchorRect.right - panelRect.width, window.innerWidth - panelRect.width - margin));
      const below = anchorRect.bottom + gap;
      const above = anchorRect.top - panelRect.height - gap;
      const top = below + panelRect.height <= window.innerHeight - margin || above < margin ? below : above;
      setPosition({ left, top: Math.max(margin, top), placement: top === below ? "below" : "above" });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(anchor);
    window.addEventListener("resize", place);
    return () => { observer.disconnect(); window.removeEventListener("resize", place); };
  }, [anchor, candidates.length]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    const outside = (event: PointerEvent) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      if ((event.target as Element | null)?.closest(".fitv2-topology-slot")) return;
      event.preventDefault();
      event.stopPropagation();
      onOutsideClose();
    };
    window.addEventListener("keydown", close);
    document.addEventListener("pointerdown", outside, true);
    return () => { window.removeEventListener("keydown", close); document.removeEventListener("pointerdown", outside, true); };
  }, [anchor, onClose, onOutsideClose]);
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previous = { rootOverflow: root.style.overflow, bodyOverflow: body.style.overflow, bodyPaddingRight: body.style.paddingRight };
    const scrollbarWidth = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      root.style.overflow = previous.rootOverflow;
      body.style.overflow = previous.bodyOverflow;
      body.style.paddingRight = previous.bodyPaddingRight;
    };
  }, []);
  return <section ref={panelRef} className={`fitv2-chooser is-entering is-${position?.placement ?? "below"}`} role="dialog" aria-label="Compatible item chooser" style={position ? { left: position.left, top: position.top } : { visibility: "hidden" }}>
      <header><label className="fitv2-chooser-search"><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" /></label><button type="button" className="fitv2-chooser-close" onClick={props.onClose} aria-label="Close compatible item chooser">×</button></header>
      {props.error ? <p className="fitv2-chooser-error">{props.error}</p> : null}
      <div className="fitv2-chooser-scroll"><table><thead><tr>{columns.map((column) => <th key={column.label}>{column.label}</th>)}</tr></thead><tbody>{candidates.map((item) => { const current = item.id === props.target.installedComponentId; const disabled = Boolean(props.installingId) || current; const detail = props.detailsById[item.id] ?? null; const install = () => { if (!disabled) props.onInstall(item); }; return <tr key={item.id} className={`${current ? "is-current " : ""}${disabled ? "is-disabled" : "is-actionable"}`} tabIndex={disabled ? -1 : 0} role="button" aria-label={`Install ${item.displayName || item.name}`} aria-disabled={disabled} onClick={install} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && !disabled) { event.preventDefault(); install(); } }}><td className={priorityColumns.has(0) ? "is-priority" : undefined}>{item.displayName || item.name}{current ? <small>Current</small> : null}</td>{columns.slice(1).map((column, index) => <td className={priorityColumns.has(index + 1) ? "is-priority" : undefined} key={column.label}>{column.value(item, detail) ?? <span className="fitv2-chooser-unavailable">—</span>}</td>)}</tr>; })}</tbody></table></div>
    </section>;
}
