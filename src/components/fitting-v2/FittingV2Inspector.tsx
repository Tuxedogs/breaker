import { useState } from "react";
import type { FittingCompatibleComponentsResult, FittingComponentDetail, FittingComponentStats } from "../../lib/fitting/fittingApi";
import type { PortBreakdownRow } from "../../lib/fitting/fittingPortGrouping";
import type { FittingV2Metric } from "../../lib/fitting-v2/fittingV2Presentation";
import type { FittingV2Target } from "../../lib/fitting-v2/fittingV2SlotTopology";

export type FittingV2SelectedTarget = FittingV2Target;

type Props = {
  shipName: string;
  metrics: FittingV2Metric[];
  portRows: PortBreakdownRow[];
  detailsById: Record<string, FittingComponentDetail | null>;
  selectedTarget: FittingV2SelectedTarget | null;
  compatible: FittingCompatibleComponentsResult | null;
  compatibilityLoading: boolean;
  compatibilityError: boolean;
};

type StatRow = { label: string; value: number | null | undefined; unit?: string };
type StatSection = { label: string; rows: StatRow[] };
const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const present = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value);
const formatted = (value: number | null | undefined, unit = "") => present(value) ? `${numberFormat.format(value!)}${unit ? ` ${unit}` : ""}` : "Unavailable";

function stateLabel(row: PortBreakdownRow): string {
  if (row.locked) return "Locked";
  if (row.bespoke) return "Bespoke";
  if (row.editable) return "Editable";
  return "Installed";
}

function category(row: PortBreakdownRow): string {
  return `${row.componentCategory ?? ""} ${row.componentSubtype ?? ""} ${row.portCategory ?? ""} ${row.portSubtype ?? ""}`.toLowerCase();
}

function sectionsFor(row: PortBreakdownRow, stats: FittingComponentStats, detail: FittingComponentDetail | null): StatSection[] {
  const text = category(row);
  const common: StatSection[] = [
    { label: "Physical properties", rows: [{ label: "Health", value: stats.health, unit: "HP" }, { label: "Mass", value: stats.mass, unit: "kg" }, { label: "Volume", value: stats.volume, unit: "SCU" }] },
    { label: "Radar emissions", rows: [{ label: "Infrared", value: stats.infraredEmission }, { label: "Electromagnetic", value: stats.electromagneticEmission }, { label: "Radar", value: stats.radarEmission }] },
  ];
  if (/weapon|gun|turret/.test(text)) return [
    { label: "Core performance", rows: [{ label: "Alpha", value: stats.alphaDamage, unit: "damage" }, { label: "Sustained DPS", value: stats.sustainedDps60 ?? stats.dps, unit: "DPS" }, { label: "Fire rate", value: stats.fireRateRpm, unit: "RPM" }, { label: "Damage over 60 seconds", value: stats.damageOver60Seconds, unit: "damage" }] },
    { label: "Ammo", rows: [{ label: "Quantity", value: stats.ammoCapacity ?? stats.maxAmmoCount }, { label: "Speed", value: stats.projectileSpeed, unit: "m/s" }, { label: "Lifetime", value: stats.projectileLifetime, unit: "s" }, { label: "Range", value: stats.calculatedRange ?? stats.projectileMaxTravel, unit: "m" }] },
    { label: "Heat", rows: [{ label: "Heat per shot", value: stats.heatPerShot }, { label: "Cooling delay", value: stats.timeTillCoolingStarts, unit: "s" }, { label: "Cooling per second", value: stats.coolingPerSecond, unit: "/s" }, { label: "Overheat cooldown", value: stats.overheatFixTime, unit: "s" }] },
    { label: "Spread", rows: [{ label: "Minimum", value: stats.spreadMin, unit: "°" }, { label: "Maximum", value: stats.spreadMax, unit: "°" }] },
    ...common,
  ];
  if (/shield/.test(text)) return [
    { label: "Core performance", rows: [{ label: "HP pool", value: detail?.mitigation?.kind === "shield" ? detail.mitigation.shieldHp ?? detail.mitigation.maxShieldHealth : stats.shieldHp, unit: "HP" }, { label: "Max regeneration", value: detail?.mitigation?.kind === "shield" ? detail.mitigation.maxShieldRegen : stats.regenRate, unit: "HP/s" }, { label: "Damaged delay", value: detail?.mitigation?.kind === "shield" ? detail.mitigation.damagedRegenDelay : null, unit: "s" }, { label: "Downed delay", value: detail?.mitigation?.kind === "shield" ? detail.mitigation.downedRegenDelay : null, unit: "s" }] },
    { label: "Power segment usage", rows: [{ label: "Power draw", value: stats.powerDraw ?? stats.powerUsage }] }, ...common,
  ];
  if (/quantum/.test(text)) return [
    { label: "Core performance", rows: [{ label: "Consumption", value: stats.quantumFuelRequirement ?? stats.fuelRate }, { label: "Spool delay", value: stats.spoolTime, unit: "s" }, { label: "Cooldown", value: stats.quantumCooldown, unit: "s" }] },
    { label: "Travel speed", rows: [{ label: "Maximum speed", value: stats.quantumSpeed, unit: "m/s" }, { label: "Stage one acceleration", value: stats.quantumStageOneAccelRate, unit: "m/s²" }, { label: "Stage two acceleration", value: stats.quantumStageTwoAccelRate, unit: "m/s²" }] },
    { label: "Power segment usage", rows: [{ label: "Power draw", value: stats.powerDraw ?? stats.powerUsage }] }, ...common,
  ];
  if (/power/.test(text)) return [{ label: "Power output", rows: [{ label: "Generation", value: stats.powerGenerated }, { label: "Thermal output", value: stats.heatGenerated }, { label: "Health", value: stats.health, unit: "HP" }] }, ...common];
  if (/cooler|cooling/.test(text)) return [{ label: "Thermal performance", rows: [{ label: "Cooling capacity", value: stats.coolingGenerated }, { label: "Cooling required", value: stats.coolingRequired }, { label: "Power requirement", value: stats.powerDraw ?? stats.powerUsage }] }, ...common];
  if (/radar|scanner/.test(text)) return [{ label: "Sensor performance", rows: [{ label: "Detection range", value: stats.detectionRange, unit: "m" }, { label: "Scan range", value: stats.scanRange, unit: "m" }, { label: "Scan rate", value: stats.scanRate }, { label: "Scan cooldown", value: stats.scanCooldownTime, unit: "s" }] }, ...common];
  return [{ label: "Component data", rows: [{ label: "Power draw", value: stats.powerDraw ?? stats.powerUsage }, { label: "Health", value: stats.health, unit: "HP" }] }, ...common];
}

