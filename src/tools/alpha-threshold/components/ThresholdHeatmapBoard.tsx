import { ArmorInteractionTestbed } from './ArmorInteractionTestbed'
import type { ArmorInteractionFilterChip } from './ArmorInteractionSummaryPanel'
import type { AlphaThresholdOnboardingHighlight } from './AlphaThresholdOnboardingModal'
import type { DefenseShieldState, SelectedWeaponComparison, Ship } from '../types'

type Props = {
  ships: Ship[]
  selectedWeapons: SelectedWeaponComparison[]
  shieldMode: DefenseShieldState
  matrixMode: 'analysis' | 'target'
  selectionMode: 'ship' | 'weapon' | null
  nextShipSlotIndex: number
  nextWeaponSlotIndex: number
  onShieldModeChange: (mode: DefenseShieldState) => void
  onMatrixModeChange: (mode: 'analysis' | 'target') => void
  onOpenWeapons: () => void
  onOpenShips: () => void
  onOpenWeaponsAt?: (slotIndex: number, autoAdvance?: boolean) => void
  onOpenShipsAt?: (slotIndex: number, autoAdvance?: boolean) => void
  onWeaponHeaderChip?: (payload: { columnIndex: number; chip: ArmorInteractionFilterChip }) => void
  onboardingHighlight?: AlphaThresholdOnboardingHighlight
}

export function ThresholdHeatmapBoard({
  ships,
  selectedWeapons,
  shieldMode,
  matrixMode,
  selectionMode,
  nextShipSlotIndex,
  nextWeaponSlotIndex,
  onShieldModeChange,
  onMatrixModeChange,
  onOpenWeapons,
  onOpenShips,
  onOpenWeaponsAt,
  onOpenShipsAt,
  onWeaponHeaderChip,
  onboardingHighlight = null,
}: Props) {
  return (
    <section className="alpha-threshold-board alpha-threshold-board-app" aria-label="Weapons Analysis board">
      <ArmorInteractionTestbed
        ships={ships}
        selectedWeapons={selectedWeapons}
        shieldMode={shieldMode}
        matrixMode={matrixMode}
        selectionMode={selectionMode}
        nextShipSlotIndex={nextShipSlotIndex}
        nextWeaponSlotIndex={nextWeaponSlotIndex}
        onShieldModeChange={onShieldModeChange}
        onMatrixModeChange={onMatrixModeChange}
        onWeaponHeaderChipClick={onWeaponHeaderChip}
        onOpenWeapons={onOpenWeapons}
        onOpenShips={onOpenShips}
        onOpenWeaponsAt={onOpenWeaponsAt}
        onOpenShipsAt={onOpenShipsAt}
        onboardingHighlight={onboardingHighlight}
      />
    </section>
  )
}
