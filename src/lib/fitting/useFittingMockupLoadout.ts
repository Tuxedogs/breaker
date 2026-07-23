import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  calculateFittingLoadout,
  getFittingHardpoints,
  getFittingLoadout,
  getFittingShip,
  isDisplayableFittingShip,
  listFittingShips,
  validateFittingLoadout,
  type FittingCalculateResult,
} from "./fittingApi";
import { selectFittingResourceGroups } from "./fittingMockupSelectors";
import type { FittingComponentSummary } from "./fittingApi";
import { resolveLoadoutComponentId } from "./fittingItemIdentity";
import {
  isItemCompatibleWithSlot,
  type SlotCompatibilityIndex,
} from "./fittingSlotCompatibility";
import { validationFailureForPort } from "./fittingSlotValidation";
import {
  adaptLoadout,
  adaptShipDetail,
  adaptShipSummary,
  enrichPortRows,
  type FittingComponentRecord,
  type FittingShipDetail,
  type FittingShipSummary,
  type PortBreakdownRow,
} from "./fittingPortGrouping";
import { useEquippedComponentLookup, type EquippedComponentDetailsState } from "./useEquippedComponentDetails";
import { FITTING_MOCKUP_POLARIS_SHIP_KEY } from "./mockup/fittingMockupShipResolve";

type LoadState<T> = {
  status: "idle" | "loading" | "loaded" | "error";
  data: T | null;
};

const emptyLoad = <T,>(): LoadState<T> => ({ status: "idle", data: null });

function applyLoadoutMap(rows: PortBreakdownRow[], loadoutMap: Record<string, string | null>): PortBreakdownRow[] {
  return rows.map((row) => ({
    ...row,
    equippedComponentKey: Object.prototype.hasOwnProperty.call(loadoutMap, row.portId)
      ? loadoutMap[row.portId]
      : row.equippedComponentKey,
  }));
}

function loadoutMapsEqual(
  left: Record<string, string | null>,
  right: Record<string, string | null>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
}

