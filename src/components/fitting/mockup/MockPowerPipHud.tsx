import { useMemo, useState } from "react";
import PowerPipIcon from "../terminal/PowerPipIcons";
import { resolvePowerChannelLabel } from "../../../lib/fitting/mockup/resolvePowerChannelLabel";
import {
  PIP_MAX_PER_CATEGORY,
  type PipAssignment,
  type PipCategory,
} from "../../../lib/fitting/fittingTerminalTypes";
import type { FittingSimulationState } from "../../../lib/fitting/useFittingSimulation";
import { sumMockPipAssignment } from "./mockPipAssignment";

const MOCK_PIP_SEGMENT_COUNT = PIP_MAX_PER_CATEGORY;

type MockPipColumnDef = {
  key: PipCategory;
  min: number;
};

const MOCK_PIP_COLUMNS: MockPipColumnDef[] = [
  { key: "weapons", min: 0 },
  { key: "engines", min: 0 },
  { key: "quantum", min: 0 },
  { key: "radar", min: 0 },
  { key: "shields", min: 0 },
  { key: "lifeSupport", min: 0 },
  { key: "cooler1", min: 0 },
  { key: "cooler2", min: 0 },
];

type PipStackPart =
  | { kind: "segment"; slot: number }
  | { kind: "merged"; minSlots: number };

type PipUnitState = "on";

function buildPipStackParts(min: number, segmentCount: number): PipStackPart[] {
  if (min <= 1) {
    return Array.from({ length: segmentCount }, (_, index) => ({
      kind: "segment" as const,
      slot: segmentCount - 1 - index,
    }));
  }
  const parts: PipStackPart[] = [];
  for (let slot = segmentCount - 1; slot >= min; slot -= 1) {
    parts.push({ kind: "segment", slot });
  }
  parts.push({ kind: "merged", minSlots: min });
  return parts;
}

/**
 * Do not assign an aggregate reactor shortfall to individual categories. The
 * server intentionally has no priority rule for deciding which segments win.
 */
function buildPipUnitStates(assignment: PipAssignment): Map<string, PipUnitState> {
  const result = new Map<string, PipUnitState>();

  for (const { key } of MOCK_PIP_COLUMNS) {
    const level = assignment[key];
    for (let fromBottom = 0; fromBottom < level; fromBottom += 1) {
      result.set(`${key}:${fromBottom}`, "on");
    }
  }

  return result;
}

function pipUnitState(
  unitStates: Map<string, PipUnitState>,
  category: PipCategory,
  fromBottom: number,
): PipUnitState | null {
  return unitStates.get(`${category}:${fromBottom}`) ?? null;
}

function mergedFillState(
  unitStates: Map<string, PipUnitState>,
  category: PipCategory,
  min: number,
  level: number,
): "off" | "on" | "partial" {
  if (level <= 0) return "off";
  if (level < min) return "partial";

  const states = Array.from({ length: min }, (_, index) => pipUnitState(unitStates, category, index));
  if (states.every((state) => state === "on")) return "on";
  return "partial";
}

function iconPowerClass(
  level: number,
): "is-off" | "is-powered" {
  if (level <= 0) return "is-off";
  return "is-powered";
}

function formatSimulationValue(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
}

function systemReadout(
  key: PipCategory,
  level: number,
  simulation: FittingSimulationState | undefined,
): string {
  if (simulation?.loading) return "Updating simulation…";
  if (simulation?.error) return "Simulation unavailable";

  if (key === "weapons") {
    const dps = simulation?.data?.weaponsSummary.dps.value ?? null;
    return dps != null ? `${formatSimulationValue(dps)} sustained DPS (60s)` : `${level} segments assigned`;
  }
  if (key === "cooler1" || key === "cooler2") {
    const utilization = simulation?.data?.cooling.utilizationPercent.value ?? null;
    return utilization != null ? `${formatSimulationValue(utilization)}% total utilization` : `${level} segments assigned`;
  }
  if (key === "shields") {
    const regen = simulation?.data?.shields?.effectiveRegenPerSecond.value ?? null;
    if (regen != null) return `${formatSimulationValue(regen)}/s shield regeneration`;
    if (!simulation?.data?.shields) return `${level} segments assigned`;
    const reason = simulation.data.missingInputs.find((entry) => (
      entry.path === "powerAllocation.shields"
      || entry.path === "shield.regenByPowerAllocation"
      || entry.path === "powerAllocation"
    ))?.reason ?? "";
    if (reason.includes("no per-generator distribution rule")) return "regeneration unavailable · no distribution rule";
    if (reason.includes("No extracted shield-regeneration value")) return "regeneration unavailable · no exact pip step";
    if (reason.includes("exceeds active reactor capacity")) return "regeneration unavailable · allocation exceeds capacity";
    return "shield regeneration unavailable";
  }
  return `${level} segments assigned`;
}

type MockPowerPipHudProps = {
  assignment: PipAssignment;
  hideOutputFooter?: boolean;
  powerBudget?: number | null;
  simulation?: FittingSimulationState;
  onPipChange: (category: PipCategory, value: number) => void;
};

