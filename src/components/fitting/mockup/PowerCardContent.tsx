import { useMemo, useState } from "react";
import type { FittingCalculateResult } from "../../../lib/fitting/fittingApi";
import { derivedNum } from "../../../components/fitting/terminal/fittingPerformanceHelpers";
import { buildPowerCardHeaderView } from "../../../lib/fitting/mockup/buildPowerCardViews";
import MockPowerPipHud from "./MockPowerPipHud";
import { INITIAL_MOCK_PIP_ASSIGNMENT, sumMockPipAssignment } from "./mockPipAssignment";
import PowerStatusHeader from "./PowerStatusHeader";

type PowerCardContentProps = {
  calculateResult: FittingCalculateResult | null;
};

export default function PowerCardContent({ calculateResult }: PowerCardContentProps) {
  const [assignedTotal, setAssignedTotal] = useState(() => sumMockPipAssignment(INITIAL_MOCK_PIP_ASSIGNMENT));

  const powerBudget = useMemo(() => {
    const reactorOutput = derivedNum(calculateResult, "power", "totalPowerGenerated");
    return reactorOutput != null ? Math.round(reactorOutput) : null;
  }, [calculateResult]);

  const powerHeader = useMemo(
    () => buildPowerCardHeaderView(calculateResult, assignedTotal),
    [calculateResult, assignedTotal],
  );

  const handleAssignmentChange = (assignment: typeof INITIAL_MOCK_PIP_ASSIGNMENT) => {
    setAssignedTotal(sumMockPipAssignment(assignment));
  };

  return (
    <>
      <PowerStatusHeader header={powerHeader} />
      <div className="fit-mock-pips fit-mock-pips--card" aria-label="Power Management">
        <MockPowerPipHud hideOutputFooter powerBudget={powerBudget} onAssignmentChange={handleAssignmentChange} />
      </div>
    </>
  );
}
