import { getFittingSlotIcon } from "../../../lib/fitting/getFittingSlotIcon";
import type { PowerCardHeaderView } from "../../../lib/fitting/mockup/fittingMockupViewTypes";

type PowerStatusHeaderProps = {
  header: PowerCardHeaderView;
};

function formatOutputValue(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return String(value);
}

const coolerIconSrc = getFittingSlotIcon({ componentType: "cooler", slotKind: "cooler" });

export default function PowerStatusHeader({ header }: PowerStatusHeaderProps) {
  const { output, cooling } = header;

  return (
    <div className="fm-power-head">
      <div className={["fm-power-output-tile", output.overBudget ? "is-over-budget" : ""].filter(Boolean).join(" ")}>
        <span className="fm-power-output-label">Output</span>
        <strong className="fm-power-output-value">
          <span className="fm-power-output-primary">{formatOutputValue(output.open)}</span>
          <span className="fm-power-output-sep"> / </span>
          <span className="fm-power-output-total">{formatOutputValue(output.total)}</span>
        </strong>
      </div>

      <div className={["fm-power-cooling", cooling.unavailable ? "is-unavailable" : "", cooling.overCapacity ? "is-over" : ""].filter(Boolean).join(" ")}>
        <div className="fm-power-cooling-track" aria-hidden>
          <span
            className="fm-power-cooling-fill"
            style={{ width: `${cooling.fillPct}%` }}
          />
        </div>
        <div className="fm-power-cooling-meta">
          <span className="fm-power-cooling-label">
            <img src={coolerIconSrc} alt="" className="fm-power-cooling-icon" draggable={false} />
            Cooling %
          </span>
          <strong className="fm-power-cooling-value">{cooling.label}</strong>
        </div>
      </div>
    </div>
  );
}
