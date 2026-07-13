import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import FittingTerminalPage from "../components/fitting/terminal/FittingTerminalPage";
import {
  calculateFittingLoadout,
  getFittingHardpoints,
  getFittingLoadout,
  getFittingShip,
  isDisplayableFittingShip,
  listFittingComponents,
  listFittingShips,
  type FittingCalculateResult,
} from "../lib/fitting/fittingApi";
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
} from "../lib/fitting/fittingPortGrouping";
import { getCraftingItemByBlueprintGuid } from "../lib/craftingData";
import {
  readFittingIconMode,
  type FittingIconMode,
} from "../lib/fitting/fittingIconMode";
import "../pages/fitting-terminal.css";

type LoadState<T> = {
  status: "idle" | "loading" | "loaded" | "error";
  data: T | null;
};

const emptyLoad = <T,>(): LoadState<T> => ({ status: "idle", data: null });

export default function FittingPage() {
  const { shipKey: routeShipKey } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [shipsState, setShipsState] = useState<LoadState<FittingShipSummary[]>>(emptyLoad);
  const [shipState, setShipState] = useState<LoadState<FittingShipDetail>>(emptyLoad);
  const [basePortRows, setBasePortRows] = useState<LoadState<PortBreakdownRow[]>>(emptyLoad);
  const [calculateState, setCalculateState] = useState<LoadState<FittingCalculateResult>>(emptyLoad);
  const [componentsState, setComponentsState] = useState<LoadState<FittingComponentRecord[]>>(emptyLoad);
  const [craftablePortIds, setCraftablePortIds] = useState<Set<string>>(new Set());
  const [iconMode] = useState<FittingIconMode>(() => readFittingIconMode());

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setShipsState({ status: "loading", data: null });
    });
    listFittingShips(controller.signal)
      .then((records) => {
        if (controller.signal.aborted) return;
        setShipsState({ status: "loaded", data: records.filter(isDisplayableFittingShip).map(adaptShipSummary) });
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
  const selectedShipKey = routeShipKey ?? searchParams.get("ship") ?? ships[0]?.shipKey ?? null;

  useEffect(() => {
    if (!routeShipKey && !searchParams.get("ship") && selectedShipKey) {
      navigate(`/fitting/${selectedShipKey}`, { replace: true });
    }
  }, [navigate, routeShipKey, searchParams, selectedShipKey]);

  useEffect(() => {
    if (!selectedShipKey) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setShipState({ status: "loading", data: null });
      setBasePortRows({ status: "loading", data: null });
      setCalculateState({ status: "loading", data: null });
      setCraftablePortIds(new Set());
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
        const { portBreakdown, loadoutMap } = adaptLoadout(selectedShipKey, ports, entries);
        setBasePortRows({ status: "loaded", data: portBreakdown });

        const calculateResult = await calculateFittingLoadout(
          { shipId: selectedShipKey, loadout: loadoutMap, options: { compareToStock: true } },
          controller.signal,
        );
        if (!controller.signal.aborted) setCalculateState({ status: "loaded", data: calculateResult });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setBasePortRows({ status: "error", data: null });
          setCalculateState({ status: "error", data: null });
        }
      });

    return () => controller.abort();
  }, [selectedShipKey]);

  const componentLookup = useMemo(() => {
    const lookup = new Map<string, FittingComponentRecord>();
    for (const component of componentsState.data ?? []) lookup.set(component.componentKey, component);
    return lookup;
  }, [componentsState.data]);

  const enrichedPortRows = useMemo(() => {
    const rows = basePortRows.data ?? [];
    if (componentLookup.size === 0) return rows;
    return enrichPortRows(rows, componentLookup);
  }, [basePortRows.data, componentLookup]);

  useEffect(() => {
    const rows = basePortRows.data ?? [];
    if (rows.length === 0) return;

    let cancelled = false;
    const componentIds = [...new Set(rows.map((row) => row.equippedComponentKey).filter(Boolean))] as string[];

    void (async () => {
      const craftable = new Set<string>();
      await Promise.all(componentIds.map(async (componentId) => {
        const recipe = await getCraftingItemByBlueprintGuid(componentId);
        if (!recipe) return;
        for (const row of rows) {
          if (row.equippedComponentKey === componentId) craftable.add(row.portId);
        }
      }));
      if (!cancelled) setCraftablePortIds(craftable);
    })();

    return () => { cancelled = true; };
  }, [basePortRows.data]);

  const loading = shipState.status === "loading" || basePortRows.status === "loading" || calculateState.status === "loading";

  function selectShip(nextShipKey: string) {
    navigate(`/fitting/${nextShipKey}`);
  }

  return (
    <FittingTerminalPage
      shipId={selectedShipKey}
      ships={ships}
      shipDetail={shipState.data}
      portRows={enrichedPortRows}
      calculateResult={calculateState.data}
      componentLookup={componentLookup}
      craftablePortIds={craftablePortIds}
      loading={loading}
      iconMode={iconMode}
      onSelectShip={selectShip}
      shipsLoading={shipsState.status !== "loaded"}
    />
  );
}
