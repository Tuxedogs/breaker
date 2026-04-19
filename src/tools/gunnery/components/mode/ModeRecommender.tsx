import type { GunneryState } from '../../hooks/useGunneryState'
import { GIMBAL_MODES } from '../../data/modes'
import type { GimbalModeDefinition } from '../../types'

type Props = Pick<GunneryState,
  | 'weaponType' | 'setWeaponType'
  | 'targetType' | 'setTargetType'
  | 'range' | 'setRange'
  | 'speed' | 'setSpeed'
  | 'recommendation'
  | 'clearRecommender'
>

const WEAPON_TYPES = [
  { id: 'cf-repeaters', label: 'CFs', meta: '1800 m/s' },
  { id: 'ndb', label: 'NDBs', meta: '1400 m/s' },
  { id: 'medusa', label: 'Medusa', meta: '900 m/s' },
] as const

const DEFAULT_TARGET_TYPES = [
  { id: 'fighter', label: 'Fighter' },
  { id: 'heavy-fighter', label: 'Heavy Fighter' },
  { id: 'large', label: 'Large' },
] as const

const MEDUSA_TARGET_TYPES = [
  { id: 'fighter', label: 'Fighter' },
  { id: 'large', label: 'Large' },
  { id: 'capital', label: 'Capital' },
] as const

const RANGES = [
  { id: 'close', label: 'Close', meta: '< 600m' },
  { id: 'mid', label: 'Mid', meta: '601m-1km' },
  { id: 'far', label: 'Far', meta: '1km+' },
] as const

const SPEEDS = [
  { id: 'slow', label: 'Slow' },
  { id: 'medium', label: 'Medium' },
  { id: 'fast', label: 'Fast' },
] as const

const INPUT_SUMMARY = {
  weaponType: Object.fromEntries(WEAPON_TYPES.map((weapon) => [weapon.id, weapon.label])),
  targetType: {
    fighter: 'Fighter',
    'heavy-fighter': 'Heavy Fighter',
    large: 'Large',
    capital: 'Capital',
  },
  range: Object.fromEntries(RANGES.map((rangeOption) => [rangeOption.id, rangeOption.label])),
  speed: Object.fromEntries(SPEEDS.map((speedOption) => [speedOption.id, speedOption.label])),
} as const

function getSwitchNote(mode: GimbalModeDefinition) {
  if (mode.id === 'AM') {
    return 'Switch to PM if the target starts outranging the cone, forcing lead, or breaking tracking with hard movement.'
  }

  return 'Switch to AM if the fight compresses and the target stays slow enough for the cone to hold without constant manual lead.'
}

