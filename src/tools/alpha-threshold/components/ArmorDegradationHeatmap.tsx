import { formatEntityLabel, formatMetric } from '../lib/calculations'
import type { SelectedShipResult, WeaponThresholdType } from '../types'

type Props = {
  shipResults: SelectedShipResult[]
}

type HeatmapCell = {
  intensity: number
}

const GRID_SIDE = 8

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function buildShipHeatmap(shipResult: SelectedShipResult): HeatmapCell[] {
  const results = shipResult.results
  if (results.length === 0) {
    return Array.from({ length: GRID_SIDE * GRID_SIDE }, () => ({ intensity: 0 }))
  }

  const thresholds: Record<WeaponThresholdType, number> = {
    ballistic: shipResult.ship.ballisticThreshold,
    energy: shipResult.ship.energyThreshold,
  }

  const floorByType: Record<WeaponThresholdType, number> = {
    ballistic: Math.max(1, thresholds.ballistic * 0.35),
    energy: Math.max(1, thresholds.energy * 0.35),
  }

  const cells: HeatmapCell[] = []
  const totalCells = GRID_SIDE * GRID_SIDE

  for (let index = 0; index < totalCells; index += 1) {
    const result = results[index % results.length]
    const thresholdType = result.thresholdType
    const alpha = result.weapon.alpha ?? 0
    const thresholdBefore = thresholds[thresholdType]
    const overmatch = Math.max(0, alpha - thresholdBefore)
    const ratio = clamp(overmatch / Math.max(thresholdBefore, 1), 0, 1.5)
    const nextThreshold = Math.max(
      floorByType[thresholdType],
      thresholdBefore * (1 - 0.18 * ratio)
    )

    thresholds[thresholdType] = nextThreshold
    cells.push({
      intensity: clamp(overmatch / Math.max(alpha, 1), 0, 1),
    })
  }

  return cells
}

function intensityStyle(intensity: number) {
  const warm = Math.round(255 * intensity)
  const cool = Math.round(160 - intensity * 110)
  const alpha = 0.2 + intensity * 0.65
  return {
    backgroundColor: `rgba(${warm}, ${cool}, 80, ${alpha.toFixed(3)})`,
  }
}

export function ArmorDegradationHeatmap({ shipResults }: Props) {
  return (
    <section className="alpha-heatmap-panel" aria-labelledby="armor-degradation-title">
      <header className="alpha-heatmap-head">
        <p className="page-kicker">Armor Degradation</p>
        <h2 id="armor-degradation-title" className="surface-title mt-3">
          Sustained Hit Heatmap
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Simulates threshold decay over repeated strikes for each selected victim.
        </p>
      </header>

      <div className="alpha-heatmap-grid-wrap">
        {shipResults.length > 0 ? (
          shipResults.slice(0, 3).map((shipResult) => {
            const cells = buildShipHeatmap(shipResult)
            return (
              <article key={shipResult.ship.name} className="alpha-heatmap-card">
                <header className="alpha-heatmap-card-head">
                  <p className="alpha-ship-option-meta">
                    {formatEntityLabel(shipResult.ship.manufacturer)}
                  </p>
                  <h3 className="alpha-compare-ship-name">
                    {formatEntityLabel(shipResult.ship.name)}
                  </h3>
                  <p className="text-xs text-slate-400">
                    B {formatMetric(shipResult.ship.ballisticThreshold)} / E{' '}
                    {formatMetric(shipResult.ship.energyThreshold)}
                  </p>
                </header>

                <div className="alpha-heatmap-grid" role="img" aria-label="Armor degradation heatmap">
                  {cells.map((cell, index) => (
                    <span
                      key={`${shipResult.ship.name}-${index}`}
                      className="alpha-heatmap-cell"
                      style={intensityStyle(cell.intensity)}
                    />
                  ))}
                </div>
              </article>
            )
          })
        ) : (
          <section className="alpha-empty-state" aria-live="polite">
            <h3 className="title-font text-base text-slate-50">
              Select victim ships and weapons to render heatmaps.
            </h3>
          </section>
        )}
      </div>
    </section>
  )
}
