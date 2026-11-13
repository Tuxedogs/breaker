import type { MiningEnvironmentPresentation } from "../../../features/mining/miningPresentationModels";
import { MINING_EQUIPMENT_SLOTS, MINING_HAZARD_SLOTS, miningConditionState } from "../../../features/mining/miningEnvironmentMetadata";

function ConditionPlate({ label, slots, conditions }: { label: string; slots: ReadonlyArray<{ code: string; label: string }>; conditions: Record<string, boolean | null | undefined> }) {
  // Condition slots only earn a plate once a source confirms at least one of them.
  if (!slots.some((slot) => miningConditionState(conditions[slot.code]) !== "unknown")) return null;
  return <div className="mdet-plate">
    <span className="mdet-plate-key">{label}</span>
    <span className="mining-environment-slots">{slots.map((slot) => {
      const state = miningConditionState(conditions[slot.code]);
      return <span className={`mining-environment-slot is-${state} slot-${slot.code.toLowerCase()}`} key={slot.code} title={`${slot.label}: ${state}`} aria-label={`${slot.label}: ${state}`}>
        {slot.code} <span aria-hidden="true">{state === "unknown" ? "" : state === "on" ? "✓" : "–"}</span>
      </span>;
    })}</span>
  </div>;
}

/** Location facts rendered as readable plates over the hero topography. */
export default function MiningEnvironmentStatus({ environment, locationKind, conditions = {} }: { environment: MiningEnvironmentPresentation; locationKind?: string; conditions?: Record<string, boolean | null | undefined> }) {
  const type = locationKind && locationKind !== "location" ? locationKind : null;
  const celsius = environment.temperatureCelsius === null ? "" : ` · ${environment.temperatureCelsius} °C`;
  const hazard = environment.temperature === "hot" ? { tone: "warn", text: `▲ Hot${celsius}` }
    : environment.temperature === "cold" ? { tone: "warn", text: `▼ Cold${celsius}` }
    : environment.temperature === "optimal" ? { tone: "", text: `Optimal${celsius}` }
    : { tone: "unknown", text: "Unknown" };
  const air = environment.breathability === "breathable" ? { tone: "good", text: "O₂ · Breathable" }
    : environment.breathability === "non-breathable" ? { tone: "bad", text: "O₂ · Not breathable" }
    : { tone: "unknown", text: "O₂ · Unknown" };
  return <>
    <div className={`mdet-plate${type ? "" : " is-unknown"}`}><span className="mdet-plate-key">Type</span><span className="mdet-plate-value">{type ?? "Unknown"}</span></div>
    <div className={`mdet-plate is-${air.tone}`}><span className="mdet-plate-key">Atmosphere</span><span className="mdet-plate-value">{air.text}</span></div>
    <div className={`mdet-plate${hazard.tone ? ` is-${hazard.tone}` : ""}`}><span className="mdet-plate-key">Hazard</span><span className="mdet-plate-value">{hazard.text}</span></div>
    <ConditionPlate label="Specialized equipment" slots={MINING_EQUIPMENT_SLOTS} conditions={conditions} />
    <ConditionPlate label="Hazards" slots={MINING_HAZARD_SLOTS} conditions={conditions} />
  </>;
}
