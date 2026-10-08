import type { CSSProperties } from "react";
import { buildPowerTowerRegions } from "./powerTowerModel";

type Props = {
  label: string;
  maxPips: number;
  minPips: number;
  allocation: number;
  exactPips?: readonly number[];
  available: boolean;
  interactive: boolean;
  unavailableReason?: string | null;
  onRequestAllocation: (allocation: number) => void;
};

function PipShape({ assigned }: { assigned: boolean }) {
  return (
    <svg className="fitv2-power-shape" viewBox="0 0 8 4.24" preserveAspectRatio="none" aria-hidden="true">
      <path className="fitv2-power-shape-frame" d="M0 0H8V4.24H0Z" />
      <path className={assigned ? "fitv2-power-shape-fill is-assigned" : "fitv2-power-shape-fill"} d="M.18 .18H7.82V4.06H.18Z" />
    </svg>
  );
}

function MinimumShape({ units, assigned }: { units: number; assigned: boolean }) {
  const height = Math.max(1, units) * 4.24;
  const midpoint = height / 2;
  const dividerPaths = Array.from({ length: Math.max(0, units - 1) }, (_, index) => {
    const y = (index + 1) * 4.24;
    return <path className="fitv2-power-minimum-divider" d={`M.72 ${y}H7.3`} key={y} />;
  });
  return (
    <svg className="fitv2-power-shape" viewBox={`-.58 0 8.58 ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path className={assigned ? "fitv2-power-minimum-fill is-assigned" : "fitv2-power-minimum-fill"} d={`M0 0H8V${height}H0Z`} />
      {dividerPaths}
      <path className={assigned ? "fitv2-power-minimum-mid is-assigned" : "fitv2-power-minimum-mid"} d={`M0 ${midpoint - .7}L-.55 ${midpoint}L0 ${midpoint + .7}Z`} />
    </svg>
  );
}

function DisabledShape() {
  return (
    <svg className="fitv2-power-disabled-shape" viewBox="0 0 8 25.44" preserveAspectRatio="none" aria-hidden="true">
      <path className="fitv2-power-disabled-fill" d="M0 0H8V25.44H0Z" />
      <path className="fitv2-power-disabled-mark" d="M4 7.1 6.35 11.2 5.8 11.55 4 8.42 2.2 11.55 1.65 11.2ZM3.55 12.7H4.45V17.35H3.55ZM3.55 18.25H4.45V19.15H3.55Z" />
    </svg>
  );
}

export default function PowerTower({ label, maxPips, minPips, allocation, exactPips = [], available, interactive, unavailableReason, onRequestAllocation }: Props) {
  if (!available) {
    return (
      <div className="fitv2-power-tower-visual is-disabled" title={unavailableReason ?? undefined} role="img" aria-label={`${label} unavailable${unavailableReason ? `: ${unavailableReason}` : ""}`}>
        <DisabledShape />
      </div>
    );
  }

  const regions = buildPowerTowerRegions(maxPips, minPips, allocation, exactPips);
  return (
    <div className="fitv2-power-tower-visual" role="group" aria-label={`${label} allocation`} style={{ "--fitv2-power-units": Math.max(1, maxPips) } as CSSProperties}>
      {[...regions].reverse().map((region) => (
        <button
          type="button"
          className={`fitv2-power-region is-${region.kind}${region.assigned ? " is-assigned" : " is-unassigned"}`}
          style={{ "--fitv2-region-units": region.units } as CSSProperties}
          aria-label={region.kind === "minimum" ? `Set ${label} allocation to its ${region.allocation}-pip operating minimum` : `Set ${label} allocation to ${region.allocation} pips`}
          aria-pressed={allocation === region.allocation}
          disabled={!interactive || region.disabled}
          onClick={() => onRequestAllocation(region.allocation)}
          key={`${region.kind}-${region.allocation}`}
        >
          {region.kind === "minimum" ? <MinimumShape units={region.units} assigned={region.assigned} /> : <PipShape assigned={region.assigned} />}
        </button>
      ))}
    </div>
  );
}