export function ModeRecommender({
  weaponType,
  setWeaponType,
  targetType,
  setTargetType,
  range,
  setRange,
  speed,
  setSpeed,
  recommendation,
  clearRecommender,
}: Props) {
  const targetOptions = weaponType === 'medusa' ? MEDUSA_TARGET_TYPES : DEFAULT_TARGET_TYPES
  const visibleTargetType = targetOptions.some((option) => option.id === targetType) ? targetType : null
  const recommendedMode = recommendation
    ? GIMBAL_MODES.find((mode) => mode.id === recommendation.mode) ?? null
    : null
  const alternateMode = recommendedMode
    ? GIMBAL_MODES.find((mode) => mode.id !== 'Fixed' && mode.id !== recommendedMode.id) ?? null
    : null
  const selectedInputs = [
    weaponType ? `Weapon: ${INPUT_SUMMARY.weaponType[weaponType]}` : null,
    visibleTargetType ? `Target: ${INPUT_SUMMARY.targetType[visibleTargetType]}` : null,
    range ? `Range: ${INPUT_SUMMARY.range[range]}` : null,
    speed ? `Speed: ${INPUT_SUMMARY.speed[speed]}` : null,
  ].filter((entry): entry is string => Boolean(entry))

  return (
    <div className="gun-recommender gun-recommender-layout">
      <section className="tool-panel tool-control-panel gun-recommender-panel gun-recommender-builder">
        <div className="tool-control-panel-head">
          <div className="tool-control-copy">
            <p className="tool-section-label">Engagement Inputs</p>
            <h2 className="tool-panel-title">Build the firing picture</h2>
            <p className="tool-panel-copy">
              Keep the target picture tight. Build the engagement on the left and read the answer immediately on the right.
            </p>
          </div>
          {selectedInputs.length > 0 && (
            <button
              className="gun-option-btn tool-choice-button tool-choice-button--compact tool-choice-button--strong"
              onClick={clearRecommender}
            >
              Clear Filters
            </button>
          )}
        </div>

        <div className="gun-recommender-grid">
          <div className="tool-control-panel-block gun-selector-group">
            <div className="gun-selector-label tool-section-label">Weapon</div>
            <div className="gun-option-row tool-choice-row">
              {WEAPON_TYPES.map((weapon) => (
                <button
                  key={weapon.id}
                  className={`gun-option-btn tool-choice-button tool-choice-button--strong${weaponType === weapon.id ? ' is-active' : ''}`}
                  aria-pressed={weaponType === weapon.id}
                  onClick={() => setWeaponType(weaponType === weapon.id ? null : weapon.id)}
                >
                  <span>{weapon.label}</span>
                  <span className="gun-option-meta">{weapon.meta}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="tool-control-panel-block gun-selector-group">
            <div className="gun-selector-label tool-section-label">Target Type</div>
            <div className="gun-option-row tool-choice-row">
              {targetOptions.map((target) => (
                <button
                  key={target.id}
                  className={`gun-option-btn tool-choice-button tool-choice-button--strong${visibleTargetType === target.id ? ' is-active' : ''}`}
                  aria-pressed={visibleTargetType === target.id}
                  onClick={() => setTargetType(visibleTargetType === target.id ? null : target.id)}
                >
                  {target.label}
                </button>
              ))}
            </div>
          </div>

          <div className="tool-control-panel-block gun-selector-group">
            <div className="gun-selector-label tool-section-label">Range</div>
            <div className="gun-option-row tool-choice-row">
              {RANGES.map((rangeOption) => (
                <button
                  key={rangeOption.id}
                  className={`gun-option-btn tool-choice-button tool-choice-button--strong${range === rangeOption.id ? ' is-active' : ''}`}
                  aria-pressed={range === rangeOption.id}
                  onClick={() => setRange(range === rangeOption.id ? null : rangeOption.id)}
                >
                  <span>{rangeOption.label}</span>
                  <span className="gun-option-meta">{rangeOption.meta}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="tool-control-panel-block gun-selector-group">
            <div className="gun-selector-label tool-section-label">Target Speed</div>
            <div className="gun-option-row tool-choice-row">
              {SPEEDS.map((speedOption) => (
                <button
                  key={speedOption.id}
                  className={`gun-option-btn tool-choice-button tool-choice-button--strong${speed === speedOption.id ? ' is-active' : ''}`}
                  aria-pressed={speed === speedOption.id}
                  onClick={() => setSpeed(speed === speedOption.id ? null : speedOption.id)}
                >
                  {speedOption.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="tool-panel tool-control-panel gun-recommendation-panel">
        <div className="tool-control-panel-head">
          <div className="tool-control-copy">
            <p className="tool-section-label">Mode Decision</p>
            <h2 className="tool-panel-title">Read the answer</h2>
            <p className="tool-panel-copy">
              The recommended AM or PM card is the output. Keep the alternate visible for fast mode checks.
            </p>
          </div>
        </div>

        {recommendation && recommendedMode && alternateMode ? (
          <div className="gun-recommendation-stack">
            <article
              className={[
                'gun-mode-card',
                'tool-info-card',
                recommendedMode.id.toLowerCase(),
                'is-recommended',
                'gun-mode-card--primary',
              ].join(' ').trim()}
            >
              <div className="gun-mode-card-header">
                <div>
                  <div className={`gun-mode-card-label ${recommendedMode.id.toLowerCase()}`}>{recommendedMode.label}</div>
                  <div className="gun-mode-card-tagline">{recommendedMode.tagline}</div>
                </div>
                <span className="gun-mode-card-status tool-chip">Recommended</span>
              </div>

              <div className="gun-result-summary-list">
                {selectedInputs.map((entry) => (
                  <span key={entry} className="gun-summary-chip tool-chip">{entry}</span>
                ))}
              </div>

              <div className="gun-mode-card-best gun-mode-card-best--decision">
                <span className="tool-section-label">Why This Mode</span>
                <p>{recommendation.reasoning}</p>
              </div>

              <div className="gun-mode-card-columns gun-mode-card-columns--decision">
                <section className="gun-mode-card-block">
                  <div className="tool-section-label">Best Use</div>
                  <p className="gun-mode-card-note">{recommendedMode.bestFor}</p>
                </section>

                <section className="gun-mode-card-block">
                  <div className="tool-section-label">Watch Out</div>
                  <p className="gun-mode-card-note">{getSwitchNote(recommendedMode)}</p>
                </section>
              </div>

              <section className="gun-mode-card-block">
                <div className="tool-section-label">Strengths</div>
                <ul className="gun-mode-card-list strengths">
                  {recommendedMode.strengths.map((strength) => <li key={strength}>{strength}</li>)}
                </ul>
              </section>
            </article>

            <article
              className={[
                'gun-mode-card',
                'tool-info-card',
                alternateMode.id.toLowerCase(),
                'is-muted',
                'gun-mode-card--secondary',
              ].join(' ').trim()}
            >
              <div className="gun-mode-card-header">
                <div>
                  <div className={`gun-mode-card-label ${alternateMode.id.toLowerCase()}`}>{alternateMode.label}</div>
                  <div className="gun-mode-card-tagline">{alternateMode.tagline}</div>
                </div>
                <span className="gun-mode-card-status tool-chip">Alternate</span>
              </div>

              <div className="gun-mode-card-best">
                <span className="tool-section-label">Use Instead When</span>
                <p>{getSwitchNote(recommendedMode)}</p>
              </div>

              <div className="gun-mode-card-columns">
                <section className="gun-mode-card-block">
                  <div className="tool-section-label">Best Use</div>
                  <p className="gun-mode-card-note">{alternateMode.bestFor}</p>
                </section>

                <section className="gun-mode-card-block">
                  <div className="tool-section-label">Tradeoff</div>
                  <ul className="gun-mode-card-list strengths">
                    {alternateMode.strengths.slice(0, 2).map((strength) => <li key={strength}>{strength}</li>)}
                  </ul>
                </section>
              </div>
            </article>
          </div>
        ) : (
          <div className="gun-result-empty-state tool-empty-state">
            <h3 className="tool-empty-state-title">Build the firing picture</h3>
            <p className="tool-empty-state-copy">
              Select weapon, target type, range, and target speed to surface the recommended mode card here.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
