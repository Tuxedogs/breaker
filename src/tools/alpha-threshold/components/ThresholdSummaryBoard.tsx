import { formatEntityLabel, formatMetric, getThresholdForWeaponType } from '../lib/calculations'
import { formatWeaponSizeLabel, formatWeaponTypeLabel } from '../lib/weapons/normalize'
import type { SelectedWeaponComparison, Ship } from '../types'

type Props = {
  ships: Ship[]
  selectedWeapons: SelectedWeaponComparison[]
}

export function ThresholdSummaryBoard({ ships, selectedWeapons }: Props) {
  if (ships.length === 0 || selectedWeapons.length === 0) {
    return (
      <section
        className="alpha-threshold-tab-panel alpha-threshold-board-empty"
        aria-live="polite"
      >
        <div className="alpha-empty-state">
          <h2 className="surface-title">Thresholds</h2>
          <p className="mt-3 text-sm text-slate-400">
            Select at least one ship and one weapon to inspect exact threshold margins.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="alpha-threshold-tab-panel" aria-label="Threshold summary">
      <div className="alpha-threshold-summary-grid">
        {ships.map((ship) => (
          <article
            key={`${ship.manufacturer}-${ship.name}`}
            className="alpha-threshold-summary-card"
          >
            <header className="alpha-threshold-summary-head">
              <div>
                <p className="page-kicker">Threshold Summary</p>
                <h3 className="surface-title mt-2">{formatEntityLabel(ship.name)}</h3>
                <p className="alpha-threshold-summary-copy">
                  {formatEntityLabel(ship.manufacturer)} / B{' '}
                  {formatMetric(ship.ballisticThreshold)} / E{' '}
                  {formatMetric(ship.energyThreshold)}
                </p>
              </div>
            </header>

            <div className="alpha-threshold-summary-list">
              {selectedWeapons.map((selectedWeapon) => {
                const thresholdType = selectedWeapon.weapon.damageType
                if (thresholdType !== 'ballistic' && thresholdType !== 'energy') {
                  return null
                }

                const threshold = getThresholdForWeaponType(ship, thresholdType)
                const alpha = selectedWeapon.weapon.alpha ?? 0
                const margin = alpha - threshold
                const passes = margin >= 0

                return (
                  <article
                    key={`${ship.name}-${selectedWeapon.slotId}`}
                    className={[
                      'alpha-threshold-summary-row',
                      passes
                        ? 'alpha-threshold-summary-row-pass'
                        : 'alpha-threshold-summary-row-blocked',
                    ].join(' ')}
                  >
                    <div className="alpha-threshold-summary-row-copy">
                      <h4 className="alpha-threshold-summary-weapon">
                        {selectedWeapon.weapon.name}
                      </h4>
                      <p className="alpha-threshold-summary-meta">
                        {formatWeaponSizeLabel(selectedWeapon.weapon.size)} /{' '}
                        {formatWeaponTypeLabel({
                          damageType: selectedWeapon.weapon.damageType,
                          weaponClass: selectedWeapon.weapon.weaponClass,
                        })}
                      </p>
                    </div>

                    <dl className="alpha-threshold-summary-stats">
                      <div>
                        <dt className="alpha-stat-label">Alpha</dt>
                        <dd className="alpha-stat-value">{formatMetric(alpha)}</dd>
                      </div>
                      <div>
                        <dt className="alpha-stat-label">Threshold</dt>
                        <dd className="alpha-stat-value">{formatMetric(threshold)}</dd>
                      </div>
                      <div>
                        <dt className="alpha-stat-label">Margin</dt>
                        <dd className="alpha-stat-value">
                          {margin >= 0 ? '+' : '-'}
                          {formatMetric(Math.abs(margin))}
                        </dd>
                      </div>
                      <div>
                        <dt className="alpha-stat-label">State</dt>
                        <dd className="alpha-stat-value">{passes ? 'Passes' : 'Blocked'}</dd>
                      </div>
                    </dl>
                  </article>
                )
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
