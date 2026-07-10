import { useState } from "react";
import PowerPipIcon from "../terminal/PowerPipIcons";
import type { PipAssignment, PipCategory } from "../../../lib/fitting/fittingTerminalTypes";

const MOCK_PIP_TOTAL = 18;
const MOCK_PIP_SEGMENT_COUNT = 8;

type MockPipColumnDef = {
  key: PipCategory;
  label: string;
  min: number;
};

const MOCK_PIP_COLUMNS: MockPipColumnDef[] = [
  { key: "weapons", label: "WPN", min: 0 },
  { key: "engines", label: "ENG", min: 0 },
  { key: "quantum", label: "QT", min: 3 },
  { key: "radar", label: "RAD", min: 0 },
  { key: "lifeSupport", label: "LS", min: 0 },
  { key: "cooler1", label: "C1", min: 0 },
  { key: "cooler2", label: "C2", min: 0 },
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

type PipStackPart =
  | { kind: "segment"; slot: number }
  | { kind: "merged"; minSlots: number };

function sumMockPipAssignment(assignment: PipAssignment): number {
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

export default function MockPowerPipHud() {
  const [assignment, setAssignment] = useState<PipAssignment>(INITIAL_MOCK_PIP_ASSIGNMENT);
  const [activeColumn, setActiveColumn] = useState<PipCategory | null>(null);
  const assignedTotal = sumMockPipAssignment(assignment);
  const unassigned = MOCK_PIP_TOTAL - assignedTotal;

  const setCategoryLevel = (category: PipCategory, nextLevel: number) => {
    setAssignment((current) => {
      const currentLevel = current[category];
      const clamped = Math.max(0, Math.min(MOCK_PIP_SEGMENT_COUNT, nextLevel));
      const delta = clamped - currentLevel;
      if (delta <= 0) return { ...current, [category]: clamped };
      const available = MOCK_PIP_TOTAL - sumMockPipAssignment(current);
      return { ...current, [category]: currentLevel + Math.min(delta, available) };
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
        {MOCK_PIP_COLUMNS.map(({ key, label, min }) => {
          const level = assignment[key];
          const quantumOnline = key !== "quantum" || level >= min;
          const stackParts = buildPipStackParts(min, MOCK_PIP_SEGMENT_COUNT);
          return (
            <div key={key} className={["fit-mock-pip-col", activeColumn === key ? "is-active" : "", level <= 0 ? "is-off" : ""].filter(Boolean).join(" ")}>
              <div className="fit-mock-pip-stack" aria-label={`${label} ${level} of ${MOCK_PIP_SEGMENT_COUNT} pips assigned`}>
                {stackParts.map((part) => {
                  if (part.kind === "merged") {
                    const mergedOn = level >= min;
                    const partial = level > 0 && level < min;
                    return (
                      <button key="merged" type="button" className={["fit-mock-pip-merged", mergedOn ? "is-on" : "", partial ? "is-partial" : "", min > 0 && !mergedOn && !partial ? "is-min" : ""].filter(Boolean).join(" ")} style={{ flex: part.minSlots }} onClick={() => setCategoryLevel(key, level >= min ? 0 : min)} />
                    );
                  }
                  const isOn = part.slot < level;
                  return (
                    <button key={part.slot} type="button" className={["fit-mock-pip-seg", isOn ? "is-on" : "", min > 0 && part.slot < min && !isOn ? "is-min" : ""].filter(Boolean).join(" ")} onClick={() => handleSegmentClick(key, part.slot, min)} />
                  );
                })}
              </div>
              {key === "quantum" ? <span className={["fit-mock-pip-qd-status", quantumOnline ? "is-online" : "is-offline"].filter(Boolean).join(" ")}>{quantumOnline ? "Online" : "Offline"}</span> : null}
              <button type="button" className={["fit-mock-pip-icon", level > 0 ? "is-powered" : "is-off"].filter(Boolean).join(" ")} onClick={() => setCategoryLevel(key, level > 0 ? 0 : Math.max(min, Math.min(MOCK_PIP_SEGMENT_COUNT, MOCK_PIP_TOTAL - assignedTotal + level)))}>
                <PowerPipIcon category={key} />
              </button>
              <span className="fit-mock-pip-label">{label}</span>
              {min > 0 ? <span className="fit-mock-pip-min">Min {min}</span> : null}
            </div>
          );
        })}
      </div>
      <div className="fit-mock-pips-footer">
        <div className="fit-mock-pips-output-block">
          <span className="fit-mock-pips-output-label">Output</span>
          <strong className="fit-mock-pips-output-value"><span className="fit-mock-pips-open">{unassigned}</span><span className="fit-mock-pips-slash"> / </span><span className="fit-mock-pips-total">{MOCK_PIP_TOTAL}</span></strong>
          {activeDef ? <span className="fit-mock-pips-system-readout">{activeDef.label} · {mockSystemReadout(activeDef.key, assignment[activeDef.key], activeDef.min)}</span> : null}
        </div>
      </div>
    </div>
  );
}
