import { useEffect, useMemo, useState } from "react";
import { getFittingComponent } from "./fittingApi";
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

    const controller = new AbortController();
    queueMicrotask(() => setLoading(true));

    void (async () => {
      const next: Record<string, { powerDraw?: number | null }> = {};
      for (const componentId of componentIds) {
        try {
          const detail = await getFittingComponent(componentId, controller.signal);
          if (controller.signal.aborted) return;
          next[componentId] = detail.stats;
        } catch {
          if (controller.signal.aborted) return;
          next[componentId] = {};
        }
      }
      if (!controller.signal.aborted) {
        setStatsByComponentId(next);
        setLoading(false);
      }
    })();

    return () => controller.abort();
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
