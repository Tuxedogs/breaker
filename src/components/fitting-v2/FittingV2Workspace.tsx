import { useEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import PowerPipIcon from "../fitting/terminal/PowerPipIcons";
import PowerTower from "./PowerTower";
import MfdPowerIcon from "./MfdPowerIcon";
import type { ShipHeroAssetView } from "../../lib/fitting/mockup/fittingMockupViewTypes";
import type { FittingShipSummary } from "../../lib/fitting/fittingPortGrouping";
import type { PipAssignment, PipCategory } from "../../lib/fitting/fittingTerminalTypes";
import type { PipSystemPowerDraw } from "../../lib/fitting/fittingPipPower";
import type { FittingSimulationState } from "../../lib/fitting/useFittingSimulation";
import { deriveDisplayManufacturer } from "../../lib/fitting/mockup/fittingMockupShipResolve";
import CommandHeader from "../shared/CommandHeader";
import FittingV2Inspector, { type FittingV2SelectedTarget } from "./FittingV2Inspector";
import type { FittingCompatibleComponentsResult, FittingComponentDetail, FittingSimulationCategoryAllocationMetadata, FittingComponentAllocation, FittingAggregateGeneration } from "../../lib/fitting/fittingApi";
import type { PortBreakdownRow } from "../../lib/fitting/fittingPortGrouping";
import {
  FITTING_V2_PIP_LABELS,
  buildFittingV2PowerPipPresentation,
  type FittingV2Effect,
  type FittingV2Metric,
} from "../../lib/fitting-v2/fittingV2Presentation";
import type { FittingV2SlotNode, FittingV2SlotTopology } from "../../lib/fitting-v2/fittingV2SlotTopology";
import { buildFittingV2PowerColumns, type FittingV2PowerColumn } from "../../lib/fitting-v2/fittingV2PowerColumns";

type Props = {
  ships: FittingShipSummary[];
  shipsLoading: boolean;
  selectedShipKey: string | null;
  ship: FittingShipSummary | null;
  loadoutModified: boolean;
  loading: boolean;
  error: boolean;
  heroAsset: ShipHeroAssetView;
  performanceMetrics: FittingV2Metric[];
  topology: FittingV2SlotTopology;
  pipAssignment: PipAssignment;
  pipDraws: PipSystemPowerDraw;
  pipReady: boolean;
  simulation: FittingSimulationState;
  effects: FittingV2Effect[];
  portRows: PortBreakdownRow[];
  componentAllocations?: readonly FittingComponentAllocation[];
  powerAggregateGeneration?: FittingAggregateGeneration;
  detailsById: Record<string, FittingComponentDetail | null>;
  selectedTarget: FittingV2SelectedTarget | null;
  compatible: FittingCompatibleComponentsResult | null;
  compatibilityLoading: boolean;
  compatibilityError: boolean;
  onSelectShip: (shipKey: string) => void;
  onPipChange: (category: PipCategory, value: number, bounds?: { minimum: number | null; maximum: number | null }) => void;
  onSelectTarget: (target: FittingV2SelectedTarget, anchor: HTMLButtonElement) => void;
};

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
function formatValue(value: number, unit: string): string {
  return `${numberFormat.format(value)}${unit ? ` ${unit}` : ""}`;
}

function metricByKey(metrics: FittingV2Metric[], key: string): FittingV2Metric | undefined {
  return metrics.find((metric) => metric.key === key);
}

function ShipInspectionCanvas({ asset, name }: { asset: ShipHeroAssetView; name: string }) {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [viewport, setViewport] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startClientX: number; startClientY: number; startX: number; startY: number } | null>(null);
  const usesPerseusCutout = /\bperseus\b/i.test(name);
  const candidates = usesPerseusCutout
    ? [{ src: "/images/fitting-v2/perseus-mid-deck-top-down.webp", alt: "Perseus mid-deck top-down cutout" }, ...asset.candidates]
    : asset.candidates;
  const candidate = candidates[candidateIndex];
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = viewer.getBoundingClientRect();
      const pointerX = event.clientX - bounds.left;
      const pointerY = event.clientY - bounds.top;
      setViewport((previous) => {
        const nextScale = Math.min(2.4, Math.max(0.72, previous.scale * (event.deltaY < 0 ? 1.12 : 0.9)));
        const ratio = nextScale / previous.scale;
        return { scale: nextScale, x: pointerX - (pointerX - previous.x) * ratio, y: pointerY - (pointerY - previous.y) * ratio };
      });
    };

    viewer.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewer.removeEventListener("wheel", handleWheel);
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startX: viewport.x, startY: viewport.y };
    setIsDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setViewport((previous) => ({ ...previous, x: drag.startX + event.clientX - drag.startClientX, y: drag.startY + event.clientY - drag.startClientY }));
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setIsDragging(false);
  };

  if (!candidate) {
    return <div className="fitv2-ship-fallback" role="img" aria-label={`${name} image unavailable`}><span>{name}</span></div>;
  }
  return <div ref={viewerRef} className={`fitv2-ship-interaction${isDragging ? " is-dragging" : ""}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
    <div className="fitv2-ship-transform" style={{ transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})` }}>
      <img className="fitv2-ship-image" src={candidate.src} alt={candidate.alt} draggable={false} onError={usesPerseusCutout ? undefined : () => setCandidateIndex((index) => index + 1)} />
      <div className="fitv2-system-callout is-power"><span>Power plant</span></div>
      <div className="fitv2-system-callout is-shields"><span>Shields</span></div>
      <div className="fitv2-system-callout is-weapons"><span>Weapons</span></div>
      <div className="fitv2-system-callout is-quantum"><span>Quantum drive</span></div>
    </div>
  </div>;
}

