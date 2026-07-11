import { useCallback, useEffect, useMemo, useState } from "react";
import {
  calculateFittingLoadout,
  getFittingHardpoints,
  getFittingLoadout,
  getFittingShip,
  isDisplayableFittingShip,
  listFittingComponents,
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
  adaptComponent,
  adaptLoadout,
  adaptShipDetail,
  adaptShipSummary,
  enrichPortRows,
  type FittingComponentRecord,
  type FittingShipDetail,
  type FittingShipSummary,
  type PortBreakdownRow,
} from "./fittingPortGrouping";
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
  calculateResult: FittingCalculateResult | null;
  componentLookup: Map<string, FittingComponentRecord>;
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
  const [selectedShipKey, setSelectedShipKey] = useState<string | null>(initialShipKey ?? FITTING_MOCKUP_POLARIS_SHIP_KEY);
  const [shipState, setShipState] = useState<LoadState<FittingShipDetail>>(emptyLoad);
  const [basePortRows, setBasePortRows] = useState<PortBreakdownRow[]>([]);
  const [stockLoadoutMap, setStockLoadoutMap] = useState<Record<string, string | null>>({});
  const [loadoutMap, setLoadoutMap] = useState<Record<string, string | null>>({});
  const [calculateState, setCalculateState] = useState<LoadState<FittingCalculateResult>>(emptyLoad);
  const [componentsState, setComponentsState] = useState<LoadState<FittingComponentRecord[]>>(emptyLoad);
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
  const [shipLoading, setShipLoading] = useState(false);

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
        setSelectedShipKey((current) => current ?? FITTING_MOCKUP_POLARIS_SHIP_KEY);
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
    listFittingComponents(controller.signal)
      .then((records) => {
        if (controller.signal.aborted) return;
        setComponentsState({ status: "loaded", data: records.map(adaptComponent) });
      })
      .catch(() => {
        if (!controller.signal.aborted) setComponentsState({ status: "error", data: null });
      });
    return () => controller.abort();
  }, []);

  const ships = useMemo(() => shipsState.data ?? [], [shipsState.data]);

  useEffect(() => {
    if (ships.length === 0) return;
    queueMicrotask(() => {
      setSelectedShipKey((current) => {
        if (current && ships.some((ship) => ship.shipKey === current)) return current;
        if (initialShipKey && ships.some((ship) => ship.shipKey === initialShipKey)) return initialShipKey;
        const gladius = ships.find((ship) => ship.name.toLowerCase().includes("gladius"));
        return gladius?.shipKey ?? ships[0]?.shipKey ?? null;
      });
    });
  }, [initialShipKey, ships]);

  useEffect(() => {
    if (!selectedShipKey) return;
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
        const lookup = new Map((componentsState.data ?? []).map((component) => [component.componentKey, component]));
        const enriched = enrichPortRows(portBreakdown, lookup);
        setBasePortRows(enriched);
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
  }, [selectedShipKey, componentsState.data]);

  const componentLookup = useMemo(() => {
    const lookup = new Map<string, FittingComponentRecord>();
    for (const component of componentsState.data ?? []) lookup.set(component.componentKey, component);
    return lookup;
  }, [componentsState.data]);

  const portRows = useMemo(() => {
    const applied = applyLoadoutMap(basePortRows, loadoutMap);
    if (componentLookup.size === 0) return applied;
    return enrichPortRows(applied, componentLookup);
  }, [basePortRows, componentLookup, loadoutMap]);

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

    try {
      const validation = await validateFittingLoadout({
        shipId: selectedShipKey,
        loadout: nextLoadout,
        options: { compareToStock: true },
      });
      const portFailure = validationFailureForPort(validation, portId);
      if (portFailure) {
        return { ok: false, reason: portFailure };
      }
    } catch {
      return { ok: false, reason: "Could not validate loadout compatibility." };
    }

    setLoadoutMap(nextLoadout);
    setCalculateState((prev) => ({ status: "loading", data: prev.data }));
    try {
      const result = await calculateFittingLoadout(
        { shipId: selectedShipKey, loadout: nextLoadout, options: { compareToStock: true } },
      );
      setCalculateState({ status: "loaded", data: result });
    } catch {
      setCalculateState({ status: "error", data: null });
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
      for (const portId of portIds) {
        const portFailure = validationFailureForPort(validation, portId);
        if (portFailure) {
          return { ok: false, reason: portFailure };
        }
      }
    } catch {
      return { ok: false, reason: "Could not validate loadout compatibility." };
    }

    setLoadoutMap(nextLoadout);
    setCalculateState((prev) => ({ status: "loading", data: prev.data }));
    try {
      const result = await calculateFittingLoadout(
        { shipId: selectedShipKey, loadout: nextLoadout, options: { compareToStock: true } },
      );
      setCalculateState({ status: "loaded", data: result });
    } catch {
      setCalculateState({ status: "error", data: null });
      return { ok: false, reason: "Installed item failed to recalculate loadout stats." };
    }

    return { ok: true };
  }, [loadoutMap, portRows, selectedShipKey]);

  const resetLoadout = useCallback(() => {
    if (!selectedShipKey) return;
    setLoadoutMap(stockLoadoutMap);
    setCalculateState({ status: "loading", data: null });
    void calculateFittingLoadout(
      { shipId: selectedShipKey, loadout: stockLoadoutMap, options: { compareToStock: true } },
    )
      .then((result) => setCalculateState({ status: "loaded", data: result }))
      .catch(() => setCalculateState({ status: "error", data: null }));
  }, [selectedShipKey, stockLoadoutMap]);

  const resourceGroups = useMemo(() => selectFittingResourceGroups(portRows), [portRows]);

  return {
    ships,
    shipsLoading: shipsState.status !== "loaded",
    selectedShipKey,
    shipDetail: shipState.data,
    portRows,
    calculateResult: calculateState.data,
    componentLookup,
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
