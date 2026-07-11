import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import FittingMockupShell from "../components/fitting/mockup/FittingMockupShell";
import FittingSelectorDrawer from "../components/fitting/mockup/FittingSelectorDrawer";
import PowerCardContent from "../components/fitting/mockup/PowerCardContent";
import {
  getFittingComponent,
  type FittingComponentDetail,
  type FittingComponentMitigation,
  type FittingComponentSummary,
} from "../lib/fitting/fittingApi";
import { getFittingSlotIcon } from "../lib/fitting/getFittingSlotIcon";
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
import { useTurretGroupCompatibleComponents } from "../lib/fitting/useTurretGroupCompatibleComponents";
import {
  FITTING_MOCKUP_POLARIS_SHIP_KEY,
  isFittingShipGuid,
  resolveMockupShipKey,
} from "../lib/fitting/mockup/fittingMockupShipResolve";

const MAIN_TABS = [
  "Overview",
  "Loadout",
  "Compare",
  "Hardpoints",
  "Shopping List",
  "Damage Lab",
  "Weapon Stats",
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

function ComponentStatsDrawer({ detail, loading }: { detail: FittingComponentDetail | null; loading: boolean }) {
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

  return (
    <div className="fm-detail-drawer">
      <section className="fm-detail-section">
        <h4>Damage</h4>
        <DetailStatRow label="Alpha Strike" value={statText(stats?.alphaDamage)} tone="accent" />
        <DetailStatRow label="Sustained DPS" value={statText(resolveDrawerWeaponDps(stats))} tone={resolveDrawerWeaponDps(stats) == null ? "muted" : "default"} nested />
        <DetailStatRow label="Damage Type" value={damageType ?? "Not calculated yet"} nested />
      </section>
      <section className="fm-detail-section">
        <h4>Projectile</h4>
        <DetailStatRow label="Velocity" value={statText(stats?.projectileSpeed, " m/s")} tone="accent" />
        <DetailStatRow label="Range" value={statText(stats?.calculatedRange, " m")} tone={stats?.calculatedRange == null ? "muted" : "default"} nested />
      </section>
      <section className="fm-detail-section">
        <h4>Power / Signature</h4>
        <DetailStatRow label="Power Draw" value={statText(stats?.powerDraw, " MW")} tone={stats?.powerDraw == null ? "muted" : "default"} />
        <DetailStatRow label="EM Signature" value={statText(stats?.electromagneticEmission)} tone="muted" nested />
      </section>
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
  const [searchParams] = useSearchParams();
  const queryShip = searchParams.get("ship");
  const initialShipKey = queryShip && isFittingShipGuid(queryShip)
    ? queryShip
    : FITTING_MOCKUP_POLARIS_SHIP_KEY;
  const [mainTab] = useState<(typeof MAIN_TABS)[number]>("Overview");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [weaponStatsOpen, setWeaponStatsOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<FittingComponentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [armorMitigations, setArmorMitigations] = useState<Array<Extract<FittingComponentMitigation, { kind: "armor" }>>>([]);
  const [shieldMitigations, setShieldMitigations] = useState<Array<Extract<FittingComponentMitigation, { kind: "shield" }>>>([]);
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

  useEffect(() => {
    if (!loadoutShips.length || !queryShip || isFittingShipGuid(queryShip)) return;
    const resolved = resolveMockupShipKey(queryShip, loadoutShips);
    if (resolved !== loadoutSelectedShipKey) loadoutSelectShip(resolved);
  }, [loadoutShips, loadoutSelectedShipKey, loadoutSelectShip, queryShip]);

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

    if (armorIds.length === 0) { setArmorMitigations([]); return; }

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
    const shieldIds = loadout.portRows
      .filter((row) => {
        const text = `${row.ruleCategory ?? ""} ${row.portCategory ?? ""}`.toLowerCase();
        return row.equippedComponentKey && text.includes("shield");
      })
      .map((row) => row.equippedComponentKey!)
      .filter((id, index, values) => values.indexOf(id) === index);

    if (shieldIds.length === 0) { setShieldMitigations([]); return; }

    const controller = new AbortController();
    void (async () => {
      const next: Array<Extract<FittingComponentMitigation, { kind: "shield" }>> = [];
      for (const componentId of shieldIds) {
        try {
          const detail = await getFittingComponent(componentId, controller.signal);
          if (controller.signal.aborted) return;
          if (detail.mitigation?.kind === "shield") next.push(detail.mitigation);
        } catch {
          if (controller.signal.aborted) return;
        }
      }
      if (!controller.signal.aborted) setShieldMitigations(next);
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
  const fittingValid = !loadout.error && Boolean(loadout.calculateResult);
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
      setSelectedDetail(await getFittingComponent(componentId));
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
  const resourceSummary = buildResourceSummary(loadout.calculateResult, fittingValid);
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
      {weaponStatsOpen ? <ComponentStatsDrawer detail={selectedDetail} loading={detailLoading} /> : null}
    </div>
  ) : null;

  const statCardsWithActions = buildStatCards({
    loadout,
    combatStats,
    armorMitigations,
    shieldMitigations,
    powerCardContent: (
      <PowerCardContent calculateResult={loadout.calculateResult} />
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
      onClose={() => setSelectorOpen(false)}
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
      onSelectShip={(shipKey) => loadout.selectShip(shipKey)}
      onSelectOffensiveRow={(id) => {
        const selection = offensiveDisplaySelections.find((entry) => entry.selectionPortId === id);
        if (selection) selectWeaponSelection(selection);
      }}
      onSelectDefensiveRow={selectPort}
      onExitInspect={() => setSelectorOpen(false)}
      onViewHeroDetails={() => setWeaponStatsOpen(true)}
      onStatCardAction={(key) => {
        if (key === "performance") setWeaponStatsOpen(true);
      }}
      onSaveLoadout={() => {
        /* Save wiring preserved — no remote persistence in mockup yet */
      }}
    />
  );
}