function Delta({ metric }: { metric: FittingV2Metric }) {
  if (metric.delta == null) return null;
  const sign = metric.delta >= 0 ? "+" : "";
  return <span className={`fitv2-delta is-${metric.deltaTone}`}>({sign}{numberFormat.format(metric.delta)}{metric.unit ? ` ${metric.unit}` : ""})</span>;
}

function InsightBar({ value, max, tone = "normal" }: { value: number; max: number; tone?: "normal" | "danger" }) {
  const width = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return <span className={`fitv2-insight-bar is-${tone}`}><i style={{ width: `${width}%` }} /></span>;
}

function SlotRow({ slot, selectedTarget, onSelectTarget }: { slot: FittingV2SlotNode; selectedTarget: FittingV2SelectedTarget | null; onSelectTarget: (target: FittingV2SelectedTarget, anchor: HTMLButtonElement) => void }) {
  const selected = selectedTarget?.portId === slot.target.portId;
  const state = slot.target.replacement === "informational" ? "Informational" : slot.state.replaceAll("-", " ");
  return <button type="button" className={`fitv2-topology-slot is-${slot.state}${selected ? " is-selected" : ""}`} onClick={(event: MouseEvent<HTMLButtonElement>) => onSelectTarget(slot.target, event.currentTarget)}>
    <span className="fitv2-topology-slot-label">{slot.label}</span>
    <strong>{slot.installedName ?? "Empty slot"}</strong>
    <small>{slot.installedSize != null ? `Size ${slot.installedSize}` : "Size unavailable"}{slot.context.length ? ` · ${slot.context.join(" · ")}` : ""}</small>
    <em>{state}</em>
  </button>;
}

function TopologyBrowser({ topology, selectedTarget, onSelectTarget }: { topology: FittingV2SlotTopology; selectedTarget: FittingV2SelectedTarget | null; onSelectTarget: (target: FittingV2SelectedTarget, anchor: HTMLButtonElement) => void }) {
  const [activeTab, setActiveTab] = useState<string>(() => topology.tabs[0]?.tab ?? "components");
  const active = topology.tabs.find((tab) => tab.tab === activeTab) ?? topology.tabs[0];
  if (!active) return <section className="fitv2-component-stack"><p className="fitv2-empty">No fitting slots are available for this ship.</p></section>;
  return <section className="fitv2-component-stack fitv2-topology-browser" aria-label="Fitting slots">
    <header className="fitv2-panel-tabs"><nav aria-label="Fitting categories">{topology.tabs.map((tab) => <button type="button" className={active.tab === tab.tab ? "is-active" : ""} key={tab.tab} onClick={() => setActiveTab(tab.tab)}>{tab.label}</button>)}</nav><span>{active.tab === "components" ? "Physical systems" : "Topology"}</span></header>
    <div className="fitv2-topology-content">
      {active.tab === "components" ? active.sections.map((section) => <section className="fitv2-topology-section" key={section.key}><h3>{section.label}</h3>{section.slots.map((slot) => <SlotRow key={slot.key} slot={slot} selectedTarget={selectedTarget} onSelectTarget={onSelectTarget} />)}</section>) : null}
      {active.tab === "weapons" ? active.assemblies.map((assembly) => <section className="fitv2-topology-section" key={assembly.key}><h3>{assembly.label}</h3>{assembly.context.length ? <p className="fitv2-topology-context">{assembly.context.join(" · ")}</p> : null}{assembly.slots.map((slot) => <SlotRow key={slot.key} slot={slot} selectedTarget={selectedTarget} onSelectTarget={onSelectTarget} />)}</section>) : null}
      {active.tab === "missiles" ? active.racks.map((rack) => <section className="fitv2-topology-section" key={rack.key}><h3>{rack.label}</h3><p className="fitv2-topology-context">{rack.payloadCount} × {rack.payload.installedSize != null ? `Size ${rack.payload.installedSize}` : "payload"} payload slots</p><SlotRow slot={{ ...rack.payload, installedName: rack.mixedPayload ? "Mixed payloads" : rack.payload.installedName, label: "Payload" }} selectedTarget={selectedTarget} onSelectTarget={onSelectTarget} /></section>) : null}
      {active.tab === "special" ? active.assemblies.map((assembly) => <section className="fitv2-topology-section" key={assembly.key}><h3>{assembly.label}</h3><SlotRow slot={assembly.root} selectedTarget={selectedTarget} onSelectTarget={onSelectTarget} />{assembly.children.map((slot) => <SlotRow key={slot.key} slot={slot} selectedTarget={selectedTarget} onSelectTarget={onSelectTarget} />)}</section>) : null}
    </div>
  </section>;
}

