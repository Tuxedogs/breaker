import { useState } from "react";
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
  layout?: "overlay" | "stacked";
  markers?: number[];
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
  layout = "overlay",
  markers = [],
}: TargetQualitySliderProps) {
  const lowerBound = Math.min(min, max);
  const upperBound = Math.max(min, max);
  const normalizedValue = clampToRange(value, lowerBound, upperBound);
  const valueFromInput = (rawValue: string) => clampToRange(Number(rawValue), lowerBound, upperBound);
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(String(normalizedValue));

  const commitDraftValue = () => {
    const nextValue = valueFromInput(draftValue);
    setDraftValue(String(nextValue));
    onChange(nextValue);
    onCommit?.(nextValue);
    setIsEditing(false);
  };

  return (
    <span
      className={`bq-target-editor bq-target-editor--slider${layout === "stacked" ? " bq-target-editor--stacked" : ""}`}
      data-bq-row-control="true"
    >
      {layout === "stacked" && isEditing && !disabled ? (
        <input
          type="number"
          min={lowerBound}
          max={upperBound}
          step={step}
          className={`bq-target-quality bq-target-quality--${tone} bq-target-quality-input`}
          value={draftValue}
          aria-label={`Edit target quality for ${materialName}`}
          data-bq-row-control="true"
          autoFocus
          onChange={(event) => setDraftValue(event.target.value)}
          onBlur={commitDraftValue}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setDraftValue(String(normalizedValue));
              setIsEditing(false);
            }
          }}
        />
      ) : layout === "stacked" ? (
        <button
          type="button"
          className={`bq-target-quality bq-target-quality--${tone}`}
          aria-label={`Edit target quality for ${materialName}`}
          data-bq-row-control="true"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            setDraftValue(String(normalizedValue));
            setIsEditing(true);
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span>{label}</span>
        </button>
      ) : (
        <span className={`bq-target-quality bq-target-quality--${tone}`} aria-hidden="true">
          <span>{label}</span>
        </span>
      )}
      <span className="bq-target-slider-shell">
        {markers.length > 0 ? (
          <span className="bq-target-slider-markers" aria-hidden="true">
            {markers.map((marker, index) => {
              const normalizedMarker = clampToRange(marker, lowerBound, upperBound);
              const position =
                upperBound === lowerBound
                  ? 0
                  : ((normalizedMarker - lowerBound) / (upperBound - lowerBound)) * 100;

              return (
                <span
                  key={`${normalizedMarker}:${index}`}
                  className="bq-target-slider-marker"
                  style={{ left: `${position}%` }}
                >
                  <span>{normalizedMarker}</span>
                </span>
              );
            })}
          </span>
        ) : null}
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
        {layout === "overlay" ? <output>{normalizedValue}</output> : null}
      </span>
    </span>
  );
}
