import {
  PIP_MAX_PER_CATEGORY,
  type PipAssignment,
  type PipCategory,
} from "../../../lib/fitting/fittingTerminalTypes";
import { formatNumber } from "../../../lib/fitting/fittingPortGrouping";
import type { PipSystemPowerDraw } from "../../../lib/fitting/fittingPipPower";
import { sumPipAssignment } from "../../../lib/fitting/fittingPipPower";
import FittingMetricPanel from "./FittingMetricPanel";
import PowerPipIcon from "./PowerPipIcons";

type PipColumnDef = {
  key: PipCategory;
  label: string;
  iconLabel: string;
};

const pipColumns: PipColumnDef[] = [
  { key: "weapons", label: "WPN", iconLabel: "Weapons" },
  { key: "engines", label: "ENG", iconLabel: "Engines" },
  { key: "quantum", label: "QT", iconLabel: "Quantum" },
  { key: "radar", label: "RAD", iconLabel: "Radar" },
  { key: "lifeSupport", label: "LSS", iconLabel: "Life Support" },
  { key: "cooler1", label: "CL1", iconLabel: "Cooler" },
  { key: "cooler2", label: "CL2", iconLabel: "Cooler" },
];

type PowerPipAssignmentProps = {
  pipAssignment: PipAssignment;
  systemDraws: PipSystemPowerDraw;
  powerBudget: number | null;
  onPipChange: (category: PipCategory, value: number) => void;
  reactorOutput: string;
  totalDraw: string;
  margin: string;
  marginHighlight?: "good" | "bad";
  panelTitle?: string;
};

function formatMw(value: number): string {
  return `${formatNumber(value)} MW`;
}

type PipSegmentState = "off" | "on" | "over";

function buildPipSegmentStates(
  assignment: PipAssignment,
  budget: number | null,
): Record<PipCategory, PipSegmentState[]> {
  let budgetRemaining = budget != null && Number.isFinite(budget) ? budget : Number.POSITIVE_INFINITY;
  const states = {} as Record<PipCategory, PipSegmentState[]>;

  for (const { key } of pipColumns) {
    const level = assignment[key];
    const bottomUp: PipSegmentState[] = [];

    for (let fromBottom = 0; fromBottom < PIP_MAX_PER_CATEGORY; fromBottom += 1) {
      const isFilled = fromBottom < level;

      if (!isFilled) {
        bottomUp.push("off");
      } else if (budgetRemaining > 0) {
        bottomUp.push("on");
        budgetRemaining -= 1;
      } else {
        bottomUp.push("over");
      }
    }

    states[key] = bottomUp.reverse();
  }

  return states;
}

export default function PowerPipAssignment({
  pipAssignment,
  systemDraws,
  powerBudget,
  onPipChange,
  panelTitle = "Power Assignment",
}: PowerPipAssignmentProps) {
  const assignedTotal = sumPipAssignment(pipAssignment);
  const budget = powerBudget != null && Number.isFinite(powerBudget) ? powerBudget : null;
  const overBudget = budget != null && assignedTotal > budget;
  const overage = overBudget ? assignedTotal - budget! : 0;

  const outputPrimary = budget != null
    ? overBudget
      ? `-${formatNumber(overage)}`
      : formatNumber(assignedTotal)
    : String(assignedTotal);
  const outputSecondary = budget != null ? formatNumber(budget) : "—";
  const segmentStates = buildPipSegmentStates(pipAssignment, budget);

  return (
    <FittingMetricPanel title={panelTitle}>
      <div className="fit-mfd">
        <div className="fit-mfd-board" role="group" aria-label="Power pip board">
          <div className="fit-mfd-output">
            <span className="fit-mfd-output-label">Output</span>
            <strong
              className={[
                "fit-mfd-output-value",
                overBudget ? "fit-mfd-output-value--over" : "",
              ].filter(Boolean).join(" ")}
            >
              {outputPrimary}
              <span> / {outputSecondary}</span>
            </strong>
            <span className="fit-mfd-output-note">
              {budget != null ? "Assigned MW / reactor output" : "Assigned MW"}
            </span>
          </div>

          <div className="fit-mfd-columns">
            {pipColumns.map(({ key, label, iconLabel }) => {
              const level = pipAssignment[key];
              const draw = systemDraws[key];
              return (
                <div key={key} className="fit-mfd-col">
                  
                  <div className="fit-mfd-pip-stack" aria-label={`${iconLabel} ${level} of ${PIP_MAX_PER_CATEGORY} MW allocated`}>
                    {segmentStates[key].map((state, slotFromTop) => {
                      const fromBottom = PIP_MAX_PER_CATEGORY - 1 - slotFromTop;
                      const isActiveEdge = fromBottom === level - 1 && level > 0;
                      return (
                        <span
                          key={slotFromTop}
                          className={[
                            "fit-mfd-pip",
                            state === "on" ? "is-on" : "",
                            state === "over" ? "is-over" : "",
                            isActiveEdge ? "is-edge" : "",
                          ].filter(Boolean).join(" ")}
                        />
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="fit-mfd-step"
                    aria-label={`Increase ${iconLabel} allocation`}
                    onClick={() => onPipChange(key, level + 1)}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="fit-mfd-step"
                    aria-label={`Decrease ${iconLabel} allocation`}
                    onClick={() => onPipChange(key, level - 1)}
                  >
                    −
                  </button>
                  <span className="fit-mfd-col-draw" title="Fitted component draw">
                    {formatMw(draw)}
                  </span>
                  <div className="fit-mfd-icon-cell" title={iconLabel}>
                    <PowerPipIcon category={key} className="fit-mfd-icon" />
                  </div>
                  <span className="fit-mfd-col-label">{label}</span>
                  
                </div>
                
              );
            })}
          </div>
        </div>
      </div>
    </FittingMetricPanel>
  );
}