function PerformanceBand({ metrics }: { metrics: FittingV2Metric[] }) {
  const groups = [
    { label: "Flight", keys: ["pitch", "yaw", "roll", "scm", "max-speed", "boost-speed"] },
    { label: "Defense", keys: ["hull-hp", "shield-hp", "shield-regen"] },
    { label: "Resources", keys: ["cargo"] },
    { label: "Systems", keys: ["power-generation", "power-demand", "cooling", "weapon-alpha"] },
  ].map((group) => ({ ...group, metrics: group.keys.map((key) => metricByKey(metrics, key)).filter((metric): metric is FittingV2Metric => Boolean(metric)) })).filter((group) => group.metrics.length > 0);
  return (
    <section className="fitv2-performance" aria-labelledby="fitv2-performance-title">
      <header><h2 id="fitv2-performance-title">Current performance</h2><span>Resulting value · delta from stock</span></header>
      <div className="fitv2-performance-list">
        {groups.length > 0 ? groups.map((group) => (
          <section className="fitv2-performance-group" key={group.label}><h3>{group.label}</h3><div>{group.metrics.map((metric) => (
            <div className="fitv2-performance-item" key={metric.key}><span>{metric.label}</span><strong>{formatValue(metric.value, metric.unit)}</strong><Delta metric={metric} /></div>
          ))}</div></section>
        )) : <p className="fitv2-empty">Performance values are unavailable for this ship.</p>}
      </div>
    </section>
  );
}

function PipColumn({ category, value, metadata, minimumSegments, maximumSegments, unavailableReason, onChange }: { category: PipCategory; value: number; metadata: FittingSimulationCategoryAllocationMetadata | undefined; minimumSegments?: number | null; maximumSegments?: number | null; unavailableReason?: string | null; onChange: (category: PipCategory, value: number, bounds?: { minimum: number | null; maximum: number | null }) => void }) {
  const presentation = buildFittingV2PowerPipPresentation(metadata);
  const maximum = maximumSegments ?? presentation.maximumSegments;
  const minimum = minimumSegments ?? presentation.minimumSegments;
  const hasPhysicalBounds = maximumSegments != null && Number.isInteger(maximumSegments) && maximumSegments > 0;
  const hasBoundedMaximum = (hasPhysicalBounds || presentation.addressability === "selectable-pips") && maximum != null && Number.isInteger(maximum) && maximum > 0;
  const compactState = presentation.addressability === "non-pip-unit"
    ? `${presentation.unitType ?? "Input"} · Non-pip`
    : presentation.addressability === "distribution-unresolved"
      ? "Distribution unresolved"
      : presentation.addressability === "component-family-missing"
        ? "Dataset unavailable"
        : presentation.addressability === "bounds-unavailable"
          ? "Bounds unavailable"
          : "Allocation unavailable";
  const unavailableTitle = presentation.unavailableReason ?? compactState;
  return <PowerTower
    label={FITTING_V2_PIP_LABELS[category]}
    maxPips={hasBoundedMaximum ? maximum : 6}
    minPips={hasBoundedMaximum && minimum != null && Number.isInteger(minimum) ? Math.max(0, minimum) : 0}
    allocation={value}
    exactPips={presentation.addressability === "selectable-pips" ? presentation.exactSegments : []}
    available={hasBoundedMaximum && !unavailableReason}
    interactive={hasBoundedMaximum && !unavailableReason}
    unavailableReason={unavailableReason ?? unavailableTitle}
    onRequestAllocation={(allocation) => onChange(category, allocation, { minimum, maximum })}
  />;
}

