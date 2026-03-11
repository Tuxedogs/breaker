import { formatEntityLabel, formatMetric } from '../lib/calculations'
import { ShipThresholdBar } from './ShipThresholdBar'
import type {
  SelectedShipResult,
  ShipOverride,
} from '../types'

type Props = {
  shipResult: SelectedShipResult
  override?: ShipOverride
}

const toneIndicatorClassName = {
  cyan: 'alpha-chip-tone-cyan',
  violet: 'alpha-chip-tone-violet',
  amber: 'alpha-chip-tone-amber',
  emerald: 'alpha-chip-tone-emerald',
} as const

export function ShipRow({
  shipResult,
  override,
}: Props) {
  const { ship, results, passingCount, hasSelections, axisMaxByType } = shipResult

  return (
    <article
      title={`Hull ${formatMetric(ship.health)} | Ballistic ${formatMetric(ship.ballisticThreshold)} | Energy ${formatMetric(ship.energyThreshold)}`}
      className={[
        'alpha-ship-row group relative',
        passingCount > 0 ? 'alpha-ship-row-pass' : '',
        hasSelections && passingCount === 0 ? 'alpha-ship-row-blocked' : '',
      ].join(' ')}
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,116px))_minmax(0,1fr)] xl:items-start">
          <header className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">
              {ship.manufacturer}
            </p>
            <h3 className="title-font mt-2 truncate text-xl leading-tight text-slate-50 sm:text-[1.35rem]">
              {formatEntityLabel(ship.name)}
            </h3>
            {override ? (
              <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-amber-200">
                Override active
              </p>
            ) : null}
          </header>

          <dl className="alpha-metric-card">
            <dt className="alpha-stat-label">Hull</dt>
            <dd className="alpha-stat-value">{formatMetric(ship.health)}</dd>
          </dl>

          <dl className="alpha-metric-card">
            <dt className="alpha-stat-label">Ballistic</dt>
            <dd className="alpha-stat-value text-cyan-100">
              {formatMetric(ship.ballisticThreshold)}
            </dd>
          </dl>

          <dl className="alpha-metric-card">
            <dt className="alpha-stat-label">Energy</dt>
            <dd className="alpha-stat-value text-amber-100">
              {formatMetric(ship.energyThreshold)}
            </dd>
          </dl>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            {results.length > 0 ? (
              results.map((result) => (
                <span
                  key={result.slotId}
                  className={[
                    'alpha-chip',
                    toneIndicatorClassName[result.tone],
                    result.passes ? 'alpha-chip-pass' : 'alpha-chip-block',
                  ].join(' ')}
                >
                  {result.slotLabel} {result.passes ? 'Pass' : 'Block'}
                </span>
              ))
            ) : (
              <span className="alpha-chip alpha-chip-muted">No weapon selected</span>
            )}

          </div>
        </div>

        <ShipThresholdBar
          ship={ship}
          results={results}
          axisMaxByType={axisMaxByType}
        />
      </div>

    </article>
  )
}