export default function MockPowerPipHud({
  assignment,
  hideOutputFooter = false,
  powerBudget = null,
  simulation,
  onPipChange,
}: MockPowerPipHudProps) {
  const [activeColumn, setActiveColumn] = useState<PipCategory | null>(null);
  const assignedTotal = sumMockPipAssignment(assignment);
  const budget = powerBudget != null && Number.isFinite(powerBudget) ? powerBudget : null;
  const remaining = budget != null ? budget - assignedTotal : null;
  const overBudget = remaining != null && remaining < 0;

  const unitStates = useMemo(
    () => buildPipUnitStates(assignment),
    [assignment],
  );

  const setCategoryLevel = (category: PipCategory, nextLevel: number) => {
    const clamped = Math.max(0, Math.min(MOCK_PIP_SEGMENT_COUNT, nextLevel));
    setActiveColumn(category);
    onPipChange(category, clamped);
  };

  const handleSegmentClick = (category: PipCategory, slotFromBottom: number, min: number) => {
    const level = assignment[category];
    const target = slotFromBottom + 1;
    if (target === level) { setCategoryLevel(category, slotFromBottom); return; }
    if (min > 0 && target < min) { setCategoryLevel(category, min); return; }
    setCategoryLevel(category, target);
  };

  const activeDef = activeColumn ? MOCK_PIP_COLUMNS.find((column) => column.key === activeColumn) : null;

  return (
    <div className="fit-mock-pips-hud">
      <div className="fit-mock-pips-columns" role="group" aria-label="Power pip columns">
        {MOCK_PIP_COLUMNS.map(({ key, min }) => {
          const label = resolvePowerChannelLabel(key);
          const level = assignment[key];
          const stackParts = buildPipStackParts(min, MOCK_PIP_SEGMENT_COUNT);
          const iconClass = iconPowerClass(level);

          return (
            <div key={key} className={["fit-mock-pip-col", activeColumn === key ? "is-active" : "", level <= 0 ? "is-off" : ""].filter(Boolean).join(" ")}>
              <div className="fit-mock-pip-stack" aria-label={`${label} ${level} of ${MOCK_PIP_SEGMENT_COUNT} segments assigned`}>
                {stackParts.map((part) => {
                  if (part.kind === "merged") {
                    const mergedState = mergedFillState(unitStates, key, min, level);
                    const partial = level > 0 && level < min;
                    return (
                      <button
                        key="merged"
                        type="button"
                        className={[
                          "fit-mock-pip-merged",
                          mergedState === "on" ? "is-on" : "",
                          partial ? "is-partial" : "",
                          min > 0 && mergedState === "off" ? "is-min" : "",
                        ].filter(Boolean).join(" ")}
                        style={{ flex: part.minSlots }}
                        aria-label={`Set ${label} allocation to ${level >= min ? 0 : min} segments`}
                        onClick={() => setCategoryLevel(key, level >= min ? 0 : min)}
                      />
                    );
                  }

                  const isOn = part.slot < level;
                  const fillState = isOn ? pipUnitState(unitStates, key, part.slot) : null;
                  return (
                    <button
                      key={part.slot}
                      type="button"
                      className={[
                        "fit-mock-pip-seg",
                        fillState === "on" ? "is-on" : "",
                        min > 0 && part.slot < min && !isOn ? "is-min" : "",
                      ].filter(Boolean).join(" ")}
                      aria-label={`Set ${label} allocation to ${part.slot + 1 === level ? part.slot : part.slot + 1} segments`}
                      aria-pressed={isOn}
                      onClick={() => handleSegmentClick(key, part.slot, min)}
                    />
                  );
                })}
              </div>
              <button
                type="button"
                className={["fit-mock-pip-icon", iconClass].filter(Boolean).join(" ")}
                aria-label={`${level > 0 ? "Turn off" : "Turn on"} ${label}`}
                aria-pressed={level > 0}
                onClick={() => setCategoryLevel(key, level > 0 ? 0 : Math.max(min, 1))}
              >
                <PowerPipIcon category={key} />
              </button>
              <span className="fit-mock-pip-label">{label}</span>
            </div>
          );
        })}
      </div>
      {hideOutputFooter ? null : (
        <div className="fit-mock-pips-footer">
          <div className={["fit-mock-pips-output-block", overBudget ? "is-over-budget" : ""].filter(Boolean).join(" ")}>
            <span className="fit-mock-pips-output-label">Remaining / Capacity</span>
            <strong className="fit-mock-pips-output-value">
              <span className="fit-mock-pips-open">{remaining != null ? formatSimulationValue(remaining) : "—"}</span>
              <span className="fit-mock-pips-slash"> / </span>
              <span className="fit-mock-pips-total">{budget != null ? formatSimulationValue(budget) : "—"}</span>
            </strong>
            {activeDef ? (
              <span className="fit-mock-pips-system-readout">
                {resolvePowerChannelLabel(activeDef.key)} · {systemReadout(activeDef.key, assignment[activeDef.key], simulation)}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
