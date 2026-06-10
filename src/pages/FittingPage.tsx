import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiUrl } from "../lib/apiUrl";
import "./fitting.css";

type FittingShipSummary = {
  shipKey: string;
  name: string;
  manufacturer: string | null;
  role: string | null;
  career: string | null;
  movementClass: string | null;
  crewSize: number | null;
  hasPrototypeCalculation: boolean;
};

type FittingShipDetail = {
  ship?: FittingShipSummary & {
    portCount?: number | null;
    fittingRelevantPortCount?: number | null;
    compatibleMappingCount?: number | null;
  };
  confidence?: string;
  warnings?: string[];
};

type PortBreakdownRow = {
  shipKey: string;
  portId: string;
  portName: string | null;
  portCategory: string | null;
  ruleCategory: string | null;
  parentPortId: string | null;
  childPortIds: string[];
  equippedComponentKey: string | null;
  equippedComponentName: string | null;
  componentCategory: string | null;
  compatibilityStatus: string | null;
  calculationContribution: Record<string, unknown>;
  warnings: string[];
  confidence: string | null;
};

type FittingLoadoutResponse = {
  shipKey: string;
  ship?: {
    shipKey: string;
    name: string;
    manufacturer: string | null;
  };
  summary: FittingSummary | null;
  warnings: string[];
  confidence: string;
  calculationConfidence?: string;
  unsupportedCategories?: unknown[];
  unsupportedMechanics?: string[];
  unresolvedRefs?: unknown[];
  portBreakdown: PortBreakdownRow[];
};

type FittingSummary = {
  shieldHpTotal?: number;
  shieldRegenTotal?: number;
  powerGenerated?: number;
  powerRequired?: number;
  powerBalance?: number;
  coolingGenerated?: number;
  coolingRequired?: number;
  coolingBalance?: number;
  quantumDrives?: Array<{
    component?: string;
    driveSpeed?: number;
    spoolUpTime?: number;
    cooldownTime?: number;
    quantumFuelRequirement?: number;
    confidence?: string;
  }>;
  directWeaponAlpha?: number;
  directWeaponDps?: number;
};

type FittingComponentRecord = {
  componentKey: string;
  displayName: string | null;
  category: string | null;
  type: string | null;
  mass: number | null;
  health: number | null;
  stats?: Record<string, unknown>;
  confidence?: unknown;
};

type LoadState<T> = {
  status: "idle" | "loading" | "loaded" | "error";
  data: T | null;
};

type NamedGroup = {
  key: string;
  label: string;
  rows: PortBreakdownRow[];
};

type OffensiveTreeNode = {
  key: string;
  label: string;
  meta: string | null;
  parentRow: PortBreakdownRow;
  itemRows: PortBreakdownRow[];
  items: Array<{
    key: string;
    label: string;
    count: number;
    rows: PortBreakdownRow[];
  }>;
};

const emptyLoad = <T,>(): LoadState<T> => ({ status: "idle", data: null });

const offensiveGroupDefs = [
  { key: "weapons", label: "Weapons" },
  { key: "missiles", label: "Missiles & Bombs" },
  { key: "qed", label: "QED" },
  { key: "qid", label: "QID / EMP" },
  { key: "special", label: "Special Offensive Systems" },
];

const componentGroupDefs = [
  { key: "armor", label: "Armor" },
  { key: "power", label: "Power Plant" },
  { key: "thruster", label: "Thrusters" },
  { key: "shield", label: "Shield Generator" },
  { key: "cooler", label: "Cooler" },
  { key: "quantum", label: "Quantum Drive" },
  { key: "fuel-intake", label: "Fuel Intake" },
  { key: "fuel-tank", label: "Fuel Tank" },
  { key: "radar", label: "Radar / Scanner" },
  { key: "missile-rack", label: "Missile Rack" },
  { key: "weapon-rack", label: "Weapon Rack" },
];

function formatNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "unknown";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "");
}

