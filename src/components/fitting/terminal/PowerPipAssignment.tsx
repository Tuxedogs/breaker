import type { PipAssignment } from "../../../lib/fitting/fittingTerminalTypes";
import FittingMetricPanel from "./FittingMetricPanel";

const pipLabels: Array<{ key: keyof PipAssignment; label: string }> = [
  { key: "weapons", label: "Weapons" },
  { key: "shields", label: "Shields" },
  { key: "engines", label: "Engines" },
  { key: "quantum", label: "Quantum" },
  { key: "systems", label: "Systems" },
  { key: "utility", label: "Utility" },
  { key: "reserved", label: "Reserved" },
];

type PowerPipAssignmentProps = {
  pipAssignment: PipAssignment;
  onPipChange: (category: keyof PipAssignment, value: number) => void;
  reactorOutput: string;
  totalDraw: string;
  margin: string;
};

export default function PowerPipAssignment({
  pipAssignment,
  onPipChange,
  reactorOutput,
  totalDraw,
  margin,
}: PowerPipAssignmentProps) {
  return (
    <FittingMetricPanel title="Power Assignment" badge="Prototype / local">
      <dl className="fit-term-kv fit-term-kv--compact">
        <div><dt>Reactor Output</dt><dd>{reactorOutput}</dd></div>
        <div><dt>Total Draw</dt><dd>{totalDraw}</dd></div>
        <div><dt>Power Margin</dt><dd>{margin}</dd></div>
      </dl>
      <p className="fit-term-note">Pip allocation is local UI state only — not validated against game pip logic.</p>
      <div className="fit-term-pips">
        {pipLabels.map(({ key, label }) => (
          <label key={key} className="fit-term-pip-row">
            <span>{label}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={pipAssignment[key]}
              onChange={(event) => onPipChange(key, Number(event.target.value))}
            />
            <strong>{pipAssignment[key]}%</strong>
          </label>
        ))}
      </div>
    </FittingMetricPanel>
  );
}
