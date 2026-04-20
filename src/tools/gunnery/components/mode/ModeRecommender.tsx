import { GIMBAL_MODES } from '../../data/modes'
import type { GimbalModeDefinition } from '../../types'

const modeIntro: Record<GimbalModeDefinition['id'], string> = {
  PM: 'Use Precision Manual in almost all scenarios. Paired with sub-targeting, it is the best mode for component work and is often superior for general engagements as well.',
  AM: 'Use Auto Manual when engaging capitals components, it is almost always more beneficial to use PM.',
  
}

function ModeList({
  items,
  tone = 'strengths',
}: {
  items: string[]
  tone?: 'strengths' | 'weaknesses'
}) {
  return (
    <ul className={`gun-mode-card-list ${tone}`}>
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  )
}

function ModeCard({ mode }: { mode: GimbalModeDefinition }) {
  const modeClass = mode.id.toLowerCase()

  return (
    <article className={['gun-mode-card', 'tool-info-card', modeClass, 'is-recommended'].join(' ')}>
      <div className="gun-mode-card-header">
        <div>
          <div className={`gun-mode-card-label ${modeClass}`}>{mode.label}</div>
          <h3 className="gun-mode-card-title">{mode.id}</h3>
          <p className="gun-mode-card-tagline">{mode.tagline}</p>
        </div>
      </div>

      <div className="gun-mode-card-best">
        <span className="tool-section-label">Behavior</span>
        <p>{modeIntro[mode.id]}</p>
        <ModeList items={mode.behaviorProfile} />
      </div>

      <div className="gun-mode-card-columns gun-mode-card-columns--wide">
        <section className="gun-mode-card-block">
          <div className="tool-section-label">Best Use</div>
          <ModeList items={mode.bestUse} />
        </section>

        <section className="gun-mode-card-block">
          <div className="tool-section-label">Strengths</div>
          <ModeList items={mode.strengths} />
        </section>
      </div>

      <div className="gun-mode-card-columns gun-mode-card-columns--wide">
        <section className="gun-mode-card-block">
          <div className="tool-section-label">Tradeoffs</div>
          <ModeList items={mode.tradeoffs} tone="weaknesses" />
        </section>

        <section className="gun-mode-card-block">
          <div className="tool-section-label">Switch Away When</div>
          <ModeList items={mode.switchWhen} />
        </section>
      </div>

      <section className="gun-mode-card-block">
        <div className="tool-section-label">Example Targets</div>
        <div className="gun-mode-target-list">
          {mode.exampleTargets.map((target) => (
            <span key={target} className="tool-chip gun-mode-target-chip">{target}</span>
          ))}
        </div>
      </section>
    </article>
  )
}

export function ModeRecommender() {
  return (
    <div className="gun-recommender gun-recommender-layout gun-recommender-layout--reference">
      <section className="gun-recommendation-stack gun-recommendation-stack--reference" aria-label="AM and PM targeting doctrine">
        {GIMBAL_MODES.map((mode) => <ModeCard key={mode.id} mode={mode} />)}
      </section>
    </div>
  )
}