function PipTower({ column, assignment, draws, totalDraw, ready, simulation, onChange }: { column: FittingV2PowerColumn; assignment: PipAssignment; draws: PipSystemPowerDraw; totalDraw: number; ready: boolean; simulation: FittingSimulationState; onChange: (category: PipCategory, value: number, bounds?: { minimum: number | null; maximum: number | null }) => void }) {
  const category = column.category;
  const categoryDraw = category ? draws[category] : 0;
  const percentage = totalDraw > 0 ? (categoryDraw / totalDraw) * 100 : null;
  const powered = category ? assignment[category] > 0 : false;
  const presentation = category ? buildFittingV2PowerPipPresentation(simulation.data?.power.categories?.[category]) : null;
  const minimum = column.minimumSegments ?? presentation?.minimumSegments;
  const maximum = column.maximumSegments ?? presentation?.maximumSegments;
  const firstPoweredSegment = presentation?.exactSegments.find((segment) => Number.isInteger(segment) && segment > 0) ?? 1;
  const hasPhysicalBounds = column.maximumSegments != null && Number.isInteger(column.maximumSegments) && column.maximumSegments > 0;
  const minimumTarget = (hasPhysicalBounds || presentation?.addressability === "selectable-pips") && maximum != null
    ? minimum != null && Number.isInteger(minimum) && minimum > 0 ? minimum : firstPoweredSegment
    : null;
  const canToggle = category !== null && column.unavailableReason === null && minimumTarget !== null && minimumTarget <= maximum!;
  const togglePower = () => { if (category && canToggle) onChange(category, powered ? 0 : minimumTarget!, { minimum: minimum ?? null, maximum: maximum ?? null }); };
  return (
    <article className={`fitv2-pip-tower ${powered ? "is-powered" : "is-unpowered"}`} aria-label={`${column.label} power allocation`} data-port-id={column.portId ?? undefined} title={column.label}>
      <div className="fitv2-pip-stack-group">
        {category ? <PipColumn category={category} value={assignment[category]} metadata={simulation.data?.power.categories?.[category]} minimumSegments={column.minimumSegments} maximumSegments={column.maximumSegments} unavailableReason={column.unavailableReason} onChange={onChange} /> : <PowerTower label={column.label} maxPips={6} minPips={0} allocation={0} available={false} interactive={false} unavailableReason={column.unavailableReason} onRequestAllocation={() => undefined} />}
      </div>
      <button type="button" className="fitv2-pip-icon-button" aria-label={powered ? `Power off ${column.label}` : `Power ${column.label} to minimum`} disabled={!canToggle} onClick={togglePower}>
        <MfdPowerIcon kind={column.icon} className={`fitv2-pip-icon is-${column.icon}`} />
      </button>
      <em>{ready && category && percentage != null ? `${numberFormat.format(percentage)}%` : "—"}</em>
    </article>
  );
}

function LiveEffects({ effects, loading }: { effects: FittingV2Effect[]; loading: boolean }) {
  const available = effects.filter((effect) => effect.value != null);
  const unavailable = effects.length - available.length;
  return (
    <aside className="fitv2-live-effects" aria-labelledby="fitv2-effects-title">
      <h3 id="fitv2-effects-title">Live effects</h3>
      <div className="fitv2-effect-list">
        {available.map((effect) => <div className="fitv2-effect-row" key={effect.key}><span>{effect.label}</span><strong>{loading ? "Updating…" : formatValue(effect.value!, effect.unit)}</strong></div>)}
        {available.length === 0 ? <span className="fitv2-effects-empty">Unavailable for this ship</span> : null}
        {available.length > 0 && unavailable > 0 ? <small>{unavailable} unavailable</small> : null}
      </div>
    </aside>
  );
}

