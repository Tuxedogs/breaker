import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import FittingV2Workspace from "../components/fitting-v2/FittingV2Workspace";
import type { FittingV2SelectedTarget } from "../components/fitting-v2/FittingV2Inspector";
import {
  isFittingShipGuid,
  resolveMockupShipKey,
} from "../lib/fitting/mockup/fittingMockupShipResolve";
import { resolveShipHeroAsset } from "../lib/fitting/mockup/fittingMockupAdapters";
import { useFittingMockupLoadout } from "../lib/fitting/useFittingMockupLoadout";
import { usePipSystemPowerDraw } from "../lib/fitting/usePipSystemPowerDraw";
import { useFittingSimulation } from "../lib/fitting/useFittingSimulation";
import { useCompatibleComponents } from "../lib/fitting/useCompatibleComponents";
import { useEquippedComponentDetails } from "../lib/fitting/useEquippedComponentDetails";
import { pipAssignmentFromDrawsUncapped } from "../lib/fitting/fittingPipPower";
import {
  DEFAULT_PIP_ASSIGNMENT,
  type PipAssignment,
  type PipCategory,
} from "../lib/fitting/fittingTerminalTypes";
import {
  buildFittingV2Effects,
  buildFittingV2PerformanceMetrics,
} from "../lib/fitting-v2/fittingV2Presentation";
import { buildFittingV2SlotTopology } from "../lib/fitting-v2/fittingV2SlotTopology";
import { isFittingV2TargetPotentiallyActionable, useFittingV2ChooserCompatibility } from "../lib/fitting-v2/fittingV2ChooserCompatibility";
import { applyFittingV2PowerRequest } from "../lib/fitting-v2/fittingV2PowerState";
import FittingV2CompatibleChooser from "../components/fitting-v2/FittingV2CompatibleChooser";
import type { FittingComponentSummary } from "../lib/fitting/fittingApi";
import "../components/fitting-v2/fitting-v2.css";

