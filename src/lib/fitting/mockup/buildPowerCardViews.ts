import type { FittingSimulationState } from "../useFittingSimulation";
import type { PowerCardHeaderView } from "./fittingMockupViewTypes";

function formatCoolingCoverageLabel(coveragePct: number): string {
  if (coveragePct > 100) return "100%+";
  if (coveragePct >= 100) return "100%";
  const rounded = Math.round(coveragePct * 10) / 10;
  if (Number.isInteger(rounded)) return `${rounded}%`;
  return `${rounded}%`;
}

export function buildPowerCardHeaderView(
  simulation: FittingSimulationState,
): PowerCardHeaderView {
  const allocated = simulation.data?.power.allocatedSegments.value ?? null;
  const capacity = simulation.data?.power.capacitySegments.value ?? null;
  const utilizationPct = simulation.data?.cooling.utilizationPercent.value ?? null;
  const coolingDemand = simulation.data?.cooling.demand.value ?? null;
  const coolingCapacity = simulation.data?.cooling.capacity.value ?? null;
  const powerUnavailable = !simulation.loading && (allocated == null || capacity == null);
  const coolingUnavailable = !simulation.loading && utilizationPct == null;

  const unavailableStatus = simulation.error
    ? `Simulation unavailable: ${simulation.error}`
    : "Required Foundry inputs are unavailable";

  return {
    output: {
      allocated,
      total: capacity,
      overBudget: allocated != null && capacity != null && allocated > capacity,
      unavailable: powerUnavailable,
      loading: simulation.loading,
      status: simulation.loading ? "Updating simulation…" : powerUnavailable ? unavailableStatus : null,
    },
    cooling: {
      label: simulation.loading
        ? "Updating…"
        : utilizationPct != null ? formatCoolingCoverageLabel(utilizationPct) : "Unavailable",
      fillPct: utilizationPct != null ? Math.min(100, Math.max(0, utilizationPct)) : 0,
      unavailable: coolingUnavailable,
      overCapacity: coolingDemand != null && coolingCapacity != null && coolingDemand > coolingCapacity,
      loading: simulation.loading,
      status: simulation.loading ? "Updating simulation…" : coolingUnavailable ? unavailableStatus : null,
    },
  };
}
