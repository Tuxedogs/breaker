import {
  formatMetric,
  getAxisPercent,
  getWeaponKey,
} from '../lib/calculations'
import type {
  SelectedWeaponComparison,
  Ship,
  ThresholdMode,
} from '../types'

type Props = {
  ship: Ship
  mode: ThresholdMode
  axisMax: number
  selectedWeapons: SelectedWeaponComparison[]
}

const markerClassName: Record<
  SelectedWeaponComparison['tone'],
  {
    glow: string
    line: string
    tip: string
  }
> = {
  cyan: {
    glow: 'shadow-[0_0_14px_rgba(103,232,249,0.28)]',
    line: 'bg-cyan-300',
    tip: 'bg-cyan-300',
  },
  violet: {
    glow: 'shadow-[0_0_14px_rgba(196,181,253,0.28)]',
    line: 'bg-violet-300',
    tip: 'bg-violet-300',
  },
  amber: {
    glow: 'shadow-[0_0_14px_rgba(252,211,77,0.28)]',
    line: 'bg-amber-300',
    tip: 'bg-amber-300',
  },
}

function getClampedMarkerPercent(value: number, axisMax: number) {
  return Math.min(99.5, Math.max(0.5, getAxisPercent(value, axisMax)))
}

export function ShipThresholdBar({
  ship,
  mode,
  axisMax,
  selectedWeapons,
}: Props) {
  const ballisticPercent = getAxisPercent(ship.ballisticThreshold, axisMax)
  const energyPercent = getAxisPercent(ship.energyThreshold, axisMax)
  const ticks = ['0%', '25%', '50%', '75%', '100%']

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-500">
        <span>Shared threshold axis</span>
        <span>Max {formatMetric(axisMax)}</span>
      </div>

      <div className="relative h-20 overflow-hidden rounded-xl border border-white/10 bg-slate-950/80">
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)',
            backgroundSize: '25% 100%',
          }}
        />

        <div className="absolute inset-x-3 top-4 flex justify-between text-[10px] uppercase tracking-[0.18em] text-slate-500">
          {ticks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>

        <div className="absolute inset-x-3 top-10 h-[0.45rem] rounded-full bg-white/6" />
        <div className="absolute inset-x-3 bottom-4 h-[0.35rem] rounded-full bg-white/6" />

        <div
          title={`Ballistic threshold ${formatMetric(ship.ballisticThreshold)}`}
          className={[
            'absolute left-3 top-10 h-[0.45rem] rounded-full transition',
            mode === 'ballistic' ? 'bg-cyan-300/85' : 'bg-cyan-300/25',
          ].join(' ')}
          style={{ width: `calc(${ballisticPercent}% - 0.75rem)` }}
        />

        <div
          title={`Energy threshold ${formatMetric(ship.energyThreshold)}`}
          className={[
            'absolute left-3 bottom-4 h-[0.35rem] rounded-full transition',
            mode === 'energy' ? 'bg-amber-300/85' : 'bg-amber-300/25',
          ].join(' ')}
          style={{ width: `calc(${energyPercent}% - 0.75rem)` }}
        />

        <div
          className="absolute top-[2.1rem] -translate-x-1/2 rounded-full border border-cyan-300/25 bg-slate-950/90 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100"
          style={{
            left: `calc(${getClampedMarkerPercent(ship.ballisticThreshold, axisMax)}% + 0.75rem)`,
          }}
        >
          B {formatMetric(ship.ballisticThreshold)}
        </div>

        <div
          className="absolute bottom-0 -translate-x-1/2 rounded-full border border-amber-300/25 bg-slate-950/90 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-amber-100"
          style={{
            left: `calc(${getClampedMarkerPercent(ship.energyThreshold, axisMax)}% + 0.75rem)`,
          }}
        >
          E {formatMetric(ship.energyThreshold)}
        </div>

        {selectedWeapons.map((selectedWeapon) => {
          const markerStyles = markerClassName[selectedWeapon.tone]
          const leftPercent = getClampedMarkerPercent(
            selectedWeapon.weapon.alpha,
            axisMax
          )

          return (
            <div
              key={`${selectedWeapon.slotId}-${getWeaponKey(selectedWeapon.weapon)}`}
              className="group/marker absolute inset-y-2"
              style={{ left: `calc(${leftPercent}% + 0.75rem)` }}
            >
              <span
                aria-hidden
                className={[
                  'absolute inset-y-0 left-1/2 w-px -translate-x-1/2',
                  markerStyles.line,
                  markerStyles.glow,
                ].join(' ')}
              />
              <span
                aria-hidden
                className={[
                  'absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-slate-950/80',
                  markerStyles.tip,
                ].join(' ')}
              />
              <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-950/95 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-100 group-hover/marker:block">
                {selectedWeapon.slotLabel}: {formatMetric(selectedWeapon.weapon.alpha)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
