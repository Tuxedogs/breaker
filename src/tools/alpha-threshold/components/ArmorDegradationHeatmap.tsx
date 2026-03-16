import { formatEntityLabel, formatMetric } from '../lib/calculations'
import type { SelectedShipResult, SelectedWeaponComparison } from '../types'

type Props = {
  shipResults: SelectedShipResult[]
  selectedWeapons: SelectedWeaponComparison[]
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getCellState(shipResult: SelectedShipResult, weapon: SelectedWeaponComparison) {
  const result = shipResult.results.find((entry) => entry.slotId === weapon.slotId)
  if (!result) return null

  const alpha = result.weapon.alpha ?? 0
  const delta = alpha - result.threshold
  const normalized = clamp(Math.abs(delta) / Math.max(result.threshold, 1), 0, 1.25)

  return {
    result,
    delta,
    intensity: normalized,
  }
}

function getCellClassName(delta: number, intensity: number) {
  if (delta >= 0) {
    if (intensity > 0.75) return 'alpha-heatmap-matrix-cell-pass-strong'
    if (intensity > 0.35) return 'alpha-heatmap-matrix-cell-pass'
    return 'alpha-heatmap-matrix-cell-pass-soft'
  }

  if (intensity > 0.75) return 'alpha-heatmap-matrix-cell-block-strong'
  if (intensity > 0.35) return 'alpha-heatmap-matrix-cell-block'
  return 'alpha-heatmap-matrix-cell-block-soft'
}

export function ArmorDegradationHeatmap({
  shipResults,
  selectedWeapons,
}: Props) {
  return (
    <section className="alpha-heatmap-panel" aria-labelledby="armor-degradation-title">
      <header className="alpha-heatmap-head">
        <p className="page-kicker">Ship vs Weapon Matrix</p>
        <h2 id="armor-degradation-title" className="surface-title mt-3">
          Threshold Heatmap
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Rows are selected ships. Columns are selected weapons. Each cell shows threshold margin.
        </p>
      </header>

      <div className="alpha-heatmap-grid-wrap">
        {shipResults.length > 0 && selectedWeapons.length > 0 ? (
          <div
            className="alpha-heatmap-matrix"
            role="table"
            aria-label="Ship versus weapon threshold matrix"
            style={{ ['--alpha-heatmap-columns' as string]: selectedWeapons.length }}
          >
            <div className="alpha-heatmap-matrix-corner" aria-hidden="true" />

            {selectedWeapons.map((selectedWeapon) => (
              <div
                key={selectedWeapon.slotId}
                role="columnheader"
                className="alpha-heatmap-matrix-weapon"
              >
                <span className="alpha-heatmap-matrix-weapon-slot">
                  {selectedWeapon.slotLabel}
                </span>
                <strong className="alpha-heatmap-matrix-weapon-name">
                  {selectedWeapon.weapon.name}
                </strong>
                <span className="alpha-heatmap-matrix-weapon-meta">
                  {selectedWeapon.weapon.damageType} · {formatMetric(selectedWeapon.weapon.alpha ?? 0)}
                </span>
              </div>
            ))}

            {shipResults.map((shipResult) => (
              <div
                key={shipResult.ship.name}
                className="contents"
              >
                <div
                  role="rowheader"
                  className="alpha-heatmap-matrix-ship"
                >
                  <span className="alpha-ship-option-meta">
                    {formatEntityLabel(shipResult.ship.manufacturer)}
                  </span>
                  <strong className="alpha-compare-ship-name">
                    {formatEntityLabel(shipResult.ship.name)}
                  </strong>
                  <span className="text-xs text-slate-400">
                    B {formatMetric(shipResult.ship.ballisticThreshold)} / E {formatMetric(shipResult.ship.energyThreshold)}
                  </span>
                </div>

                {selectedWeapons.map((selectedWeapon) => {
                  const state = getCellState(shipResult, selectedWeapon)

                  if (!state) {
                    return (
                      <div
                        key={`${shipResult.ship.name}-${selectedWeapon.slotId}`}
                        role="cell"
                        className="alpha-heatmap-matrix-cell alpha-heatmap-matrix-cell-empty"
                      >
                        --
                      </div>
                    )
                  }

                  return (
                    <div
                      key={`${shipResult.ship.name}-${selectedWeapon.slotId}`}
                      role="cell"
                      className={[
                        'alpha-heatmap-matrix-cell',
                        getCellClassName(state.delta, state.intensity),
                      ].join(' ')}
                      title={`${selectedWeapon.weapon.name}: ${state.delta >= 0 ? '+' : '-'}${formatMetric(Math.abs(state.delta))} vs ${formatMetric(state.result.threshold)}`}
                    >
                      <span className="alpha-heatmap-matrix-cell-value">
                        {state.delta >= 0 ? '+' : '-'}
                        {formatMetric(Math.abs(state.delta))}
                      </span>
                      <span className="alpha-heatmap-matrix-cell-meta">
                        {state.result.thresholdType === 'ballistic' ? 'B' : 'E'} {formatMetric(state.result.threshold)}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        ) : (
          <section className="alpha-empty-state" aria-live="polite">
            <h3 className="title-font text-base text-slate-50">
              Select ships and weapons to render the threshold matrix.
            </h3>
          </section>
        )}
      </div>
    </section>
  )
}
