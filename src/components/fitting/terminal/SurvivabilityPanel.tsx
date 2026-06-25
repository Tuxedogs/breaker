import FittingMetricPanel from "./FittingMetricPanel";

type SurvivabilityPanelProps = {
  shieldHp: string;
  shieldRegen: string;
  hullHp: string;
  thresholdPercent: number;
  onThresholdChange: (value: number) => void;
};

export default function SurvivabilityPanel({
  shieldHp,
  shieldRegen,
  hullHp,
  thresholdPercent,
  onThresholdChange,
}: SurvivabilityPanelProps) {
  return (
    <FittingMetricPanel title="Survivability">
      <dl className="fit-term-kv">
        <div><dt>Shield HP</dt><dd>{shieldHp}</dd></div>
        <div><dt>Shield Regen</dt><dd>{shieldRegen}</dd></div>
        <div><dt>Hull HP</dt><dd>{hullHp}</dd></div>
      </dl>
      <label className="fit-term-slider">
        <span className="fit-term-slider-label">
          Shield Threshold
          <strong>{thresholdPercent}%</strong>
        </span>
        <div className="fit-term-bar-track fit-term-bar-track--threshold">
          <span
            className="fit-term-bar-fill fit-term-bar-fill--threshold"
            style={{ width: `${thresholdPercent}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={thresholdPercent}
          aria-label="Shield threshold percentage"
          onChange={(event) => onThresholdChange(Number(event.target.value))}
        />
      </label>
      <table className="fit-term-table fit-term-table--resist">
        <thead>
          <tr><th>Layer</th><th>Energy</th><th>Kinetic</th><th>EMP</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Shields</td>
            <td colSpan={3} className="fit-term-unavail">Requires fitting API</td>
          </tr>
          <tr>
            <td>Armor</td>
            <td colSpan={3} className="fit-term-unavail">Not calculated yet</td>
          </tr>
        </tbody>
      </table>
    </FittingMetricPanel>
  );
}
