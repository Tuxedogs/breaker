import { useEffect, useMemo, useState } from "react";
import type { DamageTypeMap, FittingComponentMitigation } from "../../../lib/fitting/fittingApi";
import { formatNumber } from "../../../lib/fitting/fittingPortGrouping";
import {
  clampThresholdSliderValue,
  computeThresholdBreakdown,
  thresholdSliderMax,
  thresholdSliderStep,
} from "../../../lib/fitting/fittingThresholdCalc";
import {
  FittingStatGrid,
  FittingStatRow,
  FittingStatSection,
} from "./FittingStatCard";

type DefensiveCapabilitiesCardProps = {
  shieldHp: number | null;
  shieldRegen: number | null;
  hullHP: number | null;
  totalHp: number | null;
  shieldMitigations: Array<Extract<FittingComponentMitigation, { kind: "shield" }>>;
  armorMitigations: Array<Extract<FittingComponentMitigation, { kind: "armor" }>>;
};

type ThresholdSliderProps = {
  label: string;
  value: number;
  max: number;
  unit?: string;
  onChange: (value: number) => void;
};

function ThresholdSlider({ label, value, max, unit = " HP", onChange }: ThresholdSliderProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <label className="fit-stat-slider">
      <span className="fit-stat-slider-label">
        {label}
        <strong>
          {formatNumber(value)}
          {unit}
        </strong>
      </span>
      <div className="fit-term-bar-track fit-term-bar-track--threshold">
        <span
          className="fit-term-bar-fill fit-term-bar-fill--threshold"
          style={{ width: `${pct}%` }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={thresholdSliderStep(max)}
        value={Math.min(value, max)}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function valueRange(values: number[]): string | null {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return null;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  return min === max ? formatNumber(min) : `${formatNumber(min)}-${formatNumber(max)}`;
}

function damageRange(
  maps: Array<DamageTypeMap | null>,
  damageType: "physical" | "energy" | "distortion",
  fields: Array<"max" | "min" | "value" | "multiplier">,
): string | null {
  const values: number[] = [];
  for (const map of maps) {
    const entry = map?.[damageType];
    if (!entry) continue;
    for (const field of fields) {
      const value = entry[field];
      if (typeof value === "number" && Number.isFinite(value)) {
        values.push(value);
        break;
      }
    }
  }
  return valueRange(values);
}

function missingValue(value: string | null): string {
  return value ?? "Source field unavailable";
}

export default function DefensiveCapabilitiesCard({
  shieldHp,
  shieldRegen,
  hullHP,
  totalHp,
  shieldMitigations,
  armorMitigations,
}: DefensiveCapabilitiesCardProps) {
  const [showThresholds, setShowThresholds] = useState(false);
  const [sliderShieldHp, setSliderShieldHp] = useState(0);
  const [sliderArmorHp, setSliderArmorHp] = useState(0);

  useEffect(() => {
    if (shieldHp != null) setSliderShieldHp(Math.round(shieldHp));
  }, [shieldHp]);

  const shieldSliderMax = thresholdSliderMax(shieldHp);
  const armorSliderMax = thresholdSliderMax(hullHP, shieldHp);

  useEffect(() => {
    setSliderArmorHp((current) => clampThresholdSliderValue(current, armorSliderMax));
  }, [armorSliderMax]);

  useEffect(() => {
    setSliderShieldHp((current) => clampThresholdSliderValue(current, shieldSliderMax));
  }, [shieldSliderMax]);

  const breakdown = useMemo(
    () => computeThresholdBreakdown({
      shieldHp: sliderShieldHp,
      armorHp: sliderArmorHp,
      hullHp: hullHP,
    }),
    [sliderShieldHp, sliderArmorHp, hullHP],
  );

  const shieldResistanceMaps = shieldMitigations.map((entry) => entry.resistanceByDamageType);
  const shieldAbsorptionMaps = shieldMitigations.map((entry) => entry.absorptionByDamageType);
  const armorResistanceMaps = armorMitigations.map((entry) => entry.resistanceByDamageType);
  const armorDeflectionMaps = armorMitigations.map((entry) => entry.deflectionThresholdByDamageType);
  const armorDamageMultiplierMaps = armorMitigations.map((entry) => entry.damageMultiplierByDamageType);
  const armorHpRange = valueRange(armorMitigations.map((entry) => entry.health).filter((value): value is number => typeof value === "number"));
  const basePenetrationReductionRange = valueRange(armorMitigations.map((entry) => entry.basePenetrationReduction).filter((value): value is number => typeof value === "number"));
  const shieldEnergyResistance = damageRange(shieldResistanceMaps, "energy", ["max", "value"]);
  const shieldPhysicalResistance = damageRange(shieldResistanceMaps, "physical", ["max", "value"]);
  const shieldDistortionResistance = damageRange(shieldResistanceMaps, "distortion", ["max", "value"]);
  const shieldPhysicalAbsorption = damageRange(shieldAbsorptionMaps, "physical", ["max", "value"]);
  const armorPhysicalDeflection = damageRange(armorDeflectionMaps, "physical", ["value"]);
  const armorPhysicalDamageMultiplier = damageRange(armorDamageMultiplierMaps, "physical", ["value", "multiplier"]);
  const armorEnergyResistance = damageRange(armorResistanceMaps, "energy", ["multiplier", "value"]);

  return (
    <article className="fit-stat-card fit-stat-card--flip">
      <header className="fit-stat-card-head">
        <h3>{showThresholds ? "Thresholds" : "Defensive Capabilities"}</h3>
        <button
          type="button"
          className="fit-term-link-btn fit-stat-flip-btn"
          aria-pressed={showThresholds}
          onClick={() => setShowThresholds((current) => !current)}
        >
          {showThresholds ? "Overview" : "Thresholds"}
        </button>
      </header>

      <div className="fit-stat-card-body">
        {!showThresholds ? (
          <>
            <FittingStatSection title="Shield">
              <FittingStatRow label="Type" value="Bubble" unavailable={shieldHp == null} />
              <FittingStatRow
                label="HP"
                value={shieldHp != null ? formatNumber(shieldHp) : "Not calculated yet"}
                unit=" HP"
                unavailable={shieldHp == null}
                highlight={shieldHp != null ? "accent" : undefined}
              />
              <FittingStatRow
                label="Regen"
                value={shieldRegen != null ? formatNumber(shieldRegen) : "Not calculated yet"}
                unit="/s"
                nested
                unavailable={shieldRegen == null}
              />
            </FittingStatSection>

            <FittingStatSection title="Vital">
              <FittingStatRow
                label="HP"
                value={hullHP != null ? formatNumber(hullHP) : "Not available"}
                unit=" HP"
                unavailable={hullHP == null}
                highlight={hullHP != null ? "accent" : undefined}
              />
              <FittingStatRow
                label="Total"
                value={totalHp != null ? formatNumber(totalHp) : "Not calculated yet"}
                unit=" HP"
                nested
                unavailable={totalHp == null}
              />
            </FittingStatSection>

            <FittingStatSection title="Resistances">
              <FittingStatGrid columns={[
                { label: "Energy", value: missingValue(shieldEnergyResistance), unavailable: shieldEnergyResistance == null },
                { label: "Physical", value: missingValue(shieldPhysicalResistance), unavailable: shieldPhysicalResistance == null },
                { label: "Distortion", value: missingValue(shieldDistortionResistance), unavailable: shieldDistortionResistance == null },
              ]}
              />
              <FittingStatRow
                label="Physical Absorption"
                value={missingValue(shieldPhysicalAbsorption)}
                nested
                unavailable={shieldPhysicalAbsorption == null}
              />
            </FittingStatSection>

            <FittingStatSection title="Armor">
              <FittingStatRow
                label="Component HP"
                value={armorHpRange ?? "Not exposed by fitting API"}
                unavailable={armorHpRange == null}
              />
              <FittingStatRow
                label="Base Penetration Reduction"
                value={basePenetrationReductionRange ?? "Source field unavailable"}
                nested
                unavailable={basePenetrationReductionRange == null}
              />
              <FittingStatRow
                label="Physical Deflection"
                value={missingValue(armorPhysicalDeflection)}
                nested
                unavailable={armorPhysicalDeflection == null}
              />
              <FittingStatGrid columns={[
                { label: "Physical", value: missingValue(armorPhysicalDamageMultiplier), unavailable: armorPhysicalDamageMultiplier == null },
                { label: "Energy", value: missingValue(armorEnergyResistance), unavailable: armorEnergyResistance == null },
              ]}
              />
            </FittingStatSection>
          </>
        ) : (
          <>
            <FittingStatSection title="Threshold Inputs">
              <ThresholdSlider
                label="Shield HP"
                value={sliderShieldHp}
                max={shieldSliderMax}
                onChange={(value) => setSliderShieldHp(clampThresholdSliderValue(value, shieldSliderMax))}
              />
              <ThresholdSlider
                label="Armor HP"
                value={sliderArmorHp}
                max={armorSliderMax}
                onChange={(value) => setSliderArmorHp(clampThresholdSliderValue(value, armorSliderMax))}
              />
            </FittingStatSection>

            <FittingStatSection title="Threshold Breakdown">
              <FittingStatRow
                label="Shield Pool"
                value={formatNumber(breakdown.shieldPool)}
                unit=" HP"
                highlight="accent"
              />
              <FittingStatRow
                label="Armor Pool"
                value={formatNumber(breakdown.armorPool)}
                unit=" HP"
                nested
              />
              <FittingStatRow
                label="Armor Threshold Share"
                value={breakdown.armorThresholdShare != null ? formatNumber(breakdown.armorThresholdShare) : "—"}
                unit={breakdown.armorThresholdShare != null ? "%" : undefined}
                nested
                unavailable={breakdown.armorThresholdShare == null}
              />
              <FittingStatRow
                label="Total Before Hull"
                value={formatNumber(breakdown.totalBeforeHull)}
                unit=" HP"
              />
              <FittingStatRow
                label="Hull Pool"
                value={hullHP != null ? formatNumber(breakdown.hullPool) : "Not available"}
                unit=" HP"
                nested
                unavailable={hullHP == null}
              />
              <FittingStatRow
                label="Combined Survivability"
                value={formatNumber(breakdown.totalSurvivability)}
                unit=" HP"
                highlight="good"
              />
            </FittingStatSection>
          </>
        )}
      </div>
    </article>
  );
}