function Overview({ shipName, metrics }: { shipName: string; metrics: FittingV2Metric[] }) {
  const wanted = ["weapon-alpha", "shield-hp", "shield-regen", "power-generation", "power-demand", "cooling"];
  const visible = wanted.map((key) => metrics.find((item) => item.key === key)).filter(Boolean) as FittingV2Metric[];
  return <aside className="fitv2-inspector"><header className="fitv2-inspector-header"><span>Ship overview</span><h2>{shipName}</h2><p>Current loadout</p></header><div className="fitv2-overview-status"><strong>Status</strong><span>Live simulation summary</span></div><div className="fitv2-overview-metrics">{visible.map((metric) => <div key={metric.key}><span>{metric.label}</span><b>{formatted(metric.value, metric.unit)}</b></div>)}</div></aside>;
}

export default function FittingV2Inspector(props: Props) {
  const [tab, setTab] = useState<"performance" | "stores" | "compatibility">("performance");
  if (!props.selectedTarget) return <Overview shipName={props.shipName} metrics={props.metrics} />;
  const target = props.selectedTarget;
  const row = props.portRows.find((item) => item.portId === target.compatibilityPortId);
  if (!row) return <Overview shipName={props.shipName} metrics={props.metrics} />;
  const detail = row.equippedComponentKey ? props.detailsById[row.equippedComponentKey] : null;
  const stats = detail?.stats ?? {};
  const hero = sectionsFor(row, stats, detail)[0]?.rows.slice(0, 4) ?? [];
  const sections = sectionsFor(row, stats, detail).filter((section) => section.rows.some((entry) => present(entry.value)));
  return <aside className="fitv2-inspector"><header className="fitv2-inspector-header"><span>{stateLabel(row)}</span><h2>{row.equippedComponentName ?? "Uninstalled slot"}</h2><p>{row.componentManufacturer ?? "Manufacturer unavailable"}</p><small>{row.componentSubtype ?? row.componentCategory ?? row.portSubtype ?? row.portCategory ?? "Component"}{row.componentSize != null ? ` · Size ${row.componentSize}` : ""}</small></header><div className="fitv2-hero-metrics">{hero.map((entry) => <div key={entry.label}><span>{entry.label}</span><b>{formatted(entry.value, entry.unit)}</b></div>)}</div><nav className="fitv2-inspector-tabs" aria-label="Inspector tabs">{(["performance", "stores", "compatibility"] as const).map((entry) => <button type="button" className={tab === entry ? "is-active" : ""} onClick={() => setTab(entry)} key={entry}>{entry}</button>)}</nav>{tab === "performance" ? <div className="fitv2-inspector-details">{sections.length ? sections.map((section, index) => <details key={section.label} open={index === 0}><summary>{section.label}</summary><dl>{section.rows.filter((entry) => present(entry.value)).map((entry) => <div key={entry.label}><dt>{entry.label}</dt><dd>{formatted(entry.value, entry.unit)}</dd></div>)}</dl></details>) : <p className="fitv2-inspector-empty">Component performance data is unavailable.</p>}</div> : null}{tab === "stores" ? <p className="fitv2-inspector-empty">No known store locations.</p> : null}{tab === "compatibility" ? <div className="fitv2-inspector-details"><dl className="fitv2-slot-data"><div><dt>Current slot</dt><dd>{row.portName ?? row.portId}</dd></div><div><dt>Slot size</dt><dd>{row.portExactSize != null ? `Size ${row.portExactSize}` : "Unavailable"}</dd></div><div><dt>Slot type</dt><dd>{row.portSubtype ?? row.portType ?? "Unavailable"}</dd></div><div><dt>Structural state</dt><dd>{stateLabel(row)}</dd></div></dl>{props.compatibilityLoading ? <p className="fitv2-inspector-empty">Loading compatible replacements…</p> : props.compatibilityError ? <p className="fitv2-inspector-empty">Compatibility data is unavailable for this slot.</p> : props.compatible?.components.length ? <div className="fitv2-compatible-list">{props.compatible.components.slice(0, 12).map((item) => <div key={item.id}><strong>{item.displayName || item.name}</strong><span>{item.size != null ? `Size ${item.size}` : "Size unavailable"} · {item.manufacturer ?? "Manufacturer unavailable"}</span></div>)}</div> : <p className="fitv2-inspector-empty">No compatible replacement components.</p>}</div> : null}</aside>;
}
