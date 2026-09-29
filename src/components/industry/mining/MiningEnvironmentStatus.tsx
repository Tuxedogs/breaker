import type { MiningEnvironmentPresentation } from "../../../features/mining/miningPresentationModels";

function breathabilityTitle(state: MiningEnvironmentPresentation["breathability"]): string {
  if (state === "breathable") return "Breathable atmosphere";
  if (state === "non-breathable") return "Non-breathable atmosphere";
  return "Breathability data unavailable";
}

function temperatureTitle(environment: MiningEnvironmentPresentation): string {
  const detail = environment.temperatureCelsius === null ? "" : ` (${environment.temperatureCelsius} °C)`;
  if (environment.temperature === "optimal") return `Optimal environment${detail}`;
  if (environment.temperature === "hot") return `Hot environment${detail}`;
  if (environment.temperature === "cold") return `Cold environment${detail}`;
  return environment.temperatureCelsius === null
    ? "Temperature data unavailable"
    : `Temperature classification unavailable${detail}`;
}

export default function MiningEnvironmentStatus({ environment }: { environment: MiningEnvironmentPresentation }) {
  const oxygenTitle = breathabilityTitle(environment.breathability);
  const thermalTitle = temperatureTitle(environment);
  return (
    <div className="mining-environment-status" role="group" aria-label="Environmental status">
      <span className={`mining-environment-status-icon is-${environment.breathability}`} role="img" title={oxygenTitle} aria-label={oxygenTitle}>
        <span className="mining-environment-oxygen" aria-hidden="true">O₂</span>
      </span>
      <span className={`mining-environment-status-icon is-${environment.temperature}`} role="img" title={thermalTitle} aria-label={thermalTitle}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 14.6V5a2 2 0 1 1 4 0v9.6a5 5 0 1 1-4 0Z" />
          <path d="M12 8v8" />
        </svg>
      </span>
    </div>
  );
}
