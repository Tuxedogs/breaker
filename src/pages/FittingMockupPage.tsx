import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import FittingMockupShell from "../components/fitting/mockup/FittingMockupShell";
import FittingSelectorDrawer from "../components/fitting/mockup/FittingSelectorDrawer";
import PowerCardContent from "../components/fitting/mockup/PowerCardContent";
import {
  type FittingComponentDetail,
  type FittingComponentMitigation,
  type FittingComponentSummary,
  type FittingWeaponSimulationResult,
} from "../lib/fitting/fittingApi";
import { loadVehicleFittingComponent } from "../lib/fitting/fittingComponentStore";
import { getFittingSlotIcon } from "../lib/fitting/getFittingSlotIcon";
import { quantumMetersToKilometers } from "../lib/fitting/quantumDriveUnits";
import {
  buildFittingCompatDebugSnapshot,
  isFittingCompatDebugEnabled,
} from "../lib/fitting/fittingCompatDebug";
import { canonicalFittingId, resolveLoadoutComponentId } from "../lib/fitting/fittingItemIdentity";
import {
  buildMockupOffensiveDisplayGroups,
  isPortStructurallyEditable,
  mockupComponentTitle,
  mockupSlotLabel,
} from "../lib/fitting/fittingMockupGroups";
import {
  buildDefensiveGroups,
  buildHeroInspectView,
  buildOffensiveGroups,
  buildResourceSummary,
  buildStatCards,
  buildTopBarView,
  resolveShipHeroAsset,
} from "../lib/fitting/mockup/fittingMockupAdapters";
import {
  mockupDrawerSlotLabel,
  mockupDrawerTitle,
  resolveTurretGroupCompatibleItems,
  turretGroupCompatibilityMessage,
  usesGroupedPortCompatibility,
  type MockupWeaponSelection,
} from "../lib/fitting/fittingMockupTurretGroups";
import {
  compatibilityDrawerMessage,
  isItemCompatibleWithSlot,
  isSlotCompatibilityEditable,
  portCompatibleApiComponents,
  resolveCompatibleItemsForSlot,
  resolveCompatibilityRejections,
} from "../lib/fitting/fittingSlotCompatibility";
import {
  categoryLabel,
  formatNumber,
  inferDamageType,
  type PortBreakdownRow,
} from "../lib/fitting/fittingPortGrouping";
import {
  componentStatSummary,
  useCompatibleComponents,
} from "../lib/fitting/useCompatibleComponents";
import {
  resolveDrawerWeaponDps,
  statText,
  useFittingMockupCombatStats,
} from "../lib/fitting/useFittingMockupCombatStats";
import { useFittingMockupLoadout } from "../lib/fitting/useFittingMockupLoadout";
import { pipAssignmentFromDraws } from "../lib/fitting/fittingPipPower";
import {
  DEFAULT_PIP_ASSIGNMENT,
  PIP_MAX_PER_CATEGORY,
  type PipAssignment,
  type PipCategory,
} from "../lib/fitting/fittingTerminalTypes";
import { useFittingSimulation } from "../lib/fitting/useFittingSimulation";
import { usePipSystemPowerDraw } from "../lib/fitting/usePipSystemPowerDraw";
import { collectMitigationComponentIds } from "../lib/fitting/useEquippedComponentDetails";
import { useTurretGroupCompatibleComponents } from "../lib/fitting/useTurretGroupCompatibleComponents";
import {
  isFittingShipGuid,
  resolveMockupShipKey,
} from "../lib/fitting/mockup/fittingMockupShipResolve";

const MAIN_TABS = [
  "Overview",
] as const;