function PowerDock({ aggregate, allocatedPips }: { aggregate?: FittingAggregateGeneration; allocatedPips: number }) {
  const remaining = aggregate?.available && aggregate.status === "direct_source_single_plant" && aggregate.generation != null
    ? Math.max(0, aggregate.generation - allocatedPips)
    : null;
  const output = remaining == null ? "— / —" : `${numberFormat.format(remaining)} / ${numberFormat.format(aggregate!.generation!)}`;
  const reason = remaining == null
    ? aggregate?.reason ?? "Aggregate generation is unavailable from the current source-backed contract."
    : `${numberFormat.format(remaining)} of ${numberFormat.format(aggregate!.generation!)} pips remain unassigned.`;
  return <div className="fitv2-power-dock" title={reason}>
    <img src="/images/fitting-v2/mfd/MFD-dock-output-battery.svg" alt="OUTPUT and BATTERY dock" />
    <strong className="fitv2-dock-output-value">{output}</strong>
  </div>;
}

function PowerSection({ assignment, draws, ready, simulation, effects, portRows, componentAllocations, powerAggregateGeneration, onChange }: { assignment: PipAssignment; draws: PipSystemPowerDraw; ready: boolean; simulation: FittingSimulationState; effects: FittingV2Effect[]; portRows: PortBreakdownRow[]; componentAllocations: readonly FittingComponentAllocation[]; powerAggregateGeneration?: FittingAggregateGeneration; onChange: (category: PipCategory, value: number, bounds?: { minimum: number | null; maximum: number | null }) => void }) {
  const totalDraw = Object.values(draws).reduce((total, value) => total + value, 0);
  const allocatedPips = Object.values(assignment).reduce((total, value) => total + value, 0);
  const columns = buildFittingV2PowerColumns(portRows, simulation.data?.power.allocatedByCategory, componentAllocations);
  return (
    <section className="fitv2-power" aria-labelledby="fitv2-power-title">
      <header className="fitv2-power-heading">
        <div><span>Power systems</span><h2 id="fitv2-power-title">Power allocation</h2></div>
      </header>
      {simulation.error ? <p className="fitv2-power-notice">Simulation unavailable: {simulation.error}</p> : null}
      <div className="fitv2-power-console">
        <div className="fitv2-power-stage">
          <img className="fitv2-signature-dock" src="/images/fitting-v2/mfd/signature-dock.svg" alt="" />
          <PowerDock aggregate={powerAggregateGeneration} allocatedPips={allocatedPips} />
          <div className="fitv2-pip-grid fitv2-pip-stackl">{columns.map((column) => <PipTower key={column.key} column={column} assignment={assignment} draws={draws} totalDraw={totalDraw} ready={ready} simulation={simulation} onChange={onChange} />)}</div>
        </div>
        <LiveEffects effects={effects} loading={simulation.loading} />
      </div>
    </section>
  );
}

function ResourceNetwork({ assignment, simulation }: { assignment: PipAssignment; simulation: FittingSimulationState }) {
  const data = simulation.data;
  const allocated = data?.power.allocatedByCategory ?? assignment;
  const capacity = data?.power.capacitySegments.value ?? null;
  const coolingDemand = data?.cooling.demand.value ?? null;
  const coolingCapacity = data?.cooling.capacity.value ?? null;
  const utilization = data?.cooling.utilizationPercent.value ?? null;
  const total = Math.max(1, Object.values(allocated).reduce((sum, value) => sum + value, 0));
  const flows = [
    { label: "Weapons", value: allocated.weapons, icon: "weapons" as PipCategory },
    { label: "Shields", value: allocated.shields, icon: "shields" as PipCategory },
    { label: "Engines", value: allocated.engines, icon: "engines" as PipCategory },
    { label: "Systems", value: allocated.quantum + allocated.radar + allocated.lifeSupport, icon: "radar" as PipCategory },
  ];
  return (
    <section className="fitv2-resource" aria-labelledby="fitv2-network-title">
      <header className="fitv2-section-title"><div><span>System flow</span><h2 id="fitv2-network-title">Resource network</h2></div><p>Aggregate allocation and thermal consequence.</p></header>
      <div className="fitv2-resource-flow">
        <div className="fitv2-reactor-node"><span className="fitv2-reactor-icon" aria-hidden>ϟ</span><span>Power plant</span><strong>Reactor</strong><b>{capacity == null ? "Unavailable" : formatValue(capacity, "segments")}</b><InsightBar value={capacity ?? 0} max={capacity ?? 1} /></div>
        <div className="fitv2-flow-trunk" aria-hidden />
        <div className="fitv2-consumer-nodes">{flows.map((flow) => <div className="fitv2-flow-node" key={flow.label}><PowerPipIcon category={flow.icon} className="fitv2-flow-icon" /><span>{flow.label}</span><strong>{flow.value} segments</strong><i><b style={{ width: `${(flow.value / total) * 100}%` }} /></i><small>{numberFormat.format((flow.value / total) * 100)}%</small></div>)}</div>
        <div className="fitv2-flow-trunk is-output" aria-hidden />
        <div className="fitv2-thermal-nodes"><div><span>Cooler 1</span><strong>{allocated.cooler1} segments</strong></div><div><span>Cooler 2</span><strong>{allocated.cooler2} segments</strong></div><div><span>Thermal load</span><strong>{coolingDemand == null ? "Unavailable" : numberFormat.format(coolingDemand)}</strong></div><div><span>Heat rejection</span><strong>{coolingCapacity == null ? "Unavailable" : numberFormat.format(coolingCapacity)}</strong></div><InsightBar value={utilization ?? 0} max={100} tone={utilization != null && utilization > 100 ? "danger" : "normal"} /></div>
      </div>
      <footer><span>Logical aggregate flow; not a physical ship-topology diagram.</span>{data?.missingInputs.length ? <span>{data.missingInputs.length} source inputs unavailable</span> : null}</footer>
    </section>
  );
}

