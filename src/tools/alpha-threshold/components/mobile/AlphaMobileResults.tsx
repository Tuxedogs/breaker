import { estimateArmorInteraction, formatEntityLabel } from '../../lib/calculations'
import type { DefenseShieldState, SelectedWeaponComparison, Ship } from '../../types'

type Props = {
  ships: Ship[]
  selectedWeapons: SelectedWeaponComparison[]
  shieldMode: DefenseShieldState
}

function isPlaceholderShip(ship: Ship) {
  return ship.name === '' && ship.manufacturer === ''
}

function isPlaceholderWeapon(selection: SelectedWeaponComparison) {
  return selection.weapon.name === '' && selection.weapon.weaponClass === ''
}

export function AlphaMobileResults({ ships, selectedWeapons, shieldMode }: Props) {
  return (
    <section className="alpha-mobile-results" aria-label="Mobile comparison results">
      <h2 className="alpha-mobile-section-title">Results</h2>
      <div className="alpha-mobile-result-list">
        {ships.map((ship, shipIndex) => {
          if (isPlaceholderShip(ship)) return null
          return (
            <article key={`mobile-result-${ship.id}-${shipIndex}`} className="alpha-mobile-result-card">
              <header className="alpha-mobile-result-head">
                <h3>{formatEntityLabel(ship.name)}</h3>
                <p>
                  {formatEntityLabel(ship.manufacturer)} · {formatEntityLabel(ship.role ?? 'Utility')}
                </p>
              </header>
              <div className="alpha-mobile-result-body">
                {selectedWeapons.map((selection) => {
                  if (isPlaceholderWeapon(selection)) return null
                  const estimate = estimateArmorInteraction(selection.weapon, ship, shieldMode)
                  const effectivePct = Math.round(
                    estimate.damagesFreshArmor || estimate.armorDamageStartsAtPercent === 100
                      ? 100
                      : estimate.armorDamageStartsAtPercent ?? 0
                  )
                  return (
                    <div key={`${ship.id}-${selection.slotId}`} className="alpha-mobile-result-row">
                      <p className="alpha-mobile-result-weapon">{formatEntityLabel(selection.weapon.name)}</p>
                      <p className="alpha-mobile-result-stats">
                        E{effectivePct} · α/T {estimate.thresholdRatio.toFixed(2)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
