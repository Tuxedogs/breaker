import { useEffect, useMemo, useState } from "react";
import { getFittingComponent, type FittingCalculateResult, type FittingComponentMitigation } from "../../../lib/fitting/fittingApi";
import type { CombatAlphaBreakdown } from "../../../lib/fitting/useCombatAlphaBreakdown";
import {
  buildOffensiveGroups,
  formatNumber,
  summarizeGroupRows,
  type FittingShipSummary,
  type PortBreakdownRow,
} from "../../../lib/fitting/fittingPortGrouping";
import type { PipAssignment } from "../../../lib/fitting/fittingTerminalTypes";
import type { PipSystemPowerDraw } from "../../../lib/fitting/fittingPipPower";
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
  shipPerformance: FittingShipSummary | null;
  hullHP: number | null;
  cargoCapacityScu: number | null;
  portRows: PortBreakdownRow[];
  combatAlpha: CombatAlphaBreakdown;
  pipAssignment: PipAssignment;
  systemDraws: PipSystemPowerDraw;
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
  shipPerformance,
  hullHP,
  cargoCapacityScu,
  portRows,
  combatAlpha,
  pipAssignment,
  systemDraws,
  onPipChange,
  onViewWeaponStats,
}: FittingPerformanceGridProps) {
  const powerOut = derivedNum(calculateResult, "power", "totalPowerGenerated");
  const powerUsed = derivedNum(calculateResult, "power", "totalPowerRequired");
  const powerMargin = derivedNum(calculateResult, "power", "powerSurplus");
  const shieldHp = derivedNum(calculateResult, "shields", "totalShieldHP");
  const shieldRegen = derivedNum(calculateResult, "shields", "totalRegenRate");
  const [mitigationByComponentId, setMitigationByComponentId] = useState<Record<string, FittingComponentMitigation | null>>({});

  const scmSpeed = shipPerformance?.scmSpeed ?? extractedNum(calculateResult, "performance", "scmSpeed");
  const maxSpeed = shipPerformance?.maxSpeed ?? extractedNum(calculateResult, "performance", "maxSpeed");
  const boostSpeed = shipPerformance?.boostSpeedForward ?? extractedNum(calculateResult, "performance", "boostSpeedForward");
  const pitch = shipPerformance?.pitchRate ?? extractedNum(calculateResult, "performance", "pitchRate");
  const yaw = shipPerformance?.yawRate ?? extractedNum(calculateResult, "performance", "yawRate");
  const roll = shipPerformance?.rollRate ?? extractedNum(calculateResult, "performance", "rollRate");
  const boostCapacity = extractedNum(calculateResult, "performance", "boostCapacity");
  const boostRegen = extractedNum(calculateResult, "performance", "boostRegen");

  const missilePayload = sumNullable([combatAlpha.missileAlpha, combatAlpha.torpedoAlpha]);

  const mitigationComponentIds = useMemo(() => {
    const ids = portRows
      .filter((row) => {
        const text = `${row.ruleCategory ?? ""} ${row.portCategory ?? ""} ${row.componentCategory ?? ""} ${row.portName ?? ""}`.toLowerCase();
        return Boolean(row.equippedComponentKey) && (text.includes("shield") || text.includes("armor"));
      })
      .map((row) => row.equippedComponentKey!)
      .filter((componentId, index, values) => values.indexOf(componentId) === index);
    return ids;
  }, [portRows]);

  useEffect(() => {
    if (mitigationComponentIds.length === 0) return;

    const controller = new AbortController();
    void (async () => {
      const next: Record<string, FittingComponentMitigation | null> = {};
      for (const componentId of mitigationComponentIds) {
        try {
          const detail = await getFittingComponent(componentId, controller.signal);
          if (controller.signal.aborted) return;
          next[componentId] = detail.mitigation;
        } catch {
          if (controller.signal.aborted) return;
          next[componentId] = null;
        }
      }
      if (!controller.signal.aborted) setMitigationByComponentId(next);
    })();

    return () => controller.abort();
  }, [mitigationComponentIds]);

  const activeMitigationByComponentId = useMemo(() => {
    if (mitigationComponentIds.length === 0) return {};
    const next: Record<string, FittingComponentMitigation | null> = {};
    for (const componentId of mitigationComponentIds) {
      if (componentId in mitigationByComponentId) {
        next[componentId] = mitigationByComponentId[componentId];
      }
    }
    return next;
  }, [mitigationComponentIds, mitigationByComponentId]);
  const componentMitigations = useMemo(
    () => Object.values(activeMitigationByComponentId),
    [activeMitigationByComponentId],
  );
  const shieldMitigations = useMemo(
    () => componentMitigations.filter((entry): entry is Extract<FittingComponentMitigation, { kind: "shield" }> => entry?.kind === "shield"),
    [componentMitigations],
  );
  const armorMitigations = useMemo(
    () => componentMitigations.filter((entry): entry is Extract<FittingComponentMitigation, { kind: "armor" }> => entry?.kind === "armor"),
    [componentMitigations],
  );

  const missileArmedCount = useMemo(() => {
    const lookup = new Map(portRows.map((row) => [row.portId, row]));
    const missileGroup = buildOffensiveGroups(portRows).find((group) => group.key === "missiles");
    if (!missileGroup) return null;
    const summarized = summarizeGroupRows(missileGroup.rows, "missiles", lookup);
    const total = summarized.reduce((sum, row) => sum + row.quantity, 0);
    return total > 0 ? total : null;
  }, [portRows]);

  const totalHp = sumNullable([shieldHp, hullHP]);
  const marginHighlight = powerMargin != null
    ? powerMargin >= 0 ? "good" as const : "bad" as const
    : undefined;

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
          powerBudget={powerOut}
          onPipChange={onPipChange}
          reactorOutput={powerOut != null ? `${formatNumber(powerOut)} MW` : "Not calculated yet"}
          totalDraw={powerUsed != null ? `${formatNumber(powerUsed)} MW` : "Not calculated yet"}
          margin={powerMargin != null ? `${powerMargin >= 0 ? "+" : ""}${formatNumber(powerMargin)} MW` : "Not calculated yet"}
          marginHighlight={marginHighlight}
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

        <FittingStatSection title="Missiles & Bombs">
          <FittingStatRow
            label="Total Payload Output"
            value={missilePayload != null ? formatNumber(missilePayload) : "Not calculated yet"}
            unit=" Dmg"
            unavailable={missilePayload == null}
            highlight={missilePayload != null ? "accent" : undefined}
          />
          <FittingStatRow
            label="Armed Count"
            value={missileArmedCount != null ? formatNumber(missileArmedCount) : "Not calculated yet"}
            nested
            unavailable={missileArmedCount == null}
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
