import type { DefenseShieldState, SelectedWeaponComparison, Ship } from '../types'
import { AlphaMobileControlStrip } from './mobile/AlphaMobileControlStrip'
import { AlphaMobileResultsOnly } from './mobile/AlphaMobileResultsOnly'

type Props = {
  ships: Ship[]
  selectedWeapons: SelectedWeaponComparison[]
  shieldMode: DefenseShieldState
  shipCount?: number
  weaponCount?: number
  onShieldModeChange: (mode: DefenseShieldState) => void
  onOpenShips: () => void
  onOpenWeapons: () => void
}

export function MobileThresholdComparisonLayout({
  ships,
  selectedWeapons,
  shieldMode,
  shipCount,
  weaponCount,
  onShieldModeChange,
  onOpenShips,
  onOpenWeapons,
}: Props) {
  const shipSelectionCount = ships.filter((ship) => ship.name !== '' && ship.manufacturer !== '').length
  const weaponSelectionCount = selectedWeapons.filter(
    (selection) => selection.weapon.name !== '' && selection.weapon.weaponClass !== ''
  ).length

  return (
    <section className="alpha-mobile-layout" aria-label="Mobile threshold comparison">
      <AlphaMobileControlStrip
        shipCount={shipCount ?? shipSelectionCount}
        weaponCount={weaponCount ?? weaponSelectionCount}
        shieldMode={shieldMode}
        onOpenShips={onOpenShips}
        onOpenWeapons={onOpenWeapons}
        onShieldModeChange={onShieldModeChange}
      />
      <AlphaMobileResultsOnly ships={ships} selectedWeapons={selectedWeapons} shieldMode={shieldMode} />
    </section>
  )
}