type CompactStat = { label: string; value: string };

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
    addStat(parts, "Reference DPS", resolveDrawerWeaponDps(stats));
    addStat(parts, "Alpha", stats?.alphaDamage);
    addStat(parts, "Speed", stats?.projectileSpeed, " m/s");
    return parts.slice(0, 4);
  }

  if (typeText.includes("power")) {
    addStat(parts, "Capacity", stats?.powerGenerated, " segments");
    addStat(parts, "Power demand", stats?.powerDraw);
  } else if (typeText.includes("cooler")) {
    addStat(parts, "Cooling", stats?.coolingGenerated);
    addStat(parts, "Power demand", stats?.powerDraw);
  } else if (typeText.includes("shield")) {
    addStat(parts, "HP", stats?.shieldHp);
    addStat(parts, "Regen", stats?.regenRate, "/s");
  } else if (typeText.includes("quantum")) {
    addStat(
      parts,
      "Speed",
      stats?.quantumSpeed == null ? stats?.quantumSpeed : quantumMetersToKilometers(stats.quantumSpeed),
      " km/s",
    );
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

function drawerItemIcon(component: FittingComponentSummary, itemKind: "weapon" | "component"): string {
  return getFittingSlotIcon({
    slotKind: itemKind === "weapon" ? "weapon hardpoint" : "component slot",
    componentType: component.type,
    itemType: component.subtype,
  });
}

function DetailStatRow({
  label,
  value,
  tone = "default",
  nested = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "accent" | "muted";
  nested?: boolean;
}) {
  return (
    <div className={["fm-detail-row", nested ? "is-nested" : "", tone !== "default" ? `is-${tone}` : ""].filter(Boolean).join(" ")}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

function ratioText(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${formatNumber(value * 100)}%`
    : "Not calculated yet";
}

export function ComponentStatsDrawer({
  detail,
  loading,
  weaponSimulation,
  simulationLoading,
}: {
  detail: FittingComponentDetail | null;
  loading: boolean;
  weaponSimulation: FittingWeaponSimulationResult | null;
  simulationLoading: boolean;
}) {
  const stats = detail?.stats;
  if (loading) {
    return (
      <div className="fm-detail-drawer">
        <div className="fm-detail-row"><span>Loading</span><span>...</span></div>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="fm-detail-drawer">
        <div className="fm-detail-row is-muted"><span>Stats</span><span>Source unavailable</span></div>
      </div>
    );
  }

  const damageType = stats ? inferDamageType(stats) : null;
  const ballisticReserve = stats?.maxAmmoCount && stats.maxAmmoCount > 0
    ? stats.maxAmmoCount
    : stats?.ammoCapacity;
  const emMaximum = stats?.emSignatureNominal
    ?? stats?.electromagneticEmission
    ?? stats?.radarEmission;
  const powerMaximum = stats?.powerInputMaximum
    ?? stats?.powerConsumptionNominal
    ?? stats?.powerDraw;
  const powerMinimum = stats?.powerInputMinimum ?? stats?.powerConsumptionMinimum;
  const penetration = detail.mitigation?.kind === "weapon_projectile"
    ? detail.mitigation.ammoPenetration ?? detail.mitigation.maxPenetrationThickness ?? stats?.maxPenetrationThickness
    : stats?.maxPenetrationThickness;
  const penetrationDistance = detail.mitigation?.kind === "weapon_projectile"
    ? detail.mitigation.basePenetrationDistance
    : null;
  const actionTimingRows = (detail.weapon?.actions ?? []).flatMap((action) => [
    { key: `${action.actionIndex}-charge-time`, label: `${action.kind} charge time`, value: action.chargeTime },
    { key: `${action.actionIndex}-charge-up`, label: `${action.kind} charge-up`, value: action.chargeUpTime },
    { key: `${action.actionIndex}-charge-down`, label: `${action.kind} charge-down`, value: action.chargeDownTime },
    { key: `${action.actionIndex}-cooldown`, label: `${action.kind} cooldown`, value: action.cooldownTime },
    { key: `${action.actionIndex}-spin-up`, label: `${action.kind} spin-up`, value: action.spinUpTime },
    { key: `${action.actionIndex}-spin-down`, label: `${action.kind} spin-down`, value: action.spinDownTime },
  ]).filter((row) => typeof row.value === "number" && Number.isFinite(row.value));

  return (
    <div className="fm-detail-drawer">
      <section className="fm-detail-section">
        <h4>Damage</h4>
        <DetailStatRow label="Alpha Strike" value={statText(stats?.alphaDamage)} tone="accent" />
        <DetailStatRow label="Reference DPS" value={statText(resolveDrawerWeaponDps(stats))} tone={resolveDrawerWeaponDps(stats) == null ? "muted" : "default"} nested />
        <DetailStatRow
          label="Sustained DPS (60s)"
          value={simulationLoading ? "Updating…" : statText(weaponSimulation?.dps.value)}
          tone={weaponSimulation?.dps.value == null ? "muted" : "default"}
          nested
        />
        <DetailStatRow label="Damage Over 60s" value={simulationLoading ? "Updatingâ€¦" : statText(weaponSimulation?.damage.value, " dmg")} nested />
        <DetailStatRow label="Trigger Time (60s)" value={simulationLoading ? "Updatingâ€¦" : statText(weaponSimulation?.triggerTimeSeconds.value, " s")} nested />
        <DetailStatRow label="Shots Fired (60s)" value={simulationLoading ? "Updatingâ€¦" : statText(weaponSimulation?.shotsFired.value)} nested />
        <DetailStatRow label="Fire Rate" value={statText(stats?.fireRateRpm, " rpm")} nested />
        <DetailStatRow label="Damage Type" value={damageType ?? "Not calculated yet"} nested />
      </section>
      <section className="fm-detail-section">
        <h4>Ammo / Capacitor</h4>
        <DetailStatRow label="Model" value={weaponSimulation?.ammunitionModel ?? "Not calculated yet"} tone="accent" />
        <DetailStatRow label="Ballistic Reserve" value={statText(ballisticReserve)} nested />
        <DetailStatRow label="Base Maximum Load" value={statText(stats?.maxAmmoLoad)} nested />
        <DetailStatRow label="Effective Maximum Load" value={simulationLoading ? "Updatingâ€¦" : statText(weaponSimulation?.effectiveAmmo.value)} nested />
        <DetailStatRow label="Cost Per Shot" value={statText(stats?.ammoCostPerShot)} nested />
        <DetailStatRow label="Base Regen" value={statText(stats?.maxRegenPerSec, "/s")} nested />
        <DetailStatRow label="Effective Regen" value={simulationLoading ? "Updatingâ€¦" : statText(weaponSimulation?.effectiveRegenPerSecond.value, "/s")} nested />
        <DetailStatRow label="Regen Delay" value={statText(stats?.regenerationCooldown, " s")} nested />
        <DetailStatRow label="Time to Fill Capacitor" value={simulationLoading ? "Updatingâ€¦" : statText(weaponSimulation?.capacitorFillTimeSeconds.value, " s")} nested />
        <DetailStatRow label="Time to Full Recharge" value={simulationLoading ? "Updatingâ€¦" : statText(weaponSimulation?.capacitorFullRechargeTimeSeconds.value, " s")} nested />
        <DetailStatRow label="Complete Magazines (60s)" value={simulationLoading ? "Updatingâ€¦" : statText(weaponSimulation?.completeMagazinesFired)} nested />
      </section>
      <section className="fm-detail-section">
        <h4>Projectile / Spread</h4>
        <DetailStatRow label="Velocity" value={statText(stats?.projectileSpeed, " m/s")} tone="accent" />
        <DetailStatRow label="Range" value={statText(stats?.calculatedRange, " m")} tone={stats?.calculatedRange == null ? "muted" : "default"} nested />
        <DetailStatRow label="Penetration" value={statText(penetration)} nested />
        <DetailStatRow label="Penetration Distance" value={statText(penetrationDistance, " m")} nested />
        <DetailStatRow label="Spread Minâ€“Max" value={stats?.spreadMin != null && stats.spreadMax != null ? `${formatNumber(stats.spreadMin)} â€“ ${formatNumber(stats.spreadMax)}` : "Not calculated yet"} nested />
        <DetailStatRow label="First Attack" value={statText(stats?.spreadFirstAttack)} nested />
        <DetailStatRow label="Per Attack" value={statText(stats?.spreadPerAttack)} nested />
        <DetailStatRow label="Decay" value={statText(stats?.spreadDecay)} nested />
      </section>
      <section className="fm-detail-section">
        <h4>Thermal</h4>
        <DetailStatRow label="Heat Per Shot" value={statText(stats?.heatPerShot)} tone="accent" />
        <DetailStatRow label="Cooling Delay" value={statText(stats?.timeTillCoolingStarts, " s")} nested />
        <DetailStatRow label="Cooling Rate" value={statText(stats?.coolingPerSecond ?? stats?.cooldownRate, "/s")} nested />
        <DetailStatRow label="Minimum Temperature" value={statText(stats?.minimumTemperature)} nested />
        <DetailStatRow label="Overheat Temperature" value={statText(stats?.overheatTemperature)} nested />
        <DetailStatRow label="Overheat Recovery" value={statText(stats?.overheatFixTime, " s")} nested />
        <DetailStatRow label="Post-Overheat Temperature" value={statText(stats?.postOverheatTemperature)} nested />
        <DetailStatRow label="Maximum Shots Before Overheat" value={simulationLoading ? "Updatingâ€¦" : statText(weaponSimulation?.maxShotsBeforeOverheat.value)} nested />
        <DetailStatRow label="Overheat Interruptions (60s)" value={simulationLoading ? "Updatingâ€¦" : statText(weaponSimulation?.overheatInterruptions.value)} nested />
        <DetailStatRow label="Overheat Downtime (60s)" value={simulationLoading ? "Updatingâ€¦" : statText(weaponSimulation?.overheatTimeSeconds.value, " s")} nested />
      </section>
      <section className="fm-detail-section">
        <h4>Power / Signature</h4>
        <DetailStatRow label="Power Maximum" value={statText(powerMaximum)} tone={powerMaximum == null ? "muted" : "accent"} />
        <DetailStatRow label="Power Minimum (derived)" value={statText(powerMinimum)} nested />
        <DetailStatRow label="EM Maximum" value={statText(emMaximum)} nested />
        <DetailStatRow label="EM Decay Rate" value={statText(stats?.emSignatureDecayRate)} nested />
      </section>
      <section className="fm-detail-section">
        <h4>Integrity</h4>
        <DetailStatRow label="Self-Repair Uses" value={statText(stats?.selfRepairMaxCount)} tone="accent" />
        <DetailStatRow label="Self-Repair Cycle" value={statText(stats?.selfRepairTime, " s")} nested />
        <DetailStatRow label="Health Ratio" value={ratioText(stats?.selfRepairHealthRatio)} nested />
        <DetailStatRow label="Baseline HP Restored (derived)" value={statText(stats?.selfRepairBaselineHp, " hp")} nested />
        <DetailStatRow label="Repair Restore Ratio" value={ratioText(stats?.repairRestoreRatio)} nested />
        <DetailStatRow label="Component HP" value={statText(stats?.health, " hp")} nested />
      </section>
      {actionTimingRows.length > 0 ? (
        <section className="fm-detail-section">
          <h4>Action Timing</h4>
          {actionTimingRows.map((row) => (
            <DetailStatRow key={row.key} label={row.label} value={statText(row.value, " s")} nested />
          ))}
        </section>
      ) : null}
      <section className="fm-detail-section">
        <h4>Compatibility</h4>
        <DetailStatRow label="Type" value={categoryLabel(detail.type)} />
        <DetailStatRow label="Size" value={detail.size != null ? String(detail.size) : "—"} nested />
        <DetailStatRow label="Manufacturer" value={detail.manufacturer ?? "—"} nested />
        <DetailStatRow label="Grade / Class" value={[detail.grade, detail.class].filter(Boolean).join(" / ") || "—"} nested />
      </section>
    </div>
  );
}

export default function FittingMockupPage() {
  const { shipKey: routeShipKey } = useParams<{ shipKey: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryShip = searchParams.get("ship");
  const requestedShipKey = routeShipKey ?? queryShip;
  const initialShipKey = requestedShipKey && isFittingShipGuid(requestedShipKey)
    ? requestedShipKey
    : null;
  const [mainTab] = useState<(typeof MAIN_TABS)[number]>("Overview");
  const [pipAssignment, setPipAssignment] = useState<PipAssignment>({ ...DEFAULT_PIP_ASSIGNMENT });
  const pipSyncedShipRef = useRef<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [weaponStatsOpen, setWeaponStatsOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<FittingComponentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [compatStats, setCompatStats] = useState<Record<string, FittingComponentDetail>>({});
  const [installError, setInstallError] = useState<string | null>(null);
  const [compatDebug, setCompatDebug] = useState<ReturnType<typeof buildFittingCompatDebugSnapshot> | null>(null);
  const compatDebugEnabled = isFittingCompatDebugEnabled(searchParams);

  const loadout = useFittingMockupLoadout(initialShipKey);
  const {
    ships: loadoutShips,
    selectedShipKey: loadoutSelectedShipKey,
    selectShip: loadoutSelectShip,
  } = loadout;
  const combatStats = useFittingMockupCombatStats(loadout.portRows);
  const pipPower = usePipSystemPowerDraw(
    loadout.portRows,
    loadout.statsById,
    !loadout.equippedDetailsReady,
  );
  const simulation = useFittingSimulation(
    loadout.selectedShipKey,
    loadout.portRows,
    pipAssignment,
    !loadout.loading && pipPower.ready,
  );

  useEffect(() => {
    const shipKey = loadout.selectedShipKey;
    if (!shipKey || !pipPower.ready || loadout.portRows.length === 0) return;
    if (loadout.portRows.some((row) => row.shipKey !== shipKey)) return;
    if (pipSyncedShipRef.current === shipKey) return;
    pipSyncedShipRef.current = shipKey;
    setPipAssignment(pipAssignmentFromDraws(pipPower.draws));
  }, [loadout.portRows, loadout.selectedShipKey, pipPower.draws, pipPower.ready]);

  function updatePip(category: PipCategory, value: number) {
    setPipAssignment((current) => ({
      ...current,
      [category]: Math.max(0, Math.min(PIP_MAX_PER_CATEGORY, Math.round(value))),
    }));
  }

  const closeSelector = useCallback(() => setSelectorOpen(false), []);

  const mitigationByComponentId = useMemo(() => {
    if (!loadout.equippedDetailsReady) return {};
    const ids = collectMitigationComponentIds(loadout.portRows);
    const next: Record<string, FittingComponentMitigation | null> = {};
    for (const componentId of ids) {
      if (componentId in loadout.mitigationById) {
        next[componentId] = loadout.mitigationById[componentId];
      }
    }
    return next;
  }, [loadout.equippedDetailsReady, loadout.mitigationById, loadout.portRows]);

  const componentMitigations = useMemo(
    () => Object.values(mitigationByComponentId),
    [mitigationByComponentId],
  );
  const shieldMitigations = useMemo(
    () => componentMitigations.filter((entry): entry is Extract<FittingComponentMitigation, { kind: "shield" }> => entry?.kind === "shield"),
    [componentMitigations],
  );
  const armorMitigations = useMemo(
    () => componentMitigations.filter((entry): entry is Extract<FittingComponentMitigation, { kind: "armor" }> => entry?.kind === "armor"),
    [componentMitigations],
  );

  useEffect(() => {
    if (!loadoutShips.length) return;

    const resolvedRequest = requestedShipKey
      ? resolveMockupShipKey(requestedShipKey, loadoutShips)
      : loadoutSelectedShipKey ?? resolveMockupShipKey(null, loadoutShips);
    const resolvedShipKey = loadoutShips.some((ship) => ship.shipKey === resolvedRequest)
      ? resolvedRequest
      : loadoutSelectedShipKey && loadoutShips.some((ship) => ship.shipKey === loadoutSelectedShipKey)
        ? loadoutSelectedShipKey
        : loadoutShips[0]?.shipKey ?? null;
    if (!resolvedShipKey) return;

    if (resolvedShipKey !== loadoutSelectedShipKey) loadoutSelectShip(resolvedShipKey);

    if (routeShipKey !== resolvedShipKey || queryShip) {
      const nextSearch = new URLSearchParams(searchParams);
      nextSearch.delete("ship");
      const suffix = nextSearch.size > 0 ? `?${nextSearch.toString()}` : "";
      navigate(`/fitting/${encodeURIComponent(resolvedShipKey)}${suffix}`, { replace: true });
    }
  }, [loadoutShips, loadoutSelectedShipKey, loadoutSelectShip, navigate, queryShip, requestedShipKey, routeShipKey, searchParams]);

  const offensiveDisplaySelections = useMemo(
    () => buildMockupOffensiveDisplayGroups(loadout.portRows).flatMap((group) => group.selections),
    [loadout.portRows],
  );

  const selectedWeaponSelection = useMemo(
    () => offensiveDisplaySelections.find((selection) => selection.selectionPortId === loadout.selectedPortId) ?? null,
    [offensiveDisplaySelections, loadout.selectedPortId],
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
    selectorOpen && Boolean(selectedRow && isPortStructurallyEditable(selectedRow)) && !usesGroupedCompatibility,
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
    if (!selectedRow || !compatibilityIndex || compatible.loading || compatible.requestPortId !== selectedRow.portId) return [];
    if (!compatDebugEnabled) return [];
    return resolveCompatibilityRejections({ slot: selectedRow, candidateItems: portApiComponents, compatibilityIndex });
  }, [compatDebugEnabled, compatibilityIndex, compatible.loading, compatible.requestPortId, portApiComponents, selectedRow]);

  const drawerItems = useMemo(() => {
    if (usesGroupedCompatibility && selectedWeaponSelection) {
      if (groupedCompatible.loading || groupedCompatible.requestKey !== selectedWeaponSelection.childPortIds.sort().join("|")) return [];
      return resolveTurretGroupCompatibleItems(groupedCompatible.bundles);
    }
    if (!selectedRow || !compatibilityIndex || compatible.loading || compatible.requestPortId !== selectedRow.portId) return [];
    return resolveCompatibleItemsForSlot({ slot: selectedRow, candidateItems: portApiComponents, compatibilityIndex });
  }, [compatibilityIndex, compatible.loading, compatible.requestPortId, groupedCompatible.bundles, groupedCompatible.loading, groupedCompatible.requestKey, portApiComponents, selectedRow, selectedWeaponSelection, usesGroupedCompatibility]);

  const drawerEditable = Boolean(
    usesGroupedCompatibility && selectedWeaponSelection
      ? selectedWeaponSelection.childRows.every((row) => isPortStructurallyEditable(row))
        && groupedCompatible.bundles.every((bundle) => bundle.index?.status === "known")
      : selectedRow && compatibilityIndex && isSlotCompatibilityEditable(selectedRow, compatibilityIndex),
  );

  const drawerMessage = usesGroupedCompatibility && selectedWeaponSelection
    ? turretGroupCompatibilityMessage(selectedWeaponSelection, groupedCompatible.bundles, groupedCompatible.loading, drawerItems.length)
    : selectedRow && compatibilityIndex
      ? compatibilityDrawerMessage(selectedRow, compatibilityIndex, compatible.loading, drawerItems.length)
      : null;

  useEffect(() => {
    const componentId = selectedRow?.equippedComponentKey;
    if (!componentId) { setSelectedDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    loadVehicleFittingComponent(componentId)
      .then((detail) => { if (!cancelled) setSelectedDetail(detail); })
      .catch(() => { if (!cancelled) setSelectedDetail(null); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedRow?.equippedComponentKey]);

  useEffect(() => {
    const ids = drawerItems.map((component) => component.id);
    if (ids.length === 0) return;
    let cancelled = false;
    void (async () => {
      const next: Record<string, FittingComponentDetail> = {};
      for (const componentId of ids.slice(0, 40)) {
        try {
          const detail = await loadVehicleFittingComponent(componentId);
          if (cancelled) return;
          next[componentId] = detail;
        } catch {
          if (cancelled) return;
        }
      }
      if (!cancelled) setCompatStats((current) => ({ ...current, ...next }));
    })();
    return () => { cancelled = true; };
  }, [drawerItems]);

  useEffect(() => {
    if (!compatDebugEnabled || !selectedRow || !compatibilityIndex) { setCompatDebug(null); return; }
    setCompatDebug(buildFittingCompatDebugSnapshot({
      slot: selectedRow,
      apiComponents: portApiComponents,
      compatibilityIndex,
      apiStatus: compatible.result?.status ?? null,
      matchedItems: drawerItems,
      rejected: drawerRejections,
    }));
  }, [compatDebugEnabled, compatibilityIndex, compatible.result?.status, drawerItems, drawerRejections, portApiComponents, selectedRow]);

  useEffect(() => {
    setInstallError(null);
  }, [loadout.selectedPortId, selectorOpen]);

  const ship = loadout.shipDetail?.ship;
  const fittingValid = !loadout.error && loadout.portRows.length > 0 && Boolean(loadout.calculateResult);
  const drawerItemKind = selectedWeaponSelection ? "weapon" : "component";

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

  async function openComponentDetails(componentId: string) {
    setWeaponStatsOpen(true);
    setDetailLoading(true);
    try {
      setSelectedDetail(await loadVehicleFittingComponent(componentId));
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
        groupedCompatible.bundles.filter((bundle) => bundle.index).map((bundle) => [bundle.childPortId, bundle.index!]),
      );
      const result = await loadout.installTurretGroup(selectedWeaponSelection.childPortIds, item, indexes);
      if (!result.ok) { setInstallError(result.reason); return; }
      setInstallError(null);
      setSelectorOpen(false);
      return;
    }

    if (!compatibilityIndex) return;

    const verdict = isItemCompatibleWithSlot({ slot: selectedRow, item, compatibilityIndex });
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
    if (!result.ok) { setInstallError(result.reason); return; }
    setInstallError(null);
    setSelectorOpen(false);
  }

  const topBar = buildTopBarView(ship, loadout, mainTab, [...MAIN_TABS]);
  const offensiveGroups = buildOffensiveGroups(loadout, combatStats);
  const defensiveGroups = buildDefensiveGroups(loadout);
  const heroAsset = resolveShipHeroAsset({
    shipKey: loadout.selectedShipKey,
    manufacturer: ship?.manufacturer ?? null,
    name: ship?.name ?? "",
  });
  const heroInspect = buildHeroInspectView({
    selectedWeaponSelection,
    selectedRow,
    selectorOpen,
    slotTitle: mockupSlotLabel,
    drawerSlotLabel: mockupDrawerSlotLabel,
  });
  const resourceSummary = buildResourceSummary(simulation, fittingValid);
  const selectedWeaponSimulation = selectedRow
    ? simulation.data?.weapons.find((weapon) => (
        weapon.mountId === selectedRow.portId
        || weapon.componentId === selectedRow.equippedComponentKey
      )) ?? null
    : null;
  const selectedDetailPanel = selectedRow ? (
    <div className={weaponStatsOpen ? "fm-selected-detail is-open" : "fm-selected-detail"}>
      <span className="fm-detail-kicker">Selected</span>
      <h3 className="fm-detail-title">{mockupComponentTitle(selectedRow)}</h3>
      <button
        type="button"
        className={["fm-detail-toggle", weaponStatsOpen ? "is-open" : ""].filter(Boolean).join(" ")}
        onClick={() => setWeaponStatsOpen((open) => !open)}
        aria-expanded={weaponStatsOpen}
      >
        Component Stats
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d={weaponStatsOpen ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} /></svg>
      </button>
      {weaponStatsOpen ? (
        <ComponentStatsDrawer
          detail={selectedDetail}
          loading={detailLoading}
          weaponSimulation={selectedWeaponSimulation}
          simulationLoading={simulation.loading}
        />
      ) : null}
    </div>
  ) : null;

  const statCardsWithActions = buildStatCards({
    loadout,
    combatStats,
    simulation,
    armorMitigations,
    shieldMitigations,
    powerCardContent: (
      <PowerCardContent
        pipAssignment={pipAssignment}
        simulation={simulation}
        onPipChange={updatePip}
      />
    ),
  }).map((card) => (
    card.key === "performance"
      ? { ...card, actionDisabled: !selectedRow }
      : card
  ));

  const selectorDrawer = selectorOpen && selectedRow ? (
    <FittingSelectorDrawer
      title={drawerTitleForSlot(selectedRow, selectedWeaponSelection)}
      compatibleLabel={drawerEditable ? drawerSlotLabel(selectedRow, selectedWeaponSelection) : null}
      editable={drawerEditable}
      message={drawerMessage}
      installError={installError}
      items={drawerItems}
      itemStats={(component) => itemPrimaryStats(component, compatStats[component.id])}
      itemMeta={componentStatSummary}
      itemIconSrc={(component) => drawerItemIcon(component, drawerItemKind)}
      isInstalled={(component) => (
        usesGroupedCompatibility && selectedWeaponSelection
          ? selectedWeaponSelection.childRows.every((row) => canonicalFittingId(row.equippedComponentKey) === canonicalFittingId(component.id))
          : canonicalFittingId(selectedRow.equippedComponentKey) === canonicalFittingId(component.id)
      )}
      onClose={closeSelector}
      onInstall={(componentId) => { void installComponent(componentId); }}
      onOpenDetails={(componentId) => { void openComponentDetails(componentId); }}
    />
  ) : null;

  return (
    <FittingMockupShell
      topBar={topBar}
      offensiveGroups={offensiveGroups}
      defensiveGroups={defensiveGroups}
      heroAsset={heroAsset}
      heroInspect={heroInspect}
      statCards={statCardsWithActions}
      resourceSummary={resourceSummary}
      offensiveEmptyMessage={!loadout.loading ? "No offensive systems loaded." : undefined}
      defensiveEmptyMessage={!loadout.loading ? "No defensive systems loaded." : undefined}
      errorMessage={loadout.error ? "Fitting data unavailable. Check that the fitting API is running." : null}
      debugNode={compatDebugEnabled && compatDebug ? (
        <pre className="fm-error">{JSON.stringify(compatDebug, null, 2)}</pre>
      ) : null}
      selectorDrawer={selectorDrawer}
      selectedDetail={selectedDetailPanel}
      onSelectShip={(shipKey) => {
        const nextSearch = new URLSearchParams(searchParams);
        nextSearch.delete("ship");
        const suffix = nextSearch.size > 0 ? `?${nextSearch.toString()}` : "";
        navigate(`/fitting/${encodeURIComponent(shipKey)}${suffix}`);
      }}
      onSelectOffensiveRow={(id) => {
        const selection = offensiveDisplaySelections.find((entry) => entry.selectionPortId === id);
        if (selection) selectWeaponSelection(selection);
      }}
      onSelectDefensiveRow={selectPort}
      onExitInspect={closeSelector}
      onViewHeroDetails={() => setWeaponStatsOpen(true)}
      onStatCardAction={(key) => {
        if (key === "performance") setWeaponStatsOpen(true);
      }}
    />
  );
}