function formatSigned(value: unknown, unit = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "unknown";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}${unit}`;
}

function categoryLabel(value: string | null | undefined) {
  if (!value) return "Other";
  return value.replace(/[_/]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function rowText(row: PortBreakdownRow) {
  return [
    row.portId,
    row.portName,
    row.portCategory,
    row.ruleCategory,
    row.componentCategory,
    row.equippedComponentName,
  ].filter(Boolean).join(" ").toLowerCase();
}

function isUnsupported(row: PortBreakdownRow) {
  const status = row.compatibilityStatus?.toLowerCase();
  return status === "unsupported" || status === "skipped_support" || row.confidence === "unsupported";
}

function isProblem(row: PortBreakdownRow) {
  const status = row.compatibilityStatus?.toLowerCase();
  return status === "invalid" || status === "mismatch" || status === "unresolved";
}

function statusTone(row: PortBreakdownRow) {
  if (isUnsupported(row)) return "muted";
  if (row.compatibilityStatus === "valid" || row.compatibilityStatus === "compatible") return "good";
  if (isProblem(row)) return "bad";
  return "warn";
}

function componentGroupKey(row: PortBreakdownRow): string | null {
  const text = rowText(row);
  const category = row.ruleCategory ?? row.portCategory ?? "";
  if (category === "radar" || text.includes("scanner") || text.includes("radar")) return "radar";
  if (text.includes("weapon rack")) return "weapon-rack";
  if (text.includes("missile rack")) return "missile-rack";
  if (category === "armor" || text.includes("armor")) return "armor";
  if (category === "power" || text.includes("power plant")) return "power";
  if (category === "thruster" || text.includes("thruster")) return "thruster";
  if (category === "shield" || text.includes("shield")) return "shield";
  if (category === "cooler" || text.includes("cooler") || text.includes("heat")) return "cooler";
  if (category === "quantum" || text.includes("quantum")) return "quantum";
  if (category === "fuel" && text.includes("intake")) return "fuel-intake";
  if (category === "fuel" || text.includes("fuel tank") || text.includes("internal tank")) return "fuel-tank";
  return null;
}

function offensiveGroupKey(row: PortBreakdownRow): string | null {
  const text = rowText(row);
  const category = row.ruleCategory ?? row.portCategory ?? "";
  if (isControllerRow(row)) return null;
  if (text.includes("qed")) return "qed";
  if (text.includes("qid") || text.includes("emp")) return "qid";
  if (category === "missile" && !text.includes("missile rack")) return "missiles";
  if ((text.includes("bomb") || text.includes("torpedo")) && !text.includes("rack")) return "missiles";
  if (isEquippedWeaponRow(row)) return "weapons";
  if (category === "weapon" || text.includes("decoy") || text.includes("noise")) return "special";
  return null;
}

function buildGroups(
  defs: Array<{ key: string; label: string }>,
  rows: PortBreakdownRow[],
  pickKey: (row: PortBreakdownRow) => string | null,
) {
  const groups = new Map(defs.map((def) => [def.key, { ...def, rows: [] as PortBreakdownRow[] }]));
  for (const row of rows) {
    const key = pickKey(row);
    const group = key ? groups.get(key) : null;
    if (group) group.rows.push(row);
  }
  return defs.map((def) => groups.get(def.key)).filter((group): group is NamedGroup => Boolean(group));
}

function getRowTitle(row: PortBreakdownRow) {
  return row.equippedComponentName ?? row.portName ?? row.portId;
}

function getRowMeta(row: PortBreakdownRow) {
  const parts = [
    categoryLabel(row.ruleCategory ?? row.portCategory),
    row.portName && row.portName !== row.equippedComponentName ? row.portName : null,
  ].filter(Boolean);
  return parts.join(" / ");
}

function isControllerRow(row: PortBreakdownRow) {
  const text = rowText(row);
  const item = row.equippedComponentName?.trim().toLowerCase();
  return text.includes("controller") || item === "weapons" || item === "missiles";
}

function isEquippedWeaponRow(row: PortBreakdownRow) {
  if (isControllerRow(row)) return false;
  return row.componentCategory === "ship_weapon" && Boolean(row.equippedComponentName);
}

function isMissileItemRow(row: PortBreakdownRow) {
  if (isControllerRow(row)) return false;
  const category = row.ruleCategory ?? row.portCategory;
  return category === "missile" && Boolean(row.parentPortId) && Boolean(row.equippedComponentName);
}

function isWeaponParentRow(row: PortBreakdownRow) {
  const category = row.ruleCategory ?? row.portCategory;
  const text = rowText(row);
  return category === "turret" || category === "mount/gimbal" || text.includes("gimbal") || text.includes("turret") || text.includes("weapon rack");
}

function isMissileParentRow(row: PortBreakdownRow) {
  const category = row.ruleCategory ?? row.portCategory;
  const text = rowText(row);
  return category === "missile" && (row.childPortIds.length > 0 || text.includes("rack") || text.includes("launcher"));
}

function formatPortIdentity(row: PortBreakdownRow) {
  const raw = row.portName ?? row.portId;
  const last = raw.split("/").pop() ?? raw;
  const cleaned = last
    .replace(/^hardpoint[_-]?/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bS(\d)\b/g, "S$1")
    .trim();
  return cleaned || raw;
}

function getOffensiveParent(row: PortBreakdownRow, lookup: Map<string, PortBreakdownRow>, mode: "weapon" | "missile") {
  let current: PortBreakdownRow = row;
  let parent = row.parentPortId ? lookup.get(row.parentPortId) : undefined;
  while (parent) {
    const matches = mode === "weapon" ? isWeaponParentRow(parent) : isMissileParentRow(parent);
    if (!matches || isControllerRow(parent)) break;
    current = parent;
    parent = parent.parentPortId ? lookup.get(parent.parentPortId) : undefined;
  }
  return current === row && row.parentPortId && mode === "weapon"
    ? lookup.get(row.parentPortId) ?? row
    : current;
}

function summarizeTreeItems(rows: PortBreakdownRow[]) {
  const grouped = new Map<string, PortBreakdownRow[]>();
  for (const row of rows) {
    const label = row.equippedComponentName ?? row.portName ?? row.portId;
    grouped.set(label, [...(grouped.get(label) ?? []), row]);
  }
  return [...grouped.entries()].map(([label, itemRows]) => ({
    key: `${label}-${itemRows.map((row) => row.portId).join("|")}`,
    label,
    count: itemRows.length,
    rows: itemRows,
  }));
}

function buildOffensiveTree(rows: PortBreakdownRow[], mode: "weapon" | "missile") {
  const lookup = new Map(rows.map((row) => [row.portId, row]));
  const itemRows = rows.filter(mode === "weapon" ? isEquippedWeaponRow : isMissileItemRow);
  const grouped = new Map<string, OffensiveTreeNode>();

  for (const row of itemRows) {
    const parentRow = getOffensiveParent(row, lookup, mode);
    const existing = grouped.get(parentRow.portId);
    if (existing) {
      existing.itemRows.push(row);
      continue;
    }
    grouped.set(parentRow.portId, {
      key: parentRow.portId,
      label: formatPortIdentity(parentRow),
      meta: parentRow === row ? null : parentRow.equippedComponentName,
      parentRow,
      itemRows: [row],
      items: [],
    });
  }

  return [...grouped.values()]
    .map((node) => ({ ...node, items: summarizeTreeItems(node.itemRows) }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function confidenceLabel(...values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? "unknown";
}

function statValue(value: unknown, unit = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "unknown";
  return `${formatNumber(value)}${unit}`;
}

function pipFill(value: unknown, capacity: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (typeof capacity !== "number" || !Number.isFinite(capacity) || capacity <= 0) return Math.min(100, value > 0 ? 100 : 0);
  return Math.max(0, Math.min(100, (value / capacity) * 100));
}

function massGroupKey(row: PortBreakdownRow) {
  const componentKey = componentGroupKey(row);
  const offensiveKey = offensiveGroupKey(row);
  if (componentKey === "thruster") return "thrusters";
  if (componentKey === "quantum" || componentKey === "fuel-intake" || componentKey === "fuel-tank") return "propulsion";
  if (offensiveKey === "weapons" || offensiveKey === "missiles" || offensiveKey === "special" || componentKey === "weapon-rack" || componentKey === "missile-rack") return "weapons";
  return "systems";
}

function groupMassRows(rows: PortBreakdownRow[], componentLookup: Map<string, FittingComponentRecord>) {
  const groups = new Map([
    ["weapons", { label: "Weapons", rows: [] as PortBreakdownRow[], total: 0, missing: 0 }],
    ["systems", { label: "Systems", rows: [] as PortBreakdownRow[], total: 0, missing: 0 }],
    ["propulsion", { label: "Propulsion", rows: [] as PortBreakdownRow[], total: 0, missing: 0 }],
    ["thrusters", { label: "Thrusters", rows: [] as PortBreakdownRow[], total: 0, missing: 0 }],
  ]);

  for (const row of rows.filter((entry) => entry.equippedComponentKey)) {
    const group = groups.get(massGroupKey(row));
    if (!group) continue;
    const component = row.equippedComponentKey ? componentLookup.get(row.equippedComponentKey) : undefined;
    group.rows.push(row);
    if (typeof component?.mass === "number" && Number.isFinite(component.mass)) group.total += component.mass;
    else group.missing += 1;
  }
  return [...groups.values()];
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

function FittingRow({ row }: { row: PortBreakdownRow }) {
  return (
    <div className={["fit-row", isUnsupported(row) ? "fit-row--unsupported" : ""].filter(Boolean).join(" ")}>
      <div className="fit-row-main">
        <strong>{getRowTitle(row)}</strong>
        <span>{getRowMeta(row) || "Unclassified port"}</span>
      </div>
      <div className="fit-row-side">
        <span className={`fit-status fit-status--${statusTone(row)}`}>{row.compatibilityStatus ?? "unknown"}</span>
        {isUnsupported(row) && <span className="fit-prototype">Prototype</span>}
      </div>
    </div>
  );
}

function GroupPanel({ title, rows, emptyLabel }: { title: string; rows: PortBreakdownRow[]; emptyLabel: string }) {
  return (
    <section className="fit-panel fit-group-panel">
      <div className="fit-panel-head">
        <h2>{title}</h2>
        <span>{rows.length}</span>
      </div>
      <div className="fit-row-list">
        {rows.map((row) => (
          <FittingRow key={`${row.portId}-${row.equippedComponentKey ?? "empty"}-${title}`} row={row} />
        ))}
        {rows.length === 0 && <p className="fit-empty">{emptyLabel}</p>}
      </div>
    </section>
  );
}

function OffensiveTreePanel({ title, nodes, emptyLabel }: { title: string; nodes: OffensiveTreeNode[]; emptyLabel: string }) {
  const itemCount = nodes.reduce((sum, node) => sum + node.itemRows.length, 0);
  return (
    <section className="fit-panel fit-group-panel">
      <div className="fit-panel-head">
        <h2>{title}</h2>
        <span>{itemCount}</span>
      </div>
      <div className="fit-offense-tree">
        {nodes.map((node) => (
          <article key={node.key} className="fit-offense-node">
            <div className="fit-offense-parent">
              <div>
                <strong>{node.label}</strong>
                {node.meta && <span>{node.meta}</span>}
              </div>
              {isUnsupported(node.parentRow) && <span className="fit-prototype">Prototype</span>}
            </div>
            <div className="fit-offense-children">
              {node.items.map((item) => {
                const statusRow = item.rows.find(isProblem) ?? item.rows.find(isUnsupported) ?? item.rows[0];
                return (
                  <div key={item.key} className="fit-offense-child">
                    <span>{item.label}{item.count > 1 ? ` x${item.count}` : ""}</span>
                    {statusRow && <span className={`fit-status fit-status--${statusTone(statusRow)}`}>{statusRow.compatibilityStatus ?? "unknown"}</span>}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
        {nodes.length === 0 && <p className="fit-empty">{emptyLabel}</p>}
      </div>
    </section>
  );
}

function ResourcePips({ label, value, fill, tone = "neutral" }: { label: string; value: string; fill: number; tone?: "good" | "bad" | "neutral" }) {
  const segments = Array.from({ length: 8 }, (_, index) => index < Math.round((fill / 100) * 8));
  return (
    <div className={`fit-pip fit-pip--${tone}`}>
      <span>{label}</span>
      <div className="fit-pip-bars" aria-hidden>
        {segments.map((filled, index) => <i key={index} className={filled ? "is-filled" : ""} />)}
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function StatTile({ label, value, meta, tone = "neutral" }: { label: string; value: string; meta?: string; tone?: "good" | "bad" | "neutral" | "muted" }) {
  return (
    <div className={`fit-stat-tile fit-stat-tile--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {meta && <small>{meta}</small>}
    </div>
  );
}

