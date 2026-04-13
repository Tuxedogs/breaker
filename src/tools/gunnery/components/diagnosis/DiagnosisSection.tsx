import type { GunneryState } from '../../hooks/useGunneryState'

type Props = Pick<GunneryState, 'diagnosis' | 'activeSymptomId' | 'setActiveSymptomId' | 'diagnosisResult'>

export function DiagnosisSection({ diagnosis, activeSymptomId, setActiveSymptomId, diagnosisResult }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="gun-symptom-list">
        {diagnosis.map(entry => (
          <button
            key={entry.id}
            className={`gun-symptom-btn${activeSymptomId === entry.id ? ' is-active' : ''}`}
            onClick={() => setActiveSymptomId(activeSymptomId === entry.id ? null : entry.id)}
          >
            <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>▸</span>
            {entry.symptom}
          </button>
        ))}
      </div>

      {diagnosisResult ? (
        <div className="gun-diagnosis-result">
          <div className="gun-diagnosis-block">
            <div className="gun-diagnosis-block-label">Cause</div>
            <div className="gun-diagnosis-block-text">{diagnosisResult.cause}</div>
          </div>
          <div className="gun-diagnosis-block">
            <div className="gun-diagnosis-block-label">Correction</div>
            <div className="gun-diagnosis-block-text gun-diagnosis-correction">{diagnosisResult.correction}</div>
          </div>
        </div>
      ) : (
        <div className="gun-result">
          <div className="gun-result-empty">Select a symptom to see the likely cause and correction.</div>
        </div>
      )}
    </div>
  )
}
