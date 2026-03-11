import { formatMetric, getAxisMax } from '../lib/calculations'
import { ShipRow } from './ShipRow'
import type {
  SelectedWeaponComparison,
  Ship,
  ShipOverride,
  ThresholdMode,
} from '../types'

type Props = {
  ships: Ship[]
  mode: ThresholdMode
  selectedWeapons: SelectedWeaponComparison[]
  shipOverrides: Record<string, ShipOverride>
  onSaveOverride: (shipName: string, patch: ShipOverride) => void
  onResetOverride: (shipName: string) => void
}

export function ShipTable({
  ships,
  mode,
  selectedWeapons,
  shipOverrides,
  onSaveOverride,
  onResetOverride,
}: Props) {
  const axisMax = getAxisMax(
    ships,
    selectedWeapons.map((selectedWeapon) => selectedWeapon.weapon),
    mode
  )

  return (
    <section aria-labelledby="alpha-threshold-ship-table" className="alpha-table-shell">
      <div className="border-b border-white/10 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="page-kicker">Ship Survivability</p>
            <h2 id="alpha-threshold-ship-table" className="surface-title mt-3">
              Threshold Matrix
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300/80">
              Hull damage only applies when weapon alpha meets or exceeds the active threshold lane.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="module-card-chip">Ships {ships.length}</span>
            <span className="module-card-chip">
              Axis max {formatMetric(axisMax)}
            </span>
            <span className="module-card-chip">
              Mode {mode === 'ballistic' ? 'Ballistic' : 'Energy'}
            </span>
          </div>
        </div>
      </div>

      <div className="alpha-table-scroll p-3 sm:p-4">
        <ol className="space-y-3">
          {ships.map((ship) => (
            <li key={ship.name}>
              <ShipRow
                ship={ship}
                mode={mode}
                axisMax={axisMax}
                selectedWeapons={selectedWeapons}
                override={shipOverrides[ship.name]}
                onSaveOverride={(patch) => onSaveOverride(ship.name, patch)}
                onResetOverride={() => onResetOverride(ship.name)}
              />
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
