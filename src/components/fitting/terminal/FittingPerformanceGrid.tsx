import { useMemo } from "react";
import type { FittingCalculateResult, FittingComponentMitigation } from "../../../lib/fitting/fittingApi";
import type { CombatAlphaBreakdown } from "../../../lib/fitting/useCombatAlphaBreakdown";
import {
  formatNumber,
  type FittingShipSummary,
} from "../../../lib/fitting/fittingPortGrouping";
import type { PipAssignment } from "../../../lib/fitting/fittingTerminalTypes";
import type { PipSystemPowerDraw } from "../../../lib/fitting/fittingPipPower";
import type { FittingSimulationState } from "../../../lib/fitting/useFittingSimulation";
import PowerPipAssignment from "./PowerPipAssignment";
import DefensiveCapabilitiesCard from "./DefensiveCapabilitiesCard";
import {
  FittingStatCard,
  FittingStatRow,
  FittingStatSection,
} from "./FittingStatCard";
import { derivedNum, extractedNum } from "./fittingPerformanceHelpers";

type FittingPerformanceGridProps = {
  calculateResult: FittingCalculateResult | null;
  simulation: FittingSimulationState;
  shipPerformance: FittingShipSummary | null;
  hullHP: number | null;
  cargoCapacityScu: number | null;
  combatAlpha: CombatAlphaBreakdown;
  pipAssignment: PipAssignment;
  systemDraws: PipSystemPowerDraw;
  mitigationByComponentId: Record<string, FittingComponentMitigation | null>;
  onPipChange: (category: keyof PipAssignment, value: number) => void;
  onViewWeaponStats: () => void;
};

function formatAlpha(value: number | null | undefined, loading = false): string {
  if (loading) return "…";
  if (typeof value === "number" && Number.isFinite(value)) return formatNumber(value);
  return "Not calculated yet";
}

function sumNullable(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (nums.length === 0) return null;
  return nums.reduce((sum, value) => sum + value, 0);
}