export type FittingMockupLoadoutState = {
  ships: FittingShipSummary[];
  shipsLoading: boolean;
  selectedShipKey: string | null;
  shipDetail: FittingShipDetail | null;
  portRows: PortBreakdownRow[];
  loadoutMap: Readonly<Record<string, string | null>>;
  stockLoadoutMap: Readonly<Record<string, string | null>>;
  calculateResult: FittingCalculateResult | null;
  componentLookup: Map<string, FittingComponentRecord>;
  statsById: EquippedComponentDetailsState["statsById"];
  mitigationById: EquippedComponentDetailsState["mitigationById"];
  equippedDetailsReady: boolean;
  loading: boolean;
  error: boolean;
  isModified: boolean;
  selectShip: (shipKey: string) => void;
  selectPort: (portId: string) => void;
  selectedPortId: string | null;
  installComponent: (
    portId: string,
    item: FittingComponentSummary,
    compatibilityIndex: SlotCompatibilityIndex,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  installTurretGroup: (
    portIds: string[],
    item: FittingComponentSummary,
    compatibilityIndexes: Record<string, SlotCompatibilityIndex>,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  resetLoadout: () => void;
  resourceGroups: ReturnType<typeof selectFittingResourceGroups>;
};

export function useFittingMockupLoadout(initialShipKey?: string | null): FittingMockupLoadoutState {
  const [shipsState, setShipsState] = useState<LoadState<FittingShipSummary[]>>(emptyLoad);
  const [selectedShipKey, setSelectedShipKey] = useState<string | null>(initialShipKey ?? null);
  const [shipState, setShipState] = useState<LoadState<FittingShipDetail>>(emptyLoad);
  const [basePortRows, setBasePortRows] = useState<PortBreakdownRow[]>([]);
  const [stockLoadoutMap, setStockLoadoutMap] = useState<Record<string, string | null>>({});
  const [loadoutMap, setLoadoutMap] = useState<Record<string, string | null>>({});
  const [calculateState, setCalculateState] = useState<LoadState<FittingCalculateResult>>(emptyLoad);
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
  const [shipLoading, setShipLoading] = useState(false);
  const recalculationSequenceRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setShipsState({ status: "loading", data: null });
    });
    listFittingShips(controller.signal)
      .then((records) => {
        if (controller.signal.aborted) return;
        const ships = records.filter(isDisplayableFittingShip).map(adaptShipSummary);
        setShipsState({ status: "loaded", data: ships });
      })
      .catch(() => {
        if (!controller.signal.aborted) setShipsState({ status: "error", data: null });
      });
    return () => controller.abort();
  }, []);

  const ships = useMemo(() => shipsState.data ?? [], [shipsState.data]);

  useEffect(() => {
    if (ships.length === 0) return;
    queueMicrotask(() => {
      setSelectedShipKey((current) => {
        if (initialShipKey && ships.some((ship) => ship.shipKey === initialShipKey)) return initialShipKey;
        if (current && ships.some((ship) => ship.shipKey === current)) return current;
        const validatedMockupShip = ships.find((ship) => ship.shipKey === FITTING_MOCKUP_POLARIS_SHIP_KEY);
        const gladius = ships.find((ship) => ship.name.toLowerCase().includes("gladius"));
        return validatedMockupShip?.shipKey ?? gladius?.shipKey ?? ships[0]?.shipKey ?? null;
      });
    });
  }, [initialShipKey, ships]);

  useEffect(() => {
    if (!selectedShipKey) return;
    recalculationSequenceRef.current += 1;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setShipLoading(true);
      setShipState({ status: "loading", data: null });
      setCalculateState({ status: "loading", data: null });
    });

    getFittingShip(selectedShipKey, controller.signal)
      .then((ship) => {
        if (!controller.signal.aborted) setShipState({ status: "loaded", data: adaptShipDetail(ship) });
      })
      .catch(() => {
        if (!controller.signal.aborted) setShipState({ status: "error", data: null });
      });

    Promise.all([
      getFittingHardpoints(selectedShipKey, controller.signal),
      getFittingLoadout(selectedShipKey, controller.signal),
    ])
      .then(async ([ports, entries]) => {
        if (controller.signal.aborted) return;
        const { portBreakdown, loadoutMap: stockMap } = adaptLoadout(selectedShipKey, ports, entries);
        setBasePortRows(portBreakdown);
        setStockLoadoutMap(stockMap);
        setLoadoutMap(stockMap);
        setSelectedPortId(null);

        const calculateResult = await calculateFittingLoadout(
          { shipId: selectedShipKey, loadout: stockMap, options: { compareToStock: true } },
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setCalculateState({ status: "loaded", data: calculateResult });
          setShipLoading(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCalculateState({ status: "error", data: null });
          setShipLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedShipKey]);

  const appliedRows = useMemo(
    () => applyLoadoutMap(basePortRows, loadoutMap),
    [basePortRows, loadoutMap],
  );
  const equippedDetails = useEquippedComponentLookup(appliedRows);
  const componentLookup = equippedDetails.lookup;

  const portRows = useMemo(() => {
    if (componentLookup.size === 0) return appliedRows;
    return enrichPortRows(appliedRows, componentLookup);
  }, [appliedRows, componentLookup]);

  const isModified = useMemo(
    () => !loadoutMapsEqual(loadoutMap, stockLoadoutMap),
    [loadoutMap, stockLoadoutMap],
  );

  const installComponent = useCallback(async (
    portId: string,
    item: FittingComponentSummary,
    compatibilityIndex: SlotCompatibilityIndex,
  ): Promise<{ ok: true } | { ok: false; reason: string }> => {
    if (!selectedShipKey) return { ok: false, reason: "No ship selected." };

    const slot = portRows.find((row) => row.portId === portId);
    if (!slot) return { ok: false, reason: "Selected slot was not found." };

    const verdict = isItemCompatibleWithSlot({ slot, item, compatibilityIndex });
    if (!verdict.compatible) {
      return { ok: false, reason: verdict.reason ?? "Item is not compatible with this slot." };
    }

    const componentId = resolveLoadoutComponentId(item);
    if (!componentId) {
      return { ok: false, reason: "Selected item has an invalid identifier." };
    }

    const nextLoadout = { ...loadoutMap, [portId]: componentId };
    const sequence = ++recalculationSequenceRef.current;

    try {
      const validation = await validateFittingLoadout({
        shipId: selectedShipKey,
        loadout: nextLoadout,
        options: { compareToStock: true },
      });
      if (sequence !== recalculationSequenceRef.current) return { ok: true };
      const portFailure = validationFailureForPort(validation, portId);
      if (portFailure) {
        return { ok: false, reason: portFailure };
      }
    } catch {
      if (sequence !== recalculationSequenceRef.current) return { ok: true };
      return { ok: false, reason: "Could not validate loadout compatibility." };
    }

    setLoadoutMap(nextLoadout);
    setCalculateState((prev) => ({ status: "loading", data: prev.data }));
    try {
      const result = await calculateFittingLoadout(
        { shipId: selectedShipKey, loadout: nextLoadout, options: { compareToStock: true } },
      );
      if (sequence !== recalculationSequenceRef.current) return { ok: true };
      setCalculateState({ status: "loaded", data: result });
    } catch {
      if (sequence !== recalculationSequenceRef.current) return { ok: true };
      setLoadoutMap(loadoutMap);
      setCalculateState((previous) => ({ status: "error", data: previous.data }));
      return { ok: false, reason: "Installed item failed to recalculate loadout stats." };
    }

    return { ok: true };
  }, [loadoutMap, portRows, selectedShipKey]);

  const installTurretGroup = useCallback(async (
    portIds: string[],
    item: FittingComponentSummary,
    compatibilityIndexes: Record<string, SlotCompatibilityIndex>,
  ): Promise<{ ok: true } | { ok: false; reason: string }> => {
    if (!selectedShipKey) return { ok: false, reason: "No ship selected." };
    if (portIds.length === 0) return { ok: false, reason: "No turret gun ports selected." };

    const componentId = resolveLoadoutComponentId(item);
    if (!componentId) {
      return { ok: false, reason: "Selected item has an invalid identifier." };
    }

    const nextLoadout = { ...loadoutMap };
    const sequence = ++recalculationSequenceRef.current;
    for (const portId of portIds) {
      const slot = portRows.find((row) => row.portId === portId);
      const compatibilityIndex = compatibilityIndexes[portId];
      if (!slot || !compatibilityIndex) {
        return { ok: false, reason: "Selected turret gun port was not found." };
      }

      const verdict = isItemCompatibleWithSlot({ slot, item, compatibilityIndex });
      if (!verdict.compatible) {
        return { ok: false, reason: verdict.reason ?? "Item is not compatible with every gun in this turret." };
      }

      nextLoadout[portId] = componentId;
    }

    try {
      const validation = await validateFittingLoadout({
        shipId: selectedShipKey,
        loadout: nextLoadout,
        options: { compareToStock: true },
      });
      if (sequence !== recalculationSequenceRef.current) return { ok: true };
      for (const portId of portIds) {
        const portFailure = validationFailureForPort(validation, portId);
        if (portFailure) {
          return { ok: false, reason: portFailure };
        }
      }
    } catch {
      if (sequence !== recalculationSequenceRef.current) return { ok: true };
      return { ok: false, reason: "Could not validate loadout compatibility." };
    }

    setLoadoutMap(nextLoadout);
    setCalculateState((prev) => ({ status: "loading", data: prev.data }));
    try {
      const result = await calculateFittingLoadout(
        { shipId: selectedShipKey, loadout: nextLoadout, options: { compareToStock: true } },
      );
      if (sequence !== recalculationSequenceRef.current) return { ok: true };
      setCalculateState({ status: "loaded", data: result });
    } catch {
      if (sequence !== recalculationSequenceRef.current) return { ok: true };
      setLoadoutMap(loadoutMap);
      setCalculateState((previous) => ({ status: "error", data: previous.data }));
      return { ok: false, reason: "Installed item failed to recalculate loadout stats." };
    }

    return { ok: true };
  }, [loadoutMap, portRows, selectedShipKey]);

  const resetLoadout = useCallback(() => {
    if (!selectedShipKey) return;
    const sequence = ++recalculationSequenceRef.current;
    setLoadoutMap(stockLoadoutMap);
    setCalculateState({ status: "loading", data: null });
    void calculateFittingLoadout(
      { shipId: selectedShipKey, loadout: stockLoadoutMap, options: { compareToStock: true } },
    )
      .then((result) => {
        if (sequence === recalculationSequenceRef.current) {
          setCalculateState({ status: "loaded", data: result });
        }
      })
      .catch(() => {
        if (sequence === recalculationSequenceRef.current) {
          setCalculateState({ status: "error", data: null });
        }
      });
  }, [selectedShipKey, stockLoadoutMap]);

  const resourceGroups = useMemo(() => selectFittingResourceGroups(portRows), [portRows]);

  return {
    ships,
    shipsLoading: shipsState.status !== "loaded",
    selectedShipKey,
    shipDetail: shipState.data,
    portRows,
    loadoutMap,
    stockLoadoutMap,
    calculateResult: calculateState.data,
    componentLookup,
    statsById: equippedDetails.statsById,
    mitigationById: equippedDetails.mitigationById,
    equippedDetailsReady: equippedDetails.ready,
    loading: shipLoading || calculateState.status === "loading" || shipState.status === "loading",
    error: shipsState.status === "error" || shipState.status === "error" || calculateState.status === "error",
    isModified,
    selectShip: setSelectedShipKey,
    selectPort: setSelectedPortId,
    selectedPortId,
    installComponent,
    installTurretGroup,
    resetLoadout,
    resourceGroups,
  };
}
