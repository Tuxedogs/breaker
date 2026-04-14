import type { GunneryState } from '../../hooks/useGunneryState'

type Props = Pick<GunneryState, 'diagnosis' | 'activeSymptomId' | 'setActiveSymptomId' | 'diagnosisResult'>

export function DiagnosisSection({ diagnosis, activeSymptomId, setActiveSymptomId, diagnosisResult }: Props) {
  return (
    <div className="gun-section-stack">
      <div className="gun-symptom-list">
        {diagnosis.map(entry => (
          <button
            key={entry.id}
            className={`gun-symptom-btn${activeSymptomId === entry.id ? ' is-active' : ''}`}
            onClick={() => setActiveSymptomId(activeSymptomId === entry.id ? null : entry.id)}
          >
            <span className="gun-symptom-caret">▸</span>
            {entry.symptom}
          </button>
        ))}
      </div>

      {diagnosisResult ? (
        <div className="gun-diagnosis-result tool-panel">
          <div className="gun-diagnosis-block">
            <div className="gun-diagnosis-block-label tool-section-label">Cause</div>
            <div className="gun-diagnosis-block-text">{diagnosisResult.cause}</div>
          </div>
          <div className="gun-diagnosis-block">
            <div className="gun-diagnosis-block-label tool-section-label">Correction</div>
            <div className="gun-diagnosis-block-text gun-diagnosis-correction">{diagnosisResult.correction}</div>
          </div>
        </div>
      ) : (
        <div className="gun-result tool-panel">
          <div className="gun-result-empty">Select a symptom to see the likely cause and correction.</div>
        </div>
      )}
    </div>
  )
}
