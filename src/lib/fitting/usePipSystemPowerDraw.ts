import { useEffect, useMemo, useState } from "react";
import { loadVehicleFittingComponent } from "./fittingComponentStore";
import type { PortBreakdownRow } from "./fittingPortGrouping";
import {
  aggregatePipSystemDraws,
  EMPTY_PIP_DRAWS,
  type PipSystemPowerDraw,
} from "./fittingPipPower";

export type PipSystemPowerState = {
  draws: PipSystemPowerDraw;
  ready: boolean;
  loading: boolean;
};

export function usePipSystemPowerDraw(portRows: PortBreakdownRow[]): PipSystemPowerState {
  const [statsByComponentId, setStatsByComponentId] = useState<Record<string, { powerDraw?: number | null }>>({});
  const [loading, setLoading] = useState(false);

  const componentIds = useMemo(
    () => [...new Set(portRows.map((row) => row.equippedComponentKey).filter(Boolean))] as string[],
    [portRows],
  );

  useEffect(() => {
    if (componentIds.length === 0) {
      queueMicrotask(() => {
        setStatsByComponentId({});
        setLoading(false);
      });
      return;
    }

    let cancelled = false;
    queueMicrotask(() => setLoading(true));

    void (async () => {
      const next: Record<string, { powerDraw?: number | null }> = {};
      for (const componentId of componentIds) {
        try {
          const detail = await loadVehicleFittingComponent(componentId);
          if (cancelled) return;
          next[componentId] = detail.stats;
        } catch {
          if (cancelled) return;
          next[componentId] = {};
        }
      }
      if (!cancelled) {
        setStatsByComponentId(next);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [componentIds]);

  const draws = useMemo(
    () => (componentIds.length === 0 ? { ...EMPTY_PIP_DRAWS } : aggregatePipSystemDraws(portRows, statsByComponentId)),
    [componentIds.length, portRows, statsByComponentId],
  );

  return {
    draws,
    ready: !loading && componentIds.every((id) => id in statsByComponentId),
    loading,
  };
}