export default function FittingPage() {
  const { shipKey: routeShipKey } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [shipsState, setShipsState] = useState<LoadState<FittingShipSummary[]>>(emptyLoad);
  const [shipState, setShipState] = useState<LoadState<FittingShipDetail>>(emptyLoad);
  const [loadoutState, setLoadoutState] = useState<LoadState<FittingLoadoutResponse>>(emptyLoad);
  const [calculationState, setCalculationState] = useState<LoadState<FittingLoadoutResponse>>(emptyLoad);
  const [componentsState, setComponentsState] = useState<LoadState<FittingComponentRecord[]>>(emptyLoad);
  const [massOpen, setMassOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setShipsState({ status: "loading", data: null });
    });
    readJson<{ records?: FittingShipSummary[] }>(apiUrl("/api/fitting/ships"), { signal: controller.signal })
      .then((payload) => {
        if (controller.signal.aborted) return;
        const records = Array.isArray(payload.records) ? payload.records : [];
        setShipsState({ status: "loaded", data: records });
      })
      .catch(() => {
        if (!controller.signal.aborted) setShipsState({ status: "error", data: null });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setComponentsState({ status: "loading", data: null });
    });
    readJson<{ records?: FittingComponentRecord[] }>(apiUrl("/api/fitting/components"), { signal: controller.signal })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setComponentsState({ status: "loaded", data: Array.isArray(payload.records) ? payload.records : [] });
      })
      .catch(() => {
        if (!controller.signal.aborted) setComponentsState({ status: "error", data: null });
      });
    return () => controller.abort();
  }, []);

  const ships = useMemo(() => shipsState.data ?? [], [shipsState.data]);
  const selectedShipKey = routeShipKey ?? searchParams.get("ship") ?? ships.find((ship) => ship.hasPrototypeCalculation)?.shipKey ?? ships[0]?.shipKey ?? null;
  const selectedShip = ships.find((ship) => ship.shipKey === selectedShipKey) ?? null;

  useEffect(() => {
    if (!selectedShipKey) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setShipState({ status: "loading", data: null });
      setLoadoutState({ status: "loading", data: null });
      setCalculationState(emptyLoad());
    });

    readJson<FittingShipDetail>(apiUrl(`/api/fitting/ships/${encodeURIComponent(selectedShipKey)}`), { signal: controller.signal })
      .then((payload) => {
        if (!controller.signal.aborted) setShipState({ status: "loaded", data: payload });
      })
      .catch(() => {
        if (!controller.signal.aborted) setShipState({ status: "error", data: null });
      });

    readJson<FittingLoadoutResponse>(apiUrl(`/api/fitting/ships/${encodeURIComponent(selectedShipKey)}/loadout`), { signal: controller.signal })
      .then((payload) => {
        if (!controller.signal.aborted) setLoadoutState({ status: "loaded", data: payload });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadoutState({ status: "error", data: null });
      });

    if (selectedShip?.hasPrototypeCalculation) {
      queueMicrotask(() => {
        if (!controller.signal.aborted) setCalculationState({ status: "loading", data: null });
      });
      readJson<FittingLoadoutResponse>(apiUrl("/api/fitting/calculate"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shipKey: selectedShipKey }),
        signal: controller.signal,
      })
        .then((payload) => {
          if (!controller.signal.aborted) setCalculationState({ status: "loaded", data: payload });
        })
        .catch(() => {
          if (!controller.signal.aborted) setCalculationState({ status: "error", data: null });
        });
    }

    return () => controller.abort();
  }, [selectedShip?.hasPrototypeCalculation, selectedShipKey]);

  useEffect(() => {
    if (!routeShipKey && !searchParams.get("ship") && selectedShipKey) {
      navigate(`/fitting/${selectedShipKey}`, { replace: true });
    }
  }, [navigate, routeShipKey, searchParams, selectedShipKey]);

  const detailShip = shipState.data?.ship;
  const shipDetail = detailShip ?? selectedShip;
  const loadout = loadoutState.data;
  const calculation = calculationState.data;
  const summary = selectedShip?.hasPrototypeCalculation ? calculation?.summary ?? loadout?.summary ?? null : loadout?.summary ?? null;
  const portRows = useMemo(
    () => loadout?.portBreakdown ?? calculation?.portBreakdown ?? [],
    [calculation?.portBreakdown, loadout?.portBreakdown],
  );
  const componentLookup = useMemo(() => {
    const lookup = new Map<string, FittingComponentRecord>();
    for (const component of componentsState.data ?? []) lookup.set(component.componentKey, component);
    return lookup;
  }, [componentsState.data]);
  const offensiveGroups = useMemo(() => buildGroups(offensiveGroupDefs, portRows, offensiveGroupKey), [portRows]);
  const weaponTree = useMemo(() => buildOffensiveTree(portRows, "weapon"), [portRows]);
  const missileTree = useMemo(() => buildOffensiveTree(portRows, "missile"), [portRows]);
  const specialOffensiveGroups = offensiveGroups.filter((group) => group.key !== "weapons" && group.key !== "missiles");
  const componentGroups = useMemo(() => buildGroups(componentGroupDefs, portRows, componentGroupKey), [portRows]);
  const calculationRows = portRows.filter((row) => !isUnsupported(row));
  const unsupportedRows = portRows.filter(isUnsupported);
  const massGroups = useMemo(() => groupMassRows(portRows, componentLookup), [componentLookup, portRows]);
  const knownComponentMass = massGroups.reduce((sum, group) => sum + group.total, 0);
  const missingMassCount = massGroups.reduce((sum, group) => sum + group.missing, 0);
  const missileRows = missileTree.flatMap((node) => node.itemRows);
  const specialRows = [
    ...(offensiveGroups.find((group) => group.key === "qed")?.rows ?? []),
    ...(offensiveGroups.find((group) => group.key === "qid")?.rows ?? []),
    ...(offensiveGroups.find((group) => group.key === "special")?.rows ?? []),
  ];
  const coolingGenerated = summary?.coolingGenerated;
  const massDisplay = knownComponentMass > 0 ? `${formatNumber(knownComponentMass)} kg` : "unknown";
  const warnings = [
    ...(shipState.data?.warnings ?? []),
    ...(calculation?.warnings ?? []),
    ...(loadout?.warnings ?? []),
  ];
  const unsupportedMechanics = calculation?.unsupportedMechanics ?? loadout?.unsupportedMechanics ?? [];
  const confidence = confidenceLabel(calculation?.confidence, loadout?.confidence, shipState.data?.confidence);
  const missingTopStats = ["mass", "durability", "top speed", "boost speed", "pitch/yaw/roll", "signature"];

  const topStats = [
    { label: "Role", value: shipDetail?.role ?? shipDetail?.career ?? "unknown" },
    { label: "Crew", value: shipDetail?.crewSize != null ? String(shipDetail.crewSize) : "unknown" },
    { label: "Mass", value: "unknown" },
    { label: "Durability", value: "unknown" },
    { label: "Top Speed", value: "unknown" },
    { label: "Boost Speed", value: "unknown" },
    { label: "Pitch / Yaw / Roll", value: "unknown" },
    { label: "Signature", value: "unknown" },
  ];

  function selectShip(nextShipKey: string) {
    navigate(`/fitting/${nextShipKey}`);
  }

  return (
    <div className="fit-page">
      <header className="fit-console-head">
        <div className="fit-ship-title">
          <span>{shipDetail?.manufacturer ?? "Unknown Manufacturer"}</span>
          <h1>{shipDetail?.name ?? "Select a ship"}</h1>
        </div>
        <label className="fit-ship-select">
          <span>Ship</span>
          <select
            value={selectedShipKey ?? ""}
            onChange={(event) => selectShip(event.target.value)}
            disabled={shipsState.status !== "loaded" || ships.length === 0}
          >
            {ships.map((ship) => (
              <option key={ship.shipKey} value={ship.shipKey}>
                {ship.name}
              </option>
            ))}
          </select>
        </label>
        <Link to="/dashboard" className="fit-back-link">Dashboard</Link>
      </header>

      <section className="fit-stat-bar" aria-label="Ship stat bar">
        {topStats.map((stat) => (
          <div key={stat.label} className={stat.value === "unknown" ? "fit-stat fit-stat--unknown" : "fit-stat"}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </section>

      <div className="fit-layout">
        <aside className="fit-column fit-column--left" aria-label="Offensive systems">
          <OffensiveTreePanel
            title="Weapons"
            nodes={weaponTree}
            emptyLabel="No equipped weapon hardpoints in the shaped loadout."
          />
          <OffensiveTreePanel
            title="Missiles & Bombs"
            nodes={missileTree}
            emptyLabel="No missile racks or launchers in the shaped loadout."
          />
          {specialOffensiveGroups.map((group) => (
            <GroupPanel key={group.key} title={group.label} rows={group.rows} emptyLabel="No shaped fitting rows in this group." />
          ))}
        </aside>

        <main className="fit-center" aria-label="Fitting workspace">
          <section className="fit-stage">
            <div className="fit-stage-map" role="img" aria-label="Placeholder ship image slot">
              <div className="fit-stage-grid" aria-hidden />
              <div className="fit-ship-silhouette" aria-hidden>
                <span />
              </div>
              <div className="fit-stage-label">
                <span>{shipDetail?.manufacturer ?? "Unknown"}</span>
                <strong>{shipDetail?.name ?? "Ship"}</strong>
              </div>
            </div>
            <div className="fit-pips" aria-label="Prototype resource totals">
              <ResourcePips
                label="Firepower"
                value={`${formatNumber(summary?.directWeaponDps)} dps`}
                fill={typeof summary?.directWeaponDps === "number" ? 100 : 0}
                tone="neutral"
              />
              <ResourcePips
                label="Shields"
                value={`${formatNumber(summary?.shieldHpTotal)} hp`}
                fill={typeof summary?.shieldHpTotal === "number" ? 100 : 0}
                tone="good"
              />
              <ResourcePips
                label="Power"
                value={formatSigned(summary?.powerBalance)}
                fill={pipFill(summary?.powerGenerated, summary?.powerRequired)}
                tone={typeof summary?.powerBalance === "number" && summary.powerBalance < 0 ? "bad" : "good"}
              />
              <ResourcePips
                label="Cooling"
                value={formatSigned(summary?.coolingBalance)}
                fill={summary?.coolingRequired === 0 && typeof coolingGenerated === "number" ? 100 : pipFill(coolingGenerated, summary?.coolingRequired)}
                tone={typeof summary?.coolingBalance === "number" && summary.coolingBalance < 0 ? "bad" : "good"}
              />
              <ResourcePips
                label="Quantum"
                value={summary?.quantumDrives?.[0]?.component ?? "unknown"}
                fill={summary?.quantumDrives?.length ? 100 : 0}
                tone="neutral"
              />
            </div>
          </section>

          <section className="fit-stat-summary" aria-label="Detailed fitting stats">
            <div className="fit-stat-summary-head">
              <h2>Stat Summary</h2>
              <button type="button" className="fit-mass-button" onClick={() => setMassOpen(true)}>
                Component Mass
              </button>
            </div>
            <div className="fit-stat-grid">
              <StatTile label="CPT DPS" value={statValue(summary?.directWeaponDps)} meta="prototype direct weapons" />
              <StatTile label="DPS Delta" value="unknown" meta="stock comparison unavailable" tone="muted" />
              <StatTile label="CPT Alpha" value={statValue(summary?.directWeaponAlpha)} meta="prototype direct weapons" />
              <StatTile label="Alpha Delta" value="unknown" meta="stock comparison unavailable" tone="muted" />
              <StatTile label="Crew DPS" value="unknown" meta="crew allocation unavailable" tone="muted" />
              <StatTile label="Crew Alpha" value="unknown" meta="crew allocation unavailable" tone="muted" />
              <StatTile label="Missile Damage" value="unknown" meta={missileRows.length ? `${missileRows.length} missile rows; projectile damage not exposed` : "no missile damage total"} tone="muted" />
              <StatTile label="Special Damage" value="unknown" meta={specialRows.length ? `${specialRows.length} EMP/QED/QID/special rows` : "none exposed"} tone="muted" />
              <StatTile label="Shield HP" value={statValue(summary?.shieldHpTotal)} meta="prototype shield total" tone="good" />
              <StatTile label="Shield Regen" value={statValue(summary?.shieldRegenTotal)} meta="prototype shield total" tone="good" />
              <StatTile label="Physical Resist" value="unknown" meta="not labeled in shaped API" tone="muted" />
              <StatTile label="Energy Resist" value="unknown" meta="not labeled in shaped API" tone="muted" />
              <StatTile label="Distortion Resist" value="unknown" meta="not labeled in shaped API" tone="muted" />
              <StatTile label="Boost Regen" value="unknown" meta="flight stats not exposed" tone="muted" />
              <StatTile label="Boost Deplete" value="unknown" meta="flight stats not exposed" tone="muted" />
              <StatTile label="Pitch / Yaw / Roll" value="unknown" meta="modifier fields not exposed" tone="muted" />
              <StatTile label="Mass Delta" value="unknown" meta="no editable baseline" tone="muted" />
              <StatTile label="Known Component Mass" value={massDisplay} meta={missingMassCount ? `${missingMassCount} missing masses` : "from component API"} />
              <StatTile label="IR / EM" value="unknown" meta="emissions not exposed" tone="muted" />
              <StatTile label="Cross Section" value="unknown" meta="front/side/top not exposed" tone="muted" />
            </div>
          </section>
        </main>

        <aside className="fit-column fit-column--right" aria-label="Components">
          {componentGroups.map((group) => (
            <GroupPanel key={group.key} title={group.label} rows={group.rows} emptyLabel="No shaped fitting rows in this group." />
          ))}
        </aside>
      </div>

      <section className="fit-bottom" aria-label="Loadout summary">
        <article className="fit-panel">
          <div className="fit-panel-head">
            <h2>Loadout Summary</h2>
            <span>{confidence}</span>
          </div>
          <dl className="fit-summary-list">
            <div><dt>Relevant Rows</dt><dd>{calculationRows.length}</dd></div>
            <div><dt>Unsupported / Prototype</dt><dd>{unsupportedRows.length}</dd></div>
            <div><dt>Port Map</dt><dd>{detailShip?.fittingRelevantPortCount ?? detailShip?.portCount ?? portRows.length}</dd></div>
            <div><dt>Validation</dt><dd>{loadoutState.status === "error" ? "unavailable" : "default loadout"}</dd></div>
          </dl>
        </article>

        <article className="fit-panel">
          <div className="fit-panel-head">
            <h2>Durability Breakdown</h2>
            <span>unknown</span>
          </div>
          <p className="fit-muted">Durability totals are not exposed by the shaped fitting response yet.</p>
          <dl className="fit-summary-list">
            <div><dt>Shield HP</dt><dd>{formatNumber(summary?.shieldHpTotal)}</dd></div>
            <div><dt>Shield Regen</dt><dd>{formatNumber(summary?.shieldRegenTotal)}</dd></div>
          </dl>
        </article>

        <article className="fit-panel">
          <div className="fit-panel-head">
            <h2>Resistances</h2>
            <span>unknown</span>
          </div>
          <p className="fit-muted">Resistance totals are not present in the current shaped fitting calculation.</p>
        </article>

        <article className="fit-panel fit-assumptions">
          <div className="fit-panel-head">
            <h2>Assumptions & Confidence</h2>
            <span>{warnings.length}</span>
          </div>
          <ul>
            <li>Using shaped fitting APIs only; no SPViewer or invented stat values.</li>
            <li>Missing top-bar fields: {missingTopStats.join(", ")}.</li>
            {unsupportedMechanics.slice(0, 3).map((mechanic) => <li key={mechanic}>Unsupported prototype mechanic: {mechanic}.</li>)}
            {warnings.slice(0, 3).map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </article>
      </section>

      <details className="fit-advanced">
        <summary>
          <span>Advanced Port Breakdown</span>
          <strong>{portRows.length} rows</strong>
        </summary>
        <div className="fit-breakdown-table">
          <div className="fit-breakdown-row fit-breakdown-row--head">
            <span>Port</span>
            <span>Rule</span>
            <span>Equipped Component</span>
            <span>Status</span>
            <span>Confidence</span>
            <span>Warnings</span>
          </div>
          {portRows.map((row) => (
            <div key={`${row.portId}-${row.equippedComponentKey ?? "empty"}`} className="fit-breakdown-row">
              <span>{row.portName ?? row.portId}</span>
              <span>{categoryLabel(row.ruleCategory ?? row.portCategory)}</span>
              <span>{row.equippedComponentName ?? "Empty"}</span>
              <span className={`fit-status fit-status--${statusTone(row)}`}>{row.compatibilityStatus ?? "unknown"}</span>
              <span>{row.confidence ?? "unknown"}</span>
              <span>{row.warnings.length ? row.warnings.join(", ") : "-"}</span>
            </div>
          ))}
        </div>
      </details>

      {massOpen && (
        <div className="fit-modal-backdrop" role="presentation" onMouseDown={() => setMassOpen(false)}>
          <section
            className="fit-mass-popout"
            role="dialog"
            aria-modal="true"
            aria-label="Component mass breakdown"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="fit-mass-head">
              <div>
                <span>Component Mass</span>
                <h2>{massDisplay}</h2>
              </div>
              <button type="button" onClick={() => setMassOpen(false)} aria-label="Close mass breakdown">Close</button>
            </div>
            {componentsState.status === "error" && (
              <p className="fit-muted">Component mass lookup failed; mass values are unavailable.</p>
            )}
            <div className="fit-mass-groups">
              {massGroups.map((group) => (
                <article key={group.label} className="fit-mass-group">
                  <div className="fit-panel-head">
                    <h2>{group.label}</h2>
                    <span>{group.total > 0 ? `${formatNumber(group.total)} kg` : "unknown"}</span>
                  </div>
                  <div className="fit-mass-list">
                    {group.rows.map((row) => {
                      const component = row.equippedComponentKey ? componentLookup.get(row.equippedComponentKey) : undefined;
                      const mass = typeof component?.mass === "number" && Number.isFinite(component.mass)
                        ? `${formatNumber(component.mass)} kg`
                        : "missing";
                      return (
                        <div key={`${group.label}-${row.portId}-${row.equippedComponentKey ?? "empty"}`}>
                          <span>{getRowTitle(row)}</span>
                          <strong>{mass}</strong>
                        </div>
                      );
                    })}
                    {group.rows.length === 0 && <p className="fit-empty">No equipped rows in this group.</p>}
                  </div>
                  {group.missing > 0 && <p className="fit-muted">{group.missing} equipped component masses are missing or not matched.</p>}
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
