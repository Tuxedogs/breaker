import { useRef, useState, type CSSProperties } from "react";
import "./target-quality-slider.css";

type TargetQualitySliderProps = {
  label: string;
  tone: string;
  materialName: string;
  value: number | undefined;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  disabled?: boolean;
  layout?: "overlay" | "stacked" | "input" | "material";
  markers?: number[];
};

function clampToRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function snapToStep(value: number, min: number, max: number, step: number): number {
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
  const precision = Math.max(
    String(min).split(".")[1]?.length ?? 0,
    String(safeStep).split(".")[1]?.length ?? 0,
  );
  const snapped = min + Math.round((clampToRange(value, min, max) - min) / safeStep) * safeStep;
  return Number(clampToRange(snapped, min, max).toFixed(precision));
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
  const hasResolvedValue = Number.isFinite(value);
  const normalizedValue = snapToStep(value ?? lowerBound, lowerBound, upperBound, step);
  const normalizedPercent = upperBound === lowerBound
    ? 0
    : ((normalizedValue - lowerBound) / (upperBound - lowerBound)) * 100;
  const valueFromInput = (rawValue: string) => snapToStep(Number(rawValue), lowerBound, upperBound, step);
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(String(normalizedValue));
  const sliderGeometryRef = useRef<HTMLSpanElement>(null);
  const bubbleGestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    dragged: boolean;
    lastValue: number;
  } | null>(null);

  if (!hasResolvedValue) {
    return (
      <span className={`bq-target-editor bq-target-editor--${layout}`} data-bq-row-control="true">
        <span className={`bq-target-quality bq-target-quality--${tone}`} aria-label={`Target quality for ${materialName}: unavailable`}>
          <span>{label}</span>
        </span>
      </span>
    );
  }
  const beginEditing = () => {
    setIsEditing(true);
    setDraftValue("");
  };

  const restoreDisplayedValue = () => {
    setDraftValue(String(normalizedValue));
    setIsEditing(false);
  };

  const commitDraftValue = () => {
    if (draftValue.trim() === "") {
      restoreDisplayedValue();
      return;
    }
    const parsed = Number(draftValue);
    if (!Number.isFinite(parsed)) {
      restoreDisplayedValue();
      return;
    }
    const nextValue = valueFromInput(draftValue);
    setDraftValue(String(nextValue));
    setIsEditing(false);
    onChange(nextValue);
    onCommit?.(nextValue);
  };

  const valueFromPointer = (clientX: number) => {
    const geometry = sliderGeometryRef.current?.getBoundingClientRect();
    if (!geometry || geometry.width <= 0) return normalizedValue;
    const ratio = clampToRange((clientX - geometry.left) / geometry.width, 0, 1);
    return snapToStep(lowerBound + ratio * (upperBound - lowerBound), lowerBound, upperBound, step);
  };

  const beginBubblePointerGesture = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    bubbleGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragged: false,
      lastValue: normalizedValue,
    };
  };

  const moveBubblePointerGesture = (event: React.PointerEvent<HTMLButtonElement>) => {
    const gesture = bubbleGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.stopPropagation();
    if (!gesture.dragged && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) < 4) {
      return;
    }
    gesture.dragged = true;
    gesture.lastValue = valueFromPointer(event.clientX);
    onChange(gesture.lastValue);
  };

  const endBubblePointerGesture = (event: React.PointerEvent<HTMLButtonElement>) => {
    const gesture = bubbleGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    bubbleGestureRef.current = null;
    if (gesture.dragged) {
      const nextValue = valueFromPointer(event.clientX);
      onChange(nextValue);
      onCommit?.(nextValue);
      return;
    }
    setDraftValue(String(normalizedValue));
    setIsEditing(true);
  };

  if (layout === "input") {
    return (
      <span className="bq-target-editor bq-target-editor--input" data-bq-row-control="true">
        <span className="bq-target-editor-label">Target</span>
        <input
          type="number"
          min={lowerBound}
          max={upperBound}
          step={step}
          className={`bq-target-quality bq-target-quality--${tone} bq-target-quality-input`}
          value={isEditing ? draftValue : String(normalizedValue)}
          aria-label={`Target quality for ${materialName}`}
          data-bq-row-control="true"
          disabled={disabled}
          onFocus={() => {
            if (!disabled) beginEditing();
          }}
          onChange={(event) => setDraftValue(event.target.value)}
          onBlur={commitDraftValue}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") restoreDisplayedValue();
          }}
        />
      </span>
    );
  }

  if (layout === "material") {
    return (
      <span
        className="bq-target-editor bq-target-editor--slider bq-target-editor--material"
        data-bq-row-control="true"
        style={{ "--target-quality-pct": `${normalizedPercent}%` } as CSSProperties}
      >
        <span className="bq-target-slider-shell">
          <span ref={sliderGeometryRef} className="bq-target-slider-geometry" data-slider-geometry="true">
            {isEditing && !disabled ? (
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
                  if (event.key === "Escape") restoreDisplayedValue();
                }}
              />
            ) : (
              <button
                type="button"
                className={`bq-target-quality bq-target-quality--${tone}`}
                aria-label={`Edit target quality for ${materialName}`}
                data-bq-row-control="true"
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  if (event.detail === 0 && !disabled) beginEditing();
                }}
                onPointerDown={beginBubblePointerGesture}
                onPointerMove={moveBubblePointerGesture}
                onPointerUp={endBubblePointerGesture}
                onPointerCancel={(event) => {
                  event.stopPropagation();
                  bubbleGestureRef.current = null;
                }}
              >
                <span>{label}</span>
              </button>
            )}
            <span className="bq-target-slider-track" aria-hidden="true">
              <span className="bq-target-slider-track-fill" />
            </span>
            {markers.length > 0 ? (
              <span className="bq-target-slider-markers" aria-hidden="true">
                {markers.map((marker, index) => {
                  const normalizedMarker = snapToStep(marker, lowerBound, upperBound, step);
                  const position = upperBound === lowerBound
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
              onPointerUp={(event) => onCommit?.(valueFromInput(event.currentTarget.value))}
            />
          </span>
        </span>
      </span>
    );
  }

  return (
    <span
      className={`bq-target-editor bq-target-editor--slider${layout === "stacked" ? " bq-target-editor--stacked" : ""}`}
      data-bq-row-control="true"
      style={{ "--target-quality-pct": `${normalizedPercent}%` } as CSSProperties}
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
            if (event.key === "Escape") restoreDisplayedValue();
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
      <span
        className="bq-target-slider-shell"
      >
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