export default function FittingV2Workspace(props: Props) {
  const shipName = props.ship?.name ?? "Loading ship";
  const manufacturer = deriveDisplayManufacturer(props.ship?.manufacturer ?? null, shipName);
  const roleLine = [props.ship?.career, props.ship?.role, props.ship?.movementClass].filter(Boolean).join(" · ");
  return (
    <main className="fitv2-page">
      <CommandHeader
        className="fitv2-command-header"
        title="Fitting"
        description="Configure components, review performance, and manage ship power."
        icon={<svg viewBox="0 0 24 24"><path d="m14.7 6.3 3-3 3 3-3 3" /><path d="m17.7 6.3-8.9 8.9" /><path d="m7 9-3.7 3.7 8 8L15 17" /><path d="m4.5 19.5 2-2" /></svg>}
        center={<label className="fitv2-ship-select"><span>Ship</span><select value={props.selectedShipKey ?? ""} disabled={props.shipsLoading} onChange={(event) => props.onSelectShip(event.target.value)}>{props.ships.map((ship) => <option key={ship.shipKey} value={ship.shipKey}>{ship.name}</option>)}</select></label>}
        actions={<span className="fitv2-loadout-state">{props.loadoutModified ? "Modified loadout" : "Current loadout"}</span>}
      />
      {props.error ? <p className="fitv2-warning">Fitting data is unavailable. Check the configured Fitting API.</p> : null}
      <section className="fitv2-primary-workspace" aria-labelledby="fitv2-ship-title">
        <div className="fitv2-ship-workspace">
          <header className="fitv2-ship-identity"><div className="fitv2-ship-identity-copy"><h2 id="fitv2-ship-title">{shipName}</h2><p>{roleLine || "Role data unavailable"}</p></div><div className="fitv2-identity-badges"><span>{manufacturer ?? "Unknown manufacturer"}</span><span>{props.loadoutModified ? "Modified" : "Stock"}</span></div></header>
          <div className="fitv2-artwork"><div className="fitv2-artwork-backdrop" aria-hidden /><div className="fitv2-artwork-grid" aria-hidden /><ShipInspectionCanvas key={`${props.selectedShipKey ?? "unselected"}:${shipName}`} asset={props.heroAsset} name={shipName} />{props.loading ? <span className="fitv2-loading">Updating loadout…</span> : null}</div>
        </div>
        <TopologyBrowser topology={props.topology} selectedTarget={props.selectedTarget} onSelectTarget={props.onSelectTarget} />
        <FittingV2Inspector shipName={shipName} metrics={props.performanceMetrics} portRows={props.portRows} detailsById={props.detailsById} selectedTarget={props.selectedTarget} compatible={props.compatible} compatibilityLoading={props.compatibilityLoading} compatibilityError={props.compatibilityError} />
      </section>
      <PowerSection assignment={props.pipAssignment} draws={props.pipDraws} ready={props.pipReady} simulation={props.simulation} effects={props.effects} portRows={props.portRows} componentAllocations={props.componentAllocations ?? []} powerAggregateGeneration={props.powerAggregateGeneration} onChange={props.onPipChange} />
      <PerformanceBand metrics={props.performanceMetrics} />
      <ResourceNetwork assignment={props.pipAssignment} simulation={props.simulation} />
    </main>
  );
}
