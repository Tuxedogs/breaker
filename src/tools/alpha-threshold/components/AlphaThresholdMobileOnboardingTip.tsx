import { useEffect, useId, useRef } from 'react'

type Props = {
  onComplete: () => void
}

export function AlphaThresholdMobileOnboardingTip({ onComplete }: Props) {
  const titleId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    requestAnimationFrame(() => {
      buttonRef.current?.focus()
    })
  }, [])

  return (
    <div className="alpha-tool-route alpha-mobile-onboarding-portal" role="presentation">
      <div className="alpha-mobile-onboarding-dim" onClick={onComplete} />
      <section className="alpha-mobile-onboarding-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <p className="alpha-mobile-onboarding-kicker">Quick tip</p>
        <h2 id={titleId} className="alpha-mobile-onboarding-title">
          The E rating
        </h2>
        <p className="alpha-mobile-onboarding-copy">
          <span>
            E is the <strong>effective armor damage start</strong> percent.
          </span>
          <span>
            <strong>E100</strong> means armor takes damage right away.
          </span>
          <span>
            Example: <strong>Deadbolt 1</strong> showing <strong>E100</strong> starts damaging armor immediately.
          </span>
          <span>
            Lower values mean you will not deal damage until the armor is below that percentage.
          </span>
        </p>
        <button ref={buttonRef} type="button" className="alpha-action-button alpha-mobile-onboarding-button" onClick={onComplete}>
          Got it
        </button>
      </section>
    </div>
  )
}
