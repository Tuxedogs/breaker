import { formatMetric, getWeaponKey } from '../lib/calculations'
import type { Ship, ShipComparisonResult } from '../types'

type Props = {
  ship: Ship
  results: ShipComparisonResult[]
  axisMaxByType: {
    ballistic: number
    energy: number
  }
}

const markerClassName = {
  cyan: 'alpha-threshold-marker-cyan',
  violet: 'alpha-threshold-marker-violet',
  amber: 'alpha-threshold-marker-amber',
  emerald: 'alpha-threshold-marker-emerald',
} as const

const markerBadgeClassName = {
  cyan: 'alpha-threshold-slot-badge-cyan',
  violet: 'alpha-threshold-slot-badge-violet',
  amber: 'alpha-threshold-slot-badge-amber',
  emerald: 'alpha-threshold-slot-badge-emerald',
} as const

function getNormalizedPosition(value: number, axisMax: number) {
  if (axisMax <= 0) return 0
  return Math.min(value / axisMax, 1)
}

function getDeltaLabel(alpha: number, threshold: number) {
  const delta = alpha - threshold
  const rounded = formatMetric(Math.abs(delta))

  return delta >= 0 ? `+${rounded} over` : `-${rounded} below`
}

function ThresholdLane({
  label,
  accentClassName,
  thresholdValue,
  axisMax,
  markers,
}: {
  label: string
  accentClassName: string
  thresholdValue: number
  axisMax: number
  markers: ShipComparisonResult[]
}) {
  const ticks = Array.from({ length: 5 }, (_, index) =>
    formatMetric((axisMax / 4) * index)
  )
  const thresholdPosition = getNormalizedPosition(thresholdValue, axisMax)

  return (
    <div className="alpha-threshold-lane">
      <div className="alpha-threshold-lane-meta">
        <span>{label} lane</span>
        <span>Axis max {formatMetric(axisMax)}</span>
      </div>

      <div className="alpha-threshold-track">
        <div
          aria-hidden
          className="alpha-threshold-grid"
          style={{
            backgroundImage:
              'linear-gradient(90deg, rgba(148,163,184,0.18) 1px, transparent 1px)',
            backgroundSize: '25% 100%',
          }}
        />

        <div className="alpha-threshold-axis">
          {ticks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>

        <div className="alpha-threshold-lane-bar">
          <div
            className={`alpha-threshold-threshold-fill ${accentClassName}`}
            style={{
              width: `${Math.max(1.5, thresholdPosition * 100)}%`,
            }}
            title={`Threshold ${formatMetric(thresholdValue)}`}
          />
        </div>

        {markers.map((result) => {
          const alphaValue = result.weapon.alpha ?? 0
          const markerPosition = getNormalizedPosition(alphaValue, axisMax)
          const markerPercent = markerPosition * 100
          const thresholdPercent = thresholdPosition * 100
          const compareLeft = result.passes
            ? thresholdPercent
            : markerPercent
          const compareWidth = result.passes
            ? Math.max(0, markerPercent - thresholdPercent)
            : Math.max(0, thresholdPercent - markerPercent)

          return (
            <div
              key={`${result.slotId}-${getWeaponKey(result.weapon)}`}
              className="group/marker alpha-threshold-marker-layer"
            >
              <span
                aria-hidden
                className={[
                  'alpha-threshold-compare-band',
                  result.passes
                    ? 'alpha-threshold-compare-band-pass'
                    : 'alpha-threshold-compare-band-block',
                  result.passes || result.overflow
                    ? 'alpha-threshold-compare-band-overflow'
                    : '',
                ].join(' ')}
                style={{
                  left: `${compareLeft}%`,
                  width: `${Math.max(0, compareWidth)}%`,
                }}
              />

              <div
                className="alpha-threshold-marker"
                style={{ left: `${markerPercent}%` }}
              >
                <span
                  aria-hidden
                  className={[
                    'alpha-threshold-marker-line',
                    markerClassName[result.tone],
                    result.passes
                      ? 'alpha-threshold-marker-line-pass'
                      : 'alpha-threshold-marker-line-block',
                  ].join(' ')}
                />
                <span
                  aria-hidden
                  className={[
                    'alpha-threshold-marker-dot',
                    markerClassName[result.tone],
                  ].join(' ')}
                />
                <span
                  aria-hidden
                  className={[
                    'alpha-threshold-slot-badge',
                    markerBadgeClassName[result.tone],
                    result.passes ? 'alpha-threshold-slot-badge-capped' : '',
                  ].join(' ')}
                >
                  {result.slotLabel}
                </span>
                {result.overflow ? (
                  <span
                    aria-hidden
                    className={[
                      'alpha-threshold-marker-overflow',
                      result.passes
                        ? 'alpha-threshold-marker-overflow-pass'
                        : 'alpha-threshold-marker-overflow-block',
                    ].join(' ')}
                  />
                ) : null}
                <span className="alpha-threshold-marker-label group-hover/marker:block">
                  {result.slotLabel}: {formatMetric(alphaValue)}
                  {result.overflow ? '+' : ''}
                  {' • '}
                  {getDeltaLabel(alphaValue, thresholdValue)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ShipThresholdBar({
  ship,
  results,
  axisMaxByType,
}: Props) {
  const ballisticResults = results.filter(
    (result) => result.thresholdType === 'ballistic'
  )
  const energyResults = results.filter(
    (result) => result.thresholdType === 'energy'
  )

  return (
    <div className="space-y-3">
      <ThresholdLane
        label="Ballistic"
        accentClassName="bg-cyan-300/80"
        thresholdValue={ship.ballisticThreshold}
        axisMax={axisMaxByType.ballistic}
        markers={ballisticResults}
      />
      <ThresholdLane
        label="Energy"
        accentClassName="bg-amber-300/80"
        thresholdValue={ship.energyThreshold}
        axisMax={axisMaxByType.energy}
        markers={energyResults}
      />
    </div>
  )
}
