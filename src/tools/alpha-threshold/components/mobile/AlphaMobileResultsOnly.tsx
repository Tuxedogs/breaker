import { estimateArmorInteraction, formatEntityLabel } from '../../lib/calculations'
import { getShipThumbnailCandidates } from '../../lib/ships/thumbnail'
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

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function getEffectivePenetrationSummaryColor(pct: number): string {
  const p = Math.max(0, Math.min(100, Math.round(pct)))

  if (p >= 100) return 'rgb(74 222 128)'
  if (p >= 75) {
    const t = (p - 75) / 24
    return `hsl(${lerp(43, 52, t)} ${lerp(86, 92, t)}% ${lerp(46, 56, t)}%)`
  }
  if (p >= 50) {
    const t = (p - 50) / 25
    return `hsl(${lerp(26, 45, t)} ${lerp(90, 86, t)}% ${lerp(48, 46, t)}%)`
  }
  if (p >= 1) {
    const t = (p - 1) / 48
    return `hsl(${lerp(0, 22, t)} ${lerp(62, 88, t)}% ${lerp(28, 48, t)}%)`
  }
  return 'hsl(0 58% 28%)'
}

export function AlphaMobileResultsOnly({ ships, selectedWeapons, shieldMode }: Props) {
  return (
    <section className="alpha-mobile-results" aria-label="Mobile comparison results">
      <div className="alpha-mobile-result-list">
        {ships.map((ship, shipIndex) => {
          if (isPlaceholderShip(ship)) return null
          const shipThumb = getShipThumbnailCandidates(ship)[0]

          return (
            <article key={`mobile-result-${ship.id}-${shipIndex}`} className="alpha-mobile-result-card">
              <div className="alpha-mobile-result-media" aria-hidden="true">
                <img src={shipThumb.src} alt="" loading="lazy" />
                <div className="alpha-mobile-result-media-header">
                  <h3>{formatEntityLabel(ship.name)}</h3>
                  <p>
                    {formatEntityLabel(ship.manufacturer)} · {formatEntityLabel(ship.role ?? 'Utility')}
                  </p>
                </div>
                <div className="alpha-mobile-result-media-copy">
                  <div className="alpha-mobile-result-overlay-list">
                    {selectedWeapons.map((selection) => {
                      if (isPlaceholderWeapon(selection)) return null
                      const estimate = estimateArmorInteraction(selection.weapon, ship, shieldMode)
                      const effectivePct = Math.round(
                        estimate.damagesFreshArmor || estimate.armorDamageStartsAtPercent === 100
                          ? 100
                          : estimate.armorDamageStartsAtPercent ?? 0
                      )
                      return (
                        <div key={`${ship.id}-${selection.slotId}`} className="alpha-mobile-result-overlay-row">
                          <p className="alpha-mobile-result-weapon">{formatEntityLabel(selection.weapon.name)}</p>
                          <p
                            className="alpha-mobile-result-stats"
                            style={{ color: getEffectivePenetrationSummaryColor(effectivePct) }}
                          >
                            <span>E{effectivePct}</span>
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
