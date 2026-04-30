import { createPortal } from 'react-dom'
import { useEffect, useId, useRef, useState } from 'react'
import {
  AlphaThresholdOnboardingCoachDim,
  AlphaThresholdOnboardingCoachLines,
} from './AlphaThresholdOnboardingCoachmarks'
import { useOnboardingCoachLayout } from '../hooks/useOnboardingCoachLayout'

export type AlphaThresholdOnboardingHighlight = 'ship-weapon' | 'shield' | null

type Props = {
  onHighlightChange: (highlight: AlphaThresholdOnboardingHighlight) => void
  onComplete: () => void
}

export function AlphaThresholdOnboardingModal({ onHighlightChange, onComplete }: Props) {
  const titleId = useId()
  const modalRef = useRef<HTMLElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const [step, setStep] = useState(0)
  const { layout: coachLayout, maskId: coachMaskId } = useOnboardingCoachLayout(step, modalRef)

  useEffect(() => {
    if (step === 0) onHighlightChange('ship-weapon')
    else if (step === 1) onHighlightChange('shield')
    else onHighlightChange(null)
  }, [step, onHighlightChange])

  useEffect(() => {
    return () => onHighlightChange(null)
  }, [onHighlightChange])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onComplete()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onComplete])

  useEffect(() => {
    requestAnimationFrame(() => {
      nextRef.current?.focus()
    })
  }, [step])

  function handlePrimary() {
    if (step < 2) {
      setStep((s) => s + 1)
      return
    }
    onComplete()
  }

  const title =
    step === 0
      ? 'Choose Ships and Weapons'
      : step === 1
        ? 'Shields On / Off'
        : 'The E rating'

  return createPortal(
    <div className="alpha-threshold-tool alpha-threshold-onboarding-portal">
      <AlphaThresholdOnboardingCoachDim
        step={step}
        layout={coachLayout}
        maskId={coachMaskId}
        onBackdropPointerDown={onComplete}
      />
      <div className="alpha-threshold-onboarding-modal-layer">
        <section
          ref={modalRef}
          className="alpha-modal-shell alpha-threshold-onboarding-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="alpha-threshold-onboarding-modal-body">
            <p className="alpha-threshold-onboarding-kicker">Quick tour</p>
            <h2 id={titleId} className="alpha-threshold-onboarding-title">
              {title}
            </h2>
            {step === 0 ? (
              <div className="alpha-threshold-onboarding-copy">
                <p>
                  Select up to <strong>6 ships</strong> and compare them against up to <strong>5 weapon choices</strong>.
                </p>
              </div>
            ) : step === 1 ? (
              <div className="alpha-threshold-onboarding-copy">
                <p>
                  In the top-left corner, <strong>Shields ON</strong> applies shield pass-through before armor
                  is evaluated. <strong>Shields OFF</strong> models armor as if shields are down.
                </p>
                <p>
                  Presets for weapons and ship groups can be selected here.
                </p>
              </div>
            ) : (
              <div className="alpha-threshold-onboarding-copy">
                <p>
                  <strong>E</strong> is <strong>when your weapons become effective</strong> as a percent of the
                  threshold bar. <strong>E100</strong> means armor is taking meaningful damage from the first
                  shot. E50, means at 50% armor you wil start doing damage.
                </p>
                <div className="alpha-threshold-onboarding-e-tooltip-block">
                  <p className="alpha-threshold-onboarding-e-tooltip" role="note">
                    <strong>Lower values</strong> mean the weapon will not apply <strong>any</strong> damage until the{' '}
                    <strong>armor integrity</strong> is below <strong>that percentage</strong>.
                  </p>
                </div>
                <div className="alpha-threshold-onboarding-e-demo" aria-hidden>
                  <p className="alpha-threshold-onboarding-e-demo-caption">Example (RSI Perseus)</p>
                  <div className="alpha-threshold-onboarding-e-demo-matrix">
                    <div className="alpha-threshold-onboarding-e-demo-row">
                      <span className="alpha-threshold-onboarding-e-demo-weapon">Deadbolt 1</span>
                      <span className="alpha-threshold-onboarding-e-demo-e alpha-threshold-onboarding-e-demo-e--high">
                        E100
                      </span>
                    </div>
                    <div className="alpha-threshold-onboarding-e-demo-row">
                      <span className="alpha-threshold-onboarding-e-demo-weapon">Broadsword 3</span>
                      <span className="alpha-threshold-onboarding-e-demo-e alpha-threshold-onboarding-e-demo-e--mid">
                        E41
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <p className="alpha-threshold-onboarding-progress" aria-live="polite">
              Step {step + 1} of 3
            </p>
            <div className="alpha-threshold-onboarding-actions">
              <button type="button" className="alpha-action-button" onClick={() => onComplete()}>
                Skip
              </button>
              {step > 0 ? (
                <button type="button" className="alpha-action-button" onClick={() => setStep((s) => s - 1)}>
                  Back
                </button>
              ) : null}
              <button
                ref={nextRef}
                type="button"
                className="alpha-action-button alpha-action-button-primary"
                onClick={() => handlePrimary()}
              >
                {step < 2 ? 'Next' : 'Got it'}
              </button>
            </div>
          </div>
        </section>
      </div>
      <AlphaThresholdOnboardingCoachLines step={step} layout={coachLayout} />
    </div>,
    document.body
  )
}
