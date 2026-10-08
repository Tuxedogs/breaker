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

const MFD_ASSET_ROOT = "/images/fitting-v2/mfd";

function regionAsset(kind: "minimum" | "pip", units: number, assigned: boolean): string {
  const count = Math.max(1, Math.min(5, units));
  if (kind === "minimum" && assigned && count > 1) return `${MFD_ASSET_ROOT}/${count}-min-assigned.svg`;
  if (assigned) return `${MFD_ASSET_ROOT}/assigned-${count}.svg`;
  return `${MFD_ASSET_ROOT}/${count === 5 ? "unassinged" : "unassigned"}-${count}.svg`;
}

export default function PowerTower({ label, maxPips, minPips, allocation, exactPips = [], available, interactive, unavailableReason, onRequestAllocation }: Props) {
  if (!available) {
    return (
      <div className="fitv2-power-tower-visual is-disabled" title={unavailableReason ?? undefined} role="img" aria-label={`${label} unavailable${unavailableReason ? `: ${unavailableReason}` : ""}`}>
        <img className="fitv2-power-disabled-shape" src={`${MFD_ASSET_ROOT}/col-disabled.svg`} alt="" />
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
          <img className="fitv2-power-shape" src={regionAsset(region.kind, region.units, region.assigned)} alt="" />
        </button>
      ))}
    </div>
  );
}
