import { useState } from 'react'
import {
  formatEntityLabel,
  formatMetric,
  getActiveThreshold,
  getComparisonResult,
  getWeaponKey,
} from '../lib/calculations'
import { ShipOverrideEditor } from './ShipOverrideEditor'
import { ShipThresholdBar } from './ShipThresholdBar'
import type {
  SelectedWeaponComparison,
  Ship,
  ShipOverride,
  ThresholdMode,
} from '../types'

type Props = {
  ship: Ship
  mode: ThresholdMode
  axisMax: number
  selectedWeapons: SelectedWeaponComparison[]
  override?: ShipOverride
  onSaveOverride: (patch: ShipOverride) => void
  onResetOverride: () => void
}

const toneIndicatorClassName: Record<
  SelectedWeaponComparison['tone'],
  string
> = {
  cyan: 'border-cyan-300/25 text-cyan-100',
  violet: 'border-violet-300/25 text-violet-100',
  amber: 'border-amber-300/25 text-amber-100',
}

export function ShipRow({
  ship,
  mode,
  axisMax,
  selectedWeapons,
  override,
  onSaveOverride,
  onResetOverride,
}: Props) {
  const [editing, setEditing] = useState(false)
  const activeThreshold = getActiveThreshold(ship, mode)
  const results = selectedWeapons.map((selectedWeapon) => ({
    ...selectedWeapon,
    ...getComparisonResult(ship, selectedWeapon.weapon, mode),
  }))
  const passingCount = results.filter((result) => result.passes).length
  const hasSelections = results.length > 0
  const isFullyBlocked = hasSelections && passingCount === 0
  const rowTitle = `Hull ${formatMetric(ship.health)} | Ballistic ${formatMetric(ship.ballisticThreshold)} | Energy ${formatMetric(ship.energyThreshold)}`

  return (
    <article
      title={rowTitle}
      className={[
        'alpha-ship-row group relative',
        hasSelections && passingCount > 0 ? 'alpha-ship-row-pass' : '',
        isFullyBlocked ? 'alpha-ship-row-blocked' : '',
      ].join(' ')}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,112px))_minmax(0,0.9fr)] xl:items-start">
          <header className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              {ship.manufacturer}
            </p>
            <h3 className="surface-title mt-2 truncate text-lg text-white">
              {formatEntityLabel(ship.name)}
            </h3>
            {override ? (
              <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-amber-200">
                Override active
              </p>
            ) : null}
          </header>

          <dl>
            <dt className="alpha-stat-label">Hull</dt>
            <dd className="alpha-stat-value">{formatMetric(ship.health)}</dd>
          </dl>

          <dl>
            <dt className="alpha-stat-label">Ballistic</dt>
            <dd
              className={[
                'alpha-stat-value',
                mode === 'ballistic' ? 'text-cyan-100' : '',
              ].join(' ')}
            >
              {formatMetric(ship.ballisticThreshold)}
            </dd>
          </dl>

          <dl>
            <dt className="alpha-stat-label">Energy</dt>
            <dd
              className={[
                'alpha-stat-value',
                mode === 'energy' ? 'text-amber-100' : '',
              ].join(' ')}
            >
              {formatMetric(ship.energyThreshold)}
            </dd>
          </dl>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            {results.length > 0 ? (
              results.map((result) => (
                <span
                  key={`${result.slotId}-${getWeaponKey(result.weapon)}`}
                  className={[
                    'inline-flex min-h-8 items-center rounded-full border px-3 text-[11px] uppercase tracking-[0.16em]',
                    toneIndicatorClassName[result.tone],
                    result.passes
                      ? 'bg-emerald-500/10'
                      : 'border-rose-300/25 bg-rose-500/10 text-rose-100',
                  ].join(' ')}
                >
                  {result.slotLabel} {result.passes ? 'Pass' : 'Block'}
                </span>
              ))
            ) : (
              <span className="alpha-chip alpha-chip-muted">No weapon selected</span>
            )}

            <button
              type="button"
              onClick={() => setEditing((prev) => !prev)}
              className="alpha-action-button"
            >
              {editing ? 'Close' : 'Override'}
            </button>
          </div>
        </div>

        <ShipThresholdBar
          ship={ship}
          mode={mode}
          axisMax={axisMax}
          selectedWeapons={selectedWeapons}
        />

        <div className="hidden justify-end lg:flex">
          <div className="pointer-events-none rounded-xl border border-white/10 bg-slate-950/92 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-slate-300 opacity-0 transition duration-150 group-hover:opacity-100">
            Active threshold {formatMetric(activeThreshold)} · Hull {formatMetric(ship.health)}
          </div>
        </div>
      </div>

      {editing ? (
        <ShipOverrideEditor
          ship={ship}
          override={override}
          onSave={(patch) => {
            onSaveOverride(patch)
            setEditing(false)
          }}
          onReset={() => {
            onResetOverride()
            setEditing(false)
          }}
        />
      ) : null}
    </article>
  )
}
