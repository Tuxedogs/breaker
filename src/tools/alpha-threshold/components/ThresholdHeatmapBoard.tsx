import { useMemo, useState } from 'react'
import { buildShipHeatmapModel } from '../lib/calculations'
import { HeatmapLegend } from './HeatmapLegend'
import { HeatmapShipColumn } from './HeatmapShipColumn'
import { RecommendationsBoard } from './RecommendationsBoard'
import type { SelectedWeaponComparison, Ship, WeaponRecord } from '../types'

type BoardTab = 'heatmap' | 'recommendations'

type Props = {
  ships: Ship[]
  selectedWeapons: SelectedWeaponComparison[]
  allShips: Ship[]
  allWeapons: WeaponRecord[]
}

export function ThresholdHeatmapBoard({
  ships,
  selectedWeapons,
  allShips,
  allWeapons,
}: Props) {
  const [activeTab, setActiveTab] = useState<BoardTab>('heatmap')
  const shipModels = useMemo(
    () => ships.map((ship) => buildShipHeatmapModel(ship, selectedWeapons)),
    [selectedWeapons, ships]
  )

  return (
    <section className="alpha-threshold-board" aria-label="Armor Thresholds board">
      <header className="alpha-threshold-board-head">
        <div className="alpha-threshold-board-title-block">
          <div>
            <p className="page-kicker">Armor Degradation Curve</p>
            <h2 className="surface-title mt-3">Armor Thresholds</h2>
          </div>
          <p className="alpha-threshold-board-copy">
            Compare crossover timing directly on the board. Intact armor stays left, broken armor collapses to the right.
          </p>
        </div>
        <div className="alpha-threshold-board-tabs" role="tablist" aria-label="Threshold analysis views">
          {(['heatmap', 'recommendations'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className="alpha-threshold-board-tab"
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'heatmap' ? 'Analysis' : 'Weapons Loadout'}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'heatmap' ? (
        <>
          {shipModels.length === 0 || selectedWeapons.length === 0 ? (
            <section className="alpha-threshold-board-empty" aria-live="polite">
              <div className="alpha-empty-state">
                <h2 className="surface-title">Armor Thresholds</h2>
                <p className="mt-3 text-sm text-slate-400">
                  Select at least one ship and one weapon to build the analysis board.
                </p>
              </div>
            </section>
          ) : (
            <>
              <HeatmapLegend />

              <div className="alpha-threshold-board-scroll">
                <div
                  className="alpha-threshold-board-columns"
                  style={{
                    ['--alpha-threshold-columns' as string]: shipModels.length,
                    ['--alpha-threshold-visible-columns' as string]: Math.max(
                      shipModels.length,
                      2
                    ),
                  }}
                >
                  {shipModels.map((model) => (
                    <HeatmapShipColumn
                      key={`${model.ship.manufacturer}-${model.ship.name}`}
                      model={model}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      ) : null}

      {activeTab === 'recommendations' ? (
        <RecommendationsBoard
          ships={allShips}
          weapons={allWeapons}
          selectedShips={ships}
        />
      ) : null}
    </section>
  )
}
