import assert from "node:assert/strict";
import test from "node:test";
import type { FittingSimulationResult } from "../fittingApi";
import type { FittingSimulationState } from "../useFittingSimulation";
import { buildPowerCardHeaderView } from "./buildPowerCardViews";

function simulationState(values: {
  allocated: number | null;
  capacity: number | null;
  coolingCapacity: number | null;
  coolingDemand: number | null;
  utilization: number | null;
}): FittingSimulationState {
  const metric = (value: number | null) => ({
    value,
    provenance: value == null ? "unavailable" as const : "derived" as const,
    formula: null,
    sources: [],
  });

  return {
    loading: false,
    error: null,
    data: {
      power: {
        allocatedSegments: metric(values.allocated),
        capacitySegments: metric(values.capacity),
        marginSegments: metric(
          values.allocated != null && values.capacity != null
            ? values.capacity - values.allocated
            : null,
        ),
      },
      cooling: {
        capacity: metric(values.coolingCapacity),
        demand: metric(values.coolingDemand),
        utilizationPercent: metric(values.utilization),
      },
    } as FittingSimulationResult,
  };
}

test("power card uses simulation allocation, capacity, and cooling utilization", () => {
  const view = buildPowerCardHeaderView(simulationState({
    allocated: 13,
    capacity: 17,
    coolingCapacity: 48,
    coolingDemand: 4,
    utilization: 8.333,
  }));

  assert.deepEqual(view.output, {
    allocated: 13,
    total: 17,
    overBudget: false,
    unavailable: false,
    loading: false,
    status: null,
  });
  assert.equal(view.cooling.label, "8.3%");
  assert.equal(view.cooling.fillPct, 8.333);
  assert.equal(view.cooling.overCapacity, false);
  assert.equal(view.cooling.unavailable, false);
});

test("power card reports server-unavailable metrics instead of fabricating values", () => {
  const view = buildPowerCardHeaderView(simulationState({
    allocated: null,
    capacity: null,
    coolingCapacity: null,
    coolingDemand: null,
    utilization: null,
  }));

  assert.equal(view.output.allocated, null);
  assert.equal(view.output.total, null);
  assert.equal(view.output.unavailable, true);
  assert.match(view.output.status ?? "", /Foundry inputs/);
  assert.equal(view.cooling.label, "Unavailable");
  assert.equal(view.cooling.fillPct, 0);
  assert.equal(view.cooling.unavailable, true);
});

test("power card preserves loading and API error states", () => {
  const loading = buildPowerCardHeaderView({ data: null, loading: true, error: null });
  assert.equal(loading.output.loading, true);
  assert.equal(loading.output.status, "Updating simulation…");
  assert.equal(loading.cooling.label, "Updating…");

  const failed = buildPowerCardHeaderView({ data: null, loading: false, error: "request failed" });
  assert.equal(failed.output.status, "Simulation unavailable: request failed");
  assert.equal(failed.cooling.status, "Simulation unavailable: request failed");
});
