import { useCallback, useState } from "react";
import {
  DEFAULT_PIP_ASSIGNMENT,
  PIP_MAX_PER_CATEGORY,
  type CraftQualityOverride,
  type FittingFocusTarget,
  type FittingTerminalTab,
  type PipAssignment,
} from "./fittingTerminalTypes";

const initialPips: PipAssignment = { ...DEFAULT_PIP_ASSIGNMENT };

export function useFittingTerminalState(shipId: string | null) {
  const [activeTab, setActiveTab] = useState<FittingTerminalTab>("overview");
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<FittingFocusTarget | null>(null);
  const [pipAssignment, setPipAssignment] = useState<PipAssignment>(initialPips);
  const [craftOverrides, setCraftOverrides] = useState<Record<string, CraftQualityOverride>>({});
  const [activeCraftPortId, setActiveCraftPortId] = useState<string | null>(null);

  const selectComponent = useCallback((portId: string, componentId: string | null) => {
    if (!shipId) return;
    setSelectedPortId(portId);
    setFocusTarget({
      shipId,
      slotId: portId,
      componentId: componentId ?? undefined,
      source: "missing-anchor",
    });
  }, [shipId]);

  const clearSelection = useCallback(() => {
    setSelectedPortId(null);
    setFocusTarget(null);
  }, []);

  const updatePip = useCallback((category: keyof PipAssignment, value: number) => {
    setPipAssignment((current) => ({
      ...current,
      [category]: Math.max(0, Math.min(PIP_MAX_PER_CATEGORY, Math.round(value))),
    }));
  }, []);

  const syncPipsFromDraws = useCallback((assignment: PipAssignment) => {
    setPipAssignment({ ...assignment });
  }, []);

  const toggleCraftPort = useCallback((portId: string) => {
    setActiveCraftPortId((current) => (current === portId ? null : portId));
  }, []);

  const applyCraftOverride = useCallback((override: CraftQualityOverride) => {
    setCraftOverrides((current) => ({ ...current, [override.portId]: override }));
    setActiveCraftPortId(null);
  }, []);

  const resetCraftOverride = useCallback((portId: string) => {
    setCraftOverrides((current) => {
      const next = { ...current };
      delete next[portId];
      return next;
    });
  }, []);

  return {
    activeTab,
    setActiveTab,
    selectedPortId,
    focusTarget,
    selectComponent,
    clearSelection,
    pipAssignment,
    updatePip,
    syncPipsFromDraws,
    craftOverrides,
    activeCraftPortId,
    setActiveCraftPortId,
    toggleCraftPort,
    applyCraftOverride,
    resetCraftOverride,
  };
}
