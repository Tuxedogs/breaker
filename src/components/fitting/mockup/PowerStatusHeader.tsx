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
  const outputLabel = output.loading ? "Updating…" : output.unavailable ? "Unavailable" : null;

  return (
    <div className="fm-power-head">
      <div
        className={[
          "fm-power-output-tile",
          output.overBudget ? "is-over-budget" : "",
          output.unavailable ? "is-unavailable" : "",
        ].filter(Boolean).join(" ")}
        title={output.status ?? undefined}
      >
        <span className="fm-power-output-label">Allocated / Capacity</span>
        <strong className="fm-power-output-value">
          <span className="fm-power-output-primary">{formatOutputValue(output.allocated)}</span>
          <span className="fm-power-output-sep"> / </span>
          <span className="fm-power-output-total">{formatOutputValue(output.total)}</span>
        </strong>
        {outputLabel ? <span className="fit-mock-pips-system-readout">{outputLabel}</span> : null}
      </div>

      <div
        className={["fm-power-cooling", cooling.unavailable ? "is-unavailable" : "", cooling.overCapacity ? "is-over" : ""].filter(Boolean).join(" ")}
        title={cooling.status ?? undefined}
      >
        <div className="fm-power-cooling-track" aria-hidden>
          <span
            className="fm-power-cooling-fill"
            style={{ width: `${cooling.fillPct}%` }}
          />
        </div>
        <div className="fm-power-cooling-meta">
          <span className="fm-power-cooling-label">
            <img src={coolerIconSrc} alt="" className="fm-power-cooling-icon" draggable={false} />
            Cooling utilization
          </span>
          <strong className="fm-power-cooling-value">{cooling.label}</strong>
        </div>
      </div>
    </div>
  );
}
