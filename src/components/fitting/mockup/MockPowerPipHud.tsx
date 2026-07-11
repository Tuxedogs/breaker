import { useEffect, useMemo, useState } from "react";
import PowerPipIcon from "../terminal/PowerPipIcons";
import { resolvePowerChannelLabel } from "../../../lib/fitting/mockup/resolvePowerChannelLabel";
import type { PipAssignment, PipCategory } from "../../../lib/fitting/fittingTerminalTypes";

const MOCK_PIP_TOTAL = 18;
const MOCK_PIP_SEGMENT_COUNT = 8;

type MockPipColumnDef = {
  key: PipCategory;
  min: number;
};

const MOCK_PIP_COLUMNS: MockPipColumnDef[] = [
  { key: "weapons", min: 0 },
  { key: "engines", min: 0 },
  { key: "quantum", min: 3 },
  { key: "radar", min: 0 },
  { key: "lifeSupport", min: 0 },
  { key: "cooler1", min: 0 },
  { key: "cooler2", min: 0 },
];

const INITIAL_MOCK_PIP_ASSIGNMENT: PipAssignment = {
  weapons: 4,
  engines: 2,
  quantum: 3,
  radar: 2,
  lifeSupport: 2,
  cooler1: 2,
  cooler2: 2,
};

export { INITIAL_MOCK_PIP_ASSIGNMENT };

type PipStackPart =
  | { kind: "segment"; slot: number }
  | { kind: "merged"; minSlots: number };

type PipUnitState = "on" | "over";

export function sumMockPipAssignment(assignment: PipAssignment): number {
  return Object.values(assignment).reduce((sum, value) => sum + value, 0);
}

function buildPipStackParts(min: number, segmentCount: number): PipStackPart[] {
  if (min <= 1) {
    return Array.from({ length: segmentCount }, (_, index) => ({
      kind: "segment" as const,
      slot: segmentCount - 1 - index,
    }));
  }
  const parts: PipStackPart[] = [];
  for (let slot = segmentCount - 1; slot >= min; slot -= 1) {
    parts.push({ kind: "segment", slot });
  }
  parts.push({ kind: "merged", minSlots: min });
  return parts;
}

function buildPipUnitStates(assignment: PipAssignment, budget: number | null): Map<string, PipUnitState> {
  let remaining = budget != null && Number.isFinite(budget) ? budget : Number.POSITIVE_INFINITY;
  const result = new Map<string, PipUnitState>();

  for (const { key } of MOCK_PIP_COLUMNS) {
    const level = assignment[key];
    for (let fromBottom = 0; fromBottom < level; fromBottom += 1) {
      const state: PipUnitState = remaining > 0 ? "on" : "over";
      if (remaining > 0) remaining -= 1;
      result.set(`${key}:${fromBottom}`, state);
    }
  }

  return result;
}

function pipUnitState(
  unitStates: Map<string, PipUnitState>,
  category: PipCategory,
  fromBottom: number,
): PipUnitState | null {
  return unitStates.get(`${category}:${fromBottom}`) ?? null;
}

function mergedFillState(
  unitStates: Map<string, PipUnitState>,
  category: PipCategory,
  min: number,
  level: number,
): "off" | "on" | "over" | "partial" {
  if (level <= 0) return "off";
  if (level < min) return "partial";

  const states = Array.from({ length: min }, (_, index) => pipUnitState(unitStates, category, index));
  if (states.every((state) => state === "on")) return "on";
  if (states.every((state) => state === "over")) return "over";
  return "partial";
}

function iconPowerClass(
  level: number,
  category: PipCategory,
  unitStates: Map<string, PipUnitState>,
): "is-off" | "is-powered" | "is-over" {
  if (level <= 0) return "is-off";

  let hasOn = false;
  let hasOver = false;
  for (let fromBottom = 0; fromBottom < level; fromBottom += 1) {
    const state = pipUnitState(unitStates, category, fromBottom);
    if (state === "on") hasOn = true;
    if (state === "over") hasOver = true;
  }

  if (hasOver && !hasOn) return "is-over";
  return "is-powered";
}

function coolerEfficiencyPercent(level: number): number {
  if (level <= 0) return 0;
  return Math.round(35 + (level / MOCK_PIP_SEGMENT_COUNT) * 65);
}

function mockSystemReadout(key: PipCategory, level: number, min: number): string {
  if (key === "cooler1" || key === "cooler2") return `Cooling ${coolerEfficiencyPercent(level)}%`;
  if (key === "quantum") return level >= min ? `Spool ready · ${level} pips` : `Offline · need ${min} min`;
  if (key === "weapons") return level > 0 ? `Weapon regen ${Math.round(40 + level * 8)}%` : "Weapons depowered";
  if (key === "engines") return level > 0 ? `Thrust cap ${Math.round(55 + level * 5)}%` : "Thrusters limited";
  return level > 0 ? `${level} pips allocated` : "Powered off";
}

type MockPowerPipHudProps = {
  hideOutputFooter?: boolean;
  powerBudget?: number | null;
  onAssignmentChange?: (assignment: PipAssignment) => void;
};

