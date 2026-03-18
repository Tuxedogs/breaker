import { useMemo } from 'react'
import { buildShipHeatmapModel } from '../lib/calculations'
import { HeatmapLegend } from './HeatmapLegend'
import { HeatmapShipColumn } from './HeatmapShipColumn'
import type { SelectedWeaponComparison, Ship } from '../types'

type Props = {
  ships: Ship[]
  selectedWeapons: SelectedWeaponComparison[]
  showLegend?: boolean
}

export function ThresholdHeatmapBoard({
  ships,
  selectedWeapons,
  showLegend = true,
}: Props) {
  const shipModels = useMemo(
    () => ships.map((ship) => buildShipHeatmapModel(ship, selectedWeapons)),
    [selectedWeapons, ships]
  )

  if (shipModels.length === 0 || selectedWeapons.length === 0) {
    return (
      <section className="alpha-threshold-board alpha-threshold-board-empty" aria-live="polite">
        <div className="alpha-empty-state">
          <h2 className="surface-title">Threshold Heatmap</h2>
          <p className="mt-3 text-sm text-slate-400">
            Select at least one ship and one weapon to build the analysis board.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="alpha-threshold-board" aria-label="Threshold heatmap board">
      <header className="alpha-threshold-board-head">
        <div className="alpha-threshold-board-title-block">
          <div>
            <p className="page-kicker">Armor Degradation Curve</p>
            <h2 className="surface-title mt-3">Threshold Heatmap</h2>
          </div>
          <p className="alpha-threshold-board-copy">
            Compare crossover timing directly on the board. Intact armor stays left, broken armor collapses to the right.
          </p>
        </div>
      </header>

      {showLegend ? <HeatmapLegend /> : null}

      <div className="alpha-threshold-board-scroll">
        <div
          className="alpha-threshold-board-columns"
          style={{ ['--alpha-threshold-columns' as string]: shipModels.length }}
        >
          {shipModels.map((model) => (
            <HeatmapShipColumn
              key={`${model.ship.manufacturer}-${model.ship.name}`}
              model={model}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
