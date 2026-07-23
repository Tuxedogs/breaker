import { useMemo } from "react";
import type { PipAssignment, PipCategory } from "../../../lib/fitting/fittingTerminalTypes";
import type { FittingSimulationState } from "../../../lib/fitting/useFittingSimulation";
import { buildPowerCardHeaderView } from "../../../lib/fitting/mockup/buildPowerCardViews";
import MockPowerPipHud from "./MockPowerPipHud";
import PowerStatusHeader from "./PowerStatusHeader";

type PowerCardContentProps = {
  pipAssignment: PipAssignment;
  simulation: FittingSimulationState;
  onPipChange: (category: PipCategory, value: number) => void;
};

export default function PowerCardContent({ pipAssignment, simulation, onPipChange }: PowerCardContentProps) {
  const powerBudget = simulation.data?.power.capacitySegments.value ?? null;
  const powerHeader = useMemo(
    () => buildPowerCardHeaderView(simulation),
    [simulation],
  );
  const modelNotice = simulation.error
    ? `Simulation unavailable: ${simulation.error}`
    : simulation.data?.missingInputs.find((entry) => (
        entry.path === "powerAllocation" || entry.path === "powerCategory"
      ))?.reason
      ?? simulation.data?.assumptions.find((entry) => entry.includes("Heat"))
      ?? null;

  return (
    <>
      <PowerStatusHeader header={powerHeader} />
      {modelNotice ? <p className="fm-power-model-note" role="status">{modelNotice}</p> : null}
      <div className="fit-mock-pips fit-mock-pips--card" aria-label="Power Management">
        <MockPowerPipHud
          hideOutputFooter
          assignment={pipAssignment}
          powerBudget={powerBudget}
          simulation={simulation}
          onPipChange={onPipChange}
        />
      </div>
    </>
  );
}
