import { formatMetric } from '../lib/calculations'
import { ShipRow } from './ShipRow'
import type {
  SelectedShipResult,
  ShipOverride,
} from '../types'

type Props = {
  shipResults: SelectedShipResult[]
  axisMaxByType: {
    ballistic: number
    energy: number
  }
  shipOverrides: Record<string, ShipOverride>
  onSaveOverride: (shipName: string, patch: ShipOverride) => void
  onResetOverride: (shipName: string) => void
}

export function ShipTable({
  shipResults,
  axisMaxByType,
  shipOverrides,
  onSaveOverride,
  onResetOverride,
}: Props) {
  return (
    <section aria-labelledby="alpha-threshold-ship-table" className="alpha-table-shell">
      <div className="alpha-table-header">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="page-kicker">Selected Ship Results</p>
            <h2 id="alpha-threshold-ship-table" className="surface-title mt-3">
              Threshold Matrix
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Ballistic weapons compare only to ballistic thresholds. Energy weapons compare only to energy thresholds.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="alpha-chip alpha-chip-muted">
              Ships {shipResults.length}
            </span>
            <span className="alpha-chip alpha-chip-muted">
              Ballistic axis {formatMetric(axisMaxByType.ballistic)}
            </span>
            <span className="alpha-chip alpha-chip-muted">
              Energy axis {formatMetric(axisMaxByType.energy)}
            </span>
          </div>
        </div>
      </div>

      <div className="alpha-table-scroll p-3 sm:p-4">
        {shipResults.length > 0 ? (
          <ol className="space-y-3">
            {shipResults.map((shipResult) => (
              <li key={shipResult.ship.name}>
                <ShipRow
                  shipResult={shipResult}
                  axisMaxByType={axisMaxByType}
                  override={shipOverrides[shipResult.ship.name]}
                  onSaveOverride={(patch) =>
                    onSaveOverride(shipResult.ship.name, patch)
                  }
                  onResetOverride={() => onResetOverride(shipResult.ship.name)}
                />
              </li>
            ))}
          </ol>
        ) : (
          <article className="alpha-empty-state">
            <h3 className="title-font text-xl text-slate-50">
              Select a Ship and Weapon
            </h3>
          </article>
        )}
      </div>
    </section>
  )
}