export default function MockPowerPipHud({
  hideOutputFooter = false,
  powerBudget = MOCK_PIP_TOTAL,
  onAssignmentChange,
}: MockPowerPipHudProps) {
  const [assignment, setAssignment] = useState<PipAssignment>(INITIAL_MOCK_PIP_ASSIGNMENT);
  const [activeColumn, setActiveColumn] = useState<PipCategory | null>(null);
  const assignedTotal = sumMockPipAssignment(assignment);
  const budget = powerBudget != null && Number.isFinite(powerBudget) ? Math.round(powerBudget) : MOCK_PIP_TOTAL;
  const remaining = budget - assignedTotal;
  const overBudget = remaining < 0;

  const unitStates = useMemo(
    () => buildPipUnitStates(assignment, budget),
    [assignment, budget],
  );

  useEffect(() => {
    onAssignmentChange?.(assignment);
  }, [assignment, onAssignmentChange]);

  const setCategoryLevel = (category: PipCategory, nextLevel: number) => {
    setAssignment((current) => {
      const clamped = Math.max(0, Math.min(MOCK_PIP_SEGMENT_COUNT, nextLevel));
      return { ...current, [category]: clamped };
    });
    setActiveColumn(category);
  };

  const handleSegmentClick = (category: PipCategory, slotFromBottom: number, min: number) => {
    const level = assignment[category];
    const target = slotFromBottom + 1;
    if (target === level) { setCategoryLevel(category, slotFromBottom); return; }
    if (min > 0 && target < min) { setCategoryLevel(category, min); return; }
    setCategoryLevel(category, target);
  };

  const activeDef = activeColumn ? MOCK_PIP_COLUMNS.find((column) => column.key === activeColumn) : null;

  return (
    <div className="fit-mock-pips-hud">
      <div className="fit-mock-pips-columns" role="group" aria-label="Power pip columns">
        {MOCK_PIP_COLUMNS.map(({ key, min }) => {
          const label = resolvePowerChannelLabel(key);
          const level = assignment[key];
          const quantumOnline = key !== "quantum" || level >= min;
          const stackParts = buildPipStackParts(min, MOCK_PIP_SEGMENT_COUNT);
          const iconClass = iconPowerClass(level, key, unitStates);

          return (
            <div key={key} className={["fit-mock-pip-col", activeColumn === key ? "is-active" : "", level <= 0 ? "is-off" : ""].filter(Boolean).join(" ")}>
              <div className="fit-mock-pip-stack" aria-label={`${label} ${level} of ${MOCK_PIP_SEGMENT_COUNT} pips assigned`}>
                {stackParts.map((part) => {
                  if (part.kind === "merged") {
                    const mergedState = mergedFillState(unitStates, key, min, level);
                    const partial = level > 0 && level < min;
                    return (
                      <button
                        key="merged"
                        type="button"
                        className={[
                          "fit-mock-pip-merged",
                          mergedState === "on" ? "is-on" : "",
                          mergedState === "over" ? "is-over" : "",
                          partial ? "is-partial" : "",
                          min > 0 && mergedState === "off" ? "is-min" : "",
                        ].filter(Boolean).join(" ")}
                        style={{ flex: part.minSlots }}
                        onClick={() => setCategoryLevel(key, level >= min ? 0 : min)}
                      />
                    );
                  }

                  const isOn = part.slot < level;
                  const fillState = isOn ? pipUnitState(unitStates, key, part.slot) : null;
                  return (
                    <button
                      key={part.slot}
                      type="button"
                      className={[
                        "fit-mock-pip-seg",
                        fillState === "on" ? "is-on" : "",
                        fillState === "over" ? "is-over" : "",
                        min > 0 && part.slot < min && !isOn ? "is-min" : "",
                      ].filter(Boolean).join(" ")}
                      onClick={() => handleSegmentClick(key, part.slot, min)}
                    />
                  );
                })}
              </div>
              {key === "quantum" ? (
                <span className={["fit-mock-pip-qd-status", quantumOnline ? "is-online" : "is-offline"].filter(Boolean).join(" ")}>
                  {quantumOnline ? "Online" : "Offline"}
                </span>
              ) : null}
              <button
                type="button"
                className={["fit-mock-pip-icon", iconClass].filter(Boolean).join(" ")}
                onClick={() => setCategoryLevel(key, level > 0 ? 0 : Math.max(min, 1))}
              >
                <PowerPipIcon category={key} />
              </button>
              <span className="fit-mock-pip-label">{label}</span>
              {min > 0 ? <span className="fit-mock-pip-min">Min {min}</span> : null}
            </div>
          );
        })}
      </div>
      {hideOutputFooter ? null : (
        <div className="fit-mock-pips-footer">
          <div className={["fit-mock-pips-output-block", overBudget ? "is-over-budget" : ""].filter(Boolean).join(" ")}>
            <span className="fit-mock-pips-output-label">Output</span>
            <strong className="fit-mock-pips-output-value">
              <span className="fit-mock-pips-open">{remaining}</span>
              <span className="fit-mock-pips-slash"> / </span>
              <span className="fit-mock-pips-total">{budget}</span>
            </strong>
            {activeDef ? (
              <span className="fit-mock-pips-system-readout">
                {resolvePowerChannelLabel(activeDef.key)} · {mockSystemReadout(activeDef.key, assignment[activeDef.key], activeDef.min)}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
