import {
  formatMetric,
  getAxisPercent,
  getWeaponKey,
} from '../lib/calculations'
import type {
  Ship,
  ShipComparisonResult,
} from '../types'

type Props = {
  ship: Ship
  results: ShipComparisonResult[]
  axisMaxByType: {
    ballistic: number
    energy: number
  }
}

const markerClassName = {
  cyan: 'bg-cyan-300',
  violet: 'bg-violet-300',
  amber: 'bg-amber-300',
  emerald: 'bg-emerald-300',
} as const

function getClampedMarkerPercent(value: number, axisMax: number) {
  return Math.min(99.2, Math.max(0.8, getAxisPercent(value, axisMax)))
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

  return (
    <div className="alpha-threshold-lane">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-400">
        <span>{label} lane</span>
        <span>Axis max {formatMetric(axisMax)}</span>
      </div>

      <div className="relative h-14 overflow-hidden rounded-xl border border-white/10 bg-slate-950/95">
        <div
          aria-hidden
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              'linear-gradient(90deg, rgba(148,163,184,0.18) 1px, transparent 1px)',
            backgroundSize: '25% 100%',
          }}
        />

        <div className="absolute inset-x-3 top-2 flex justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500">
          {ticks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>

        <div className="absolute inset-x-3 bottom-3 h-3 rounded-lg border border-white/10 bg-slate-900/90">
          <div
            className={`h-full rounded-lg ${accentClassName}`}
            style={{ width: `${Math.max(1.5, getAxisPercent(thresholdValue, axisMax))}%` }}
            title={`Threshold ${formatMetric(thresholdValue)}`}
          />
        </div>

        <div
          className="absolute bottom-8 -translate-x-1/2 rounded-full border border-white/10 bg-slate-950/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-100"
          style={{
            left: `calc(${getClampedMarkerPercent(thresholdValue, axisMax)}% + 0.75rem)`,
          }}
        >
          T {formatMetric(thresholdValue)}
        </div>

        {markers.map((result) => {
          const leftPercent = getClampedMarkerPercent(
            result.weapon.alpha ?? 0,
            axisMax
          )

          return (
            <div
              key={`${result.slotId}-${getWeaponKey(result.weapon)}`}
              className="group/marker absolute inset-y-2"
              style={{ left: `calc(${leftPercent}% + 0.75rem)` }}
            >
              <span
                aria-hidden
                className={[
                  'absolute bottom-0 left-1/2 top-4 w-[2px] -translate-x-1/2',
                  markerClassName[result.tone],
                ].join(' ')}
              />
              <span
                aria-hidden
                className={[
                  'absolute left-1/2 top-3 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-slate-950/90',
                  markerClassName[result.tone],
                ].join(' ')}
              />
              <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-950/95 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-100 group-hover/marker:block">
                {result.slotLabel}: {formatMetric(result.weapon.alpha ?? 0)}
                {result.overflow ? '+' : ''}
              </span>
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