export default function FittingPerformanceGrid({
  calculateResult,
  simulation,
  shipPerformance,
  hullHP,
  cargoCapacityScu,
  combatAlpha,
  pipAssignment,
  systemDraws,
  mitigationByComponentId,
  onPipChange,
  onViewWeaponStats,
}: FittingPerformanceGridProps) {
  const powerOut = derivedNum(calculateResult, "power", "totalPowerGenerated");
  const simulatedPowerCapacity = simulation.data?.power.capacitySegments.value ?? null;
  const simulatedPowerAllocated = simulation.data?.power.allocatedSegments.value ?? null;
  const coolingUtilization = simulation.data?.cooling.utilizationPercent.value ?? null;
  const sustainedWeaponDps = simulation.data?.weaponsSummary.dps.value ?? null;
  const sustainedWeaponDamage = simulation.data?.weaponsSummary.totalDamage.value ?? null;
  const shieldHp = derivedNum(calculateResult, "shields", "totalShieldHP");
  const shieldRegen = derivedNum(calculateResult, "shields", "totalRegenRate");

  const scmSpeed = shipPerformance?.scmSpeed ?? extractedNum(calculateResult, "performance", "scmSpeed");
  const maxSpeed = shipPerformance?.maxSpeed ?? extractedNum(calculateResult, "performance", "maxSpeed");
  const boostSpeed = shipPerformance?.boostSpeedForward ?? extractedNum(calculateResult, "performance", "boostSpeedForward");
  const pitch = shipPerformance?.pitchRate ?? extractedNum(calculateResult, "performance", "pitchRate");
  const yaw = shipPerformance?.yawRate ?? extractedNum(calculateResult, "performance", "yawRate");
  const roll = shipPerformance?.rollRate ?? extractedNum(calculateResult, "performance", "rollRate");
  const boostCapacity = extractedNum(calculateResult, "performance", "boostCapacity");
  const boostRegen = extractedNum(calculateResult, "performance", "boostRegen");

  const ordnancePayload = derivedNum(calculateResult, "ordnance", "totalOrdnancePayloadDamage");

  const componentMitigations = useMemo(
    () => Object.values(mitigationByComponentId),
    [mitigationByComponentId],
  );
  const shieldMitigations = useMemo(
    () => componentMitigations.filter((entry): entry is Extract<FittingComponentMitigation, { kind: "shield" }> => entry?.kind === "shield"),
    [componentMitigations],
  );
  const armorMitigations = useMemo(
    () => componentMitigations.filter((entry): entry is Extract<FittingComponentMitigation, { kind: "armor" }> => entry?.kind === "armor"),
    [componentMitigations],
  );

  const ordnanceCountValues = [
    derivedNum(calculateResult, "ordnance", "installedMissileCount"),
    derivedNum(calculateResult, "ordnance", "installedTorpedoCount"),
    derivedNum(calculateResult, "ordnance", "installedBombCount"),
  ];
  const ordnanceArmedCount = ordnanceCountValues.every((value) => value !== null)
    ? ordnanceCountValues.reduce((sum, value) => sum + value!, 0)
    : null;

  const totalHp = sumNullable([shieldHp, hullHP]);
  const formatSpeed = (value: number | null) => (
    value != null ? `${formatNumber(value)} m/s` : "Not calculated yet"
  );

  const pyrLine = [pitch, yaw, roll].every((value) => value != null)
    ? `${formatNumber(pitch!)} / ${formatNumber(yaw!)} / ${formatNumber(roll!)} °/s`
    : "Not calculated yet";

  return (
    <section className="fit-term-performance" aria-label="Fitting outcomes and ship performance">
      <div className="fit-term-performance-pip">
        <PowerPipAssignment
          pipAssignment={pipAssignment}
          systemDraws={systemDraws}
          powerBudget={simulatedPowerCapacity ?? powerOut}
          allocatedPower={simulatedPowerAllocated}
          coolingUtilization={coolingUtilization}
          simulationLoading={simulation.loading}
          onPipChange={onPipChange}
        />
      </div>

      <DefensiveCapabilitiesCard
        shieldHp={shieldHp}
        shieldRegen={shieldRegen}
        hullHP={hullHP}
        totalHp={totalHp}
        shieldMitigations={shieldMitigations}
        armorMitigations={armorMitigations}
      />

      <FittingStatCard
        title="Offensive Capabilities"
        action={(
          <button type="button" className="fit-term-link-btn" onClick={onViewWeaponStats}>
            Weapon Stats
          </button>
        )}
      >
        <FittingStatRow
          label="Pilot Alpha"
          value={formatAlpha(combatAlpha.pilotAlpha, combatAlpha.loading)}
          unavailable={combatAlpha.pilotAlpha == null && !combatAlpha.loading}
          highlight={combatAlpha.pilotAlpha != null ? "accent" : undefined}
        />
        <FittingStatRow
          label="Crew Alpha"
          value={formatAlpha(combatAlpha.crewAlpha, combatAlpha.loading)}
          unavailable={combatAlpha.crewAlpha == null && !combatAlpha.loading}
        />
        <FittingStatRow
          label="Sustained DPS (60s)"
          value={simulation.loading ? "…" : sustainedWeaponDps != null ? formatNumber(sustainedWeaponDps) : "Not calculated yet"}
          unavailable={sustainedWeaponDps == null && !simulation.loading}
          highlight={sustainedWeaponDps != null ? "accent" : undefined}
        />
        <FittingStatRow
          label="Damage over 60s"
          value={simulation.loading ? "…" : sustainedWeaponDamage != null ? formatNumber(sustainedWeaponDamage) : "Not calculated yet"}
          unit={sustainedWeaponDamage != null ? " Dmg" : undefined}
          unavailable={sustainedWeaponDamage == null && !simulation.loading}
        />

        <FittingStatSection title="Missiles & Bombs">
          <FittingStatRow
            label="Total Payload Output"
            value={ordnancePayload != null ? formatNumber(ordnancePayload) : "Not calculated yet"}
            unit=" Dmg"
            unavailable={ordnancePayload == null}
            highlight={ordnancePayload != null ? "accent" : undefined}
          />
          <FittingStatRow
            label="Armed Count"
            value={ordnanceArmedCount != null ? formatNumber(ordnanceArmedCount) : "Not calculated yet"}
            nested
            unavailable={ordnanceArmedCount == null}
          />
        </FittingStatSection>

        <FittingStatSection title="Storage & Cargo">
          <FittingStatRow
            label="Cargo Grid"
            value={cargoCapacityScu != null ? formatNumber(cargoCapacityScu) : "Not available"}
            unit=" SCU"
            unavailable={cargoCapacityScu == null}
            highlight={cargoCapacityScu != null ? "accent" : undefined}
          />
          <FittingStatRow label="Grid Dimensions" value="Requires fitting API" nested unavailable />
          <FittingStatRow label="Storage" value="Not available" unavailable />
          <FittingStatRow label="k µSCU" value="—" nested unavailable />
        </FittingStatSection>

        <FittingStatSection title="Fuel">
          <FittingStatRow label="Hydrogen" value="Requires fitting API" unavailable />
          <FittingStatRow label="Flight Time" value="—" nested unavailable />
          <FittingStatRow label="Fuel Scoop Effectiveness" value="—" nested unavailable />
          <FittingStatRow label="Quantum" value="Requires fitting API" unavailable />
          <FittingStatRow label="Range" value="—" nested unavailable />
          <FittingStatRow label="Cost to fill — Hydrogen" value="—" nested unavailable />
          <FittingStatRow label="Cost to fill — Quantum" value="—" nested unavailable />
        </FittingStatSection>
      </FittingStatCard>

      <FittingStatCard title="Thruster Output">
        <FittingStatSection title="Flight Performances">
          <FittingStatRow
            label="SCM / AB"
            value={scmSpeed != null && boostSpeed != null
              ? `${formatNumber(scmSpeed)} / ${formatNumber(boostSpeed)}`
              : scmSpeed != null ? formatNumber(scmSpeed) : "Not calculated yet"}
            unit={scmSpeed != null ? " m/s" : undefined}
            unavailable={scmSpeed == null}
          />
          <FittingStatRow label="NAV" value={formatSpeed(maxSpeed)} unavailable={maxSpeed == null} />
          <FittingStatRow label="Boost Ramp Time" value="Not calculated yet" unavailable />
          <FittingStatRow label="P / Y / R" value={pyrLine} unavailable={pitch == null && yaw == null && roll == null} />
          <FittingStatRow label="AB P / Y / R" value="Not calculated yet" unavailable />
          {boostCapacity != null || boostRegen != null ? (
            <FittingStatRow
              label="Boost Capacity / Regen"
              value={[boostCapacity, boostRegen].map((value) => value != null ? formatNumber(value) : "—").join(" / ")}
              nested
            />
          ) : null}
        </FittingStatSection>

        <FittingStatSection title="Accelerations">
          <FittingStatRow label="Main" value="Not calculated yet" unavailable />
          <FittingStatRow label="Retro" value="Not calculated yet" unavailable />
          <FittingStatRow label="Up Strafe" value="Not calculated yet" unavailable />
          <FittingStatRow label="Down Strafe" value="Not calculated yet" unavailable />
          <FittingStatRow label="Lateral Strafe" value="Not calculated yet" unavailable />
        </FittingStatSection>
      </FittingStatCard>
    </section>
  );
}