export default function FittingV2Page() {
  const { shipKey: routeShipKey } = useParams<{ shipKey: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryShip = searchParams.get("ship");
  const requestedShipKey = routeShipKey ?? queryShip;
  const initialShipKey = requestedShipKey && isFittingShipGuid(requestedShipKey)
    ? requestedShipKey
    : null;
  const loadout = useFittingMockupLoadout(initialShipKey);
  const { selectedShipKey, selectShip: selectLoadoutShip, ships } = loadout;
  const [pipAssignment, setPipAssignment] = useState<PipAssignment>({ ...DEFAULT_PIP_ASSIGNMENT });
  const [selectedTargetState, setSelectedTargetState] = useState<{ shipKey: string | null; target: FittingV2SelectedTarget } | null>(null);
  const [chooserTargetState, setChooserTargetState] = useState<{ shipKey: string | null; target: FittingV2SelectedTarget; anchor: HTMLButtonElement } | null>(null);
  const [chooserError, setChooserError] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const pipSyncedShipRef = useRef<string | null>(null);
  const pipPower = usePipSystemPowerDraw(
    loadout.portRows,
    loadout.statsById,
    !loadout.equippedDetailsReady,
  );
  const simulation = useFittingSimulation(
    selectedShipKey,
    loadout.portRows,
    pipAssignment,
    !loadout.loading && pipPower.ready,
  );

  useEffect(() => {
    const shipKey = selectedShipKey;
    if (!shipKey || !pipPower.ready || loadout.portRows.length === 0) return;
    if (loadout.portRows.some((row) => row.shipKey !== shipKey)) return;
    if (pipSyncedShipRef.current === shipKey) return;
    pipSyncedShipRef.current = shipKey;
    queueMicrotask(() => setPipAssignment({
      ...pipAssignmentFromDrawsUncapped(pipPower.draws),
      quantum: 0,
    }));
  }, [loadout.portRows, pipPower.draws, pipPower.ready, selectedShipKey]);

  useEffect(() => {
    if (!ships.length) return;
    const resolvedRequest = requestedShipKey
      ? resolveMockupShipKey(requestedShipKey, ships)
      : selectedShipKey ?? resolveMockupShipKey(null, ships);
    const resolvedShipKey = ships.some((candidate) => candidate.shipKey === resolvedRequest)
      ? resolvedRequest
      : selectedShipKey && ships.some((candidate) => candidate.shipKey === selectedShipKey)
        ? selectedShipKey
        : ships[0]?.shipKey ?? null;
    if (!resolvedShipKey) return;

    if (resolvedShipKey !== selectedShipKey) selectLoadoutShip(resolvedShipKey);
    if (routeShipKey !== resolvedShipKey || queryShip) {
      const nextSearch = new URLSearchParams(searchParams);
      nextSearch.delete("ship");
      const suffix = nextSearch.size > 0 ? `?${nextSearch.toString()}` : "";
      navigate(`/fitting-v2/${encodeURIComponent(resolvedShipKey)}${suffix}`, { replace: true });
    }
  }, [navigate, queryShip, requestedShipKey, routeShipKey, searchParams, selectLoadoutShip, selectedShipKey, ships]);

  const ship = loadout.shipDetail?.ship;
  const heroAsset = useMemo(() => resolveShipHeroAsset({
    shipKey: selectedShipKey,
    manufacturer: ship?.manufacturer ?? null,
    name: ship?.name ?? "Selected ship",
  }), [selectedShipKey, ship?.manufacturer, ship?.name]);
  const performanceMetrics = useMemo(() => buildFittingV2PerformanceMetrics({
    ship,
    hullHp: loadout.shipDetail?.hullHP ?? loadout.shipDetail?.mitigation?.hullHp,
    calculateResult: loadout.calculateResult,
  }), [loadout.calculateResult, loadout.shipDetail, ship]);
  const topology = useMemo(
    () => buildFittingV2SlotTopology(loadout.portRows),
    [loadout.portRows],
  );
  const effects = useMemo(
    () => buildFittingV2Effects(simulation.data),
    [simulation.data],
  );
  const selectedTarget = selectedTargetState?.shipKey === selectedShipKey ? selectedTargetState.target : null;
  const selectedSlot = selectedTarget
    ? loadout.portRows.find((row) => row.portId === selectedTarget.compatibilityPortId) ?? null
    : null;
  const compatible = useCompatibleComponents(selectedShipKey, selectedSlot, Boolean(selectedSlot));
  const chooserTarget = chooserTargetState?.shipKey === selectedShipKey ? chooserTargetState.target : null;
  const chooserCompatibility = useFittingV2ChooserCompatibility(selectedShipKey, chooserTarget, loadout.portRows);
  const chooserCandidateIds = chooserCompatibility.result?.components.map((item) => item.id) ?? [];
  const chooserDetails = useEquippedComponentDetails(chooserCandidateIds);

  function updatePip(category: PipCategory, value: number, physicalBounds?: { minimum: number | null; maximum: number | null }) {
    const metadata = simulation.data?.power.categories[category];
    const maximum = physicalBounds?.maximum ?? metadata?.maximumSegments.value;
    const minimum = physicalBounds?.minimum ?? metadata?.minimumSegments.value;
    setPipAssignment((current) => applyFittingV2PowerRequest(current, category, value, { minimum, maximum }));
  }

  function selectShip(nextShipKey: string) {
    const nextSearch = new URLSearchParams(searchParams);
    nextSearch.delete("ship");
    const suffix = nextSearch.size > 0 ? `?${nextSearch.toString()}` : "";
    navigate(`/fitting-v2/${encodeURIComponent(nextShipKey)}${suffix}`);
  }

  function closeChooser() {
    chooserTargetState?.anchor.focus();
    setChooserTargetState(null);
    setChooserError(null);
  }

  function closeChooserFromOutside() {
    closeChooser();
  }

  function selectTarget(target: FittingV2SelectedTarget, anchor: HTMLButtonElement) {
    setSelectedTargetState({ shipKey: selectedShipKey, target });
    setChooserError(null);
    if (isFittingV2TargetPotentiallyActionable(target)) setChooserTargetState({ shipKey: selectedShipKey, target, anchor });
  }

  async function installCandidate(item: FittingComponentSummary) {
    if (!chooserTarget) return;
    const compatibilityIndex = chooserCompatibility.indexes[chooserTarget.compatibilityPortId];
    if (chooserTarget.replacement !== "rack-payload" && !compatibilityIndex) {
      setChooserError("Compatibility data is not ready for this slot.");
      return;
    }
    setChooserError(null);
    setInstallingId(item.id);
    const result = chooserTarget.replacement === "rack-payload"
      ? await loadout.installRackPayload(chooserTarget.payloadPortIds ?? [], item, chooserCompatibility.indexes)
      : await loadout.installComponent(chooserTarget.compatibilityPortId, item, compatibilityIndex!);
    setInstallingId(null);
    if (!result.ok) {
      setChooserError(result.reason);
      return;
    }
    const installedTarget = { ...chooserTarget, installedComponentId: item.id };
    setSelectedTargetState({ shipKey: selectedShipKey, target: installedTarget });
    setChooserTargetState(null);
  }

  return (
    <>
    <FittingV2Workspace
      ships={loadout.ships}
      shipsLoading={loadout.shipsLoading}
      selectedShipKey={selectedShipKey}
      ship={ship ?? null}
      loadoutModified={loadout.isModified}
      loading={loadout.loading}
      error={loadout.error}
      heroAsset={heroAsset}
      performanceMetrics={performanceMetrics}
      topology={topology}
      pipAssignment={pipAssignment}
      pipDraws={pipPower.draws}
      pipReady={pipPower.ready}
      simulation={simulation}
      effects={effects}
      portRows={loadout.portRows}
      componentAllocations={loadout.calculateResult?.componentAllocations ?? []}
      powerAggregateGeneration={loadout.calculateResult?.categories.power?.aggregateGeneration}
      detailsById={loadout.detailsById}
      selectedTarget={selectedTarget}
      compatible={compatible.result}
      compatibilityLoading={compatible.loading}
      compatibilityError={compatible.error}
      onSelectShip={selectShip}
      onPipChange={updatePip}
      onSelectTarget={selectTarget}
    />
    {chooserTarget ? <div className="fitv2-chooser-scrim" aria-hidden="true" /> : null}
    {chooserTarget ? <FittingV2CompatibleChooser
      target={chooserTarget}
      candidates={chooserCompatibility.result?.components ?? []}
      detailsById={chooserDetails.detailsById}
      detailsLoading={chooserDetails.loading}
      error={chooserError ?? chooserCompatibility.error}
      installingId={installingId}
      anchor={chooserTargetState?.anchor ?? null}
      onClose={closeChooser}
      onOutsideClose={closeChooserFromOutside}
      onInstall={installCandidate}
    /> : null}
    </>
  );
}
