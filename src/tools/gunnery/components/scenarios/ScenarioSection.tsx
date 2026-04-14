import type { GunneryState } from '../../hooks/useGunneryState'

type Props = Pick<GunneryState, 'scenarios' | 'activeScenarioId' | 'activeScenario' | 'selectScenario'>

export function ScenarioSection({ scenarios, activeScenarioId, activeScenario, selectScenario }: Props) {
  return (
    <div className="gun-section-stack">
      <div className="gun-scenario-grid tool-choice-row">
        {scenarios.map(s => (
          <button
            key={s.id}
            className={`gun-scenario-btn tool-choice-button${activeScenarioId === s.id ? ' is-active' : ''}`}
            onClick={() => selectScenario(activeScenarioId === s.id ? null : s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {activeScenario ? (
        <div className="gun-scenario-display tool-panel">
          <div className="gun-scenario-meta">
            <span className={`gun-mode-badge tool-chip ${activeScenario.recommendedMode.toLowerCase()}`}>
              {activeScenario.recommendedMode === 'AM' ? 'Auto Manual' : 'Precision Manual'}
            </span>
            <span className="gun-scenario-context tool-section-label">
              {activeScenario.targetType} · {activeScenario.range} · {activeScenario.speed}
            </span>
          </div>

          <div className="gun-scenario-description">{activeScenario.description}</div>

          <div className="gun-scenario-rules">
            {activeScenario.keyRules.map((rule, i) => (
              <div key={i} className="gun-scenario-rule">{rule}</div>
            ))}
          </div>
        </div>
      ) : (
        <div className="gun-result tool-panel">
          <div className="gun-result-empty">Select a scenario to see recommended mode and key rules.</div>
        </div>
      )}
    </div>
  )
}
