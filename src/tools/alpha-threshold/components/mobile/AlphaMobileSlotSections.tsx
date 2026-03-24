import { formatEntityLabel, formatMetric } from '../../lib/calculations'
import { formatWeaponTypeLabel } from '../../lib/weapons/normalize'
import type { SelectedWeaponComparison, Ship } from '../../types'

type Props = {
  ships: Ship[]
  selectedWeapons: SelectedWeaponComparison[]
  nextShipSlotIndex: number
  nextWeaponSlotIndex: number
  onOpenShipsAt?: (slotIndex: number, autoAdvance?: boolean) => void
  onOpenWeaponsAt?: (slotIndex: number, autoAdvance?: boolean) => void
}

function isPlaceholderShip(ship: Ship) {
  return ship.name === '' && ship.manufacturer === ''
}

function isPlaceholderWeapon(selection: SelectedWeaponComparison) {
  return selection.weapon.name === '' && selection.weapon.weaponClass === ''
}

export function AlphaMobileSlotSections({
  ships,
  selectedWeapons,
  nextShipSlotIndex,
  nextWeaponSlotIndex,
  onOpenShipsAt,
  onOpenWeaponsAt,
}: Props) {
  return (
    <>
      <section className="alpha-mobile-slot-section" aria-label="Ship slots">
        <h2 className="alpha-mobile-section-title">Ships</h2>
        <div className="alpha-mobile-slot-grid alpha-mobile-slot-grid-ships">
          {ships.map((ship, index) => {
            const isEmpty = isPlaceholderShip(ship)
            return (
              <button
                key={`mobile-ship-slot-${index + 1}`}
                type="button"
                className={[
                  'alpha-mobile-slot-card',
                  isEmpty ? 'alpha-mobile-slot-card-empty' : '',
                  index === nextShipSlotIndex ? 'alpha-mobile-slot-card-active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onOpenShipsAt?.(index, false)}
              >
                <p className="alpha-mobile-slot-eyebrow">Ship {index + 1}</p>
                {isEmpty ? (
                  <p className="alpha-mobile-slot-value">Select ship</p>
                ) : (
                  <>
                    <p className="alpha-mobile-slot-value">{formatEntityLabel(ship.name)}</p>
                    <p className="alpha-mobile-slot-meta">
                      {formatEntityLabel(ship.manufacturer)} · {formatEntityLabel(ship.role ?? 'Utility')}
                    </p>
                  </>
                )}
              </button>
            )
          })}
        </div>
      </section>

      <section className="alpha-mobile-slot-section" aria-label="Weapon slots">
        <h2 className="alpha-mobile-section-title">Weapons</h2>
        <div className="alpha-mobile-slot-grid alpha-mobile-slot-grid-weapons">
          {selectedWeapons.map((selection, index) => {
            const isEmpty = isPlaceholderWeapon(selection)
            const weapon = selection.weapon
            return (
              <button
                key={selection.slotId}
                type="button"
                className={[
                  'alpha-mobile-slot-card',
                  isEmpty ? 'alpha-mobile-slot-card-empty' : '',
                  index === nextWeaponSlotIndex ? 'alpha-mobile-slot-card-active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onOpenWeaponsAt?.(index, false)}
              >
                <p className="alpha-mobile-slot-eyebrow">Weapon {index + 1}</p>
                {isEmpty ? (
                  <p className="alpha-mobile-slot-value">Select weapon</p>
                ) : (
                  <>
                    <p className="alpha-mobile-slot-value">{formatEntityLabel(weapon.name)}</p>
                    <p className="alpha-mobile-slot-meta">
                      {formatWeaponTypeLabel({ damageType: weapon.damageType, weaponClass: weapon.weaponClass })} · S
                      {weapon.size} · α {formatMetric(weapon.alpha ?? 0)}
                    </p>
                  </>
                )}
              </button>
            )
          })}
        </div>
      </section>
    </>
  )
}
