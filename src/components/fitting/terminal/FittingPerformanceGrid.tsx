import type { FittingCalculateResult } from "../../../lib/fitting/fittingApi";
import type { CombatAlphaBreakdown } from "../../../lib/fitting/useCombatAlphaBreakdown";
import type { FittingShipSummary } from "../../../lib/fitting/fittingPortGrouping";
import { formatNumber, formatSigned } from "../../../lib/fitting/fittingPortGrouping";
import type { PipAssignment } from "../../../lib/fitting/fittingTerminalTypes";
import FittingMetricPanel from "./FittingMetricPanel";
import PowerPipAssignment from "./PowerPipAssignment";
import SurvivabilityPanel from "./SurvivabilityPanel";

function derivedNum(result: FittingCalculateResult | null, category: string, key: string): number | null {
  const categoryData = result?.categories?.[category as keyof NonNullable<FittingCalculateResult["categories"]>];
  const value = categoryData?.derived?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function extractedNum(result: FittingCalculateResult | null, category: string, key: string): number | null {
  const categoryData = result?.categories?.[category as keyof NonNullable<FittingCalculateResult["categories"]>] as
    | { extracted?: Record<string, unknown> }
    | undefined;
  const value = categoryData?.extracted?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function alphaLabel(value: number | null | undefined, loading = false): string {
  if (loading) return "…";
  if (typeof value === "number" && Number.isFinite(value)) return formatNumber(value);
  return "Not calculated yet";
}

type FittingPerformanceGridProps = {
  calculateResult: FittingCalculateResult | null;
  shipPerformance: FittingShipSummary | null;
  combatAlpha: CombatAlphaBreakdown;
  pipAssignment: PipAssignment;
  onPipChange: (category: keyof PipAssignment, value: number) => void;
  shieldThresholdPercent: number;
  onThresholdChange: (value: number) => void;
  onViewWeaponStats: () => void;
};

export default function FittingPerformanceGrid({
  calculateResult,
  shipPerformance,
  combatAlpha,
  pipAssignment,
  onPipChange,
  shieldThresholdPercent,
  onThresholdChange,
  onViewWeaponStats,
}: FittingPerformanceGridProps) {
  const weaponAlpha = derivedNum(calculateResult, "weapons", "weaponAlphaTotal");
  const weaponCount = derivedNum(calculateResult, "weapons", "weaponCount");
  const powerOut = derivedNum(calculateResult, "power", "totalPowerGenerated");
  const powerUsed = derivedNum(calculateResult, "power", "totalPowerRequired");
  const powerMargin = derivedNum(calculateResult, "power", "powerSurplus");
  const coolOut = derivedNum(calculateResult, "cooling", "totalCoolingGenerated");
  const coolUsed = derivedNum(calculateResult, "cooling", "totalCoolingRequired");
  const coolMargin = derivedNum(calculateResult, "cooling", "coolingSurplus");
  const shieldHp = derivedNum(calculateResult, "shields", "totalShieldHP");
  const shieldRegen = derivedNum(calculateResult, "shields", "totalRegenRate");

  const scmSpeed = shipPerformance?.scmSpeed ?? extractedNum(calculateResult, "performance", "scmSpeed");
  const maxSpeed = shipPerformance?.maxSpeed ?? extractedNum(calculateResult, "performance", "maxSpeed");
  const boostSpeed = shipPerformance?.boostSpeedForward ?? extractedNum(calculateResult, "performance", "boostSpeedForward");
  const pitch = shipPerformance?.pitchRate ?? extractedNum(calculateResult, "performance", "pitchRate");
  const yaw = shipPerformance?.yawRate ?? extractedNum(calculateResult, "performance", "yawRate");
  const roll = shipPerformance?.rollRate ?? extractedNum(calculateResult, "performance", "rollRate");

  return (
    <section className="fit-term-performance" aria-label="Fitting outcomes and ship performance">
      <FittingMetricPanel
        title="Combat"
        action={(
          <button type="button" className="fit-term-link-btn" onClick={onViewWeaponStats}>
            View Full Weapon Stats
          </button>
        )}
      >
        <dl className="fit-term-kv fit-term-kv--combat">
          <div><dt>Total Equipped Alpha</dt><dd>{alphaLabel(weaponAlpha)}</dd></div>
          <div><dt>Gun Alpha</dt><dd>{alphaLabel(combatAlpha.gunAlpha, combatAlpha.loading)}</dd></div>
          <div><dt>Missile Alpha</dt><dd>{alphaLabel(combatAlpha.missileAlpha, combatAlpha.loading)}</dd></div>
          <div><dt>Torpedo Alpha</dt><dd>{alphaLabel(combatAlpha.torpedoAlpha, combatAlpha.loading)}</dd></div>
          <div><dt>Alpha by Damage Type</dt><dd className="fit-term-unavail">Requires fitting API</dd></div>
          <div><dt>Equipped Weapon Count</dt><dd>{weaponCount != null ? formatNumber(weaponCount) : "Not calculated yet"}</dd></div>
          <div><dt>Lock Time</dt><dd className="fit-term-unavail">Source data unavailable</dd></div>
        </dl>
      </FittingMetricPanel>

      <PowerPipAssignment
        pipAssignment={pipAssignment}
        onPipChange={onPipChange}
        reactorOutput={powerOut != null ? `${formatNumber(powerOut)} MW` : "Not calculated yet"}
        totalDraw={powerUsed != null ? `${formatNumber(powerUsed)} MW` : "Not calculated yet"}
        margin={powerMargin != null ? formatSigned(powerMargin, " MW") : "Not calculated yet"}
      />

      <SurvivabilityPanel
        shieldHp={shieldHp != null ? formatNumber(shieldHp) : "Not calculated yet"}
        shieldRegen={shieldRegen != null ? `${formatNumber(shieldRegen)}/s` : "Not calculated yet"}
        hullHp="Source data unavailable"
        armorRating="Source data unavailable"
        damageReduction="Source data unavailable"
        thresholdPercent={shieldThresholdPercent}
        onThresholdChange={onThresholdChange}
      />

      <FittingMetricPanel title="Resistances" badge="Unavailable">
        <table className="fit-term-table">
          <thead>
            <tr><th>Type</th><th>Shields</th><th>Armor</th><th>EHP</th></tr>
          </thead>
          <tbody>
            {["Energy", "Kinetic", "EMP", "Thermal"].map((type) => (
              <tr key={type}>
                <td>{type}</td>
                <td colSpan={3} className="fit-term-unavail">Source data unavailable</td>
              </tr>
            ))}
          </tbody>
        </table>
      </FittingMetricPanel>

      <FittingMetricPanel title="Signatures & Detection">
        <dl className="fit-term-kv">
          <div><dt>EM Emission</dt><dd className="fit-term-unavail">Source data unavailable</dd></div>
          <div><dt>IR Emission</dt><dd className="fit-term-unavail">Source data unavailable</dd></div>
          <div><dt>Max Cross Section</dt><dd className="fit-term-unavail">Source data unavailable</dd></div>
          <div><dt>Radar Range</dt><dd className="fit-term-unavail">Requires fitting API</dd></div>
          <div><dt>Lock Range</dt><dd className="fit-term-unavail">Requires fitting API</dd></div>
        </dl>
      </FittingMetricPanel>

      <FittingMetricPanel title="Mobility" badge="Ship-level">
        <dl className="fit-term-kv">
          <div><dt>SCM Speed</dt><dd>{scmSpeed != null ? formatNumber(scmSpeed) : "Not calculated yet"}</dd></div>
          <div><dt>NAV Speed</dt><dd>{maxSpeed != null ? formatNumber(maxSpeed) : "Not calculated yet"}</dd></div>
          <div><dt>Boost Speed</dt><dd>{boostSpeed != null ? formatNumber(boostSpeed) : "Not calculated yet"}</dd></div>
          <div><dt>Acceleration</dt><dd className="fit-term-unavail">Source data unavailable</dd></div>
          <div><dt>Maneuvering</dt><dd className="fit-term-unavail">Source data unavailable</dd></div>
        </dl>
        <table className="fit-term-table fit-term-table--pyr">
          <thead>
            <tr><th>Axis</th><th>Normal</th><th>Boosted</th></tr>
          </thead>
          <tbody>
            <tr><td>Pitch</td><td>{pitch != null ? formatNumber(pitch) : "Not calculated yet"}</td><td className="fit-term-unavail">Source data unavailable</td></tr>
            <tr><td>Yaw</td><td>{yaw != null ? formatNumber(yaw) : "Not calculated yet"}</td><td className="fit-term-unavail">Source data unavailable</td></tr>
            <tr><td>Roll</td><td>{roll != null ? formatNumber(roll) : "Not calculated yet"}</td><td className="fit-term-unavail">Source data unavailable</td></tr>
          </tbody>
        </table>
      </FittingMetricPanel>

      <FittingMetricPanel title="Resources">
        <dl className="fit-term-kv">
          <div><dt>Power Output</dt><dd>{powerOut != null ? `${formatNumber(powerOut)} MW` : "Not calculated yet"}</dd></div>
          <div><dt>Power Used</dt><dd>{powerUsed != null ? `${formatNumber(powerUsed)} MW` : "Not calculated yet"}</dd></div>
          <div><dt>Power Margin</dt><dd>{powerMargin != null ? formatSigned(powerMargin, " MW") : "Not calculated yet"}</dd></div>
          <div><dt>Cooling Output</dt><dd>{coolOut != null ? `${formatNumber(coolOut)} kW` : "Not calculated yet"}</dd></div>
          <div><dt>Cooling Used</dt><dd>{coolUsed != null ? `${formatNumber(coolUsed)} kW` : "Not calculated yet"}</dd></div>
          <div><dt>Cooling Margin</dt><dd>{coolMargin != null ? formatSigned(coolMargin, " kW") : "Not calculated yet"}</dd></div>
          <div><dt>Fuel Capacity</dt><dd className="fit-term-unavail">Source data unavailable</dd></div>
          <div><dt>Fuel Usage</dt><dd className="fit-term-unavail">Source data unavailable</dd></div>
          <div><dt>Quantum Range</dt><dd className="fit-term-unavail">Requires fitting API</dd></div>
          <div><dt>Quantum Fuel Time</dt><dd className="fit-term-unavail">Requires fitting API</dd></div>
        </dl>
      </FittingMetricPanel>
    </section>
  );
}
