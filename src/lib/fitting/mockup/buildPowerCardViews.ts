import { derivedNum } from "../../../components/fitting/terminal/fittingPerformanceHelpers";
import type { FittingCalculateResult } from "../fittingApi";
import type { PowerCardHeaderView } from "./fittingMockupViewTypes";

function formatCoolingCoverageLabel(coveragePct: number): string {
  if (coveragePct > 100) return "100%+";
  if (coveragePct >= 100) return "100%";
  const rounded = Math.round(coveragePct * 10) / 10;
  if (Number.isInteger(rounded)) return `${rounded}%`;
  return `${rounded}%`;
}

export function buildPowerCardHeaderView(
  calculateResult: FittingCalculateResult | null,
  assignedPips: number,
): PowerCardHeaderView {
  const coolingAvailable = derivedNum(calculateResult, "cooling", "totalCoolingGenerated");
  const coolingRequired = derivedNum(calculateResult, "cooling", "totalCoolingRequired");
  const reactorOutput = derivedNum(calculateResult, "power", "totalPowerGenerated");

  const canCompute = coolingAvailable != null
    && coolingRequired != null
    && coolingRequired > 0;
  const coveragePct = canCompute ? (coolingAvailable / coolingRequired) * 100 : null;
  const overCapacity = coveragePct != null && coveragePct > 100;

  const pipTotal = reactorOutput != null ? Math.max(0, Math.round(reactorOutput)) : null;
  const pipOpen = pipTotal != null ? pipTotal - assignedPips : null;

  return {
    output: {
      open: pipOpen,
      total: pipTotal,
      overBudget: pipOpen != null && pipOpen < 0,
    },
    cooling: {
      label: coveragePct != null ? formatCoolingCoverageLabel(coveragePct) : "Not calculated yet",
      fillPct: coveragePct != null ? Math.min(100, Math.max(0, coveragePct)) : 0,
      unavailable: !canCompute,
      overCapacity,
    },
  };
}
