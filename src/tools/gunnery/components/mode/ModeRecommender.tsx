import type { GunneryState } from '../../hooks/useGunneryState'
import { GIMBAL_MODES } from '../../data/modes'


type Props = Pick<GunneryState,
  | 'operatorType' | 'setOperatorType'
  | 'targetType' | 'setTargetType'
  | 'range' | 'setRange'
  | 'speed' | 'setSpeed'
  | 'recommendation'
  | 'clearRecommender'
>

const OPERATOR_TYPES = [
  { id: 'heavy-fighter',  label: 'Heavy Fighter'  },
  { id: 'medium-fighter', label: 'Medium Fighter' },
  { id: 'gunship',        label: 'Gunship'        },
  { id: 'capital-gunner', label: 'Capital Gunner' },
] as const

const TARGET_TYPES = [
  { id: 'capital', label: 'Capital' },
  { id: 'medium',  label: 'Medium' },
  { id: 'small',   label: 'Small'  },
] as const

const RANGES = [
  { id: 'close', label: 'Close' },
  { id: 'mid',   label: 'Mid'   },
  { id: 'far',   label: 'Far'   },
] as const

const SPEEDS = [
  { id: 'slow',   label: 'Slow'   },
  { id: 'medium', label: 'Medium' },
  { id: 'fast',   label: 'Fast'   },
] as const

export function ModeRecommender({
  operatorType, setOperatorType,
  targetType, setTargetType,
  range, setRange,
  speed, setSpeed,
  recommendation,
  clearRecommender,
}: Props) {
  return (
    <div className="gun-recommender">
      {/* Inputs */}
      <div className="gun-selector-group">
        <div className="gun-selector-label tool-section-label">Your Ship Type</div>
        <div className="gun-option-row tool-choice-row">
          {OPERATOR_TYPES.map(o => (
            <button
              key={o.id}
              className={`gun-option-btn tool-choice-button${operatorType === o.id ? ' is-active' : ''}`}
              onClick={() => setOperatorType(operatorType === o.id ? null : o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="gun-selector-group">
        <div className="gun-selector-label tool-section-label">Target Type</div>
        <div className="gun-option-row tool-choice-row">
          {TARGET_TYPES.map(t => (
            <button
              key={t.id}
              className={`gun-option-btn tool-choice-button${targetType === t.id ? ' is-active' : ''}`}
              onClick={() => setTargetType(targetType === t.id ? null : t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="gun-selector-group">
        <div className="gun-selector-label tool-section-label">Range</div>
        <div className="gun-option-row tool-choice-row">
          {RANGES.map(r => (
            <button
              key={r.id}
              className={`gun-option-btn tool-choice-button${range === r.id ? ' is-active' : ''}`}
              onClick={() => setRange(range === r.id ? null : r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="gun-selector-group">
        <div className="gun-selector-label tool-section-label">Target Speed</div>
        <div className="gun-option-row tool-choice-row">
          {SPEEDS.map(s => (
            <button
              key={s.id}
              className={`gun-option-btn tool-choice-button${speed === s.id ? ' is-active' : ''}`}
              onClick={() => setSpeed(speed === s.id ? null : s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      <div className="gun-result tool-panel">
        {!recommendation ? (
          <div className="gun-result-empty">
            Select target type, range, and speed to get a mode recommendation.
          </div>
        ) : (
          <>
            <div className="gun-result-mode">
              <span className={`gun-mode-badge tool-chip ${recommendation.mode.toLowerCase()}`}>
                {recommendation.mode === 'AM' ? 'Auto Manual' : recommendation.mode === 'PM' ? 'Precision Manual' : 'Fixed'}
              </span>
              <span className={`gun-confidence-tag tool-chip ${recommendation.confidence}`}>
                {recommendation.confidence === 'strong' ? 'Strong match' : 'Moderate'}
              </span>
            </div>
            <div className="gun-result-reasoning">{recommendation.reasoning}</div>
          </>
        )}
      </div>

      {/* Mode comparison */}
      <div className="gun-mode-comparison">
        {GIMBAL_MODES.filter(m => m.id !== 'Fixed').map(mode => (
          <div
            key={mode.id}
            className={[
              'gun-mode-card',
              'tool-info-card',
              mode.id.toLowerCase(),
              recommendation?.mode === mode.id ? 'is-recommended' : '',
            ].join(' ').trim()}
          >
            <div className="gun-mode-card-header">
              <div className={`gun-mode-card-label ${mode.id.toLowerCase()}`}>{mode.label}</div>
            </div>
            <div className="gun-mode-card-tagline">{mode.tagline}</div>
            <ul className="gun-mode-card-list strengths">
              {mode.strengths.map(s => <li key={s}>{s}</li>)}
            </ul>
            <ul className="gun-mode-card-list weaknesses">
              {mode.weaknesses.map(w => <li key={w}>{w}</li>)}
            </ul>
            <div className="gun-mode-card-best">
              Best for: <span>{mode.bestFor}</span>
            </div>
          </div>
        ))}
      </div>

      {(operatorType || targetType || range || speed) && (
        <button
          className="gun-option-btn tool-choice-button"
          style={{ alignSelf: 'flex-start' }}
          onClick={clearRecommender}
        >
          Clear
        </button>
      )}
    </div>
  )
}
