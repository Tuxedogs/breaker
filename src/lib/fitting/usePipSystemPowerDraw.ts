import { useMemo } from "react";
import type { PortBreakdownRow } from "./fittingPortGrouping";
import {
  aggregatePipSystemDraws,
  EMPTY_PIP_DRAWS,
  type PipSystemPowerDraw,
} from "./fittingPipPower";
import type { FittingComponentStats } from "./fittingApi";

export type PipSystemPowerState = {
  draws: PipSystemPowerDraw;
  ready: boolean;
  loading: boolean;
};

export function usePipSystemPowerDraw(
  portRows: PortBreakdownRow[],
  statsByComponentId: Record<string, FittingComponentStats>,
  detailsLoading = false,
): PipSystemPowerState {
  const componentIds = useMemo(
    () => [...new Set(portRows.map((row) => row.equippedComponentKey).filter(Boolean))] as string[],
    [portRows],
  );

  const draws = useMemo(
    () => (componentIds.length === 0
      ? { ...EMPTY_PIP_DRAWS }
      : aggregatePipSystemDraws(portRows, statsByComponentId)),
    [componentIds.length, portRows, statsByComponentId],
  );

  const ready = componentIds.length === 0
    || componentIds.every((id) => id in statsByComponentId);

  return {
    draws,
    ready: ready && !detailsLoading,
    loading: detailsLoading || (componentIds.length > 0 && !ready),
  };
}
