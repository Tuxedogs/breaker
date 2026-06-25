import FittingMetricPanel from "./FittingMetricPanel";

type SurvivabilityPanelProps = {
  shieldHp: string;
  shieldRegen: string;
  hullHp: string;
  armorRating: string;
  damageReduction: string;
  thresholdPercent: number;
  onThresholdChange: (value: number) => void;
};

export default function SurvivabilityPanel({
  shieldHp,
  shieldRegen,
  hullHp,
  armorRating,
  damageReduction,
  thresholdPercent,
  onThresholdChange,
}: SurvivabilityPanelProps) {
  return (
    <FittingMetricPanel title="Survivability">
      <dl className="fit-term-kv">
        <div><dt>Shield HP</dt><dd>{shieldHp}</dd></div>
        <div><dt>Shield Regen</dt><dd>{shieldRegen}</dd></div>
        <div><dt>Hull HP</dt><dd>{hullHp}</dd></div>
        <div><dt>Armor Rating</dt><dd>{armorRating}</dd></div>
        <div><dt>Damage Reduction</dt><dd>{damageReduction}</dd></div>
      </dl>
      <label className="fit-term-slider">
        <span>Shield Threshold ({thresholdPercent}%)</span>
        <input
          type="range"
          min={0}
          max={100}
          value={thresholdPercent}
          onChange={(event) => onThresholdChange(Number(event.target.value))}
        />
      </label>
      <p className="fit-term-unavail">Threshold EHP: Not calculated yet</p>
    </FittingMetricPanel>
  );
}
