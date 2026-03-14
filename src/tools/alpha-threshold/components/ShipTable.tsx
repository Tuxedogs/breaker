import { formatMetric } from '../lib/calculations'
import { ShipRow } from './ShipRow'
import type {
  AxisScaleMode,
  SelectedShipResult,
  ShipOverride,
} from '../types'

type Props = {
  shipResults: SelectedShipResult[]
  axisScaleMode: AxisScaleMode
  globalAxisMaxByType: {
    ballistic: number
    energy: number
  }
  onAxisScaleModeChange: (value: AxisScaleMode) => void
  shipOverrides: Record<string, ShipOverride>
}

export function ShipTable({
  shipResults,
  axisScaleMode,
  globalAxisMaxByType,
  onAxisScaleModeChange,
  shipOverrides,
}: Props) {
  return (
    <section
      aria-labelledby="alpha-threshold-ship-table"
      className="alpha-table-shell"
    >
      <header className="alpha-table-header">
        <div className="flex flex-col gap-6">
          <div className="alpha-table-intro">
            <p className="page-kicker">Selected Ship Results</p>
            <h2 id="alpha-threshold-ship-table" className="surface-title mt-3">
              Threshold Matrix
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Ballistic weapons compare only to ballistic thresholds. Energy weapons compare only to energy thresholds.
            </p>
            <div className="mt-5 space-y-1">
              <p className="alpha-control-label">Axis Scale Mode</p>
              <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
                {([
                  ['by-size', 'By Size'],
                  ['global', 'Global'],
                  ['per-row', 'Per Row'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onAxisScaleModeChange(value)}
                    className={[
                      'alpha-segment-button min-h-8 px-2.5 text-[11px]',
                      axisScaleMode === value ? 'alpha-segment-button-active' : '',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <ul className="alpha-table-summary" aria-label="Matrix summary">
            <li className="alpha-chip alpha-chip-muted">Ships {shipResults.length}</li>
            <li className="alpha-chip alpha-chip-muted">
              B {formatMetric(globalAxisMaxByType.ballistic)}
            </li>
            <li className="alpha-chip alpha-chip-muted">
              E {formatMetric(globalAxisMaxByType.energy)}
            </li>
          </ul>
        </div>
      </header>

      <div className="alpha-table-scroll">
        {shipResults.length > 0 ? (
          <ol className="alpha-table-list space-y-3">
            {shipResults.map((shipResult) => (
              <li key={shipResult.ship.name}>
                <ShipRow
                  shipResult={shipResult}
                  override={shipOverrides[shipResult.ship.name]}
                />
              </li>
            ))}
          </ol>
        ) : (
          <section className="alpha-empty-state" aria-live="polite">
            <h3 className="title-font text-xl text-slate-50">
              Select a Ship and Weapon
            </h3>
          </section>
        )}
      </div>
    </section>
  )
}
