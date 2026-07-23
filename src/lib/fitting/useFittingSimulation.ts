import { useEffect, useMemo, useState } from "react";
import {
  calculateFittingLoadout,
  FITTING_SIMULATION_MODEL_VERSION,
  type FittingSimulationResult,
} from "./fittingApi";
import type { PortBreakdownRow } from "./fittingPortGrouping";
import type { PipAssignment } from "./fittingTerminalTypes";

export type FittingSimulationState = {
  data: FittingSimulationResult | null;
  loading: boolean;
  error: string | null;
};

const EMPTY_STATE: FittingSimulationState = {
  data: null,
  loading: false,
  error: null,
};

type StoredSimulationState = FittingSimulationState & {
  requestKey: string | null;
};

export function useFittingSimulation(
  shipId: string | null,
  portRows: readonly PortBreakdownRow[],
  powerAllocation: PipAssignment,
  enabled = true,
): FittingSimulationState {
  const loadout = useMemo(
    () => Object.fromEntries(portRows.map((row) => [row.portId, row.equippedComponentKey])),
    [portRows],
  );
  const loadoutKey = useMemo(() => JSON.stringify(loadout), [loadout]);
  const allocationKey = useMemo(() => JSON.stringify(powerAllocation), [powerAllocation]);
  const requestKey = shipId ? `${shipId}|${loadoutKey}|${allocationKey}` : null;
  const request = useMemo(() => {
    if (!shipId) return null;
    return {
      shipId,
      loadout: JSON.parse(loadoutKey) as Record<string, string | null>,
      options: { compareToStock: false },
      simulation: {
        modelVersion: FITTING_SIMULATION_MODEL_VERSION,
        durationSeconds: 60,
        powerAllocation: JSON.parse(allocationKey) as PipAssignment,
      },
    };
  }, [allocationKey, loadoutKey, shipId]);
  const [state, setState] = useState<StoredSimulationState>({ ...EMPTY_STATE, requestKey: null });

  useEffect(() => {
    if (!enabled || !request || portRows.length === 0) {
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setState({ data: null, loading: true, error: null, requestKey });
      void calculateFittingLoadout(request, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) {
            setState({ data: result.simulation ?? null, loading: false, error: null, requestKey });
          }
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error.message : "Fitting simulation failed.",
            requestKey,
          });
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, portRows.length, request, requestKey]);

  if (!enabled || !shipId || portRows.length === 0) return EMPTY_STATE;
  if (state.requestKey !== requestKey) return { data: null, loading: true, error: null };
  return state;
}
