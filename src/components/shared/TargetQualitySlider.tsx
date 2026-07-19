import "./target-quality-slider.css";

type TargetQualitySliderProps = {
  label: string;
  tone: string;
  materialName: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  disabled?: boolean;
};

function clampToRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

/** The compact target-quality control shared by Build Queue and Crafting Detail. */
export default function TargetQualitySlider({
  label,
  tone,
  materialName,
  value,
  min = 1,
  max = 1000,
  step = 1,
  onChange,
  onCommit,
  disabled = false,
}: TargetQualitySliderProps) {
  const lowerBound = Math.min(min, max);
  const upperBound = Math.max(min, max);
  const normalizedValue = clampToRange(value, lowerBound, upperBound);
  const valueFromInput = (rawValue: string) => clampToRange(Number(rawValue), lowerBound, upperBound);

  return (
    <span className="bq-target-editor bq-target-editor--slider" data-bq-row-control="true">
      <span className={`bq-target-quality bq-target-quality--${tone}`} aria-hidden="true">
        <span>{label}</span>
      </span>
      <span className="bq-target-slider-shell">
        <input
          type="range"
          min={lowerBound}
          max={upperBound}
          step={step}
          className="bq-target-quality-slider"
          value={normalizedValue}
          aria-label={`Target quality for ${materialName}`}
          aria-valuetext={`Target ${normalizedValue}`}
          data-bq-row-control="true"
          disabled={disabled}
          onChange={(event) => onChange(valueFromInput(event.target.value))}
          onBlur={(event) => onCommit?.(valueFromInput(event.currentTarget.value))}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        />
        <output>{normalizedValue}</output>
      </span>
    </span>
  );
}
