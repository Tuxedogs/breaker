import type { OnboardingCoachLayout } from '../hooks/useOnboardingCoachLayout'

type DimProps = {
  step: number
  layout: OnboardingCoachLayout | null
  maskId: string
  onBackdropPointerDown: () => void
}

export function AlphaThresholdOnboardingCoachDim({
  step,
  layout,
  maskId,
  onBackdropPointerDown,
}: DimProps) {
  if (step >= 2) {
    return (
      <div
        className="alpha-threshold-onboarding-dim-full"
        role="presentation"
        aria-hidden
        onMouseDown={(e) => {
          e.preventDefault()
          onBackdropPointerDown()
        }}
      />
    )
  }

  if (!layout) {
    return (
      <div
        className="alpha-threshold-onboarding-dim-full"
        role="presentation"
        aria-hidden
        onMouseDown={(e) => {
          e.preventDefault()
          onBackdropPointerDown()
        }}
      />
    )
  }

  const { vw, vh, holes } = layout

  return (
    <div className="alpha-threshold-onboarding-coach alpha-threshold-onboarding-coach-dim" aria-hidden>
      <svg
        className="alpha-threshold-onboarding-coach-svg"
        width={vw}
        height={vh}
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="none"
      >
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={vw} height={vh}>
            <rect x="0" y="0" width={vw} height={vh} fill="white" />
            {holes.map((h, i) => (
              <rect
                key={i}
                x={h.x}
                y={h.y}
                width={h.w}
                height={h.h}
                rx={10}
                ry={10}
                fill="black"
              />
            ))}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width={vw}
          height={vh}
          fill="rgb(2 6 12)"
          fillOpacity={0.78}
          mask={`url(#${maskId})`}
          onMouseDown={(e) => {
            e.preventDefault()
            onBackdropPointerDown()
          }}
          style={{ cursor: 'default' }}
        />
      </svg>
    </div>
  )
}

type LinesProps = {
  step: number
  layout: OnboardingCoachLayout | null
}

/** Renders above the Quick tour card so connectors read from the box to each target. */
export function AlphaThresholdOnboardingCoachLines({ step, layout }: LinesProps) {
  if (step >= 2 || !layout || layout.paths.length === 0) return null

  const { vw, vh, paths } = layout

  return (
    <div className="alpha-threshold-onboarding-coach-lines-overlay" aria-hidden>
      <svg
        className="alpha-threshold-onboarding-coach-lines-svg"
        width={vw}
        height={vh}
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="none"
      >
        <g
          className="alpha-threshold-onboarding-coach-lines"
          fill="none"
          stroke="rgb(56 189 248)"
          strokeWidth={2}
          strokeLinecap="square"
          strokeLinejoin="miter"
          style={{ pointerEvents: 'none' }}
        >
          {paths.map((d, i) => (
            <path key={i} d={d} opacity={0.95} />
          ))}
        </g>
      </svg>
    </div>
  )
}
