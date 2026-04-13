import type { GunneryState } from '../../hooks/useGunneryState'

type Props = Pick<GunneryState, 'scenarios' | 'activeScenarioId' | 'activeScenario' | 'selectScenario'>

export function ScenarioSection({ scenarios, activeScenarioId, activeScenario, selectScenario }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="gun-scenario-grid">
        {scenarios.map(s => (
          <button
            key={s.id}
            className={`gun-scenario-btn${activeScenarioId === s.id ? ' is-active' : ''}`}
            onClick={() => selectScenario(activeScenarioId === s.id ? null : s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {activeScenario ? (
        <div className="gun-scenario-display">
          <div className="gun-scenario-meta">
            <span className={`gun-mode-badge ${activeScenario.recommendedMode.toLowerCase()}`}>
              {activeScenario.recommendedMode === 'AM' ? 'Auto Manual' : 'Precision Manual'}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'rgba(180,200,220,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
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
        <div className="gun-result">
          <div className="gun-result-empty">Select a scenario to see recommended mode and key rules.</div>
        </div>
      )}
    </div>
  )
}
